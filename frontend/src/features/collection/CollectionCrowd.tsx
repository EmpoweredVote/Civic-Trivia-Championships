import { useEffect, useMemo, useRef, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure, FieldProp, FieldEffect } from '../../components/bobbits/fieldGeometry';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useAuthStore } from '../../store/authStore';
import { useConfettiStore } from '../../store/confettiStore';
import { createLocalProgressStore, createServerProgressStore } from './bobitProgress';
import type { BobitProgressStore } from './bobitProgress';
import { crowdInit, crowdApply, crowdStep, isStunned } from './crowdReducer';
import type { CrowdState } from './crowdReducer';
import { crowdFigures, overflowCount, aerialFigures, sceneGroundY } from './crowdFigures';
import {
  directorInit, directorStep, startScene, canStage, castIds,
} from './sceneDirector';
import type { DirectorState } from './sceneDirector';
import { sceneForArrival, ALL_SCENES } from './scenes';
import { bandFor, CROWD_CAP, wanderCastFor, groundLineFromBottom } from './crowdLayout';
import {
  initAgents, agentsAdvance, syncCast, rotateCast, makeRand, rescaleTo,
} from './crowdAgents';
import type { AgentState } from './crowdAgents';
import type { Rand } from '../../components/bobbits/wanderReducer';
import type { CrowdBand } from './crowdLayout';

interface CollectionCrowdProps {
  /** Collection being played. Null before a session exists. */
  slug: string | null;
  darkMode: boolean;
  isMobile: boolean;
  /** The most recent revealed answer. A new object identity means a new answer to react to. */
  lastAnswer: { questionId: string; correct: boolean; streak: number } | null;
  /** True once the match ends with every question correct. */
  finished5of5: boolean;
  /**
   * True only while an answer is revealed.
   *
   * Gates the aerial overlay. Nothing may pass in front of the question card while the timer
   * is running and the player is aiming at an answer -- bound 2 of the four the spec's
   * 2026-09-14 addendum puts on the occlusion relaxation.
   */
  aerialAllowed?: boolean;
}

/**
 * The localStorage driver, shared across every signed-out mount: its state IS the browser's,
 * so there is nothing per-instance about it and rebuilding it would only re-read storage.
 */
const localStore = createLocalProgressStore();

/**
 * The collection crowd: one bobit per question this player has answered correctly, standing
 * in a band beneath the game.
 *
 * Never an overlay. The band sits in normal document flow so it cannot cover the question or
 * the answer options -- a hard requirement, and layout is the only way to guarantee it rather
 * than merely arrange it.
 */
export function CollectionCrowd({
  slug, darkMode, isMobile, lastAnswer, finished5of5, aerialAllowed = false,
}: CollectionCrowdProps) {
  const reducedMotion = useReducedMotion();
  // Resize-aware rather than a one-off window.innerHeight read: the overlay's height is a
  // fraction of the viewport, and a stale one would put the arc's ceiling in the wrong place.
  const { height: viewportH } = useWindowSize();
  const fireFireworks = useConfettiStore(s => s.fireFireworks);
  const userId = useAuthStore(s => s.user?.id ?? null);
  const stateRef = useRef<CrowdState>(crowdInit());
  const agentsRef = useRef<AgentState>({});
  const rotateRef = useRef(0);
  // The width the current layout was built for. Agents are seeded before the field has measured
  // itself, so this starts nominal and is corrected on the first real frame.
  const laidOutAtRef = useRef(0);
  const directorRef = useRef<DirectorState>(directorInit());
  // Read inside the frame loop, so the gate can change without rebuilding the loop.
  const allowAirRef = useRef(aerialAllowed);
  // Air actors are published from the frame loop for React to mount the overlay with. Kept as
  // STATE rather than a ref because mounting the overlay is a render, not a paint.
  const [aerial, setAerial] = useState<FieldFigure[]>([]);
  // Random by default; seedable via ?bobitSeed= so the screenshot sweep and the bench get the
  // SAME room every run. Math.random cannot be seeded, and a verification pass that cannot
  // reproduce its own input is not a verification pass.
  const randRef = useRef<Rand>(makeRand(
    new URLSearchParams(window.location.search).get('bobitSeed'),
  ));
  const [overflow, setOverflow] = useState(0);

  // Signed in: progress lives on the account. Signed out: it lives in this browser, exactly
  // as it has since Stage 3. Keyed on the user id rather than merely on truthiness, so
  // switching accounts builds a fresh store and one player's crowd can never be served to
  // the next.
  const store: BobitProgressStore = useMemo(
    () => (userId ? createServerProgressStore() : localStore),
    [userId],
  );

  const band: CrowdBand = useMemo(() => bandFor(isMobile), [isMobile]);
  const height = band.height;

  // Seed from storage whenever the collection -- or the driver behind it -- changes.
  useEffect(() => {
    if (!slug) {
      stateRef.current = crowdInit();
      agentsRef.current = {};
      directorRef.current = directorInit();
      setAerial([]);
      setOverflow(0);
      return;
    }

    let cancelled = false;
    const seed = () => {
      // A hydrate that lands after the collection changed must not seed the wrong crowd.
      if (cancelled) return;
      const owned = [...store.load(slug)];
      stateRef.current = crowdApply(stateRef.current, { type: 'seed', ids: owned });
      // A returning player's bobits are already standing there when he arrives -- they do not
      // walk in. Entrances belong to bobits earned in front of you.
      agentsRef.current = initAgents(
        stateRef.current.residents.slice(0, CROWD_CAP),
        { band, width: band.width, greeting: new Set(), frozen: false, rand: randRef.current },
      );
      rotateRef.current = 0;
      laidOutAtRef.current = band.width;
      // A returning player's bobits are already standing there. Seeding must never fire the
      // entrances -- forty owned questions would otherwise mean forty cannon shots on load.
      directorRef.current = directorInit();
      setOverflow(overflowCount(stateRef.current));
    };

    // No-op for the local driver, which has no hydrate: its mirror is already the truth.
    // Seeds either way -- a failed hydrate must still leave a definite (empty) crowd rather
    // than an indeterminate band.
    const pending = store.hydrate?.(slug);
    if (pending) pending.then(seed, seed);
    else seed();

    return () => { cancelled = true; };
  }, [slug, store, band]);

  // React to a revealed answer. Keyed on object identity, so the same question answered again
  // in a later match still registers.
  useEffect(() => {
    if (!slug || !lastAnswer) return;
    const { questionId, correct, streak } = lastAnswer;
    if (correct) {
      // The ordinal is how many this collection had already given the player, so 0 is the very
      // first ever. Captured BEFORE the grant, and only a genuinely new bobit gets an entrance
      // -- a question answered correctly a second time spawns nobody.
      const ordinal = stateRef.current.residents.length;
      const known = stateRef.current.residents.includes(questionId);
      stateRef.current = crowdApply(stateRef.current, { type: 'correct', id: questionId, streak });
      store.grant(slug, questionId);
      if (!known && !reducedMotion) {
        const scene = sceneForArrival(ordinal, randRef.current);
        const w = laidOutAtRef.current || band.width;
        if (canStage(directorRef.current, scene.span, w)) {
          directorRef.current = startScene(
            directorRef.current, scene, questionId, w, randRef.current,
          );
        }
      }
    } else {
      stateRef.current = crowdApply(stateRef.current, { type: 'wrong', id: questionId });
      // Revoke unconditionally: revoking something never owned is a no-op, and checking first
      // would duplicate the reducer's own ownership test.
      store.revoke(slug, questionId);
    }
    setOverflow(overflowCount(stateRef.current));
  }, [lastAnswer, slug, store]);

  useEffect(() => { allowAirRef.current = aerialAllowed; }, [aerialAllowed]);

  // Dev replay. The set pieces fire once per collection EVER, so there is otherwise no way to
  // see one twice -- not for building them, and not for reviewing them. That is why the spec
  // calls this a requirement rather than a convenience.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __bobitScene?: (id: string) => void };
    w.__bobitScene = (id: string) => {
      const scene = ALL_SCENES.find(sc => sc.id === id);
      if (!scene) {
        // eslint-disable-next-line no-console
        console.warn('[bobits] no such scene:', id, '— have:', ALL_SCENES.map(sc => sc.id));
        return;
      }
      const w2 = laidOutAtRef.current || band.width;
      directorRef.current = startScene(
        directorRef.current, scene, `replay-${Date.now()}`, w2, randRef.current,
      );
    };
    return () => { delete w.__bobitScene; };
  }, [band]);

  // Confetti belongs to the finish, not to a tier.
  useEffect(() => {
    if (finished5of5 && !reducedMotion) fireFireworks();
  }, [finished5of5, reducedMotion, fireFireworks]);

  const figuresFor = useMemo(() => (
    _t: number, dt: number, width: number, greeting: ReadonlySet<string>,
  ): FieldFigure[] => {
    if (!reducedMotion) {
      stateRef.current = crowdStep(stateRef.current, dt);

      // First real frame (and any resize): spread the room over the width it actually has.
      const measured = width || band.width;
      if (laidOutAtRef.current && measured !== laidOutAtRef.current) {
        agentsRef.current = rescaleTo(agentsRef.current, laidOutAtRef.current, measured);
        laidOutAtRef.current = measured;
      }

      directorRef.current = directorStep(directorRef.current, dt, sceneGroundY(band));

      // An agent the director owns is held exactly as a greeting one is: wanderAdvance must
      // not walk somebody a scene is choreographing, or the two fight over his position.
      const owned = castIds(directorRef.current);
      const held = owned.size ? new Set([...greeting, ...owned]) : greeting;

      const opts = {
        band,
        width: measured,
        greeting: held,
        // The abduction's freeze stops feet as well as poses. Rewinding the animation phase
        // alone would pin everyone mid-stride and then slide them across the floor.
        frozen: isStunned(stateRef.current),
        rand: randRef.current,
      };

      // Reconcile first: a bobit granted this frame must exist before he is advanced. The
      // cast is derived from the MEASURED width, so a phone gets a handful of wanderers and a
      // wide desktop band gets a proper crowd -- it is floor space that limits this, not CPU.
      agentsRef.current = syncCast(
        agentsRef.current, stateRef.current.residents, opts, wanderCastFor(opts.width, band),
      );

      rotateRef.current += dt;
      const rotated = rotateCast(agentsRef.current, rotateRef.current, opts);
      if (rotated !== agentsRef.current) { agentsRef.current = rotated; rotateRef.current = 0; }

      agentsRef.current = agentsAdvance(agentsRef.current, dt, opts);
    }

    const air = aerialFigures(directorRef.current, band, darkMode);
    // setState from the frame loop is cheap here because the array is empty almost always, and
    // React bails out of a re-render when the value is the same empty array identity.
    setAerial(prev => (prev.length === 0 && air.length === 0 ? prev : air));

    return crowdFigures(
      stateRef.current, agentsRef.current, band, darkMode, directorRef.current, allowAirRef.current,
    );
  }, [band, darkMode, reducedMotion]);

  // Props and effects come straight off the director. Stable identities so BobitField's refs
  // are not rebuilt every render.
  const propsFor = useMemo(() => (): FieldProp[] => directorRef.current.props.map(p => ({
    id: p.id, kind: p.kind, x: p.x, groundY: p.groundY, scale: band.scale,
    flip: p.flip, angle: p.angle,
    // Light barrel on a dark ground and vice versa. A fixed dark cannon was invisible in dark
    // mode -- it read as a smudge on the floor rather than as the joke it is.
    color: darkMode ? '#9AA6B8' : '#4A5568',
  })), [band, darkMode]);

  const effectsFor = useMemo(() => (): FieldEffect[] => directorRef.current.effects, []);

  if (!slug) return null;

  // The overlay spans the game area down to the bottom of the band, so ONE coordinate system
  // covers both: a point at band-y `yb` is at overlay-y `overlayHeight - height + yb`. Without
  // that the arc would jump at the hand-off between canvases.
  const overlayHeight = Math.max(height, Math.round(viewportH * 0.62));
  const bandToOverlay = overlayHeight - height;
  const flying = aerialAllowed && aerial.length > 0;

  return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
      {/* The air.
          A second canvas so a cannon shot can arc in front of the question card. Four bounds,
          all load-bearing (spec, 2026-09-14 addendum):
            1. Transient    -- only ever holds a figure mid-flight.
            2. Reveal only  -- `aerialAllowed` is false while the answer timer runs.
            3. Click-through -- pointerEvents none AND interactive={false}, so it installs no
               document listeners and can never intercept a click meant for an answer.
            4. Set pieces only -- pool entrances never set layer:'air'.
          UNMOUNTED whenever nothing is airborne, so in the normal case there is no second
          canvas on the page at all. */}
      {flying && (
        <div
          aria-hidden
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0,
            height: overlayHeight, pointerEvents: 'none', zIndex: 20,
          }}
        >
          <BobitField
            figures={aerial.map(f => ({ ...f, groundY: f.groundY + bandToOverlay }))}
            height={overlayHeight}
            interactive={false}
          />
        </div>
      )}
      {/* The floor.
          Behind the canvas, so figures and their shadows sit ON it. It is not decoration: with
          depth gone the crowd had nothing to stand on, which is why a jump -- a real 48-unit
          lift in the rig -- read as a wobble rather than as leaving the ground. It also gives
          the eye something to separate figures against when they pass in front of each other.
          Faded at both ends because the band is full-bleed and a hard rule edge to edge would
          read as a divider. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, right: 0,
          bottom: groundLineFromBottom(), height: 1, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent, ${
            darkMode ? 'rgba(148,163,184,0.42)' : 'rgba(71,85,105,0.38)'
          } 8%, ${
            darkMode ? 'rgba(148,163,184,0.42)' : 'rgba(71,85,105,0.38)'
          } 92%, transparent)`,
        }}
      />
      <BobitField
        figures={[]}
        figuresFor={figuresFor}
        // The director already stepped this frame inside figuresFor, which BobitField calls
        // first, so both of these read state that is current rather than a frame stale.
        propsFor={propsFor}
        effectsFor={effectsFor}
        height={height}
        interactive
      />
      {overflow > 0 && (
        <span
          style={{
            // Bottom-LEFT: the right border is where the tree's trunk goes.
            position: 'absolute', left: 8, bottom: 4,
            fontFamily: "'Manrope', sans-serif", fontSize: isMobile ? 10 : 12,
            fontWeight: 600, opacity: 0.55,
            color: darkMode ? '#94A3B8' : '#4B5768',
          }}
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}

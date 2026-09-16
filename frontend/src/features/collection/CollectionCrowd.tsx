import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure, FieldProp, FieldEffect } from '../../components/bobbits/fieldGeometry';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useAuthStore } from '../../store/authStore';
import { useConfettiStore } from '../../store/confettiStore';
import { createLocalProgressStore, createServerProgressStore } from './bobitProgress';
import { createPeakStore } from './bobitPeak';
import { treeX, TREE_GROW_SEC } from './treePlacement';
import { treeSurfaces } from '../../components/bobbits/props';
import { treeEarned } from './milestone';
import type { BobitProgressStore } from './bobitProgress';
import { crowdInit, crowdApply, crowdStep, isStunned } from './crowdReducer';
import type { CrowdState } from './crowdReducer';
import { crowdFigures, overflowCount, aerialFigures, sceneGroundY } from './crowdFigures';
import {
  directorInit, directorStep, startScene, canStage, castIds,
} from './sceneDirector';
import type { DirectorState } from './sceneDirector';
import {
  sceneForArrival, ALL_SCENES, TREE_MILESTONE, TREE_MILESTONE_MOBILE,
} from './scenes';
import { ROLE_NEWCOMER } from './scenes/types';
import type { Scene } from './scenes/types';
import {
  bandFor, CROWD_CAP, wanderCastFor, groundLineFromBottom, overlayHeightFor, overlayOffset,
} from './crowdLayout';
import {
  initAgents, agentsAdvance, syncCast, rotateCast, makeRand, rescaleTo, placeReleased,
  nearestAgent, assignPerch,
} from './crowdAgents';
import type { AgentState } from './crowdAgents';
import type { Surface } from '../../components/bobbits/fieldGeometry';
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
   * Questions in this collection: the 25% milestone's denominator.
   *
   * Null means UNKNOWN, not zero, and an unknown denominator must never earn anything -- see
   * `treeEarned`. It is null while the collection list is in flight and after a failed fetch.
   */
  questionCount?: number | null;
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
 * The milestone latch. Local even for signed-in players -- see bobitPeak.ts for why, and what
 * it costs (a tree re-earned after a browser change).
 */
const peakStore = createPeakStore();

/** Stable identity, so "nothing is flying" never causes a re-render. */
const NO_AERIAL = { figures: [] as FieldFigure[], dx: 0, dy: 0 };

/**
 * The collection crowd: one bobit per question this player has answered correctly, standing
 * in a band beneath the game.
 *
 * Never an overlay. The band sits in normal document flow so it cannot cover the question or
 * the answer options -- a hard requirement, and layout is the only way to guarantee it rather
 * than merely arrange it.
 */
/**
 * Fill a scene's roles from bobits who already live here.
 *
 * `startScene` invents a synthetic id for any role an override does not cover, and a synthetic
 * id renders as an ORPHAN -- a bobit who appears from nowhere, performs, and evaporates. That
 * was the cannon's phantom host. A scene whose roles are all existing residents, like the
 * milestone, would otherwise produce one phantom per role.
 *
 * `newcomer` is never cast here: `startScene` owns that name and fills it with the arriving
 * bobit's own id. A scene with no arrival must not use it as a role name, and `scenes.test.ts`
 * asserts the milestone does not.
 */
function castFromRoom(
  director: DirectorState, agents: AgentState, scene: Scene, width: number, newcomerId: string,
): Record<string, string> {
  const slot = canStage(director, scene.span, width);
  if (!slot) return {};
  const mid = (slot.left + slot.right) / 2;
  const taken = new Set([...castIds(director), newcomerId]);
  const out: Record<string, string> = {};
  for (const role of scene.roles) {
    if (role === ROLE_NEWCOMER) continue;
    const id = nearestAgent(agents, mid, taken);
    if (!id) break;                 // nobody left; startScene falls back to a synthetic id
    out[role] = id;
    taken.add(id);                  // two roles must never be played by the same bobit
  }
  return out;
}

export function CollectionCrowd({
  slug, darkMode, isMobile, lastAnswer, finished5of5, aerialAllowed = false,
  questionCount = null,
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
  /**
   * Airborne figures AND the band-to-overlay offset they were measured against, in one piece of
   * state. Splitting them would let a frame paint this tick's figures against last tick's
   * offset, which is a one-frame jump in exactly the place this mapping exists to prevent.
   */
  const [aerial, setAerial] = useState<{ figures: FieldFigure[]; dx: number; dy: number }>(
    NO_AERIAL,
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  // Random by default; seedable via ?bobitSeed= so the screenshot sweep and the bench get the
  // SAME room every run. Math.random cannot be seeded, and a verification pass that cannot
  // reproduce its own input is not a verification pass.
  const randRef = useRef<Rand>(makeRand(
    new URLSearchParams(window.location.search).get('bobitSeed'),
  ));
  const [overflow, setOverflow] = useState(0);
  /**
   * Whether this collection has earned its tree. State rather than a ref, because the tree
   * arriving has to cause a render -- the prop list is rebuilt from it.
   */
  const [earned, setEarned] = useState(false);
  const earnedRef = useRef(false);
  /**
   * Seconds the tree has been growing, starting at FULL HEIGHT.
   *
   * Growing is for the moment the milestone is earned, and for that moment only. Starting this
   * at zero would sprout the tree out of the floor every time the game screen mounted, so a
   * player who earned it weeks ago would watch it grow again on every match.
   */
  const growRef = useRef(TREE_GROW_SEC);
  /**
   * Has the milestone been evaluated for this collection with a REAL denominator yet?
   *
   * Without this, the first evaluation that finds the tree earned looks exactly like earning
   * it: `earnedRef` starts false, so "false -> true" fires for a player who crossed 25% weeks
   * ago. And it cannot simply be "the first call", because the first call almost always runs
   * with `questionCount` still null from its fetch.
   */
  const milestoneSettledRef = useRef(false);
  /** The milestone set piece is a one-off; a re-render must not restage it. */
  const milestoneFiredRef = useRef(false);
  /**
   * The tree's branch, or nothing. Recomputed each frame: the band's measured width changes
   * with the viewport and the trunk moves with it, so a Surface cached at mount would leave a
   * perched bobit sitting in mid-air after a resize.
   */
  const surfacesRef = useRef<Surface[]>([]);
  useEffect(() => { earnedRef.current = earned; }, [earned]);
  /**
   * Forces a repaint of the band when it is NOT animating.
   *
   * Under reduced motion there is no frame loop to pick changes up, so every edit that would
   * otherwise be drawn on the next frame -- the initial seed, a bobit granted or lost mid-match
   * -- has to say so explicitly.
   */
  const [repaintKey, setRepaintKey] = useState(0);
  const repaint = useCallback(() => setRepaintKey(k => k + 1), []);

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

  /**
   * Tell the latch how many bobits the room holds, and recompute.
   *
   * Called wherever the resident list changes -- the seed, and every answer. Recording is
   * monotonic, so calling it with a smaller number after a loss is a no-op by design.
   */
  const syncMilestone = useCallback((slugNow: string | null) => {
    if (!slugNow) { setEarned(false); return; }
    peakStore.record(slugNow, stateRef.current.residents.length);
    const qc = questionCount ?? null;
    const nowEarned = treeEarned(peakStore.peak(slugNow), qc);
    // Sprout only when the milestone is crossed while the player is WATCHING. The first
    // evaluation against a real denominator reports a state we inherited, not an event.
    const crossedLive = nowEarned && !earnedRef.current && milestoneSettledRef.current;
    if (crossedLive && !reducedMotion) {
      growRef.current = 0;
      // The ceremony belongs to the moment it is earned. A player who arrives already past 25%
      // gets the tree without it, which is correct rather than a shortfall.
      if (!milestoneFiredRef.current) {
        milestoneFiredRef.current = true;
        const w = laidOutAtRef.current || band.width;
        // A phone gets the crowd's version: no tree to gather around, so the room celebrates
        // instead. Cutting the milestone along with the tree would leave a phone player with
        // nothing but pool entrances for the rest of a collection.
        const scene = isMobile ? TREE_MILESTONE_MOBILE : TREE_MILESTONE;
        if (canStage(directorRef.current, scene.span, w)) {
          directorRef.current = startScene(
            directorRef.current, scene, `milestone-${Date.now()}`, w, randRef.current,
            castFromRoom(directorRef.current, agentsRef.current, scene, w, ''),
          );
        }
      }
    }
    if (qc !== null) milestoneSettledRef.current = true;
    setEarned(nowEarned);
  }, [questionCount, reducedMotion, band, isMobile]);


  // Seed from storage whenever the collection -- or the driver behind it -- changes.
  useEffect(() => {
    if (!slug) {
      stateRef.current = crowdInit();
      agentsRef.current = {};
      directorRef.current = directorInit();
      setAerial(NO_AERIAL);
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
      growRef.current = TREE_GROW_SEC;
      milestoneSettledRef.current = false;
      milestoneFiredRef.current = false;
      setOverflow(overflowCount(stateRef.current));
      syncMilestone(slug);
      repaint();
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
            castFromRoom(directorRef.current, agentsRef.current, scene, w, questionId),
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
    syncMilestone(slug);
    repaint();
  }, [lastAnswer, slug, store, repaint, syncMilestone]);

  useEffect(() => { allowAirRef.current = aerialAllowed; }, [aerialAllowed]);

  // questionCount arrives from a fetch, so the first evaluation almost always happens with it
  // null. Re-run when it lands, or a player at 30 of 120 would never see the tree this session.
  useEffect(() => { syncMilestone(slug ?? null); }, [slug, questionCount, syncMilestone]);

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
      const newcomer = `replay-${Date.now()}`;
      directorRef.current = startScene(
        directorRef.current, scene, newcomer, w2, randRef.current,
        castFromRoom(directorRef.current, agentsRef.current, scene, w2, newcomer),
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
    // Reconciliation happens either way. Only MOTION is skipped under reduced motion: an agent
    // still has to exist for a resident, or the accessible path renders an empty band rather
    // than a still one, which is not the same thing and is not what the spec asks for.
    const measured = width || band.width;
    if (laidOutAtRef.current && measured !== laidOutAtRef.current) {
      agentsRef.current = rescaleTo(agentsRef.current, laidOutAtRef.current, measured);
      laidOutAtRef.current = measured;
    }
    agentsRef.current = syncCast(
      agentsRef.current, stateRef.current.residents,
      { band, width: measured, greeting, frozen: false, rand: randRef.current },
      wanderCastFor(measured, band),
    );

    if (!reducedMotion) {
      stateRef.current = crowdStep(stateRef.current, dt);

      directorRef.current = directorStep(directorRef.current, dt, sceneGroundY(band));

      if (earnedRef.current) growRef.current = Math.min(TREE_GROW_SEC, growRef.current + dt);

      surfacesRef.current = earnedRef.current && !isMobile
        ? treeSurfaces(treeX(measured, band.scale), sceneGroundY(band), band.scale)
        : [];

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

      // AFTER syncCast, because the agent a released bobit is about to be placed on is the one
      // syncCast has just created for him, and BEFORE agentsAdvance, so his first walking frame
      // starts from his entrance's last position rather than from the seed at the band's centre.
      agentsRef.current = placeReleased(agentsRef.current, directorRef.current.released);

      rotateRef.current += dt;
      const rotated = rotateCast(agentsRef.current, rotateRef.current, opts);
      if (rotated !== agentsRef.current) { agentsRef.current = rotated; rotateRef.current = 0; }

      agentsRef.current = agentsAdvance(agentsRef.current, dt, opts);

      // After the advance, so a bobit who has just been released from a scene or finished a
      // move is eligible this frame rather than next. A no-op while the branch is claimed.
      if (surfacesRef.current.length > 0) {
        agentsRef.current = assignPerch(agentsRef.current, surfacesRef.current, opts);
      }
    }

    const air = aerialFigures(directorRef.current, band, darkMode);
    if (air.length === 0) {
      // setState from the frame loop is cheap here because the array is empty almost always,
      // and React bails out of a re-render when the value is the same identity.
      setAerial(prev => (prev.figures.length === 0 ? prev : NO_AERIAL));
    } else {
      // Measured only while something is actually flying -- a handful of frames per match --
      // so the layout read never lands on the ordinary path.
      const r = wrapRef.current?.getBoundingClientRect() ?? null;
      const vh = window.innerHeight;
      const { dx, dy } = overlayOffset(r, vh, overlayHeightFor(vh, band.height), band.height);
      setAerial({ figures: air, dx, dy });
    }

    return crowdFigures(
      stateRef.current, agentsRef.current, band, darkMode, directorRef.current,
      allowAirRef.current, surfacesRef.current,
    );
  }, [band, darkMode, reducedMotion]);

  // Props and effects come straight off the director. Stable identities so BobitField's refs
  // are not rebuilt every render.
  /**
   * The director's set pieces PLUS the room's own permanent scenery.
   *
   * The cannon is scene-owned and transient -- it leaves with the scene that placed it. The
   * tree is room-owned and persistent, which is why it is concatenated here rather than being
   * a Scene beat: a scene would end and take it away again.
   */
  const propsFor = useMemo(() => (): FieldProp[] => {
    // Light barrel on a dark ground and vice versa. A fixed dark cannon was invisible in dark
    // mode -- it read as a smudge on the floor rather than as the joke it is.
    const color = darkMode ? '#9AA6B8' : '#4A5568';
    const out: FieldProp[] = directorRef.current.props.map(p => ({
      id: p.id, kind: p.kind, x: p.x, groundY: p.groundY, scale: band.scale,
      flip: p.flip, angle: p.angle, color,
    }));
    // Desktop only: a phone band has no horizontal room for a trunk beside a crowd.
    if (earnedRef.current && !isMobile) {
      out.push({
        id: 'room:tree',
        kind: 'tree',
        x: treeX(laidOutAtRef.current || band.width, band.scale),
        groundY: sceneGroundY(band),
        scale: band.scale,
        grow: growRef.current / TREE_GROW_SEC,
        color,
      });
    }
    return out;
  }, [band, darkMode, isMobile]);

  const effectsFor = useMemo(() => (): FieldEffect[] => directorRef.current.effects, []);

  if (!slug) return null;

  // The overlay spans the game area down to the bottom of the band, so ONE coordinate system
  // covers both. The offsets come from `overlayOffset`, measured against the band's real box:
  // the overlay is fixed to the VIEWPORT while the band sits inside the game container's
  // padding, and assuming those were the same box drew a flying bobit low and to the left.
  const overlayHeight = overlayHeightFor(viewportH, height);
  const flying = aerialAllowed && aerial.figures.length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
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
            figures={aerial.figures.map(f => (
              { ...f, x: f.x + aerial.dx, groundY: f.groundY + aerial.dy }
            ))}
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
        repaintKey={repaintKey}
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

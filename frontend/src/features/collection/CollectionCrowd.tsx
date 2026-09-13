import { useEffect, useMemo, useRef, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAuthStore } from '../../store/authStore';
import { useConfettiStore } from '../../store/confettiStore';
import { createLocalProgressStore, createServerProgressStore } from './bobitProgress';
import type { BobitProgressStore } from './bobitProgress';
import { crowdInit, crowdApply, crowdStep, isStunned } from './crowdReducer';
import type { CrowdState } from './crowdReducer';
import { crowdFigures, overflowCount } from './crowdFigures';
import { bandFor, CROWD_CAP, WANDER_CAST } from './crowdLayout';
import {
  initAgents, agentsAdvance, syncCast, rotateCast, makeRand,
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
  slug, darkMode, isMobile, lastAnswer, finished5of5,
}: CollectionCrowdProps) {
  const reducedMotion = useReducedMotion();
  const fireFireworks = useConfettiStore(s => s.fireFireworks);
  const userId = useAuthStore(s => s.user?.id ?? null);
  const stateRef = useRef<CrowdState>(crowdInit());
  const agentsRef = useRef<AgentState>({});
  const rotateRef = useRef(0);
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
      stateRef.current = crowdApply(stateRef.current, { type: 'correct', id: questionId, streak });
      store.grant(slug, questionId);
    } else {
      stateRef.current = crowdApply(stateRef.current, { type: 'wrong', id: questionId });
      // Revoke unconditionally: revoking something never owned is a no-op, and checking first
      // would duplicate the reducer's own ownership test.
      store.revoke(slug, questionId);
    }
    setOverflow(overflowCount(stateRef.current));
  }, [lastAnswer, slug, store]);

  // Confetti belongs to the finish, not to a tier.
  useEffect(() => {
    if (finished5of5 && !reducedMotion) fireFireworks();
  }, [finished5of5, reducedMotion, fireFireworks]);

  const figuresFor = useMemo(() => (
    _t: number, dt: number, width: number, greeting: ReadonlySet<string>,
  ): FieldFigure[] => {
    if (!reducedMotion) {
      stateRef.current = crowdStep(stateRef.current, dt);

      const opts = {
        band,
        width: width || band.width,
        greeting,
        // The abduction's freeze stops feet as well as poses. Rewinding the animation phase
        // alone would pin everyone mid-stride and then slide them across the floor.
        frozen: isStunned(stateRef.current),
        rand: randRef.current,
      };

      // Reconcile first: a bobit granted this frame must exist before he is advanced.
      agentsRef.current = syncCast(
        agentsRef.current, stateRef.current.residents, opts, WANDER_CAST,
      );

      rotateRef.current += dt;
      const rotated = rotateCast(agentsRef.current, rotateRef.current, opts);
      if (rotated !== agentsRef.current) { agentsRef.current = rotated; rotateRef.current = 0; }

      agentsRef.current = agentsAdvance(agentsRef.current, dt, opts);
    }

    return crowdFigures(stateRef.current, agentsRef.current, band, darkMode);
  }, [band, darkMode, reducedMotion]);

  if (!slug) return null;

  return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
      <BobitField figures={[]} figuresFor={figuresFor} height={height} interactive />
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

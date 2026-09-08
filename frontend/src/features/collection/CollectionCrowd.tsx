import { useEffect, useMemo, useRef, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useConfettiStore } from '../../store/confettiStore';
import { createLocalProgressStore } from './bobitProgress';
import { crowdInit, crowdApply, crowdStep } from './crowdReducer';
import type { CrowdState } from './crowdReducer';
import { crowdFigures, overflowCount } from './crowdFigures';
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

const store = createLocalProgressStore();

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
  const stateRef = useRef<CrowdState>(crowdInit());
  const [overflow, setOverflow] = useState(0);

  const height = isMobile ? 54 : 96;
  const band: CrowdBand = useMemo(() => ({
    width: 1000,                       // nominal; figures are placed proportionally
    height,
    scale: isMobile ? 0.13 : 0.2,
  }), [height, isMobile]);

  // Seed from storage whenever the collection changes.
  useEffect(() => {
    if (!slug) { stateRef.current = crowdInit(); setOverflow(0); return; }
    const owned = [...store.load(slug)];
    stateRef.current = crowdApply(stateRef.current, { type: 'seed', ids: owned });
    setOverflow(overflowCount(stateRef.current));
  }, [slug]);

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
  }, [lastAnswer, slug]);

  // Confetti belongs to the finish, not to a tier.
  useEffect(() => {
    if (finished5of5 && !reducedMotion) fireFireworks();
  }, [finished5of5, reducedMotion, fireFireworks]);

  const figuresFor = useMemo(() => (t: number, dt: number): FieldFigure[] => {
    if (!reducedMotion) stateRef.current = crowdStep(stateRef.current, dt);
    return crowdFigures(stateRef.current, t, band, darkMode);
  }, [band, darkMode, reducedMotion]);

  if (!slug) return null;

  return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
      <BobitField figures={[]} figuresFor={figuresFor} height={height} />
      {overflow > 0 && (
        <span
          style={{
            position: 'absolute', right: 8, bottom: 4,
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

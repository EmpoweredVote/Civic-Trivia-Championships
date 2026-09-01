import { useMemo } from 'react';
import { BobbitCanvas } from './BobbitCanvas';
import type { BobbitFigureSpec } from './BobbitCanvas';
import { figColor } from './leremyRig';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface BobbitCardGreeterProps {
  darkMode: boolean;
  isMobile: boolean;
}

/**
 * A single Bobbit perched on the top edge of whatever card this is placed over — seated,
 * legs dangling onto the card below, waving hello. Render as a SIBLING of the card (inside
 * a shared position:relative wrapper), not as its descendant — the card's own overflow:hidden
 * would otherwise clip the head/arm poking up above its edge.
 */
export function BobbitCardGreeter({ darkMode, isMobile }: BobbitCardGreeterProps) {
  const animate = !useReducedMotion();
  // Same scale as every other Bobbit instance (hero trophy-carry, collections pair).
  const scale = isMobile ? 0.22 : 0.28;
  const width = isMobile ? 88 : 104;
  // seatFromTop must clear the head + raised wave arm above the seat line — kept at the
  // proportional-safe value (≈142.6 raw units * scale + margin) even while trimming other
  // spacing, since undershooting this clips the head (confirmed regression, don't repeat).
  const seatFromTop = isMobile ? 40 : 48;
  const legClearance = isMobile ? 22 : 26;
  const height = seatFromTop + legClearance;

  // Memoised: BobbitCanvas keys its rAF loop on this array's identity, so a fresh array on
  // every parent render would restart the animation clock at 0 and make the figure jump.
  const figures: BobbitFigureSpec[] = useMemo(() => [
    { anim: 'greetseat', color: figColor(0, darkMode), x: 0.5, bottom: legClearance, scale, phase: 0.6 },
  ], [darkMode, legClearance, scale]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', top: -seatFromTop, left: isMobile ? 14 : 26,
        width, height, pointerEvents: 'none', zIndex: 2,
      }}
    >
      <BobbitCanvas figures={figures} height={height} animate={animate} />
    </div>
  );
}

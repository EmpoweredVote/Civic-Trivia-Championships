import { useMemo } from 'react';
import { BobitField } from './BobitField';
import type { FieldFigure } from './fieldGeometry';
import { figColor } from './rigExtras';

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
  // Same scale as every other Bobbit instance (hero trophy-carry, collections pair).
  const scale = isMobile ? 0.22 : 0.28;
  const width = isMobile ? 88 : 104;
  // seatFromTop must clear the head + raised wave arm above the seat line — kept at the
  // proportional-safe value (≈142.6 raw units * scale + margin) even while trimming other
  // spacing, since undershooting this clips the head (confirmed regression, don't repeat).
  const seatFromTop = isMobile ? 40 : 48;
  const legClearance = isMobile ? 22 : 26;
  const height = seatFromTop + legClearance;

  const figures: FieldFigure[] = useMemo(() => [{
    id: 'card-greeter',
    anim: 'greetseat',
    color: figColor(0, darkMode),
    x: 0,
    xFrac: 0.5,
    groundY: height - legClearance,
    scale,
    phase: 0.6,
  }], [darkMode, legClearance, scale, height]);

  return (
    <div
      style={{
        position: 'absolute', top: -seatFromTop, left: isMobile ? 14 : 26,
        width, height, zIndex: 2,
      }}
    >
      <BobitField figures={figures} height={height} interactive />
    </div>
  );
}

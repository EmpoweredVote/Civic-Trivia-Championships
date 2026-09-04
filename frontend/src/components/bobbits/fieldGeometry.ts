import type { DrawOpts } from './leremyRig';

/**
 * One inhabitant of a BobitField. Positions are in field space (CSS px from the field's own
 * top-left), not page coordinates -- the field is a single canvas and everything inside it
 * shares one coordinate system.
 */
export interface FieldFigure {
  id: string;
  anim: string;
  color: string;
  x: number;
  /** px from the field's top to this figure's ground-contact line (feet, or seat when seated). */
  groundY: number;
  scale: number;
  flip?: boolean;
  /** Seconds added to the field's shared clock, so figures don't move in lockstep. */
  phase?: number;
  shadow?: boolean;
  /** Gates the destructive hold gesture. Collection bobits set this false -- a poof there
   *  means "you got this wrong", never something the player can do on purpose. */
  poofable?: boolean;
  greetable?: boolean;
  props?: DrawOpts;
}

/**
 * Pelvis height above the ground-contact point, in rig units at scale 1. Standing poses plant
 * their feet ~112 below the pelvis; seated poses barely lift off the seat. These are the same
 * two constants ev-figures.js uses (feetY - 112 * S and feetY - 8 * S).
 *
 * 'rope' is deliberately absent: that figure hangs in mid-air from his hands and has no ground
 * contact at all, so neither offset describes him -- his mode positions him directly.
 * 'paddleball' is a standing idle despite sitting among the seated poses in the rig's ORDER.
 */
const SEATED = new Set(['sit', 'read', 'greetseat', 'witsend']);

export function pelvisOffset(anim: string): number {
  return SEATED.has(anim) ? 8 : 112;
}

/**
 * Paint order: further-back figures first, so a nearer figure overlaps them. Array.prototype
 * .sort is stable in every engine we target, so equal groundY keeps insertion order and a
 * cast's declared order still reads left to right.
 */
export function sortByDepth(figures: FieldFigure[]): FieldFigure[] {
  return [...figures].sort((a, b) => a.groundY - b.groundY);
}

// Generous enough to contain a raised wave arm and a head, tight enough to be a useful
// candidate filter before the ink check. Derived from the 30x90-unit box BobbitCanvas used
// for its click target, widened slightly because that box clipped splayed limbs.
const HALF_W = 34;
const ABOVE_PELVIS = 96;

export function figureBounds(f: FieldFigure) {
  const pelvis = f.groundY - pelvisOffset(f.anim) * f.scale;
  return {
    left: f.x - HALF_W * f.scale,
    right: f.x + HALF_W * f.scale,
    top: pelvis - ABOVE_PELVIS * f.scale,
    bottom: f.groundY + 10 * f.scale,
  };
}

/**
 * A walkable/climbable ledge in field space. Declared now, consumed by nothing yet -- the seam
 * exists so the later unlockable platforms, toys and buildings can be added without reworking
 * how figures are positioned.
 */
export interface Surface {
  id: string;
  left: number;
  right: number;
  y: number;
}

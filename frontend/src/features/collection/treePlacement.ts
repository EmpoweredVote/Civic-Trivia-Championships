import {
  TREE_HALF_W, MARGIN_TREE_RIG_H, MARGIN_TREE_HALF_W,
} from '../../components/bobbits/props';

/**
 * Seconds the sapling takes to reach full height, the first time it is ever earned.
 *
 * Three, not two: the margin tree is ~868px tall at 1920x1080, and two seconds is a 434px/s
 * sprout, which reads as a jump rather than as growing.
 */
export const TREE_GROW_SEC = 3;

/**
 * Where the trunk stands.
 *
 * Hard against the right border, inset by its own half-width so nothing is clipped. The band is
 * full-bleed, so "the right border" really is the right edge of the viewport.
 *
 * `Math.max` rather than a bare subtraction so a band narrower than the tree still places it on
 * the canvas instead of off the left edge. That is not a real viewport, but it is a real first
 * frame -- the band is measured after mount, and until then its width is the nominal 1000.
 */
export function treeX(width: number, scale: number): number {
  const half = TREE_HALF_W * scale;
  return Math.max(half, width - half);
}

/**
 * The empty strip beside the question column, in real measured pixels.
 *
 * MEASURED, never recomputed from `clamp(700px, 55vw, 1500px)`. Two reasons: `band.width` is a
 * nominal 1000 and using a nominal where real pixels are needed has caused two bugs in this
 * feature already; and the real margin is narrower than the arithmetic by the scrollbar, which
 * the question area has (`overflow-y-auto`) and which no clamp calculation knows about.
 */
export interface MarginBox {
  width: number;
  height: number;
}

/**
 * Below this much margin there is no margin tree, and the room falls back to the in-band one.
 *
 * A 1024px viewport lands at ~138px, so that is the real crossover. Two renderers is the
 * accepted cost -- see the spec's section 2. The in-band tree already ships; the cost is
 * carrying it, not building it.
 */
export const MIN_TREE_MARGIN = 140;

/**
 * How big the margin tree is, or null for "there is no room -- use the in-band tree".
 *
 * The smaller of the two fits, so the tree fills the space it has and NEVER leaves it. That
 * second half is what makes bound 1 of the occlusion relaxation geometric: a tree that cannot
 * outgrow its measured margin cannot reach the question card.
 */
export function treeScale(box: MarginBox | null): number | null {
  if (!box) return null;
  if (!(box.width >= MIN_TREE_MARGIN) || !(box.height > 0)) return null;
  const heightFit = box.height / MARGIN_TREE_RIG_H;
  const widthFit = box.width / (MARGIN_TREE_HALF_W * 2);
  const scale = Math.min(heightFit, widthFit);
  return scale > 0 && Number.isFinite(scale) ? scale : null;
}

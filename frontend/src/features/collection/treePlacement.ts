import { TREE_HALF_W } from '../../components/bobbits/props';

/** Seconds the sapling takes to reach full height, the first time it is ever earned. */
export const TREE_GROW_SEC = 2;

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

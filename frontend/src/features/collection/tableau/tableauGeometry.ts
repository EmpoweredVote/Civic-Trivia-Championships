import { BLUEPRINT } from './blueprint';
import type { TableauLine, StackSide } from './blueprint';
import { curlExtent } from './curl';

/**
 * The empty strip beside the question column, in real MEASURED pixels.
 *
 * Measured, never recomputed from `clamp(700px, 55vw, 1500px)`: a nominal used where real
 * pixels are needed has caused two bugs in the bobit work already, and the real margin is
 * narrower than the arithmetic by the scrollbar the question area carries, which no clamp
 * calculation knows about.
 */
export interface MarginBox {
  width: number;
  height: number;
}

/**
 * Below this much margin there is no tableau at all.
 *
 * A 1024px viewport lands at ~138px per side, so that is the real crossover, and the spec
 * makes narrow screens fall back to the crowd celebration rather than to a second renderer.
 * This is the retired `MIN_TREE_MARGIN`'s value, kept because it is the same measurement.
 */
export const MIN_TABLEAU_MARGIN = 140;

function finitePositive(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function usable(box: MarginBox | null | undefined): MarginBox | null {
  if (!box) return null;
  if (!finitePositive(box.width) || !finitePositive(box.height)) return null;
  if (box.width < MIN_TABLEAU_MARGIN) return null;
  return box;
}

/**
 * The extreme ink one stack puts down, in rig units, AT FULL BUILD.
 *
 * At full build, deliberately. If the box were computed from what is currently standing, the
 * scale would change every four bobits and the whole tableau would shift and resize under the
 * player -- a cabin that shrinks when a tree arrives beside it. One box, one scale, for the
 * life of the collection.
 */
export function inkBox(side: StackSide): { left: number; right: number; top: number } {
  let left = 0, right = 0, top = 0;
  for (const l of BLUEPRINT) {
    if (l.side !== side) continue;
    if (l.kind === 'string') {
      // The curl is loops around a crown, not a segment: bound it from its own extent.
      const { halfW, up } = curlExtent();
      left = Math.min(left, l.x1 - halfW);
      right = Math.max(right, l.x1 + halfW);
      top = Math.max(top, l.y1 + up);
      continue;
    }
    const half1 = l.w / 2;
    const half2 = (l.w2 ?? l.w) / 2;
    left = Math.min(left, l.x1 - half1, l.x2 - half2);
    right = Math.max(right, l.x1 + half1, l.x2 + half2);
    top = Math.max(top, l.y1 + half1, l.y2 + half2);
  }
  return { left, right, top };
}

/** How far one stack may be scaled before it outgrows a box of this size. */
function fitsIn(side: StackSide, box: MarginBox): number[] {
  const b = inkBox(side);
  return [box.height / b.top, box.width / (b.right - b.left)];
}

/**
 * ONE scale for BOTH stacks, given a box for each.
 *
 * Per-side scaling was the obvious first move and it is wrong: the left stack tops out at 712
 * rig units and the right at 985, so scaling each to fill its own box would draw the cabin
 * half again as large as the tree standing next to it. The two stacks are one world and they
 * agree about how big it is.
 *
 * The shared definition of the fit. `tableauScale` adds the margin-specific minimum width on
 * top of it; the recap, which has no question column to sit beside and no fallback to demote
 * to, uses it directly. Two places computing a scale separately is how the margin tree's draw
 * and its Surfaces came to disagree by half a trunk width.
 */
export function fitScale(
  leftBox: MarginBox | null, rightBox: MarginBox | null,
): number | null {
  const fits: number[] = [];
  if (leftBox) fits.push(...fitsIn('left', leftBox));
  if (rightBox) fits.push(...fitsIn('right', rightBox));
  if (fits.length === 0) return null;
  const scale = Math.min(...fits);
  return finitePositive(scale) ? scale : null;
}

/**
 * The scale for the two MARGIN canvases beside the question column.
 *
 * Returns null when there is no usable margin at all, which is the signal for "no tableau" --
 * narrow viewport, a phone, or a margin measured while its nodes were detached.
 */
export function tableauScale(
  leftBox: MarginBox | null, rightBox: MarginBox | null,
): number | null {
  return fitScale(usable(leftBox), usable(rightBox));
}

/**
 * The stack's centre line inside its own canvas, in px.
 *
 * Each stack is pushed AWAY from the question column: the right stack's rightmost ink is flush
 * with its canvas's right edge, the left stack's leftmost ink with its canvas's left edge. The
 * gap that opens is therefore always on the card's side, which is what makes bound 1 hold by
 * construction rather than by care.
 */
export function originX(side: StackSide, canvasW: number, scale: number): number {
  const b = inkBox(side);
  return side === 'right'
    ? canvasW - b.right * scale
    : -b.left * scale;
}

/**
 * Is this stack's canvas actually going to be on screen?
 *
 * THE single predicate for "is this stack live". It decides four things that must agree: does
 * the canvas mount, are its Surfaces offered, may a crew be cast for it, and does `canvasOf`
 * route anybody to it. They were once four separate expressions and two of them drifted -- a
 * 130px left margin beside a 200px right one yielded a non-null shared scale, so surfaces and
 * crews were produced for a canvas that never mounted and everybody sent there vanished.
 */
export function stackLive(box: MarginBox | null, scale: number | null): boolean {
  return scale !== null && usable(box) !== null;
}

/** The leftmost pixel this stack puts ink on, in canvas coordinates. The bound-1 quantity. */
export function leftmostInk(side: StackSide, canvasW: number, scale: number): number {
  return originX(side, canvasW, scale) + inkBox(side).left * scale;
}

/** The rightmost pixel this stack puts ink on, in canvas coordinates. */
export function rightmostInk(side: StackSide, canvasW: number, scale: number): number {
  return originX(side, canvasW, scale) + inkBox(side).right * scale;
}

/**
 * A line's endpoints in canvas px.
 *
 * ONE definition, read by the draw, the surfaces and the build sequence. The margin tree's
 * first draft computed its draw and its Surfaces separately and they immediately drifted by
 * half a trunk width, so the seat extended past the end of the wood.
 */
export function lineEndpoints(
  line: TableauLine, ox: number, floorY: number, scale: number,
): { x1: number; y1: number; x2: number; y2: number } {
  return {
    x1: ox + line.x1 * scale,
    y1: floorY - line.y1 * scale,
    x2: ox + line.x2 * scale,
    y2: floorY - line.y2 * scale,
  };
}

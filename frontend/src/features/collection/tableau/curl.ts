import type { TableauLine } from './blueprint';
import { lineEndpoints } from './tableauGeometry';

/** Half the horizontal travel of the curl, in rig units, measured from the crown. */
export const CURL_SPAN = 120;
/** How far the curl's centre line arches above the crown. */
export const CURL_RISE = 170;
/** Radius of one loop. */
export const CURL_R = 55;

/**
 * The curl's ink box relative to the crown, in rig units.
 *
 * Separate from the path itself so `tableauGeometry` can bound the canopy without drawing it --
 * the geometry module must stay pure and cheap, and the bounds test must not depend on how
 * many sample points the path happens to use.
 */
export function curlExtent(): { halfW: number; up: number } {
  return { halfW: CURL_SPAN + CURL_R, up: CURL_RISE + CURL_R };
}

/** How many loops the curl makes across the crown. */
const LOOPS = 7;
/** Sample points per loop. Enough that the stroke reads as a curve, few enough to be cheap. */
const PER_LOOP = 24;

/**
 * The curl: a child's drawing of foliage.
 *
 * Chris, on how a kid draws a tree: trunk first, then loopy circles in green for the leaves.
 * So this is not a canopy shape -- it is a single continuous line that travels across the
 * crown while looping, exactly the gesture a hand makes scribbling leaves on.
 *
 * `t` is 0..1 and pays the line out from the crown outward, so the canopy ARRIVES rather than
 * appearing. At 0 there is no ink at all, which lets the caller animate it up out of nothing
 * with no special case -- the same contract `drawTree`'s `grow` had.
 *
 * Coordinates are rig units RELATIVE TO THE CROWN, x across and y up.
 */
export function curlPoints(t: number): Array<[number, number]> {
  const k = Math.max(0, Math.min(1, t));
  // Nothing at all at zero, rather than the single point `i <= steps` would otherwise emit.
  // One point draws no ink, so this is not a rendering fix -- it is the contract: "the string
  // has not been paid out yet" and "the string is a dot" are different states, and only the
  // first one is true before the climber reaches the crown.
  if (k <= 0) return [];
  const total = LOOPS * PER_LOOP;
  const steps = Math.floor(k * total);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / total;                      // 0..k along the whole curl
    const a = u * LOOPS * Math.PI * 2;        // the loop's own angle
    // The centre line travels left to right across the crown while arching over it.
    const cx = -CURL_SPAN + u * CURL_SPAN * 2;
    const cy = CURL_RISE * Math.sin(Math.PI * u);
    pts.push([cx + Math.cos(a) * CURL_R, cy + Math.sin(a) * CURL_R]);
  }
  return pts;
}

/**
 * The curl, stroked.
 *
 * A STROKE, not a fill: it is a piece of string. Drawn in the leaf colour the caller supplies,
 * which must be theme-derived -- a fixed green is a different kind of wrong in each theme, and
 * a fixed dark prop was invisible in dark mode on the cannon for exactly this reason.
 */
export function drawCurl(
  ctx: CanvasRenderingContext2D,
  line: TableauLine, ox: number, floorY: number, scale: number, color: string, t: number,
): void {
  const pts = curlPoints(t);
  if (pts.length < 2) return;
  const crown = lineEndpoints(line, ox, floorY, scale);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, line.w * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = crown.x1 + x * scale;
    const py = crown.y1 - y * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}

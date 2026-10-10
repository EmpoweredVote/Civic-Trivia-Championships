import type { TableauLine } from './blueprint';

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

/**
 * The curl, stroked. STUB -- Task 5 writes the real one under TDD.
 *
 * It exists now because `drawTableau` (Task 4) draws every built line and the right stack's
 * line 9 is this one, so without it that task would not compile. Drawing nothing is the
 * correct stub: `curlPoints(0)` will return no ink either, so the tableau simply has a bare
 * tree frame until Task 5 lands.
 */
export function drawCurl(
  _ctx: CanvasRenderingContext2D,
  _line: TableauLine, _ox: number, _floorY: number, _scale: number, _color: string, _t: number,
): void {
  /* Task 5 */
}

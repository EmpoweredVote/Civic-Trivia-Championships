import { linesFor } from './blueprint';
import type { TableauLine, StackSide } from './blueprint';
import { lineEndpoints } from './tableauGeometry';
import { drawCurl } from './curl';

/**
 * One line of the tableau: a tapered quad between two points.
 *
 * Tapered rather than square because a constant-width bar reads as a grey slab bolted to a
 * post -- the same lesson the margin tree's branches learned. One primitive draws every stick
 * in the blueprint, from the 44-unit trunk to the pennant that tapers to a point.
 */
export function drawStick(
  ctx: CanvasRenderingContext2D,
  line: TableauLine, ox: number, floorY: number, scale: number, color: string,
): void {
  const { x1, y1, x2, y2 } = lineEndpoints(line, ox, floorY, scale);
  const h1 = (line.w * scale) / 2;
  const h2 = ((line.w2 ?? line.w) * scale) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Unit normal to the line, so the quad's width is measured across it rather than in x.
  const nx = -dy / len, ny = dx / len;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * h1, y1 + ny * h1);
  ctx.lineTo(x2 + nx * h2, y2 + ny * h2);
  ctx.lineTo(x2 - nx * h2, y2 - ny * h2);
  ctx.lineTo(x1 - nx * h1, y1 - ny * h1);
  ctx.closePath();
  ctx.fill();
}

/**
 * One stack, as far as it has been built.
 *
 * Lowest line first, which is also build order, so a later line overlaps the joint it was
 * lashed to rather than being hidden under it.
 */
export function drawTableau(
  ctx: CanvasRenderingContext2D,
  side: StackSide, built: number,
  ox: number, floorY: number, scale: number,
  color: string, leafColor: string,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const line of linesFor(side, built)) {
    if (line.kind === 'string') drawCurl(ctx, line, ox, floorY, scale, leafColor, 1);
    else drawStick(ctx, line, ox, floorY, scale, color);
  }
  ctx.restore();
}

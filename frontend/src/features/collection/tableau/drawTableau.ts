import { linesFor } from './blueprint';
import type { TableauLine, StackSide } from './blueprint';
import { lineEndpoints } from './tableauGeometry';
import { drawCurl } from './curl';
import { lineAt, phaseAt } from './buildSequence';

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
  drawStickBetween(ctx, lineEndpoints(line, ox, floorY, scale), line, scale, color);
}

/**
 * The same quad, between endpoints somebody else computed.
 *
 * ONE definition of the shape, shared by the finished draw above and the in-flight draw of a
 * line the crew is still raising. Two definitions of one piece of geometry is how the margin
 * tree's draw and its Surfaces drifted by half a trunk width.
 */
export function drawStickBetween(
  ctx: CanvasRenderingContext2D,
  e: { x1: number; y1: number; x2: number; y2: number },
  line: TableauLine, scale: number, color: string,
): void {
  const { x1, y1, x2, y2 } = e;
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
  /** The line currently going up, if its stack is this one. Drawn after the finished lines. */
  site?: { line: TableauLine; t: number } | null,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const line of linesFor(side, built)) {
    // The line the crew is still raising is NOT standing, whatever `built` says. Drawing it
    // both ways makes the finished line snap into place and then a second copy of it get
    // dragged in and rotated into the same spot -- the build reads as a ghost rather than as
    // construction. Guarded here as well as at the call site, because a draw that cannot
    // double-paint is cheaper than a caller remembering which counter to pass.
    if (site && site.line.n === line.n) continue;
    if (line.kind === 'string') drawCurl(ctx, line, ox, floorY, scale, leafColor, 1);
    else drawStick(ctx, line, ox, floorY, scale, color);
  }

  // The line under construction, on top of everything already standing -- it is in front of
  // the structure it is being lashed to, which is where the crew are working.
  if (site && site.line.side === side) {
    if (site.line.kind === 'string') {
      const { phase, k } = phaseAt(site.line, site.t);
      if (phase === 'curl' || phase === 'done') {
        // The loops. NOTHING else: `lineAt` returns the string's final endpoints from `curl`
        // onward, so also drawing it as a line puts a green bar up through the middle of the
        // canopy for six seconds, which then vanishes at `done` when the finished path takes
        // over and draws only loops. A stem that pops out of existence is worse than no stem.
        drawCurl(ctx, site.line, ox, floorY, scale, leafColor, phase === 'curl' ? k : 1);
      } else {
        // Still being paid out: a plain line following the climber up to the crown.
        const e = lineAt(site.line, site.t, ox, floorY, scale);
        if (e) drawStickBetween(ctx, e, site.line, scale, leafColor);
      }
    } else {
      const e = lineAt(site.line, site.t, ox, floorY, scale);
      if (e) drawStickBetween(ctx, e, site.line, scale, color);
    }
  }
  ctx.restore();
}

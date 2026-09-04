import { figureBounds, sortByDepth } from './bobitField';
import type { FieldFigure } from './bobitField';

/**
 * Confirms the point lands on painted ink for this specific figure.
 *
 * Injected rather than fixed so the selection logic is testable with no canvas. The real
 * implementation renders the one candidate to a reusable scratch canvas and reads its alpha,
 * which is why this returns a boolean per figure rather than "is there ink here" -- on a
 * single shared field canvas, alpha at a point cannot say WHICH figure painted it.
 *
 * ev-figures.js solves the same problem differently: it walks fourteen separate canvases and
 * reads alpha on each, so the canvas itself identifies the figure. That does not survive the
 * move to one field.
 */
export type InkProbe = (figure: FieldFigure, px: number, py: number) => boolean;

/** Figures whose bounding box contains the point, topmost (last-painted) first. */
export function boundsCandidates(figures: FieldFigure[], px: number, py: number): FieldFigure[] {
  const painted = sortByDepth(figures);
  const out: FieldFigure[] = [];
  for (let i = painted.length - 1; i >= 0; i--) {
    const b = figureBounds(painted[i]);
    if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) out.push(painted[i]);
  }
  return out;
}

/**
 * The figure under this point, or null. Boxes filter the candidates cheaply; the probe then
 * confirms ink on at most one figure at a time, stopping at the first hit -- so a crowded
 * field costs one render per hit test, not one per figure.
 */
export function figureAtPoint(
  figures: FieldFigure[], px: number, py: number, probe: InkProbe,
): FieldFigure | null {
  for (const c of boundsCandidates(figures, px, py)) {
    if (probe(c, px, py)) return c;
  }
  return null;
}

import type { FieldFigure } from './fieldGeometry';

/**
 * The post-poof exodus. Everyone left on the field bolts for the nearer edge and does not
 * come back until the page reloads.
 *
 * This is a deliberately reduced port. ev-figures.js's flee is its largest single behaviour
 * -- figures fall onto measured section-break lines, limp, and drop props that keep rolling
 * -- because it runs over a whole scrolling landing page. `sectionBreakLines()` reads
 * document-flow geometry that does not exist inside a fixed-height field canvas, so what
 * carries over is the arc (freeze, drop, scatter, gone), not the page-specific physics.
 */

/** How fast the room bolts. Faster than any gait: this is a scramble, not a walk. */
export const FLEE_SPEED = 210;

/** How far past the edge a figure must get before he counts as gone. */
export const FLEE_MARGIN = 70;

export type FleeState = Record<string, { dir: -1 | 1; x: number; startedAt: number; gone: boolean }>;

/**
 * Everyone still on the field runs for their nearer edge. The victim is excluded: the burst
 * already took him, and he has no position left to run from.
 */
export function armFlee(
  figures: FieldFigure[], victimId: string | null, fieldWidth: number,
): FleeState {
  const out: FleeState = {};
  for (const f of figures) {
    if (f.id === victimId) continue;
    out[f.id] = { dir: f.x < fieldWidth / 2 ? -1 : 1, x: f.x, startedAt: 0, gone: false };
  }
  return out;
}

export function fleeAdvance(state: FleeState, dt: number, fieldWidth: number): FleeState {
  const out: FleeState = {};
  for (const id of Object.keys(state)) {
    const e = state[id];
    if (e.gone) { out[id] = e; continue; }
    const x = e.x + e.dir * FLEE_SPEED * dt;
    const gone = e.dir > 0 ? x > fieldWidth + FLEE_MARGIN : x < -FLEE_MARGIN;
    out[id] = { ...e, x, startedAt: e.startedAt + dt, gone };
  }
  return out;
}

export function allGone(state: FleeState): boolean {
  return Object.keys(state).every(id => state[id].gone);
}

/**
 * Stroll / pause / look-around wandering for a decorative rail.
 *
 * ev-figures.js's wanderer walks one figure clean across the viewport (`av.x += av.dir *
 * av.speed * dt`) and retires it off-screen for 14-22s before the next appears. A CTC rail is
 * a few hundred px wide and always populated, so this turns at the bounds instead of retiring,
 * and adds a pause beat -- without it, a short rail reads as a metronome.
 *
 * Pure and immutable, like every other reducer here. Randomness is injected so phase lengths
 * and turns are seedable under test.
 */

/**
 * Travel speed in RIG UNITS per second, so it scales with the figure rather than the viewport.
 * ev-figures.js pairs `stroll` with 32 px/s at its S = 0.32 (GSPEED, ev-figures.js:1616),
 * which is 100 units/s. A figure's px/s is WANDER_UNITS_PER_SEC * scale.
 */
export const WANDER_UNITS_PER_SEC = 100;

/** Seconds a walk leg lasts, before a pause. */
export const WALK_MIN = 2.2;
export const WALK_MAX = 5.5;

/** Seconds a pause lasts. Long enough to read as "looking around", short enough not to stall. */
export const PAUSE_MIN = 1.2;
export const PAUSE_MAX = 3.0;

/**
 * Closest two wanderers may come, in rig units. fieldGeometry's HALF_W is 34, so two figures
 * at 68 are already touching; 76 leaves a visible sliver between them.
 */
export const MIN_SEPARATION = 76;

/** Matches fieldGeometry's HALF_W: no part of a figure may cross the rail edge. */
const EDGE_MARGIN_UNITS = 34;

export type WanderPhase = 'walk' | 'pause';

export interface Wanderer {
  /** px in field space. */
  x: number;
  dir: 1 | -1;
  phase: WanderPhase;
  /** Seconds spent in the current phase. */
  t: number;
  /** Seconds the current phase lasts. */
  next: number;
}

export type WanderState = Record<string, Wanderer>;

export type Rand = () => number;

export interface WanderOpts {
  /** Measured field width in px. */
  width: number;
  /** Figure scale, for converting unit speeds and gaps into px. */
  scale: number;
  /**
   * Ids currently greeting -- hovered, or still inside the greet linger. These hold still:
   * ev-figures.js gates its walker the same way (`if (!e.greet) av.x += ...`), so hovering
   * interrupts the walk rather than running a walk cycle on the spot.
   */
  greeting: ReadonlySet<string>;
  rand: Rand;
}

function span(min: number, max: number, rand: Rand): number {
  return min + (max - min) * rand();
}

export function initWander(
  seeds: Array<{ id: string; x: number; dir: 1 | -1 }>, rand: Rand,
): WanderState {
  const out: WanderState = {};
  for (const s of seeds) {
    out[s.id] = { x: s.x, dir: s.dir, phase: 'walk', t: 0, next: span(WALK_MIN, WALK_MAX, rand) };
  }
  return out;
}

export function wanderAdvance(state: WanderState, dt: number, opts: WanderOpts): WanderState {
  const { width, scale, greeting, rand } = opts;
  const margin = EDGE_MARGIN_UNITS * scale;
  const minGap = MIN_SEPARATION * scale;
  const speed = WANDER_UNITS_PER_SEC * scale;
  const ids = Object.keys(state);
  const out: WanderState = {};

  for (const id of ids) {
    const e = state[id];

    // Greeting: frozen where it stands, phase timer included. Resuming mid-leg afterwards is
    // deliberate -- it looks like being interrupted, not like restarting.
    if (greeting.has(id)) { out[id] = e; continue; }

    const t = e.t + dt;

    if (t >= e.next) {
      const phase: WanderPhase = e.phase === 'walk' ? 'pause' : 'walk';
      // A fresh direction is chosen on the way OUT of a pause, so the look-around beat is
      // what hides the turn.
      const dir: 1 | -1 = phase === 'walk' ? (rand() < 0.5 ? -1 : 1) : e.dir;
      const next = phase === 'walk'
        ? span(WALK_MIN, WALK_MAX, rand)
        : span(PAUSE_MIN, PAUSE_MAX, rand);
      out[id] = { ...e, phase, dir, t: 0, next };
      continue;
    }

    if (e.phase === 'pause') { out[id] = { ...e, t }; continue; }

    let x = e.x + e.dir * speed * dt;
    let dir = e.dir;

    // Turn at the bounds rather than stopping: a figure pinned against an invisible wall
    // looks broken, one that turns looks like it changed its mind.
    if (x < margin) { x = margin; dir = 1; }
    else if (x > width - margin) { x = width - margin; dir = -1; }

    // Hold position and turn rather than closing inside the minimum gap. Compared against
    // each other figure's already-committed position this frame where one exists, and its
    // previous position otherwise, so two figures walking at each other both turn together.
    for (const other of ids) {
      if (other === id) continue;
      const ox = (out[other] ?? state[other]).x;
      const closing = Math.abs(x - ox) < Math.abs(e.x - ox);
      if (Math.abs(x - ox) < minGap && closing) {
        x = e.x;
        dir = e.x < ox ? -1 : 1;
        break;
      }
    }

    out[id] = { ...e, x, dir, t };
  }

  return out;
}

/** Which rig animation a wanderer plays in its current phase. */
export function wanderAnim(e: Wanderer): string {
  return e.phase === 'walk' ? 'stroll' : 'standstill';
}

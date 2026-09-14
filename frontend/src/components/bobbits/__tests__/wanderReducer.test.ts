import { describe, it, expect } from 'vitest';
import {
  initWander, wanderAdvance, wanderAnim,
  WANDER_UNITS_PER_SEC, WALK_MIN, PAUSE_MIN, MIN_SEPARATION,
} from '../wanderReducer';
import type { WanderState, Rand } from '../wanderReducer';

/** Deterministic rand: cycles a fixed list so phase lengths and turns are predictable. */
function seq(values: number[]): Rand {
  let i = 0;
  return () => values[i++ % values.length];
}

const OPTS = (over: Partial<{ width: number; scale: number; greeting: Set<string>; rand: Rand }> = {}) => ({
  width: 400,
  scale: 1,
  greeting: new Set<string>(),
  rand: seq([0.5]),
  ...over,
});

describe('initWander', () => {
  it('seeds every figure walking', () => {
    const s = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0.5]));
    expect(s.a.phase).toBe('walk');
    expect(s.a.x).toBe(100);
    expect(s.a.dir).toBe(1);
    expect(s.a.t).toBe(0);
  });

  it('gives the first walk a duration inside the walk band', () => {
    const s = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));
    expect(s.a.next).toBeCloseTo(WALK_MIN, 5);
  });
});

describe('wanderAdvance — walking', () => {
  it('travels at the unit speed times the figure scale', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ scale: 0.5 }));
    expect(s1.a.x).toBeCloseTo(100 + WANDER_UNITS_PER_SEC * 0.5, 5);
  });

  it('travels leftward when dir is -1', () => {
    const s0 = initWander([{ id: 'a', x: 200, dir: -1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ scale: 1 }));
    expect(s1.a.x).toBeCloseTo(200 - WANDER_UNITS_PER_SEC, 5);
  });

  it('does not mutate the previous state', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0.5]));
    wanderAdvance(s0, 1, OPTS());
    expect(s0.a.x).toBe(100);
  });
});

describe('wanderAdvance — rail bounds', () => {
  it('turns rather than leaving the right edge', () => {
    const s0 = initWander([{ id: 'a', x: 395, dir: 1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ width: 400, scale: 1 }));
    expect(s1.a.dir).toBe(-1);
    expect(s1.a.x).toBeLessThanOrEqual(400);
  });

  it('turns rather than leaving the left edge', () => {
    const s0 = initWander([{ id: 'a', x: 5, dir: -1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ width: 400, scale: 1 }));
    expect(s1.a.dir).toBe(1);
    expect(s1.a.x).toBeGreaterThanOrEqual(0);
  });

  it('never escapes the rail over a long run', () => {
    let s: WanderState = initWander([{ id: 'a', x: 200, dir: 1 }], seq([0.3, 0.7]));
    const opts = OPTS({ width: 400, scale: 1, rand: seq([0.3, 0.7]) });
    for (let i = 0; i < 2000; i++) {
      s = wanderAdvance(s, 1 / 60, opts);
      expect(s.a.x).toBeGreaterThanOrEqual(0);
      expect(s.a.x).toBeLessThanOrEqual(400);
    }
  });
});

describe('wanderAdvance — phases', () => {
  it('switches to pause when the walk timer expires', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));   // next = WALK_MIN
    const s1 = wanderAdvance(s0, WALK_MIN + 0.01, OPTS());
    expect(s1.a.phase).toBe('pause');
    expect(s1.a.t).toBe(0);
  });

  it('holds position through the pause', () => {
    let s = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));
    s = wanderAdvance(s, WALK_MIN + 0.01, OPTS());
    const paused = s.a.x;
    s = wanderAdvance(s, 0.5, OPTS());
    expect(s.a.phase).toBe('pause');
    expect(s.a.x).toBe(paused);
  });

  it('returns to walking when the pause expires', () => {
    let s = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));
    s = wanderAdvance(s, WALK_MIN + 0.01, OPTS({ rand: seq([0]) }));
    s = wanderAdvance(s, PAUSE_MIN + 0.01, OPTS({ rand: seq([0]) }));
    expect(s.a.phase).toBe('walk');
  });
});

describe('wanderAdvance — greeting figures hold still', () => {
  it('does not advance a greeting figure', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ greeting: new Set(['a']) }));
    expect(s1.a.x).toBe(100);
  });

  it('holds the phase timer too, so a hovered figure does not silently change phase', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));
    const s1 = wanderAdvance(s0, WALK_MIN + 5, OPTS({ greeting: new Set(['a']) }));
    expect(s1.a.phase).toBe('walk');
    expect(s1.a.t).toBe(0);
  });

  it('advances a figure that is not the greeting one', () => {
    const s0 = initWander([
      { id: 'a', x: 100, dir: 1 },
      { id: 'b', x: 300, dir: 1 },
    ], seq([0.5]));
    const s1 = wanderAdvance(s0, 0.1, OPTS({ greeting: new Set(['a']) }));
    expect(s1.a.x).toBe(100);
    expect(s1.b.x).toBeGreaterThan(300);
  });
});

describe('wanderAdvance — separation', () => {
  it('never lets two figures close inside the minimum gap', () => {
    let s: WanderState = initWander([
      { id: 'a', x: 180, dir: 1 },
      { id: 'b', x: 180 + MIN_SEPARATION, dir: -1 },
    ], seq([0.5]));
    const opts = OPTS({ width: 400, scale: 1, rand: seq([0.5]) });
    for (let i = 0; i < 600; i++) {
      s = wanderAdvance(s, 1 / 60, opts);
      expect(Math.abs(s.a.x - s.b.x)).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-6);
    }
  });

  it('turns a figure that would close the gap', () => {
    const s0: WanderState = {
      a: { x: 200, dir: 1, phase: 'walk', t: 0, next: 99 },
      b: { x: 200 + MIN_SEPARATION, dir: -1, phase: 'walk', t: 0, next: 99 },
    };
    const s1 = wanderAdvance(s0, 0.1, OPTS({ scale: 1 }));
    expect(s1.a.dir).toBe(-1);
  });
});

describe('wanderAnim', () => {
  it('strolls while walking', () => {
    expect(wanderAnim({ x: 0, dir: 1, phase: 'walk', t: 0, next: 3 })).toBe('stroll');
  });

  it('stands still while pausing', () => {
    expect(wanderAnim({ x: 0, dir: 1, phase: 'pause', t: 0, next: 3 })).toBe('standstill');
  });
});

describe('yielding to someone in the way', () => {
  /**
   * Two figures walking straight at each other, starting OUTSIDE the minimum gap so the
   * separation rule is what stops them. Seeding them already inside it tests nothing: the rule
   * prevents closing, it does not push apart figures that were placed too close to begin with.
   */
  const converging = () => initWander(
    [{ id: 'a', x: 100, dir: 1 }, { id: 'b', x: 100 + MIN_SEPARATION + 60, dir: -1 }],
    seq([0.5]),
  );

  it('does not flip direction every frame when hemmed in on both sides', () => {
    // The bug: the separation check broke on the FIRST blocker in id order rather than the
    // nearest, so a figure between two others got a different blocker on alternating frames
    // and reversed on each one. A figure is drawn mirrored by its direction, so that renders
    // as a stick figure vibrating on the spot.
    let s = initWander([
      { id: 'a', x: 100, dir: 1 },
      { id: 'mid', x: 108, dir: 1 },
      { id: 'c', x: 116, dir: -1 },
    ], seq([0.5]));

    const dirs: number[] = [];
    for (let i = 0; i < 40; i++) {
      s = wanderAdvance(s, 1 / 60, OPTS({ scale: 1 }));
      dirs.push(s.mid.dir);
    }
    let flips = 0;
    for (let i = 1; i < dirs.length; i++) if (dirs[i] !== dirs[i - 1]) flips++;
    expect(flips).toBeLessThanOrEqual(2);
  });

  it('stops rather than walking through, and never closes inside the gap', () => {
    let s = converging();
    let closest = Infinity;
    for (let i = 0; i < 120; i++) {
      s = wanderAdvance(s, 1 / 60, OPTS({ scale: 1 }));
      closest = Math.min(closest, Math.abs(s.a.x - s.b.x));
    }
    // One frame of travel (~1.7px each at this speed) of tolerance: the check runs after the
    // step, so the pair can be a single frame inside the line before they yield.
    expect(closest).toBeGreaterThan(MIN_SEPARATION - 5);
  });

  it('pauses on the yield, so it reads as noticing somebody', () => {
    let s = converging();
    for (let i = 0; i < 30; i++) s = wanderAdvance(s, 1 / 60, OPTS({ scale: 1 }));
    expect([s.a.phase, s.b.phase]).toContain('pause');
  });

  it('keeps the direction the yield chose instead of re-rolling back into them', () => {
    // Leaving an ordinary pause rolls a fresh direction; leaving a yield must not, or half the
    // time the figure turns straight back into whoever it just stopped for.
    let s = converging();
    for (let i = 0; i < 30; i++) s = wanderAdvance(s, 1 / 60, OPTS({ scale: 1 }));
    const yielded = s.a.phase === 'pause' ? s.a : s.b;
    const away = yielded.dir;
    // rand() = 0 would otherwise pick dir -1 on the way out of the pause.
    let t = { x: yielded } as unknown as WanderState;
    t = { x: { ...yielded, t: yielded.next } };
    const out = wanderAdvance(t, 1 / 60, OPTS({ scale: 1, rand: seq([0]) }));
    expect(out.x.phase).toBe('walk');
    expect(out.x.dir).toBe(away);
  });
});

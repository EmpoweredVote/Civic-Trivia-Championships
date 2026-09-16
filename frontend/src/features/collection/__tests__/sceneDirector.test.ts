import { describe, it, expect } from 'vitest';
import {
  directorInit, canStage, startScene, directorStep, actorsOf, castIds,
} from '../sceneDirector';
import type { Scene } from '../scenes/types';

const WIDTH = 1000;
const GROUND = 80;
const rand = () => 0.5;

const TINY: Scene = {
  id: 'tiny', duration: 2, span: 0.2, roles: ['newcomer'],
  beats: [
    { at: 0, role: 'newcomer', pose: 'splayed', moveTo: 0, layer: 'ground' },
    { at: 1, role: 'newcomer', pose: 'friendly', moveTo: 1, path: 'walk' },
  ],
};

describe('canStage', () => {
  it('finds floor in an empty room', () => {
    expect(canStage(directorInit(), 0.3, WIDTH)).not.toBeNull();
  });

  it('refuses a span that cannot fit beside what is already running', () => {
    const s = startScene(directorInit(), { ...TINY, span: 0.85 }, 'a', WIDTH, rand);
    expect(canStage(s, 0.85, WIDTH)).toBeNull();
  });

  it('finds room beside a narrow scene', () => {
    const s = startScene(directorInit(), { ...TINY, span: 0.2 }, 'a', WIDTH, rand);
    expect(canStage(s, 0.2, WIDTH)).not.toBeNull();
  });

  it('never returns overlapping ground', () => {
    let s = startScene(directorInit(), { ...TINY, span: 0.3 }, 'a', WIDTH, rand);
    s = startScene(s, { ...TINY, id: 'b', span: 0.3 }, 'b', WIDTH, rand);
    const [p, q] = s.running;
    expect(p.right <= q.left || q.right <= p.left).toBe(true);
  });
});

describe('directorStep', () => {
  it('runs a scene and then lets go of it', () => {
    let s = startScene(directorInit(), TINY, 'a', WIDTH, rand);
    expect(castIds(s).has('a')).toBe(true);
    s = directorStep(s, TINY.duration + 0.01, GROUND);
    expect(s.running).toHaveLength(0);
    expect(castIds(s).has('a')).toBe(false);
  });

  it('applies the beat in force at the current time, not a later one', () => {
    let s = startScene(directorInit(), TINY, 'a', WIDTH, rand);
    s = directorStep(s, 0.5, GROUND);
    expect(actorsOf(s, GROUND)[0].pose).toBe('splayed');
    s = directorStep(s, 0.6, GROUND);
    expect(actorsOf(s, GROUND)[0].pose).toBe('friendly');
  });

  it('walks between beat destinations rather than snapping', () => {
    const walky: Scene = {
      ...TINY, duration: 4,
      beats: [
        { at: 0, role: 'newcomer', pose: 'stroll', moveTo: 0 },
        { at: 1, role: 'newcomer', pose: 'stroll', moveTo: 1, path: 'walk' },
      ],
    };
    let s = startScene(directorInit(), walky, 'a', WIDTH, rand);
    s = directorStep(s, 1.0, GROUND);
    const start = actorsOf(s, GROUND)[0].x;
    s = directorStep(s, 0.4, GROUND);
    const mid = actorsOf(s, GROUND)[0].x;
    s = directorStep(s, 2.0, GROUND);
    const end = actorsOf(s, GROUND)[0].x;
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeLessThan(end);
  });

  it('lifts an arc off the ground and puts it back down', () => {
    const flying: Scene = {
      ...TINY, duration: 4,
      beats: [
        { at: 0, role: 'newcomer', pose: 'flail', moveTo: 0 },
        { at: 1, role: 'newcomer', pose: 'flail', moveTo: 1, path: 'arc', arcPeak: 200, layer: 'air' },
        { at: 2, role: 'newcomer', pose: 'spent', layer: 'ground' },
      ],
    };
    let s = startScene(directorInit(), flying, 'a', WIDTH, rand);
    s = directorStep(s, 1.0, GROUND);
    const grounded = actorsOf(s, GROUND)[0].y;
    s = directorStep(s, 0.5, GROUND);
    const airborne = actorsOf(s, GROUND)[0];
    expect(airborne.y).toBeLessThan(grounded - 50);
    expect(airborne.layer).toBe('air');
    s = directorStep(s, 1.0, GROUND);
    const landed = actorsOf(s, GROUND)[0];
    expect(landed.y).toBeCloseTo(GROUND, 0);
    expect(landed.layer).toBe('ground');
  });

  it('places and removes props on cue', () => {
    const withProp: Scene = {
      ...TINY, duration: 3,
      beats: [
        { at: 0, role: 'newcomer', pose: 'standstill', moveTo: 0 },
        { at: 1, role: 'newcomer', prop: { kind: 'cannon', angle: -32 } },
        { at: 2, role: 'newcomer', prop: null },
      ],
    };
    let s = startScene(directorInit(), withProp, 'a', WIDTH, rand);
    s = directorStep(s, 0.5, GROUND);
    expect(s.props).toHaveLength(0);
    s = directorStep(s, 1.0, GROUND);
    expect(s.props).toHaveLength(1);
    s = directorStep(s, 1.0, GROUND);
    expect(s.props).toHaveLength(0);
  });

  it('takes a scene prop away with the scene, even if it was never cleared', () => {
    const leaky: Scene = {
      ...TINY, duration: 2,
      beats: [
        { at: 0, role: 'newcomer', pose: 'standstill', moveTo: 0 },
        { at: 0.5, role: 'newcomer', prop: { kind: 'cannon', angle: -32 } },
      ],
    };
    let s = startScene(directorInit(), leaky, 'a', WIDTH, rand);
    s = directorStep(s, 0.6, GROUND);
    expect(s.props).toHaveLength(1);
    s = directorStep(s, 2, GROUND);
    expect(s.props).toHaveLength(0);
  });

  it('spawns an effect for a smoke beat and ages it out', () => {
    const smoky: Scene = {
      ...TINY, duration: 3,
      beats: [
        { at: 0, role: 'newcomer', pose: 'standstill', moveTo: 0 },
        { at: 0.5, role: 'newcomer', smoke: { spread: 40 } },
      ],
    };
    let s = startScene(directorInit(), smoky, 'a', WIDTH, rand);
    s = directorStep(s, 0.6, GROUND);
    expect(s.effects.length).toBeGreaterThan(0);
    s = directorStep(s, 3, GROUND);
    expect(s.effects).toHaveLength(0);
  });

  it('fires each one-shot beat exactly once, however the frames fall', () => {
    const smoky: Scene = {
      ...TINY, duration: 3,
      beats: [
        { at: 0, role: 'newcomer', pose: 'standstill', moveTo: 0 },
        { at: 0.5, role: 'newcomer', smoke: { spread: 40 } },
      ],
    };
    let s = startScene(directorInit(), smoky, 'a', WIDTH, rand);
    for (let i = 0; i < 40; i++) s = directorStep(s, 1 / 60, GROUND);
    expect(s.effects).toHaveLength(1);
  });

  it('does not mutate the state it is given', () => {
    const s = startScene(directorInit(), TINY, 'a', WIDTH, rand);
    const before = JSON.stringify(s);
    directorStep(s, 0.5, GROUND);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('a beat written at at:0', () => {
  /** pool-stumble's whole entrance is one such beat: its only smoke puff is at 0.0. */
  const POOF: Scene = {
    id: 'poof', duration: 1.5, span: 0.2, roles: ['newcomer'],
    beats: [
      { at: 0, role: 'newcomer', moveTo: 0.5, hidden: true, smoke: { spread: 30 } },
      { at: 0.4, role: 'newcomer', hidden: false, pose: 'spent' },
    ],
  };

  it('fires its side effect on the first step', () => {
    let s = startScene(directorInit(), POOF, 'a', WIDTH, rand);
    s = directorStep(s, 1 / 60, GROUND);
    expect(s.effects.filter(e => e.kind === 'smoke')).toHaveLength(1);
  });

  it('still fires it exactly once', () => {
    let s = startScene(directorInit(), POOF, 'a', WIDTH, rand);
    for (let i = 0; i < 30; i++) s = directorStep(s, 1 / 60, GROUND);
    expect(s.effects.filter(e => e.kind === 'smoke')).toHaveLength(1);
  });
});

describe('releasing a scene', () => {
  it('reports nobody until a scene actually ends', () => {
    expect(directorInit().released).toEqual([]);
    let s = startScene(directorInit(), TINY, 'a', WIDTH, rand);
    s = directorStep(s, 1 / 60, GROUND);
    expect(s.released).toEqual([]);
  });

  /**
   * The whole point: a bobit's agent is seeded at the centre of the band and only his ACTOR
   * knows where the scene walked him. Without a handoff he snaps back to centre the instant
   * his entrance ends, which is the one thing the design forbids outright.
   */
  it('hands an actor back at the x his scene left him at', () => {
    let s = startScene(directorInit(), TINY, 'a', WIDTH, rand);
    const slot = s.running[0];
    for (let i = 0; i < 200 && s.released.length === 0; i++) {
      s = directorStep(s, 1 / 60, GROUND);
    }
    expect(s.running).toHaveLength(0);
    expect(s.released.map(r => r.agentId)).toEqual(['a']);
    // TINY walks the newcomer to moveTo: 1 -- the far end of its own reserved slot.
    expect(s.released[0].x).toBeCloseTo(slot.right, 0);
  });
});

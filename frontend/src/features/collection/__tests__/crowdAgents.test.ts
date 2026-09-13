import { describe, it, expect } from 'vitest';
import {
  initAgents, agentsAdvance, castFor, homeSlot, syncCast, rotateCast, ROTATE_EVERY, makeRand,
} from '../crowdAgents';
import type { AgentOpts } from '../crowdAgents';
import { bandFor, CROWD_CAP } from '../crowdLayout';
import type { Rand } from '../../../components/bobbits/wanderReducer';

function seq(values: number[]): Rand {
  let i = 0;
  return () => values[i++ % values.length];
}

const OPTS = (over: Partial<AgentOpts> = {}): AgentOpts => ({
  band: bandFor(false),
  width: 1000,
  greeting: new Set<string>(),
  frozen: false,
  rand: seq([0.5]),
  ...over,
});

describe('initAgents', () => {
  it('seeds every id wandering, spread across the width', () => {
    const s = initAgents(['a', 'b', 'c'], OPTS());
    expect(Object.keys(s)).toEqual(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) expect(s[id].activity).toBe('wander');
    expect(s.a.x).not.toBe(s.b.x);
  });

  it('gives each agent a depth inside 0..1', () => {
    const s = initAgents(['a', 'b'], OPTS({ rand: seq([0, 0.25, 1, 0.75]) }));
    for (const id of ['a', 'b']) {
      expect(s[id].depth).toBeGreaterThanOrEqual(0);
      expect(s[id].depth).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same ids and seed', () => {
    const a = initAgents(['x', 'y'], OPTS({ rand: seq([0.3, 0.7]) }));
    const b = initAgents(['x', 'y'], OPTS({ rand: seq([0.3, 0.7]) }));
    expect(a).toEqual(b);
  });
});

describe('agentsAdvance', () => {
  it('moves wandering agents', () => {
    const s0 = initAgents(['a'], OPTS());
    const s1 = agentsAdvance(s0, 0.5, OPTS());
    expect(s1.a.x).not.toBeCloseTo(s0.a.x, 5);
  });

  it('holds a greeting agent exactly still', () => {
    const s0 = initAgents(['a'], OPTS());
    const s1 = agentsAdvance(s0, 0.5, OPTS({ greeting: new Set(['a']) }));
    expect(s1.a).toEqual(s0.a);
  });

  it('holds EVERY agent still while the room is frozen', () => {
    const s0 = initAgents(['a', 'b'], OPTS());
    const s1 = agentsAdvance(s0, 0.5, OPTS({ frozen: true }));
    expect(s1).toEqual(s0);
  });

  it('leaves ranked agents standing at their slot', () => {
    const s0 = initAgents(['a'], OPTS());
    const ranked = { a: { ...s0.a, activity: 'rank' as const, targetX: 300 } };
    const s1 = agentsAdvance(ranked, 0.5, OPTS());
    expect(s1.a.x).toBe(ranked.a.x);
    expect(s1.a.activity).toBe('rank');
  });

  it('does not mutate the state it is given', () => {
    const s0 = initAgents(['a'], OPTS());
    const before = JSON.parse(JSON.stringify(s0));
    agentsAdvance(s0, 0.5, OPTS());
    expect(s0).toEqual(before);
  });
});

describe('castFor', () => {
  it('puts everyone on stage while the room is small', () => {
    const { stage, rank } = castFor(['a', 'b', 'c'], 24);
    expect(stage).toEqual(['a', 'b', 'c']);
    expect(rank).toEqual([]);
  });

  it('gives the stage to the MOST RECENT arrivals once the room outgrows the cast', () => {
    const residents = Array.from({ length: 30 }, (_, i) => `q${i}`);   // grant order
    const { stage, rank } = castFor(residents, 24);
    expect(stage).toHaveLength(24);
    expect(rank).toHaveLength(6);
    expect(stage[stage.length - 1]).toBe('q29');
    expect(rank).toEqual(['q0', 'q1', 'q2', 'q3', 'q4', 'q5']);
  });

  it('never exceeds the crowd cap', () => {
    const residents = Array.from({ length: 140 }, (_, i) => `q${i}`);
    const { stage, rank } = castFor(residents, 24);
    expect(stage.length + rank.length).toBe(CROWD_CAP);
  });
});

describe('homeSlot', () => {
  it('derives a slot from the ID-SORTED order, not from grant order', () => {
    // Same set, different grant order -> identical home slot. This is what stops a lost and
    // re-earned bobit from moving everyone else's house.
    const band = bandFor(false);
    const a = homeSlot('q2', ['q1', 'q2', 'q3'], band);
    const b = homeSlot('q2', ['q3', 'q1', 'q2'], band);
    expect(a).toEqual(b);
  });

  it('puts ranked bobits at the back, behind the stage', () => {
    const band = bandFor(false);
    expect(homeSlot('q1', ['q1', 'q2'], band).depth).toBe(1);
  });
});

describe('syncCast', () => {
  it('adds an agent for a new resident', () => {
    const opts = OPTS();
    const s0 = initAgents(['a'], opts);
    const s1 = syncCast(s0, ['a', 'b'], opts, 24);
    expect(Object.keys(s1).sort()).toEqual(['a', 'b']);
  });

  it('drops an agent who is no longer a resident', () => {
    const opts = OPTS();
    const s0 = initAgents(['a', 'b'], opts);
    const s1 = syncCast(s0, ['a'], opts, 24);
    expect(Object.keys(s1)).toEqual(['a']);
  });

  it('demotes by WALKING, never by teleporting', () => {
    const opts = OPTS();
    const residents = ['a', 'b', 'c'];
    const s0 = initAgents(residents, opts);
    const s1 = syncCast(s0, residents, opts, 1);   // only 'c' keeps the stage
    expect(s1.a.activity).toBe('moving');
    expect(s1.a.x).toBe(s0.a.x);                   // has not moved yet
    expect(s1.a.targetDepth).toBe(1);
    expect(s1.c.activity).toBe('wander');
  });

  it('leaves an already-correct agent untouched', () => {
    const opts = OPTS();
    const s0 = initAgents(['a'], opts);
    const s1 = syncCast(s0, ['a'], opts, 24);
    expect(s1.a).toBe(s0.a);
  });
});

describe('rotateCast', () => {
  const mixed = (opts: AgentOpts) => {
    const s = initAgents(['a', 'b', 'c'], opts);
    return {
      ...s,
      a: { ...s.a, activity: 'rank' as const, depth: 1 },
      b: { ...s.b, activity: 'rank' as const, depth: 1 },
    };
  };

  it('does nothing before the interval elapses', () => {
    const opts = OPTS();
    const s = mixed(opts);
    expect(rotateCast(s, ROTATE_EVERY - 0.01, opts)).toBe(s);
  });

  it('sends one ranked bobit walking to the stage and one stage bobit back', () => {
    const opts = OPTS();
    const s = rotateCast(mixed(opts), ROTATE_EVERY, opts);
    const moving = Object.values(s).filter(a => a.activity === 'moving');
    expect(moving).toHaveLength(2);
    expect(moving.some(a => a.targetDepth >= 1)).toBe(true);    // one heading back
    expect(moving.some(a => a.targetDepth < 1)).toBe(true);     // one coming forward
  });

  it('does nothing when there are no ranks to rotate with', () => {
    const opts = OPTS();
    const s = initAgents(['a', 'b'], opts);
    expect(rotateCast(s, ROTATE_EVERY, opts)).toBe(s);
  });
});

describe('makeRand', () => {
  it('gives the same sequence for the same seed', () => {
    const a = makeRand('milwaukee');
    const b = makeRand('milwaukee');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives different sequences for different seeds', () => {
    expect(makeRand('a')()).not.toBe(makeRand('b')());
  });

  it('stays inside 0..1', () => {
    const r = makeRand('seed');
    for (let i = 0; i < 50; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('falls through to a working generator with no seed', () => {
    const r = makeRand(null);
    expect(typeof r()).toBe('number');
  });
});

describe('homeSlot — the ranks spread across the band', () => {
  it('spans the whole width rather than packing into the first few slots', () => {
    // Regression: indexing over ALL residents put the six ranked bobits in a rigid line at
    // the far left while twenty-four wandered the rest of the band. Screenshot caught it.
    const band = bandFor(false);
    const ranked = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
    const xs = ranked.map(id => homeSlot(id, ranked, band, ranked).x).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(band.width * 0.2);
    expect(xs[xs.length - 1]).toBeGreaterThan(band.width * 0.8);
  });

  it('never stands anyone flush against an edge', () => {
    const band = bandFor(false);
    const ranked = ['q1', 'q2'];
    for (const id of ranked) {
      const { x } = homeSlot(id, ranked, band, ranked);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(band.width);
    }
  });

  it('keeps ranks in id order, so the back row does not shuffle', () => {
    const band = bandFor(false);
    const ranked = ['q3', 'q1', 'q2'];
    const x1 = homeSlot('q1', ranked, band, ranked).x;
    const x2 = homeSlot('q2', ranked, band, ranked).x;
    const x3 = homeSlot('q3', ranked, band, ranked).x;
    expect(x1).toBeLessThan(x2);
    expect(x2).toBeLessThan(x3);
  });
});

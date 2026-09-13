import { describe, it, expect } from 'vitest';
import { initAgents, agentsAdvance } from '../crowdAgents';
import type { AgentOpts } from '../crowdAgents';
import { bandFor } from '../crowdLayout';
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

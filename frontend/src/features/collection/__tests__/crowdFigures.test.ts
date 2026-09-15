import { describe, it, expect } from 'vitest';
import { crowdFigures, overflowCount, aerialFigures } from '../crowdFigures';
import { directorInit, startScene, directorStep } from '../sceneDirector';
import { SWIRL } from '../scenes/arrival01Swirl';
import { CANNON } from '../scenes/arrival02Cannon';
import { crowdInit, crowdApply, crowdStep, ARRIVAL_DUR } from '../crowdReducer';
import { initAgents } from '../crowdAgents';
import { bandFor, CROWD_CAP } from '../crowdLayout';
import type { AgentOpts } from '../crowdAgents';
import type { Rand } from '../../../components/bobbits/wanderReducer';

function seq(values: number[]): Rand { let i = 0; return () => values[i++ % values.length]; }
const BAND = bandFor(false);
const OPTS: AgentOpts = {
  band: BAND, width: 1000, greeting: new Set(), frozen: false, rand: seq([0.5]),
};

describe('overflowCount', () => {
  it('is zero while the room fits under the cap', () => {
    expect(overflowCount(crowdApply(crowdInit(), { type: 'seed', ids: ['a'] }))).toBe(0);
  });

  it('counts everyone past the cap', () => {
    const ids = Array.from({ length: CROWD_CAP + 7 }, (_, i) => `q${i}`);
    expect(overflowCount(crowdApply(crowdInit(), { type: 'seed', ids }))).toBe(7);
  });
});

describe('crowdFigures', () => {
  const roomOf = (ids: string[]) => ({
    state: crowdApply(crowdInit(), { type: 'seed', ids }),
    agents: initAgents(ids, OPTS),
  });

  it('renders one figure per agent', () => {
    const { state, agents } = roomOf(['a', 'b']);
    expect(crowdFigures(state, agents, BAND, false)).toHaveLength(2);
  });

  it('takes each figure position from its agent, not from a slot', () => {
    const { state, agents } = roomOf(['a']);
    const [fig] = crowdFigures(state, agents, BAND, false);
    expect(fig.x).toBeCloseTo(agents.a.x, 5);
  });

  it('makes every crowd figure greetable and never poofable', () => {
    const { state, agents } = roomOf(['a', 'b']);
    for (const f of crowdFigures(state, agents, BAND, false)) {
      expect(f.greetable).toBe(true);
      expect(f.poofable).toBe(false);
    }
  });

  it('gives each bobit a stable colour and its own phase', () => {
    const { state, agents } = roomOf(['a', 'b']);
    const figs = crowdFigures(state, agents, BAND, false);
    expect(figs[0].color).not.toBe(figs[1].color);
    expect(figs[0].phase).not.toBe(figs[1].phase);
  });

  it('walks a wandering agent with a stroll and stands a ranked one still', () => {
    const { state, agents } = roomOf(['a']);
    const walking = { a: { ...agents.a, phase: 'walk' as const } };
    const ranked = { a: { ...agents.a, activity: 'rank' as const } };
    expect(crowdFigures(state, walking, BAND, false)[0].anim).toBe('stroll');
    expect(crowdFigures(state, ranked, BAND, false)[0].anim).toBe('standstill');
  });

  it('celebrates a correct answer across the room', () => {
    const { agents } = roomOf(['a', 'b']);
    const state = crowdApply(
      crowdApply(crowdInit(), { type: 'seed', ids: ['a', 'b'] }),
      { type: 'correct', id: 'a', streak: 3 },
    );
    const anims = crowdFigures(state, agents, BAND, false).map(f => f.anim);
    expect(anims.every(a => a === 'stroll' || a === 'standstill')).toBe(false);
  });

  it('stops drawing the victim once the burst takes him', () => {
    const ids = ['a', 'b'];
    const { agents } = roomOf(ids);
    let state = crowdApply(crowdInit(), { type: 'seed', ids });
    state = crowdApply(state, { type: 'wrong', id: 'a' });
    state = { ...state, residents: ['b'], loss: { id: 'a', phase: 'burst', t: 0 } };
    expect(crowdFigures(state, agents, BAND, false).map(f => f.id)).toEqual(['b']);
  });

  it('lifts the victim off the ground while he rises', () => {
    const ids = ['a'];
    const { agents } = roomOf(ids);
    let state = crowdApply(crowdInit(), { type: 'seed', ids });
    state = crowdApply(state, { type: 'wrong', id: 'a' });
    const start = crowdFigures(state, agents, BAND, false)[0].groundY;
    const later = crowdFigures(
      { ...state, loss: { id: 'a', phase: 'rising', t: 0.5 } }, agents, BAND, false,
    )[0].groundY;
    expect(later).toBeLessThan(start);
  });
});

describe('crowdFigures — the cap', () => {
  it('never paints more than the cap, even given more agents than that', () => {
    const ids = Array.from({ length: CROWD_CAP + 12 }, (_, i) => `q${i}`);
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    const agents = initAgents(ids, OPTS);
    expect(crowdFigures(state, agents, BAND, false)).toHaveLength(CROWD_CAP);
  });

  it('drops the same bobits every time rather than depending on insertion order', () => {
    const ids = Array.from({ length: CROWD_CAP + 12 }, (_, i) => `q${i}`);
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    const forward = initAgents(ids, OPTS);
    const backward = initAgents([...ids].reverse(), OPTS);
    const idsOf = (a: typeof forward) =>
      crowdFigures(state, a, BAND, false).map(f => f.id).sort();
    expect(idsOf(forward)).toEqual(idsOf(backward));
  });
});

describe('arrival', () => {
  it('waves hello instead of celebrating itself', () => {
    // Regression: the reducer tracked the arrival window all along, but the translator stopped
    // reading it, so a newly earned bobit just materialised and stood there.
    const ids = ['a'];
    const agents = initAgents(ids, OPTS);
    const state = crowdApply(crowdInit(), { type: 'correct', id: 'a', streak: 3 });
    expect(state.arriving.a).toBeDefined();
    expect(crowdFigures(state, agents, BAND, false)[0].anim).toBe('friendly');
  });

  it('stops waving once the arrival window closes, and joins the room', () => {
    const ids = ['a', 'b'];
    const agents = initAgents(ids, OPTS);
    let state = crowdApply(crowdInit(), { type: 'seed', ids: ['b'] });
    state = crowdApply(state, { type: 'correct', id: 'a', streak: 3 });
    const settled = crowdStep(state, ARRIVAL_DUR + 0.01);
    expect(settled.arriving.a).toBeUndefined();
    expect(crowdFigures(settled, agents, BAND, false)
      .find(f => f.id === 'a')!.anim).not.toBe('friendly');
  });

  it('never overrides the abduction -- a victim is a victim', () => {
    const ids = ['a'];
    const agents = initAgents(ids, OPTS);
    const state = {
      ...crowdApply(crowdInit(), { type: 'correct', id: 'a', streak: 1 }),
      loss: { id: 'a', phase: 'rising' as const, t: 0 },
    };
    expect(crowdFigures(state, agents, BAND, false)[0].anim).toBe('fall');
  });
});

describe('director figures', () => {
  const dirWith = (id: string) =>
    startScene(directorInit(), SWIRL, id, 1000, () => 0.5);

  it('draws a scene actor even when no agent exists for it', () => {
    const state = crowdApply(crowdInit(), { type: 'seed', ids: [] });
    // The swirl opens hidden, so step past the flash before looking.
    const dir = directorStep(dirWith('newbie'), 1.2, BAND.height - 6);
    expect(crowdFigures(state, {}, BAND, false, dir).length).toBeGreaterThan(0);
  });

  it('lets the director override the pose of an agent it has cast', () => {
    const ids = ['a'];
    const agents = initAgents(ids, OPTS);
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    const dir = directorStep(dirWith('a'), 1.2, BAND.height - 6);
    const fig = crowdFigures(state, agents, BAND, false, dir).find(f => f.id === 'a');
    expect(fig!.anim).toBe('splayed');
  });

  it('draws a cast agent exactly once', () => {
    const ids = ['a'];
    const agents = initAgents(ids, OPTS);
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    const dir = directorStep(dirWith('a'), 1.2, BAND.height - 6);
    expect(crowdFigures(state, agents, BAND, false, dir).filter(f => f.id === 'a'))
      .toHaveLength(1);
  });

  it('hides a role that has not materialised yet', () => {
    // The swirl's opening beat is hidden:true -- smoke gathering around nobody.
    const state = crowdApply(crowdInit(), { type: 'seed', ids: [] });
    const dir = directorStep(dirWith('newbie'), 0.4, BAND.height - 6);
    expect(crowdFigures(state, {}, BAND, false, dir)).toHaveLength(0);
  });

  it('keeps airborne actors off the band entirely', () => {
    // They belong to the overlay. Drawing them on both would double-paint the figure.
    let dir = startScene(directorInit(), CANNON, 'a', 1000, () => 0.5);
    dir = directorStep(dir, 5.0, BAND.height - 6);   // mid-flight
    const state = crowdApply(crowdInit(), { type: 'seed', ids: [] });
    const ground = crowdFigures(state, {}, BAND, false, dir);
    const air = aerialFigures(dir, BAND, false);
    expect(air.length).toBeGreaterThan(0);
    for (const a of air) expect(ground.map(g => g.id)).not.toContain(a.id);
  });

  it('gives airborne figures the hand variant the beat asked for', () => {
    let dir = startScene(directorInit(), CANNON, 'a', 1000, () => 0.5);
    dir = directorStep(dir, 9.9, BAND.height - 6);   // the high-five
    const figs = crowdFigures(state0(), {}, BAND, false, dir);
    const five = figs.filter(f => f.anim === 'highfive');
    expect(five.length).toBe(2);
    expect(new Set(five.map(f => f.vars?.hand))).toEqual(new Set(['R', 'L']));
  });
});

function state0() {
  return crowdApply(crowdInit(), { type: 'seed', ids: [] });
}

describe('when the sky is closed', () => {
  it('keeps a flying actor on the band instead of dropping him', () => {
    // The timer is running, so nothing may pass in front of the question card. The scene still
    // plays -- it just cannot use the sky. Skipping the actor entirely made him vanish in
    // mid-flight and reappear on landing.
    let dir = startScene(directorInit(), CANNON, 'a', 1000, () => 0.5);
    dir = directorStep(dir, 5.0, BAND.height - 6);
    const grounded = crowdFigures(state0(), {}, BAND, false, dir, false);
    expect(grounded.length).toBeGreaterThan(0);
    for (const f of grounded) {
      expect(f.groundY).toBeGreaterThanOrEqual(0);
      expect(f.groundY).toBeLessThanOrEqual(BAND.height);
    }
  });

  it('still routes him to the overlay when the sky is open', () => {
    let dir = startScene(directorInit(), CANNON, 'a', 1000, () => 0.5);
    dir = directorStep(dir, 5.0, BAND.height - 6);
    const ids = crowdFigures(state0(), {}, BAND, false, dir, true).map(f => f.id);
    // Exact ids: a substring check matches the HOST too, whose generated id contains 'cannon'.
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('scene:a');
    const air = aerialFigures(dir, BAND, false);
    expect(air.map(f => f.id)).toContain('air:a');
  });
});

import { describe, it, expect } from 'vitest';
import {
  crowdFigures, overflowCount, aerialFigures, treeFigures, heightFactor, HEIGHT_SPREAD,
  sceneGroundY,
} from '../crowdFigures';
import { directorInit, startScene, directorStep } from '../sceneDirector';
import { SWIRL } from '../scenes/arrival01Swirl';
import { CANNON } from '../scenes/arrival02Cannon';
import { POOL } from '../scenes/poolEntrances';
import { crowdInit, crowdApply, crowdStep, ARRIVAL_DUR } from '../crowdReducer';
import { initAgents, assignPerch, agentsAdvance } from '../crowdAgents';
import { bandFor, CROWD_CAP } from '../crowdLayout';
import type { AgentOpts } from '../crowdAgents';
import type { Rand } from '../../../components/bobbits/wanderReducer';
import { figureBounds } from '../../../components/bobbits/fieldGeometry';

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

  /**
   * groundY is the FEET line and a figure is drawn UPWARD from it, so clamping the feet to the
   * top of the canvas puts the entire body above it. Asserting the clamp's own range says
   * nothing about whether anybody can see him; asserting his bounds does.
   */
  it('keeps the whole figure on the canvas, not just his feet', () => {
    let dir = startScene(directorInit(), CANNON, 'a', 1000, () => 0.5);
    dir = directorStep(dir, 5.0, BAND.height - 6);
    const grounded = crowdFigures(state0(), {}, BAND, false, dir, false);
    expect(grounded.length).toBeGreaterThan(0);
    for (const f of grounded) {
      expect(figureBounds(f).top).toBeGreaterThanOrEqual(0);
      expect(figureBounds(f).bottom).toBeLessThanOrEqual(BAND.height);
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

  /**
   * The test above passes NO agents, so the band copy it should be guarding against cannot
   * exist. With a real agent it does: an airborne actor was skipped when the overlay had him,
   * which left his agent to be drawn normally -- so the bobit appeared twice for the whole
   * flight, once arcing over the card and once standing at the band's centre.
   */
  it('does not also draw him on the band while the overlay has him', () => {
    const agents = initAgents(['a'], OPTS);
    const state = crowdApply(crowdInit(), { type: 'seed', ids: ['a'] });
    let dir = startScene(directorInit(), CANNON, 'a', 1000, () => 0.5);
    dir = directorStep(dir, 5.0, BAND.height - 6);
    const ids = crowdFigures(state, agents, BAND, false, dir, true).map(f => f.id);
    expect(ids).not.toContain('a');
    expect(aerialFigures(dir, BAND, false).map(f => f.id)).toContain('air:a');
  });

  /**
   * The two canvases are gated by ONE value. They used to be gated by two copies of it -- a ref
   * the frame loop read and the prop the render read -- which could disagree for a frame, and a
   * frame is long enough to paint a bobit on both canvases or on neither.
   *
   * Making `aerialFigures` take the gate too means the pure layer cannot be asked an
   * inconsistent question: hand both functions the same value and the answer partitions.
   */
  it('puts an airborne bobit on exactly one canvas, whichever way the gate is set', () => {
    const agents = initAgents(['a'], OPTS);
    const state = crowdApply(crowdInit(), { type: 'seed', ids: ['a'] });
    let dir = startScene(directorInit(), CANNON, 'a', 1000, () => 0.5);
    dir = directorStep(dir, 5.0, BAND.height - 6);
    for (const allowAir of [true, false]) {
      const onBand = crowdFigures(state, agents, BAND, false, dir, allowAir)
        .filter(f => f.id === 'a').length;
      const inAir = aerialFigures(dir, BAND, false, allowAir)
        .filter(f => f.id === 'air:a').length;
      expect({ allowAir, drawn: onBand + inAir }).toEqual({ allowAir, drawn: 1 });
    }
  });
});

describe('a bobit coming up through the floor', () => {
  /**
   * `pool-peek` has no room below the floor line -- six pixels, then the band's bottom edge.
   * What makes it work is the canvas CLIPPING at that edge: his feet are under it and only his
   * head is on it. Asserting the offset would say nothing about whether anybody can see him,
   * so this asserts what is on the canvas and what is not.
   */
  it('puts his head on the canvas while his feet are under it', () => {
    const PEEK = POOL.find(sc => sc.id === 'pool-peek')!;
    let dir = startScene(directorInit(), PEEK, 'x', 1000, () => 0.5);
    dir = directorStep(dir, 0.45, sceneGroundY(BAND), BAND.scale);
    const fig = crowdFigures(state0(), {}, BAND, false, dir)[0];
    expect(fig, 'nobody is drawn at all').toBeDefined();
    expect(fig.groundY, 'his feet should be under the band').toBeGreaterThan(BAND.height);
    const top = figureBounds(fig).top;
    expect(top, 'his head should still be on it').toBeLessThan(BAND.height);
    expect(top, 'only his head should be, not his whole body')
      .toBeGreaterThan(BAND.height - 30);
  });

  it('has him standing on the floor like anyone else by the end', () => {
    const PEEK = POOL.find(sc => sc.id === 'pool-peek')!;
    let dir = startScene(directorInit(), PEEK, 'x', 1000, () => 0.5);
    dir = directorStep(dir, PEEK.duration - 0.1, sceneGroundY(BAND), BAND.scale);
    const fig = crowdFigures(state0(), {}, BAND, false, dir)[0];
    expect(fig.groundY).toBeCloseTo(sceneGroundY(BAND), 1);
    expect(figureBounds(fig).bottom).toBeLessThanOrEqual(BAND.height);
  });
});

describe('heightFactor', () => {
  it('is stable for an id', () => {
    expect(heightFactor('milwi-014')).toBe(heightFactor('milwi-014'));
  });

  it('stays inside the spread', () => {
    for (let i = 0; i < 200; i++) {
      const f = heightFactor(`milwi-${i}`);
      expect(f).toBeGreaterThanOrEqual(1 - HEIGHT_SPREAD);
      expect(f).toBeLessThanOrEqual(1 + HEIGHT_SPREAD);
    }
  });

  it('actually varies, and both taller and shorter than standard occur', () => {
    const fs = Array.from({ length: 60 }, (_, i) => heightFactor(`milwi-${i}`));
    expect(new Set(fs).size).toBeGreaterThan(5);
    expect(fs.some(f => f > 1.01)).toBe(true);
    expect(fs.some(f => f < 0.99)).toBe(true);
  });
});

describe('a bobit keeps his height', () => {
  const roomOf2 = (ids: string[]) => ({
    state: crowdApply(crowdInit(), { type: 'seed', ids }),
    agents: initAgents(ids, OPTS),
  });

  it('gives two different bobits two different heights', () => {
    const { state, agents } = roomOf2(['milwi-003', 'milwi-014']);
    const figs = crowdFigures(state, agents, BAND, false);
    expect(figs[0].scale).not.toBe(figs[1].scale);
  });

  /**
   * The one that matters. A newcomer is drawn from his ACTOR during his entrance and from his
   * AGENT the moment it ends; if those two paths size him differently he visibly changes
   * height at the handoff, which is worse than the teleport it replaced.
   */
  it('at the same size whether his scene is staging him or not', () => {
    const { state, agents } = roomOf2(['milwi-003', 'milwi-014']);
    const loose = crowdFigures(state, agents, BAND, false)
      .find(f => f.id === 'milwi-003');

    let d = startScene(directorInit(), SWIRL, 'milwi-003', 1000, () => 0.5);
    for (let i = 0; i < 120; i++) d = directorStep(d, 1 / 60, 80);   // past the 1.0s reveal
    const staged = crowdFigures(state, agents, BAND, false, d, false)
      .find(f => f.id === 'milwi-003');

    expect(staged).toBeDefined();
    expect(staged!.scale).toBe(loose!.scale);
  });
});

describe('a perched bobit', () => {
  const BRANCH = [{ id: 'tree:branch', left: 800, right: 880, y: 40 }];

  const perchedRoom = () => {
    const state = crowdApply(crowdInit(), { type: 'seed', ids: ['a'] });
    const agents = initAgents(['a'], OPTS);
    agents.a = { ...agents.a, x: 840, activity: 'perch', perchId: 'tree:branch', perchT: 1 };
    return { state, agents };
  };

  it('sits on the branch, not on the floor', () => {
    const { state, agents } = perchedRoom();
    const [fig] = crowdFigures(state, agents, BAND, false, undefined, true, BRANCH);
    expect(fig.groundY).toBe(40);
  });

  it('sits along the branch rather than wherever he was standing', () => {
    const { state, agents } = perchedRoom();
    agents.a = { ...agents.a, x: 120 };
    const [fig] = crowdFigures(state, agents, BAND, false, undefined, true, BRANCH);
    expect(fig.x).toBeGreaterThanOrEqual(BRANCH[0].left);
    expect(fig.x).toBeLessThanOrEqual(BRANCH[0].right);
  });

  /**
   * fieldGeometry documents this trap and it has now bitten three times, most recently in the
   * prop sheet: bounds and the ink probe measure from the BASE anim while paint positions with
   * the RESOLVED one, so a seated figure given a standing hoverAnim is drawn ~104 units away
   * from its own hit box.
   */
  it('greets without leaving its hit box', () => {
    const { state, agents } = perchedRoom();
    const [fig] = crowdFigures(state, agents, BAND, false, undefined, true, BRANCH);
    expect(fig.hoverAnim).toBe('greetseat');
  });

  it('falls back to the floor when the tree is gone', () => {
    const { state, agents } = perchedRoom();
    const [fig] = crowdFigures(state, agents, BAND, false, undefined, true, []);
    expect(fig.groundY).toBeGreaterThan(40);
    expect(fig.hoverAnim).toBeUndefined();
  });

  it('leaves a bobit on the floor alone', () => {
    const state = crowdApply(crowdInit(), { type: 'seed', ids: ['a'] });
    const agents = initAgents(['a'], OPTS);
    const [fig] = crowdFigures(state, agents, BAND, false, undefined, true, BRANCH);
    expect(fig.groundY).toBeGreaterThan(40);
    expect(fig.hoverAnim).toBeUndefined();
  });
});

describe('the three-way partition', () => {
  const SURFACES = [
    { id: 'margin-tree:branch0', left: 80, right: 240, y: 650, rootX: 230 },
    { id: 'margin-tree:branch1', left: 240, right: 370, y: 460, rootX: 250 },
    { id: 'margin-tree:branch2', left: 120, right: 240, y: 270, rootX: 230 },
  ];

  /** The tree canvas's floor line: its own height, not the band's 90. */
  const FLOOR = 868;

  /** A room with one bobit sent up the tree and settled on the lowest branch. */
  const roomWithAClimber = () => {
    const ids = ['a', 'b', 'c'];
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    let agents = initAgents(ids, OPTS);
    agents = assignPerch(agents, SURFACES, OPTS, FLOOR);
    const climber = Object.keys(agents).find(id => agents[id].perchId) as string;
    agents = agentsAdvance(agents, agents[climber].moveDur, OPTS);           // walk done
    agents = agentsAdvance(agents, (agents[climber].climbDur as number) + 0.1, OPTS);
    return { state, agents, climber };
  };

  /**
   * The property, and the reason this is one pass: an airborne bobit was once drawn on BOTH
   * canvases for the whole flight -- arcing over the card and standing on the band at the same
   * time -- because the band read a ref in the frame loop while the render read a prop. A
   * partition only holds if every side is answering the same question.
   */
  it('puts every agent on exactly one canvas', () => {
    const { state, agents } = roomWithAClimber();
    const director = directorInit();
    const band = crowdFigures(state, agents, BAND, false, director, false, [], SURFACES);
    const tree = treeFigures(state, agents, BAND, false, SURFACES, 0.868);
    const air = aerialFigures(director, BAND, false, false);

    const all = [...band, ...tree, ...air].map(f => f.id);
    expect(new Set(all).size, 'no figure on two canvases').toBe(all.length);
    expect(new Set(all)).toEqual(new Set(Object.keys(agents)));
  });

  it('draws the perched bobit on the TREE, not on the band', () => {
    const { state, agents, climber } = roomWithAClimber();
    const band = crowdFigures(state, agents, BAND, false, directorInit(), false, [], SURFACES);
    const tree = treeFigures(state, agents, BAND, false, SURFACES, 0.868);
    expect(band.map(f => f.id)).not.toContain(climber);
    expect(tree.map(f => f.id)).toContain(climber);
  });

  it('seats him on the branch, with a seated hover pose', () => {
    const { state, agents, climber } = roomWithAClimber();
    const f = treeFigures(state, agents, BAND, false, SURFACES, 0.868)
      .find(g => g.id === climber);
    expect(f).toBeDefined();
    expect(f?.anim).toBe('sit');
    expect(f?.hoverAnim).toBe('greetseat');
    expect(f?.groundY).toBeCloseTo(SURFACES[0].y, 5);
  });

  it('draws a CLIMBING bobit standing, off the floor, with no seated hover pose', () => {
    const ids = ['a'];
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    let agents = assignPerch(initAgents(ids, OPTS), SURFACES, OPTS, FLOOR);
    agents = agentsAdvance(agents, agents.a.moveDur, OPTS);
    agents = agentsAdvance(agents, (agents.a.climbDur as number) * 0.5, OPTS);

    const f = treeFigures(state, agents, BAND, false, SURFACES, 0.868)[0];
    expect(f.anim).toBe('climb');
    expect(f.hoverAnim).toBeUndefined();
    // Off the floor and not yet at the branch: genuinely mid-climb. Smaller y is higher up, so
    // he is strictly between the branch and the floor.
    expect(f.groundY).toBeLessThan(FLOOR);
    expect(f.groundY).toBeGreaterThan(SURFACES[0].y);
  });

  it('is empty when the room has no tree', () => {
    const ids = ['a', 'b'];
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    const agents = initAgents(ids, OPTS);
    expect(treeFigures(state, agents, BAND, false, [], null)).toHaveLength(0);
    // And then everyone is on the band.
    expect(crowdFigures(state, agents, BAND, false, directorInit(), false, []))
      .toHaveLength(2);
  });

  it('drops a climber back to the band if his Surface disappears mid-climb', () => {
    // A resize can take the tree's scale below MIN_TREE_MARGIN between two frames. He must
    // land on the floor rather than be drawn against a branch that no longer exists.
    const { state, agents, climber } = roomWithAClimber();
    const band = crowdFigures(state, agents, BAND, false, directorInit(), false, []);
    expect(band.map(f => f.id)).toContain(climber);
    expect(treeFigures(state, agents, BAND, false, [], null)).toHaveLength(0);
  });
});

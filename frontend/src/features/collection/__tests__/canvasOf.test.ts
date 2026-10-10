import { describe, it, expect } from 'vitest';
import { canvasOf, tableauFigures } from '../crowdFigures';
import { crowdInit } from '../crowdReducer';
import { bandFor } from '../crowdLayout';
import type { Agent, Activity } from '../crowdAgents';
import type { Surface } from '../../../components/bobbits/fieldGeometry';

const LEFT: Surface[] = [{ id: 'tableau:left:12', left: 10, right: 90, y: 300, rootX: 10 }];
const RIGHT: Surface[] = [{ id: 'tableau:right:6', left: 10, right: 90, y: 300, rootX: 90 }];

function agent(over: Partial<Agent>): Agent {
  return {
    x: 0, dir: 1, t: 0, state: 'walk', depth: 0, activity: 'wander',
    targetX: 0, targetDepth: 0, fromX: 0, fromDepth: 0, moveT: 0, moveDur: 1,
    ...over,
  } as Agent;
}

const OFF_CANVAS: Activity[] = ['climbing', 'descending', 'perch'];

describe('canvasOf — the partition', () => {
  it('leaves an ordinary wanderer on the band', () => {
    expect(canvasOf(agent({}), LEFT, RIGHT)).toBe('band');
  });

  it('sends a climber to the canvas that owns his surface', () => {
    for (const activity of OFF_CANVAS) {
      expect(canvasOf(agent({ activity, perchId: 'tableau:left:12' }), LEFT, RIGHT))
        .toBe('left');
      expect(canvasOf(agent({ activity, perchId: 'tableau:right:6' }), LEFT, RIGHT))
        .toBe('right');
    }
  });

  it('keeps a bobit who has merely CLAIMED a surface on the band until he climbs', () => {
    // perchId is claimed the instant he sets off walking, which is what stops two bobits
    // being sent to one branch. He is still on the floor until the climb starts.
    expect(canvasOf(agent({ activity: 'moving', perchId: 'tableau:left:12' }), LEFT, RIGHT))
      .toBe('band');
  });

  /**
   * REVIEW FOCUS 2 and 4. Scenery can disappear -- a resize below the threshold, a margin that
   * measured zero, a different collection, one side too narrow while the other is fine. A
   * bobit must NOT go with it. He falls back to the band rather than to nothing.
   */
  it('falls a climber back to the band when his surface has gone', () => {
    for (const activity of OFF_CANVAS) {
      expect(canvasOf(agent({ activity, perchId: 'tableau:left:12' }), [], RIGHT)).toBe('band');
      expect(canvasOf(agent({ activity, perchId: 'tableau:right:6' }), LEFT, [])).toBe('band');
      expect(canvasOf(agent({ activity, perchId: 'tableau:left:12' }), [], [])).toBe('band');
    }
  });

  it('draws a worker on his own stack, and one still walking there on the band', () => {
    expect(canvasOf(agent({ activity: 'raising', jobId: 'job:left:9' }), [], [])).toBe('left');
    expect(canvasOf(agent({ activity: 'raising', jobId: 'job:right:14' }), [], []))
      .toBe('right');
    for (const activity of ['hauling', 'raising', 'lashing'] as Activity[]) {
      expect(canvasOf(agent({ activity, jobId: 'job:left:9' }), [], [])).toBe('left');
    }
    // Claimed, not yet arrived: still the band's. The claim lands when he sets off walking.
    expect(canvasOf(agent({ activity: 'moving', jobId: 'job:left:9' }), [], [])).toBe('band');
  });

  /**
   * C1. A worker is routed to his stack's canvas by `jobId`, but he has NO `perchId` -- the
   * line he is raising is not scenery yet. `tableauFigures` positions a figure from his
   * Surface, so it looked him up, got `undefined`, and dereferenced it.
   *
   * The blast radius is why this is the first test here and not a footnote: the throw is
   * inside `figuresFor`, which `BobitField` calls from inside its rAF tick BEFORE scheduling
   * the next frame. One exception and the band's animation loop stops for the rest of the
   * match.
   *
   * Reachable on the happy path at 24 bobits: that is line 6, the tree's first branch, which
   * is the first line that is BOTH a perch (so the surface list is non-empty and the early
   * return does not fire) and built by a crew.
   */
  it('does not hand a worker to the perch renderer, which cannot position him', () => {
    const agents = {
      w: agent({ activity: 'raising', jobId: 'job:right:6', jobRole: 'hauler' }),
    };
    const band = bandFor(false);
    expect(() => tableauFigures(
      crowdInit(), agents, band, false, 'right', LEFT, RIGHT, 0.868,
    )).not.toThrow();
    // And he is not drawn here at all: `workerFigures` owns him, and a figure pushed onto
    // both lists is the double-paint this partition exists to prevent.
    expect(tableauFigures(crowdInit(), agents, band, false, 'right', LEFT, RIGHT, 0.868))
      .toHaveLength(0);
  });

  /**
   * C3. A stack that is not MOUNTED must not be handed anybody.
   *
   * The routing predicate and the mounting predicate are different questions, and they drifted:
   * surfaces and workers were produced whenever a margin had been measured, while the canvas
   * only mounted if that margin was also wide enough. An asymmetric layout -- a scrollbar on
   * one side, 130px left and 200px right -- put climbers and crews on a canvas that does not
   * exist, and they were drawn nowhere.
   *
   * This is the bug `crowdFigures`' own history note already records: "he was excluded from
   * the band and handed to a canvas that is not mounted".
   */
  it('falls a worker back to the band when his stack is not mounted', () => {
    const both = { left: true, right: true };
    expect(canvasOf(agent({ activity: 'raising', jobId: 'job:left:9' }), [], [], both))
      .toBe('left');
    expect(canvasOf(
      agent({ activity: 'raising', jobId: 'job:left:9' }), [], [], { left: false, right: true },
    )).toBe('band');
    expect(canvasOf(
      agent({ activity: 'raising', jobId: 'job:right:14' }), [], [], { left: true, right: false },
    )).toBe('band');
  });

  it('never guesses a side for a worker with no job id', () => {
    // Unreachable while claim and release move together, but a silent wrong answer is worse
    // than a fallback: it would draw him on a stack he has nothing to do with.
    expect(canvasOf(agent({ activity: 'raising' }), LEFT, RIGHT)).toBe('band');
  });

  it('is TOTAL and DISJOINT over a generated population', () => {
    const activities: Activity[] = [
      'wander', 'rank', 'moving', 'climbing', 'descending', 'perch',
      'hauling', 'raising', 'lashing',
    ];
    const perchIds = [
      undefined, 'tableau:left:12', 'tableau:right:6', 'tableau:left:99',
      'job:left:9', 'job:right:14',
    ];
    const surfaceSets: Array<[Surface[], Surface[]]> = [
      [LEFT, RIGHT], [LEFT, []], [[], RIGHT], [[], []],
    ];
    let n = 0;
    for (const activity of activities) {
      for (const perchId of perchIds) {
        for (const [l, r] of surfaceSets) {
          const got = canvasOf(agent({ activity, perchId }), l, r);
          // Total: always one of the three. Disjoint: it returns one value, so a figure
          // built from it can only be pushed onto one list.
          expect(['band', 'left', 'right'], `${activity}/${perchId}`).toContain(got);
          n++;
        }
      }
    }
    expect(n).toBe(activities.length * perchIds.length * surfaceSets.length);
  });
});

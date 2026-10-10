import { describe, it, expect } from 'vitest';
import { canvasOf } from '../crowdFigures';
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

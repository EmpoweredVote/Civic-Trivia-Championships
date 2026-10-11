import { describe, it, expect } from 'vitest';
import { assignJob, releaseJob, initAgents } from '../crowdAgents';
import { bandFor } from '../crowdLayout';

const band = bandFor(false);
const opts = {
  band, width: 1000, greeting: new Set<string>(), frozen: false,
  rand: () => 0.5,
};

describe('assignJob', () => {
  it('casts exactly as many workers as the job has roles', () => {
    const before = initAgents(['a', 'b', 'c', 'd'], opts);
    const after = assignJob(before, 'job:left:9', ['hauler', 'steadier'], 100, opts);
    const cast = Object.keys(after).filter(id => after[id].jobId === 'job:left:9');
    expect(cast).toHaveLength(2);
    expect(cast.map(id => after[id].jobRole).sort()).toEqual(['hauler', 'steadier']);
  });

  it('casts nobody at all rather than a short crew', () => {
    const before = initAgents(['a'], opts);
    const after = assignJob(before, 'job:left:9', ['hauler', 'steadier', 'lasher'], 100, opts);
    expect(after).toBe(before);
  });

  it('never casts a bobit who is already on a job, perched or climbing', () => {
    let s = initAgents(['a', 'b', 'c', 'd'], opts);
    s = assignJob(s, 'job:left:1', ['hauler'], 100, opts);
    s = { ...s, b: { ...s.b, activity: 'perch', perchId: 'tableau:right:6' } };
    const after = assignJob(s, 'job:left:2', ['hauler', 'steadier'], 100, opts);
    const cast = Object.keys(after).filter(id => after[id].jobId === 'job:left:2');
    expect(cast).toHaveLength(2);
    for (const id of cast) {
      expect(id).not.toBe('b');
      expect(after[id].jobId).toBe('job:left:2');
    }
  });

  it('gives each worker his own station when the job names one per role', () => {
    // The crew does not stand on one pixel. Each worker waits where the line will reach him,
    // so it arrives in his hands instead of snapping him to his station on the frame the
    // margin canvas takes the crew over.
    const before = initAgents(['a', 'b', 'c'], opts);
    const want: Record<string, number> = { hauler: 400, steadier: 100, lasher: 150 };
    const after = assignJob(
      before, 'job:left:9', ['hauler', 'steadier', 'lasher'], [400, 100, 150], opts,
    );
    const cast = Object.values(after).filter(a => a.jobId === 'job:left:9');
    expect(cast).toHaveLength(3);
    for (const w of cast) {
      expect(w.targetX, `the ${w.jobRole} walks to his own station`).toBe(want[w.jobRole ?? '']);
    }
  });

  it('pairs workers to stations without crossing paths', () => {
    let before = initAgents(['a', 'b'], opts);
    before = {
      ...before,
      a: { ...before.a, x: 10 },
      b: { ...before.b, x: 900 },
    };
    // Stations given in role order, far one first: the pairing must still send the bobit who
    // is already on the left to the left-hand station.
    const after = assignJob(before, 'job:left:9', ['hauler', 'steadier'], [800, 50], opts);
    expect(after.a.targetX).toBe(50);
    expect(after.a.jobRole).toBe('steadier');
    expect(after.b.targetX).toBe(800);
    expect(after.b.jobRole).toBe('hauler');
  });

  it('walks the crew to the site rather than teleporting them', () => {
    const before = initAgents(['a', 'b'], opts);
    const after = assignJob(before, 'job:left:9', ['hauler'], 400, opts);
    const worker = Object.values(after).find(a => a.jobId === 'job:left:9');
    expect(worker?.activity).toBe('moving');
    expect(worker?.targetX).toBe(400);
  });
});

describe('releaseJob', () => {
  it('returns the whole crew to wandering, with nothing left claimed', () => {
    const before = initAgents(['a', 'b', 'c'], opts);
    const working = assignJob(before, 'job:left:9', ['hauler', 'steadier'], 100, opts);
    const after = releaseJob(working, 'job:left:9');
    for (const id of Object.keys(after)) {
      expect(after[id].jobId).toBeUndefined();
      expect(after[id].jobRole).toBeUndefined();
      expect(after[id].activity).toBe('wander');
    }
  });

  it('leaves a different job\'s crew alone', () => {
    let s = initAgents(['a', 'b', 'c', 'd'], opts);
    s = assignJob(s, 'job:left:1', ['hauler'], 100, opts);
    s = assignJob(s, 'job:right:2', ['hauler'], 200, opts);
    const after = releaseJob(s, 'job:left:1');
    expect(Object.values(after).filter(a => a.jobId === 'job:right:2')).toHaveLength(1);
  });
});

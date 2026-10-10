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

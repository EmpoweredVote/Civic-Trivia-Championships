import { describe, it, expect } from 'vitest';
import { CFG, REST, computePose, clonePose, wave } from '../leremyRig';

const round = (n: number) => Math.round(n * 1000) / 1000;

describe('computePose', () => {
  it('places the pelvis at the origin plus bob', () => {
    const j = computePose({ ...REST, bob: 7 }, CFG, { x: 0, y: 0 });
    expect(round(j.P.x)).toBe(0);
    expect(round(j.P.y)).toBe(7);
  });

  it('puts the head one torso + gap + radius above the pelvis at rest', () => {
    const j = computePose(REST, CFG, { x: 0, y: 0 });
    // spineA = 180 => straight up; head centre sits at torsoLen + gap + R above P
    expect(round(j.H.x)).toBe(0);
    expect(round(j.H.y)).toBe(round(-(CFG.torsoLen + CFG.gap + CFG.R)));
  });

  it('is unaffected by hunch on the legs', () => {
    const flat = computePose(REST, CFG, { x: 0, y: 0 });
    const curled = computePose({ ...REST, hunch: -40 }, CFG, { x: 0, y: 0 });
    expect(round(curled.fR.x)).toBe(round(flat.fR.x));
    expect(round(curled.fR.y)).toBe(round(flat.fR.y));
  });

  it('moves the head when hunch is applied', () => {
    const flat = computePose(REST, CFG, { x: 0, y: 0 });
    const curled = computePose({ ...REST, hunch: -40 }, CFG, { x: 0, y: 0 });
    expect(round(curled.H.x)).not.toBe(round(flat.H.x));
  });

  it('translates with the origin', () => {
    const a = computePose(REST, CFG, { x: 0, y: 0 });
    const b = computePose(REST, CFG, { x: 100, y: 50 });
    expect(round(b.H.x - a.H.x)).toBe(100);
    expect(round(b.H.y - a.H.y)).toBe(50);
  });
});

describe('wave', () => {
  it('is zero at t=0 with no phase', () => {
    expect(round(wave(0, 1))).toBe(0);
  });

  it('peaks at a quarter period', () => {
    expect(round(wave(0.25, 1))).toBe(1);
  });
});

describe('clonePose', () => {
  it('returns a copy, not the same object', () => {
    const p = clonePose(REST);
    p.lean = 99;
    expect(REST.lean).toBe(0);
  });
});

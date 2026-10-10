import { describe, it, expect } from 'vitest';
import {
  linesBuilt, bobitsForLine, linesStandingOnArrival, BOBITS_PER_LINE,
} from '../tableauProgress';
import { TOTAL_LINES } from '../blueprint';

describe('linesBuilt', () => {
  it('gives a line every four bobits', () => {
    expect(linesBuilt(0)).toBe(0);
    expect(linesBuilt(3)).toBe(0);
    expect(linesBuilt(4)).toBe(1);
    expect(linesBuilt(7)).toBe(1);
    expect(linesBuilt(8)).toBe(2);
  });

  it('completes the tableau at a hundred bobits', () => {
    expect(linesBuilt(100)).toBe(TOTAL_LINES);
  });

  it('clamps above a hundred rather than running off the end of the blueprint', () => {
    expect(linesBuilt(400)).toBe(TOTAL_LINES);
    expect(linesBuilt(1e9)).toBe(TOTAL_LINES);
  });

  /**
   * REVIEW FOCUS 5. `bobitPeak` filters junk on read, but nothing stops a caller -- a dev
   * mock, a future server driver, a test -- handing this a string's worth of nonsense. The
   * tableau is scenery; a bad number must cost an empty margin, never a thrown render.
   */
  it('treats a junk peak as no progress', () => {
    expect(linesBuilt(-1)).toBe(0);
    expect(linesBuilt(-1e9)).toBe(0);
    expect(linesBuilt(NaN)).toBe(0);
    expect(linesBuilt(Infinity)).toBe(TOTAL_LINES);
    expect(linesBuilt(-Infinity)).toBe(0);
    expect(linesBuilt(undefined as unknown as number)).toBe(0);
  });
});

/**
 * REVIEW FOCUS 3. A returning player, or a contact sheet asking for `&tableau=25`.
 *
 * Fifteen build sequences back to back is three and a half minutes of a match in which the
 * player earned none of them, and it would make `bobit-tableau.mjs` unable to photograph a
 * finished tableau at all. Only lines earned ON CAMERA are built on camera.
 */
describe('linesStandingOnArrival', () => {
  it('has everything already earned already standing', () => {
    expect(linesStandingOnArrival(60)).toBe(15);
    expect(linesStandingOnArrival(100)).toBe(TOTAL_LINES);
    expect(linesStandingOnArrival(0)).toBe(0);
  });

  it('agrees with linesBuilt at every bobit count, so nothing is ever skipped', () => {
    // If these two could disagree the worksite would either replay finished work or skip a
    // line outright -- the tableau would be permanently one short and never catch up.
    for (let peak = 0; peak <= 110; peak++) {
      expect(linesStandingOnArrival(peak), `peak ${peak}`).toBe(linesBuilt(peak));
    }
  });
});

describe('bobitsForLine', () => {
  it('is the inverse of linesBuilt at every milestone', () => {
    for (let n = 1; n <= TOTAL_LINES; n++) {
      const owed = bobitsForLine(n);
      expect(linesBuilt(owed), `line ${n} stands at ${owed}`).toBeGreaterThanOrEqual(n);
      expect(linesBuilt(owed - 1), `line ${n} does not stand at ${owed - 1}`).toBeLessThan(n);
    }
  });

  it('puts the last line at a hundred', () => {
    expect(bobitsForLine(TOTAL_LINES)).toBe(100);
    expect(bobitsForLine(1)).toBe(BOBITS_PER_LINE);
  });
});

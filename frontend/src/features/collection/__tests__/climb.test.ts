import { describe, it, expect } from 'vitest';
import {
  climbDurFor, climbProgress,
  CLIMB_PX_PER_SEC, CLIMB_ASCENT_FRAC, CLIMB_MAX_SEC, CLIMB_MIN_SEC,
} from '../crowdAgents';

describe('climbDurFor', () => {
  it('takes longer for a higher branch', () => {
    expect(climbDurFor(600)).toBeGreaterThan(climbDurFor(217));
  });

  it('climbs the ascent leg at CLIMB_PX_PER_SEC', () => {
    const dy = 400;
    const ascentSec = climbDurFor(dy) * CLIMB_ASCENT_FRAC;
    expect(dy / ascentSec).toBeCloseTo(CLIMB_PX_PER_SEC, 5);
  });

  it('gives the three branches of a 1920px tree a legible spread', () => {
    // dy = MARGIN_BRANCH_UP * 0.868, the height-bound scale at 1920x1080.
    const [a, b, c] = [217, 408, 599].map(climbDurFor);
    expect(a).toBeCloseTo(1.61, 1);
    expect(b).toBeCloseTo(3.02, 1);
    expect(c).toBeCloseTo(4.44, 1);
  });

  it('is clamped at both ends, so no tree produces an absurd climb', () => {
    expect(climbDurFor(1)).toBe(CLIMB_MIN_SEC);
    expect(climbDurFor(99999)).toBe(CLIMB_MAX_SEC);
  });

  it('treats a downward delta as the same distance', () => {
    expect(climbDurFor(-400)).toBe(climbDurFor(400));
  });
});

describe('climbProgress', () => {
  it('spends the first stretch going up with no lateral movement', () => {
    expect(climbProgress(0)).toEqual({ up: 0, out: 0 });
    const mid = climbProgress(CLIMB_ASCENT_FRAC * 0.5);
    expect(mid.up).toBeCloseTo(0.5, 5);
    expect(mid.out).toBe(0);
  });

  it('is fully up before it starts moving out along the branch', () => {
    const at = climbProgress(CLIMB_ASCENT_FRAC);
    expect(at.up).toBeCloseTo(1, 5);
    expect(at.out).toBeCloseTo(0, 5);
  });

  it('finishes at the branch seat', () => {
    expect(climbProgress(1)).toEqual({ up: 1, out: 1 });
  });

  it('clamps outside 0-1 rather than extrapolating off the tree', () => {
    expect(climbProgress(-3)).toEqual({ up: 0, out: 0 });
    expect(climbProgress(9)).toEqual({ up: 1, out: 1 });
  });

  /**
   * The property that matters, and the reason this function exists at all: the perch used to be
   * a TELEPORT -- `agentsAdvance` flipped to 'perch' at walk completion and the figure was drawn
   * at the branch's y on that frame. Invisible at the in-band tree's 50px, a bobit blinking into
   * the canopy at 600.
   *
   * Asserted as a consequence -- no frame moves him more than a body's worth -- rather than by
   * checking climbProgress's own numbers back at it.
   */
  it('never teleports: no single frame covers more than a fraction of the climb', () => {
    const dy = 600;
    const dur = climbDurFor(dy);
    const STEP = 1 / 60;
    let prevUp = 0;
    let maxJump = 0;
    for (let t = 0; t <= dur; t += STEP) {
      const { up } = climbProgress(t / dur);
      expect(up).toBeGreaterThanOrEqual(prevUp);      // monotonic: he never slips back
      maxJump = Math.max(maxJump, (up - prevUp) * dy);
      prevUp = up;
    }
    expect(prevUp).toBeCloseTo(1, 5);                  // and he does arrive
    expect(maxJump).toBeLessThan(8);                   // px in one frame; a bobit is 48 tall
  });

  it('moves out along the branch monotonically too', () => {
    let prev = 0;
    for (let k = 0; k <= 1.0001; k += 0.01) {
      const { out } = climbProgress(k);
      expect(out).toBeGreaterThanOrEqual(prev);
      prev = out;
    }
  });
});

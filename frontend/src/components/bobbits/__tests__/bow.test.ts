import { describe, it, expect } from 'vitest';
import { ALL_ANIMATIONS, BOW_CYCLE } from '../rigExtras';
import { computePose, REST } from '../leremyRig';
import { pelvisOffset } from '../fieldGeometry';

/**
 * Sample a whole cycle and report the extremes of a joint, so every assertion below is about
 * what the bow DOES rather than about the numbers it was written with. Three of this feature's
 * tests asserted the implementation's own arithmetic back at it and each sat on a real defect.
 */
function sweep(pick: (j: ReturnType<typeof computePose>) => number) {
  let min = Infinity;
  let max = -Infinity;
  for (let t = 0; t < BOW_CYCLE * 2; t += 0.02) {
    const v = pick(computePose(ALL_ANIMATIONS.bow.frame(t)));
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return { min, max };
}

const rest = computePose(REST);

describe('the bow', () => {
  it('is registered, so a figure can actually be given it', () => {
    expect(ALL_ANIMATIONS.bow).toBeDefined();
    expect(typeof ALL_ANIMATIONS.bow.frame).toBe('function');
  });

  it('is a STANDING pose', () => {
    // 112 is the standing pelvis offset, 8 the seated one. A seated `bow` would be drawn 104
    // units from its own hit box, which is the trap this feature has recorded four times.
    expect(pelvisOffset('bow')).toBe(112);
  });

  /**
   * THE sign test. `vec(a) = { sin a, cos a }`, so -y is up and +x is the direction the figure
   * faces. A forward fold carries the head forward; the wrong hunch sign carries it BACKWARDS,
   * over an invisible chair, and looks deliberate enough to survive a code read.
   */
  it('folds FORWARD, not backwards', () => {
    const head = sweep(j => j.H.x);
    expect(head.max).toBeGreaterThan(rest.H.x + 20);   // really folds forward
    expect(head.min).toBeGreaterThan(rest.H.x - 6);    // and never leans back
  });

  it('comes back up again, so it reads as repeated bowing', () => {
    const head = sweep(j => j.H.x);
    expect(head.min).toBeLessThan(rest.H.x + 6);       // returns to standing between bows
  });

  /**
   * THE property that makes repeated bows read as REPEATED: a real standing pause between
   * them. Without it the figure just oscillates and reads as a bobbing idle.
   *
   * Asserted on the STAND rather than on a dwell at the bottom, which was this test's first
   * draft and did not discriminate: a smoothstep apex is naturally flat, so "holds at the
   * deepest point" passes even for a bow with no hold in it at all.
   */
  it('stands between bows, so they read as separate bows', () => {
    let standing = 0;
    for (let t = 0; t < BOW_CYCLE; t += 0.02) {
      if (computePose(ALL_ANIMATIONS.bow.frame(t)).H.x < rest.H.x + 1) standing += 1;
    }
    // 0.4, and the threshold discriminates rather than being fitted: MEASURED at 0.66s with
    // the pause and 0.06s with BOW_STAND set to zero, an order of magnitude apart.
    expect(standing * 0.02, 'seconds spent upright per cycle').toBeGreaterThan(0.4);
  });

  /**
   * THE T-pose test. A T-pose is armRU near +/-90, which puts the hand level with the shoulder.
   * Reading `armRF` as an elbow bend has produced one three times, most recently in `clap`.
   * Asserted on the HAND, not on the angle: the consequence, not the value.
   */
  it('never lets a hand rise to shoulder height', () => {
    for (let t = 0; t < BOW_CYCLE * 2; t += 0.02) {
      const j = computePose(ALL_ANIMATIONS.bow.frame(t));
      // +y is DOWN, so a hanging hand is strictly below its shoulder.
      expect(j.hR.y, `right hand at t=${t.toFixed(2)}`).toBeGreaterThan(j.sR.y);
      expect(j.hL.y, `left hand at t=${t.toFixed(2)}`).toBeGreaterThan(j.sL.y);
    }
  });

  it('keeps the knees straight, unlike `spent` which buckles them', () => {
    const p = ALL_ANIMATIONS.bow.frame(BOW_CYCLE * 0.25);
    const s = ALL_ANIMATIONS.spent.frame(0);
    expect(Math.abs(p.legRF)).toBeLessThan(Math.abs(s.legRF));
  });

  it('cycles on a period long enough to read as separate bows', () => {
    expect(BOW_CYCLE).toBeGreaterThan(1.5);
    expect(BOW_CYCLE).toBeLessThan(5);
  });
});

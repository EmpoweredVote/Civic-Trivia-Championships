import { describe, it, expect } from 'vitest';
import { CFG, computePose } from '../leremyRig';
import { ALL_ANIMATIONS, GRIP_HAND_SPAN_UNITS } from '../rigExtras';

/** Mirrors BobbitTrophyCarry: rear sits gap units left of lead, both on the same pose. */
const GAP_UNITS = 150;

/** Pedestal half-width in rig units: drawTrophy's 12.5 at TROPHY_SIZE_MULT = 2. */
const PEDESTAL_HALF = 25;

/**
 * Half a limb's thickness. The hand joint is the wrist centre, so a joint within this of the
 * pedestal corner is drawn touching it.
 */
const TOLERANCE = CFG.armW / 2 + 2;

function innerHands(t: number) {
  const j = computePose(ALL_ANIMATIONS.carryGrip.frame(t), CFG, { x: 0, y: 0 });
  // Rear carrier at x = 0 reaches right with its RIGHT hand; lead at x = GAP reaches left
  // with its LEFT hand. Same pose, mirrored roles -- exactly what the component draws.
  return { rear: 0 + j.hR.x, lead: GAP_UNITS + j.hL.x };
}

describe('carryGrip', () => {
  it('exists and is a gait, so the walk cycle still reads', () => {
    expect(ALL_ANIMATIONS.carryGrip).toBeDefined();
    expect(typeof ALL_ANIMATIONS.carryGrip.frame).toBe('function');
  });

  it('brings the two inner hands to the pedestal span', () => {
    const { rear, lead } = innerHands(0);
    expect(lead - rear).toBeCloseTo(GRIP_HAND_SPAN_UNITS, 0);
  });

  it('puts each inner hand on a pedestal corner, measured from their own midpoint', () => {
    const { rear, lead } = innerHands(0);
    const trophyX = (rear + lead) / 2;
    expect(Math.abs(Math.abs(rear - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(Math.abs(lead - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('keeps contact through the whole gait, not just the reference frame', () => {
    for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 2.0]) {
      const { rear, lead } = innerHands(t);
      const trophyX = (rear + lead) / 2;
      expect(Math.abs(Math.abs(rear - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(Math.abs(lead - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('reaches inward, not outward — a regression guard on the sign', () => {
    const j = computePose(ALL_ANIMATIONS.carryGrip.frame(0), CFG, { x: 0, y: 0 });
    expect(j.hR.x).toBeGreaterThan(0);   // rear's right hand reaches toward the lead
    expect(j.hL.x).toBeLessThan(0);      // lead's left hand reaches toward the rear
  });

  it('does not reach further than the arm is long', () => {
    const j = computePose(ALL_ANIMATIONS.carryGrip.frame(0), CFG, { x: 0, y: 0 });
    const reach = CFG.upperArm + CFG.foreArm;
    expect(Math.abs(j.hR.x) - CFG.shoulderHalf).toBeLessThan(reach);
  });
});

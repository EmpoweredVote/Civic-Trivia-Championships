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

/**
 * How far the hand span may drift from GRIP_HAND_SPAN_UNITS ACROSS the gait. Wider than the
 * reference frame's own tolerance on purpose: the walk cycle sways the shoulders, so the span
 * breathes by a unit or so whatever the angles are. It is still far tighter than TOLERANCE, so
 * a genuine regression in the reach cannot hide inside it.
 */
const SPAN_GATE = 2;

/** The eight frames the gait assertions sample — a little over two full stride cycles. */
const GAIT_FRAMES = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 2.0];

function innerHands(t: number) {
  const j = computePose(ALL_ANIMATIONS.carryGrip.frame(t), CFG, { x: 0, y: 0 });
  // Rear carrier at x = 0 reaches right with its RIGHT hand; lead at x = GAP reaches left
  // with its LEFT hand. Same pose, mirrored roles -- exactly what the component draws.
  return {
    rear: 0 + j.hR.x, lead: GAP_UNITS + j.hL.x,
    rearY: j.hR.y, leadY: j.hL.y,
  };
}

/**
 * A pedestal CORNER is two-dimensional, so both axes are checked against the same tolerance:
 * the pedestal rides the hands' own midpoint in x (BobbitTrophyCarry's trophyX) and their own
 * average in y (its trophyY / CARRY_HAND_Y), so each hand must land within TOLERANCE of the
 * corner that midpoint implies. Checking x alone passed happily while the two hands sat 26-32
 * units apart vertically -- see the tuning log on carryGrip in rigExtras.ts.
 */
function expectOnCorners(t: number) {
  const { rear, lead, rearY, leadY } = innerHands(t);
  const trophyX = (rear + lead) / 2;
  const baseY = (rearY + leadY) / 2;
  expect(Math.abs(Math.abs(rear - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(Math.abs(lead - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(rearY - baseY)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(leadY - baseY)).toBeLessThanOrEqual(TOLERANCE);
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

  it('holds that span through the whole gait, not just the reference frame', () => {
    for (const t of GAIT_FRAMES) {
      const { rear, lead } = innerHands(t);
      expect(Math.abs((lead - rear) - GRIP_HAND_SPAN_UNITS)).toBeLessThanOrEqual(SPAN_GATE);
    }
  });

  it('puts each inner hand on a pedestal corner, measured from their own midpoint', () => {
    expectOnCorners(0);
  });

  it('keeps contact through the whole gait, not just the reference frame', () => {
    for (const t of GAIT_FRAMES) expectOnCorners(t);
  });

  it('holds the two inner hands at the same height, so the pedestal base is level', () => {
    // The axis the old test never looked at. A mirrored pose CANNOT satisfy this -- computePose
    // adds `ub = lean + hunch` to both arm angles and cos(ub + t) != cos(ub - t) -- which is
    // why carryGrip carries independent left/right angles.
    for (const t of GAIT_FRAMES) {
      const { rearY, leadY } = innerHands(t);
      expect(Math.abs(rearY - leadY)).toBeLessThanOrEqual(TOLERANCE);
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

  it('hangs the trophy midway between the two carriers, not off to one side', () => {
    // Only the SPAN is pinned by the corner assertions, so the pair can satisfy them while
    // drifting bodily toward one carrier -- the trophy rides their midpoint and would visibly
    // sit off-centre. The old symmetric pose was ~12 units out; this keeps it under one.
    for (const t of GAIT_FRAMES) {
      const j = computePose(ALL_ANIMATIONS.carryGrip.frame(t), CFG, { x: 0, y: 0 });
      expect(Math.abs(j.hR.x + j.hL.x)).toBeLessThanOrEqual(2);
    }
  });
});

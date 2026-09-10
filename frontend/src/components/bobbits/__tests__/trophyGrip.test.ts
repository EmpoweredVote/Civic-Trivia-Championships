import { describe, it, expect } from 'vitest';
import { ANIMATIONS, CFG, computePose } from '../leremyRig';
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
  // Rear carrier at x = 0 reaches right with its RIGHT hand; lead at x = GAP reaches left
  // with its LEFT hand. Each takes its OWN per-side variant -- exactly what the component
  // draws -- so the arm that is not gripping keeps carry's hang instead of copying the reach.
  const jR = computePose(ALL_ANIMATIONS.carryGrip.frame(t, { hand: 'R' }), CFG, { x: 0, y: 0 });
  const jL = computePose(ALL_ANIMATIONS.carryGrip.frame(t, { hand: 'L' }), CFG, { x: 0, y: 0 });
  return {
    rear: 0 + jR.hR.x, lead: GAP_UNITS + jL.hL.x,
    rearY: jR.hR.y, leadY: jL.hL.y,
  };
}

/**
 * The arm that is NOT gripping must keep `carry`'s own hang. Without this, both arms inherit
 * the reach and the carriers stand in a T-pose with an arm held straight out into empty space
 * -- which every hand-contact assertion above still passes, because none of them look at it.
 */
function idleArms(t: number) {
  const carry = computePose(ANIMATIONS.carry.frame(t), CFG, { x: 0, y: 0 });
  const jR = computePose(ALL_ANIMATIONS.carryGrip.frame(t, { hand: 'R' }), CFG, { x: 0, y: 0 });
  const jL = computePose(ALL_ANIMATIONS.carryGrip.frame(t, { hand: 'L' }), CFG, { x: 0, y: 0 });
  // Rear grips with R, so its L is idle; lead grips with L, so its R is idle.
  return {
    rearIdle: jR.hL, rearIdleRef: carry.hL,
    leadIdle: jL.hR, leadIdleRef: carry.hR,
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
    const jR = computePose(ALL_ANIMATIONS.carryGrip.frame(0, { hand: 'R' }), CFG, { x: 0, y: 0 });
    const jL = computePose(ALL_ANIMATIONS.carryGrip.frame(0, { hand: 'L' }), CFG, { x: 0, y: 0 });
    expect(jR.hR.x).toBeGreaterThan(0);   // rear's right hand reaches toward the lead
    expect(jL.hL.x).toBeLessThan(0);      // lead's left hand reaches toward the rear
  });

  it('does not reach further than the arm is long', () => {
    const j = computePose(ALL_ANIMATIONS.carryGrip.frame(0, { hand: 'R' }), CFG, { x: 0, y: 0 });
    const reach = CFG.upperArm + CFG.foreArm;
    expect(Math.abs(j.hR.x) - CFG.shoulderHalf).toBeLessThan(reach);
  });

  it('hangs the trophy midway between the two carriers, not off to one side', () => {
    // Only the SPAN is pinned by the corner assertions, so the pair can satisfy them while
    // drifting bodily toward one carrier -- the trophy rides their midpoint and would visibly
    // sit off-centre. The old symmetric pose was ~12 units out; this keeps it under one.
    for (const t of GAIT_FRAMES) {
      const { rear, lead } = innerHands(t);
      expect(Math.abs((rear + lead) / 2 - GAP_UNITS / 2)).toBeLessThanOrEqual(2);
    }
  });

  it('leaves the non-gripping arm hanging, not held out in a T-pose', () => {
    // The assertion that was missing. Every hand-contact check above looks only at the two
    // gripping hands, so when one pose drove BOTH arms the idle arm inherited the same
    // near-horizontal reach and the carriers stood arms-out into empty space -- all green.
    // Caught by a screenshot. The idle arm must match `carry`'s own hang.
    for (const t of GAIT_FRAMES) {
      const { rearIdle, rearIdleRef, leadIdle, leadIdleRef } = idleArms(t);
      expect(Math.abs(rearIdle.x - rearIdleRef.x)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(rearIdle.y - rearIdleRef.y)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(leadIdle.x - leadIdleRef.x)).toBeLessThanOrEqual(0.001);
      expect(Math.abs(leadIdle.y - leadIdleRef.y)).toBeLessThanOrEqual(0.001);
    }
  });

  it('reaches noticeably further with the gripping arm than the idle one', () => {
    // The shape statement the identity test above cannot make: whatever `carry`'s hang happens
    // to be, the arm doing the holding must be the one extended. In the T-posed version both
    // arms reached the same distance, which is precisely what made it read as a plank.
    // Deliberately expressed as a comparison rather than a threshold — the last version of
    // this assertion used a guessed constant of 20 against a real hang of 29.5.
    for (const t of GAIT_FRAMES) {
      const { rear, lead } = innerHands(t);
      const { rearIdle, leadIdle } = idleArms(t);
      expect(Math.abs(rear)).toBeGreaterThan(Math.abs(rearIdle.x) + 10);
      expect(Math.abs(lead - GAP_UNITS)).toBeGreaterThan(Math.abs(leadIdle.x) + 10);
    }
  });
});

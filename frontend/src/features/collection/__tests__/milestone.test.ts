import { describe, it, expect } from 'vitest';
import { treeEarned, MILESTONE_FRACTION } from '../milestone';
import { treeScale } from '../treePlacement';
import { marginTreeX } from '../../../components/bobbits/props';
import { TREE_MILESTONE } from '../scenes';
import { canStage, directorInit } from '../sceneDirector';

describe('treeEarned', () => {
  it('is false well short of the mark', () => {
    expect(treeEarned(5, 120)).toBe(false);
  });

  it('is true at exactly the mark', () => {
    expect(treeEarned(30, 120)).toBe(true);
  });

  it('is true past the mark', () => {
    expect(treeEarned(80, 120)).toBe(true);
  });

  /**
   * An unknown denominator must never earn anything. `questionCount` is null while the fetch is
   * in flight and after a failure, and a tree that appears for a second on every slow network
   * is worse than a tree that appears late.
   */
  it('is false when the collection size is unknown', () => {
    expect(treeEarned(999, null)).toBe(false);
  });

  it('is false for a zero-sized collection rather than trivially true', () => {
    expect(treeEarned(0, 0)).toBe(false);
  });

  it('uses a quarter', () => {
    expect(MILESTONE_FRACTION).toBe(0.25);
  });
});

describe('the milestone ceremony stands under the trunk', () => {
  /**
   * The scene's cast walks to fractions of its own SLOT while the trunk lives in the MARGIN
   * canvas's coordinates. Two separately right-anchored things are not the same place, and
   * "it is anchored right, so it must line up" is exactly the reasoning that let the
   * milestone's `span <= 0.25` test pass while the scene played at the opposite end of the band.
   *
   * So: stage it for real and assert the ground it actually takes. The slot comes from
   * `canStage` and the x from the director's own arithmetic -- reimplementing either here is
   * how a test comes to assert something the app never does. (The first draft of this test did
   * exactly that: it read `moveTo` as a fraction of the whole band and reported the ceremony
   * 362px adrift of a trunk it was in fact standing under.)
   */
  const CASES = [
    { vw: 1920, inner: 1872, margin: 432, height: 868 },
    { vw: 1440, inner: 1392, margin: 372, height: 640 },
    { vw: 1280, inner: 1232, margin: 264, height: 560 },
  ];

  /** Where a role's `moveTo` fraction actually puts him, in band px. */
  const stagedX = (frac: number, inner: number) => {
    const slot = canStage(directorInit(), TREE_MILESTONE.span, inner, TREE_MILESTONE.anchor);
    expect(slot, 'an empty room can always stage the milestone').not.toBeNull();
    const { left, right } = slot as { left: number; right: number };
    return left + frac * (right - left);
  };

  it('puts the admirer within a body or two of the trunk, at every width', () => {
    for (const { vw, inner, margin, height } of CASES) {
      const scale = treeScale({ width: margin, height }) as number;
      // The trunk in PAGE coordinates: the canvas is flush right, so add its left edge.
      const trunkPageX = (inner - margin) + marginTreeX(margin, scale);

      const admirer = TREE_MILESTONE.beats
        .find(b => b.role === 'admirer' && b.moveTo !== undefined);
      expect(admirer, 'the admirer still has a moveTo').toBeDefined();
      const admirerPageX = stagedX(admirer?.moveTo as number, inner);

      // Within ~3 bobit widths. Tighter than that is over-fitting a hand-tuned fraction; looser
      // and he is admiring an empty patch of floor.
      expect(Math.abs(admirerPageX - trunkPageX), `admirer vs trunk at ${vw}px`)
        .toBeLessThan(160);
    }
  });

  /** The witness stands back and looks up; he must not be off in another postcode. */
  it('keeps the witness in sight of the tree', () => {
    for (const { vw, inner, margin, height } of CASES) {
      const scale = treeScale({ width: margin, height }) as number;
      const trunkPageX = (inner - margin) + marginTreeX(margin, scale);
      const witness = TREE_MILESTONE.beats
        .find(b => b.role === 'witness' && b.moveTo !== undefined);
      const witnessPageX = stagedX(witness?.moveTo as number, inner);
      expect(Math.abs(witnessPageX - trunkPageX), `witness vs trunk at ${vw}px`)
        .toBeLessThan(400);
    }
  });

  it('still reserves the right of the band for the set piece', () => {
    expect(TREE_MILESTONE.anchor).toBe('right');
    expect(TREE_MILESTONE.span).toBeLessThanOrEqual(0.25);
  });
});

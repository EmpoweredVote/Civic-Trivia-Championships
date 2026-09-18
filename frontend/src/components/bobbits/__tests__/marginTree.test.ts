import { describe, it, expect } from 'vitest';
import {
  marginTreeX, marginTreeLeftmost, marginTreeRightmost, marginTreeTop, marginTreeSurfaces,
  MARGIN_BRANCH_UP, MARGIN_TREE_HALF_W, MARGIN_TREE_RIG_H,
} from '../props';
import { treeScale } from '../../../features/collection/treePlacement';

/** The same measured margins as treePlacement.test.ts. Kept in step with it by hand. */
const MARGINS = [
  { vw: 1920, margin: 432, height: 868 },
  { vw: 1440, margin: 372, height: 640 },
  { vw: 1280, margin: 264, height: 560 },
];

describe('marginTreeX', () => {
  it('stands near the right of its canvas', () => {
    const s = 0.868;
    expect(marginTreeX(432, s)).toBeGreaterThan(432 * 0.5);
    expect(marginTreeX(432, s)).toBeLessThanOrEqual(432);
  });
});

describe('BOUND 1 — nothing the tree draws crosses the question column', () => {
  /**
   * The canvas IS the margin: it is positioned `right: 0` with `width: marginBox.width`, so its
   * left edge sits exactly on the column's right edge. Therefore "ink stays inside the canvas"
   * and "ink stays off the card" are the same statement, and this is the test that holds the
   * standing instruction.
   *
   * Asserted as a consequence -- the leftmost ink the tree produces -- rather than by checking
   * that treeScale took a min(). Three of this feature's new tests asserted the
   * implementation's own arithmetic back at it, and each sat on top of a real defect.
   */
  it('keeps its leftmost ink inside the measured margin at every width', () => {
    for (const { vw, margin, height } of MARGINS) {
      const s = treeScale({ width: margin, height });
      expect(s, `scale at ${vw}px`).not.toBeNull();
      expect(marginTreeLeftmost(margin, s as number), `leftmost ink at ${vw}px`)
        .toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * The whole ink box, not just its left edge. The canopy reaches further right than any branch
   * and further left than the trunk, so checking the trunk's own placement proves nothing about
   * either side.
   */
  it('keeps its whole ink box inside the canvas, all four edges', () => {
    for (const { vw, margin, height } of MARGINS) {
      const s = treeScale({ width: margin, height }) as number;
      expect(marginTreeLeftmost(margin, s), `left at ${vw}px`).toBeGreaterThanOrEqual(0);
      expect(marginTreeRightmost(margin, s), `right at ${vw}px`).toBeLessThanOrEqual(margin);
      // Measured down from the floor line, which is the canvas's bottom edge.
      expect(marginTreeTop(s), `canopy height at ${vw}px`).toBeLessThanOrEqual(height);
    }
  });

  it('keeps every branch tip inside the measured margin too', () => {
    for (const { vw, margin, height } of MARGINS) {
      const s = treeScale({ width: margin, height }) as number;
      const x = marginTreeX(margin, s);
      const groundY = MARGIN_TREE_RIG_H * s;
      for (const sf of marginTreeSurfaces(x, groundY, s)) {
        expect(sf.left, `${sf.id} left edge at ${vw}px`).toBeGreaterThanOrEqual(0);
        expect(sf.right, `${sf.id} right edge at ${vw}px`).toBeLessThanOrEqual(margin);
      }
    }
  });

  it('never lets the footprint exceed the margin, however extreme the box', () => {
    for (const margin of [140, 200, 340, 432, 900]) {
      const s = treeScale({ width: margin, height: 10000 }) as number;
      expect(MARGIN_TREE_HALF_W * 2 * s).toBeLessThanOrEqual(margin + 0.001);
      expect(marginTreeLeftmost(margin, s)).toBeGreaterThanOrEqual(-0.001);
      expect(marginTreeRightmost(margin, s)).toBeLessThanOrEqual(margin + 0.001);
    }
  });
});

describe('marginTreeSurfaces', () => {
  const S = 0.868;
  const CANVAS = 432;
  const GROUND = 868;
  const surfaces = () => marginTreeSurfaces(marginTreeX(CANVAS, S), GROUND, S);

  it('offers three branches, lowest first', () => {
    const out = surfaces();
    expect(out).toHaveLength(3);
    expect(out[0].y).toBeGreaterThan(out[1].y);      // smaller y is higher up
    expect(out[1].y).toBeGreaterThan(out[2].y);
  });

  it('gives each branch a distinct id, so assignPerch can claim them separately', () => {
    expect(new Set(surfaces().map(s => s.id)).size).toBe(3);
  });

  it('puts the branches at the rig heights the design specifies', () => {
    const out = surfaces();
    out.forEach((sf, i) => {
      expect(sf.y).toBeCloseTo(GROUND - MARGIN_BRANCH_UP[i] * S, 5);
    });
  });

  it('alternates sides, so the tree does not lean', () => {
    const out = surfaces();
    const x = marginTreeX(CANVAS, S);
    const reachesLeft = out.map(sf => (sf.left + sf.right) / 2 < x);
    expect(reachesLeft[0]).toBe(true);       // lowest reaches left, toward the card
    expect(reachesLeft[1]).toBe(false);
    expect(reachesLeft[2]).toBe(true);
  });

  /**
   * `rootX` is the trunk-side end -- where a climber arrives and starts up. Without it
   * assignPerch walks him to the branch's MIDDLE and he ascends through open air beside the
   * trunk instead of climbing it.
   */
  it('roots every branch at the trunk', () => {
    const x = marginTreeX(CANVAS, S);
    for (const sf of surfaces()) {
      expect(sf.rootX).toBeDefined();
      expect(Math.abs((sf.rootX as number) - x)).toBeLessThan(MARGIN_TREE_HALF_W * S * 0.25);
      expect(sf.rootX).toBeGreaterThanOrEqual(sf.left);
      expect(sf.rootX).toBeLessThanOrEqual(sf.right);
    }
  });

  it('leaves room on every branch to walk out from the trunk', () => {
    for (const sf of surfaces()) {
      expect(sf.right - sf.left).toBeGreaterThan(20);
    }
  });

  /** Every branch has to be on the trunk, not floating above where the trunk ends. */
  it('hangs every branch off the trunk, below its top', () => {
    for (const up of MARGIN_BRANCH_UP) {
      expect(up).toBeLessThan(MARGIN_TREE_RIG_H);
    }
  });
});

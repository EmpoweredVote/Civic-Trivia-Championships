import { describe, it, expect } from 'vitest';
import { treeX, TREE_GROW_SEC, treeScale, MIN_TREE_MARGIN } from '../treePlacement';
import {
  TREE_HALF_W, MARGIN_TREE_RIG_H, MARGIN_TREE_HALF_W,
} from '../../../components/bobbits/props';

describe('treeX', () => {
  it('stands on the right border', () => {
    expect(treeX(1000, 0.2)).toBeGreaterThan(900);
  });

  it('keeps its whole footprint on the canvas', () => {
    const x = treeX(1000, 0.2);
    expect(x + TREE_HALF_W * 0.2).toBeLessThanOrEqual(1000);
  });

  it('stays on a narrow band too', () => {
    const x = treeX(340, 0.2);
    expect(x + TREE_HALF_W * 0.2).toBeLessThanOrEqual(340);
    expect(x).toBeGreaterThan(0);
  });

  /** A band narrower than the tree must still place it somewhere sane, not off-screen. */
  it('does not fall off a band narrower than itself', () => {
    const x = treeX(10, 0.2);
    expect(x).toBeGreaterThan(0);
    expect(Number.isFinite(x)).toBe(true);
  });

  it('grows over three seconds, not two — the margin tree is ten times as tall', () => {
    expect(TREE_GROW_SEC).toBe(3);
  });
});

/**
 * The real margins, computed once from the layout rather than guessed: the HUD, the card and
 * the buttons all share one `maxWidth: clamp(700px, 55vw, 1500px)`, `mx-auto` column inside a
 * container padded `px-4 sm:px-6`. So the margin either side is
 * (inner - column) / 2, where inner = viewport - 2 * padding.
 */
const MARGINS = [
  { vw: 1920, margin: 432, height: 868 },
  { vw: 1440, margin: 372, height: 640 },
  { vw: 1280, margin: 264, height: 560 },
  { vw: 1024, margin: 138, height: 520 },   // just under MIN_TREE_MARGIN
];

describe('treeScale', () => {
  it('has no opinion when there is no measured box yet', () => {
    expect(treeScale(null)).toBeNull();
  });

  it('gives up below the minimum margin, so the in-band tree takes over', () => {
    expect(treeScale({ width: MIN_TREE_MARGIN - 1, height: 800 })).toBeNull();
    expect(treeScale({ width: 138, height: 520 })).toBeNull();
  });

  it('is height-bound on a wide desktop', () => {
    const s = treeScale({ width: 432, height: 868 });
    expect(s).toBeCloseTo(868 / MARGIN_TREE_RIG_H, 5);
  });

  it('is width-bound when the margin is the tighter of the two', () => {
    // A tall but narrow margin: 300px of width caps the scale below what the height allows.
    const s = treeScale({ width: 300, height: 2000 });
    expect(s).toBeCloseTo(300 / (MARGIN_TREE_HALF_W * 2), 5);
  });

  /**
   * The property that matters, asserted as a consequence rather than as arithmetic: whatever
   * scale comes back, the tree's whole footprint fits inside the margin it was measured from.
   * That is what keeps it off the question card.
   */
  it('always returns a scale whose footprint fits the box it was given', () => {
    for (const { vw, margin, height } of MARGINS) {
      const s = treeScale({ width: margin, height });
      if (s === null) continue;
      expect(MARGIN_TREE_HALF_W * 2 * s, `footprint at ${vw}px`).toBeLessThanOrEqual(margin);
      expect(MARGIN_TREE_RIG_H * s, `height at ${vw}px`).toBeLessThanOrEqual(height);
    }
  });

  it('never returns a non-positive or non-finite scale', () => {
    for (const box of [{ width: 0, height: 0 }, { width: -5, height: 800 },
                       { width: 400, height: 0 }]) {
      const s = treeScale(box);
      if (s !== null) {
        expect(s).toBeGreaterThan(0);
        expect(Number.isFinite(s)).toBe(true);
      }
    }
  });
});

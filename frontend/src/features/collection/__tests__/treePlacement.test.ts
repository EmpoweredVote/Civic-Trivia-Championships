import { describe, it, expect } from 'vitest';
import { treeX, TREE_GROW_SEC } from '../treePlacement';
import { TREE_HALF_W } from '../../../components/bobbits/props';

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

  it('grows over a couple of seconds', () => {
    expect(TREE_GROW_SEC).toBe(2);
  });
});

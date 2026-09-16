import { describe, it, expect } from 'vitest';
import { treeEarned, MILESTONE_FRACTION } from '../milestone';

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

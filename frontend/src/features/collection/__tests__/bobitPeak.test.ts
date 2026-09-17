import { describe, it, expect } from 'vitest';
import { createPeakStore, PEAK_STORAGE_KEY } from '../bobitPeak';

/** A Storage stand-in. The node test environment has no localStorage. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  } as Storage;
}

/** A Storage that throws on every access -- private mode, or a full quota. */
function brokenStorage(): Storage {
  const boom = () => { throw new Error('nope'); };
  return {
    get length(): number { throw new Error('nope'); },
    clear: boom, getItem: boom, key: boom, removeItem: boom, setItem: boom,
  } as unknown as Storage;
}

describe('createPeakStore', () => {
  it('starts at zero for a collection it has never seen', () => {
    expect(createPeakStore(fakeStorage()).peak('milwaukee-wi')).toBe(0);
  });

  it('remembers the best count it has been told', () => {
    const s = createPeakStore(fakeStorage());
    s.record('milwaukee-wi', 12);
    expect(s.peak('milwaukee-wi')).toBe(12);
  });

  /** The whole point: losing bobits must not lower the mark. */
  it('never goes down', () => {
    const s = createPeakStore(fakeStorage());
    s.record('milwaukee-wi', 12);
    s.record('milwaukee-wi', 4);
    expect(s.peak('milwaukee-wi')).toBe(12);
  });

  it('keeps collections apart', () => {
    const s = createPeakStore(fakeStorage());
    s.record('milwaukee-wi', 12);
    expect(s.peak('bloomington-in')).toBe(0);
  });

  it('survives a reload', () => {
    const storage = fakeStorage();
    createPeakStore(storage).record('milwaukee-wi', 9);
    expect(createPeakStore(storage).peak('milwaukee-wi')).toBe(9);
  });

  /**
   * Reads on first USE, not at construction. `createLocalProgressStore` shipped with the
   * opposite and it cost a day: a module-level singleton that snapshots storage in its
   * constructor has really snapshotted it at import time, which nothing can see or order.
   */
  it('sees a value written after it was constructed', () => {
    const storage = fakeStorage();
    const s = createPeakStore(storage);
    storage.setItem(PEAK_STORAGE_KEY, JSON.stringify({ 'milwaukee-wi': 7 }));
    expect(s.peak('milwaukee-wi')).toBe(7);
  });

  it('ignores a rubbish value rather than throwing', () => {
    const s = createPeakStore(fakeStorage({ [PEAK_STORAGE_KEY]: 'not json' }));
    expect(s.peak('milwaukee-wi')).toBe(0);
  });

  it('ignores entries that are not counts', () => {
    const s = createPeakStore(fakeStorage({
      [PEAK_STORAGE_KEY]: JSON.stringify({ good: 5, bad: 'twelve', worse: -3 }),
    }));
    expect(s.peak('good')).toBe(5);
    expect(s.peak('bad')).toBe(0);
    expect(s.peak('worse')).toBe(0);
  });

  it('keeps working when storage itself throws', () => {
    const s = createPeakStore(brokenStorage());
    s.record('milwaukee-wi', 5);
    expect(s.peak('milwaukee-wi')).toBe(5);
  });
});

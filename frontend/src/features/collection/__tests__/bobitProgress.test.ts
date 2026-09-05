import { describe, it, expect } from 'vitest';
import { createLocalProgressStore, STORAGE_KEY } from '../bobitProgress';

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

describe('createLocalProgressStore', () => {
  it('starts empty for an unknown collection', () => {
    const s = createLocalProgressStore(fakeStorage());
    expect(s.load('milwaukee-wi').size).toBe(0);
  });

  it('remembers a granted question', () => {
    const s = createLocalProgressStore(fakeStorage());
    s.grant('milwaukee-wi', 'milwi-042');
    expect(s.load('milwaukee-wi').has('milwi-042')).toBe(true);
  });

  it('persists across store instances sharing the same storage', () => {
    const storage = fakeStorage();
    createLocalProgressStore(storage).grant('milwaukee-wi', 'milwi-042');
    expect(createLocalProgressStore(storage).load('milwaukee-wi').has('milwi-042')).toBe(true);
  });

  it('keeps collections separate', () => {
    const s = createLocalProgressStore(fakeStorage());
    s.grant('milwaukee-wi', 'milwi-042');
    expect(s.load('wisconsin').size).toBe(0);
  });

  it('revokes a question', () => {
    const s = createLocalProgressStore(fakeStorage());
    s.grant('milwaukee-wi', 'milwi-042');
    s.revoke('milwaukee-wi', 'milwi-042');
    expect(s.load('milwaukee-wi').has('milwi-042')).toBe(false);
  });

  it('re-granting after a revoke works', () => {
    const s = createLocalProgressStore(fakeStorage());
    s.grant('milwaukee-wi', 'milwi-042');
    s.revoke('milwaukee-wi', 'milwi-042');
    s.grant('milwaukee-wi', 'milwi-042');
    expect(s.load('milwaukee-wi').has('milwi-042')).toBe(true);
  });

  it('granting twice is not counted twice', () => {
    const s = createLocalProgressStore(fakeStorage());
    s.grant('milwaukee-wi', 'milwi-042');
    s.grant('milwaukee-wi', 'milwi-042');
    expect(s.load('milwaukee-wi').size).toBe(1);
  });

  it('revoking something never granted is harmless', () => {
    const s = createLocalProgressStore(fakeStorage());
    expect(() => s.revoke('milwaukee-wi', 'nope-001')).not.toThrow();
    expect(s.load('milwaukee-wi').size).toBe(0);
  });

  it('summarises counts per collection', () => {
    const s = createLocalProgressStore(fakeStorage());
    s.grant('milwaukee-wi', 'milwi-001');
    s.grant('milwaukee-wi', 'milwi-002');
    s.grant('wisconsin', 'wisco-001');
    expect(s.summary()).toEqual({ 'milwaukee-wi': 2, wisconsin: 1 });
  });

  it('writes under the versioned key', () => {
    const storage = fakeStorage();
    createLocalProgressStore(storage).grant('milwaukee-wi', 'milwi-042');
    expect(storage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('survives corrupt stored JSON by starting fresh', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: 'not json{{' });
    const s = createLocalProgressStore(storage);
    expect(s.load('milwaukee-wi').size).toBe(0);
    expect(() => s.grant('milwaukee-wi', 'milwi-042')).not.toThrow();
  });

  it('survives a storage that throws, degrading to memory only', () => {
    const s = createLocalProgressStore(brokenStorage());
    expect(() => s.grant('milwaukee-wi', 'milwi-042')).not.toThrow();
    // Gameplay must never block on the crowd: the grant still holds for this session.
    expect(s.load('milwaukee-wi').has('milwi-042')).toBe(true);
  });
});

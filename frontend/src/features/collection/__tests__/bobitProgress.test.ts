import { describe, it, expect } from 'vitest';
import { createLocalProgressStore, createServerProgressStore, STORAGE_KEY } from '../bobitProgress';

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

describe('createServerProgressStore', () => {
  /** Stands in for the authenticated GET. Records calls so tests can assert none were made. */
  function fakeFetcher(data: Record<string, string[]>) {
    const calls: number[] = [];
    return {
      calls,
      fetch: async () => { calls.push(Date.now()); return data; },
    };
  }

  it('is empty before hydrating, and does not throw', () => {
    const s = createServerProgressStore(async () => ({}));
    expect(s.load('milwaukee-wi').size).toBe(0);
  });

  it('populates from the server on hydrate', async () => {
    const s = createServerProgressStore(async () => ({ 'milwaukee-wi': ['milwi-042'] }));
    await s.hydrate!('milwaukee-wi');
    expect(s.load('milwaukee-wi').has('milwi-042')).toBe(true);
  });

  it('degrades to an empty crowd when the fetch rejects', async () => {
    const s = createServerProgressStore(async () => { throw new Error('offline'); });
    // Gameplay must never block on the crowd: this resolves, it does not reject.
    await expect(s.hydrate!('milwaukee-wi')).resolves.toBeUndefined();
    expect(s.load('milwaukee-wi').size).toBe(0);
  });

  it('keeps other collections when hydrating one', async () => {
    const s = createServerProgressStore(async () => ({
      'milwaukee-wi': ['milwi-042'], wisconsin: ['wisco-001'],
    }));
    await s.hydrate!('milwaukee-wi');
    expect(s.load('wisconsin').has('wisco-001')).toBe(true);
  });

  it('treats the server as authoritative on re-hydrate rather than merging', async () => {
    let payload: Record<string, string[]> = { 'milwaukee-wi': ['milwi-042', 'milwi-043'] };
    const s = createServerProgressStore(async () => payload);
    await s.hydrate!('milwaukee-wi');
    payload = { 'milwaukee-wi': ['milwi-042'] };          // 043 was lost server-side
    await s.hydrate!('milwaukee-wi');
    expect(s.load('milwaukee-wi').has('milwi-043')).toBe(false);
    expect(s.load('milwaukee-wi').size).toBe(1);
  });

  it('shows a grant immediately and issues no request', async () => {
    // Read-server, write-local: the same answer submission already told the server.
    const f = fakeFetcher({});
    const s = createServerProgressStore(f.fetch);
    await s.hydrate!('milwaukee-wi');
    const before = f.calls.length;
    s.grant('milwaukee-wi', 'milwi-042');
    expect(s.load('milwaukee-wi').has('milwi-042')).toBe(true);
    expect(f.calls.length).toBe(before);
  });

  it('shows a revoke immediately and issues no request', async () => {
    const f = fakeFetcher({ 'milwaukee-wi': ['milwi-042'] });
    const s = createServerProgressStore(f.fetch);
    await s.hydrate!('milwaukee-wi');
    const before = f.calls.length;
    s.revoke('milwaukee-wi', 'milwi-042');
    expect(s.load('milwaukee-wi').has('milwi-042')).toBe(false);
    expect(f.calls.length).toBe(before);
  });

  it('summarises across hydrated collections', async () => {
    const s = createServerProgressStore(async () => ({
      'milwaukee-wi': ['milwi-001', 'milwi-002'], wisconsin: ['wisco-001'],
    }));
    await s.hydrate!('milwaukee-wi');
    expect(s.summary()).toEqual({ 'milwaukee-wi': 2, wisconsin: 1 });
  });

  it('never writes to localStorage', async () => {
    const storage = fakeStorage();
    const s = createServerProgressStore(async () => ({ 'milwaukee-wi': ['milwi-042'] }));
    await s.hydrate!('milwaukee-wi');
    s.grant('milwaukee-wi', 'milwi-099');
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('driver interchangeability', () => {
  it('the local driver has no hydrate, so signed-out play is unchanged', () => {
    // CollectionCrowd calls store.hydrate?.(slug); for the local driver that must be a no-op.
    expect(createLocalProgressStore(fakeStorage()).hydrate).toBeUndefined();
  });
});

describe('createLocalProgressStore — when it reads storage', () => {
  /** Counts getItem calls, so "has it read yet?" is observable. */
  function countingStorage(initial: Record<string, string> = {}) {
    const inner = fakeStorage(initial);
    let reads = 0;
    const storage = {
      get length() { return inner.length; },
      clear: () => inner.clear(),
      getItem: (k: string) => { reads++; return inner.getItem(k); },
      key: (i: number) => inner.key(i),
      removeItem: (k: string) => inner.removeItem(k),
      setItem: (k: string, v: string) => inner.setItem(k, v),
    } as Storage;
    return { storage, reads: () => reads };
  }

  it('does not touch storage merely by being constructed', () => {
    const { storage, reads } = countingStorage();
    createLocalProgressStore(storage);
    expect(reads()).toBe(0);
  });

  /**
   * The regression. `localStore` is a module singleton created when CollectionCrowd is first
   * imported, and main.tsx's static `import App` evaluates that before its own body gets to
   * seed the dev mock -- so a store that snapshots at construction reads an empty localStorage
   * and the whole room comes up empty on first load. Reading on first USE is what makes the
   * order of those two events stop mattering.
   */
  it('sees progress written after it was constructed', () => {
    const storage = fakeStorage();
    const store = createLocalProgressStore(storage);
    storage.setItem(STORAGE_KEY, JSON.stringify({ 'milwaukee-wi': { 'milwi-001': 1 } }));
    expect(store.load('milwaukee-wi').has('milwi-001')).toBe(true);
  });

  it('reads once and then trusts its own mirror', () => {
    const { storage, reads } = countingStorage({
      [STORAGE_KEY]: JSON.stringify({ 'milwaukee-wi': { 'milwi-001': 1 } }),
    });
    const store = createLocalProgressStore(storage);
    store.load('milwaukee-wi');
    store.load('milwaukee-wi');
    store.summary();
    expect(reads()).toBe(1);
  });

  it('does not re-read and resurrect a bobit it has just revoked', () => {
    const storage = fakeStorage({
      [STORAGE_KEY]: JSON.stringify({ 'milwaukee-wi': { 'milwi-001': 1 } }),
    });
    const store = createLocalProgressStore(storage);
    store.revoke('milwaukee-wi', 'milwi-001');
    expect(store.load('milwaukee-wi').has('milwi-001')).toBe(false);
  });

  it('still starts empty when the very first read throws', () => {
    const store = createLocalProgressStore(brokenStorage());
    expect(store.load('milwaukee-wi').size).toBe(0);
  });
});

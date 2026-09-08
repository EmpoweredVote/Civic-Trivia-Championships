import { describe, it, expect } from 'vitest';
import { createLocalProgressStore, createServerProgressStore } from '../bobitProgress';
import type { BobitProgressStore } from '../bobitProgress';
import { crowdInit, crowdApply } from '../crowdReducer';
import { crowdFigures } from '../crowdFigures';
import { CROWD_CAP } from '../crowdLayout';

/**
 * The collection invariant, stated as a test.
 *
 * The number of bobits standing on the game stage is the number of questions this player has
 * answered correctly in THAT collection -- nothing else. Switch to a collection you have
 * never played and the stage is empty; switch back and everyone is exactly where they were.
 *
 * This is the behaviour the whole mechanic rests on, and it spans four pieces (the store, the
 * reducer's seed, the layout cap and the figure builder), so it is asserted here end to end
 * rather than trusted to each piece's own tests.
 */

const band = { width: 1000, height: 90, scale: 0.2 };

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  } as Storage;
}

/** What the game stage would actually draw for `slug`, given this store. */
function figuresOnStage(store: BobitProgressStore, slug: string) {
  const owned = [...store.load(slug)];
  const state = crowdApply(crowdInit(), { type: 'seed', ids: owned });
  return crowdFigures(state, 0, band, false);
}

const countOnStage = (store: BobitProgressStore, slug: string) =>
  figuresOnStage(store, slug).length;

describe('the stage shows exactly this collection\'s correct answers', () => {
  it('counts one bobit per correct answer in the collection being played', () => {
    const store = createLocalProgressStore(fakeStorage());
    store.grant('milwaukee-wi', 'milwi-001');
    store.grant('milwaukee-wi', 'milwi-002');
    store.grant('milwaukee-wi', 'milwi-003');
    expect(countOnStage(store, 'milwaukee-wi')).toBe(3);
  });

  it('is empty for a collection never played', () => {
    const store = createLocalProgressStore(fakeStorage());
    store.grant('milwaukee-wi', 'milwi-001');
    expect(countOnStage(store, 'wisconsin')).toBe(0);
  });

  it('does not count another collection\'s bobits', () => {
    const store = createLocalProgressStore(fakeStorage());
    store.grant('milwaukee-wi', 'milwi-001');
    store.grant('milwaukee-wi', 'milwi-002');
    store.grant('wisconsin', 'wisco-001');
    expect(countOnStage(store, 'milwaukee-wi')).toBe(2);
    expect(countOnStage(store, 'wisconsin')).toBe(1);
  });

  it('drops to zero on switching to a fresh collection and restores on switching back', () => {
    // The exact journey: play Milwaukee, switch to Wisconsin, switch back.
    const store = createLocalProgressStore(fakeStorage());
    store.grant('milwaukee-wi', 'milwi-001');
    store.grant('milwaukee-wi', 'milwi-002');

    const before = figuresOnStage(store, 'milwaukee-wi');
    expect(before.length).toBe(2);

    expect(countOnStage(store, 'wisconsin')).toBe(0);          // fresh collection: empty stage

    const after = figuresOnStage(store, 'milwaukee-wi');       // and back again
    expect(after.length).toBe(2);
    // Not merely the same count -- the same bobits, in the same places.
    expect(after.map(f => f.id)).toEqual(before.map(f => f.id));
    expect(after.map(f => f.x)).toEqual(before.map(f => f.x));
    expect(after.map(f => f.color)).toEqual(before.map(f => f.color));
  });

  it('playing a second collection does not disturb the first', () => {
    const store = createLocalProgressStore(fakeStorage());
    store.grant('milwaukee-wi', 'milwi-001');
    const before = figuresOnStage(store, 'milwaukee-wi').map(f => f.x);

    store.grant('wisconsin', 'wisco-001');
    store.grant('wisconsin', 'wisco-002');

    expect(countOnStage(store, 'milwaukee-wi')).toBe(1);
    expect(figuresOnStage(store, 'milwaukee-wi').map(f => f.x)).toEqual(before);
  });

  it('a missed question removes exactly one bobit, from the right collection', () => {
    const store = createLocalProgressStore(fakeStorage());
    store.grant('milwaukee-wi', 'milwi-001');
    store.grant('milwaukee-wi', 'milwi-002');
    store.grant('wisconsin', 'wisco-001');

    store.revoke('milwaukee-wi', 'milwi-001');

    expect(countOnStage(store, 'milwaukee-wi')).toBe(1);
    expect(countOnStage(store, 'wisconsin')).toBe(1);
  });

  it('renders at most the cap, and reports the rest as overflow', () => {
    const store = createLocalProgressStore(fakeStorage());
    for (let i = 0; i < CROWD_CAP + 12; i++) {
      store.grant('milwaukee-wi', `milwi-${String(i).padStart(4, '0')}`);
    }
    expect(store.load('milwaukee-wi').size).toBe(CROWD_CAP + 12);
    expect(countOnStage(store, 'milwaukee-wi')).toBe(CROWD_CAP);
  });

  it('survives the round trip through storage', () => {
    // A reload is the common case, and it must not change the count.
    const storage = fakeStorage();
    const first = createLocalProgressStore(storage);
    first.grant('milwaukee-wi', 'milwi-001');
    first.grant('milwaukee-wi', 'milwi-002');
    first.grant('wisconsin', 'wisco-001');

    const reloaded = createLocalProgressStore(storage);
    expect(countOnStage(reloaded, 'milwaukee-wi')).toBe(2);
    expect(countOnStage(reloaded, 'wisconsin')).toBe(1);
  });
});

describe('the same invariant holds for the account-backed driver', () => {
  const payload = {
    'milwaukee-wi': ['milwi-001', 'milwi-002', 'milwi-003'],
    wisconsin: ['wisco-001'],
  };

  it('counts only the played collection', async () => {
    const store = createServerProgressStore(async () => payload);
    await store.hydrate!('milwaukee-wi');
    expect(countOnStage(store, 'milwaukee-wi')).toBe(3);
    expect(countOnStage(store, 'wisconsin')).toBe(1);
  });

  it('is empty for a collection the account has never played', async () => {
    const store = createServerProgressStore(async () => payload);
    await store.hydrate!('bend-or');
    expect(countOnStage(store, 'bend-or')).toBe(0);
  });

  it('restores the same bobits in the same places on switching back', async () => {
    const store = createServerProgressStore(async () => payload);
    await store.hydrate!('milwaukee-wi');
    const before = figuresOnStage(store, 'milwaukee-wi');

    await store.hydrate!('wisconsin');                 // switching collections re-hydrates
    expect(countOnStage(store, 'wisconsin')).toBe(1);

    await store.hydrate!('milwaukee-wi');
    const after = figuresOnStage(store, 'milwaukee-wi');
    expect(after.map(f => f.id)).toEqual(before.map(f => f.id));
    expect(after.map(f => f.x)).toEqual(before.map(f => f.x));
  });

  it('an unreachable server shows an empty stage rather than another collection\'s crowd', async () => {
    const store = createServerProgressStore(async () => { throw new Error('offline'); });
    await store.hydrate!('milwaukee-wi');
    expect(countOnStage(store, 'milwaukee-wi')).toBe(0);
  });
});

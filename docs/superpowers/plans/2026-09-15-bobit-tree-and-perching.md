# Bobit tree, perching and the 25% milestone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the collection room its first permanent structure — a small climbable tree earned at 25% of a collection — and the perching behaviour that makes `Surface` a real interface rather than an unused one.

**Architecture:** The tree is **room-owned**, not scene-owned: unlike the cannon it is not part of a `Scene`, it is a prop `CollectionCrowd` emits every frame once the collection's milestone has been reached, and it animates in once via a `grow` value rather than by being choreographed. Perching adds one `Activity` to `crowdAgents` and one consumer of `Surface`. The milestone trigger is a persisted per-collection high-water mark, so it can never un-fire.

**Tech Stack:** TypeScript, React 18, canvas 2D, vitest (node environment), Playwright for visual verification.

**Spec:** `docs/superpowers/specs/2026-09-12-bobit-living-room-design.md` — **read its two addenda**, 2026-09-14 (what plan 1 changed) and 2026-09-15 (what plan 3 must change). The 2026-09-15 addendum overrides the spec body on tree height and on how the milestone is stored.

## Global Constraints

- **The band is 96px desktop / 72px mobile.** A standing bobit is ~48px of that. Anything that leaves the floor line must be checked against 96px before it is built. This is the constraint that broke `pool-peek` and `pool-drop`.
- **Rig units, not pixels.** Prop and figure geometry is in rig units; `scale` is 0.2. 240 rig units = a standing bobit = ~48px. Divide by 5 for px at the band's scale.
- **The four occlusion bounds hold and are not to be widened** (spec, 2026-09-14 addendum): transient only, reveal phase only, `pointer-events: none` + `interactive={false}`, set pieces only. **The tree is none of those things — it is permanent and in-band, so it must never be drawn on the aerial overlay.**
- **`backend/` in this repo is FROZEN.** Nothing in this plan touches it. Progress storage stays localStorage for signed-out players and the ev-accounts server driver for signed-in ones.
- **A perched figure MUST carry `hoverAnim: 'greetseat'`.** `fieldGeometry.ts` documents why: `figureBounds` and the ink probe measure from the BASE anim while `paint` positions with the RESOLVED one, so a seated figure given a standing `hoverAnim` is drawn ~104 units from its own hit box.
- **Props draw BEHIND figures** (`BobitField.tsx`, "Props first: they stand behind the crowd"). The spec's "a bobit can walk behind the tree" is therefore **dropped** — it was a depth-era idea and depth is gone. A perched bobit drawing in front of the trunk is what this order already gives, and is what matters.
- **Never regress a test into restating the implementation.** Three defects in this feature hid behind tests that asserted the code's own arithmetic. Assert consequences: is it visible, did it persist, did it end up where it should.
- **Look at it.** Every task that changes a pixel ends with a sheet from `scripts/bobit-props.mjs`, `scripts/bobit-scenes.mjs` or `scripts/bobit-shots.mjs`, and the step is not done until a human or the implementer has actually opened the PNG.

---

### Task 1: `questionCount` reaches the game

The 25% denominator exists on `CollectionSummary` but nothing on the game route has it. `src/pages/Game.tsx` renders both `GameScreen` and `ResultsScreen`, so it is the single place to thread it through. This also gives `ResultsScreen.collectionQuestionCount` its first real caller — it is currently declared, passed by nobody, and always falls back to 5.

**Files:**
- Create: `frontend/src/features/collections/hooks/useCollectionQuestionCount.ts`
- Create: `frontend/src/features/collections/hooks/__tests__/useCollectionQuestionCount.test.ts`
- Modify: `frontend/src/pages/Game.tsx`
- Modify: `frontend/src/features/game/components/GameScreen.tsx`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

**Interfaces:**
- Consumes: `CollectionSummary` from `src/features/collections/types.ts` (has `slug: string` and `questionCount: number`); `apiRequest` from `src/services/api`.
- Produces: `questionCountForSlug(collections: CollectionSummary[], slug: string | null): number | null` and the hook `useCollectionQuestionCount(slug: string | null): number | null`. `CollectionCrowd` gains a prop `questionCount?: number | null`.

- [ ] **Step 1: Write the failing test for the pure lookup**

Create `frontend/src/features/collections/hooks/__tests__/useCollectionQuestionCount.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { questionCountForSlug } from '../useCollectionQuestionCount';
import type { CollectionSummary } from '../../types';

const summary = (slug: string, questionCount: number): CollectionSummary => ({
  id: 1, name: slug, slug, description: '', themeColor: '#000',
  questionCount, tier: 'city', localeName: '', localeCode: '',
} as CollectionSummary);

describe('questionCountForSlug', () => {
  it('finds the count for a slug', () => {
    expect(questionCountForSlug([summary('a', 10), summary('b', 42)], 'b')).toBe(42);
  });

  it('is null for a slug that is not there', () => {
    expect(questionCountForSlug([summary('a', 10)], 'zzz')).toBeNull();
  });

  it('is null with no slug at all', () => {
    expect(questionCountForSlug([summary('a', 10)], null)).toBeNull();
  });

  /** A collection with no questions must not become a 0 denominator downstream. */
  it('is null rather than zero when the collection is empty', () => {
    expect(questionCountForSlug([summary('a', 0)], 'a')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd frontend && npx vitest run src/features/collections/hooks/__tests__/useCollectionQuestionCount.test.ts`
Expected: FAIL — `questionCountForSlug is not a function`.

- [ ] **Step 3: Write the hook and its pure half**

Create `frontend/src/features/collections/hooks/useCollectionQuestionCount.ts`:

```typescript
import { useEffect, useState } from 'react';
import { apiRequest } from '../../../services/api';
import type { CollectionSummary } from '../types';

/**
 * How many questions a collection holds, or null if we cannot say.
 *
 * Null rather than 0 for an empty collection: every consumer uses this as a DENOMINATOR, and a
 * zero would turn "25% of the collection" into "always earned".
 */
export function questionCountForSlug(
  collections: CollectionSummary[], slug: string | null,
): number | null {
  if (!slug) return null;
  const found = collections.find(c => c.slug === slug);
  return found && found.questionCount > 0 ? found.questionCount : null;
}

/**
 * The collection list is fetched on the dashboard by `useCollections`, but the game is a
 * separate route with its own tree, so it has to ask again. One extra GET of an endpoint the
 * app already calls, against a public route, on a screen that is about to run for minutes.
 *
 * Never throws: the crowd and the proficiency stat both degrade to "unknown" on failure, and
 * neither is worth interrupting a match for.
 */
export function useCollectionQuestionCount(slug: string | null): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) { setCount(null); return; }
    let cancelled = false;
    apiRequest<{ collections: CollectionSummary[] }>('/api/game/collections')
      .then(({ collections }) => {
        if (!cancelled) setCount(questionCountForSlug(collections ?? [], slug));
      })
      .catch(() => { if (!cancelled) setCount(null); });
    return () => { cancelled = true; };
  }, [slug]);

  return count;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `cd frontend && npx vitest run src/features/collections/hooks/__tests__/useCollectionQuestionCount.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Thread it through `Game.tsx`**

In `frontend/src/pages/Game.tsx`, add the import beside the others:

```typescript
import { useCollectionQuestionCount } from '../features/collections/hooks/useCollectionQuestionCount';
```

Inside the component, next to the other hooks:

```typescript
  // The 25% milestone's denominator, and the Proficiency stat's. Null while it loads and on
  // failure; both consumers treat null as "unknown" rather than guessing.
  const collectionQuestionCount = useCollectionQuestionCount(state.collectionSlug ?? null);
```

Pass it to `ResultsScreen` (the prop is already declared there and has never been supplied):

```typescript
        collectionQuestionCount={collectionQuestionCount}
```

And to `GameScreen`:

```typescript
      collectionQuestionCount={collectionQuestionCount}
```

- [ ] **Step 6: Accept and forward it in `GameScreen`**

In `frontend/src/features/game/components/GameScreen.tsx`, add to the props interface:

```typescript
  /** Questions in this collection, for the crowd's 25% milestone. Null while unknown. */
  collectionQuestionCount?: number | null;
```

Destructure it with the other props, and pass it to the crowd:

```tsx
          <CollectionCrowd
            slug={state.collectionSlug}
            darkMode={darkMode}
            isMobile={isMobile}
            lastAnswer={lastAnswer}
            finished5of5={finished5of5}
            questionCount={collectionQuestionCount}
            // Bound 2 of the occlusion relaxation: a figure may only pass in front of the
            // question card once the answer is revealed, never while the timer is running.
            aerialAllowed={state.phase === 'revealing'}
          />
```

- [ ] **Step 7: Accept it in `CollectionCrowd`**

In `frontend/src/features/collection/CollectionCrowd.tsx`, add to the props interface:

```typescript
  /**
   * Questions in this collection. The milestone denominator. Null means unknown, and an unknown
   * denominator must never earn anything -- see `treeEarned` in Task 3.
   */
  questionCount?: number | null;
```

Destructure it with a default of `null`. It is unused this task; Task 3 consumes it.

- [ ] **Step 8: Typecheck, run the suite, look at the game**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: tsc clean, all tests pass.

Then, with `npm run dev` running, open `http://localhost:5173/?mock=1&collection=milwaukee-wi` and play to the results screen. The Proficiency stat should now use 120 (the mock's `questionCount`) as its denominator rather than 5.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/collections/hooks/useCollectionQuestionCount.ts \
        frontend/src/features/collections/hooks/__tests__/useCollectionQuestionCount.test.ts \
        frontend/src/pages/Game.tsx \
        frontend/src/features/game/components/GameScreen.tsx \
        frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat(bobits): thread collection questionCount to the game route

The 25% milestone needs a denominator and ResultsScreen has declared
collectionQuestionCount since it was written without a single caller -- it has
always silently fallen back to this game's five questions.

Game.tsx renders both consumers, so it is the one place to fetch it. Null
rather than 0 for an empty collection: every consumer divides by this."
```

---

### Task 2: the high-water mark

The room can lose bobits, so the milestone cannot be derived from the current owned count without the tree vanishing and returning. Record the best count ever reached, per collection.

**Files:**
- Create: `frontend/src/features/collection/bobitPeak.ts`
- Create: `frontend/src/features/collection/__tests__/bobitPeak.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PEAK_STORAGE_KEY = 'ctc.bobits.peak.v1'`, and `createPeakStore(storage?: Storage): PeakStore` where `PeakStore` is `{ peak(slug: string): number; record(slug: string, owned: number): void }`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/collection/__tests__/bobitPeak.test.ts`:

```typescript
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

  it('keeps working when storage itself throws', () => {
    const s = createPeakStore(brokenStorage());
    s.record('milwaukee-wi', 5);
    expect(s.peak('milwaukee-wi')).toBe(5);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/bobitPeak.test.ts`
Expected: FAIL — `createPeakStore is not a function`.

- [ ] **Step 3: Write the store**

Create `frontend/src/features/collection/bobitPeak.ts`:

```typescript
/**
 * The best number of bobits a player has ever held in a collection.
 *
 * Separate from `bobitProgress` on purpose. That key's shape is
 * `{ [slug]: { [questionId]: epochMs } }` and widening it would break its parse for every
 * player mid-collection, for a value that is not progress at all -- it is a latch on a piece of
 * scenery.
 *
 * Local even for signed-in players. The high-water mark is cosmetic, the signed-in driver reads
 * from ev-accounts, and that service is outside this repo while `backend/` here is frozen -- so
 * there is nowhere to put it server-side without work this plan cannot do. A signed-in player
 * who switches browsers re-earns the tree. That is worse than storing it properly and much
 * better than blocking the feature on another service.
 */

export const PEAK_STORAGE_KEY = 'ctc.bobits.peak.v1';

/** `{ [collectionSlug]: bestOwnedCountEverSeen }` */
type PeakShape = Record<string, number>;

export interface PeakStore {
  peak(slug: string): number;
  record(slug: string, owned: number): void;
}

export function createPeakStore(storage?: Storage): PeakStore {
  const backing = storage ?? safeDefaultStorage();

  // Filled on first USE. See the same note in bobitProgress.ts: a module-level singleton that
  // reads storage in its constructor has really read it at import time.
  let mirror: PeakShape | null = null;
  const data = (): PeakShape => (mirror ??= read(backing));

  function read(s: Storage | null): PeakShape {
    if (!s) return {};
    try {
      const raw = s.getItem(PEAK_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const out: PeakShape = {};
      for (const [slug, n] of Object.entries(parsed)) {
        if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[slug] = Math.floor(n);
      }
      return out;
    } catch {
      return {};
    }
  }

  function write() {
    if (!backing) return;
    try {
      backing.setItem(PEAK_STORAGE_KEY, JSON.stringify(data()));
    } catch {
      // Quota or private mode. The mirror already has it; only persistence is lost, and the
      // worst case is that a tree is re-earned next session.
    }
  }

  return {
    peak(slug) {
      return data()[slug] ?? 0;
    },
    record(slug, owned) {
      if (!Number.isFinite(owned) || owned <= 0) return;
      const d = data();
      const next = Math.floor(owned);
      if (next <= (d[slug] ?? 0)) return;
      d[slug] = next;
      write();
    },
  };
}

/** window.localStorage, or null where merely touching it throws. */
function safeDefaultStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/bobitPeak.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/bobitPeak.ts \
        frontend/src/features/collection/__tests__/bobitPeak.test.ts
git commit -m "feat(bobits): remember the best bobit count per collection

The milestone latch. A wrong answer takes a bobit back, so a tree derived from
the current count would vanish mid-match and return -- a rule that reads as a
bug. This never goes down.

A sibling key rather than a wider ctc.bobits.v1: that shape is
{slug: {questionId: epochMs}} and widening it breaks the parse for anyone
mid-collection, for a value that is scenery rather than progress."
```

---

### Task 3: earning the milestone

**Files:**
- Create: `frontend/src/features/collection/milestone.ts`
- Create: `frontend/src/features/collection/__tests__/milestone.test.ts`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

**Interfaces:**
- Consumes: `PeakStore` from Task 2; the `questionCount` prop from Task 1.
- Produces: `MILESTONE_FRACTION = 0.25` and `treeEarned(peak: number, questionCount: number | null): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/collection/__tests__/milestone.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/milestone.test.ts`
Expected: FAIL — `treeEarned is not a function`.

- [ ] **Step 3: Write it**

Create `frontend/src/features/collection/milestone.ts`:

```typescript
/**
 * Building milestones.
 *
 * 25% is the only one this plan implements. 50/75/100 are content added to a finished
 * mechanism (spec, "Milestone set piece"), and the tree is the worked example that proves the
 * seam is real.
 */

export const MILESTONE_FRACTION = 0.25;

/**
 * Has this collection earned its tree?
 *
 * `peak` is the high-water mark, never the current count -- see bobitPeak.ts.
 *
 * A null or zero `questionCount` earns NOTHING. It is null while the collection list is in
 * flight and after a failed fetch, and a tree that flickers in on every slow network is worse
 * than one that arrives a second late.
 */
export function treeEarned(peak: number, questionCount: number | null): boolean {
  if (!questionCount || questionCount <= 0) return false;
  return peak >= questionCount * MILESTONE_FRACTION;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/milestone.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Record the peak and compute `earned` in `CollectionCrowd`**

In `frontend/src/features/collection/CollectionCrowd.tsx`, add the imports:

```typescript
import { createPeakStore } from './bobitPeak';
import { treeEarned } from './milestone';
```

Beside the existing `localStore` module singleton, add:

```typescript
const peakStore = createPeakStore();
```

Add state and a ref inside the component, next to `overflow`:

```typescript
  /**
   * Whether this collection has earned its tree. State rather than a ref because the tree's
   * arrival must cause a render -- the prop list is rebuilt from it.
   */
  const [earned, setEarned] = useState(false);
  const earnedRef = useRef(false);
  useEffect(() => { earnedRef.current = earned; }, [earned]);
```

Add a helper inside the component, above the seeding effect:

```typescript
  /**
   * Tell the latch how many bobits the room holds, and recompute.
   *
   * Called wherever the resident list changes -- the seed, and every answer. Recording is
   * monotonic, so calling it with a smaller number after a loss is a no-op by design.
   */
  const syncMilestone = useCallback((slugNow: string | null) => {
    if (!slugNow) { setEarned(false); return; }
    peakStore.record(slugNow, stateRef.current.residents.length);
    setEarned(treeEarned(peakStore.peak(slugNow), questionCount ?? null));
  }, [questionCount]);
```

Call `syncMilestone(slug)` in three places:
1. At the end of the seeding effect's `seed()` function, after `setOverflow(...)`.
2. At the end of the `lastAnswer` effect, after `setOverflow(...)`.
3. In a small effect of its own, so a late-arriving `questionCount` re-evaluates:

```typescript
  // questionCount arrives after a fetch, so the first evaluation usually happens with it null.
  useEffect(() => { syncMilestone(slug ?? null); }, [slug, questionCount, syncMilestone]);
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: tsc clean, all tests pass. Nothing renders differently yet — `earned` has no consumer until Task 5.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/collection/milestone.ts \
        frontend/src/features/collection/__tests__/milestone.test.ts \
        frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat(bobits): work out whether a collection has earned its tree

Compares the high-water mark against a quarter of the collection. An unknown
denominator earns nothing: questionCount is null while its fetch is in flight,
and a tree that flickers in on every slow network is worse than a late one.

No consumer yet -- the tree itself lands in a later task."
```

---

### Task 4: tree geometry, and the sheet that proves it fits

Nothing is built on top of this until it has been looked at. The cannon shipped reading as a magnifying glass because no sheet existed; a tree in a 96px band is a tighter fit than the cannon ever was.

**Files:**
- Modify: `frontend/src/components/bobbits/props.ts`
- Modify: `frontend/src/components/bobbits/__tests__/props.test.ts`
- Modify: `frontend/src/components/bobbits/fieldGeometry.ts`
- Modify: `frontend/src/components/bobbits/BobitField.tsx`
- Modify: `frontend/scripts/bobit-props.mjs`

**Interfaces:**
- Consumes: `Surface` from `fieldGeometry.ts` (`{ id: string; left: number; right: number; y: number }`), `accentFor` from `props.ts`.
- Produces: `TREE_TRUNK_H`, `TREE_LEDGE_UP`, `TREE_HALF_W`, `drawTree(ctx, x, groundY, scale, grow, color)` and `treeSurfaces(x, groundY, scale): Surface[]`. `FieldProp.kind` widens to `'cannon' | 'tree'` and `FieldProp` gains `grow?: number`.

- [ ] **Step 1: Write the failing geometry tests**

Append to `frontend/src/components/bobbits/__tests__/props.test.ts`:

```typescript
import { drawTree, treeSurfaces, TREE_LEDGE_UP } from '../props';
import { bandFor } from '../../../features/collection/crowdLayout';

describe('treeSurfaces', () => {
  const BAND = bandFor(false);              // 96px desktop
  const FLOOR = BAND.height - 6;            // GROUND_INSET, the crowd's ground line

  it('offers exactly one branch', () => {
    expect(treeSurfaces(900, FLOOR, BAND.scale)).toHaveLength(1);
  });

  it('puts the branch above a standing bobit head', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    // A standing figure is 240 rig units; its head is at FLOOR - 240 * scale.
    expect(branch.y).toBeLessThan(FLOOR);
    expect(branch.y).toBeGreaterThan(0);
  });

  /**
   * The constraint that broke pool-peek and pool-drop, asserted rather than assumed: a bobit
   * SEATED on this branch has to fit inside a 96px band. A seated figure stands about 150 rig
   * units tall, so his head is at branch.y - 150 * scale and that must still be on the canvas.
   */
  it('leaves a seated bobit fully inside the band', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    const seatedHeadY = branch.y - 150 * BAND.scale;
    expect(seatedHeadY).toBeGreaterThanOrEqual(0);
  });

  it('is wide enough to sit on and narrow enough to be a branch', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    const w = branch.right - branch.left;
    expect(w).toBeGreaterThan(20 * BAND.scale);
    expect(w).toBeLessThan(200 * BAND.scale);
  });

  it('sits where the trunk is', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    expect(branch.left).toBeLessThan(900);
    expect(branch.right).toBeGreaterThan(900 - TREE_LEDGE_UP);
  });

  it('gives the branch a stable id', () => {
    expect(treeSurfaces(900, FLOOR, BAND.scale)[0].id).toBe(
      treeSurfaces(400, FLOOR, BAND.scale)[0].id,
    );
  });
});

describe('drawTree', () => {
  it('draws something and leaves the context balanced', () => {
    const { ctx, ops } = recordingCtx();
    drawTree(ctx, 900, 90, 0.2, 1, '#4A5568');
    expect(ops.filter(o => o === 'fill').length).toBeGreaterThan(0);
    expect(ops.filter(o => o === 'save').length).toBe(ops.filter(o => o === 'restore').length);
  });

  it('draws nothing at all before it has started growing', () => {
    const { ctx, ops } = recordingCtx();
    drawTree(ctx, 900, 90, 0.2, 0, '#4A5568');
    expect(ops.filter(o => o === 'fill').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/props.test.ts`
Expected: FAIL — `treeSurfaces is not a function`.

- [ ] **Step 3: Write the geometry**

Add the `Surface` import at the top of `frontend/src/components/bobbits/props.ts` — note
`fieldGeometry` does not import `props`, so this adds no cycle:

```typescript
import type { Surface } from './fieldGeometry';
```

Then append:

```typescript
/**
 * The tree, in rig units, sized to a 96px band and nothing larger.
 *
 * 240 units is a standing bobit (~48px at scale 0.2) and the band is 480 units tall, so the
 * whole tree has to live in what is left after the crowd. That is why there is ONE branch: a
 * second ledge above this one would put its occupant's head through the top of the canvas.
 * See the spec's 2026-09-15 addendum.
 *
 *   480 ---- top of the band
 *   430 ---- canopy top
 *   250 ---- branch ledge      <- a seated bobit reaches ~400 from here
 *   240 ---- a standing bobit's head, for scale
 *     0 ---- the floor line
 */
const TREE_TRUNK_W = 34;
export const TREE_TRUNK_H = 300;
/** Height of the branch above the ground line, in rig units. */
export const TREE_LEDGE_UP = 250;
/** Half the tree's total footprint, for the trunk's own placement. */
export const TREE_HALF_W = 90;
const BRANCH_LEN = 78;
const BRANCH_W = 16;
const CANOPY_R = 88;

/**
 * Where a bobit can sit. The first and only consumer of `Surface`, which has waited in
 * fieldGeometry.ts since Stage 1 for exactly this.
 *
 * The branch reaches LEFT out of the trunk, because the tree stands on the right border and a
 * branch reaching right would hang off the edge of the viewport.
 */
export function treeSurfaces(x: number, groundY: number, scale: number): Surface[] {
  const y = groundY - TREE_LEDGE_UP * scale;
  return [{
    id: 'tree:branch',
    left: x - (TREE_TRUNK_W * 0.5 + BRANCH_LEN) * scale,
    right: x - TREE_TRUNK_W * 0.25 * scale,
    y,
  }];
}

/**
 * The tree.
 *
 * `grow` is 0-1. At 0 nothing is drawn at all, so a caller can animate it up out of the floor
 * without a special case; at 1 it is full height. Growth scales the HEIGHT only -- a tree that
 * also grew sideways read as a balloon inflating rather than as something sprouting.
 */
export function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, scale: number, grow = 1, color = '#3F4854',
) {
  const g = Math.max(0, Math.min(1, grow));
  if (g <= 0) return;
  const accent = accentFor(color);

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale * g);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Canopy first, so the trunk and branch read on top of it.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-10, -TREE_TRUNK_H - 40, CANOPY_R, CANOPY_R * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-70, -TREE_TRUNK_H + 6, CANOPY_R * 0.56, CANOPY_R * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(52, -TREE_TRUNK_H - 6, CANOPY_R * 0.5, CANOPY_R * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk: a touch wider at the base so it sits on the floor rather than balancing on it.
  ctx.beginPath();
  ctx.moveTo(-TREE_TRUNK_W * 0.8, 0);
  ctx.lineTo(-TREE_TRUNK_W * 0.42, -TREE_TRUNK_H);
  ctx.lineTo(TREE_TRUNK_W * 0.42, -TREE_TRUNK_H);
  ctx.lineTo(TREE_TRUNK_W * 0.8, 0);
  ctx.closePath();
  ctx.fill();

  // The branch that `treeSurfaces` describes. Drawn as a solid bar: a bobit sits ON this, so
  // its top edge and the Surface's `y` are the same line.
  ctx.fillStyle = color;
  ctx.fillRect(
    -(TREE_TRUNK_W * 0.5 + BRANCH_LEN), -TREE_LEDGE_UP - BRANCH_W,
    BRANCH_LEN + TREE_TRUNK_W * 0.5, BRANCH_W,
  );

  // Two accent notches on the trunk, the tree's equivalent of the cannon's bands: cheap, and
  // they stop it reading as a flat post at 60px.
  ctx.fillStyle = accent;
  ctx.fillRect(-TREE_TRUNK_W * 0.34, -TREE_TRUNK_H * 0.62, TREE_TRUNK_W * 0.68, 10);
  ctx.fillRect(-TREE_TRUNK_W * 0.3, -TREE_TRUNK_H * 0.34, TREE_TRUNK_W * 0.6, 9);

  ctx.restore();
}
```

- [ ] **Step 4: Widen `FieldProp` and dispatch in `BobitField`**

In `frontend/src/components/bobbits/fieldGeometry.ts`, change `FieldProp`:

```typescript
  kind: 'cannon' | 'tree';
```

and add:

```typescript
  /** 0-1 for a tree that is still sprouting. Ignored by every other kind. */
  grow?: number;
```

In `frontend/src/components/bobbits/BobitField.tsx`, add `drawTree` to the import from `./props`, and extend the dispatch beside the existing `if (pr.kind === 'cannon')`:

```typescript
        if (pr.kind === 'tree') {
          drawTree(ctx, pr.x, pr.groundY, pr.scale, pr.grow ?? 1, pr.color || CANNON_COLOR);
        }
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/props.test.ts && npx tsc --noEmit`
Expected: PASS, and tsc clean.

- [ ] **Step 6: Put the tree on the prop sheet**

In `frontend/scripts/bobit-props.mjs`, after the cannon rows, add a tree row to the `sheet` function — inside the same `page.evaluate`, before the `return`:

```javascript
    c.fillStyle = label;
    c.font = '13px system-ui, sans-serif';
    c.fillText('the tree: at band scale beside a standing bobit, and enlarged', 660, 200);

    // At the size the player sees it, with a standing bobit AND a seated one on the branch --
    // the seated figure is the whole question, because the band is 96px.
    {
      const bx = 760, by = 120;
      props.drawTree(c, bx, by, 0.2, 1, body);
      const stand = ALL_ANIMATIONS.standstill.frame(0.2);
      c.save(); c.translate(bx - 60, by - 112 * 0.2); c.scale(0.2, 0.2);
      draw(c, computePose(stand, CFG, { x: 0, y: 0 }), CFG, { color: figColor(0, isDark) });
      c.restore();
      const [branch] = props.treeSurfaces(bx, by, 0.2);
      const seated = ALL_ANIMATIONS.sit.frame(0.3);
      c.save(); c.translate((branch.left + branch.right) / 2, branch.y - 112 * 0.2);
      c.scale(0.2, 0.2);
      draw(c, computePose(seated, CFG, { x: 0, y: 0 }), CFG, { color: figColor(1, isDark) });
      c.restore();
    }

    // Enlarged, with the band's real top edge drawn in: if the seated bobit crosses this line
    // the tree is too tall and the geometry has to come down.
    {
      const bx = 1020, by = 560, s = 0.8;
      props.drawTree(c, bx, by, s, 1, body);
      const [branch] = props.treeSurfaces(bx, by, s);
      const seated = ALL_ANIMATIONS.sit.frame(0.3);
      c.save(); c.translate((branch.left + branch.right) / 2, branch.y - 112 * s);
      c.scale(s, s);
      draw(c, computePose(seated, CFG, { x: 0, y: 0 }), CFG, { color: figColor(1, isDark) });
      c.restore();
      // The band's top edge at this enlargement. The ground line sits GROUND_INSET (6px) above
      // the band's bottom, so the top is 90px above it at scale 0.2, and 90 * (s / 0.2) away
      // here. If the seated bobit crosses this line, the tree is too tall for the real band.
      const bandTopY = by - (96 - 6) * (s / 0.2);
      c.strokeStyle = '#DC2626';
      c.beginPath();
      c.moveTo(bx - 200, bandTopY);
      c.lineTo(bx + 120, bandTopY);
      c.stroke();
      c.fillStyle = '#DC2626';
      c.font = '12px ui-monospace, monospace';
      c.fillText('band top', bx - 200, bandTopY - 6);
    }
```

- [ ] **Step 7: LOOK AT IT**

Run, with `npm run dev` in another shell:

```bash
cd frontend && node scripts/bobit-props.mjs
```

Open `frontend/.shots/prop-cannon-light.png` and `prop-cannon-dark.png`.

Check, and do not proceed until all four are true:
1. The tree reads as a tree at band scale, not as a post or a lollipop.
2. The seated bobit on the branch is **entirely above the red band-top line** — if any part of him crosses it, reduce `TREE_LEDGE_UP` by 20 units and re-run.
3. The trunk's accent notches are visible in **both** themes.
4. A standing bobit beside the trunk is clearly shorter than the tree.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/bobbits/props.ts \
        frontend/src/components/bobbits/__tests__/props.test.ts \
        frontend/src/components/bobbits/fieldGeometry.ts \
        frontend/src/components/bobbits/BobitField.tsx \
        frontend/scripts/bobit-props.mjs
git commit -m "feat(bobits): tree geometry, and the first consumer of Surface

One branch, not the spec's 2-3: the band is 96px and a standing bobit is half
of it, so a second ledge would put its occupant's head through the top of the
canvas. The tests assert that a SEATED figure fits, rather than asserting the
numbers back at themselves.

grow is 0-1 and scales height only. A tree that grew sideways too read as a
balloon inflating rather than as something sprouting.

Sheeted before anything is built on it. The cannon shipped reading as a
magnifying glass because no sheet existed."
```

---

### Task 5: the tree in the room

**Files:**
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`
- Create: `frontend/src/features/collection/treePlacement.ts`
- Create: `frontend/src/features/collection/__tests__/treePlacement.test.ts`

**Interfaces:**
- Consumes: `earned` from Task 3; `treeSurfaces`, `TREE_HALF_W` from Task 4.
- Produces: `treeX(width: number, scale: number): number` and `TREE_GROW_SEC = 2`.

- [ ] **Step 1: Write the failing placement tests**

Create `frontend/src/features/collection/__tests__/treePlacement.test.ts`:

```typescript
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

  it('grows over a couple of seconds', () => {
    expect(TREE_GROW_SEC).toBe(2);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/treePlacement.test.ts`
Expected: FAIL — `treeX is not a function`.

- [ ] **Step 3: Write it**

Create `frontend/src/features/collection/treePlacement.ts`:

```typescript
import { TREE_HALF_W } from '../../components/bobbits/props';

/** Seconds the sapling takes to reach full height, the first time it is ever seen. */
export const TREE_GROW_SEC = 2;

/**
 * Where the trunk stands.
 *
 * Hard against the right border, inset by its own half-width so nothing is clipped. The band is
 * full-bleed, so "the right border" really is the right edge of the viewport.
 */
export function treeX(width: number, scale: number): number {
  const half = TREE_HALF_W * scale;
  return Math.max(half, width - half);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/treePlacement.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Emit the tree from `CollectionCrowd`**

Add imports:

```typescript
import { treeX, TREE_GROW_SEC } from './treePlacement';
import { treeSurfaces } from '../../components/bobbits/props';
```

Add a ref for the growth clock, beside the other refs:

```typescript
  /**
   * Seconds the tree has been growing. Persists for the life of the mount, so a tree already
   * standing when the screen opens does not re-sprout on every question.
   */
  const growRef = useRef(0);
```

Advance it in the frame loop, inside `figuresFor`, right after `directorStep` is called:

```typescript
      if (earnedRef.current) growRef.current = Math.min(TREE_GROW_SEC, growRef.current + dt);
```

Replace `propsFor` so it appends the tree to the director's props:

```typescript
  // Props are the director's set pieces PLUS the room's own permanent scenery. The cannon is
  // scene-owned and transient; the tree is room-owned and persistent, which is why it is
  // concatenated here rather than being a Scene beat.
  const propsFor = useMemo(() => (): FieldProp[] => {
    const color = darkMode ? '#9AA6B8' : '#4A5568';
    const out: FieldProp[] = directorRef.current.props.map(p => ({
      id: p.id, kind: p.kind, x: p.x, groundY: p.groundY, scale: band.scale,
      flip: p.flip, angle: p.angle, color,
    }));
    if (earnedRef.current && !isMobile) {
      const w = laidOutAtRef.current || band.width;
      out.push({
        id: 'room:tree',
        kind: 'tree',
        x: treeX(w, band.scale),
        groundY: sceneGroundY(band),
        scale: band.scale,
        grow: growRef.current / TREE_GROW_SEC,
        color,
      });
    }
    return out;
  }, [band, darkMode, isMobile]);
```

- [ ] **Step 6: Move the overflow label to the left**

The trunk now occupies the bottom-right corner. In the same file, find the `+N more` label's style block and change `right` to `left`:

```typescript
          bottom: 4, left: 8,
```

- [ ] **Step 7: Typecheck, run the suite, and LOOK AT IT**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: tsc clean, all tests pass.

Then, with `npm run dev` running, open:

```
http://localhost:5173/?mock=1&collection=milwaukee-wi&owned=40
```

The mock collection has `questionCount: 120`, so 40 owned is past the 25% mark and the tree must be standing on the right border, growing in over two seconds on first load. Check the `+N more` label is bottom-LEFT and not underneath the trunk. Then reload with `&owned=8` — below the mark, and with a fresh browser context the tree must be absent.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/collection/treePlacement.ts \
        frontend/src/features/collection/__tests__/treePlacement.test.ts \
        frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat(bobits): stand the tree in the room once it is earned

Room-owned, not scene-owned: the cannon is a Scene beat and leaves with its
scene, the tree is concatenated onto the prop list every frame and stays. It
grows in once per mount rather than being choreographed, so there is no set
piece to keep alive for the lifetime of a collection.

The +N more label moves to the bottom LEFT, because the trunk is now where it
used to sit."
```

---

### Task 6: perching

**Files:**
- Modify: `frontend/src/features/collection/crowdAgents.ts`
- Modify: `frontend/src/features/collection/__tests__/crowdAgents.test.ts`
- Modify: `frontend/src/features/collection/crowdFigures.ts`
- Modify: `frontend/src/features/collection/__tests__/crowdFigures.test.ts`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

**Interfaces:**
- Consumes: `treeSurfaces` from Task 4, `treeX` from Task 5.
- Produces: `Activity` widens to `'wander' | 'rank' | 'moving' | 'perch'`; `Agent` gains `perchId?: string`; `assignPerch(state, surfaces, rand): AgentState`; `PERCH_DWELL_SEC = 26`.

- [ ] **Step 1: Write the failing perch tests**

Append to `frontend/src/features/collection/__tests__/crowdAgents.test.ts`:

```typescript
import { assignPerch, PERCH_DWELL_SEC } from '../crowdAgents';

describe('assignPerch', () => {
  const BRANCH = [{ id: 'tree:branch', left: 800, right: 880, y: 40 }];

  const roomAt = (xs: Record<string, number>): AgentState => {
    const base = initAgents(Object.keys(xs), OPTS());
    const out: AgentState = {};
    for (const id of Object.keys(xs)) out[id] = { ...base[id], x: xs[id] };
    return out;
  };

  it('sends somebody to an empty branch', () => {
    const out = assignPerch(roomAt({ a: 100, b: 840 }), BRANCH, () => 0);
    const perching = Object.values(out).filter(ag => ag.perchId === 'tree:branch');
    expect(perching).toHaveLength(1);
  });

  it('sends the NEAREST bobit, not an arbitrary one', () => {
    const out = assignPerch(roomAt({ far: 100, near: 840 }), BRANCH, () => 0);
    expect(out.near.perchId).toBe('tree:branch');
    expect(out.far.perchId).toBeUndefined();
  });

  /** Capacity one. A second climber would sit inside the first. */
  it('leaves a taken branch alone', () => {
    const first = assignPerch(roomAt({ a: 820, b: 840 }), BRANCH, () => 0);
    const second = assignPerch(first, BRANCH, () => 0);
    const perching = Object.values(second).filter(ag => ag.perchId === 'tree:branch');
    expect(perching).toHaveLength(1);
  });

  it('does nothing at all when there is no tree', () => {
    const before = roomAt({ a: 100 });
    expect(assignPerch(before, [], () => 0)).toBe(before);
  });

  it('never sends a bobit the director is choreographing', () => {
    const room = roomAt({ a: 840 });
    room.a = { ...room.a, activity: 'rank' };
    const out = assignPerch(room, BRANCH, () => 0);
    expect(out.a.perchId).toBeUndefined();
  });

  it('dwells long enough to be worth watching', () => {
    expect(PERCH_DWELL_SEC).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: FAIL — `assignPerch is not a function`.

- [ ] **Step 3: Widen `Activity` and `Agent`**

In `frontend/src/features/collection/crowdAgents.ts`:

```typescript
/**
 * `wander` roams the stage. `rank` stands at a home slot. `moving` is walking between the two
 * -- the state that makes "no bobit ever teleports" true rather than merely intended. `perch`
 * is sitting on a Surface, off the floor entirely.
 */
export type Activity = 'wander' | 'rank' | 'moving' | 'perch';
```

and add to `Agent`:

```typescript
  /** The Surface this agent is sitting on, or walking to. Absent for everyone on the floor. */
  perchId?: string;
  /** Seconds spent perched, so he eventually climbs down again. */
  perchT?: number;
```

- [ ] **Step 4: Write `assignPerch` and teach `agentsAdvance` about perching**

Add to `crowdAgents.ts`:

```typescript
/** Seconds a bobit stays up the tree before climbing down. */
export const PERCH_DWELL_SEC = 26;

/**
 * Send one idle bobit up to an empty branch.
 *
 * Perching is a DESTINATION, not a stunt (spec): somebody who has nothing else to do walks to
 * the trunk and climbs it, and the room is quieter by one. Perched bobits also leave the
 * floor's separation budget, so the tree buys back a little stage room.
 *
 * Capacity is one per Surface. With a single branch that means one bobit up the tree at a time,
 * which is what keeps it an event rather than a queue.
 */
export function assignPerch(
  state: AgentState, surfaces: readonly { id: string; left: number; right: number; y: number }[],
  rand: Rand,
): AgentState {
  if (surfaces.length === 0) return state;

  const taken = new Set<string>();
  for (const id of Object.keys(state)) {
    const p = state[id].perchId;
    if (p) taken.add(p);
  }

  const free = surfaces.find(s => !taken.has(s.id));
  if (!free) return state;

  // Only somebody genuinely idle. A ranked bobit is standing at his home slot on purpose, and
  // one the director has cast is mid-scene.
  const candidates = Object.keys(state)
    .filter(id => state[id].activity === 'wander' && !state[id].perchId)
    .sort();
  if (candidates.length === 0) return state;

  const mid = (free.left + free.right) / 2;
  let best = candidates[0];
  let bestD = Math.abs(state[best].x - mid);
  for (const id of candidates) {
    const d = Math.abs(state[id].x - mid);
    if (d < bestD) { best = id; bestD = d; }
  }
  // `rand` is accepted so a future version can make this occasional rather than immediate
  // without changing every caller; it is deliberately unused for now.
  void rand;

  return {
    ...state,
    [best]: { ...state[best], perchId: free.id, perchT: 0, activity: 'perch' },
  };
}
```

In `agentsAdvance`, handle the new activity. Add this branch immediately after the `rank` branch:

```typescript
    if (a.activity === 'perch') {
      const perchT = (a.perchT ?? 0) + dt;
      if (perchT >= PERCH_DWELL_SEC) {
        // Down he comes, back onto the floor and back into the wander pool.
        out[id] = { ...a, activity: 'wander', perchId: undefined, perchT: undefined };
      } else {
        out[id] = { ...a, perchT };
      }
      continue;
    }
```

And in `agentAnim`, above the existing cases:

```typescript
  if (a.activity === 'perch') return 'sit';
```

- [ ] **Step 5: Run the agent tests and watch them pass**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing rendering test**

Append to `frontend/src/features/collection/__tests__/crowdFigures.test.ts`:

```typescript
describe('a perched bobit', () => {
  const BRANCH = [{ id: 'tree:branch', left: 800, right: 880, y: 40 }];

  const perchedRoom = () => {
    const state = crowdApply(crowdInit(), { type: 'seed', ids: ['a'] });
    const agents = initAgents(['a'], OPTS);
    agents.a = { ...agents.a, x: 840, activity: 'perch', perchId: 'tree:branch', perchT: 1 };
    return { state, agents };
  };

  it('sits on the branch, not on the floor', () => {
    const { state, agents } = perchedRoom();
    const [fig] = crowdFigures(state, agents, BAND, false, undefined, true, BRANCH);
    expect(fig.groundY).toBe(40);
  });

  /**
   * fieldGeometry documents this trap and it has bitten before: figureBounds and the ink probe
   * measure from the BASE anim while paint positions with the RESOLVED one, so a seated figure
   * given a standing hoverAnim is drawn ~104 units away from its own hit box.
   */
  it('greets without leaving its hit box', () => {
    const { state, agents } = perchedRoom();
    const [fig] = crowdFigures(state, agents, BAND, false, undefined, true, BRANCH);
    expect(fig.hoverAnim).toBe('greetseat');
  });

  it('is still on the floor when there is no tree', () => {
    const { state, agents } = perchedRoom();
    const [fig] = crowdFigures(state, agents, BAND, false, undefined, true, []);
    expect(fig.groundY).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 7: Run it and watch it fail**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdFigures.test.ts`
Expected: FAIL — `crowdFigures` takes six arguments, and `groundY` is the floor.

- [ ] **Step 8: Render perched figures on their Surface**

In `frontend/src/features/collection/crowdFigures.ts`, add a seventh parameter to `crowdFigures`:

```typescript
  allowAir = true,
  /**
   * Surfaces a bobit may be sitting on. Empty when the room has no tree. A perched agent whose
   * Surface is not in this list falls back to the floor rather than to nothing -- scenery can
   * disappear (a narrower viewport, a different collection) and a bobit must not go with it.
   */
  surfaces: readonly { id: string; left: number; right: number; y: number }[] = [],
): FieldFigure[] {
```

Inside the per-agent loop, before `out.push`, resolve the perch:

```typescript
    const perch = a.perchId ? surfaces.find(s => s.id === a.perchId) : undefined;
```

then use it for position and seatedness in the pushed figure:

```typescript
      x: perch ? (perch.left + perch.right) / 2 : a.x,
      groundY: perch ? perch.y : groundY,
      // A seated figure MUST carry a seated hoverAnim -- see fieldGeometry's note on the
      // ~104-unit pelvis difference between standing and seated.
      ...(perch ? { hoverAnim: 'greetseat' } : {}),
```

- [ ] **Step 9: Run the tests and watch them pass**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: all tests pass, tsc clean.

- [ ] **Step 10: Wire it up in `CollectionCrowd`**

Compute the room's surfaces once per frame in `figuresFor`, and pass them on:

```typescript
      // The tree's branch, or nothing at all. Recomputed each frame because the band's measured
      // width changes with the viewport and the trunk moves with it.
      const w = laidOutAtRef.current || band.width;
      surfacesRef.current = earnedRef.current && !isMobile
        ? treeSurfaces(treeX(w, band.scale), sceneGroundY(band), band.scale)
        : [];

      if (surfacesRef.current.length > 0) {
        agentsRef.current = assignPerch(agentsRef.current, surfacesRef.current, randRef.current);
      }
```

Declare `surfacesRef` with the other refs:

```typescript
  const surfacesRef = useRef<{ id: string; left: number; right: number; y: number }[]>([]);
```

And pass it to `crowdFigures` at the bottom of `figuresFor`:

```typescript
    return crowdFigures(
      stateRef.current, agentsRef.current, band, darkMode, directorRef.current,
      allowAirRef.current, surfacesRef.current,
    );
```

Add `assignPerch` to the `crowdAgents` import and `treeSurfaces` is already imported from Task 5.

- [ ] **Step 11: LOOK AT IT**

Run `npm run dev`, then open:

```
http://localhost:5173/?mock=1&collection=milwaukee-wi&owned=40
```

Watch for up to a minute. A bobit should walk to the tree, and sit on the branch. Check:
1. He is sitting **on** the branch, not floating above it or sunk into it.
2. His head does not leave the top of the band.
3. Hovering him plays a **seated** greet, not a standing one that jumps sideways.
4. After ~26s he climbs down and rejoins the floor.

If he sits wrong by a few pixels, the fix is `TREE_LEDGE_UP` in `props.ts` or the seat offset in the `sit` pose — not a magic number in `crowdFigures`.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/features/collection/crowdAgents.ts \
        frontend/src/features/collection/__tests__/crowdAgents.test.ts \
        frontend/src/features/collection/crowdFigures.ts \
        frontend/src/features/collection/__tests__/crowdFigures.test.ts \
        frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat(bobits): perching, and Surface finally has a consumer

Surface has sat unused in fieldGeometry since Stage 1 waiting for exactly this.
A bobit with nothing to do walks to the tree and sits on its branch; capacity
is one, which keeps it an event rather than a queue.

Perched figures carry hoverAnim greetseat. fieldGeometry documents why and it
has bitten before: bounds and the ink probe measure from the BASE anim while
paint positions with the RESOLVED one, so a seated figure with a standing
hoverAnim draws ~104 units from its own hit box.

A perched agent whose Surface has gone falls back to the floor. Scenery can
disappear -- a narrower viewport, a different collection -- and a bobit must
not go with it."
```

---

### Task 7: the milestone set piece

The tree's arrival is choreographed for the bobits, not for the tree: the tree grows on its own clock (Task 5), and this scene is the room noticing.

**Files:**
- Create: `frontend/src/features/collection/scenes/milestone25Tree.ts`
- Modify: `frontend/src/features/collection/scenes/index.ts`
- Modify: `frontend/src/features/collection/__tests__/scenes.test.ts`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

**Interfaces:**
- Consumes: `Scene`, `Beat` from `scenes/types.ts`; `earned` from Task 3.
- Produces: `TREE_MILESTONE: Scene` with `id: 'milestone-tree'`, exported from `scenes/index.ts` and added to `ALL_SCENES`.

- [ ] **Step 1: Write the scene**

Create `frontend/src/features/collection/scenes/milestone25Tree.ts`:

```typescript
import { SMOKE_PURPLE } from '../../../components/bobbits/rigExtras';
import type { Scene } from './types';

/**
 * 25% of a collection: the tree arrives.
 *
 * The TREE is not in this scene. It is room-owned and grows on its own clock the moment the
 * milestone latches (see treePlacement.TREE_GROW_SEC), because a permanent structure has no
 * business living inside a transient Scene -- the scene would end and take it with it, the way
 * a cannon leaves with its shot.
 *
 * What is choreographed here is the ROOM NOTICING: two bobits drift over, look up, and present
 * at it. The climbing is not scripted either; `assignPerch` sends somebody up on its own once
 * the branch exists, and scripting it as well would put two bobits on a one-bobit branch.
 *
 * Reserves the right quarter, which is where the trunk is.
 */
export const TREE_MILESTONE: Scene = {
  id: 'milestone-tree',
  duration: 7.0,
  span: 0.25,
  /**
   * NEITHER role is called `newcomer`, deliberately. `startScene` hardcodes
   * `cast.newcomer = newcomerId` and applies `castOverrides` only to the OTHER roles, so a role
   * by that name can never be filled from the room -- it would be a synthetic id rendered as an
   * orphan. This scene has no arrival in it: both parts are played by bobits who already live
   * here, so both must be castable.
   */
  roles: ['admirer', 'witness'],
  beats: [
    // A puff at the foot of the trunk as the sapling breaks ground.
    { at: 0.0, role: 'admirer', moveTo: 0.72, pose: 'stroll', path: 'walk',
      smoke: { spread: 34, color: SMOKE_PURPLE } },
    { at: 0.0, role: 'witness', moveTo: 0.34, pose: 'stroll', path: 'walk' },

    // Both look up at it while it grows.
    { at: 2.0, role: 'admirer', pose: 'ponder' },
    { at: 2.2, role: 'witness', pose: 'ponder' },

    // And present it, a beat apart so it does not read as a drill.
    { at: 3.4, role: 'admirer', pose: 'present' },
    { at: 3.8, role: 'witness', pose: 'present' },

    // Then back to their business, walking, so nobody teleports out of the scene.
    { at: 5.4, role: 'admirer', pose: 'friendly', moveTo: 0.86, path: 'walk' },
    { at: 5.6, role: 'witness', pose: 'friendly', moveTo: 0.12, path: 'walk' },
  ],
};
```

- [ ] **Step 2: Register it**

In `frontend/src/features/collection/scenes/index.ts`:

```typescript
import { TREE_MILESTONE } from './milestone25Tree';
```

```typescript
export { SWIRL, CANNON, POOL, TREE_MILESTONE };
```

```typescript
/** Every scene there is, for the dev replay route and for validation. */
export const ALL_SCENES: Scene[] = [SWIRL, CANNON, ...POOL, TREE_MILESTONE];
```

**Do not add it to `sceneForArrival`.** It is not an arrival; it fires on a milestone.

- [ ] **Step 3: Write the failing test**

Append to `frontend/src/features/collection/__tests__/scenes.test.ts`:

```typescript
describe('the tree milestone scene', () => {
  it('is registered, but is not an arrival', () => {
    expect(ALL_SCENES.map(s => s.id)).toContain('milestone-tree');
    // sceneForArrival must never return it: arrivals are ordinal-driven, this is not.
    for (let ordinal = 0; ordinal < 40; ordinal++) {
      expect(sceneForArrival(ordinal, () => 0.5).id).not.toBe('milestone-tree');
    }
  });

  it('never reaches for the sky -- it is not a set piece with an overlay', () => {
    const scene = ALL_SCENES.find(s => s.id === 'milestone-tree')!;
    expect(scene.beats.every(b => b.layer !== 'air')).toBe(true);
  });

  it('reserves the right quarter, where the trunk is', () => {
    const scene = ALL_SCENES.find(s => s.id === 'milestone-tree')!;
    expect(scene.span).toBeLessThanOrEqual(0.25);
  });
});
```

The suite's existing "every scene ends on the floor" property test covers this scene automatically — that is the point of having written it as a property.

- [ ] **Step 4: Run it**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/scenes.test.ts`
Expected: PASS (the scene already exists from Step 1). Every pose this scene names — `stroll`,
`ponder`, `present`, `friendly` — is registered today; the suite's existing property test plays
every scene frame by frame, so a typo in a pose key fails there rather than on screen.

- [ ] **Step 5: Generalise the caster, so both roles are real bobits**

`hostFor` (added in the review-fix pass) fills only `ROLE_HOST`. This scene has two roles and
neither is an arrival, so every role must be cast from the room. In `CollectionCrowd.tsx`,
replace `hostFor` with a general version:

```typescript
/**
 * Fill a scene's roles from bobits who already live here.
 *
 * `startScene` invents a synthetic id for any role an override does not cover, and a synthetic
 * id renders as an orphan -- a bobit who appears from nowhere, performs, and evaporates. That
 * was the cannon's phantom host. A scene whose roles are ALL existing residents, like the
 * milestone, would otherwise produce one phantom per role.
 *
 * `newcomer` is never cast here: `startScene` owns that name and fills it with the arriving
 * bobit's own id. A scene with no arrival must not use it as a role name.
 */
function castFromRoom(
  director: DirectorState, agents: AgentState, scene: Scene, width: number, newcomerId: string,
): Record<string, string> {
  const slot = canStage(director, scene.span, width);
  if (!slot) return {};
  const mid = (slot.left + slot.right) / 2;
  const taken = new Set([...castIds(director), newcomerId]);
  const out: Record<string, string> = {};
  for (const role of scene.roles) {
    if (role === ROLE_NEWCOMER) continue;
    const id = nearestAgent(agents, mid, taken);
    if (!id) break;                 // nobody left; startScene falls back to a synthetic id
    out[role] = id;
    taken.add(id);                  // two roles must never be the same bobit
  }
  return out;
}
```

Import `ROLE_NEWCOMER` alongside `ROLE_HOST` from `./scenes/types`, replace both existing
`hostFor(...)` call sites with `castFromRoom(...)`, and delete `hostFor`.

Add the test that makes this safe, to `frontend/src/features/collection/__tests__/crowdAgents.test.ts`:

```typescript
it('never returns an id already excluded, so two roles cannot share a bobit', () => {
  const state = initAgents(['a', 'b'], OPTS());
  const first = nearestAgent(state, 500)!;
  const second = nearestAgent(state, 500, new Set([first]));
  expect(second).not.toBe(first);
  expect(second).not.toBeNull();
});
```

- [ ] **Step 6: Fire it once, when the milestone latches**

In `CollectionCrowd.tsx`, add a ref so it fires exactly once per mount:

```typescript
  /** The milestone scene is a one-off; a re-render must not restage it. */
  const milestoneFiredRef = useRef(false);
```

In `syncMilestone` (Task 3), after `setEarned(...)`, add:

```typescript
    // Fire the set piece only on the TRANSITION, and only when the room can stage it. A player
    // who arrives already past 25% gets the tree without the ceremony, which is correct: the
    // ceremony is for the moment it is earned.
    const nowEarned = treeEarned(peakStore.peak(slugNow), questionCount ?? null);
    if (nowEarned && !earnedRef.current && !milestoneFiredRef.current && !reducedMotion) {
      milestoneFiredRef.current = true;
      const w = laidOutAtRef.current || band.width;
      const scene = TREE_MILESTONE;
      if (canStage(directorRef.current, scene.span, w)) {
        directorRef.current = startScene(
          directorRef.current, scene, `milestone-${Date.now()}`, w, randRef.current,
          castFromRoom(directorRef.current, agentsRef.current, scene, w, ''),
        );
      }
    }
```

Reset `milestoneFiredRef.current = false` in the slug-change branch of the seeding effect, beside `setAerial(NO_AERIAL)`.

Import `TREE_MILESTONE` from `./scenes`.

- [ ] **Step 7: Typecheck and run the suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: tsc clean, all tests pass.

- [ ] **Step 8: LOOK AT IT**

```bash
cd frontend && node scripts/bobit-scenes.mjs milestone-tree
```

Open `.shots/scene-milestone-tree-light.png` and `-dark.png`. Check both bobits walk in, look up, present, and walk off, and that nobody is left standing in a pose at the end.

Then watch it fire for real. The mock's collection is 120 questions, so 25% is 30:

```
http://localhost:5173/?mock=1&collection=milwaukee-wi&owned=29
```

Answer A correctly to reach 30 and watch the tree sprout and the room notice.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/collection/scenes/milestone25Tree.ts \
        frontend/src/features/collection/scenes/index.ts \
        frontend/src/features/collection/__tests__/scenes.test.ts \
        frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat(bobits): the room notices its tree arrive

The tree is NOT in this scene. It is room-owned and grows on its own clock,
because a permanent structure inside a transient Scene leaves when the scene
does -- the way a cannon leaves with its shot. What is choreographed is the
room noticing: two bobits drift over, look up and present at it.

The climbing is not scripted either. assignPerch sends somebody up once the
branch exists, and scripting it too would put two bobits on a one-bobit branch.

Fires on the TRANSITION only. A player already past 25% gets the tree without
the ceremony, which is right: the ceremony is for the moment it is earned."
```

---

### Task 8: the mobile milestone, and the reduced-motion room

Mobile has no tree — there is no horizontal room for one beside a crowd — but it must still get the milestone, or a phone player has nothing but pool entrances for the rest of a collection.

**Files:**
- Create: `frontend/src/features/collection/scenes/milestone25Mobile.ts`
- Modify: `frontend/src/features/collection/scenes/index.ts`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`
- Modify: `frontend/src/features/collection/__tests__/scenes.test.ts`

**Interfaces:**
- Consumes: everything from Task 7.
- Produces: `TREE_MILESTONE_MOBILE: Scene` with `id: 'milestone-mobile'`.

- [ ] **Step 1: Write the mobile scene**

Create `frontend/src/features/collection/scenes/milestone25Mobile.ts`:

```typescript
import type { Scene } from './types';

/**
 * 25% on a phone: the crowd notices, and there is no tree.
 *
 * A phone band has no horizontal room for a trunk beside a crowd, so the tree is cut (spec,
 * "Mobile -- the reduced room"). But cutting the milestone WITH it would leave a phone player
 * with nothing but pool entrances for the rest of a collection, and the tree is the only
 * milestone set piece in this spec. Same beat in the progression, different staging: the room
 * gathers loosely and runs the celebration it already knows.
 *
 * Narrow span, because a phone band is narrow and two scenes must never share ground.
 */
export const TREE_MILESTONE_MOBILE: Scene = {
  id: 'milestone-mobile',
  duration: 4.4,
  span: 0.44,
  /** Both parts are existing residents, so neither role may be called `newcomer` -- see the
   *  same note on TREE_MILESTONE. */
  roles: ['admirer', 'witness'],
  beats: [
    { at: 0.0, role: 'admirer', moveTo: 0.5, pose: 'stroll', path: 'walk' },
    { at: 0.0, role: 'witness', moveTo: 0.38, pose: 'stroll', path: 'walk' },

    { at: 1.3, role: 'admirer', pose: 'cheer' },
    { at: 1.5, role: 'witness', pose: 'cheer' },

    { at: 2.4, role: 'admirer', pose: 'highfive', hand: 'R' },
    { at: 2.4, role: 'witness', pose: 'highfive', hand: 'L' },

    { at: 3.4, role: 'admirer', pose: 'friendly', moveTo: 0.72, path: 'walk' },
    { at: 3.5, role: 'witness', pose: 'friendly', moveTo: 0.16, path: 'walk' },
  ],
};
```

- [ ] **Step 2: Register it and test it**

In `scenes/index.ts`, import it, export it, and add it to `ALL_SCENES`. Do **not** add it to `sceneForArrival`.

Append to `scenes.test.ts`:

```typescript
describe('the mobile milestone scene', () => {
  it('is registered and is not an arrival', () => {
    expect(ALL_SCENES.map(s => s.id)).toContain('milestone-mobile');
    for (let ordinal = 0; ordinal < 40; ordinal++) {
      expect(sceneForArrival(ordinal, () => 0.5).id).not.toBe('milestone-mobile');
    }
  });

  it('fits a phone band', () => {
    const scene = ALL_SCENES.find(s => s.id === 'milestone-mobile')!;
    expect(scene.span).toBeLessThanOrEqual(0.5);
  });

  it('pairs its high-five hands, or the slap misses', () => {
    const scene = ALL_SCENES.find(s => s.id === 'milestone-mobile')!;
    const hands = scene.beats.filter(b => b.pose === 'highfive').map(b => b.hand);
    expect(new Set(hands)).toEqual(new Set(['R', 'L']));
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/scenes.test.ts`
Expected: PASS.

- [ ] **Step 4: Choose the scene by platform**

In `CollectionCrowd.tsx`, in the milestone-firing block from Task 7, replace the scene constant:

```typescript
      // A phone gets the crowd's version: no tree to gather around, so the room celebrates.
      const scene = isMobile ? TREE_MILESTONE_MOBILE : TREE_MILESTONE;
```

and use `scene` in the `canStage` check and the `startScene` call.

- [ ] **Step 5: Verify reduced motion is still a still room**

The milestone block is already gated on `!reducedMotion` (Task 7, Step 5), and the tree is emitted from `propsFor`, which does not depend on the frame loop — so a reduced-motion player gets the tree standing, fully grown, with no ceremony. Confirm `growRef` starts at `TREE_GROW_SEC` when `reducedMotion` is true, by initialising it that way:

```typescript
  const growRef = useRef(reducedMotion ? TREE_GROW_SEC : 0);
```

- [ ] **Step 6: Typecheck, run the suite, and LOOK AT IT**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: tsc clean, all tests pass.

Then check all three rooms:

```bash
cd frontend && node scripts/bobit-shots.mjs
```

Open `.shots/desktop-light-page.png` (tree present on the right), `.shots/mobile-light-page.png` (**no tree**, and the band not crowded by one), and confirm the `+N more` label is bottom-left in both.

For reduced motion, run a browser with `prefers-reduced-motion: reduce` and confirm the tree is standing and fully grown at first paint, with no sprouting animation.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/collection/scenes/milestone25Mobile.ts \
        frontend/src/features/collection/scenes/index.ts \
        frontend/src/features/collection/__tests__/scenes.test.ts \
        frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat(bobits): the phone gets the milestone without the tree

A phone band has no horizontal room for a trunk beside a crowd, so the tree is
cut. Cutting the milestone with it would leave a phone player with nothing but
pool entrances for the rest of a collection -- the tree is the only milestone
set piece there is. Same beat in the progression, different staging.

Reduced motion gets the tree standing and fully grown at first paint, with no
ceremony: growRef starts at full height rather than animating."
```

---

### Task 9: close the loop

**Files:**
- Modify: `docs/superpowers/HANDOFF-bobits.md`

- [ ] **Step 1: Run everything one more time**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
node scripts/bobit-props.mjs
node scripts/bobit-scenes.mjs
node scripts/bobit-shots.mjs
```

Open every PNG in `.shots/`. This is the last gate before the branch is any bigger.

- [ ] **Step 2: Update the handoff**

In `docs/superpowers/HANDOFF-bobits.md`:
- Update the commit count and the test count.
- Move plan 3 from "unwritten" to done in the **Read these first** list.
- Remove plan 3 from open items.
- Record under **What changed from the spec while building**: the tree has one branch rather than 2-3, and "a bobit can walk behind the tree" was dropped because props draw behind figures and depth is gone.
- Add to the gotchas: *`Surface` positions a figure's SEAT, and a seated figure needs a seated `hoverAnim`; the two are 104 rig units apart and nothing will tell you.*
- Leave `pool-peek` and `pool-drop` as open. This plan did not fix them.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/HANDOFF-bobits.md
git commit -m "docs(bobits): plan 3 is done — the tree, perching, the milestone

Records the two places the build diverged from the spec: one branch rather than
2-3, because 96px does not hold a second one, and no walking behind the trunk,
because props draw behind figures and depth is gone.

pool-peek and pool-drop stay open. This plan did not give them the vertical
room they need."
```

---

## What this plan does NOT do

- **`pool-peek` and `pool-drop` are still broken.** Both were choreographed against vertical room the 96px band does not have. The tree does not create any — it is sized to fit the same band. Fixing them needs either different choreography or a taller band, and that is a design decision, not an implementation one.
- **50%, 75% and 100% milestones.** Out of scope per the spec. The seam is `milestone.ts` plus a scene file; the tree is the worked example that proves it.
- **Server-side storage of the high-water mark.** `backend/` here is frozen and ev-accounts is another repo. A signed-in player who switches browsers re-earns the tree.
- **The remaining review Minors** — the aerial gate read from two copies, scene-instance ids, duplicated `SMOKE_DUR`/`SMOKE_LIFE`, the ripple starting at `slotOrder[0]`, and `cannonMuzzle` still being unused.

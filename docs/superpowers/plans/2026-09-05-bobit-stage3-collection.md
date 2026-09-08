# Bobit Stage 3 — Collection Mechanic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind a bobit to every question a player has answered correctly, persist that across matches, and stage the crowd on the game screen — arrivals that escalate with the in-match streak, and a loss sequence when a previously-earned question is missed.

**Architecture:** Three pure modules (a storage driver, a deterministic identity function, a crowd state machine) plus one React component that owns crowd state in refs and feeds `BobitField` through a per-frame callback. React never re-renders per frame; the choreography advances inside the field's existing rAF loop.

**Tech Stack:** TypeScript, React 19, Canvas 2D, Vitest, zustand (existing `confettiStore`).

**Spec:** `docs/superpowers/specs/2026-09-04-bobit-collection-design.md`
**Measurements:** `docs/superpowers/specs/2026-09-04-bobit-stage2-perf-findings.md`

## Global Constraints

- **Bobits must NEVER cover the question card or any of the four answer options.** Direct user instruction. The crowd lives in normal document flow beneath the answer grid, never as an overlay above it. The answer grid may shrink slightly to make room; it may not be occluded.
- **Crowd cap is 100 figures.** Measured in Stage 2: 105 is the 60fps ceiling on a mid-tier phone, and CPU throttling flatters mobile, so 100 is the working cap. Above it, render 100 and show the remainder as a count.
- **`poofable: false` on every collection bobit.** A poof on the game screen always means "you got this wrong" and must never be something the player can trigger.
- **`backend/` is FROZEN** (ev-cto decision 0013, `backend/FROZEN.md`). No API route, table, or migration may be added in this repo. Stage 3 is entirely frontend; the server driver is a later change in `ev-accounts/backend/src/trivia/`.
- **`useReducedMotion` must be honoured.** Crowd renders static; arrivals and departures are instant; no smoke, no confetti.
- **Gameplay never blocks on the crowd.** Any storage failure degrades to an empty field and in-memory-only grants for that match.
- **Confetti fires only at a 5/5 finish**, via `useConfettiStore().fireFireworks()`. The four lower tiers are bobits alone.
- **Storage key is the collection SLUG, not a numeric id.** The spec said `collectionId`; the frontend's `GameState` carries `collectionSlug` and never carries the numeric id. Slug is `notNull().unique()` in the schema, so it is equally stable and equally not-derived-from-the-external-id-prefix, which was the spec's actual concern.

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/features/collection/bobitProgress.ts` | `BobitProgressStore` interface + localStorage driver. Injectable `Storage` so it is testable without a DOM. |
| `frontend/src/features/collection/crowdIdentity.ts` | Deterministic `externalId` → colour tone + stable slot ordering. Pure. |
| `frontend/src/features/collection/crowdReducer.ts` | Crowd state machine: residents, arrivals, celebration tier, loss sequence. Pure. |
| `frontend/src/features/collection/crowdLayout.ts` | Slot index → x/groundY/scale within a band of given width and height. Pure. |
| `frontend/src/features/collection/CollectionCrowd.tsx` | The React component. Owns state in refs, pushes events, renders `BobitField`. |
| `frontend/src/components/bobbits/BobitField.tsx` | Modify: add the `figuresFor` per-frame callback. |
| `frontend/src/features/game/components/GameScreen.tsx` | Modify: mount the crowd band beneath the answer grid. |

---

## Task 1: The progress store

**Files:**
- Create: `frontend/src/features/collection/bobitProgress.ts`
- Create: `frontend/src/features/collection/__tests__/bobitProgress.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BobitProgressStore` — `{ load(slug: string): Set<string>; grant(slug: string, questionId: string): void; revoke(slug: string, questionId: string): void; summary(): Record<string, number> }`
  - `createLocalProgressStore(storage?: Storage): BobitProgressStore`
  - `STORAGE_KEY = 'ctc.bobits.v1'`

Synchronous, not Promise-based: localStorage is synchronous, and the choreography reads owned-state inside a frame callback where a Promise would be useless. When the server driver lands it will maintain an in-memory mirror and write through asynchronously, keeping this shape.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/__tests__/bobitProgress.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- bobitProgress`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/collection/bobitProgress.ts

/**
 * Which questions a player has a bobit for.
 *
 * Synchronous on purpose. localStorage is synchronous, and the crowd choreography reads
 * owned-state inside a per-frame callback where a Promise would be useless. When the server
 * driver lands (in ev-accounts -- this repo's backend/ is frozen) it keeps this shape and
 * writes through asynchronously behind an in-memory mirror.
 */
export interface BobitProgressStore {
  load(slug: string): Set<string>;
  grant(slug: string, questionId: string): void;
  revoke(slug: string, questionId: string): void;
  /** Owned count per collection slug, for a future per-collection tally. */
  summary(): Record<string, number>;
}

export const STORAGE_KEY = 'ctc.bobits.v1';

/** `{ [collectionSlug]: { [questionExternalId]: epochMs } }` */
type Shape = Record<string, Record<string, number>>;

/**
 * Keyed by collection SLUG rather than the numeric collection id: the frontend's GameState
 * carries `collectionSlug` and never carries the id. Slug is notNull().unique() in the schema,
 * so it is just as stable -- and, importantly, it is still not derived from the question's
 * external-id prefix, which is the thing that cannot be trusted (the convention is 5 letters
 * now, legacy collections kept 3, and Indiana has two).
 */
export function createLocalProgressStore(storage?: Storage): BobitProgressStore {
  const backing = storage ?? safeDefaultStorage();

  // The in-memory mirror is the source of truth for reads. It means a storage that throws --
  // private mode, a full quota -- costs persistence but never costs the player their match.
  let data: Shape = read(backing);

  function read(s: Storage | null): Shape {
    if (!s) return {};
    try {
      const raw = s.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Shape) : {};
    } catch {
      return {};   // corrupt or unreadable: start fresh rather than break the game
    }
  }

  function write() {
    if (!backing) return;
    try {
      backing.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota or private mode. The mirror already has the change; persistence is what is lost.
    }
  }

  return {
    load(slug) {
      return new Set(Object.keys(data[slug] ?? {}));
    },
    grant(slug, questionId) {
      if (!data[slug]) data[slug] = {};
      if (data[slug][questionId] === undefined) {
        data[slug][questionId] = Date.now();
        write();
      }
    },
    revoke(slug, questionId) {
      if (data[slug]?.[questionId] === undefined) return;
      delete data[slug][questionId];
      write();
    },
    summary() {
      const out: Record<string, number> = {};
      for (const slug of Object.keys(data)) {
        const n = Object.keys(data[slug]).length;
        if (n > 0) out[slug] = n;
      }
      return out;
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

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- bobitProgress`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/bobitProgress.ts frontend/src/features/collection/__tests__/bobitProgress.test.ts
git commit -m "feat: bobit progress store with a localStorage driver"
```

---

## Task 2: Deterministic identity

A bobit must be the same figure, in the same spot, every match — that is what makes the empty slot after a loss read as a specific missing person rather than a smaller crowd.

**Files:**
- Create: `frontend/src/features/collection/crowdIdentity.ts`
- Create: `frontend/src/features/collection/__tests__/crowdIdentity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hashId(questionId: string): number` — a stable non-negative 32-bit hash
  - `toneOf(questionId: string): number` — `0..5`, indexes `FIG_COLORS`
  - `slotOrder(questionIds: string[]): string[]` — deterministic ordering, independent of input order

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/__tests__/crowdIdentity.test.ts
import { describe, it, expect } from 'vitest';
import { hashId, toneOf, slotOrder } from '../crowdIdentity';

describe('hashId', () => {
  it('is stable for the same input', () => {
    expect(hashId('milwi-042')).toBe(hashId('milwi-042'));
  });

  it('differs for different inputs', () => {
    expect(hashId('milwi-042')).not.toBe(hashId('milwi-043'));
  });

  it('is always a non-negative integer', () => {
    for (const id of ['a', 'milwi-001', 'wisco-137', '', 'x'.repeat(200)]) {
      const h = hashId(id);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('toneOf', () => {
  it('is stable', () => {
    expect(toneOf('milwi-042')).toBe(toneOf('milwi-042'));
  });

  it('is always a valid palette index', () => {
    for (let i = 0; i < 300; i++) {
      const t = toneOf(`milwi-${i}`);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(6);
    }
  });

  it('spreads across the palette rather than collapsing to one tone', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(toneOf(`milwi-${i}`));
    expect(seen.size).toBe(6);
  });
});

describe('slotOrder', () => {
  it('does not depend on the order it was given', () => {
    const a = slotOrder(['milwi-003', 'milwi-001', 'milwi-002']);
    const b = slotOrder(['milwi-001', 'milwi-002', 'milwi-003']);
    expect(a).toEqual(b);
  });

  it('keeps every id', () => {
    const ids = ['milwi-001', 'milwi-002', 'milwi-003'];
    expect(slotOrder(ids).slice().sort()).toEqual(ids.slice().sort());
  });

  it('gives a figure the same slot as the crowd grows around it', () => {
    // The point of the whole mechanic: earning a new bobit must not shuffle everyone else.
    const before = slotOrder(['milwi-001', 'milwi-002', 'milwi-003']);
    const after = slotOrder(['milwi-001', 'milwi-002', 'milwi-003', 'milwi-004']);
    for (const id of before) {
      expect(after.indexOf(id)).toBe(before.indexOf(id));
    }
  });

  it('does not mutate its input', () => {
    const ids = ['milwi-003', 'milwi-001'];
    slotOrder(ids);
    expect(ids).toEqual(['milwi-003', 'milwi-001']);
  });

  it('handles an empty crowd', () => {
    expect(slotOrder([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- crowdIdentity`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/collection/crowdIdentity.ts

/**
 * Stable identity for a collection bobit.
 *
 * Both a figure's colour and its position derive from its question id, so the bobit for
 * `milwi-042` is the same figure in the same spot every match. That is what makes a loss
 * legible: the gap is where a particular person used to stand, not just one fewer body.
 */

/** FNV-1a, 32-bit. Small, dependency-free, and well spread over short ASCII ids. */
export function hashId(questionId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < questionId.length; i++) {
    h ^= questionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Palette index, 0-5, matching FIG_COLORS in rigExtras. */
export function toneOf(questionId: string): number {
  return hashId(questionId) % 6;
}

/**
 * Deterministic slot ordering.
 *
 * Sorted by the id itself, NOT by hash and NOT by grant time. Sorting by hash would be just as
 * stable, but sorting by id keeps a collection's figures grouped in their natural numbering,
 * which reads as a room filling up rather than scattering. Grant time would be wrong outright:
 * it would reshuffle everyone whenever one bobit was lost and re-earned.
 */
export function slotOrder(questionIds: string[]): string[] {
  return [...questionIds].sort();
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- crowdIdentity`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdIdentity.ts frontend/src/features/collection/__tests__/crowdIdentity.test.ts
git commit -m "feat: deterministic bobit identity from question id"
```

---

## Task 3: Crowd layout

**Files:**
- Create: `frontend/src/features/collection/crowdLayout.ts`
- Create: `frontend/src/features/collection/__tests__/crowdLayout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CROWD_CAP = 100`
  - `CrowdBand` — `{ width: number; height: number; scale: number }`
  - `slotPosition(index: number, total: number, band: CrowdBand): { x: number; groundY: number; row: number }`
  - `rowsFor(total: number): number`

Figures are laid out in up to three rows, back row highest on screen. Row assignment is by slot index so a figure never changes row as the crowd grows past a row boundary — it fills row 0 left to right, then row 1, then row 2, and widens spacing rather than reflowing.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/__tests__/crowdLayout.test.ts
import { describe, it, expect } from 'vitest';
import { slotPosition, rowsFor, CROWD_CAP } from '../crowdLayout';

const band = { width: 1000, height: 90, scale: 0.22 };

describe('rowsFor', () => {
  it('uses one row for a small crowd', () => {
    expect(rowsFor(8)).toBe(1);
  });

  it('adds rows as the crowd grows', () => {
    expect(rowsFor(60)).toBeGreaterThan(1);
    expect(rowsFor(100)).toBeGreaterThan(rowsFor(20));
  });

  it('never exceeds three rows', () => {
    expect(rowsFor(CROWD_CAP)).toBeLessThanOrEqual(3);
    expect(rowsFor(1000)).toBeLessThanOrEqual(3);
  });
});

describe('slotPosition', () => {
  it('keeps every figure inside the band horizontally', () => {
    for (let i = 0; i < 100; i++) {
      const p = slotPosition(i, 100, band);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(band.width);
    }
  });

  it('keeps every figure inside the band vertically', () => {
    for (let i = 0; i < 100; i++) {
      const p = slotPosition(i, 100, band);
      expect(p.groundY).toBeGreaterThan(0);
      expect(p.groundY).toBeLessThanOrEqual(band.height);
    }
  });

  it('puts back rows higher on screen than front rows', () => {
    const front = slotPosition(0, 100, band);
    const back = slotPosition(99, 100, band);
    expect(back.row).not.toBe(front.row);
    const rowYs = new Map<number, number>();
    for (let i = 0; i < 100; i++) {
      const p = slotPosition(i, 100, band);
      rowYs.set(p.row, p.groundY);
    }
    const sorted = [...rowYs.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i][1]).toBeLessThan(sorted[i - 1][1]);
    }
  });

  it('does not move a figure to another row when the crowd grows', () => {
    // Slot 5 must stay put whether the room holds 20 or 90.
    expect(slotPosition(5, 20, band).row).toBe(slotPosition(5, 90, band).row);
  });

  it('is deterministic', () => {
    expect(slotPosition(7, 50, band)).toEqual(slotPosition(7, 50, band));
  });

  it('spreads figures out rather than stacking them', () => {
    const a = slotPosition(0, 10, band);
    const b = slotPosition(1, 10, band);
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- crowdLayout`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/collection/crowdLayout.ts

/**
 * Maximum figures rendered at once.
 *
 * Stage 2 measured 105 as the 60fps ceiling on a mid-tier phone, and CPU throttling flatters
 * mobile (it slows JavaScript but leaves the GPU alone), so the working cap is 100. It also
 * contains the median collection whole -- 91 of 41 collections' worth of questions -- so most
 * rooms render complete. Anything above the cap is shown as a count instead.
 */
export const CROWD_CAP = 100;

export interface CrowdBand {
  width: number;
  height: number;
  scale: number;
}

/** How many rows a crowd of this size uses. Capped at three: more looks like a wall. */
export function rowsFor(total: number): number {
  if (total <= 24) return 1;
  if (total <= 60) return 2;
  return 3;
}

/** Figures per row, at the widest the crowd will get. Fixed so a slot never changes row. */
const ROW_CAPACITY = [34, 33, 33];

export function slotPosition(index: number, total: number, band: CrowdBand) {
  const rows = rowsFor(total);

  // Row assignment is by index against FIXED capacities, not against the current population,
  // so slot 5 is in row 0 whether the room holds 20 or 90. Reflowing on growth would move
  // everyone every time a bobit arrived, which is exactly what the identity rules forbid.
  let row = 0;
  let within = index;
  for (let r = 0; r < rows; r++) {
    if (within < ROW_CAPACITY[r]) { row = r; break; }
    within -= ROW_CAPACITY[r];
    row = r + 1;
  }
  if (row >= rows) { row = rows - 1; within = index; }

  const perRow = ROW_CAPACITY[Math.min(row, ROW_CAPACITY.length - 1)];
  // Half-step inset so the first and last figures are not flush against the band edges.
  const x = ((within + 0.5) / perRow) * band.width;

  // Back rows sit higher. The band's bottom is the front row's ground line.
  const rowGap = band.height / (rows + 1.6);
  const groundY = band.height - row * rowGap;

  return { x, groundY, row };
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- crowdLayout`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdLayout.ts frontend/src/features/collection/__tests__/crowdLayout.test.ts
git commit -m "feat: crowd band layout with fixed row capacities"
```

---

## Task 4: The crowd state machine

The choreography, as a pure reducer — the same shape `gameReducer.ts` already establishes. No canvas, no timers, no React.

**Files:**
- Create: `frontend/src/features/collection/crowdReducer.ts`
- Create: `frontend/src/features/collection/__tests__/crowdReducer.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CrowdState` — `{ residents: string[]; arriving: Record<string, number>; celebrating: number; celebrateT: number; loss: { id: string; phase: LossPhase; t: number } | null }`
  - `LossPhase` — `'rising' | 'burst' | 'stunned' | 'recovering'`
  - `CrowdEvent` — `{ type: 'seed'; ids: string[] } | { type: 'correct'; id: string; streak: number } | { type: 'wrong'; id: string } | { type: 'reset' }`
  - `crowdInit(): CrowdState`
  - `crowdApply(state: CrowdState, event: CrowdEvent): CrowdState`
  - `crowdStep(state: CrowdState, dt: number): CrowdState`
  - `ARRIVAL_DUR = 1.1`, `CELEBRATE_DUR = 2.2`
  - `LOSS_RISE = 0.9`, `LOSS_BURST = 0.6`, `LOSS_STUN = 0.8`, `LOSS_RECOVER = 1.7`
  - `isStunned(state: CrowdState): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/__tests__/crowdReducer.test.ts
import { describe, it, expect } from 'vitest';
import {
  crowdInit, crowdApply, crowdStep, isStunned,
  ARRIVAL_DUR, CELEBRATE_DUR, LOSS_RISE, LOSS_BURST, LOSS_STUN, LOSS_RECOVER,
} from '../crowdReducer';

const seeded = (ids: string[]) => crowdApply(crowdInit(), { type: 'seed', ids });

describe('seeding', () => {
  it('starts empty', () => {
    expect(crowdInit().residents).toEqual([]);
  });

  it('takes the owned set as residents, already settled', () => {
    const s = seeded(['a', 'b']);
    expect(s.residents).toEqual(['a', 'b']);
    expect(Object.keys(s.arriving)).toEqual([]);
  });

  it('replaces residents rather than appending, so switching collections is clean', () => {
    const s = crowdApply(seeded(['a', 'b']), { type: 'seed', ids: ['c'] });
    expect(s.residents).toEqual(['c']);
  });
});

describe('a correct answer', () => {
  it('adds a newcomer as arriving, not settled', () => {
    const s = crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 1 });
    expect(s.residents).toContain('a');
    expect(s.arriving.a).toBe(0);
  });

  it('settles the newcomer once the arrival finishes', () => {
    let s = crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 1 });
    s = crowdStep(s, ARRIVAL_DUR + 0.01);
    expect(s.arriving.a).toBeUndefined();
    expect(s.residents).toContain('a');
  });

  it('does not duplicate a question already owned', () => {
    const s = crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 1 });
    expect(s.residents.filter(x => x === 'a').length).toBe(1);
  });

  it('still celebrates for a question already owned', () => {
    const s = crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 3 });
    expect(s.celebrating).toBe(3);
  });

  it('records whose answer the celebration is for', () => {
    expect(crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 2 }).celebrant).toBe('a');
  });

  it('clears the celebrant when the celebration ends', () => {
    let s = crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 2 });
    s = crowdStep(s, CELEBRATE_DUR + 0.01);
    expect(s.celebrant).toBeNull();
  });

  it('records the streak as the celebration tier', () => {
    expect(crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 4 }).celebrating).toBe(4);
  });

  it('clamps the tier to 5', () => {
    expect(crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 9 }).celebrating).toBe(5);
  });

  it('ends the celebration after its duration', () => {
    let s = crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 2 });
    s = crowdStep(s, CELEBRATE_DUR + 0.01);
    expect(s.celebrating).toBe(0);
  });
});

describe('a wrong answer', () => {
  it('does nothing visible for a question never owned', () => {
    const s = crowdApply(seeded(['a']), { type: 'wrong', id: 'b' });
    expect(s.loss).toBeNull();
    expect(s.residents).toEqual(['a']);
  });

  it('starts the loss sequence for a question that was owned', () => {
    const s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    expect(s.loss).toEqual({ id: 'a', phase: 'rising', t: 0 });
  });

  it('keeps the victim in residents while he rises, so he can be drawn', () => {
    const s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    expect(s.residents).toContain('a');
  });

  it('removes him at the burst', () => {
    let s = crowdApply(seeded(['a', 'b']), { type: 'wrong', id: 'a' });
    s = crowdStep(s, LOSS_RISE + 0.01);
    expect(s.loss?.phase).toBe('burst');
    expect(s.residents).not.toContain('a');
    expect(s.residents).toContain('b');
  });

  it('stuns the room after the burst', () => {
    let s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    s = crowdStep(s, LOSS_RISE + 0.01);
    s = crowdStep(s, LOSS_BURST + 0.01);
    expect(s.loss?.phase).toBe('stunned');
    expect(isStunned(s)).toBe(true);
  });

  it('recovers, then clears', () => {
    let s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    s = crowdStep(s, LOSS_RISE + 0.01);
    s = crowdStep(s, LOSS_BURST + 0.01);
    s = crowdStep(s, LOSS_STUN + 0.01);
    expect(s.loss?.phase).toBe('recovering');
    expect(isStunned(s)).toBe(false);
    s = crowdStep(s, LOSS_RECOVER + 0.01);
    expect(s.loss).toBeNull();
  });

  it('cancels any celebration in progress', () => {
    let s = crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 3 });
    s = crowdApply(s, { type: 'wrong', id: 'a' });
    expect(s.celebrating).toBe(0);
  });

  it('ignores a second loss while one is running', () => {
    let s = crowdApply(seeded(['a', 'b']), { type: 'wrong', id: 'a' });
    s = crowdApply(s, { type: 'wrong', id: 'b' });
    expect(s.loss?.id).toBe('a');
    expect(s.residents).toContain('b');
  });
});

describe('reset', () => {
  it('clears everything', () => {
    let s = crowdApply(seeded(['a']), { type: 'correct', id: 'b', streak: 2 });
    s = crowdApply(s, { type: 'reset' });
    expect(s).toEqual(crowdInit());
  });
});

describe('purity', () => {
  it('crowdApply does not mutate the previous state', () => {
    const s0 = seeded(['a']);
    crowdApply(s0, { type: 'correct', id: 'b', streak: 1 });
    expect(s0.residents).toEqual(['a']);
  });

  it('crowdStep does not mutate the previous state', () => {
    const s0 = crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 1 });
    crowdStep(s0, 5);
    expect(s0.arriving.a).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- crowdReducer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/collection/crowdReducer.ts

/**
 * The crowd's choreography, as a pure state machine.
 *
 * Same shape as gameReducer.ts: a reducer for discrete events plus a step function for time.
 * Nothing here touches a canvas, a timer or React, so all of it is unit-testable and the
 * per-frame path stays outside the React render cycle entirely.
 */

/** Seconds a newcomer spends walking in and waving before he settles. */
export const ARRIVAL_DUR = 1.1;
/** Seconds the room celebrates a correct answer. */
export const CELEBRATE_DUR = 2.2;

// The loss sequence, from the spec: rise, burst, ~0.8s freeze, then look around and shrug,
// with everyone back to normal inside ~2.5s of the burst.
export const LOSS_RISE = 0.9;
export const LOSS_BURST = 0.6;
export const LOSS_STUN = 0.8;
export const LOSS_RECOVER = 1.7;

export type LossPhase = 'rising' | 'burst' | 'stunned' | 'recovering';

export interface CrowdState {
  /** Question ids present in the room, including a victim who has not burst yet. */
  residents: string[];
  /**
   * Whose answer this celebration is for. That bobit celebrates harder than the room around
   * him -- the spec's "steps forward and celebrates personally" -- which is the only thing
   * distinguishing a repeat correct answer from a brand new arrival.
   */
  celebrant: string | null;
  /** Newcomers mid-arrival: id -> seconds elapsed. */
  arriving: Record<string, number>;
  /** Celebration tier 0-5. 0 means nobody is celebrating. */
  celebrating: number;
  celebrateT: number;
  loss: { id: string; phase: LossPhase; t: number } | null;
}

export type CrowdEvent =
  | { type: 'seed'; ids: string[] }
  | { type: 'correct'; id: string; streak: number }
  | { type: 'wrong'; id: string }
  | { type: 'reset' };

export function crowdInit(): CrowdState {
  return { residents: [], arriving: {}, celebrant: null, celebrating: 0, celebrateT: 0, loss: null };
}

export function crowdApply(state: CrowdState, event: CrowdEvent): CrowdState {
  switch (event.type) {
    case 'reset':
      return crowdInit();

    case 'seed':
      // Replaces rather than merges: seeding happens when a match starts, and the previous
      // match may have been a different collection entirely.
      return { ...crowdInit(), residents: [...event.ids] };

    case 'correct': {
      const known = state.residents.includes(event.id);
      return {
        ...state,
        residents: known ? state.residents : [...state.residents, event.id],
        // A question already owned spawns nobody -- his own bobit steps forward instead.
        arriving: known ? state.arriving : { ...state.arriving, [event.id]: 0 },
        celebrant: event.id,
        celebrating: Math.min(5, Math.max(1, event.streak)),
        celebrateT: 0,
      };
    }

    case 'wrong': {
      // Only a question the player actually owned costs anything. One loss at a time: a
      // second would fight the first for the room's attention.
      if (state.loss || !state.residents.includes(event.id)) return state;
      return {
        ...state,
        celebrating: 0,
        celebrateT: 0,
        celebrant: null,
        loss: { id: event.id, phase: 'rising', t: 0 },
      };
    }
  }
}

export function crowdStep(state: CrowdState, dt: number): CrowdState {
  let next: CrowdState = { ...state };

  // arrivals
  if (Object.keys(state.arriving).length) {
    const arriving: Record<string, number> = {};
    for (const id of Object.keys(state.arriving)) {
      const t = state.arriving[id] + dt;
      if (t < ARRIVAL_DUR) arriving[id] = t;
    }
    next.arriving = arriving;
  }

  // celebration
  if (state.celebrating > 0) {
    const t = state.celebrateT + dt;
    if (t >= CELEBRATE_DUR) { next.celebrating = 0; next.celebrateT = 0; next.celebrant = null; }
    else next.celebrateT = t;
  }

  // loss
  if (state.loss) {
    const t = state.loss.t + dt;
    const { id, phase } = state.loss;
    if (phase === 'rising' && t >= LOSS_RISE) {
      // He leaves the room at the burst, not before -- until then he is still drawn, rising.
      next.residents = next.residents.filter(r => r !== id);
      next.loss = { id, phase: 'burst', t: 0 };
    } else if (phase === 'burst' && t >= LOSS_BURST) {
      next.loss = { id, phase: 'stunned', t: 0 };
    } else if (phase === 'stunned' && t >= LOSS_STUN) {
      next.loss = { id, phase: 'recovering', t: 0 };
    } else if (phase === 'recovering' && t >= LOSS_RECOVER) {
      next.loss = null;
    } else {
      next.loss = { id, phase, t };
    }
  }

  return next;
}

/** The room is frozen: pinned mid-pose for the beat after somebody vanishes. */
export function isStunned(state: CrowdState): boolean {
  return state.loss?.phase === 'stunned';
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- crowdReducer`
Expected: PASS, 22 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdReducer.ts frontend/src/features/collection/__tests__/crowdReducer.test.ts
git commit -m "feat: crowd choreography state machine"
```

---

## Task 5: Per-frame figures in BobitField

The crowd's figures change every frame — arrivals walk in, the celebration tier changes poses, the victim rises. A React prop cannot carry that without a re-render per frame.

**Files:**
- Modify: `frontend/src/components/bobbits/BobitField.tsx`

**Interfaces:**
- Consumes: `FieldFigure` (existing).
- Produces: `BobitField` gains an optional prop
  `figuresFor?: (t: number, dt: number) => FieldFigure[]`
  When present it is called once per frame and its return value replaces `figures` for that frame. `figures` stays required and is used for the static case and as the first-frame value.

- [ ] **Step 1: Add the prop**

In the props interface, after `bubbles`:

```tsx
  /**
   * Per-frame figure source. When present this is called once per frame and replaces
   * `figures` for that frame.
   *
   * The crowd's figures change every frame -- newcomers walk in, the celebration tier swaps
   * poses, a victim rises -- and a React prop cannot carry that without re-rendering sixty
   * times a second. This keeps the choreography inside the existing rAF loop and React out
   * of the per-frame path entirely.
   */
  figuresFor?: (t: number, dt: number) => FieldFigure[];
```

- [ ] **Step 2: Wire it into the loop**

Add a ref beside `clickRef` so changing the callback does not tear down the loop:

```tsx
  const figuresForRef = useRef(figuresFor);
```

Add beside the other ref-sync effects:

```tsx
  useEffect(() => { figuresForRef.current = figuresFor; }, [figuresFor]);
```

In `renderFrame`, replace:

```tsx
      const all = resolveX(figuresRef.current, w);
```

with:

```tsx
      const source = figuresForRef.current
        ? figuresForRef.current(t, dt)
        : figuresRef.current;
      const all = resolveX(source, w);
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: clean.

- [ ] **Step 4: Confirm nothing regressed**

Run: `cd frontend && npm test`
Expected: PASS. The existing field consumers pass no `figuresFor`, so they take the unchanged path.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/BobitField.tsx
git commit -m "feat: per-frame figure source for BobitField"
```

---

## Task 6: Turning crowd state into figures

**Files:**
- Create: `frontend/src/features/collection/crowdFigures.ts`
- Create: `frontend/src/features/collection/__tests__/crowdFigures.test.ts`

**Interfaces:**
- Consumes: `CrowdState`, `isStunned` (Task 4); `slotOrder`, `toneOf` (Task 2); `slotPosition`, `CrowdBand`, `CROWD_CAP` (Task 3); `FieldFigure` (`components/bobbits/fieldGeometry`); `figColor` (`components/bobbits/rigExtras`).
- Produces:
  - `crowdFigures(state: CrowdState, t: number, band: CrowdBand, darkMode: boolean): FieldFigure[]`
  - `overflowCount(state: CrowdState): number`
  - `animForTier(tier: number): string`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/__tests__/crowdFigures.test.ts
import { describe, it, expect } from 'vitest';
import { crowdFigures, overflowCount, animForTier } from '../crowdFigures';
import { crowdInit, crowdApply } from '../crowdReducer';
import { CROWD_CAP } from '../crowdLayout';

const band = { width: 1000, height: 90, scale: 0.22 };
const seeded = (ids: string[]) => crowdApply(crowdInit(), { type: 'seed', ids });
const many = (n: number) => Array.from({ length: n }, (_, i) => `q-${String(i).padStart(4, '0')}`);

describe('crowdFigures', () => {
  it('renders nobody for an empty crowd', () => {
    expect(crowdFigures(crowdInit(), 0, band, false)).toEqual([]);
  });

  it('renders one figure per resident', () => {
    expect(crowdFigures(seeded(['a', 'b', 'c']), 0, band, false).length).toBe(3);
  });

  it('marks every collection bobit unpoofable', () => {
    // A poof on the game screen must always mean "you got this wrong".
    for (const f of crowdFigures(seeded(['a', 'b']), 0, band, false)) {
      expect(f.poofable).toBe(false);
    }
  });

  it('caps the rendered population', () => {
    expect(crowdFigures(seeded(many(154)), 0, band, false).length).toBe(CROWD_CAP);
  });

  it('reports the overflow', () => {
    expect(overflowCount(seeded(many(154)))).toBe(54);
    expect(overflowCount(seeded(many(80)))).toBe(0);
  });

  it('gives a figure the same id it was seeded with', () => {
    const ids = crowdFigures(seeded(['b', 'a']), 0, band, false).map(f => f.id);
    expect(ids.slice().sort()).toEqual(['a', 'b']);
  });

  it('keeps a figure in the same place as the crowd grows', () => {
    const before = crowdFigures(seeded(['a', 'b']), 0, band, false).find(f => f.id === 'a')!;
    const after = crowdFigures(seeded(['a', 'b', 'c', 'd']), 0, band, false).find(f => f.id === 'a')!;
    expect(after.x).toBe(before.x);
    expect(after.groundY).toBe(before.groundY);
  });

  it('gives a figure the same colour every time', () => {
    const a = crowdFigures(seeded(['a']), 0, band, false)[0];
    const b = crowdFigures(seeded(['a', 'z']), 5, band, false).find(f => f.id === 'a')!;
    expect(b.color).toBe(a.color);
  });

  it('uses a different palette in dark mode', () => {
    const light = crowdFigures(seeded(['a']), 0, band, false)[0];
    const dark = crowdFigures(seeded(['a']), 0, band, true)[0];
    expect(dark.color).not.toBe(light.color);
  });

  it('freezes the phase while the room is stunned', () => {
    let s = crowdApply(seeded(['a', 'b']), { type: 'wrong', id: 'a' });
    s = { ...s, loss: { id: 'a', phase: 'stunned', t: 0.1 } };
    const at1 = crowdFigures(s, 1, band, false).find(f => f.id === 'b')!;
    const at2 = crowdFigures(s, 2, band, false).find(f => f.id === 'b')!;
    expect(at2.phase).toBe(at1.phase);
  });

  it('lifts the victim off the ground while he rises', () => {
    let s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    const start = crowdFigures(s, 0, band, false).find(f => f.id === 'a')!;
    s = { ...s, loss: { id: 'a', phase: 'rising', t: 0.6 } };
    const later = crowdFigures(s, 0.6, band, false).find(f => f.id === 'a')!;
    expect(later.groundY).toBeLessThan(start.groundY);
  });

  it('gives the celebrant a bigger pose than the room', () => {
    let s = crowdApply(seeded(['a', 'b']), { type: 'correct', id: 'a', streak: 1 });
    const figs = crowdFigures(s, 0, band, false);
    const celebrant = figs.find(f => f.id === 'a')!;
    const bystander = figs.find(f => f.id === 'b')!;
    expect(celebrant.anim).not.toBe(bystander.anim);
  });
});

describe('animForTier', () => {
  it('escalates through distinct poses', () => {
    const poses = [1, 2, 3, 4, 5].map(animForTier);
    expect(new Set(poses).size).toBeGreaterThan(2);
  });

  it('idles when nobody is celebrating', () => {
    expect(animForTier(0)).toBe('standstill');
  });

  it('gives the top tier the biggest pose', () => {
    expect(animForTier(5)).toBe('dance');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- crowdFigures`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/collection/crowdFigures.ts
import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { figColor } from '../../components/bobbits/rigExtras';
import { slotOrder, toneOf, hashId } from './crowdIdentity';
import { slotPosition, CROWD_CAP } from './crowdLayout';
import type { CrowdBand } from './crowdLayout';
import { isStunned, LOSS_RISE } from './crowdReducer';
import type { CrowdState } from './crowdReducer';

/**
 * The escalation ladder, as poses. Tier is the in-match streak, 1-5.
 *
 * Confetti is deliberately absent here: it fires only at a 5/5 finish, from the component,
 * so the top rung differs in kind and not merely in degree.
 */
export function animForTier(tier: number): string {
  switch (tier) {
    case 0: return 'standstill';
    case 1: return 'friendly';   // a nod and a wave
    case 2: return 'cheer';      // arms up
    case 3: return 'cheer';
    case 4: return 'jump';
    default: return 'dance';
  }
}

/** How many owned bobits are not being rendered because of the cap. */
export function overflowCount(state: CrowdState): number {
  return Math.max(0, state.residents.length - CROWD_CAP);
}

export function crowdFigures(
  state: CrowdState, t: number, band: CrowdBand, darkMode: boolean,
): FieldFigure[] {
  const ordered = slotOrder(state.residents);
  const shown = ordered.slice(0, CROWD_CAP);
  const total = shown.length;

  // While the room is stunned every figure holds its pose. Feeding a frozen clock is what
  // makes that a freeze rather than a reset to the start of the animation.
  const clock = isStunned(state) ? 0 : t;

  const out: FieldFigure[] = [];
  for (let i = 0; i < total; i++) {
    const id = shown[i];
    const pos = slotPosition(i, total, band);
    const arriving = state.arriving[id] !== undefined;
    const victim = state.loss?.id === id;

    let anim: string;
    if (victim) anim = 'fall';                      // limp, being lifted
    else if (arriving) anim = 'friendly';           // walks in and waves
    else if (state.celebrant === id && state.celebrating > 0) {
      // Whoever this answer belongs to celebrates one rung harder than the room -- that is
      // what a repeat correct answer looks like when it spawns nobody.
      anim = animForTier(Math.min(5, state.celebrating + 1));
    } else anim = animForTier(state.celebrating);

    let groundY = pos.groundY;
    if (victim && state.loss?.phase === 'rising') {
      // Floats up, accelerating, over the rise. He is drawn until the burst takes him.
      const k = Math.min(1, state.loss.t / LOSS_RISE);
      groundY -= k * k * (band.height * 1.6);
    }

    out.push({
      id,
      anim,
      color: figColor(toneOf(id), darkMode),
      x: pos.x,
      groundY,
      scale: band.scale,
      // Phase from the id, so neighbours never move in lockstep and a given bobit always
      // breathes on his own beat.
      phase: (hashId(id) % 1000) / 250,
      flip: hashId(id) % 2 === 0,
      poofable: false,
      greetable: false,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- crowdFigures`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdFigures.ts frontend/src/features/collection/__tests__/crowdFigures.test.ts
git commit -m "feat: turn crowd state into field figures"
```

---

## Task 7: The crowd component

**Files:**
- Create: `frontend/src/features/collection/CollectionCrowd.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–6, plus `BobitField` and `useReducedMotion`.
- Produces:
  - `CollectionCrowd(props: { slug: string | null; darkMode: boolean; isMobile: boolean; lastAnswer: { questionId: string; correct: boolean; streak: number } | null; finished5of5: boolean })`

The component owns crowd state in a ref and drives it from `figuresFor`. Its only React state is the overflow count, which changes rarely.

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/features/collection/CollectionCrowd.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useConfettiStore } from '../../store/confettiStore';
import { createLocalProgressStore } from './bobitProgress';
import { crowdInit, crowdApply, crowdStep } from './crowdReducer';
import type { CrowdState } from './crowdReducer';
import { crowdFigures, overflowCount } from './crowdFigures';
import type { CrowdBand } from './crowdLayout';

interface CollectionCrowdProps {
  /** Collection being played. Null before a session exists. */
  slug: string | null;
  darkMode: boolean;
  isMobile: boolean;
  /** The most recent revealed answer. A new object identity means a new answer to react to. */
  lastAnswer: { questionId: string; correct: boolean; streak: number } | null;
  /** True once the match ends with every question correct. */
  finished5of5: boolean;
}

const store = createLocalProgressStore();

/**
 * The collection crowd: one bobit per question this player has answered correctly, standing
 * in a band beneath the game.
 *
 * Never an overlay. The band sits in normal document flow so it cannot cover the question or
 * the answer options -- a hard requirement, and layout is the only way to guarantee it rather
 * than merely arrange it.
 */
export function CollectionCrowd({
  slug, darkMode, isMobile, lastAnswer, finished5of5,
}: CollectionCrowdProps) {
  const reducedMotion = useReducedMotion();
  const fireFireworks = useConfettiStore(s => s.fireFireworks);
  const stateRef = useRef<CrowdState>(crowdInit());
  const [overflow, setOverflow] = useState(0);

  const height = isMobile ? 54 : 96;
  const band: CrowdBand = useMemo(() => ({
    width: 1000,                       // nominal; figures are placed proportionally
    height,
    scale: isMobile ? 0.13 : 0.2,
  }), [height, isMobile]);

  // Seed from storage whenever the collection changes.
  useEffect(() => {
    if (!slug) { stateRef.current = crowdInit(); setOverflow(0); return; }
    const owned = [...store.load(slug)];
    stateRef.current = crowdApply(stateRef.current, { type: 'seed', ids: owned });
    setOverflow(overflowCount(stateRef.current));
  }, [slug]);

  // React to a revealed answer. Keyed on object identity, so the same question answered again
  // in a later match still registers.
  useEffect(() => {
    if (!slug || !lastAnswer) return;
    const { questionId, correct, streak } = lastAnswer;
    if (correct) {
      stateRef.current = crowdApply(stateRef.current, { type: 'correct', id: questionId, streak });
      store.grant(slug, questionId);
    } else {
      stateRef.current = crowdApply(stateRef.current, { type: 'wrong', id: questionId });
      // Revoke unconditionally: revoking something never owned is a no-op, and checking first
      // would duplicate the reducer's own ownership test.
      store.revoke(slug, questionId);
    }
    setOverflow(overflowCount(stateRef.current));
  }, [lastAnswer, slug]);

  // Confetti belongs to the finish, not to a tier.
  useEffect(() => {
    if (finished5of5 && !reducedMotion) fireFireworks();
  }, [finished5of5, reducedMotion, fireFireworks]);

  const figuresFor = useMemo(() => (t: number, dt: number): FieldFigure[] => {
    if (!reducedMotion) stateRef.current = crowdStep(stateRef.current, dt);
    return crowdFigures(stateRef.current, t, band, darkMode);
  }, [band, darkMode, reducedMotion]);

  if (!slug) return null;

  return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
      <BobitField figures={[]} figuresFor={figuresFor} height={height} />
      {overflow > 0 && (
        <span
          style={{
            position: 'absolute', right: 8, bottom: 4,
            fontFamily: "'Manrope', sans-serif", fontSize: isMobile ? 10 : 12,
            fontWeight: 600, opacity: 0.55,
            color: darkMode ? '#94A3B8' : '#4B5768',
          }}
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat: collection crowd component"
```

---

## Task 8: Mount it on the game screen

**Files:**
- Modify: `frontend/src/features/game/components/GameScreen.tsx`

**Interfaces:**
- Consumes: `CollectionCrowd` (Task 7); `state.collectionSlug`, `state.answers`, `state.currentStreak`, `state.phase` (existing `GameState`).
- Produces: no new exports.

- [ ] **Step 1: Derive the last answer**

Inside `GameScreen`, above the `return`:

```tsx
  // The crowd reacts to the most recent revealed answer. A fresh object identity each time an
  // answer lands is what makes the effect fire again for a question seen in an earlier match.
  const lastAnswer = useMemo(() => {
    const a = state.answers[state.answers.length - 1];
    if (!a) return null;
    return { questionId: a.questionId, correct: a.correct, streak: state.currentStreak };
  }, [state.answers, state.currentStreak]);

  const finished5of5 =
    state.phase === 'complete' &&
    state.answers.length === state.totalQuestions &&
    state.answers.every(a => a.correct);
```

- [ ] **Step 2: Render the band beneath the answers**

At the end of the main content container — after the block holding `QuestionCard` and `AnswerGrid`, still inside the `relative h-full flex flex-col` wrapper — add:

```tsx
        {/* The collection crowd. In flow, never an overlay: it must not cover the question or
            any answer option. flex-shrink-0 keeps the band its full height and lets the
            content column above it take the compression instead. */}
        <div className="mx-auto w-full flex-shrink-0" style={{ maxWidth: 'clamp(700px, 55vw, 1500px)' }}>
          <CollectionCrowd
            slug={state.collectionSlug}
            darkMode={darkMode}
            isMobile={isMobile}
            lastAnswer={lastAnswer}
            finished5of5={finished5of5}
          />
        </div>
```

Add the import at the top:

```tsx
import { CollectionCrowd } from '../../collection/CollectionCrowd';
```

Both values are already in scope inside `GameScreen`: `darkMode` comes from `useThemeStore()` at line 97, and `viewportWidth` from `useWindowSize()` at line 115. Derive the mobile flag next to the existing `timerScale` maths:

```tsx
  const isMobile = viewportWidth < 640;
```

(640 is the breakpoint `BobbitCivicFactSitter` already uses for the same purpose.)

- [ ] **Step 3: Typecheck and test**

Run: `cd frontend && npm run typecheck && npm test`
Expected: both clean.

- [ ] **Step 4: Verify the hard constraint by eye**

Run `npm run dev`, start a match, and confirm at desktop AND at a 375px-wide viewport:
- the question card is fully visible and unobstructed
- all four answer options are fully visible and unobstructed
- the crowd band sits below them and never overlaps

If the answers are compressed too far on a small phone, reduce the band height (`isMobile ? 54 : 96`) rather than letting the crowd overlap anything.

- [ ] **Step 5: Verify the mechanic**

In the same session: answer correctly and confirm a bobit walks in and the room reacts; reload and confirm he is still there; answer that same question wrong in a later match and confirm he rises, bursts, the room freezes, and the slot is left empty.

- [ ] **Step 6: Build and smoke**

Run: `cd frontend && npm run build && npm start & npm run smoke`
Expected: smoke passes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/game/components/GameScreen.tsx
git commit -m "feat: mount the collection crowd beneath the game"
```

---

## Out of scope

- **The server driver.** `backend/` is frozen; it lands in `ev-accounts/backend/src/trivia/` as a separate change, and is what later unlocks difficulty gating (question selection runs on the backend and cannot read localStorage).
- **Per-collection tallies on collection cards.** `summary()` exists to serve it.
- **Unlockable platforms and toys.** `Surface` is declared in `fieldGeometry.ts` and unimplemented.
- **Revisiting the overflow treatment.** Ship the cap at 100 with a "+N more" count and revisit if it reads badly.

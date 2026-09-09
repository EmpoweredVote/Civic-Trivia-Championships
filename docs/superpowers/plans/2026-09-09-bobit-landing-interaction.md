# Bobit Landing Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every bobit on the CTC landing page perform only in response to the visitor — nothing waves or dances unprompted — fix the carried logo so it is actually held, and give the quote reader ev-landing's click-to-speak model with a per-session quote.

**Architecture:** Wander state lives in `BobbitScene` behind a new pure `wanderReducer.ts`, driven through `BobitField`'s existing per-frame `figuresFor` hook, so the shared crowd renderer gains only optional additive fields. The reader keeps its own canvas and grows an explicit state machine ported from ev-landing's `drawReader`. The trophy fix is geometric and verified by measurement, not by eye.

**Tech Stack:** React 18 + TypeScript, Vite, vitest, canvas 2D. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-09-bobit-landing-interaction-design.md`

## Global Constraints

- **`leremyRig.ts` is never edited.** It is a faithful mirror of ev-landing's `leremy-rig.js` so re-syncing stays a clean overwrite. Every CTC-only pose goes in `rigExtras.ts`.
- **`CollectionCrowd` must remain untouched and behaviourally unchanged.** All `BobitField` interface changes are additive and optional; Task 2 carries a test proving the default path is unchanged.
- **Bobits must never cover the question card or any of the four answer options.** Nothing here touches the game screen, but wander clamping is the reducer's own contract, not a caller's responsibility.
- **`frontend/` only.** `backend/` is frozen (ev-cto decision 0013) and irrelevant to this work.
- **A green build is not a page load.** Final verification runs `npm run smoke` in `frontend/`.
- Run all commands from `frontend/`. Tests: `npx vitest run <path>`.

---

### Task 1: Card greeter rests instead of waving

The greeter's `anim: 'greetseat'` **is** the wave — that is why it never stops. Switching it to `sit` makes the existing hover-greet path supply the wave for free, because `BobitField` already maps a hovered seated figure to `greetseat`.

**Files:**
- Modify: `frontend/src/components/bobbits/BobbitCardGreeter.tsx:30`
- Test: `frontend/src/components/bobbits/__tests__/greeterRest.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Self-contained.

- [ ] **Step 1: Write the failing test**

The mechanism that makes this free has two preconditions: `sit` must be a seated pose in the rig (so hover resolves to `greetseat`, not standing `greet`), and `sit` must be in `fieldGeometry`'s `SEATED` set (so `pelvisOffset` stays 8 and the figure does not jump vertically). Guard both.

Create `frontend/src/components/bobbits/__tests__/greeterRest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ALL_ANIMATIONS } from '../rigExtras';
import { pelvisOffset } from '../fieldGeometry';

describe('the card greeter rest pose', () => {
  it('uses a pose the rig reports as seated, so hover resolves to greetseat', () => {
    expect(ALL_ANIMATIONS.sit).toBeDefined();
    expect(ALL_ANIMATIONS.sit.seated).toBe(true);
  });

  it('sits at the same pelvis offset as the wave it replaces, so it does not jump', () => {
    expect(pelvisOffset('sit')).toBe(pelvisOffset('greetseat'));
  });

  it('still has a wave to hand off to', () => {
    expect(ALL_ANIMATIONS.greetseat).toBeDefined();
    expect(ALL_ANIMATIONS.greetseat.seated).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/components/bobbits/__tests__/greeterRest.test.ts`
Expected: PASS. These assertions describe the rig as it already stands — they are a regression guard on the mechanism Step 3 depends on, not a red test. If any assertion **fails**, stop: the free-wave assumption is wrong and this task needs redesigning before touching the component.

- [ ] **Step 3: Change the rest pose**

In `BobbitCardGreeter.tsx`, line 30, change `anim: 'greetseat'` to `anim: 'sit'`, and update the component's doc comment (lines 11-16), which currently says "waving hello". Replace that clause:

```tsx
/**
 * A single Bobbit perched on the top edge of whatever card this is placed over — seated,
 * legs dangling onto the card below. At rest it just sits; hovering makes it wave, which
 * BobitField supplies for free by swapping a hovered seated figure to `greetseat`. Render as
 * a SIBLING of the card (inside a shared position:relative wrapper), not as its descendant —
 * the card's own overflow:hidden would otherwise clip the head/arm poking up above its edge.
 */
```

The `seatFromTop` comment on lines 21-24 warns that undershooting clips the raised wave arm. That clearance is still required — hover still raises the arm — so leave those values alone.

- [ ] **Step 4: Re-run the test and typecheck**

Run: `npx vitest run src/components/bobbits/__tests__/greeterRest.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/bobbits/BobbitCardGreeter.tsx src/components/bobbits/__tests__/greeterRest.test.ts
git commit -m "feat(bobits): the card greeter sits at rest and waves on hover"
```

---

### Task 2: `hoverAnim` — let a figure choose what it plays while hovered

`BobitField` hardcodes `greeting ? (seated ? 'greetseat' : 'greet') : anim`. The dancers need hover to mean *dance*. ev-figures.js already carries a spec field of exactly this name (`A[spec.hoverAnim || 'greet']`, ev-figures.js:4084), so the name is borrowed, not invented.

The resolution currently lives inline inside a `useEffect` closure and cannot be tested. Extract it to a pure function first.

**Files:**
- Modify: `frontend/src/components/bobbits/fieldGeometry.ts` (add `hoverAnim` to `FieldFigure`, add `resolveAnimKey`)
- Modify: `frontend/src/components/bobbits/BobitField.tsx:146-149`
- Test: `frontend/src/components/bobbits/__tests__/fieldGeometry.test.ts` (extend)

**Interfaces:**
- Consumes: `FieldFigure` from `fieldGeometry.ts`.
- Produces:
  - `FieldFigure.hoverAnim?: string`
  - `resolveAnimKey(f: FieldFigure, greeting: boolean, isSeated: boolean): string`

  Task 4 sets `hoverAnim: 'dance'`. Nothing else consumes `resolveAnimKey`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/bobbits/__tests__/fieldGeometry.test.ts`:

```ts
import { resolveAnimKey } from '../fieldGeometry';
import type { FieldFigure } from '../fieldGeometry';

describe('resolveAnimKey', () => {
  const base: FieldFigure = {
    id: 'a', anim: 'stroll', color: '#000', x: 0, groundY: 50, scale: 0.28,
  };

  it('plays its own animation when not greeting', () => {
    expect(resolveAnimKey(base, false, false)).toBe('stroll');
  });

  it('defaults a standing figure to greet', () => {
    expect(resolveAnimKey(base, true, false)).toBe('greet');
  });

  it('defaults a seated figure to greetseat', () => {
    expect(resolveAnimKey({ ...base, anim: 'sit' }, true, true)).toBe('greetseat');
  });

  it('prefers an explicit hoverAnim over the default', () => {
    expect(resolveAnimKey({ ...base, hoverAnim: 'dance' }, true, false)).toBe('dance');
  });

  it('prefers an explicit hoverAnim over greetseat too', () => {
    const f = { ...base, anim: 'sit', hoverAnim: 'dance' };
    expect(resolveAnimKey(f, true, true)).toBe('dance');
  });

  it('ignores hoverAnim while not greeting', () => {
    expect(resolveAnimKey({ ...base, hoverAnim: 'dance' }, false, false)).toBe('stroll');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/bobbits/__tests__/fieldGeometry.test.ts`
Expected: FAIL — `resolveAnimKey` is not exported from `fieldGeometry`.

- [ ] **Step 3: Add the field and the resolver**

In `fieldGeometry.ts`, add to the `FieldFigure` interface after `greetable?: boolean;`:

```ts
  /**
   * What this figure plays while greeting (hovered, or within the greet linger). Defaults to
   * `greet`, or `greetseat` when its own pose is seated. ev-figures.js carries the same field
   * on its stand specs (`A[spec.hoverAnim || 'greet']`).
   */
  hoverAnim?: string;
```

And add the resolver. It takes `isSeated` as a parameter rather than reading `ALL_ANIMATIONS` itself: `rigExtras` imports `leremyRig`, and keeping `fieldGeometry` free of that dependency avoids an import cycle and keeps the function pure.

```ts
/**
 * Which animation key a figure paints with this frame. Seatedness is passed in rather than
 * looked up so this stays pure and free of a dependency on the animation registry.
 */
export function resolveAnimKey(f: FieldFigure, greeting: boolean, isSeated: boolean): string {
  if (!greeting) return f.anim;
  if (f.hoverAnim) return f.hoverAnim;
  return isSeated ? 'greetseat' : 'greet';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/bobbits/__tests__/fieldGeometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in BobitField**

In `BobitField.tsx`, replace lines 146-149:

```ts
      const animKey = greeting
        ? (ALL_ANIMATIONS[f.anim]?.seated ? 'greetseat' : 'greet')
        : f.anim;
      const anim = ALL_ANIMATIONS[animKey] || ALL_ANIMATIONS[f.anim];
```

with:

```ts
      const animKey = resolveAnimKey(f, greeting, !!ALL_ANIMATIONS[f.anim]?.seated);
      const anim = ALL_ANIMATIONS[animKey] || ALL_ANIMATIONS[f.anim];
```

Add `resolveAnimKey` to the existing `fieldGeometry` import at the top of the file. The `|| ALL_ANIMATIONS[f.anim]` fallback stays: it now also covers a typo'd `hoverAnim`.

- [ ] **Step 6: Verify the whole bobit suite and typecheck**

Run: `npx vitest run src/components/bobbits && npx tsc --noEmit`
Expected: PASS. The existing suite passing is the evidence that `CollectionCrowd`'s default path is unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/bobbits/fieldGeometry.ts src/components/bobbits/BobitField.tsx src/components/bobbits/__tests__/fieldGeometry.test.ts
git commit -m "feat(bobits): let a field figure choose its own hover animation"
```

---

### Task 3: `wanderReducer` — stroll, pause, look around

A pure state machine, following the shape of `fleeReducer` / `greetReducer`: `Record<string, …>`, immutable, no clock of its own. Randomness is injected so phase durations and turns are seedable.

Travel speed is expressed in **rig units per second** so it scales with the figure. ev-figures.js pairs `stroll` with 32 px/s at its `S = 0.32` (`GSPEED`, ev-figures.js:1616), which is 100 units/s.

**Files:**
- Create: `frontend/src/components/bobbits/wanderReducer.ts`
- Test: `frontend/src/components/bobbits/__tests__/wanderReducer.test.ts` (create)

**Interfaces:**
- Consumes: `FieldFigure` type only (for documentation; no runtime dependency).
- Produces:
  - `WANDER_UNITS_PER_SEC: number`, `WALK_MIN/WALK_MAX/PAUSE_MIN/PAUSE_MAX: number`, `MIN_SEPARATION: number`
  - `type WanderPhase = 'walk' | 'pause'`
  - `interface Wanderer { x: number; dir: 1 | -1; phase: WanderPhase; t: number; next: number }`
  - `type WanderState = Record<string, Wanderer>`
  - `type Rand = () => number`
  - `initWander(seeds: Array<{ id: string; x: number; dir: 1 | -1 }>, rand: Rand): WanderState`
  - `wanderAdvance(state: WanderState, dt: number, opts: WanderOpts): WanderState`
  - `interface WanderOpts { width: number; scale: number; greeting: ReadonlySet<string>; rand: Rand }`
  - `wanderAnim(e: Wanderer): string`

  Task 4 consumes all of these.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/bobbits/__tests__/wanderReducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  initWander, wanderAdvance, wanderAnim,
  WANDER_UNITS_PER_SEC, WALK_MIN, PAUSE_MIN, MIN_SEPARATION,
} from '../wanderReducer';
import type { WanderState, Rand } from '../wanderReducer';

/** Deterministic rand: cycles a fixed list so phase lengths and turns are predictable. */
function seq(values: number[]): Rand {
  let i = 0;
  return () => values[i++ % values.length];
}

const OPTS = (over: Partial<{ width: number; scale: number; greeting: Set<string>; rand: Rand }> = {}) => ({
  width: 400,
  scale: 1,
  greeting: new Set<string>(),
  rand: seq([0.5]),
  ...over,
});

describe('initWander', () => {
  it('seeds every figure walking', () => {
    const s = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0.5]));
    expect(s.a.phase).toBe('walk');
    expect(s.a.x).toBe(100);
    expect(s.a.dir).toBe(1);
    expect(s.a.t).toBe(0);
  });

  it('gives the first walk a duration inside the walk band', () => {
    const s = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));
    expect(s.a.next).toBeCloseTo(WALK_MIN, 5);
  });
});

describe('wanderAdvance — walking', () => {
  it('travels at the unit speed times the figure scale', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ scale: 0.5 }));
    expect(s1.a.x).toBeCloseTo(100 + WANDER_UNITS_PER_SEC * 0.5, 5);
  });

  it('travels leftward when dir is -1', () => {
    const s0 = initWander([{ id: 'a', x: 200, dir: -1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ scale: 1 }));
    expect(s1.a.x).toBeCloseTo(200 - WANDER_UNITS_PER_SEC, 5);
  });

  it('does not mutate the previous state', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0.5]));
    wanderAdvance(s0, 1, OPTS());
    expect(s0.a.x).toBe(100);
  });
});

describe('wanderAdvance — rail bounds', () => {
  it('turns rather than leaving the right edge', () => {
    const s0 = initWander([{ id: 'a', x: 395, dir: 1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ width: 400, scale: 1 }));
    expect(s1.a.dir).toBe(-1);
    expect(s1.a.x).toBeLessThanOrEqual(400);
  });

  it('turns rather than leaving the left edge', () => {
    const s0 = initWander([{ id: 'a', x: 5, dir: -1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ width: 400, scale: 1 }));
    expect(s1.a.dir).toBe(1);
    expect(s1.a.x).toBeGreaterThanOrEqual(0);
  });

  it('never escapes the rail over a long run', () => {
    let s: WanderState = initWander([{ id: 'a', x: 200, dir: 1 }], seq([0.3, 0.7]));
    const opts = OPTS({ width: 400, scale: 1, rand: seq([0.3, 0.7]) });
    for (let i = 0; i < 2000; i++) {
      s = wanderAdvance(s, 1 / 60, opts);
      expect(s.a.x).toBeGreaterThanOrEqual(0);
      expect(s.a.x).toBeLessThanOrEqual(400);
    }
  });
});

describe('wanderAdvance — phases', () => {
  it('switches to pause when the walk timer expires', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));   // next = WALK_MIN
    const s1 = wanderAdvance(s0, WALK_MIN + 0.01, OPTS());
    expect(s1.a.phase).toBe('pause');
    expect(s1.a.t).toBe(0);
  });

  it('holds position through the pause', () => {
    let s = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));
    s = wanderAdvance(s, WALK_MIN + 0.01, OPTS());
    const paused = s.a.x;
    s = wanderAdvance(s, 0.5, OPTS());
    expect(s.a.phase).toBe('pause');
    expect(s.a.x).toBe(paused);
  });

  it('returns to walking when the pause expires', () => {
    let s = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));
    s = wanderAdvance(s, WALK_MIN + 0.01, OPTS({ rand: seq([0]) }));
    s = wanderAdvance(s, PAUSE_MIN + 0.01, OPTS({ rand: seq([0]) }));
    expect(s.a.phase).toBe('walk');
  });
});

describe('wanderAdvance — greeting figures hold still', () => {
  it('does not advance a greeting figure', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0.5]));
    const s1 = wanderAdvance(s0, 1, OPTS({ greeting: new Set(['a']) }));
    expect(s1.a.x).toBe(100);
  });

  it('holds the phase timer too, so a hovered figure does not silently change phase', () => {
    const s0 = initWander([{ id: 'a', x: 100, dir: 1 }], seq([0]));
    const s1 = wanderAdvance(s0, WALK_MIN + 5, OPTS({ greeting: new Set(['a']) }));
    expect(s1.a.phase).toBe('walk');
    expect(s1.a.t).toBe(0);
  });

  it('advances a figure that is not the greeting one', () => {
    const s0 = initWander([
      { id: 'a', x: 100, dir: 1 },
      { id: 'b', x: 300, dir: 1 },
    ], seq([0.5]));
    const s1 = wanderAdvance(s0, 0.1, OPTS({ greeting: new Set(['a']) }));
    expect(s1.a.x).toBe(100);
    expect(s1.b.x).toBeGreaterThan(300);
  });
});

describe('wanderAdvance — separation', () => {
  it('never lets two figures close inside the minimum gap', () => {
    let s: WanderState = initWander([
      { id: 'a', x: 180, dir: 1 },
      { id: 'b', x: 220, dir: -1 },
    ], seq([0.5]));
    const opts = OPTS({ width: 400, scale: 1, rand: seq([0.5]) });
    for (let i = 0; i < 600; i++) {
      s = wanderAdvance(s, 1 / 60, opts);
      expect(Math.abs(s.a.x - s.b.x)).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-6);
    }
  });

  it('turns a figure that would close the gap', () => {
    const s0: WanderState = {
      a: { x: 200, dir: 1, phase: 'walk', t: 0, next: 99 },
      b: { x: 200 + MIN_SEPARATION, dir: -1, phase: 'walk', t: 0, next: 99 },
    };
    const s1 = wanderAdvance(s0, 0.1, OPTS({ scale: 1 }));
    expect(s1.a.dir).toBe(-1);
  });
});

describe('wanderAnim', () => {
  it('strolls while walking', () => {
    expect(wanderAnim({ x: 0, dir: 1, phase: 'walk', t: 0, next: 3 })).toBe('stroll');
  });

  it('stands still while pausing', () => {
    expect(wanderAnim({ x: 0, dir: 1, phase: 'pause', t: 0, next: 3 })).toBe('standstill');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/bobbits/__tests__/wanderReducer.test.ts`
Expected: FAIL — cannot resolve `../wanderReducer`.

- [ ] **Step 3: Write the reducer**

Create `frontend/src/components/bobbits/wanderReducer.ts`:

```ts
/**
 * Stroll / pause / look-around wandering for a decorative rail.
 *
 * ev-figures.js's wanderer walks one figure clean across the viewport (`av.x += av.dir *
 * av.speed * dt`) and retires it off-screen for 14-22s before the next appears. A CTC rail is
 * a few hundred px wide and always populated, so this turns at the bounds instead of retiring,
 * and adds a pause beat -- without it, a short rail reads as a metronome.
 *
 * Pure and immutable, like every other reducer here. Randomness is injected so phase lengths
 * and turns are seedable under test.
 */

/**
 * Travel speed in RIG UNITS per second, so it scales with the figure rather than the viewport.
 * ev-figures.js pairs `stroll` with 32 px/s at its S = 0.32 (GSPEED, ev-figures.js:1616),
 * which is 100 units/s. A figure's px/s is WANDER_UNITS_PER_SEC * scale.
 */
export const WANDER_UNITS_PER_SEC = 100;

/** Seconds a walk leg lasts, before a pause. */
export const WALK_MIN = 2.2;
export const WALK_MAX = 5.5;

/** Seconds a pause lasts. Long enough to read as "looking around", short enough not to stall. */
export const PAUSE_MIN = 1.2;
export const PAUSE_MAX = 3.0;

/**
 * Closest two wanderers may come, in rig units. fieldGeometry's HALF_W is 34, so two figures
 * at 68 are already touching; 76 leaves a visible sliver between them.
 */
export const MIN_SEPARATION = 76;

/** Matches fieldGeometry's HALF_W: no part of a figure may cross the rail edge. */
const EDGE_MARGIN_UNITS = 34;

export type WanderPhase = 'walk' | 'pause';

export interface Wanderer {
  /** px in field space. */
  x: number;
  dir: 1 | -1;
  phase: WanderPhase;
  /** Seconds spent in the current phase. */
  t: number;
  /** Seconds the current phase lasts. */
  next: number;
}

export type WanderState = Record<string, Wanderer>;

export type Rand = () => number;

export interface WanderOpts {
  /** Measured field width in px. */
  width: number;
  /** Figure scale, for converting unit speeds and gaps into px. */
  scale: number;
  /**
   * Ids currently greeting -- hovered, or still inside the greet linger. These hold still:
   * ev-figures.js gates its walker the same way (`if (!e.greet) av.x += ...`), so hovering
   * interrupts the walk rather than running a walk cycle on the spot.
   */
  greeting: ReadonlySet<string>;
  rand: Rand;
}

function span(min: number, max: number, rand: Rand): number {
  return min + (max - min) * rand();
}

export function initWander(
  seeds: Array<{ id: string; x: number; dir: 1 | -1 }>, rand: Rand,
): WanderState {
  const out: WanderState = {};
  for (const s of seeds) {
    out[s.id] = { x: s.x, dir: s.dir, phase: 'walk', t: 0, next: span(WALK_MIN, WALK_MAX, rand) };
  }
  return out;
}

export function wanderAdvance(state: WanderState, dt: number, opts: WanderOpts): WanderState {
  const { width, scale, greeting, rand } = opts;
  const margin = EDGE_MARGIN_UNITS * scale;
  const minGap = MIN_SEPARATION * scale;
  const speed = WANDER_UNITS_PER_SEC * scale;
  const ids = Object.keys(state);
  const out: WanderState = {};

  for (const id of ids) {
    const e = state[id];

    // Greeting: frozen where it stands, phase timer included. Resuming mid-leg afterwards is
    // deliberate -- it looks like being interrupted, not like restarting.
    if (greeting.has(id)) { out[id] = e; continue; }

    const t = e.t + dt;

    if (t >= e.next) {
      const phase: WanderPhase = e.phase === 'walk' ? 'pause' : 'walk';
      // A fresh direction is chosen on the way OUT of a pause, so the look-around beat is
      // what hides the turn.
      const dir: 1 | -1 = phase === 'walk' ? (rand() < 0.5 ? -1 : 1) : e.dir;
      const next = phase === 'walk'
        ? span(WALK_MIN, WALK_MAX, rand)
        : span(PAUSE_MIN, PAUSE_MAX, rand);
      out[id] = { ...e, phase, dir, t: 0, next };
      continue;
    }

    if (e.phase === 'pause') { out[id] = { ...e, t }; continue; }

    let x = e.x + e.dir * speed * dt;
    let dir = e.dir;

    // Turn at the bounds rather than stopping: a figure pinned against an invisible wall
    // looks broken, one that turns looks like it changed its mind.
    if (x < margin) { x = margin; dir = 1; }
    else if (x > width - margin) { x = width - margin; dir = -1; }

    // Hold position and turn rather than closing inside the minimum gap. Compared against
    // each other figure's already-committed position this frame where one exists, and its
    // previous position otherwise, so two figures walking at each other both turn together.
    for (const other of ids) {
      if (other === id) continue;
      const ox = (out[other] ?? state[other]).x;
      const closing = Math.abs(x - ox) < Math.abs(e.x - ox);
      if (Math.abs(x - ox) < minGap && closing) {
        x = e.x;
        dir = e.x < ox ? -1 : 1;
        break;
      }
    }

    out[id] = { ...e, x, dir, t };
  }

  return out;
}

/** Which rig animation a wanderer plays in its current phase. */
export function wanderAnim(e: Wanderer): string {
  return e.phase === 'walk' ? 'stroll' : 'standstill';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/bobbits/__tests__/wanderReducer.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/bobbits/wanderReducer.ts src/components/bobbits/__tests__/wanderReducer.test.ts
git commit -m "feat(bobits): a stroll-pause-look-around wander reducer"
```

---

### Task 4: Wire wander into `BobbitScene`

`figuresFor` is called at the top of `renderFrame` (`BobitField.tsx:228`), **before** hover is resolved for the frame (line 237). So the greeting set it can be handed is the previous frame's — one frame of latency, ~16ms, on stopping a hovered walker. That is imperceptible and is the honest available ordering; do not restructure the frame to chase it, because hover resolution needs positions and positions would then need hover.

`figuresFor` gains two appended optional positional parameters. Appending positionally (rather than switching to an options object) is deliberate: `CollectionCrowd`'s existing `(t, dt) => …` arrow stays assignable to the wider signature, so that file needs no edit and the Global Constraint holds.

**Files:**
- Modify: `frontend/src/components/bobbits/greetReducer.ts` (add `greetingIds`)
- Modify: `frontend/src/components/bobbits/BobitField.tsx:55` (signature), `:228-230` (call site)
- Modify: `frontend/src/components/bobbits/BobbitScene.tsx`
- Test: `frontend/src/components/bobbits/__tests__/greetReducer.test.ts` (extend)

**Interfaces:**
- Consumes: `initWander`, `wanderAdvance`, `wanderAnim`, `WanderState` (Task 3); `FieldFigure.hoverAnim` (Task 2).
- Produces:
  - `greetingIds(state: GreetState): ReadonlySet<string>`
  - `BobitFieldProps.figuresFor?: (t: number, dt: number, width: number, greeting: ReadonlySet<string>) => FieldFigure[]`

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/bobbits/__tests__/greetReducer.test.ts`:

```ts
import { greetingIds } from '../greetReducer';

describe('greetingIds', () => {
  it('is empty for empty state', () => {
    expect(greetingIds({}).size).toBe(0);
  });

  it('contains a hovered figure', () => {
    const s = greetReduce({}, 'a', 0.016);
    expect(greetingIds(s).has('a')).toBe(true);
  });

  it('still contains a figure inside its linger', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, null, 1.0);
    expect(greetingIds(s).has('a')).toBe(true);
  });

  it('drops a figure once its linger expires', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, null, GREET_LINGER + 0.01);
    expect(greetingIds(s).has('a')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/bobbits/__tests__/greetReducer.test.ts`
Expected: FAIL — `greetingIds` is not exported.

- [ ] **Step 3: Add `greetingIds`**

Append to `greetReducer.ts`:

```ts
/**
 * Everyone currently greeting, hovered or lingering. Handed to a field's `figuresFor` so a
 * choreography that owns positions (the wander) can hold a greeting figure still.
 */
export function greetingIds(state: GreetState): ReadonlySet<string> {
  return new Set(Object.keys(state));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/bobbits/__tests__/greetReducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Widen `figuresFor` and pass the extra arguments**

In `BobitField.tsx`, change the prop type on line 55:

```ts
  /**
   * Per-frame figure source, called once at the top of each frame. `width` is the field's
   * measured width; `greeting` is the PREVIOUS frame's greeting set, because hover is resolved
   * after this call (hover needs positions, and positions would then need hover). One frame of
   * latency, ~16ms.
   *
   * Extra parameters are appended positionally so a narrower `(t, dt) => …` callback stays
   * assignable -- CollectionCrowd relies on that.
   */
  figuresFor?: (
    t: number, dt: number, width: number, greeting: ReadonlySet<string>,
  ) => FieldFigure[];
```

Then update the call site (lines 228-230):

```ts
      const source = figuresForRef.current
        ? figuresForRef.current(t, dt, w, greetingIds(greetRef.current))
        : figuresRef.current;
```

`w` is already in scope from line 227. Add `greetingIds` to the existing `greetReducer` import.

- [ ] **Step 6: Rewrite `BobbitScene`**

Replace the body of `frontend/src/components/bobbits/BobbitScene.tsx`:

```tsx
import { useCallback, useRef } from 'react';
import { BobitField } from './BobitField';
import type { FieldFigure } from './fieldGeometry';
import { figColor } from './rigExtras';
import { initWander, wanderAdvance, wanderAnim } from './wanderReducer';
import type { WanderState } from './wanderReducer';
import { useConfettiStore } from '../../store/confettiStore';

interface BobbitSceneProps {
  darkMode: boolean;
  isMobile: boolean;
}

interface CastMember {
  tone: number;
  /** Where this one starts, as a fraction of the rail. It wanders from there. */
  x: number;
  phase: number;
}

// Two wandering the footer rail. Both dance when you reach for them, and both drop confetti.
const CAST: CastMember[] = [
  { tone: 2, x: 0.28, phase: 0.6 },
  { tone: 1, x: 0.68, phase: 1.8 },
];

const idFor = (i: number) => `scene-${i}`;

/**
 * A thin divider rail hosting a couple of Bobbits. Purely decorative -- sits in normal flow so
 * it never overlaps surrounding text or cards.
 *
 * They stroll, pause and look around until you reach for one, at which point it stops and
 * dances; clicking drops confetti. Positions come from wanderReducer, advanced inside the
 * field's own rAF loop via `figuresFor`, so React never sees a per-frame update.
 */
export function BobbitScene({ darkMode, isMobile }: BobbitSceneProps) {
  const fireTopRain = useConfettiStore(s => s.fireTopRain);

  // height/railBottom keep enough clearance above (raised arms) and below the rail -- both
  // scaled with `scale`, matching every other Bobbit instance.
  const scale = isMobile ? 0.22 : 0.28;
  const height = isMobile ? 71 : 93;
  const railBottom = isMobile ? 15 : 20;

  const wanderRef = useRef<WanderState | null>(null);

  const figuresFor = useCallback((
    _t: number, dt: number, width: number, greeting: ReadonlySet<string>,
  ): FieldFigure[] => {
    // The field reports width 0 until its ResizeObserver has measured. Seeding positions from
    // that would stack both figures on the left edge, so wait a frame.
    if (width <= 0) return [];

    if (!wanderRef.current) {
      wanderRef.current = initWander(
        CAST.map((c, i) => ({
          id: idFor(i), x: c.x * width, dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
        })),
        Math.random,
      );
    }

    wanderRef.current = wanderAdvance(wanderRef.current, dt, {
      width, scale, greeting, rand: Math.random,
    });

    const st = wanderRef.current;
    return CAST.map((c, i) => {
      const id = idFor(i);
      const e = st[id];
      return {
        id,
        anim: wanderAnim(e),
        hoverAnim: 'dance',
        color: figColor(c.tone, darkMode),
        x: e.x,
        groundY: height - railBottom,
        scale,
        phase: c.phase,
        flip: e.dir < 0,
      };
    });
  }, [darkMode, scale, height, railBottom]);

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: isMobile ? 16 : 24 }}>
      <BobitField
        figures={[]}
        figuresFor={figuresFor}
        height={height}
        interactive
        onFigureClick={() => fireTopRain()}
      />
    </div>
  );
}
```

Note what is gone: `useMemo` over `figures`, and `anim`/`clickable` on `CastMember`. `clickable` was never read — `onFigureClick` fires for any figure the ink test hits — so it goes rather than lingering as a lie.

- [ ] **Step 7: Verify the suite, typecheck, and see it move**

Run: `npx vitest run src/components/bobbits && npx tsc --noEmit`
Expected: PASS, no type errors.

Then run the app and watch the footer rail: two figures should stroll, stop, stand a moment, and set off again — sometimes reversing. Hovering one stops it and it dances; the cursor leaving lets it settle and walk on. Clicking drops confetti. Neither should ever reach the rail's edge or close up against the other.

- [ ] **Step 8: Commit**

```bash
git add src/components/bobbits/BobbitScene.tsx src/components/bobbits/BobitField.tsx src/components/bobbits/greetReducer.ts src/components/bobbits/__tests__/greetReducer.test.ts
git commit -m "feat(bobits): the footer pair wander and dance when you reach for them"
```

---

### Task 5: The carriers actually hold the trophy

Two faults compound. `trophyX` is the midpoint of the carriers' *ground-contact points* (`BobbitTrophyCarry.tsx:170`), not of their hands. And `ANIMATIONS.carry` is ev-landing's beam-crew pose — its arms hang close to the body (`armRU 16 / armRF 6`) because a beam wider than four figures sits *under* the hands. CTC's trophy is `50 * scale` wide against a `150 * scale` gap, so those hands have nothing to reach for.

The target is crisp and testable: **the two inner hands must sit ~50 rig units apart** — the pedestal's width — because the trophy rides their midpoint, so each hand then lands on a pedestal corner. With bodies 150 units apart that means each inner hand reaches ~50 units in from its own body centre: 45 units of horizontal travel against 82 of reach (`upperArm 42 + foreArm 40`), roughly 33° off vertical.

The exact angles are **not** derived here. `computePose` composes `armRU`/`armRF` in a way this plan does not model, and the bobit notes are explicit that geometry predictions here have been wrong three times running. Write the contact test first, start from the values below, and tune until it passes.

**Files:**
- Modify: `frontend/src/components/bobbits/rigExtras.ts` (add `carryGrip` to `EXTRA_ANIMATIONS`)
- Modify: `frontend/src/components/bobbits/BobbitTrophyCarry.tsx:16-17, 141-142, 170, 174-179`
- Test: `frontend/src/components/bobbits/__tests__/trophyGrip.test.ts` (create)

**Interfaces:**
- Consumes: `ANIMATIONS`, `CFG`, `computePose` from `leremyRig`.
- Produces: `EXTRA_ANIMATIONS.carryGrip` (an `Animation`), and `GRIP_HAND_SPAN_UNITS: number` exported from `rigExtras` so the test and the component agree on one number.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/bobbits/__tests__/trophyGrip.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CFG, computePose } from '../leremyRig';
import { ALL_ANIMATIONS, GRIP_HAND_SPAN_UNITS } from '../rigExtras';

/** Mirrors BobbitTrophyCarry: rear sits gap units left of lead, both on the same pose. */
const GAP_UNITS = 150;

/** Pedestal half-width in rig units: drawTrophy's 12.5 at TROPHY_SIZE_MULT = 2. */
const PEDESTAL_HALF = 25;

/**
 * Half a limb's thickness. The hand joint is the wrist centre, so a joint within this of the
 * pedestal corner is drawn touching it.
 */
const TOLERANCE = CFG.armW / 2 + 2;

function innerHands(t: number) {
  const j = computePose(ALL_ANIMATIONS.carryGrip.frame(t), CFG, { x: 0, y: 0 });
  // Rear carrier at x = 0 reaches right with its RIGHT hand; lead at x = GAP reaches left
  // with its LEFT hand. Same pose, mirrored roles -- exactly what the component draws.
  return { rear: 0 + j.hR.x, lead: GAP_UNITS + j.hL.x };
}

describe('carryGrip', () => {
  it('exists and is a gait, so the walk cycle still reads', () => {
    expect(ALL_ANIMATIONS.carryGrip).toBeDefined();
    expect(typeof ALL_ANIMATIONS.carryGrip.frame).toBe('function');
  });

  it('brings the two inner hands to the pedestal span', () => {
    const { rear, lead } = innerHands(0);
    expect(lead - rear).toBeCloseTo(GRIP_HAND_SPAN_UNITS, 0);
  });

  it('puts each inner hand on a pedestal corner, measured from their own midpoint', () => {
    const { rear, lead } = innerHands(0);
    const trophyX = (rear + lead) / 2;
    expect(Math.abs(Math.abs(rear - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(Math.abs(lead - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('keeps contact through the whole gait, not just the reference frame', () => {
    for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 2.0]) {
      const { rear, lead } = innerHands(t);
      const trophyX = (rear + lead) / 2;
      expect(Math.abs(Math.abs(rear - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
      expect(Math.abs(Math.abs(lead - trophyX) - PEDESTAL_HALF)).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('reaches inward, not outward — a regression guard on the sign', () => {
    const j = computePose(ALL_ANIMATIONS.carryGrip.frame(0), CFG, { x: 0, y: 0 });
    expect(j.hR.x).toBeGreaterThan(0);   // rear's right hand reaches toward the lead
    expect(j.hL.x).toBeLessThan(0);      // lead's left hand reaches toward the rear
  });

  it('does not reach further than the arm is long', () => {
    const j = computePose(ALL_ANIMATIONS.carryGrip.frame(0), CFG, { x: 0, y: 0 });
    const reach = CFG.upperArm + CFG.foreArm;
    expect(Math.abs(j.hR.x) - CFG.shoulderHalf).toBeLessThan(reach);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/bobbits/__tests__/trophyGrip.test.ts`
Expected: FAIL — `carryGrip` and `GRIP_HAND_SPAN_UNITS` do not exist.

- [ ] **Step 3: Add the grip pose**

In `rigExtras.ts`, export the span constant near the top (after `FIG_COLORS`):

```ts
/**
 * How far apart the two carriers' inner hands must sit, in rig units, for each to land on a
 * corner of the trophy's pedestal. drawTrophy's pedestal is 12.5 units either side of centre
 * and the prop draws at TROPHY_SIZE_MULT = 2, so the pedestal spans 50 units and the trophy
 * rides the hands' midpoint.
 */
export const GRIP_HAND_SPAN_UNITS = 50;
```

Then add to `EXTRA_ANIMATIONS`:

```ts
  // `carry` with the arms reaching in, so two carriers can actually hold the trophy between
  // them. `carry` itself is ev-figures.js's beam-crew pose: its arms hang close to the body
  // because a beam wider than four figures sits UNDER the hands. CTC's trophy is 50 units
  // wide against a 150-unit gap, so those hands had nothing to reach for and the logo floated.
  //
  // Symmetric on purpose. Each carrier's INNER arm is the one that meets the trophy -- rear
  // reaches right, lead reaches left -- and one symmetric pose serves both roles, the way
  // `carry` already did. The outer arms splay outward as a consequence; if that reads badly,
  // the alternative is a per-side variant driven by AnimVars.hand, as `greet` does.
  //
  // These two angles are TUNED AGAINST __tests__/trophyGrip.test.ts, not derived. Change them
  // only by re-running that test.
  carryGrip: {
    label: "Carrying (grip)", mood: "mind the trophy",
    frame(t: number) {
      const p = ANIMATIONS.carry.frame(t);
      p.armRU = 33; p.armRF = 41;
      p.armLU = -33; p.armLF = -41;
      return p;
    },
  },
```

Now run the test and **tune `armRU`/`armRF` (keeping the left mirrored) until the span and corner assertions pass.** Raising the magnitudes reaches further inward. The starting pair puts the hand near 33° off vertical, which the geometry says is about right, but `computePose`'s composition decides the truth.

- [ ] **Step 4: Run the test until it passes**

Run: `npx vitest run src/components/bobbits/__tests__/trophyGrip.test.ts`
Expected: PASS, after tuning. If no angle pair satisfies both the span and the reach guard, stop and report — that would mean the gap and pedestal width cannot be reconciled by arms alone, and the spec's fallback (closing `gap`) is needed instead.

- [ ] **Step 5: Use the grip pose and ride the hands horizontally**

In `BobbitTrophyCarry.tsx`:

1. Line 16 — recompute the reference joints from the new pose, and keep the name:

```ts
const CARRY_REF_JOINTS = computePose(ALL_ANIMATIONS.carryGrip.frame(0), CFG, { x: 0, y: 0 });
```

Import `ALL_ANIMATIONS` from `./rigExtras` (the file already imports `drawTrophy, figColor` from there). `CARRY_HAND_Y` on line 17 needs no change — it averages `hR.y` and `hL.y` and still does.

2. Lines 141-142 — walk with the grip:

```ts
        leadPose = ALL_ANIMATIONS.carryGrip.frame(gaitClock);
        rearPose = ALL_ANIMATIONS.carryGrip.frame(gaitClock + 0.16);
```

Leave every other phase alone: `heave`, `greet` and `standstill` are the set-down, wave and idle, where the trophy is on the ground and no grip is wanted.

3. Line 170 — the trophy's x comes from the inner hands, replacing the ground-point midpoint:

```ts
        // Trophy x rides the two INNER hands, the same joints its y already tracks -- rear's
        // right and lead's left. The old midpoint of the two ground-contact points is what
        // left the logo floating: it ignored where the hands actually were.
        const rearHandX = rearX + jRear.hR.x * scale;
        const leadHandX = leadX + jLead.hL.x * scale;
        const trophyX = (rearHandX + leadHandX) / 2;
```

`jRear` and `jLead` are already computed on lines 165-166, above this point. Lines 174-179 (the y track) need no change.

- [ ] **Step 6: Verify and look at it**

Run: `npx vitest run src/components/bobbits && npx tsc --noEmit`
Expected: PASS, no type errors.

Then watch the hero walk-in: both carriers' hands should stay on the pedestal's corners for the whole walk, with the trophy swaying on their bob rather than hanging still between them. The set-down, wave and pick-up phases should be unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/bobbits/rigExtras.ts src/components/bobbits/BobbitTrophyCarry.tsx src/components/bobbits/__tests__/trophyGrip.test.ts
git commit -m "fix(bobits): the carriers grip the trophy instead of flanking it"
```

---

### Task 6: The reader looks up on hover and speaks on click

Port ev-landing's `drawReader` machine (ev-figures.js:3502-3560) and its documented contract (ev-figures.js:3128-3134). Hover becomes acknowledgement; click becomes the payload.

The state machine is extracted as a pure module so it can be tested without a canvas — the component's current hover handling is entangled with refs and a rAF closure, and porting a five-state machine into that shape untested would be a mistake.

**Files:**
- Create: `frontend/src/components/bobbits/readerReducer.ts`
- Modify: `frontend/src/components/bobbits/BobbitCivicFactSitter.tsx`
- Test: `frontend/src/components/bobbits/__tests__/readerReducer.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `QUOTE_TRANS = 0.5`, `QUOTE_GLANCE = 0.35`
  - `type ReaderPhase = 'read' | 'lookup' | 'hold' | 'resume'`
  - `interface ReaderState { phase: ReaderPhase; t: number; glance: number }`
  - `READER_IDLE: ReaderState`
  - `type ReaderEvent = { type: 'tick'; dt: number; hovering: boolean } | { type: 'click' } | { type: 'dismiss' }`
  - `readerReduce(state: ReaderState, ev: ReaderEvent): ReaderState`
  - `bubbleOpen(state: ReaderState): boolean`
  - `showBook(state: ReaderState): boolean`

  Task 7 consumes `bubbleOpen`. Task 9 consumes nothing from here.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/bobbits/__tests__/readerReducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  readerReduce, bubbleOpen, showBook, READER_IDLE, QUOTE_TRANS, QUOTE_GLANCE,
} from '../readerReducer';
import type { ReaderState } from '../readerReducer';

const tick = (s: ReaderState, dt: number, hovering = false) =>
  readerReduce(s, { type: 'tick', dt, hovering });

describe('readerReduce — glance on hover', () => {
  it('starts reading with no glance', () => {
    expect(READER_IDLE.phase).toBe('read');
    expect(READER_IDLE.glance).toBe(0);
  });

  it('ramps the glance while hovered', () => {
    const s = tick(READER_IDLE, QUOTE_GLANCE / 2, true);
    expect(s.glance).toBeGreaterThan(0);
    expect(s.glance).toBeLessThan(1);
  });

  it('reaches a full glance and clamps there', () => {
    let s = tick(READER_IDLE, QUOTE_GLANCE, true);
    s = tick(s, QUOTE_GLANCE, true);
    expect(s.glance).toBe(1);
  });

  it('ramps back down when the cursor leaves', () => {
    let s = tick(READER_IDLE, QUOTE_GLANCE, true);
    s = tick(s, QUOTE_GLANCE / 2, false);
    expect(s.glance).toBeLessThan(1);
    expect(s.glance).toBeGreaterThan(0);
  });

  it('clamps the glance at zero', () => {
    let s = tick(READER_IDLE, QUOTE_GLANCE, true);
    s = tick(s, QUOTE_GLANCE * 4, false);
    expect(s.glance).toBe(0);
  });

  it('never opens a bubble from hover alone', () => {
    let s = tick(READER_IDLE, QUOTE_GLANCE, true);
    s = tick(s, QUOTE_GLANCE, true);
    expect(bubbleOpen(s)).toBe(false);
  });

  it('keeps the book in hand while glancing', () => {
    const s = tick(READER_IDLE, QUOTE_GLANCE, true);
    expect(showBook(s)).toBe(true);
  });
});

describe('readerReduce — click to speak', () => {
  it('a click starts the look-up', () => {
    const s = readerReduce(READER_IDLE, { type: 'click' });
    expect(s.phase).toBe('lookup');
    expect(s.t).toBe(0);
  });

  it('the look-up settles into hold after the transition', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    expect(s.phase).toBe('hold');
  });

  it('the bubble opens only once held', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    expect(bubbleOpen(s)).toBe(false);
    s = tick(s, QUOTE_TRANS + 0.01);
    expect(bubbleOpen(s)).toBe(true);
  });

  it('the book goes into the lap once held', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    expect(showBook(s)).toBe(false);
  });

  it('a second click resumes reading', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    s = readerReduce(s, { type: 'click' });
    expect(s.phase).toBe('resume');
    expect(bubbleOpen(s)).toBe(false);
  });

  it('resume lands back in read', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    s = readerReduce(s, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    expect(s.phase).toBe('read');
    expect(s.glance).toBe(0);
  });

  it('ignores clicks mid-transition, as ev-figures.js does', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    const mid = tick(s, QUOTE_TRANS / 2);
    s = readerReduce(mid, { type: 'click' });
    expect(s).toEqual(mid);
  });
});

describe('readerReduce — dismissal', () => {
  it('dismiss from hold resumes reading', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    s = readerReduce(s, { type: 'dismiss' });
    expect(s.phase).toBe('resume');
  });

  it('dismiss while already reading changes nothing', () => {
    const s = readerReduce(READER_IDLE, { type: 'dismiss' });
    expect(s).toEqual(READER_IDLE);
  });
});

describe('readerReduce — purity', () => {
  it('does not mutate the state it is given', () => {
    const s0 = tick(READER_IDLE, QUOTE_GLANCE / 2, true);
    const before = s0.glance;
    tick(s0, QUOTE_GLANCE / 2, true);
    expect(s0.glance).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/bobbits/__tests__/readerReducer.test.ts`
Expected: FAIL — cannot resolve `../readerReducer`.

- [ ] **Step 3: Write the reducer**

Create `frontend/src/components/bobbits/readerReducer.ts`:

```ts
/**
 * The seated reader's interaction machine, ported from ev-figures.js's drawReader
 * (ev-figures.js:3502-3560) and the contract documented above it (3128-3134):
 *
 *   hover  -> he lifts his head off the page but keeps hold of the book
 *   click  -> he sits up, lowers the book into his lap, and a bubble opens with his quote
 *   click  -> back to the book
 *
 * read --click--> lookup --(QUOTE_TRANS)--> hold --click--> resume --(QUOTE_TRANS)--> read
 *
 * Hover only ever drives `glance`, a 0-1 ramp within `read`. That separation is the point of
 * the rework: hovering acknowledges you, clicking is what makes him speak.
 */

/** Seconds to cross between reading and holding, either direction. */
export const QUOTE_TRANS = 0.5;

/** Seconds for the hover glance to ramp fully in or out. */
export const QUOTE_GLANCE = 0.35;

export type ReaderPhase = 'read' | 'lookup' | 'hold' | 'resume';

export interface ReaderState {
  phase: ReaderPhase;
  /** Seconds spent in the current phase. */
  t: number;
  /** 0-1 hover glance, only meaningful during `read`. */
  glance: number;
}

export const READER_IDLE: ReaderState = { phase: 'read', t: 0, glance: 0 };

export type ReaderEvent =
  | { type: 'tick'; dt: number; hovering: boolean }
  | { type: 'click' }
  | { type: 'dismiss' };

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function readerReduce(state: ReaderState, ev: ReaderEvent): ReaderState {
  if (ev.type === 'click') {
    // Only the settled states take a click. A click mid-transition is dropped rather than
    // queued -- ev-figures.js returns early for exactly this, and reversing halfway through
    // the lerp looks like a glitch.
    if (state.phase === 'read') return { phase: 'lookup', t: 0, glance: state.glance };
    if (state.phase === 'hold') return { phase: 'resume', t: 0, glance: 0 };
    return state;
  }

  if (ev.type === 'dismiss') {
    if (state.phase === 'hold') return { phase: 'resume', t: 0, glance: 0 };
    return state;
  }

  const { dt, hovering } = ev;
  const t = state.t + dt;

  switch (state.phase) {
    case 'read': {
      const step = dt / QUOTE_GLANCE;
      return { phase: 'read', t, glance: clamp01(state.glance + (hovering ? step : -step)) };
    }
    case 'lookup':
      return t >= QUOTE_TRANS
        ? { phase: 'hold', t: 0, glance: 0 }
        : { ...state, t };
    case 'hold':
      return { ...state, t };
    case 'resume':
      return t >= QUOTE_TRANS
        ? { phase: 'read', t: 0, glance: 0 }
        : { ...state, t };
  }
}

/** The bubble is open exactly while he is sitting up holding the book in his lap. */
export function bubbleOpen(state: ReaderState): boolean {
  return state.phase === 'hold';
}

/**
 * Whether the book is still in his hands. It drops into the lap once the look-up is more than
 * half done, matching the old component's `hoverAmount < 0.5` handoff.
 */
export function showBook(state: ReaderState): boolean {
  if (state.phase === 'read') return true;
  if (state.phase === 'lookup') return state.t < QUOTE_TRANS / 2;
  if (state.phase === 'resume') return state.t >= QUOTE_TRANS / 2;
  return false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/bobbits/__tests__/readerReducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the two poses**

In `BobbitCivicFactSitter.tsx`, add these above the component, ported from ev-figures.js:3137-3161. They are local to this file: they are one scene's choreography, not rig vocabulary, which is why they do not go in `rigExtras`.

```tsx
/** Hover: the same reading hold, head raised off the page. Ported from ev-figures.js. */
function quoteGlance(t: number): Pose {
  const p = ANIMATIONS.read.frame(t);
  const br = Math.sin(t * 0.28 * Math.PI * 2);
  p.hunch = -(14 + br * 2);              // partly uncurled, still leaning in
  p.headTilt = 6 + Math.sin(t * 0.4 * Math.PI * 2) * 3;
  return p;
}

/**
 * Settled: sat up, book down in the lap, looking up and out. Ported from ev-figures.js.
 * 0deg points straight DOWN and 90 is horizontal, so the upper arms hang low and the forearms
 * come forward, putting the hands over the thighs -- the book draws at the hand midpoint,
 * which is what drops it into the lap.
 */
function quoteHold(t: number): Pose {
  const p = { ...REST };
  const br = Math.sin(t * 0.26 * Math.PI * 2);
  p.lean = 2;
  p.hunch = -(4 + br * 2);
  p.bob = br * 1.2;
  p.headTilt = 9 + Math.sin(t * 0.32 * Math.PI * 2) * 3;
  p.armRU = 30 + br;  p.armRF = 88 + br * 3;
  p.armLU = 22 - br;  p.armLF = 80 + br * 2;
  p.legRU = 78; p.legRF = 11;
  p.legLU = 70; p.legLF = 5;
  return p;
}
```

Add `REST` to the existing `leremyRig` import.

- [ ] **Step 6: Drive the component from the reducer**

Rework `BobbitCivicFactSitter.tsx`:

1. Replace the hover refs (`hoverTargetRef`, `hoverAmountRef`, `hoverStartAtRef`) with one `stateRef = useRef<ReaderState>(READER_IDLE)` and a `hoveringRef = useRef(false)`. Keep a `const [bubbleShown, setBubbleShown] = useState(false)` for the DOM bubble, updated from the loop only when `bubbleOpen(state)` changes — React must not see a per-frame update.

2. Replace `poseFor` with a selector over the phase:

```tsx
    function poseFor(state: ReaderState, t: number): Pose {
      const read = ANIMATIONS.read.frame(t);
      switch (state.phase) {
        case 'read':
          return state.glance > 0 ? lerpPose(read, quoteGlance(t), smooth01(state.glance)) : read;
        case 'lookup':
          return lerpPose(read, quoteHold(t), smooth01(state.t / QUOTE_TRANS));
        case 'hold':
          return quoteHold(t);
        case 'resume':
          return lerpPose(quoteHold(t), read, smooth01(state.t / QUOTE_TRANS));
      }
    }
```

`lerpPose` and `smooth01` are **not** in the rig — verified, `leremyRig.ts` exports neither. Define them at module scope in this file, replacing the `blend` helper currently nested inside the `useEffect` (lines 86-88) and the `Object.keys` blend loop it feeds (lines 98-102):

```tsx
/** ev-figures.js's easing: flat at both ends, so a glance starts and settles softly. */
function smooth01(u: number): number {
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  return c * c * (3 - 2 * c);
}

/** Blends every field of two poses. Pose is a flat record of numbers, so this is total. */
function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...a };
  (Object.keys(out) as (keyof Pose)[]).forEach((k) => {
    out[k] = a[k] + (b[k] - a[k]) * t;
  });
  return out;
}
```

Hoisting them out of the effect is what lets `poseFor` be a plain function of state rather than a closure over refs.

3. In `tick`, replace the `hoverAmountRef` easing with:

```tsx
      stateRef.current = readerReduce(stateRef.current, {
        type: 'tick', dt, hovering: hoveringRef.current,
      });
```

4. `render` takes the state, uses `poseFor(state, t)` and `card: showBook(state)`.

5. Handlers:

```tsx
    const onEnter = () => { hoveringRef.current = true; };
    const onLeave = () => { hoveringRef.current = false; };
    const onActivate = () => {
      stateRef.current = readerReduce(stateRef.current, { type: 'click' });
    };
```

Wire `onMouseEnter`/`onMouseLeave` on the wrapper to `onEnter`/`onLeave`, and `onClick` on the canvas to `onActivate`.

6. **Keyboard parity.** Moving the payload to click breaks the keyboard path, since focus alone no longer reveals anything. On the canvas: `onFocus={onEnter}`, `onBlur={onLeave}`, and

```tsx
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
          else if (e.key === 'Escape') {
            stateRef.current = readerReduce(stateRef.current, { type: 'dismiss' });
          }
        }}
```

7. **Dismissal.** A document-level listener while the bubble is open, cleaned up on close and unmount: `Escape` and any click outside the wrapper both send `{ type: 'dismiss' }`.

8. **Reword the `aria-label`.** It currently claims hovering reveals a fact:

```tsx
        aria-label="A Bobbit sitting on the divider, reading — activate to hear a civic fact"
```

9. **Reduced motion.** The existing `if (!animate)` branch renders one frame and returns. Keep that, but render `poseFor(stateRef.current, 0)` so an activated reader still shows the settled hold rather than being stuck reading. The bubble is DOM and unaffected.

- [ ] **Step 7: Verify**

Run: `npx vitest run src/components/bobbits && npx tsc --noEmit`
Expected: PASS, no type errors.

Then on the landing page's collections search box: hovering the reader lifts its head with the book still in hand and **no** bubble; clicking sits it up, drops the book to its lap and opens the quote; clicking again returns it to reading. Escape and a click elsewhere both close it. Tab to it and press Enter for the same result.

- [ ] **Step 8: Commit**

```bash
git add src/components/bobbits/readerReducer.ts src/components/bobbits/BobbitCivicFactSitter.tsx src/components/bobbits/__tests__/readerReducer.test.ts
git commit -m "feat(bobits): the reader looks up on hover and speaks on click"
```

---

### Task 7: One quote per session

ev-landing's `deal()` shuffles its pool once per page load and gives each reader one distinct quote (ev-quotes.js:204-208). Match it: pick at module scope, so the fact survives a React remount within the session and changes only on refresh.

**Files:**
- Modify: `frontend/src/components/bobbits/BobbitCivicFactSitter.tsx`
- Test: `frontend/src/components/bobbits/__tests__/sessionFact.test.ts` (create)

**Interfaces:**
- Consumes: `bubbleOpen` (Task 6), already wired.
- Produces: `CIVIC_FACTS: readonly string[]` and `sessionFact(): string`, both exported from `BobbitCivicFactSitter.tsx` so the test can reach them.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/bobbits/__tests__/sessionFact.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CIVIC_FACTS, sessionFact } from '../BobbitCivicFactSitter';

describe('sessionFact', () => {
  it('returns one of the pool', () => {
    expect(CIVIC_FACTS).toContain(sessionFact());
  });

  it('returns the same fact on every call within a session', () => {
    const first = sessionFact();
    for (let i = 0; i < 50; i++) expect(sessionFact()).toBe(first);
  });

  it('has a pool worth shuffling', () => {
    expect(CIVIC_FACTS.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/bobbits/__tests__/sessionFact.test.ts`
Expected: FAIL — `CIVIC_FACTS` and `sessionFact` are not exported.

- [ ] **Step 3: Pick once, at module scope**

In `BobbitCivicFactSitter.tsx`, export the pool (`export const CIVIC_FACTS = [ … ] as const;` — it is currently a bare `const`) and add below it:

```tsx
/**
 * One fact for the whole session, chosen at module load. ev-landing deals its quote pool once
 * per page load (ev-quotes.js:204-208) and a reader keeps his line for the visit; a fact that
 * changed on every hover made the reader feel like a slot machine rather than someone with
 * something to say. New fact on refresh, not on re-hover.
 */
const SESSION_FACT = CIVIC_FACTS[Math.floor(Math.random() * CIVIC_FACTS.length)];

export function sessionFact(): string {
  return SESSION_FACT;
}
```

- [ ] **Step 4: Use it and delete the rotation**

In the component:
- Delete the `factIndex` state (line 56) and every `CIVIC_FACTS[factIndex]` reference, using `sessionFact()` instead — both the bubble body and the `sr-only` span.
- Delete the `setFactIndex` block inside the old `setHover(false)` path (lines 151-155). That call **is** the per-hover rotation.
- The comment on lines 54-55 explains that the fact must be committed before the reveal so a screen reader reads the right one on focus. That constraint is now satisfied structurally — there is no mid-interaction mutation left to race — so replace it with a line saying so rather than deleting the reasoning outright.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/components/bobbits && npx tsc --noEmit`
Expected: PASS, no type errors.

Then: hover and click the reader several times — the same fact every time. Reload the page a few times to see it change.

- [ ] **Step 6: Commit**

```bash
git add src/components/bobbits/BobbitCivicFactSitter.tsx src/components/bobbits/__tests__/sessionFact.test.ts
git commit -m "feat(bobits): the reader keeps one quote for the session"
```

---

### Task 8: On touch, a tap is hover and click at once

`onClick` is a `MouseEvent` handler and browsers synthesise a click after `touchend`, so **click already works on touch**. Hover does not: `pointerRef` is only ever written by `onMove` (mousemove), which touch never fires. That asymmetry is the whole gap — a tapped dancer gets its confetti but never dances.

A tap can be shorter than a frame, so the tap point must be held long enough for at least one `renderFrame` to resolve hover from it. `TAP_HOVER_MS` sits below `TOUCH_ARM_MS` (300) so a tap that becomes a poof hold is unaffected; hover is suppressed anyway while the poof phase is not `idle`.

**Files:**
- Modify: `frontend/src/components/bobbits/pointerGestures.ts` (add `TAP_HOVER_MS`)
- Modify: `frontend/src/components/bobbits/BobitField.tsx` (touch handlers)
- Modify: `frontend/src/components/bobbits/BobbitCivicFactSitter.tsx` (its own canvas)
- Test: `frontend/src/components/bobbits/__tests__/pointerGestures.test.ts` (extend)

**Interfaces:**
- Consumes: `greetingIds` (Task 4) indirectly; `readerReduce` (Task 6).
- Produces: `TAP_HOVER_MS: number`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/bobbits/__tests__/pointerGestures.test.ts`:

```ts
import { TAP_HOVER_MS, TOUCH_ARM_MS } from '../pointerGestures';

describe('TAP_HOVER_MS', () => {
  it('outlasts a frame at 60fps, so hover resolves at least once from a tap', () => {
    expect(TAP_HOVER_MS).toBeGreaterThan(1000 / 60);
  });

  it('expires before the poof hold arms, so a tap and a hold stay distinct', () => {
    expect(TAP_HOVER_MS).toBeLessThan(TOUCH_ARM_MS);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/bobbits/__tests__/pointerGestures.test.ts`
Expected: FAIL — `TAP_HOVER_MS` is not exported.

- [ ] **Step 3: Add the constant**

In `pointerGestures.ts`, below `TOUCH_ARM_MS`:

```ts
/**
 * How long a tap keeps acting as a hover. Touch fires no mousemove, so without this a tapped
 * Bobit gets its click and never its greet. Must outlast a frame (so hover resolves at least
 * once) and expire before TOUCH_ARM_MS (so a tap and a hold-to-poof stay distinct).
 */
export const TAP_HOVER_MS = 180;
```

- [ ] **Step 4: Publish the tap as a pointer position**

In `BobitField.tsx`:

1. Add a ref beside the others: `const tapHoverUntilRef = useRef(0);`

2. In `onTouchStart`, after `const p = local(...)`, publish the point and arm the window:

```ts
      // Touch fires no mousemove, so publish the tap as a pointer position: this is what
      // makes a tap read as hover AND click, per the landing page's touch model.
      pointerRef.current = p;
      tapHoverUntilRef.current = performance.now() + TAP_HOVER_MS;
```

3. In `onTouchMove`, keep it following the finger while it is still a tap, and cancel the hover once it has become a drag or a hold:

```ts
      if (performance.now() < tapHoverUntilRef.current) pointerRef.current = p;
```

4. In `onTouchEnd`, do **not** null `pointerRef` immediately — a fast tap would then never be seen. Let the window expire instead. Add to the top of `renderFrame`, before hover is resolved:

```ts
      // A tap's hover expires on its own, so the greet linger drains and the figure settles.
      if (tapHoverUntilRef.current && performance.now() >= tapHoverUntilRef.current) {
        pointerRef.current = null;
        tapHoverUntilRef.current = 0;
      }
```

5. Import `TAP_HOVER_MS` from `./pointerGestures`.

`onLeave` already nulls `pointerRef`; also clear `tapHoverUntilRef.current = 0` there so a mouse leaving cannot be overridden by a stale tap window.

- [ ] **Step 5: Give the reader the same rule**

In `BobbitCivicFactSitter.tsx`, add to the wrapper div:

```tsx
      onTouchStart={() => {
        // Tap = hover + click together: he looks up and speaks in one gesture.
        hoveringRef.current = true;
        stateRef.current = readerReduce(stateRef.current, { type: 'click' });
      }}
```

The glance ramps while the look-up plays, which is harmless — both move the head the same way. Leave the synthesised `onClick` in place: it is what desktop uses, and a double-fire is prevented because `readerReduce` ignores a click mid-transition (Task 6, verified by test).

- [ ] **Step 6: Verify**

Run: `npx vitest run src/components/bobbits && npx tsc --noEmit`
Expected: PASS, no type errors.

Then in a browser's device-emulation mode (or a real phone): tapping a footer wanderer makes it dance **and** drops confetti; tapping the card greeter makes it wave; tapping the reader looks up and opens the quote in one gesture. A 3-second press on a wanderer still starts the poof smoke.

- [ ] **Step 7: Commit**

```bash
git add src/components/bobbits/pointerGestures.ts src/components/bobbits/BobitField.tsx src/components/bobbits/BobbitCivicFactSitter.tsx src/components/bobbits/__tests__/pointerGestures.test.ts
git commit -m "feat(bobits): a tap is hover and click at once on touch"
```

---

### Task 9: The reader on mobile

**This is the deferrable task.** The other eight do not depend on it. If it grows past its steps, stop and report rather than reshaping the search box around a decoration.

`BobbitCivicFactSitter` returns `null` below 640px, deliberately — "hover has no equivalent there." Task 8 removes that reason. But its position is desktop-tuned: `right: 340` inside the search-box container, which is roughly 330px wide on a 375px viewport, so it would land off the left edge. Its bubble is `width: 200` centred via `translate(-50%, …)`, which overflows near a narrow edge.

**Files:**
- Modify: `frontend/src/components/bobbits/BobbitCivicFactSitter.tsx`

**Interfaces:**
- Consumes: everything from Tasks 6-8.
- Produces: nothing.

- [ ] **Step 1: Render on mobile at a mobile anchor**

Delete `if (isMobile) return null;` (line 160). Keep `isMobile` — it now selects position instead of visibility:

```tsx
  // Desktop clears the search input's text; mobile perches on the top-right corner, where the
  // only thing behind it is the input's trailing whitespace (the search icon is on the left).
  const rightOffset = isMobile ? 16 : 340;
```

Use `rightOffset` in the wrapper's `right`.

- [ ] **Step 2: Make the bubble edge-aware**

Centring a 200px bubble on a sitter 16px from the right edge pushes half of it off-screen. Anchor it to the same edge on mobile so it opens inward:

```tsx
          ...(isMobile
            ? { right: 0, transform: `translateY(${bubbleShown ? '0' : '4px'})` }
            : { left: '50%', transform: `translate(-50%, ${bubbleShown ? '0' : '4px'})` }),
          width: isMobile ? 240 : 200,
          maxWidth: isMobile ? 'calc(100vw - 48px)' : '60vw',
```

Replace the existing `left`/`transform`/`width`/`maxWidth` on the bubble with this. `calc(100vw - 48px)` accounts for the collections section's `0 24px` padding.

- [ ] **Step 3: Check the seat still clears the head**

`seatFromTop = 46` is a desktop-tuned clearance, and the file's sibling component carries a warning that undershooting it clips the head — a confirmed past regression. The sitter draws at `scale = 0.3` regardless of viewport, so the clearance is unchanged and needs no adjustment. Confirm visually rather than assuming: the head and the raised arm must not be cut off at the top of the canvas on a narrow viewport.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/components/bobbits && npx tsc --noEmit`
Expected: PASS, no type errors.

Then at 375px width: the reader sits on the search box's top-right corner, fully visible, not overlapping the search icon or clipping its own head. Tapping it opens the quote, and the bubble stays entirely on screen. Check 320px too — the narrowest phone worth supporting.

- [ ] **Step 5: Commit**

```bash
git add src/components/bobbits/BobbitCivicFactSitter.tsx
git commit -m "feat(bobits): the reader comes to mobile, anchored to the search box corner"
```

---

## Final verification

- [ ] **Full suite**

Run from `frontend/`: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Smoke test**

Run from `frontend/`: `npm run smoke`
Expected: PASS. A green build is not a page load — this is the standing rule after a Vite 8 bump built cleanly and served a blank white page.

- [ ] **Walk the landing page once, in both themes**

Nothing waves or dances until you reach for it. The footer pair stroll, pause and look around, dance under the cursor, and drop confetti when clicked. The hero carriers hold the logo by its pedestal for the whole walk-in. The reader lifts its head on hover and speaks only when clicked, with the same fact all session. Everything above works from a tap on a phone.

- [ ] **Confirm the constraint held**

Run: `git diff --stat master -- src/features/collection/`
Expected: empty. `CollectionCrowd` was to be untouched.

# Bobit Living Floor Implementation Plan (1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crowd's fixed slots with wandering agents that react to the match and wave when clicked, so earned bobits read as a room rather than tally marks.

**Architecture:** A new `crowdAgents.ts` holds per-bobit position, depth and activity, delegating the walk cycle to the existing `wanderReducer`. Below a measured cast size everyone wanders; above it the surplus stands at stable home slots computed the way they are today. `crowdFigures.ts` stays a pure translator from state to `FieldFigure[]`, and `BobitField`'s existing `figuresFor` hook keeps React out of the per-frame path.

**Tech Stack:** TypeScript, React 19, Vitest (node environment — no DOM), canvas 2D via the ported Leremy rig. Playwright + chromium for rendered verification.

**Spec:** `docs/superpowers/specs/2026-09-12-bobit-living-room-design.md`

**Plan 1 of 3.** Plan 2 is the scene director and entrances (swirl, cannon, pool, dev replay route). Plan 3 is the tree, perching and the 25% milestone. Both build on interfaces defined here.

## Global Constraints

- **Bobits must never cover the question card or any answer option.** The band stays in normal document flow, never an overlay. (Chris, 2026-09-05.)
- **`CROWD_CAP = 100`**, unchanged. It is a measured number, not a guess.
- **`poofable: false` on every crowd figure.** A poof means "you got this wrong", never a player action.
- **Never edit `leremyRig.ts`.** It is a faithful mirror of ev-landing's `leremy-rig.js` and must stay a clean overwrite on re-sync. All additions go in `rigExtras.ts`.
- **`slotOrder` sorts by id, not grant time.** Do not change this — grant time reshuffles everyone whenever a bobit is lost and re-earned.
- **No bobit ever teleports.** Every position change is walked.
- **Tests are node-environment and pure.** No DOM, no canvas, seeded RNG. Vitest `include: ['src/**/*.test.ts']`.
- Run tests from `frontend/`: `npm test`. Typecheck: `npm run typecheck`.

---

## File Structure

**Create:**
- `frontend/src/features/collection/crowdAgents.ts` — agent state: position, depth, activity, cast membership, walked transitions, rotation.
- `frontend/src/features/collection/crowdReactions.ts` — pure pose selection for the celebration chain and the costless-miss ripple, plus high-five pairing.
- `frontend/src/features/collection/__tests__/crowdAgents.test.ts`
- `frontend/src/features/collection/__tests__/crowdReactions.test.ts`
- `frontend/scripts/bobit-bench.mjs` — the measurement harness for `WANDER_CAST`.
- `frontend/scripts/bobit-shots.mjs` — Playwright screenshot sweep.

**Modify:**
- `frontend/src/features/collection/crowdLayout.ts` — add `bandFor`, `stageBounds`, `agentPlacement`, `WANDER_CAST`.
- `frontend/src/features/collection/crowdReducer.ts` — add the `ripple` field; extend `CELEBRATE_DUR`.
- `frontend/src/features/collection/crowdFigures.ts` — translate agents instead of slots.
- `frontend/src/features/collection/CollectionCrowd.tsx` — band from `bandFor`, drive agents, enable interaction.
- `frontend/src/components/bobbits/rigExtras.ts` — add `clap` and `highfive`.
- Existing tests: `crowdLayout.test.ts`, `crowdReducer.test.ts`, `crowdFigures.test.ts`, `rigExtras.test.ts`.

---

### Task 1: Band geometry

**Files:**
- Modify: `frontend/src/features/collection/crowdLayout.ts`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx:58-63`
- Test: `frontend/src/features/collection/__tests__/crowdLayout.test.ts`

**Interfaces:**
- Consumes: `CrowdBand` (already exported from `crowdLayout.ts`).
- Produces: `bandFor(isMobile: boolean): CrowdBand` — the single source of the band's height and figure scale.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/collection/__tests__/crowdLayout.test.ts`:

```ts
import { bandFor } from '../crowdLayout';

describe('bandFor', () => {
  it('gives desktop a 190px band at the held 0.2 scale', () => {
    const b = bandFor(false);
    expect(b.height).toBe(190);
    expect(b.scale).toBeCloseTo(0.2, 5);
  });

  it('gives mobile a 100px band at the enlarged 0.20 scale', () => {
    const b = bandFor(true);
    expect(b.height).toBe(100);
    expect(b.scale).toBeCloseTo(0.2, 5);
  });

  it('keeps the nominal 1000px width both ways -- figures are placed proportionally', () => {
    expect(bandFor(false).width).toBe(1000);
    expect(bandFor(true).width).toBe(1000);
  });

  it('is deep enough for four bobit-heights on desktop', () => {
    // A standing figure is 195 rig units tall.
    const b = bandFor(false);
    expect(b.height / (195 * b.scale)).toBeGreaterThan(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdLayout.test.ts`
Expected: FAIL — `bandFor` is not exported by `../crowdLayout`.

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/features/collection/crowdLayout.ts`:

```ts
/**
 * The band's height and figure scale.
 *
 * Desktop spends its extra height on DEPTH (scale held at 0.2) because there is width to
 * spare and the room needs floor. Mobile spends it on SIZE (0.13 -> 0.20) because at 25px
 * tall a wave is a few pixels and nothing reads.
 *
 * Provisional until screenshotted at a 768px-tall viewport -- see the measurement task. The
 * band is flex-shrink-0 above a flex-1 question area, so every pixel here comes out of the
 * question card's allowance.
 */
export function bandFor(isMobile: boolean): CrowdBand {
  return {
    width: 1000,                      // nominal; figures are placed proportionally
    height: isMobile ? 100 : 190,
    scale: isMobile ? 0.2 : 0.2,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdLayout.test.ts`
Expected: PASS

- [ ] **Step 5: Use it in the component**

In `frontend/src/features/collection/CollectionCrowd.tsx`, replace the `height` constant and the `band` memo (currently lines 58-63) with:

```tsx
  const band: CrowdBand = useMemo(() => bandFor(isMobile), [isMobile]);
  const height = band.height;
```

Add `bandFor` to the existing import from `./crowdLayout`.

- [ ] **Step 6: Verify the app still builds**

Run: `cd frontend && npm run typecheck && npm test`
Expected: typecheck clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/collection/crowdLayout.ts frontend/src/features/collection/CollectionCrowd.tsx frontend/src/features/collection/__tests__/crowdLayout.test.ts
git commit -m "feat(bobits): give the crowd band room to walk in"
```

---

### Task 2: Stage placement — depth to ground line and scale

**Files:**
- Modify: `frontend/src/features/collection/crowdLayout.ts`
- Test: `frontend/src/features/collection/__tests__/crowdLayout.test.ts`

**Interfaces:**
- Consumes: `CrowdBand`, `bandFor` (Task 1).
- Produces:
  - `stageBounds(band: CrowdBand): { top: number; bottom: number }` — the vertical span agents wander in.
  - `agentPlacement(depth: number, band: CrowdBand): { groundY: number; scale: number }`.
  - `WANDER_CAST: number` — how many wander at once.

- [ ] **Step 1: Write the failing test**

Append to `crowdLayout.test.ts`:

```ts
import { stageBounds, agentPlacement, WANDER_CAST } from '../crowdLayout';

describe('stageBounds', () => {
  it('gives the stage the lower 60% of the band', () => {
    const b = bandFor(false);
    const s = stageBounds(b);
    expect(s.bottom).toBe(b.height);
    expect(s.top).toBeCloseTo(b.height * 0.4, 5);
  });
});

describe('agentPlacement', () => {
  it('puts depth 0 at the front of the stage and depth 1 at the back', () => {
    const b = bandFor(false);
    const front = agentPlacement(0, b);
    const back = agentPlacement(1, b);
    expect(front.groundY).toBeCloseTo(stageBounds(b).bottom, 5);
    expect(back.groundY).toBeCloseTo(stageBounds(b).top, 5);
    expect(back.groundY).toBeLessThan(front.groundY);   // further back sits higher
  });

  it('scales nearer figures up and further ones down, by +/-8%', () => {
    const b = bandFor(false);
    expect(agentPlacement(0, b).scale).toBeCloseTo(b.scale * 1.08, 5);
    expect(agentPlacement(1, b).scale).toBeCloseTo(b.scale * 0.92, 5);
    expect(agentPlacement(0.5, b).scale).toBeCloseTo(b.scale, 5);
  });

  it('clamps depth rather than trusting its caller', () => {
    const b = bandFor(false);
    expect(agentPlacement(-1, b).groundY).toBeCloseTo(agentPlacement(0, b).groundY, 5);
    expect(agentPlacement(2, b).groundY).toBeCloseTo(agentPlacement(1, b).groundY, 5);
  });
});

describe('WANDER_CAST', () => {
  it('is small enough to keep the O(N^2) separation check cheap', () => {
    // wanderAdvance compares every pair each frame. 100 would be 10,000 checks a frame.
    expect(WANDER_CAST * WANDER_CAST).toBeLessThan(2000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdLayout.test.ts`
Expected: FAIL — `stageBounds` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `crowdLayout.ts`:

```ts
/**
 * How many bobits wander at once. The rest stand at their home slots.
 *
 * PROVISIONAL -- 24 is a starting point, not a measurement. `wanderAdvance` is O(N^2) over the
 * cast, so 24 is 576 pairwise checks a frame where the full 100-figure room would be 10,000.
 * Task 12 measures the real ceiling; the Stage 2 memory is blunt that four confident
 * predictions about this rig were all wrong.
 */
export const WANDER_CAST = 24;

/** The vertical span wandering agents occupy: the lower 60% of the band. */
export function stageBounds(band: CrowdBand) {
  return { top: band.height * 0.4, bottom: band.height };
}

/**
 * Where a wandering agent stands, from its depth.
 *
 * Depth exists because free wandering without it puts every agent on one horizontal line,
 * which reads as a conga queue rather than a crowd. The +/-8% scale swing is what sells it as
 * distance rather than as figures at different heights.
 */
export function agentPlacement(depth: number, band: CrowdBand) {
  const d = Math.min(1, Math.max(0, depth));
  const { top, bottom } = stageBounds(band);
  return {
    groundY: bottom - d * (bottom - top),
    scale: band.scale * (1.08 - 0.16 * d),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdLayout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdLayout.ts frontend/src/features/collection/__tests__/crowdLayout.test.ts
git commit -m "feat(bobits): place wandering agents in depth on the stage"
```

---

### Task 3: `crowdAgents.ts` — state and advance

**Files:**
- Create: `frontend/src/features/collection/crowdAgents.ts`
- Create: `frontend/src/features/collection/__tests__/crowdAgents.test.ts`

**Interfaces:**
- Consumes: `Wanderer`, `WanderState`, `wanderAdvance`, `initWander`, `Rand` from `../../components/bobbits/wanderReducer`; `CrowdBand`, `agentPlacement` from `./crowdLayout`.
- Produces:
  - `type Activity = 'wander' | 'rank' | 'moving'`
  - `interface Agent extends Wanderer { depth: number; activity: Activity; targetX: number; targetDepth: number }`
  - `type AgentState = Record<string, Agent>`
  - `interface AgentOpts { band: CrowdBand; width: number; greeting: ReadonlySet<string>; frozen: boolean; rand: Rand }`
  - `initAgents(ids: string[], opts: AgentOpts): AgentState`
  - `agentsAdvance(state: AgentState, dt: number, opts: AgentOpts): AgentState`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/collection/__tests__/crowdAgents.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initAgents, agentsAdvance } from '../crowdAgents';
import type { AgentOpts } from '../crowdAgents';
import { bandFor } from '../crowdLayout';
import type { Rand } from '../../../components/bobbits/wanderReducer';

function seq(values: number[]): Rand {
  let i = 0;
  return () => values[i++ % values.length];
}

const OPTS = (over: Partial<AgentOpts> = {}): AgentOpts => ({
  band: bandFor(false),
  width: 1000,
  greeting: new Set<string>(),
  frozen: false,
  rand: seq([0.5]),
  ...over,
});

describe('initAgents', () => {
  it('seeds every id wandering, spread across the width', () => {
    const s = initAgents(['a', 'b', 'c'], OPTS());
    expect(Object.keys(s)).toEqual(['a', 'b', 'c']);
    for (const id of ['a', 'b', 'c']) expect(s[id].activity).toBe('wander');
    expect(s.a.x).not.toBe(s.b.x);
  });

  it('gives each agent a depth inside 0..1', () => {
    const s = initAgents(['a', 'b'], OPTS({ rand: seq([0, 0.25, 1, 0.75]) }));
    for (const id of ['a', 'b']) {
      expect(s[id].depth).toBeGreaterThanOrEqual(0);
      expect(s[id].depth).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same ids and seed', () => {
    const a = initAgents(['x', 'y'], OPTS({ rand: seq([0.3, 0.7]) }));
    const b = initAgents(['x', 'y'], OPTS({ rand: seq([0.3, 0.7]) }));
    expect(a).toEqual(b);
  });
});

describe('agentsAdvance', () => {
  it('moves wandering agents', () => {
    const s0 = initAgents(['a'], OPTS());
    const s1 = agentsAdvance(s0, 0.5, OPTS());
    expect(s1.a.x).not.toBeCloseTo(s0.a.x, 5);
  });

  it('holds a greeting agent exactly still', () => {
    const s0 = initAgents(['a'], OPTS());
    const s1 = agentsAdvance(s0, 0.5, OPTS({ greeting: new Set(['a']) }));
    expect(s1.a).toEqual(s0.a);
  });

  it('holds EVERY agent still while the room is frozen', () => {
    const s0 = initAgents(['a', 'b'], OPTS());
    const s1 = agentsAdvance(s0, 0.5, OPTS({ frozen: true }));
    expect(s1).toEqual(s0);
  });

  it('leaves ranked agents standing at their slot', () => {
    const s0 = initAgents(['a'], OPTS());
    const ranked = { a: { ...s0.a, activity: 'rank' as const, targetX: 300 } };
    const s1 = agentsAdvance(ranked, 0.5, OPTS());
    expect(s1.a.x).toBe(ranked.a.x);
    expect(s1.a.activity).toBe('rank');
  });

  it('does not mutate the state it is given', () => {
    const s0 = initAgents(['a'], OPTS());
    const before = JSON.parse(JSON.stringify(s0));
    agentsAdvance(s0, 0.5, OPTS());
    expect(s0).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: FAIL — cannot find module `../crowdAgents`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/features/collection/crowdAgents.ts`:

```ts
/**
 * Per-bobit autonomous state for the living floor.
 *
 * Composes `wanderReducer` rather than replacing it: that module already owns the walk cycle,
 * the pause beat, the turn at the bounds and the pairwise separation, and all of it is tested.
 * What is added here is DEPTH (so the crowd is not a single line), an ACTIVITY (so the director
 * in plan 2 can take an agent off autopilot), and walked transitions between the stage and the
 * standing ranks.
 *
 * Pure and immutable, like every other reducer here. Randomness is injected so a room is
 * reproducible under test.
 */
import { initWander, wanderAdvance } from '../../components/bobbits/wanderReducer';
import type { Wanderer, WanderState, Rand } from '../../components/bobbits/wanderReducer';
import type { CrowdBand } from './crowdLayout';

/**
 * `wander` roams the stage. `rank` stands at a home slot. `moving` is walking between the two
 * -- the state that makes "no bobit ever teleports" true rather than merely intended.
 */
export type Activity = 'wander' | 'rank' | 'moving';

export interface Agent extends Wanderer {
  /** 0 = front of the stage (nearest), 1 = back. */
  depth: number;
  activity: Activity;
  /** Where a `moving` agent is walking to. Meaningless otherwise, but always defined. */
  targetX: number;
  targetDepth: number;
}

export type AgentState = Record<string, Agent>;

export interface AgentOpts {
  band: CrowdBand;
  /** Measured field width in px. */
  width: number;
  /** Ids currently greeting -- hovered, or inside the greet linger. These hold still. */
  greeting: ReadonlySet<string>;
  /** The room is stunned: nothing moves, poses included. */
  frozen: boolean;
  rand: Rand;
}

/** px/s a transitioning agent walks at, matching the wander stroll so the gait reads right. */
const MOVE_UNITS_PER_SEC = 100;

export function initAgents(ids: string[], opts: AgentOpts): AgentState {
  const { width, rand } = opts;
  // Spread across the width rather than stacking at 0: a room that starts as a pile takes
  // several seconds of separation pressure to look like a room.
  const seeds = ids.map((id, i) => ({
    id,
    x: ((i + 0.5) / Math.max(1, ids.length)) * width,
    dir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
  }));
  const wander = initWander(seeds, rand);

  const out: AgentState = {};
  for (const id of ids) {
    const w = wander[id];
    out[id] = {
      ...w,
      depth: rand(),
      activity: 'wander',
      targetX: w.x,
      targetDepth: 0,
    };
  }
  return out;
}

export function agentsAdvance(state: AgentState, dt: number, opts: AgentOpts): AgentState {
  if (opts.frozen) return state;

  const ids = Object.keys(state);
  const out: AgentState = {};

  // Only the wandering subset goes through wanderAdvance, which means separation is computed
  // among stage agents alone -- exactly right, since ranked agents stand behind them and a
  // rank is allowed to be shoulder to shoulder.
  const wanderIn: WanderState = {};
  for (const id of ids) if (state[id].activity === 'wander') wanderIn[id] = state[id];

  const wanderOut = wanderAdvance(wanderIn, dt, {
    width: opts.width,
    scale: opts.band.scale,
    greeting: opts.greeting,
    rand: opts.rand,
  });

  const step = MOVE_UNITS_PER_SEC * opts.band.scale * dt;

  for (const id of ids) {
    const a = state[id];

    if (a.activity === 'wander') {
      out[id] = { ...a, ...wanderOut[id] };
      continue;
    }

    if (a.activity === 'rank') {
      out[id] = a;
      continue;
    }

    // 'moving': walk toward the target, then settle into the ranks or onto the stage.
    if (opts.greeting.has(id)) { out[id] = a; continue; }

    const dx = a.targetX - a.x;
    const ddepth = a.targetDepth - a.depth;
    if (Math.abs(dx) <= step) {
      out[id] = {
        ...a,
        x: a.targetX,
        depth: a.targetDepth,
        // targetDepth 1 is the ranks; anything shallower is a return to the stage.
        activity: a.targetDepth >= 1 ? 'rank' : 'wander',
        t: 0,
      };
      continue;
    }
    const dir: 1 | -1 = dx > 0 ? 1 : -1;
    const progress = step / Math.abs(dx);
    out[id] = {
      ...a,
      x: a.x + dir * step,
      depth: a.depth + ddepth * progress,
      dir,
    };
  }

  return out;
}

/** Which rig animation an agent plays from its own activity alone. */
export function agentAnim(a: Agent): string {
  if (a.activity === 'rank') return 'standstill';
  if (a.activity === 'moving') return 'stroll';
  return a.phase === 'walk' ? 'stroll' : 'standstill';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdAgents.ts frontend/src/features/collection/__tests__/crowdAgents.test.ts
git commit -m "feat(bobits): add wandering agents with depth and walked transitions"
```

---

### Task 4: Cast selection and home slots

**Files:**
- Modify: `frontend/src/features/collection/crowdAgents.ts`
- Test: `frontend/src/features/collection/__tests__/crowdAgents.test.ts`

**Interfaces:**
- Consumes: `slotOrder` from `./crowdIdentity`, `slotPosition`, `CROWD_CAP`, `WANDER_CAST` from `./crowdLayout`, `Agent`/`AgentState` (Task 3).
- Produces:
  - `castFor(residents: string[], cast: number): { stage: string[]; rank: string[] }`
  - `homeSlot(id: string, residents: string[], band: CrowdBand): { x: number; depth: number }`
  - `syncCast(state: AgentState, residents: string[], opts: AgentOpts, cast: number): AgentState`

- [ ] **Step 1: Write the failing test**

Append to `crowdAgents.test.ts`:

```ts
import { castFor, homeSlot, syncCast } from '../crowdAgents';
import { CROWD_CAP } from '../crowdLayout';

describe('castFor', () => {
  it('puts everyone on stage while the room is small', () => {
    const { stage, rank } = castFor(['a', 'b', 'c'], 24);
    expect(stage).toEqual(['a', 'b', 'c']);
    expect(rank).toEqual([]);
  });

  it('gives the stage to the MOST RECENT arrivals once the room outgrows the cast', () => {
    const residents = Array.from({ length: 30 }, (_, i) => `q${i}`);   // grant order
    const { stage, rank } = castFor(residents, 24);
    expect(stage).toHaveLength(24);
    expect(rank).toHaveLength(6);
    expect(stage[stage.length - 1]).toBe('q29');
    expect(rank).toEqual(['q0', 'q1', 'q2', 'q3', 'q4', 'q5']);
  });

  it('never exceeds the crowd cap', () => {
    const residents = Array.from({ length: 140 }, (_, i) => `q${i}`);
    const { stage, rank } = castFor(residents, 24);
    expect(stage.length + rank.length).toBe(CROWD_CAP);
  });
});

describe('homeSlot', () => {
  it('derives a slot from the ID-SORTED order, not from grant order', () => {
    // Same set, different grant order -> identical home slot. This is what stops a lost and
    // re-earned bobit from moving everyone else's house.
    const band = bandFor(false);
    const a = homeSlot('q2', ['q1', 'q2', 'q3'], band);
    const b = homeSlot('q2', ['q3', 'q1', 'q2'], band);
    expect(a).toEqual(b);
  });

  it('puts ranked bobits at the back, behind the stage', () => {
    const band = bandFor(false);
    expect(homeSlot('q1', ['q1', 'q2'], band).depth).toBe(1);
  });
});

describe('syncCast', () => {
  it('adds an agent for a new resident', () => {
    const opts = OPTS();
    const s0 = initAgents(['a'], opts);
    const s1 = syncCast(s0, ['a', 'b'], opts, 24);
    expect(Object.keys(s1).sort()).toEqual(['a', 'b']);
  });

  it('drops an agent who is no longer a resident', () => {
    const opts = OPTS();
    const s0 = initAgents(['a', 'b'], opts);
    const s1 = syncCast(s0, ['a'], opts, 24);
    expect(Object.keys(s1)).toEqual(['a']);
  });

  it('demotes by WALKING, never by teleporting', () => {
    const opts = OPTS();
    const residents = ['a', 'b', 'c'];
    const s0 = initAgents(residents, opts);
    const s1 = syncCast(s0, residents, opts, 1);   // only 'c' keeps the stage
    expect(s1.a.activity).toBe('moving');
    expect(s1.a.x).toBe(s0.a.x);                   // has not moved yet
    expect(s1.a.targetDepth).toBe(1);
    expect(s1.c.activity).toBe('wander');
  });

  it('leaves an already-correct agent untouched', () => {
    const opts = OPTS();
    const s0 = initAgents(['a'], opts);
    const s1 = syncCast(s0, ['a'], opts, 24);
    expect(s1.a).toBe(s0.a);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: FAIL — `castFor` is not exported by `../crowdAgents`.

- [ ] **Step 3: Write minimal implementation**

Append to `crowdAgents.ts` (and extend the existing imports):

```ts
import { slotOrder } from './crowdIdentity';
import { slotPosition, CROWD_CAP } from './crowdLayout';
```

```ts
/**
 * Who wanders and who stands.
 *
 * Recency decides the stage: the bobits you most recently earned are the ones moving around,
 * which is what makes a big room feel like it is still about this match. Note this is the one
 * place grant order is used -- POSITIONS still come from the id-sorted order (see homeSlot),
 * so nothing reflows when a bobit is lost and re-earned.
 */
export function castFor(residents: string[], cast: number): { stage: string[]; rank: string[] } {
  const shown = residents.slice(0, CROWD_CAP);
  if (shown.length <= cast) return { stage: shown, rank: [] };
  return {
    stage: shown.slice(shown.length - cast),
    rank: shown.slice(0, shown.length - cast),
  };
}

/**
 * Where a ranked bobit stands. Depth 1 puts him at the back of the band, behind the stage.
 *
 * Position comes from `slotPosition` over the ID-SORTED residents, exactly as the fixed-slot
 * crowd did, so a bobit's house does not move when his neighbours change.
 */
export function homeSlot(id: string, residents: string[], band: CrowdBand) {
  const order = slotOrder(residents).slice(0, CROWD_CAP);
  const index = Math.max(0, order.indexOf(id));
  const pos = slotPosition(index, order.length, band);
  return { x: pos.x, depth: 1 };
}

/**
 * Reconcile the agent set with the residents and the cast.
 *
 * Newcomers are born wandering. Anyone who left is dropped. Anyone on the wrong side of the
 * cast line is set WALKING to the right side -- never moved there.
 */
export function syncCast(
  state: AgentState, residents: string[], opts: AgentOpts, cast: number,
): AgentState {
  const { stage, rank } = castFor(residents, cast);
  const onStage = new Set(stage);
  const inRank = new Set(rank);
  const out: AgentState = {};

  for (const id of [...stage, ...rank]) {
    const a = state[id];

    if (!a) {
      // A resident with no agent yet: seed one wandering where he stands.
      const born = initAgents([id], opts)[id];
      out[id] = inRank.has(id)
        ? { ...born, activity: 'rank', depth: 1, ...homeSlotTarget(id, residents, opts.band) }
        : born;
      continue;
    }

    const wantsRank = inRank.has(id);
    const isRanked = a.activity === 'rank' || (a.activity === 'moving' && a.targetDepth >= 1);

    if (wantsRank && !isRanked) {
      const home = homeSlot(id, residents, opts.band);
      out[id] = { ...a, activity: 'moving', targetX: home.x, targetDepth: home.depth };
      continue;
    }

    if (onStage.has(id) && isRanked) {
      out[id] = { ...a, activity: 'moving', targetX: a.x, targetDepth: opts.rand() * 0.9 };
      continue;
    }

    out[id] = a;
  }

  return out;
}

/** The `moving`/`rank` target fields for a home slot, as a spreadable fragment. */
function homeSlotTarget(id: string, residents: string[], band: CrowdBand) {
  const home = homeSlot(id, residents, band);
  return { x: home.x, targetX: home.x, targetDepth: home.depth };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdAgents.ts frontend/src/features/collection/__tests__/crowdAgents.test.ts
git commit -m "feat(bobits): choose the wandering cast by recency, place ranks by id"
```

---

### Task 5: Cast rotation

**Files:**
- Modify: `frontend/src/features/collection/crowdAgents.ts`
- Test: `frontend/src/features/collection/__tests__/crowdAgents.test.ts`

**Interfaces:**
- Consumes: `AgentState`, `AgentOpts`, `syncCast` (Task 4).
- Produces: `ROTATE_EVERY: number`, `rotateCast(state: AgentState, elapsed: number, opts: AgentOpts): AgentState`.

- [ ] **Step 1: Write the failing test**

Append to `crowdAgents.test.ts`:

```ts
import { rotateCast, ROTATE_EVERY } from '../crowdAgents';

describe('rotateCast', () => {
  const mixed = (opts: AgentOpts) => {
    const s = initAgents(['a', 'b', 'c'], opts);
    return {
      ...s,
      a: { ...s.a, activity: 'rank' as const, depth: 1 },
      b: { ...s.b, activity: 'rank' as const, depth: 1 },
    };
  };

  it('does nothing before the interval elapses', () => {
    const opts = OPTS();
    const s = mixed(opts);
    expect(rotateCast(s, ROTATE_EVERY - 0.01, opts)).toBe(s);
  });

  it('sends one ranked bobit walking to the stage and one stage bobit back', () => {
    const opts = OPTS();
    const s = rotateCast(mixed(opts), ROTATE_EVERY, opts);
    const moving = Object.values(s).filter(a => a.activity === 'moving');
    expect(moving).toHaveLength(2);
    expect(moving.some(a => a.targetDepth >= 1)).toBe(true);    // one heading back
    expect(moving.some(a => a.targetDepth < 1)).toBe(true);     // one coming forward
  });

  it('does nothing when there are no ranks to rotate with', () => {
    const opts = OPTS();
    const s = initAgents(['a', 'b'], opts);
    expect(rotateCast(s, ROTATE_EVERY, opts)).toBe(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: FAIL — `rotateCast` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `crowdAgents.ts`:

```ts
/** Seconds between cast rotations. Slow on purpose: this is background life, not an event. */
export const ROTATE_EVERY = 20;

/**
 * Swap one ranked bobit onto the stage and one stage bobit back into the ranks.
 *
 * Without this the same faces hold the stage forever and a 90-bobit room looks staffed rather
 * than populated. Both journeys are walked, like every other position change here.
 *
 * `elapsed` is seconds since the last rotation; the caller owns that clock. Returns the SAME
 * reference when nothing happens, so callers can skip work on identity.
 */
export function rotateCast(state: AgentState, elapsed: number, opts: AgentOpts): AgentState {
  if (elapsed < ROTATE_EVERY) return state;

  const ids = Object.keys(state).sort();          // sorted: deterministic under test
  const ranked = ids.filter(id => state[id].activity === 'rank');
  const roaming = ids.filter(id => state[id].activity === 'wander');
  if (!ranked.length || !roaming.length) return state;

  const up = ranked[Math.floor(opts.rand() * ranked.length) % ranked.length];
  const down = roaming[Math.floor(opts.rand() * roaming.length) % roaming.length];

  return {
    ...state,
    [up]: { ...state[up], activity: 'moving', targetX: state[up].x, targetDepth: opts.rand() * 0.9 },
    [down]: { ...state[down], activity: 'moving', targetX: state[down].x, targetDepth: 1 },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdAgents.ts frontend/src/features/collection/__tests__/crowdAgents.test.ts
git commit -m "feat(bobits): rotate the wandering cast so the room is not staffed by the same 24"
```

---

### Task 6: `clap` and `highfive` poses

**Files:**
- Modify: `frontend/src/components/bobbits/rigExtras.ts`
- Test: `frontend/src/components/bobbits/__tests__/rigExtras.test.ts`

**Interfaces:**
- Consumes: `ANIMATIONS`, `clonePose`, `wave`, `REST` from `./leremyRig`; `Animation`, `AnimVars` types.
- Produces: `EXTRA_ANIMATIONS.clap`, `EXTRA_ANIMATIONS.highfive` — both reachable via `ALL_ANIMATIONS`.

**Do not edit `leremyRig.ts`.** It mirrors ev-landing and must stay a clean overwrite.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/bobbits/__tests__/rigExtras.test.ts`:

```ts
import { ALL_ANIMATIONS } from '../rigExtras';

describe('clap', () => {
  it('is registered in the catalogue', () => {
    expect(ALL_ANIMATIONS.clap).toBeDefined();
  });

  it('brings the hands together and apart over time', () => {
    // The gap between the forearms must actually change -- a static "clap" is just a pose.
    const gapAt = (t: number) => {
      const p = ALL_ANIMATIONS.clap.frame(t);
      return Math.abs(p.armRF - Math.abs(p.armLF));
    };
    const samples = [0, 0.1, 0.2, 0.3, 0.4].map(gapAt);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(5);
  });

  it('keeps both hands in front of the body, not overhead', () => {
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const p = ALL_ANIMATIONS.clap.frame(t);
      expect(p.armRU).toBeLessThan(120);
      expect(p.armLU).toBeGreaterThan(-120);
    }
  });
});

describe('highfive', () => {
  it('is registered in the catalogue', () => {
    expect(ALL_ANIMATIONS.highfive).toBeDefined();
  });

  it('raises the RIGHT arm for hand R and the LEFT arm for hand L', () => {
    const r = ALL_ANIMATIONS.highfive.frame(0, { hand: 'R' });
    const l = ALL_ANIMATIONS.highfive.frame(0, { hand: 'L' });
    expect(r.armRU).toBeGreaterThan(110);
    expect(l.armLU).toBeLessThan(-110);
  });

  it('leans each partner toward the other', () => {
    const r = ALL_ANIMATIONS.highfive.frame(0, { hand: 'R' });
    const l = ALL_ANIMATIONS.highfive.frame(0, { hand: 'L' });
    expect(Math.sign(r.lean)).toBe(-Math.sign(l.lean));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/rigExtras.test.ts`
Expected: FAIL — `ALL_ANIMATIONS.clap` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add to `EXTRA_ANIMATIONS` in `frontend/src/components/bobbits/rigExtras.ts`:

```ts
  // Hands meet in front of the chest and part again. Built on `present` rather than REST so
  // the torso keeps its slight forward address -- a clap from a ramrod-straight body reads as
  // a golf clap, which is the wrong note for a room celebrating you.
  clap: {
    label: "Clap", mood: "nice one",
    frame(t: number) {
      const p = ANIMATIONS.present.frame(t);
      const s = wave(t, 3.4);                 // fast: claps are quicker than a wave
      const close = 18 + s * 16;
      p.armRU = 58; p.armRF = 96 + close;
      p.armLU = -58; p.armLF = -96 - close;
      p.headTilt = -4 + s * 2;
      p.bob = p.bob - Math.abs(s) * 1.2;
      return p;
    },
  },
  // One arm up and across, body leaning into the partner. PER-SIDE via AnimVars.hand, the
  // same contract `greet` and `carryGrip` use: pass 'R' for the partner standing to the LEFT
  // (he reaches right) and 'L' for the one standing to the right.
  //
  // The non-slapping arm deliberately keeps its hang. An earlier draft mirrored both arms and
  // it read as surrender, not a high-five -- the same trap `carryGrip` documents, where a
  // symmetric pose is the intuitive choice and the wrong one.
  highfive: {
    label: "High five", mood: "up top",
    frame(t: number, v?: AnimVars) {
      const p = clonePose(REST);
      const s = wave(t, 2.6);
      p.hunch = -6;
      p.headTilt = -8;
      if (v?.hand === 'L') {
        p.lean = -9;
        p.armLU = -132 - s * 5; p.armLF = -38 - s * 4;
      } else {
        p.lean = 9;
        p.armRU = 132 + s * 5; p.armRF = 38 + s * 4;
      }
      return p;
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/rigExtras.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/rigExtras.ts frontend/src/components/bobbits/__tests__/rigExtras.test.ts
git commit -m "feat(bobits): add clap and highfive poses"
```

> **Note for the reviewer:** these two poses are asserted numerically only. Task 13 screenshots them. The trophy-grip bug passed a joint-coordinate test *and* an independent kinematics review and was still a T-pose on screen — a test constrains the joints it names and nothing else.

---

### Task 7: Reactions — the celebration chain and the costless-miss ripple

**Files:**
- Create: `frontend/src/features/collection/crowdReactions.ts`
- Create: `frontend/src/features/collection/__tests__/crowdReactions.test.ts`
- Modify: `frontend/src/features/collection/crowdReducer.ts`
- Modify: `frontend/src/features/collection/__tests__/crowdReducer.test.ts`

**Interfaces:**
- Consumes: `CrowdState`, `CELEBRATE_DUR` from `./crowdReducer`.
- Produces:
  - `CELEBRATE_DUR = 2.4`, and a new `ripple: { from: string; t: number } | null` field on `CrowdState`, plus `RIPPLE_DUR = 1.5`.
  - `pairUp(agents: Array<{ id: string; x: number }>, maxGap: number): Array<[string, string]>`
  - `celebrationPose(elapsed: number, tier: number, isCelebrant: boolean, paired: 'R' | 'L' | null): { anim: string; hand?: 'R' | 'L' }`
  - `ripplePose(distancePx: number, elapsed: number, scale: number): string | null`

- [ ] **Step 1: Write the failing test for pairing**

Create `frontend/src/features/collection/__tests__/crowdReactions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pairUp, celebrationPose, ripplePose } from '../crowdReactions';

describe('pairUp', () => {
  it('pairs two neighbours who are close enough', () => {
    expect(pairUp([{ id: 'a', x: 0 }, { id: 'b', x: 20 }], 50)).toEqual([['a', 'b']]);
  });

  it('leaves a bobit unpaired when nobody is within reach', () => {
    expect(pairUp([{ id: 'a', x: 0 }, { id: 'b', x: 500 }], 50)).toEqual([]);
  });

  it('pairs each bobit at most once', () => {
    const pairs = pairUp([{ id: 'a', x: 0 }, { id: 'b', x: 10 }, { id: 'c', x: 20 }], 50);
    expect(pairs).toHaveLength(1);
    const used = pairs.flat();
    expect(new Set(used).size).toBe(used.length);
  });

  it('is deterministic regardless of input order', () => {
    const input = [{ id: 'c', x: 20 }, { id: 'a', x: 0 }, { id: 'b', x: 10 }];
    const shuffled = [{ id: 'b', x: 10 }, { id: 'c', x: 20 }, { id: 'a', x: 0 }];
    expect(pairUp(input, 50)).toEqual(pairUp(shuffled, 50));
  });

  it('always names the left-hand partner first', () => {
    const [[first, second]] = pairUp([{ id: 'z', x: 0 }, { id: 'a', x: 30 }], 50);
    expect(first).toBe('z');    // x=0 is to the left, despite sorting later by id
    expect(second).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdReactions.test.ts`
Expected: FAIL — cannot find module `../crowdReactions`.

- [ ] **Step 3: Implement pairing**

Create `frontend/src/features/collection/crowdReactions.ts`:

```ts
/**
 * What the room does, as pure pose selection.
 *
 * Deliberately separate from `crowdReducer`: the reducer owns WHEN a reaction is running (it
 * is driven by match events and holds the clock), and this module owns WHAT each bobit plays
 * while it runs. Keeping them apart is what lets the celebration chain be tested at a hundred
 * time offsets without constructing a match.
 */

/** Seconds a costless-miss ripple takes to cross the room and settle. */
export const RIPPLE_DUR = 1.5;

/** px/s the ripple travels outward from its origin. */
const RIPPLE_SPEED = 420;

/**
 * Pair neighbours off for a high-five.
 *
 * Greedy nearest-neighbour, walked in ID order so the result never depends on how the caller
 * happened to enumerate its agents -- the pairs have to be identical frame to frame or the
 * partners flicker between each other.
 *
 * Each pair is returned LEFT FIRST, because the two partners need different poses: the left
 * one reaches right and vice versa.
 */
export function pairUp(
  agents: Array<{ id: string; x: number }>, maxGap: number,
): Array<[string, string]> {
  const order = [...agents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const taken = new Set<string>();
  const pairs: Array<[string, string]> = [];

  for (const a of order) {
    if (taken.has(a.id)) continue;
    let best: { id: string; x: number } | null = null;
    let bestGap = Infinity;
    for (const b of order) {
      if (b.id === a.id || taken.has(b.id)) continue;
      const gap = Math.abs(b.x - a.x);
      if (gap <= maxGap && gap < bestGap) { best = b; bestGap = gap; }
    }
    if (!best) continue;
    taken.add(a.id);
    taken.add(best.id);
    pairs.push(a.x <= best.x ? [a.id, best.id] : [best.id, a.id]);
  }

  return pairs;
}
```

- [ ] **Step 4: Run test to verify pairing passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdReactions.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for the celebration chain and ripple**

Append to `crowdReactions.test.ts`:

```ts
describe('celebrationPose', () => {
  it('cheers, then claps, then high-fives, then lets go', () => {
    expect(celebrationPose(0.2, 3, false, 'R').anim).toBe('cheer');
    expect(celebrationPose(1.0, 3, false, 'R').anim).toBe('clap');
    expect(celebrationPose(1.8, 3, false, 'R').anim).toBe('highfive');
    expect(celebrationPose(2.5, 3, false, 'R').anim).toBeNull();
  });

  it('passes the hand through so partners reach toward each other', () => {
    expect(celebrationPose(1.8, 3, false, 'R').hand).toBe('R');
    expect(celebrationPose(1.8, 3, false, 'L').hand).toBe('L');
  });

  it('makes the unpaired jump instead of high-fiving thin air', () => {
    expect(celebrationPose(1.8, 3, false, null).anim).toBe('jump');
  });

  it('gives tier 5 a dance where tier 1 only manages a friendly nod', () => {
    expect(celebrationPose(0.2, 5, false, null).anim).toBe('dance');
    expect(celebrationPose(0.2, 1, false, null).anim).toBe('friendly');
  });

  it('celebrates one rung harder for whoever the answer belongs to', () => {
    expect(celebrationPose(0.2, 1, true, null).anim).toBe('cheer');
  });
});

describe('ripplePose', () => {
  it('reaches nobody at t=0', () => {
    expect(ripplePose(200, 0, 1)).toBeNull();
  });

  it('reaches the near bobits before the far ones', () => {
    expect(ripplePose(50, 0.3, 1)).not.toBeNull();
    expect(ripplePose(900, 0.3, 1)).toBeNull();
  });

  it('is over once the ripple duration elapses', () => {
    expect(ripplePose(50, RIPPLE_DUR + 0.1, 1)).toBeNull();
  });

  it('shrugs near the origin and looks confused further out', () => {
    expect(ripplePose(10, 0.6, 1)).toBe('shrug');
    expect(ripplePose(230, 0.6, 1)).toBe('confused');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdReactions.test.ts`
Expected: FAIL — `celebrationPose` is not exported.

- [ ] **Step 7: Implement the chain and the ripple**

Append to `crowdReactions.ts`:

```ts
/** Phase boundaries within a celebration, in seconds from its start. */
const CHEER_UNTIL = 0.8;
const CLAP_UNTIL = 1.6;
const HIGHFIVE_UNTIL = 2.4;

/**
 * The escalation ladder, as the celebration's OPENING pose. Tier is the in-match streak, 1-5.
 *
 * This is the old `animForTier` ladder in its new job: it no longer describes the whole
 * reaction, only how hard the room opens before the clap-and-high-five chain takes over.
 */
function openingFor(tier: number): string {
  switch (tier) {
    case 0: return 'standstill';
    case 1: return 'friendly';
    case 2:
    case 3: return 'cheer';
    case 4: return 'jump';
    default: return 'dance';
  }
}

/**
 * What one bobit plays at `elapsed` seconds into a celebration.
 *
 * `paired` is the hand this bobit reaches with, or null if nobody was close enough. The
 * celebrant -- whoever the answer belongs to -- opens one rung harder, which is the only thing
 * distinguishing a repeat correct answer from a brand new arrival.
 *
 * Returns `anim: null` once the celebration is spent, meaning "go back to your own business".
 */
export function celebrationPose(
  elapsed: number, tier: number, isCelebrant: boolean, paired: 'R' | 'L' | null,
): { anim: string | null; hand?: 'R' | 'L' } {
  if (tier <= 0 || elapsed >= HIGHFIVE_UNTIL) return { anim: null };

  if (elapsed < CHEER_UNTIL) {
    return { anim: openingFor(isCelebrant ? Math.min(5, tier + 1) : tier) };
  }
  if (elapsed < CLAP_UNTIL) return { anim: 'clap' };
  if (!paired) return { anim: 'jump' };
  return { anim: 'highfive', hand: paired };
}

/**
 * What one bobit plays during a costless miss, from how far he stands from the origin.
 *
 * A miss on a question you never owned costs nothing, so nothing is taken -- but the room
 * still has to acknowledge it, or a new player's whole first match passes without the crowd
 * reacting to anything. The reaction travels outward so it reads as news spreading rather
 * than as everyone being told at once.
 *
 * `scale` converts the rig-unit sense of "near" into the band's pixels.
 */
export function ripplePose(distancePx: number, elapsed: number, scale: number): string | null {
  if (elapsed <= 0 || elapsed >= RIPPLE_DUR) return null;
  const front = elapsed * RIPPLE_SPEED * scale;
  if (distancePx > front) return null;
  return distancePx <= 100 * scale ? 'shrug' : 'confused';
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdReactions.test.ts`
Expected: PASS

- [ ] **Step 9: Write the failing test for the reducer's ripple field**

Append to `frontend/src/features/collection/__tests__/crowdReducer.test.ts`:

```ts
describe('costless miss', () => {
  it('starts a ripple when the player never owned the question', () => {
    const s = crowdApply(crowdInit(), { type: 'seed', ids: ['a'] });
    const next = crowdApply(s, { type: 'wrong', id: 'never-owned' });
    expect(next.loss).toBeNull();
    expect(next.ripple).toEqual({ from: 'a', t: 0 });
  });

  it('does not ripple when there is nobody to react', () => {
    const next = crowdApply(crowdInit(), { type: 'wrong', id: 'never-owned' });
    expect(next.ripple).toBeNull();
  });

  it('prefers the abduction when the question WAS owned', () => {
    const s = crowdApply(crowdInit(), { type: 'seed', ids: ['a'] });
    const next = crowdApply(s, { type: 'wrong', id: 'a' });
    expect(next.loss).not.toBeNull();
    expect(next.ripple).toBeNull();
  });

  it('clears the ripple once it has run its course', () => {
    const s = crowdApply(
      crowdApply(crowdInit(), { type: 'seed', ids: ['a'] }),
      { type: 'wrong', id: 'never-owned' },
    );
    expect(crowdStep(s, RIPPLE_DUR + 0.1).ripple).toBeNull();
  });
});
```

Add `RIPPLE_DUR` to the file's imports from `../crowdReactions`.

- [ ] **Step 10: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdReducer.test.ts`
Expected: FAIL — `ripple` is undefined on the state.

- [ ] **Step 11: Add the ripple to the reducer**

In `frontend/src/features/collection/crowdReducer.ts`:

1. Change `export const CELEBRATE_DUR = 2.2;` to `export const CELEBRATE_DUR = 2.4;` and update its comment to *"Seconds the celebration chain runs: cheer, clap, high-five. Must match HIGHFIVE_UNTIL in crowdReactions."*
2. Add to `CrowdState`:

```ts
  /**
   * A miss that cost nothing. The room reacts from `from`'s position outward, but nobody is
   * taken. Distinct from `loss`, which is the abduction.
   */
  ripple: { from: string; t: number } | null;
```

3. Add `ripple: null` to the object returned by `crowdInit()`.
4. Replace the `'wrong'` case with:

```ts
    case 'wrong': {
      // A question the player actually owned costs him that bobit. One loss at a time: a
      // second would fight the first for the room's attention.
      if (state.residents.includes(event.id)) {
        if (state.loss) return state;
        return {
          ...state,
          celebrating: 0, celebrateT: 0, celebrant: null, ripple: null,
          loss: { id: event.id, phase: 'rising', t: 0 },
        };
      }
      // A miss on a question he never owned takes nothing -- but the room still notices, or a
      // new player's first match passes with no reaction to anything at all.
      if (state.loss || !state.residents.length) return state;
      return {
        ...state,
        celebrating: 0, celebrateT: 0, celebrant: null,
        ripple: { from: slotOrder(state.residents)[0], t: 0 },
      };
    }
```

Add `import { slotOrder } from './crowdIdentity';` at the top.

5. In `crowdStep`, before the `// loss` block, add:

```ts
  // ripple
  if (state.ripple) {
    const t = state.ripple.t + dt;
    next.ripple = t >= RIPPLE_DUR ? null : { ...state.ripple, t };
  }
```

Add `import { RIPPLE_DUR } from './crowdReactions';` at the top.

- [ ] **Step 12: Run the full suite**

Run: `cd frontend && npm test`
Expected: PASS. If an existing `crowdReducer` test asserts `CELEBRATE_DUR === 2.2`, update it to 2.4 — the chain is longer than the old held pose.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/features/collection/crowdReactions.ts frontend/src/features/collection/crowdReducer.ts frontend/src/features/collection/__tests__/crowdReactions.test.ts frontend/src/features/collection/__tests__/crowdReducer.test.ts
git commit -m "feat(bobits): cheer, clap, high-five on a win; shrug off a costless miss"
```

---

### Task 8: Translate agents into figures

**Files:**
- Modify: `frontend/src/features/collection/crowdFigures.ts`
- Modify: `frontend/src/features/collection/__tests__/crowdFigures.test.ts`

**Interfaces:**
- Consumes: `AgentState`, `agentAnim` (Task 3), `agentPlacement` (Task 2), `celebrationPose`, `ripplePose`, `pairUp` (Task 7), `CrowdState` (Task 7).
- Produces: `crowdFigures(state: CrowdState, agents: AgentState, band: CrowdBand, darkMode: boolean): FieldFigure[]` — note the signature change: `_t` is gone (it was never read) and `agents` is new.

- [ ] **Step 1: Write the failing test**

Replace the body of `frontend/src/features/collection/__tests__/crowdFigures.test.ts` with tests for the new signature, keeping any existing assertions about colour and the loss sequence:

```ts
import { describe, it, expect } from 'vitest';
import { crowdFigures } from '../crowdFigures';
import { crowdInit, crowdApply } from '../crowdReducer';
import { initAgents } from '../crowdAgents';
import { bandFor } from '../crowdLayout';
import type { AgentOpts } from '../crowdAgents';
import type { Rand } from '../../../components/bobbits/wanderReducer';

function seq(values: number[]): Rand { let i = 0; return () => values[i++ % values.length]; }
const BAND = bandFor(false);
const OPTS: AgentOpts = {
  band: BAND, width: 1000, greeting: new Set(), frozen: false, rand: seq([0.5]),
};

describe('crowdFigures', () => {
  const roomOf = (ids: string[]) => ({
    state: crowdApply(crowdInit(), { type: 'seed', ids }),
    agents: initAgents(ids, OPTS),
  });

  it('renders one figure per agent', () => {
    const { state, agents } = roomOf(['a', 'b']);
    expect(crowdFigures(state, agents, BAND, false)).toHaveLength(2);
  });

  it('takes each figure position from its agent, not from a slot', () => {
    const { state, agents } = roomOf(['a']);
    const [fig] = crowdFigures(state, agents, BAND, false);
    expect(fig.x).toBeCloseTo(agents.a.x, 5);
  });

  it('makes every crowd figure greetable and never poofable', () => {
    const { state, agents } = roomOf(['a', 'b']);
    for (const f of crowdFigures(state, agents, BAND, false)) {
      expect(f.greetable).toBe(true);
      expect(f.poofable).toBe(false);
    }
  });

  it('walks a wandering agent with a stroll and stands a ranked one still', () => {
    const { state, agents } = roomOf(['a']);
    const walking = { a: { ...agents.a, phase: 'walk' as const } };
    const ranked = { a: { ...agents.a, activity: 'rank' as const } };
    expect(crowdFigures(state, walking, BAND, false)[0].anim).toBe('stroll');
    expect(crowdFigures(state, ranked, BAND, false)[0].anim).toBe('standstill');
  });

  it('celebrates a correct answer across the room', () => {
    const { agents } = roomOf(['a', 'b']);
    const state = crowdApply(
      crowdApply(crowdInit(), { type: 'seed', ids: ['a', 'b'] }),
      { type: 'correct', id: 'a', streak: 3 },
    );
    const anims = crowdFigures(state, agents, BAND, false).map(f => f.anim);
    expect(anims.every(a => a === 'stroll' || a === 'standstill')).toBe(false);
  });

  it('stops drawing the victim once the burst takes him', () => {
    const ids = ['a', 'b'];
    const { agents } = roomOf(ids);
    let state = crowdApply(crowdInit(), { type: 'seed', ids });
    state = crowdApply(state, { type: 'wrong', id: 'a' });
    state = { ...state, residents: ['b'], loss: { id: 'a', phase: 'burst', t: 0 } };
    expect(crowdFigures(state, agents, BAND, false).map(f => f.id)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdFigures.test.ts`
Expected: FAIL — `crowdFigures` still expects the old `(state, _t, band, darkMode)` signature.

- [ ] **Step 3: Rewrite the translator**

Replace `frontend/src/features/collection/crowdFigures.ts` with:

```ts
import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { figColor } from '../../components/bobbits/rigExtras';
import { toneOf, hashId } from './crowdIdentity';
import { agentPlacement, CROWD_CAP } from './crowdLayout';
import type { CrowdBand } from './crowdLayout';
import { agentAnim } from './crowdAgents';
import type { AgentState } from './crowdAgents';
import { celebrationPose, ripplePose, pairUp } from './crowdReactions';
import { isStunned, LOSS_RISE } from './crowdReducer';
import type { CrowdState } from './crowdReducer';

/** How many owned bobits are not being rendered because of the cap. */
export function overflowCount(state: CrowdState): number {
  return Math.max(0, state.residents.length - CROWD_CAP);
}

/** How close two bobits must be to slap hands, in px. */
const HIGHFIVE_REACH_UNITS = 160;

/**
 * Agents plus match state, rendered.
 *
 * Position now comes from the agent -- the fixed slot layout survives only as the home a
 * ranked bobit walks back to (see crowdAgents.homeSlot). What is left here is genuinely
 * translation: pick a pose, resolve a colour, and get out of the way.
 */
export function crowdFigures(
  state: CrowdState, agents: AgentState, band: CrowdBand, darkMode: boolean,
): FieldFigure[] {
  const ids = Object.keys(agents);

  // While the room is stunned every figure holds its pose. The field paints at `t + phase`,
  // so the freeze reaches it through the phase: rewinding by exactly how long the stun has
  // run pins `t + phase` at the value it had when the stun began, since the two advance
  // together. Continuous at onset -- the stun's clock starts at zero.
  const rewind = isStunned(state) && state.loss ? state.loss.t : 0;

  // Pairs are recomputed every frame from positions, which is safe because pairUp is
  // deterministic in id order: the same neighbours produce the same pairing, so partners do
  // not flicker between each other mid-slap.
  const celebrating = state.celebrating > 0;
  const pairs = celebrating
    ? pairUp(ids.map(id => ({ id, x: agents[id].x })), HIGHFIVE_REACH_UNITS * band.scale)
    : [];
  const hands = new Map<string, 'R' | 'L'>();
  for (const [left, right] of pairs) { hands.set(left, 'R'); hands.set(right, 'L'); }

  const rippleX = state.ripple ? agents[state.ripple.from]?.x ?? null : null;

  const out: FieldFigure[] = [];
  for (const id of ids) {
    const a = agents[id];
    const victim = state.loss?.id === id;

    // He holds his place but stops being drawn the moment the burst takes him.
    if (victim && !state.residents.includes(id)) continue;

    const place = agentPlacement(a.depth, band);
    let anim = agentAnim(a);
    let props: FieldFigure['props'];

    if (victim) {
      anim = 'fall';                                   // limp, being lifted
    } else if (celebrating) {
      const pose = celebrationPose(
        state.celebrateT, state.celebrating, state.celebrant === id, hands.get(id) ?? null,
      );
      if (pose.anim) {
        anim = pose.anim;
        if (pose.hand) props = { hand: pose.hand };
      }
    } else if (state.ripple && rippleX !== null) {
      const pose = ripplePose(Math.abs(a.x - rippleX), state.ripple.t, band.scale);
      if (pose) anim = pose;
    }

    let groundY = place.groundY;
    if (victim && state.loss?.phase === 'rising') {
      // Floats up, accelerating, over the rise. He is drawn until the burst takes him.
      const k = Math.min(1, state.loss.t / LOSS_RISE);
      groundY -= k * k * (band.height * 1.6);
    }

    out.push({
      id,
      anim,
      color: figColor(toneOf(id), darkMode),
      x: a.x,
      groundY,
      scale: place.scale,
      // Phase from the id, so neighbours never breathe in lockstep. The stun rides on top.
      phase: (hashId(id) % 1000) / 250 - rewind,
      flip: a.dir === -1,
      poofable: false,
      greetable: true,
      props,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdFigures.test.ts`
Expected: PASS

- [ ] **Step 5: Confirm `DrawOpts` accepts `hand`**

Run: `cd frontend && npm run typecheck`

Expected: clean. If `DrawOpts` in `leremyRig.ts` has no `hand` field, **do not edit the rig.** Instead widen the local usage in `crowdFigures.ts` to `props: { hand: pose.hand } as FieldFigure['props']` and note it for plan 2, which introduces the director's own prop plumbing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/collection/crowdFigures.ts frontend/src/features/collection/__tests__/crowdFigures.test.ts
git commit -m "feat(bobits): render the crowd from agents instead of slots"
```

---

### Task 9: Wire the living floor into `CollectionCrowd`

**Files:**
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`
- Test: manual, plus the existing suite staying green.

**Interfaces:**
- Consumes: everything from Tasks 1-8.
- Produces: a `CollectionCrowd` that drives agents per frame and passes `interactive` to `BobitField`.

- [ ] **Step 1: Add the agent refs**

In `CollectionCrowd.tsx`, alongside the existing `stateRef`, add:

```tsx
  const agentsRef = useRef<AgentState>({});
  const rotateRef = useRef(0);
  // Seeded per mount so a room is reproducible in a screenshot run but varied between visits.
  const randRef = useRef<Rand>(() => Math.random());
```

Import `AgentState`, `initAgents`, `agentsAdvance`, `syncCast`, `rotateCast`, `ROTATE_EVERY` from `./crowdAgents`, `WANDER_CAST`, `bandFor` from `./crowdLayout`, and `Rand` (type) from `../../components/bobbits/wanderReducer`.

- [ ] **Step 2: Seed agents alongside the crowd state**

In the seeding effect, after `stateRef.current = crowdApply(...)`, add:

```tsx
      agentsRef.current = initAgents(
        stateRef.current.residents.slice(0, CROWD_CAP),
        { band, width: band.width, greeting: new Set(), frozen: false, rand: randRef.current },
      );
      rotateRef.current = 0;
```

Add `band` to that effect's dependency array, and import `CROWD_CAP`.

- [ ] **Step 3: Drive agents in `figuresFor`**

Replace the `figuresFor` memo with:

```tsx
  const figuresFor = useMemo(() => (
    _t: number, dt: number, width: number, greeting: ReadonlySet<string>,
  ): FieldFigure[] => {
    const crowd = stateRef.current;

    if (!reducedMotion) {
      stateRef.current = crowdStep(crowd, dt);

      const opts = {
        band,
        width: width || band.width,
        greeting,
        frozen: isStunned(stateRef.current),
        rand: randRef.current,
      };

      // Reconcile first: a bobit granted this frame must exist before he is advanced.
      agentsRef.current = syncCast(
        agentsRef.current, stateRef.current.residents, opts, WANDER_CAST,
      );

      rotateRef.current += dt;
      const rotated = rotateCast(agentsRef.current, rotateRef.current, opts);
      if (rotated !== agentsRef.current) { agentsRef.current = rotated; rotateRef.current = 0; }

      agentsRef.current = agentsAdvance(agentsRef.current, dt, opts);
    }

    return crowdFigures(stateRef.current, agentsRef.current, band, darkMode);
  }, [band, darkMode, reducedMotion]);
```

Import `isStunned` from `./crowdReducer`.

- [ ] **Step 4: Turn interaction on**

Change the `BobitField` element to:

```tsx
      <BobitField figures={[]} figuresFor={figuresFor} height={height} interactive />
```

- [ ] **Step 5: Move the overflow label**

The trunk lands bottom-right in plan 3. Change the overflow `<span>`'s style from `right: 8` to `left: 8`.

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run typecheck && npm test`
Expected: typecheck clean, all tests pass.

- [ ] **Step 7: Look at it**

Run: `cd frontend && npm run dev`, open a collection, answer a question correctly.

Confirm by eye: bobits wander and pause; hovering one stops him and he waves; a correct answer produces cheer → clap → high-five; a miss on a question you do not own produces a shrug that spreads. **The band must not overlap the question card or any answer option at any viewport.**

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat(bobits): drive the living floor and let players wave back"
```

---

### Task 10: Measure `WANDER_CAST`

**Files:**
- Create: `frontend/scripts/bobit-bench.mjs`
- Modify: `frontend/src/features/collection/crowdLayout.ts` (the constant, after measuring)

**This task's deliverable is a number and a recorded finding, not a feature.**

- [ ] **Step 1: Write the harness**

Create `frontend/scripts/bobit-bench.mjs`. It must measure **work, not vsync** — the Stage 2 harness reported 16.7ms for every configuration because it timed frame-to-frame delta, which is pinned to the display refresh no matter how little work happens.

```js
// Measures the per-frame WORK of the crowd simulation + paint, not the interval between
// frames. Run: node scripts/bobit-bench.mjs
import { chromium } from 'playwright';

const CASTS = [10, 20, 30, 40];
const RESIDENTS = 100;         // a full room, per CROWD_CAP

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/?bench=1');

for (const cast of CASTS) {
  const ms = await page.evaluate(async ({ cast, residents }) => {
    const h = window.__bobitBench;      // exposed by the dev harness hook, step 2
    h.reset({ cast, residents });
    // Warm up, then time 240 frames of ACTUAL simulation + paint.
    for (let i = 0; i < 60; i++) h.frame(1 / 60);
    const t0 = performance.now();
    for (let i = 0; i < 240; i++) h.frame(1 / 60);
    return (performance.now() - t0) / 240;
  }, { cast, residents: RESIDENTS });
  console.log(`cast=${String(cast).padStart(3)}  ${ms.toFixed(2)} ms/frame`);
}

await browser.close();
```

- [ ] **Step 2: Expose the harness hook**

In `CollectionCrowd.tsx`, behind `import.meta.env.DEV` only, publish `window.__bobitBench` with `reset({cast, residents})` and `frame(dt)` that run `syncCast` → `rotateCast` → `agentsAdvance` → `crowdFigures` and then paint once into the existing canvas. It must call the same functions the real loop calls — a harness that measures a different code path measures nothing.

- [ ] **Step 3: Sanity-check the harness before trusting it**

Run the bench with `CASTS = [0, 100]`. Expected: the two numbers **differ substantially**. If every configuration reports the same figure, the harness is timing vsync or an empty path — fix it before reading any result. This check is the whole reason this step exists.

- [ ] **Step 4: Measure, throttled**

Add `await page.emulateCPUThrottling?.(4)` (or launch with `--cpu-throttling-rate=4` via CDP) to approximate a mid-tier phone, and rerun. Record the four numbers.

- [ ] **Step 5: Measure the celebration worst case**

Repeat with a celebration running every frame (`crowdApply({type:'correct'})` before each frame), since the high-five pass adds a `pairUp` over the cast and changes the pose mix.

- [ ] **Step 6: Set the constant**

Pick the largest cast that holds **under 16.7ms/frame throttled with a celebration running**, then back off one step for headroom, exactly as `CROWD_CAP = 100` was derived from a measured 105. Update `WANDER_CAST` in `crowdLayout.ts` and replace its `PROVISIONAL` comment with the measured numbers and the date.

- [ ] **Step 7: Record the finding**

Append a short section to `docs/superpowers/specs/2026-09-04-bobit-stage2-perf-findings.md` with the table and whether any prediction in this plan was wrong. That file exists because four confident predictions about this rig were all wrong; this is where the fifth gets recorded either way.

- [ ] **Step 8: Commit**

```bash
git add frontend/scripts/bobit-bench.mjs frontend/src/features/collection/crowdLayout.ts frontend/src/features/collection/CollectionCrowd.tsx docs/superpowers/specs/2026-09-04-bobit-stage2-perf-findings.md
git commit -m "perf(bobits): measure the wandering cast ceiling and set WANDER_CAST"
```

---

### Task 11: Rendered verification

**Files:**
- Create: `frontend/scripts/bobit-shots.mjs`

**This task's deliverable is a set of screenshots somebody has actually looked at.**

Numeric verification is not visual verification. The trophy-grip fix passed a joint-coordinate contact test *and* an independent kinematics review, and a screenshot then showed both carriers in a T-pose, because the assertions constrained only the two hands that gripped. Tasks 6 and 7 assert joints; this task looks at figures.

- [ ] **Step 1: Write the sweep**

Create `frontend/scripts/bobit-shots.mjs`: launch chromium, mock `/api/game/collections`, drive the crowd into each state below, and save a PNG per cell into `frontend/.shots/`.

States to capture, each at **desktop and mobile viewports, in light and dark**:

1. Empty band.
2. Three bobits wandering (mid-stroll and mid-pause).
3. Thirty bobits — stage plus ranks, showing the depth spread.
4. A `clap` frame, full-body.
5. A `highfive` pair, full-body, **both partners in frame**.
6. A celebration at tier 1 and at tier 5.
7. A costless-miss ripple, mid-spread.
8. The abduction at `rising`, at `stunned`, and at `recovering`.
9. A `moving` agent walking from the stage to the ranks.

- [ ] **Step 2: Run it**

Run: `cd frontend && npm run dev` in one shell, `node scripts/bobit-shots.mjs` in another.

- [ ] **Step 3: Look at every shot**

Check specifically, because these are the failures joints tests do not catch:

- No figure is in a T-pose or has an arm held straight out into empty space.
- The high-five partners' hands actually meet; neither reaches past the other.
- Heads still top the silhouette in every pose.
- Depth reads as distance, not as figures at different heights.
- **The band overlaps no question text and no answer option, at either viewport.**
- The band at a 768px-tall viewport does not squeeze the question card. If it does, convert the desktop height to a clamp against viewport height and re-shoot.

- [ ] **Step 4: Fix what the screenshots show, and re-shoot**

Any pose correction goes in `rigExtras.ts` with a tuning-log comment recording what was measured and what was kept, in the style of `carryGrip`.

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/bobit-shots.mjs frontend/src/components/bobbits/rigExtras.ts
git commit -m "test(bobits): screenshot sweep for the living floor"
```

Add `.shots/` to `frontend/.gitignore` — the images are evidence for the review, not repository content.

---

## Self-Review

**Spec coverage.** Every plan-1 requirement in the spec maps to a task: band geometry → 1; depth and the stage → 2; agents and the wander delegation → 3; densification and home slots → 4; rotation → 5; `clap`/`highfive` → 6; the celebration chain, pairing and the costless-miss ripple → 7; the freeze halting agents → 3 (the `frozen` option) and 9 (wired from `isStunned`); translation → 8; click-to-wave and `greetable` → 8 and 9; the overflow label move → 9; the measurement pass → 10; rendered verification → 11.

Deferred to later plans, as the spec states: the scene director, props, `splayed`/`flail`, `drawSmokePuff`, the swirl, the cannon, the pool entrances and the dev replay route (plan 2); the tree, `Surface` consumption, perching, `hoverAnim: 'greetseat'`, `questionCount` plumbing and the 25% milestone (plan 3).

**Type consistency.** `AgentOpts` carries the same five fields everywhere it appears. `crowdFigures` takes `(state, agents, band, darkMode)` in Task 8 and is called that way in Task 9. `castFor`/`syncCast` both take the cast size as their last argument. `celebrationPose` returns `{anim: string | null; hand?}` and Task 8 checks `pose.anim` before assigning. `CELEBRATE_DUR` (2.4) and `HIGHFIVE_UNTIL` (2.4) are stated as needing to match, and Task 7 step 11 says so in the comment.

**One known risk, stated rather than hidden.** `WANDER_CAST = 24` and the 190px band ship as provisional constants through Tasks 1-9 and are corrected in Tasks 10 and 11. If Task 10 measures a much smaller ceiling, Task 4's cast split still works unchanged — only the constant moves.

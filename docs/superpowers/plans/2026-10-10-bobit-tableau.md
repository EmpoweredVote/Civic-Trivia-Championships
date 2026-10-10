# Bobit Tableau Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stick-figure landscape that the player's own bobits build in the margins beside the question column — one line every 4 bobits, 25 lines, 6 structures, complete at 100 bobits.

**Architecture:** An authored blueprint of 25 line segments in abstract rig units, scaled to the measured margins so it can never reach the question card. Pure modules answer *what is built* (`tableauProgress`), *where it is* (`tableauGeometry`), *what it looks like mid-build* (`buildSequence`) and *what you can sit on* (`tableauSurfaces`); two React canvases render it. The shipped margin tree is retired and re-expressed as five ordinary blueprint lines.

**Tech Stack:** TypeScript, React 18, canvas 2D, Vitest (node-only — no DOM), Playwright for contact sheets.

**Spec:** `docs/superpowers/specs/2026-10-10-bobit-tableau-design.md`

## Global Constraints

- **Occlusion:** bobits and scenery must never cover the question card or the four answer options. Held by geometry: the tableau is scaled to its measured margin and cannot outgrow it. Do not widen this.
- **One line every 4 bobits**, 25 lines total, driven by the **high-water mark** from `bobitPeak.ts` — never the current resident count.
- **Per-frame quantities cross component boundaries as callbacks** (`figuresFor`, `propsFor`, `linesFor`), never as values. A value prop is frozen at the last React render; the animation runs on rAF.
- **One pass per frame produces every canvas's figure list.** A partition only holds if every reader asks the same question.
- **Colours are derived from the theme's body colour, never hardcoded.** A fixed dark prop is invisible in dark mode.
- **Choose a pose by its frame function, never its name.** `fall` is a seated sprawl; `peek` looks down.
- **`npm test | grep …` masks the exit code.** Never chain a commit off a grepped test run.
- Everything goes through a pull request. The admin bypass on `master` exists and is not to be used. Never rename CI job names.
- `frontend/` only. `backend/` in this repo is frozen.

## Review Focus

Five things the spec implies but no task's happy path exercises. Each has a test, in the task named.

1. **A margin measured as zero or negative mid-match.** `GameScreen` early-returns the wager screen, tearing out the measured nodes; a detached node reports all zeros. A zero box must yield *no tableau*, never a zero or infinite scale. → Task 3.
2. **A resize that drops below the threshold while a bobit is climbing.** His surface vanishes mid-climb. He must fall back to the band, not vanish with the scenery. → Task 7.
3. **`linesBuilt` jumping by more than one.** A returning player, or `&tableau=25`. The tableau must render the jump as already-standing, not queue eleven build sequences. → Task 16.
4. **Only one margin wide enough.** Asymmetric layout, or a scrollbar on one side. One stack renders; agents assigned to the absent one must not disappear. → Task 7.
5. **A non-finite or negative `peak`.** `bobitPeak` filters on read, but `linesBuilt` is called with whatever it is handed. → Task 2.

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/features/collection/tableau/blueprint.ts` | The 25 lines as data: endpoints, kind, side, anchor, perch |
| `frontend/src/features/collection/tableau/tableauProgress.ts` | `linesBuilt(peak)` and the cadence constants |
| `frontend/src/features/collection/tableau/tableauGeometry.ts` | Ink bounds, shared scale, per-side origin, rig→canvas endpoints |
| `frontend/src/features/collection/tableau/drawTableau.ts` | `drawStick`, `drawCurl`, `drawTableau` |
| `frontend/src/features/collection/tableau/curl.ts` | The green curl's loop path |
| `frontend/src/features/collection/tableau/tableauSurfaces.ts` | `Surface`s from built perch lines |
| `frontend/src/features/collection/tableau/buildSequence.ts` | Phases, the line's position mid-build, crew placement |
| `frontend/src/features/collection/tableau/TableauMargin.tsx` | One margin's canvas; mounted twice |
| `frontend/src/features/collection/crowdFigures.ts` | `canvasOf` replaces `onTheTree`; `tableauFigures` replaces `treeFigures` |
| `frontend/src/features/collection/crowdAgents.ts` | `hauling`/`raising`/`lashing` activities, `jobId` claim |
| `frontend/src/features/collection/CollectionCrowd.tsx` | Wires two margin canvases and the worksite |
| `frontend/src/features/collection/RecapCrowd.tsx` | The static tableau on the results screen |
| `frontend/src/features/game/components/GameScreen.tsx` | Measures both margins |
| `frontend/scripts/bobit-tableau.mjs` | 26-state contact sheet, build strips |

**Retired in Task 12:** `milestone.ts`, `treePlacement.ts`, `TreeMargin.tsx`, `treeSurfaces`/`drawTree`/`TREE_*` in `props.ts`, and their tests.

---

# PHASE 1 — The tableau stands

At the end of Phase 1 the tableau renders, grows with the bobit count, and is climbable. Lines appear fully built with no construction beat. This is working, shippable software.

---

### Task 1: The blueprint

**Files:**
- Create: `frontend/src/features/collection/tableau/blueprint.ts`
- Test: `frontend/src/features/collection/tableau/__tests__/blueprint.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type LineKind = 'stick' | 'string'`; `type StackSide = 'left' | 'right'`; `interface TableauLine`; `const BLUEPRINT: readonly TableauLine[]`; `const TOTAL_LINES = 25`; `const STRUCTURES: readonly TableauStructure[]`; `function linesFor(side: StackSide, built: number): TableauLine[]`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/tableau/__tests__/blueprint.test.ts
import { describe, it, expect } from 'vitest';
import { BLUEPRINT, STRUCTURES, TOTAL_LINES, linesFor } from '../blueprint';

/** Distance from point p to segment ab, in rig units. */
function distToSegment(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

describe('blueprint integrity', () => {
  it('is exactly 25 lines, numbered 1..25 with no gaps', () => {
    expect(BLUEPRINT).toHaveLength(TOTAL_LINES);
    expect(BLUEPRINT.map(l => l.n)).toEqual(
      Array.from({ length: TOTAL_LINES }, (_, i) => i + 1),
    );
  });

  it('is six structures whose lines are contiguous and sides alternate', () => {
    expect(STRUCTURES).toHaveLength(6);
    let next = 1;
    STRUCTURES.forEach((s, i) => {
      expect(s.from, `structure ${i} starts where the last ended`).toBe(next);
      next = s.to + 1;
      if (i > 0) {
        expect(s.side, `structure ${i} alternates sides`).not.toBe(STRUCTURES[i - 1].side);
      }
    });
    expect(next - 1).toBe(TOTAL_LINES);
  });

  /**
   * NOTHING FLOATS, as a consequence rather than as an assertion about the data's shape.
   * Every line is lashed either to the ground or to a line already standing, and its
   * endpoint 1 physically touches that line. A tableau that passed `anchor < n` while
   * putting the joint 80 units from the wood would still look broken.
   */
  it('anchors every line to the ground or to a lower-numbered line', () => {
    for (const l of BLUEPRINT) {
      expect(l.anchor, `line ${l.n}`).toBeLessThan(l.n);
      expect(l.anchor, `line ${l.n}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('puts endpoint 1 of every line on the thing it is lashed to', () => {
    const TOLERANCE = 12;   // rig units: about half a line's width
    for (const l of BLUEPRINT) {
      if (l.anchor === 0) {
        expect(l.y1, `line ${l.n} is on the ground`).toBe(0);
        continue;
      }
      const a = BLUEPRINT[l.anchor - 1];
      expect(a.side, `line ${l.n} is lashed to its own stack`).toBe(l.side);
      const d = distToSegment(l.x1, l.y1, a.x1, a.y1, a.x2, a.y2);
      expect(d, `line ${l.n} joint to line ${l.anchor}`).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('has exactly one string, the tree canopy, and it is the tree\'s last line', () => {
    const strings = BLUEPRINT.filter(l => l.kind === 'string');
    expect(strings).toHaveLength(1);
    expect(strings[0].n).toBe(9);
    expect(strings[0].structure).toBe('tree');
  });

  it('only lets a bobit perch on a roughly level stick', () => {
    for (const l of BLUEPRINT.filter(x => x.perch)) {
      expect(l.kind, `line ${l.n}`).toBe('stick');
      const slope = Math.abs(l.y2 - l.y1) / Math.max(1, Math.abs(l.x2 - l.x1));
      expect(slope, `line ${l.n} is level enough to sit on`).toBeLessThan(0.2);
    }
  });

  it('keeps every line inside the rig box', () => {
    for (const l of BLUEPRINT) {
      for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {
        expect(Math.abs(x), `line ${l.n} x`).toBeLessThanOrEqual(200);
        expect(y, `line ${l.n} y`).toBeGreaterThanOrEqual(0);
        expect(y, `line ${l.n} y`).toBeLessThanOrEqual(1000);
      }
    }
  });
});

describe('linesFor', () => {
  it('returns only that side\'s lines, and only those built', () => {
    expect(linesFor('left', 0)).toEqual([]);
    expect(linesFor('left', 4).map(l => l.n)).toEqual([1, 2, 3, 4]);
    expect(linesFor('right', 4)).toEqual([]);
    expect(linesFor('right', 9).map(l => l.n)).toEqual([5, 6, 7, 8, 9]);
  });

  it('clamps above the total rather than throwing', () => {
    expect(linesFor('left', 999).length + linesFor('right', 999).length).toBe(TOTAL_LINES);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/blueprint.test.ts`
Expected: FAIL — `Cannot find module '../blueprint'`

- [ ] **Step 3: Write the blueprint**

```ts
// frontend/src/features/collection/tableau/blueprint.ts

/**
 * The tableau, as data.
 *
 * TWENTY-FIVE LINES, six structures, two stacks. Rig units: x runs -200..200 from the stack's
 * own centre line, y runs 0..1000 UP from the floor the crowd walks on. Both margins use the
 * same rig; the left stack is the right stack's mirror in placement, not in authoring.
 *
 * ENDPOINT 1 IS THE JOINT. Every line is lashed to its anchor at (x1, y1), and the build
 * sequence pivots the line about that point when it is raised. Authoring a line the other way
 * round makes it rise from the wrong end, which is the sort of thing that looks deliberate in
 * a diff and absurd on screen. `blueprint.test.ts` holds it: endpoint 1 must physically touch
 * the anchor.
 *
 * ANCHOR 0 MEANS THE GROUND. Otherwise an anchor is a lower line number -- never a higher one,
 * because nothing may be lashed to something that is not up yet.
 */

export type LineKind = 'stick' | 'string';
export type StackSide = 'left' | 'right';

export interface TableauLine {
  /** 1-based position in the build order. Also the line's identity. */
  n: number;
  kind: LineKind;
  side: StackSide;
  /** Which structure this belongs to, for grouping and for test messages. */
  structure: string;
  /** The joint. Lies on the anchor. The raise pivots about this point. */
  x1: number;
  y1: number;
  /** The free end. */
  x2: number;
  y2: number;
  /** Thickness at endpoint 1, in rig units. */
  w: number;
  /** Thickness at endpoint 2. Defaults to `w`; set it lower to taper. */
  w2?: number;
  /** Line number this is lashed to, or 0 for the ground. */
  anchor: number;
  /** A bobit may sit on this line's top edge. Level sticks only. */
  perch?: boolean;
}

export interface TableauStructure {
  key: string;
  label: string;
  side: StackSide;
  /** Inclusive line range. */
  from: number;
  to: number;
}

export const TOTAL_LINES = 25;

export const STRUCTURES: readonly TableauStructure[] = [
  { key: 'cabin',     label: 'Cabin',         side: 'left',  from: 1,  to: 4 },
  { key: 'tree',      label: 'Tree',          side: 'right', from: 5,  to: 9 },
  { key: 'scaffold',  label: 'Scaffold',      side: 'left',  from: 10, to: 13 },
  { key: 'treehouse', label: 'Treehouse',     side: 'right', from: 14, to: 17 },
  { key: 'lookout',   label: 'Lookout',       side: 'left',  from: 18, to: 21 },
  { key: 'mast',      label: 'Mast and flag', side: 'right', from: 22, to: 25 },
];

export const BLUEPRINT: readonly TableauLine[] = [
  // ── ① CABIN, on the ground. A post-and-rafter frame with a peaked roof. ───────────────
  { n: 1,  kind: 'stick', side: 'left',  structure: 'cabin', anchor: 0,
    x1: -80, y1: 0,   x2: -80, y2: 150, w: 16 },
  { n: 2,  kind: 'stick', side: 'left',  structure: 'cabin', anchor: 0,
    x1:  80, y1: 0,   x2:  80, y2: 150, w: 16 },
  { n: 3,  kind: 'stick', side: 'left',  structure: 'cabin', anchor: 1,
    x1: -80, y1: 150, x2:   0, y2: 225, w: 14 },
  { n: 4,  kind: 'stick', side: 'left',  structure: 'cabin', anchor: 2,
    x1:  80, y1: 150, x2:   0, y2: 225, w: 14 },

  // ── ② TREE, on the ground. Branch heights are the shipped margin tree's, verbatim. ────
  { n: 5,  kind: 'stick', side: 'right', structure: 'tree', anchor: 0,
    x1: 0, y1: 0,   x2: 0,    y2: 760, w: 44, w2: 26 },
  { n: 6,  kind: 'stick', side: 'right', structure: 'tree', anchor: 5, perch: true,
    x1: 0, y1: 230, x2: -158, y2: 230, w: 17, w2: 9 },
  { n: 7,  kind: 'stick', side: 'right', structure: 'tree', anchor: 5, perch: true,
    x1: 0, y1: 430, x2:  142, y2: 430, w: 17, w2: 9 },
  { n: 8,  kind: 'stick', side: 'right', structure: 'tree', anchor: 5, perch: true,
    x1: 0, y1: 640, x2: -112, y2: 640, w: 17, w2: 9 },
  // The green curl. Its endpoints are the crown and the nominal top of the loops; the loops
  // themselves come from `curl.ts`, because a scribble is not a segment.
  { n: 9,  kind: 'string', side: 'right', structure: 'tree', anchor: 5,
    x1: 0, y1: 760, x2: 0, y2: 940, w: 11 },

  // ── ③ SCAFFOLD, straddling the cabin roof. Feet sit ON the rafters. ───────────────────
  { n: 10, kind: 'stick', side: 'left', structure: 'scaffold', anchor: 3,
    x1: -50, y1: 178, x2: -50, y2: 560, w: 14 },
  { n: 11, kind: 'stick', side: 'left', structure: 'scaffold', anchor: 4,
    x1:  50, y1: 178, x2:  50, y2: 560, w: 14 },
  { n: 12, kind: 'stick', side: 'left', structure: 'scaffold', anchor: 10, perch: true,
    x1: -50, y1: 370, x2:  50, y2: 370, w: 13 },
  { n: 13, kind: 'stick', side: 'left', structure: 'scaffold', anchor: 10, perch: true,
    x1: -50, y1: 540, x2:  50, y2: 540, w: 13 },

  // ── ④ TREEHOUSE, lashed into the tree's lowest branch, reaching away from the card. ───
  { n: 14, kind: 'stick', side: 'right', structure: 'treehouse', anchor: 6, perch: true,
    x1: -10,  y1: 245, x2: -160, y2: 245, w: 18 },
  { n: 15, kind: 'stick', side: 'right', structure: 'treehouse', anchor: 14,
    x1: -150, y1: 245, x2: -150, y2: 330, w: 12 },
  { n: 16, kind: 'stick', side: 'right', structure: 'treehouse', anchor: 14,
    x1: -25,  y1: 245, x2: -25,  y2: 330, w: 12 },
  { n: 17, kind: 'stick', side: 'right', structure: 'treehouse', anchor: 15, perch: true,
    x1: -150, y1: 330, x2: -25,  y2: 330, w: 12 },

  // ── ⑤ LOOKOUT, a hut on the scaffold's top brace. Echoes the cabin on purpose. ────────
  { n: 18, kind: 'stick', side: 'left', structure: 'lookout', anchor: 13,
    x1: -50, y1: 540, x2: -50, y2: 650, w: 13 },
  { n: 19, kind: 'stick', side: 'left', structure: 'lookout', anchor: 13,
    x1:  50, y1: 540, x2:  50, y2: 650, w: 13 },
  { n: 20, kind: 'stick', side: 'left', structure: 'lookout', anchor: 18,
    x1: -50, y1: 650, x2:   0, y2: 712, w: 13 },
  { n: 21, kind: 'stick', side: 'left', structure: 'lookout', anchor: 19,
    x1:  50, y1: 650, x2:   0, y2: 712, w: 13 },

  // ── ⑥ MAST AND FLAG, rising from the treehouse rail, clear of the canopy. ─────────────
  { n: 22, kind: 'stick', side: 'right', structure: 'mast', anchor: 17,
    x1: -150, y1: 330, x2: -150, y2: 880, w: 13, w2: 8 },
  { n: 23, kind: 'stick', side: 'right', structure: 'mast', anchor: 22,
    x1: -150, y1: 790, x2:    0, y2: 560, w: 7 },
  { n: 24, kind: 'stick', side: 'right', structure: 'mast', anchor: 22,
    x1: -150, y1: 838, x2: -190, y2: 838, w: 10, w2: 6 },
  // The pennant: a stick that tapers to a point, which is all a flag needs to be at this size.
  { n: 25, kind: 'stick', side: 'right', structure: 'mast', anchor: 22,
    x1: -150, y1: 872, x2:  -80, y2: 856, w: 26, w2: 2 },
];

/** That side's lines, up to and including line `built`. */
export function linesFor(side: StackSide, built: number): TableauLine[] {
  const upTo = Math.max(0, Math.min(TOTAL_LINES, Math.floor(built)));
  return BLUEPRINT.filter(l => l.side === side && l.n <= upTo);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/blueprint.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/tableau/blueprint.ts frontend/src/features/collection/tableau/__tests__/blueprint.test.ts
git commit -m "feat(tableau): the 25-line blueprint, with nothing-floats held by test"
```

---

### Task 2: Progress

**Files:**
- Create: `frontend/src/features/collection/tableau/tableauProgress.ts`
- Test: `frontend/src/features/collection/tableau/__tests__/tableauProgress.test.ts`

**Interfaces:**
- Consumes: `TOTAL_LINES` from `./blueprint`.
- Produces: `const BOBITS_PER_LINE = 4`; `function linesBuilt(peak: number): number`; `function bobitsForLine(n: number): number`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/tableau/__tests__/tableauProgress.test.ts
import { describe, it, expect } from 'vitest';
import { linesBuilt, bobitsForLine, BOBITS_PER_LINE } from '../tableauProgress';
import { TOTAL_LINES } from '../blueprint';

describe('linesBuilt', () => {
  it('gives a line every four bobits', () => {
    expect(linesBuilt(0)).toBe(0);
    expect(linesBuilt(3)).toBe(0);
    expect(linesBuilt(4)).toBe(1);
    expect(linesBuilt(7)).toBe(1);
    expect(linesBuilt(8)).toBe(2);
  });

  it('completes the tableau at a hundred bobits', () => {
    expect(linesBuilt(100)).toBe(TOTAL_LINES);
  });

  it('clamps above a hundred rather than running off the end of the blueprint', () => {
    expect(linesBuilt(400)).toBe(TOTAL_LINES);
    expect(linesBuilt(1e9)).toBe(TOTAL_LINES);
  });

  /**
   * REVIEW FOCUS 5. `bobitPeak` filters junk on read, but nothing stops a caller -- a dev
   * mock, a future server driver, a test -- handing this a string's worth of nonsense. The
   * tableau is scenery; a bad number must cost an empty margin, never a thrown render.
   */
  it('treats a junk peak as no progress', () => {
    expect(linesBuilt(-1)).toBe(0);
    expect(linesBuilt(-1e9)).toBe(0);
    expect(linesBuilt(NaN)).toBe(0);
    expect(linesBuilt(Infinity)).toBe(TOTAL_LINES);
    expect(linesBuilt(-Infinity)).toBe(0);
    expect(linesBuilt(undefined as unknown as number)).toBe(0);
  });
});

describe('bobitsForLine', () => {
  it('is the inverse of linesBuilt at every milestone', () => {
    for (let n = 1; n <= TOTAL_LINES; n++) {
      const owed = bobitsForLine(n);
      expect(linesBuilt(owed), `line ${n} stands at ${owed}`).toBeGreaterThanOrEqual(n);
      expect(linesBuilt(owed - 1), `line ${n} does not stand at ${owed - 1}`).toBeLessThan(n);
    }
  });

  it('puts the last line at a hundred', () => {
    expect(bobitsForLine(TOTAL_LINES)).toBe(100);
    expect(bobitsForLine(1)).toBe(BOBITS_PER_LINE);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/tableauProgress.test.ts`
Expected: FAIL — `Cannot find module '../tableauProgress'`

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/collection/tableau/tableauProgress.ts
import { TOTAL_LINES } from './blueprint';

/**
 * How much of the tableau is standing.
 *
 * Driven by an ABSOLUTE bobit count, not by a fraction of the collection. Collections run from
 * 31 questions to 393 and are being targeted at 100 going forward, so a percentage would make
 * the same four right answers worth a whole structure in one room and a twelfth of one in
 * another. Four bobits, one line, everywhere.
 *
 * The number handed in is the HIGH-WATER MARK (`bobitPeak.ts`), never the live resident count.
 * Bobits are revoked on a wrong answer, and a house that un-builds itself when you miss a
 * question punishes twice and reads as a bug.
 */
export const BOBITS_PER_LINE = 4;

/** Lines standing at this high-water mark. Never negative, never past the blueprint. */
export function linesBuilt(peak: number): number {
  // Defensive rather than trusting: this is scenery, and a junk value must cost an empty
  // margin rather than a thrown render. NaN fails every comparison, so test for the good case.
  if (typeof peak !== 'number' || Number.isNaN(peak) || peak <= 0) return 0;
  return Math.max(0, Math.min(TOTAL_LINES, Math.floor(peak / BOBITS_PER_LINE)));
}

/** The bobit count at which line `n` goes up. The inverse of `linesBuilt`. */
export function bobitsForLine(n: number): number {
  return n * BOBITS_PER_LINE;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/tableauProgress.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/tableau/tableauProgress.ts frontend/src/features/collection/tableau/__tests__/tableauProgress.test.ts
git commit -m "feat(tableau): one line every four bobits, off the high-water mark"
```

---

### Task 3: Geometry and the occlusion bound

**Files:**
- Create: `frontend/src/features/collection/tableau/tableauGeometry.ts`
- Test: `frontend/src/features/collection/tableau/__tests__/tableauGeometry.test.ts`

**Interfaces:**
- Consumes: `BLUEPRINT`, `TableauLine`, `StackSide` from `./blueprint`; `curlExtent` from `./curl` (Task 5 — stub it in Step 3 and the real one lands in Task 5 without changing this signature).
- Produces: `interface MarginBox { width: number; height: number }`; `const MIN_TABLEAU_MARGIN = 140`; `function inkBox(side): { left; right; top }`; `function tableauScale(left: MarginBox | null, right: MarginBox | null): number | null`; `function originX(side, canvasW, scale): number`; `function lineEndpoints(line, originX, floorY, scale): { x1; y1; x2; y2 }`; `function leftmostInk(side, canvasW, scale): number`; `function rightmostInk(side, canvasW, scale): number`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/tableau/__tests__/tableauGeometry.test.ts
import { describe, it, expect } from 'vitest';
import {
  inkBox, tableauScale, originX, lineEndpoints,
  leftmostInk, rightmostInk, MIN_TABLEAU_MARGIN,
} from '../tableauGeometry';
import { BLUEPRINT } from '../blueprint';

/** Real measured margins, both sides, from the shipped tree's own fixture widths. */
const MARGINS = [
  { vw: 1920, width: 432, height: 868 },
  { vw: 1440, width: 372, height: 640 },
  { vw: 1280, width: 264, height: 560 },
];

describe('BOUND 1 — nothing the tableau draws crosses the question column', () => {
  /**
   * The canvases ARE the margins. The right canvas is positioned `right: 0` with the measured
   * margin width, so its LEFT edge is the column's right edge; the left canvas is `left: 0`,
   * so its RIGHT edge is the column's left edge. "Ink stays inside the canvas" and "ink stays
   * off the card" are therefore the same statement, and this is the test that holds the
   * standing instruction.
   *
   * Asserted as a CONSEQUENCE -- the extreme pixels the tableau actually puts down -- not by
   * checking that tableauScale took a min(). Three of this feature's earlier tests asserted
   * the implementation's arithmetic back at it and each sat on a real defect.
   */
  it('keeps every pixel inside both measured margins at every width', () => {
    for (const { vw, width, height } of MARGINS) {
      const box = { width, height };
      const s = tableauScale(box, box);
      expect(s, `scale at ${vw}px`).not.toBeNull();
      const scale = s as number;
      expect(leftmostInk('right', width, scale), `right stack left edge at ${vw}px`)
        .toBeGreaterThanOrEqual(0);
      expect(rightmostInk('right', width, scale), `right stack right edge at ${vw}px`)
        .toBeLessThanOrEqual(width);
      expect(leftmostInk('left', width, scale), `left stack left edge at ${vw}px`)
        .toBeGreaterThanOrEqual(0);
      expect(rightmostInk('left', width, scale), `left stack right edge at ${vw}px`)
        .toBeLessThanOrEqual(width);
    }
  });

  it('fits inside the margin\'s height too, so the canopy is not clipped', () => {
    for (const { vw, width, height } of MARGINS) {
      const box = { width, height };
      const scale = tableauScale(box, box) as number;
      for (const side of ['left', 'right'] as const) {
        expect(inkBox(side).top * scale, `${side} stack height at ${vw}px`)
          .toBeLessThanOrEqual(height);
      }
    }
  });
});

describe('tableauScale', () => {
  it('is ONE scale for both stacks, so the cabin is not bigger than the tree', () => {
    // A tall narrow left margin and a short wide right one. The shared scale must satisfy
    // both, which means it is the smaller of the two sides' fits -- not each side's own.
    const left = { width: 400, height: 900 };
    const right = { width: 200, height: 400 };
    const s = tableauScale(left, right) as number;
    expect(rightmostInk('right', right.width, s)).toBeLessThanOrEqual(right.width);
    expect(inkBox('right').top * s).toBeLessThanOrEqual(right.height);
    expect(inkBox('left').top * s).toBeLessThanOrEqual(left.height);
  });

  /**
   * REVIEW FOCUS 1. GameScreen early-returns the wager screen, tearing out the measured nodes,
   * and a detached node reports all zeros. A zero box must yield NO TABLEAU -- never a zero
   * scale (everything collapses onto the floor line) and never an infinite one.
   */
  it('refuses a zero, negative or non-finite box rather than scaling to it', () => {
    expect(tableauScale({ width: 0, height: 0 }, { width: 0, height: 0 })).toBeNull();
    expect(tableauScale({ width: 400, height: 0 }, null)).toBeNull();
    expect(tableauScale({ width: -400, height: 900 }, null)).toBeNull();
    expect(tableauScale({ width: NaN, height: 900 }, null)).toBeNull();
    expect(tableauScale({ width: 400, height: Infinity }, null)).toBeNull();
    expect(tableauScale(null, null)).toBeNull();
  });

  it('refuses a margin narrower than the threshold', () => {
    const tooNarrow = { width: MIN_TABLEAU_MARGIN - 1, height: 900 };
    expect(tableauScale(tooNarrow, tooNarrow)).toBeNull();
  });

  /**
   * REVIEW FOCUS 4. One margin wide enough, the other not -- an asymmetric layout, or a
   * scrollbar on one side only. The wide side still gets its stack.
   */
  it('scales from the one usable margin when only one is wide enough', () => {
    const wide = { width: 420, height: 880 };
    const narrow = { width: 40, height: 880 };
    const s = tableauScale(narrow, wide);
    expect(s).not.toBeNull();
    expect(rightmostInk('right', wide.width, s as number)).toBeLessThanOrEqual(wide.width);
  });
});

describe('lineEndpoints', () => {
  it('puts a ground line\'s joint exactly on the floor', () => {
    const scale = 0.8;
    const ox = originX('left', 432, scale);
    const ground = BLUEPRINT.find(l => l.anchor === 0) as (typeof BLUEPRINT)[number];
    const e = lineEndpoints(ground, ox, 868, scale);
    expect(e.y1).toBe(868);
  });

  it('measures y UPWARD from the floor', () => {
    const scale = 0.8;
    const ox = originX('right', 432, scale);
    const trunk = BLUEPRINT[4];                    // line 5, the trunk: y 0 -> 760
    const e = lineEndpoints(trunk, ox, 868, scale);
    expect(e.y2).toBeLessThan(e.y1);               // canvas y grows downward
    expect(e.y1 - e.y2).toBeCloseTo(760 * scale, 5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/tableauGeometry.test.ts`
Expected: FAIL — `Cannot find module '../tableauGeometry'`

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/collection/tableau/curl.ts` with just the extent for now; Task 5 fills in the path without changing this signature.

```ts
// frontend/src/features/collection/tableau/curl.ts

/** Half the horizontal travel of the curl, in rig units, measured from the crown. */
export const CURL_SPAN = 120;
/** How far the curl's centre line arches above the crown. */
export const CURL_RISE = 170;
/** Radius of one loop. */
export const CURL_R = 55;

/**
 * The curl's ink box relative to the crown, in rig units.
 *
 * Separate from the path itself so `tableauGeometry` can bound the canopy without drawing it --
 * the geometry module must stay pure and cheap, and the bounds test must not depend on how
 * many sample points the path happens to use.
 */
export function curlExtent(): { halfW: number; up: number } {
  return { halfW: CURL_SPAN + CURL_R, up: CURL_RISE + CURL_R };
}
```

```ts
// frontend/src/features/collection/tableau/tableauGeometry.ts
import { BLUEPRINT } from './blueprint';
import type { TableauLine, StackSide } from './blueprint';
import { curlExtent } from './curl';

/**
 * The empty strip beside the question column, in real MEASURED pixels.
 *
 * Measured, never recomputed from `clamp(700px, 55vw, 1500px)`: a nominal used where real
 * pixels are needed has caused two bugs in the bobit work already, and the real margin is
 * narrower than the arithmetic by the scrollbar the question area carries, which no clamp
 * calculation knows about.
 */
export interface MarginBox {
  width: number;
  height: number;
}

/**
 * Below this much margin there is no tableau at all.
 *
 * A 1024px viewport lands at ~138px per side, so that is the real crossover, and the spec
 * makes narrow screens fall back to the crowd celebration rather than to a second renderer.
 * This is the retired `MIN_TREE_MARGIN`'s value, kept because it is the same measurement.
 */
export const MIN_TABLEAU_MARGIN = 140;

function finitePositive(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function usable(box: MarginBox | null | undefined): MarginBox | null {
  if (!box) return null;
  if (!finitePositive(box.width) || !finitePositive(box.height)) return null;
  if (box.width < MIN_TABLEAU_MARGIN) return null;
  return box;
}

/**
 * The extreme ink one stack puts down, in rig units, AT FULL BUILD.
 *
 * At full build, deliberately. If the box were computed from what is currently standing, the
 * scale would change every four bobits and the whole tableau would shift and resize under the
 * player -- a cabin that shrinks when a tree arrives beside it. One box, one scale, for the
 * life of the collection.
 */
export function inkBox(side: StackSide): { left: number; right: number; top: number } {
  let left = 0, right = 0, top = 0;
  for (const l of BLUEPRINT) {
    if (l.side !== side) continue;
    if (l.kind === 'string') {
      // The curl is loops around a crown, not a segment: bound it from its own extent.
      const { halfW, up } = curlExtent();
      left = Math.min(left, l.x1 - halfW);
      right = Math.max(right, l.x1 + halfW);
      top = Math.max(top, l.y1 + up);
      continue;
    }
    const half1 = l.w / 2;
    const half2 = (l.w2 ?? l.w) / 2;
    left = Math.min(left, l.x1 - half1, l.x2 - half2);
    right = Math.max(right, l.x1 + half1, l.x2 + half2);
    top = Math.max(top, l.y1 + half1, l.y2 + half2);
  }
  return { left, right, top };
}

/**
 * ONE scale for BOTH stacks.
 *
 * Per-side scaling was the obvious first move and it is wrong: the left stack tops out at 712
 * rig units and the right at 985, so scaling each to fill its own margin would draw the cabin
 * half again as large as the tree standing next to it. The two stacks are one world and they
 * agree about how big it is.
 *
 * Returns null when there is no usable margin at all, which is the signal for "no tableau" --
 * narrow viewport, a phone, or a margin measured while its nodes were detached.
 */
export function tableauScale(
  leftBox: MarginBox | null, rightBox: MarginBox | null,
): number | null {
  const l = usable(leftBox);
  const r = usable(rightBox);
  if (!l && !r) return null;

  const fits: number[] = [];
  if (l) {
    const b = inkBox('left');
    fits.push(l.height / b.top, l.width / (b.right - b.left));
  }
  if (r) {
    const b = inkBox('right');
    fits.push(r.height / b.top, r.width / (b.right - b.left));
  }
  const scale = Math.min(...fits);
  return finitePositive(scale) ? scale : null;
}

/**
 * The stack's centre line inside its own canvas, in px.
 *
 * Each stack is pushed AWAY from the question column: the right stack's rightmost ink is flush
 * with its canvas's right edge, the left stack's leftmost ink with its canvas's left edge. The
 * gap that opens is therefore always on the card's side, which is what makes bound 1 hold by
 * construction rather than by care.
 */
export function originX(side: StackSide, canvasW: number, scale: number): number {
  const b = inkBox(side);
  return side === 'right'
    ? canvasW - b.right * scale
    : -b.left * scale;
}

/** The leftmost pixel this stack puts ink on, in canvas coordinates. The bound-1 quantity. */
export function leftmostInk(side: StackSide, canvasW: number, scale: number): number {
  return originX(side, canvasW, scale) + inkBox(side).left * scale;
}

/** The rightmost pixel this stack puts ink on, in canvas coordinates. */
export function rightmostInk(side: StackSide, canvasW: number, scale: number): number {
  return originX(side, canvasW, scale) + inkBox(side).right * scale;
}

/**
 * A line's endpoints in canvas px.
 *
 * ONE definition, read by the draw, the surfaces and the build sequence. The margin tree's
 * first draft computed its draw and its Surfaces separately and they immediately drifted by
 * half a trunk width, so the seat extended past the end of the wood.
 */
export function lineEndpoints(
  line: TableauLine, ox: number, floorY: number, scale: number,
): { x1: number; y1: number; x2: number; y2: number } {
  return {
    x1: ox + line.x1 * scale,
    y1: floorY - line.y1 * scale,
    x2: ox + line.x2 * scale,
    y2: floorY - line.y2 * scale,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/tableauGeometry.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/tableau/tableauGeometry.ts frontend/src/features/collection/tableau/curl.ts frontend/src/features/collection/tableau/__tests__/tableauGeometry.test.ts
git commit -m "feat(tableau): one shared scale, and bound 1 held by geometry"
```

---

### Task 4: Drawing the sticks

**Files:**
- Create: `frontend/src/features/collection/tableau/drawTableau.ts`
- Modify: `frontend/src/components/bobbits/fieldGeometry.ts` (add `'tableau'` to `FieldProp['kind']`)
- Modify: `frontend/src/components/bobbits/BobitField.tsx` (dispatch the new prop kind)
- Test: `frontend/src/features/collection/tableau/__tests__/drawTableau.test.ts`

**Interfaces:**
- Consumes: `linesFor`, `TableauLine` from `./blueprint`; `lineEndpoints`, `originX` from `./tableauGeometry`.
- Produces: `function drawStick(ctx, line, ox, floorY, scale, color): void`; `function drawTableau(ctx, side, built, ox, floorY, scale, color, leafColor): void`.

- [ ] **Step 1: Write the failing test**

A node-only runner has no canvas, so the test drives a recording stub. That is deliberate: it tests the *geometry the draw commits to*, which is the thing that can silently disagree with the surfaces, and leaves "does it look like a cabin" to the contact sheets, which is the only place that question can honestly be answered.

```ts
// frontend/src/features/collection/tableau/__tests__/drawTableau.test.ts
import { describe, it, expect } from 'vitest';
import { drawStick, drawTableau } from '../drawTableau';
import { BLUEPRINT } from '../blueprint';
import { originX } from '../tableauGeometry';

interface Pt { x: number; y: number }

/** Records the vertices a fill path visits. Enough to bound the ink without a canvas. */
function recorder() {
  const pts: Pt[] = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo(x: number, y: number) { pts.push({ x, y }); },
    lineTo(x: number, y: number) { pts.push({ x, y }); },
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {}, set lineCap(_v: string) {}, set lineJoin(_v: string) {},
    set globalAlpha(_v: number) {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, pts };
}

describe('drawStick', () => {
  it('draws a quad whose two ends are the line\'s two widths', () => {
    const { ctx, pts } = recorder();
    const line = { ...BLUEPRINT[0], w: 20, w2: 20 };     // vertical post, 20 wide
    drawStick(ctx, line, 100, 500, 1, '#000');
    expect(pts).toHaveLength(4);
    const xs = pts.map(p => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20, 5);
  });

  it('tapers toward endpoint 2 when w2 is smaller', () => {
    const { ctx, pts } = recorder();
    const line = { ...BLUEPRINT[0], x1: 0, y1: 0, x2: 0, y2: 100, w: 40, w2: 4 };
    drawStick(ctx, line, 0, 500, 1, '#000');
    const atFloor = pts.filter(p => Math.abs(p.y - 500) < 0.001);
    const atTip = pts.filter(p => Math.abs(p.y - 400) < 0.001);
    const spread = (ps: Pt[]) => Math.max(...ps.map(p => p.x)) - Math.min(...ps.map(p => p.x));
    expect(spread(atFloor)).toBeCloseTo(40, 5);
    expect(spread(atTip)).toBeCloseTo(4, 5);
  });
});

describe('drawTableau', () => {
  it('draws nothing at all when nothing is built', () => {
    const { ctx, pts } = recorder();
    drawTableau(ctx, 'left', 0, 0, 500, 1, '#000', '#0a0');
    expect(pts).toHaveLength(0);
  });

  it('draws only that side\'s built lines', () => {
    const { ctx, pts } = recorder();
    drawTableau(ctx, 'left', 4, 0, 500, 1, '#000', '#0a0');
    expect(pts).toHaveLength(4 * 4);          // four sticks, four vertices each
  });

  /**
   * The draw and the geometry must agree. They are computed from one definition
   * (`lineEndpoints`), and this is the test that notices if that ever stops being true --
   * which is exactly how the margin tree's seat once extended past the end of its branch.
   */
  it('keeps every drawn vertex inside the canvas at a real scale', () => {
    const width = 432, floorY = 868, scale = 0.868;
    for (const side of ['left', 'right'] as const) {
      const { ctx, pts } = recorder();
      drawTableau(ctx, side, 25, originX(side, width, scale), floorY, scale, '#000', '#0a0');
      expect(pts.length, `${side} drew something`).toBeGreaterThan(0);
      for (const p of pts) {
        expect(p.x, `${side} vertex x`).toBeGreaterThanOrEqual(-0.5);
        expect(p.x, `${side} vertex x`).toBeLessThanOrEqual(width + 0.5);
        expect(p.y, `${side} vertex y`).toBeLessThanOrEqual(floorY + 0.5);
        expect(p.y, `${side} vertex y`).toBeGreaterThanOrEqual(-0.5);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/drawTableau.test.ts`
Expected: FAIL — `Cannot find module '../drawTableau'`

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/collection/tableau/drawTableau.ts
import { linesFor } from './blueprint';
import type { TableauLine, StackSide } from './blueprint';
import { lineEndpoints } from './tableauGeometry';
import { drawCurl } from './curl';

/**
 * One line of the tableau: a tapered quad between two points.
 *
 * Tapered rather than square because a constant-width bar reads as a grey slab bolted to a
 * post -- the same lesson the margin tree's branches learned. One primitive draws every stick
 * in the blueprint, from the 44-unit trunk to the pennant that tapers to a point.
 */
export function drawStick(
  ctx: CanvasRenderingContext2D,
  line: TableauLine, ox: number, floorY: number, scale: number, color: string,
): void {
  const { x1, y1, x2, y2 } = lineEndpoints(line, ox, floorY, scale);
  const h1 = (line.w * scale) / 2;
  const h2 = ((line.w2 ?? line.w) * scale) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Unit normal to the line, so the quad's width is measured across it rather than in x.
  const nx = -dy / len, ny = dx / len;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * h1, y1 + ny * h1);
  ctx.lineTo(x2 + nx * h2, y2 + ny * h2);
  ctx.lineTo(x2 - nx * h2, y2 - ny * h2);
  ctx.lineTo(x1 - nx * h1, y1 - ny * h1);
  ctx.closePath();
  ctx.fill();
}

/**
 * One stack, as far as it has been built.
 *
 * Lowest line first, which is also build order, so a later line overlaps the joint it was
 * lashed to rather than being hidden under it.
 */
export function drawTableau(
  ctx: CanvasRenderingContext2D,
  side: StackSide, built: number,
  ox: number, floorY: number, scale: number,
  color: string, leafColor: string,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const line of linesFor(side, built)) {
    if (line.kind === 'string') drawCurl(ctx, line, ox, floorY, scale, leafColor, 1);
    else drawStick(ctx, line, ox, floorY, scale, color);
  }
  ctx.restore();
}
```

Add the prop kind. In `frontend/src/components/bobbits/fieldGeometry.ts`, change `FieldProp`:

```ts
export interface FieldProp {
  id: string;
  kind: 'cannon' | 'tableau';
  x: number;
  /** px from the field's top to the prop's ground contact line. */
  groundY: number;
  scale: number;
  flip?: boolean;
  /** Degrees from horizontal for a cannon barrel; negative is nose-up. */
  angle?: number;
  /** Which stack a `tableau` prop draws, and how much of it is standing. */
  side?: 'left' | 'right';
  built?: number;
  /** Body colour, supplied by the caller because only it knows the theme. */
  color?: string;
  /** Foliage colour for the tableau's one string line. Theme-derived, never fixed. */
  leafColor?: string;
}
```

In `frontend/src/components/bobbits/BobitField.tsx`, find the prop dispatch (the `switch`/`if` on `p.kind` that calls `drawCannon` / `drawTree` / `drawMarginTree`) and replace the tree branches with:

```ts
if (p.kind === 'tableau') {
  drawTableau(
    ctx, p.side ?? 'right', p.built ?? 0,
    p.x, p.groundY, p.scale,
    p.color ?? '#3F4854', p.leafColor ?? '#5E8C4A',
  );
  continue;
}
```

Import it at the top of `BobitField.tsx`:

```ts
import { drawTableau } from '../../features/collection/tableau/drawTableau';
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npx vitest run src/features/collection/tableau src/components/bobbits
```
Expected: PASS. `drawTree` / `drawMarginTree` tests still pass — those functions are not removed until Task 12.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/tableau/drawTableau.ts frontend/src/features/collection/tableau/__tests__/drawTableau.test.ts frontend/src/components/bobbits/fieldGeometry.ts frontend/src/components/bobbits/BobitField.tsx
git commit -m "feat(tableau): draw the stacks as tapered sticks"
```

---

### Task 5: The green curl

**Files:**
- Modify: `frontend/src/features/collection/tableau/curl.ts`
- Create: `frontend/src/features/collection/tableau/__tests__/curl.test.ts`

**Interfaces:**
- Consumes: `TableauLine` from `./blueprint`; `lineEndpoints` from `./tableauGeometry`.
- Produces: `function curlPoints(t: number): Array<[number, number]>`; `function drawCurl(ctx, line, ox, floorY, scale, color, t): void`. `curlExtent` keeps its Task 3 signature.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/tableau/__tests__/curl.test.ts
import { describe, it, expect } from 'vitest';
import { curlPoints, curlExtent, CURL_SPAN, CURL_R } from '../curl';

describe('curlPoints', () => {
  it('puts no ink down at all before the string is paid out', () => {
    expect(curlPoints(0)).toHaveLength(0);
  });

  it('grows monotonically, so the loops arrive rather than appearing', () => {
    const lengths = [0.1, 0.3, 0.5, 0.8, 1].map(t => curlPoints(t).length);
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i], `t=${i}`).toBeGreaterThan(lengths[i - 1]);
    }
  });

  /**
   * The curl is the one piece of this blueprint that is not a segment, so it is the one piece
   * that could silently breach §2.1 -- `tableauGeometry` bounds it from `curlExtent`, and this
   * is the test that keeps that promise honest. If the path ever reaches further than the
   * extent claims, the ink box is wrong and bound 1 is wrong with it.
   */
  it('never reaches outside the extent that bounds it', () => {
    const { halfW, up } = curlExtent();
    for (const t of [0.25, 0.5, 0.75, 1]) {
      for (const [x, y] of curlPoints(t)) {
        expect(Math.abs(x), `x at t=${t}`).toBeLessThanOrEqual(halfW);
        expect(y, `y at t=${t}`).toBeLessThanOrEqual(up);
        expect(y, `y at t=${t}`).toBeGreaterThanOrEqual(-CURL_R);
      }
    }
  });

  it('travels across the crown rather than piling up in one place', () => {
    const xs = curlPoints(1).map(p => p[0]);
    expect(Math.min(...xs)).toBeLessThan(-CURL_SPAN * 0.5);
    expect(Math.max(...xs)).toBeGreaterThan(CURL_SPAN * 0.5);
  });

  it('loops — it crosses its own horizontal travel many times', () => {
    const pts = curlPoints(1);
    let reversals = 0;
    for (let i = 2; i < pts.length; i++) {
      const a = pts[i - 1][0] - pts[i - 2][0];
      const b = pts[i][0] - pts[i - 1][0];
      if (a * b < 0) reversals++;
    }
    // A plain arch reverses once. Loops reverse twice per loop.
    expect(reversals).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/curl.test.ts`
Expected: FAIL — `curlPoints is not a function`

- [ ] **Step 3: Write the implementation**

Append to `frontend/src/features/collection/tableau/curl.ts`:

```ts
import type { TableauLine } from './blueprint';
import { lineEndpoints } from './tableauGeometry';

/** How many loops the curl makes across the crown. */
const LOOPS = 7;
/** Sample points per loop. Enough that the stroke reads as a curve, few enough to be cheap. */
const PER_LOOP = 24;

/**
 * The curl: a child's drawing of foliage.
 *
 * Chris, on how a kid draws a tree: trunk first, then loopy circles in green for the leaves.
 * So this is not a canopy shape -- it is a single continuous line that travels across the
 * crown while looping, exactly the gesture a hand makes scribbling leaves on.
 *
 * `t` is 0..1 and pays the line out from the crown outward, so the canopy ARRIVES rather than
 * appearing. At 0 there is no ink at all, which lets the caller animate it up out of nothing
 * with no special case -- the same contract `drawTree`'s `grow` had.
 *
 * Coordinates are rig units RELATIVE TO THE CROWN, x across and y up.
 */
export function curlPoints(t: number): Array<[number, number]> {
  const k = Math.max(0, Math.min(1, t));
  const total = LOOPS * PER_LOOP;
  const steps = Math.floor(k * total);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / total;                      // 0..k along the whole curl
    const a = u * LOOPS * Math.PI * 2;        // the loop's own angle
    // The centre line travels left to right while arching over the crown.
    const cx = -CURL_SPAN + u * CURL_SPAN * 2;
    const cy = CURL_RISE * Math.sin(Math.PI * u);
    pts.push([cx + Math.cos(a) * CURL_R, cy + Math.sin(a) * CURL_R]);
  }
  return pts;
}

/**
 * The curl, stroked.
 *
 * A STROKE, not a fill: it is a piece of string. Drawn in the leaf colour the caller supplies,
 * which must be theme-derived -- a fixed green is a different kind of wrong in each theme, and
 * a fixed dark prop was invisible in dark mode on the cannon for exactly this reason.
 */
export function drawCurl(
  ctx: CanvasRenderingContext2D,
  line: TableauLine, ox: number, floorY: number, scale: number, color: string, t: number,
): void {
  const pts = curlPoints(t);
  if (pts.length < 2) return;
  const crown = lineEndpoints(line, ox, floorY, scale);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, line.w * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = crown.x1 + x * scale;
    const py = crown.y1 - y * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npx vitest run src/features/collection/tableau
```
Expected: PASS. `tableauGeometry.test.ts` still passes — `curlExtent` was already bounding the canopy.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/tableau/curl.ts frontend/src/features/collection/tableau/__tests__/curl.test.ts
git commit -m "feat(tableau): the green curl, a child's loops of leaves"
```

---

### Task 6: Surfaces

**Files:**
- Create: `frontend/src/features/collection/tableau/tableauSurfaces.ts`
- Test: `frontend/src/features/collection/tableau/__tests__/tableauSurfaces.test.ts`

**Interfaces:**
- Consumes: `linesFor` from `./blueprint`; `lineEndpoints`, `originX` from `./tableauGeometry`; `Surface` from `../../../components/bobbits/fieldGeometry`.
- Produces: `function tableauSurfaces(side, built, ox, floorY, scale): Surface[]`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/tableau/__tests__/tableauSurfaces.test.ts
import { describe, it, expect } from 'vitest';
import { tableauSurfaces } from '../tableauSurfaces';
import { originX, lineEndpoints } from '../tableauGeometry';
import { BLUEPRINT } from '../blueprint';

const W = 432, FLOOR = 868, S = 0.868;
const ox = (side: 'left' | 'right') => originX(side, W, S);

describe('tableauSurfaces', () => {
  it('offers nothing to sit on before anything is built', () => {
    expect(tableauSurfaces('right', 0, ox('right'), FLOOR, S)).toEqual([]);
  });

  it('offers nothing while a structure has no level line yet', () => {
    // Line 5 is the trunk: a post, not a seat.
    expect(tableauSurfaces('right', 5, ox('right'), FLOOR, S)).toEqual([]);
  });

  it('offers the first branch as soon as it is built, and not before', () => {
    expect(tableauSurfaces('right', 5, ox('right'), FLOOR, S)).toHaveLength(0);
    const after = tableauSurfaces('right', 6, ox('right'), FLOOR, S);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('tableau:right:6');
  });

  it('never offers a seat on something not yet standing', () => {
    for (let built = 0; built <= 25; built++) {
      for (const side of ['left', 'right'] as const) {
        for (const sf of tableauSurfaces(side, built, ox(side), FLOOR, S)) {
          const n = Number(sf.id.split(':')[2]);
          expect(n, `surface ${sf.id} at built=${built}`).toBeLessThanOrEqual(built);
        }
      }
    }
  });

  it('gives ids that are stable for a line regardless of how much else is built', () => {
    const at10 = tableauSurfaces('right', 10, ox('right'), FLOOR, S).map(s => s.id);
    const at25 = tableauSurfaces('right', 25, ox('right'), FLOOR, S).map(s => s.id);
    expect(at25.slice(0, at10.length)).toEqual(at10);
  });

  /**
   * A seat's top edge and the wood's top edge are the SAME LINE. The in-band tree drew its
   * branch rect downward from the Surface's y and sank its occupant a branch-width into the
   * wood -- 3px there and invisible, 15px on the margin tree and obvious.
   */
  it('seats a bobit on the top edge of the wood, not inside it', () => {
    const branch = BLUEPRINT[5];                          // line 6, the lowest branch
    const e = lineEndpoints(branch, ox('right'), FLOOR, S);
    const sf = tableauSurfaces('right', 6, ox('right'), FLOOR, S)[0];
    expect(sf.y).toBeCloseTo(Math.min(e.y1, e.y2) - (branch.w * S) / 2, 5);
  });

  it('roots a climb at the joint, so a branch is climbed at the trunk', () => {
    const branch = BLUEPRINT[5];
    const e = lineEndpoints(branch, ox('right'), FLOOR, S);
    const sf = tableauSurfaces('right', 6, ox('right'), FLOOR, S)[0];
    expect(sf.rootX).toBeCloseTo(e.x1, 5);
  });

  it('never offers a seat on the string', () => {
    const all = tableauSurfaces('right', 25, ox('right'), FLOOR, S);
    expect(all.some(s => s.id.endsWith(':9'))).toBe(false);
  });

  it('orders seats lowest first, so a lone climber is not parked in the canopy', () => {
    const ys = tableauSurfaces('right', 25, ox('right'), FLOOR, S).map(s => s.y);
    const descending = [...ys].sort((a, b) => b - a);      // canvas y: bigger is lower
    expect(ys).toEqual(descending);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/tableauSurfaces.test.ts`
Expected: FAIL — `Cannot find module '../tableauSurfaces'`

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/collection/tableau/tableauSurfaces.ts
import { linesFor } from './blueprint';
import type { StackSide } from './blueprint';
import { lineEndpoints } from './tableauGeometry';
import type { Surface } from '../../../components/bobbits/fieldGeometry';

/**
 * What a bobit can sit on, in the coordinates of the canvas that stack lives in.
 *
 * This is why `Surface` was declared in `fieldGeometry.ts` in Stage 1 and consumed by nothing:
 * its comment said it existed for "the later unlockable platforms, toys and buildings". These
 * are those.
 *
 * ONLY BUILT LINES, and only level sticks. A half-built structure must offer nothing, or a
 * bobit is placed on a seat that is not there yet and hangs in mid-air beside it -- which is
 * precisely what a screenshot of a real milestone caught the margin tree doing during its
 * sprout, three figures floating beside a tree that had not reached them.
 *
 * LOWEST FIRST, because `assignPerch` claims the first unclaimed surface. Without the ordering
 * a lone climber ends up in the canopy while the branch above the cabin stands empty.
 */
export function tableauSurfaces(
  side: StackSide, built: number, ox: number, floorY: number, scale: number,
): Surface[] {
  const out: Surface[] = [];
  for (const line of linesFor(side, built)) {
    if (!line.perch) continue;
    const e = lineEndpoints(line, ox, floorY, scale);
    // The TOP edge of the wood is the line a bobit's seat rests on. Half the line's width
    // above its centre line, and `line.perch` already guarantees it is near-level.
    const top = Math.min(e.y1, e.y2) - (line.w * scale) / 2;
    out.push({
      id: `tableau:${side}:${line.n}`,
      left: Math.min(e.x1, e.x2),
      right: Math.max(e.x1, e.x2),
      y: top,
      // Endpoint 1 is the joint, so it is where the line meets whatever holds it up -- and
      // therefore where somebody climbs to reach it.
      rootX: e.x1,
    });
  }
  // Canvas y grows downward, so "lowest first" is largest y first.
  return out.sort((a, b) => b.y - a.y);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/tableauSurfaces.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/tableau/tableauSurfaces.ts frontend/src/features/collection/tableau/__tests__/tableauSurfaces.test.ts
git commit -m "feat(tableau): built lines become places to sit"
```

---

### Task 7: Generalise the partition

**Files:**
- Modify: `frontend/src/features/collection/crowdFigures.ts` (replace `onTheTree`, rename `treeFigures` → `tableauFigures`)
- Create: `frontend/src/features/collection/__tests__/canvasOf.test.ts`

This is the most dangerous change in the plan. `HANDOFF-bobits.md` §3 records why: an airborne bobit was once painted on two canvases for a whole flight because two readers disagreed about who owned him.

**Interfaces:**
- Consumes: `Agent` from `./crowdAgents`; `Surface` from `../../components/bobbits/fieldGeometry`.
- Produces: `type CanvasId = 'band' | 'left' | 'right'`; `function canvasOf(a: Agent, left: readonly Surface[], right: readonly Surface[]): CanvasId`; `function tableauFigures(state, agents, band, darkMode, side, surfaces, scale): FieldFigure[]`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/__tests__/canvasOf.test.ts
import { describe, it, expect } from 'vitest';
import { canvasOf } from '../crowdFigures';
import type { Agent, Activity } from '../crowdAgents';
import type { Surface } from '../../../components/bobbits/fieldGeometry';

const LEFT: Surface[] = [{ id: 'tableau:left:12', left: 10, right: 90, y: 300, rootX: 10 }];
const RIGHT: Surface[] = [{ id: 'tableau:right:6', left: 10, right: 90, y: 300, rootX: 90 }];

function agent(over: Partial<Agent>): Agent {
  return {
    x: 0, dir: 1, t: 0, state: 'walk', depth: 0, activity: 'wander',
    targetX: 0, targetDepth: 0, fromX: 0, fromDepth: 0, moveT: 0, moveDur: 1,
    ...over,
  } as Agent;
}

const OFF_CANVAS: Activity[] = ['climbing', 'descending', 'perch'];

describe('canvasOf — the partition', () => {
  it('leaves an ordinary wanderer on the band', () => {
    expect(canvasOf(agent({}), LEFT, RIGHT)).toBe('band');
  });

  it('sends a climber to the canvas that owns his surface', () => {
    for (const activity of OFF_CANVAS) {
      expect(canvasOf(agent({ activity, perchId: 'tableau:left:12' }), LEFT, RIGHT))
        .toBe('left');
      expect(canvasOf(agent({ activity, perchId: 'tableau:right:6' }), LEFT, RIGHT))
        .toBe('right');
    }
  });

  it('keeps a bobit who has merely CLAIMED a surface on the band until he climbs', () => {
    // perchId is claimed the instant he sets off walking, which is what stops two bobits
    // being sent to one branch. He is still on the floor until the climb starts.
    expect(canvasOf(agent({ activity: 'moving', perchId: 'tableau:left:12' }), LEFT, RIGHT))
      .toBe('band');
  });

  /**
   * REVIEW FOCUS 2 and 4. Scenery can disappear -- a resize below the threshold, a margin that
   * measured zero, a different collection, one side too narrow while the other is fine. A
   * bobit must NOT go with it. He falls back to the band rather than to nothing.
   */
  it('falls a climber back to the band when his surface has gone', () => {
    for (const activity of OFF_CANVAS) {
      expect(canvasOf(agent({ activity, perchId: 'tableau:left:12' }), [], RIGHT)).toBe('band');
      expect(canvasOf(agent({ activity, perchId: 'tableau:right:6' }), LEFT, [])).toBe('band');
      expect(canvasOf(agent({ activity, perchId: 'tableau:left:12' }), [], [])).toBe('band');
    }
  });

  it('is TOTAL and DISJOINT over a generated population', () => {
    const activities: Activity[] = [
      'wander', 'rank', 'moving', 'climbing', 'descending', 'perch',
    ];
    const perchIds = [undefined, 'tableau:left:12', 'tableau:right:6', 'tableau:left:99'];
    const surfaceSets: Array<[Surface[], Surface[]]> = [
      [LEFT, RIGHT], [LEFT, []], [[], RIGHT], [[], []],
    ];
    let n = 0;
    for (const activity of activities) {
      for (const perchId of perchIds) {
        for (const [l, r] of surfaceSets) {
          const got = canvasOf(agent({ activity, perchId }), l, r);
          // Total: always one of the three. Disjoint: it returns one value, so a figure
          // built from it can only be pushed onto one list.
          expect(['band', 'left', 'right'], `${activity}/${perchId}`).toContain(got);
          n++;
        }
      }
    }
    expect(n).toBe(activities.length * perchIds.length * surfaceSets.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/canvasOf.test.ts`
Expected: FAIL — `canvasOf is not exported`

- [ ] **Step 3: Replace `onTheTree` with `canvasOf`**

In `frontend/src/features/collection/crowdFigures.ts`, delete the `onTheTree` function and put this in its place:

```ts
/** Which canvas owns this agent's figure THIS FRAME. */
export type CanvasId = 'band' | 'left' | 'right';

/**
 * THE partition predicate. One question, every reader.
 *
 * `crowdFigures` and `tableauFigures` both call this, so the two cannot disagree about who
 * they are drawing -- which is exactly how an airborne bobit came to be painted on two
 * canvases at once for a whole flight, arcing over the question card and standing on the band
 * at the same time. The handoff is emphatic about this and it is emphatic for a reason: a
 * partition only holds if every side is answering the same question.
 *
 * It covers the three PERSISTENT canvases. The aerial overlay is partitioned separately by
 * `allowAir` and `onOverlay`, which is already correct and already tested.
 *
 * An agent whose surface is in NEITHER list falls back to the band: scenery can disappear -- a
 * narrower viewport, a margin measured while its nodes were detached, a different collection --
 * and a bobit must not disappear with it.
 *
 * Task 14 adds one clause ahead of these, for a bobit working on a line that is still going up.
 * Everything below stays exactly as it is.
 */
export function canvasOf(
  a: Agent, left: readonly Surface[], right: readonly Surface[],
): CanvasId {
  // Claimed is not the same as occupied. `perchId` is taken the instant he sets off walking,
  // so two bobits can never be sent to one seat, but he stands on the floor until the climb
  // actually begins.
  if (a.activity !== 'perch' && a.activity !== 'climbing' && a.activity !== 'descending') {
    return 'band';
  }
  if (!a.perchId) return 'band';
  if (left.some(sf => sf.id === a.perchId)) return 'left';
  if (right.some(sf => sf.id === a.perchId)) return 'right';
  return 'band';
}
```

Rename `treeFigures` to `tableauFigures` and give it a `side`. The body is unchanged except for the partition call and the parameter list:

```ts
/**
 * One margin canvas's figures: everyone perched on that stack, climbing it or coming down.
 *
 * Coordinates are that CANVAS's, not the band's -- the Surfaces are already in them. Figures
 * are drawn at BAND scale on a tableau-scale canvas, so a climber reads as a normal bobit in a
 * big tree rather than as a giant. `FieldFigure.scale` is per figure, which makes that free.
 */
export function tableauFigures(
  state: CrowdState,
  agents: AgentState,
  band: CrowdBand,
  darkMode: boolean,
  side: 'left' | 'right',
  left: readonly Surface[],
  right: readonly Surface[],
  tableauScale: number | null,
): FieldFigure[] {
  const mine = side === 'left' ? left : right;
  if (mine.length === 0 || tableauScale === null) return [];
  void state;

  const out: FieldFigure[] = [];
  for (const id of Object.keys(agents)) {
    const a = agents[id];
    if (canvasOf(a, left, right) !== side) continue;
    const sf = mine.find(s => s.id === a.perchId) as Surface;
    // ...body unchanged from the old treeFigures, from `if (a.activity === 'perch') {` down...
  }
  return out;
}
```

In `crowdFigures` itself, replace the exclusion line:

```ts
// was: if (onTheTree(a, treeSurfaces)) continue;
if (canvasOf(a, leftSurfaces, rightSurfaces) !== 'band') continue;
```

and change its two surface parameters from `surfaces` / `treeSurfaces` to `leftSurfaces` / `rightSurfaces`, both defaulting to `[]`. The in-band-perch branch (`const perch = …`) is deleted outright — with the fallback tree retired in Task 12 there are no band surfaces left, and `canvasOf` has already removed everyone who is off the floor.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npx vitest run src/features/collection && npx tsc --noEmit -p .
```
Expected: `canvasOf.test.ts` PASS. `crowdFigures.test.ts` will need its call sites updated to the new parameter names — do that now; its assertions do not change. `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdFigures.ts frontend/src/features/collection/__tests__/
git commit -m "refactor(bobits): one canvasOf predicate replaces onTheTree

Three persistent canvases instead of two, so the partition has to answer a
three-way question -- and it must answer it in exactly one place. A figure
painted on two canvases was a real bug once and the handoff says why."
```

---

### Task 8: The margin canvas component

**Files:**
- Create: `frontend/src/features/collection/tableau/TableauMargin.tsx`

**Interfaces:**
- Consumes: `BobitField`, `FieldFigure`, `FieldProp`; `originX` from `./tableauGeometry`; `groundLineFromBottom` from `../crowdLayout`.
- Produces: `function TableauMargin(props: TableauMarginProps): JSX.Element`.

- [ ] **Step 1: Write the component**

There is no DOM test runner in this repo (`vitest` is node-only by design, and three interaction bugs of exactly this class have shipped here before), so this component is verified by the contact sheets in Task 12 rather than by a unit test. Its *geometry* is already held by `tableauGeometry.test.ts`.

```tsx
// frontend/src/features/collection/tableau/TableauMargin.tsx
import { BobitField } from '../../../components/bobbits/BobitField';
import type { FieldFigure, FieldProp } from '../../../components/bobbits/fieldGeometry';
import { groundLineFromBottom } from '../crowdLayout';
import { originX } from './tableauGeometry';
import type { MarginBox } from './tableauGeometry';
import type { StackSide } from './blueprint';

interface TableauMarginProps {
  side: StackSide;
  box: MarginBox;
  scale: number;
  darkMode: boolean;
  /**
   * How many lines are standing, read PER FRAME.
   *
   * A CALLBACK, not a number. A value passed as a prop is frozen at the last React render
   * while the build advances on the rAF clock -- which is how the margin tree's sprout once
   * stalled part-grown at whatever height React last happened to catch. A unit test cannot
   * see that; a screenshot shows it immediately.
   */
  builtFor: () => number;
  /** Everyone perched, climbing or descending on THIS stack, in THIS canvas's coordinates. */
  figuresFor: () => FieldFigure[];
}

/**
 * One stack's canvas: the empty strip beside the question column, floor line to canopy.
 *
 * WHY ITS OWN CANVAS. The band is 96px tall and in normal document flow, which is how "the
 * crowd never covers the question" is guaranteed rather than merely arranged. A tableau ten
 * times that height cannot live there, and making the band taller would either steal the
 * question card's allowance or put an interactive canvas over the answer buttons.
 *
 * BOUND 1 IS GEOMETRY HERE. The canvas is pinned to its own side of the shell with the
 * MEASURED margin width, so its inner edge IS the question column's edge, and nothing drawn
 * inside it can reach the card. `tableauGeometry.test.ts` asserts the whole ink box stays
 * inside at every width. That is what lets these canvases stay INTERACTIVE while the aerial
 * overlay, which really does span the card, must not be: a bobit can still be greeted from
 * his branch.
 *
 * Two interactive BobitFields on one page was already checked when the margin tree shipped;
 * this makes it three. The document- and window-level listeners are all cancel handlers, each
 * acting on its own refs, and the 60ms armPoll is a no-op without a pending touch.
 *
 * Mounted INSIDE the crowd's wrapper, whose bottom edge is the band's bottom edge, so
 * `bottom: groundLineFromBottom()` puts this canvas's bottom exactly on the floor line the
 * crowd walks on -- from the same constant the floor line itself is drawn from.
 */
export function TableauMargin({
  side, box, scale, darkMode, builtFor, figuresFor,
}: TableauMarginProps) {
  // Light timber on a dark ground and vice versa, exactly as the cannon learned to be: a fixed
  // dark prop is a smudge in dark mode.
  const color = darkMode ? '#9AA6B8' : '#4A5568';
  // The one colour in the tableau that is not the body colour. Derived per theme for the same
  // reason -- a single green that works on both backgrounds does not exist.
  const leafColor = darkMode ? '#7FB069' : '#4F7942';

  const propsFor = (): FieldProp[] => [{
    id: `room:tableau:${side}`,
    kind: 'tableau',
    side,
    built: builtFor(),
    x: originX(side, box.width, scale),
    // The canvas's bottom edge IS the band's floor line, so the stack stands on the same
    // ground the crowd walks on.
    groundY: box.height,
    scale,
    color,
    leafColor,
  }];

  return (
    <div
      style={{
        position: 'absolute',
        [side]: 0,
        bottom: groundLineFromBottom(),
        width: box.width,
        height: box.height,
        // Behind the question column in z-order, so that even if a future layout change made
        // the boxes overlap, the card wins. Belt and braces over the geometry.
        zIndex: 0,
      } as React.CSSProperties}
    >
      <BobitField
        figures={[]}
        figuresFor={figuresFor}
        propsFor={propsFor}
        height={box.height}
        interactive
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit -p .`
Expected: clean. Nothing imports it yet — that is Task 10.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/collection/tableau/TableauMargin.tsx
git commit -m "feat(tableau): the margin canvas, mounted once per stack"
```

---

### Task 9: Measure both margins

**Files:**
- Modify: `frontend/src/features/game/components/GameScreen.tsx:145-200` (the `measureMargin` callback and the `marginBox` state)

**Interfaces:**
- Consumes: `MarginBox` from `../../collection/tableau/tableauGeometry`.
- Produces: `CollectionCrowd` now receives `leftMargin` and `rightMargin` props instead of `marginBox`.

- [ ] **Step 1: Widen the measurement to both sides**

In `GameScreen.tsx`, change the import:

```ts
import type { MarginBox } from '../../collection/tableau/tableauGeometry';
```

Replace the single `marginBox` state with a pair:

```ts
const [margins, setMargins] = useState<{ left: MarginBox | null; right: MarginBox | null }>(
  { left: null, right: null },
);
```

Replace the body of `measureMargin`:

```ts
const measureMargin = useCallback(() => {
  const col = columnEl.current;
  const shell = shellEl.current;
  if (!col || !shell) return;
  const c = col.getBoundingClientRect();
  const sh = shell.getBoundingClientRect();
  // A detached node measures all zeros. Publishing that would collapse the margins and
  // silently take the tableau away mid-match -- see the attach note below.
  if (sh.width <= 0 || c.width <= 0) return;

  // CONTENT box, not border box, on BOTH sides. The band -- and therefore each tableau
  // canvas, which is flush with it -- lives inside this shell's `px-4 sm:px-6`. Measuring to
  // `sh.right` overstates the right margin by that padding, and since that canvas is
  // positioned from its right edge the surplus comes off its left: the canvas would start
  // ~24px inside the question column, which is bound 1 breached by arithmetic. The left
  // margin has the mirror of the same trap.
  const cs = getComputedStyle(shell);
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const padRight = parseFloat(cs.paddingRight) || 0;
  const padLeft = parseFloat(cs.paddingLeft) || 0;
  const floorY = sh.bottom - padBottom - groundLineFromBottom();

  // Top of the content box down to the floor line. The column is the first child, so its own
  // top IS the content top -- and the HUD shares this column, so a stack may rise past the
  // score row without ever being over it. Both margins share this height.
  const height = Math.max(0, Math.round(floorY - c.top));
  const right = Math.max(0, Math.round((sh.right - padRight) - c.right));
  const left = Math.max(0, Math.round(c.left - (sh.left + padLeft)));

  setMargins(prev => {
    // Same identity when nothing moved, so a ResizeObserver firing on every frame of a drag
    // does not re-render the crowd for no reason.
    const same = (a: MarginBox | null, w: number) =>
      a !== null && a.width === w && a.height === height;
    if (same(prev.left, left) && same(prev.right, right)) return prev;
    return { left: { width: left, height }, right: { width: right, height } };
  });
}, []);
```

At the `<CollectionCrowd …>` call site around line 886, replace `marginBox={marginBox}` with:

```tsx
leftMargin={margins.left}
rightMargin={margins.right}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit -p .`
Expected: FAIL — `CollectionCrowd` does not accept `leftMargin`/`rightMargin` yet. That is Task 10; this is the expected intermediate state.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/game/components/GameScreen.tsx
git commit -m "feat(tableau): measure the left margin as well as the right"
```

---

### Task 10: Wire the crowd to two stacks

**Files:**
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: `CollectionCrowd` accepts `leftMargin` / `rightMargin`; renders two `TableauMargin`s.

- [ ] **Step 1: Replace the tree's imports**

```ts
// Remove:
//   import { treeX, TREE_GROW_SEC, treeScale } from './treePlacement';
//   import type { MarginBox } from './treePlacement';
//   import { treeSurfaces, marginTreeSurfaces, marginTreeX } from '../../components/bobbits/props';
//   import { TreeMargin } from './TreeMargin';
//   import { treeEarned } from './milestone';
import { tableauScale, originX } from './tableau/tableauGeometry';
import type { MarginBox } from './tableau/tableauGeometry';
import { tableauSurfaces } from './tableau/tableauSurfaces';
import { linesBuilt } from './tableau/tableauProgress';
import { TableauMargin } from './tableau/TableauMargin';
```

Change `treeFigures` to `tableauFigures` in the `crowdFigures` import.

- [ ] **Step 2: Replace the props and the derived state**

```ts
  leftMargin?: MarginBox | null;
  rightMargin?: MarginBox | null;
```

Destructure them in place of `marginBox`, and delete `questionCount` from the props — the tableau no longer reads it. Replace the earned/grow state:

```ts
/**
 * Lines standing, from the high-water mark. Not the live resident count: bobits are revoked
 * on a wrong answer, and a house that un-builds itself punishes twice and reads as a bug.
 *
 * No `grow` clock and no `earned` latch any more. The tree had both because it arrived whole
 * at a threshold; the tableau arrives a line at a time and `linesBuilt` is the whole of it.
 */
const builtRef = useRef(0);

const scale = useMemo(
  () => (isMobile ? null : tableauScale(leftMargin ?? null, rightMargin ?? null)),
  [leftMargin, rightMargin, isMobile],
);
const scaleRef = useRef(scale);
const leftBoxRef = useRef<MarginBox | null>(leftMargin ?? null);
const rightBoxRef = useRef<MarginBox | null>(rightMargin ?? null);
useLayoutEffect(() => { scaleRef.current = scale; }, [scale]);
useLayoutEffect(() => { leftBoxRef.current = leftMargin ?? null; }, [leftMargin]);
useLayoutEffect(() => { rightBoxRef.current = rightMargin ?? null; }, [rightMargin]);

/** Published from the frame loop for each TableauMargin to paint. */
const leftFiguresRef = useRef<FieldFigure[]>([]);
const rightFiguresRef = useRef<FieldFigure[]>([]);
const leftSurfacesRef = useRef<Surface[]>([]);
const rightSurfacesRef = useRef<Surface[]>([]);
```

In the effect that currently calls `peakStore.record` and `treeEarned`, keep the record and replace the rest:

```ts
peakStore.record(slugNow, stateRef.current.residents.length);
builtRef.current = linesBuilt(peakStore.peak(slugNow));
```

- [ ] **Step 3: Replace the frame loop's geometry read**

Inside the frame callback, replace the whole `mScale` / `mBox` / `surfacesRef` block with:

```ts
/**
 * ONE read of the tableau's geometry per frame, feeding the surfaces, the perch assignment
 * and all three figure lists.
 *
 * Read here rather than at each use for the same reason the aerial gate is: readers that each
 * fetch their own copy can disagree about a frame, and the partition between the canvases only
 * holds while they agree.
 */
const s = scaleRef.current;
const lBox = leftBoxRef.current;
const rBox = rightBoxRef.current;
const built = builtRef.current;
```

and, inside the `if (!reducedMotion)` block, in place of the old surfaces assignment:

```ts
// In the coordinates of whichever canvas holds them. An agent's perchId belongs to exactly
// one list, which is what `canvasOf` partitions on.
leftSurfacesRef.current = s !== null && lBox !== null
  ? tableauSurfaces('left', built, originX('left', lBox.width, s), lBox.height, s)
  : [];
rightSurfacesRef.current = s !== null && rBox !== null
  ? tableauSurfaces('right', built, originX('right', rBox.width, s), rBox.height, s)
  : [];
```

Replace the `assignPerch` block. Each stack is assigned independently, because the floor a climb starts from is that canvas's own height and the two canvases are not the same box:

```ts
// After the advance, so a bobit released from a scene or finishing a move is eligible this
// frame rather than next. A no-op while every surface is claimed.
if (leftSurfacesRef.current.length > 0 && lBox) {
  agentsRef.current = assignPerch(
    agentsRef.current, leftSurfacesRef.current, opts, lBox.height,
  );
}
if (rightSurfacesRef.current.length > 0 && rBox) {
  agentsRef.current = assignPerch(
    agentsRef.current, rightSurfacesRef.current, opts, rBox.height,
  );
}
```

Replace the `bandSurfaces` / `treeCanvasSurfaces` lines and the `treeFigures` call:

```ts
// The margin canvases, published from this SAME pass. Not a second read of the geometry: the
// lists partition every agent between them, and a partition only holds if every side is
// answering the same question.
const lSurf = leftSurfacesRef.current;
const rSurf = rightSurfacesRef.current;
leftFiguresRef.current = tableauFigures(
  stateRef.current, agentsRef.current, band, darkMode, 'left', lSurf, rSurf, s,
);
rightFiguresRef.current = tableauFigures(
  stateRef.current, agentsRef.current, band, darkMode, 'right', lSurf, rSurf, s,
);

return crowdFigures(
  stateRef.current, agentsRef.current, band, darkMode, directorRef.current,
  allowAir, lSurf, rSurf,
);
```

Update the frame callback's dependency array: `[band, darkMode, reducedMotion, isMobile]` is unchanged.

- [ ] **Step 4: Replace the render**

```tsx
const builtForCanvas = useMemo(() => (): number => builtRef.current, []);
const leftFiguresForCanvas = useMemo(() => (): FieldFigure[] => leftFiguresRef.current, []);
const rightFiguresForCanvas = useMemo(() => (): FieldFigure[] => rightFiguresRef.current, []);

// …in the JSX, replacing the single {inMargin && …} block:
{scale !== null && leftMargin && leftMargin.width >= MIN_TABLEAU_MARGIN && (
  <TableauMargin
    side="left"
    box={leftMargin}
    scale={scale}
    darkMode={darkMode}
    builtFor={builtForCanvas}
    figuresFor={leftFiguresForCanvas}
  />
)}
{scale !== null && rightMargin && rightMargin.width >= MIN_TABLEAU_MARGIN && (
  <TableauMargin
    side="right"
    box={rightMargin}
    scale={scale}
    darkMode={darkMode}
    builtFor={builtForCanvas}
    figuresFor={rightFiguresForCanvas}
  />
)}
```

Import `MIN_TABLEAU_MARGIN` alongside `tableauScale`.

- [ ] **Step 5: Verify**

```bash
cd frontend && npx tsc --noEmit -p . && npx vitest run
```
Expected: `tsc` clean. Tests referencing `treeFigures`, `marginBox` or `treeEarned` fail — leave them; Task 12 deletes them with the code they cover. Note which ones fail so Task 12 can confirm it removed exactly those.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "feat(tableau): wire both margins into the crowd's one frame pass"
```

---

### Task 11: The results screen

**Files:**
- Modify: `frontend/src/features/collection/RecapCrowd.tsx`
- Modify: `frontend/src/features/game/components/ResultsScreen.tsx:734`

**Interfaces:**
- Consumes: `drawTableau`, `tableauScale`, `originX`, `linesBuilt`.
- Produces: `RecapCrowd` accepts `slug: string`.

- [ ] **Step 1: Draw both stacks behind the recap crowd**

The recap is full-width with no question card to dodge, so both stacks stand side by side with the crowd celebrating between and on them. **Static**: the recap shows what is built and does not run the worksite. Nothing on the recap reads the match result — the room celebrates whether you won or lost, and a crew working through the celebration contradicts that.

In `RecapCrowd.tsx`, add the prop and a `propsFor` callback:

```ts
import { tableauScale, originX } from './tableau/tableauGeometry';
import { linesBuilt } from './tableau/tableauProgress';
import { createPeakStore } from './bobitPeak';

const peakStore = createPeakStore();

// …inside the component, where `band` and the recap's own height are known:
const built = linesBuilt(peakStore.peak(slug));

/**
 * The recap's stacks share one scale, derived from the recap band's own height and a third of
 * its width per side -- the middle third is left clear for the celebrating crowd, which is
 * what the screen is for.
 */
const propsFor = (): FieldProp[] => {
  if (built <= 0) return [];
  const sideW = Math.floor(width / 3);
  const box = { width: sideW, height };
  const s = tableauScale(box, box);
  if (s === null) return [];
  const color = darkMode ? '#9AA6B8' : '#4A5568';
  const leafColor = darkMode ? '#7FB069' : '#4F7942';
  return [
    {
      id: 'recap:tableau:left', kind: 'tableau', side: 'left', built,
      x: originX('left', sideW, s), groundY: height, scale: s, color, leafColor,
    },
    {
      id: 'recap:tableau:right', kind: 'tableau', side: 'right', built,
      // The right stack is drawn in the right third, so its origin is offset by the two
      // thirds to its left.
      x: (width - sideW) + originX('right', sideW, s),
      groundY: height, scale: s, color, leafColor,
    },
  ];
};
```

Pass `propsFor={propsFor}` to the `BobitField`.

In `ResultsScreen.tsx` at the `<RecapCrowd …>` call, add `slug={collectionSlug}` using whatever the screen already holds for the collection's slug.

- [ ] **Step 2: Verify**

```bash
cd frontend && npx tsc --noEmit -p .
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/collection/RecapCrowd.tsx frontend/src/features/game/components/ResultsScreen.tsx
git commit -m "feat(tableau): the results screen shows what you have built"
```

---

### Task 12: Retire the tree

**Files:**
- Delete: `frontend/src/features/collection/treePlacement.ts`, `milestone.ts`, `TreeMargin.tsx`
- Delete: `frontend/src/features/collection/__tests__/treePlacement.test.ts`, `milestone.test.ts`, `frontend/src/components/bobbits/__tests__/marginTree.test.ts`
- Modify: `frontend/src/components/bobbits/props.ts` (remove `drawTree`, `drawMarginTree`, `treeSurfaces`, `marginTreeSurfaces`, `marginTree*`, `TREE_*`, `MARGIN_*`)
- Modify: `frontend/src/components/bobbits/__tests__/props.test.ts` (drop the tree cases)

The spec is explicit that this spends verification already paid for, and that re-earning it is part of the cost — Task 16 is where it is re-earned.

- [ ] **Step 1: Confirm nothing still imports the tree**

```bash
cd frontend && grep -rn "drawTree\|drawMarginTree\|treeSurfaces\|marginTree\|TreeMargin\|treeEarned\|treePlacement\|MILESTONE_FRACTION\|TREE_" src/ --include=*.ts --include=*.tsx
```
Expected: matches only inside the files about to be deleted. Any other hit is a live caller — fix it before continuing.

- [ ] **Step 2: Delete and prune**

```bash
cd frontend
git rm src/features/collection/treePlacement.ts \
       src/features/collection/milestone.ts \
       src/features/collection/TreeMargin.tsx \
       src/features/collection/__tests__/treePlacement.test.ts \
       src/features/collection/__tests__/milestone.test.ts \
       src/components/bobbits/__tests__/marginTree.test.ts
```

In `props.ts`, delete `drawTree`, `drawMarginTree`, `treeSurfaces`, `marginTreeSurfaces`, `marginTreeX`, `marginTreeLeftmost`, `marginTreeRightmost`, `marginTreeTop`, and every `TREE_*` / `MARGIN_*` constant. Keep `accentFor`, `cannonMuzzle` and `drawCannon` — the cannon is unaffected. Remove the now-dead `Surface` import if nothing else in the file uses it.

In `props.test.ts`, delete the describe blocks covering the removed functions.

- [ ] **Step 3: Verify the whole suite and the types**

```bash
cd frontend && npx tsc --noEmit -p .
cd frontend && npx vitest run
```
Expected: both clean. Every test that failed at the end of Task 10 is now either passing or deleted. **Check the exit code directly — do not pipe this through `grep`, which masks it and has let two red tests be committed here before.**

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(bobits): retire the margin tree, now that it is five blueprint lines

The tree, its placement module, its milestone latch, its own canvas and the
in-band fallback all go. What they did is now ordinary tableau: lines 5-9 on
the right stack, the same branch heights, hauled up like everything else.

This spends screenshot verification already paid for. Re-earning it is part
of the cost of this work, not an optional extra."
```

---

### Task 13: Contact sheets and the mock

**Files:**
- Create: `frontend/scripts/bobit-tableau.mjs`
- Modify: the dev mock's query parsing (find it with `grep -rn "bobitSeed" frontend/src`)

- [ ] **Step 1: Add `&tableau=N` to the mock**

Alongside the existing `&owned=N`, accept `&tableau=N` and have it seed the peak store to `N * BOBITS_PER_LINE`, so a contact sheet can ask for an exact line count without computing bobits. `&owned=N` keeps working and keeps driving the peak as it does today.

- [ ] **Step 2: Write the contact sheet script**

Model it on `frontend/scripts/bobit-tree.mjs`. It must produce:

- **All 26 states.** `tableau=0` through `tableau=25`, both themes, at 1920 / 1440 / 1280. The question this answers is whether step 9 of 25 looks deliberate, and no unit test can answer it.
- **A curl strip.** Line 9 at `t` = 0, 0.1 … 1.0, both themes. The curl is the one piece of the blueprint whose success is purely how it looks.
- **One viewport per process.** `bobit-recap.mjs` was OOM-killed three times sharing a single Chromium across rows; take `TABLEAU_WIDTHS` / `TABLEAU_THEMES` env vars for exactly this.
- **Register the catch-all route FIRST.** Playwright matches routes in reverse registration order.

- [ ] **Step 3: Run it and look at every sheet**

```bash
cd frontend && npm run dev &
cd frontend && TABLEAU_WIDTHS=1920 node scripts/bobit-tableau.mjs
cd frontend && TABLEAU_WIDTHS=1440 node scripts/bobit-tableau.mjs
cd frontend && TABLEAU_WIDTHS=1280 node scripts/bobit-tableau.mjs
```

**Open the images.** Every defect in this feature that mattered was found this way with the unit tests green: a T-pose clap, heads clipped on mobile, a tree shaped like a mushroom, an invisible branch, three bobits floating in mid-air. Specifically check: nothing crosses into the question column at any width; the two stacks are the same scale; the curl reads as leaves rather than as a scribble; no perched bobit is sunk into the wood or floating above it; both themes.

- [ ] **Step 4: Retire the scripts the new one replaces**

`bobit-tree.mjs` shoots a tree that no longer exists and `bobit-milestone.mjs` drives a 25% crossing that is no longer a thing. Delete them only now, after `bobit-tableau.mjs` has produced sheets you have actually looked at — they are the model it was built from, and deleting them in Task 12 would have taken the reference away before it was used.

```bash
cd frontend && git rm scripts/bobit-tree.mjs scripts/bobit-milestone.mjs
grep -rn "bobit-tree\|bobit-milestone" frontend/ docs/ --include=*.md --include=*.json --include=*.mjs
```
Fix any surviving reference the grep finds (`HANDOFF-bobits.md` §5 lists both in its script table).

- [ ] **Step 5: Commit**

```bash
git add -A frontend/scripts frontend/src docs
git commit -m "test(tableau): 26-state contact sheets and a curl strip

Retires bobit-tree.mjs and bobit-milestone.mjs with them: both drive scenery
that no longer exists."
```

---

# PHASE 2 — The crew builds it

Phase 1 ships a tableau whose lines appear fully built. Phase 2 makes bobits put them up.

---

### Task 14: Worksite activities and the job claim

**Files:**
- Modify: `frontend/src/features/collection/crowdAgents.ts`
- Create: `frontend/src/features/collection/__tests__/assignJob.test.ts`

**Interfaces:**
- Consumes: `Agent`, `AgentOpts`, `startMove`.
- Produces: `Activity` gains `'hauling' | 'raising' | 'lashing'`; `Agent` gains `jobId?: string`, `jobRole?: 'hauler' | 'steadier' | 'lasher'`, `jobT?: number`; `function assignJob(state, jobId, roles, atX, opts): AgentState`; `function releaseJob(state, jobId): AgentState`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/__tests__/assignJob.test.ts
import { describe, it, expect } from 'vitest';
import { assignJob, releaseJob, initAgents } from '../crowdAgents';
import { bandFor } from '../crowdLayout';

const band = bandFor(false);
const opts = {
  band, width: 1000, greeting: new Set<string>(), frozen: false,
  rand: () => 0.5,
};

describe('assignJob', () => {
  it('casts exactly as many workers as the job has roles', () => {
    const before = initAgents(['a', 'b', 'c', 'd'], opts);
    const after = assignJob(before, 'line:9', ['hauler', 'steadier'], 100, opts);
    const cast = Object.keys(after).filter(id => after[id].jobId === 'line:9');
    expect(cast).toHaveLength(2);
    expect(cast.map(id => after[id].jobRole).sort()).toEqual(['hauler', 'steadier']);
  });

  it('casts nobody at all rather than a short crew', () => {
    const before = initAgents(['a'], opts);
    const after = assignJob(before, 'line:9', ['hauler', 'steadier', 'lasher'], 100, opts);
    expect(after).toBe(before);
  });

  it('never casts a bobit who is already on a job, perched or climbing', () => {
    let s = initAgents(['a', 'b', 'c', 'd'], opts);
    s = assignJob(s, 'line:1', ['hauler'], 100, opts);
    s = { ...s, b: { ...s.b, activity: 'perch', perchId: 'tableau:right:6' } };
    const after = assignJob(s, 'line:2', ['hauler', 'steadier'], 100, opts);
    const cast = Object.keys(after).filter(id => after[id].jobId === 'line:2');
    expect(cast).toHaveLength(2);
    for (const id of cast) {
      expect(id).not.toBe('b');
      expect(after[id].jobId).toBe('line:2');
    }
  });

  it('walks the crew to the site rather than teleporting them', () => {
    const before = initAgents(['a', 'b'], opts);
    const after = assignJob(before, 'line:9', ['hauler'], 400, opts);
    const worker = Object.values(after).find(a => a.jobId === 'line:9');
    expect(worker?.activity).toBe('moving');
    expect(worker?.targetX).toBe(400);
  });
});

describe('releaseJob', () => {
  it('returns the whole crew to wandering, with nothing left claimed', () => {
    const before = initAgents(['a', 'b', 'c'], opts);
    const working = assignJob(before, 'line:9', ['hauler', 'steadier'], 100, opts);
    const after = releaseJob(working, 'line:9');
    for (const id of Object.keys(after)) {
      expect(after[id].jobId).toBeUndefined();
      expect(after[id].jobRole).toBeUndefined();
      expect(after[id].activity).toBe('wander');
    }
  });

  it('leaves a different job\'s crew alone', () => {
    let s = initAgents(['a', 'b', 'c', 'd'], opts);
    s = assignJob(s, 'line:1', ['hauler'], 100, opts);
    s = assignJob(s, 'line:2', ['hauler'], 200, opts);
    const after = releaseJob(s, 'line:1');
    expect(Object.values(after).filter(a => a.jobId === 'line:2')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/assignJob.test.ts`
Expected: FAIL — `assignJob is not exported`

- [ ] **Step 3: Implement**

Extend the `Activity` union and the `Agent` interface, then add:

```ts
export type JobRole = 'hauler' | 'steadier' | 'lasher';

/**
 * Cast a crew for one line.
 *
 * ALL OR NOTHING. A half-cast crew means a beam raising itself with one bobit watching, which
 * reads as a bug rather than as a short-handed site -- so if there are not enough idle bobits
 * the job simply does not start this frame and tries again next.
 *
 * Claimed with exactly the discipline `assignPerch` uses for a branch: the claim lands the
 * instant they set off walking, which is what stops two jobs recruiting the same bobit, and it
 * is held until `releaseJob`. The failure mode of releasing early is already understood here:
 * a branch released early gets two occupants.
 *
 * They WALK to the site. "No bobit ever teleports" is the one rule the spec restates as
 * load-bearing, and at a tableau's height a teleport is a very visible one.
 */
export function assignJob(
  state: AgentState, jobId: string, roles: readonly JobRole[], atX: number, opts: AgentOpts,
): AgentState {
  const free = Object.keys(state)
    .filter(id => state[id].activity === 'wander' && !state[id].perchId && !state[id].jobId)
    .sort();
  if (free.length < roles.length) return state;

  // Nearest first, so the crew that turns up is the one that was already standing there.
  const picked = free
    .sort((a, b) => Math.abs(state[a].x - atX) - Math.abs(state[b].x - atX))
    .slice(0, roles.length);

  const out = { ...state };
  picked.forEach((id, i) => {
    out[id] = {
      ...startMove(state[id], atX, 0, opts),
      jobId,
      jobRole: roles[i],
      jobT: 0,
    };
  });
  return out;
}

/** Hand the whole crew back to the floor. Only called when the line is permanent. */
export function releaseJob(state: AgentState, jobId: string): AgentState {
  let out: AgentState | null = null;
  for (const id of Object.keys(state)) {
    if (state[id].jobId !== jobId) continue;
    out ??= { ...state };
    out[id] = {
      ...state[id],
      activity: 'wander',
      jobId: undefined,
      jobRole: undefined,
      jobT: undefined,
    };
  }
  return out ?? state;
}
```

In `agentsAdvance`, add a branch that advances `jobT` for `hauling`/`raising`/`lashing` agents and leaves their position to the build sequence — the same way the director's cast is held out of `wanderAdvance`, so the two cannot fight over where a worker is. In `agentAnim`, map the three new activities to `hefty`, `heave` and `climb` respectively.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npx vitest run src/features/collection && npx tsc --noEmit -p .
```
Expected: PASS once `canvasOf` has been extended, below.

**`canvasOf` must learn about jobs, and this is where it does.**

A worker is drawn on his stack's **margin canvas** from the moment work starts, not on the band — `crewAt` returns margin-canvas coordinates, and splitting one job across two canvases mid-raise is exactly the double-paint the partition exists to prevent. While he is still *walking* to the site his activity is `moving` and he is a band figure; the handover happens at the phase change. It is continuous rather than a teleport because the canvas's bottom edge is the band's floor line and the canvas abuts the band.

So `jobId` carries its side — `job:left:9`, `job:right:14` — and `canvasOf` gains a first clause:

```ts
// A worker ON the site is his stack's canvas's business. One still walking to it is the
// band's. `jobId` carries the side because the agent has no other way to say which stack
// he is working on, and a partition that has to guess is not a partition.
if (a.activity === 'hauling' || a.activity === 'raising' || a.activity === 'lashing') {
  return a.jobId?.startsWith('job:left:') ? 'left' : 'right';
}
```

Extend `canvasOf.test.ts`'s `activities` array with the three new values and its `perchIds` array with `'job:left:9'` and `'job:right:14'`, so the totality sweep stays exhaustive, and add:

```ts
it('draws a worker on his own stack, and a worker still walking there on the band', () => {
  const working = agent({ activity: 'raising', jobId: 'job:left:9' });
  expect(canvasOf(working, [], [])).toBe('left');
  expect(canvasOf(agent({ activity: 'raising', jobId: 'job:right:14' }), [], [])).toBe('right');
  // Claimed, not yet arrived: still the band's.
  expect(canvasOf(agent({ activity: 'moving', jobId: 'job:left:9' }), [], [])).toBe('band');
});
```

Note this clause does **not** consult the surface lists: a job's line is under construction and has no `Surface` yet, so there is nothing to look it up in. That is the one place `canvasOf` trusts the agent rather than the scenery, and it is safe because `releaseJob` is the only thing that clears `jobId`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/crowdAgents.ts frontend/src/features/collection/__tests__/
git commit -m "feat(tableau): a crew is claimed and released like a branch"
```

---

### Task 15: The build sequence

**Files:**
- Create: `frontend/src/features/collection/tableau/buildSequence.ts`
- Test: `frontend/src/features/collection/tableau/__tests__/buildSequence.test.ts`

**Interfaces:**
- Consumes: `TableauLine`, `BLUEPRINT`; `lineEndpoints`.
- Produces: `type BuildPhase = 'fetch' | 'haul' | 'raise' | 'lash' | 'payout' | 'curl' | 'done'`; `const BUILD_SEC`; `interface Worker { role: JobRole; x: number; groundY: number; anim: string; flip: boolean }`; `function buildDuration(line): number`; `function phaseAt(line, t): { phase: BuildPhase; k: number }`; `function lineAt(line, t, ox, floorY, scale): { x1; y1; x2; y2 } | null`; `function crewRolesFor(line): JobRole[]`; `function siteX(side, bandWidth): number`; `function crewAt(line, t, ox, floorY, scale): Worker[]`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/collection/tableau/__tests__/buildSequence.test.ts
import { describe, it, expect } from 'vitest';
import { phaseAt, lineAt, buildDuration, BUILD_SEC } from '../buildSequence';
import { BLUEPRINT } from '../blueprint';
import { lineEndpoints, originX } from '../tableauGeometry';

const W = 432, FLOOR = 868, S = 0.868;
const OX = originX('right', W, S);
const trunk = BLUEPRINT[4];        // line 5, a ground stick
const branch = BLUEPRINT[5];       // line 6, lashed above the ground
const canopy = BLUEPRINT[8];       // line 9, the string

describe('phaseAt', () => {
  it('runs a ground stick through fetch, haul, raise, lash, done', () => {
    const d = buildDuration(trunk);
    expect(phaseAt(trunk, 0).phase).toBe('fetch');
    expect(phaseAt(trunk, BUILD_SEC.fetch + 0.1).phase).toBe('haul');
    expect(phaseAt(trunk, BUILD_SEC.fetch + BUILD_SEC.haul + 0.1).phase).toBe('raise');
    expect(phaseAt(trunk, d - 0.1).phase).toBe('lash');
    expect(phaseAt(trunk, d).phase).toBe('done');
    expect(phaseAt(trunk, d + 100).phase).toBe('done');
  });

  it('hoists a line whose joint is off the ground instead of hauling it', () => {
    expect(phaseAt(branch, BUILD_SEC.fetch + 0.1).phase).toBe('raise');
  });

  it('pays the string out and curls it, never raising it', () => {
    const d = buildDuration(canopy);
    expect(phaseAt(canopy, BUILD_SEC.fetch + 0.1).phase).toBe('payout');
    expect(phaseAt(canopy, d - 0.1).phase).toBe('curl');
    expect(phaseAt(canopy, d).phase).toBe('done');
  });

  it('reports k as 0..1 within every phase', () => {
    for (let t = 0; t <= buildDuration(trunk); t += 0.25) {
      const { k } = phaseAt(trunk, t);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });
});

describe('lineAt', () => {
  it('shows nothing before the crew has fetched it', () => {
    expect(lineAt(trunk, 0, OX, FLOOR, S)).toBeNull();
  });

  it('carries a ground line flat along the floor', () => {
    const t = BUILD_SEC.fetch + BUILD_SEC.haul * 0.5;
    const e = lineAt(trunk, t, OX, FLOOR, S);
    expect(e).not.toBeNull();
    expect(Math.abs((e as NonNullable<typeof e>).y1 - (e as NonNullable<typeof e>).y2))
      .toBeLessThan(2);
  });

  it('pivots about endpoint 1, which never moves during the raise', () => {
    const final = lineEndpoints(trunk, OX, FLOOR, S);
    const start = BUILD_SEC.fetch + BUILD_SEC.haul;
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const e = lineAt(trunk, start + BUILD_SEC.raise * k, OX, FLOOR, S);
      expect((e as NonNullable<typeof e>).x1, `joint x at k=${k}`).toBeCloseTo(final.x1, 5);
      expect((e as NonNullable<typeof e>).y1, `joint y at k=${k}`).toBeCloseTo(final.y1, 5);
    }
  });

  /**
   * THE ONE THAT MATTERS. The end of the animation must equal the blueprint EXACTLY. Anything
   * else leaves the line settled a few pixels off its own joint -- which is how the margin
   * tree's branch rect and its Surface came to disagree by half a trunk width, putting a
   * sitter inside the wood.
   */
  it('ends exactly where the blueprint says, for every line', () => {
    for (const line of BLUEPRINT) {
      if (line.kind === 'string') continue;        // the curl has no endpoint to land on
      const ox = originX(line.side, W, S);
      const want = lineEndpoints(line, ox, FLOOR, S);
      const got = lineAt(line, buildDuration(line), ox, FLOOR, S);
      expect(got, `line ${line.n}`).not.toBeNull();
      const e = got as NonNullable<typeof got>;
      expect(e.x1, `line ${line.n} x1`).toBeCloseTo(want.x1, 6);
      expect(e.y1, `line ${line.n} y1`).toBeCloseTo(want.y1, 6);
      expect(e.x2, `line ${line.n} x2`).toBeCloseTo(want.x2, 6);
      expect(e.y2, `line ${line.n} y2`).toBeCloseTo(want.y2, 6);
    }
  });

  it('never puts a line outside the canvas at any point in its build', () => {
    for (const line of BLUEPRINT) {
      if (line.kind === 'string') continue;
      const ox = originX(line.side, W, S);
      const d = buildDuration(line);
      for (let t = 0; t <= d; t += d / 40) {
        const e = lineAt(line, t, ox, FLOOR, S);
        if (!e) continue;
        for (const x of [e.x1, e.x2]) {
          expect(x, `line ${line.n} at t=${t.toFixed(1)}`).toBeGreaterThanOrEqual(-40);
          expect(x, `line ${line.n} at t=${t.toFixed(1)}`).toBeLessThanOrEqual(W + 40);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/tableau/__tests__/buildSequence.test.ts`
Expected: FAIL — `Cannot find module '../buildSequence'`

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/collection/tableau/buildSequence.ts
import type { TableauLine } from './blueprint';
import { lineEndpoints } from './tableauGeometry';

/**
 * How a line gets from nowhere to standing.
 *
 * SCRIPTED, not simulated. An emergent worksite would produce better accidents and worse
 * software: this codebase's primary defence is the contact sheet, and you cannot screenshot-
 * verify a scene that is different every time. A script samples identically on every run, so
 * `bobit-tableau.mjs` can show the same raise at the same ten instants forever.
 *
 * The clock is the worksite's OWN and is not gated on game phase. The crew keeps working while
 * the timer runs -- that is what makes the margin a place rather than an event.
 */
export type BuildPhase = 'fetch' | 'haul' | 'raise' | 'lash' | 'payout' | 'curl' | 'done';

export const BUILD_SEC = {
  fetch: 3,
  haul: 4,
  raise: 3.5,
  lash: 3.5,
  payout: 4.5,
  curl: 6,
} as const;

/** A line lashed above this height is hoisted on a rope rather than carried and pivoted. */
const GROUND_JOINT_UNITS = 1;

function isGroundLine(line: TableauLine): boolean {
  return line.y1 <= GROUND_JOINT_UNITS;
}

export function buildDuration(line: TableauLine): number {
  if (line.kind === 'string') return BUILD_SEC.fetch + BUILD_SEC.payout + BUILD_SEC.curl;
  return isGroundLine(line)
    ? BUILD_SEC.fetch + BUILD_SEC.haul + BUILD_SEC.raise + BUILD_SEC.lash
    : BUILD_SEC.fetch + BUILD_SEC.raise + BUILD_SEC.lash;
}

/** Which phase the clock is in, and how far through it. */
export function phaseAt(line: TableauLine, t: number): { phase: BuildPhase; k: number } {
  const order: Array<[BuildPhase, number]> = line.kind === 'string'
    ? [['fetch', BUILD_SEC.fetch], ['payout', BUILD_SEC.payout], ['curl', BUILD_SEC.curl]]
    : isGroundLine(line)
      ? [['fetch', BUILD_SEC.fetch], ['haul', BUILD_SEC.haul],
         ['raise', BUILD_SEC.raise], ['lash', BUILD_SEC.lash]]
      : [['fetch', BUILD_SEC.fetch], ['raise', BUILD_SEC.raise], ['lash', BUILD_SEC.lash]];

  let left = Math.max(0, t);
  for (const [phase, dur] of order) {
    if (left < dur) return { phase, k: dur > 0 ? left / dur : 1 };
    left -= dur;
  }
  return { phase: 'done', k: 1 };
}

/** Ease in and out, so the line leans into the lift and settles out of it. */
function smoothstep(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/**
 * Where the line is drawn this frame, or null while it does not exist yet.
 *
 * THE PIVOT IS ENDPOINT 1, always, because endpoint 1 is the joint -- the end that is lashed.
 * Pivoting about the free end would swing the joint through the air and plant the wrong end on
 * the wood. `blueprint.test.ts` guarantees endpoint 1 touches the anchor; this is what cashes
 * that guarantee in.
 *
 * At `t >= buildDuration` the result is EXACTLY `lineEndpoints`, not an approximation of it. A
 * line that settles three pixels off its own joint is the same defect that once sank a sitter
 * into a branch.
 */
export function lineAt(
  line: TableauLine, t: number, ox: number, floorY: number, scale: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const final = lineEndpoints(line, ox, floorY, scale);
  const { phase, k } = phaseAt(line, t);
  if (phase === 'fetch') return null;
  if (phase === 'done' || phase === 'lash' || phase === 'curl') return final;

  const len = Math.hypot(final.x2 - final.x1, final.y2 - final.y1);
  // Flat on the floor, lying away from the stack's centre so it is not inside the structure.
  const dir = final.x2 >= final.x1 ? 1 : -1;
  const flat = { x1: final.x1, y1: floorY, x2: final.x1 + dir * len, y2: floorY };

  if (phase === 'haul') {
    // Dragged in from off the canvas's near edge to the joint's x, still flat.
    const from = dir > 0 ? -len : ox + len;
    const x1 = from + (flat.x1 - from) * smoothstep(k);
    return { x1, y1: floorY, x2: x1 + dir * len, y2: floorY };
  }

  if (phase === 'payout') {
    // A string does not pivot: it follows the climber up, from the floor to the crown.
    const y1 = floorY + (final.y1 - floorY) * smoothstep(k);
    return { x1: final.x1, y1, x2: final.x1, y2: y1 };
  }

  // raise: rotate about endpoint 1, from flat to final.
  const a0 = Math.atan2(flat.y2 - flat.y1, flat.x2 - flat.x1);
  const a1 = Math.atan2(final.y2 - final.y1, final.x2 - final.x1);
  const a = a0 + (a1 - a0) * smoothstep(k);
  return {
    x1: final.x1,
    y1: isGroundLine(line) ? floorY + (final.y1 - floorY) * smoothstep(k) : final.y1,
    x2: final.x1 + Math.cos(a) * len,
    y2: (isGroundLine(line) ? floorY + (final.y1 - floorY) * smoothstep(k) : final.y1)
        + Math.sin(a) * len,
  };
}
```

Then the crew, in the same file:

```ts
import type { JobRole } from '../crowdAgents';
import type { StackSide } from './blueprint';

export interface Worker {
  role: JobRole;
  /** Margin-canvas px. */
  x: number;
  /** The worker's ground-contact line, in margin-canvas px. */
  groundY: number;
  anim: string;
  flip: boolean;
}

/**
 * Who a line needs.
 *
 * A ground line is carried and pivoted by two. Anything lashed above head height needs a third
 * on the structure to receive it -- which is the whole point of the upward rule: a bobit has to
 * climb in order to work, because he is building above his own head.
 */
export function crewRolesFor(line: TableauLine): JobRole[] {
  return isGroundLine(line) || line.kind === 'string'
    ? ['hauler', 'steadier']
    : ['hauler', 'steadier', 'lasher'];
}

/**
 * Where the crew gathers ON THE BAND, in band px.
 *
 * NOT the joint's x. The joint is in the margin canvas's coordinates and the crew walks on the
 * band, which is a different box -- the left canvas starts at the shell's content edge and the
 * right one ends at it. Handing `assignJob` a canvas x would send the crew to a point in the
 * middle of the question column. They gather at the band's own edge, under the stack.
 */
export function siteX(side: StackSide, bandWidth: number): number {
  return side === 'left' ? bandWidth * 0.04 : bandWidth * 0.96;
}

/**
 * Where each worker stands this frame, in the MARGIN CANVAS's coordinates.
 *
 * The canvas's bottom edge IS the band's floor line, and the canvas abuts the band, so a
 * worker handed over from the band at the end of `fetch` continues from where he was standing
 * rather than jumping. That continuity is the reason `canvasOf` moves him at the phase change
 * and not at the claim.
 *
 * Poses are chosen by what their frame function DOES, never by name -- `fall` is a seated
 * sprawl and `peek` looks down, and both have shipped wrong here once. `hefty` is the heavy
 * haul with a measured sag onto the weight-bearing leg; `heave` is a straight-back hinge that
 * folds deep and lifts; `offer` holds something out at arm's length; `climb` ratchets limbs
 * upward.
 */
export function crewAt(
  line: TableauLine, t: number, ox: number, floorY: number, scale: number,
): Worker[] {
  const { phase, k } = phaseAt(line, t);
  if (phase === 'fetch' || phase === 'done') return [];

  const e = lineAt(line, t, ox, floorY, scale);
  if (!e) return [];
  const final = lineEndpoints(line, ox, floorY, scale);
  const toward = final.x2 >= final.x1 ? 1 : -1;

  // The steadier stands at the joint for the whole job, holding it true.
  const steadier: Worker = {
    role: 'steadier',
    x: final.x1 - toward * 14 * scale,
    groundY: phase === 'haul' ? floorY : Math.min(floorY, final.y1 + 2),
    anim: phase === 'haul' ? 'hefty' : 'offer',
    flip: toward < 0,
  };

  // The hauler is at the moving end: dragging it in, then heaving it up.
  const hauler: Worker = {
    role: 'hauler',
    x: e.x2,
    groundY: phase === 'haul' || phase === 'payout' ? floorY : Math.min(floorY, e.y2 + 2),
    anim: phase === 'haul' ? 'hefty' : phase === 'payout' ? 'climb' : 'heave',
    flip: toward > 0,
  };

  const out = [steadier, hauler];

  // The lasher climbs to receive the line, and only exists for a line lashed above the ground.
  if (crewRolesFor(line).includes('lasher')) {
    out.push({
      role: 'lasher',
      x: final.x1 + toward * 10 * scale,
      groundY: final.y1,
      anim: phase === 'lash' ? 'offer' : 'climb',
      flip: toward < 0,
    });
  }
  void k;
  return out;
}
```

**A roped worker must be positioned explicitly** if `rope` is ever used here — `fieldGeometry.ts` leaves it out of `pelvisOffset` on purpose, because that figure hangs from his hands and has no ground contact, so neither the standing (112) nor the seated (8) offset describes him. `crewAt` above uses `climb` instead, which is a standing pose and positions normally.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/collection/tableau`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/tableau/buildSequence.ts frontend/src/features/collection/tableau/__tests__/buildSequence.test.ts
git commit -m "feat(tableau): haul, hoist, raise, lash, curl"
```

---

### Task 16: Run the worksite, then verify everything

**Files:**
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`
- Modify: `frontend/src/features/collection/tableau/TableauMargin.tsx` (take an in-progress line)
- Modify: `frontend/scripts/bobit-tableau.mjs` (add the build strips)

- [ ] **Step 1: Add the worksite clock to the crowd**

A `siteRef` holds `{ n, t } | null` — the line being built and its clock. Each frame:

```ts
// The worksite advances on its own clock, not the game's. It is deliberately NOT gated on
// reducedMotion's motion skip in the same way the crowd is: a player on reduced motion still
// gets the line, it simply appears rather than being carried in.
const target = builtRef.current;
const site = siteRef.current;
if (site === null && shownRef.current < target) {
  const next = BLUEPRINT[shownRef.current];      // the line about to go up
  siteRef.current = { n: next.n, t: 0 };
  agentsRef.current = assignJob(
    agentsRef.current,
    `job:${next.side}:${next.n}`,
    crewRolesFor(next),
    // BAND coordinates, not the joint's -- `siteX` exists because those are different boxes
    // and handing this a canvas x sends the crew into the middle of the question column.
    siteX(next.side, measured),
    opts,
  );
} else if (site !== null) {
  const line = BLUEPRINT[site.n - 1];
  const t = site.t + dt;
  if (t >= buildDuration(line)) {
    agentsRef.current = releaseJob(agentsRef.current, `job:${line.side}:${line.n}`);
    shownRef.current = line.n;
    siteRef.current = null;
  } else {
    siteRef.current = { n: site.n, t };
  }
}
```

**REVIEW FOCUS 3** lives here. `shownRef` starts at `linesBuilt(peak)` on mount, not at 0: a returning player with 60 bobits must find fifteen lines *standing*, not watch fifteen build sequences run back to back for three and a half minutes. Only lines earned **during this session** are built on camera. Seed it in the same effect that sets `builtRef`:

```ts
// First read for this collection: everything already earned is already standing. Only what
// is earned from here on is worth watching go up.
if (shownSlugRef.current !== slugNow) {
  shownSlugRef.current = slugNow;
  shownRef.current = builtRef.current;
  siteRef.current = null;
}
```

- [ ] **Step 2: Write the failing test for the jump**

```ts
// append to frontend/src/features/collection/tableau/__tests__/tableauProgress.test.ts
import { linesStandingOnArrival } from '../tableauProgress';

describe('REVIEW FOCUS 3 — a player who returns having earned a lot', () => {
  it('finds everything already earned already standing', () => {
    // 60 bobits is 15 lines. None of them should queue a build sequence.
    expect(linesStandingOnArrival(60)).toBe(15);
    expect(linesStandingOnArrival(100)).toBe(25);
    expect(linesStandingOnArrival(0)).toBe(0);
  });
});
```

Add to `tableauProgress.ts`:

```ts
/**
 * What is already up the moment a collection is opened.
 *
 * Everything earned before this session is simply STANDING. Playing fifteen build sequences
 * back to back for a returning player would take three and a half minutes of a match in which
 * they earned none of it, and `&tableau=25` would do the same to a contact sheet. Only lines
 * earned on camera are built on camera.
 */
export function linesStandingOnArrival(peak: number): number {
  return linesBuilt(peak);
}
```

- [ ] **Step 3: Draw the line under construction**

`drawTableau` gains a trailing optional parameter — appended, so no existing call site changes:

```ts
export function drawTableau(
  ctx: CanvasRenderingContext2D,
  side: StackSide, built: number,
  ox: number, floorY: number, scale: number,
  color: string, leafColor: string,
  /** The line currently going up, if its stack is this one. Drawn after the finished lines. */
  site?: { line: TableauLine; t: number } | null,
): void {
  // …existing loop over linesFor(side, built)…
  if (!site || site.line.side !== side) { ctx.restore(); return; }
  if (site.line.kind === 'string') {
    const { phase, k } = phaseAt(site.line, site.t);
    if (phase === 'curl') drawCurl(ctx, site.line, ox, floorY, scale, leafColor, k);
    // During `payout` the string is a plain line following the climber; `lineAt` has it.
  }
  const e = lineAt(site.line, site.t, ox, floorY, scale);
  if (e) drawStickBetween(ctx, e, site.line, scale, color);
  ctx.restore();
}
```

Factor the quad out of `drawStick` into `drawStickBetween(ctx, endpoints, line, scale, color)` so the finished draw and the in-flight draw share **one** definition of the shape. Two definitions of one piece of geometry is how the margin tree's draw and its surfaces drifted by half a trunk width.

`TableauMargin` gains `siteFor: () => { line: TableauLine; t: number } | null` and passes its result through `propsFor` onto the prop. A **callback**, per the global constraints — the build clock is per-frame, and a value prop is frozen at the last React render.

`FieldProp` gains `site?: { line: TableauLine; t: number } | null`, and `BobitField`'s `tableau` branch forwards `p.site`.

- [ ] **Step 4: Run everything**

```bash
cd frontend && npx tsc --noEmit -p .
cd frontend && npx vitest run
cd frontend && npm run smoke
```

All three must pass. `npm run smoke` is not optional: a green build is not a page load, and a bundler-level break here would white-screen the game.

- [ ] **Step 5: Re-earn the visual verification**

```bash
cd frontend && npm run dev &
cd frontend && TABLEAU_WIDTHS=1920 node scripts/bobit-tableau.mjs
cd frontend && TABLEAU_WIDTHS=1440 node scripts/bobit-tableau.mjs
cd frontend && TABLEAU_WIDTHS=1280 node scripts/bobit-tableau.mjs
cd frontend && node scripts/bobit-recap.mjs
cd frontend && node scripts/bobit-bench.mjs
```

Drive a **real crossing** the player's way — `?mock=1&collection=milwaukee-wi&owned=15`, answer A, Next, answer A — so line 4 goes up on camera. Do not use a synthetic replay: `__bobitScene` passes an id that never becomes a resident, and a tool built to find this class of bug can be structurally unable to show it.

Check, with your eyes:
- nothing crosses into the question column at any width, in either theme;
- the raise pivots about the joint, and the crew does not let go early;
- the curl reads as leaves;
- nobody is sunk into the wood, floating above it, or T-posing;
- the recap shows both stacks;
- `bobit-bench.mjs` still clears 16.7ms at 100 residents with both margins mounted. `CROWD_CAP` was a **measured** ceiling; if this pass has eaten the headroom, re-derive it rather than inheriting it.

- [ ] **Step 6: Commit and open the PR**

```bash
git add -A frontend
git commit -m "feat(tableau): the crew builds the tableau on camera"
git push -u origin feat/bobit-tableau
gh pr create --base master --title "feat(bobits): the collection tableau" --body "…"
```

The PR must state the bench result and link the contact sheets. Merging to `master` is a production deploy — there is no staging.

---

## Self-review notes

- **Spec coverage.** §2.1 → Task 3; §2.2 → Task 1; §2.3 → Task 1; §2.4 strings → Tasks 1, 5, 15; §2.5 (no bridge) → nothing to build; §3 → Task 2; §4.1 → Task 15; §4.2 → Task 14; §4.3 poses → Tasks 14, 15; §4.4 → the File Structure table; §5.1 → Tasks 8, 10; §5.2 → Task 7; §5.3 → Tasks 8, 16; §5.4 → Task 9; §6 → Task 11; §7 → Task 3's bound tests; §8.1 → every task's tests; §8.2 → Tasks 13, 16; §8.3 → Task 13; §8.4 → Task 16; §9 → Task 12.
- **Review Focus coverage.** 1 → Task 3; 2 → Task 7; 3 → Task 16; 4 → Tasks 3 and 7; 5 → Task 2. All five have a test in the task that owns the code.
- **Known deviation from the spec, deliberate.** The spec's §2.3 glosses the treehouse as "two joists, deck, rail"; the blueprint authors it as "deck, two posts, rail", because two parallel joists do not read in a flat side-on view. The line count and milestone are unchanged.

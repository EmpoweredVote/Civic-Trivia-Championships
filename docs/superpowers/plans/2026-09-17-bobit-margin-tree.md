# Margin Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 25% milestone tree out of the 96px crowd band and into the page margin beside the question column, at roughly ten times its current height, with three branches bobits climb.

**Architecture:** A third canvas — `<TreeMargin>` — absolutely positioned inside GameScreen's existing `relative` container, anchored to the band's floor line, sized from the *measured* right margin. Because its box is derived from the measured column edge it cannot overlap the question card, which keeps bound 1 of the occlusion relaxation a geometric fact rather than a convention. The tree and its climbers draw there at a scale of their own; the crowd stays on the band untouched. Today's in-band tree is kept, unmodified, as the fallback on narrow viewports.

**Tech Stack:** React 18, TypeScript, canvas 2D, vitest 4.1.11 (node environment), Playwright for contact sheets.

**Spec:** `docs/superpowers/specs/2026-09-17-bobit-margin-tree-design.md`

## Global Constraints

- **`environment: 'node'`.** `frontend/vitest.config.ts` runs no DOM and no canvas. Every test in this plan exercises a pure function. There is no component test, no `render()`, no jsdom. Do not add jsdom. Task 8's React wiring is gated by the screenshot pass in Task 9 — that is deliberate, not an omission.
- **Test glob is `src/**/*.test.ts`.** A test outside `src/` or named `.spec.ts` will not run.
- **Bound 1 of the occlusion relaxation is NOT widened.** Nothing the tree draws, and nobody in it, may cross the question column's right edge, at any viewport width. If an implementation choice makes that hard to hold, stop and ask — do not relax it.
- **Bounds 2, 3 and 4 are untouched.** This work adds no `layer: 'air'` beat, changes no aerial gate, and adds no pool entrance.
- **The in-band tree is frozen.** `drawTree`, `treeSurfaces`, `treeX`, `TREE_TRUNK_H` (300), `TREE_HALF_W` (90), `TREE_LEDGE_UP` (250) keep their behaviour and values. The fallback path draws through them.
- **No seated pose on a beat that leaves the ground.** The standing and seated pelvis offsets are 104 units apart and `figureBounds` measures from the BASE anim while paint positions with the RESOLVED one. Ask `pelvisOffset()`; never hardcode 112. This trap has been recorded four times in this feature.
- **`armRU`/`armRF` are absolute from the body, 0° = straight DOWN, and `armRF` is NOT an elbow bend.** Reading it as one has produced a T-pose three times. No task here authors a new pose, which is the cheapest way to avoid a fourth.
- **Mobile is untouched.** No margin, no tree, `TREE_MILESTONE_MOBILE` still fires.
- **Commands:** `npm test` (full suite), `npx vitest run <path>` (one file), `npm run typecheck`, `npm run build`, `npm run smoke`. All from `frontend/`.
- **CI job names must not be renamed.** The `master` ruleset matches them by name; a rename silently stops the required checks from ever reporting.

---

### Task 1: The margin box, and the scale derived from it

The one pure function that decides how big the tree is, and whether there is room for it at all. Everything downstream takes its scale from here.

**Files:**
- Modify: `frontend/src/features/collection/treePlacement.ts`
- Test: `frontend/src/features/collection/__tests__/treePlacement.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface MarginBox { width: number; height: number }` — in `treePlacement.ts`
  - `MIN_TREE_MARGIN = 140` — in `treePlacement.ts`
  - `treeScale(box: MarginBox | null): number | null` — null means "no room, use the in-band tree"
  - `MARGIN_TREE_RIG_H = 1000`, `MARGIN_TREE_HALF_W = 200` — in **`props.ts`**, beside the rest of the rig

**Import direction.** `treePlacement.ts` already imports `TREE_HALF_W` from `props.ts`, so the
two rig constants live in `props.ts` and `treePlacement` imports them. Putting them in
`treePlacement` and importing them back into `props` would close a cycle — and would also have
a component importing from `features/`, which nothing in `components/bobbits/` does.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/collection/__tests__/treePlacement.test.ts`:

```ts
import { treeScale, MIN_TREE_MARGIN } from '../treePlacement';
import { MARGIN_TREE_RIG_H, MARGIN_TREE_HALF_W } from '../../../components/bobbits/props';

/**
 * The real margins, computed once from the layout rather than guessed: the HUD, the card and
 * the buttons all share one `maxWidth: clamp(700px, 55vw, 1500px)`, `mx-auto` column inside a
 * container padded `px-4 sm:px-6`. So the margin either side is
 * (inner - column) / 2, where inner = viewport - 2 * padding.
 */
const MARGINS = [
  { vw: 1920, margin: 432, height: 868 },
  { vw: 1440, margin: 372, height: 640 },
  { vw: 1280, margin: 264, height: 560 },
  { vw: 1024, margin: 138, height: 520 },   // just under MIN_TREE_MARGIN
];

describe('treeScale', () => {
  it('has no opinion when there is no measured box yet', () => {
    expect(treeScale(null)).toBeNull();
  });

  it('gives up below the minimum margin, so the in-band tree takes over', () => {
    expect(treeScale({ width: MIN_TREE_MARGIN - 1, height: 800 })).toBeNull();
    expect(treeScale({ width: 138, height: 520 })).toBeNull();
  });

  it('is height-bound on a wide desktop', () => {
    const s = treeScale({ width: 432, height: 868 });
    expect(s).toBeCloseTo(868 / MARGIN_TREE_RIG_H, 5);
  });

  it('is width-bound when the margin is the tighter of the two', () => {
    // A tall but narrow margin: 300px of width caps the scale below what the height allows.
    const s = treeScale({ width: 300, height: 2000 });
    expect(s).toBeCloseTo(300 / (MARGIN_TREE_HALF_W * 2), 5);
  });

  /**
   * The property that matters, asserted as a consequence rather than as arithmetic: whatever
   * scale comes back, the tree's whole footprint fits inside the margin it was measured from.
   * That is what keeps it off the question card.
   */
  it('always returns a scale whose footprint fits the box it was given', () => {
    for (const { vw, margin, height } of MARGINS) {
      const s = treeScale({ width: margin, height });
      if (s === null) continue;
      expect(MARGIN_TREE_HALF_W * 2 * s, `footprint at ${vw}px`).toBeLessThanOrEqual(margin);
      expect(MARGIN_TREE_RIG_H * s, `height at ${vw}px`).toBeLessThanOrEqual(height);
    }
  });

  it('never returns a non-positive or non-finite scale', () => {
    for (const box of [{ width: 0, height: 0 }, { width: -5, height: 800 },
                       { width: 400, height: 0 }]) {
      const s = treeScale(box);
      if (s !== null) {
        expect(s).toBeGreaterThan(0);
        expect(Number.isFinite(s)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/treePlacement.test.ts`
Expected: FAIL — `treeScale` is not exported from `../treePlacement`.

- [ ] **Step 3: Add the two rig constants to `props.ts`**

These are the numbers `treeScale` divides by, so they land first. They go in `props.ts` beside
the rest of the rig — see "Import direction" above.

Append to `frontend/src/components/bobbits/props.ts`:

```ts
/**
 * Total height of the MARGIN tree's rig, floor line to top of canopy.
 *
 * Distinct from the in-band tree's `TREE_TRUNK_H` (300), which is frozen: that tree still ships
 * as the fallback under `MIN_TREE_MARGIN` and its constants must not move.
 */
export const MARGIN_TREE_RIG_H = 1000;

/** Half the margin tree's total ink footprint, in rig units. Its placement divides by this. */
export const MARGIN_TREE_HALF_W = 200;
```

- [ ] **Step 4: Write `treeScale`**

Append to `frontend/src/features/collection/treePlacement.ts`, extending its existing
`props` import to `import { TREE_HALF_W, MARGIN_TREE_RIG_H, MARGIN_TREE_HALF_W } from '../../components/bobbits/props';`:

```ts
/**
 * The empty strip beside the question column, in real measured pixels.
 *
 * MEASURED, never recomputed from `clamp(700px, 55vw, 1500px)`. Two reasons: `band.width` is a
 * nominal 1000 and using a nominal where real pixels are needed has caused two bugs in this
 * feature already; and the real margin is narrower than the arithmetic by the scrollbar, which
 * the question area has (`overflow-y-auto`) and which no clamp calculation knows about.
 */
export interface MarginBox {
  width: number;
  height: number;
}

/**
 * Below this much margin there is no margin tree, and the room falls back to the in-band one.
 *
 * A 1024px viewport lands at ~138px, so that is the real crossover. Two renderers is the
 * accepted cost -- see the spec's section 2. The in-band tree already ships; the cost is
 * carrying it, not building it.
 */
export const MIN_TREE_MARGIN = 140;

/**
 * How big the margin tree is, or null for "there is no room -- use the in-band tree".
 *
 * The smaller of the two fits, so the tree fills the space it has and NEVER leaves it. That
 * second half is what makes bound 1 of the occlusion relaxation geometric: a tree that cannot
 * outgrow its measured margin cannot reach the question card.
 */
export function treeScale(box: MarginBox | null): number | null {
  if (!box) return null;
  if (!(box.width >= MIN_TREE_MARGIN) || !(box.height > 0)) return null;
  const heightFit = box.height / MARGIN_TREE_RIG_H;
  const widthFit = box.width / (MARGIN_TREE_HALF_W * 2);
  const scale = Math.min(heightFit, widthFit);
  return scale > 0 && Number.isFinite(scale) ? scale : null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/treePlacement.test.ts`
Expected: PASS. The pre-existing `treeX` tests must still pass — they are untouched.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/components/bobbits/props.ts src/features/collection/treePlacement.ts src/features/collection/__tests__/treePlacement.test.ts
git commit -m "feat(bobits): derive the margin tree's scale from a measured box

The smaller of the height fit and the width fit, so the tree fills its
margin and cannot outgrow it. That second half is what keeps bound 1 of
the occlusion relaxation geometric rather than conventional.

Null below 140px of margin, where the in-band tree takes over.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The margin tree's rig, its three branches, and the bound-1 test

The tree itself, plus the test that means the standing instruction was not widened. This is the most load-bearing task in the plan.

**Files:**
- Modify: `frontend/src/components/bobbits/props.ts`
- Modify: `frontend/src/components/bobbits/fieldGeometry.ts` (add `Surface.rootX?`, extend `FieldProp.kind`)
- Modify: `frontend/src/components/bobbits/BobitField.tsx:340-341` (dispatch the new kind)
- Test: `frontend/src/components/bobbits/__tests__/marginTree.test.ts` (create)

**Interfaces:**
- Consumes: `treeScale`, `MARGIN_TREE_RIG_H`, `MARGIN_TREE_HALF_W`, `MIN_TREE_MARGIN` from Task 1.
- Produces:
  - `MARGIN_BRANCH_UP = [250, 470, 690]` — branch heights in rig units, lowest first
  - `marginTreeX(canvasW: number, scale: number): number` — the trunk's x in canvas px
  - `marginTreeLeftmost(canvasW: number, scale: number): number` — leftmost ink, canvas px
  - `marginTreeSurfaces(x: number, groundY: number, scale: number): Surface[]` — three, lowest first, each with `rootX`
  - `drawMarginTree(ctx, x, groundY, scale, grow?, color?): void`
  - `Surface.rootX?: number` — the end a climber arrives at; midpoint when absent
  - `FieldProp.kind` gains `'marginTree'`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/bobbits/__tests__/marginTree.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  marginTreeX, marginTreeLeftmost, marginTreeSurfaces,
  MARGIN_BRANCH_UP, MARGIN_TREE_HALF_W, MARGIN_TREE_RIG_H,
} from '../props';
import { treeScale } from '../../../features/collection/treePlacement';

/** The same measured margins as treePlacement.test.ts. Kept in step with it by hand. */
const MARGINS = [
  { vw: 1920, margin: 432, height: 868 },
  { vw: 1440, margin: 372, height: 640 },
  { vw: 1280, margin: 264, height: 560 },
];

describe('marginTreeX', () => {
  it('stands near the right of its canvas', () => {
    const s = 0.868;
    expect(marginTreeX(432, s)).toBeGreaterThan(432 * 0.5);
    expect(marginTreeX(432, s)).toBeLessThanOrEqual(432);
  });
});

describe('BOUND 1 — nothing the tree draws crosses the question column', () => {
  /**
   * The canvas IS the margin: it is positioned `right: 0` with `width: marginBox.width`, so its
   * left edge sits exactly on the column's right edge. Therefore "ink stays inside the canvas"
   * and "ink stays off the card" are the same statement, and this is the test that holds the
   * standing instruction.
   *
   * Asserted as a consequence -- the leftmost ink the tree produces -- rather than by checking
   * that treeScale took a min(). Three of this feature's new tests asserted the
   * implementation's own arithmetic back at it, and each sat on top of a real defect.
   */
  it('keeps its leftmost ink inside the measured margin at every width', () => {
    for (const { vw, margin, height } of MARGINS) {
      const s = treeScale({ width: margin, height });
      expect(s, `scale at ${vw}px`).not.toBeNull();
      const leftmost = marginTreeLeftmost(margin, s as number);
      expect(leftmost, `leftmost ink at ${vw}px`).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps every branch tip inside the measured margin too', () => {
    for (const { vw, margin, height } of MARGINS) {
      const s = treeScale({ width: margin, height }) as number;
      const x = marginTreeX(margin, s);
      const groundY = MARGIN_TREE_RIG_H * s;
      for (const sf of marginTreeSurfaces(x, groundY, s)) {
        expect(sf.left, `${sf.id} left edge at ${vw}px`).toBeGreaterThanOrEqual(0);
        expect(sf.right, `${sf.id} right edge at ${vw}px`).toBeLessThanOrEqual(margin);
      }
    }
  });

  it('never lets the footprint exceed the margin, however extreme the box', () => {
    for (const margin of [140, 200, 340, 432, 900]) {
      const s = treeScale({ width: margin, height: 10000 }) as number;
      expect(MARGIN_TREE_HALF_W * 2 * s).toBeLessThanOrEqual(margin + 0.001);
      expect(marginTreeLeftmost(margin, s)).toBeGreaterThanOrEqual(-0.001);
    }
  });
});

describe('marginTreeSurfaces', () => {
  const S = 0.868;
  const CANVAS = 432;
  const GROUND = 868;
  const surfaces = () => marginTreeSurfaces(marginTreeX(CANVAS, S), GROUND, S);

  it('offers three branches, lowest first', () => {
    const out = surfaces();
    expect(out).toHaveLength(3);
    expect(out[0].y).toBeGreaterThan(out[1].y);      // smaller y is higher up
    expect(out[1].y).toBeGreaterThan(out[2].y);
  });

  it('gives each branch a distinct id, so assignPerch can claim them separately', () => {
    expect(new Set(surfaces().map(s => s.id)).size).toBe(3);
  });

  it('puts the branches at the rig heights the design specifies', () => {
    const out = surfaces();
    out.forEach((sf, i) => {
      expect(sf.y).toBeCloseTo(GROUND - MARGIN_BRANCH_UP[i] * S, 5);
    });
  });

  it('alternates sides, so the tree does not lean', () => {
    const out = surfaces();
    const x = marginTreeX(CANVAS, S);
    const reachesLeft = out.map(sf => (sf.left + sf.right) / 2 < x);
    expect(reachesLeft[0]).toBe(true);       // lowest reaches left, toward the card
    expect(reachesLeft[1]).toBe(false);
    expect(reachesLeft[2]).toBe(true);
  });

  /**
   * `rootX` is the trunk-side end -- where a climber arrives and starts up. Without it
   * assignPerch walks him to the branch's MIDDLE and he ascends through open air beside the
   * trunk instead of climbing it.
   */
  it('roots every branch at the trunk', () => {
    const x = marginTreeX(CANVAS, S);
    for (const sf of surfaces()) {
      expect(sf.rootX).toBeDefined();
      expect(Math.abs((sf.rootX as number) - x)).toBeLessThan(MARGIN_TREE_HALF_W * S * 0.25);
      expect(sf.rootX).toBeGreaterThanOrEqual(sf.left);
      expect(sf.rootX).toBeLessThanOrEqual(sf.right);
    }
  });

  it('leaves room on every branch to walk out from the trunk', () => {
    for (const sf of surfaces()) {
      expect(sf.right - sf.left).toBeGreaterThan(20);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/marginTree.test.ts`
Expected: FAIL — `marginTreeX` is not exported from `../props`.

- [ ] **Step 3: Add `rootX` to `Surface` and the new prop kind**

In `frontend/src/components/bobbits/fieldGeometry.ts`, replace the `Surface` interface (line ~143):

```ts
export interface Surface {
  id: string;
  left: number;
  right: number;
  y: number;
  /**
   * Where a figure arrives at this surface and leaves it from, if that is not the middle.
   *
   * A branch is climbed at the TRUNK, not at its midpoint: `assignPerch` walks the climber to
   * this x at floor level and the climb goes straight up from it. Absent means "the middle",
   * which is what the in-band one-branch tree wants and how it behaved before this existed.
   */
  rootX?: number;
}
```

And extend the prop kind (line ~109):

```ts
  kind: 'cannon' | 'tree' | 'marginTree';
```

- [ ] **Step 4: Write the tree's geometry and its draw function**

Append to `frontend/src/components/bobbits/props.ts`:

```ts
/**
 * The MARGIN tree, in rig units, sized to the empty strip beside the question column.
 *
 * Separate from the in-band tree above, which is NOT re-authored: it still ships as the
 * fallback under `MIN_TREE_MARGIN` and its constants must not move. Two renderers is the
 * accepted cost (spec, section 2).
 *
 * The 96px band forced ONE branch -- a second ledge would have put its occupant's head through
 * the top of the canvas. That constraint is gone here, so the spec's original 2-3 branches come
 * back as three.
 *
 *  1000 ---- top of the canopy          <- MARGIN_TREE_RIG_H
 *   820 ---- trunk top
 *   690 ---- branch 3   (reaches left)
 *   470 ---- branch 2   (reaches right)
 *   250 ---- branch 1   (reaches left, toward the card -- the closest ink to it)
 *   240 ---- a standing bobit's head, for scale. He is drawn at BAND scale, ~4.3x smaller
 *            than this rig, so he reads as a climber in a big tree rather than a giant.
 *     0 ---- the floor line, shared with the band
 */
const MARGIN_TRUNK_W = 74;
const MARGIN_TRUNK_H = 820;
/** Branch heights above the floor, lowest first. Indices line up with `marginTreeSurfaces`. */
export const MARGIN_BRANCH_UP = [250, 470, 690];
/** Reach of each branch out from the trunk's centre, same order. */
const MARGIN_BRANCH_LEN = [168, 150, 120];
/** Which way each branch reaches. -1 is left, toward the question column. */
const MARGIN_BRANCH_DIR = [-1, 1, -1];
const MARGIN_BRANCH_W = 26;
const MARGIN_CANOPY_R = 190;

/**
 * The trunk's x inside its own canvas.
 *
 * Inset by half the footprint, so the whole tree -- canopy and the longest branch alike -- fits
 * between 0 and `canvasW`. Combined with `treeScale` taking the min of the height and width
 * fits, that is what makes bound 1 hold by construction rather than by care.
 */
export function marginTreeX(canvasW: number, scale: number): number {
  return canvasW - MARGIN_TREE_HALF_W * scale;
}

/** The leftmost pixel the tree puts ink on, in canvas coordinates. The bound-1 quantity. */
export function marginTreeLeftmost(canvasW: number, scale: number): number {
  return marginTreeX(canvasW, scale) - MARGIN_TREE_HALF_W * scale;
}

/**
 * The three branches a bobit can sit on, lowest first.
 *
 * Lowest first matters: `assignPerch` claims the first unclaimed surface, so the tree fills
 * from the bottom and a lone climber is never parked in the canopy.
 */
export function marginTreeSurfaces(x: number, groundY: number, scale: number): Surface[] {
  return MARGIN_BRANCH_UP.map((up, i) => {
    const dir = MARGIN_BRANCH_DIR[i];
    const tip = x + dir * (MARGIN_TRUNK_W * 0.5 + MARGIN_BRANCH_LEN[i]) * scale;
    const root = x + dir * MARGIN_TRUNK_W * 0.2 * scale;
    return {
      id: `margin-tree:branch${i}`,
      left: Math.min(tip, root),
      right: Math.max(tip, root),
      y: groundY - up * scale,
      // The trunk-side end. A branch is climbed at the trunk, not at its midpoint.
      rootX: root,
    };
  });
}

/**
 * The margin tree.
 *
 * `grow` is 0-1 exactly as `drawTree`'s is, and scales the HEIGHT only -- a tree that also grew
 * sideways read as a balloon inflating rather than as something sprouting.
 */
export function drawMarginTree(
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

  // Canopy first, so the trunk and the branches read on top of it.
  ctx.fillStyle = color;
  for (const [cx, cy, r] of [
    [-14, -MARGIN_TRUNK_H - 96, MARGIN_CANOPY_R],
    [-136, -MARGIN_TRUNK_H - 8, MARGIN_CANOPY_R * 0.56],
    [104, -MARGIN_TRUNK_H - 26, MARGIN_CANOPY_R * 0.52],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trunk: wider at the base, so it sits on the floor rather than balancing on it.
  ctx.beginPath();
  ctx.moveTo(-MARGIN_TRUNK_W * 0.8, 0);
  ctx.lineTo(-MARGIN_TRUNK_W * 0.4, -MARGIN_TRUNK_H);
  ctx.lineTo(MARGIN_TRUNK_W * 0.4, -MARGIN_TRUNK_H);
  ctx.lineTo(MARGIN_TRUNK_W * 0.8, 0);
  ctx.closePath();
  ctx.fill();

  // The three branches `marginTreeSurfaces` describes. A bobit sits ON these, so each one's
  // TOP edge and its Surface's `y` are the same line -- change one and you must change the
  // other, or he sits in mid-air or inside the wood.
  MARGIN_BRANCH_UP.forEach((up, i) => {
    const dir = MARGIN_BRANCH_DIR[i];
    const len = MARGIN_BRANCH_LEN[i] + MARGIN_TRUNK_W * 0.5;
    const x0 = dir < 0 ? -len : 0;
    ctx.fillRect(x0, -up - MARGIN_BRANCH_W, len, MARGIN_BRANCH_W);
  });

  // Accent notches, the tree's equivalent of the cannon's bands. Derived from the body colour,
  // never hardcoded: the field passes a LIGHT body in dark mode and a DARK one in light, and a
  // fixed light detail was invisible in dark mode on the cannon for exactly this reason.
  ctx.fillStyle = accent;
  for (const up of [MARGIN_TRUNK_H * 0.28, MARGIN_TRUNK_H * 0.58]) {
    ctx.fillRect(-MARGIN_TRUNK_W * 0.3, -up, MARGIN_TRUNK_W * 0.6, 22);
  }

  ctx.restore();
}
```

`MARGIN_TREE_HALF_W` and `MARGIN_TREE_RIG_H` are already in this file from Task 1 — no import
needed, and do **not** add one pointing at `treePlacement`: that would close a cycle.

- [ ] **Step 5: Dispatch the new kind in BobitField**

In `frontend/src/components/bobbits/BobitField.tsx`, extend the import on line 7 and add a branch after the `'tree'` case at line ~341:

```ts
import { drawCannon, drawTree, drawMarginTree } from './props';
```

```ts
        if (pr.kind === 'marginTree') {
          drawMarginTree(ctx, pr.x, pr.groundY, pr.scale, pr.grow ?? 1, pr.color || CANNON_COLOR);
        }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/marginTree.test.ts`
Expected: PASS, all of it.

Then check nothing else moved: `cd frontend && npm test`
Expected: the full suite green. `props.test.ts` covers the in-band tree and must be untouched.

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: clean. If `Surface.rootX` breaks a consumer, that consumer was assuming a shape it should not have — fix the consumer, do not remove `rootX`.

- [ ] **Step 8: Commit**

```bash
cd frontend
git add src/components/bobbits/props.ts src/components/bobbits/fieldGeometry.ts src/components/bobbits/BobitField.tsx src/components/bobbits/__tests__/marginTree.test.ts
git commit -m "feat(bobits): the margin tree's rig, with three branches

Three branches instead of one: the single-branch decision was forced by
the 96px band's ceiling, not chosen, so it lapses with the constraint.
Alternating sides, lowest reaching left toward the card.

Surface gains rootX -- the trunk-side end. A branch is climbed at the
trunk, not at its midpoint.

Carries the bound-1 test: the leftmost ink and every branch edge stay
inside the measured margin at every width, asserted as a consequence
rather than by checking that treeScale took a min().

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `assignPerch` walks to the trunk

**Files:**
- Modify: `frontend/src/features/collection/crowdAgents.ts:227-258`
- Test: `frontend/src/features/collection/__tests__/crowdAgents.test.ts`

**Interfaces:**
- Consumes: `Surface.rootX` from Task 2.
- Produces: no new exports. `assignPerch` now targets `surface.rootX ?? midpoint`.

- [ ] **Step 1: Write the failing test**

Append to the `assignPerch` describe block in `frontend/src/features/collection/__tests__/crowdAgents.test.ts` (create the block if there isn't one):

```ts
describe('assignPerch', () => {
  const OPTS = () => ({
    band: bandFor(false), width: 1000, greeting: new Set<string>(),
    frozen: false, rand: seq([0.5]),
  });

  it('walks the climber to the branch ROOT, not its middle', () => {
    const opts = OPTS();
    const s0 = initAgents(['a'], opts);
    // A branch reaching left out of a trunk at x=900: middle is 820, root is 890.
    const s1 = assignPerch(s0, [{ id: 'b0', left: 740, right: 900, y: 40, rootX: 890 }], opts);
    expect(s1.a.activity).toBe('moving');
    expect(s1.a.targetX).toBe(890);
    expect(s1.a.perchId).toBe('b0');
  });

  it('falls back to the middle for a surface with no root, as the in-band tree has', () => {
    const opts = OPTS();
    const s0 = initAgents(['a'], opts);
    const s1 = assignPerch(s0, [{ id: 'b0', left: 700, right: 900, y: 40 }], opts);
    expect(s1.a.targetX).toBe(800);
  });

  it('fills three branches bottom-up and never doubles one up', () => {
    const opts = OPTS();
    const surfaces = [
      { id: 'b0', left: 740, right: 900, y: 300, rootX: 890 },
      { id: 'b1', left: 900, right: 1040, y: 200, rootX: 910 },
      { id: 'b2', left: 780, right: 900, y: 100, rootX: 890 },
    ];
    let s = initAgents(['a', 'b', 'c', 'd'], opts);
    // One claim per call, by design -- the room does not send a delegation up the tree.
    const claimed: string[] = [];
    for (let i = 0; i < 4; i++) {
      s = assignPerch(s, surfaces, opts);
      const ids = Object.keys(s).filter(id => s[id].perchId).map(id => s[id].perchId as string);
      claimed.length = 0;
      claimed.push(...ids);
    }
    expect(new Set(claimed).size).toBe(claimed.length);   // no branch claimed twice
    expect(claimed).toHaveLength(3);                       // and no fourth climber
  });
});
```

Ensure the file's imports include `assignPerch` and `bandFor`:

```ts
import { initAgents, assignPerch, syncCast, rotateCast, ROTATE_EVERY } from '../crowdAgents';
import { bandFor } from '../crowdLayout';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts -t assignPerch`
Expected: FAIL on "walks the climber to the branch ROOT" — `targetX` is 820, the midpoint.

- [ ] **Step 3: Write the implementation**

In `frontend/src/features/collection/crowdAgents.ts`, change `assignPerch`'s target. Replace:

```ts
  const mid = (free.left + free.right) / 2;
  let best = candidates[0];
  let bestD = Math.abs(state[best].x - mid);
  for (const id of candidates) {
    const d = Math.abs(state[id].x - mid);
    if (d < bestD) { best = id; bestD = d; }
  }
```

with:

```ts
  // Where he ARRIVES: the branch's trunk-side end, because a branch is climbed at the trunk.
  // Walking him to the midpoint instead would send him up through open air beside it. Absent
  // `rootX` means the middle, which is what the one-branch in-band tree wants.
  const mid = (free.left + free.right) / 2;
  const arrive = free.rootX ?? mid;
  let best = candidates[0];
  let bestD = Math.abs(state[best].x - arrive);
  for (const id of candidates) {
    const d = Math.abs(state[id].x - arrive);
    if (d < bestD) { best = id; bestD = d; }
  }
```

and the `startMove` call below it:

```ts
  const walking = startMove(state[best], arrive, 0, opts);
```

Widen the parameter type to carry `rootX`:

```ts
export function assignPerch(
  state: AgentState,
  surfaces: readonly { id: string; left: number; right: number; y: number; rootX?: number }[],
  opts: AgentOpts,
): AgentState {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: PASS, including the pre-existing tests in the file.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/features/collection/crowdAgents.ts src/features/collection/__tests__/crowdAgents.test.ts
git commit -m "feat(bobits): a climber walks to the branch root, not its middle

A branch is climbed at the trunk. Targeting the midpoint sent him up
through open air beside it -- invisible at the in-band tree's 50px,
obvious at 600.

rootX absent still means the middle, so the in-band tree is unchanged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The climb's arithmetic

Two pure functions, so the motion can be tested without a canvas or a clock.

**Files:**
- Modify: `frontend/src/features/collection/crowdAgents.ts`
- Test: `frontend/src/features/collection/__tests__/climb.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CLIMB_PX_PER_SEC = 180`, `CLIMB_ASCENT_FRAC = 0.75`, `CLIMB_MAX_SEC = 5`, `CLIMB_MIN_SEC = 0.6`
  - `climbDurFor(dy: number): number`
  - `climbProgress(k: number): { up: number; out: number }` — `k` is 0-1 through the whole climb

**A refinement of the spec.** The spec's §5 quotes "~180px/s, giving roughly 1.2s, 2.3s and 3.3s". 180px/s is the speed of the *ascent leg*, which is only `CLIMB_ASCENT_FRAC` of the climb, so the totals are `1/0.75` longer: **1.6s, 3.0s and 4.4s** at 1920px. `CLIMB_MAX_SEC` is 5 to accommodate that. Use these numbers; the spec's are the same speed stated against the wrong leg.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/collection/__tests__/climb.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  climbDurFor, climbProgress,
  CLIMB_PX_PER_SEC, CLIMB_ASCENT_FRAC, CLIMB_MAX_SEC, CLIMB_MIN_SEC,
} from '../crowdAgents';

describe('climbDurFor', () => {
  it('takes longer for a higher branch', () => {
    expect(climbDurFor(600)).toBeGreaterThan(climbDurFor(217));
  });

  it('climbs the ascent leg at CLIMB_PX_PER_SEC', () => {
    const dy = 400;
    const ascentSec = climbDurFor(dy) * CLIMB_ASCENT_FRAC;
    expect(dy / ascentSec).toBeCloseTo(CLIMB_PX_PER_SEC, 5);
  });

  it('gives the three branches of a 1920px tree a legible spread', () => {
    // dy = MARGIN_BRANCH_UP * 0.868, the height-bound scale at 1920x1080.
    const [a, b, c] = [217, 408, 599].map(climbDurFor);
    expect(a).toBeCloseTo(1.61, 1);
    expect(b).toBeCloseTo(3.02, 1);
    expect(c).toBeCloseTo(4.44, 1);
  });

  it('is clamped at both ends, so no tree produces an absurd climb', () => {
    expect(climbDurFor(1)).toBe(CLIMB_MIN_SEC);
    expect(climbDurFor(99999)).toBe(CLIMB_MAX_SEC);
  });

  it('treats a downward delta as the same distance', () => {
    expect(climbDurFor(-400)).toBe(climbDurFor(400));
  });
});

describe('climbProgress', () => {
  it('spends the first stretch going up with no lateral movement', () => {
    expect(climbProgress(0)).toEqual({ up: 0, out: 0 });
    const mid = climbProgress(CLIMB_ASCENT_FRAC * 0.5);
    expect(mid.up).toBeCloseTo(0.5, 5);
    expect(mid.out).toBe(0);
  });

  it('is fully up before it starts moving out along the branch', () => {
    const at = climbProgress(CLIMB_ASCENT_FRAC);
    expect(at.up).toBeCloseTo(1, 5);
    expect(at.out).toBeCloseTo(0, 5);
  });

  it('finishes at the branch seat', () => {
    expect(climbProgress(1)).toEqual({ up: 1, out: 1 });
  });

  it('clamps outside 0-1 rather than extrapolating off the tree', () => {
    expect(climbProgress(-3)).toEqual({ up: 0, out: 0 });
    expect(climbProgress(9)).toEqual({ up: 1, out: 1 });
  });

  /**
   * The property that matters, and the reason this function exists at all: the perch used to be
   * a TELEPORT -- `agentsAdvance` flipped to 'perch' at walk completion and the figure was drawn
   * at the branch's y on that frame. Invisible at the in-band tree's 50px, a bobit blinking into
   * the canopy at 600.
   *
   * Asserted as a consequence -- no frame moves him more than a body's worth -- rather than by
   * checking climbProgress's own numbers back at it.
   */
  it('never teleports: no single frame covers more than a fraction of the climb', () => {
    const dy = 600;
    const dur = climbDurFor(dy);
    const STEP = 1 / 60;
    let prevUp = 0;
    let maxJump = 0;
    for (let t = 0; t <= dur; t += STEP) {
      const { up } = climbProgress(t / dur);
      expect(up).toBeGreaterThanOrEqual(prevUp);      // monotonic: he never slips back
      maxJump = Math.max(maxJump, (up - prevUp) * dy);
      prevUp = up;
    }
    expect(prevUp).toBeCloseTo(1, 5);                  // and he does arrive
    expect(maxJump).toBeLessThan(8);                   // px in one frame; a bobit is 48 tall
  });

  it('moves out along the branch monotonically too', () => {
    let prev = 0;
    for (let k = 0; k <= 1.0001; k += 0.01) {
      const { out } = climbProgress(k);
      expect(out).toBeGreaterThanOrEqual(prev);
      prev = out;
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/climb.test.ts`
Expected: FAIL — `climbDurFor` is not exported from `../crowdAgents`.

- [ ] **Step 3: Write the implementation**

Append to `frontend/src/features/collection/crowdAgents.ts`:

```ts
/** px/s a bobit climbs a trunk. The ASCENT leg's speed, not the whole climb's. */
export const CLIMB_PX_PER_SEC = 180;
/** Fraction of the climb spent going up the trunk; the rest walks out along the branch. */
export const CLIMB_ASCENT_FRAC = 0.75;
export const CLIMB_MIN_SEC = 0.6;
/**
 * Five seconds, not four: the tallest branch of a 1920x1080 tree is ~600px up, which at
 * CLIMB_PX_PER_SEC over CLIMB_ASCENT_FRAC of the climb is 4.44s. A four-second cap would
 * silently speed the top branch up and break the one property this module promises.
 */
export const CLIMB_MAX_SEC = 5;

/**
 * How long a climb of `dy` pixels takes.
 *
 * Derived, not fixed, so the same function gives sane numbers on a 1920px tree and on the
 * shorter width-bound one a 1280px viewport produces. Sign is ignored: coming down covers the
 * same distance as going up.
 */
export function climbDurFor(dy: number): number {
  const ascent = Math.abs(dy) / CLIMB_PX_PER_SEC;
  return Math.min(CLIMB_MAX_SEC, Math.max(CLIMB_MIN_SEC, ascent / CLIMB_ASCENT_FRAC));
}

/**
 * Where a climber is, as two 0-1 fractions: `up` the trunk, then `out` along the branch.
 *
 * Two legs rather than a diagonal because a tree is climbed at the trunk and then walked out
 * along the limb. A single interpolation from the floor to the branch seat would slide him up
 * through open air, which is the same failure the in-band tree's teleport had, just slower.
 */
export function climbProgress(k: number): { up: number; out: number } {
  const t = Math.max(0, Math.min(1, k));
  if (t <= CLIMB_ASCENT_FRAC) return { up: t / CLIMB_ASCENT_FRAC, out: 0 };
  return { up: 1, out: (t - CLIMB_ASCENT_FRAC) / (1 - CLIMB_ASCENT_FRAC) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/climb.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/features/collection/crowdAgents.ts src/features/collection/__tests__/climb.test.ts
git commit -m "feat(bobits): the climb's arithmetic, up then out

Two legs, not a diagonal: a tree is climbed at the trunk and then walked
out along the limb. Duration derived from the height so the same function
serves a 1920px tree and the shorter width-bound one at 1280.

The no-teleport property is asserted as a consequence -- no frame covers
more than 8px of a 600px climb -- not by checking the arithmetic back at
itself.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `climbing` and `descending` as agent activities

Wires Task 4's arithmetic into the agent state machine, and closes the descent teleport.

**Files:**
- Modify: `frontend/src/features/collection/crowdAgents.ts` (`Activity`, `Agent`, `agentsAdvance`, `agentAnim`)
- Test: `frontend/src/features/collection/__tests__/crowdAgents.test.ts`

**Interfaces:**
- Consumes: `climbDurFor`, `climbProgress`, `CLIMB_ASCENT_FRAC` from Task 4; `Surface.rootX` from Task 2.
- Produces:
  - `Activity` gains `'climbing' | 'descending'`
  - `Agent` gains `climbT?: number`, `climbDur?: number`, `climbFromY?: number`, `climbToY?: number`, `climbFromX?: number`, `climbToX?: number`
  - `agentAnim` returns `'climb'` for both new activities
  - `agentsAdvance` advances them and hands `climbing → perch`, `descending → wander`

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/collection/__tests__/crowdAgents.test.ts`:

```ts
describe('the climb', () => {
  const OPTS = () => ({
    band: bandFor(false), width: 1000, greeting: new Set<string>(),
    frozen: false, rand: seq([0.5]),
  });
  /**
   * Margin-canvas coordinates, because that is where a real climb happens: the floor is the
   * canvas's own height and the branch is several hundred px above it. Using band coordinates
   * here would make a 30px "climb" that clamps to CLIMB_MIN_SEC and proves nothing.
   */
  const FLOOR = 868;
  const BRANCH = { id: 'b0', left: 80, right: 240, y: 650, rootX: 230 };

  /** Walk him to the root and let the walk finish, which is where the climb begins. */
  const atTheTrunk = (opts: ReturnType<typeof OPTS>) => {
    let s = assignPerch(initAgents(['a'], opts), [BRANCH], opts, FLOOR);
    s = agentsAdvance(s, s.a.moveDur, opts);
    return s;
  };

  it('starts climbing when the walk to the trunk finishes, not perching', () => {
    const opts = OPTS();
    const s = atTheTrunk(opts);
    expect(s.a.activity).toBe('climbing');
    expect(s.a.perchId).toBe('b0');
  });

  it('plays the rig CLIMB pose, never a seated one, while off the ground', () => {
    const opts = OPTS();
    const s = atTheTrunk(opts);
    expect(agentAnim(s.a)).toBe('climb');
    const mid = agentsAdvance(s, (s.a.climbDur as number) * 0.5, opts);
    expect(agentAnim(mid.a)).toBe('climb');
    expect(agentAnim(mid.a)).not.toBe('sit');
  });

  it('sits down only once the climb completes', () => {
    const opts = OPTS();
    const s = atTheTrunk(opts);
    const done = agentsAdvance(s, (s.a.climbDur as number) + 0.01, opts);
    expect(done.a.activity).toBe('perch');
    expect(agentAnim(done.a)).toBe('sit');
    expect(done.a.perchT).toBe(0);
  });

  it('comes DOWN by climbing when the dwell expires, not by dropping', () => {
    const opts = OPTS();
    let s = atTheTrunk(opts);
    s = agentsAdvance(s, (s.a.climbDur as number) + 0.01, opts);
    expect(s.a.activity).toBe('perch');
    s = agentsAdvance(s, PERCH_DWELL_SEC + 0.01, opts);
    expect(s.a.activity).toBe('descending');
    expect(agentAnim(s.a)).toBe('climb');
    // The branch is not released until his feet are down, or two bobits claim one limb.
    expect(s.a.perchId).toBe('b0');
  });

  it('releases the branch and rejoins the room at the bottom', () => {
    const opts = OPTS();
    let s = atTheTrunk(opts);
    s = agentsAdvance(s, (s.a.climbDur as number) + 0.01, opts);
    s = agentsAdvance(s, PERCH_DWELL_SEC + 0.01, opts);
    s = agentsAdvance(s, (s.a.climbDur as number) + 0.01, opts);
    expect(s.a.activity).toBe('wander');
    expect(s.a.perchId).toBeUndefined();
    expect(s.a.perchT).toBeUndefined();
  });

  it('is frozen by the abduction freeze like everyone else', () => {
    const opts = OPTS();
    const s = atTheTrunk(opts);
    const frozen = agentsAdvance(s, 0.5, { ...opts, frozen: true });
    expect(frozen).toBe(s);
  });
});
```

Ensure the file imports `agentsAdvance`, `agentAnim` and `PERCH_DWELL_SEC`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts -t "the climb"`
Expected: FAIL on the first case — activity is `'perch'`, because the walk currently hands straight to it.

- [ ] **Step 3: Extend the types**

In `frontend/src/features/collection/crowdAgents.ts`:

```ts
export type Activity = 'wander' | 'rank' | 'moving' | 'climbing' | 'descending' | 'perch';
```

and on the `Agent` interface, beside `perchId` / `perchT`:

```ts
  /** Seconds into the current climb, up or down. */
  climbT?: number;
  /** How long this climb takes, from `climbDurFor`. */
  climbDur?: number;
  /** The climb's endpoints, in field pixels. `From` is where he set off. */
  climbFromY?: number;
  climbToY?: number;
  climbFromX?: number;
  climbToX?: number;
```

- [ ] **Step 4: Hand the finished walk to the climb instead of to the perch**

In `agentsAdvance`, in the `'moving'` completion branch, replace:

```ts
        activity: a.perchId ? 'perch' : (a.targetDepth >= 1 ? 'rank' : 'wander'),
        perchT: a.perchId ? 0 : a.perchT,
```

with:

```ts
        // A bobit who set off for a branch CLIMBS it now that he is standing under it. He used
        // to be placed on it outright, which at the in-band tree's 50px looked like a step and
        // at 600px is a figure blinking into the canopy.
        activity: a.perchId ? 'climbing' : (a.targetDepth >= 1 ? 'rank' : 'wander'),
        perchT: a.perchId ? undefined : a.perchT,
```

**Both climb endpoints are recorded at claim time**, because `assignPerch` is the only place
that holds the Surface. It needs one thing it does not have today: the floor line of the canvas
the branch lives in. `opts.band` is the BAND's geometry, and the margin tree's floor is its own
canvas's `height` (≈868px), not the band's 96 — so a `band`-derived default would put the climb's
origin 770px from where the climber actually stands. Take it as a parameter, defaulted so the
in-band tree keeps today's behaviour:

```ts
export function assignPerch(
  state: AgentState,
  surfaces: readonly { id: string; left: number; right: number; y: number; rootX?: number }[],
  opts: AgentOpts,
  /**
   * The floor line of the canvas these surfaces are in, in that canvas's coordinates.
   *
   * NOT derivable from `opts.band`: the margin tree's floor is its own canvas's height, ~868px,
   * while the band's is 90. Defaulted to the band's, which is where the in-band tree's one
   * branch has always been measured from.
   */
  floorY: number = stageBounds(opts.band).bottom,
): AgentState {
```

and, at the end:

```ts
  const walking = startMove(state[best], arrive, 0, opts);
  return {
    ...state,
    [best]: {
      ...walking,
      perchId: free.id,
      // Both endpoints AND the duration, recorded here because this is the only place holding
      // the Surface. Nothing downstream has to reconstruct them, so nothing downstream can
      // reconstruct them differently.
      climbFromX: arrive,
      climbToX: (free.left + free.right) / 2,
      climbFromY: floorY,
      climbToY: free.y,
      climbDur: climbDurFor(free.y - floorY),
    },
  };
```

`stageBounds` is already exported from `crowdLayout.ts`; add it to this file's imports if it is
not there.

- [ ] **Step 5: Advance the two new activities**

In `agentsAdvance`, before the `'moving'` branch, add:

```ts
    if (a.activity === 'climbing' || a.activity === 'descending') {
      // `climbDur` is always set by whoever started the climb -- assignPerch on the way up, the
      // dwell expiry on the way down -- so there is nothing to recompute here. A fallback would
      // be a second opinion about the same climb, which is how two readers come to disagree.
      const dur = a.climbDur ?? CLIMB_MIN_SEC;
      const climbT = (a.climbT ?? 0) + dt;
      if (climbT >= dur) {
        if (a.activity === 'climbing') {
          // Seated at last. `perchT` starts the dwell clock; crowdFigures takes his position
          // from the Surface from here on.
          out[id] = {
            ...a, activity: 'perch', perchT: 0, climbT: undefined, climbDur: undefined, t: 0,
          };
        } else {
          // Feet down. Only NOW is the branch released, or a second climber claims a taken limb.
          out[id] = {
            ...a, activity: 'wander', perchId: undefined, perchT: undefined,
            climbT: undefined, climbDur: undefined,
            climbFromX: undefined, climbToX: undefined,
            climbFromY: undefined, climbToY: undefined,
            t: 0,
          };
        }
        continue;
      }
      out[id] = { ...a, climbT, climbDur: dur };
      continue;
    }
```

- [ ] **Step 6: Start the descent instead of dropping him**

In the `'perch'` branch, replace the dwell expiry:

```ts
      if (perchT >= PERCH_DWELL_SEC) {
        out[id] = { ...a, activity: 'wander', perchId: undefined, perchT: undefined, t: 0 };
```

with:

```ts
      if (perchT >= PERCH_DWELL_SEC) {
        // Down he CLIMBS. Flipping straight to 'wander' dropped him from the branch to the
        // floor in one frame, which is the same teleport the ascent had, in reverse.
        const fromY = a.climbToY ?? 0;
        const toY = a.climbFromY ?? 0;
        out[id] = {
          ...a,
          activity: 'descending',
          perchT: undefined,
          climbT: 0,
          climbDur: climbDurFor(toY - fromY),
          // Reversed: he starts where he sat and ends where he set off from.
          climbFromX: a.climbToX, climbToX: a.climbFromX,
          climbFromY: fromY, climbToY: toY,
          t: 0,
        };
```

- [ ] **Step 7: Give both activities the climb pose**

In `agentAnim`:

```ts
export function agentAnim(a: Agent): string {
  if (a.activity === 'perch') return 'sit';
  // The rig's own `climb`: a spiderman wall-climb, limbs ratcheting up one at a time, headTilt
  // 16 so the eyes are on the next hold. Built from REST, so it is STANDING -- which is the
  // point. A seated pose on a beat that leaves the ground draws the figure 104 units from where
  // the scene put him, and that trap has now been recorded four times in this feature.
  if (a.activity === 'climbing' || a.activity === 'descending') return 'climb';
  if (a.activity === 'rank') return 'standstill';
  if (a.activity === 'moving') return 'stroll';
  return a.phase === 'walk' ? 'stroll' : 'standstill';
}
```

- [ ] **Step 8: Run the tests**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdAgents.test.ts`
Expected: PASS, including every pre-existing test in the file.

Then: `cd frontend && npm test`
Expected: the full suite green. If `crowdFigures.test.ts` fails because a perched agent is no longer where it expected, STOP — that is Task 6's job and the two must not be blended.

- [ ] **Step 9: Commit**

```bash
cd frontend
git add src/features/collection/crowdAgents.ts src/features/collection/__tests__/crowdAgents.test.ts
git commit -m "feat(bobits): climb the tree, and climb back down

The perch was a teleport in both directions: the walk's completion put
the figure on the branch, and the dwell's expiry dropped him off it. At
the in-band tree's 50px nobody noticed; at 600 it is a bobit blinking
into the canopy.

Two new activities on the rig's existing \`climb\` pose -- standing, never
seated, which is the trap this feature has now recorded four times. The
branch is released only when his feet are down.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The three-way partition

The dangerous task. Three canvases, three figure lists, one frame — and a partition only holds if every side is answering the same question.

**Files:**
- Modify: `frontend/src/features/collection/crowdFigures.ts`
- Test: `frontend/src/features/collection/__tests__/crowdFigures.test.ts`

**Interfaces:**
- Consumes: `climbProgress` / `climbDurFor` from Task 4, the new activities from Task 5, `marginTreeSurfaces` from Task 2.
- Produces:
  - `treeFigures(state, agents, band, darkMode, surfaces, treeScale): FieldFigure[]` — the tree canvas's figures: everyone perched, climbing or descending, in TREE-CANVAS coordinates
  - `crowdFigures(...)` keeps its signature but **excludes** anyone on the tree

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/features/collection/__tests__/crowdFigures.test.ts`:

```ts
describe('the three-way partition', () => {
  const SURFACES = [
    { id: 'margin-tree:branch0', left: 80, right: 240, y: 650, rootX: 230 },
    { id: 'margin-tree:branch1', left: 240, right: 370, y: 460, rootX: 250 },
    { id: 'margin-tree:branch2', left: 120, right: 240, y: 270, rootX: 230 },
  ];

  /** The tree canvas's floor line: its own height, not the band's 90. */
  const FLOOR = 868;

  /** A room with one bobit sent up the tree and settled on the lowest branch. */
  const roomWithAClimber = () => {
    const ids = ['a', 'b', 'c'];
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    let agents = initAgents(ids, OPTS);
    agents = assignPerch(agents, SURFACES, OPTS, FLOOR);
    const climber = Object.keys(agents).find(id => agents[id].perchId) as string;
    agents = agentsAdvance(agents, agents[climber].moveDur, OPTS);           // walk done
    agents = agentsAdvance(agents, (agents[climber].climbDur as number) + 0.1, OPTS);
    return { state, agents, climber };
  };

  /**
   * The property, and the reason this is one pass: an airborne bobit was once drawn on BOTH
   * canvases for the whole flight -- arcing over the card and standing on the band at the same
   * time -- because the band read a ref in the frame loop while the render read a prop. A
   * partition only holds if every side is answering the same question.
   */
  it('puts every agent on exactly one canvas', () => {
    const { state, agents } = roomWithAClimber();
    const director = directorInit();
    const band = crowdFigures(state, agents, BAND, false, director, false, SURFACES);
    const tree = treeFigures(state, agents, BAND, false, SURFACES, 0.868);
    const air = aerialFigures(director, BAND, false, false);

    const all = [...band, ...tree, ...air].map(f => f.id);
    expect(new Set(all).size, 'no figure on two canvases').toBe(all.length);
    expect(new Set(all)).toEqual(new Set(Object.keys(agents)));
  });

  it('draws the perched bobit on the TREE, not on the band', () => {
    const { state, agents, climber } = roomWithAClimber();
    const band = crowdFigures(state, agents, BAND, false, directorInit(), false, SURFACES);
    const tree = treeFigures(state, agents, BAND, false, SURFACES, 0.868);
    expect(band.map(f => f.id)).not.toContain(climber);
    expect(tree.map(f => f.id)).toContain(climber);
  });

  it('seats him on the branch, with a seated hover pose', () => {
    const { state, agents, climber } = roomWithAClimber();
    const f = treeFigures(state, agents, BAND, false, SURFACES, 0.868)
      .find(g => g.id === climber);
    expect(f).toBeDefined();
    expect(f?.anim).toBe('sit');
    expect(f?.hoverAnim).toBe('greetseat');
    expect(f?.groundY).toBeCloseTo(SURFACES[0].y, 5);
  });

  it('draws a CLIMBING bobit standing, off the floor, with no seated hover pose', () => {
    const ids = ['a'];
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    let agents = assignPerch(initAgents(ids, OPTS), SURFACES, OPTS, FLOOR);
    agents = agentsAdvance(agents, agents.a.moveDur, OPTS);
    agents = agentsAdvance(agents, (agents.a.climbDur as number) * 0.5, OPTS);

    const f = treeFigures(state, agents, BAND, false, SURFACES, 0.868)[0];
    expect(f.anim).toBe('climb');
    expect(f.hoverAnim).toBeUndefined();
    // Off the floor and not yet at the branch: genuinely mid-climb. Smaller y is higher up, so
    // he is strictly between the branch and the floor.
    expect(f.groundY).toBeLessThan(FLOOR);
    expect(f.groundY).toBeGreaterThan(SURFACES[0].y);
  });

  it('is empty when the room has no tree', () => {
    const ids = ['a', 'b'];
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    const agents = initAgents(ids, OPTS);
    expect(treeFigures(state, agents, BAND, false, [], null)).toHaveLength(0);
    // And then everyone is on the band.
    expect(crowdFigures(state, agents, BAND, false, directorInit(), false, []))
      .toHaveLength(2);
  });

  it('drops a climber back to the band if his Surface disappears mid-climb', () => {
    // A resize can take the tree's scale below MIN_TREE_MARGIN between two frames. He must
    // land on the floor rather than be drawn against a branch that no longer exists.
    const { state, agents, climber } = roomWithAClimber();
    const band = crowdFigures(state, agents, BAND, false, directorInit(), false, []);
    expect(band.map(f => f.id)).toContain(climber);
    expect(treeFigures(state, agents, BAND, false, [], null)).toHaveLength(0);
  });
});
```

Add `treeFigures`, `assignPerch` and `agentsAdvance` to the file's imports.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdFigures.test.ts -t "three-way partition"`
Expected: FAIL — `treeFigures` is not exported.

- [ ] **Step 3: Write `treeFigures`, and exclude its members from the band**

In `frontend/src/features/collection/crowdFigures.ts`, add near the top:

```ts
/**
 * Is this agent the TREE canvas's business this frame?
 *
 * THE partition predicate. `crowdFigures` and `treeFigures` both call it, so the two cannot
 * disagree about who they are drawing -- which is exactly how an airborne bobit came to be
 * painted on two canvases at once. One question, one answer, both readers.
 *
 * A perched agent whose Surface is NOT in the list is NOT the tree's: the tree has gone (a
 * resize below MIN_TREE_MARGIN), and he falls back to the floor.
 */
function onTheTree(a: Agent, surfaces: readonly Surface[]): boolean {
  if (!a.perchId) return false;
  if (!surfaces.some(sf => sf.id === a.perchId)) return false;
  return a.activity === 'perch' || a.activity === 'climbing' || a.activity === 'descending';
}
```

Then add the new export:

```ts
/**
 * The tree canvas's figures: everyone perched on it, climbing it or coming down it.
 *
 * Coordinates are the TREE CANVAS's, not the band's -- the Surfaces are already in them, since
 * CollectionCrowd builds them from `marginTreeX(marginBox.width, scale)`. Figures are drawn at
 * BAND scale on a tree-scale canvas, so a climber reads as a normal bobit in a big tree rather
 * than as a giant. `FieldFigure.scale` is per figure, which is what makes that free.
 */
export function treeFigures(
  state: CrowdState,
  agents: AgentState,
  band: CrowdBand,
  darkMode: boolean,
  surfaces: readonly Surface[],
  treeScale: number | null,
): FieldFigure[] {
  if (surfaces.length === 0 || treeScale === null) return [];

  const out: FieldFigure[] = [];
  for (const id of Object.keys(agents)) {
    const a = agents[id];
    if (!onTheTree(a, surfaces)) continue;
    const sf = surfaces.find(s => s.id === a.perchId) as Surface;

    if (a.activity === 'perch') {
      out.push({
        id, anim: 'sit', color: figColor(toneOf(id), darkMode),
        // He sits along the branch's middle rather than wherever he happened to stop.
        x: (sf.left + sf.right) / 2,
        groundY: sf.y,
        scale: band.scale * heightFactor(id),
        // Phase from the id, so neighbours never breathe in lockstep -- same derivation as
        // crowdFigures uses, so a bobit's rhythm does not change when he leaves the band.
        phase: (hashId(id) % 1000) / 250,
        flip: a.dir === -1,
        poofable: false,
        greetable: true,
        // A hoverAnim MUST match its base anim's seatedness: bounds measure from the BASE key
        // while paint positions with the RESOLVED one.
        hoverAnim: 'greetseat',
      });
      continue;
    }

    // Climbing or descending. Position comes from the climb's own recorded endpoints, NOT from
    // the Surface -- reading the Surface here is what made the old transition a teleport. And
    // not from `band` either: these are the TREE canvas's coordinates, where the floor is ~868
    // rather than 90, so a band-derived fallback would start him 770px from his own feet.
    const dur = a.climbDur ?? CLIMB_MIN_SEC;
    const { up, out: along } = climbProgress(dur > 0 ? (a.climbT ?? 0) / dur : 1);
    const fromY = a.climbFromY as number;
    const toY = a.climbToY as number;
    const fromX = a.climbFromX as number;
    const toX = a.climbToX as number;

    out.push({
      id, anim: 'climb', color: figColor(toneOf(id), darkMode),
      x: fromX + (toX - fromX) * along,
      groundY: fromY + (toY - fromY) * up,
      scale: band.scale * heightFactor(id),
      phase: (hashId(id) % 1000) / 250,
      // Facing the trunk he is climbing, so he is not clinging to it back-first.
      flip: (sf.rootX ?? (sf.left + sf.right) / 2) < fromX,
      poofable: false,
      // No greeting mid-climb, and NO hoverAnim: `climb` is standing, and a seated hover pose
      // on a standing base is drawn 104 units from where this put him.
      greetable: false,
    });
  }
  return out;
}
```

In `crowdFigures`, exclude the tree's members. Find the loop over agents and add, as its first statement:

```ts
    // The tree's, not the band's. One predicate, both readers -- see `onTheTree`.
    if (onTheTree(a, surfaces)) continue;
```

Then delete the old `perch` lookup and its use in the pushed figure, so `crowdFigures` no longer positions anybody off the floor:

```ts
      x: a.x,
      groundY,
```

(dropping `perch ? … : …` from both, and dropping the `...(perch ? { hoverAnim: 'greetseat' } : {})` spread.)

Keep the `surfaces` parameter on `crowdFigures`: it still needs it to answer `onTheTree`.

Add the imports it now needs: `climbProgress` and `CLIMB_MIN_SEC` plus the `Agent` type from
`./crowdAgents`. `figColor`, `toneOf`, `hashId`, `heightFactor` and the `Surface` type are
already imported in this file — use them rather than inventing new helpers, so a bobit's colour
and breathing rhythm do not change when he leaves the band for the tree.

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdFigures.test.ts`
Expected: PASS. Pre-existing tests that asserted a perched figure came out of `crowdFigures` with the IN-BAND tree's single Surface will now fail, because that agent moves to `treeFigures`. That is the intended change: update those tests to call `treeFigures`, and do not weaken the partition to keep them passing.

Then: `cd frontend && npm test` and `npm run typecheck`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/features/collection/crowdFigures.ts src/features/collection/__tests__/crowdFigures.test.ts
git commit -m "feat(bobits): partition the tree's figures off the band

crowdFigures and treeFigures both ask ONE predicate who belongs where, so
the two cannot disagree about a frame. An airborne bobit was once painted
on both canvases for a whole flight because the band read a ref while the
render read a prop; a partition only holds if every side is answering the
same question.

A climber's position comes from the climb, never from the Surface --
reading the Surface mid-climb is what made the transition a teleport. A
perched agent whose Surface has vanished falls back to the floor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The ceremony at the new size

**Files:**
- Modify: `frontend/src/features/collection/treePlacement.ts` (`TREE_GROW_SEC` 2 → 3)
- Modify: `frontend/src/features/collection/__tests__/treePlacement.test.ts` (the existing assertion)
- Test: `frontend/src/features/collection/__tests__/milestone.test.ts`

**Interfaces:**
- Consumes: `marginTreeX` from Task 2, `treeScale` from Task 1.
- Produces: no new exports. `TREE_GROW_SEC` becomes 3.

- [ ] **Step 1: Write the failing test**

The existing `treePlacement.test.ts` asserts `expect(TREE_GROW_SEC).toBe(2)`. Change it:

```ts
  it('grows over three seconds, not two — the margin tree is ten times as tall', () => {
    expect(TREE_GROW_SEC).toBe(3);
  });
```

And append to `frontend/src/features/collection/__tests__/milestone.test.ts`:

```ts
import { marginTreeX } from '../../../components/bobbits/props';
import { treeScale } from '../treePlacement';
import { TREE_MILESTONE } from '../scenes';

describe('the milestone ceremony stands under the trunk', () => {
  /**
   * The scene's cast walks to fractions of the BAND while the trunk lives in the MARGIN
   * canvas's coordinates. Two separately right-anchored things are not the same place, and
   * "it is anchored right, so it must line up" is exactly the reasoning that let the
   * milestone's `span <= 0.25` test pass while the scene played at the opposite end of the band.
   *
   * So: assert the ground it actually takes.
   */
  const CASES = [
    { vw: 1920, inner: 1872, margin: 432, height: 868 },
    { vw: 1440, inner: 1392, margin: 372, height: 640 },
    { vw: 1280, inner: 1232, margin: 264, height: 560 },
  ];

  it('puts the admirer within a body or two of the trunk, at every width', () => {
    for (const { vw, inner, margin, height } of CASES) {
      const scale = treeScale({ width: margin, height }) as number;
      // The trunk in PAGE coordinates: the canvas is flush right, so add its left edge.
      const trunkPageX = (inner - margin) + marginTreeX(margin, scale);

      // The admirer's beat, from TREE_MILESTONE: moveTo 0.72 of the full-bleed band.
      const admirer = TREE_MILESTONE.beats
        .find(b => b.role === 'admirer' && b.moveTo !== undefined);
      expect(admirer, 'the admirer still has a moveTo').toBeDefined();
      const admirerPageX = (admirer?.moveTo as number) * inner;

      // Within ~3 bobit widths. Tighter than that is over-fitting a hand-tuned fraction; looser
      // and he is admiring an empty patch of floor.
      expect(Math.abs(admirerPageX - trunkPageX), `admirer vs trunk at ${vw}px`)
        .toBeLessThan(160);
    }
  });

  it('still reserves the right of the band for the set piece', () => {
    expect(TREE_MILESTONE.anchor).toBe('right');
    expect(TREE_MILESTONE.span).toBeLessThanOrEqual(0.25);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/treePlacement.test.ts src/features/collection/__tests__/milestone.test.ts`
Expected: the grow test FAILS (`TREE_GROW_SEC` is 2). The ceremony test may PASS or FAIL — **either is informative.** If it fails, the admirer's `moveTo` needs adjusting toward the trunk; change the beat's fraction in `milestone25Tree.ts`, not the tolerance.

- [ ] **Step 3: Lengthen the sprout**

In `frontend/src/features/collection/treePlacement.ts`:

```ts
/**
 * Seconds the sapling takes to reach full height, the first time it is ever earned.
 *
 * Three, not two: the margin tree is ~868px tall at 1920x1080, and two seconds is a 434px/s
 * sprout, which reads as a jump rather than as growing. Confirm by screenshot, not by feel.
 */
export const TREE_GROW_SEC = 3;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/treePlacement.test.ts src/features/collection/__tests__/milestone.test.ts`
Expected: PASS. If the ceremony test still fails, adjust the admirer's `moveTo` in `milestone25Tree.ts` and re-run — the scene serves the tree, not the reverse.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/features/collection/treePlacement.ts src/features/collection/scenes/milestone25Tree.ts src/features/collection/__tests__/
git commit -m "feat(bobits): the ceremony, at ten times the height

A two-second sprout is 434px/s on the margin tree and reads as a jump.
Three seconds.

And the milestone now asserts the GROUND it takes, not just its span: the
cast walks to fractions of the band while the trunk lives in the margin
canvas's coordinates, and two separately right-anchored things are not
the same place. The old span test passed happily while the scene played
at the wrong end of the band.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The wiring

The React layer. **It has no unit tests, by design** — `vitest.config.ts` runs `environment: 'node'` with no DOM and no canvas, and every test in this repo exercises a pure function. Its gate is Task 9's screenshot pass. This is the class of change where three interaction bugs shipped on one branch in this feature and were caught by reading, so read the diff carefully before running it.

**Files:**
- Create: `frontend/src/features/collection/TreeMargin.tsx`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`
- Modify: `frontend/src/features/game/components/GameScreen.tsx:527` (ref on the shared column), `:642-643`, `:793-806`

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces:
  - `<TreeMargin box darkMode grow scale surfaces figures />`
  - `CollectionCrowdProps` gains `marginBox?: MarginBox | null`

- [ ] **Step 1: Measure the column in GameScreen**

The HUD, the question card and the buttons share one `maxWidth: clamp(700px, 55vw, 1500px)`, `mx-auto` container — so there is one column to measure. Add a ref to the **HUD's** column div (line ~527, the `flex flex-col mx-auto w-full flex-shrink-0` one), because it is present in every phase, and observe it:

```tsx
const columnRef = useRef<HTMLDivElement>(null);
const shellRef = useRef<HTMLDivElement>(null);
const [marginBox, setMarginBox] = useState<MarginBox | null>(null);

// The tree's canvas is sized from the MEASURED margin, never from recomputing the clamp: the
// nominal-vs-measured trap has cost this feature two bugs, and the arithmetic does not know
// about the scrollbar the question area has.
useLayoutEffect(() => {
  const col = columnRef.current;
  const shell = shellRef.current;
  if (!col || !shell) return;
  const measure = () => {
    const c = col.getBoundingClientRect();
    const s = shell.getBoundingClientRect();
    const width = Math.max(0, s.right - c.right);
    const height = Math.max(0, s.bottom - s.top);
    setMarginBox({ width, height });
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(col);
  ro.observe(shell);
  window.addEventListener('resize', measure);
  return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
}, []);
```

Put `shellRef` on the `relative h-full flex flex-col py-5 sm:py-6 md:py-8 px-4 sm:px-6` container (line ~523) — it is already the positioning context the band sits in, and it is the box whose right edge the canvas is flush with.

Pass it down at the `<CollectionCrowd>` call site:

```tsx
            marginBox={marginBox}
```

- [ ] **Step 2: Write `TreeMargin`**

Create `frontend/src/features/collection/TreeMargin.tsx`:

```tsx
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure, FieldProp } from '../../components/bobbits/fieldGeometry';
import { marginTreeX } from '../../components/bobbits/props';
import type { MarginBox } from './treePlacement';

interface TreeMarginProps {
  box: MarginBox;
  scale: number;
  /** 0-1 while the tree is still sprouting. */
  grow: number;
  darkMode: boolean;
  /** Everyone perched, climbing or descending, in THIS canvas's coordinates. */
  figuresFor: () => FieldFigure[];
}

/**
 * The tree's own canvas: the empty strip beside the question column, floor line to canopy.
 *
 * WHY A THIRD CANVAS. The band is 96px tall and in normal document flow, which is how "the
 * crowd never covers the question" is guaranteed rather than merely arranged. A tree ten times
 * that height cannot live there, and making the band taller would either steal the question
 * card's allowance or put an interactive canvas over the answer buttons.
 *
 * BOUND 1 IS GEOMETRY HERE. The canvas is `right: 0` with `width: box.width`, where `box.width`
 * was measured from the column's right edge -- so its left edge IS that edge, and nothing drawn
 * inside it can reach the card. `marginTree.test.ts` asserts the tree's leftmost ink and every
 * branch edge stay inside it at every width. That is what lets this canvas stay INTERACTIVE
 * while the aerial overlay, which really does span the card, must not be: a bobit can still be
 * clicked and greeted from his branch.
 *
 * Two interactive BobitFields on one page is safe, and was checked rather than assumed: the
 * document- and window-level listeners are all cancel handlers (mouseup, blur, Escape, and a
 * context-menu suppressor guarded by that field's own gesture state), each acting on its own
 * refs, and the 60ms armPoll is a no-op without a pending touch on that field.
 */
export function TreeMargin({ box, scale, grow, darkMode, figuresFor }: TreeMarginProps) {
  // Light trunk on a dark ground and vice versa, exactly as the cannon learned to be: a fixed
  // dark prop is a smudge in dark mode.
  const color = darkMode ? '#9AA6B8' : '#4A5568';
  const propsFor = (): FieldProp[] => [{
    id: 'room:margin-tree',
    kind: 'marginTree',
    x: marginTreeX(box.width, scale),
    // The canvas's bottom edge IS the band's floor line, so the trunk stands on the same
    // ground the crowd walks on.
    groundY: box.height,
    scale,
    grow,
    color,
  }];

  return (
    <div
      style={{
        position: 'absolute', right: 0, bottom: 0,
        width: box.width, height: box.height,
        // Behind the question column in z-order, so that even if a future layout change made
        // the boxes overlap, the card wins. Belt and braces over the geometry.
        zIndex: 0,
      }}
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

- [ ] **Step 3: Wire it into CollectionCrowd**

In `frontend/src/features/collection/CollectionCrowd.tsx`:

Add the prop:

```tsx
  /**
   * The empty strip beside the question column, measured by GameScreen.
   *
   * GameScreen owns that column, so GameScreen measures it -- this component does not reach up
   * into its parent's layout. Null until the first measurement, and null on mobile.
   */
  marginBox?: MarginBox | null;
```

Derive the scale, and choose which tree the room has:

```tsx
  const marginScale = useMemo(
    () => (isMobile ? null : treeScale(marginBox ?? null)),
    [marginBox, isMobile],
  );
  /** True when the tree lives in the margin; false means the in-band fallback. */
  const inMargin = earned && marginScale !== null;
```

In `figuresFor`, build the Surfaces in the coordinate system of whichever canvas holds them:

```tsx
      surfacesRef.current = !earnedRef.current || isMobile
        ? []
        : marginScaleRef.current !== null
          // MARGIN-CANVAS coordinates: this canvas's own width and its own floor line.
          ? marginTreeSurfaces(
              marginTreeX(marginBoxRef.current!.width, marginScaleRef.current),
              marginBoxRef.current!.height,
              marginScaleRef.current,
            )
          // Band coordinates, exactly as before.
          : treeSurfaces(treeX(measured, band.scale), sceneGroundY(band), band.scale);
```

Give `assignPerch` the floor line of whichever canvas the branches are in. The existing call is
`assignPerch(agentsRef.current, surfacesRef.current, opts)`; it becomes:

```tsx
      if (surfacesRef.current.length > 0) {
        // The floor the climb starts from, in the same coordinates as the Surfaces: the margin
        // canvas's own height when the tree is there, the band's own ground line when it is not.
        const floorY = marginScaleRef.current !== null && marginBoxRef.current
          ? marginBoxRef.current.height
          : sceneGroundY(band);
        agentsRef.current = assignPerch(agentsRef.current, surfacesRef.current, opts, floorY);
      }
```

Publish the tree's figures the way the aerial ones are published — from the **same single pass**, so the three lists cannot disagree about a frame:

```tsx
    // ONE read per frame, feeding ALL THREE canvases. Not three independent reads: an airborne
    // bobit was once painted on two canvases for a whole flight because the band read a ref in
    // the frame loop while the render read a prop.
    const allowAir = allowAirRef.current;
    const surfaces = surfacesRef.current;
    const treeScaleNow = marginScaleRef.current;

    const air = aerialFigures(directorRef.current, band, darkMode, allowAir);
    // … existing aerial publish, unchanged …

    const onTree = treeFigures(
      stateRef.current, agentsRef.current, band, darkMode, surfaces, treeScaleNow,
    );
    treeFiguresRef.current = onTree;

    return crowdFigures(
      stateRef.current, agentsRef.current, band, darkMode, directorRef.current,
      allowAir, surfaces,
    );
```

`treeFiguresRef` is a ref, and `TreeMargin`'s `figuresFor` reads it — the same arrangement `propsFor` already uses for the director's props, and for the same reason: `BobitField` calls `figuresFor` first, so both read state that is current rather than a frame stale.

Keep the in-band tree in `propsFor` **only** when the margin one is not up:

```tsx
    // Desktop only, and only when there is no room for the margin tree.
    if (earnedRef.current && !isMobile && marginScaleRef.current === null) {
      out.push({ id: 'room:tree', kind: 'tree', /* …unchanged… */ });
    }
```

And mount it:

```tsx
      {inMargin && marginBox && (
        <TreeMargin
          box={marginBox}
          scale={marginScale as number}
          grow={growRef.current / TREE_GROW_SEC}
          darkMode={darkMode}
          figuresFor={() => treeFiguresRef.current}
        />
      )}
```

Mirror `marginBox` and `marginScale` into refs in a **layout** effect, not a passive one — the frame loop runs on rAF and a passive effect can land after it, which would paint one frame of figures against the previous frame's geometry. That is the same fix the aerial gate needed:

```tsx
  useLayoutEffect(() => { marginBoxRef.current = marginBox ?? null; }, [marginBox]);
  useLayoutEffect(() => { marginScaleRef.current = marginScale; }, [marginScale]);
```

- [ ] **Step 4: Typecheck and build**

Run: `cd frontend && npm run typecheck`
Expected: clean.

Run: `cd frontend && npm test`
Expected: the full suite green.

Run: `cd frontend && npm run build`
Expected: clean.

Run: `cd frontend && npm run smoke`
Expected: OK. A green build is not a page that loads — a CJS dependency once whited the app out with a React #130 while `tsc` and `vite build` were both happy.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/features/collection/TreeMargin.tsx src/features/collection/CollectionCrowd.tsx src/features/game/components/GameScreen.tsx
git commit -m "feat(bobits): mount the tree in the measured margin

A third canvas, flush with the column's measured right edge, floor line to
canopy. Its left edge IS that edge, so bound 1 of the occlusion relaxation
holds by geometry rather than by care -- which is also what lets this one
stay interactive, so a bobit can still be greeted from his branch.

All three figure lists come from one pass per frame. The margin box and
its scale are mirrored in LAYOUT effects, so the frame loop never paints
this frame's figures against last frame's geometry.

Under 140px of margin the in-band tree takes over, unchanged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Look at it

The gate that actually matters. Every defect in this feature that mattered was found by screenshot with the unit tests green: a T-pose clap, hands-on-hips clap, heads clipped on mobile, the back row off-canvas, the crowd bunched in the left two thirds, props never wired to the canvas, `pool-stumble` arriving with no poof, and an airborne bobit drawn on both canvases at once.

**Files:**
- Create: `frontend/scripts/bobit-tree.mjs`

**Interfaces:**
- Consumes: the running app.
- Produces: PNGs in `frontend/.shots/`.

- [ ] **Step 1: Write the contact sheet script**

Create `frontend/scripts/bobit-tree.mjs`, modelled on `bobit-scenes.mjs`:

```js
/**
 * Contact sheets for the margin tree.
 *
 * FULL-VIEWPORT screenshots, not the tree canvas alone. The whole question this sheet answers
 * is how the tree sits NEXT TO the card -- whether it crowds the HUD, whether the lowest branch
 * crowds the answers, whether the margin reads as heavy. A crop of the canvas cannot show any
 * of that. (The cannon taught the same lesson: its flight is on the fixed overlay, so band-only
 * shots missed it entirely.)
 *
 * Widths span both sides of MIN_TREE_MARGIN, so the fallback to the in-band tree is visible in
 * the same sheet as the thing it falls back from.
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-tree.mjs
 *
 * Writes frontend/.shots/tree-<width>-<theme>.png and tree-climb-<theme>.png.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';
const SEED = 'bobit-tree';
const SLUG = 'milwaukee-wi';

/** Both sides of the 140px margin crossover. 1024 should show the IN-BAND tree. */
const WIDTHS = [1920, 1440, 1280, 1024];

/**
 * Enough owned questions to be past 25% of the collection, so the tree is standing. NOT enough
 * to be the interesting case for the ceremony -- that is the climb sheet below.
 */
const OWNED = 40;

async function openRoom(context, width, height) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  page.on('console', m => {
    if (m.type() === 'error' || m.text().includes('[bobits]')) {
      console.log(`    console: ${m.text()}`);
    }
  });
  await page.goto(`${BASE}/?mock=1&collection=${SLUG}&owned=${OWNED}&bobitSeed=${SEED}`);
  const play = page.getByRole('button', { name: /play now|continue playing/i });
  await play.waitFor({ timeout: 15000 });
  await play.click();
  return page;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ deviceScaleFactor: 2 });
    await context.addInitScript(t => localStorage.setItem('ctc-theme', t), theme);

    for (const width of WIDTHS) {
      const page = await openRoom(context, width, 1080);
      // Long enough for the crowd to settle AND for somebody to have been sent up the tree:
      // assignPerch only picks a genuinely idle wanderer, and the climb itself is up to 4.4s.
      await page.waitForTimeout(12000);
      await page.screenshot({ path: `${OUT}/tree-${width}-${theme}.png` });
      console.log(`  shot: tree-${width}-${theme}`);
      await page.close();
    }

    // A climb, sampled. One page, frames across the time a bobit takes to go up.
    const page = await openRoom(context, 1920, 1080);
    await page.waitForTimeout(6000);
    for (let i = 0; i < 6; i++) {
      await page.screenshot({ path: `${OUT}/tree-climb-${theme}-${i}.png` });
      await page.waitForTimeout(900);
    }
    console.log(`  strip: tree-climb-${theme} (6 frames)`);
    await page.close();

    await context.close();
  }

  await browser.close();
  console.log(`\nWrote sheets to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
```

- [ ] **Step 2: Run it and look**

```bash
cd frontend
npm run dev          # in another shell
node scripts/bobit-tree.mjs
```

Then open every PNG and check, explicitly:

- [ ] Nothing the tree draws touches the question card or any answer option, at any width.
- [ ] 1024px shows the **in-band** tree, not a squeezed margin one.
- [ ] The trunk's base sits on the same floor line the crowd walks on — not above it, not below.
- [ ] A climber is on the trunk in at least one climb frame, standing, not seated, and not drawn near the floor while nominally on a branch.
- [ ] The perched bobit sits ON the branch's top edge, not through it or above it.
- [ ] Dark mode: the trunk, branches and accent notches are all visible. The field passes a LIGHT body colour in dark mode, so a hardcoded light detail vanishes — this is how the cannon shipped invisible.
- [ ] The tree does not read as competing with the HUD. If it does, the lever is `MARGIN_TREE_RIG_H`.
- [ ] Only ONE tree is on the page. Two means the fallback and the margin tree are both mounting.

- [ ] **Step 3: Drive a REAL milestone**

`__bobitScene` passes a synthetic `replay-<ts>` id that never becomes a resident, so the newcomer renders as an orphan with no agent — a tool structurally unable to show a whole class of bug. So cross the threshold for real:

```
http://localhost:5173/?mock=1&collection=milwaukee-wi&owned=<just under 25% of the pool>
```

Then answer A correctly until the tree is earned while you are watching, and check:

- [ ] The tree sprouts out of the floor over ~3s. It does not appear at full height, and it does not appear on mount.
- [ ] The two admirers are standing **under the trunk**, not at an empty stretch of floor.
- [ ] Reloading does not re-sprout it — growth belongs to the moment it is earned.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add scripts/bobit-tree.mjs
git commit -m "test(bobits): contact sheets for the margin tree

Full-viewport, not the canvas alone: the question is how the tree sits
next to the card, and a crop cannot show that. Four widths spanning the
140px crossover, so the in-band fallback appears in the same sheet as the
thing it falls back from. Both themes, because the field passes a light
body colour in dark mode.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Full verification before any PR**

```bash
cd frontend
npm test            # 669+ tests, all green
npm run typecheck   # clean
npm run build       # clean
npm run smoke       # OK
```

Do not claim any of these passed without the output in front of you.

---

## Self-review notes

**Spec coverage.** §1 → Task 8 step 1. §2 → Task 1. §2 "bound 1 becomes geometry" → Task 2 step 1. §3 → Task 2, plus Task 3 for `rootX`. §4 → Task 6, plus `TreeMargin`'s doc comment in Task 8 for the interactive-safety reasoning. §5 → Tasks 4 and 5. §6 → Task 7. §7 → distributed across every task's test step, plus Task 9. §8's file table → Tasks 1-9, all files accounted for.

**Four deliberate divergences from the spec**, all recorded above where they occur:

1. The spec's climb durations (1.2 / 2.3 / 3.3s) state 180px/s against the whole climb; it is the **ascent leg's** speed, so the real totals are 1.6 / 3.0 / 4.4s and `CLIMB_MAX_SEC` is 5. Task 4 says so.
2. The spec leaves the climb's endpoints unassigned. They are recorded by `assignPerch` at claim time (Task 5 step 4), because that is the only place holding the Surface — which is also why `assignPerch` now takes the canvas's `floorY`. It cannot be derived from `opts.band`: the margin canvas's floor is ~868px, the band's is 90.
3. The spec puts `MARGIN_TREE_RIG_H` / `MARGIN_TREE_HALF_W` in `treePlacement.ts`. They are in `props.ts` instead, because `treePlacement` already imports `TREE_HALF_W` from `props` and the other direction would close a cycle.
4. `treeFigures` reuses `figColor(toneOf(id))` and `(hashId(id) % 1000) / 250` rather than new colour and phase helpers, so a bobit's appearance and breathing rhythm do not change when he leaves the band for the tree.

**Open questions the spec leaves for a screenshot**, to be answered in Task 9 and reported, not silently resolved: whether `climb` needs a reversed clock coming down, and whether three branches beat two at 1280px where the tree is width-bound and shorter.

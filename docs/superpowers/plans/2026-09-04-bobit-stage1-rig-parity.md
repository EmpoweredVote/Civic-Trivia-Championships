# Bobit Stage 1 — Rig Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CTC's 14-animation rig fork with ev-landing's 41-animation rig, render every bobit from one canvas on one clock, and port the four interaction behaviors (pixel hit-test, hover greet, hold-to-poof, touch) so the two products behave identically.

**Architecture:** `leremyRig.ts` is converted wholesale from ev-landing's `leremy-rig.js`; CTC's four extra animations and its trophy/card props move to `rigExtras.ts` and layer on top. A new `bobitField.ts` owns a single canvas, a single `requestAnimationFrame` loop, and a shared clock — the four existing homepage components become consumers of it instead of owning canvases. All interaction logic is extracted as pure functions and reducers so it is unit-testable without a canvas; painting itself is verified by the existing Playwright smoke.

**Tech Stack:** TypeScript, React 19, Vite, Canvas 2D. Vitest (added by Task 1 — the repo currently has no test framework).

**Spec:** `docs/superpowers/specs/2026-09-04-bobit-collection-design.md`

## Global Constraints

- **Never rename CI jobs.** `.github/workflows/ci.yml` job names `Frontend build (tsc + vite)` and `Backend build (tsc)` are required by the master ruleset by name. The file says so at line 32. New checks go *inside* the existing job as steps.
- **The repo has no test framework.** Not in `frontend/`, not in `backend/`, not at root. Task 1 establishes it. No task before Task 1 can be TDD'd.
- **Frontend Node engine is `^24.0.0`** (`frontend/package.json`).
- **`useReducedMotion` must be honoured** by every component that animates. It already is; do not regress it.
- **Figure geometry must not change.** `CFG`, `REST`, `computePose` and `drawTorso` are already identical between the two rigs (verified 2026-09-04). Any visual diff in the body silhouette after Task 2 is a porting bug, not an intended change.
- **`bobitField` gates poof per figure.** Collection bobits (Stage 3) must be able to opt out of the destructive gesture. Build the gate in Stage 1 even though only Stage 3 uses it.
- **Do not port the PostHog stub.** ev-landing's preview copy stubs `window.posthog`; `HANDOFF.md` explicitly warns against carrying it over. CTC has real analytics.
- **Do not port ev-landing's singleton stage controller** (`attach`, `setAnim`, `setPlaying`, `setSpeed`, `setSkel`, and the `RT` object). It drives an internal demo page and has no consumer in CTC.

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/vitest.config.ts` | Create. Test runner config. |
| `frontend/src/components/bobbits/leremyRig.ts` | Rewrite. Converted from ev-landing `leremy-rig.js`: `CFG`, `REST`, `computePose`, `draw`, `drawShadow`, `drawSmoke`, `makeGait`, 41 animations. |
| `frontend/src/components/bobbits/rigExtras.ts` | Create. CTC-only `cheer`, `dance`, `offer`, `ponder`; `drawTrophy`, `drawQuizCard`; `figColor` / `FIG_COLORS`. |
| `frontend/src/components/bobbits/bobitField.ts` | Create. Field state, depth sort, pelvis offsets, figure geometry helpers. Pure — no DOM. |
| `frontend/src/components/bobbits/BobitField.tsx` | Create. The single canvas, single rAF, DPR handling, event wiring. |
| `frontend/src/components/bobbits/hitTest.ts` | Create. Pure candidate selection + ink confirmation. |
| `frontend/src/components/bobbits/greetReducer.ts` | Create. Pure hover-greet state machine. |
| `frontend/src/components/bobbits/poofReducer.ts` | Create. Pure poof state machine. |
| `frontend/src/components/bobbits/pointerGestures.ts` | Create. Pure mouse/touch gesture recognition feeding the poof reducer. |
| `frontend/src/components/bobbits/fleeReducer.ts` | Create. Pure post-poof exodus movement. |
| `frontend/src/components/bobbits/BobbitCanvas.tsx` | Delete at Task 12 — replaced by `BobitField.tsx`. |
| `frontend/src/components/bobbits/Bobbit*.tsx` (4 files) | Modify at Task 12. Keep public props, drop owned canvases. |
| `.github/workflows/ci.yml:28` | Modify at Task 1. Add a test step inside the existing frontend job. |

---

## Task 1: Test infrastructure

There is no test framework anywhere in this repo. Everything downstream depends on this task.

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/components/bobbits/__tests__/smoke.test.ts`
- Modify: `.github/workflows/ci.yml:28`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (run once, CI-safe) and `npm run test:watch` in `frontend/`. All later tasks assume `vitest`'s `describe` / `it` / `expect` globals are available.

- [ ] **Step 1: Install vitest**

```bash
cd frontend && npm install -D vitest@^3
```

- [ ] **Step 2: Create the config**

Node environment, not jsdom. Every test in this plan exercises pure functions; nothing needs a DOM. Adding jsdom now would be unused weight.

```ts
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add the scripts**

In `frontend/package.json`, add to `"scripts"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Write a failing test**

```ts
// frontend/src/components/bobbits/__tests__/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `cd frontend && npm test`
Expected: PASS, 1 test. If the runner itself fails to start, the config is wrong — fix before continuing.

- [ ] **Step 6: Wire into CI without renaming the job**

In `.github/workflows/ci.yml`, insert a step immediately after `- run: npm ci` (line 27) and before `- run: npm run build`:

```yaml
      # Unit tests for pure logic (rig math, gesture + poof reducers). Kept inside
      # this job rather than added as a new one -- the master ruleset requires the
      # existing check by name, and a new job would not be required.
      - run: npm test
```

Do not touch the `name:` field of either job.

- [ ] **Step 7: Verify the workflow still parses**

Run: `cd "C:/Project Test" && git diff --stat .github/workflows/ci.yml`
Expected: 1 file changed, 4 insertions. Confirm by eye that both `name:` lines are unchanged.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/components/bobbits/__tests__/smoke.test.ts .github/workflows/ci.yml
git commit -m "test: add vitest to frontend, wired into the existing CI job"
```

---

## Task 2: Port the rig core

Convert ev-landing's geometry and drawing primitives to TypeScript. Source of truth is `C:\ev-landing\ev-landing-main\leremy-rig.js`.

**Verified before planning:** `CFG`, `REST`, `computePose` and `drawTorso` are already identical between the two files apart from comments and type annotations. `neckW: 22` exists in ev-landing's `CFG` but is referenced nowhere — carry it across for fidelity, but it changes no output.

**Files:**
- Modify: `frontend/src/components/bobbits/leremyRig.ts`
- Create: `frontend/src/components/bobbits/__tests__/leremyRig.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CFG`, `REST`, `Pose`, `Point`, `Joints` (unchanged shapes from the current file)
  - `computePose(pose: Pose, cfg?: typeof CFG, origin?: Point): Joints`
  - `draw(ctx: CanvasRenderingContext2D, j: Joints, cfg?: typeof CFG, opts?: DrawOpts): void`
  - `drawShadow(ctx: CanvasRenderingContext2D, cx: number, groundY: number, w: number, color?: string): void`
  - `drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, spread: number, alpha: number, seed: number, t: number): void`
  - `wave(t: number, f: number, ph?: number): number`
  - `clonePose(p: Pose): Pose`
  - `DrawOpts` extended with ev-landing's prop flags: `arm?: 'R' | 'L'`, `mega?`, `megaColor?`, `book?`, `phone?`, `swirl?`, `laptop?`, `chair?`, `chairColor?` — plus the existing `color`, `card`, `cardRot`.

- [ ] **Step 1: Write the failing golden-value test**

`computePose` is pure math over a fixed rig, so exact joint positions are the right assertion. Compute the expected values by running the *existing* CTC implementation once before rewriting — they must not move.

```ts
// frontend/src/components/bobbits/__tests__/leremyRig.test.ts
import { describe, it, expect } from 'vitest';
import { CFG, REST, computePose, clonePose, wave } from '../leremyRig';

const round = (n: number) => Math.round(n * 1000) / 1000;

describe('computePose', () => {
  it('places the pelvis at the origin plus bob', () => {
    const j = computePose({ ...REST, bob: 7 }, CFG, { x: 0, y: 0 });
    expect(round(j.P.x)).toBe(0);
    expect(round(j.P.y)).toBe(7);
  });

  it('puts the head one torso + gap + radius above the pelvis at rest', () => {
    const j = computePose(REST, CFG, { x: 0, y: 0 });
    // spineA = 180 => straight up; head centre sits at torsoLen + gap + R above P
    expect(round(j.H.x)).toBe(0);
    expect(round(j.H.y)).toBe(round(-(CFG.torsoLen + CFG.gap + CFG.R)));
  });

  it('is unaffected by hunch on the legs', () => {
    const flat = computePose(REST, CFG, { x: 0, y: 0 });
    const curled = computePose({ ...REST, hunch: -40 }, CFG, { x: 0, y: 0 });
    expect(round(curled.fR.x)).toBe(round(flat.fR.x));
    expect(round(curled.fR.y)).toBe(round(flat.fR.y));
  });

  it('moves the head when hunch is applied', () => {
    const flat = computePose(REST, CFG, { x: 0, y: 0 });
    const curled = computePose({ ...REST, hunch: -40 }, CFG, { x: 0, y: 0 });
    expect(round(curled.H.x)).not.toBe(round(flat.H.x));
  });

  it('translates with the origin', () => {
    const a = computePose(REST, CFG, { x: 0, y: 0 });
    const b = computePose(REST, CFG, { x: 100, y: 50 });
    expect(round(b.H.x - a.H.x)).toBe(100);
    expect(round(b.H.y - a.H.y)).toBe(50);
  });
});

describe('wave', () => {
  it('is zero at t=0 with no phase', () => {
    expect(round(wave(0, 1))).toBe(0);
  });

  it('peaks at a quarter period', () => {
    expect(round(wave(0.25, 1))).toBe(1);
  });
});

describe('clonePose', () => {
  it('returns a copy, not the same object', () => {
    const p = clonePose(REST);
    p.lean = 99;
    expect(REST.lean).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it passes against the CURRENT file**

Run: `cd frontend && npm test -- leremyRig`
Expected: PASS. This is deliberate — the test pins current behaviour *before* the rewrite so the port can be proven not to change geometry. If any assertion fails now, stop: the assumption that the rigs match is wrong and the plan needs revisiting.

- [ ] **Step 3: Commit the characterisation test**

```bash
git add frontend/src/components/bobbits/__tests__/leremyRig.test.ts
git commit -m "test: pin current rig geometry before porting ev-landing's engine"
```

- [ ] **Step 4: Port the primitives**

Replace the body of `frontend/src/components/bobbits/leremyRig.ts` with a TypeScript conversion of these functions from `C:\ev-landing\ev-landing-main\leremy-rig.js`, in this order: `CFG`, `REST`, `vec`, `add`, `clonePose`, `wave`, `computePose`, `capsule`, `drawTorso`, `draw`, plus the prop helpers `drawMegaphone`, `drawBook`, `drawPhone`, `drawSwirl`, `drawLaptop`, `drawChair`, then `drawShadow` and `drawSmoke`.

Conversion rules:
- `const` → `export const` for the public surface listed under **Produces**.
- Add the type annotations already present in the current CTC file; they match.
- Keep every comment. They record measured decisions (why `hunch` is negative for right-facing walks, why the smoke radius is capped) that are not recoverable from the code.
- Do **not** port `ANIMATIONS`, `ORDER`, `makeGait`, `drawSkeleton`, or the `RT` stage controller — Task 3 handles the first three, and the last two have no consumer.
- Do **not** port `figColor` or `FIG_COLORS`; they are CTC additions and belong in `rigExtras.ts` (Task 4). Leave the existing exports in place until then so nothing breaks mid-task.

`drawSmoke` verbatim (this is the whole function; it has no dependencies beyond `D = Math.PI / 180`):

```ts
export function drawSmoke(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  spread: number, alpha: number,
  seed: number, t: number,
) {
  if (!(alpha > 0) || !(spread > 0)) return;
  const N = 9;
  ctx.save();
  ctx.fillStyle = '#8A8F98';
  for (let i = 0; i < N; i++) {
    const ang = ((seed * 37 + i * 61) % 360) * D;          // deterministic angle
    const rad = 0.35 + (((seed * 13 + i * 29) % 100) / 100) * 0.65;
    const drift = Math.sin(t * (0.7 + i * 0.13) + i) * spread * 0.14;
    const px = x + Math.cos(ang) * spread * rad + drift;
    const py = y - Math.abs(Math.sin(ang)) * spread * rad * 0.85 - spread * 0.2;
    const pr = spread * (0.26 + rad * 0.3);
    ctx.globalAlpha = Math.min(1, alpha) * (0.4 + rad * 0.45);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
```

- [ ] **Step 5: Run the geometry test against the ported file**

Run: `cd frontend && npm test -- leremyRig`
Expected: PASS, unchanged. Any failure means the port altered geometry — fix the port, never the test.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: errors only from files referencing animations that Task 3 has not ported yet (`BobbitScene`, `BobbitCardGreeter`, `BobbitTrophyCarry`, `BobbitCivicFactSitter`). No errors inside `leremyRig.ts` itself.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/bobbits/leremyRig.ts
git commit -m "feat: port ev-landing rig primitives, incl. drawSmoke and prop set"
```

---

## Task 3: Port the 41 animations

**Files:**
- Modify: `frontend/src/components/bobbits/leremyRig.ts`
- Create: `frontend/src/components/bobbits/__tests__/animations.test.ts`

**Interfaces:**
- Consumes: `CFG`, `REST`, `clonePose`, `wave` from Task 2.
- Produces:
  - `Animation` — `{ label: string; mood: string; frame(t: number, v?: Record<string, unknown>): Pose; seated?: boolean; book?: boolean; swirl?: boolean; laptop?: boolean; rope?: boolean; mega?: boolean }`
  - `ANIMATIONS: Record<string, Animation>` with exactly these 41 keys: `bored friendly present shrug confused spent notlistening witsend exhausted sassy stroll shuffle strut scurry march sneak trudge carry hefty climb rope peek jump sit read holdannoyed annoyed greet greetseat standstill paddleball toddle elder elderangry fall scold toddlemarch presentup heave heave2 painhop`
  - `makeGait(g: GaitOpts): Animation` where `GaitOpts = { label: string; mood: string; speed: number; stride: number; hunch: number; knee: number; arm: number; bob: number; head: number }`
  - `ANIMATIONS.walk` aliased to `ANIMATIONS.stroll` (ev-landing does this at `leremy-rig.js:1089`)

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/animations.test.ts
import { describe, it, expect } from 'vitest';
import { ANIMATIONS, makeGait, REST } from '../leremyRig';

const EXPECTED_KEYS = [
  'bored', 'friendly', 'present', 'shrug', 'confused', 'spent', 'notlistening',
  'witsend', 'exhausted', 'sassy', 'stroll', 'shuffle', 'strut', 'scurry',
  'march', 'sneak', 'trudge', 'carry', 'hefty', 'climb', 'rope', 'peek', 'jump',
  'sit', 'read', 'holdannoyed', 'annoyed', 'greet', 'greetseat', 'standstill',
  'paddleball', 'toddle', 'elder', 'elderangry', 'fall', 'scold', 'toddlemarch',
  'presentup', 'heave', 'heave2', 'painhop',
];

const POSE_KEYS = [
  'lean', 'headTilt', 'bob', 'hunch',
  'armRU', 'armRF', 'armLU', 'armLF',
  'legRU', 'legRF', 'legLU', 'legLF',
];

describe('ANIMATIONS', () => {
  it('has all 41 ported animations', () => {
    for (const k of EXPECTED_KEYS) {
      expect(ANIMATIONS[k], `missing animation: ${k}`).toBeDefined();
    }
  });

  it('aliases walk to stroll', () => {
    expect(ANIMATIONS.walk).toBe(ANIMATIONS.stroll);
  });

  it.each(EXPECTED_KEYS)('%s returns a finite pose across a full cycle', (key) => {
    for (let t = 0; t < 12; t += 0.05) {
      const p = ANIMATIONS[key].frame(t);
      for (const pk of POSE_KEYS) {
        const v = (p as Record<string, number>)[pk];
        if (v === undefined) continue;   // pose fields are optional
        expect(Number.isFinite(v), `${key}.${pk} at t=${t} was ${v}`).toBe(true);
      }
    }
  });

  it.each(EXPECTED_KEYS)('%s does not mutate REST', (key) => {
    const before = { ...REST };
    ANIMATIONS[key].frame(1.5);
    expect(REST).toEqual(before);
  });

  it.each(EXPECTED_KEYS)('%s carries a label and a mood', (key) => {
    expect(typeof ANIMATIONS[key].label).toBe('string');
    expect(ANIMATIONS[key].label.length).toBeGreaterThan(0);
    expect(typeof ANIMATIONS[key].mood).toBe('string');
  });
});

describe('makeGait', () => {
  it('produces an animation whose legs actually scissor', () => {
    const g = makeGait({
      label: 'Test', mood: 'testing',
      speed: 2, stride: 24, hunch: -7, knee: 30, arm: 14, bob: 3, head: -5,
    });
    const a = g.frame(0);
    const b = g.frame(0.25);
    expect(a.legRU).not.toBe(b.legRU);
  });

  it('is periodic in the walk cycle', () => {
    const g = makeGait({
      label: 'Test', mood: 'testing',
      speed: 2, stride: 24, hunch: -7, knee: 30, arm: 14, bob: 3, head: -5,
    });
    const period = 1 / 2;   // speed = cycles per second
    const round = (n: number) => Math.round(n * 100) / 100;
    expect(round(g.frame(0.1).legRU)).toBe(round(g.frame(0.1 + period).legRU));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- animations`
Expected: FAIL — `ANIMATIONS` has only the 14 CTC keys, `makeGait` is not exported.

- [ ] **Step 3: Port the animations**

Copy `makeGait` (`leremy-rig.js:1069`), then the `ANIMATIONS` object (`leremy-rig.js:435`–`1088`) and the `ANIMATIONS.walk = ANIMATIONS.stroll` alias (line 1089) into `leremyRig.ts`. Add the `Animation` interface above them.

The seven simple gaits are one line each and must be copied with their exact tuned constants:

```ts
  stroll:  makeGait({ label: 'Stroll', mood: 'just moseying…', speed: 2.0, stride: 24, hunch: -7, knee: 30, arm: 14, bob: 3, head: -5 }),
  shuffle: makeGait({ label: 'Shuffle', mood: 'five more minutes…', speed: 1.5, stride: 10, hunch: -12, knee: 12, arm: 5, bob: 1.5, head: -9 }),
  strut:   makeGait({ label: 'Strut', mood: 'yeah, I own this ledge.', speed: 2.2, stride: 30, hunch: -5, knee: 34, arm: 26, bob: 4, head: -6 }),
  scurry:  makeGait({ label: 'Scurry', mood: 'late late late late', speed: 4.6, stride: 15, hunch: -16, knee: 26, arm: 8, bob: 2, head: -7 }),
  march:   makeGait({ label: 'March', mood: 'hup, two, three, four', speed: 2.4, stride: 34, hunch: -2, knee: 6, arm: 30, bob: 5, head: 0 }),
  sneak:   makeGait({ label: 'Sneak', mood: 'shhh… nobody saw that', speed: 1.3, stride: 22, hunch: -22, knee: 52, arm: 10, bob: 6, head: -11 }),
  trudge:  makeGait({ label: 'Trudge', mood: 'why is this site SO long', speed: 1.1, stride: 13, hunch: -16, knee: 16, arm: 6, bob: 5, head: -15 }),
```

`carry` (line 623) and `hefty` (line 642) wrap `makeGait` and then override arms — port them whole, including the sag comment on `hefty`.

Do not retune any constant. These are measured values.

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- animations`
Expected: PASS, all 41 keys present, every frame finite, no `REST` mutation.

- [ ] **Step 5: Run the geometry test again to check for regressions**

Run: `cd frontend && npm test`
Expected: PASS, both suites.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/bobbits/leremyRig.ts frontend/src/components/bobbits/__tests__/animations.test.ts
git commit -m "feat: port all 41 ev-landing animations and makeGait"
```

---

## Task 4: Extract CTC's rig extras

The four CTC-only animations and the trophy/card props move out of the rig into their own layer, so the rig file stays a faithful mirror of ev-landing and future re-syncs are a clean overwrite.

**Files:**
- Create: `frontend/src/components/bobbits/rigExtras.ts`
- Modify: `frontend/src/components/bobbits/leremyRig.ts` (remove the extras)
- Create: `frontend/src/components/bobbits/__tests__/rigExtras.test.ts`

**Interfaces:**
- Consumes: `ANIMATIONS`, `Animation`, `Pose`, `REST`, `clonePose`, `wave`, `Joints`, `CFG` from Task 3.
- Produces:
  - `EXTRA_ANIMATIONS: Record<string, Animation>` — keys `cheer`, `dance`, `offer`, `ponder`
  - `ALL_ANIMATIONS: Record<string, Animation>` — `{ ...ANIMATIONS, ...EXTRA_ANIMATIONS }`. **Every consumer from Task 5 onward imports `ALL_ANIMATIONS`, never `ANIMATIONS`.**
  - `FIG_COLORS: { light: string[]; dark: string[] }`
  - `figColor(i: number, darkMode: boolean): string`
  - `drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void`
  - `drawQuizCard(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, rot: number): void`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/rigExtras.test.ts
import { describe, it, expect } from 'vitest';
import { ALL_ANIMATIONS, EXTRA_ANIMATIONS, figColor, FIG_COLORS } from '../rigExtras';
import { ANIMATIONS } from '../leremyRig';

describe('EXTRA_ANIMATIONS', () => {
  it('holds exactly the four CTC-only poses', () => {
    expect(Object.keys(EXTRA_ANIMATIONS).sort()).toEqual(['cheer', 'dance', 'offer', 'ponder']);
  });

  it('keeps them out of the ported rig', () => {
    for (const k of ['cheer', 'dance', 'offer', 'ponder']) {
      expect(ANIMATIONS[k], `${k} leaked into the ported rig`).toBeUndefined();
    }
  });
});

describe('ALL_ANIMATIONS', () => {
  it('merges the 41 ported plus the 4 extras', () => {
    expect(Object.keys(ALL_ANIMATIONS).length).toBe(46);   // 41 + 4 + the walk alias
  });

  it('exposes both families', () => {
    expect(ALL_ANIMATIONS.stroll).toBeDefined();
    expect(ALL_ANIMATIONS.dance).toBeDefined();
  });
});

describe('figColor', () => {
  it('picks from the light palette when not dark', () => {
    expect(figColor(0, false)).toBe(FIG_COLORS.light[0]);
  });

  it('picks from the dark palette when dark', () => {
    expect(figColor(0, true)).toBe(FIG_COLORS.dark[0]);
  });

  it('wraps past the end of the palette', () => {
    expect(figColor(6, false)).toBe(FIG_COLORS.light[0]);
    expect(figColor(7, true)).toBe(FIG_COLORS.dark[1]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- rigExtras`
Expected: FAIL — `rigExtras.ts` does not exist.

- [ ] **Step 3: Create `rigExtras.ts`**

Move these out of the pre-Task-2 version of `leremyRig.ts` (recover them with `git show HEAD~2:frontend/src/components/bobbits/leremyRig.ts` if they have already been overwritten):

- `FIG_COLORS` and `figColor` verbatim
- `TROPHY_GOLD`, `TROPHY_TEAL_DARK`, `TROPHY_TEAL_LIGHT`, the star helper, and `drawTrophy`
- `drawQuizCard`
- The `cheer`, `dance`, `offer`, `ponder` entries, wrapped as `EXTRA_ANIMATIONS`

`offer` and `ponder` are built from `ANIMATIONS.present` in the old file (`const p = ANIMATIONS.present.frame(t)`). `present` exists in the ported rig too, so the import is `import { ANIMATIONS } from './leremyRig'` and the reference is unchanged.

Then:

```ts
export const ALL_ANIMATIONS: Record<string, Animation> = { ...ANIMATIONS, ...EXTRA_ANIMATIONS };
```

- [ ] **Step 4: Remove the extras from `leremyRig.ts`**

Delete `FIG_COLORS`, `figColor`, `drawTrophy`, `drawQuizCard`, the trophy colour constants, and any `cheer`/`dance`/`offer`/`ponder` entries left in `ANIMATIONS`. Keep `card` and `cardRot` on `DrawOpts` — `draw()` still handles the prop; only the *drawing helper* moves. Import `drawQuizCard` into `leremyRig.ts` from `rigExtras.ts`.

**Watch for a circular import:** `leremyRig.ts` would import `drawQuizCard` from `rigExtras.ts`, which imports `ANIMATIONS` from `leremyRig.ts`. Break it by keeping `drawQuizCard` in `leremyRig.ts` alongside the other prop helpers, and exporting it *from* there and re-exporting through `rigExtras.ts`. Only the animations and palette move.

- [ ] **Step 5: Run the test**

Run: `cd frontend && npm test -- rigExtras`
Expected: PASS.

- [ ] **Step 6: Run everything**

Run: `cd frontend && npm test`
Expected: PASS, three suites.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/bobbits/rigExtras.ts frontend/src/components/bobbits/leremyRig.ts frontend/src/components/bobbits/__tests__/rigExtras.test.ts
git commit -m "refactor: split CTC rig extras out of the ported ev-landing rig"
```

---

## Task 5: Field geometry and depth sort

Pure logic only. No canvas, no React.

**Files:**
- Create: `frontend/src/components/bobbits/bobitField.ts`
- Create: `frontend/src/components/bobbits/__tests__/bobitField.test.ts`

**Interfaces:**
- Consumes: `ALL_ANIMATIONS` from Task 4.
- Produces:
  - `FieldFigure` —
    ```ts
    export interface FieldFigure {
      id: string;
      anim: string;
      color: string;
      x: number;          // px in field space
      groundY: number;    // px from field top to the ground-contact line
      scale: number;
      flip?: boolean;
      phase?: number;     // seconds added to the shared clock
      shadow?: boolean;   // default true
      poofable?: boolean; // default true — Stage 3 sets false for collection bobits
      greetable?: boolean;// default true
      props?: DrawOpts;
    }
    ```
  - `pelvisOffset(anim: string): number` — rig units above the ground-contact point
  - `sortByDepth(figures: FieldFigure[]): FieldFigure[]` — ascending `groundY`, stable
  - `figureBounds(f: FieldFigure): { left: number; right: number; top: number; bottom: number }`
  - `Surface` — `{ id: string; left: number; right: number; y: number }`. **Declared, not implemented.** The spec requires the interface seam so the later unlockable platforms, toys and buildings are additive rather than a rewrite. Nothing in Stage 1 consumes it; do not build climbing behaviour.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/bobitField.test.ts
import { describe, it, expect } from 'vitest';
import { pelvisOffset, sortByDepth, figureBounds } from '../bobitField';
import type { FieldFigure } from '../bobitField';

const fig = (over: Partial<FieldFigure> = {}): FieldFigure => ({
  id: 'a', anim: 'standstill', color: '#000', x: 0, groundY: 100, scale: 1, ...over,
});

describe('pelvisOffset', () => {
  it('is 112 for standing poses', () => {
    expect(pelvisOffset('standstill')).toBe(112);
    expect(pelvisOffset('stroll')).toBe(112);
    expect(pelvisOffset('greet')).toBe(112);
  });

  it('is 8 for seated poses', () => {
    expect(pelvisOffset('sit')).toBe(8);
    expect(pelvisOffset('read')).toBe(8);
    expect(pelvisOffset('greetseat')).toBe(8);
    expect(pelvisOffset('witsend')).toBe(8);
  });

  it('falls back to standing for an unknown pose', () => {
    expect(pelvisOffset('no-such-anim')).toBe(112);
  });
});

describe('sortByDepth', () => {
  it('draws further-back figures first', () => {
    const out = sortByDepth([
      fig({ id: 'front', groundY: 300 }),
      fig({ id: 'back', groundY: 100 }),
      fig({ id: 'mid', groundY: 200 }),
    ]);
    expect(out.map(f => f.id)).toEqual(['back', 'mid', 'front']);
  });

  it('is stable for equal groundY', () => {
    const out = sortByDepth([
      fig({ id: 'first', groundY: 100 }),
      fig({ id: 'second', groundY: 100 }),
    ]);
    expect(out.map(f => f.id)).toEqual(['first', 'second']);
  });

  it('does not mutate its input', () => {
    const input = [fig({ id: 'front', groundY: 300 }), fig({ id: 'back', groundY: 100 })];
    sortByDepth(input);
    expect(input.map(f => f.id)).toEqual(['front', 'back']);
  });
});

describe('figureBounds', () => {
  it('spans from the head down to the ground line', () => {
    const b = figureBounds(fig({ x: 50, groundY: 200, scale: 1 }));
    expect(b.bottom).toBeGreaterThanOrEqual(200);
    expect(b.top).toBeLessThan(200 - 112);
    expect(b.left).toBeLessThan(50);
    expect(b.right).toBeGreaterThan(50);
  });

  it('scales with the figure', () => {
    const big = figureBounds(fig({ scale: 1 }));
    const small = figureBounds(fig({ scale: 0.5 }));
    expect(big.right - big.left).toBeGreaterThan(small.right - small.left);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- bobitField`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/bobbits/bobitField.ts
import type { DrawOpts } from './leremyRig';

export interface FieldFigure {
  id: string;
  anim: string;
  color: string;
  x: number;
  groundY: number;
  scale: number;
  flip?: boolean;
  phase?: number;
  shadow?: boolean;
  poofable?: boolean;
  greetable?: boolean;
  props?: DrawOpts;
}

// Pelvis height above the ground-contact point, in rig units at scale 1. Standing poses
// plant their feet ~112 below the pelvis; seated poses barely lift off the seat. These are
// the same two constants ev-figures.js uses (feetY - 112 * S and feetY - 8 * S).
//
// 'rope' is deliberately absent: that figure hangs in mid-air from his hands and has no
// ground contact at all, so neither offset describes him. Its mode positions him directly.
// 'paddleball' is a standing idle despite sitting between the seated poses in ORDER.
const SEATED = new Set(['sit', 'read', 'greetseat', 'witsend']);

export function pelvisOffset(anim: string): number {
  return SEATED.has(anim) ? 8 : 112;
}

export function sortByDepth(figures: FieldFigure[]): FieldFigure[] {
  // Array.prototype.sort is stable in every engine we target (ES2019+), so equal
  // groundY keeps insertion order and the cast's declared order still reads.
  return [...figures].sort((a, b) => a.groundY - b.groundY);
}

// Generous enough to contain a raised wave arm and a head, tight enough to be a useful
// candidate filter before the ink check. Half-width 30 and height 90 above the pelvis are
// the values BobbitCanvas already used for its click box.
const HALF_W = 34;
const ABOVE_PELVIS = 96;

export function figureBounds(f: FieldFigure) {
  const pelvis = f.groundY - pelvisOffset(f.anim) * f.scale;
  return {
    left: f.x - HALF_W * f.scale,
    right: f.x + HALF_W * f.scale,
    top: pelvis - ABOVE_PELVIS * f.scale,
    bottom: f.groundY + 10 * f.scale,
  };
}

/**
 * A walkable/climbable ledge in field space. Declared now, consumed by nothing in Stage 1 —
 * the seam exists so the later unlockable platforms, toys and buildings can be added without
 * reworking how figures are positioned.
 */
export interface Surface {
  id: string;
  left: number;
  right: number;
  y: number;
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- bobitField`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/bobitField.ts frontend/src/components/bobbits/__tests__/bobitField.test.ts
git commit -m "feat: field geometry, pelvis offsets and depth sort"
```

---

## Task 6: Pixel-accurate hit testing

ev-landing walks 14 canvases and reads alpha on each. On one field canvas alpha alone cannot say *which* figure was hit, so the algorithm differs: filter to the topmost figure whose bounds contain the point, then confirm ink. The confirmation is injected as a function so the logic is testable with no canvas.

**Files:**
- Create: `frontend/src/components/bobbits/hitTest.ts`
- Create: `frontend/src/components/bobbits/__tests__/hitTest.test.ts`

**Interfaces:**
- Consumes: `FieldFigure`, `figureBounds`, `sortByDepth` from Task 5.
- Produces:
  - `type InkProbe = (figure: FieldFigure, px: number, py: number) => boolean`
  - `figureAtPoint(figures: FieldFigure[], px: number, py: number, probe: InkProbe): FieldFigure | null`
  - `boundsCandidates(figures: FieldFigure[], px: number, py: number): FieldFigure[]` — topmost first

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/hitTest.test.ts
import { describe, it, expect, vi } from 'vitest';
import { figureAtPoint, boundsCandidates } from '../hitTest';
import type { FieldFigure } from '../bobitField';

const fig = (over: Partial<FieldFigure> = {}): FieldFigure => ({
  id: 'a', anim: 'standstill', color: '#000', x: 0, groundY: 100, scale: 1, ...over,
});

const alwaysInk = () => true;
const neverInk = () => false;

describe('boundsCandidates', () => {
  it('returns nothing when the point is outside every figure', () => {
    expect(boundsCandidates([fig({ x: 0 })], 9999, 9999)).toEqual([]);
  });

  it('returns the figure whose box contains the point', () => {
    const f = fig({ id: 'hit', x: 50, groundY: 200 });
    expect(boundsCandidates([f], 50, 150).map(c => c.id)).toEqual(['hit']);
  });

  it('orders overlapping figures topmost first', () => {
    // Higher groundY paints later, so it is on top and must be tested first.
    const back = fig({ id: 'back', x: 50, groundY: 150 });
    const front = fig({ id: 'front', x: 50, groundY: 160 });
    const got = boundsCandidates([back, front], 50, 120);
    expect(got.map(c => c.id)).toEqual(['front', 'back']);
  });
});

describe('figureAtPoint', () => {
  it('returns null when nothing is under the point', () => {
    expect(figureAtPoint([fig()], 9999, 9999, alwaysInk)).toBeNull();
  });

  it('returns null when the box matches but there is no ink', () => {
    const f = fig({ x: 50, groundY: 200 });
    expect(figureAtPoint([f], 50, 150, neverInk)).toBeNull();
  });

  it('returns the figure when the box matches and there is ink', () => {
    const f = fig({ id: 'hit', x: 50, groundY: 200 });
    expect(figureAtPoint([f], 50, 150, alwaysInk)?.id).toBe('hit');
  });

  it('falls through to the figure behind when the front one is empty there', () => {
    const back = fig({ id: 'back', x: 50, groundY: 150 });
    const front = fig({ id: 'front', x: 50, groundY: 160 });
    const probe = (f: FieldFigure) => f.id === 'back';
    expect(figureAtPoint([back, front], 50, 120, probe)?.id).toBe('back');
  });

  it('probes at most once per candidate', () => {
    const probe = vi.fn(() => true);
    const back = fig({ id: 'back', x: 50, groundY: 150 });
    const front = fig({ id: 'front', x: 50, groundY: 160 });
    figureAtPoint([back, front], 50, 120, probe);
    expect(probe).toHaveBeenCalledTimes(1);   // stops at the first hit
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- hitTest`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/bobbits/hitTest.ts
import { figureBounds, sortByDepth } from './bobitField';
import type { FieldFigure } from './bobitField';

/**
 * Confirms the point lands on painted ink for this specific figure. Injected rather than
 * fixed so the selection logic is testable without a canvas — the real implementation
 * (BobitField.tsx) renders the one candidate to a reusable scratch canvas and reads alpha.
 */
export type InkProbe = (figure: FieldFigure, px: number, py: number) => boolean;

/** Figures whose bounding box contains the point, topmost (last-painted) first. */
export function boundsCandidates(figures: FieldFigure[], px: number, py: number): FieldFigure[] {
  const painted = sortByDepth(figures);
  const out: FieldFigure[] = [];
  for (let i = painted.length - 1; i >= 0; i--) {
    const b = figureBounds(painted[i]);
    if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) out.push(painted[i]);
  }
  return out;
}

export function figureAtPoint(
  figures: FieldFigure[], px: number, py: number, probe: InkProbe,
): FieldFigure | null {
  for (const c of boundsCandidates(figures, px, py)) {
    if (probe(c, px, py)) return c;
  }
  return null;
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- hitTest`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/hitTest.ts frontend/src/components/bobbits/__tests__/hitTest.test.ts
git commit -m "feat: pixel-accurate hit testing over a single field canvas"
```

---

## Task 7: Hover greet

**Files:**
- Create: `frontend/src/components/bobbits/greetReducer.ts`
- Create: `frontend/src/components/bobbits/__tests__/greetReducer.test.ts`

**Interfaces:**
- Consumes: nothing beyond types.
- Produces:
  - `GreetState` — `Record<string, { clock: number; linger: number }>` keyed by figure id
  - `GREET_LINGER = 1.6`
  - `greetReduce(state: GreetState, hoveredId: string | null, dt: number): GreetState`
  - `isGreeting(state: GreetState, id: string): boolean`
  - `greetClock(state: GreetState, id: string): number`

Behaviour, matching `ev-figures.js`: while hovered, the figure's greet clock advances and `linger` is pinned at `GREET_LINGER`. Once the cursor leaves, `linger` drains by `dt` and the greet clock keeps running. When `linger` reaches 0 the entry is dropped and the figure resumes its normal animation from where its own clock left off.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/greetReducer.test.ts
import { describe, it, expect } from 'vitest';
import { greetReduce, isGreeting, greetClock, GREET_LINGER } from '../greetReducer';

describe('greetReduce', () => {
  it('starts empty', () => {
    expect(isGreeting({}, 'a')).toBe(false);
  });

  it('begins greeting on first hover', () => {
    const s = greetReduce({}, 'a', 0.016);
    expect(isGreeting(s, 'a')).toBe(true);
  });

  it('advances the greet clock while hovered', () => {
    let s = greetReduce({}, 'a', 0.5);
    s = greetReduce(s, 'a', 0.5);
    expect(greetClock(s, 'a')).toBeCloseTo(1.0, 5);
  });

  it('pins linger at full while hovered', () => {
    let s = greetReduce({}, 'a', 0.5);
    s = greetReduce(s, 'a', 0.5);
    expect(s.a.linger).toBe(GREET_LINGER);
  });

  it('keeps greeting after the cursor leaves, for the linger window', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, null, 1.0);
    expect(isGreeting(s, 'a')).toBe(true);
  });

  it('stops greeting once the linger runs out', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, null, GREET_LINGER + 0.01);
    expect(isGreeting(s, 'a')).toBe(false);
  });

  it('re-arms the linger if the cursor comes back', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, null, 1.0);
    s = greetReduce(s, 'a', 0.1);
    expect(s.a.linger).toBe(GREET_LINGER);
  });

  it('handles two figures independently', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, 'b', 0.1);
    expect(isGreeting(s, 'a')).toBe(true);
    expect(isGreeting(s, 'b')).toBe(true);
  });

  it('does not mutate the previous state', () => {
    const s0 = greetReduce({}, 'a', 0.1);
    const before = s0.a.clock;
    greetReduce(s0, 'a', 0.5);
    expect(s0.a.clock).toBe(before);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- greetReducer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/bobbits/greetReducer.ts

/** Seconds a figure keeps greeting after the cursor leaves. Matches ev-figures.js. */
export const GREET_LINGER = 1.6;

export type GreetState = Record<string, { clock: number; linger: number }>;

export function greetReduce(state: GreetState, hoveredId: string | null, dt: number): GreetState {
  const next: GreetState = {};

  for (const id of Object.keys(state)) {
    if (id === hoveredId) continue;   // handled below, so the hovered figure is written once
    const entry = state[id];
    const linger = entry.linger - dt;
    if (linger > 0) next[id] = { clock: entry.clock + dt, linger };
    // else: dropped — he goes back about his day from his own clock
  }

  if (hoveredId) {
    const prev = state[hoveredId];
    next[hoveredId] = { clock: (prev ? prev.clock : 0) + dt, linger: GREET_LINGER };
  }

  return next;
}

export function isGreeting(state: GreetState, id: string): boolean {
  return state[id] !== undefined;
}

export function greetClock(state: GreetState, id: string): number {
  return state[id] ? state[id].clock : 0;
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- greetReducer`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/greetReducer.ts frontend/src/components/bobbits/__tests__/greetReducer.test.ts
git commit -m "feat: hover-greet state machine with 1.6s linger"
```

---

## Task 8: The poof state machine

The phases and timings are taken from `ev-figures.js:230` and `poofTick` at line 1455.

**Files:**
- Create: `frontend/src/components/bobbits/poofReducer.ts`
- Create: `frontend/src/components/bobbits/__tests__/poofReducer.test.ts`

**Interfaces:**
- Consumes: nothing beyond types.
- Produces:
  - `POOF_HOLD = 3.0`, `POOF_BURST = 0.6`, `POOF_STUN = 1.0`, `POOF_FIZZLE = 0.4`
  - `PoofPhase = 'idle' | 'holding' | 'poof' | 'stunned' | 'fleeing' | 'cleared' | 'fizzle'`
  - `PoofState` — `{ phase: PoofPhase; t: number; victimId: string | null; fx: number; fy: number; taken: boolean }`
  - `POOF_IDLE: PoofState`
  - `PoofEvent` — `{ type: 'grab'; id: string; fx: number; fy: number } | { type: 'release' } | { type: 'tick'; dt: number } | { type: 'allGone' }`
  - `poofReduce(state: PoofState, event: PoofEvent): PoofState`

`fx` / `fy` are the press point as a fraction of the figure's bounds, so the smoke sits where the user actually grabbed rather than at the figure's centre.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/poofReducer.test.ts
import { describe, it, expect } from 'vitest';
import {
  poofReduce, POOF_IDLE, POOF_HOLD, POOF_BURST, POOF_STUN, POOF_FIZZLE,
} from '../poofReducer';
import type { PoofState } from '../poofReducer';

const grab = (s: PoofState = POOF_IDLE) =>
  poofReduce(s, { type: 'grab', id: 'victim', fx: 0.5, fy: 0.8 });
const tick = (s: PoofState, dt: number) => poofReduce(s, { type: 'tick', dt });

describe('poofReduce', () => {
  it('starts idle', () => {
    expect(POOF_IDLE.phase).toBe('idle');
    expect(POOF_IDLE.victimId).toBeNull();
  });

  it('enters holding on grab and records the victim and press point', () => {
    const s = grab();
    expect(s.phase).toBe('holding');
    expect(s.victimId).toBe('victim');
    expect(s.fx).toBe(0.5);
    expect(s.fy).toBe(0.8);
  });

  it('ignores a second grab while already holding', () => {
    const s = poofReduce(grab(), { type: 'grab', id: 'other', fx: 0, fy: 0 });
    expect(s.victimId).toBe('victim');
  });

  it('stays holding until the full hold elapses', () => {
    const s = tick(grab(), POOF_HOLD - 0.01);
    expect(s.phase).toBe('holding');
  });

  it('bursts once the hold completes, and marks him taken', () => {
    const s = tick(grab(), POOF_HOLD);
    expect(s.phase).toBe('poof');
    expect(s.taken).toBe(true);
    expect(s.t).toBe(0);
  });

  it('goes to stunned after the burst', () => {
    const s = tick(tick(grab(), POOF_HOLD), POOF_BURST);
    expect(s.phase).toBe('stunned');
  });

  it('goes to fleeing after the stun', () => {
    let s = tick(grab(), POOF_HOLD);
    s = tick(s, POOF_BURST);
    s = tick(s, POOF_STUN);
    expect(s.phase).toBe('fleeing');
  });

  it('clears once everyone has left', () => {
    let s = tick(grab(), POOF_HOLD);
    s = tick(s, POOF_BURST);
    s = tick(s, POOF_STUN);
    s = poofReduce(s, { type: 'allGone' });
    expect(s.phase).toBe('cleared');
  });

  it('fizzles on release during the hold', () => {
    const s = poofReduce(tick(grab(), 1.0), { type: 'release' });
    expect(s.phase).toBe('fizzle');
    expect(s.t).toBe(0);
  });

  it('returns to idle when the fizzle finishes, forgetting the victim', () => {
    let s = poofReduce(tick(grab(), 1.0), { type: 'release' });
    s = tick(s, POOF_FIZZLE);
    expect(s.phase).toBe('idle');
    expect(s.victimId).toBeNull();
  });

  it('ignores release once the burst has already happened', () => {
    const burst = tick(grab(), POOF_HOLD);
    expect(poofReduce(burst, { type: 'release' }).phase).toBe('poof');
  });

  it('does not tick while idle', () => {
    expect(tick(POOF_IDLE, 5).t).toBe(0);
  });

  it('does not tick once cleared', () => {
    let s = tick(grab(), POOF_HOLD);
    s = tick(s, POOF_BURST);
    s = tick(s, POOF_STUN);
    s = poofReduce(s, { type: 'allGone' });
    expect(tick(s, 5).t).toBe(0);
  });

  it('does not mutate the previous state', () => {
    const s0 = grab();
    tick(s0, 1.0);
    expect(s0.t).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- poofReducer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/bobbits/poofReducer.ts

// Timings from ev-figures.js:230 (POOF_HOLD / POOF_BURST / POOF_STUN) and the
// 0.4s fizzle branch in poofTick.
export const POOF_HOLD = 3.0;
export const POOF_BURST = 0.6;
export const POOF_STUN = 1.0;
export const POOF_FIZZLE = 0.4;

export type PoofPhase =
  | 'idle' | 'holding' | 'poof' | 'stunned' | 'fleeing' | 'cleared' | 'fizzle';

export interface PoofState {
  phase: PoofPhase;
  t: number;
  victimId: string | null;
  /** Press point as a fraction of the victim's bounds, so the smoke sits where he was grabbed. */
  fx: number;
  fy: number;
  /** He is off the field; the smoke holds his last spot rather than following his bounds. */
  taken: boolean;
}

export const POOF_IDLE: PoofState = {
  phase: 'idle', t: 0, victimId: null, fx: 0.5, fy: 1, taken: false,
};

export type PoofEvent =
  | { type: 'grab'; id: string; fx: number; fy: number }
  | { type: 'release' }
  | { type: 'tick'; dt: number }
  | { type: 'allGone' };

export function poofReduce(state: PoofState, event: PoofEvent): PoofState {
  switch (event.type) {
    case 'grab':
      if (state.phase !== 'idle') return state;
      return { phase: 'holding', t: 0, victimId: event.id, fx: event.fx, fy: event.fy, taken: false };

    case 'release':
      // Only a hold can be cancelled. Once the burst has fired he is gone.
      if (state.phase !== 'holding') return state;
      return { ...state, phase: 'fizzle', t: 0 };

    case 'allGone':
      if (state.phase !== 'fleeing') return state;
      return { ...state, phase: 'cleared', t: 0 };

    case 'tick': {
      if (state.phase === 'idle' || state.phase === 'cleared') return state;
      const t = state.t + event.dt;

      if (state.phase === 'holding' && t >= POOF_HOLD) {
        return { ...state, phase: 'poof', t: 0, taken: true };
      }
      if (state.phase === 'poof' && t >= POOF_BURST) {
        return { ...state, phase: 'stunned', t: 0 };
      }
      if (state.phase === 'stunned' && t >= POOF_STUN) {
        return { ...state, phase: 'fleeing', t: 0 };
      }
      if (state.phase === 'fizzle' && t >= POOF_FIZZLE) {
        return { ...POOF_IDLE };
      }
      return { ...state, t };
    }
  }
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- poofReducer`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/poofReducer.ts frontend/src/components/bobbits/__tests__/poofReducer.test.ts
git commit -m "feat: poof state machine ported from ev-figures poofTick"
```

---

## Task 9: Pointer and touch gesture recognition

Turns raw pointer events into `PoofEvent`s. Kept separate from the reducer because the mouse and touch rules differ and both are fiddly. ev-landing's touch path learned the hard way that starting smoke on `touchstart` makes every tap begin a poof — so the touch path arms on a timer and cancels on movement past a slop threshold.

**Files:**
- Create: `frontend/src/components/bobbits/pointerGestures.ts`
- Create: `frontend/src/components/bobbits/__tests__/pointerGestures.test.ts`

**Interfaces:**
- Consumes: `PoofEvent` from Task 8.
- Produces:
  - `TOUCH_ARM_MS = 300`, `HOLD_SLOP = 12`
  - `GestureState` — `{ armed: boolean; startX: number; startY: number; touchArmedAt: number | null; pending: { id: string; fx: number; fy: number } | null }`
  - `GESTURE_IDLE: GestureState`
  - `gestureReduce(state, input): { state: GestureState; emit: PoofEvent | null }` where `input` is
    ```ts
    type GestureInput =
      | { kind: 'mousedown'; button: number; x: number; y: number; id: string | null; fx: number; fy: number }
      | { kind: 'mouseup'; button: number }
      | { kind: 'touchstart'; touches: number; x: number; y: number; id: string | null; fx: number; fy: number; now: number }
      | { kind: 'touchmove'; x: number; y: number; touches: number; now: number }
      | { kind: 'touchend' }
      | { kind: 'cancel' };
    ```
  - `shouldSuppressContextMenu(state: GestureState): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/pointerGestures.test.ts
import { describe, it, expect } from 'vitest';
import {
  gestureReduce, GESTURE_IDLE, TOUCH_ARM_MS, HOLD_SLOP, shouldSuppressContextMenu,
} from '../pointerGestures';

describe('mouse', () => {
  it('grabs on right mousedown over a figure', () => {
    const r = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    expect(r.emit).toEqual({ type: 'grab', id: 'a', fx: 0.5, fy: 0.9 });
    expect(r.state.armed).toBe(true);
  });

  it('ignores left mousedown', () => {
    const r = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 0, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    expect(r.emit).toBeNull();
    expect(r.state.armed).toBe(false);
  });

  it('ignores right mousedown over empty space', () => {
    const r = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: null, fx: 0, fy: 0,
    });
    expect(r.emit).toBeNull();
  });

  it('releases on right mouseup', () => {
    const down = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    const up = gestureReduce(down.state, { kind: 'mouseup', button: 2 });
    expect(up.emit).toEqual({ type: 'release' });
    expect(up.state.armed).toBe(false);
  });

  it('suppresses the context menu only while armed', () => {
    expect(shouldSuppressContextMenu(GESTURE_IDLE)).toBe(false);
    const down = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    expect(shouldSuppressContextMenu(down.state)).toBe(true);
  });
});

describe('touch', () => {
  it('does not grab immediately on touchstart', () => {
    const r = gestureReduce(GESTURE_IDLE, {
      kind: 'touchstart', touches: 1, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9, now: 1000,
    });
    expect(r.emit).toBeNull();
    expect(r.state.touchArmedAt).toBe(1000);
  });

  it('grabs once the arming delay has passed', () => {
    const start = gestureReduce(GESTURE_IDLE, {
      kind: 'touchstart', touches: 1, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9, now: 1000,
    });
    const held = gestureReduce(start.state, {
      kind: 'touchmove', x: 10, y: 10, touches: 1, now: 1000 + TOUCH_ARM_MS,
    });
    expect(held.emit).toEqual({ type: 'grab', id: 'a', fx: 0.5, fy: 0.9 });
  });

  it('cancels if the finger moves past the slop before arming', () => {
    const start = gestureReduce(GESTURE_IDLE, {
      kind: 'touchstart', touches: 1, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9, now: 1000,
    });
    const moved = gestureReduce(start.state, {
      kind: 'touchmove', x: 10 + HOLD_SLOP + 1, y: 10, touches: 1, now: 1050,
    });
    expect(moved.state.touchArmedAt).toBeNull();
    expect(moved.emit).toBeNull();
  });

  it('cancels on a second finger', () => {
    const start = gestureReduce(GESTURE_IDLE, {
      kind: 'touchstart', touches: 1, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9, now: 1000,
    });
    const two = gestureReduce(start.state, { kind: 'touchmove', x: 10, y: 10, touches: 2, now: 1050 });
    expect(two.state.touchArmedAt).toBeNull();
  });

  it('releases on touchend after arming', () => {
    const start = gestureReduce(GESTURE_IDLE, {
      kind: 'touchstart', touches: 1, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9, now: 1000,
    });
    const armed = gestureReduce(start.state, {
      kind: 'touchmove', x: 10, y: 10, touches: 1, now: 1000 + TOUCH_ARM_MS,
    });
    const end = gestureReduce(armed.state, { kind: 'touchend' });
    expect(end.emit).toEqual({ type: 'release' });
  });

  it('emits nothing on touchend if it never armed — a plain tap', () => {
    const start = gestureReduce(GESTURE_IDLE, {
      kind: 'touchstart', touches: 1, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9, now: 1000,
    });
    const end = gestureReduce(start.state, { kind: 'touchend' });
    expect(end.emit).toBeNull();
  });
});

describe('cancel', () => {
  it('releases and disarms', () => {
    const down = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    const c = gestureReduce(down.state, { kind: 'cancel' });
    expect(c.emit).toEqual({ type: 'release' });
    expect(c.state.armed).toBe(false);
  });

  it('emits nothing when nothing was armed', () => {
    expect(gestureReduce(GESTURE_IDLE, { kind: 'cancel' }).emit).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- pointerGestures`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/bobbits/pointerGestures.ts
import type { PoofEvent } from './poofReducer';

/**
 * How long a finger must rest on a Bobit before the hold begins. ev-figures.js used to call
 * poofStart on touchstart, so smoke began the instant you touched one and every tap looked
 * like the start of a destruction. Arm on a timer instead: lift before this and nothing
 * poof-related ever happened.
 */
export const TOUCH_ARM_MS = 300;

/** How far the finger may drift before the hold is treated as a scroll instead. */
export const HOLD_SLOP = 12;

export interface GestureState {
  armed: boolean;
  startX: number;
  startY: number;
  touchArmedAt: number | null;
  pending: { id: string; fx: number; fy: number } | null;
}

export const GESTURE_IDLE: GestureState = {
  armed: false, startX: 0, startY: 0, touchArmedAt: null, pending: null,
};

export type GestureInput =
  | { kind: 'mousedown'; button: number; x: number; y: number; id: string | null; fx: number; fy: number }
  | { kind: 'mouseup'; button: number }
  | { kind: 'touchstart'; touches: number; x: number; y: number; id: string | null; fx: number; fy: number; now: number }
  | { kind: 'touchmove'; x: number; y: number; touches: number; now: number }
  | { kind: 'touchend' }
  | { kind: 'cancel' };

interface Result { state: GestureState; emit: PoofEvent | null; }

const released = (state: GestureState): Result =>
  state.armed || state.touchArmedAt !== null
    ? { state: { ...GESTURE_IDLE }, emit: state.armed ? { type: 'release' } : null }
    : { state, emit: null };

export function gestureReduce(state: GestureState, input: GestureInput): Result {
  switch (input.kind) {
    case 'mousedown':
      if (input.button !== 2 || !input.id) return { state, emit: null };
      return {
        state: { armed: true, startX: input.x, startY: input.y, touchArmedAt: null, pending: null },
        emit: { type: 'grab', id: input.id, fx: input.fx, fy: input.fy },
      };

    case 'mouseup':
      if (input.button !== 2) return { state, emit: null };
      return released(state);

    case 'touchstart':
      if (input.touches !== 1 || !input.id) return { state: { ...GESTURE_IDLE }, emit: null };
      return {
        state: {
          armed: false, startX: input.x, startY: input.y,
          touchArmedAt: input.now,
          pending: { id: input.id, fx: input.fx, fy: input.fy },
        },
        emit: null,
      };

    case 'touchmove': {
      if (state.touchArmedAt === null) return { state, emit: null };
      if (input.touches !== 1) return { state: { ...GESTURE_IDLE }, emit: null };

      const dx = Math.abs(input.x - state.startX);
      const dy = Math.abs(input.y - state.startY);
      if (dx > HOLD_SLOP || dy > HOLD_SLOP) return { state: { ...GESTURE_IDLE }, emit: null };

      if (!state.armed && input.now - state.touchArmedAt >= TOUCH_ARM_MS && state.pending) {
        return {
          state: { ...state, armed: true },
          emit: { type: 'grab', ...state.pending },
        };
      }
      return { state, emit: null };
    }

    case 'touchend':
    case 'cancel':
      return released(state);
  }
}

/**
 * Firefox fires contextmenu on mousedown (mid-hold), Chrome on mouseup (as the gag lands).
 * Suppressing it unconditionally would break right-click everywhere else on the page, so it
 * is gated on a hold actually being armed.
 */
export function shouldSuppressContextMenu(state: GestureState): boolean {
  return state.armed;
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- pointerGestures`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/pointerGestures.ts frontend/src/components/bobbits/__tests__/pointerGestures.test.ts
git commit -m "feat: mouse and touch gesture recognition for the poof hold"
```

---

## Task 10: The field renderer

The one canvas, one clock, one rAF. This task is the only one whose deliverable is verified visually rather than by unit test — every piece of logic it consumes is already covered by Tasks 5–9.

**Files:**
- Create: `frontend/src/components/bobbits/BobitField.tsx`

**Interfaces:**
- Consumes: `ALL_ANIMATIONS` (Task 4); `FieldFigure`, `pelvisOffset`, `sortByDepth` (Task 5); `figureAtPoint`, `InkProbe` (Task 6); `greetReduce`, `isGreeting`, `greetClock` (Task 7); `poofReduce`, `POOF_IDLE` (Task 8); `gestureReduce`, `GESTURE_IDLE`, `shouldSuppressContextMenu` (Task 9); `draw`, `drawShadow`, `drawSmoke`, `computePose`, `CFG` (Task 2).
- Produces:
  - `BobitField(props: { figures: FieldFigure[]; height: number; animate?: boolean; interactive?: boolean; className?: string; style?: CSSProperties }): JSX.Element`

- [ ] **Step 1: Write the component**

Key implementation points, each of which exists for a reason found in the source:

1. **One rAF, one clock.** `const t = (now - start) / 1000`, and each figure's pose is `ALL_ANIMATIONS[f.anim].frame(t + (f.phase ?? 0))`. Never a per-figure clock.
2. **Memoise on the figures array identity.** The existing `BobbitScene` and `BobbitCardGreeter` both carry a comment explaining that a fresh array each render restarts the clock at 0 and makes figures visibly jump. Keep `figures` in a ref updated by an effect, so the rAF closure reads the latest array without restarting.
3. **DPR capped at 1.5**, matching ev-landing. CTC currently caps at 2; the lower cap is one of the levers Stage 2 will measure, and 1.5 is the value the landing page settled on.
4. **Paint order is `sortByDepth(figures)`.**
5. **Ink probe** renders the single candidate figure to a reusable 1-figure scratch canvas at the same scale, then reads a `(2*pad+1)²` alpha window around the local point, `pad = 6`. Only one figure is ever rendered per probe, and probes only run on throttled `mousemove`.
6. **Smoke draws last**, on top of every figure, using `drawSmoke` with the radius envelope from `poofDrawSmoke`: `holding` uses `12 + k*k*22` tightened by `*= 1 - (k - 0.7) * 1.2` once `k > 0.7`; `fizzle` uses `20 * f` with `f = 1 - t/0.4`; `poof` uses `58 + b * 70` with alpha `1 - b`.
7. **`interactive` defaults to false.** Only screens that opt in get listeners. A purely decorative field must not attach a document-level `mousemove`.
8. **`poofable !== false`** gates whether a figure can be grabbed. `greetable !== false` gates hover.
9. **Reduced motion** renders one frame at `t = 0` and attaches no rAF, matching the existing `animate={false}` path in `BobbitCanvas`.

```tsx
// frontend/src/components/bobbits/BobitField.tsx — structure
export function BobitField({ figures, height, animate = true, interactive = false, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const figuresRef = useRef(figures);
  const greetRef = useRef<GreetState>({});
  const poofRef = useRef<PoofState>(POOF_IDLE);
  const gestureRef = useRef<GestureState>(GESTURE_IDLE);
  const hoveredRef = useRef<string | null>(null);

  useEffect(() => { figuresRef.current = figures; }, [figures]);

  // ... single rAF effect keyed on [height, animate, interactive] only — NOT on `figures`,
  // which would restart the clock. The loop reads figuresRef.current each frame.
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: no errors in `BobitField.tsx`. Errors in the four not-yet-migrated `Bobbit*.tsx` components are expected until Task 12.

- [ ] **Step 3: Verify visually against a scratch route**

Add a temporary route rendering a `BobitField` with one figure of each of the 46 animations in a grid, run `npm run dev`, and confirm every pose renders on-model with no clipping and no NaN geometry (a NaN shows as a figure that vanishes entirely).

- [ ] **Step 4: Remove the scratch route**

Delete it before committing. It is a verification aid, not a deliverable.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/BobitField.tsx
git commit -m "feat: single-canvas bobit field with shared clock and interactions"
```

---

## Task 11: The exodus

`poofReduce` reaches `fleeing` and nothing renders it. This task makes the homepage aftermath real: the room freezes, drops what it was holding, then bolts off-screen and stays empty until reload.

In `ev-figures.js` this is the largest single behavior — `poofArmFlee` (line 614), `drawFlee` (811), `fleePose` (570), `raisePose` (593), `limpPose` (781), `hystericalLimp` (799), `dropSecs` (765), `spreadEagle` (1002), `stunDropAll` (1388), `drawDrops` (1418), `propOf` (1023), `drawGroundProp` (1045), and `sectionBreakLines` (531), which measures the page furniture they fall onto.

**Port a deliberately reduced version.** The landing page's flee has figures falling onto measured section-break lines, limping, and dropping props that keep rolling. CTC's homepage has none of that furniture, and `sectionBreakLines` reads document-flow geometry that does not exist inside a fixed-height field canvas. Port the *arc* — freeze, drop, scatter, gone — not the page-specific physics.

**Files:**
- Create: `frontend/src/components/bobbits/fleeReducer.ts`
- Create: `frontend/src/components/bobbits/__tests__/fleeReducer.test.ts`
- Modify: `frontend/src/components/bobbits/BobitField.tsx`

**Interfaces:**
- Consumes: `FieldFigure` (Task 5), `PoofState` / `PoofPhase` (Task 8).
- Produces:
  - `FleeState` — `Record<string, { dir: -1 | 1; x: number; startedAt: number; gone: boolean }>`
  - `armFlee(figures: FieldFigure[], victimId: string | null, fieldWidth: number): FleeState`
  - `fleeAdvance(state: FleeState, dt: number, fieldWidth: number): FleeState`
  - `allGone(state: FleeState): boolean`
  - `FLEE_SPEED = 210` (px/s), `FLEE_MARGIN = 70`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/fleeReducer.test.ts
import { describe, it, expect } from 'vitest';
import { armFlee, fleeAdvance, allGone, FLEE_SPEED, FLEE_MARGIN } from '../fleeReducer';
import type { FieldFigure } from '../bobitField';

const fig = (id: string, x: number): FieldFigure => ({
  id, anim: 'standstill', color: '#000', x, groundY: 100, scale: 1,
});

describe('armFlee', () => {
  it('arms every figure except the victim', () => {
    const s = armFlee([fig('a', 10), fig('victim', 50), fig('b', 90)], 'victim', 100);
    expect(Object.keys(s).sort()).toEqual(['a', 'b']);
  });

  it('sends each figure toward its nearer edge', () => {
    const s = armFlee([fig('left', 10), fig('right', 90)], null, 100);
    expect(s.left.dir).toBe(-1);
    expect(s.right.dir).toBe(1);
  });

  it('starts nobody as gone', () => {
    const s = armFlee([fig('a', 10)], null, 100);
    expect(s.a.gone).toBe(false);
    expect(allGone(s)).toBe(false);
  });

  it('reports allGone for an empty field', () => {
    expect(allGone({})).toBe(true);
  });
});

describe('fleeAdvance', () => {
  it('moves a figure toward its edge', () => {
    let s = armFlee([fig('right', 90)], null, 100);
    s = fleeAdvance(s, 0.1, 100);
    expect(s.right.x).toBeCloseTo(90 + FLEE_SPEED * 0.1, 5);
  });

  it('marks a figure gone once it clears the margin', () => {
    let s = armFlee([fig('right', 90)], null, 100);
    s = fleeAdvance(s, 10, 100);
    expect(s.right.gone).toBe(true);
    expect(s.right.x).toBeGreaterThan(100 + FLEE_MARGIN);
  });

  it('reports allGone once everyone has left', () => {
    let s = armFlee([fig('a', 10), fig('b', 90)], null, 100);
    s = fleeAdvance(s, 10, 100);
    expect(allGone(s)).toBe(true);
  });

  it('does not move figures already gone', () => {
    let s = armFlee([fig('a', 90)], null, 100);
    s = fleeAdvance(s, 10, 100);
    const restingX = s.a.x;
    s = fleeAdvance(s, 10, 100);
    expect(s.a.x).toBe(restingX);
  });

  it('does not mutate the previous state', () => {
    const s0 = armFlee([fig('a', 50)], null, 100);
    const x0 = s0.a.x;
    fleeAdvance(s0, 1, 100);
    expect(s0.a.x).toBe(x0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- fleeReducer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/bobbits/fleeReducer.ts
import type { FieldFigure } from './bobitField';

/** How fast the room bolts. Faster than any gait — this is a scramble, not a walk. */
export const FLEE_SPEED = 210;

/** How far past the edge a figure must get before he counts as gone. */
export const FLEE_MARGIN = 70;

export type FleeState = Record<string, { dir: -1 | 1; x: number; startedAt: number; gone: boolean }>;

/**
 * Everyone still on the field runs for their nearer edge. The victim is excluded — he was
 * already taken by the burst and has no position left to run from.
 */
export function armFlee(
  figures: FieldFigure[], victimId: string | null, fieldWidth: number,
): FleeState {
  const out: FleeState = {};
  for (const f of figures) {
    if (f.id === victimId) continue;
    out[f.id] = { dir: f.x < fieldWidth / 2 ? -1 : 1, x: f.x, startedAt: 0, gone: false };
  }
  return out;
}

export function fleeAdvance(state: FleeState, dt: number, fieldWidth: number): FleeState {
  const out: FleeState = {};
  for (const id of Object.keys(state)) {
    const e = state[id];
    if (e.gone) { out[id] = e; continue; }
    const x = e.x + e.dir * FLEE_SPEED * dt;
    const gone = e.dir > 0 ? x > fieldWidth + FLEE_MARGIN : x < -FLEE_MARGIN;
    out[id] = { ...e, x, startedAt: e.startedAt + dt, gone };
  }
  return out;
}

export function allGone(state: FleeState): boolean {
  return Object.keys(state).every(id => state[id].gone);
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- fleeReducer`
Expected: PASS, 10 tests.

- [ ] **Step 5: Wire into `BobitField`**

- On entering `stunned`: pin every figure at `dt = 0` for the phase's full second. ev-landing does the prop drop at the *start* of the stun deliberately, so falling props are the only thing moving during the freeze.
- On entering `fleeing`: call `armFlee` once, then `fleeAdvance` each frame. Fleeing figures render with `ALL_ANIMATIONS.scurry` and `flip` set from `dir`.
- When `allGone` returns true, dispatch `{ type: 'allGone' }` to the poof reducer, which moves it to `cleared`.
- In `cleared`, render nothing. The page stays empty until reload, as on the landing page.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/bobbits/fleeReducer.ts frontend/src/components/bobbits/__tests__/fleeReducer.test.ts frontend/src/components/bobbits/BobitField.tsx
git commit -m "feat: post-poof exodus — stun, scatter, empty until reload"
```

---

## Task 12: Migrate the four homepage components

Each keeps its public props exactly — `Dashboard.tsx` and `CollectionPicker.tsx` must not change — and stops owning a canvas.

**Files:**
- Modify: `frontend/src/components/bobbits/BobbitScene.tsx`
- Modify: `frontend/src/components/bobbits/BobbitCardGreeter.tsx`
- Modify: `frontend/src/components/bobbits/BobbitTrophyCarry.tsx`
- Modify: `frontend/src/components/bobbits/BobbitCivicFactSitter.tsx`
- Delete: `frontend/src/components/bobbits/BobbitCanvas.tsx`

**Interfaces:**
- Consumes: `BobitField` (Task 10), `figColor` (Task 4).
- Produces: no public API change. `BobbitScene(props: { darkMode: boolean; isMobile: boolean })`, `BobbitCardGreeter(props: { darkMode: boolean; isMobile: boolean })`, `BobbitTrophyCarry(props: { darkMode: boolean; isMobile: boolean })`, `BobbitCivicFactSitter(props: { darkMode: boolean })` all keep their current signatures.

- [ ] **Step 1: Migrate `BobbitScene`**

Replace its `BobbitCanvas` usage with `BobitField`. Its two `dance` figures become `FieldFigure`s with `groundY = height - railBottom`. Keep the `useMemo` and its comment — the reason it exists is unchanged. Keep the `fireTopRain` click behaviour by passing `interactive` and handling the click through the field's hit test.

- [ ] **Step 2: Migrate `BobbitCardGreeter`**

One `greetseat` figure. Preserve `seatFromTop` and its comment — the note that undershooting it clips the head records a confirmed regression.

- [ ] **Step 3: Migrate `BobbitTrophyCarry`**

This is the substantial one. Its hand-rolled `Phase` state machine (`'walk' | 'lowering' | 'rising1' | 'waving' | 'lowering2' | 'rising2' | 'offstage'`) drives a walk cycle that `ALL_ANIMATIONS.carry` now provides natively. Keep the phase machine — it choreographs the trophy set-down, which no ported animation covers — but replace its per-frame pose construction with `ALL_ANIMATIONS.carry.frame(gaitClock)` and `ALL_ANIMATIONS.heave.frame(...)`. `CARRY_REF_JOINTS` stays: the trophy's hold height is computed from it.

- [ ] **Step 4: Migrate `BobbitCivicFactSitter`**

Straight port of its figure list onto `BobitField`.

- [ ] **Step 5: Delete `BobbitCanvas.tsx`**

Run: `cd frontend && grep -rn "BobbitCanvas" src/`
Expected: no results. If any remain, migrate them before deleting.

- [ ] **Step 6: Typecheck and test**

Run: `cd frontend && npm run typecheck && npm test`
Expected: both clean.

- [ ] **Step 7: Build and smoke**

Run: `cd frontend && npm run build && npm start & npm run smoke`
Expected: smoke passes. This is the check that catches a runtime mount failure a green `tsc` would miss — the exact class of bug the Vite 8 confetti incident produced.

- [ ] **Step 8: Verify the homepage by eye**

Run `npm run dev` and confirm on `/`: the card greeter waves on the featured card, the trophy pair walks in and sets the trophy down, the dancing pair sits on the footer, hovering any figure produces a greet, and a 3-second right-hold poofs one and empties the page.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/bobbits/
git commit -m "refactor: move homepage bobbits onto the shared field, drop BobbitCanvas"
```

---

## Task 13: The dialogue layer

Sequenced last deliberately — it does not block Stage 2 or Stage 3, so it can slip without holding up the collection mechanic.

**Files:**
- Create: `frontend/src/components/bobbits/dialogue/lines.ts` (from `ev-lines.js`)
- Create: `frontend/src/components/bobbits/dialogue/quotes.ts` (from `ev-quotes.js`)
- Create: `frontend/src/components/bobbits/dialogue/copy.en.ts` (from `ev-copy.en.js`)
- Create: `frontend/src/components/bobbits/dialogue/bubbleReducer.ts`
- Create: `frontend/src/components/bobbits/__tests__/bubbleReducer.test.ts`
- Modify: `frontend/src/components/bobbits/BobitField.tsx`

**Interfaces:**
- Consumes: `FieldFigure` (Task 5), `BobitField` (Task 10).
- Produces:
  - `BubbleState` — `Record<string, { text: string; ttl: number }>`
  - `BUBBLE_TTL = 12`
  - `bubbleReduce(state: BubbleState, event: BubbleEvent, dt: number): BubbleState`
  - `BubbleEvent` — `{ type: 'open'; id: string; text: string } | { type: 'dismiss'; id: string } | { type: 'dismissAll' } | { type: 'tick' }`

**Content note:** ev-landing's lines are written for a landing page ("why is this site SO long"). Do not ship them verbatim in CTC. Port the *mechanism* in this task; the copy is a separate content pass against CTC's voice, and `docs/voice-and-tone.md` in ev-landing is the reference for house style.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/bobbits/__tests__/bubbleReducer.test.ts
import { describe, it, expect } from 'vitest';
import { bubbleReduce, BUBBLE_TTL } from '../dialogue/bubbleReducer';

describe('bubbleReduce', () => {
  it('opens a bubble with a full lifetime', () => {
    const s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    expect(s.a.text).toBe('hi');
    expect(s.a.ttl).toBe(BUBBLE_TTL);
  });

  it('expires a bubble after its lifetime', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'tick' }, BUBBLE_TTL + 0.01);
    expect(s.a).toBeUndefined();
  });

  it('keeps a bubble alive before its lifetime is up', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'tick' }, BUBBLE_TTL - 0.5);
    expect(s.a).toBeDefined();
  });

  it('dismisses one bubble by id', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'open', id: 'b', text: 'yo' }, 0);
    s = bubbleReduce(s, { type: 'dismiss', id: 'a' }, 0);
    expect(s.a).toBeUndefined();
    expect(s.b).toBeDefined();
  });

  it('dismisses every bubble at once', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'open', id: 'b', text: 'yo' }, 0);
    s = bubbleReduce(s, { type: 'dismissAll' }, 0);
    expect(Object.keys(s)).toEqual([]);
  });

  it('re-opening resets the lifetime', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'tick' }, BUBBLE_TTL - 0.5);
    s = bubbleReduce(s, { type: 'open', id: 'a', text: 'again' }, 0);
    expect(s.a.ttl).toBe(BUBBLE_TTL);
    expect(s.a.text).toBe('again');
  });

  it('does not mutate the previous state', () => {
    const s0 = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    bubbleReduce(s0, { type: 'tick' }, 1);
    expect(s0.a.ttl).toBe(BUBBLE_TTL);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- bubbleReducer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `bubbleReducer.ts`**

```ts
// frontend/src/components/bobbits/dialogue/bubbleReducer.ts

/** Seconds a bubble stays up before its reader goes back to his book. From ev-figures.js. */
export const BUBBLE_TTL = 12;

export type BubbleState = Record<string, { text: string; ttl: number }>;

export type BubbleEvent =
  | { type: 'open'; id: string; text: string }
  | { type: 'dismiss'; id: string }
  | { type: 'dismissAll' }
  | { type: 'tick' };

export function bubbleReduce(state: BubbleState, event: BubbleEvent, dt: number): BubbleState {
  switch (event.type) {
    case 'open':
      return { ...state, [event.id]: { text: event.text, ttl: BUBBLE_TTL } };

    case 'dismiss': {
      const next = { ...state };
      delete next[event.id];
      return next;
    }

    case 'dismissAll':
      return {};

    case 'tick': {
      const next: BubbleState = {};
      for (const id of Object.keys(state)) {
        const ttl = state[id].ttl - dt;
        if (ttl > 0) next[id] = { text: state[id].text, ttl };
      }
      return next;
    }
  }
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- bubbleReducer`
Expected: PASS, 7 tests.

- [ ] **Step 5: Port the line-selection modules**

Convert `ev-lines.js` (context tagging and line selection) and `ev-quotes.js` to TypeScript under `dialogue/`. Port the selection *logic* verbatim; replace the line content with CTC placeholder copy carrying a `TODO(content)` marker, so the content pass is a separate reviewable change rather than landing-page voice shipped by accident.

- [ ] **Step 6: Render bubbles in `BobitField`**

Draw bubbles after figures and before smoke. A bubble anchors above its figure's head — `figureBounds(f).top` minus the bubble height.

- [ ] **Step 7: Dismiss on the poof**

When `poofReduce` transitions to `poof`, emit `{ type: 'dismissAll' }`. ev-landing calls `dismissBubbles()` at exactly this point, with a comment recording why: a closed bubble that leaves a dangling handle on its Bobit means he never goes back to what he was doing.

- [ ] **Step 8: Typecheck, test, build, smoke**

Run: `cd frontend && npm run typecheck && npm test && npm run build`
Expected: all clean.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/bobbits/dialogue/ frontend/src/components/bobbits/BobitField.tsx frontend/src/components/bobbits/__tests__/bubbleReducer.test.ts
git commit -m "feat: bobit dialogue layer with bubble lifetimes"
```

---

## Roadmap — Stages 2 and 3

Not planned in detail. Stage 3's task breakdown depends on Stage 2's measured numbers, and writing it against a guessed population cap would mean rewriting it.

### Stage 2 — performance spike

Deliverable is a numbers table, not shipped code. Build an instrumented harness over `BobitField` that ramps population and records frame time per device class, measuring three scenes separately:

1. **Idle crowd** — the phase-bucket cache's best case. Hypothesis: quantising phase into ~24 buckets turns N pose computations plus ~15N path ops into 24 tile renders plus N blits, for roughly a quarter of the cost with no perceptible difference.
2. **Phase-gradient scenes** (stadium wave, clap ripple) — the same draw-call pattern as idle, blitted in x order rather than randomly. Expected to be free; confirm it.
3. **Unique-pose scenes** (the tier-5 pile-on) — defeats the cache and costs full price. The real worst case; must not be inferred from the crowd number.

Secondary levers to measure: DPR cap 1.5 vs 2, viewport culling, silhouette-LOD for back-row figures.

Output: naive vs. pose-cached numbers per device class per scene, and a recommended population cap. A cap below 154 means Stage 3 gains a crowd-LOD rule, not a redesign.

### Stage 3 — the collection mechanic

Sized by Stage 2. Components, from the spec:

- `BobitProgressStore` interface plus the localStorage driver (`ctc.bobits.v1`)
- Deterministic per-question tone and position from a hash of `externalId`
- `crowdReducer` — residents, arrivals, departures, celebration tier; pure and unit-tested like `gameReducer.ts`
- The five-tier escalation ladder, confetti at 5/5 only via `fireFireworks`
- The loss sequence: rise, smoke, burst, 0.8s freeze, scan, shrug, resume within 2.5s
- Game-screen wiring, with `poofable: false` on every collection bobit

The server driver is a follow-on and is what unlocks difficulty gating, since question selection runs on the backend and cannot read localStorage.

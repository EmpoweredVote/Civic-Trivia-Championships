# Bobit Entrances Implementation Plan (2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make earning a bobit an event — purple smoke and a flash for the first one a collection ever gives you, a cannon for the second, and four funny short entrances for every one after.

**Architecture:** A pure `sceneDirector` runs scenes that are DATA: a list of timed beats naming a role, a pose, a destination and an effect. It casts agents into roles, owns them for the scene, hands them back, and arbitrates floor so two scenes never fight for the same ground. Figures the director puts in the air are drawn on a second, non-interactive overlay canvas spanning the game area, so a cannon shot can pass in front of the question card without the layout moving.

**Tech Stack:** TypeScript, React 19, Vitest (node environment — no DOM), canvas 2D via the ported Leremy rig. Playwright + chromium for rendered verification.

**Spec:** `docs/superpowers/specs/2026-09-12-bobit-living-room-design.md` — **read its 2026-09-14 addendum first**, which corrects four things plan 1 changed.

**Plan 2 of 3.** Plan 1 (the living floor) shipped. Plan 3 is the tree, perching and the 25% milestone.

## Global Constraints

- **The layout never moves.** The band stays 96px desktop / 72px mobile. No growing, no shifting. (Chris, 2026-09-14.)
- **The occlusion relaxation is bounded to four rules**, all of which must hold:
  1. **Transient only** — a figure passes through; nothing comes to rest over the card.
  2. **Reveal phase only** — never while the timer runs and the player is aiming at an answer.
  3. **`pointer-events: none`** — the overlay can never intercept a click.
  4. **Set pieces only** — ordinary arrivals and pool entrances stay wholly inside the band.
- **The crowd at rest never occludes anything.** Unchanged from 2026-09-05.
- **Never edit `leremyRig.ts`** — it mirrors ev-landing and must stay a clean overwrite. Additions go in `rigExtras.ts`.
- **`poofable: false`** on every crowd figure. A poof means "you got this wrong".
- **One ground line.** No depth. `agentPlacement` ignores its depth argument.
- **The swirl and the cannon fire once per collection, ever.** They are precious; a dev replay route is a requirement, not a convenience.
- Tests are node-environment and pure: no DOM, no canvas, seeded RNG. Run from `frontend/`: `npm test`, `npm run typecheck`.

---

## File Structure

**Create:**
- `frontend/src/features/collection/sceneDirector.ts` — pure timeline runner: casting, beats, floor reservation, ground/air layering.
- `frontend/src/features/collection/scenes/types.ts` — `Beat`, `Scene`, shared helpers.
- `frontend/src/features/collection/scenes/arrival01Swirl.ts`
- `frontend/src/features/collection/scenes/arrival02Cannon.ts`
- `frontend/src/features/collection/scenes/poolEntrances.ts`
- `frontend/src/features/collection/scenes/index.ts` — `sceneForArrival(ordinal, rand)`.
- `frontend/src/components/bobbits/props.ts` — `drawCannon`, the `FieldProp` type.
- `frontend/src/features/collection/__tests__/sceneDirector.test.ts`
- `frontend/src/features/collection/__tests__/scenes.test.ts`
- `frontend/src/components/bobbits/__tests__/props.test.ts`

**Modify:**
- `frontend/src/components/bobbits/rigExtras.ts` — `splayed`, `flail`, `drawSmokePuff`.
- `frontend/src/components/bobbits/BobitField.tsx` — a `props` array, drawn in depth order with figures.
- `frontend/src/components/bobbits/fieldGeometry.ts` — `FieldProp`.
- `frontend/src/features/collection/crowdFigures.ts` — merge director output with agent output.
- `frontend/src/features/collection/CollectionCrowd.tsx` — drive the director; mount the overlay.
- `frontend/src/features/collection/crowdAgents.ts` — a `cast` activity the director owns.
- `frontend/src/dev/mockGameApi.ts` — `?scene=` replay.

---

### Task 1: Coloured smoke

**Files:**
- Modify: `frontend/src/components/bobbits/rigExtras.ts`
- Test: `frontend/src/components/bobbits/__tests__/rigExtras.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `drawSmokePuff(ctx, x, y, spread, alpha, seed, t, color)` — same shape as the rig's `drawSmoke` plus a colour.

The rig's `drawSmoke` hardcodes `#8A8F98`. Do not edit it.

- [ ] **Step 1: Write the failing test**

Append to `rigExtras.test.ts`:

```ts
import { drawSmokePuff, SMOKE_PURPLE } from '../rigExtras';

/** Records the fillStyles a draw call actually used. */
function recordingCtx() {
  const fills: string[] = [];
  const calls: string[] = [];
  return {
    fills, calls,
    ctx: {
      save() { calls.push('save'); }, restore() { calls.push('restore'); },
      beginPath() {}, fill() { calls.push('fill'); },
      arc() {},
      set fillStyle(v: string) { fills.push(v); },
      get fillStyle() { return fills[fills.length - 1] ?? ''; },
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D,
  };
}

describe('drawSmokePuff', () => {
  it('paints in the colour it is given, not the rig grey', () => {
    const { ctx, fills } = recordingCtx();
    drawSmokePuff(ctx, 0, 0, 20, 1, 1, 0, SMOKE_PURPLE);
    expect(fills).toContain(SMOKE_PURPLE);
    expect(fills).not.toContain('#8A8F98');
  });

  it('draws nothing at all when it has no alpha or no spread', () => {
    for (const [spread, alpha] of [[20, 0], [0, 1], [-5, 1]]) {
      const { ctx, calls } = recordingCtx();
      drawSmokePuff(ctx, 0, 0, spread, alpha, 1, 0, SMOKE_PURPLE);
      expect(calls).toEqual([]);
    }
  });

  it('restores the context it was handed', () => {
    const { ctx, calls } = recordingCtx();
    drawSmokePuff(ctx, 0, 0, 20, 1, 1, 0, SMOKE_PURPLE);
    expect(calls.filter(c => c === 'save').length)
      .toBe(calls.filter(c => c === 'restore').length);
  });

  it('puts several puffs down, not one blob', () => {
    const { ctx, calls } = recordingCtx();
    drawSmokePuff(ctx, 0, 0, 20, 1, 1, 0, SMOKE_PURPLE);
    expect(calls.filter(c => c === 'fill').length).toBeGreaterThan(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/rigExtras.test.ts`
Expected: FAIL — `drawSmokePuff` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `rigExtras.ts`:

```ts
/** The arrival colour. Brand purple from FIG_COLORS, lightened so it reads as smoke. */
export const SMOKE_PURPLE = '#9B7BE0';

/**
 * The rig's `drawSmoke`, with a colour.
 *
 * `leremyRig.drawSmoke` hardcodes '#8A8F98' and the rig is a mirror of ev-landing, so a
 * variant lives here rather than a parameter being added there. Geometry is deliberately
 * identical -- the same deterministic angle/radius scatter -- so the two read as one effect.
 */
export function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  spread: number, alpha: number,
  seed: number, t: number,
  color: string,
) {
  if (!(alpha > 0) || !(spread > 0)) return;
  const N = 9;
  const D = Math.PI / 180;
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < N; i++) {
    const ang = ((seed * 37 + i * 61) % 360) * D;
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/rigExtras.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bobbits/rigExtras.ts frontend/src/components/bobbits/__tests__/rigExtras.test.ts
git commit -m "feat(bobits): purple smoke"
```

---

### Task 2: `splayed` and `flail`

**Files:**
- Modify: `frontend/src/components/bobbits/rigExtras.ts`
- Test: `frontend/src/components/bobbits/__tests__/rigExtras.test.ts`

**Interfaces:**
- Consumes: `ANIMATIONS`, `clonePose`, `wave`, `REST` from `./leremyRig`.
- Produces: `EXTRA_ANIMATIONS.splayed`, `EXTRA_ANIMATIONS.flail`, reachable via `ALL_ANIMATIONS`.

**Angle convention, which has now caused two T-poses:** `armRU`/`armRF` are BOTH measured from
the upper-body direction and are ABSOLUTE, not relative to each other. `0` points straight DOWN,
`+ve` toward the viewer's right, `90` is horizontal. `armRF` is not an elbow bend.

- [ ] **Step 1: Write the failing test**

```ts
describe('splayed', () => {
  it('is registered', () => {
    expect(ALL_ANIMATIONS.splayed).toBeDefined();
  });

  it('holds all four limbs out, like something being stretched by them', () => {
    const p = ALL_ANIMATIONS.splayed.frame(0);
    // This is the ONE pose where near-horizontal arms are correct.
    expect(Math.abs(p.armRU)).toBeGreaterThan(70);
    expect(Math.abs(p.armLU)).toBeGreaterThan(70);
    expect(Math.abs(p.legRU)).toBeGreaterThan(25);
    expect(Math.abs(p.legLU)).toBeGreaterThan(25);
  });

  it('keeps left and right mirrored, so he hangs straight', () => {
    const p = ALL_ANIMATIONS.splayed.frame(0.3);
    expect(p.armRU).toBeCloseTo(-p.armLU, 5);
    expect(p.legRU).toBeCloseTo(-p.legLU, 5);
  });

  it('trembles, rather than being a still frame', () => {
    const a = ALL_ANIMATIONS.splayed.frame(0).armRU;
    const b = ALL_ANIMATIONS.splayed.frame(0.25).armRU;
    expect(a).not.toBeCloseTo(b, 3);
  });
});

describe('flail', () => {
  it('is registered', () => {
    expect(ALL_ANIMATIONS.flail).toBeDefined();
  });

  it('windmills the arms out of phase with each other', () => {
    // Both arms moving identically is a jumping-jack, not panic.
    const offsets = [0, 0.1, 0.2, 0.3, 0.4].map(t => {
      const p = ALL_ANIMATIONS.flail.frame(t);
      return p.armRU + p.armLU;      // 0 for a perfectly mirrored pose
    });
    expect(Math.max(...offsets.map(Math.abs))).toBeGreaterThan(15);
  });

  it('travels a long way round, so it reads as windmilling', () => {
    const samples = [0, 0.12, 0.25, 0.37, 0.5].map(t => ALL_ANIMATIONS.flail.frame(t).armRU);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(90);
  });

  it('kicks the legs too -- he is airborne, not standing', () => {
    const samples = [0, 0.15, 0.3, 0.45].map(t => ALL_ANIMATIONS.flail.frame(t).legRU);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/rigExtras.test.ts`
Expected: FAIL — `ALL_ANIMATIONS.splayed` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add to `EXTRA_ANIMATIONS` in `rigExtras.ts`:

```ts
  // Held out by both arms and both legs, as if two people are stretching him -- the instant the
  // flash leaves him hanging in mid-air, before he drops.
  //
  // Near-horizontal upper arms are CORRECT here. That is a T-pose, and this is the one pose in
  // the catalogue that wants one: he is being held, not doing something with his hands. The
  // clap and the trophy grip both had to be rescued from exactly this shape, so it is worth
  // saying out loud that here it is the point.
  splayed: {
    label: "Splayed", mood: "...whoa",
    frame(t: number) {
      const p = clonePose(REST);
      const tremble = wave(t, 7.5);
      p.armRU = 88 + tremble * 4; p.armRF = 92 + tremble * 5;
      p.armLU = -88 - tremble * 4; p.armLF = -92 - tremble * 5;
      p.legRU = 34 + tremble * 3; p.legRF = 12;
      p.legLU = -34 - tremble * 3; p.legLF = -12;
      p.hunch = 4;
      p.headTilt = tremble * 5;
      p.bob = -2;
      return p;
    },
  },
  // Airborne and panicking: arms windmilling right the way round, out of phase with each other,
  // legs cycling. Used for the whole flight out of the cannon.
  flail: {
    label: "Flailing", mood: "AAAAAA",
    frame(t: number) {
      const p = clonePose(REST);
      const r = t * 6.5;                       // revolutions, fast
      const l = r + 1.9;                       // out of phase: panic, not a jumping jack
      p.armRU = Math.sin(r) * 120 + 40;
      p.armRF = Math.sin(r + 0.5) * 90 + 30;
      p.armLU = Math.sin(l) * -120 - 40;
      p.armLF = Math.sin(l + 0.5) * -90 - 30;
      p.legRU = 20 + Math.sin(r * 0.8) * 34;
      p.legRF = -20 + Math.sin(r * 0.8 + 1) * 24;
      p.legLU = -20 + Math.sin(l * 0.8) * 34;
      p.legLF = 20 + Math.sin(l * 0.8 + 1) * 24;
      p.hunch = -6;
      p.headTilt = Math.sin(r * 0.5) * 14;
      return p;
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/rigExtras.test.ts`
Expected: PASS

- [ ] **Step 5: Fix the pose-count tests**

Two tests in that file assert the exact CTC pose list and `ALL_ANIMATIONS.length`. Update them
to include `flail` and `splayed` (9 extras, 51 total).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/bobbits/rigExtras.ts frontend/src/components/bobbits/__tests__/rigExtras.test.ts
git commit -m "feat(bobits): splayed and flail poses"
```

> **Reviewer note:** these are asserted numerically only. Task 11 renders them. Two poses in this
> rig have now shipped a T-pose past a green joint test.

---

### Task 3: Props on the field

**Files:**
- Create: `frontend/src/components/bobbits/props.ts`
- Create: `frontend/src/components/bobbits/__tests__/props.test.ts`
- Modify: `frontend/src/components/bobbits/fieldGeometry.ts`
- Modify: `frontend/src/components/bobbits/BobitField.tsx`

**Interfaces:**
- Consumes: `FieldFigure` from `./fieldGeometry`.
- Produces:
  - `interface FieldProp { id: string; kind: 'cannon'; x: number; groundY: number; scale: number; flip?: boolean; angle?: number }` in `fieldGeometry.ts`
  - `drawCannon(ctx, x, groundY, scale, angle, flip, color)` in `props.ts`
  - `BobitField` accepts `props?: FieldProp[]` and `propsFor?: (t, dt) => FieldProp[]`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/bobbits/__tests__/props.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { drawCannon, cannonMuzzle } from '../props';

function recordingCtx() {
  const ops: string[] = [];
  return {
    ops,
    ctx: {
      save() { ops.push('save'); }, restore() { ops.push('restore'); },
      translate() {}, rotate() {}, scale() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
      fill() { ops.push('fill'); }, stroke() { ops.push('stroke'); },
      ellipse() {},
      fillStyle: '', strokeStyle: '', lineWidth: 0, lineJoin: '', lineCap: '',
    } as unknown as CanvasRenderingContext2D,
  };
}

describe('drawCannon', () => {
  it('draws something and leaves the context balanced', () => {
    const { ctx, ops } = recordingCtx();
    drawCannon(ctx, 100, 50, 0.2, -32, false, '#444');
    expect(ops.filter(o => o === 'fill').length).toBeGreaterThan(0);
    expect(ops.filter(o => o === 'save').length).toBe(ops.filter(o => o === 'restore').length);
  });
});

describe('cannonMuzzle', () => {
  it('sits above and ahead of the cannon it belongs to', () => {
    const m = cannonMuzzle(100, 50, 0.2, -32, false);
    expect(m.x).toBeGreaterThan(100);     // ahead, firing right
    expect(m.y).toBeLessThan(50);         // above the ground line
  });

  it('mirrors when the cannon is flipped', () => {
    const r = cannonMuzzle(100, 50, 0.2, -32, false);
    const l = cannonMuzzle(100, 50, 0.2, -32, true);
    expect(100 - l.x).toBeCloseTo(r.x - 100, 5);
    expect(l.y).toBeCloseTo(r.y, 5);
  });

  it('rises with the barrel angle', () => {
    const shallow = cannonMuzzle(100, 50, 0.2, -10, false);
    const steep = cannonMuzzle(100, 50, 0.2, -60, false);
    expect(steep.y).toBeLessThan(shallow.y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/props.test.ts`
Expected: FAIL — cannot find module `../props`.

- [ ] **Step 3: Write the prop**

Create `frontend/src/components/bobbits/props.ts`:

```ts
/**
 * Scene props: things that are not figures but stand on the same floor.
 *
 * Drawn by BobitField in the same pass as the figures so a bobit can walk behind one. Geometry
 * is in the same rig units figures use, so a prop and a figure at the same `scale` agree about
 * how big the world is.
 */

/** Barrel length in rig units, from the pivot. The muzzle is at its far end. */
const BARREL_LEN = 96;
const BARREL_R = 17;
const WHEEL_R = 26;

/**
 * Where the barrel's mouth is, in field px. The cannon fires FROM here, so the flight has to
 * start here or the bobit appears out of thin air next to the muzzle.
 */
export function cannonMuzzle(
  x: number, groundY: number, scale: number, angle: number, flip = false,
) {
  const a = (angle * Math.PI) / 180;
  const dir = flip ? -1 : 1;
  const pivotY = groundY - WHEEL_R * scale;
  return {
    x: x + dir * Math.cos(a) * BARREL_LEN * scale,
    y: pivotY + Math.sin(a) * BARREL_LEN * scale,
  };
}

/**
 * A stubby cartoon cannon: two wheels, a barrel on a pivot, a knob on the back with a string.
 * `angle` is degrees from horizontal, NEGATIVE being nose-up, which matches `cannonMuzzle`.
 */
export function drawCannon(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, scale: number, angle: number, flip = false,
  color = '#3F4854',
) {
  const a = (angle * Math.PI) / 180;
  const dir = flip ? -1 : 1;

  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(dir * scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // wheel
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -WHEEL_R, WHEEL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#AAB2BF';
  ctx.beginPath();
  ctx.arc(0, -WHEEL_R, WHEEL_R * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // barrel, pivoted at the axle
  ctx.save();
  ctx.translate(0, -WHEEL_R);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-14, -BARREL_R);
  ctx.lineTo(BARREL_LEN, -BARREL_R * 0.8);
  ctx.lineTo(BARREL_LEN, BARREL_R * 0.8);
  ctx.lineTo(-14, BARREL_R);
  ctx.closePath();
  ctx.fill();
  // muzzle ring
  ctx.fillStyle = '#AAB2BF';
  ctx.beginPath();
  ctx.ellipse(BARREL_LEN, 0, BARREL_R * 0.34, BARREL_R * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
  // firing knob on the breech
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-18, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/props.test.ts`
Expected: PASS

- [ ] **Step 5: Add `FieldProp` and render it**

In `fieldGeometry.ts`:

```ts
/**
 * A scene prop standing on the field. Not a figure: it has no pose and no hit box, and the
 * pointer never finds it.
 */
export interface FieldProp {
  id: string;
  kind: 'cannon';
  x: number;
  /** px from the field's top to the prop's ground contact line. */
  groundY: number;
  scale: number;
  flip?: boolean;
  /** Degrees from horizontal for a cannon barrel; negative is nose-up. */
  angle?: number;
}
```

In `BobitField.tsx`, add to the props interface:

```tsx
  /** Scene props (a cannon). Painted with the figures, behind anything nearer the viewer. */
  propsList?: FieldProp[];
  /** Per-frame prop source, called alongside `figuresFor`. */
  propsFor?: (t: number, dt: number, width: number) => FieldProp[];
```

Hold them in refs exactly as `figures`/`figuresFor` are held, and in the render loop paint each
prop **before** the figures (props stand behind the crowd, so a bobit passing in front of the
cannon reads correctly):

```tsx
      for (const p of propList) {
        if (p.kind === 'cannon') {
          drawCannon(c, p.x, p.groundY, p.scale, p.angle ?? -32, p.flip, CANNON_COLOR);
        }
      }
```

with `const CANNON_COLOR = '#3F4854';` at module scope and `drawCannon` imported from `./props`.

- [ ] **Step 6: Verify**

Run: `cd frontend && npm run typecheck && npm test`
Expected: clean, all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/bobbits/props.ts frontend/src/components/bobbits/__tests__/props.test.ts frontend/src/components/bobbits/fieldGeometry.ts frontend/src/components/bobbits/BobitField.tsx
git commit -m "feat(bobits): a cannon the field can draw"
```

---

### Task 4: Scene types and the beat format

**Files:**
- Create: `frontend/src/features/collection/scenes/types.ts`
- Test: covered by Task 5's director tests.

**Interfaces:**
- Produces: `Beat`, `Scene`, `SceneLayer`, `ROLE_HOST`, `ROLE_NEWCOMER`.

- [ ] **Step 1: Write the types**

Create `frontend/src/features/collection/scenes/types.ts`:

```ts
/**
 * A scene is DATA, not code.
 *
 * Every set piece is a list of timed beats. The director interprets them; the scene files say
 * nothing about canvases, agents or React. That is what lets a cannon shot be a deterministic
 * unit test rather than something you have to sit and watch, and it is what makes adding the
 * "large library of random entrances" a matter of dropping files in this folder.
 */

/** Which canvas a figure is on. `air` is the overlay that may pass in front of the card. */
export type SceneLayer = 'ground' | 'air';

export const ROLE_HOST = 'host';
export const ROLE_NEWCOMER = 'newcomer';

export interface Beat {
  /** Seconds from the scene's start. Beats are applied in `at` order. */
  at: number;
  /** Which role this beat commands. */
  role: string;
  /** Rig animation key to play from this beat until the next one changes it. */
  pose?: string;
  /** Pose variant, for per-side poses like `highfive`. */
  hand?: 'R' | 'L';
  /**
   * Destination as a fraction 0-1 of the scene's OWN span, not of the band. A scene that
   * reserves the middle third still writes 0 and 1 for its own ends.
   */
  moveTo?: number;
  /** How to get there. `arc` is the only one that leaves the ground. */
  path?: 'snap' | 'walk' | 'run' | 'arc';
  /** Peak height of an `arc`, in px above the ground line. Ignored for other paths. */
  arcPeak?: number;
  /** Which canvas to draw on from this beat onward. */
  layer?: SceneLayer;
  /** A puff of smoke at this role's position. */
  smoke?: { spread: number; color?: string };
  /** A white flash at this role's position. */
  flash?: boolean;
  /** Place (or with null, remove) a prop at this role's slot. */
  prop?: { kind: 'cannon'; angle: number } | null;
  /** Hide the figure for this role from here on -- used between the flash and the landing. */
  hidden?: boolean;
}

export interface Scene {
  id: string;
  /** Seconds. The director releases every cast member when this elapses. */
  duration: number;
  /**
   * Fraction of the band's width this scene needs, 0-1. Two running scenes may never overlap
   * in reserved span.
   */
  span: number;
  /** Roles this scene casts. `newcomer` is always the arriving bobit. */
  roles: string[];
  beats: Beat[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/collection/scenes/types.ts
git commit -m "feat(bobits): the beat format scenes are written in"
```

---

### Task 5: The director

**Files:**
- Create: `frontend/src/features/collection/sceneDirector.ts`
- Create: `frontend/src/features/collection/__tests__/sceneDirector.test.ts`

**Interfaces:**
- Consumes: `Beat`, `Scene`, `SceneLayer` (Task 4); `AgentState` from `./crowdAgents`.
- Produces:
  - `interface Actor { role: string; agentId: string | null; x: number; y: number; pose: string; hand?: 'R'|'L'; layer: SceneLayer; hidden: boolean }`
  - `interface RunningScene { scene: Scene; t: number; left: number; right: number; cast: Record<string, string> }`
  - `interface DirectorState { running: RunningScene[]; props: Array<{ id: string; kind: 'cannon'; x: number; angle: number; flip: boolean }>; effects: Array<{ id: string; kind: 'smoke'|'flash'; x: number; y: number; t: number; spread: number; color?: string }> }`
  - `directorInit(): DirectorState`
  - `canStage(state, span, width): { left: number; right: number } | null`
  - `startScene(state, scene, newcomerId, width, rand): DirectorState`
  - `directorStep(state, dt, width, groundY): DirectorState`
  - `actorsOf(state, width, groundY): Actor[]`
  - `castIds(state): Set<string>`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/collection/__tests__/sceneDirector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  directorInit, canStage, startScene, directorStep, actorsOf, castIds,
} from '../sceneDirector';
import type { Scene } from '../scenes/types';

const WIDTH = 1000;
const GROUND = 80;
const rand = () => 0.5;

const TINY: Scene = {
  id: 'tiny', duration: 2, span: 0.2, roles: ['newcomer'],
  beats: [
    { at: 0, role: 'newcomer', pose: 'splayed', moveTo: 0, layer: 'ground' },
    { at: 1, role: 'newcomer', pose: 'friendly', moveTo: 1, path: 'walk' },
  ],
};

describe('canStage', () => {
  it('finds floor in an empty room', () => {
    expect(canStage(directorInit(), 0.3, WIDTH)).not.toBeNull();
  });

  it('refuses a span that cannot fit beside what is already running', () => {
    const s = startScene(directorInit(), { ...TINY, span: 0.85 }, 'a', WIDTH, rand);
    expect(canStage(s, 0.85, WIDTH)).toBeNull();
  });

  it('finds room beside a narrow scene', () => {
    const s = startScene(directorInit(), { ...TINY, span: 0.2 }, 'a', WIDTH, rand);
    expect(canStage(s, 0.2, WIDTH)).not.toBeNull();
  });

  it('never returns overlapping ground', () => {
    let s = startScene(directorInit(), { ...TINY, span: 0.3 }, 'a', WIDTH, rand);
    s = startScene(s, { ...TINY, id: 'b', span: 0.3 }, 'b', WIDTH, rand);
    const [p, q] = s.running;
    expect(p.right <= q.left || q.right <= p.left).toBe(true);
  });
});

describe('directorStep', () => {
  it('runs a scene and then lets go of it', () => {
    let s = startScene(directorInit(), TINY, 'a', WIDTH, rand);
    expect(castIds(s).has('a')).toBe(true);
    s = directorStep(s, TINY.duration + 0.01, WIDTH, GROUND);
    expect(s.running).toHaveLength(0);
    expect(castIds(s).has('a')).toBe(false);
  });

  it('applies the beat in force at the current time, not a later one', () => {
    let s = startScene(directorInit(), TINY, 'a', WIDTH, rand);
    s = directorStep(s, 0.5, WIDTH, GROUND);
    expect(actorsOf(s, WIDTH, GROUND)[0].pose).toBe('splayed');
    s = directorStep(s, 0.6, WIDTH, GROUND);
    expect(actorsOf(s, WIDTH, GROUND)[0].pose).toBe('friendly');
  });

  it('walks between beat destinations rather than snapping', () => {
    const walky: Scene = {
      ...TINY, duration: 4,
      beats: [
        { at: 0, role: 'newcomer', pose: 'stroll', moveTo: 0 },
        { at: 1, role: 'newcomer', pose: 'stroll', moveTo: 1, path: 'walk' },
      ],
    };
    let s = startScene(directorInit(), walky, 'a', WIDTH, rand);
    s = directorStep(s, 1.0, WIDTH, GROUND);
    const start = actorsOf(s, WIDTH, GROUND)[0].x;
    s = directorStep(s, 0.4, WIDTH, GROUND);
    const mid = actorsOf(s, WIDTH, GROUND)[0].x;
    s = directorStep(s, 2.0, WIDTH, GROUND);
    const end = actorsOf(s, WIDTH, GROUND)[0].x;
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeLessThan(end);
  });

  it('lifts an arc off the ground and puts it back down', () => {
    const flying: Scene = {
      ...TINY, duration: 4,
      beats: [
        { at: 0, role: 'newcomer', pose: 'flail', moveTo: 0 },
        { at: 1, role: 'newcomer', pose: 'flail', moveTo: 1, path: 'arc', arcPeak: 200, layer: 'air' },
      ],
    };
    let s = startScene(directorInit(), flying, 'a', WIDTH, rand);
    s = directorStep(s, 1.0, WIDTH, GROUND);
    const grounded = actorsOf(s, WIDTH, GROUND)[0].y;
    s = directorStep(s, 0.5, WIDTH, GROUND);
    const airborne = actorsOf(s, WIDTH, GROUND)[0];
    expect(airborne.y).toBeLessThan(grounded - 50);
    expect(airborne.layer).toBe('air');
    s = directorStep(s, 2.5, WIDTH, GROUND);
    expect(actorsOf(s, WIDTH, GROUND)[0]?.y ?? grounded).toBeCloseTo(grounded, 0);
  });

  it('places and removes props on cue', () => {
    const withProp: Scene = {
      ...TINY, duration: 3,
      beats: [
        { at: 0, role: 'newcomer', pose: 'standstill', moveTo: 0 },
        { at: 1, role: 'newcomer', prop: { kind: 'cannon', angle: -32 } },
        { at: 2, role: 'newcomer', prop: null },
      ],
    };
    let s = startScene(directorInit(), withProp, 'a', WIDTH, rand);
    s = directorStep(s, 0.5, WIDTH, GROUND);
    expect(s.props).toHaveLength(0);
    s = directorStep(s, 1.0, WIDTH, GROUND);
    expect(s.props).toHaveLength(1);
    s = directorStep(s, 1.0, WIDTH, GROUND);
    expect(s.props).toHaveLength(0);
  });

  it('spawns an effect for a smoke beat and ages it out', () => {
    const smoky: Scene = {
      ...TINY, duration: 3,
      beats: [
        { at: 0, role: 'newcomer', pose: 'standstill', moveTo: 0 },
        { at: 0.5, role: 'newcomer', smoke: { spread: 40 } },
      ],
    };
    let s = startScene(directorInit(), smoky, 'a', WIDTH, rand);
    s = directorStep(s, 0.6, WIDTH, GROUND);
    expect(s.effects.length).toBeGreaterThan(0);
    s = directorStep(s, 3, WIDTH, GROUND);
    expect(s.effects).toHaveLength(0);
  });

  it('does not mutate the state it is given', () => {
    const s = startScene(directorInit(), TINY, 'a', WIDTH, rand);
    const before = JSON.stringify(s);
    directorStep(s, 0.5, WIDTH, GROUND);
    expect(JSON.stringify(s)).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/sceneDirector.test.ts`
Expected: FAIL — cannot find module `../sceneDirector`.

- [ ] **Step 3: Write the director**

Create `frontend/src/features/collection/sceneDirector.ts`:

```ts
/**
 * Runs scenes. Pure, seedable, and ignorant of canvases and React.
 *
 * Three jobs, and only three: cast agents into a scene's roles, interpolate between its beats,
 * and make sure two scenes never claim the same ground. Everything it produces is a plain
 * description of where somebody is and what they are doing; painting it is somebody else's
 * problem.
 */
import type { Beat, Scene, SceneLayer } from './scenes/types';
import type { Rand } from '../../components/bobbits/wanderReducer';

export interface Actor {
  role: string;
  /** The agent this role is played by, or null for a role with no agent (a prop's anchor). */
  agentId: string | null;
  x: number;
  /** px from the field top. Equal to the ground line unless the actor is in the air. */
  y: number;
  pose: string;
  hand?: 'R' | 'L';
  layer: SceneLayer;
  hidden: boolean;
}

export interface RunningScene {
  scene: Scene;
  t: number;
  /** Reserved floor, in px. */
  left: number;
  right: number;
  cast: Record<string, string>;
}

export interface DirectorEffect {
  id: string;
  kind: 'smoke' | 'flash';
  x: number;
  y: number;
  /** Seconds since it started. */
  t: number;
  spread: number;
  color?: string;
}

export interface DirectorProp {
  id: string;
  kind: 'cannon';
  x: number;
  angle: number;
  flip: boolean;
}

export interface DirectorState {
  running: RunningScene[];
  props: DirectorProp[];
  effects: DirectorEffect[];
}

/** Seconds a smoke puff or flash lives. */
export const SMOKE_DUR = 1.0;
export const FLASH_DUR = 0.22;

export function directorInit(): DirectorState {
  return { running: [], props: [], effects: [] };
}

/** Every agent the director currently owns. `crowdAgents` must not advance these. */
export function castIds(state: DirectorState): Set<string> {
  const out = new Set<string>();
  for (const r of state.running) for (const id of Object.values(r.cast)) out.add(id);
  return out;
}

/**
 * Find a disjoint stretch of floor for a scene of this span, or null.
 *
 * Scenes run concurrently (the design chose overlap over queueing), so the only thing stopping
 * two of them happening on top of each other is this.
 */
export function canStage(
  state: DirectorState, span: number, width: number,
): { left: number; right: number } | null {
  const need = Math.min(width, Math.max(1, span * width));
  const taken = [...state.running]
    .map(r => ({ left: r.left, right: r.right }))
    .sort((a, b) => a.left - b.left);

  let cursor = 0;
  for (const t of taken) {
    if (t.left - cursor >= need) return { left: cursor, right: cursor + need };
    cursor = Math.max(cursor, t.right);
  }
  if (width - cursor >= need) return { left: cursor, right: cursor + need };
  return null;
}

/**
 * Begin a scene. The caller has already checked `canStage`; if it cannot fit now it is placed
 * at 0 anyway rather than dropped, because a caller that ignores the check should get a visible
 * bug rather than silence.
 */
export function startScene(
  state: DirectorState, scene: Scene, newcomerId: string, width: number, rand: Rand,
): DirectorState {
  const slot = canStage(state, scene.span, width) ?? { left: 0, right: scene.span * width };
  const cast: Record<string, string> = { newcomer: newcomerId };
  for (const role of scene.roles) {
    if (role === 'newcomer') continue;
    // Roles other than the newcomer are filled by the caller through `cast` overrides; an
    // uncast role simply has no agent and is positioned by its beats alone.
    cast[role] = `${scene.id}:${role}:${Math.floor(rand() * 1e6)}`;
  }
  return {
    ...state,
    running: [...state.running, { scene, t: 0, left: slot.left, right: slot.right, cast }],
  };
}

/** The beat in force for a role at time t, and the one before it, for interpolation. */
function framing(beats: Beat[], role: string, t: number) {
  const mine = beats.filter(b => b.role === role).sort((a, b) => a.at - b.at);
  let prev: Beat | null = null;
  let next: Beat | null = null;
  for (const b of mine) {
    if (b.at <= t) prev = b;
    else { next = b; break; }
  }
  return { prev, next, mine };
}

/** Accumulated pose/layer/hidden for a role at time t: later beats override earlier ones. */
function settledAt(beats: Beat[], role: string, t: number) {
  let pose = 'standstill';
  let hand: 'R' | 'L' | undefined;
  let layer: SceneLayer = 'ground';
  let hidden = false;
  for (const b of beats.filter(x => x.role === role && x.at <= t).sort((a, b) => a.at - b.at)) {
    if (b.pose) pose = b.pose;
    if (b.hand) hand = b.hand;
    if (b.layer) layer = b.layer;
    if (b.hidden !== undefined) hidden = b.hidden;
  }
  return { pose, hand, layer, hidden };
}

/** Where a role's last committed destination was, as a 0-1 fraction of the scene's span. */
function fracAt(beats: Beat[], role: string, t: number): number {
  const { prev, next } = framing(beats, role, t);
  const from = prev?.moveTo ?? 0;
  if (!next || next.moveTo === undefined) return from;
  if (next.path === 'snap' || next.path === undefined) return from;
  const span = next.at - (prev?.at ?? 0);
  if (span <= 0) return next.moveTo;
  const k = Math.min(1, Math.max(0, (t - (prev?.at ?? 0)) / span));
  return from + (next.moveTo - from) * k;
}

/** Height above the ground line at time t, for a role whose current leg is an arc. */
function liftAt(beats: Beat[], role: string, t: number): number {
  const { prev, next } = framing(beats, role, t);
  if (!next || next.path !== 'arc') return 0;
  const span = next.at - (prev?.at ?? 0);
  if (span <= 0) return 0;
  const k = Math.min(1, Math.max(0, (t - (prev?.at ?? 0)) / span));
  return Math.sin(Math.PI * k) * (next.arcPeak ?? 0);
}

export function directorStep(
  state: DirectorState, dt: number, width: number, groundY: number,
): DirectorState {
  const running: RunningScene[] = [];
  let props = [...state.props];
  let effects = state.effects.map(e => ({ ...e, t: e.t + dt }));

  for (const r of state.running) {
    const t0 = r.t;
    const t1 = r.t + dt;

    // Beats that fall inside this frame fire their one-shot side effects exactly once.
    for (const b of r.scene.beats) {
      if (!(b.at > t0 && b.at <= t1)) continue;
      const x = r.left + fracAt(r.scene.beats, b.role, b.at) * (r.right - r.left);
      const y = groundY - liftAt(r.scene.beats, b.role, b.at);

      if (b.smoke) {
        effects.push({
          id: `${r.scene.id}:${b.role}:${b.at}:smoke`,
          kind: 'smoke', x, y, t: 0, spread: b.smoke.spread, color: b.smoke.color,
        });
      }
      if (b.flash) {
        effects.push({
          id: `${r.scene.id}:${b.role}:${b.at}:flash`,
          kind: 'flash', x, y, t: 0, spread: b.smoke?.spread ?? 40,
        });
      }
      if (b.prop === null) {
        props = props.filter(p => !p.id.startsWith(`${r.scene.id}:`));
      } else if (b.prop) {
        props = [...props, {
          id: `${r.scene.id}:${b.role}:prop`, kind: b.prop.kind, x, angle: b.prop.angle,
          flip: false,
        }];
      }
    }

    if (t1 >= r.scene.duration) {
      // Scene over: release the cast and take its props with it, so a cannon cannot outlive
      // the scene that placed it.
      props = props.filter(p => !p.id.startsWith(`${r.scene.id}:`));
      continue;
    }
    running.push({ ...r, t: t1 });
  }

  effects = effects.filter(e => e.t < (e.kind === 'flash' ? FLASH_DUR : SMOKE_DUR));

  return { running, props, effects };
}

/** Everything the director currently wants drawn, as positions and poses. */
export function actorsOf(
  state: DirectorState, width: number, groundY: number,
): Actor[] {
  const out: Actor[] = [];
  for (const r of state.running) {
    for (const role of r.scene.roles) {
      const { pose, hand, layer, hidden } = settledAt(r.scene.beats, role, r.t);
      const frac = fracAt(r.scene.beats, role, r.t);
      out.push({
        role,
        agentId: r.cast[role] ?? null,
        x: r.left + frac * (r.right - r.left),
        y: groundY - liftAt(r.scene.beats, role, r.t),
        pose, hand, layer, hidden,
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/sceneDirector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/sceneDirector.ts frontend/src/features/collection/__tests__/sceneDirector.test.ts
git commit -m "feat(bobits): a pure scene director"
```

---

### Task 6: The swirl, the cannon, and the pool

**Files:**
- Create: `frontend/src/features/collection/scenes/arrival01Swirl.ts`
- Create: `frontend/src/features/collection/scenes/arrival02Cannon.ts`
- Create: `frontend/src/features/collection/scenes/poolEntrances.ts`
- Create: `frontend/src/features/collection/scenes/index.ts`
- Create: `frontend/src/features/collection/__tests__/scenes.test.ts`

**Interfaces:**
- Consumes: `Beat`, `Scene`, `SMOKE_PURPLE`.
- Produces: `SWIRL`, `CANNON`, `POOL: Scene[]`, `sceneForArrival(ordinal: number, rand: Rand): Scene`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/collection/__tests__/scenes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SWIRL } from '../scenes/arrival01Swirl';
import { CANNON } from '../scenes/arrival02Cannon';
import { POOL } from '../scenes/poolEntrances';
import { sceneForArrival } from '../scenes/index';
import type { Scene } from '../scenes/types';
import { ALL_ANIMATIONS } from '../../../components/bobbits/rigExtras';

const ALL: Scene[] = [SWIRL, CANNON, ...POOL];

describe('every scene', () => {
  it('names only poses the rig actually has', () => {
    for (const s of ALL) {
      for (const b of s.beats) {
        if (b.pose) expect(ALL_ANIMATIONS[b.pose], `${s.id}: ${b.pose}`).toBeDefined();
      }
    }
  });

  it('keeps every beat inside its own duration', () => {
    for (const s of ALL) for (const b of s.beats) {
      expect(b.at, s.id).toBeGreaterThanOrEqual(0);
      expect(b.at, s.id).toBeLessThanOrEqual(s.duration);
    }
  });

  it('only moves roles it has cast', () => {
    for (const s of ALL) for (const b of s.beats) {
      expect(s.roles, `${s.id}: ${b.role}`).toContain(b.role);
    }
  });

  it('asks for a span it can actually be given', () => {
    for (const s of ALL) {
      expect(s.span, s.id).toBeGreaterThan(0);
      expect(s.span, s.id).toBeLessThanOrEqual(1);
    }
  });

  it('never leaves anybody in the air when it ends', () => {
    // A scene that finishes mid-flight would hand back an agent hovering over the card.
    for (const s of ALL) {
      const last: Record<string, string> = {};
      for (const b of [...s.beats].sort((a, b) => a.at - b.at)) {
        if (b.layer) last[b.role] = b.layer;
      }
      for (const [role, layer] of Object.entries(last)) {
        expect(layer, `${s.id}: ${role} ends in the air`).toBe('ground');
      }
    }
  });

  it('never leaves a prop behind', () => {
    for (const s of ALL) {
      const placed = s.beats.filter(b => b.prop).length;
      const removed = s.beats.filter(b => b.prop === null).length;
      expect(removed, `${s.id} places ${placed} props`).toBeGreaterThanOrEqual(placed ? 1 : 0);
    }
  });
});

describe('the pool', () => {
  it('has four entrances, all short', () => {
    expect(POOL).toHaveLength(4);
    for (const s of POOL) expect(s.duration).toBeLessThanOrEqual(3.2);
  });

  it('keeps every pool entrance narrow enough to never wait for floor', () => {
    for (const s of POOL) expect(s.span).toBeLessThanOrEqual(0.2);
  });

  it('stays on the ground -- the overlay is for set pieces only', () => {
    for (const s of POOL) for (const b of s.beats) {
      expect(b.layer ?? 'ground', s.id).toBe('ground');
    }
  });
});

describe('sceneForArrival', () => {
  it('gives the very first bobit of a collection the swirl', () => {
    expect(sceneForArrival(0, () => 0).id).toBe(SWIRL.id);
  });

  it('gives the second the cannon', () => {
    expect(sceneForArrival(1, () => 0).id).toBe(CANNON.id);
  });

  it('draws from the pool after that', () => {
    for (const ordinal of [2, 3, 9, 40]) {
      expect(POOL.map(s => s.id)).toContain(sceneForArrival(ordinal, () => 0.5).id);
    }
  });

  it('varies which pool entrance it picks', () => {
    const picked = new Set([0, 0.3, 0.6, 0.9].map(r => sceneForArrival(5, () => r).id));
    expect(picked.size).toBeGreaterThan(1);
  });
});

describe('the cannon', () => {
  it('sends the newcomer over the card and lands him back on the floor', () => {
    const air = CANNON.beats.filter(b => b.layer === 'air');
    expect(air.length).toBeGreaterThan(0);
    const arc = CANNON.beats.find(b => b.path === 'arc');
    expect(arc?.arcPeak ?? 0).toBeGreaterThan(120);
  });

  it('takes the cannon away again after firing', () => {
    const place = CANNON.beats.findIndex(b => b.prop && b.prop.kind === 'cannon');
    const clear = CANNON.beats.findIndex(b => b.prop === null);
    expect(place).toBeGreaterThanOrEqual(0);
    expect(clear).toBeGreaterThan(place);
  });

  it('ends with both of them celebrating together', () => {
    const late = CANNON.beats.filter(b => b.at > CANNON.duration - 2.5 && b.pose);
    const poses = late.map(b => b.pose);
    expect(poses).toContain('highfive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/scenes.test.ts`
Expected: FAIL — cannot find module `../scenes/arrival01Swirl`.

- [ ] **Step 3: Write the swirl**

Create `frontend/src/features/collection/scenes/arrival01Swirl.ts`:

```ts
import { SMOKE_PURPLE } from '../../../components/bobbits/rigExtras';
import type { Scene } from './types';

/**
 * Arrival #1: the first bobit a collection ever gives you.
 *
 * Purple smoke gathers, a flash, and he is THERE -- splayed as if held out by both arms and
 * both legs. He drops, lands, looks around to get his bearings, spots you through the monitor
 * and waves, then wanders off scratching his head.
 *
 * Fires once per collection for the lifetime of a player's progress. There is no way to see it
 * twice without the dev replay route.
 */
export const SWIRL: Scene = {
  id: 'swirl',
  duration: 4.2,
  span: 0.22,
  roles: ['newcomer'],
  beats: [
    // Smoke gathers around nothing at all.
    { at: 0.0, role: 'newcomer', moveTo: 0.5, hidden: true,
      smoke: { spread: 26, color: SMOKE_PURPLE } },
    { at: 0.35, role: 'newcomer', smoke: { spread: 40, color: SMOKE_PURPLE } },
    { at: 0.7, role: 'newcomer', smoke: { spread: 52, color: SMOKE_PURPLE } },
    // Flash, and he is hanging there, stretched by all four limbs.
    { at: 1.0, role: 'newcomer', flash: true, hidden: false, pose: 'splayed' },
    // Dropped. Lands in a heap.
    { at: 1.6, role: 'newcomer', pose: 'spent' },
    // Picks himself up and works out where he is.
    { at: 2.2, role: 'newcomer', pose: 'confused' },
    // Sees you.
    { at: 3.0, role: 'newcomer', pose: 'greet' },
    // Wanders off, still none the wiser.
    { at: 3.9, role: 'newcomer', pose: 'ponder', moveTo: 0.75, path: 'walk', layer: 'ground' },
  ],
};
```

- [ ] **Step 4: Write the cannon**

Create `frontend/src/features/collection/scenes/arrival02Cannon.ts`:

```ts
import { SMOKE_PURPLE } from '../../../components/bobbits/rigExtras';
import type { Scene } from './types';

/**
 * Arrival #2: the cannon.
 *
 * The host sees smoke gathering and gets excited -- a friend is coming. It is not a friend, it
 * is a cannon, pointed at the far wall. He scratches his head at it, walks round the back,
 * finds the string, and pulls. The newcomer erupts from the muzzle flailing, arcs the length of
 * the room OVER THE QUESTION CARD, and lands in a heap. The cannon poofs away. The host works
 * out what he has just done, runs the length of the room, and they high-five.
 *
 * The flight is the one thing in this app allowed to pass in front of the question card, under
 * the four bounds in the spec's 2026-09-14 addendum: transient, reveal phase only, pointer
 * events off, set pieces only.
 */
export const CANNON: Scene = {
  id: 'cannon',
  duration: 10.6,
  span: 0.85,
  roles: ['host', 'newcomer'],
  beats: [
    { at: 0.0, role: 'host', pose: 'standstill', moveTo: 0.08 },
    { at: 0.0, role: 'newcomer', moveTo: 0.12, hidden: true },

    // Smoke gathers right beside the host.
    { at: 0.0, role: 'newcomer', smoke: { spread: 26, color: SMOKE_PURPLE } },
    { at: 0.4, role: 'newcomer', smoke: { spread: 42, color: SMOKE_PURPLE } },

    // He reads it as a friend arriving and paces about, delighted.
    { at: 0.8, role: 'host', pose: 'cheer' },
    { at: 1.2, role: 'host', pose: 'scurry', moveTo: 0.02, path: 'run' },

    // Flash. It is not a bobit.
    { at: 1.6, role: 'newcomer', flash: true,
      prop: { kind: 'cannon', angle: -34 } },

    // He stops. Considers the cannon.
    { at: 2.0, role: 'host', pose: 'ponder', moveTo: 0.06, path: 'walk' },

    // Walks round behind it and finds the string.
    { at: 3.2, role: 'host', pose: 'stroll', moveTo: 0.0, path: 'walk' },
    { at: 4.0, role: 'host', pose: 'heave' },

    // FIRE. Out of the muzzle, flailing, over the card, down the far end.
    { at: 4.3, role: 'newcomer', hidden: false, pose: 'flail', moveTo: 0.14,
      smoke: { spread: 58 } },
    { at: 5.9, role: 'newcomer', pose: 'flail', moveTo: 0.95, path: 'arc', arcPeak: 240,
      layer: 'air' },

    // Lands in a heap, back on the floor and back on the band's own canvas.
    { at: 5.95, role: 'newcomer', pose: 'spent', layer: 'ground' },

    // The cannon poofs away.
    { at: 6.1, role: 'host', prop: null, smoke: { spread: 44, color: SMOKE_PURPLE } },

    // The host realises what he just did.
    { at: 6.4, role: 'host', pose: 'presentup' },

    // And runs the length of the room.
    { at: 7.0, role: 'host', pose: 'scurry', moveTo: 0.86, path: 'run' },

    // The newcomer picks himself up, and they celebrate.
    { at: 8.6, role: 'newcomer', pose: 'cheer' },
    { at: 9.0, role: 'host', pose: 'cheer' },
    { at: 9.8, role: 'host', pose: 'highfive', hand: 'R' },
    { at: 9.8, role: 'newcomer', pose: 'highfive', hand: 'L' },

    // Released.
    { at: 10.5, role: 'host', pose: 'standstill', layer: 'ground' },
    { at: 10.5, role: 'newcomer', pose: 'standstill', layer: 'ground' },
  ],
};
```

- [ ] **Step 5: Write the pool**

Create `frontend/src/features/collection/scenes/poolEntrances.ts`:

```ts
import { SMOKE_PURPLE } from '../../../components/bobbits/rigExtras';
import type { Scene } from './types';

/**
 * The ordinary arrivals: every bobit after the first two.
 *
 * Short, funny, and entirely inside the band -- none of these use the overlay, because the
 * relaxation that lets a figure pass in front of the question card is for set pieces only.
 *
 * Deliberately additive: the "large library of random entrances" is more files like these, and
 * `sceneForArrival` picks from whatever is in the array.
 */

/** Poof in, land badly, dust yourself off. */
const STUMBLE: Scene = {
  id: 'pool-stumble', duration: 2.6, span: 0.12, roles: ['newcomer'],
  beats: [
    { at: 0.0, role: 'newcomer', moveTo: 0.5, hidden: true,
      smoke: { spread: 30, color: SMOKE_PURPLE } },
    { at: 0.35, role: 'newcomer', hidden: false, pose: 'spent', flash: true },
    { at: 1.1, role: 'newcomer', pose: 'shrug' },
    { at: 1.9, role: 'newcomer', pose: 'friendly' },
    { at: 2.5, role: 'newcomer', pose: 'standstill', layer: 'ground' },
  ],
};

/** Walk in, trip over nothing, check whether anyone saw. */
const TRIP: Scene = {
  id: 'pool-trip', duration: 3.0, span: 0.16, roles: ['newcomer'],
  beats: [
    { at: 0.0, role: 'newcomer', moveTo: 0, pose: 'stroll' },
    { at: 1.1, role: 'newcomer', pose: 'stroll', moveTo: 0.6, path: 'walk' },
    { at: 1.3, role: 'newcomer', pose: 'painhop' },
    { at: 2.0, role: 'newcomer', pose: 'confused' },
    { at: 2.9, role: 'newcomer', pose: 'standstill', layer: 'ground' },
  ],
};

/** Head appears from below the floor, looks both ways, climbs up. */
const PEEK: Scene = {
  id: 'pool-peek', duration: 2.8, span: 0.12, roles: ['newcomer'],
  beats: [
    { at: 0.0, role: 'newcomer', moveTo: 0.5, pose: 'peek' },
    { at: 1.6, role: 'newcomer', pose: 'climb' },
    { at: 2.2, role: 'newcomer', pose: 'friendly' },
    { at: 2.7, role: 'newcomer', pose: 'standstill', layer: 'ground' },
  ],
};

/** Falls in from above, lands hard, gets up and waves. */
const DROP: Scene = {
  id: 'pool-drop', duration: 2.6, span: 0.12, roles: ['newcomer'],
  beats: [
    { at: 0.0, role: 'newcomer', moveTo: 0.5, pose: 'fall' },
    { at: 0.7, role: 'newcomer', pose: 'spent', smoke: { spread: 26 } },
    { at: 1.5, role: 'newcomer', pose: 'shrug' },
    { at: 2.1, role: 'newcomer', pose: 'friendly' },
    { at: 2.5, role: 'newcomer', pose: 'standstill', layer: 'ground' },
  ],
};

export const POOL: Scene[] = [STUMBLE, TRIP, PEEK, DROP];
```

- [ ] **Step 6: Write the picker**

Create `frontend/src/features/collection/scenes/index.ts`:

```ts
import { SWIRL } from './arrival01Swirl';
import { CANNON } from './arrival02Cannon';
import { POOL } from './poolEntrances';
import type { Scene } from './types';
import type { Rand } from '../../../components/bobbits/wanderReducer';

export { SWIRL, CANNON, POOL };
export type { Scene };

/**
 * Which entrance a given arrival gets.
 *
 * `ordinal` is how many bobits the player ALREADY had in this collection when this one was
 * granted, so 0 is the very first one the collection has ever given them. It is per collection
 * and for the lifetime of their progress, not per session: a returning player with forty
 * already owned is at ordinal 40, and must not be shown forty cannon shots on page load.
 */
export function sceneForArrival(ordinal: number, rand: Rand): Scene {
  if (ordinal <= 0) return SWIRL;
  if (ordinal === 1) return CANNON;
  return POOL[Math.floor(rand() * POOL.length) % POOL.length];
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/scenes.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/collection/scenes frontend/src/features/collection/__tests__/scenes.test.ts
git commit -m "feat(bobits): the swirl, the cannon, and four pool entrances"
```

---

### Task 7: The overlay layer

**Files:**
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`
- Test: manual + Task 11's screenshots.

**Interfaces:**
- Consumes: `Actor` (Task 5), `BobitField`.
- Produces: an overlay `BobitField` mounted above the game area, fed only with `air` actors.

**The four bounds are enforced HERE.** Everything else in this plan is choreography; this is the
task that must not be got wrong.

- [ ] **Step 1: Mount the overlay**

In `CollectionCrowd.tsx`, render an overlay sibling BEFORE the band's own container:

```tsx
      {/* The air.
          A second canvas spanning the game area, so a cannon shot can arc in front of the
          question card. Four bounds, all of them load-bearing (spec, 2026-09-14 addendum):
            1. Transient   -- only ever holds a figure mid-flight; empty otherwise.
            2. Reveal only -- `aerialAllowed` is false while the answer timer is running.
            3. Click-through -- pointerEvents none, and interactive={false}, so it installs no
               document listeners and can never intercept a click meant for an answer.
            4. Set pieces only -- pool entrances never set layer:'air'.
          It is UNMOUNTED entirely when nothing is airborne, so in the normal case there is no
          second canvas on the page at all. */}
      {aerial.length > 0 && (
        <div
          aria-hidden
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0,
            height: overlayHeight, pointerEvents: 'none', zIndex: 20,
          }}
        >
          <BobitField
            figures={aerial}
            height={overlayHeight}
            interactive={false}
          />
        </div>
      )}
```

- [ ] **Step 2: Compute the overlay's height and coordinate offset**

Add above the return:

```tsx
  // The overlay spans from the top of the game area down to the bottom of the band, so ONE
  // coordinate system covers both: a point at band-y `yb` is at overlay-y
  // `overlayHeight - height + yb`. Without that the arc would jump at the handoff.
  const overlayHeight = Math.max(height, Math.round(window.innerHeight * 0.62));
  const bandToOverlay = overlayHeight - height;
```

and translate airborne actors when building the overlay's figures:

```tsx
  const aerial: FieldFigure[] = airActors.map(a => ({
    ...a,
    groundY: a.groundY + bandToOverlay,
  }));
```

- [ ] **Step 3: Gate it on the reveal phase**

`CollectionCrowd` already receives `lastAnswer`, which changes identity only on a reveal. Add a
prop so the gate is explicit rather than inferred:

```tsx
  /**
   * True only while an answer is revealed. Gates the aerial overlay: nothing may pass in front
   * of the question card while the timer is running and the player is aiming at an answer.
   */
  aerialAllowed: boolean;
```

Pass `state.phase === 'revealing'` from `GameScreen.tsx`. When it is false, air actors are drawn
on the BAND instead, clamped to the band's own height — the scene still plays, it just cannot
use the sky.

- [ ] **Step 4: Verify the bounds by hand**

Run: `cd frontend && npm run dev`, open `?mock=1&scene=cannon`.

Confirm, and do not proceed until all four hold:
- The overlay canvas is absent from the DOM except during the flight.
- Clicking exactly where the flying bobit is, over an answer button, selects that answer.
- During the answering phase (timer running), nothing is ever drawn above the band.
- The bobit is never at rest over the card.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/collection/CollectionCrowd.tsx frontend/src/features/game/components/GameScreen.tsx
git commit -m "feat(bobits): an overlay the cannon shot can fly through"
```

---

### Task 8: Wire the director into the crowd

**Files:**
- Modify: `frontend/src/features/collection/crowdAgents.ts`
- Modify: `frontend/src/features/collection/crowdFigures.ts`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`
- Test: `frontend/src/features/collection/__tests__/crowdFigures.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-7.
- Produces: `crowdFigures(state, agents, band, darkMode, director?)` returning ground figures, and `aerialFigures(director, band)` returning air figures.

- [ ] **Step 1: Write the failing test**

Append to `crowdFigures.test.ts`:

```ts
import { directorInit, startScene } from '../sceneDirector';
import { SWIRL } from '../scenes/arrival01Swirl';

describe('director figures', () => {
  it('draws a scene actor even though it has no agent', () => {
    const state = crowdApply(crowdInit(), { type: 'seed', ids: [] });
    const dir = startScene(directorInit(), SWIRL, 'newbie', 1000, () => 0.5);
    const figs = crowdFigures(state, {}, BAND, false, dir);
    expect(figs.length).toBeGreaterThan(0);
  });

  it('lets the director override the pose of an agent it has cast', () => {
    const ids = ['a'];
    const agents = initAgents(ids, OPTS);
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    const dir = startScene(directorInit(), SWIRL, 'a', 1000, () => 0.5);
    const fig = crowdFigures(state, agents, BAND, false, dir).find(f => f.id === 'a');
    expect(fig!.anim).toBe(SWIRL.beats[0].pose ?? 'standstill');
  });

  it('draws a cast agent exactly once', () => {
    const ids = ['a'];
    const agents = initAgents(ids, OPTS);
    const state = crowdApply(crowdInit(), { type: 'seed', ids });
    const dir = startScene(directorInit(), SWIRL, 'a', 1000, () => 0.5);
    const figs = crowdFigures(state, agents, BAND, false, dir);
    expect(figs.filter(f => f.id === 'a')).toHaveLength(1);
  });

  it('hides a role that is mid-materialisation', () => {
    // The swirl's first beat is hidden:true -- smoke gathering around nobody.
    const dir = startScene(directorInit(), SWIRL, 'newbie', 1000, () => 0.5);
    const state = crowdApply(crowdInit(), { type: 'seed', ids: [] });
    expect(crowdFigures(state, {}, BAND, false, dir).find(f => f.id.includes('newbie')))
      .toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/crowdFigures.test.ts`
Expected: FAIL — `crowdFigures` takes four arguments.

- [ ] **Step 3: Merge director output into the translator**

In `crowdFigures.ts`, add a fifth parameter and, before the agent loop, build a map of actors
by agent id. For each agent the director has cast, use the actor's x/y/pose instead of the
agent's, and skip it if the actor is `hidden`. For actors with no matching agent, push a figure
of their own. Air-layer actors are skipped entirely here — `aerialFigures` returns those:

```ts
/** Figures the director wants drawn on the OVERLAY, in band coordinates. */
export function aerialFigures(
  director: DirectorState, band: CrowdBand, darkMode: boolean,
): FieldFigure[] {
  return actorsOf(director, band.width, band.height)
    .filter(a => a.layer === 'air' && !a.hidden)
    .map(a => ({
      id: `air:${a.agentId ?? a.role}`,
      anim: a.pose,
      color: figColor(toneOf(a.agentId ?? a.role), darkMode),
      x: a.x,
      groundY: a.y,
      scale: band.scale,
      poofable: false,
      greetable: false,
      vars: a.hand ? { hand: a.hand } : undefined,
    }));
}
```

- [ ] **Step 4: Keep the director's cast off autopilot**

In `CollectionCrowd`'s `figuresFor`, pass `castIds(directorRef.current)` into `agentsAdvance`'s
`greeting` set — an agent the director owns must not also be walked by `wanderAdvance`, or the
two will fight over its position:

```tsx
      const owned = castIds(directorRef.current);
      const held = owned.size ? new Set([...greeting, ...owned]) : greeting;
```

and use `held` as `opts.greeting`.

- [ ] **Step 5: Start a scene when a bobit is granted**

In the `lastAnswer` effect, before `crowdApply`, capture the ordinal and start the scene:

```tsx
    if (correct) {
      const ordinal = stateRef.current.residents.length;
      const known = stateRef.current.residents.includes(questionId);
      stateRef.current = crowdApply(stateRef.current, { type: 'correct', id: questionId, streak });
      store.grant(slug, questionId);
      // Only a NEW bobit gets an entrance. A question re-answered correctly spawns nobody.
      if (!known && !reducedMotion) {
        const scene = sceneForArrival(ordinal, randRef.current);
        const w = laidOutAtRef.current || band.width;
        if (canStage(directorRef.current, scene.span, w)) {
          directorRef.current = startScene(directorRef.current, scene, questionId, w, randRef.current);
        }
      }
    }
```

- [ ] **Step 6: Step the director each frame**

In `figuresFor`, after `crowdStep`:

```tsx
      directorRef.current = directorStep(
        directorRef.current, dt, measured, band.height - 6,
      );
```

- [ ] **Step 7: Verify**

Run: `cd frontend && npm run typecheck && npm test`
Expected: clean, all pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/collection
git commit -m "feat(bobits): entrances fire when a bobit is earned"
```

---

### Task 9: Effects on the canvas

**Files:**
- Modify: `frontend/src/components/bobbits/BobitField.tsx`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

**Interfaces:**
- Consumes: `drawSmokePuff` (Task 1), `DirectorEffect` (Task 5).
- Produces: `BobitField` accepts `effectsFor?: (t, dt) => FieldEffect[]`, with
  `interface FieldEffect { id: string; kind: 'smoke' | 'flash'; x: number; y: number; t: number; spread: number; color?: string }` in `fieldGeometry.ts`.

- [ ] **Step 1: Add the type and the draw**

In `fieldGeometry.ts`:

```ts
/** A transient visual effect: a puff of smoke or a flash. Not a figure and not a prop. */
export interface FieldEffect {
  id: string;
  kind: 'smoke' | 'flash';
  x: number;
  y: number;
  /** Seconds since it began. */
  t: number;
  spread: number;
  color?: string;
}
```

In `BobitField.tsx`, after figures are painted (effects sit in front of the crowd):

```tsx
      for (const e of effectList) {
        if (e.kind === 'smoke') {
          const alpha = 1 - e.t / SMOKE_DUR;
          drawSmokePuff(c, e.x, e.y, e.spread * (0.6 + e.t), alpha, e.id.length, t,
            e.color || '#8A8F98');
        } else {
          // A flash is a hard white disc that dies fast -- the moment of arrival, not a glow.
          const k = 1 - e.t / FLASH_DUR;
          c.save();
          c.globalAlpha = Math.max(0, k);
          c.fillStyle = '#FFFFFF';
          c.beginPath();
          c.arc(e.x, e.y - e.spread * 0.4, e.spread * (1.6 - k), 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      }
```

- [ ] **Step 2: Feed it from the director**

In `CollectionCrowd`, pass `effectsFor={() => directorRef.current.effects}`.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run typecheck && npm test`
Expected: clean, all pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/bobbits frontend/src/features/collection
git commit -m "feat(bobits): smoke and flash on the canvas"
```

---

### Task 10: The dev replay route

**Files:**
- Modify: `frontend/src/dev/mockGameApi.ts`
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

**This is a requirement, not a convenience.** The swirl and the cannon fire once per collection
for the lifetime of a player's progress; without this neither can be built or reviewed.

- [ ] **Step 1: Expose a replay hook**

In `CollectionCrowd`, behind `import.meta.env.DEV` only:

```tsx
  // Dev replay. The set pieces fire once per collection EVER, so there is otherwise no way to
  // see one twice -- not for building them, and not for reviewing them.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __bobitScene?: (id: string) => void };
    w.__bobitScene = (id: string) => {
      const scene = [SWIRL, CANNON, ...POOL].find(s => s.id === id);
      if (!scene) { console.warn('[bobits] no scene', id); return; }
      const width = laidOutAtRef.current || band.width;
      directorRef.current = startScene(
        directorRef.current, scene, `replay-${Date.now()}`, width, randRef.current,
      );
    };
    return () => { delete w.__bobitScene; };
  }, [band]);
```

- [ ] **Step 2: Fire it from the URL**

In `mockGameApi.ts`, at the end of `installMockGameApi`:

```ts
  // ?scene=cannon replays a set piece as soon as the crowd is mounted, and every 14s after,
  // so it can be watched more than once without reloading.
  const scene = params.get('scene');
  if (scene) {
    const fire = () => {
      const w = window as unknown as { __bobitScene?: (id: string) => void };
      if (w.__bobitScene) w.__bobitScene(scene);
    };
    setTimeout(fire, 2500);
    setInterval(fire, 14000);
  }
```

- [ ] **Step 3: Verify each scene replays**

Run `npm run dev`, then for each of `swirl`, `cannon`, `pool-stumble`, `pool-trip`,
`pool-peek`, `pool-drop`:

```
http://localhost:5173/?mock=1&collection=milwaukee-wi&scene=<id>
```

Press Play, and confirm the scene runs on a loop.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/dev/mockGameApi.ts frontend/src/features/collection/CollectionCrowd.tsx
git commit -m "dev(bobits): replay any entrance from the URL"
```

---

### Task 11: Rendered verification

**Files:**
- Modify: `frontend/scripts/bobit-shots.mjs`

**The deliverable is screenshots somebody has looked at.** Two poses in this rig have now
shipped a T-pose past a green joint test — `carryGrip` and `clap`. `splayed` deliberately IS a
T-pose, which makes looking at it more important, not less: nothing in the tests can tell the
intentional one from a mistake.

- [ ] **Step 1: Add the new poses to the pose sheet**

Extend `poseSheet` in `bobit-shots.mjs` with a third row: `splayed` at one instant, and `flail`
at six instants across half a second, so the windmill is visible as a sequence.

- [ ] **Step 2: Add a scene sweep**

Add a `sceneSweep(browser)` that, for each of the six scenes, loads
`?mock=1&scene=<id>&bobitSeed=shots`, presses Play, and screenshots the whole page at five
evenly spaced instants across the scene's duration.

- [ ] **Step 3: Run it**

```bash
cd frontend && node scripts/bobit-shots.mjs
```

- [ ] **Step 4: Look at every shot**

Specifically:
- `splayed` reads as being HELD, not as a mistake — limbs out, body slack.
- `flail` reads as panic, not as a jumping jack: the arms are out of phase at every instant.
- The cannon is recognisably a cannon, and the muzzle is where the bobit comes from.
- The flight passes over the question card and the card is still readable through/around it.
- Nothing is left behind when a scene ends: no cannon, no figure in the sky, no smoke.
- The pool entrances stay wholly inside the band.

- [ ] **Step 5: Fix what the screenshots show and re-shoot**

Pose corrections go in `rigExtras.ts` with a tuning-log comment in the style of `carryGrip` and
`clap`.

- [ ] **Step 6: Commit**

```bash
git add frontend/scripts/bobit-shots.mjs frontend/src/components/bobbits/rigExtras.ts
git commit -m "test(bobits): screenshot the entrances"
```

---

## Self-Review

**Spec coverage.** Plan-2 requirements from the spec: scene director → Task 5; scenes as data →
Tasks 4 and 6; the swirl → Task 6; the cannon → Task 6; four pool entrances → Task 6;
`splayed`/`flail` → Task 2; `drawSmokePuff` → Task 1; props on the field → Task 3; floor
arbitration → Task 5 (`canStage`); the overlay and the four bounds → Task 7; firing on a grant
with the per-collection ordinal → Task 8; effects → Task 9; dev replay → Task 10; rendered
verification → Task 11.

Deferred to plan 3, as the spec states: the tree, `Surface` consumption, perching,
`hoverAnim: 'greetseat'`, `questionCount` plumbing and the 25% milestone.

**One deliberate deviation from the spec.** The spec has set pieces **wait up to ~4s** for floor
before playing a compact variant. This plan drops the wait: `canStage` is checked once and the
scene is skipped if the floor is busy. The reason is that plan 1 made the band full-bleed, so
the floor is now ~1900px where the spec assumed ~790px — two scenes fit side by side far more
often, and a bounded wait adds a queue's worth of state for a case that is now rare. If it turns
out set pieces are being skipped in practice, the wait goes back in as a scheduled scene.

**Type consistency.** `Scene`/`Beat` are defined once in `scenes/types.ts` and imported
everywhere. `startScene(state, scene, newcomerId, width, rand)` and `directorStep(state, dt,
width, groundY)` keep those argument orders at every call site. `crowdFigures` takes an optional
fifth `director` argument; `aerialFigures(director, band, darkMode)` is separate. `SMOKE_DUR`
and `FLASH_DUR` are defined in `sceneDirector.ts` and imported by `BobitField`.

**Known risks, stated rather than hidden.**
1. **`arcPeak: 240` is a guess.** It is the first number in this feature not derived from a
   measurement, and the overlay's height is itself a fraction of the viewport. Task 11's
   screenshots are what settle it.
2. **The cannon's 10.6s duration versus a fast player.** Answers can be ~6s apart, so arrival #3
   can be granted while the cannon is still running. That is by design (concurrent scenes), but
   it is the first time two scenes will genuinely overlap, and the floor arbitration is what
   stops them colliding. Worth watching in Task 11.
3. **`window.innerHeight` in the overlay height** is read at render, not on resize. If the
   overlay is ever mounted across a resize it will be stale until the next arrival. Acceptable
   because it is unmounted whenever nothing is airborne.

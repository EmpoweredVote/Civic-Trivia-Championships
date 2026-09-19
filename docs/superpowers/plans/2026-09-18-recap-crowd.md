# Recap Crowd Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every bobit unlocked for the played collection on the results screen, celebrating — the session's new arrivals bowing repeatedly, everyone else cheering, clapping, high-fiving and occasionally jumping — so a match that ends on a lost final question still ends on a high note.

**Architecture:** A new `RecapCrowd` component built on `BobitField` and the shared identity/layout modules, with static placement and a pure pose picker. `CollectionCrowd` is untouched apart from one optional callback that reports which bobits were earned this session, reusing the decision it already makes to choose an entrance. One new rig pose, `bow`, derived from the existing `spent`.

**Tech Stack:** React 18, TypeScript, canvas 2D, vitest 4.1.11 (node environment), Playwright for contact sheets.

**Spec:** `docs/superpowers/specs/2026-09-18-recap-crowd-design.md`

## Global Constraints

- **`environment: 'node'`.** `frontend/vitest.config.ts` runs no DOM and no canvas. Every test in this plan exercises a pure function. There is no component test and no `render()`. Do not add jsdom.
- **Test glob is `src/**/*.test.ts`.** A test outside `src/` or named `.spec.ts` will not run.
- **`armRU`/`armRF` are absolute from the body, 0° is straight DOWN, and `armRF` is NOT an elbow bend.** Misreading it as an elbow bend has produced a T-pose three times. Arm angles hang from the already-curled torso (`ub = lean + hunch` in `computePose`).
- **Negative `hunch` is FORWARD.** `leremyRig.ts:836` — "lateral walks, pitched FORWARD (negative hunch = toward travel)". `read` uses `+22` for "reclined back into the chair". The wrong sign bends the figure backwards and will survive a code read.
- **`bow` is a STANDING pose.** Never give it to a seated figure, never use it as a `hoverAnim` on a seated base, never play it on a beat that leaves the ground. Standing and seated pelvis offsets are 104 units apart and `figureBounds` measures from the BASE anim.
- **Do not revive `slotPosition` / `rowsFor`.** They are dead code from the removed depth era and do the multi-row layout that would relieve crowding. Density is accepted; climbable structures are the intended fix (spec, "A consequence of decision 4").
- **`CROWD_CAP` is 100 and `overflowCount` produces the `+N more` count.** One cap, shared with the play screen. Do not introduce a second.
- **Nothing reads the match result.** The room celebrates whether the player won or lost — that is the entire point of the feature.
- **The play screen gains exactly one optional callback and nothing else.** It is live in production.
- **Commands:** `npm test`, `npx vitest run <path>`, `npm run typecheck`, `npm run build`, `npm run smoke`. All from `frontend/`.
- **CI job names must not be renamed.** The `master` ruleset matches them by name.

## A divergence from the spec, recorded up front

Spec §6 says `onBobitEarned` will be asserted to "fire once per genuinely new bobit and never for a repeat correct answer, driven through `CollectionCrowd`'s existing reducer path". **That test is not possible here.** `CollectionCrowd` is a React component and vitest runs node-only with no DOM, so there is no way to mount it and observe the callback. Task 3 therefore ships without a unit test, and the property is verified in Task 6 by driving a real match and checking the number of bowers against the number of genuinely new bobits. Do not add jsdom to make the spec's sentence true.

---

### Task 1: The `bow` pose

**Files:**
- Modify: `frontend/src/components/bobbits/rigExtras.ts`
- Test: `frontend/src/components/bobbits/__tests__/bow.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ALL_ANIMATIONS.bow` — an `Animation` with `label`, `mood`, `frame(t)`
  - `BOW_CYCLE: number` — seconds for one fold-hold-rise-stand cycle, exported from `rigExtras`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/bobbits/__tests__/bow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ALL_ANIMATIONS, BOW_CYCLE } from '../rigExtras';
import { computePose, REST } from '../leremyRig';
import { pelvisOffset } from '../fieldGeometry';

/**
 * Sample a whole cycle and report the extremes of a joint, so every assertion below is about
 * what the bow DOES rather than about the numbers it was written with. Three of this feature's
 * tests asserted the implementation's own arithmetic back at it and each sat on a real defect.
 */
function sweep(pick: (j: ReturnType<typeof computePose>) => number) {
  let min = Infinity;
  let max = -Infinity;
  for (let t = 0; t < BOW_CYCLE * 2; t += 0.02) {
    const v = pick(computePose(ALL_ANIMATIONS.bow.frame(t)));
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return { min, max };
}

const rest = computePose(REST);

describe('the bow', () => {
  it('is registered, so a figure can actually be given it', () => {
    expect(ALL_ANIMATIONS.bow).toBeDefined();
    expect(typeof ALL_ANIMATIONS.bow.frame).toBe('function');
  });

  it('is a STANDING pose', () => {
    // 112 is the standing pelvis offset, 8 the seated one. A seated `bow` would be drawn 104
    // units from its own hit box, which is the trap this feature has recorded four times.
    expect(pelvisOffset('bow')).toBe(112);
  });

  /**
   * THE sign test. `vec(a) = { sin a, cos a }`, so -y is up and +x is the direction the figure
   * faces. A forward fold carries the head forward; the wrong hunch sign carries it BACKWARDS,
   * over an invisible chair, and looks deliberate enough to survive a code read.
   */
  it('folds FORWARD, not backwards', () => {
    const head = sweep(j => j.H.x);
    expect(head.max).toBeGreaterThan(rest.H.x + 20);   // really folds forward
    expect(head.min).toBeGreaterThan(rest.H.x - 6);    // and never leans back
  });

  it('comes back up again, so it reads as repeated bowing', () => {
    const head = sweep(j => j.H.x);
    expect(head.min).toBeLessThan(rest.H.x + 6);       // returns to standing between bows
  });

  it('holds still at the bottom rather than bobbing continuously', () => {
    // At least a few consecutive samples within a hair of the deepest point.
    const depths: number[] = [];
    for (let t = 0; t < BOW_CYCLE; t += 0.02) {
      depths.push(computePose(ALL_ANIMATIONS.bow.frame(t)).H.x);
    }
    const deepest = Math.max(...depths);
    const held = depths.filter(d => d > deepest - 1).length;
    expect(held).toBeGreaterThan(10);                  // ~0.2s or more at full depth
  });

  /**
   * THE T-pose test. A T-pose is armRU near +/-90, which puts the hand level with the shoulder.
   * Reading `armRF` as an elbow bend has produced one three times, most recently in `clap`.
   * Asserted on the HAND, not on the angle: the consequence, not the value.
   */
  it('never lets a hand rise to shoulder height', () => {
    for (let t = 0; t < BOW_CYCLE * 2; t += 0.02) {
      const j = computePose(ALL_ANIMATIONS.bow.frame(t));
      // +y is DOWN, so a hanging hand is strictly below its shoulder.
      expect(j.hR.y, `right hand at t=${t.toFixed(2)}`).toBeGreaterThan(j.sR.y);
      expect(j.hL.y, `left hand at t=${t.toFixed(2)}`).toBeGreaterThan(j.sL.y);
    }
  });

  it('keeps the knees straight, unlike `spent` which buckles them', () => {
    const p = ALL_ANIMATIONS.bow.frame(BOW_CYCLE * 0.25);
    const s = ALL_ANIMATIONS.spent.frame(0);
    expect(Math.abs(p.legRF)).toBeLessThan(Math.abs(s.legRF));
  });

  it('cycles on a period long enough to read as separate bows', () => {
    expect(BOW_CYCLE).toBeGreaterThan(2);
    expect(BOW_CYCLE).toBeLessThan(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/bow.test.ts`
Expected: FAIL — `BOW_CYCLE` is not exported from `../rigExtras`.

- [ ] **Step 3: Write the implementation**

In `frontend/src/components/bobbits/rigExtras.ts`, add these constants above `EXTRA_ANIMATIONS`:

```ts
/**
 * The bow's cycle: fold down, hold, rise, then stand before the next one.
 *
 * The STAND is what makes it read as repeated bowing rather than as a bobbing idle -- without
 * a real pause the figure just oscillates. Chris asked for "bow, repeatedly".
 */
const BOW_FOLD = 0.5;
const BOW_HOLD = 0.4;
const BOW_RISE = 0.5;
const BOW_STAND = 1.2;
export const BOW_CYCLE = BOW_FOLD + BOW_HOLD + BOW_RISE + BOW_STAND;

/** Ease in and out, so he leans into the bow and settles out of it rather than snapping. */
function bowEase(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/** How deep into the bow he is, 0 standing to 1 fully folded, across one cycle. */
function bowDepth(c: number): number {
  if (c < BOW_FOLD) return bowEase(c / BOW_FOLD);
  if (c < BOW_FOLD + BOW_HOLD) return 1;
  if (c < BOW_FOLD + BOW_HOLD + BOW_RISE) {
    return bowEase(1 - (c - BOW_FOLD - BOW_HOLD) / BOW_RISE);
  }
  return 0;
}
```

And add this entry to `EXTRA_ANIMATIONS`, beside `clap`:

```ts
  /**
   * A theatrical bow, for a bobit earned in the match the player has just finished.
   *
   * DERIVED FROM `spent`, not invented. `spent` is the rig's proven deep forward fold
   * ("doubled over, hands braced on the thighs") and it already answers the two things that
   * would otherwise be guesswork here:
   *
   *   1. NEGATIVE hunch is forward. See leremyRig's gait comment: "pitched FORWARD (negative
   *      hunch = toward travel)". `read` uses +22 for "reclined back into the chair".
   *   2. At a -44 fold, "arms straight down" is armRU 58 / armRF 26, because arm angles hang
   *      from the ALREADY-CURLED torso (`ub = lean + hunch`). Do not re-derive this; spent
   *      measured it.
   *
   * What differs from `spent`: the knees stay STRAIGHT (spent buckles them -- he is winded,
   * not bowing), and the fold is animated on a cycle rather than held.
   */
  bow: {
    label: "Bow", mood: "thank you, thank you",
    frame(t: number) {
      const p = clonePose(REST);
      const c = ((t % BOW_CYCLE) + BOW_CYCLE) % BOW_CYCLE;
      const k = bowDepth(c);
      // A little breathing at the bottom so a held bow is not perfectly frozen.
      const br = wave(t, 0.9) * k;

      p.lean = 5 * k;
      p.hunch -= 50 * k + br * 2;          // NEGATIVE is forward
      p.headTilt -= 10 * k;                 // head follows the fold down
      p.bob += 4 * k;
      // Arms sweep down and slightly back as he folds, from spent's measured "straight down".
      p.armRU += 58 * k; p.armRF += 26 * k;
      p.armLU += 46 * k; p.armLF += 18 * k;
      return p;
    },
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/bobbits/__tests__/bow.test.ts`
Expected: PASS. If "folds FORWARD" fails, the hunch sign is inverted — negate it, do not loosen the assertion.

- [ ] **Step 5: Look at it**

A pose that has never been screenshotted is a pose nobody has seen, and every defect that mattered in this feature was found by screenshot with the suite green.

```bash
cd frontend
npm run dev          # in another shell
node scripts/bobit-shots.mjs
```

Open the pose sheet in `.shots/` and check: he folds at the waist rather than tipping as a rigid plank; his hands hang rather than sticking out; his head is clearly the lowest part of him at the bottom of the bow; and at 48px it reads as a bow rather than as a stumble.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/components/bobbits/rigExtras.ts src/components/bobbits/__tests__/bow.test.ts
git commit -m "feat(bobits): a bow, derived from spent

spent is the rig's proven deep forward fold, and it already measured the
two things that would otherwise be guesswork: negative hunch is forward,
and at a -44 fold 'arms straight down' is armRU 58, because arm angles
hang from the already-curled torso.

Knees stay straight -- spent buckles them, he is winded rather than
bowing -- and the fold animates on a cycle with a real pause, so it reads
as repeated bowing rather than as a bobbing idle.

The sign and the T-pose are both asserted on JOINTS rather than angles:
the head must travel forward and never back, and a hand must never rise
to shoulder height.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `recapPoses.ts`

**Files:**
- Create: `frontend/src/features/collection/recapPoses.ts`
- Test: `frontend/src/features/collection/__tests__/recapPoses.test.ts` (create)

**Interfaces:**
- Consumes: `hashId` from `./crowdIdentity`.
- Produces:
  - `recapPose(id: string, elapsed: number, isNew: boolean, paired: 'R' | 'L' | null): { anim: string; hand?: 'R' | 'L' }`
  - `AUDIENCE_CYCLE: number`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/collection/__tests__/recapPoses.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recapPose, AUDIENCE_CYCLE } from '../recapPoses';

const ROSTER = Array.from({ length: 200 }, (_, i) => `milwi-${String(i).padStart(3, '0')}`);

describe('recapPose — the new arrivals', () => {
  it('bows, at every moment of the recap', () => {
    for (const id of ROSTER.slice(0, 20)) {
      for (let t = 0; t < 30; t += 0.1) {
        expect(recapPose(id, t, true, null).anim, `${id} at t=${t.toFixed(1)}`).toBe('bow');
      }
    }
  });

  it('bows even when pairUp has offered him a partner', () => {
    // A bower is the cast, not the audience. He does not break off to slap hands.
    expect(recapPose(ROSTER[0], 4, true, 'R').anim).toBe('bow');
  });
});

describe('recapPose — the audience', () => {
  const audience = (id: string, t: number, paired: 'R' | 'L' | null = null) =>
    recapPose(id, t, false, paired);

  it('never bows', () => {
    for (const id of ROSTER) {
      for (let t = 0; t < 20; t += 0.25) {
        expect(audience(id, t).anim, `${id} at t=${t.toFixed(2)}`).not.toBe('bow');
      }
    }
  });

  it('high-fives when it has a partner, and says which hand', () => {
    const r = audience(ROSTER[3], 5, 'R');
    expect(r.anim).toBe('highfive');
    expect(r.hand).toBe('R');
    expect(audience(ROSTER[4], 5, 'L').hand).toBe('L');
  });

  it('never returns highfive without a hand', () => {
    for (const id of ROSTER.slice(0, 40)) {
      for (let t = 0; t < 12; t += 0.2) {
        const r = audience(id, t);
        if (r.anim === 'highfive') expect(r.hand).toBeDefined();
      }
    }
  });

  it('only ever plays poses the rig actually has', () => {
    const known = new Set(['cheer', 'clap', 'jump', 'highfive']);
    for (const id of ROSTER) {
      for (let t = 0; t < 12; t += 0.3) {
        expect(known.has(audience(id, t).anim), audience(id, t).anim).toBe(true);
      }
    }
  });

  /**
   * "Occasional jumps, but those should be rare" -- Chris. Asserted as a RATE over the whole
   * room and a long window, which is the consequence, rather than as a value at one instant,
   * which would be the implementation's arithmetic handed back to it.
   */
  it('jumps rarely, but does jump', () => {
    let jumps = 0;
    let total = 0;
    for (let t = 0; t < 120; t += 0.25) {
      for (const id of ROSTER) {
        total += 1;
        if (audience(id, t).anim === 'jump') jumps += 1;
      }
    }
    const rate = jumps / total;
    expect(rate, 'jumps never happen').toBeGreaterThan(0.001);
    expect(rate, 'jumping is not rare').toBeLessThan(0.03);
  });

  /**
   * THE lockstep test. Without a per-id phase offset every bobit changes pose on the same
   * frame and the room reads as choreography rather than as a crowd -- a lesson the
   * celebration chain already paid for once (see REACTION_SPREAD in crowdReactions).
   */
  it('does not put the room in lockstep', () => {
    for (let t = 0; t < 20; t += 0.37) {
      const counts = new Map<string, number>();
      for (const id of ROSTER) {
        const a = audience(id, t).anim;
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
      const biggest = Math.max(...counts.values());
      expect(biggest / ROSTER.length, `one pose dominates at t=${t.toFixed(2)}`)
        .toBeLessThan(0.8);
    }
  });

  it('is stable: the same id and time always give the same pose', () => {
    for (const id of ROSTER.slice(0, 30)) {
      expect(audience(id, 7.25)).toEqual(audience(id, 7.25));
    }
  });

  it('cycles slowly enough that a pose is legible before it changes', () => {
    expect(AUDIENCE_CYCLE).toBeGreaterThan(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/recapPoses.test.ts`
Expected: FAIL — cannot resolve `../recapPoses`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/collection/recapPoses.ts`:

```ts
import { hashId } from './crowdIdentity';

/**
 * What one bobit plays on the recap screen, as pure pose selection.
 *
 * Deliberately separate from `crowdReactions`, which owns what the room does DURING a match --
 * a one-shot chain driven by an event, over in 2.4s. The recap has no events and no end: it
 * runs for as long as the player looks at it. Sharing a module would mean one of the two
 * growing a mode flag.
 *
 * Pure, and takes plain numbers, so the whole thing is testable without a canvas or a clock.
 */

/** Seconds one audience bobit takes to get through his own cycle of celebration. */
export const AUDIENCE_CYCLE = 3.2;

/** One bobit in this many is ever a jumper at all. */
const JUMP_ONE_IN = 8;
/** And a jumper only jumps on one cycle in this many. */
const JUMP_EVERY = 4;
/** The slice of a cycle a jump occupies, as fractions of it. */
const JUMP_FROM = 0.55;
const JUMP_TO = 0.8;

/**
 * What this bobit is doing on the recap screen right now.
 *
 * `paired` comes from `pairUp` in crowdReactions, which returns pairs LEFT FIRST -- the left
 * partner reaches RIGHT and vice versa, so two of the same hand miss each other entirely.
 *
 * NOTE there are two independent offsets at work, and both are needed:
 *   - the one below, which spreads WHICH POSE each bobit is playing, and
 *   - `FieldFigure.phase`, which spreads the animation clock INSIDE a pose so neighbours do
 *     not breathe in unison.
 * Dropping either one puts the room in lockstep in a different way.
 */
export function recapPose(
  id: string, elapsed: number, isNew: boolean, paired: 'R' | 'L' | null,
): { anim: string; hand?: 'R' | 'L' } {
  // Earned in the match just finished: he is the cast, and he takes a bow. He does not break
  // off to slap hands -- that is what the audience is for.
  if (isNew) return { anim: 'bow' };

  if (paired) return { anim: 'highfive', hand: paired };

  const h = hashId(id);
  // Stable per-bobit offset into the cycle, so the room does not change pose on one frame.
  const offset = ((h % 1000) / 1000) * AUDIENCE_CYCLE;
  const t = Math.max(0, elapsed) + offset;
  const cycle = Math.floor(t / AUDIENCE_CYCLE);
  const phase = (t % AUDIENCE_CYCLE) / AUDIENCE_CYCLE;

  // Rare by construction: one bobit in eight, one cycle in four, a quarter of that cycle --
  // so a given bobit is jumping well under one percent of the time, and in a room of forty
  // that is somebody jumping every few seconds rather than a wave of them.
  const jumper = h % JUMP_ONE_IN === 0;
  if (jumper && cycle % JUMP_EVERY === 0 && phase >= JUMP_FROM && phase < JUMP_TO) {
    return { anim: 'jump' };
  }

  return { anim: phase < 0.5 ? 'cheer' : 'clap' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/collection/__tests__/recapPoses.test.ts`
Expected: PASS.

If "jumps rarely, but does jump" fails as too rare, widen `JUMP_EVERY` or the window — do NOT widen the assertion band, which is the requirement.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/features/collection/recapPoses.ts src/features/collection/__tests__/recapPoses.test.ts
git commit -m "feat(bobits): what the recap room plays

Separate from crowdReactions, which owns a one-shot chain driven by a
match event and over in 2.4s. The recap has no events and no end.

New bobits bow; everyone else cheers and claps, high-fives when pairUp
offers a partner, and jumps rarely -- one bobit in eight, one cycle in
four, a quarter of that cycle.

Rarity is asserted as a RATE across the room over two minutes, and
lockstep is asserted by checking that no single pose ever dominates the
roster. Both are consequences; neither is the arithmetic handed back.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `onBobitEarned` — the new-bobit seam

**Files:**
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `CollectionCrowdProps.onBobitEarned?: (questionId: string) => void`

**No unit test.** See "A divergence from the spec" above: `CollectionCrowd` is a React component and vitest is node-only. The property is verified in Task 6 by driving a real match. Read this diff carefully before running it — three interaction bugs of exactly this class shipped on one branch in this feature and were caught by reading, not testing.

- [ ] **Step 1: Add the prop**

In `CollectionCrowdProps`, after `aerialAllowed`:

```tsx
  /**
   * Fired once for each bobit the player EARNS in this session -- a correct answer to a
   * question this collection had not already given him.
   *
   * Exists so the recap screen knows who to have bow. It deliberately reuses the decision this
   * component already makes to choose an entrance, rather than letting the recap take its own
   * snapshot of the owned set: a second snapshot would race `hydrate()` for signed-in players,
   * and would be a second opinion about who is new that could disagree with the entrance the
   * player actually watched.
   */
  onBobitEarned?: (questionId: string) => void;
```

- [ ] **Step 2: Destructure it**

```tsx
  slug, darkMode, isMobile, lastAnswer, finished5of5, aerialAllowed = false,
  questionCount = null, onBobitEarned,
}: CollectionCrowdProps) {
```

- [ ] **Step 3: Fire it from the existing decision**

In the `lastAnswer` effect, the `correct` branch already computes `known`. Add the call
immediately after it, BEFORE the `!known && !reducedMotion` entrance check:

```tsx
      const known = stateRef.current.residents.includes(questionId);
      // Report the earn from the SAME test that decides whether he gets an entrance, so
      // "walked in" and "bows at the recap" can never disagree about who is new.
      //
      // NOT gated on reducedMotion, unlike the entrance below: a player with reduced motion
      // still earns the bobit and still deserves to see him on the recap. Only the ENTRANCE is
      // a motion effect.
      if (!known) onBobitEarned?.(questionId);
```

- [ ] **Step 4: Add it to the effect's dependency array**

The effect's deps currently end `[lastAnswer, slug, store, repaint, syncMilestone]`. Add
`onBobitEarned`:

```tsx
  }, [lastAnswer, slug, store, repaint, syncMilestone, onBobitEarned]);
```

The caller in Task 5 wraps it in `useCallback`, so this does not re-run the effect on every
parent render.

- [ ] **Step 5: Verify nothing moved**

Run: `cd frontend && npm test && npm run typecheck`
Expected: the full suite green and typecheck clean. This task adds no test; it must break none.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/features/collection/CollectionCrowd.tsx
git commit -m "feat(bobits): report which bobits were earned this session

One optional callback, fired from the SAME test that already decides
whether a newcomer gets an entrance -- so 'walked in' and 'bows at the
recap' can never disagree about who is new.

Not gated on reducedMotion, unlike the entrance: a player with reduced
motion still earns the bobit. Only the entrance is a motion effect.

The alternative -- having the recap snapshot the owned set at match start
and diff it -- races hydrate() for signed-in players and creates a second
opinion that could contradict the entrance the player just watched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `RecapCrowd`

**Files:**
- Create: `frontend/src/features/collection/RecapCrowd.tsx`

**Interfaces:**
- Consumes: `recapPose`, `AUDIENCE_CYCLE` from Task 2; `bow` from Task 1.
- Produces:
  ```tsx
  <RecapCrowd slug={string} darkMode={boolean} isMobile={boolean} newBobitIds={ReadonlySet<string>} />
  ```

**No unit test**, for the same reason as Task 3. Its gate is Task 6.

- [ ] **Step 1: Write the component**

Create `frontend/src/features/collection/RecapCrowd.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure } from '../../components/bobbits/fieldGeometry';
import { figColor } from '../../components/bobbits/rigExtras';
import { useAuthStore } from '../../store/authStore';
import { createLocalProgressStore, createServerProgressStore } from './bobitProgress';
import type { BobitProgressStore } from './bobitProgress';
import { toneOf, hashId, slotOrder } from './crowdIdentity';
import { heightFactor } from './crowdFigures';
import { pairUp } from './crowdReactions';
import { bandFor, CROWD_CAP, groundLineFromBottom, agentPlacement } from './crowdLayout';
import { recapPose } from './recapPoses';

/**
 * The localStorage driver, shared across every signed-out mount: its state IS the browser's,
 * so there is nothing per-instance about it and rebuilding it would only re-read storage.
 */
const localStore = createLocalProgressStore();

/** How close two bobits must be to slap hands, in rig units. Matches crowdFigures. */
const HIGHFIVE_REACH_UNITS = 160;

interface RecapCrowdProps {
  /** Collection just played. Null renders nothing. */
  slug: string | null;
  darkMode: boolean;
  isMobile: boolean;
  /**
   * Bobits EARNED in the session just finished. These bow; everybody else is the audience.
   * Empty is a real and correct case -- a replay of familiar questions grants nobody.
   */
  newBobitIds: ReadonlySet<string>;
}

/**
 * The room, at the end of the match, celebrating.
 *
 * NOT `CollectionCrowd` with a mode flag. The recap needs none of that component's scene
 * director, entrances, aerial overlay, milestone latch, tree or answer reactions, and a flag
 * would leave five of its props dead while threading a mode through a file that is live in
 * production.
 *
 * It is not a fork either: colour, height, animation phase, band size, floor line and the
 * crowd cap all come from the same shared modules the play screen uses, so a bobit is
 * recognisably himself on both screens.
 *
 * Positions are STATIC -- there are no agents here at all. The celebration is the motion.
 */
export function RecapCrowd({ slug, darkMode, isMobile, newBobitIds }: RecapCrowdProps) {
  const userId = useAuthStore(s => s.user?.id ?? null);
  const [owned, setOwned] = useState<string[]>([]);

  const store: BobitProgressStore = useMemo(
    () => (userId ? createServerProgressStore() : localStore),
    [userId],
  );

  const band = useMemo(() => bandFor(isMobile), [isMobile]);

  // Seed from storage. Same shape as CollectionCrowd's: hydrate if the driver has one, and
  // seed either way, so a failed fetch leaves a definite (empty) room rather than an
  // indeterminate one.
  useEffect(() => {
    if (!slug) { setOwned([]); return; }
    let cancelled = false;
    const seed = () => {
      if (cancelled) return;
      setOwned(slotOrder([...store.load(slug)]));
    };
    const pending = store.hydrate?.(slug);
    if (pending) pending.then(seed, seed);
    else seed();
    return () => { cancelled = true; };
  }, [slug, store]);

  const shown = useMemo(() => owned.slice(0, CROWD_CAP), [owned]);
  const overflow = Math.max(0, owned.length - CROWD_CAP);

  const figuresFor = useMemo(() => (
    elapsed: number, _dt: number, width: number,
  ): FieldFigure[] => {
    // `elapsed` is BobitField's own shared clock, the same one every figure phases off.
    // Accumulating dt by hand here would be a second clock that could drift from it.
    const measured = width || band.width;
    const place = agentPlacement(0, band);

    // Static placement: index across the measured width, with the same half-step inset
    // `homeSlot` uses so nobody stands flush against an edge.
    const xs = new Map<string, number>();
    shown.forEach((id, i) => {
      xs.set(id, ((i + 0.5) / Math.max(1, shown.length)) * measured);
    });

    // Pairs are recomputed every frame, which is free here because nobody moves. pairUp walks
    // ids in sorted order, so partners never flicker between each other mid-slap, and it
    // returns each pair LEFT FIRST -- the left one reaches RIGHT and vice versa.
    const hands = new Map<string, 'R' | 'L'>();
    const audience = shown.filter(id => !newBobitIds.has(id));
    for (const [left, right] of pairUp(
      audience.map(id => ({ id, x: xs.get(id) as number })),
      HIGHFIVE_REACH_UNITS * band.scale,
    )) {
      hands.set(left, 'R');
      hands.set(right, 'L');
    }

    return shown.map(id => {
      const pose = recapPose(id, elapsed, newBobitIds.has(id), hands.get(id) ?? null);
      return {
        id,
        anim: pose.anim,
        color: figColor(toneOf(id), darkMode),
        x: xs.get(id) as number,
        groundY: place.groundY,
        scale: place.scale * heightFactor(id),
        // The SECOND offset -- this one spreads the clock inside a pose, where recapPose's
        // spreads which pose. Same derivation crowdFigures uses, so a bobit's rhythm does not
        // change between the play screen and this one.
        phase: (hashId(id) % 1000) / 250,
        poofable: false,
        greetable: true,
        vars: pose.hand ? { hand: pose.hand } : undefined,
      };
    });
  }, [shown, newBobitIds, band, darkMode]);

  if (!slug || owned.length === 0) return null;

  return (
    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
      {/* The floor, faded at both ends because the band is full-bleed and a hard rule edge to
          edge would read as a divider. Same treatment as the play band's. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, right: 0,
          bottom: groundLineFromBottom(), height: 1, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent, ${
            darkMode ? 'rgba(148,163,184,0.42)' : 'rgba(71,85,105,0.38)'
          } 8%, ${
            darkMode ? 'rgba(148,163,184,0.42)' : 'rgba(71,85,105,0.38)'
          } 92%, transparent)`,
        }}
      />
      <BobitField
        figures={[]}
        figuresFor={figuresFor}
        height={band.height}
        interactive
      />
      {overflow > 0 && (
        <span
          style={{
            position: 'absolute', left: 8, bottom: 4,
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
Expected: clean. If `heightFactor` or `agentPlacement` is not exported, export it rather than
duplicating it — a second copy of either would let the two screens' figures drift apart.

- [ ] **Step 3: Run the suite**

Run: `cd frontend && npm test`
Expected: green. This task adds no test and must break none.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/features/collection/RecapCrowd.tsx
git commit -m "feat(bobits): the recap crowd

A new component rather than a mode on CollectionCrowd: the recap needs
none of its director, entrances, overlay, milestone latch or answer
reactions, and a flag would leave five dead props threaded through a file
that is live in production.

Not a fork -- colour, height, phase, band size, floor line and the crowd
cap all come from the shared modules, so a bobit is himself on both
screens. Positions are static; there are no agents here at all.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Mount it

**Files:**
- Modify: `frontend/src/pages/Game.tsx`
- Modify: `frontend/src/features/game/components/ResultsScreen.tsx`
- Modify: `frontend/src/features/game/components/GameScreen.tsx`

**Interfaces:**
- Consumes: `<RecapCrowd>` from Task 4, `onBobitEarned` from Task 3.
- Produces: `ResultsScreenProps.collectionSlug?: string | null` and
  `ResultsScreenProps.newBobitIds?: ReadonlySet<string>`

- [ ] **Step 1: Accumulate the session's new bobits in `Game.tsx`**

Add near the other state, and note the reset — a second match must never inherit the first's
bowers:

```tsx
  /**
   * Bobits earned in THIS session, for the recap to have bow.
   *
   * Reset whenever the session id changes. Without that, a second match's recap would still be
   * bowing the first match's arrivals, which is both wrong and hard to notice.
   */
  const [newBobitIds, setNewBobitIds] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => { setNewBobitIds(new Set()); }, [state.sessionId]);
  const handleBobitEarned = useCallback((questionId: string) => {
    setNewBobitIds(prev => (prev.has(questionId) ? prev : new Set(prev).add(questionId)));
  }, []);
```

Add `useCallback` to the React import if it is not already there.

- [ ] **Step 2: Thread the callback down to `CollectionCrowd`**

`GameScreen` renders `CollectionCrowd`, so the callback passes through it. In
`GameScreenProps`:

```tsx
  /** Reports each bobit earned this session, for the recap screen's bowers. */
  onBobitEarned?: (questionId: string) => void;
```

Destructure it alongside the other props, and pass it at the `<CollectionCrowd>` call site:

```tsx
            onBobitEarned={onBobitEarned}
```

Then at `Game.tsx`'s `<GameScreen>` call site, add `onBobitEarned={handleBobitEarned}`.

- [ ] **Step 3: Give `ResultsScreen` the two props**

In `ResultsScreenProps`:

```tsx
  /** Collection just played, for the recap crowd to load its room. */
  collectionSlug?: string | null;
  /** Bobits earned this session. These bow; the rest are the audience. */
  newBobitIds?: ReadonlySet<string>;
```

Destructure with defaults:

```tsx
  collectionSlug = null,
  newBobitIds,
```

and, because a `new Set()` literal in the render would be a fresh identity every time and
rebuild the memo in `RecapCrowd` on every render:

```tsx
const NO_NEW_BOBITS: ReadonlySet<string> = new Set();
```

at module scope, used as `newBobitIds ?? NO_NEW_BOBITS`.

- [ ] **Step 4: Mount the crowd**

`ResultsScreen`'s outer element is a flex column: `<Header />`, then one flex row holding the
two panels, then the modals. The crowd goes between that row and `<LearnMoreModal>` — the last
thing in the page's reading order, which is what "on the bottom" means:

```tsx
        </motion.div>
      </div>

      {/* The room the player spent the match building, celebrating. Last in the reading order
          so it closes the experience -- and it celebrates whatever the result was, which is
          the entire point of the feature. */}
      <RecapCrowd
        slug={collectionSlug}
        darkMode={darkMode}
        isMobile={isMobile}
        newBobitIds={newBobitIds ?? NO_NEW_BOBITS}
      />

      <LearnMoreModal
```

`ResultsScreen` reads theme through `useGameTheme()`; if it has no `darkMode` and no `isMobile`
to hand, take them the same way `GameScreen` does — `useThemeStore()` for the first and
`useWindowSize()` with the `< 640` breakpoint for the second. Do not invent a new breakpoint.

- [ ] **Step 5: Pass them from `Game.tsx`**

At the existing `<ResultsScreen>` call site:

```tsx
        collectionSlug={state.collectionSlug}
        newBobitIds={newBobitIds}
```

- [ ] **Step 6: Verify**

```bash
cd frontend
npm run typecheck   # clean
npm test            # green
npm run build       # clean
```

Then serve the build and smoke it — a green build is not a page that loads:

```bash
npx serve -s dist -l 10000 &
npm run smoke
```

Expected: `smoke OK`.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/pages/Game.tsx src/features/game/components/ResultsScreen.tsx src/features/game/components/GameScreen.tsx
git commit -m "feat(bobits): mount the recap crowd

Last in the results page's reading order, so it closes the experience.
It celebrates whatever the result was, which is the entire point.

Game.tsx accumulates the session's earned bobits and resets the set on
every sessionId change -- without that, a second match's recap would
still be bowing the first match's arrivals.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Look at it, and measure the scroll

The gate that actually decides this. Every defect that mattered in this feature was found by
screenshot with the unit tests green — a T-pose clap, hands-on-hips clap, heads clipped on
mobile, a crowd bunched in the left two thirds, props never wired to the canvas, a tree frozen
half-grown, three bobits floating in mid-air.

**Files:**
- Create: `frontend/scripts/bobit-recap.mjs`

- [ ] **Step 1: Write the script**

Create `frontend/scripts/bobit-recap.mjs`:

```js
/**
 * Contact sheets for the recap crowd, plus the scroll measurement.
 *
 * FULL-VIEWPORT screenshots: the questions this answers are how the band sits under the recap
 * panels, whether the bowers are findable among the audience, and whether the page scrolls
 * before anybody expands a question. A crop of the band cannot show any of that.
 *
 * Drives a REAL match rather than mounting the screen directly, because who bows comes from
 * CollectionCrowd's own earn decision -- the one thing in this feature that no unit test can
 * reach (vitest here is node-only).
 *
 * Usage:  npm run dev      (in another shell)
 *         node scripts/bobit-recap.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOTS_URL || 'http://localhost:5173';
const OUT = '.shots';
const SLUG = 'milwaukee-wi';

/** Rosters either side of the CROWD_CAP of 100, and one small enough to count faces. */
const ROSTERS = [5, 40, 100, 140];
const WIDTHS = [[1920, 1080], [1440, 900], [1280, 800], [390, 844]];

/**
 * Click whatever is in front of us until the recap appears.
 *
 * ADVANCE FIRST, answer second. The obvious ordering -- answer, then advance -- re-clicks the
 * already-selected answer forever once a question is revealed, because the answer button is
 * still there and still enabled.
 */
async function driveToRecap(page) {
  for (let step = 0; step < 80; step++) {
    const txt = await page.evaluate(() => document.body.innerText);
    if (/play again/i.test(txt)) return true;
    const click = async (re) => {
      const b = page.getByRole('button', { name: re }).first();
      if (await b.count() && await b.isEnabled().catch(() => false)) {
        await b.click({ timeout: 2000 }).catch(() => {});
        return true;
      }
      return false;
    };
    if (await click(/lock in|next|continue|last question|game recap|see results|finish/i)) {
      await page.waitForTimeout(900);
    } else if (await click(/place|wager|confirm|submit|all in|skip/i)) {
      await page.waitForTimeout(900);
    } else if (await click(/A — correct/)) {
      await page.waitForTimeout(700);
    } else {
      await page.waitForTimeout(600);
    }
  }
  return false;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const theme of ['light', 'dark']) {
    for (const [w, h] of WIDTHS) {
      for (const owned of ROSTERS) {
        const ctx = await browser.newContext({ deviceScaleFactor: 1 });
        await ctx.addInitScript(t => localStorage.setItem('ctc-theme', t), theme);
        const page = await ctx.newPage();
        await page.setViewportSize({ width: w, height: h });
        page.on('console', m => {
          if (m.type() === 'error') console.log(`    console: ${m.text()}`);
        });

        await page.goto(`${BASE}/?mock=1&collection=${SLUG}&owned=${owned}&bobitSeed=recap`);
        await page.getByRole('button', { name: /play now|continue playing|quick play/i })
          .click();
        await page.waitForTimeout(2000);

        const reached = await driveToRecap(page);
        await page.waitForTimeout(3000);

        const m = await page.evaluate(() => ({
          doc: document.documentElement.scrollHeight,
          view: window.innerHeight,
        }));
        const verdict = m.doc > m.view + 2 ? `SCROLLS by ${m.doc - m.view}px` : 'fits';
        console.log(
          `  ${theme} ${String(w).padStart(4)}x${h} owned=${String(owned).padStart(3)} ` +
          `reached=${reached}  ${m.doc}px vs ${m.view}px -> ${verdict}`
        );

        await page.screenshot({ path: `${OUT}/recap-${theme}-${w}-${owned}.png` });
        // The whole page too, so a band below the fold is still visible in the sheet.
        await page.screenshot({
          path: `${OUT}/recap-${theme}-${w}-${owned}-full.png`, fullPage: true,
        });
        await ctx.close();
      }
    }
  }

  await browser.close();
  console.log(`\nWrote sheets to ${OUT}/. Now LOOK at them.`);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
```

- [ ] **Step 2: Run it**

```bash
cd frontend
npm run dev          # in another shell
node scripts/bobit-recap.mjs
```

If any row reports `reached=false`, the driver never got to the recap and that row's numbers
mean nothing — fix the driver before reading anything into them.

- [ ] **Step 3: Look at every sheet, against this list**

- [ ] The band is there, at the bottom, below both panels.
- [ ] **At `owned=5`**, every bobit is one of the session's arrivals: all five bow. This is the
      case where the bow is easiest to judge — is it a bow, or a stumble?
- [ ] **At `owned=140`**, the label reads `+40 more` and exactly 100 figures are drawn.
- [ ] **At `owned=100`**, the density is what Chris said he would accept. If it is worse than
      that, say so — do not quietly add rows.
- [ ] Bowers are findable among the audience. If they are not, that is a finding, not a tuning
      detail: the two-tier idea is the feature.
- [ ] Nobody is in a T-pose, hands-on-hips, or clipped at the top of the band.
- [ ] Dark mode: the figures and the floor line are both visible. The field passes a LIGHT body
      colour in dark mode and a DARK one in light, which is how the cannon once shipped
      invisible.
- [ ] At 390px the heads are not clipped — that exact bug shipped once on mobile.
- [ ] Jumps are rare. If a sheet shows several airborne at once, the rate is wrong however the
      unit test scored it.

- [ ] **Step 4: Verify the bowers against a real earn**

This is the substitute for the unit test Task 3 could not have. `milwaukee-wi`'s mock has Q1/Q2
as already-owned ids and Q3–Q5 as new ones, so:

- Run with `&owned=40` and answer everything correctly. **Exactly three** bobits should bow,
  because only Q3–Q5 are genuinely new.
- Run it a second time in the same browser without clearing storage. **Nobody** should bow —
  every question is now familiar — and the recap should be all audience. That is the correct
  behaviour, and it is the case most likely to look like a bug to someone who has not read the
  spec.

- [ ] **Step 5: Report the scroll measurement**

Collect the `fits` / `SCROLLS by Npx` lines and report them as a table. This is the answer to
"let's try to avoid scrolls until they expand the questions" — as a number, per width.

**If it scrolls, stop and report.** Do not restyle the recap to make room. The spec's non-goals
say so explicitly: the decision is Chris's.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add scripts/bobit-recap.mjs
git commit -m "test(bobits): contact sheets and the scroll measurement

Full-viewport, four widths, both themes, rosters either side of the
CROWD_CAP. Drives a real match rather than mounting the screen, because
who bows comes from CollectionCrowd's own earn decision -- the one thing
here no unit test can reach, since vitest is node-only.

Also reports document height against viewport on the collapsed recap, so
'avoid scrolls until they expand the questions' is a number rather than
a hope.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Full verification before any PR**

```bash
cd frontend
npm test            # green
npm run typecheck   # clean
npm run build       # clean
npm run smoke       # OK
```

Do not claim any of these passed without the output in front of you.

---

## Self-review notes

**Spec coverage.** §1 → Tasks 4 and 5. §2 → Tasks 3 and 5. §3 → Task 2. §4 → Task 1. §5 →
Task 5. §6 → each task's test step plus Task 6. §7's file table → Tasks 1–6, all accounted for.

**Divergences from the spec, recorded where they occur:**

1. **`onBobitEarned` has no unit test.** The spec's §6 promises one; `CollectionCrowd` is a
   React component and vitest is node-only, so it is impossible without adding jsdom. Verified
   instead by driving a real match in Task 6 step 4, which is a stronger check anyway — it
   tests the whole chain rather than one callback.
2. **`onBobitEarned` is not gated on `reducedMotion`**, though the entrance beside it is. A
   reduced-motion player still earns the bobit; only the entrance is a motion effect.
3. **`RecapCrowd` takes the audience-only list to `pairUp`.** The spec does not say so. Bowers
   must not be offered partners, or a bower would be handed a `hand` he ignores and his
   partner would slap at nobody.

**Open questions the spec leaves for a screenshot**, to be answered in Task 6 and reported, not
silently resolved: whether the audience should ever fall quiet and start again, and whether the
density at 100 is what Chris meant by acceptable.

# Bobit living room — handoff

**Written:** 2026-09-15, at a context clear.
**Branch:** `feat/bobit-living-floor` — **30 commits, NOT pushed, nothing deployed.**
Production is untouched. The frontend static site auto-deploys from `master`, so merging is a
production deploy; do not merge without Chris saying so.

## Read these first, in this order

1. `docs/superpowers/specs/2026-09-12-bobit-living-room-design.md` — the design. **Read its
   2026-09-14 addendum**, which corrects four things and records the occlusion decision.
2. `docs/superpowers/plans/2026-09-12-bobit-living-floor.md` — plan 1. **Done.**
3. `docs/superpowers/plans/2026-09-14-bobit-entrances.md` — plan 2. **Functionally done.**
4. Plan 3 — **not written.** Tree, perching, the 25% milestone.

## State

**Plan 1 (the living floor): complete.** Bobits wander on one ground line, greet on click,
celebrate wins with a staggered cheer → clap → high-five, and shrug off costless misses.

**Plan 2 (the entrances): complete but unpolished.** The director runs scenes-as-data. The
swirl (arrival #1), the cannon (arrival #2) and four pool entrances all exist and fire. The
cannon's flight passes in front of the question card on an overlay canvas.

**556 tests green, typecheck clean.**

## THE STANDING INSTRUCTION THAT CHANGED

Memory and the original spec both say *"bobits must never cover the question card or any of the
four answer options"* (Chris, 2026-09-05). **That was relaxed on 2026-09-14, narrowly.** Chris
asked for the cannon shot to be able to fly in front of the buttons, and explicitly said NOT to
change the shape of the landscape to do it.

The relaxation is bounded to four rules, all verified in a browser and all load-bearing:

1. **Transient only** — a figure passes through; nothing comes to rest over the card.
2. **Reveal phase only** — never while the timer runs (`aerialAllowed={state.phase === 'revealing'}`).
3. **`pointer-events: none`** and `interactive={false}` — it can never intercept a click.
4. **Set pieces only** — pool entrances never set `layer: 'air'`.

The crowd at rest still never occludes anything. **Do not widen this without asking.**

## What changed from the spec while building

- **Depth is gone.** One ground line, one size. Depth made a bobit changing station walk
  diagonally up the screen, and the rig has no perspective gait, so it read as sliding.
  `stageBounds`/`agentPlacement` remain as the seam if it is ever wanted back.
- **Band is full-bleed, 96px desktop / 72px mobile** (was 190/100 in the spec).
- **There is a floor line** under the crowd. Without it `jump` — a real 48-unit lift — read as
  a wobble, because there was nothing to leave.
- **`WANDER_CAST` is derived from width**, not fixed: `wanderCastFor(width, band)`, ~37 desktop,
  ~8 phone. Measurement showed the cast never constrained performance at all.
- **Set pieces do not wait for floor.** The spec had a 4s wait; the full-bleed band made it
  unnecessary. `canStage` is checked once and the scene is skipped if busy.

## How to run it

The backend here is frozen and the live API serves CTC under different paths, so there is
nothing to point a local frontend at. A dev-only mock lives in the app:

```
cd frontend && npm run dev
http://localhost:5173/?mock=1&collection=milwaukee-wi
```

Options: `&owned=N` (default 30), `&bobitSeed=xyz`, `&scene=<id>` to replay an entrance on a
14s loop. Scene ids: `swirl`, `cannon`, `pool-stumble`, `pool-trip`, `pool-peek`, `pool-drop`.

- **To see the swirl:** `&owned=0`, answer A.
- **To see the cannon:** `&owned=1`, answer A twice (the second is bobit #2).
- **A is always the correct answer.** Q1/Q2 are bobits you own (a miss takes one and plays the
  abduction); Q3–Q5 are new (a miss is the costless ripple).

`scripts/bobit-play.mjs` opens a headed browser with the same mocks — but it costs ~500MB and
was killed four times on a loaded machine. **Prefer the in-app mock.**

Other scripts: `scripts/bobit-shots.mjs` (pose sheet + page sweep → `.shots/`),
`scripts/bobit-bench.mjs` (frame cost vs cast size).

## Open items, in the order I would take them

1. **The cannon prop is crude.** It reads as a plain grey tube, not a cannon. Visible and
   correctly placed, but the silhouette needs art work — a proper carriage, a thicker breech,
   maybe a muzzle flare. `frontend/src/components/bobbits/props.ts`.
2. **The swirl and the four pool entrances have never been looked at.** Only the cannon was
   screenshotted. Use `&scene=<id>`.
3. **Chris's open question:** whether the flat overlap reads badly now that depth is gone, and
   whether the yield pause (0.45–1.1s) makes the room feel too polite.
4. **Plan 3 is unwritten:** the tree on the right border, perching (`Surface` is still
   unconsumed), `questionCount` plumbing, the 25% milestone.
5. `ResultsScreen` declares a `collectionQuestionCount` prop **no caller passes** — dead, always
   falls back to 5. Worth fixing when the plumbing lands.

## Gotchas this work hit, worth not rediscovering

- **`armRU`/`armRF` are both absolute from the body, 0° = straight DOWN, and `armRF` is NOT an
  elbow bend.** Reading it as one has produced a T-pose three times: `carryGrip`, `clap`, and
  nearly `splayed` (where a T-pose is correct and deliberate).
- **Numeric verification is not visual verification.** Every defect in this feature that mattered
  was found by screenshotting, with the unit tests green: a T-pose clap, hands-on-hips clap,
  heads clipped off on mobile, the back row positioned off-canvas, the crowd bunched in the left
  two thirds, and props that were never wired to the canvas at all.
- **Nominal vs measured width.** `band.width` is a nominal 1000 for proportional placement. Using
  it where real pixels are needed has caused two separate bugs.
- **Playwright matches routes in REVERSE registration order.** A catch-all must be registered
  first or it swallows everything.
- **A harness's sanity check must watch the quantity the variable actually drives.** The bench
  compared total frame cost (dominated by paint, flat across cast sizes) and cried vsync at a
  working harness.

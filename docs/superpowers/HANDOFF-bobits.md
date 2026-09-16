# Bobit living room — handoff

**Written:** 2026-09-15, updated after a review pass and the first two fixes from it.
**Branch:** `feat/bobit-living-floor` — **34 commits, NOT pushed, nothing deployed.**
Production is untouched. The frontend static site auto-deploys from `master`, so merging is a
production deploy; do not merge without Chris saying so.

## Read these first, in this order

1. `docs/superpowers/specs/2026-09-12-bobit-living-room-design.md` — the design. **Read its
   2026-09-14 addendum**, which corrects four things and records the occlusion decision.
2. `docs/superpowers/plans/2026-09-12-bobit-living-floor.md` — plan 1. **Done.**
3. `docs/superpowers/plans/2026-09-14-bobit-entrances.md` — plan 2. **Done, and now reviewed.**
4. Plan 3 — **not written.** Tree, perching, the 25% milestone.

## State

**Plan 1 (the living floor): complete.** Bobits wander on one ground line, greet on click,
celebrate wins with a staggered cheer → clap → high-five, and shrug off costless misses. They
now vary in height by ±10%.

**Plan 2 (the entrances): complete.** The director runs scenes-as-data. The swirl (arrival #1),
the cannon (arrival #2) and four pool entrances all exist and fire. The cannon's flight passes
in front of the question card on an overlay canvas.

**569 tests green, typecheck clean.**

A full code review ran on 2026-09-15 over `713fa75..796e12f`. Verdict: **merge with fixes**. The
occlusion relaxation was the highest-risk part of the work and **all four bounds hold**, two of
them enforced by tests that will hold for future scenes. Two Criticals came out of it; both are
fixed (commits `f4b9083`, `ec0c343`). The Importants are listed under open items below.

## READ THIS BEFORE YOU RUN ANYTHING

**`?mock=1&owned=N` renders an EMPTY ROOM on its first page load.** Not a rendering bug — module
evaluation order:

- `CollectionCrowd.tsx` creates `localStore` as a module-level singleton.
- `createLocalProgressStore` snapshots localStorage **once, at construction**.
- `main.tsx`'s static `import App` evaluates that module *before* its own body runs
  `await import('./dev/mockGameApi')`, which is what seeds `&owned=`.

So the seed lands after the snapshot. **Load the page twice** and the crowd appears; the seed
persists, and the second load's singleton reads it. Measured: first load 0 ink on the band,
second load 26,171.

This is why the swirl and the four pool entrances went unreviewed for so long — anyone who
looked at them through the documented harness saw an empty band and a lone newcomer, and no
part of that looks like a harness problem. **Not yet fixed.** `bobit-shots.mjs` was never
affected because it seeds through `addInitScript`, before any page script runs.

## THE STANDING INSTRUCTION THAT CHANGED

Memory and the original spec both say *"bobits must never cover the question card or any of the
four answer options"* (Chris, 2026-09-05). **That was relaxed on 2026-09-14, narrowly.** Chris
asked for the cannon shot to be able to fly in front of the buttons, and explicitly said NOT to
change the shape of the landscape to do it.

The relaxation is bounded to four rules, all verified in a browser, all re-verified in the
2026-09-15 review, and all load-bearing:

1. **Transient only** — a figure passes through; nothing comes to rest over the card.
2. **Reveal phase only** — never while the timer runs (`aerialAllowed={state.phase === 'revealing'}`).
3. **`pointer-events: none`** and `interactive={false}` — it can never intercept a click.
4. **Set pieces only** — pool entrances never set `layer: 'air'`.

Bounds 1 and 4 are enforced by tests, not by convention: `scenes.test.ts` plays every scene to
its last frame and asserts nobody ends airborne, hidden or off the floor, and separately asserts
no pool beat sets `layer`. A future pool entrance that reaches for the sky fails CI.

The crowd at rest still never occludes anything. **Do not widen this without asking.**

## What changed from the spec while building

- **Depth is gone.** One ground line, one size. Depth made a bobit changing station walk
  diagonally up the screen, and the rig has no perspective gait, so it read as sliding.
  `stageBounds`/`agentPlacement` remain as the seam if it is ever wanted back.
- **Height varies instead**, ±10% via `heightFactor(id)` in `crowdFigures.ts`. This is depth's
  distinguishing cue without depth's failure — nobody walks a diagonal, so nothing slides.
- **Band is full-bleed, 96px desktop / 72px mobile** (was 190/100 in the spec). **This has
  consequences the spec did not anticipate — see `pool-peek`/`pool-drop` under open items.**
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

**Load it twice** — see the harness section above.

Options: `&owned=N` (default 30), `&bobitSeed=xyz`, `&scene=<id>` to replay an entrance on a
14s loop. Scene ids: `swirl`, `cannon`, `pool-stumble`, `pool-trip`, `pool-peek`, `pool-drop`.

- **To see the swirl:** `&owned=0`, answer A.
- **To see the cannon:** `&owned=1`, answer A twice (the second is bobit #2).
- **A is always the correct answer.** Q1/Q2 are bobits you own (a miss takes one and plays the
  abduction); Q3–Q5 are new (a miss is the costless ripple).

`scripts/bobit-play.mjs` opens a headed browser with the same mocks — but it costs ~500MB and
was killed four times on a loaded machine. **Prefer the in-app mock.**

Other scripts:

- `scripts/bobit-scenes.mjs` — **contact sheets for the entrances**, one PNG per scene per
  theme into `.shots/`. Frames are labelled with the elapsed time the *page* saw, because the
  naive schedule drifts half a second over eight frames and will label a `spent` frame as
  `splayed`. Handles the two-load workaround itself. `node scripts/bobit-scenes.mjs [sceneId…]`.
  The cannon is excluded by default: its flight needs `aerialAllowed`, so replaying it
  mid-question captures the air layer suppressed, which looks like a bug and is not one.
- `scripts/bobit-shots.mjs` — pose sheet + page sweep.
- `scripts/bobit-bench.mjs` — frame cost vs cast size.

## Open items, in the order I would take them

1. **Fix the `?mock=1` first-load bug.** Everything else in this list is harder to look at until
   this is gone. Either seed before `App` is imported, or make the local store read lazily
   instead of snapshotting at construction.
2. **`pool-peek` and `pool-drop` do not work, and height variation does not help them.**
   Peek is "a head appears from below the floor"; drop is "falls in from above". The 96px
   full-bleed band has no space above or below the floor line, so peek has no peek — he is just
   suddenly there — and drop's first 0.7s is a blank band before a puff and a dizzy bobit.
   Both were written against the spec's 190px band. Needs either different choreography or
   vertical room; it is a design decision, not a bug fix.
3. **The cannon prop is crude.** It reads as a plain grey tube, not a cannon. Visible and
   correctly placed, but the silhouette needs art work — a proper carriage, a thicker breech,
   maybe a muzzle flare. `frontend/src/components/bobbits/props.ts`.
4. **The review's Important findings**, none yet fixed:
   - The overlay's coordinate mapping ignores the game container's padding in **both** axes
     (`py-5 sm:py-6 md:py-8 px-4 sm:px-6`), so an airborne figure is drawn 20–32px too low and
     16–24px sideways. That is close to a full body height of discontinuity at takeoff and at
     landing. Only the two transition frames show it — screenshot those, not the apex.
   - `TOP_MARGIN = 2` in `crowdFigures.ts` clamps the **feet**, and a figure is drawn upward
     from there, so the closed-sky fallback draws the whole body off the top of the canvas —
     the exact "vanish in flight" it exists to prevent. Reachable whenever a player hits Next
     within ~4.3s of the reveal.
   - The cannon's `host` is **always a phantom**: `castOverrides` is defaulted to `{}` and no
     caller passes it, so the host is a synthetic id who materialises at t=0 with no entrance
     and vanishes at t=10.6. The high-five is with a stranger. **Wants a yes/no from Chris
     rather than a fix from whoever picks this up** — it changes what the scene means.
   - Reduced motion renders an **empty band**: `syncCast` sits inside `if (!reducedMotion)`, so
     no agent is ever created. The spec is explicit that this path should be today's behaviour.
5. **Plan 3 is unwritten:** the tree on the right border, perching (`Surface` is still
   unconsumed), `questionCount` plumbing, the 25% milestone.
6. Review Minors, all small: the aerial gate is read from two different copies one frame apart;
   effect/prop ids key on scene id rather than scene instance (fine today, not once the
   entrance library grows); `SMOKE_DUR`/`SMOKE_LIFE` are duplicated across two modules;
   the costless-miss ripple starts at `slotOrder[0]` where the spec says the newest bobit;
   `cannonMuzzle` is tested but unused, so the flight does not start at the muzzle.
7. `ResultsScreen` declares a `collectionQuestionCount` prop **no caller passes** — dead, always
   falls back to 5. Worth fixing when the plumbing lands.

## Chris's open questions, one of them now answered

- **"Does the flat overlap read badly now that depth is gone?"** — Partly, but that is the
  smaller half. The real cost is **findability**: in a room of ~35 same-size, same-palette
  figures on one line, an entrance that is not a poof or a flash does not register at all.
  `pool-trip`'s stroll-in is indistinguishable from ambient walking. The two entrances that do
  read (swirl, drop) read because of *smoke*, not pose. Height variation was added in response;
  whether it is enough is worth a fresh look. Consider giving every pool entrance a poof as its
  arrival marker. Three-plus figure overlaps do go muddy, but that is secondary.
- **"Is the yield pause (0.45–1.1s) too polite?"** — still unanswered.

## Gotchas this work hit, worth not rediscovering

- **`armRU`/`armRF` are both absolute from the body, 0° = straight DOWN, and `armRF` is NOT an
  elbow bend.** Reading it as one has produced a T-pose three times: `carryGrip`, `clap`, and
  nearly `splayed` (where a T-pose is correct and deliberate).
- **Numeric verification is not visual verification.** Every defect in this feature that mattered
  was found by screenshotting, with the unit tests green: a T-pose clap, hands-on-hips clap,
  heads clipped off on mobile, the back row positioned off-canvas, the crowd bunched in the left
  two thirds, props never wired to the canvas, and `pool-stumble` arriving with no poof.
- **A tool can be structurally unable to show the bug it was built to find.** The dev replay
  route passes a synthetic `replay-<ts>` id that never becomes a resident, so the newcomer
  renders as an *orphan* with no agent — which meant the release-to-agent teleport could not
  appear there at all. Reviewing entrances through `__bobitScene` alone will keep missing that
  whole class. Drive a real grant (`&owned=0`, answer A) when the handoff matters.
- **Three of the new tests asserted the implementation's own arithmetic back at it**, and each
  one sat directly on top of a real defect: the clamp test asserted the clamp's range instead of
  whether anything was visible; every synthetic scene avoided `at: 0`; nothing asserted that an
  agent's position survived his scene. Assert *consequences*, not *values*.
- **Nominal vs measured width.** `band.width` is a nominal 1000 for proportional placement. Using
  it where real pixels are needed has caused two separate bugs.
- **Playwright matches routes in REVERSE registration order.** A catch-all must be registered
  first or it swallows everything.
- **A harness's sanity check must watch the quantity the variable actually drives.** The bench
  compared total frame cost (dominated by paint, flat across cast sizes) and cried vsync at a
  working harness. Separately, a column probe that sampled every 52px "proved" an empty band
  when the figures are 3px-wide lines — it was measuring nothing.

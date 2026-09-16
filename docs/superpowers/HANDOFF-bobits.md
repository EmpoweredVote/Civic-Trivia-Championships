# Bobit living room — handoff

**Written:** 2026-09-16, with plans 1, 2 and 3 all shipped on this branch.
**Branch:** `feat/bobit-living-floor` — **55 commits, NOT pushed, nothing deployed.**
Production is untouched. The frontend static site auto-deploys from `master`, so merging is a
production deploy; do not merge without Chris saying so.

## Read these first, in this order

1. `docs/superpowers/specs/2026-09-12-bobit-living-room-design.md` — the design. **Read its
   2026-09-14 addendum**, which corrects four things and records the occlusion decision.
2. `docs/superpowers/plans/2026-09-12-bobit-living-floor.md` — plan 1. **Done.**
3. `docs/superpowers/plans/2026-09-14-bobit-entrances.md` — plan 2. **Done, and now reviewed.**
4. `docs/superpowers/plans/2026-09-15-bobit-tree-and-perching.md` — plan 3. **Done.**
   Built against the spec's **2026-09-15 addendum**, which overrides the spec body on tree
   height and on how the milestone is stored.

## State

**Plan 1 (the living floor): complete.** Bobits wander on one ground line, greet on click,
celebrate wins with a staggered cheer → clap → high-five, and shrug off costless misses. They
now vary in height by ±10%.

**Plan 2 (the entrances): complete.** The director runs scenes-as-data. The swirl (arrival #1),
the cannon (arrival #2) and four pool entrances all exist and fire. The cannon's flight passes
in front of the question card on an overlay canvas.

**Plan 3 (the tree, perching, the milestone): complete.** A collection earns a small tree at 25%
of its questions, on a persisted high-water mark so it can never un-earn itself. `Surface` has
its first consumer: a bobit with nothing to do walks to the trunk and sits on the branch, and
greets from his seat. The room notices the tree arriving; a phone gets the same milestone as a
crowd celebration instead, because a phone band has no room for a trunk.

**653 tests green, typecheck clean.**

A full code review ran on 2026-09-15 over `713fa75..796e12f`. Verdict: **merge with fixes**. The
occlusion relaxation was the highest-risk part of the work and **all four bounds hold**, two of
them enforced by tests that will hold for future scenes. **Every finding from it is now fixed** —
two Criticals, four Importants, and one Minor that turned out to be worse than reported.

## The harness bug that hid all of this (FIXED 2026-09-15, `d323902`)

Worth knowing about even though it is fixed, because it explains the state you inherited.

`?mock=1&owned=N` used to render an **empty room on its first page load** and a correct one on
every load after. `createLocalProgressStore` snapshotted localStorage in its constructor, and
`localStore` in `CollectionCrowd.tsx` is a module singleton — so the snapshot was really taken
whenever that module was first imported, and `main.tsx`'s static `import App` evaluates it
before the module body runs the dev mock that seeds `&owned=`.

An empty band reads as a feature that does not work, not as a harness that lies. That is why
the swirl and the four pool entrances shipped unreviewed. The mirror now fills on first use.

**The lesson generalises:** a module-level singleton that captures I/O at construction has, in
effect, captured it at import time, and import order is not something callers can see or
control. `bobit-shots.mjs` was immune only because it seeds through `addInitScript`, before any
page script runs.

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
- **The tree has ONE branch, not the spec's 2-3.** 96px does not hold a second one. See the
  spec's 2026-09-15 addendum.
- **Nobody walks behind the tree.** The spec wanted depth ordering against it; props draw
  BEHIND figures (`BobitField`, "Props first"), and depth is gone. A perched bobit drawing in
  front of the trunk is what that order already gives, and is the part that matters.
- **Scenes can be anchored.** `Scene.anchor: 'right'` was added for the milestone: `canStage`
  packs from the left, so the set piece staged at the far end of the band and its cast
  presented at an empty stretch of floor while the tree stood on the other side.

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

Other scripts:

- `scripts/bobit-scenes.mjs` — **contact sheets for the entrances**, one PNG per scene per
  theme into `.shots/`. Frames are labelled with the elapsed time the *page* saw, because the
  naive schedule drifts half a second over eight frames and will label a `spent` frame as
  `splayed`. `node scripts/bobit-scenes.mjs [sceneId…]`.
  The cannon is excluded by default: its flight needs `aerialAllowed`, so replaying it
  mid-question captures the air layer suppressed, which looks like a bug and is not one.
- `scripts/bobit-props.mjs` — **prop sheet**: every prop at the 0.2 scale the player sees it,
  beside a real bobit, and enlarged so the silhouette can be judged. Both themes, because the
  field passes a LIGHT body colour in dark mode and a DARK one in light, and an accent that
  contrasts in one can vanish in the other.
- `scripts/bobit-shots.mjs` — pose sheet + page sweep.
- `scripts/bobit-bench.mjs` — frame cost vs cast size.

## Open items, in the order I would take them

1. **`pool-peek` and `pool-drop` do not work.** Peek is "a head appears from below the floor";
   drop is "falls in from above". The 96px full-bleed band has no space above or below the
   floor line, so peek has no peek and drop's first 0.7s is a blank band. Plan 3 did **not**
   give them the room they need — the tree is sized to the same band. Needs either different
   choreography or a taller band, and that is a design decision.
2. **Review Minors, still open:** the aerial gate is read from two different copies
   (`allowAirRef` in the frame loop, the `aerialAllowed` prop in render) and can disagree for a
   frame; effect/prop ids key on scene id rather than scene instance (fine today, not once the
   entrance library grows); `SMOKE_DUR`/`SMOKE_LIFE` are duplicated across two modules; the
   costless-miss ripple starts at `slotOrder[0]` where the spec says the newest bobit;
   `cannonMuzzle` is tested but unused, so the flight does not start at the muzzle.
3. **50% / 75% / 100% milestones.** Out of scope by the spec, and the seam is now real:
   `milestone.ts` plus a scene file plus a prop. The tree is the worked example.
4. **The high-water mark is local even for signed-in players.** `backend/` here is frozen and
   ev-accounts is another repo, so a signed-in player who switches browsers re-earns the tree.

## Decisions a fresh session should not re-litigate

- **The tree is room-owned, not a Scene.** A permanent structure inside a transient scene
  leaves when the scene does, the way a cannon leaves with its shot.
- **The climb is not scripted.** `assignPerch` sends somebody up once the branch exists;
  scripting it in the milestone scene too would put two bobits on a one-bobit branch.
- **Growing is for the moment the tree is earned, and only then.** Getting that right took
  three passes — see `042af8e`. A tree that sprouts on every mount, or on the first evaluation
  against a real denominator, is the failure mode.
- **Whether the cannon should have a host at all** is still genuinely open. Casting a real
  neighbour settled what a host IS, not whether the scene wants one.

## What the review fixes changed, worth knowing

- An airborne bobit was drawn on **both** canvases for the whole flight — arcing over the card
  and standing on the band at once. Found by screenshot, not by the suite; the existing test
  passed no agents, so the band copy it guarded against could not be produced. The review had
  this as a Minor one-frame race. It was every frame of every shot.
- The closed-sky clamp pinned the FEET at y=2, which draws the whole body off the top. Its test
  asserted the clamp's own range and passed throughout.
- The cannon's host was a synthetic id — a bobit who appeared from nowhere and evaporated. It is
  now the nearest real resident. **Still open for Chris:** whether the cannon should have a host
  at all. The code no longer answers that by accident.
- Reduced motion rendered an empty band, for two independent reasons (no agents were created,
  and a static field painted once before the parent had seeded it).
- The cannon prop read as a magnifying glass: a filled disc and a tapered tube in one flat
  colour, with nothing under either. It now has a spoked wheel ring, a trail to the ground, a
  flared muzzle and a swelled breech. Its detail colour was also hardcoded light, so in dark
  mode — where the BODY is light — every detail was invisible; it is derived from the body now.

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
- **`Surface` positions a figure's SEAT, and a seated figure needs a seated `hoverAnim`.** The
  standing and seated pelvis offsets are 112 and 8 — 104 units apart — and `figureBounds`
  measures from the BASE anim while paint positions with the RESOLVED one. This has now caught
  three separate things on this branch, most recently the prop sheet itself, which drew a
  seated bobit straight through the top of the band. Never hardcode 112; ask `pelvisOffset()`.
- **A test that asserts a span says nothing about where the scene lands.** The milestone's
  "reserves the right quarter" test checked `span <= 0.25` and passed happily while the scene
  played at the opposite end of the band. Stage the thing and assert the ground it took.
- **A harness's sanity check must watch the quantity the variable actually drives.** The bench
  compared total frame cost (dominated by paint, flat across cast sizes) and cried vsync at a
  working harness. Separately, a column probe that sampled every 52px "proved" an empty band
  when the figures are 3px-wide lines — it was measuring nothing.

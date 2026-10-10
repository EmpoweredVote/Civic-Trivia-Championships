# The bobit tableau — design

> **Status:** design, approved in brainstorming 2026-10-10. Not yet planned, not yet built.
> **Supersedes:** the margin tree (`2026-09-17-bobit-margin-tree-design.md`), which this absorbs.
> **Author:** Claude, from a brainstorm with Chris, 2026-10-10.

## 1. What this is, and why

A collection's progress is currently legible only as a number and as a crowd that gets
denser. At 100 bobits they stand ~18.7px apart while a cheering figure is ~20px wide, and the
accepted answer to that — recorded in `HANDOFF-bobits.md` §6 and in memory — was always
"eventually we'll build buildings as stuff for them to climb on." This is that.

**The tableau is the progress bar.** A stick-figure landscape of houses, trees and scaffolds
that the player's own bobits build, one line at a time, in the empty margins beside the
question column. Every four bobits earned, a crew hauls a new line in, heaves it upright,
climbs it and lashes it on. Early on the margins hold a cabin and a sapling; at a hundred
bobits they hold two towers with bobits living all over them.

**Success looks like:** a player who has been away can tell at a glance roughly how far into a
collection they are, without reading a number — and a player who has just earned their
sixteenth bobit watches a roof go on.

**It also solves the density problem rather than deferring it.** Every completed structure
emits new `Surface`s, and `Surface` has been sitting unused in `fieldGeometry.ts` since Stage 1
with a comment saying it exists for "the later unlockable platforms, toys and buildings". The
climbing and perching machinery already works; this gives it somewhere to go.

### What Chris decided, and what is assumption

Decided in the brainstorm, verbatim in substance:

| Question | Decision |
|---|---|
| Where it lives | The margins beside the question column, during a match. The question/answer blocks may give up width to make room. |
| What drives it | **Absolute bobit count** — one line every 4 bobits, 25 lines to a finished tableau. Collections are being targeted at 100 questions going forward. |
| Build order | **One structure at a time.** A structure finishes before the next starts, so there is never a pile of loose sticks. |
| Margin scope | **Both margins**, and the existing margin tree is **rebuilt** as ordinary tableau lines. No special cases left. |
| The build beat | **A continuous worksite.** Work runs on its own clock and spills across questions; earning a line is the moment it goes up. |
| Narrow screens | **Desktop-only during a match**; phones keep the crowd cheer. Progress still accrues silently. |
| Results screen | The tableau **also appears on the results screen**, for everyone. |
| Prototype scope | **One tableau.** Per-collection tableaus are a later file, not a later rewrite. |

Assumptions, stated so they can be corrected: this reuses the existing bobit rig and canvas
machinery rather than introducing new art; and the standing occlusion rule still binds
unchanged (§7).

## 2. The blueprint

### 2.1 Coordinate space

Each margin is its own rig, authored in abstract units — **1000 tall, 400 wide** — and scaled
to the measured margin box with `min(heightFit, widthFit)`, exactly as `treeScale` does today.

This is the single most important structural decision in the document. It makes "nothing ever
reaches the question card" a matter of **geometry rather than care**: a tableau that cannot
outgrow its measured margin cannot cross into the column. It is the same construction that
lets the margin tree's canvas stay interactive while the aerial overlay must not.

The left rig is the right rig mirrored about its own centre line, so **one set of bounds tests
covers both margins**.

### 2.2 The upward rule

Every line declares what it is lashed to. Line 1 is lashed to the ground; **nothing else is.**
A structure may only be built on a structure already standing.

This is both the physical logic of the scene and the reason a bobit has to climb in order to
work — he is building above his own head. It is enforced by a test, not by care: the blueprint
is invalid if any line's anchor has a higher index than the line itself.

### 2.3 Two stacks, alternating

Each margin grows its own tower. The sequence alternates sides so neither margin sits empty
for half a collection.

```
   LEFT MARGIN                            RIGHT MARGIN
                                               ╗ ▸ 24,25  pennants
   ┌───────┐  ◂ 20                            ║  ▸ 23     yard
   │   o   │  ◂ 19   ⑤ LOOKOUT                ║  ▸ 22     stay
   ╞═══╤═══╡  ◂ 18     on the scaffold     ═══╩═══  ▸ 21   ⑥ MAST & FLAG
   │   │   │  ◂ 17                         │ o   │           on the deck
   ╫───┼───╫  ◂ 12                         ╞═════╡  ▸ 16
   ║   │   ║  ◂ 11   ③ SCAFFOLD            │     │  ▸ 15  ④ TREEHOUSE
   ╫───┼───╫  ◂ 10     on the cabin roof   ╘══╤══╛  ▸ 14     lashed into
   ║   │   ║  ◂  9                            │     ▸ 13     the branches
   ╔═══╧═══╗  ◂  4                         ╲  │  ╱
   ║ ╱   ╲ ║  ◂  3   ① CABIN                ╲ │ ╱   ▸ 7,8
   ║│  ▫  │║  ◂  2     on the ground          ╲│╱   ▸ 6    ② TREE
   ║│     │║  ◂  1                              │    ▸ 5      on the ground
 ──┴┴─────┴┴──────────────────────────────────┴┴──────────────────
            the band floor — shared with the crowd
```

Line numbers run 1–4 (cabin), 5–8 (tree), 9–12 (scaffold), 13–16 (treehouse),
17–20 (lookout), 21–25 (mast and flag).

| # | Structure | Side | Lines | Rests on | Complete at |
|---|---|---|---|---|---|
| ① | **Cabin** — two wall posts, two rafters | left | 4 | the ground | 16 bobits |
| ② | **Tree** — trunk, three branches | right | 4 | the ground | 32 |
| ③ | **Scaffold** — two uprights, two braces | left | 4 | the cabin roof | 48 |
| ④ | **Treehouse deck** — two joists, deck, rail | right | 4 | the tree's branches | 64 |
| ⑤ | **Lookout** — two posts, a roof | left | 4 | the scaffold | 80 |
| ⑥ | **Mast and flag** — mast, stay, yard, two pennants | right | 5 | the deck | 100 |

**25 lines, 6 structures, 100 bobits.**

### 2.4 One thing the occlusion rule forbids

The obvious finale is a rope bridge spanning the two stacks. **It is forbidden** and is not in
this design. The margin box is measured from the question column's *top* edge downward, so
anything spanning the gap is over the card by definition. The finale is a mast and flag on the
right-hand tower instead.

Chris was told this explicitly and chose not to widen the rule. Widening it is his call alone
and is not to be taken quietly — see §7.

## 3. Progress and persistence

```
linesBuilt(peak) = min(25, floor(peak / 4))
```

`peak` is the **existing** high-water mark from `bobitPeak.ts`. No new storage key, no schema
change, no migration. That module already filters junk values defensively, already defers its
read to first use (because a module singleton that reads storage in its constructor has really
read it at import time), and is already documented as local-only.

**Why the peak and not the current count.** Bobits are revoked on a wrong answer. A house that
un-builds itself when you miss a question punishes twice and reads as a bug. This is the same
rule the tree already follows and it is not re-litigated here.

**`questionCount` is no longer read at all.** The tableau is purely absolute-count driven,
which deletes an entire failure mode: the tree currently earns nothing while `questionCount`
is null — in flight, or after a failed collection fetch — specifically so it does not flicker
in on every slow network. With no percentage to compute, there is nothing to wait for.

**Known limitation, inherited not introduced.** `bobitPeak` is localStorage-only even for
signed-in players, because `backend/` in this repo is frozen and the signed-in driver reads
from ev-accounts, which is another repo. A player who changes browser re-earns the tableau.
That is already true of the tree; this makes it cost more. Fixing it is ev-accounts work and
is out of scope here. It should be filed there.

**Consequence worth stating plainly:** a collection with fewer than 100 questions can never
finish its tableau — a 31-question collection tops out at 7 lines, which is a finished cabin
and a tree still missing its top branch. That is the accepted cost of predictable cadence, and
it resolves itself as collections move to the 100-question target.

## 4. The worksite

### 4.1 Phases of a line

One line goes up in five phases on a single clock, ~14s end to end. The clock is the
worksite's own and is **not** gated on game phase — this is a continuous worksite, and the
crew keeps working while the timer runs.

| Phase | What happens | Pose |
|---|---|---|
| `fetch` | A worker leaves the band and walks to the foot of the stack. | `stroll` |
| `haul` | He drags the line along the floor to the base. The line is drawn horizontal, in his hands. | `hefty` |
| `raise` | The line pivots from horizontal to its final angle. One worker heaves, a second steadies. | `heave` / `heave2` |
| `lash` | A climber ascends to the joint; the line settles the last few degrees. | `climb`, then `present` |
| `done` | The line is permanent. Its `Surface`s become claimable. | crew released |

For any line whose anchor is **above the ground** — everything after structure ① — `haul` and
`raise` are replaced by a **`hoist`** variant: the line goes up on a rope, a worker above
hauling (`heave`) and one below steadying (`offer`). This is the literal shape of what Chris
described — "climb up it, pulling up other lines that can be affixed to the tableau" — and it
is also what makes the upward rule legible rather than merely true.

### 4.2 The crew is cast from real residents

Two or three of the player's own bobits, claimed and released with **exactly the discipline
`assignPerch` already uses for a branch**: a `jobId` on the `Agent`, claimed when cast, held
for the duration, released only at `done`. The existing claim/release code is the model
because its failure mode is already understood — a branch released early gets two occupants.

New `Activity` values: `hauling`, `raising`, `lashing`. They join the existing
`wander | rank | moving | climbing | descending | perch`.

### 4.3 The poses already exist

This is a genuine finding and it materially reduces the work. `leremyRig.ts` already carries a
construction vocabulary, authored for a beam crew on another EV property:

- `carry` — *"beam coming through!"*
- `hefty` — *"Heavy haul"*, with a measured sag onto the weight-bearing leg
- `heave` / `heave2` — *"…annd, lift."*, a straight-back hinge and a squat variant
- `trudge` — *"why is this site SO long"*
- `rope` — hand-over-hand, body hitching up on each pull

**No new poses are required for the prototype.** One caveat, from `fieldGeometry.ts`: `rope`
is deliberately absent from `pelvisOffset`, because that figure hangs from his hands and has
no ground contact at all. Neither the standing (112) nor the seated (8) offset describes him.
A roped worker must be positioned explicitly by the build sequence, not by `groundY`.

### 4.4 Module shape

Three pure modules and one component, so that the testable surface is as large as this repo's
node-only `vitest` can reach:

| Module | Purity | Answers |
|---|---|---|
| `tableau/blueprint.ts` | pure data | what the 25 lines are, grouped, with anchors |
| `tableau/tableauProgress.ts` | pure | how many lines are built, from `peak` |
| `tableau/buildSequence.ts` | pure | given a line and `t`, where the line is and where its crew are |
| `tableau/TableauMargin.tsx` | component | one margin's canvas; mounted twice |

`TableauMargin` replaces `TreeMargin` and is used for both sides.

## 5. Canvases and the partition

### 5.1 Four canvases

| Canvas | Holds | Interactive | Mounted |
|---|---|---|---|
| Band (in flow, 96px) | the crowd | yes | always |
| Aerial overlay (fixed) | set-piece flight only | **no** | only while something flies |
| **Left margin** | the left stack, its crew and residents | yes | while the margin is wide enough |
| **Right margin** | the right stack, its crew and residents | yes | while the margin is wide enough |

### 5.2 The partition is the highest-risk change in this design

`HANDOFF-bobits.md` §3 is emphatic, and it is emphatic because of a real bug: an airborne
bobit was once painted on two canvases for an entire flight, arcing over the question card and
standing on the band at the same time, because one reader consulted a ref in the frame loop
and another consulted a prop. **A partition only holds if every side is answering the same
question.**

Today that question is `onTheTree(agent, surfaces)`. It must be generalised to exactly one
function:

```
canvasOf(agent, lists) -> 'band' | 'left' | 'right'
```

This covers the three *persistent* canvases only. The aerial overlay is partitioned separately
and unchanged, by the existing `allowAir` gate and `onOverlay` set — that partition is already
correct and already tested, and folding it in would mean reopening it for no gain.

Every reader calls it. No reader reimplements it. An agent whose perch or job surface appears
in **neither** margin list falls back to the band — scenery can disappear (a narrower
viewport, a different collection) and a bobit must not go with it. That fallback already
exists for the tree and its rationale carries over unchanged.

### 5.3 Per-frame quantities are callbacks

`figuresFor`, `propsFor`, `growFor` — never values. A number passed as a prop is frozen at the
last React render while the animation runs on rAF; this is how the tree's sprout once stalled
part-grown at whatever height React last caught. The worksite's clock makes this trap *more*
dangerous here, not less, because the worksite runs continuously rather than for three seconds.

### 5.4 Measurement

`GameScreen` already measures the right margin, and already does it correctly in ways that
were hard-won: content-box not border-box, callback refs rather than a mount-time effect (the component
early-returns the wager screen, so the measured nodes are torn out and put back mid-match),
and never publishing a zero-width rect. The left margin is measured the same way, from the
shell's content-box *left* edge to the column's left edge.

Narrowing the question column — which Chris offered — widens both margins for free and needs
no change here beyond the `maxWidth` clamp itself.

## 6. The results screen

`RecapCrowd` renders the tableau full-width: both stacks side by side, scaled to the recap
band's height, with the recap crowd celebrating in and on them. Available on **every**
viewport, including phones, which is the only place a phone player sees the tableau at all.

**Static.** The recap shows what is built; it does not run the worksite. The recap's governing
decision is that nothing on it reads the match result — the room celebrates whether you won or
lost — and a crew working through the celebration contradicts that. Surfaces are still live,
so celebrating bobits can be up on the structures.

## 7. The standing occlusion rule

Unchanged. Restated because this design doubles the amount of ink beside the card:

Bobits must never cover the question card or any of the four answer options. The relaxation of
2026-09-14 is bounded to four rules — transient only, reveal phase only, `pointer-events:
none`, set pieces only — and **this design does not widen it.** The tableau holds the rule by
geometry (§2.1), which is strictly stronger than holding it by convention, and both margin
canvases may therefore stay interactive.

The rope bridge of §2.4 is the one thing this design wanted and did not take.

## 8. Testing and verification

**Numeric verification is not visual verification.** Every defect in the bobit work that
mattered was found by screenshot with the unit tests green — a T-pose clap, heads clipped on
mobile, a tree shaped like a mushroom, three bobits floating in mid-air. This section is
written on that basis.

### 8.1 Pure tests (`vitest`, node-only)

- **Blueprint integrity** — exactly 25 lines in 6 structures; every line's anchor index is
  lower than its own; structures are contiguous in the sequence; sides alternate.
- **Bounds** — the tableau's whole ink box stays inside the rig at **every one of the 26
  states** (0 built through 25), both margins, so §2.1 is asserted rather than assumed.
- **Progress** — `linesBuilt` for peak 0, 3, 4, 99, 100, 400; clamps at 25; never negative.
- **Build sequence** — phase boundaries; the line's endpoints at `t=0` match the carried
  position and at `t=1` match the final blueprint position exactly. Asserting that the end of
  the animation equals the blueprint is what stops a line settling 3px off its own joint.
- **Surfaces** — only built lines emit them; ids are stable across rebuilds; a half-built
  structure emits nothing a bobit could stand on in mid-air.
- **Partition** — `canvasOf` is total and disjoint over a generated agent population.

**Assert consequences, not values.** Three of this feature's existing tests asserted the
implementation's own arithmetic back at it and each sat on a real defect.

### 8.2 Visual verification (new `scripts/bobit-tableau.mjs`)

- A contact sheet of **all 26 states**, both themes, at 1920 / 1440 / 1280. The point is to
  see whether step 9 of 25 looks deliberate, which no unit test can answer.
- A **build strip**: one `raise` and one `hoist` sampled at ten points, to catch a line that
  pivots from the wrong end or a crew that lets go early.
- A **real crossing**, driven the player's way through the mock, not via a synthetic replay —
  `__bobitScene` passes an id that never becomes a resident, so a tool built to find this class
  of bug can be structurally unable to show it.
- **One viewport per process.** `bobit-recap.mjs` was OOM-killed three times sharing a single
  Chromium across rows.

### 8.3 Mock support

`?mock=1&owned=N` already drives `peak`, so `&owned=40` already yields 10 lines. Add
`&tableau=N` to force a line count directly, for the contact sheets.

### 8.4 Performance

`CROWD_CAP` of 100 was a **measured** 60fps floor on a mid-tier phone. This design adds two
canvases and up to 25 line draws. `bobit-bench.mjs` must be re-run before merge, and the cap
re-derived rather than inherited.

## 9. Migration: the tree

The tree becomes structure ②: a trunk line and three branch lines, hauled up like everything
else.

- Its branch heights and `Surface` geometry are **ported verbatim**, so climbers behave
  identically and `marginTree.test.ts`'s intent survives.
- `MIN_TREE_MARGIN`, `treeScale` and the in-band fallback tree are retired with it. Narrow
  screens get the crowd cheer, per §1.
- **The one player who loses something:** at exactly 25% of a 100-question collection a player
  has a whole tree today and would have a finished cabin plus a part-built tree instead. Every
  player past ~32 bobits strictly gains. This is judged acceptable and is recorded here so it
  is not discovered as a surprise.
- This replaces the only part of the bobit system that is already screenshot-verified in
  production. **Re-earning that verification is part of the cost of this work**, not an
  optional extra, and §8.2's contact sheets are how it is re-earned.

## 10. Out of scope

- Per-collection tableaus. The blueprint is data; a second tableau is a second file, which is
  the whole reason it is authored as data.
- Server-side persistence of the high-water mark (ev-accounts work).
- In-match rendering on phones and narrow viewports.
- The rope bridge (§2.4).
- Emergent worksite behaviour — a worker who fumbles, a bystander who wanders over to watch.
  Deliberately deferred: the scripted sequences can borrow from it later, and unpredictability
  collides with screenshot verification, which is this codebase's primary defence.

## 11. Risks

| Risk | Mitigation |
|---|---|
| The partition (§5.2) — the most dangerous change here | One `canvasOf`, every reader; a totality/disjointness test over a generated population |
| Replacing verified shipped code (§9) | Port geometry verbatim; re-run the full contact sheets before merge |
| Four canvases at 100 bobits | Re-run `bobit-bench.mjs`; re-derive the cap, do not inherit it |
| A continuous clock makes the frozen-prop trap worse (§5.3) | Callbacks only; no per-frame value crosses a prop boundary |
| Step 9 of 25 looking like a pile of sticks | One structure at a time (§2.3) and a 26-state contact sheet that makes it visible |

## 12. Delivery

`frontend/` only. `backend/` in this repo is frozen and nothing here touches it.

The frontend static site auto-deploys from `master` and **there is no staging**, so merging is
a production deploy. Everything goes through a pull request; the admin bypass on `master`
exists and is not to be used. CI job names must not be renamed — the ruleset matches them by
name and a rename silently stops the required checks from reporting.

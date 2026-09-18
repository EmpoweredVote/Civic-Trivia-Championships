# The margin tree — design

> **Status: design, approved in conversation 2026-09-17. Not yet planned, not yet built.**
> Successor to `2026-09-12-bobit-living-room-design.md` and its two addenda. Read that spec's
> 2026-09-14 addendum (the occlusion decision) and 2026-09-15 addendum (tree height, milestone
> storage) first — this document overrides the second of those on height, and nothing else.

The shipped feature is described in `docs/superpowers/HANDOFF-bobits.md`. This design changes
one part of it: the size and the home of the 25% milestone tree.

## Why

Chris, 2026-09-17, against a production screenshot of Q5 on a 1920×1080 window: the tree reads
as *a tiny thing in the lower right that somebody is carrying*, where he expected something
much larger, filling the empty space at the side of the game space. He drew what he wanted over
the screenshot — a trunk from the band's floor line to near the top of the page, canopy at the
top, branches reaching left and stopping clear of the card.

He is reading it correctly, and it is not a tuning problem. Measured:

- The whole tree is **82px** tall: `TREE_TRUNK_H` 300 rig units, plus canopy to ~409 units, at
  the crowd's scale of 0.2.
- The band has **90px** of room above its floor line (96px tall, `GROUND_INSET` 6).

So the tree is already flush against its ceiling, and already hard against the right edge —
`treeX` insets it by 18px. A standing bobit is 48px, so the tree is 1.8 body heights. That is
the proportion of a potted sapling held beside somebody, which is exactly what it looks like.
The sketch is roughly **10×** the current height.

A tree that size cannot live in the band. It needs a second drawing surface, and that surface
is in the page margin, which is where the occlusion rules apply.

## Decisions taken

Three questions were put to Chris before this design; his answers are settled input, not
options to revisit.

1. **A climbing frame, not scenery.** Two to three branches, several occupants, and going up
   reads as a climb rather than a placement. The single-branch decision in the 2026-09-15
   addendum was forced by the 96px ceiling, not chosen on its merits, so it lapses with the
   constraint that caused it.
2. **A hard boundary at the card, with the tree scaled to the margin.** Nothing about the tree
   ever crosses the question column, at any viewport width. The alternative — letting the canopy
   rest over the card's top corner — was declined, so **bound 1 of the occlusion relaxation is
   NOT widened by this work.** See "Bound 1 becomes geometry", below.
3. **Fill the margin, as sketched.** Canopy near the top of the content box; trunk the full
   height of the margin. About 868px at 1920×1080, scaling down with the viewport.

## Non-goals

- **The 50 / 75 / 100% milestones.** Still out of scope. The left margin is the obvious home for
  a later one and this work must not spend it, but nothing here builds one.
- **Mobile.** A phone has no margin. The tree stays cut and `TREE_MILESTONE_MOBILE` still fires,
  exactly as today. No mobile code path changes.
- **The 25% threshold.** A bigger reward might deserve a later milestone; that was not asked for
  and is not decided here.
- **The high-water mark going server-side.** Still blocked on `ev-accounts` being another repo.
- **The recap crowd.** Chris asked for the results screen to show every bobit unlocked for the
  collection, all celebrating, so a match that ends on a lost final question still ends on a
  high note. That is a separate feature on a separate screen — `ResultsScreen` mounts no crowd
  at all today — and gets its own design document.

## 1. Where it lives, and how it is measured

A new `<TreeMargin>` canvas, absolutely positioned inside GameScreen's existing
`relative h-full flex flex-col` container — the same positioning context the band sits in.
`right: 0`, so it is flush with the **band's** right edge and not the viewport's: the band is
inset by that container's `px-4 sm:px-6`, which is the whole reason `overlayOffset` exists.
Its bottom edge is the band's floor line.

**The box is measured, never computed from the clamp.** GameScreen already renders the column
that governs the whole screen — and note that the HUD, the question card and the buttons all
share one `maxWidth: clamp(700px, 55vw, 1500px)`, `mx-auto` container, so there is exactly one
column to measure and the margin is clear from the top of the content box down to the band.
GameScreen puts a ref on it, observes it with a `ResizeObserver`, and passes
`marginBox: { width, height } | null` to `CollectionCrowd`.

```
marginBox.width  = containerRect.right - columnRect.right
marginBox.height = bandFloorY - contentTopY
```

…where `contentTopY` is the top of the padded content box of that `relative` container (inside
its `py-5 sm:py-6 md:py-8`) and `bandFloorY` is the band's floor line, both read from rects. At
1920×1080 that lands at roughly 432 × 868, which is the tree Chris drew.

Two reasons it is measured rather than derived:

- Recomputing `clamp(700px, 55vw, 1500px)` in JavaScript is the nominal-vs-measured trap that
  has already produced two bugs in this feature (`band.width` is a nominal 1000).
- The real margin is narrower than the arithmetic by the **scrollbar**, which is present in
  Chris's screenshot (the question area is `overflow-y-auto`) and which no clamp calculation
  knows about.

`CollectionCrowd` does not reach up into its parent's layout for this. GameScreen owns the
column, so GameScreen measures it; the seam runs one way only.

## 2. Scale, and the fallback

One pure function, `treeScale(marginBox)`, returning the smaller of two fits:

```
heightFit = marginBox.height / MARGIN_TREE_RIG_H
widthFit  = marginBox.width  / (MARGIN_TREE_HALF_W * 2)
scale     = min(heightFit, widthFit)
```

**These are new constants, not the existing ones re-valued.** `MARGIN_TREE_RIG_H = 1000` and
`MARGIN_TREE_HALF_W = 200` sit beside the in-band tree's `TREE_TRUNK_H` (300), `TREE_HALF_W`
(90) and `TREE_LEDGE_UP` (250), all of which keep their values untouched — the fallback path
draws through them and must not move. Concretely that means a second draw function,
`drawMarginTree`, rather than a re-authored `drawTree`.

At those values the fit is height-bound on wide screens (≈0.87 at 1920×1080) and becomes
width-bound as the viewport narrows. Either way the tree fills the space it has and never leaves
it.

Below `MIN_TREE_MARGIN = 140px` the function returns null and the room falls back to **today's
in-band tree, unchanged**. A 1024px viewport lands at ≈138px of margin, so that is the real
crossover. This means two tree renderers are maintained. That is a genuine cost, accepted
because the small one is already written, tested and in production — the cost is carrying it,
not building it.

The crowd's own `band.scale` stays 0.2. **Climbers are drawn at band scale on a tree-scale
canvas**, which `FieldFigure.scale` already supports per figure. The tree is therefore ~4.3×
the crowd's scale and a climber is a normal-sized bobit in a big tree, not a giant.

### Bound 1 becomes geometry

Today "nothing comes to rest over the card" is held by the band being in normal document flow.
The margin canvas keeps that property by **confinement**: because its box is derived from the
measured column edge, it cannot overlap the card, and a test can assert so directly rather than
asserting a convention. This is why the canvas may stay `interactive` — see §4.

## 3. The tree itself

`drawMarginTree` is authored against `MARGIN_TREE_RIG_H`: trunk to ~820 units, canopy above it
to 1000, **three branches at roughly 250 / 470 / 690 units, alternating sides** — lowest reaching
left toward the card, middle right, top left again, as sketched. `grow` keeps scaling height
only, so the sprout still works with no special case (a tree that also grew sideways read as a
balloon inflating). `drawTree` is left exactly as it is, for the fallback.

`marginTreeSurfaces` returns three `Surface`s, ordered lowest first, beside the existing
one-branch `treeSurfaces` which is unchanged. `assignPerch`
already takes `Surface[]`, claims the first unclaimed one, and refuses a second occupant per
branch — so **three branches need no change to its claiming logic**. It fills bottom-up, at
most one new climber per frame.

`assignPerch` does need one change: it currently walks the climber to the branch's **midpoint**,
which for a climb would send him up through open air beside the trunk. He must walk to the
branch's trunk-side end. `Surface` gains an optional `rootX`, defaulting to the midpoint when
absent, so the in-band fallback tree keeps today's behaviour with no edit.

The lowest branch reaches left, toward the card, so its tip is the closest any permanent
geometry comes to the column. That distance is asserted, not eyeballed — see §6.

## 4. Drawing surfaces, and the three-way partition

Three canvases, and every figure belongs to exactly one:

| Canvas | Holds | Interactive |
|---|---|---|
| Band (in flow, 96px) | the crowd | yes, as today |
| Aerial overlay (fixed, mounted only while something flies) | transient set-piece flight | no |
| Tree margin (absolute, mounted while the tree stands) | the tree, its climbers, its occupants | **yes** |

`crowdFigures` stops returning perched figures; a new `treeFigures` returns them. **All three
lists come from one pass per frame, taking the gate and state as arguments** rather than each
reading refs on its own. That is not a preference: the review found an airborne bobit drawn on
*both* canvases for the whole flight because the band read `allowAirRef` in the frame loop while
the render read the `aerialAllowed` prop. A partition only holds if every side is answering the
same question. `aerialFigures` was fixed by taking the gate; `treeFigures` takes it the same way
from the start.

The margin canvas may be `interactive`, so a bobit still **greets from his seat**. Verified
rather than assumed: `BobitField`'s document- and window-level listeners are all *cancel*
handlers — `mouseup`, `blur`, Escape, and a context-menu suppressor guarded by
`shouldSuppressContextMenu(gestureRef.current)` — each acting on its own field's refs, and the
60ms `armPoll` interval is a no-op without a pending touch on that field. Two interactive fields
on one page do not interfere. Collection bobits also set `poofable: false`, so the destructive
hold gesture is no more reachable in the tree than on the band.

## 5. The climb and the descent

Today the perch is a **teleport**. `agentsAdvance` flips to `activity: 'perch'` at walk
completion and `crowdFigures` sets `groundY: perch.y` on that frame. At 50px nobody notices; at
600px it is a bobit blinking into the canopy. The same happens in reverse after
`PERCH_DWELL_SEC`. This is a defect that exists in production and is merely small enough to get
away with.

`Activity` gains `climbing` and `descending`. The sequence becomes:

```
wander → moving (to rootX, at floor) → climbing → perch → descending → wander
```

`climbing` runs on a normalized `climbT` over a duration derived from the height rather than
fixed: `climbDurFor(dy)` at ~180px/s, giving roughly 1.2s, 2.3s and 3.3s for the three branches
at 1920px, and sane numbers on a 1280px tree from the same function. One pure function,
`climbProgress(t)`, splits the ascent — the first 75% climbs the trunk with x held at `rootX`,
the last 25% walks out to the branch midpoint at branch height. Descent is the same function
reversed.

**The pose is the rig's existing `climb`.** No new rig animation is needed. It is a spiderman
wall-climb — limbs spread wide and ratcheting up one at a time, right hand → left foot → left
hand → right foot, `headTilt` 16 so the eyes are on the next hold — and it is built from `REST`,
so it is standing, not seated. (Confirmed by reading its frame function. Choosing a pose by its
name is the mistake that cost `pool-drop` and `pool-peek`: `fall` is a seated sprawl and `peek`
looks *down*.)

Which makes this the place the four-times-recorded seated trap lives:

- `agentAnim` must return `climb` for both new activities, never `sit`.
- `crowdFigures` must not attach `hoverAnim: 'greetseat'` until `activity === 'perch'`. Today's
  condition already reads `a.activity === 'perch'`, so it excludes climbing correctly — but the
  same `perch` lookup also drives x and `groundY`, so climbing needs **its own position branch**
  rather than falling through to the floor.
- Never hardcode the pelvis offset; ask `pelvisOffset()`. Standing and seated are 104 units
  apart and `figureBounds` measures from the BASE anim while paint positions with the RESOLVED
  one.

`PERCH_DWELL_SEC` (26s) still ends the stay, but hands off to `descending` rather than dropping
him.

**Not asserted, to be screenshotted:** the `climb` frame ratchets limbs *upward* on a cycle, so
played unchanged on the way down it may read as climbing up while moving down. If it does, the
fix is a reversed clock, not a new pose — but that is a judgement to make from a contact sheet.

## 6. The ceremony at this size

`TREE_MILESTONE` needs no rewrite. Its two admirers walk to 0.72 and 0.34 of the band, `ponder`
(head tilted up), then `present` a beat apart — which was faintly odd aimed at an 82px sapling
and is right for this. `anchor: 'right'` stays correct, for the reason already in the scene's
comment: `canStage` packs from the left, so without it they present at an empty stretch of floor.

Two adjustments:

- `TREE_GROW_SEC = 2` is a 434px/s sprout at the new size. Take it to **3s** and confirm by
  screenshot.
- The scene assumes its cast ends up **under the trunk**, and that assumption is currently
  implicit — the trunk's x now lives in margin-canvas coordinates. Add an assertion that the
  admirers' band-space x falls under the mapped trunk position, rather than trusting that two
  right-anchored things coincide. ("A test that asserts a span says nothing about where the
  scene lands" — the milestone's own `span <= 0.25` test passed happily while the scene played
  at the opposite end of the band.)

## 7. Verification

### The suite

- `treeScale()` against a table of viewport widths, including both sides of the 140px crossover.
- **The bound-1 test.** Given measured container and column rects, assert the margin canvas's
  left edge is ≥ the column's right edge, *and* that the lowest branch's tip — the one reaching
  toward the card — is too, at every width in the table. This is the test that means the
  standing instruction was not widened, and it is the single most load-bearing test in the work.
- The three-way partition: one frame's pass, every agent on exactly one canvas.
- The climb as a **consequence, not arithmetic**: `groundY` moves monotonically from floor to
  branch and back, and no frame's delta exceeds a teleport threshold. Asserting
  `climbProgress`'s own numbers back at it is the failure mode that sat on top of three real
  defects in this feature already.
- Three surfaces → at most three climbers, never two on one branch.
- No seated anim while `climbing` or `descending`, extending the existing rule's test.

### The visual pass

Every defect that mattered in this feature was found by screenshot with the unit tests green.
So:

- A new `scripts/bobit-tree.mjs` contact sheet: 1920 / 1440 / 1280 / 1024 × light and dark,
  plus a climb sequence and the growth sprout. Both themes is not optional — the field passes a
  LIGHT body colour in dark mode and a DARK one in light, and the cannon's detail colour was
  invisible in dark mode for exactly this reason.
- **Drive the milestone for real.** `?mock=1` with an `owned` count that crosses 25% while
  watching. Never through `__bobitScene`: it passes a synthetic `replay-<ts>` id that never
  becomes a resident, so the newcomer renders as an orphan with no agent — a tool structurally
  unable to show a whole class of bug.

## 8. Files this touches

| File | Change |
|---|---|
| `features/game/components/GameScreen.tsx` | ref + `ResizeObserver` on the shared column; pass `marginBox` down |
| `features/collection/CollectionCrowd.tsx` | accept `marginBox`; mount `<TreeMargin>`; feed the three-way partition from one pass |
| `features/collection/treePlacement.ts` | `treeScale`, `MIN_TREE_MARGIN`, `TREE_GROW_SEC` → 3 |
| `components/bobbits/props.ts` | new `drawMarginTree` + `marginTreeSurfaces` (three branches, `rootX`); existing `drawTree` / `treeSurfaces` / constants untouched |
| `components/bobbits/fieldGeometry.ts` | `Surface.rootX?` |
| `features/collection/crowdAgents.ts` | `climbing` / `descending`, `climbDurFor`, `climbProgress`, `agentAnim`, `assignPerch` target |
| `features/collection/crowdFigures.ts` | drop perched figures; add `treeFigures` taking the gate |
| `scripts/bobit-tree.mjs` | new contact sheet |

Tests alongside each, per the list in §7.

## 9. Risks

- **The partition is the dangerous part**, for the same reason the aerial one was: three lists
  that must agree about one frame. Mitigated by one pass and a test that every agent lands on
  exactly one canvas, but it is where a subtle both-canvases bug would hide.
- **Two tree renderers.** The ≥140px and <140px paths can drift. Mitigated by the fallback being
  the already-shipped code, untouched.
- **A resize mid-climb** changes the tree's scale and therefore the branch's y. `surfacesRef` is
  already recomputed every frame for precisely this reason, and `rescaleTo` handles x — but a
  climber interpolating toward a y that moves under him wants a screenshot at a dragged window
  edge, not just a unit test.
- **The margin is empty for a reason** on some layouts. If the tree reads as heavy or as
  competing with the HUD, the lever is `MARGIN_TREE_RIG_H`, not a rebuild.

## 10. Open questions

- Whether the `climb` pose needs a reversed clock on the way down (§5). A contact sheet decides.
- Whether three branches is the right number or two reads better at 1280px, where the tree is
  width-bound and shorter. The rig constants make this a one-line change; it is a screenshot
  judgement, not a design one.
- Carried over, unrelated to this work and still open for Chris: whether the cannon should have
  a host at all, and whether the yield pause (0.45–1.1s) is too polite.

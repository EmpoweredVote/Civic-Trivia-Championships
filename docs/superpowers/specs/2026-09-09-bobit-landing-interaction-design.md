# Bobit landing-page interaction rework

**Date:** 2026-09-09
**Status:** Design approved in chat; awaiting spec review
**Scope:** `pages/Dashboard.tsx` and the four bobit scenes it mounts, plus one additive field on
`FieldFigure`.

## Why

Every bobit on the CTC landing page performs unprompted. The card greeter waves forever, the
bottom pair dance forever, and the reader hands out a different civic fact on every mouse-over.
Performance without provocation reads as decoration; performance *in response to you* reads as a
character noticing you. ev-landing already solved this for its book readers, and that solution is
the model here.

Four behavioural changes plus one geometry bug:

1. Nothing waves or dances until interacted with.
2. The bottom pair wander, dance on hover, and drop confetti on click.
3. The carried CTC logo should actually be held — right now it floats between two figures whose
   hands never touch it.
4. The reader mirrors ev-landing: hover lifts the head off the page, **click** opens the quote.
5. The quote is fixed for the session and changes on refresh, not on every hover.

## The interaction contract

| Bobit | At rest | Hover (desktop) | Click | Tap (touch) |
|---|---|---|---|---|
| Card greeter | Seated, hanging out | Waves | — | Waves |
| Bottom pair | Stroll / pause / look around | Dances | Confetti | Dances **and** confetti |
| Trophy carriers | Walk in carrying the logo | (unchanged) | Wave (unchanged) | Wave |
| Reader | Reading, turning pages | Head lifts, book stays in hand | Sits up, book to lap, quote bubble | Lifts head **and** opens the quote |

**The touch rule, stated once:** a tap is hover and click at the same instant. A tap that never
reaches `TOUCH_ARM_MS` (300ms, already the tap/hold-to-poof boundary in `pointerGestures.ts`)
delivers both a hover-enter and a click to the same figure.

## Architecture

### Wander needs no change to the shared renderer

`BobitField` already exposes the hook this needs:

```ts
figuresFor?: (t: number, dt: number) => FieldFigure[]   // BobitField.tsx:55
```

Its own comment describes the intent — it "keeps the choreography inside the existing rAF loop and
React out of the per-frame path entirely." `CollectionCrowd.tsx:118` already drives itself this way
with `figures={[]}`.

So wander lives in `BobbitScene`, driven through `figuresFor` and backed by a new pure
`wanderReducer.ts` sitting alongside `greetReducer` / `fleeReducer` / `poofReducer` /
`bubbleReducer`. This matches the established house pattern — a pure state machine plus a thin
translator, each with a test in `__tests__/` — and keeps `CollectionCrowd` entirely out of the
blast radius.

**Amended 2026-09-09 during planning.** `figuresFor` as it stands is not quite sufficient, and
this design originally overstated the case by claiming `hoverAnim` was the only shared change.
Two facts surfaced while writing the plan:

- Hovering must **stop** the walk (ev-figures.js gates its own walker the same way:
  `if (!e.greet) av.x += …`). But `figuresFor` receives no hover information, so a wander that
  owns positions cannot know to hold still.
- Clamping to the rail requires the field's measured width, which `figuresFor` also does not
  receive.

So `figuresFor` gains two **appended optional positional** parameters —
`(t, dt, width, greeting)` — plus a small `greetingIds(state)` helper on `greetReducer`.
Appending positionally rather than switching to an options object is deliberate:
`CollectionCrowd`'s existing `(t, dt) => …` arrow stays assignable to the wider signature, so
that file still needs no edit and the "untouched" property is preserved. The shared surface
therefore grows by one optional field and two optional parameters, not by one field alone.

One consequence worth recording: `figuresFor` is called at the top of the frame, *before* hover
is resolved for that frame, so the greeting set it receives is the **previous** frame's — about
16ms of latency on stopping a hovered walker. That ordering is not a defect to fix; hover
resolution needs positions, and positions would then need hover.

### The one additive interface change

`BobitField` currently hardcodes what a hovered figure plays:

```ts
const animKey = greeting
  ? (ALL_ANIMATIONS[f.anim]?.seated ? 'greetseat' : 'greet')
  : f.anim;                                              // BobitField.tsx:146-148
```

The dancers need hover to mean *dance*, not *greet*. Add one optional field to `FieldFigure`:

```ts
/** What this figure plays while hovered. Defaults to greet/greetseat by seatedness. */
hoverAnim?: string;
```

and consult it in that expression. Every existing caller omits it and is unaffected.

**Rejected:** generalising this into a behaviour/plugin system on the field. That is YAGNI for two
behaviours and would turn the crowd renderer into a framework — precisely what
`BobbitCivicFactSitter`'s header comment warns against.

## The five changes

### 1. Card greeter — one line

`BobbitCardGreeter.tsx:30` sets `anim: 'greetseat'`, which *is* the wave; that is why it never
stops. Change it to `'sit'` (`leremyRig.ts:969`, label "Hanging out", `seated: true`).

The existing greet path then does the rest: a hovered figure whose anim is seated already maps to
`greetseat`. Idle becomes a bobit sitting on the card edge hanging out; hover makes it wave; the
1.6s `GREET_LINGER` lets the wave finish its arc rather than snapping off when the cursor leaves.

No new code.

### 2. Bottom pair — wander, dance, confetti

**New file `wanderReducer.ts`.** Per-figure state:

```ts
interface WanderFigure {
  x: number;        // px in field space
  dir: 1 | -1;
  phase: 'walk' | 'pause';
  t: number;        // seconds in the current phase
  next: number;     // seconds the current phase lasts
}
```

Cycle: walk for a randomised interval, pause, then resume in a direction chosen fresh. During
`walk` the figure plays `stroll` (`leremyRig.ts:837`, speed 2.0, "just moseying…"); during `pause`
it plays `standstill` (`leremyRig.ts:1077`, "Standing by") — the look-around beat.

Constraints the reducer owns:

- **Clamp to the measured rail width.** `x` is bounded to the field's width less each figure's
  half-bounds, so a wanderer can never leave the rail. On hitting a bound it turns rather than
  stopping, so it never appears stuck against an invisible wall.
- **No bunching.** A minimum separation is enforced between wanderers; a figure whose next step
  would close inside it turns instead. This keeps the pair reading as two characters rather than
  one clump on the footer edge.
- **Deterministic under test.** The reducer takes its randomness through an injected `rand: () =>
  number` so phase durations and direction choices are seedable, following `fleeReducer`'s shape.

`BobbitScene` keeps its `CAST` for colour/phase, drops the hardcoded `anim: 'dance'`, holds
wander state in a ref, and advances it inside `figuresFor(t, dt)`. Each emitted figure carries
`hoverAnim: 'dance'`.

`onFigureClick` → `fireTopRain()` already works (`BobbitScene.tsx:63`) and is untouched. Note that
hover already freezes the figure's own clock and runs the greet clock from 0, so a hovered figure
starts its dance from the top of the animation rather than mid-phrase — correct here, and free.

### 3. Trophy hands

**The bug.** `BobbitTrophyCarry.tsx:170` computes

```ts
const trophyX = (leadX + rearX) / 2;
```

— the midpoint of the two carriers' *ground-contact points*. Vertically the prop already tracks the
real hand joints (`(rearHandY + leadHandY) / 2`, lines 174-179), which is why it looks nearly right.
But the two carriers stand `gap = 150 * scale` apart (line 73, sized "for the enlarged trophy" by
eye) while the prop's widest element — the pedestal in `drawTrophy` — spans only `±12.5 * s` at
`TROPHY_SIZE_MULT = 2`, i.e. `50 * scale` total. The figures stand three trophy-widths apart, so
the logo hangs centred between them touching nothing.

The `carry` pose compounds it: `leremyRig.ts:844-849` pins `armRU = 16, armRF = 6, armLU = -16,
armLF = -6` — near-symmetric arms hanging close to the body. That pose was written for ev-landing's
beam crew, hauling a slab wider than four figures, where hands sit *under* a load rather than
gripping its edges. Reused for a small trophy, the hands have nothing to reach for.

**The fix.** Reach the inner arms inward so the hands land on the pedestal's corners, and derive
`trophyX` from the actual hand joints the same way `trophyY` already does.

Measured feasible before proposing it:

| Quantity | Value |
|---|---|
| Arm reach (`upperArm 42 + foreArm 40`) | 82 units |
| Inner shoulder x (figure at −75, `shoulderHalf 5`) | −70 |
| Pedestal edge x (`12.5 × 2`) | −25 |
| Horizontal reach required | **45 of 82 available** (≈33° off vertical) |

So the hands can grip the logo without moving the figures apart or resizing brand art. A
`carryGrip` variant of the carry gait supplies the inward arm angles; the walk cycle's bob and
hunch continue to sway the hands, and the trophy rides them, so contact is maintained in motion
rather than only in the reference frame.

**`carryGrip` goes in `rigExtras.ts`, not `leremyRig.ts`.** `leremyRig.ts` is a faithful TS mirror
of ev-landing's `leremy-rig.js`; CTC's own additions live in `rigExtras.ts` (which is where `dance`,
`cheer`, `offer`, `ponder` and `drawTrophy` already sit) specifically so re-syncing the rig from
ev-landing stays a clean overwrite. Adding a pose to `leremyRig.ts` would silently break that
property. `CARRY_REF_JOINTS` in `BobbitTrophyCarry.tsx:16` is recomputed from the new variant.

Because `drawTrophy` translates to `(x, y)` and draws its pedestal from `-4.4 * s` up to `0`, the
prop's base sits exactly at hand height already — so hands brought to `±25` meet the pedestal's
bottom corners without further vertical work.

**Verification is measured, not eyeballed:** assert computed hand-joint positions coincide with the
drawn pedestal corners within a small tolerance, across several frames of the gait. The bobit
notes are emphatic that geometry intuitions here have been wrong three times running.

### 4. Reader — click to speak

Mirror ev-landing's `drawReader` state machine (`ev-figures.js:3502-3560`) and its documented
contract (`ev-figures.js:3128-3134`):

```
read ──hover──▶ glance (0.35s ramp, reversible)
read ──click──▶ lookup (0.5s) ──▶ hold (bubble open)
hold ──click──▶ resume (0.5s) ──▶ read
```

Constants carry over: `QUOTE_TRANS = 0.5`, `QUOTE_GLANCE = 0.35`.

- **`read`** — the rig's own `read` pose, which turns pages on its own.
- **hover during `read`** — ramps `qGlance` 0→1 over `QUOTE_GLANCE` and lerps toward a glance pose:
  head lifted off the page, still leaning in, **book still in hand**. Reverses on leave. This is
  the change of feel: hover is now acknowledgement, not the payload.
- **click** — `lookup` lerps `read` → hold pose over `QUOTE_TRANS`, then the bubble opens. The hold
  pose sits up, drops the book into the lap (arms forward so the hand midpoint lands over the
  thighs) and looks up and out.
- **click again** — `resume` lerps back and closes the bubble.
- **Dismissal** — click-off and `Escape` both close the bubble and return the reader to `read`,
  matching ev-landing's `dismissBubbles`.
- **The figure does not turn.** ev-landing pins `flip` as cast so the reader is never spun to face
  away from what it is sitting on. Same here.

The existing accessibility contract is preserved and extended: the canvas stays `tabIndex={0}`
with `role="img"`, `aria-label` and `aria-describedby`. Keyboard parity follows the new model —
focus performs the glance, `Enter`/`Space` performs the click, so the quote is reachable without a
pointer. The `aria-label` is reworded, since "reveals a civic fact" will no longer describe what
hovering does.

The component keeps its own canvas. Its header comment already argues this at length — it is a
labelled focusable control driving bespoke choreography, not a member of a decorative crowd — and
this change makes that more true, not less.

### 5. Quote fixed per session

ev-landing's `deal()` shuffles the pool once per page load and gives each reader one distinct quote
(`ev-quotes.js:204-208`). Match it:

- Pick the fact once per page load rather than per component mount, so the quote survives a React
  remount within the session and only changes on refresh.
- Delete the `setFactIndex` advance in `setHover(false)` (`BobbitCivicFactSitter.tsx:151-155`) —
  that call is the "new quote per mouseover" behaviour.

The existing comment about committing the fact *before* the reveal starts still applies and gets
easier: with a per-session pick there is no mid-interaction mutation for a screen reader to race.

## Touch

`onClick` is a `MouseEvent` handler, and browsers synthesise a click after `touchend`, so **click
already works on touch today**. Hover does not: `pointerRef` is only ever written by `onMove`
(mousemove), which touch never fires. That asymmetry is the whole gap.

The fix is confined to `BobitField`'s touch handlers, which today feed only `gestureReduce` for the
poof hold: on a tap that resolves as a tap rather than a hold, also publish the touch point as the
pointer position, so the greet reducer sees a hover-enter for that figure. The hover then decays
through the existing `GREET_LINGER`, so a tapped dancer dances for a beat and settles — no new
timing model.

The reader, which owns its own canvas, gets the same rule locally: a tap runs the glance and the
click transition together, so one tap goes from reading to speaking.

## Open item: the reader on mobile

`BobbitCivicFactSitter` currently returns `null` below 640px, deliberately — "hover has no
equivalent there" (`BobbitCivicFactSitter.tsx:160`). The touch rule removes that reason, so it
should now render on phones. But its position is desktop-tuned and will not survive the move as-is:

- It is absolutely positioned `top: -seatFromTop, right: 340` inside the search-box container
  (`CollectionPicker.tsx:190`). On a 375px viewport the search box is roughly 330px wide, so
  `right: 340` places the sitter off the left edge entirely.
- Its bubble is `width: 200` with `maxWidth: 60vw`, centred on the sitter via
  `translate(-50%, …)`. Near a narrow viewport's edge that overflows.

Specified resolution:

- **Mobile anchor `right: 16`** — the sitter perches on the search box's top-right corner, clear of
  the search icon (left) and the placeholder text's start.
- **Bubble alignment becomes edge-aware on mobile:** right-anchored rather than centre-anchored, so
  it opens inward and stays on screen.

This is the one item in the batch that could grow, and it is layout work rather than a flag flip.
If it proves fussier than the above, mobile rendering for the reader is the piece to defer — the
other four changes do not depend on it.

## Testing

Following the `__tests__/` precedent, where every reducer has a companion test:

- **`wanderReducer.test.ts`** — phase transitions on timer expiry; direction flip at both rail
  bounds; `x` never escapes the clamp; minimum separation never violated; determinism under a
  seeded `rand`.
- **Reader state machine** — the full `read → glance → lookup → hold → resume → read` path;
  click during a transition is ignored (ev-landing returns early for exactly this); dismissal by
  click-off and by `Escape` both restore `read`.
- **Quote stability** — the fact does not change across hover/click cycles or a remount within one
  session.
- **Trophy contact** — computed hand joints coincide with the drawn pedestal corners within
  tolerance, sampled across gait frames.
- **`hoverAnim` default** — a figure without `hoverAnim` still resolves to `greet`/`greetseat` by
  seatedness, so `CollectionCrowd` behaviour is provably unchanged.

Manual verification runs through `npm run smoke` in `frontend/`, per the standing rule that a green
build is not a page load.

## Out of scope

- `CollectionCrowd`, the crowd cap, and per-question bobit progress — untouched.
- The game screen. Nothing here goes near it, and the standing constraint holds regardless: bobits
  must never cover the question card or any of the four answer options. The wander gives the bottom
  pair a moving `x` for the first time, which is why clamping to the measured rail is part of the
  reducer's contract rather than a caller's responsibility.
- Any refactor of `BobitField`'s render path.
- The trophy carriers' own hover/click behaviour, which already works.

## Verified facts this design rests on

Measured or read on 2026-09-09, not recalled:

- `figuresFor` exists with signature `(t, dt) => FieldFigure[]` — `BobitField.tsx:55`.
- Hover anim is hardcoded at `BobitField.tsx:146-148`.
- Touch handlers never write `pointerRef`; `onMove` is mousemove-only — `BobitField.tsx:396-420`.
- `TOUCH_ARM_MS = 300`, `HOLD_SLOP = 12` — `pointerGestures.ts:17,20`.
- `GREET_LINGER = 1.6` — `greetReducer.ts:10`.
- `sit` is seated, label "Hanging out" — `leremyRig.ts:969`.
- `stroll` speed 2.0; `standstill` label "Standing by" — `leremyRig.ts:837,1077`.
- `carry` pins `armRU 16 / armRF 6 / armLU -16 / armLF -6` — `leremyRig.ts:844-849`.
- `CFG.upperArm = 42`, `CFG.foreArm = 40`, `CFG.shoulderHalf = 5` — `leremyRig.ts:53,54,58`.
- Trophy pedestal half-width `12.5 * s`; `TROPHY_SIZE_MULT = 2`; `gap = 150 * scale` —
  `rigExtras.ts:144`, `BobbitTrophyCarry.tsx:20,73`.
- ev-landing reader contract and state machine — `ev-figures.js:3128-3134, 3502-3560`.
- ev-landing deals quotes once per load — `ev-quotes.js:204-208`.

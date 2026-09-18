# The recap crowd — design

> **Status: design, approved in conversation 2026-09-18. Not yet planned, not yet built.**
> Sibling to `2026-09-17-bobit-margin-tree-design.md`, and independent of it: this branches from
> `master` and touches no file the margin tree rewrote. The shipped bobit feature is described in
> `docs/superpowers/HANDOFF-bobits.md`.

## Why

Chris, 2026-09-18:

> On the game recap page, I'd expect to see all of the folks unlocked for that collection on
> display and celebrating happily. So even if you lose the last question and everyone is a
> little bummed, the experience ends on a high note, with everyone celebrating and cheering on
> the post game screen, on the bottom.

`ResultsScreen` mounts no crowd at all today — the room the player has been building all match
simply disappears at the moment it would mean the most. And the last thing the band does before
it vanishes is react to the final answer, so a lost wager leaves the player looking at a room
that is visibly disappointed in him.

## Decisions taken

Four questions were put to Chris before this design. His answers are settled input.

1. **Two tiers, by pose.** *"New bobits from that session should bow, repeatedly. Everyone else
   cheers and celebrates, occasional jumps, but those should be rare. High Fives are also
   great."* So the session's new arrivals are the cast taking a bow and the rest are the
   audience.
2. **The cap stays.** `CROWD_CAP` is 100 with a `+N more` label past it, exactly as on the play
   screen — one cap in the codebase, one measured performance ceiling, no new unknown.
3. **Bottom of the recap, in flow.** Not fixed to the viewport. Chris added: *"let's try to
   avoid scrolls until they expand the questions"* — so the collapsed recap fitting one
   viewport is a REQUIREMENT of this work, and a measured one (see §6).
4. **One line, and the density is accepted.** Asked whether 100 bobits should stack into rows
   for legibility — they sit ~18.7px apart on a 1870px band while a cheering figure is ~20px
   wide — Chris said: *"I know it will be dense, eventually we'll build buildings as stuff for
   them to climb on."* So the band stays the same 96px single line the play screen uses.

### A consequence of decision 4, recorded so it is not re-litigated

`slotPosition` and `rowsFor` in `crowdLayout.ts` are **dead code** — no callers outside their
own tests. They are the last of the removed depth era, and they do exactly the multi-row layout
that would relieve crowding. **Do not revive them for this.** Vertical structures with
`Surface`s are the intended answer to a full room, the way the 25% tree already is —
`fieldGeometry`'s own comment on `Surface` says the seam exists "so the later unlockable
platforms, toys and buildings can be added".

## Non-goals

- **Anything on the play screen.** `CollectionCrowd` gains exactly one optional callback and
  nothing else. It is live in production and was just heavily rewritten for the margin tree.
- **A tree, a scene director, entrances, or the aerial overlay** on the recap. None of them
  belong on a screen with no match running.
- **Wandering.** The recap crowd stands still and celebrates; the celebration is the motion.
- **Reviving multi-row layout.** See above.
- **Restyling the recap to make room.** If the no-scroll requirement does not hold, that is
  reported, not silently fixed by shrinking Chris's score panel.

## 1. What `RecapCrowd` is

A new component, `frontend/src/features/collection/RecapCrowd.tsx`, mounted at the bottom of
`ResultsScreen` between the two-panel row and the modals, full-bleed the way the play band is.

**Why a new component rather than a mode on `CollectionCrowd`.** The recap needs almost none of
what that component does: no scene director, no entrances, no aerial overlay, no tree, no
milestone latch, no `lastAnswer` reactions, no agents, no wandering. A `mode` flag would leave
five props (`lastAnswer`, `aerialAllowed`, `finished5of5`, `questionCount`, `marginBox`) dead in
the new mode, threaded through a ~600-line file that is live in production. What the recap
actually needs is: read the owned ids, place them, pick celebratory poses, draw.

It is not a fork, though — every derivation that decides what a bobit *looks like* is imported
from the shared modules, so a bobit is recognisably himself on both screens:

| What | From | Why it must be shared |
|---|---|---|
| Colour | `figColor(toneOf(id), darkMode)` | a bobit who changed colour between screens would read as a different bobit |
| Height | `heightFactor(id)` | same |
| Animation phase | `(hashId(id) % 1000) / 250` | so neighbours never breathe in lockstep, on either screen |
| Band size | `bandFor(isMobile)` | 96px desktop / 72px mobile, scale 0.2 |
| Floor line | `groundLineFromBottom()` | the floor and the feet cannot drift apart |
| Cap and overflow | `CROWD_CAP`, `overflowCount` | one cap, one measured ceiling |

Positions are **static**: index across the measured width with the same half-step inset
`homeSlot` uses, so nobody stands flush against an edge. There is no `AgentState` here at all.

The `+N more` label sits bottom-left, matching the play band. (On the play band that position is
because the tree's trunk occupies bottom-right; here there is no tree, but consistency is worth
more than the free space.)

`ResultsScreen` gains two props from `Game.tsx`: `collectionSlug` and `newBobitIds`.

## 2. Who bows

`CollectionCrowd` gains one optional callback:

```ts
onBobitEarned?: (questionId: string) => void;
```

fired from the existing `lastAnswer` effect at the exact point that already computes
`const known = stateRef.current.residents.includes(questionId)` — the same branch that decides
whether a newcomer gets an entrance.

**Why a callback and not a snapshot.** The obvious alternative is for `Game.tsx` to snapshot the
owned set from the progress store when a match starts and diff it at the recap. That is worse
for two reasons: for signed-in players `load()` is only true after `hydrate()` resolves, so the
snapshot races the crowd's own seeding; and it creates a second opinion about who is new. Using
the existing decision means "got an entrance" and "bows at the recap" are the same judgement and
cannot disagree.

`Game.tsx` accumulates the ids into a `Set` for the current session and **clears it whenever
`state.sessionId` changes**, so a second match never inherits the first's bowers.

The set is 0–5 by construction: five questions, and a question answered correctly in an earlier
match grants nobody. A perfect run on a fresh collection bows five; a replay of familiar
questions bows none and the recap is all audience — which is correct, not a shortfall, and is
one of the cases the contact sheet in §6 must show.

## 3. The poses

A new pure module, `frontend/src/features/collection/recapPoses.ts`. One exported function, no
state, no clock of its own:

```ts
export function recapPose(
  id: string, elapsed: number, isNew: boolean, paired: 'R' | 'L' | null,
): { anim: string; hand?: 'R' | 'L' }
```

Every bobit gets a stable per-id phase offset derived from `hashId`, the same idea
`reactionOffset` uses with `REACTION_SPREAD`. This is not decoration: without it every bobit
changed pose on the same frame and the room read as choreography rather than as a crowd, which
is a lesson the celebration chain already paid for once.

- **`isNew`** → `bow`, on a loop with a genuine pause between bows, so it reads as repeated
  bowing rather than a bobbing idle. See §4 for the cycle.
- **Everyone else** → a weighted cycle on that bobit's own period:
  - mostly `cheer` and `clap`,
  - `highfive` whenever `pairUp` has given him a partner — `hand` is `R` for the left-hand
    partner and `L` for the right, because two of the same hand miss each other entirely,
  - `jump` on a rare window. Chris asked for rare: roughly one bobit in eight, one cycle in
    four, which at 40 bobits is a jump somewhere in the room every couple of seconds rather
    than a wave of them.

`pairUp(agents, maxGap)` already exists in `crowdReactions` and is already used by
`crowdFigures`. It takes plain `{ id, x }` objects, NOT `AgentState`, so it composes with
this component's static placement without dragging the agent system in behind it. It walks ids in sorted order so pairs are identical frame to frame and partners
never flicker between each other, and it returns each pair LEFT FIRST. Pairs are recomputed
every frame from positions, which is cheap and, here, trivially stable because positions never
move.

## 4. The bow

A new entry in `rigExtras`, beside `cheer` / `clap` / `highfive` / `dance`.

**It is derived from `spent`, not invented.** `spent` ("doubled over, hands braced on the
thighs") is the rig's proven deep forward fold and it answers the two questions that would
otherwise be guesswork:

```ts
p.hunch = -(44 + br * 3);   // deep forward fold
p.headTilt = -8 + br * 2;   // head hanging
p.armRU = 58; p.armRF = 26; // "arms straight down"
p.armLU = 46; p.armLF = 18;
```

The bow takes that skeleton, **straightens the knees** (`spent` buckles them; a bow does not),
and animates the fold rather than holding it: down over ~0.5s, hold ~0.4s, rise over ~0.5s,
stand ~1.2s, repeat.

Three constraints, each one a scar this feature already carries:

- **Negative `hunch` is FORWARD.** The rig says so outright — `leremyRig.ts:836`, "lateral
  walks, pitched FORWARD (negative hunch = toward travel)" — and `read` uses `+22` for
  "reclined back into the chair". Get the sign wrong and he bends backwards over an invisible
  chair, which will look deliberate enough to survive a code read.
- **`armRU`/`armRF` are absolute from the body, 0° is straight DOWN, and `armRF` is NOT an
  elbow bend.** Misreading it as one has produced a T-pose three times. Note that arm angles
  hang from the already-curled torso (`ub = lean + hunch` in `computePose`), which is why
  `spent` needs `armRU = 58` to hang *straight down* at a −44 fold. Do not re-derive this;
  `spent` measured it.
- **`bow` is a STANDING pose.** It must never be given to a seated figure, used as a
  `hoverAnim` on a seated base, or played on a beat that leaves the ground. The standing and
  seated pelvis offsets are 104 units apart and `figureBounds` measures from the BASE anim.

It gets a row in the existing `scripts/bobit-props.mjs` sheet run and its own pose frames in the
contact sheet. A pose that has never been screenshotted is a pose nobody has seen.

## 5. Where it mounts

`ResultsScreen` today is: `<Header />`, then one flex row holding the left score panel
(`md:w-[clamp(320px,24vw,420px)]`) beside the right question accordion, then the modals. The
crowd goes **between that row and the modals** — the last thing in the page's reading order,
which is what "on the bottom" means and what closes the experience.

`Game.tsx` already holds `state.collectionSlug` (it feeds `useCollectionQuestionCount`) and
renders `ResultsScreen`, so both new props are a one-line addition at an existing call site.

Mobile is unchanged in kind: `bandFor(true)` gives 72px, and the panels already stack.

## 6. Verification

### The suite

`vitest` here is `environment: 'node'` by design — no DOM, no canvas — so everything asserted is
a pure function, and `recapPoses.ts` is written to be exactly that.

- `recapPose` returns `bow` for a new bobit at every sampled time, and NEVER returns `bow` for
  anyone else.
- It returns `highfive` only when given a partner, and never with a missing `hand`.
- `jump` is asserted as a **rate** — sampled across many ids over a long window and checked to
  fall in a band — not as a magic value at one instant. The rate is the consequence; the
  arithmetic is not.
- Phase offsets spread the room: no more than a small fraction of a synthetic roster shares a
  pose on any single sampled frame.
- `overflowCount` drives the `+N more` count, so the cap cannot drift from the play screen's.
- `onBobitEarned` fires once per genuinely new bobit and never for a repeat correct answer,
  driven through `CollectionCrowd`'s existing reducer path.

### The visual pass

Every defect that mattered in this feature was found by screenshot with the suite green. A new
`scripts/bobit-recap.mjs`:

- The recap band at 1920 / 1440 / 1280 / 390, both themes, with rosters of **5, 40 and 100**.
  100 is the case Chris has already said will be dense; the sheet is how we confirm we both
  mean the same thing by acceptable.
- **0, 1 and 5 bowers**, since a replay of familiar questions legitimately produces none.
- Both themes is not optional: the field passes a LIGHT body colour in dark mode and a DARK one
  in light, and the cannon shipped invisible in dark mode for exactly this reason.

### The measurement

Document height versus viewport height on the **collapsed** recap, at each width, reported as a
number. That turns "let's try to avoid scrolls until they expand the questions" from a hope into
a fact.

If it does not hold, the finding is reported and the decision is Chris's. This spec does not
authorise restyling the recap to make the band fit.

## 7. Files this touches

| File | Change |
|---|---|
| `features/collection/RecapCrowd.tsx` | new — the band, static placement, `+N more` |
| `features/collection/recapPoses.ts` | new — `recapPose`, pure |
| `components/bobbits/rigExtras.ts` | new `bow` animation, derived from `spent` |
| `features/collection/CollectionCrowd.tsx` | one optional `onBobitEarned` callback |
| `features/game/components/ResultsScreen.tsx` | two props; mount the crowd below the panels |
| `pages/Game.tsx` | accumulate new ids per session; pass slug + set |
| `scripts/bobit-recap.mjs` | new — contact sheets and the scroll measurement |

Tests alongside each, per §6.

## 8. Risks

- **The bow is the only real unknown.** Everything else composes existing, screenshotted parts.
  Deriving it from `spent` removes most of the risk; what remains is whether a 48px figure
  folding forward reads as a bow at all, which only a contact sheet answers.
- **100 celebrating figures is a heavier scene than 100 wandering ones** — every figure is
  posed every frame, where the play band's paint was already measured as flat across cast size
  (~3.4ms at `CROWD_CAP`). Expected to be fine, since paint dominates and the figure count is
  unchanged; worth a glance at the bench rather than an assumption.
- **The no-scroll requirement may already be false today**, before this work adds anything. §6
  measures it rather than assuming either way.
- **`Game.tsx` accumulating session state** is a new responsibility for a component that mostly
  routes. Kept to a `Set` and a `sessionId` reset, with the *decision* about newness staying in
  `CollectionCrowd` where it already lives.

## 9. Open questions

- Whether the audience should ever fall quiet and start again, or celebrate continuously for as
  long as the recap is open. Continuous is specified here because it is simpler and because the
  player controls how long they look; if it reads as manic on the contact sheet, a lull is a
  small change to `recapPose`.
- Whether a lost final question should change anything at all about the recap crowd. Chris's
  framing says explicitly that it should not — the point is that the room celebrates regardless
  — so nothing here reads the result. Recorded because it is a deliberate omission, not an
  oversight.
- Carried over from the margin tree, unrelated to this work: whether the cannon should have a
  host at all, whether the yield pause (0.45–1.1s) is too polite, and whether the tree's
  `climb` pose needs a reversed clock on the way down.

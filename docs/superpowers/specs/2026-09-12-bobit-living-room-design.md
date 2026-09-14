# The Bobit living room

**Date:** 2026-09-12
**Status:** Design approved in chat; awaiting spec review
**Scope:** `features/collection/` (the crowd), `components/bobbits/` (field, rig extras, new
reducers and scenes), and the band's height allocation in `GameScreen.tsx`.
**Supersedes:** the fixed-slot crowd described in `2026-09-04-bobit-collection-design.md`.
That spec's identity rules, cap and loss sequence survive; its positioning model does not.

## Why

The crowd works and it does not live. `crowdLayout.ts` pins every bobit to a slot index and
`crowdFigures.ts` swaps its pose in place, so a row of earned bobits reads as tally marks —
check marks standing shoulder to shoulder. The slots were a deliberate choice (a bobit must
never move house when a newcomer arrives), and the cost was motion.

The reward for knowing your city should be a room you want to look at. This spec replaces
positioning with a simulation, and arrival with choreography: bobits wander, perch, greet you
when clicked, celebrate wins, shrug off misses, and show up in ways worth earning.

## What is being kept

Not a rewrite. These hold, unchanged:

- **`CROWD_CAP = 100`**, a measured number (Stage 2: 105 was the 60fps ceiling on a mid-tier
  phone; CPU throttling flatters mobile because it slows JS and leaves the GPU alone).
- **The abduction.** A miss on a question you owned still lifts that bobit, bursts him, freezes
  the room and revokes him from storage.
- **Bobits never occlude the question card or any answer option.** The band stays in normal
  document flow. Answers may shrink; they may not be covered. (Chris, 2026-09-05.)
- **`poofable: false` in the crowd.** A poof means "you got this wrong" and is never something
  a player can do on purpose.
- **Per-bobit identity from `hashId`** — tone and flip stay stable for a given question id.
- **The pure-reducer house pattern**: state machine + thin translator + `__tests__/`, driven
  from `BobitField`'s `figuresFor` so React never enters the per-frame path.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Fixed stage with graceful densification | A band deep enough for 100 wanderers would occlude the game. Below the cast size they wander; above it they stand in ranks. |
| D2 | Concurrent set pieces, not a queue | A queue drifts out of sync with the match — you would watch Q2's arrival during Q4. Overlap costs floor arbitration, which is designable. |
| D3 | Set pieces at arrival #1, #2, and the building milestones | Spectacle spent where it means something. Ordinary arrivals draw from a funny short pool. |
| D4 | Keep the abduction; add a reaction for costless misses | Two distinct weights of wrong. Today a miss on an unowned question does literally nothing. |
| D5 | Desktop buys depth, mobile buys size | Desktop has width to spare and needs floor. At 25px tall nothing on a phone reads. |
| D6 | Mobile runs a reduced room | A phone has no horizontal room for a cannon arc and a tree. |
| D7 | First building is a climbable tree on the right border | A concrete `Surface` consumer, and vertical perches give an arriving bobit somewhere to go. |
| D8 | Agents + Director architecture | Splits autonomous behaviour from scripted choreography from floor arbitration — three concerns with different testing needs. |

**The ordinal is per collection, for the lifetime of the player's progress** — not per session.
It comes free from the data: `residents.length` at the moment of the grant, over a store that
already persists per collection. Consequences worth stating:

- A returning player's owned bobits are **seeded silently** on mount. Forty owned questions must
  not produce forty cannon shots on page load.
- So the swirl and the cannon fire **once per collection, ever**. They are precious, which is
  why they are allowed to wait for floor (see *Floor arbitration*) and why a dev replay route
  is a requirement and not a convenience.

---

## Architecture

```
crowdAgents.ts    per-bobit autonomous state: position, depth, facing, activity
sceneDirector.ts  pure timeline runner; casting, beats, floor reservation
scenes/           one file per set piece — data, not code
props.ts          cannon and tree geometry
crowdFigures.ts   translator: agents + director + props -> FieldFigure[]  (shrinks)
crowdReducer.ts   unchanged in role: match events (correct/wrong/seed) and the loss sequence
```

Everything above the translator is pure and seedable. A cannon shot is a deterministic unit
test, not something you sit and watch.

### `crowdAgents.ts`

Extends `wanderReducer.ts` rather than replacing it — that file already handles stroll/pause,
direction choice out of a pause, edge margins and pairwise separation. Added per agent:

- `depth: 0..1` — maps to a ground line across the stage's vertical span and modulates scale
  by ±8%. Without it, free wandering puts everyone on one horizontal line and reads as a conga
  queue rather than a crowd.
- `activity: 'wander' | 'perch' | 'socialise' | 'rank' | 'cast'` — `cast` means the director
  owns this agent and `crowdAgents` must not advance it.

### `sceneDirector.ts`

```ts
interface Beat {
  at: number;                    // seconds from scene start
  role: string;                  // 'host' | 'newcomer' | 'cannon'
  pose?: string;                 // rig animation key
  moveTo?: number;               // 0-1 within the scene's own span
  path?: 'walk' | 'run' | 'arc';
  vfx?: { kind: 'smoke' | 'flash'; color?: string; spread: number };
  prop?: { kind: 'cannon' | 'tree'; angle?: number } | null;   // null removes
}

interface Scene { id: string; duration: number; span: number; roles: string[]; beats: Beat[] }
```

Director state is a list of running scenes, each with elapsed `t`, a reserved floor span, and
a casting map `role -> agent id`. Stepping is arithmetic over `t`.

Casting: `newcomer` is the arriving id; `host` is the nearest stage agent, tie-broken by id so
casting is deterministic. Props are cast as prop instances, not agents.

---

## The floor

### Band geometry

| | today | proposed |
|---|---|---|
| Desktop height | 96px | **190px** |
| Desktop scale | 0.2 | **0.2** (held) |
| Mobile height | 54px | **100px** |
| Mobile scale | 0.13 | **0.20** |

Desktop goes from 2.5 bobit-heights deep to ~4.9 (a standing figure is 195 rig units; 195 x 0.2
= 39px). Mobile figures grow from 25px to 39px.

The band is `flex-shrink-0` in a flex column whose question area is `flex-1`, so height taken
by the band comes out of the question area directly. No layout surgery — this is the approved
10-15% reallocation.

**These are starting values, to be tuned against a rendered screenshot at real viewports.**
At a 768px-tall laptop, 190px may crowd the question card; the likely landing place is a clamp
against viewport height rather than a constant. See *Verification*.

### Two zones

- **Front stage**, lower ~60%: agents wander freely.
- **Back ranks**, upper ~40%: the standing majority, on the existing `slotPosition` layout,
  which already places back rows higher.

### The rule that replaces fixed slots

The current design forbids reflow because reflow would move everyone whenever a bobit arrived.
That rule was protecting against *teleporting*. Restated:

> **No bobit ever teleports. Every position change is walked.**

Which frees the cast to change. When a newcomer pushes a bobit out of the wandering cast, that
bobit **strolls up into the ranks on his own feet**. Same protection, more life.

### Densification

`WANDER_CAST` — how many wander at once — **starts at 24 and is a measured number.** The most
recent arrivals hold the stage; the rest stand in ranks. This is what keeps the per-frame
separation check off O(100^2): `wanderAdvance` is O(N^2) over the cast, so 24 is 576 checks a
frame where 100 would be 10,000.

A slow rotation keeps it from being the same 24 faces forever: roughly every 20s one rank bobit
ambles down to the stage and one stage bobit drifts back up. This is what makes a 90-bobit room
feel populated rather than staffed.

Mobile runs a smaller cast, also measured.

### The tree (25% of `questionCount`)

The first consumer of `Surface`, which has sat unused in `fieldGeometry.ts` since Stage 1
waiting for exactly this. Trunk on the right border, ~12% of band width, **branches as 2-3
`Surface` ledges** at different heights.

Perching is a destination, not a stunt: a bobit who has just arrived, or who ends a wander leg
with nothing to do, may path to the trunk, `climb`, then `sit` on a branch and `peek` or `read`.
Branch capacity 1-2. Perched bobits leave the floor's separation budget, so the tree also buys
back stage room.

Desktop only.

**The `+N more` overflow label moves from bottom-right to bottom-left** — the trunk is now
where it sat.

---

## The director's scenes

### Floor arbitration

A scene reserves a span; reservations must be disjoint. Wandering agents treat a reservation as
a wall and turn at it — the existing edge-turn branch in `wanderAdvance`, pointed at a moving
bound instead of the band edge. Nobody strolls through the line of fire.

Concurrency (D2) means two scenes can want the same ground:

- **Pool entrances never wait.** ~12% span, so they almost always fit; otherwise they relocate.
- **Set pieces wait up to ~4s for their span, then play a compact variant.** They fire once per
  collection ever; downgrading the cannon because arrival #1 was still waving would be a bad
  trade, and a bounded wait is not the backlog that queueing was rejected for.

### Arrival #1 — the swirl (~4.2s, span ~22%)

Purple smoke gathers and swirls, then a flash, and he is *there* — splayed as if held out by
both arms and both legs. He drops, lands, plays `confused` turning to get his bearings, spots
you through the monitor and waves excitedly (`greet`), then is released to wander with his first
leg playing `ponder`, scratching his head.

### Arrival #2 — the cannon (~10.6s, span ~85%)

| t | beat |
|---|---|
| 0.0 | purple swirl gathers **right beside the host** |
| 0.8 | host reads it as a friend arriving — `cheer`, pacing back and forth in excitement |
| 1.6 | flash. It is not a bobit. It is a **cannon**, aimed at the far wall |
| 2.0 | host stops. `ponder` — scratches his head at it |
| 3.2 | walks around behind it |
| 4.0 | finds the string. Pulls |
| 4.3 | **FIRE.** The newcomer erupts from the muzzle flailing, arcing across the whole band |
| 5.9 | lands in a heap — `spent` |
| 6.1 | the cannon poofs away in purple smoke |
| 6.4 | host realises what he just did — `presentup`, both hands over his head |
| 7.0 | `scurry` — runs the length of the room to the newcomer |
| 8.6 | newcomer picks himself up and `cheer`s |
| 9.0 | host `cheer`s |
| 9.8 | **high-five** |
| 10.6 | both released to wander |

The high-five is built as a **reusable two-actor beat**. It also greets later arrivals and
punctuates correct answers.

Compact mobile variant: cannon at the left third, shorter arc, landing in the right third.

### Milestone set piece — the tree (25%, ~7s, right 25%)

Swirl at the right border; a sapling pushes up through the floor and grows to full height over
~2s; nearby bobits drift over, look up and `present` at it; one climbs immediately, sits on a
branch, and waves down. The tree persists from then on.

50% / 75% / 100% buildings are **out of scope for this spec** and become content added to a
finished mechanism. The tree is the worked example that proves the seam is real.

### Pool entrances — four, funny, 2-3s, ~12% span

1. **Poof-in stumble** — purple poof, lands badly, `shrug`, dusts himself off.
2. **Trip-in** — strolls in from the nearest edge, catches his foot, recovers, glances round to
   see whether anyone saw.
3. **Peek-in** — head pops up over the band's bottom edge (`peek`), looks both ways, hauls
   himself up.
4. **Drop-in** — falls in from above, lands `spent`, gets up, `friendly` wave.

A larger random library is anticipated and is deliberately additive: new files in `scenes/`,
no mechanism touched.

---

## Reactions

### A correct answer

The streak ladder in `animForTier` stops being the behaviour and becomes the **intensity input**
to a sequence:

| t | the room |
|---|---|
| 0.0 | stage agents stop, turn toward the celebrant, `cheer` |
| 0.8 | `clap` |
| 1.6 | agents within ~2x separation **pair off and high-five**; the unpaired `jump` |
| 2.4 | released, back to wandering |

Tier 1 is a nod and a cheer; tier 5 gets the full chain plus `dance`. Back ranks cheer in place
without pairing — 76 simultaneous high-fives are both unreadable and expensive.

Pairing is greedy nearest-neighbour **sorted by id**, so it is deterministic and testable.

### A miss

**Owned** — the abduction, unchanged: rise 0.9s, burst 0.6s, room frozen 0.8s, recover 1.7s.
One change: the freeze is currently implemented by rewinding every figure's animation phase,
which pins poses but would leave agents *sliding* now that they have positions. The freeze
becomes a director-level flag that also halts agent advancement. Poses freeze and feet stop.

**Costless** — the gap in today's build, where a miss on a question you never owned does
literally nothing. A ripple of `shrug` and `confused` spreads outward from the newest bobit over
~1.5s, then the room shrugs it off. No freeze, no loss.

---

## Interaction

Mostly wiring: `greetReducer` and `BobitField`'s `interactive` mode already do this on the
landing page. `CollectionCrowd` currently hard-codes `greetable: false` and never sets
`interactive`.

- `greetable: true`, `interactive` on.
- `poofable` stays **false**.
- Hover or click: he stops where he stands and waves. `wanderAdvance` already freezes greeting
  ids, so the walk is interrupted rather than run on the spot.
- Touch: a tap is hover and click at the same instant, via the existing 300ms boundary in
  `pointerGestures.ts`.

**Perched bobits must carry `hoverAnim: 'greetseat'`.** `fieldGeometry.ts` documents this trap
and nothing has hit it yet: `figureBounds` and the ink probe measure from the BASE anim while
`paint` positions with the RESOLVED one, so a seated figure given a standing `hoverAnim` is
drawn ~104 units from its own hit box. The tree introduces the first seated figures in the
crowd, which arms it.

---

## Rig additions

All of it in **`rigExtras.ts`, never `leremyRig.ts`** — the rig is a faithful mirror of
ev-landing's `leremy-rig.js` and must stay a clean overwrite on re-sync.

| addition | for |
|---|---|
| `splayed` | arrival #1, held out by all four limbs |
| `flail` | the cannon shot, airborne, arms windmilling |
| `highfive` | the reusable two-actor beat |
| `clap` | the correct-answer sequence |
| `drawSmokePuff(..., color)` | `drawSmoke` in the rig hardcodes `#8A8F98`; purple is a CTC variant |

`BobitField` gains a `props` array — `{id, x, groundY, scale, draw}` — sorted into the same
depth order as figures, so a bobit can walk behind the tree. The cannon is scene-owned and
transient; the tree is room-owned and persistent.

---

## Mobile — the reduced room

Present: wandering, greeting, arrivals, high-fives, both miss reactions.
Cut: the tree. Compacted: set piece variants with shorter travel.
`WANDER_CAST` is smaller, and measured.

**The 25% milestone still fires on mobile**, without the tree. Cutting the tree would otherwise
leave a phone player with nothing but pool entrances for the rest of the collection, since the
tree is the only milestone set piece in this spec. The mobile variant is the crowd noticing the
milestone rather than a structure arriving: the room stops, gathers loosely toward the newest
bobit, and runs the full cheer-clap-high-five chain at tier 5. Same beat in the progression,
different staging.

## Reduced motion

No wandering, no scenes, no VFX. Bobits stand in ranks; arrivals appear in place. This is
essentially today's behaviour, which is a useful property: the accessible path is the existing
correct baseline, and everything in this spec is strictly additive over it.

---

## Verification

### Pure tests

`crowdAgents`, `sceneDirector`, each scene's beat timeline, pairing determinism, and floor
arbitration (disjointness, relocation fallback, the bounded wait). Seeded RNG throughout.
Existing `crowdReducer` and `bobitProgress` tests stay green.

### Rendered verification — mandatory, not optional

Playwright and chromium are installed locally and the app drives with `/api/game/collections`
mocked, so this costs minutes. Screenshot every new pose and every set piece at three keyframes,
at both scales, in light and dark.

This is the trophy-grip lesson applied directly: that fix passed a joint-coordinate contact test
**and** a reviewer who independently recomputed the kinematics, and a screenshot then showed both
carriers in a T-pose. A test constrains the joints it names and nothing else.

It is also the only real option for the click-to-wave path: **no DOM-capable component tests
exist in this repo** (vitest is node-only by design), and three interaction bugs of exactly that
class have already shipped on one branch.

### The measurement pass

Runs before `WANDER_CAST` is fixed. Build the harness first, and **check the harness measures
work rather than vsync** — the Stage 2 harness initially reported 16.7ms for every configuration
because it timed frame-to-frame delta.

Measure:

1. Frame cost across cast sizes 10 / 20 / 30 / 40 in a full 100-figure room, throttled profile.
2. Frame cost with two concurrent set pieces running — the worst case for canvas **API call
   count**, which Stage 2 established is the real cost driver, not fill.

Outputs: the real `WANDER_CAST` for each form factor, and whether concurrent set pieces need a
hard cap of 2.

### Dev replay route

The set pieces fire once per collection ever, so they cannot be QA'd by playing normally. A
`?scene=<id>` trigger that replays any scene on demand is a **requirement**, not a convenience —
without it neither building nor reviewing this is practical.

---

## Dependencies and open items

1. **`questionCount` plumbing.** The 25% denominator exists on `CollectionSummary` from
   `/api/game/collections`, but `CollectionCrowd` receives only `slug`. Needs threading through
   `useCollections` -> `GameScreen` -> `CollectionCrowd`. (Note: `ResultsScreen` already declares
   a `collectionQuestionCount` prop that **no caller passes** — it is dead and always falls back
   to 5. Worth fixing in the same pass.)
2. **Band height** is provisional until screenshotted at a 768px-tall viewport.
3. **`WANDER_CAST`** is provisional until measured.
4. `backend/` is frozen; nothing here needs it. Progress remains localStorage for signed-out
   players and the accounts server driver for signed-in ones, exactly as today.

## Out of scope

- The 50% / 75% / 100% buildings.
- The large random entrance library.
- Any change to question selection, scoring, or difficulty gating.
- Server-side bobit progress (already shipped separately).

---

## Addendum: what plan 1 changed (2026-09-14)

Plan 1 shipped and was watched running. Four things in this spec are now wrong, and plan 2
builds on the corrected versions.

**Depth is gone. One ground line.** The spec gave agents a `depth` 0-1 mapped across the lower
60% of the band with a ±8% scale swing. It looked right standing still and broke in motion: the
rig has no perspective gait, so a bobit changing station walked diagonally up the screen and
read as sliding. Everyone now stands on one line at one size, as ev-landing does.
`stageBounds`/`agentPlacement` remain as the seam if depth is ever wanted back.

**The band is full-bleed and much shorter.** It shared the question card's max-width, penning
the crowd into a column down the middle; it now spans the viewport. On one line it only has to
clear a raised-arm pose, so it is **96px desktop / 72px mobile**, not 190/100.

**There is a floor line.** A faded rule under the crowd. Not decoration: with depth gone the
crowd had nothing to stand on, so `jump` — a real 48-unit lift — read as a wobble.

**`WANDER_CAST` is derived, not fixed.** Measurement falsified the premise: the cast never
constrained performance (100 wandering, celebrating, 4x throttled = 4.48ms against 16.7ms).
Floor space constrains it, so it is `wanderCastFor(width, band)` — ~37 desktop, ~8 phone.

### The consequence for plan 2, and the constraint that changes with it

A 96px band leaves **54px of headroom** above a standing figure. A cannon arc across even a
third of a full-bleed band (~630px) needs ~126px of rise to read as flight rather than as
sliding. The set piece no longer fits in the room the living floor gave back.

**Decided 2026-09-14 (Chris):** the band **grows while a set piece runs** (96 → ~240px,
animated, ~11s) and shrinks back, pushing the question card up rather than overlapping it.

**And the standing no-occlusion rule is relaxed, narrowly.** The rule from 2026-09-05 —
"bobits must never cover the question card or any of the four answer options" — was written
against a crowd that would otherwise *stand* in front of the answers. Chris asked for a figure
to be able to **briefly fly in front of** the card during a set piece, which growing the band
cannot do on its own: an overlay is required. The relaxation is bounded to:

- **Transient only.** A figure passes through; nothing ever comes to rest over the card.
- **Reveal phase only.** Never while the timer is running and the player is aiming at an answer.
- **`pointer-events: none`.** It can never intercept a click meant for an answer or for Next.
- **Set pieces only.** Ordinary arrivals and the pool entrances stay wholly inside the band.

The original intent — the player can always read the question and hit the answer they want —
is preserved by those four bounds. The crowd at rest still never occludes anything.

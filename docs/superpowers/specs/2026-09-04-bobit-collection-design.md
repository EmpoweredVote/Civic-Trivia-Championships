# Bobit Collection — Design

**Date:** 2026-09-04
**Status:** Approved for planning

Three staged pieces of work: bring CTC's stick-figure rig to parity with the
ev-landing implementation, measure how large a crowd the renderer can carry, and
build a per-question bobit collection that persists across matches.

---

## 1. Background

### What ev-landing has

The Empowered Vote landing page (`C:\ev-landing\ev-landing-main`) runs a
procedural skeletal rig — every frame computed from joint angles, no sprites.
Two framework-free files:

| File | Lines | Role |
|---|---|---|
| `leremy-rig.js` | 1252 | Rig engine. **41 animations**, `drawSmoke`, `drawShadow`, `makeGait` |
| `ev-figures.js` | 4530 | Overlay: casting sheet (`SPECS`), spawn/reposition, the loop, every interaction |

Plus `ev-lines.js` / `ev-quotes.js` / `ev-copy.en.js` for speech bubbles.

`Animating stick figures/handoff/HANDOFF.md` documents the rig well but describes
a much older overlay (364 lines vs. today's 4530). Trust it on rig concepts,
not on behaviors.

The behaviors that define a bobit's feel:

- **Pixel-accurate hit testing.** `bobitAt()` reads canvas alpha rather than
  testing bounding boxes, so the cursor only finds a figure when it is over
  actual ink. Any pose added later inherits it with no extra work.
- **Hover greet.** Freezes the figure's clock, plays `greet` / `greetseat`
  (attention → head-cock → wave), lingers 1.6s after the cursor leaves.
- **Hold-to-poof.** Right button held for 3s — not a click. Smoke gathers and
  tightens, the figure is lifted, bursts. Release / Escape / blur / pointer-leave
  cancels to a `fizzle` and he picks himself back up.
- **Touch parity.** One-finger hold with slop tolerance and a tap timer.

### What CTC has

`frontend/src/components/bobbits/` holds a **divergent fork**, not a subset:
`leremyRig.ts` (501 lines, 14 animations) plus five React components.

- Shared with ev-landing (10): `standstill friendly sit read greet greetseat present stroll carry heave`
- CTC-only (4): `cheer dance offer ponder`, plus trophy and card props
- Missing (31): every other gait, `climb jump peek rope fall painhop`, the
  personality idles, `holdannoyed` / `annoyed`, and `drawSmoke` entirely

No hit testing (`BobbitCanvas` uses a hardcoded 30×90-unit box), no hover greet,
no poof.

### Numbers that shape the design

Queried live 2026-09-04 against `kxsdzaojfaibhuzmclfq`:

| | |
|---|---|
| Active collections | 41 |
| Active questions in `collection_questions` | 3,707 |
| Questions per collection | min 53, median 91, max 154 |

A match is 5 questions (`TOTAL_QUESTIONS`), so a flawless run fills 5 slots.
Filling a median collection is ~18 perfect matches, realistically 25–40.

### Constraints discovered

- **No per-question progress exists anywhere.** Not in `backend/src/db/schema.ts`,
  no endpoint. `Dashboard.tsx:135` says so in a comment. This is the load-bearing
  new component.
- **`Question.id` is already the `externalId`.** `questionService.ts:68` maps
  `id: row.externalId` — "uses externalId as id (NOT the database serial id)".
  The frontend already holds a stable per-question key; **no API change is needed
  for the core loop.**
- **`questionService.ts` already excludes `recentQuestionIds` per session**, and
  already-correct questions still resurface. Stage 3 rides existing selection.
- **`confettiStore` already has a five-step ladder**: `fireSmallBurst`,
  `fireMediumBurst`, `fireConfettiRain`, `fireTopRain`, `fireFireworks`.
- **`useReducedMotion` is already honoured** by every existing bobbit component.

---

## 2. Decisions

| Decision | Choice |
|---|---|
| Rig source of truth | Adopt ev-landing's `leremy-rig.js`; CTC's 4 extras layer on top |
| Behaviors ported | Pixel hit-test + hover greet, hold-to-poof + smoke, touch parity, dialogue |
| Homepage poof aftermath | Full ev-landing parity, mass exodus included |
| Collection crowd scope | The collection currently being played |
| Where the crowd renders | Game screen only; homepage stays decorative |
| Persistence | localStorage now, behind a storage interface; server driver later |
| Wager question (Q5) | Same rule, no exception — a wrong Q5 destroys its bobit |
| Growth rate | Accepted as-is; pacing is a content problem, not a mechanic problem |
| Perf target | Set from measurement, not chosen in advance |

Two populations with different rules, deliberately kept on separate screens:

```
GAME SCREEN     collection crowd — earned, persists, never mass-flees
HOMEPAGE        decorative cast — full ev-landing rules, exodus included
```

**Accepted risk, recorded deliberately:** the homepage exodus means a visitor who
discovers the right-hold can empty it until reload. It is the one place in CTC
where a user gesture removes content, and it sits two clicks from a game screen
where the same gesture means something far more serious.

**The hold-to-poof gesture is disabled on collection bobits.** On the game screen
a poof always means "you got this one wrong" — it is never something the player
can do on purpose. Letting a gesture destroy earned progress would both risk real
loss and blunt the meaning of the animation at the moment it needs to land
hardest. Hover greet stays enabled on the game screen; only the destructive
gesture is withheld. `bobitField` gates this per figure, so the homepage cast and
the collection crowd can coexist under different rules if they ever share a
screen.

---

## 3. Stage 1 — rig adoption and behavior parity

### One field, one clock

Today each bobbit component owns a `<canvas>` and its own `requestAnimationFrame`
loop. That is fine for 2–6 figures and wrong for 91–154.

`BobitField` replaces it: a single canvas covering the play area, a single rAF, a
shared clock all figures phase off, and figures painted in ground-Y order so
overlap reads as depth. Existing components become consumers of the field rather
than owners of a canvas.

This makes the alpha hit-test cheaper than it is on the landing page. There,
`bobitAt` walks 14 canvases calling `getBoundingClientRect` + `getImageData` on
each. On one field canvas it is a single `getImageData` at the cursor.

### Files

```
frontend/src/components/bobbits/
  leremyRig.ts     ← converted from ev-landing's leremy-rig.js (41 anims, drawSmoke, makeGait)
  rigExtras.ts     ← CTC's cheer, dance, offer, ponder + trophy/card props
  bobitField.ts    ← shared clock, depth sort, alpha hit-test, greet, poof, touch
```

The four homepage components keep their public props and lose their loops.
`BobbitTrophyCarry` carries the real conversion work: it hand-rolls a walk-cycle
state machine (`Phase = 'walk' | 'lowering' | 'rising1' | ...`) that the adopted
rig's `makeGait` covers natively.

`BobitField`'s interface defines a `surfaces` concept — left unimplemented — so
the later unlockable platforms and toys are additive rather than a rewrite.

### Dialogue layer

`ev-lines.js` / `ev-quotes.js` / `ev-copy.en.js` port as a separate step within
this stage. It is three more source files and does not block stages 2 or 3;
sequence it last so it can slip without holding up the collection mechanic.

---

## 4. Stage 2 — the performance spike

**No target is set in advance.** An instrumented harness ramps the population and
records frame time until it exceeds budget, across the device classes actually
available. The numbers set the bar.

### The hypothesis to test first

A room of 91 idlers is 91 figures playing the same animation at different phases:
91 pose computations and roughly 1,365 canvas path operations per frame.

Quantise phase into ~24 buckets and it becomes 24 renders to offscreen tiles plus
91 blits. Nobody can perceive a 1/24-second phase difference in a breathing idle,
so the visual read is unchanged at roughly a quarter of the cost.

If it holds, the naive and optimised ceilings will differ enough to change what
stage 3 can ask for. **The harness measures both, not just one.**

### Cases to measure separately

1. **Idle crowd** — the cache's best case.
2. **Phase-gradient scenes** (stadium wave, clap ripple) — the same draw-call
   pattern as idle, blitted in x order instead of random order. Expected to cost
   the same; confirm it.
3. **Unique-pose scenes** (the tier-5 pile-on) — defeats the cache, costs full
   price. This is the real worst case and must not be inferred from the crowd
   number.

### Secondary levers to measure

DPR cap (1.5 as ev-landing chose, vs. CTC's current 2), viewport culling, and
silhouette-LOD for back-row figures.

### Deliverable

A numbers table per device class — naive vs. pose-cached, for all three scene
cases — and a recommended population cap. If the cap lands under 154, stage 3
gains a crowd-LOD rule rather than a redesign.

---

## 5. Stage 3 — the collection mechanic

### Identity and the gap

Each bobit is bound to a question by `externalId`. Both its colour tone and its
standing position derive deterministically from a hash of that id, so the bobit
for `milwi-042` is the same figure in the same spot every match.

That is what makes the loss land: when he floats away he leaves a hole in a crowd
the player recognises, and re-earning that question refills that exact spot. The
gap is the reminder.

### Storage

```ts
export interface BobitProgressStore {
  load(collectionId: number): Promise<Set<string>>;   // owned question externalIds
  grant(collectionId: number, questionId: string): Promise<void>;
  revoke(collectionId: number, questionId: string): Promise<void>;
  summary(): Promise<Record<number, number>>;          // future per-collection tally
}
```

**localStorage driver.** Key `ctc.bobits.v1`, shape
`{ [collectionId]: { [questionId]: epochMs } }`. Revoke deletes the entry; no
tombstone, because re-earning is simply a re-grant. Maximum realistic size is
3,707 entries at ~20 bytes — about 75KB, comfortably inside quota.

`collectionId` is stored, never derived from the id prefix. Prefixes look
derivable but are not reliable: the convention is 5 letters now, legacy
collections kept 3 (`bli`, `lac`), and **Indiana has two** (`ins` and `ind`).
Parsing prefixes would quietly mis-file questions.

**Server driver**, when it lands in the consolidated engine:

```sql
trivia.user_question_progress (
  user_id              uuid        not null,
  collection_id        int         not null,
  question_external_id text        not null,
  first_correct_at     timestamptz not null,
  lost_at              timestamptz,
  primary key (user_id, question_external_id)
)
```

Called the way `awardPlatformXp()` and `awardPlatformGems()` already are.

**The server driver is not optional long-term.** Difficulty gating — "always ask
*Who is your Mayor?* until it is flagged correct, then let it join the easy
rotation" — requires question *selection* to read this store, and selection runs
on the backend. localStorage cannot serve it. The seam exists so that work is a
driver swap rather than a rewrite.

### Crowd state is a reducer

The choreography is time-based and would be miserable to test written in place.
It follows the pattern `gameReducer.ts` already establishes: a pure
`crowdReducer(state, event) → state` holding residents, arrivals, departures and
the current celebration tier, unit-tested with plain assertions. `BobitField` is
a dumb renderer over that state. No test touches a canvas.

### The escalation ladder

Driven by in-match correct streak:

| Streak | The room does |
|---|---|
| 1 | Newcomer walks in and waves; nearest 1–2 turn and nod |
| 2 | High five with a neighbour; a clap ripples to ~4 nearby |
| 3 | Clapping spreads to roughly a third of the room, a few `jump` |
| 4 | Most of the room cheers — arms up, jumping in place |
| 5 | Full room: running, jumping, converging on the newcomer, plus `fireFireworks` |

**Confetti fires only at 5/5.** The four lower rungs are bobits alone. Confetti at
tier 3 would stop meaning anything by the time it matters; the top rung has to
differ in kind, not only in degree.

A correct answer on a question already owned spawns nobody — that bobit steps
forward and celebrates personally, and the room still escalates by streak.

### The loss

On a wrong answer to a question the player owns:

1. Victim rises (`abduct`), smoke gathers, bursts, gone.
2. Room freezes ~0.8s.
3. Heads turn and scan; two or three `shrug`.
4. Everyone resumes idle within ~2.5s.
5. Store revokes; the spot stays empty until re-earned.

A wrong answer on a question never owned does essentially nothing — a couple of
glances, no more.

This rule has **no exception for Q5**. A bobit is bound to a question, not to a
scoring mode.

### Degradation

- Store read fails → field renders empty, grants stay in memory for that match
  only. **Gameplay never blocks on the crowd.**
- `useReducedMotion` → crowd renders static, arrivals and departures become
  instant, no smoke, no confetti.
- Population above the stage-2 measured cap → crowd-LOD, not a hard cut.

---

## 6. Out of scope

- **Unlockable platforms, toys and buildings.** The field's ground-Y depth sort is
  the right substrate and `surfaces` is defined for them, but nothing is built.
- **Difficulty gating** (mayor-first rotation). Depends on the server driver.
- **Per-collection tallies on collection cards.** `summary()` exists on the
  interface to serve it later.
- **Cross-device progress.** Follows the server driver.
- **Extracting a shared `@ev/leremy-rig` package.** Genuinely solves drift between
  the two repos, but needs publish infrastructure spanning a static site and a
  Vite app. Revisit once the backend consolidation settles.

---

## 7. Sequencing

1. **Stage 1** — rig adoption, `BobitField`, behavior port. Dialogue layer last.
2. **Stage 2** — the spike. Needs stage 1's field to measure anything meaningful.
3. **Stage 3** — the collection mechanic, sized by stage 2's numbers.

Stages 1 and 2 are pure frontend and unblocked. Stage 3's core loop is also pure
frontend — the backend work is the server driver, which is a follow-on.

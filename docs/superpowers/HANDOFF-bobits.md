# Bobits — shipped, and what to know

> **Reference for a live feature, not a handoff for work in flight.** Three pieces are in
> production: the living floor, the margin tree, and the recap crowd. This is what they do,
> what is load-bearing about how they do it, and what was left undone.

| What | PR | Merged as | State |
|---|---|---|---|
| The living room (floor, entrances, tree + perching) | #113 | `af6233f` | live |
| The margin tree | #115 | `30f2e67` | live |
| The recap crowd | #116 | `b62e86a` | live |
| The 1280 scroll fix | #117 | — | **open, green, unmerged** |

`civic-trivia-frontend` (`srv-d6a0o4jnv86c73f71seg`) auto-deploys from `master`, and there is
no staging. **Merging to `master` is a production deploy.** The backend here is frozen and
`civic-trivia-backend` is suspended; production gameplay runs through `ev-accounts`.

Specs and plans for all of it are under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

---

## 1. What is live

**The living floor.** Bobits wander on one ground line, greet on click, celebrate wins with a
staggered cheer → clap → high-five, and shrug off costless misses. Heights vary ±10%. The
director runs scenes-as-data: the swirl (arrival #1), the cannon (arrival #2) and four pool
entrances. Every entrance arrives in a poof of smoke.

**The margin tree.** At 25% of a collection's questions, a tree grows in the empty strip beside
the question column — floor line to canopy, three branches, bobits climbing between them. On
viewports too narrow for it, the original in-band tree is the fallback. A phone gets neither,
and the milestone plays as a crowd celebration instead.

**The recap crowd.** The results screen shows the whole room celebrating, so a match lost on the
final question still ends well. Bobits earned *in that session* bow, repeatedly; everyone else
cheers, claps, high-fives and occasionally jumps.

---

## 2. THE STANDING INSTRUCTION, AND WHAT IT NOW MEANS

Memory and the original spec say *"bobits must never cover the question card or any of the four
answer options"* (Chris, 2026-09-05). That was relaxed **once**, on 2026-09-14, so the cannon
shot could fly in front of the buttons. **It has not been widened since, and the margin tree
deliberately did not widen it** — Chris was asked directly and declined.

The relaxation is bounded to four rules, all load-bearing:

1. **Transient only** — a figure passes through; nothing comes to rest over the card.
2. **Reveal phase only** — never while the timer runs (`aerialAllowed={state.phase === 'revealing'}`).
3. **`pointer-events: none`** and `interactive={false}` — it can never intercept a click.
4. **Set pieces only** — pool entrances never set `layer: 'air'`.

Bounds 1 and 4 are held by `scenes.test.ts`, not by convention.

**The margin tree holds bound 1 by GEOMETRY.** Its canvas is positioned `right: 0` with a width
measured from the question column's right edge, so its left edge *is* that edge and nothing
drawn inside it can reach the card. `marginTree.test.ts` asserts the tree's whole ink box and
every branch edge stay inside the margin at every width. That is why this canvas may stay
`interactive` while the aerial overlay must not — a bobit can still be greeted from his branch.

**Do not widen this without asking.**

---

## 3. The three canvases, and the partition

| Canvas | Holds | Interactive | Mounted |
|---|---|---|---|
| Band (in flow, 96px / 72px mobile) | the crowd | yes | always |
| Aerial overlay (fixed, full viewport) | set-piece flight only | **no** | only while something flies |
| Tree margin (absolute, in the margin) | the tree, its climbers | yes | while the margin tree stands |

**Every figure belongs to exactly one, and all three lists come from ONE pass per frame.** This
is not a preference. An airborne bobit was once painted on *both* canvases for a whole flight —
arcing over the card and standing on the band at the same time — because the band read a ref in
the frame loop while the render read a prop. A partition only holds if every side is answering
the same question. `onTheTree()` is the single predicate both `crowdFigures` and `treeFigures`
ask.

**`crowdFigures` takes TWO surface lists.** Band surfaces (the in-band fallback tree's one
branch) are drawn by it; tree-canvas surfaces are passed in only so their occupants can be left
out. With one list, the fallback tree's occupant was excluded from the band and handed to a
canvas that is not mounted in that case — he vanished.

---

## 4. Gotchas, in rough order of how much they cost

**Numeric verification is not visual verification.** Every defect in this work that mattered was
found by screenshotting, with the unit tests green: a T-pose clap, hands-on-hips clap, heads
clipped on mobile, the back row off-canvas, the crowd bunched in the left two thirds, props
never wired to the canvas, `pool-stumble` with no poof, a tree shaped like a mushroom, an
invisible branch, a sprout frozen half-grown, three bobits floating in mid-air, and the margin
tree silently vanishing for the rest of a match. **Run the contact sheets.**

**A value passed as a prop is frozen at the last render; the animation runs on rAF.** The tree's
`grow` shipped as a number and the sprout stalled at whatever height React last rendered. Per-
frame quantities must be passed as callbacks (`growFor`, `figuresFor`, `propsFor`), read inside
the frame.

**A `[]`-dep effect does not survive a component early-returning its subtree.** `GameScreen`
early-returns the wager screen before its main shell, so the measured nodes are torn out and put
back mid-match. A mount-time `ResizeObserver` kept watching the detached nodes — which report
all zeros — and the margin tree silently demoted to its in-band fallback from the wager screen
onward. Use **callback refs** that rebind on attach/detach, and never publish a zero-width rect.

**Geometry drawn at one scale and positioned at another will disagree.** The tree's branches are
drawn at `grow` height while their `Surface`s are computed at full height, so during the sprout
figures hang in the air above branches that have not reached them. There are no branches to
claim until the tree has finished growing.

**Border box vs content box.** The band lives inside its container's `px-4 sm:px-6`, so measuring
the margin to the container's *border*-box right edge overstates it by that padding — and since
the canvas is positioned from its right edge, the surplus comes off the left and pushes it over
the card. Bound 1 breached by arithmetic.

**`armRU`/`armRF` are absolute from the body, 0° = straight DOWN, and `armRF` is NOT an elbow
bend.** Reading it as one has produced a T-pose three times. Arm angles hang from the
already-curled torso (`ub = lean + hunch`), which is why `spent` needs `armRU = 58` to hang
*straight down* at a −44 fold.

**Negative `hunch` is FORWARD.** `leremyRig.ts` says so outright in its gait comment; `read` uses
`+22` for "reclined back into the chair". The wrong sign bends a figure backwards over an
invisible chair and looks deliberate enough to survive a code read.

**`Surface` positions a figure's SEAT, and a seated figure needs a seated `hoverAnim`.** Standing
and seated pelvis offsets are 112 and 8 — 104 apart — and `figureBounds` measures from the BASE
anim while paint positions with the RESOLVED one. Never hardcode 112; ask `pelvisOffset()`.
**No scene may play a seated pose on a beat that leaves the ground.** Recorded four times.

**Choose a pose by its frame function, never its name.** `fall` is a SEATED sprawl, not a body in
the air. `peek` cranes forward and looks DOWN. Both shipped wrong once.

**A branch's rect and its `Surface` must share an edge.** The in-band tree draws the rect from
`-up - W`, putting its *bottom* on the Surface's `y`, so a sitter is sunk a branch-width into the
wood — 3px there, 15px on the margin tree, which draws from `-up` instead.

**One definition per piece of geometry.** The margin tree's draw and its `Surface`s were computed
separately and immediately drifted by half a trunk width. `marginBranch(i)` is now the single
source, read by the draw, the surfaces and the ink bounds.

**`Scene.moveTo` is a fraction of the scene's own SLOT, not of the band** —
`x = r.left + frac * (r.right - r.left)`. A test that recomputed it as band-global reported the
milestone ceremony 362px adrift of a trunk it was standing under.

**Assert consequences, not values.** Three of this feature's tests asserted the implementation's
own arithmetic back at it and each sat on a real defect. Two more were *weak* rather than wrong:
"holds still at the bottom of the bow" passes for a bow with no hold, because a smoothstep apex
is naturally flat; "reserves the right quarter" passed while the scene played at the far end.

**Nominal vs measured width.** `band.width` is a nominal 1000 for proportional placement. Using
it where real pixels are needed has caused two separate bugs.

**Playwright matches routes in REVERSE registration order.** A catch-all must be registered first.

**A tool can be structurally unable to show the bug it was built to find.** `__bobitScene` passes
a synthetic `replay-<ts>` id that never becomes a resident, so the newcomer renders as an orphan
with no agent. Drive a real grant when it matters.

**`npm test | grep …` masks the exit code**, so `&& git commit` does not gate on it. Two red
tests were committed that way.

---

## 5. How to run it

The backend here is frozen, so there is nothing to point a local frontend at. A dev-only mock
lives in the app:

```
cd frontend && npm run dev
http://localhost:5173/?mock=1&collection=milwaukee-wi
```

Options: `&owned=N` (default 30), `&bobitSeed=xyz`, `&scene=<id>` to replay an entrance on a 14s
loop. Scene ids: `swirl`, `cannon`, `pool-stumble`, `pool-trip`, `pool-peek`, `pool-drop`.

**A is always the correct answer.** Q1/Q2 are already-owned ids and grant nobody; Q3–Q5 are new.
The mock's collection has `questionCount: 120`, so the 25% milestone is 30 residents.

### The scripts

| Script | What it answers |
|---|---|
| `bobit-tree.mjs` | the margin tree at 1920/1440/1280/1024 × both themes, plus a climb strip |
| `bobit-milestone.mjs` | drives a REAL 25% crossing — does it sprout, is anybody floating, are the admirers under the trunk |
| `bobit-recap.mjs` | the recap crowd at four widths × both themes × rosters either side of the cap, **and the scroll measurement** |
| `bobit-scenes.mjs` | contact sheets for the entrances |
| `bobit-props.mjs` | every prop at the 0.2 scale the player sees it, both themes |
| `bobit-shots.mjs` | pose sheet (including the bow cycle) + page sweep |
| `bobit-bench.mjs` | frame cost vs cast size |

**Run one viewport per process.** `bobit-recap.mjs` was OOM-killed three times sharing a single
Chromium across rows; it takes `RECAP_WIDTHS` / `RECAP_OWNED` / `RECAP_THEMES` for exactly this.
`bobit-play.mjs` costs ~500MB and has been killed four times — prefer the in-app mock.

**Driving a REAL cannon:** `__bobitScene` replays mid-question, where `aerialAllowed` is false and
the flight is suppressed onto the band. Do it the player's way — `&owned=1`, answer A, Next,
answer A — and take FULL-VIEWPORT screenshots, because the flight is on the fixed overlay.

---

## 6. Decisions a fresh session should not re-litigate

- **Crowd density is ACCEPTED.** At 100 bobits they sit ~18.7px apart while a cheering figure is
  ~20px wide. Chris, asked whether to stack them into rows: *"I know it will be dense, eventually
  we'll build buildings as stuff for them to climb on."* **Do not revive `slotPosition` /
  `rowsFor`** — they are dead code from the removed depth era and they do exactly the multi-row
  layout that would spend the buildings idea's budget on a worse version of it. The left margin
  is reserved for a later milestone.
- **Depth is gone.** One ground line, one size; height varies instead. A bobit walking a diagonal
  read as sliding, because the rig has no perspective gait.
- **The tree is room-owned, not a Scene.** A permanent structure inside a transient scene leaves
  when the scene does.
- **The climb is not scripted.** `assignPerch` sends somebody up once a branch exists.
- **Growing is for the moment the tree is earned, and only then.** Three passes to get right.
- **The recap is a separate component, not a mode flag** on `CollectionCrowd`. It needs none of
  the director, entrances, overlay, milestone latch or answer reactions.
- **Who is new comes from the decision that already exists.** `CollectionCrowd` computes `!known`
  to choose an entrance; `onBobitEarned` reuses it, so "walked in" and "bows at the recap" cannot
  disagree. It is deliberately *not* gated on `reducedMotion` — only the entrance is a motion
  effect.
- **Nothing on the recap reads the match result.** The room celebrates whether you won or lost.
  That is the entire point.

---

## 7. Left undone, and open questions

**Unfixed, known:**

- **390px recap overflows by 246px** — and overflowed by **232px before any bobit band existed**.
  A pre-existing layout problem; deliberately not folded into #117, which targets 1280.
- **At a 100-bobit roster the bowers are invisible.** Three in a wall of a hundred. The two-tier
  idea pays off early in a collection and not late.
- **The high-water mark is local even for signed-in players**, so a browser change re-earns the
  tree. `backend/` here is frozen and ev-accounts is another repo.
- **50% / 75% / 100% milestones.** Out of scope by the spec; the seam is real and the tree is the
  worked example.

**Open, needing a judgement:**

- **The descent's clock.** `climb` ratchets limbs *upward*; played unchanged coming down it may
  read as climbing up while moving down. Never caught on camera — `PERCH_DWELL_SEC` is 26s and no
  contact sheet spans it. **Unverified, not verified-fine.**
- **The canopy is a smooth dome.** Consistent with the flat-silhouette house style, and the
  furthest thing from the scribbled foliage Chris sketched. Cheap to roughen.
- **Whether the cannon should have a host at all.** Casting a real neighbour settled what a host
  IS, not whether the scene wants one.
- **Whether the yield pause (0.45–1.1s) is too polite.**
- **Whether the recap audience should ever fall quiet** and start again, rather than celebrating
  continuously.

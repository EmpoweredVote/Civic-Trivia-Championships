# Bobit Stage 2 — Performance Findings

**Date:** 2026-09-04
**Status:** Spike complete. Output is a recommendation; the harness is throwaway.

Measured on `spike/bobit-perf` against a throwaway `/perf-lab` route driven by Playwright.
Device classes are CDP CPU throttling rates. Idle crowd, `scale: 0.28`, DPR cap 1.5, 1280×900.

---

## The answer

**Is 154 bobits doable in a browser? Yes — but not on every phone.**

Frames per second at the real collection sizes, using the recommended batched draw:

| Device | 53 (smallest collection) | 91 (median) | 154 (largest) |
|---|---|---|---|
| Desktop | 60 | 60 | 60 |
| Fast phone (2× throttle) | 60 | 60 | 60 |
| Mid phone (3×) | 60 | 59 | **40** |
| Slow phone (4×) | 60 | **41** | **24** |

Maximum population holding 60fps:

| Device | naive (today) | batched | tile cache |
|---|---|---|---|
| Desktop | 446 | **611** | 548 |
| Fast phone (2×) | 160 | **197** | 198 |
| Mid phone (3×) | 79 | **105** | 101 |
| Slow phone (4×) | 53 | **55** | 55 |
| Old phone (6×) | 13 | 12 | 12 |

**The median collection (91) fits inside the mid-phone budget. The largest (154) does not.**

---

## Two hypotheses, both wrong

**1. "Phase-bucket tile caching gives roughly 4×."** It gives about 20%.

The reasoning was that 91 idlers playing one animation at different phases could share 24
pre-rendered tiles, replacing pose maths and ~15 path operations per figure with one blit.
The tiles do work exactly as predicted — they render once and serve any crowd size — but the
saving is small, because pose computation was never the expensive part. Trading path
rasterisation for texture blitting is close to a wash.

**2. "Unique-pose scenes are the real worst case, and must be measured separately."** They
cost the same as everything else.

Idle, stadium wave, and all-different-poses came out within noise of one another at every
population and every device class. The concern only made sense while the tile cache was
believed to be a large win — if the cache barely matters, defeating it barely matters.

Recording both because they shaped the Stage 1 plan, and the plan's reasoning should not be
trusted on this point.

---

## What is actually expensive

Canvas API call count, not fill.

The evidence is that shrinking figures barely helped the naive path (37.9ms at `scale: 0.20`
vs 36.0ms at `scale: 0.14`) while it helped the tile cache a lot (25.0ms → 18.8ms). A
fill-bound cost falls with area. A call-bound cost does not. DPR made almost no difference
either, in either direction — 1.0 was sometimes marginally *slower* than 1.5, which is noise,
and noise at that scale is itself the finding.

`draw()` issues a `beginPath`/`moveTo`/`lineTo`/`stroke` per limb segment — about 15 canvas
calls per figure per frame. At 154 figures that is ~2,300 calls every frame.

## The recommendation: batch by line width

A bobit is drawn in exactly **one colour**. Overlapping strokes of the same colour are
indistinguishable whatever order they are issued in, so the painter's order `draw()` carefully
maintains — back leg, back arm, torso, front leg, front arm, head — has no visible effect on a
plain figure. That frees the segments to be grouped by line width instead of by body part:

- one path for both legs (`legW`)
- one path for both arms (`armW`)
- one path for the torso (`torsoW`)
- one fill for the head

Four canvas calls instead of fifteen, worth about **+37% on desktop and +33% on a mid phone**
over the current path.

**Correction to a claim made in this document's first version.** I described the batched path
as producing identical pixels. It does not, and the difference was then measured rather than
assumed: `draw()` overlaps two round-capped capsules at each knee and elbow, while the batched
path draws one polyline with a round *join* there. Across all 46 animations at five times
each, about **15% of a figure's edge pixels change, by a mean of 6-10 of 255** (worst single
channel 128). Rendered side by side at 3x the shipping size the two are indistinguishable, and
at the size figures actually ship -- roughly 30px tall -- it is far below perception. If
anything the joined path is marginally cleaner, since two overlapping capsules
double-composite their antialiased edges where they meet and a join does not.

The right claim is *visually indistinguishable*, not *identical*.

It beats the tile cache at every device class while being roughly 40 lines with no warm-up
cost, no memory growth, no per-colour/scale/flip tile explosion, and no phase quantisation.

**Constraint:** valid only for a plain monochrome figure. Anything carrying a prop or a second
colour (the trophy pair, `witsend`'s desk, `elder`'s cane) must still go through `draw()`.
Since props only ever appear on a handful of figures and never on a crowd, this costs nothing
in practice.

## Recommended: drop the tile cache

It is beaten by a far simpler change, and it carries real costs the numbers do not show —
warm-up (8–11ms for 144 tiles), memory proportional to animation × colour × flip × 24, and a
visible seam wherever the cycle length is wrong. `poseCache.ts` should not graduate to
`main`; only `drawBatched` should.

---

## What this means for Stage 3

The spec's crowd is per-collection, so the population is 53–154 with a median of 91.

**Recommendation: cap the rendered crowd at 100.**

- It clears 60fps on a mid phone (measured cap 105).
- It fully contains the median collection (91) — most rooms render complete.
- Only collections above 100 need any degradation at all.

For the collections that exceed it, the cheapest honest option is to render the 100 nearest
and show the remainder as a count ("+54 more"), rather than dropping to a lower frame rate.
That keeps the crowd honest as a progress display while staying inside budget.

A silhouette-LOD for back-row figures was not measured — with the cap in place there was no
population left that needed it. Worth revisiting only if the cap is raised.

## Caveat on the device classes

CPU throttling slows JavaScript and the CPU side of rasterisation, but leaves the GPU alone. A
real mid-tier phone has a weaker GPU too, so **these numbers flatter mobile** — especially the
tile-cache column, which is blit-heavy and therefore the most GPU-bound of the three. Treat
the mid-phone cap of ~105 as an optimistic bound, which is a further argument for setting the
cap at 100 rather than at the measured edge.

## Reproducing

Everything is on `spike/bobit-perf` and is throwaway:

- `frontend/src/pages/PerfLab.tsx` + its `/perf-lab` route
- `frontend/scripts/perf-bench.mjs`
- `frontend/src/components/bobbits/poseCache.ts` (tile cache + `drawBatched`)

`npm run build && npm start`, then `node scripts/perf-bench.mjs`.

**Methodology note worth keeping.** The first version of the harness measured
frame-to-frame delta and reported exactly 16.7ms for every configuration, because
`requestAnimationFrame` is locked to the display refresh — it was measuring vsync, and would
have concluded that 154 was free everywhere. The harness now times the draw loop itself, with
a 1×1 `getImageData` to force a flush (measured cost: 0.2ms), and cross-checks against raw
frame count over a fixed wall-clock window.

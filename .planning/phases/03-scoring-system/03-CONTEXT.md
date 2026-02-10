# Phase 3: Scoring System - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side score calculation with base points (+100) and speed bonuses (up to +50), displayed throughout the game with animated feedback. Results screen shows detailed score breakdown. Maximum possible score: 1,500 (10 questions x 150 max per question).

</domain>

<decisions>
## Implementation Decisions

### Score display
- Score placement: Claude's discretion (pick best spot based on existing game screen layout)
- Score updates with pop + scale animation showing points earned, then settles to new total
- Score is static/hidden during question phase — updates only on answer reveal
- Wrong answers: subtle shake/red flash on the score area (no points change, but acknowledges the miss)

### Speed bonus feel
- 3 tiers: Fast (+50), Medium (+25), Slow (+0)
- Timer zone markers use existing color transitions (teal = fast, yellow = medium, red/orange = slow/none) — no separate indicators needed
- No text labels on timer — player learns zones through color alone
- After correct answer: separate floating popups — "+100" base then "+35 speed bonus" that merge into the total
- Speed bonus popup uses teal accent color to distinguish from base points (white/gold)
- Timeout ("Time's up!") is distinct from wrong answer — orange/amber text treatment, different from incorrect (red) and correct (green)

### Results breakdown
- Summary at top: total score with base vs speed bonus split (e.g., "1,250 pts — 1,000 base + 250 speed")
- Do NOT show theoretical max alongside actual score — just the score
- Per-question detail in the expandable review section: points badge (+150 or +0) visible on collapsed view, base + speed breakdown shown when expanded
- "Fastest answer" callout: highlight the question answered fastest with response time in seconds (e.g., "Fastest: Q3 (2.1s) — +150 pts")
- Perfect game (10/10): special visual treatment — golden score, different animation, "Perfect Game!" label
- Speed bonus stat card vs inline: Claude's discretion

### Anti-cheat / Server-side validation
- Full session tracking: server creates game session, serves questions, validates answers against that session
- Server calculates ALL scores — client never computes points
- Plausibility checks: flag impossible answers (e.g., <0.5s response time, answer after timeout)
- Per-answer timing vs batch submission: Claude's discretion (pick what works best with full session tracking)
- Handling failed plausibility checks: Claude's discretion (fair but not punitive for MVP)

### Claude's Discretion
- Exact score placement on game screen
- Speed bonus stat card placement on results screen
- Per-answer timing approach (real-time vs batch)
- Plausibility check failure handling
- Animation timing and easing for score popups

</decisions>

<specifics>
## Specific Ideas

- Speed bonus popups merging into the score should feel like a game show points reveal — brief drama, then clean
- Timer color zones doing double duty as bonus tier indicators keeps the UI clean — no extra chrome
- The "fastest answer" callout gives players a mini-achievement to feel good about even in imperfect games
- Orange/amber for timeout creates a clear 3-state system: green (correct), red (wrong), orange (timeout)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-scoring-system*
*Context gathered: 2026-02-10*

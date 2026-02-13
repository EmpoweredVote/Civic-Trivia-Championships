# Phase 6: Wager Mechanics - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can bet up to half their current score on the final question (Q10). The wager replaces standard scoring for Q10 — no base points, no speed bonus. This phase adds the wager flow, input UI, outcome reveal, and results integration. It does not add new question types, multiplayer wagering, or streak-based betting.

</domain>

<decisions>
## Implementation Decisions

### Wager flow & timing
- Wager screen appears BEFORE Q10 is revealed (blind wager, Final Jeopardy style)
- Category/topic of Q10 is shown as a hint on the wager screen so users can gauge confidence
- Dramatic pause after Q9: full-screen "FINAL QUESTION" announcement before wager screen
- Final question uses extended timer (longer than standard 25s, e.g., 45-60s)
- No speed bonus on final question — purely about the wager amount
- No base +100 points on Q10 — wager only for score impact
- Timeout on final question counts as wrong — user loses their wager
- Q10 correct answer still counts toward XP/gems progression (per-correct bonuses)

### Wager input design
- Slider input for selecting wager amount (0 to half of current score)
- Live-updating outcome display as slider moves: "If correct: {score + wager}" / "If wrong: {score - wager}"
- "Lock In Wager" confirmation button after selecting amount (matches existing lock-in UX pattern)
- Slider defaults to 25% of max wager (gentle nudge toward betting)

### Skip behavior
- No separate skip button — sliding to 0 IS the skip mechanism
- Wager of 0 means Q10 still plays with wager rules (extended timer, no base points) but nothing at risk
- Button text is context-aware: "Play for Fun" when slider is at 0, "Lock In Wager" when above 0

### Dramatic presentation
- Full-screen "FINAL QUESTION" announcement screen after Q9 completes (dedicated screen, not overlay)
- Final question card has distinct visual styling — different color scheme, special border/glow, badge
- Outcome reveal: dramatic count animation — score visibly climbs (win) or drops (loss) from current total
- Results screen has dedicated wager breakdown section showing bet amount and outcome separately from Q1-Q9

### Claude's Discretion
- Exact extended timer duration (somewhere in 45-60s range)
- Specific color scheme and glow effects for final question styling
- Animation timing and easing for the score count reveal
- "FINAL QUESTION" announcement screen design and duration
- Slider step increments and visual design

</decisions>

<specifics>
## Specific Ideas

- Final Jeopardy inspiration: blind wager with category hint, dramatic reveal
- The wager screen → question → outcome reveal should feel like a complete mini-experience within the game
- Score counting up/down after the answer creates the "moment of truth" tension
- Context-aware button text ("Play for Fun" vs "Lock In Wager") adds personality

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-wager-mechanics*
*Context gathered: 2026-02-12*

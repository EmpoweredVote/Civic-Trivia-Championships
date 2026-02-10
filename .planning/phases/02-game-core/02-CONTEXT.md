# Phase 2: Game Core - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can play a full 10-question trivia game with visual timer, answer selection, and explanations. This phase delivers the core gameplay loop: start game, present questions, accept answers with lock-in, reveal correct/incorrect with brief explanation, and show final results. Scoring calculation, deeper learning content, progression, and wager mechanics are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Question & answer layout
- Responsive answer grid: 2x2 on desktop, vertical stack on mobile
- Question text top-centered, prominent and large
- Minimal HUD: question number ("3 of 10"), timer, and question text only
- Letter labels on options (A, B, C, D) — classic game show style
- Keyboard shortcuts (A/B/C/D) for answer selection on desktop
- Subtle topic theming per question (small icon or accent color, same overall layout)
- Full immersive mode by default (no nav bar), with app-shell option in settings
- Difficulty level hidden from players — every question feels equal weight
- Progress dots (10 dots like Millionaire's money ladder) — neutral fill only, no correct/incorrect coloring
- Subtle gradient/pattern background — adds visual depth
- Who Wants to Be a Millionaire aesthetic: dark background, dramatic, centered
- Allow quit mid-game with confirmation dialog ("Are you sure?"), progress is lost

### Timer look & behavior
- Circular ring timer depleting clockwise, with numeric seconds countdown inside the ring
- 20 seconds per question
- Timer positioned in top-right corner
- Color transitions: teal → yellow → orange → red (Claude's discretion on exact transition timing)
- On timeout: brief "Time's up!" flash, then show correct answer and explanation
- No extra urgency effects in final seconds — red color change is sufficient

### Answer flow & reveal
- Two-step lock-in: first click highlights selection, second click or "Lock In" button confirms
- Player can change selection before confirming
- Brief 1-2 second suspense pause after lock-in before reveal (Millionaire style)
- During reveal: wrong options fade out, leaving correct answer highlighted (and wrong pick if applicable)
- 1-3 sentence explanation shown inline during reveal
- Auto-advance after reveal with "Next" button to skip ahead sooner

### Results screen
- Balanced display: score and accuracy given equal visual weight
- Accuracy shown as fraction (7/10)
- Expandable question-by-question review: shows question text, player's answer, correct answer, and explanation
- Review collapsed by default, "Review answers" button to expand
- Same visual treatment regardless of performance — no judgment, no performance-tiered messages
- No time stats on results screen
- Two action buttons: "Play Again" and "Home"

### Claude's Discretion
- Answer option color scheme (color-coded vs uniform)
- Question text overflow handling for long questions
- Transition animation between questions
- Game start flow (play button, countdown, etc.)
- Timer color transition timing thresholds
- Timer lifecycle (when it pauses/runs)
- Score entrance animation on results screen
- Exact spacing, typography, and visual polish details

</decisions>

<specifics>
## Specific Ideas

- "Who Wants to Be a Millionaire" is the primary aesthetic reference — dark, dramatic, centered, game-show feel
- Progress dots inspired by Millionaire's money ladder
- Suspense pause on answer reveal mirrors the dramatic Millionaire reveal moment
- Questions should feel like a game show, not a quiz app — the dark background + circular timer + letter-labeled options create that atmosphere

</specifics>

<deferred>
## Deferred Ideas

- "Learn more" deep-dive modal on answer reveal — Phase 4 (Learning & Content)
- "Save to review later" functionality for questions — add to backlog (new capability)

</deferred>

---

*Phase: 02-game-core*
*Context gathered: 2026-02-10*

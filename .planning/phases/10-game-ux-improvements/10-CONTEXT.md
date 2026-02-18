# Phase 10: Game UX Improvements - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Refine the game interface with better visual positioning, streamlined answer selection (single-click), and faster pacing. No new game features — this polishes the existing play experience.

</domain>

<decisions>
## Implementation Decisions

### Answer selection feel
- Single-click answering: tap = final answer, no lock-in confirmation step
- No accidental-tap safeguard — speed and decisiveness are part of the game
- **Exception: Q10 (wager question) keeps two-step lock-in** since stakes are higher with wagered points
- Non-selected answers dim/fade to ~30% opacity after selection, drawing focus to selected + correct
- Bold hover effect on answer buttons (glow, scale, or border change) to signal "click = final"
- Quick press-down animation (~50ms scale-down then bounce back) on click for tactile feedback
- Timer stops immediately on tap — time is locked in at moment of selection
- All input (keyboard shortcuts, clicks) locked after selection until reveal completes
- Existing shake animation for wrong answers stays as-is

### Pacing changes
- Question preview reduced from 2s to 1s (options appear after 1s instead of 2s)
- Suspense pause reduced from 1.5s to 0.75s (faster reveal after selection)
- Auto-advance reduced from 6s to 4s (after answer reveal)
- Question timer reduced from 25s to 20s (matches snappier overall pace)
- 50s final question timer unchanged

### Layout & spacing
- Question card positioned at 1/3 from top on desktop
- On mobile/small screens, question shifts up to ~1/4 from top to give answers more room
- Answer grid: 2x2 on desktop, single column stack on mobile
- Fixed max-width for question card and answer grid (centered, ~700px)
- Timer placement: Claude's discretion based on visual hierarchy goal (question → options → timer)

### Transitions & feedback
- Faster/snappier slide animation between questions (same left/right direction, quicker duration)
- Pulsing glow effect on selected answer during 0.75s suspense pause — builds tension
- Immediate dim on all non-selected options when correct answer reveals (no stagger)
- Score popup timing: Claude's discretion to match overall pacing

### Visual hierarchy
- Larger/bolder question text — clear visual dominance over answer options
- Question number (Q3 of 10) subtle/secondary — small, muted indicator
- Running score hidden during answering, only visible during reveal/transition between questions
- Learn More button appears below answer options after reveal

### Claude's Discretion
- Timer placement in the new layout
- Score popup animation timing adjustments
- Exact max-width values and responsive breakpoints
- Specific animation durations and easing curves
- Press-down animation implementation details

</decisions>

<specifics>
## Specific Ideas

- The overall feel should be snappier and more game-show-like — the current flow feels slightly sluggish
- Q10 wager question intentionally keeps two-step lock-in for dramatic stakes differentiation
- Pulsing glow during suspense is meant to build "will I get it right?" tension
- Bold hover effects should communicate "this button does something irreversible" without being anxiety-inducing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-game-ux-improvements*
*Context gathered: 2026-02-17*

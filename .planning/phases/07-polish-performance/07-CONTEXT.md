# Phase 7: Polish & Performance - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Accessibility compliance (WCAG AA), animation/celebration polish, and performance optimization for the complete game-show experience. All interactive elements keyboard navigable, screen reader support, color-independent indicators, timer extension setting, 60fps animations, and full game-show celebration effects.

</domain>

<decisions>
## Implementation Decisions

### Keyboard navigation
- Support both arrow keys + Enter AND number keys (1-4) for answer selection
- Arrow keys navigate between answers, Enter locks in; 1/2/3/4 selects directly
- Results screen accordions: Up/Down arrows move between questions, Enter/Space toggles expand
- Wager slider: Arrow keys adjust in steps of 10 points, Page Up/Down for jumps of 50
- Escape key closes modals/menus AND pauses the game timer during gameplay
- Custom focus rings matching game-show theme (teal/amber glow) instead of browser defaults
- Learn More modal: auto-focus into modal with focus trap until closed
- Skip-to-content link: Claude's discretion based on current nav structure

### Screen reader behavior
- Timer: threshold alerts only — announce at '10 seconds remaining', '5 seconds remaining', 'Time's up'
- Answer reveal: announce result + correct answer (e.g., "Correct! The answer is B, The Supreme Court. You earned 150 points.")
- Explanation text NOT auto-read — user can navigate to it manually
- Question number: announce only at start ("Question 1 of 10") and final ("Final Question"), not every transition

### Pause functionality
- Escape key pauses the game timer during active gameplay
- Pause overlay: dark overlay with 'Paused' text, question hidden to prevent extra reading time
- Pause options: Resume and Quit Game (quit navigates to home screen)

### Visual celebrations
- Full game-show level effects — confetti, particle bursts, bold animations
- Escalating streak celebrations:
  - 3-streak: small burst
  - 5-streak: bigger effect + label ("On Fire!")
  - 7+: dramatic celebration
- Perfect game (10/10): full-screen confetti rain + golden score treatment + special badge
- Question transitions: Claude's discretion on transition style

### Timer extension setting
- Located on profile page settings section
- Labeled neutrally as "Extended Time" (no accessibility-specific heading)
- User-selectable: 1.5x or 2x multiplier options
- Applies to both regular questions (25s) AND final question (50s) proportionally
- Stored as user preference, persists across sessions

### Color & contrast
- Timer: keep color transitions (teal → yellow → orange → red) but add pulsing/flashing at low time + icon changes at thresholds
- Answer feedback: add checkmark icon for correct, X icon for incorrect alongside existing color changes
- Full palette audit for WCAG AA (4.5:1 contrast ratio) — text, buttons, borders, backgrounds, decorative elements
- When adjustments needed: preserve current dark game-show feel by adjusting shades/tints rather than switching colors entirely

### Claude's Discretion
- Skip-to-content link implementation
- Question transition animation style
- Exact focus ring styling details
- Streak celebration visual design specifics
- Performance optimization strategies for 60fps

</decisions>

<specifics>
## Specific Ideas

- Pause overlay should hide the question text to prevent using pause as extra reading time
- Timer pulsing serves double duty: motion cue for accessibility AND dramatic tension for game feel
- "Extended Time" labeling removes stigma — anyone can use it without feeling singled out
- Celebrations should escalate to reward sustained performance, building toward the perfect game payoff

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-polish-performance*
*Context gathered: 2026-02-12*

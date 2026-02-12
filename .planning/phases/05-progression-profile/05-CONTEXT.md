# Phase 5: Progression & Profile - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users earn XP and gems per game completion, see rewards on the results screen, and can view a profile page with their stats and currency totals. XP formula: 50 base + 1 per correct answer. Gems formula: 10 base + 1 per correct answer. Profile shows games played, best score, and overall accuracy percentage. Progression persists to user profile.

</domain>

<decisions>
## Implementation Decisions

### Rewards on results screen
- XP and gems displayed alongside the existing score in the same container/card — unified stats row
- Count-up animation from 0 (matching existing score counter spring animation)
- Show totals only (e.g., "+57 XP", "+14 gems") — no base + bonus breakdown
- Icons + numbers only, no "Rewards Earned" label
- Perfect game (10/10) gets golden treatment matching existing amber/gold styling
- Hidden for anonymous users — only logged-in users see XP/gems earned
- Show earned amount only, not cumulative totals (profile shows totals)

### Profile page layout
- Accessed via hamburger menu item (not header avatar)
- Hero section: username and stats overview — identity-focused, not currency-focused
- Avatar: user-uploaded image with initials fallback (colored circle with initials if no image)
- Page structure: Claude's discretion (single page vs tabs based on content volume)

### XP & gems visual identity
- XP color: blue/cyan family
- Gems color: purple/amethyst family
- Icons: simple custom SVG icons (not emoji)
- Visibility: results screen + profile page only — not shown persistently in header

### Stats presentation
- Simple vertical list of label: value pairs (not stat cards)
- Three stats only: games played, best score, overall accuracy
- Accuracy as percentage only — no progress bar or visual indicator
- Empty state (0 games): encouraging message with CTA to play first game, not zeros

### Claude's Discretion
- Profile page structure (single page vs tabs)
- Stats data freshness approach (refresh on load vs real-time)
- Exact avatar upload UX
- SVG icon designs for XP and gems
- Spacing and typography within profile layout

</decisions>

<specifics>
## Specific Ideas

- Results screen rewards should feel like a natural extension of the existing score display — same container, same animation style
- Profile should lead with identity (who you are) not currency (what you have)
- Keep the profile clean and minimal — simple list for stats, not a dashboard

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-progression-profile*
*Context gathered: 2026-02-12*

# Phase 27: Backend Foundation & Inline Flagging - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish flag data collection infrastructure (database schema, API endpoints, rate limiting) and add an inline flag button to the answer reveal screen so authenticated players can thumbs-down questions during gameplay without interrupting game flow. Post-game elaboration (Phase 28), admin review queue (Phase 29), and admin integration (Phase 30) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Flag button design & placement
- Small flag icon in the corner of the question card — always visible but out of the way
- Icon only, with "Flag" tooltip label on hover/long-press — discoverable without cluttering the UI
- Flag icon (not thumbs-down) — neutral reporting symbol
- Flag icon area is excluded from the "tap anywhere to advance" zone — tapping the flag flags the question, tapping anywhere else still advances to next question

### Tap feedback & toggle states
- Color fill on tap — icon fills with amber/yellow to indicate flagged state (simple, clear state change)
- Amber/yellow flagged color — warm caution tone, stands out without feeling aggressive in a game context
- Brief fade transition when un-flagging — amber fades out smoothly to confirm the un-flag registered
- Flag state persists visually wherever flagged questions appear — including the results screen, not just the reveal screen

### Rate limit experience
- When rate-limited: flag icon becomes disabled/grayed out with tooltip "Too many flags — try again later"
- Icon stays visible but disabled when rate-limited — player knows the feature exists, just temporarily unavailable
- Rolling 15-minute window across sessions — prevents starting new games to bypass the limit
- One flag per user-question pair — same user flagging same question again doesn't create duplicate, counts as single signal for admin review

### First-time discoverability
- No onboarding hint — flag icon with hover label is self-explanatory
- Independent tooltip implementation — not sharing with the Learn More auto-tooltip system
- Flag icon appears on every question — not just wrong answers; players flagging correctly-answered questions is also useful signal
- Appears immediately on reveal — no animation delay, always available as soon as answer is revealed

### Claude's Discretion
- Exact corner placement within the question card (top-right likely, but adjust for layout)
- Flag icon size relative to other elements
- Database schema design for question_flags table
- API endpoint structure and error responses
- Rate limiting implementation approach (Redis vs database)
- Tooltip styling and positioning

</decisions>

<specifics>
## Specific Ideas

- Flag icon should feel like a utility, not a primary action — small, unobtrusive, but always available
- The "tap anywhere to advance" behavior must be preserved everywhere except the flag icon hit area
- Amber/yellow color should match the existing game palette (the app already uses amber for timeout states)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-backend-foundation-inline-flagging*
*Context gathered: 2026-02-21*

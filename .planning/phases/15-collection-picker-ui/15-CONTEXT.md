# Phase 15: Collection Picker UI - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Players can browse and select a community-specific trivia collection before starting a game. The picker lives on the existing dashboard. Collection CRUD, content creation, and expiration are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Picker placement & flow
- Collection cards appear directly on the dashboard, always visible (not collapsed)
- "Start Game" button stays at the top, collection cards sit below
- Federal Civics is preselected as default
- Collection name displays in the game header and on the results screen during gameplay

### Card visual design
- Rich cards with colored header/banner area per collection — feels like choosing a game mode
- Selected card is visually elevated (shadow/scale increase) with a colored border; unselected cards appear slightly receded
- Color-coded header band per collection (no icons/emoji for now)
- Cards arranged in a horizontal row on desktop

### Selection & start interaction
- Clicking a card selects it (highlighted) — does NOT auto-start the game
- Player hits "Start Game" button to begin with the selected collection
- Player can start without explicitly selecting — defaults to Federal Civics (zero-friction backward compat)
- Button text is dynamic: "Play Federal Civics", "Play Bloomington IN", etc.
- Last-played collection is remembered for next visit (localStorage or user profile)

### States & edge cases
- With only one collection: show the picker anyway (single card, preselected)
- Loading state: skeleton card placeholders that pulse/shimmer while API loads
- Collections with fewer than 10 questions are hidden from the picker (prevents bad experiences)
- Mobile: cards stack vertically on narrow screens (full-width per card)

### Claude's Discretion
- Exact card dimensions and spacing
- Color palette for collection header bands
- Skeleton card animation implementation
- Minimum question threshold (10 is the guideline, Claude can adjust if needed)
- localStorage vs user profile for remembering last-played collection
- Exact breakpoint for mobile stack behavior

</decisions>

<specifics>
## Specific Ideas

- "We may want an image of that location eventually" — for now, color-coded headers are sufficient
- Button text reflects selection: "Play [Collection Name]" pattern
- Rich cards should feel like choosing a game mode, not a settings dropdown

</specifics>

<deferred>
## Deferred Ideas

- Location images/photos on collection cards — future enhancement once image pipeline exists
- "Coming soon" placeholder cards for unreleased collections — revisit when more collections are available

</deferred>

---

*Phase: 15-collection-picker-ui*
*Context gathered: 2026-02-18*

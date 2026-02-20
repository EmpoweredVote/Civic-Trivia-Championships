# Phase 20: Admin Exploration UI - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Web interface for admin users to explore, filter, and inspect questions and collection health. Builds on the existing admin shell (red theme, sidebar nav) from Phase 18 and quality scores from Phase 19. This phase is read-only exploration — editing, bulk actions, and content management are future capabilities.

</domain>

<decisions>
## Implementation Decisions

### Question Table
- Full column set by default: question text, collection, difficulty, quality score, encounter count, correct rate, status, created date, violations count
- Default sort: quality score ascending (lowest first) — surfaces worst questions for review
- Per-column filter dropdowns (spreadsheet-style) for collection, difficulty, status
- Prominent search bar at top — search across question text, answer text, and explanation content
- Server-side pagination

### Question Detail View
- Opens as a slide-over panel from the right — table stays visible underneath
- Question text and all 4 answer options front and center (correct answer highlighted) — content-first layout
- Quality violations shown both ways: inline badges on relevant content AND a summary section below with all violations listed with severity tags
- Read-only — no actions (archive, edit, status change). Pure exploration for this phase
- Prev/next arrows in panel header to navigate between questions without closing the panel

### Collection Health Dashboard
- Numbers + progress bars for visualization — no charting library dependency
- All metrics given equal weight: question count, quality score distribution, difficulty spread, telemetry aggregates
- Overview grid of collection cards, each showing summary stats — click a card to expand full detail below (progressive disclosure)
- Color-coded health indicators on cards: red/yellow/green based on thresholds (e.g., question count vs minimum, quality distribution)

### Navigation & Filtering
- Filter state persists in URL query params (e.g., ?collection=us-federal&difficulty=hard) — shareable and bookmarkable
- Click-through from collection health dashboard to question table pre-filtered by that collection
- Admin dashboard landing page shows summary overview with high-level stats (total questions, collections needing attention) and links to drill into questions and collections
- Slide-over detail panel supports prev/next navigation between questions

### Claude's Discretion
- Exact pagination size and controls
- Progress bar styling and threshold values for color-coding
- Search debounce and implementation approach
- Responsive breakpoints for table on smaller screens
- Loading states and skeleton patterns
- Exact layout of the summary overview dashboard

</decisions>

<specifics>
## Specific Ideas

- Spreadsheet-style per-column dropdowns for filtering — familiar pattern for data exploration
- Slide-over panel keeps table visible for context while inspecting a question
- Quality score low-first default sort orients the tool toward content review workflow
- Progressive disclosure on collection dashboard: overview grid → click to expand detail

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-admin-exploration-ui*
*Context gathered: 2026-02-19*

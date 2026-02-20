# Phase 22: Admin Question Editing - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can edit questions inline from the detail panel (Phase 20), with automatic quality re-scoring and violation count updates on save. Also includes archive action from the detail panel. The question table row updates to reflect changes without full page reload.

</domain>

<decisions>
## Implementation Decisions

### Edit mode experience
- Edit button in the panel header toggles the entire panel into edit mode
- Fields become proper form inputs (input/textarea elements with borders) — clearly signals editing
- Save + Cancel buttons shown in edit mode — explicit action pair
- Confirmation dialog when admin has unsaved changes and tries to close panel or navigate away ("You have unsaved changes. Discard?")

### Options editing
- Always exactly 4 options — no add/remove
- Radio button next to each option to mark the correct answer
- Drag handles to reorder option positions (A/B/C/D)
- Option labels (A, B, C, D) visible next to each input — matches player view

### Quality feedback on save
- Quality scores and violations are **informational signals** — the admin is the ultimate arbiter
- Warn but allow save: if edit changes quality score or creates new violations, show a warning but never block the save
- Quality score and violations update in the database after save (data stays accurate)
- Updated score and violations refresh inline in the detail panel after save
- Before/after comparison shown: old score → new score, which violations changed

### Field types & constraints
- Difficulty: 1-10 numeric scale in admin editor (player-facing continues to show Easy/Medium/Hard)
- Question text and explanation fields support basic markdown (bold, italic, links)
- Visible character counts on question and explanation fields (e.g., "142/200")
- Source URL field validates URL format before saving — catches typos
- Options are plain text inputs (no markdown)

### Archive action
- Admin can archive a question directly from the detail panel (status change action)
- Fits naturally alongside edit — no separate workflow needed

### Claude's Discretion
- Exact character limits for each field
- Archive button placement and confirmation flow
- Loading/saving state indicators
- Markdown toolbar vs raw markdown input
- Exact drag-and-drop implementation for option reordering
- How before/after quality comparison is visually presented

</decisions>

<specifics>
## Specific Ideas

- "The admin is the ultimate arbiter" — quality rules, telemetry, and AI scores are data points that serve the admin, not gatekeepers
- Difficulty should eventually be informed by telemetry data (correct_count / encounter_count) — for now the 1-10 numeric scale is a manual admin input
- "Player facing should be Easy/Medium/Hard, outside of that a numeric scale makes a lot of sense"

</specifics>

<deferred>
## Deferred Ideas

- **Randomize option order per gameplay round** — shuffle A/B/C/D each time a player sees a question (gameplay engine change, not admin editing)
- **Thumbs up/down rating to train collection creators** — feedback system to improve AI generation quality (new capability, own phase)

</deferred>

---

*Phase: 22-admin-question-editing*
*Context gathered: 2026-02-19*

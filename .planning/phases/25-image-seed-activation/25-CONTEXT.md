# Phase 25: Image, Seed & Activation - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Fremont collection visible and playable in the collection picker. Add a branded banner image, export question data for the reproducible seed script, and activate the collection. All collection metadata (name, slug, description, theme color, sort order) was established in Phase 23. All questions (92 active) were generated and curated in Phase 24.

</domain>

<decisions>
## Implementation Decisions

### Banner image
- Subject: Mission Peak — Fremont's most iconic landmark
- Style: Clear day, vibrant — blue sky, green hills, crisp and bright
- Composition: With or without the summit pole — whichever photo looks best cropped to 112px-tall banner
- Source: Find a free-use (Creative Commons / public domain) photo online
- File: `frontend/public/images/collections/fremont-ca.jpg` (matches existing pattern)

### Collection card details
- Name: "Fremont, CA" — confirmed, matches Bloomington/LA pattern
- Description: "Five towns, one city — how well do you know Fremont?" — confirmed, no changes
- Theme color: #047857 (emerald green) — confirmed, distinct from other collections
- Sort order: 3 (Federal → Bloomington → Fremont → LA) — confirmed

### Seed & export
- Export scope: Active questions only (92) — exclude 31 draft questions
- Export tool: Build a reusable export-community.ts that works for any locale slug — useful for future collections
- Data location: Claude's discretion (follow existing pattern with backend/src/data/)
- Add `fremont-ca` entry to seed-community.ts LOCALES array
- Activation: Automatic via seed script — seed-community.ts already sets isActive: true, Fremont follows same pattern

### Claude's Discretion
- Exact image selection from available free-use Mission Peak photos (best fit for banner crop)
- Data file location (follow existing backend/src/data/ pattern)
- Export script implementation details
- Any necessary image resizing/optimization

</decisions>

<specifics>
## Specific Ideas

- Mission Peak is the signature Fremont landmark — the hilltop pole is instantly recognizable to locals
- Photo should feel vibrant and inviting, not moody or dramatic
- Export tool should be general-purpose so future locale collections can reuse it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-image-seed-activation*
*Context gathered: 2026-02-21*

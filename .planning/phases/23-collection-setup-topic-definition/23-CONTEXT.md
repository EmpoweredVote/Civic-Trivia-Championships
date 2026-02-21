# Phase 23: Collection Setup & Topic Definition - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure the Fremont, CA collection in the database and create the locale config file with topic categories, distribution targets, source URLs, and disambiguation rules. This phase produces the configuration that Phase 24 (Question Generation) consumes. No questions are generated in this phase.

</domain>

<decisions>
## Implementation Decisions

### Collection branding
- Sort order: 3rd position (between Bloomington and LA) — LA moves to sort order 4
- Description tone: diversity angle — lean into Fremont's five-town consolidation and multicultural identity (e.g., "Five towns, one city — how well do you know Fremont?")
- External ID prefix: `fre` (fre-001, fre-002, etc.)
- Collection slug: `fremont-ca` (following existing pattern)

### Topic distribution
- History + Culture heavy — civic history and landmarks/culture get 18-20 questions each
- Budget & finance gets slightly more than standard: 12-15 questions (Tesla economic story, Measure E, housing costs)
- County topic includes regional context — Alameda County governance PLUS regional agencies (BART, AC Transit, Bay Area regional bodies) that directly serve Fremont
- State government topic uses general California civics — may overlap with LA collection, that's acceptable
- Remaining categories (city government, local services, elections & voting) get standard 8-12 each
- Target ~100 questions total

### Content guardrails
- Tesla/NUMMI: cover BOTH economic impact (jobs, tax revenue, supply chain) AND land use/zoning (NUMMI closure, factory reuse, environmental review, city council decisions) — the full civic story
- Ohlone/Indigenous: land acknowledgment level — 1-2 respectful questions about Ohlone presence, not deep dive into ongoing political efforts
- Five-district consolidation (1956): should be represented across multiple categories, not just civic history

### Claude's Discretion
- Theme color selection (should visually differentiate from LA's ocean blue and Bloomington's deep red)
- Icon identifier choice
- Mission San Jose disambiguation approach (determine per-question when explicit era/district labels are needed vs. when context is sufficient)
- Little Kabul / Afghan-American community framing (Claude determines appropriate balance of celebration and civic context with cultural sensitivity)
- Exact question counts per category within the ranges above

</decisions>

<specifics>
## Specific Ideas

- Description should evoke the five-town consolidation story — it's unique to Fremont and makes a good hook
- Existing California state config (from LA collection) can be reused/referenced for state-level sources
- Fremont's position as 3rd in sort order groups it near other community collections while keeping Federal first

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-collection-setup-topic-definition*
*Context gathered: 2026-02-20*

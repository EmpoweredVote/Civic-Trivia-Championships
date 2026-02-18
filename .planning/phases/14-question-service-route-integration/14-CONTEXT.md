# Phase 14: Question Service & Route Integration - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Swap the game's data layer from JSON file reads to PostgreSQL database queries via a QuestionService. Game sessions accept an optional collection scope, defaulting to Federal Civics. All existing game behavior (timer, scoring, wager, results, progression, plausibility) must work identically with database-sourced questions. Zero user-facing regression.

</domain>

<decisions>
## Implementation Decisions

### Question selection logic
- First question is always **easy** difficulty, last question (Q10) is always **hard** difficulty
- Questions 2-9 are a **balanced mix** of difficulties (~3 easy, ~3 medium, ~2 hard spread)
- Avoid questions the player saw in their **last 2-3 games** (~20-30 questions)
- If constraints can't be met (small collection, few unseen questions), **relax constraints** — drop difficulty ordering rules and fill with whatever's available rather than allowing repeats

### Fallback & error handling
- If database is unreachable at game start, **silently fall back to JSON** file
- Player sees no indication of fallback — console log only for dev/ops visibility
- JSON fallback serves the **flat 120-question pool** with no collection filtering or difficulty ordering
- **Auto-retry database on each new game start** — fallback is per-request, not sticky

### API contract
- Response shape for questions stays **identical** to existing format — DB questions transformed to match
- Game session **includes collection metadata** (collectionName, collectionSlug) so results screen and future features can reference which collection was played
- All code paths that consume question data go **through QuestionService** — single point of access

### JSON file lifecycle
- questions.json stays in the codebase permanently as the **silent fallback**
- File is a **frozen snapshot** of the original 120 federal questions — never updated to match DB changes
- JSON is historical reference and emergency fallback only; database is the source of truth

### Claude's Discretion
- How `collectionId` flows from frontend to backend (body field vs route param vs query param — pick based on existing API patterns)
- Whether to add a `GET /api/collections` listing endpoint in this phase or defer to Phase 15
- Whether learning content is served from the database (check Phase 13 schema) or stays JSON-sourced
- Exact balanced difficulty distribution algorithm for questions 2-9
- QuestionService internal architecture (class vs module, caching strategy)

</decisions>

<specifics>
## Specific Ideas

- "First pick question should always be easy, last question should always be hard" — the game should feel like a progression from warm-up to challenge
- Fallback pattern mirrors Phase 9's Redis graceful degradation approach, but silent (no banner)
- Decision from STATE.md: "Database as single source of truth" — JSON is backup only, not authoritative

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-question-service-route-integration*
*Context gathered: 2026-02-18*

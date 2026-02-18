# Phase 13: Database Schema & Seed Migration - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Move questions from JSON to PostgreSQL, create the collections data model with topic taxonomy, and seed the existing 120-question federal bank. The database becomes the single source of truth. This phase creates the foundation every downstream v1.2 feature depends on.

</domain>

<decisions>
## Implementation Decisions

### Collection metadata
- Each collection stores: name, slug, description, locale metadata, icon identifier, theme color, isActive boolean, sort_order integer
- No difficulty indicator on collections — derive from questions if needed later
- Collections have an active/inactive toggle for visibility control (only active collections appear in picker)
- sort_order field controls display order in the Phase 15 collection picker

### Topic taxonomy
- Primary category uses the existing `topic` field (7 values for Federal: Constitution, Amendments, Branches of Government, Elections, Civic Participation, Supreme Court, U.S. History)
- `topicCategory` (9 values) kept as an optional subcategory for finer granularity
- Topics stored in a dedicated topics table — collections define which topics are valid
- Topics can be shared across collections (e.g., "Elections" used by Federal and Bloomington) or collection-specific (e.g., "Indiana State" only in Bloomington)
- Each collection links to its valid topics; questions reference topics by ID

### Seed scope
- Seed all three collections: Federal (active, with 120 questions), Bloomington IN (inactive, empty), Los Angeles CA (inactive, empty)
- Bloomington and LA start inactive — hidden from picker until Phase 17 populates them with questions
- Database is the single source of truth after migration — JSON file stays in repo as historical reference but is never read by the app
- Migration includes a rollback script that can revert schema changes

### Learning content handling
- Learning content stored as a JSONB column on the questions table (null for questions without content)
- Full migration of all learning content fields: paragraphs, corrections (per-wrong-answer explanations), and source
- Source URL/name is a required field for ALL questions — enforces authoritative sourcing for civic content credibility
- The 87 questions currently without sources will have authoritative sources added during the migration (AI-assisted sourcing)

### Claude's Discretion
- Exact table column types and constraints
- Index strategy for query performance
- Migration script tooling (raw SQL, Knex, Drizzle, etc.)
- JSONB structure for learning content
- Rollback implementation approach

</decisions>

<specifics>
## Specific Ideas

- "Start the game with an easy question and end with a hard one, rest can be random" — noted for Phase 14 (Question Service) question selection logic, not schema
- Use existing Supabase setup (EV-Backend-Dev, `civic_trivia` schema) — no new infrastructure needed
- All 120 federal questions must have authoritative source URLs after migration — no exceptions for civic content

</specifics>

<deferred>
## Deferred Ideas

- Question ordering within games (easy first, hard last) — Phase 14 Question Service logic
- Collection difficulty indicators — derive from questions if needed in future phases

</deferred>

---

*Phase: 13-database-schema-seed-migration*
*Context gathered: 2026-02-18*

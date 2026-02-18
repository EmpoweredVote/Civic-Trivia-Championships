# Project Research Summary

**Project:** Civic Trivia Championship v1.2 -- Community Collections
**Domain:** Civic education trivia with locale-specific content collections
**Researched:** 2026-02-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

Civic Trivia Championship v1.2 adds community-specific question collections (Bloomington IN, Los Angeles CA) to an existing deployed federal civics trivia game. The core architectural shift is migrating questions from a single JSON file loaded at server startup to PostgreSQL (already in the stack via Supabase), introducing a `collections` table, a `questions` table, and a junction table for tag-based membership. This migration is the critical path -- every other v1.2 feature (collection picker, expiration, content generation) depends on questions living in the database. The existing stack handles all requirements with only one new runtime dependency (`node-cron` for expiration scheduling). Zero frontend dependencies need to be added.

The recommended approach is a phased build starting with the database schema and seed migration, then swapping the question loading layer (with backward compatibility so the existing game never breaks), then adding the collection picker UI and expiration system in parallel. Content generation for Bloomington and LA runs as a parallel workstream but is gated by the database layer being ready. The most important insight from research: content creation is the bottleneck, not code. Technical work is estimated at 7-10 days; content creation for two communities is 5-10 days and carries the highest risk.

The two most dangerous risks are (1) AI hallucination on local government facts, especially for small cities like Bloomington where LLM training data is sparse, and (2) breaking the existing federal game during the JSON-to-database migration. Both are preventable: hallucination requires a RAG-from-authoritative-sources approach with mandatory local reviewer sign-off; migration safety requires keeping the JSON file as a fallback and making the `collectionId` parameter optional so omitting it produces identical v1.1 behavior.

## Key Findings

### Recommended Stack

The existing stack (React 18, TypeScript, Express, PostgreSQL via Supabase, Redis) handles all v1.2 requirements. One new runtime dependency is needed.

**Core technologies (all existing, no changes):**
- **PostgreSQL (Supabase):** Questions migrate from JSON to PostgreSQL using relational tables for collections/tags and JSONB for nested content (options, learningContent)
- **`pg` client (`^8.11.3`):** Already installed for user data; now also handles question queries
- **`@headlessui/react` (`^2.2.9`):** Collection picker UI via RadioGroup/Listbox -- no new frontend packages
- **`@anthropic-ai/sdk` (`^0.74.0`):** Enhanced content generation scripts for locale-aware question creation

**New dependency:**
- **`node-cron` (`^3.0.3`):** Hourly expiration sweep -- lighter than Render cron jobs, simpler than `setInterval`

**Explicitly not adding:** ORM (Prisma/Drizzle), migration tool (Knex), full-text search, i18n library, Redis caching for questions, admin dashboard framework, job queue (BullMQ). Each was evaluated and rejected with rationale in STACK.md.

### Expected Features

**Must have (table stakes):**
- TS-1: Collection picker screen (card-based grid, not dropdown)
- TS-2: Collection-scoped question loading (backend accepts `collectionId`)
- TS-3: Collection metadata registry (name, locale, description, question count)
- TS-4: Question tagging with collection membership (junction table)
- TS-5: Backward-compatible default collection (Federal becomes "Federal Civics")
- TS-6: Minimum collection size enforcement (floor of 30, target 50-80)

**Should have (differentiators):**
- D-1: Time-sensitive question expiration (hard expiration with `expiresAt` date)
- D-2: Collection health endpoint (admin JSON endpoint showing active/expiring counts)
- D-5: Community contributor attribution (optional `contributor` field)
- D-6: Per-collection topic categories (replacing hardcoded federal-only enum with collection-defined categories)

**Defer to post-alpha:**
- D-3: Locale-aware collection suggestions (only 2-3 communities -- manual selection is fine)
- D-4: Mixed collection mode / "Surprise Me" (need more collections first)
- All anti-features: user-generated questions, real-time editing, dynamic difficulty, push notifications, nested hierarchies, cross-collection leaderboards

### Architecture Approach

The architecture change is surgical: only the session creation step needs to know about collections. Once questions are selected and stored in the Redis session, everything downstream (answering, scoring, plausibility detection, results) is unchanged. Three new backend services (`QuestionService`, `CollectionService`, `ExpirationService`) replace the single `readFileSync` + in-memory array pattern. The frontend adds a `CollectionPicker` component on the Dashboard that passes `collectionId` to the existing game start flow.

**Major components:**
1. **QuestionService** -- Replaces in-memory `allQuestions[]` with PostgreSQL queries filtered by collection and expiration
2. **CollectionService** -- CRUD and listing for collection metadata with active question counts
3. **ExpirationService** -- Hourly cron that sets `is_active = false` on expired questions and logs results
4. **CollectionPicker (frontend)** -- Card grid on Dashboard using Headless UI; passes selection to `POST /session`
5. **Seed migration script** -- One-time idempotent migration of 120 federal questions from JSON to PostgreSQL

**Database schema:** 3 new tables (`questions`, `collections`, `collection_questions` junction), using string IDs for human-readability, JSONB for nested content, and relational joins for the tag/collection dimension that is actually queried.

### Critical Pitfalls

1. **AI hallucination on local government content** -- LLMs have sparse training data for small cities like Bloomington. Prevention: source-first RAG approach (scrape bloomington.in.gov first, then generate), mandatory local reviewer sign-off, reject any question not traceable to an authoritative source.

2. **Breaking existing game during migration** -- The current `readFileSync` + module-scope array is deeply embedded. Prevention: keep JSON as fallback, make `collectionId` optional (null = v1.1 behavior), feature flag `USE_COLLECTIONS`, integration test the full game flow after every migration step.

3. **Content expiration removing questions mid-game** -- Sessions already snapshot full Question objects in Redis, so active games are safe. But expiration must be soft-delete only, with a 24-hour grace period before removal from new game selection.

4. **Collection size imbalance killing replayability** -- A 10-question game from a 15-question pool means 67% repetition. Prevention: minimum 40 questions before a collection goes live; display smaller collections as "Coming Soon."

5. **Tag taxonomy rot** -- Without governance, tags proliferate into synonyms and case variants. Prevention: controlled vocabulary from day one, canonical lowercase-hyphenated format, hierarchical prefixes (`locale:`, `topic:`).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Database Schema + Seed Migration

**Rationale:** Everything depends on questions being in PostgreSQL. This is the critical path with zero parallel alternatives.
**Delivers:** `questions`, `collections`, and `collection_questions` tables populated with 120 federal questions tagged as "Federal Civics" collection. Seed migration script that is idempotent and preserves existing `q001`-`q120` IDs.
**Addresses:** TS-3 (collection registry), TS-4 (question tagging), TS-5 (default federal collection)
**Avoids:** Pitfall #2 (migration breakage) by keeping JSON as fallback, Pitfall #8 (data loss) by using JSONB for nested content and running validation script post-migration

### Phase 2: Question Service + Route Integration

**Rationale:** Must swap the data access layer before any collection-aware features can work. This phase makes the game query PostgreSQL instead of JSON.
**Delivers:** `QuestionService` class, modified `POST /api/game/session` accepting optional `collectionId`, removal of `readFileSync` pattern. Existing "Quick Play" works identically (backward compatible).
**Addresses:** TS-2 (collection-scoped loading)
**Avoids:** Pitfall #2 (breaking existing game) by making `collectionId` optional with null defaulting to Federal collection

### Phase 3: Collection Picker UI

**Rationale:** With the backend ready to serve collections and filter questions, the frontend can present the selection UI. This is the user-facing milestone.
**Delivers:** `CollectionPicker` component on Dashboard, `GET /api/collections` endpoint, collection cards with name/description/question count. "Quick Play" preserved as default path.
**Addresses:** TS-1 (collection picker screen), TS-6 (minimum size enforcement -- collections below threshold shown as "Coming Soon")
**Avoids:** Pitfall #9 (anonymous play friction) by keeping a prominent "Play Now" default path

### Phase 4: Question Expiration System

**Rationale:** Independent of the collection picker but requires questions in the database (Phase 1-2 complete). Can be built in parallel with Phase 3 or after it.
**Delivers:** `ExpirationService` with hourly `node-cron` schedule, soft-delete of expired questions, structured logging of deactivations, collection health check for below-minimum warnings.
**Addresses:** D-1 (time-sensitive expiration), D-2 (collection health endpoint)
**Avoids:** Pitfall #3 (mid-game removal) via session snapshot isolation and soft-delete only, Pitfall #6 (notification fatigue) by starting with structured logs only (no email)

### Phase 5: Content Generation + Community Questions

**Rationale:** Requires database layer (Phase 1-2) to store generated questions. This is the highest-risk and longest phase due to content quality concerns.
**Delivers:** Enhanced `generateCollectionQuestions.ts` script with locale-aware prompts, RAG-from-source approach, review JSON workflow, actual Bloomington IN and Los Angeles CA question content (target 50-80 questions each), per-collection topic categories (D-6).
**Addresses:** D-6 (per-collection topic categories), D-5 (contributor attribution), locale-specific content for both communities
**Avoids:** Pitfall #1 (AI hallucination) via source-first generation and local reviewer requirement, Pitfall #7 (quality disparity) via source audit before generation and quality parity standard, Pitfall #11 (cost overruns) via batch checkpointing and cost estimation

### Phase Ordering Rationale

- **Phase 1 before everything:** All researchers independently identified the JSON-to-PostgreSQL migration as the foundational dependency. No collection feature works without it.
- **Phase 2 immediately after Phase 1:** Swapping the data access layer validates the migration and unblocks all downstream phases.
- **Phases 3, 4, and 5 are parallelizable** after Phase 2. The architecture research explicitly notes Steps 3, 4, and 5 in the dependency graph are independent of each other.
- **Content generation (Phase 5) is the bottleneck.** Technical work across Phases 1-4 is estimated at 5-7 days. Content creation for two communities is 5-10 days. Starting content work as soon as the database layer is ready is essential.
- **Expiration (Phase 4) before content generation completes** ensures the expiration infrastructure exists before time-sensitive local questions are added.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Content Generation):** Highest risk phase. AI hallucination on local facts is the top pitfall. Needs phase-level research into Bloomington IN and LA source material availability, RAG pipeline design, and content review workflow. No established patterns exist for volunteer-maintained civic trivia content.
- **Phase 4 (Expiration):** Moderate uncertainty around grace period timing, expiration priority tiers, and how to handle collections dropping below minimum size. Start with the simplest implementation (hourly sweep, soft delete, structured logging) and iterate.

Phases with standard patterns (skip deep research):
- **Phase 1 (Schema + Migration):** Well-documented PostgreSQL patterns. The schema design is validated across all research files. Idempotent seed migration is a standard pattern.
- **Phase 2 (Service Layer):** Straightforward refactor from in-memory array to database queries. The QuestionService pattern is fully specified in ARCHITECTURE.md with working code sketches.
- **Phase 3 (Collection Picker):** Standard UI pattern using existing Headless UI components. Every trivia platform reviewed uses card-based category selection.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack verified by codebase analysis. One new dependency (`node-cron`). All "what NOT to add" decisions well-reasoned. |
| Features | MEDIUM-HIGH | Table stakes well-established from trivia platform patterns. Expiration design borrowed from CMS/LMS platforms. Content authoring workflow has no established patterns for this specific domain. |
| Architecture | HIGH | Based entirely on direct codebase analysis. Schema design follows standard PostgreSQL tagging patterns. Service layer and route changes are fully specified with code sketches. |
| Pitfalls | HIGH | Critical pitfalls identified from codebase analysis (migration risk) and domain research (AI hallucination). Integration risks mapped to specific files and line numbers. |

**Overall confidence:** MEDIUM-HIGH

The technical implementation path is HIGH confidence -- the stack, schema, architecture, and integration points are well-understood. The MEDIUM areas are all content-related: AI hallucination rates on small-city civic facts, content review workflow design, and volunteer contributor management. These are domain risks, not engineering risks.

### Gaps to Address

- **Content generation pipeline for local civic facts:** No validated approach exists for generating accurate locale-specific civic trivia via AI. The RAG-from-authoritative-sources recommendation is sound in principle but untested at this scale. Address during Phase 5 planning with a proof-of-concept for one locale before committing to both.
- **Volunteer contributor workflow:** No established patterns found for managing volunteer civic content contributors. Needs to be designed from scratch during Phase 5, informed by open-source project contribution models (PR-based review).
- **Expiration notification timing:** When to alert about expiring questions (30 days? 60 days?) has no civic-specific guidance. Start with 60 days and adjust based on observed content maintenance velocity.
- **Per-collection topic categories implementation:** The recommendation is collection-defined categories (not a global enum), but the TopicIcon component refactor and how to handle icons for arbitrary categories needs design work during Phase 3/5.
- **Session display of collection name:** Open question whether the results screen should show which collection was played. Low-stakes decision but should be made explicitly during Phase 3.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `backend/src/routes/game.ts`, `backend/src/services/sessionService.ts`, `backend/src/data/questions.json`, `backend/schema.sql`, `backend/package.json`
- [PostgreSQL JSON Types Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [Render Cron Jobs Documentation](https://render.com/docs/cronjobs)
- [iCivics Platform](https://ed.icivics.org/) -- civic education game organization patterns
- Gameful civic engagement peer-reviewed research (ScienceDirect)

### Secondary (MEDIUM confidence)
- [node-cron npm](https://www.npmjs.com/package/node-cron) -- scheduling library selection
- [When to Avoid JSONB in PostgreSQL (Heap)](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema) -- relational vs JSONB decision
- [AI Hallucination Report 2026](https://www.allaboutai.com/resources/ai-statistics/ai-hallucinations/) -- 10-20% domain-specific hallucination rates
- [CDT: AI in Local Government](https://cdt.org/insights/ai-in-local-government-how-counties-cities-are-advancing-ai-governance/) -- verification requirements
- [CITE Journal: Civic Education in the Age of AI](https://citejournal.org/proofing/civic-education-in-the-age-of-ai-should-we-trust-ai-generated-lesson-plans/) -- AI poor at regional civic facts
- [Open Trivia Database API](https://opentdb.com/api_config.php) -- category-based trivia patterns
- Content expiration patterns from Kontent.ai, Liferay, Sensei LMS
- Taxonomy management from Alpha Solutions, Parse.ly

### Tertiary (LOW confidence)
- [Bloomberg Cities: Small City Data Capacity](https://bloombergcities.jhu.edu/news/how-small-cities-can-make-big-leaps-data) -- data availability disparity
- Individual UX case studies and blog posts on trivia game design

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*

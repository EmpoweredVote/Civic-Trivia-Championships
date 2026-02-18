---
phase: 13-database-schema-seed-migration
plan: 01
subsystem: database
tags: [drizzle, postgresql, migrations, schema, jsonb]

# Dependency graph
requires:
  - phase: v1.1 (Phases 1-12)
    provides: Existing PostgreSQL connection and users table
provides:
  - Collections data model with 5 tables (collections, topics, questions, junction tables)
  - Drizzle ORM schema definitions with TypeScript types
  - SQL migration with indexes, constraints, and JSONB columns
  - Rollback script for schema reversion
affects: [14-question-service-route-integration, 15-collection-picker-ui, 16-expiration-system, 17-community-content-generation]

# Tech tracking
tech-stack:
  added: [drizzle-orm, drizzle-kit]
  patterns: [junction-tables for many-to-many, JSONB for semi-structured data, timestamptz for all temporal data, CHECK constraints for validation, GIN indexes for JSONB queries]

key-files:
  created:
    - backend/src/db/schema.ts
    - backend/drizzle.config.ts
    - backend/src/db/migrations/0001_create_collections_topics_questions.sql
    - backend/rollback.sql
  modified:
    - backend/package.json

key-decisions:
  - "Use Drizzle ORM for type-safe schema definitions with SQL-centric approach"
  - "Store learning content as JSONB column (null for questions without content)"
  - "Source field is required JSONB for ALL questions (enforces authoritative sourcing)"
  - "Junction tables use composite primary keys without surrogate IDs"
  - "All timestamps use timestamptz for timezone-aware temporal data"
  - "GIN index with jsonb_path_ops for performant learning content queries"

patterns-established:
  - "Pattern 1: Drizzle ORM schema definitions in src/db/schema.ts with inferred TypeScript types"
  - "Pattern 2: SQL migrations in src/db/migrations/ with explicit rollback scripts"
  - "Pattern 3: civic_trivia schema for collections domain (separate from public.users)"
  - "Pattern 4: CHECK constraints for enum validation (difficulty, correct_answer range)"

# Metrics
duration: 4 min
completed: 2026-02-18
---

# Phase 13 Plan 01: Database Schema & Seed Migration Summary

**Drizzle ORM schema with 5 tables, JSONB learning content, CHECK constraints, GIN indexes, and complete migration SQL**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T20:25:20Z
- **Completed:** 2026-02-18T20:29:26Z
- **Tasks:** 2/2
- **Files modified:** 5 created, 1 modified

## Accomplishments
- Installed Drizzle ORM and Drizzle Kit for type-safe PostgreSQL schema management
- Created schema.ts with 5 tables: collections, topics, collection_topics, questions, collection_questions
- Generated and applied SQL migration with all foreign keys, indexes, and CHECK constraints
- Verified tables exist in civic_trivia schema with proper constraints
- Created rollback.sql for complete schema reversion

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Drizzle ORM and create schema definitions** - `1f7873e` (chore)
2. **Task 2: Run migration against database and create rollback script** - `9f09bf0` (feat)

**Plan metadata:** (to be added after STATE.md update)

## Files Created/Modified
- `backend/src/db/schema.ts` - Drizzle table definitions for all 5 tables with TypeScript types
- `backend/drizzle.config.ts` - Drizzle Kit configuration for civic_trivia schema
- `backend/src/db/migrations/0001_create_collections_topics_questions.sql` - Forward migration SQL
- `backend/rollback.sql` - Reverse migration script with DROP TABLE CASCADE statements
- `backend/src/db/migrations/meta/_journal.json` - Drizzle Kit migration metadata
- `backend/src/db/migrations/meta/0000_snapshot.json` - Schema snapshot for Drizzle Kit
- `backend/package.json` - Added drizzle-orm dependency and npm scripts (db:generate, db:migrate, db:seed)

## Decisions Made

**1. Drizzle ORM over Prisma or raw SQL**
- Rationale: TypeScript-first ORM with SQL-centric approach; lightweight, zero dependencies, ideal for serverless; better TypeScript inference than Knex; less abstraction overhead than Prisma

**2. JSONB columns for options, source, and learning content**
- Rationale: Options are always 4-element arrays (not text[]); source is required structured object; learning content is optional with variable structure; JSONB enables GIN indexing for queries

**3. Source field required for ALL questions**
- Rationale: CONTEXT.md mandates authoritative sourcing for civic content credibility; promotes to top-level NOT NULL column (not buried in learningContent)

**4. Learning content structure without nested source/topic**
- Rationale: Source and topic are promoted to question columns; learningContent JSONB stores only paragraphs and corrections (the optional deep-dive content)

**5. CHECK constraints for difficulty and correctAnswer**
- Rationale: Database-level validation prevents invalid data at source; difficulty limited to 'easy', 'medium', 'hard'; correctAnswer must be 0-3 for 4-option questions

**6. GIN index with jsonb_path_ops on learning_content**
- Rationale: Optimized for containment queries (@>); smaller and faster than default jsonb_ops for this use case

**7. Partial indexes on is_active and expires_at**
- Rationale: Most queries filter active collections or non-null expiration dates; partial indexes reduce index size and improve performance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - Drizzle ORM and PostgreSQL migration applied successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Database schema complete with all 5 tables, indexes, and constraints
- Ready for Phase 13 Plan 02: Research authoritative sources for 87 unsourced questions
- After Plan 02, ready for Phase 13 Plan 03: Seed collections, topics, and migrate 120 questions

**Blockers:** None

**Concerns:**
- Plan 02 (source research) is highest risk - AI hallucination on authoritative URLs requires verification of every suggested source
- Learning content migration structure needs validation during seed (Plan 03)

---
*Phase: 13-database-schema-seed-migration*
*Completed: 2026-02-18*

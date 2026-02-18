---
phase: 13-database-schema-seed-migration
plan: 03
subsystem: database
tags: [drizzle, postgresql, seed-data, migrations, civic-education]

# Dependency graph
requires:
  - phase: 13-database-schema-seed-migration
    plan: 01
    provides: Database schema with 5 tables (collections, topics, collection_topics, questions, collection_questions)
  - phase: 13-database-schema-seed-migration
    plan: 02
    provides: sources.json with authoritative source mappings for all 120 questions
provides:
  - Drizzle database instance wrapping existing pg Pool
  - Seed scripts for collections, topics, and questions data
  - 3 collections seeded (Federal active, Bloomington/LA inactive)
  - 15 topics seeded and linked to Federal collection
  - 120 questions migrated from JSON with full content, sources, and learning content
  - Idempotent seed script with transaction-wrapped operations
affects: [14-question-service-route-integration, 15-collection-picker-ui, 17-community-content-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle database instance pattern wrapping existing pg Pool"
    - "Idempotent seed scripts using ON CONFLICT DO NOTHING"
    - "Transaction-wrapped seed operations for atomicity"
    - "JSON-to-database migration with topic ID mapping"
    - "ANALYZE after bulk inserts for fresh query planner statistics"

key-files:
  created:
    - backend/src/db/index.ts
    - backend/src/db/seed/collections.ts
    - backend/src/db/seed/topics.ts
    - backend/src/db/seed/questions.ts
    - backend/src/db/seed/seed.ts
  modified: []

key-decisions:
  - "Load dotenv in seed script to access DATABASE_URL environment variable"
  - "Store learning content as JSONB with only paragraphs and corrections (source promoted to separate column)"
  - "Map both title case and lowercase topic variants from questions.json to normalized slugs"
  - "Link all 15 topics to Federal collection (ready for Phase 14 question selection)"

patterns-established:
  - "Pattern 1: Seed scripts import dotenv/config at top for environment variable access"
  - "Pattern 2: Seed data separated into modules (collections.ts, topics.ts, questions.ts)"
  - "Pattern 3: Question migration validates source presence and logs mismatches for verification"
  - "Pattern 4: Seed orchestrator uses transaction wrapping for atomicity and rollback capability"

# Metrics
duration: 3 min
completed: 2026-02-18
---

# Phase 13 Plan 03: Database Schema & Seed Migration Summary

**Database seeded with 3 collections, 15 topics, and 120 migrated federal civics questions with authoritative sources from .gov/.edu sites**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T22:02:39Z
- **Completed:** 2026-02-18T22:05:48Z
- **Tasks:** 2/2
- **Files modified:** 5 created

## Accomplishments
- Created Drizzle database instance wrapping existing pg Pool for use by seed scripts and future queries
- Seeded 3 collections: Federal Civics (active), Bloomington IN (inactive), Los Angeles CA (inactive)
- Seeded 15 topics (7 primary + 8 subcategory) linked to Federal collection
- Migrated all 120 questions from JSON with full content, sources, and learning content preservation
- All 120 questions now have authoritative sources (0 NULL sources, satisfies NOT NULL constraint)
- Seed script is idempotent (safe to re-run) with transaction wrapping for rollback capability

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Drizzle database instance and seed data modules** - `71e7009` (feat)
2. **Task 2: Create question migration module and run seed** - `2cc461e` (feat)

## Files Created/Modified
- `backend/src/db/index.ts` - Drizzle database instance wrapping existing pg Pool with schema
- `backend/src/db/seed/collections.ts` - 3 collection seed objects (Federal, Bloomington, LA)
- `backend/src/db/seed/topics.ts` - 15 topic seed objects plus slug mapping for question migration
- `backend/src/db/seed/questions.ts` - Question migration logic transforming JSON to database format
- `backend/src/db/seed/seed.ts` - Main seed orchestrator with transaction-wrapped operations

## Decisions Made

**1. Load dotenv in seed script**
- Rationale: tsx doesn't automatically load .env files, but dotenv is already installed as a dependency. Adding `import 'dotenv/config'` at the top of seed.ts enables access to DATABASE_URL without additional tooling.

**2. Learning content JSONB structure**
- Rationale: Source and topic are promoted to question-level columns (source is NOT NULL, topicId is FK to topics table). learningContent JSONB stores only the optional deep-dive content (paragraphs and corrections), not metadata fields.

**3. Handle topic name variants in questions.json**
- Rationale: Some questions use "Constitution" (title case), others use "constitution" (lowercase). Created mapping that handles both variants to avoid migration errors.

**4. Link all 15 topics to Federal collection**
- Rationale: Phase 15 collection picker will filter questions by collection+topic. Linking all topics upfront enables flexible question selection in Phase 14 without additional seed operations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added dotenv import to seed script**
- **Found during:** Task 2 (Running seed script)
- **Issue:** tsx doesn't automatically load .env files, causing "password authentication failed" error when seed script tried to connect to database
- **Fix:** Added `import 'dotenv/config'` at top of seed.ts to load environment variables
- **Files modified:** backend/src/db/seed/seed.ts
- **Verification:** Seed script ran successfully and connected to database
- **Committed in:** 2cc461e (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to unblock seed execution. No scope creep.

## Issues Encountered

None - seed script ran successfully after dotenv fix, all verifications passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 14 (Question Service & Route Integration):**
- Database is the single source of truth for question data
- All 120 federal questions available with full content (options, explanations, learning content, sources)
- Federal collection is active; Bloomington and LA are inactive placeholders
- Topics table contains Federal's 7 primary + 8 subcategory topics, all linked to Federal collection
- Each question references a topic by ID (enables efficient JOIN queries)
- Source column populated for ALL 120 questions (authoritative sourcing enforced)

**Blockers:** None

**Concerns:** None - seed script is idempotent and all verifications passed

---
*Phase: 13-database-schema-seed-migration*
*Completed: 2026-02-18*

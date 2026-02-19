---
phase: 17-community-content-generation
plan: 01
subsystem: api
tags: [anthropic, zod, cheerio, p-limit, rag, content-generation, civic-trivia, typescript]

# Dependency graph
requires:
  - phase: 16-expiration-system
    provides: status='draft'|'active'|'expired' question lifecycle that generated questions slot into
  - phase: 13-collection-schema
    provides: DB schema (questions, topics, collections, collection_questions junction)
provides:
  - Reusable content generation pipeline for locale-specific civic trivia questions
  - Zod validation schema matching DB questions table
  - Anthropic client with prompt caching support
  - Two locale configs (Bloomington IN, LA CA) with 8 topic categories each, 100 question targets
  - RAG source fetcher (cheerio-based HTML-to-text, p-limit concurrency)
  - Database seeder inserting questions at status='draft'
  - CLI orchestrator with --locale, --batch, --fetch-sources, --dry-run flags
affects:
  - 17-02 (Bloomington question generation — runs this pipeline)
  - 17-03 (LA question generation — runs this pipeline)

# Tech tracking
tech-stack:
  added:
    - zod@4.3.6 (schema validation for AI-generated question batches)
    - cheerio@1.2.0 (HTML parsing for RAG source document extraction)
    - p-limit@7.3.0 (concurrency control for source URL fetching)
  patterns:
    - Prompt caching via cache_control: ephemeral on RAG source document blocks
    - ON CONFLICT DO NOTHING for idempotent question seeding
    - status='draft' for all AI-generated questions requiring human review

key-files:
  created:
    - backend/src/scripts/content-generation/anthropic-client.ts
    - backend/src/scripts/content-generation/question-schema.ts
    - backend/src/scripts/content-generation/prompts/system-prompt.ts
    - backend/src/scripts/content-generation/locale-configs/bloomington-in.ts
    - backend/src/scripts/content-generation/locale-configs/los-angeles-ca.ts
    - backend/src/scripts/content-generation/rag/fetch-sources.ts
    - backend/src/scripts/content-generation/rag/parse-sources.ts
    - backend/src/scripts/content-generation/utils/seed-questions.ts
    - backend/src/scripts/content-generation/generate-locale-questions.ts
  modified:
    - backend/package.json (added zod, cheerio, p-limit)

key-decisions:
  - "Use Zod schema validation (not zod-to-json-schema) — parse response text directly, simpler than tool_use"
  - "expiresAt as nullable ISO 8601 string in Zod (converted to Date for DB insert)"
  - "p-limit(3) for concurrent source fetches — avoids overwhelming .gov servers"
  - "cache_control: ephemeral on last source document block — caches entire source prefix"
  - "status='draft' for all generated questions — admin activates after review"
  - "ON CONFLICT DO NOTHING for idempotent seeding — safe to re-run batches"

patterns-established:
  - "LocaleConfig interface in bloomington-in.ts — imported by all locale configs and main script"
  - "Locale config dynamic import pattern — main script loads config based on --locale CLI arg"
  - "ensureLocaleTopics() before seedQuestionBatch() — topics must exist before questions"
  - "Source documents prefixed with [DOCUMENT: filename] for AI context awareness"

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 17 Plan 01: Content Generation Infrastructure Summary

**Reusable civic trivia generation pipeline with Zod validation, RAG source fetching, and Anthropic prompt caching — seeds questions as status='draft' for two locale configs (Bloomington IN, LA CA)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T08:16:12Z
- **Completed:** 2026-02-19T08:22:43Z
- **Tasks:** 3
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments

- Built complete generation pipeline: locale config → RAG fetch → Anthropic API → Zod validation → DB seed
- Created Bloomington and LA locale configs each with 8 topic categories summing to exactly 100 target questions
- Implemented prompt caching on RAG source documents using cache_control: ephemeral to reduce API costs across batches
- Seeder inserts questions at status='draft' with ON CONFLICT DO NOTHING for safe re-runs

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create core utilities** - `66e1424` (feat)
2. **Task 2: Create locale configs, system prompt, and RAG fetcher** - `fd34bef` (feat)
3. **Task 3: Create main generation script and database seeder** - `25cc991` (feat)

## Files Created/Modified

- `backend/src/scripts/content-generation/anthropic-client.ts` - Configured Anthropic client (maxRetries: 3, timeout: 120s), MODEL constant
- `backend/src/scripts/content-generation/question-schema.ts` - Zod QuestionSchema + BatchSchema matching DB questions table
- `backend/src/scripts/content-generation/prompts/system-prompt.ts` - buildSystemPrompt() with all CONTEXT.md decisions encoded
- `backend/src/scripts/content-generation/locale-configs/bloomington-in.ts` - bloomingtonConfig with 8 topics, 16 source URLs
- `backend/src/scripts/content-generation/locale-configs/los-angeles-ca.ts` - losAngelesConfig with 8 topics, 14 source URLs
- `backend/src/scripts/content-generation/rag/fetch-sources.ts` - fetchSources() with cheerio + p-limit(3) concurrency
- `backend/src/scripts/content-generation/rag/parse-sources.ts` - loadSourceDocuments() prefixes docs with filename for AI context
- `backend/src/scripts/content-generation/utils/seed-questions.ts` - ensureLocaleTopics() + seedQuestionBatch() with draft status
- `backend/src/scripts/content-generation/generate-locale-questions.ts` - Main CLI orchestrator with all flags
- `backend/package.json` - Added zod, cheerio, p-limit dependencies
- `backend/package-lock.json` - Updated lockfile

## Decisions Made

- **Zod parse over tool_use:** Used BatchSchema.parse() on response text rather than Anthropic tool_use for simpler implementation. zod-to-json-schema not needed.
- **expiresAt as nullable string in Zod schema:** Converted to Date object at DB insert time, avoids Zod datetime issues with the DB layer.
- **cache_control on last source doc block:** Applying ephemeral cache to the last source document caches the entire prefix (system prompt + all source docs), maximizing cache efficiency across batches.
- **LocaleConfig interface exported from bloomington-in.ts:** Shared interface between all locale configs and the main script to avoid duplication.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- npx tsx -e inline eval had module resolution issues with Windows/MINGW paths — used a project-relative test file for verification instead. No impact on generated code.

## User Setup Required

None - no external service configuration required for the tooling itself. Running the script requires ANTHROPIC_API_KEY in backend/.env (already documented in existing scripts).

## Next Phase Readiness

- Plan 02 can immediately run: `npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale bloomington-in --fetch-sources`
- Plan 03 can run: `npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale los-angeles-ca --fetch-sources`
- Admin needs to activate generated questions (change status from 'draft' to 'active') before they appear in gameplay
- If first batch generates poor quality, the --batch 1 --dry-run flow lets reviewer validate before committing to DB

---
*Phase: 17-community-content-generation*
*Completed: 2026-02-19*

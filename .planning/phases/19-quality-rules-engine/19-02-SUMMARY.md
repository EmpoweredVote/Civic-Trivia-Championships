---
phase: 19-quality-rules-engine
plan: 02
subsystem: api
tags: [database-migration, audit-script, quality-scoring, reporting, postgresql]

# Dependency graph
requires:
  - phase: 19-01
    provides: Quality rules engine with auditQuestion function
provides:
  - Database column (quality_score) for persisting quality assessments
  - Reusable audit script that evaluates all active questions against quality rules
  - Console summary with per-collection breakdown and violation counts
  - Detailed markdown report (audit-report.md) for inspection and record-keeping
affects: [19-03-archival-system, 20-admin-ui, 21-generation-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [database-migration, sql-aggregation, batch-processing, markdown-generation]

key-files:
  created:
    - backend/src/scripts/migrate-quality-score.ts
    - backend/src/scripts/audit-questions.ts
  modified:
    - backend/src/db/schema.ts
    - backend/package.json

key-decisions:
  - "quality_score starts as NULL (not 100) because questions haven't been audited yet"
  - "Index uses DESC NULLS LAST for efficient sorting in admin UI"
  - "Audit script is reusable (not one-time) with CLI flags for different modes"
  - "Console summary includes after-archival counts and OK/WARNING status per collection"
  - "Markdown report lists blocking violations first, then advisory, then all by score"
  - "--save-scores is optional flag (allows dry-run without persisting)"

patterns-established:
  - "Database migrations follow migrate-telemetry.ts pattern (IF NOT EXISTS, process.exit)"
  - "Audit script uses SQL aggregation for collection memberships (array_agg)"
  - "Progress indicators every 50 questions for long-running audits"
  - "Markdown report provides complete audit trail for record-keeping"

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 19 Plan 02: Quality Score Migration & Audit Script Summary

**Database migration adding quality_score column with index, and comprehensive audit script producing console summary and markdown report for all 320 questions**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-20T00:55:24Z
- **Completed:** 2026-02-20T00:58:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added quality_score INTEGER column to questions table (nullable, no default - scores populated after audit)
- Created descending index with NULLS LAST for efficient admin UI sorting
- Built comprehensive audit script that evaluates all 320 active questions against quality rules
- Console summary shows total counts, per-collection breakdown with after-archival projections, and violation summaries
- Markdown report (audit-report.md) provides detailed inspection with blocking violations first, advisory second, all questions by score
- Optional --save-scores flag persists quality_score to database
- Optional --skip-url-check flag enables fast dry-run without network calls
- Verified: All 320 questions audited, 9 blocking violations, 119 advisory violations, all collections remain >= 50 after archival

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration for quality_score column** - `f51cbeb` (feat)
   - migrate-quality-score.ts following migrate-telemetry.ts pattern
   - ALTER TABLE with IF NOT EXISTS for idempotency
   - Created descending index: idx_questions_quality_score DESC NULLS LAST
   - Updated schema.ts with qualityScore: integer('quality_score') field
   - Added qualityScoreIdx to table indexes
   - Verified column exists in database with NULL values

2. **Task 2: Dry-run audit script with console and markdown output** - `1034306` (feat)
   - audit-questions.ts with CLI flag parsing (--skip-url-check, --save-scores)
   - SQL aggregation query with array_agg for collection memberships
   - Batch processing with progress indicators every 50 questions
   - Console summary: counts, per-collection breakdown (total/pass/block/advisory/after-archival/status), violation summaries
   - Markdown report: summary table, collection impact, blocking violations, advisory violations, all questions by score
   - Optional score persistence to database via --save-scores flag
   - npm script: npm run audit-questions
   - Verified: 320 questions audited, scores saved to database, report generated

## Files Created/Modified

- `backend/src/scripts/migrate-quality-score.ts` - Idempotent migration adding quality_score INTEGER column and descending index
- `backend/src/db/schema.ts` - Added qualityScore field and qualityScoreIdx to questions table
- `backend/src/scripts/audit-questions.ts` - Comprehensive audit orchestrator with console/markdown reporting and optional score persistence
- `backend/package.json` - Added "audit-questions" npm script

## Decisions Made

1. **quality_score starts as NULL (not 100):** Questions haven't been audited yet, so NULL indicates "not yet scored". After audit runs with --save-scores, scores get populated. This prevents false positives of "everything is perfect" before audit.

2. **Index design:** Created descending index with NULLS LAST. Descending order means highest quality scores appear first in admin UI. NULLS LAST ensures unscored questions don't pollute the top of sorted lists.

3. **Audit script is reusable:** Not a one-time migration script. Can be re-run at any time with different flags. Will be used in Phase 21 after new questions are generated.

4. **Console summary includes after-archival counts:** Shows projected collection sizes after blocking violations are archived. Displays OK (>= 50) or WARNING (< 50) status to identify collections at risk.

5. **Markdown report structure:** Blocking violations listed first (these will be archived), then advisory violations (flagged but stay active), then complete ranked list by score. Provides complete audit trail.

6. **--save-scores is optional:** Allows dry-run inspection without committing scores to database. User can review audit-report.md before persisting scores with second run.

7. **SQL aggregation for collections:** Used raw SQL with array_agg to fetch all collection memberships in single query. More efficient than N+1 queries in Drizzle ORM.

8. **Progress indicators:** Console logs every 50 questions during audit. Gives user confidence that long-running audit (with URL checks) is progressing.

## Deviations from Plan

None - plan executed exactly as written. All verification criteria met.

## Issues Encountered

**1. TypeScript type mismatches (auto-fixed during implementation)**
- **Issue:** Missing `difficulty` field in QuestionInput construction, `ruleId` vs `rule` property name mismatch
- **Fix:** Added difficulty field to QuestionRow interface and SQL query, replaced all `ruleId` references with `rule` (correct property name from types.ts)
- **Impact:** TypeScript compilation passes with zero errors

## User Setup Required

None - migration and audit script work out of the box with existing database connection.

## Audit Results Summary

**From initial audit run (--skip-url-check mode):**

- **Total questions:** 320
- **Passing all rules:** 192 (60%)
- **Blocking violations:** 9 questions (2.8%) - would be archived
- **Advisory only:** 119 questions (37.2%) - flagged for review

**Per-collection breakdown:**
| Collection | Total | Pass | Block | Advisory | After Archival | Status |
|------------|-------|------|-------|----------|----------------|--------|
| Bloomington, IN | 100 | 96 | 4 | 0 | 96 | OK (>= 50) |
| Federal Civics | 120 | 0 | 1 | 119 | 119 | OK (>= 50) |
| Los Angeles, CA | 100 | 96 | 4 | 0 | 96 | OK (>= 50) |

**Blocking violation breakdown:**
- pure-lookup: 6 questions
- ambiguous-answers: 3 questions

**Advisory violation breakdown:**
- missing-citation: 120 questions (mostly Federal Civics - citations in learning content, not explanation)
- partisan-framing: 1 question

**Collection health:** All three collections remain well above 50-question threshold after archival. No collections at risk of being hidden.

## Next Phase Readiness

**Ready for Phase 19 Plan 03 (Archive Blocking Violations):**
- quality_score column exists in database
- All 320 questions have been audited and scored
- 9 questions identified with blocking violations ready for archival
- Per-collection impact is known (all collections remain healthy)
- Audit report provides documentation trail

**Ready for Phase 20 (Admin UI):**
- quality_score column available for display and sorting
- Scores are populated (0-100 scale)
- Index optimized for descending sort in admin UI

**Ready for Phase 21 (Generation Pipeline):**
- Audit script is reusable for newly generated questions
- --skip-url-check enables fast pipeline integration
- --save-scores can persist scores immediately after generation

**No blockers.** Ready to proceed with archival implementation.

---
*Phase: 19-quality-rules-engine*
*Completed: 2026-02-20*

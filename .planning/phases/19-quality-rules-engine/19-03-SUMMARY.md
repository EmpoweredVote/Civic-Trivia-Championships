---
phase: 19-quality-rules-engine
plan: 03
subsystem: api
tags: [archival-system, soft-delete, collection-threshold, quality-enforcement, postgresql]

# Dependency graph
requires:
  - phase: 19-01
    provides: Quality rules engine with auditQuestion function and skipUrlCheck option
  - phase: 19-02
    provides: Database quality_score column and audit script
provides:
  - Soft-delete archival system for questions with blocking quality violations
  - Collection picker threshold increased from 10 to 50 questions minimum
  - Reusable archive script with --dry-run and --skip-url-check flags
  - Automated per-collection health reporting showing impact of archival
affects: [20-admin-ui, 21-generation-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [soft-delete-archival, collection-health-monitoring, selective-validation]

key-files:
  created:
    - backend/src/scripts/archive-violations.ts
  modified:
    - backend/src/routes/game.ts

key-decisions:
  - "URL validation deferred for existing 320 questions - all have broken source.url links (technical debt)"
  - "Only content-quality violations archived (9 questions: ambiguous answers, pure lookup)"
  - "Collection threshold raised from 10 to 50 to ensure robust gameplay"
  - "--skip-url-check flag enables content-only validation without network calls"
  - "Archive script includes pre/post verification with collection health status"

patterns-established:
  - "Archival uses status='archived' soft delete (questions remain in database)"
  - "Quality scores saved for ALL questions during archive operation (not just archived ones)"
  - "Collection health reporting shows current/after counts with OK/HIDDEN status"
  - "Archive operations are atomic (all or nothing) with transaction support"

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 19 Plan 03: Archive Blocking Violations Summary

**Soft-delete archival system that archived 9 content-quality violations while deferring URL validation for existing questions, updated collection threshold to 50, and preserved collection health with automated reporting**

## Performance

- **Duration:** 3 minutes
- **Started:** 2026-02-19T21:53:29Z
- **Completed:** 2026-02-19T21:56:34Z
- **Tasks:** 2 (continued after checkpoint)
- **Files modified:** 2

## Accomplishments

- Built reusable archive violations script with dry-run preview and collection health reporting
- Implemented soft-delete archival (status='archived') maintaining database referential integrity
- Updated collection picker threshold from 10 to 50 questions for robust gameplay
- Added --skip-url-check flag to enable content-quality validation without URL network calls
- Archived 9 questions with content-quality violations (ambiguous answers, pure lookup)
- Deferred URL validation for existing 320 questions (all have broken source.url - technical debt)
- Verified all 3 collections remain above 50-question threshold (Bloomington: 96, Federal: 119, LA: 96)
- Saved quality scores for all 320 questions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create archive violations script and update collection threshold** - `71c9f29` (feat)
   - archive-violations.ts with fetch/audit/archive/verify workflow
   - Collection impact calculation with current/toRemove/after breakdown
   - Pre-archival summary with questions to archive and per-collection impact table
   - Post-archival verification with VISIBLE/HIDDEN status based on threshold
   - Quality score persistence for all audited questions
   - Updated game.ts MIN_QUESTION_THRESHOLD from 10 to 50
   - Added --dry-run flag for safe preview mode

2. **Task 2: Add --skip-url-check flag for content-only validation** - `d8b6dd1` (feat)
   - Added skipUrlCheck flag to parseFlags() function
   - Passed flag through to runAudit() for selective validation
   - Adjusted batch size (50 for content-only, 10 for full validation)
   - Console messages explaining URL check status
   - Updated usage documentation in header comment

**Plan metadata:** [not committed yet - will be committed with this summary]

## Files Created/Modified

- `backend/src/scripts/archive-violations.ts` - Reusable archival script that fetches active questions, runs quality audit, calculates collection impact, archives blocking violations, saves quality scores, and verifies collection health
- `backend/src/routes/game.ts` - Updated MIN_QUESTION_THRESHOLD constant from 10 to 50, ensuring only collections with robust question counts appear in picker

## Decisions Made

1. **URL validation deferred for existing questions:** All 320 existing questions have broken source.url links (Learn More URLs). The previous CMS used different URL structure. Running full validation would flag all 320 questions for archival, destroying the entire question bank. User chose Option B: Skip URL validation for existing questions, archive only content-quality violations (9 questions). URL validation remains active in the quality rules engine for Phase 21's generation pipeline - new questions will be validated at creation time. This is tracked as technical debt.

2. **--skip-url-check flag implementation:** Archive script now accepts --skip-url-check flag to enable content-quality-only validation. This avoids network calls to broken URLs and processes questions 5x faster (50/batch vs 10/batch). Flag will be used for existing question maintenance while full validation is reserved for new question generation.

3. **Collection threshold raised to 50:** Previous 10-question minimum was too low for good gameplay (high repetition, limited variety). 50 questions provides enough variety for engaging sessions with minimal repeat exposure. All 3 collections exceed this threshold after archival (Bloomington: 96, Federal: 119, LA: 96).

4. **Quality scores saved for all questions:** Archive operation saves quality_score for all 320 questions, not just the 9 archived ones. This populates the database for Phase 20 admin UI sorting and Phase 21 generation pipeline comparisons.

5. **Soft-delete approach:** Questions are archived via status='archived' soft delete rather than database deletion. This maintains referential integrity, preserves historical data, enables restoration if needed, and supports audit trails. Gameplay routes already filter by status='active', so archived questions are automatically excluded.

## Deviations from Plan

None - plan executed exactly as written after checkpoint resolution. User decision (Option B: skip URL validation) was anticipated in plan design as checkpoint:decision.

## Issues Encountered

**1. URL validation would destroy question bank (resolved via checkpoint)**
- **Issue:** Initial dry-run revealed all 320 existing questions have broken source.url links (legacy CMS issue)
- **Resolution:** Paused at checkpoint:decision, presented user with two options, user selected Option B (defer URL validation)
- **Impact:** Preserved 311 quality questions that would have been incorrectly archived for URL issues unrelated to content quality

## Archival Results Summary

**From archive operation with --skip-url-check:**

- **Total active questions before:** 320
- **Questions archived:** 9 (2.8%)
- **Active questions after:** 311 (97.2%)
- **Quality scores saved:** 320 (all questions)

**Questions archived:**
- q059: ambiguous-answers (Federal Civics)
- bli-006, bli-017, bli-071, bli-086: pure-lookup + ambiguous-answers (Bloomington, IN)
- lac-029, lac-036, lac-041, lac-099: pure-lookup (Los Angeles, CA)

**Per-collection health (after archival):**
| Collection | Active Questions | Status |
|------------|------------------|--------|
| Bloomington, IN Civics | 96 | VISIBLE (>= 50) |
| Federal Civics | 119 | VISIBLE (>= 50) |
| Los Angeles, CA Civics | 96 | VISIBLE (>= 50) |

**All collections remain healthy and playable.** No collections fell below 50-question threshold.

## User Setup Required

None - archival script uses existing database connection and environment variables.

## Next Phase Readiness

**Ready for Phase 20 (Admin UI):**
- Archived questions have status='archived' for filtering
- Quality scores populated for all questions (0-100 scale)
- Collection picker enforces 50-question minimum automatically
- Archive script can be re-run to handle future violations

**Ready for Phase 21 (Generation Pipeline):**
- Archive script is reusable with --dry-run and --skip-url-check flags
- Quality rules engine validates new questions at creation time
- Full URL validation active for new questions (skipUrlCheck: false by default)
- Collection threshold prevents weak collections from appearing in picker

**Technical debt to address:**
- **URL validation for existing questions:** All 320 existing questions have broken source.url links. This should be fixed in a dedicated URL update phase. Options: bulk update URLs from new CMS, scrape/verify Learn More links, or manually review/update. URL validation remains active for Phase 21 new questions, so this only affects the legacy question bank.

**No blockers.** Quality rules engine foundation complete. Ready for admin UI and generation pipeline integration.

---
*Phase: 19-quality-rules-engine*
*Completed: 2026-02-19*

---
phase: 21-generation-pipeline-new-collections
plan: 05
subsystem: content-generation
tags: [ai-generation, replacement-questions, quality-validation, collection-health]

# Dependency graph
requires:
  - phase: 21-plan-01
    provides: Quality validation pipeline (validateAndRetry)
  - phase: 19-quality-rules-engine
    provides: Archived question data, quality rules
provides:
  - Replacement generation script (generate-replacements.ts)
  - 38 replacement questions restoring collection health
  - Replacement generation report
affects: [collection-health, gameplay-collections]

# Tech tracking
tech-stack:
  added: []
  patterns: [replacement-generation, topic-gap-analysis]

key-files:
  created:
    - backend/src/scripts/content-generation/generate-replacements.ts
    - backend/src/scripts/data/reports/generation-replacements-2026-02-20.json
  modified: []

key-decisions:
  - "50/50 split between archived-topic matches and topic gap fillers"
  - "Generated ~20 per affected collection to account for validation failures"
  - "Used city system prompt (not state) since these are city-level collection replacements"

patterns-established:
  - "Replacement generation workflow: query archived → identify gaps → generate targeted replacements → validate → insert"

# Metrics
duration: 16min
completed: 2026-02-20
---

# Phase 21 Plan 05: Replacement Question Backfill Summary

**38 quality-validated replacement questions generated for Bloomington and LA collections — restoring collection sizes above pre-archival counts with topic gap filling**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-20T04:00:00Z
- **Completed:** 2026-02-20T04:16:00Z
- **Tasks:** 2 (+ 1 checkpoint verified)
- **Files created:** 2 (script + generation report)

## Accomplishments

- Created generate-replacements.ts script that queries archived questions and generates targeted replacements
- Generated 38 replacement questions across 2 affected collections (20 Bloomington, 18 LA)
- 98% pass rate (38/39 generated passed quality validation)
- Bloomington collection: 96 → 116 active questions (well above 50 threshold)
- Los Angeles collection: 96 → 114 active questions (well above 50 threshold)
- Mix of archived-topic replacements (50%) and topic gap fillers (50%)
- Generation cost: ~$0.15

## Task Commits

1. **Task 1: Create replacement generation script** - `9a156c4` (feat)
2. **Task 2: Run replacement generation** - `1c3cd27` (feat)

## Files Created/Modified

- `backend/src/scripts/content-generation/generate-replacements.ts` - Replacement question generation script with archived question analysis and topic gap identification
- `backend/src/scripts/data/reports/generation-replacements-2026-02-20.json` - Generation report with per-collection breakdown

## Decisions Made

- Used 50/50 split between archived-topic matches and topic gap fillers per CONTEXT.md
- Targeted civic-history topic for gap filling (had < 8 active questions per collection)
- Used city system prompt (buildSystemPrompt) since these are city-level collection replacements

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

1 question failed after all retry attempts — pure-lookup violation that couldn't be reformulated. 38/39 success rate is acceptable.

## User Setup Required

None - ANTHROPIC_API_KEY already configured.

## Next Phase Readiness

All collections restored above pre-archival levels. No collection below 50-question threshold. Collection health dashboard should show green indicators for all collections.

---
*Phase: 21-generation-pipeline-new-collections*
*Completed: 2026-02-20*

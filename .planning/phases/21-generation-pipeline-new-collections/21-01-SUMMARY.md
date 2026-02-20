---
phase: 21-generation-pipeline-new-collections
plan: 01
subsystem: content-generation
tags: [ai-generation, quality-validation, claude-api, phase-19-integration]

# Dependency graph
requires:
  - phase: 19-quality-rules-engine
    provides: Quality rules engine (auditQuestion, types, scoring)
  - phase: 17-city-generation
    provides: Anthropic client, question schema, generation patterns
provides:
  - Quality guidelines text for embedding in AI prompts
  - Validation+retry pipeline with feedback loop
  - Generation report structure and persistence
affects: [21-02-state-templates, 21-03-indiana-generation, 21-04-california-generation, 21-05-replacement-questions]

# Tech tracking
tech-stack:
  added: []
  patterns: [validation-with-retry-loop, feedback-based-regeneration, structured-generation-reports]

key-files:
  created:
    - backend/src/scripts/content-generation/prompts/quality-guidelines.ts
    - backend/src/scripts/content-generation/utils/quality-validation.ts
  modified: []

key-decisions:
  - "Quality guidelines are summarized (200-400 tokens) not full rule implementations - prevents token bloat and prompt confusion"
  - "Retry loop is decoupled from API client via RegenerateFn callback - keeps utility reusable across different generation scripts"
  - "URL validation skipped during generation (skipUrlCheck: true) for speed - can batch validate after insertion"
  - "Generation reports persist as JSON files with full breakdown - enables audit trail and debugging"

patterns-established:
  - "Validation-retry pattern: validate, extract blocking violations, regenerate with feedback, retry up to maxRetries"
  - "Report structure captures: config, results, breakdown (by rule/retry/difficulty/topic), failures, performance"

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 21 Plan 01: Quality-Gated Generation Infrastructure Summary

**Foundation for AI question generation with quality validation: natural-language guidelines for prompts, validation-retry loop with feedback, and structured generation reports**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T03:31:20Z
- **Completed:** 2026-02-20T03:33:22Z
- **Tasks:** 1
- **Files created:** 2

## Accomplishments

- Created QUALITY_GUIDELINES constant (350+ tokens) summarizing all 6 Phase 19 quality rules in prompt-friendly language
- Built validateAndRetry() function with feedback loop: validates, retries with violation messages up to 3 times, tracks stats
- Implemented createReport() and saveReport() utilities for structured JSON generation reports
- Integrated with Phase 19 auditQuestion() using skipUrlCheck option for fast validation during generation

## Task Commits

1. **Task 1: Create quality guidelines prompt text and validation+retry utility** - `b148f46` (feat)

**Plan metadata:** (pending - will be committed after SUMMARY)

## Files Created/Modified

### Created
- `backend/src/scripts/content-generation/prompts/quality-guidelines.ts` - Natural-language summary of Phase 19 quality rules (ambiguity, vague qualifiers, pure lookup, partisan framing, structural quality, distractor quality) for embedding in AI generation prompts
- `backend/src/scripts/content-generation/utils/quality-validation.ts` - Validation pipeline with validateAndRetry() (retry loop with feedback), createReport(), saveReport(), GenerationReport interface; integrates auditQuestion() from Phase 19 engine

## Decisions Made

**Quality guidelines format:** Created as natural-language summary (200-400 tokens) rather than full rule implementations. This prevents token bloat in prompts and avoids confusing the AI with implementation details (regex patterns, Jaccard similarity thresholds). The guidelines describe what to avoid, not how violations are detected.

**Validation-retry decoupling:** validateAndRetry() accepts a RegenerateFn callback instead of hardcoding Anthropic API calls. This keeps the utility decoupled from the API client, making it reusable across different generation scripts (state templates, replacement questions, future collection types).

**URL validation strategy:** During generation, skipUrlCheck: true is used for fast validation. URL checks take 5+ seconds per question with timeouts on slow government sites. By skipping URL checks during generation and batching them after insertion, we avoid a 8+ minute bottleneck for 100 questions.

**Report persistence:** Generation reports are saved as JSON files in `backend/src/scripts/data/reports/` with filename pattern `generation-{target}-{YYYY-MM-DD}.json`. This provides an auditable trail of all generation runs, enables debugging of systematic quality issues, and tracks cost/performance metrics over time.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compilation succeeded with zero errors, imports resolved correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 21-02:** State template design can now import QUALITY_GUIDELINES for embedding in state-level system prompts. The validation pipeline is ready to be integrated into generation scripts.

**Key deliverables for next plans:**
- QUALITY_GUIDELINES available for import in state system prompts
- validateAndRetry() ready to wrap generation batches in Plans 03-05
- Report structure defined for tracking generation run outcomes

**No blockers.** All infrastructure in place for quality-gated generation.

---
*Phase: 21-generation-pipeline-new-collections*
*Completed: 2026-02-20*

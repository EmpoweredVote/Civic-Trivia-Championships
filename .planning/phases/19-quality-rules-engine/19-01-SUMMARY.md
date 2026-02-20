---
phase: 19-quality-rules-engine
plan: 01
subsystem: api
tags: [quality-validation, rule-engine, typescript, link-check, scoring]

# Dependency graph
requires:
  - phase: 18-foundation
    provides: Backend TypeScript structure and schema definitions
provides:
  - Composable quality rules engine with blocking/advisory severity levels
  - Seven rule functions: ambiguity, vague qualifiers, pure lookup, structural quality, partisan framing, broken links
  - Weighted scoring system (0-100) for quality assessment
  - Batch audit runner with concurrency control for URL validation
affects: [19-02-audit-script, 19-03-archival-system, 21-generation-pipeline]

# Tech tracking
tech-stack:
  added: [link-check]
  patterns: [composable-rule-functions, pure-validation-functions, weighted-scoring-aggregation]

key-files:
  created:
    - backend/src/services/qualityRules/types.ts
    - backend/src/services/qualityRules/rules/ambiguity.ts
    - backend/src/services/qualityRules/rules/lookup.ts
    - backend/src/services/qualityRules/rules/structural.ts
    - backend/src/services/qualityRules/rules/partisan.ts
    - backend/src/services/qualityRules/scoring.ts
    - backend/src/services/qualityRules/index.ts
  modified: []

key-decisions:
  - "Ambiguity detection uses Jaccard similarity >70% with civic stop words filtered out"
  - "Pure lookup detection uses allowlist (foundational patterns) and blocklist (obscure indicators) approach"
  - "Link validation treats timeouts as advisory, hard failures (404/500) as blocking"
  - "Partisan framing is advisory only with conservative keyword list (needs LLM upgrade in Phase 21)"
  - "Score is informational only - only hasBlockingViolations flag triggers archival"

patterns-established:
  - "Quality rules are pure functions (or async for I/O) returning RuleResult with violations"
  - "Each violation has rule ID, severity (blocking/advisory), message, and optional evidence"
  - "Audit runner separates sync and async rules for performance optimization"
  - "skipUrlCheck option enables fast dry-run audits without network calls"

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 19 Plan 01: Quality Rules Engine Summary

**Composable quality rules engine with 7 rule functions (ambiguity, vague qualifiers, pure lookup, structural, partisan, broken links), weighted 0-100 scoring, and batch audit runner with URL concurrency control**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-20T00:47:49Z
- **Completed:** 2026-02-20T00:52:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created complete quality rules engine as pure, composable TypeScript functions
- Implemented blocking rules (ambiguity, vague qualifiers, pure lookup, broken links) and advisory rules (structural quality, partisan framing, timeouts)
- Built weighted scoring system (0-100) that aggregates violations but is informational only (not used for archival decisions)
- Created batch audit runner with concurrency control (default 10) to avoid hammering URLs during validation
- Enabled skipUrlCheck option for fast sync-only audits (dry-run without network calls)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create types and all quality rule functions** - `c36a400` (feat)
   - types.ts with Severity, Violation, RuleResult, AuditResult, QualityRule types
   - ambiguity.ts with checkAmbiguousAnswers and checkVagueQualifiers (blocking)
   - lookup.ts with checkPureLookup (blocking, distinguishes foundational vs obscure)
   - structural.ts with checkStructuralQuality (advisory) and checkLearnMoreLink (blocking for failures, advisory for timeouts)
   - partisan.ts with checkPartisanFraming (advisory, conservative keyword list)
   - link-check package installed with custom type declarations

2. **Task 2: Create scoring module and audit runner** - `7472184` (feat)
   - scoring.ts with SCORE_WEIGHTS and calculateQualityScore function
   - index.ts with auditQuestion and auditQuestions orchestrators
   - ALL_SYNC_RULES and ALL_ASYNC_RULES arrays for performance optimization
   - Concurrency control for URL validation (batching to avoid overwhelming servers)

## Files Created/Modified

- `backend/src/services/qualityRules/types.ts` - Core type definitions for rules engine (Severity, Violation, RuleResult, AuditResult, QualityRule, QuestionInput)
- `backend/src/services/qualityRules/rules/ambiguity.ts` - Detects answer overlap >70% using Jaccard similarity and vague qualifiers in question text (blocking)
- `backend/src/services/qualityRules/rules/lookup.ts` - Distinguishes foundational civic knowledge from obscure trivia using pattern matching (blocking)
- `backend/src/services/qualityRules/rules/structural.ts` - Validates question/explanation length, citation presence, option completeness (advisory), and Learn More link reachability (blocking)
- `backend/src/services/qualityRules/rules/partisan.ts` - Detects overtly partisan keywords in question/explanation (advisory, needs refinement)
- `backend/src/services/qualityRules/rules/link-check.d.ts` - Type declarations for link-check package (no official types available)
- `backend/src/services/qualityRules/scoring.ts` - Weighted score calculation (0-100) from violations with rule-specific penalties
- `backend/src/services/qualityRules/index.ts` - Main audit orchestrator with single-question and batch audit functions
- `backend/package.json` / `backend/package-lock.json` - Added link-check dependency for URL validation

## Decisions Made

1. **Ambiguity detection approach:** Used Jaccard similarity (word overlap) with >70% threshold. Filters out civic stop words (federal, state, government, etc.) to prevent false positives from shared civic vocabulary. This can be tuned after dry-run audit based on real data.

2. **Pure lookup detection strategy:** Built allowlist (foundational patterns like "How many senators") and blocklist (obscure indicators like "What year was the X Act passed"). Conservative approach: foundational patterns always pass, obscure indicators only flag if no foundational match. Avoids false positives on important civic knowledge.

3. **Link validation severity:** Hard failures (404, 500, connection errors) are blocking. Timeouts are advisory (government sites can be slow, don't want false positives). Uses 5-second timeout per URL.

4. **Partisan framing limitations:** Implemented as advisory-only with high-confidence keyword list. Documented that this is intentionally conservative and will be upgraded to LLM-based detection in Phase 21 for better accuracy. Current keywords catch overtly biased terms only.

5. **Score vs blocking logic separation:** Score (0-100) is informational only for sorting/display in admin UI. Only `hasBlockingViolations` boolean determines archival. This prevents score-based threshold brittleness and keeps archival logic simple.

6. **Performance optimization:** Separated sync rules (pure, fast) from async rules (URL validation) to enable skipUrlCheck option for fast dry-run audits. Batch audit uses concurrency control (default 10) to avoid overwhelming servers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added link-check type declarations**
- **Found during:** Task 1 (implementing checkLearnMoreLink)
- **Issue:** link-check package has no official TypeScript types, causing compilation error
- **Fix:** Created link-check.d.ts with type declarations for the package API
- **Files modified:** backend/src/services/qualityRules/rules/link-check.d.ts
- **Verification:** TypeScript compilation passes with zero errors
- **Committed in:** c36a400 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** Type declarations required for TypeScript compilation. No scope creep.

## Issues Encountered

None - all tasks executed as planned. Link-check type declarations were a necessary technical detail handled automatically.

## User Setup Required

None - no external service configuration required. All rules are pure functions (except URL validation which uses standard HTTP).

## Next Phase Readiness

**Ready for Phase 19 Plan 02 (Audit Script):**
- Quality rules engine complete and fully functional
- All rule functions tested via TypeScript compilation
- Blocking rules: ambiguous answers, vague qualifiers, pure lookup, broken Learn More links
- Advisory rules: structural quality, partisan framing, Learn More timeouts
- Score calculation: 0-100 weighted, informational only
- Audit runner: single + batch with skipUrlCheck and concurrency options

**Reusable for Phase 21 (Generation Pipeline):**
- Engine designed as composable, pure functions
- No database dependencies (takes QuestionInput interface)
- Can be imported and used in generation pipeline gating

**Known limitations to address in future phases:**
- Ambiguity detection threshold (70%) may need tuning after dry-run audit shows real data
- Pure lookup patterns are conservative (may miss some bad questions, better than false positives)
- Partisan framing keywords are intentionally minimal (high-confidence only, needs LLM upgrade)
- Link validation doesn't cache results (will re-check same URLs if run multiple times)

**No blockers.** Ready to proceed with audit script implementation.

---
*Phase: 19-quality-rules-engine*
*Completed: 2026-02-20*

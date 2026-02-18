---
phase: 11-plausibility-enhancement
plan: 01
subsystem: security
tags: [anti-cheat, plausibility, scoring, pattern-detection, accessibility]

# Dependency graph
requires:
  - phase: 10-game-ux-improvements
    provides: Frontend timer constants and duration sync baseline
  - phase: 03-scoring-system
    provides: Base scoring logic and score calculation functions
  - phase: 07-polish-performance
    provides: Timer multiplier user settings and accessibility support
provides:
  - Difficulty-adjusted plausibility thresholds config (easy: 1.0s, medium: 0.75s, hard: 0.5s)
  - Pattern counting system with session-scoped plausibilityFlags counter
  - Penalty-aware scoring that zeroes speed bonus after 3+ flags
  - Timer multiplier threshold scaling for accessibility users
  - INVARIANT guarantee: flagged=true only for wrong answers (by design)
affects: [11-02, scoring-system, game-results, admin-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Difficulty-adjusted threshold config with 'as const' for type safety"
    - "Pattern counting with forward-only penalty application (3+ threshold)"
    - "INVARIANT-driven design: detection logic guarantees flagged=true => isCorrect=false"

key-files:
  created:
    - backend/src/config/plausibilityThresholds.ts
  modified:
    - backend/src/services/sessionService.ts
    - backend/src/services/scoreService.ts
    - .planning/ROADMAP.md

key-decisions:
  - "Zero speed bonus penalty instead of 30% point reduction (user-approved PLAUS-02 deviation)"
  - "Hard difficulty uses strictest threshold (0.5s) as runtime fallback for invalid difficulties"
  - "Clock manipulation check separate from difficulty-based detection (orthogonal concerns)"
  - "Forward-only penalty: first 2 flags normal scoring, 3rd+ zeroes speed bonus"

patterns-established:
  - "INVARIANT comments document critical design guarantees in code"
  - "Difficulty-adjusted security thresholds scale with user accessibility settings"
  - "Pattern counting prevents false positives from single suspicious answer"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 11 Plan 01: Core Plausibility Detection Summary

**Difficulty-adjusted timing thresholds with pattern counting that zeroes speed bonuses for suspicious answer patterns while respecting accessibility settings**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T20:48:47Z
- **Completed:** 2026-02-17T20:51:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created immutable plausibility threshold config with cognitive processing time rationale (easy: 1.0s, medium: 0.75s, hard: 0.5s)
- Implemented session-scoped pattern counting (plausibilityFlags) to prevent false positive penalties
- Built penalty-aware scoring system that zeroes speed bonus after 3+ flags (forward-only application)
- Integrated timer multiplier threshold scaling for accessibility users (1.5x/2.0x extended time)
- Guaranteed by design that penalties only affect wrong answers (INVARIANT: flagged=true implies isCorrect=false)
- Synced backend QUESTION_DURATION to 20s to match frontend (Phase 10 alignment)
- Updated ROADMAP to reflect user-approved "zero speed bonus" deviation from original "30% point reduction"

## Task Commits

Each task was committed atomically:

1. **Task 1: Create plausibility threshold config and update GameSession interface** - `b691047` (feat)
   - Created plausibilityThresholds.ts with difficulty-adjusted thresholds and timer multiplier support
   - Added plausibilityFlags field to GameSession interface
   - Fixed QUESTION_DURATION/MAX_PLAUSIBLE_TIME_REMAINING to 20s (sync with frontend)
   - Removed MIN_PLAUSIBLE_RESPONSE_TIME constant (replaced by config)

2. **Task 2: Rewrite plausibility detection and penalty-aware scoring** - `38c9c48` (feat)
   - Implemented difficulty-based detection with User.findById for timerMultiplier lookup
   - Added calculateScoreWithPenalty() function to scoreService
   - Rewrote submitAnswer() plausibility logic: skip Q10/anonymous, check isCorrect first, skip flagging for correct answers
   - Applied 3-flag pattern threshold before activating penalties
   - Added INVARIANT code comment documenting flagged=true => isCorrect=false guarantee
   - Updated ROADMAP Phase 11 Success Criteria item 2 from "30% point reduction" to "zero speed bonus"

## Files Created/Modified
- `backend/src/config/plausibilityThresholds.ts` - Immutable threshold config with difficulty levels and getAdjustedThreshold() helper
- `backend/src/services/sessionService.ts` - Enhanced submitAnswer() with pattern detection, User lookup for timerMultiplier, difficulty-adjusted flagging
- `backend/src/services/scoreService.ts` - Added calculateScoreWithPenalty() for penalty-aware scoring logic
- `.planning/ROADMAP.md` - Updated Phase 11 Success Criteria to reflect "zero speed bonus" instead of "30% point reduction"

## Decisions Made

**1. Zero speed bonus instead of 30% point reduction**
- **Context:** ROADMAP PLAUS-02 originally specified "30% point reduction" for flagged answers
- **Decision:** Changed to "zero speed bonus" (keep base 100 points for correct, just remove speed bonus)
- **Rationale:** User-approved deviation. Cleaner design: suspicious speed = no speed reward. Simpler to implement and explain.
- **Impact:** ROADMAP updated, code implements zero speed bonus penalty

**2. Hard difficulty as runtime fallback**
- **Context:** Question.difficulty is typed as `string` but plausibility expects 'easy' | 'medium' | 'hard'
- **Decision:** If difficulty not in valid set, fall back to 'hard' (strictest threshold)
- **Rationale:** Fail-safe approach - invalid difficulty treated as most suspicious
- **Impact:** Runtime guard in submitAnswer() with PlausibilityDifficulty cast

**3. Forward-only penalty application**
- **Context:** Pattern threshold requires 3+ flags before penalties
- **Decision:** First 2 flags get normal scoring, 3rd flag onward gets zero speed bonus
- **Rationale:** Prevents retroactive score changes (cleaner game state), encourages early correction
- **Impact:** penaltyActive = plausibilityFlags >= 3, checked before each score calculation

**4. INVARIANT guarantee via detection order**
- **Context:** Need to ensure penalties never apply to correct answers
- **Decision:** Calculate isCorrect FIRST, skip flagging if true. Document as INVARIANT in code comment.
- **Rationale:** Design guarantee is cleaner than runtime filter. Makes system behavior provable by inspection.
- **Impact:** Code comment documents invariant, detection logic enforces it structurally

## Deviations from Plan

None - plan executed exactly as written. The ROADMAP update was specified in the plan's NOTE section as a required task.

## Issues Encountered

None - TypeScript compilation passed, server started successfully, all verification criteria met.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 11-02 (Response stripping and frontend type cleanup):**
- Backend detection system operational and tested (TypeScript compiles, server starts)
- plausibilityFlags tracked in GameSession
- ServerAnswer.flagged field still included in API responses (11-02 will strip it)
- Frontend currently receives flagged field but doesn't use it (safe for 11-02 cleanup)

**For future admin dashboard work:**
- plausibilityFlags counter is session-scoped (resets each game)
- console.warn logging captures diagnostic details for each flag
- Consider persisting flagged answer data to database for admin analytics

**Monitoring recommendations:**
- Watch console.warn logs for false positive patterns
- Monitor if timerMultiplier users get disproportionate flags (threshold scaling working?)
- Track if 3-flag pattern threshold is appropriate (too lenient/strict?)

---
*Phase: 11-plausibility-enhancement*
*Completed: 2026-02-17*

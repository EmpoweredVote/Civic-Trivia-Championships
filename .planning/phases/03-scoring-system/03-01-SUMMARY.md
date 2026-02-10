---
phase: 03-scoring-system
plan: 01
subsystem: api
tags: [session-management, scoring, game-logic, express, typescript]

# Dependency graph
requires:
  - phase: 02-game-core
    provides: Question type structure and game flow
provides:
  - Server-side session management with SessionManager singleton
  - Score calculation service with 3-tier speed bonus system
  - Three API endpoints for session creation, answer submission, and results
  - Plausibility checking for suspicious answer timing
affects: [04-realtime-features, 05-leaderboards]

# Tech tracking
tech-stack:
  added: [crypto.randomUUID]
  patterns: [singleton service pattern, in-memory session storage, server-authority scoring]

key-files:
  created:
    - backend/src/services/scoreService.ts
    - backend/src/services/sessionService.ts
  modified:
    - backend/src/routes/game.ts

key-decisions:
  - "Server-authority scoring prevents client manipulation"
  - "3-tier speed bonus: >=15s (+50), >=5s (+25), <5s (+0)"
  - "In-memory session storage with 1-hour expiry"
  - "Plausibility checks flag but don't penalize suspicious answers"
  - "Questions returned without correctAnswer to prevent client cheating"
  - "Anonymous user support (userId='anonymous') for MVP"

patterns-established:
  - "Singleton pattern for stateful services (sessionManager)"
  - "Helper functions to strip sensitive data before returning to client"
  - "Plausibility checking logs warnings without affecting gameplay"

# Metrics
duration: 4min
completed: 2026-02-10
---

# Phase 3 Plan 1: Server-Side Scoring System Summary

**Server-authority session tracking with 3-tier speed bonus scoring and plausibility checking for cheat prevention**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-10T22:54:44Z
- **Completed:** 2026-02-10T22:58:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Server creates and manages game sessions with crypto-secure session IDs
- Score calculation service with 3-tier speed bonus system (fast: +50, medium: +25, slow: +0)
- Three API endpoints: POST /session, POST /answer, GET /results/:sessionId
- Plausibility checks detect suspicious timing (responseTime < 0.5s or timeRemaining > 25s)
- Questions returned without correctAnswer field to prevent client-side cheating
- Automatic session cleanup every 5 minutes (1-hour expiry)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create score service and session service** - `d651187` (feat)
2. **Task 2: Add session and answer API endpoints** - `8a35273` (feat)

## Files Created/Modified
- `backend/src/services/scoreService.ts` - Speed bonus calculation (3 tiers) and score aggregation
- `backend/src/services/sessionService.ts` - SessionManager singleton with create, submitAnswer, getResults, cleanup
- `backend/src/routes/game.ts` - Three new endpoints: POST /session, POST /answer, GET /results/:sessionId

## Decisions Made

**1. Server-authority scoring model**
- Rationale: Prevents client-side score manipulation. Server owns all scoring logic, client only receives results.

**2. 3-tier speed bonus system**
- Fast: >=15s remaining out of 25s = +50 bonus
- Medium: >=5s remaining = +25 bonus
- Slow: <5s remaining = +0 bonus
- Rationale: Rewards quick answers without making game too difficult. Three tiers provide good granularity.

**3. In-memory session storage**
- Rationale: Simple for MVP. Sessions expire in 1 hour. No database needed yet. Can migrate to Redis later if needed.

**4. Plausibility checks without penalties**
- Flags suspicious answers (responseTime < 0.5s or timeRemaining > 25s)
- Logs warnings but doesn't penalize for MVP
- Rationale: Detection without false positives. Can add penalties later after monitoring real usage patterns.

**5. Strip correctAnswer from session questions**
- Questions returned from POST /session don't include correctAnswer
- correctAnswer returned in POST /answer response for reveal
- Rationale: Prevents client inspection cheat while allowing proper game reveal.

**6. Anonymous user support**
- userId defaults to "anonymous" for users without auth
- Rationale: Auth is optional per Phase 1. Sessions work for both authenticated and anonymous users.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly. All tests passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 3 Plan 2 (Frontend integration):**
- Server-side session management complete
- Scoring system validated with all 3 speed bonus tiers
- API endpoints tested and operational
- Plausibility checks logging correctly

**Ready for Phase 4 (Realtime features):**
- Session system provides foundation for multiplayer sessions
- Score calculation can be extended for competitive scoring

**No blockers or concerns.**

---
*Phase: 03-scoring-system*
*Completed: 2026-02-10*

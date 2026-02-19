---
phase: 16-expiration-system
verified: 2026-02-18T21:45:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "Collection picker question counts exclude non-active questions"
    status: failed
    reason: "GET /collections endpoint filters by expiresAt but NOT by status='active'"
    artifacts:
      - path: "backend/src/routes/game.ts"
        issue: "Lines 64-72 WHERE clause missing eq(questions.status, 'active') condition"
    missing:
      - "Add status='active' filter to collections query WHERE clause"
      - "Ensure only active questions counted in collection.questionCount"
---

# Phase 16: Expiration System Verification Report

**Phase Goal:** Time-sensitive questions automatically drop from rotation without disrupting active games

**Verified:** 2026-02-18T21:45:00Z

**Status:** gaps_found

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Questions past their expires_at date no longer appear in new game sessions | VERIFIED | questionService.ts line 295 includes eq(questions.status, 'active') AND expiresAt > now check |
| 2 | An hourly cron job runs the expiration sweep automatically | VERIFIED | startCron.ts registers '0 * * * *' schedule, server.ts calls startExpirationCron() on line 32 |
| 3 | Expired questions are logged with structured output and flagged for content review | VERIFIED | expirationSweep.ts logs JSON at lines 51-58 (expired) and 84-92 (expiring-soon), updates status to 'expired' |
| 4 | A player mid-game is not affected if a question expires during their session | VERIFIED | Session isolation: questions loaded at game start, stored in Redis/memory session, no re-query during game |
| 5 | A health endpoint reports per-collection question counts, expiring-soon counts, and expired counts | FAILED | Health endpoint exists (health.ts lines 32-117) BUT collection picker counts (game.ts lines 64-72) missing status filter |

**Score:** 4/5 truths verified


### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| backend/src/db/schema.ts | status and expirationHistory fields | VERIFIED | Lines 75-81: status (text, default 'active'), expirationHistory (jsonb, default []), statusIdx index on line 91 |
| backend/src/cron/expirationSweep.ts | Sweep logic with status updates | VERIFIED | 116 lines, exports runExpirationSweep, queries expired/expiring-soon, updates status, logs JSON |
| backend/src/cron/startCron.ts | Cron scheduler registration | VERIFIED | 17 lines, exports startExpirationCron, schedules '0 * * * *' with node-cron |
| backend/src/services/questionService.ts | Filters by status='active' | VERIFIED | Line 295 includes eq(questions.status, 'active') in baseConditions |
| backend/src/routes/health.ts | Health endpoint | VERIFIED | 119 lines, GET /collections with per-collection counts and tier labels (lines 32-117) |
| backend/src/routes/admin.ts | Auth-protected admin routes | VERIFIED | 230 lines, GET /questions, POST /renew, POST /archive, authenticateToken middleware on line 10 |
| backend/src/server.ts | Cron startup call | VERIFIED | Line 32 calls startExpirationCron() after session manager init |
| frontend/src/features/admin/types.ts | AdminQuestion types | VERIFIED | 18 lines, exports AdminQuestion and StatusFilter |
| frontend/src/features/admin/hooks/useAdminQuestions.ts | Admin API hook | VERIFIED | 97 lines, exports useAdminQuestions with fetch/renew/archive methods |
| frontend/src/pages/Admin.tsx | Admin page component | VERIFIED | 416 lines (substantive), filter tabs, question list, renew/archive actions |
| frontend/src/App.tsx | /admin route in ProtectedRoute | VERIFIED | Line 37 adds /admin route inside ProtectedRoute |
| frontend/src/components/layout/Header.tsx | Review nav link | VERIFIED | Lines 90-95 add Review button in authenticated menu |


### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| server.ts | startCron.ts | import and call | WIRED | Line 14 imports, line 32 calls startExpirationCron() |
| expirationSweep.ts | schema.ts | drizzle query | WIRED | Lines 21-24 use questions.status, questions.expiresAt in WHERE |
| questionService.ts | schema.ts | status='active' filter | WIRED | Line 295 eq(questions.status, 'active') in baseConditions |
| game.ts collections | schema.ts | status filter | NOT_WIRED | Lines 64-72 WHERE clause checks expiresAt but NOT status |
| admin hook | admin routes | API calls with auth | WIRED | Lines 33-34 (GET), 60-66 (renew), 77-82 (archive) with Authorization header |
| App.tsx | Admin.tsx | React Router | WIRED | Line 37 Route path="/admin" inside ProtectedRoute |
| Header.tsx | Admin page | Navigation link | WIRED | Lines 90-95 navigate to /admin for authenticated users |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| EXP-01: Expired questions automatically removed from game rotation | SATISFIED | questionService filters by status='active' |
| EXP-02: Expiration check runs on hourly schedule | SATISFIED | Cron registered at '0 * * * *' |
| EXP-03: Expired questions logged and flagged for review | SATISFIED | JSON logs + admin UI listing |
| EXP-04: Active sessions not affected by mid-session expiration | SATISFIED | Session isolation design |
| ADM-01: Collection health dashboard | PARTIAL | Health endpoint exists BUT collection picker counts missing status filter |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| backend/src/routes/game.ts | 64-72 | Missing status filter | Blocker | Collection picker counts include expired/archived questions |


### Gaps Summary

**One critical gap found:**

The GET /collections endpoint (used by the collection picker UI) correctly filters questions by expiresAt but is missing the status='active' filter. This means:

1. Expired questions (status='expired') are still counted in collection.questionCount
2. Archived questions (status='archived') are still counted in collection.questionCount
3. Collection picker shows inflated counts that do not match reality

**Root cause:** Plan 16-01 specified updating game.ts line 64-68 to add status filter, but the actual implementation at lines 64-72 only includes the expiresAt check. The status column exists and is used correctly in questionService.ts, but not in the collections endpoint.

**Impact:** Users see collection cards with question counts that include expired/archived content. When they start a game, fewer questions may be available than the count suggested (if expired questions exist).

**Fix required:** Add status='active' filter to the WHERE condition in game.ts GET /collections endpoint. The query needs to filter questions similar to how questionService does it:

```typescript
// Current (lines 64-72):
.where(
  and(
    eq(collections.isActive, true),
    or(
      isNull(questions.id),
      isNull(questions.expiresAt),
      gt(questions.expiresAt, now)
    )
  )
)

// Should be:
.where(
  and(
    eq(collections.isActive, true),
    or(
      isNull(questions.id),
      and(
        eq(questions.status, 'active'),
        or(
          isNull(questions.expiresAt),
          gt(questions.expiresAt, now)
        )
      )
    )
  )
)
```

This brings it into alignment with:
- questionService.ts (correctly filters by status)
- health.ts (correctly filters by status)
- admin.ts (correctly queries by status)


### Human Verification Required

The following items need human testing:

#### 1. Admin Page Accessibility

**Test:** Log in, click hamburger menu in header, click "Review" link

**Expected:** Navigate to /admin, see "Content Review" page with filter tabs (All, Expired, Expiring Soon, Archived) and empty state message "No questions need attention"

**Why human:** Navigation flow requires browser interaction, visual confirmation of UI elements

#### 2. Admin Page Auth Protection

**Test:** Log out, manually navigate to http://localhost:5173/admin in browser

**Expected:** Redirected to /login page

**Why human:** React Router ProtectedRoute behavior requires client-side navigation

#### 3. Health Endpoint Accessibility

**Test:** Open http://localhost:3000/health/collections in browser (while logged out)

**Expected:** JSON response with summary (totalActive, totalExpiringSoon, etc.) and collections array with Federal Civics showing activeCount=120, tier='Healthy', isPlayable=true

**Why human:** Public endpoint verification, JSON structure visual inspection

#### 4. Cron Registration Logs

**Test:** Start backend server with npm run dev, check console output

**Expected:** See log line "Expiration cron job registered (runs hourly at :00)" during startup

**Why human:** Server startup logs require terminal observation

#### 5. Expiration Sweep Manual Run

**Test:** Create a test question with expires_at in the past, then run: npx tsx -e "import { runExpirationSweep } from './src/cron/expirationSweep.js'; await runExpirationSweep(); process.exit(0);"

**Expected:** JSON log output showing 1 newly expired question with structured fields (level: 'warn', job: 'expiration-sweep', questionId, externalId, expiresAt)

**Why human:** Requires database manipulation and command-line execution, visual inspection of JSON logs

---

_Verified: 2026-02-18T21:45:00Z_

_Verifier: Claude (gsd-verifier)_

---
phase: 16-expiration-system
plan: 03
subsystem: frontend
tags: [react, tailwind, admin-ui, protected-routes, hooks]

# Dependency graph
requires:
  - phase: 16-02
    provides: Admin API endpoints for listing/renewing/archiving questions
  - phase: 12-refresh-token-auth
    provides: ProtectedRoute component and useAuthStore for token management
provides:
  - Admin review page at /admin with status filter tabs and question management
  - useAdminQuestions hook for API communication with auth headers
  - Navigation link in Header for authenticated users
  - TypeScript types for admin question data
affects: [content-reviewers, admin-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: [protected admin page, filter tab UI pattern, auth-header hook pattern]

key-files:
  created:
    - frontend/src/features/admin/types.ts
    - frontend/src/features/admin/hooks/useAdminQuestions.ts
    - frontend/src/pages/Admin.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/Header.tsx

key-decisions:
  - "Admin page accessible to all authenticated users (no role-based access)"
  - "Filter tabs for All/Expired/Expiring Soon/Archived with active tab highlighting"
  - "Renew action uses date input defaulting to 1 year from today"
  - "Archive action requires window.confirm() for safety"
  - "Responsive layout: table on desktop, card list on mobile"

patterns-established:
  - "Admin page pattern: ProtectedRoute + Header + filter tabs + action buttons"
  - "Admin hook pattern: useAdminQuestions manages fetch/filter/action state with auth headers"

# Metrics
duration: 6.2min
completed: 2026-02-19
---

# Phase 16 Plan 03: Admin Review Page Summary

**Protected admin page with filter tabs, question list, and renew/archive actions for content reviewers**

## Performance

- **Duration:** 6.2 min (including checkpoint approval and production debugging)
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 5

## Accomplishments
- Admin types (AdminQuestion, StatusFilter) define the admin data contract
- useAdminQuestions hook handles all API communication with auth headers, filter state, and action methods
- Admin page renders filter tabs, question list with status badges, and action buttons
- Route registered at /admin inside ProtectedRoute (redirects anonymous users to login)
- Header shows "Review" navigation link for authenticated users
- Checkpoint approved: admin page shows "No questions need attention" (correct for current data)

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin types, hook, and page component** - `0ef5aa1` (feat)
2. **Task 2: Route registration and navigation link** - `23aaa50` (feat)
3. **Checkpoint: Human verification** - Approved after production deployment testing

## Production Deployment Fix

During checkpoint verification on production (Render + Supabase), discovered that the `civic_trivia` schema tables had never been created on Supabase — only locally via `drizzle-kit push`. The `selectQuestionsForGame()` JSON fallback had silently masked this since the initial deployment.

**Root cause:** `drizzle-kit push` only ran against local DATABASE_URL (localhost:5433), never against Supabase.

**Fix applied:**
- Diagnostic endpoint revealed only `users` table existed in `civic_trivia` schema on Supabase
- Created all 5 game tables + indexes via one-time setup endpoint
- Seeded 3 collections, 15 topics, 120 questions via one-time seed endpoint
- Fixed build script to copy JSON data files (questions.json, sources.json) to dist/
- Removed temporary diagnostic endpoints after use

**Additional fix commits:**
- `ce150c8` - Fix admin response shape + NULL checks
- `b7c0948` - Remove failed startup migration
- `1ee7f9c` - ORM helpers for collections query
- `6770dcc` - Quoted identifiers for Supabase
- `21ae5a2` - Diagnostic endpoint
- `2ff1963` - Table creation endpoint
- `89866ef` - Build script fix for JSON copy
- `3ad89be` - Cleanup diagnostic endpoints

## Files Created/Modified

### Created
- `frontend/src/features/admin/types.ts` - AdminQuestion interface and StatusFilter type
- `frontend/src/features/admin/hooks/useAdminQuestions.ts` - Hook for admin API with auth, filtering, renew/archive actions
- `frontend/src/pages/Admin.tsx` - Admin review page with filter tabs, question list, status badges, action buttons

### Modified
- `frontend/src/App.tsx` - Added /admin route inside ProtectedRoute
- `frontend/src/components/layout/Header.tsx` - Added "Review" navigation link for authenticated users
- `backend/src/routes/health.ts` - Schema-qualified table names for Supabase compatibility
- `backend/src/routes/game.ts` - ORM helpers for collections query
- `backend/src/routes/admin.ts` - Fixed response shape to {questions: [...]}
- `backend/package.json` - Build script copies JSON data files to dist/

## Deviations from Plan

1. **Production database tables missing** - Tables never existed on Supabase. Created via one-time endpoints instead of migration. This was a pre-existing infrastructure gap, not a Phase 16 regression.
2. **Build script update** - Added JSON file copy to build command. TypeScript compiler doesn't copy non-TS files.
3. **Multiple bugfix commits** - Required iterative debugging of Supabase schema qualification issues.

## Issues Encountered

**Supabase schema qualification**: Drizzle ORM uses `pgSchema('civic_trivia')` which generates fully-qualified table references like `"civic_trivia"."collections"`. This requires the schema and tables to actually exist on the production database. The JSON fallback in `questionService.ts` had masked this issue for all previous phases.

**Build missing JSON files**: TypeScript's `tsc` compiler only processes `.ts` files. JSON data files (questions.json, sources.json) need explicit copying in the build step.

---
*Phase: 16-expiration-system*
*Completed: 2026-02-19*

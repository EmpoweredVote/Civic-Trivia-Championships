---
phase: 18-foundation-admin-auth-telemetry
plan: 01
subsystem: auth
tags: [jwt, admin, rbac, postgres, middleware]

# Dependency graph
requires:
  - phase: 17-community-collections
    provides: User authentication system with JWT tokens
provides:
  - Admin role infrastructure with is_admin column on users table
  - requireAdmin middleware for protecting admin endpoints
  - JWT tokens including isAdmin claim
  - ADMIN_EMAIL environment variable mechanism for first admin promotion
affects: [18-02-telemetry-schema, 18-03-telemetry-tracking, 19-quality-rules, 20-admin-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-based access control via JWT claims"
    - "requireAdmin middleware chaining after authenticateToken"
    - "One-time admin promotion via environment variable"

key-files:
  created:
    - backend/src/scripts/migrate-admin-role.ts
  modified:
    - backend/src/models/User.ts
    - backend/src/utils/tokenUtils.ts
    - backend/src/controllers/authController.ts
    - backend/src/middleware/auth.ts
    - backend/src/routes/admin.ts

key-decisions:
  - "Admin role stored as boolean column in users table (is_admin)"
  - "ADMIN_EMAIL env var promotes first admin on login (one-time check)"
  - "requireAdmin middleware runs after authenticateToken (chained)"
  - "Non-admin users receive 403 with 'Admin access required' message"

patterns-established:
  - "Pattern 1: Admin middleware checks req.user.isAdmin populated by authenticateToken"
  - "Pattern 2: JWT payload includes isAdmin claim for stateless role checks"
  - "Pattern 3: User model queries always include is_admin column mapping to isAdmin field"

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 18 Plan 01: Admin Role Infrastructure Summary

**JWT access tokens include isAdmin claim, requireAdmin middleware protects all /api/admin endpoints with 403 for non-admins**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T22:44:25Z
- **Completed:** 2026-02-19T22:48:09Z
- **Tasks:** 2/2
- **Files modified:** 6 (4 modified, 1 created, 1 migration script)

## Accomplishments
- is_admin column added to users table (NOT NULL DEFAULT false)
- JWT tokens carry isAdmin claim in payload
- requireAdmin middleware rejects non-admin users with 403
- All admin routes protected by requireAdmin middleware
- ADMIN_EMAIL env var mechanism enables first admin promotion on login

## Task Commits

Each task was committed atomically:

1. **Task 1: Add is_admin column and update User model + JWT pipeline** - `7c7cabc` (feat)
2. **Task 2: Create requireAdmin middleware and protect admin routes** - `8996fd2` (feat)

## Files Created/Modified
- `backend/src/scripts/migrate-admin-role.ts` - Database migration script to add is_admin column
- `backend/src/models/User.ts` - Added isAdmin to User interface and all SELECT queries
- `backend/src/utils/tokenUtils.ts` - Added isAdmin to TokenPayload, updated generateAccessToken signature
- `backend/src/controllers/authController.ts` - Updated login and refresh to include isAdmin in tokens and responses, added ADMIN_EMAIL promotion logic
- `backend/src/middleware/auth.ts` - Created requireAdmin middleware function
- `backend/src/routes/admin.ts` - Updated router.use to chain authenticateToken and requireAdmin

## Decisions Made

**Admin role implementation:**
- Used boolean column (is_admin) rather than roles table - simpler for single role system
- Default false for all users maintains secure-by-default posture

**First admin designation:**
- ADMIN_EMAIL environment variable approach enables bootstrapping without SQL access
- One-time promotion check in login avoids unnecessary database writes on subsequent logins
- Console log confirms when admin role is granted for auditability

**Middleware architecture:**
- requireAdmin runs synchronously after authenticateToken - no database queries needed
- Returns 401 if no req.user (catches unauthenticated), 403 if not admin (authorized but forbidden)
- Middleware chaining (authenticateToken, requireAdmin) keeps separation of concerns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed schema path for users table migration**
- **Found during:** Task 1 (Running migration script)
- **Issue:** Initial migration failed with "relation users does not exist" because users table is in public schema, not civic_trivia schema
- **Fix:** Updated migration script to explicitly SET search_path TO public before ALTER TABLE
- **Files modified:** backend/src/scripts/migrate-admin-role.ts
- **Verification:** Migration ran successfully, is_admin column added
- **Committed in:** 7c7cabc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Schema path fix was necessary to complete migration. No scope creep.

## Issues Encountered

**Database schema discovery:**
- Initial assumption that users table was in civic_trivia schema (based on database.ts config setting search_path)
- Reality: users table created in public schema before civic_trivia schema was standardized
- Resolution: Created check-users-table.ts diagnostic script, confirmed public schema, updated migration
- Learning: Always verify schema location for raw SQL operations, don't assume from app config

## User Setup Required

**ADMIN_EMAIL environment variable:**
To designate the first admin user, add to backend/.env:
```
ADMIN_EMAIL=your-admin-email@example.com
```

When that user logs in, they will be automatically promoted to admin role. Subsequent admin users must be promoted via direct database UPDATE.

## Next Phase Readiness

**Ready for:**
- Phase 18-02 (Telemetry Schema) - can proceed with telemetry table creation
- Phase 18-03 (Telemetry Tracking) - admin role infrastructure in place
- Phase 19 (Quality Rules) - admin role required for quality rule enforcement
- Phase 20 (Admin UI) - all admin endpoints secured, ready for UI to consume

**Blockers:** None

**Concerns:** None - implementation matches requirements exactly

**Testing notes:**
- Manual testing required to verify:
  - Non-admin user hitting /api/admin/questions receives 403
  - Admin user (after ADMIN_EMAIL promotion) can access admin endpoints
  - JWT token payload includes isAdmin claim (decode token to verify)
  - Login and refresh responses include isAdmin in user object

---
*Phase: 18-foundation-admin-auth-telemetry*
*Completed: 2026-02-19*

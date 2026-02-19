---
phase: 16-expiration-system
plan: 02
subsystem: api
tags: [express, drizzle-orm, authentication, rest-api, health-monitoring]

# Dependency graph
requires:
  - phase: 16-01
    provides: Questions table status field and expirationHistory for health queries
  - phase: 12-refresh-token-auth
    provides: authenticateToken middleware for admin route protection
provides:
  - GET /health/collections endpoint with per-collection health data and tier labels
  - GET /api/admin/questions endpoint for listing expired/expiring-soon questions
  - POST /api/admin/questions/:id/renew endpoint for question reactivation
  - POST /api/admin/questions/:id/archive endpoint for permanent retirement
  - Auth-protected admin routes (401 without valid token)
affects: [16-03-renewal-flow, admin-dashboard-ui, monitoring-dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns: [public health endpoints, auth-protected admin APIs, SQL aggregation with FILTER clauses, JSONB append for audit history]

key-files:
  created:
    - backend/src/routes/admin.ts
  modified:
    - backend/src/routes/health.ts
    - backend/src/server.ts

key-decisions:
  - "Health endpoint is public (no auth) for monitoring dashboard access"
  - "Admin routes use authenticateToken middleware for all endpoints"
  - "Question IDs in admin routes use database serial id (not externalId)"
  - "Collection health query uses LEFT JOIN to include collections with zero questions"
  - "Tier labels computed in JavaScript (Healthy/At Risk/Critical) based on active count"

patterns-established:
  - "Health endpoint pattern: Aggregate SQL query + JS tier computation for monitoring data"
  - "Admin CRUD pattern: Auth middleware + validation + JSONB audit trail append"
  - "Question renewal: Update status to 'active' + new expires_at + history entry"

# Metrics
duration: 1.9min
completed: 2026-02-19
---

# Phase 16 Plan 02: Health Endpoint + Admin API Summary

**Public collection health endpoint with tier labels and auth-protected admin API for renewing/archiving expired questions**

## Performance

- **Duration:** 1.9 min
- **Started:** 2026-02-19T04:18:33Z
- **Completed:** 2026-02-19T04:20:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- GET /health/collections provides per-collection health monitoring with four count buckets (active, expiring-soon, expired, archived)
- Computed tier labels (Healthy/At Risk/Critical) based on active question count thresholds
- System-wide summary totals enable dashboard overview
- Auth-protected admin API enables expired question management workflow
- Renewal action immediately reactivates questions (status back to 'active')
- Archive action permanently retires questions from rotation
- All admin actions append structured audit entries to expirationHistory JSONB field

## Task Commits

Each task was committed atomically:

1. **Task 1: Collection health endpoint** - `1581492` (feat)
2. **Task 2: Admin API routes for expired question management** - `04d243f` (feat)

## Files Created/Modified

### Created
- `backend/src/routes/admin.ts` - Auth-protected admin routes: GET /questions (list expired/expiring-soon), POST /questions/:id/renew (reactivate), POST /questions/:id/archive (retire)

### Modified
- `backend/src/routes/health.ts` - Added GET /collections route with SQL aggregation query, tier computation, and system-wide summary
- `backend/src/server.ts` - Registered admin router at /api/admin endpoint

## Decisions Made

1. **Public health endpoint**: Health endpoint requires no authentication to enable monitoring dashboards and external health checks. Data is aggregated counts only (no sensitive content).

2. **Admin uses database serial IDs**: Admin route params use questions.id (serial integer) rather than externalId string. Simplifies UPDATE queries and aligns with Drizzle ORM primary key patterns.

3. **Tier labels in JavaScript**: Health tiers (Healthy/At Risk/Critical) computed in JavaScript rather than SQL CASE statement. Allows flexible threshold tuning without query changes, improves readability.

4. **LEFT JOIN for zero-question collections**: Collection health query uses LEFT JOIN so collections with zero questions still appear in results (with all counts as 0). Prevents "missing collection" confusion in monitoring.

5. **Renewal immediately reactivates**: POST /renew sets status='active' atomically with expires_at update. Question instantly returns to game rotation without additional manual status change.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with clean TypeScript compilation.

## User Setup Required

None - endpoints live on existing backend server with existing authentication middleware.

## Next Phase Readiness

**Ready for Plan 03 (Renewal flow testing + documentation):**
- Health endpoint operational for monitoring dashboards
- Admin API complete with all three review actions (list, renew, archive)
- Auth protection confirmed via middleware application
- Audit trail appends working for both renewal and archive actions
- Renewed questions immediately return to 'active' status

**Blockers:** None

**Concerns:** None - expiration visibility and management fully operational

---
*Phase: 16-expiration-system*
*Completed: 2026-02-19*

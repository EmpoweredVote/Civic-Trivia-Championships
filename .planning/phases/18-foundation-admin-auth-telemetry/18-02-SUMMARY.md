---
phase: 18-foundation-admin-auth-telemetry
plan: 02
subsystem: auth, ui
tags: react, typescript, react-router, tailwind, admin, rbac, frontend-auth

# Dependency graph
requires:
  - phase: 18-01
    provides: Backend admin role (is_admin column, JWT claim, requireAdmin middleware)
provides:
  - Frontend admin route guard (AdminGuard checks isAdmin claim)
  - 403 Forbidden page for non-admin users
  - Admin shell with red-themed sidebar layout
  - Admin dashboard placeholder with upcoming feature cards
  - Admin pill indicator in Header for admin users
affects: [20-admin-question-explorer, 21-admin-content-generation, admin-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AdminGuard component pattern for role-based route protection
    - Nested route layout with Outlet pattern (AdminLayout → AdminDashboard)
    - Red color theme for admin areas (bg-red-900, bg-red-800) distinct from player teal theme

key-files:
  created:
    - frontend/src/pages/Forbidden.tsx
    - frontend/src/pages/admin/AdminLayout.tsx
    - frontend/src/pages/admin/AdminDashboard.tsx
  modified:
    - frontend/src/types/auth.ts
    - frontend/src/App.tsx
    - frontend/src/components/layout/Header.tsx

key-decisions:
  - "AdminGuard renders Forbidden component (not redirect) for non-admin users"
  - "Admin access hidden - no nav links to /admin, only Admin pill for admins"
  - "Red color theme (red-900, red-800, red-600) for admin areas vs teal for player experience"
  - "Admin shell uses sidebar + header layout, distinct from player experience"
  - "Old Admin.tsx (v1.2 content review) preserved for Phase 20 integration"

patterns-established:
  - "Role-based route guards: AdminGuard checks user.isAdmin, renders Forbidden for non-admins"
  - "Admin UI theming: red color palette (red-900/red-800 sidebar, red-600 accents)"
  - "Hidden admin access: admins type /admin URL, no visible nav links"
  - "Subtle admin indicator: red pill badge in header links to /admin"

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 18 Plan 02: Frontend Admin Access Control Summary

**Admin route guard with 403 page, red-themed admin shell with sidebar layout, and subtle admin pill indicator for admin users**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T22:51:43Z
- **Completed:** 2026-02-19T22:54:53Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Non-admin users see friendly 403 page when accessing /admin (not a redirect, a rendered component)
- Admin users see red-themed admin shell with sidebar navigation and header
- Admin dashboard with welcome message and 3 placeholder feature cards (Phase 20, 21 previews)
- Admin pill indicator in Header only for admin users (red badge linking to /admin)
- No navigation links to /admin in main app UI (admin access hidden from non-admins)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update User type, create Forbidden page and AdminGuard, rewire routing** - `474c9a4` (feat)
2. **Task 2: Create admin shell layout, dashboard placeholder, and update Header** - `8d45e22` (feat)

## Files Created/Modified

**Created:**
- `frontend/src/pages/Forbidden.tsx` - Friendly 403 page with shield icon, message, link to home
- `frontend/src/pages/admin/AdminLayout.tsx` - Red-themed admin shell with sidebar (Dashboard, Questions, Collections nav), responsive
- `frontend/src/pages/admin/AdminDashboard.tsx` - Welcome message + 3 placeholder cards for upcoming features

**Modified:**
- `frontend/src/types/auth.ts` - Added `isAdmin?: boolean` to User interface (optional for backward compat)
- `frontend/src/App.tsx` - Added AdminGuard component, rewired /admin routes through AdminGuard → AdminLayout
- `frontend/src/components/layout/Header.tsx` - Added Admin pill for admin users, removed "Review" link from dropdown

## Decisions Made

1. **AdminGuard renders Forbidden (not redirects)** - Better UX than redirecting to login, shows clear 403 message
2. **Admin access hidden** - No menu links to /admin anywhere in main nav, admins access by typing URL or clicking Admin pill
3. **Red color theme for admin areas** - Distinct from player experience (teal), uses red-900/red-800 for sidebar, red-600 for accents
4. **Sidebar + header layout** - AdminLayout with left sidebar navigation, top header with user info, main content via Outlet
5. **Preserve old Admin.tsx** - v1.2 content review page will be integrated into Question Explorer in Phase 20

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation straightforward, TypeScript compilation and build succeeded on first try.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Frontend admin infrastructure complete:**
- Admin route guard protects /admin routes (checks isAdmin claim from JWT)
- Admin shell layout ready for Phase 20 content (Question Explorer, Collections)
- Admin pill indicator visible for admin users
- 403 page handles non-admin access attempts gracefully

**Ready for Phase 20 (Admin Question Explorer):**
- AdminLayout provides sidebar navigation structure
- Questions nav link placeholder ready to route to /admin/questions
- Red theme established for admin feature consistency

**Blockers:** None

**Testing notes:**
- To test admin access: Set is_admin=true in database for a user, login to get JWT with isAdmin=true claim
- Non-admin users at /admin will see 403 Forbidden page
- Admin users at /admin will see admin dashboard with placeholder cards

---
*Phase: 18-foundation-admin-auth-telemetry*
*Completed: 2026-02-19*

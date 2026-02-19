# Phase 18: Foundation (Admin Auth + Telemetry) - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure admin access behind role checks (backend middleware + frontend route guard) and begin accumulating gameplay telemetry data (encounter and correctness counters on questions). The admin UI content is Phase 20 — this phase delivers the auth gate, a basic admin shell, and telemetry recording.

</domain>

<decisions>
## Implementation Decisions

### Admin redirect & access denied
- Non-admin users navigating to `/admin` see a **403 page** (not a silent redirect)
- 403 page has a **friendly tone** — something like "This area is for admins. If you think you should have access, contact us." with a link home
- Admin section is **hidden** — no nav link to `/admin` anywhere; admins access by typing the URL directly
- Backend 403 responses include **status code + error message** (e.g., `{ error: "Admin access required" }`)

### Role provisioning
- Admin granting is **out of scope** — no API to grant admin to other users; database-only for now
- Admin users see a **subtle indicator** somewhere in the UI so they know they have admin status
- First admin designation and admin flag storage location are Claude's discretion (see below)

### Telemetry data model
- Telemetry uses **counters on the questions table** — add encounter_count and correct_count columns directly (no separate events table)
- **All users** count — every gameplay interaction is recorded whether the player is logged in or anonymous
- Additional fields beyond encounter_count/correct_count and failure handling are Claude's discretion (see below)

### Admin layout foundation
- Phase 18 creates a **basic admin shell** that Phase 20 fills with real content
- Layout is **sidebar + header** — left sidebar for nav links, top header with "Admin" title
- Landing page shows **welcome + placeholder** — "Welcome, Admin" with placeholder cards for upcoming features
- Admin shell has a **distinct theme** from the main app — **red-themed** to clearly separate admin from player experience
- Uses the same component library but with a red color scheme override

### Claude's Discretion
- First admin designation approach (env var, migration seed, or manual DB update)
- Admin flag storage (column on users table vs separate roles table)
- Additional telemetry fields beyond encounter_count and correct_count (e.g., last_encountered_at, avg_response_time)
- Telemetry failure handling (silent drop vs console logging)
- Exact admin shell spacing, typography, and red theme implementation details
- Loading skeleton and error state designs

</decisions>

<specifics>
## Specific Ideas

- Admin theme should be red — a clear visual signal that you're in the admin area, not the player experience
- 403 page should feel friendly, not intimidating — this is a civic engagement app, not a fortress
- Telemetry should be invisible to players — fire-and-forget, no impact on gameplay response time

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-foundation-admin-auth-telemetry*
*Context gathered: 2026-02-19*

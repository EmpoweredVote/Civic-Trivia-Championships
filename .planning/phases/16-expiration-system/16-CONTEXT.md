# Phase 16: Expiration System - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Time-sensitive questions automatically drop from rotation when their `expires_at` date passes. An hourly cron job sweeps for expirations, a health endpoint reports collection status, and a simple admin page lets reviewers manage expired questions. Active games are never disrupted.

</domain>

<decisions>
## Implementation Decisions

### Expiring-soon thresholds
- "Expiring soon" = within 30 days of `expires_at`
- No grace period — once `expires_at` passes, question is immediately excluded from new sessions
- Questions without `expires_at` are permanent (never expire) — good for foundational federal civics content
- Expiration is content-driven, not system-driven: content authors set `expires_at` based on when the underlying fact becomes stale (e.g., budget question expires end of fiscal year, mayor question expires end of term)
- Best practice is to set `expires_at` on any time-bounded content, even though it's not required

### Renewal and history
- Expired questions can be renewed by setting a new `expires_at` — immediately reactivated, no review gate
- System tracks expiration/renewal history as an audit trail — helps spot content that repeatedly expires
- Expiration sweep flags expiring-soon questions that haven't been reviewed yet ("needs attention" nudge)

### Collection health rules
- Collections below minimum playable count (10 questions) are blocked from starting new games
- Blocked collections are hidden entirely from the picker (not grayed out)
- Health tiers: Healthy (>2x minimum), At Risk (1x-2x minimum), Critical (<minimum)

### Review workflow
- Dual surfacing: structured log output from cron AND database status field for queryable state
- Three actions on expired questions: Renew (new `expires_at`), Update content + renew, or Archive (permanently retire)
- Simple admin page listing expired and expiring-soon questions with action buttons
- Admin page is auth-required (logged-in users only)

### Health endpoint
- System-wide summary + per-collection breakdown in one response
- Four count buckets per collection: active, expiring-soon (30 days), expired, archived
- Includes computed tier label per collection (Healthy / At Risk / Critical)

### Claude's Discretion
- Health endpoint access level (public vs auth-protected) — based on existing patterns
- Cron implementation details (scheduling mechanism, error handling)
- Structured log format specifics
- Audit trail storage approach (separate table vs status history on questions table)
- Admin page layout and styling details

</decisions>

<specifics>
## Specific Ideas

- "Anything that may expire should have a date when we think it may expire" — expiration dates are a content authoring best practice, not a system enforcement
- Budget questions expire end of fiscal year, elected official questions expire end of term — the system enforces whatever date the author sets
- The "needs attention" flag on expiring-soon questions creates a proactive review nudge before content goes stale

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-expiration-system*
*Context gathered: 2026-02-18*

# Phase 9: Redis Session Migration - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate game session storage from in-memory Map to Redis for persistence across server restarts and multi-instance deployment readiness. Includes graceful degradation to in-memory when Redis is unavailable, health check endpoint, and Docker Compose for local Redis setup. No new game features or user-facing functionality changes.

</domain>

<decisions>
## Implementation Decisions

### Degradation experience
- Subtle indicator shown to user when running in degraded (in-memory) mode — e.g., small banner noting sessions may not persist
- Silent for the user during normal Redis operation — degradation indicator only appears on fallback
- /health endpoint exposes Redis status, uptime, and session count for monitoring dashboards and load balancers

### Development workflow
- In-memory storage by default for local development — no Redis required to run the app
- Set REDIS_URL environment variable to opt into Redis (lowest friction dev experience)
- Include docker-compose.yml with Redis service for developers who want to test with Redis locally

### Deploy transition
- Minimize impact on active users — deploy during low-traffic window or with brief maintenance notice
- No technical session migration needed (games are ~3 min, short-lived sessions)
- Redis hosting not decided yet — code should work with any Redis instance (managed service, self-hosted, etc.)

### Claude's Discretion
- Redis recovery behavior — whether to sync in-memory sessions to Redis on recovery or only use Redis for new sessions
- Redis connection configuration approach (single REDIS_URL vs separate vars)
- Startup logging of which storage backend is active
- Whether Redis is required in production mode or stays optional with degradation
- User-facing communication about the upgrade (changelog note vs silent)
- Logging strategy when Redis is down (transition-only vs periodic warnings)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-redis-session-migration*
*Context gathered: 2026-02-13*

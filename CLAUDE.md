# Civic Trivia Championship — working notes

## Health endpoints (learned the hard way, 2026-07-25)

Render polls a service's configured Health Check Path **every 5–10 seconds**, and
that interval is **not configurable** — it's a standing feature request, not a
setting. Anything on that path runs ~500,000 times a month.

Rules:

- **The platform probe path must be dependency-free.** No Redis, no Postgres, no
  outbound HTTP. If the process can return 200, it's alive — that's all a restart
  decision needs. In this repo that path is `GET /health/live`.
- **Diagnostics go behind a flag**, never in the default payload. `GET /health`
  reports dependency status; `GET /health?verbose=1` adds `sessionCount`, which
  costs a Redis `KEYS` scan.
- **Report connection state from local client state**, not by issuing a command.
  `isRedisHealthy()` reads the client's `isReady` flag.
- **Never point the health check path at a route that doesn't exist yet.** Deploy
  the route first, verify 200 in production, *then* change the Render setting —
  otherwise health checks fail against a 404 and Render restarts the service.

What went wrong: `/health` computed `sessionCount` via `KEYS session:*`, one billed
Upstash command per probe. That alone consumed the entire 500k/month free tier
while real gameplay used under 2k. It also ran a Postgres `SELECT 1` on every hit.

## Upstash Redis budget

Free tier: **500,000 commands/month**, resets on the 1st. Treat it as a hard design
budget, not a formality.

- Sessions are the only Redis dependency. Graceful degradation to `MemoryStorage`
  exists and works, but sessions are lost on restart.
- The hot read path (`getSession`) uses `GETEX` for one command per read. Do not
  regress this to `get()` + `set()` — that doubles cost to persist
  `lastActivityTime`, which only `MemoryStorage.cleanup()` ever reads.
- `RedisStorage.count()` is O(N) and billed per call. Diagnostics only; never on a
  path a monitor can poll.
- If Redis usage ever looks high, suspect an automated prober before suspecting
  users. Gameplay volume is small; probes are relentless.

## Render

- Backend service: `srv-d69ubnk9c44c738h8fh0` (`civic-trivia-backend`), starter
  plan, region `oregon`, auto-deploys on commit to `master`.
- Starter plan does **not** spin down, so uptime pings are for alerting, not
  keepalive.
- Changing service settings needs Render's REST API — the Render MCP server
  exposes no `update_web_service` tool.

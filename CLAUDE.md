# Civic Trivia Championship — working notes

## How changes land (Chris, 2026-09-17)

**Everything goes through a pull request — docs and CLAUDE.md included.** Not just
product code.

`master` has a ruleset requiring two build checks, and an admin bypass that lets a
direct push through anyway. It reports `2 of 2 required status checks are expected`
and lands the commit regardless. That bypass exists; **do not use it.** A docs change
that skips the gate is still a change nobody reviewed, and doing it twice is how it
stops being an exception.

The rule is about the gate, not the merge: once a PR's checks are green it can be
merged normally.

Also relevant: **never rename the CI job names.** The ruleset matches them by name, so
a rename silently stops the required checks from ever reporting.

## Health endpoints (learned the hard way, 2026-07-25)

> **Where this applies now:** the service these rules were written for is suspended
> (see Render, below). The rules still bind — carry them into `ev-accounts`, which
> serves production and talks to the same Upstash instance.

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

**Verified 2026-09-09; the deploy-filter bullet re-verified 2026-09-17.**

- Backend service `srv-d69ubnk9c44c738h8fh0` (`civic-trivia-backend`) is
  **suspended**, with `autoDeploy: no` and `autoDeployTrigger: off`. It serves no
  traffic and a push to `master` will not deploy it. Production CTC is served by
  the `ev-accounts` engine at `https://api.empowered.vote` (`/ctc`, `/api/trivia`).
- The **frontend** static site (`srv-d6a0o4jnv86c73f71seg`, `civic-trivia-frontend`)
  is the only live Render service fed by this repo, and it auto-deploys from
  `master`. Merging to `master` is therefore a production deploy; there is no
  staging environment.
- **Its Root Directory is `frontend`, and that filters deploys BOTH ways.** A
  commit touching `frontend/` ships. A commit touching nothing under `frontend/`
  — a docs-only change, a CLAUDE.md edit, this very bullet — creates **no deploy
  at all.** Not a slow one: none. Render never builds it and the deploy list
  never mentions the commit.

  Verified 2026-09-17 against the whole deploy history: every deploy corresponds
  to a commit with at least one file under `frontend/`, and the one commit
  without (`b3d1bb8`, a docs rewrite) produced nothing. Beware the misleading
  case — `713fa75` is titled `docs(bobits): ...` and did deploy, because it also
  changed `BobbitCivicFactSitter.tsx`. **Judge by the file list, never the commit
  message.**

  Consequences: doc commits to this repo are free and cannot break production;
  and if you ever need to force a rebuild without a code change, an empty commit
  will NOT do it — touch a file under `frontend/` or trigger the deploy from the
  dashboard.
- Starter plan does **not** spin down, so uptime pings are for alerting, not
  keepalive. (Historical — applies to the suspended service and to whatever plan
  ev-accounts runs on.)
- Changing service settings needs Render's REST API — the Render MCP server
  exposes no `update_web_service` tool.

## Question quality rules — the enforcement flag (2026-09-27)

`TRIVIA_QUALITY_RULES_ENFORCE` is a **comma-separated list of rule names, not a
boolean** (ev-accounts #825). It reads:

| value | meaning |
|---|---|
| unset, `""`, `false`, `none` | nothing enforces |
| `true`, `all` | every rule enforces — what the old boolean meant, still honoured |
| `nested-options,other-rule` | exactly those rules enforce |

**Currently set to `nested-options`** on the Render cron job
`ev-jobs-trivia-pipeline` (`crn-dain8nuk1f9s738t6gs0`).

It is a list rather than a switch because the rules do not share a false-positive
rate, so they cannot share a setting. `checkPureLookup` matches **15.3% of the live
news bank** — it flags "in what year was..." shapes, which is an ordinary news
question — so enforcing everything would block a large share of each night's output.
That is why enforcement sat off entirely from #816 until the flag was split, and why
`pure-lookup` is deliberately still unenforced.

- **The gate does not validate rule names.** It stays free of the rules registry so
  it can be tested without a database, which means it cannot tell a typo from a rule
  it has not heard of: `nseted-options` parses as a rule name, matches nothing and
  blocks nothing. It fails quiet, so confirm what was actually parsed rather than
  what you meant to set. Do not "fix" this by importing the registry.
- **Confirm it from the database, not from the dashboard.** Each run writes what was
  in effect into `trivia.generation_jobs.notes.qualityRules`: `enforced` (boolean,
  any rule), `enforcedRules` (the names, `["*"]` for all), `blocked` (actually
  refused) and `suppressed` (would have been refused had its rule been enforced, and
  was written anyway). Read `suppressed` before adding a rule to the list — it is the
  cost of adding it, measured in advance.
- **No MCP tool reads Render environment variables**, only `update_environment_variables`
  (which merges by default). The value cannot be confirmed from the API, so set it
  explicitly and verify from the notes row above.
- **An empty night proves nothing.** This pipeline legitimately yields 0–4 questions
  on many nights, so `audited: 0` means the setting was never exercised — not that it
  works.
- **Rolling back needs no deploy.** Clear the flag or set it to `none`. Changing it
  does trigger a redeploy of the cron job, but the running code re-reads the variable
  per question rather than at import.

The `nested-options` rule itself is **vendored in two places**: this repo's
`backend/src/services/qualityRules/rules/` (guards the collection-creation scripts)
and `ev-accounts/backend/src/trivia/services/qualityRules/rules/` (guards the nightly
pipeline). **The tests for both live only beside the ev-accounts copy**, because this
repo has no test runner — a change made here is untested until it is carried over.

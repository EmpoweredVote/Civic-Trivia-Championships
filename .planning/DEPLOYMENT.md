# Deployment Documentation

**Status:** Frontend LIVE. This repo's backend is FROZEN and serves nothing.
**Last Updated:** 2026-09-09 (verified against the Render API and the live Supabase project)
**Previous revision:** 2026-02-17 — described a single-service architecture that no longer exists.

---

## Live URLs

- **Frontend:** https://ctc.empowered.vote (also https://civic-trivia-frontend.onrender.com)
- **API:** https://api.empowered.vote — served by **`ev-accounts`**, not by this repo
- **GitHub Repo:** https://github.com/EmpoweredVote/Civic-Trivia-Championships (public)

---

## Architecture Overview

```
Frontend  (Render Static Site, this repo's frontend/)
    |
    | API calls to
    v
ev-accounts engine  (https://api.empowered.vote)
    |   mounts a vendored copy of CTC's routers at /ctc and /api/trivia
    |   canonical source: ev-accounts/backend/src/trivia/
    |
    +--> PostgreSQL  (Supabase project kxsdzaojfaibhuzmclfq, schema `trivia`)
    +--> Redis       (Upstash stirred-pika-7510, session storage)

this repo's backend/   -- FROZEN. Deploys nowhere. History and reference only.
```

### The ownership split (ev-cto decision 0013, 2026-09-05)

| Change | Repo |
|---|---|
| UI, components, game screens | **this repo**, `frontend/` |
| Questions, collections, content scripts | **this repo**, `backend/src/scripts/` + DB |
| Routes, tables, migrations, services | **`ev-accounts`**, `backend/src/trivia/` |

A change committed to this repo's `backend/` reaches nothing and creates silent drift — the
fold vendored the runtime with no dependency link back. See `backend/FROZEN.md`.

Anything needing a new route, table, or migration **cannot be done in this repo.**

---

## Render

**Account:** chris@empowered.vote · **Dashboard:** https://dashboard.render.com

### Frontend Static Site — LIVE

**Service:** `civic-trivia-frontend` · Region: Oregon (US West)

- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Auto-deploys from `master`. **Deploys are gated on CI** — the required check names are
  enforced by the master ruleset. **Never rename a CI job.**

**Environment:** split across two places.

- `frontend/.env.production` **is tracked in the repo** and holds Vite public vars — e.g.
  `VITE_SUPABASE_ANON_KEY`, switched from the legacy anon key to the **publishable** key on
  2026-09-09 (`9122c4e`).
- The production **API URL** is Render-env-only. Ask for it rather than guessing.

**Anything in a `VITE_`-prefixed var is inlined into the public bundle at build time.** Only
publishable values belong there — never a service key or a secret. Note that reading `.env`
files is blocked by a deny rule in this workspace, which is deliberate; don't route around it.

### Backend Web Service — SUSPENDED

**Service:** `srv-d69ubnk9c44c738h8fh0` (`civic-trivia-backend`) · starter plan · Oregon

Verified 2026-09-09: `suspended: suspended`, `autoDeploy: no`, `autoDeployTrigger: off`.
It serves no traffic, and **a push to `master` will not deploy it.** Retained so its config
and history stay inspectable.

Health check path was `/health/live`. Starter plan does **not** spin down, so uptime pings
were for alerting, not keepalive — there is no sleep-mode problem to work around here.

**Changing service settings requires Render's REST API** — the Render MCP server exposes no
`update_web_service` tool.

---

## Supabase

**Account:** chris@empowered.vote
**Project ref:** `kxsdzaojfaibhuzmclfq` — shared across Empowered.Vote apps
**Schema:** `trivia`

CTC has been on this shared project since Phase 40 (2026-02-28). Cross-app identity is
confirmed working; `GET /api/users/profile/identity` (Bearer auth) returns the user UUID for
cross-app comparison.

### Connection — read this before changing anything

- **Role: `ctc_app`** — a dedicated, **non-rotating** role, via the **Session pooler**.
- **Region MUST be `us-west-1`.** `us-east-1` will fail.
- **Do NOT revert to the `postgres` user.** It auto-rotates, which caused recurring
  production outages until this was fixed on 2026-06-03.

### Dashboard navigation gotcha

**Exposed Schemas** is under Settings → **Schema**. (Settings → API is the outdated path.)

### Content inventory (queried 2026-09-09)

| | Count |
|---|---|
| Collections total | 42 |
| Collections active | 41 — 25 city, 14 state, 1 federal, 1 international |
| Active questions | 3,825 (of 8,389 rows) |
| Active questions in active collections | 3,734 |

**Open discrepancy:** `Climate Agreements` is `is_active = false` with 91 active questions
behind it, despite Phase 79-02 being marked complete. Not playable. See STATE.md.

---

## Authentication

**Supabase migrated to ES256 on 2026-04-03.** Verification is JWKS-based via
`createRemoteJWKSet`. The old symmetric `JWT_SECRET` / `JWT_REFRESH_SECRET` scheme is
**obsolete** — do not reintroduce it. Other EV services may still need the same fix.

**Admin access:** the CTC admin panel is role-aware. Either a `ctc_content_editor` role or an
`admin_users` row grants access; the role alone is now sufficient.

---

## Upstash Redis

**Database:** `stirred-pika-7510` · **Dashboard:** https://console.upstash.com

**Free tier: 500,000 commands/month, resets on the 1st.** Treat it as a hard design budget.
(The previous revision of this doc said 10,000/day — that was wrong.)

- Sessions are the only Redis dependency. Graceful degradation to `MemoryStorage` works, but
  sessions are lost on restart.
- The hot read path (`getSession`) uses **`GETEX`** — one command per read. **Do not regress
  to `get()` + `set()`**; that doubles cost to persist `lastActivityTime`, which only
  `MemoryStorage.cleanup()` ever reads.
- `RedisStorage.count()` is O(N) and billed per call. Diagnostics only — never on a path a
  monitor can poll.
- **If usage looks high, suspect a prober before suspecting users.** Gameplay volume is small;
  probes are relentless.

### Health endpoint rules (learned the hard way, 2026-07-25)

Render polls a configured health check path **every 5–10 seconds, not configurable** — roughly
500,000 hits/month. In July 2026 `/health` computed `sessionCount` via `KEYS session:*`, one
billed command per probe. That alone consumed the **entire** monthly free tier while real
gameplay used under 2k.

- **The platform probe path must be dependency-free** — no Redis, no Postgres, no outbound
  HTTP. `/health/live` is that path.
- **Diagnostics go behind a flag.** `/health` reports dependency status; `/health?verbose=1`
  adds `sessionCount` and its `KEYS` scan.
- **Report connection state from local client state**, not by issuing a command —
  `isRedisHealthy()` reads the client's `isReady` flag.
- **Never point a health check path at a route that doesn't exist yet.** Deploy the route,
  verify 200 in production, *then* change the Render setting — otherwise probes hit a 404 and
  Render restarts the service.

These rules still bind. Carry them into `ev-accounts`, which now serves production and talks
to the same Upstash instance.

---

## Platform Integration

**Canonical API URL (since 2026-04-02):** `https://api.empowered.vote`. Both
`EMPOWERED_ACCOUNTS_API_URL` and `EMPOWERED_ACCOUNTS_URL` point here. The old
`accounts-api.empowered.vote` subdomain is deprecated.

| Award | Call | Key |
|---|---|---|
| XP | POST `{API}/api/xp/award` via `awardPlatformXp()` | `TRIVIA_SERVICE_KEY` |
| Gems | POST `{API}/api/gems/award` via `awardPlatformGems()` | `TRIVIA_GEMS_KEY` |

The deprecated `connect.credit_gems` direct RPC is fully removed (migrated Phase 66).

---

## Deployment Workflow

### Automatic deploys

Push to `master`. Render rebuilds the **frontend static site** only; CI must pass first.
A commit touching only `backend/` or docs ships nothing.

```bash
git push origin master
```

Workflow-file pushes work — the token carries `workflow` scope (confirmed 2026-09-01).

### After any bundler or dependency bump

```bash
cd frontend && npm run smoke
```

**A green build is not a page load.** A Vite 8 bump built cleanly and produced a blank white
page in production: `react-canvas-confetti` is CJS-only and triggered React error #130. It was
replaced with `canvas-confetti` directly. Run the smoke test.

### Manual deploy

Render dashboard → service → "Manual Deploy" → "Deploy latest commit".

### Logs

Render dashboard → service → Logs → Live tail. Also available through the Render MCP server
(`list_logs`, `get_metrics`).

**Render MCP setup:** endpoint is `/mcp`; OAuth is broken (no DCR), so it needs a
`RENDER_API_KEY` env var — reuse the one from EV-Accounts `.env`.

---

## Local Development

```bash
cd frontend && npm run dev     # http://localhost:5173
cd backend  && npm run dev     # reference only; serves nothing in production
```

Environment files are **not** in git. `backend/.env.example` and the Render dashboard are the
references. Never commit a populated `.env`.

---

## Content and Collection Work

This is the most active work owned by this repo.

**Creating a collection:** use the **`/create-collection <City, ST>`** skill — it researches,
writes, scaffolds, seeds and activates autonomously with no extra API spend. Manual fallback
steps and all quality conventions are in CLAUDE.md.

**Two rules that cause real damage if missed:**

1. **NEVER derive a collection from an `external_id` prefix.** Verified against the live DB
   2026-09-08: a prefix does not identify a collection and never has. Five collections use
   more than one prefix, and **`ind` is used by both Indiana and Indio CA** —
   `WHERE external_id LIKE 'ind-%'` matches 51 questions across the two. Join through
   `trivia.collection_questions` instead. Federal has no shared prefix at all
   (`q001`…`q120`), so prefix logic breaks on it entirely.

2. **Any new question-insert path MUST call `placeAnswer()`.** Generator prompts anchor
   `correctAnswer` to index 0, so answer position is guarded at write time —
   `backend/src/services/questionQuality/answerPlacement.ts` (also ported to ev-accounts;
   two copies exist, noted in the source).

**`collection_questions` is required.** `/api/game/collections` joins on it, and the activate
script does not populate it. Use the **guarded** insert from CLAUDE.md — the bare
`LIKE '<prefix>-%'` form cross-links on a shared prefix.

---

## Troubleshooting

### Frontend can't reach the API
1. Confirm the API URL in Render's frontend env (it is not in the repo).
2. Rebuild after changing it — Vite inlines env vars at build time.
3. CORS error? The allowed origin is configured in `ev-accounts`, not here.

### Blank white page after a deploy that built green
A CJS-only dependency under Vite. Check the browser console for React error #130 and run
`npm run smoke` locally. See the Vite 8 / confetti incident above.

### Database connection failures
1. Confirm the role is `ctc_app`, not `postgres` (which auto-rotates).
2. Confirm the region is `us-west-1`.
3. Confirm the Session pooler host, not the direct connection.

### Redis usage spiking
Suspect a prober, not players. Check what is polling `/health` and whether anything on that
path issues a Redis command. See the health endpoint rules above.

### Favicon looks wrong after a rebrand
Browser cache. Hard-reload before believing the deploy failed.

---

## Team Access

**GitHub:** https://github.com/orgs/EmpoweredVote/people → Invite member.

**Contributors:** Krishna Patel sends ongoing frontend tweaks via **fork PRs**. Review
caveats: partial extractions, test hacks, and PRs that may not pass `tsc`. The master ruleset
is active (both build checks required, admin bypass working) — confirmed 2026-07-18.

**Render:** free tier does not support team members; Chris manages deploys.

**Supabase:** shared project — access is managed at the Empowered.Vote org level.

---

## Cost

| Service | Cost | Note |
|---|---|---|
| GitHub | $0 | public repo |
| Render | frontend static site free; backend starter plan (suspended) | |
| Supabase | shared EV project | not billed to CTC alone |
| Upstash | $0 | free tier — **500k commands/month is a hard design budget** |

---

## Open Items

- [ ] **Decide on `Climate Agreements`** — inactive with 91 active questions behind it.
- [ ] **19 commits unpushed on `master`** (content-quality + answer-placement guard). Pushing
      deploys nothing, but the code lands in a frozen tree.
- [ ] **Reconcile Phase 80 (Admin Visibility) with decision 0013** — it is backend work and
      cannot be executed in this repo as planned.
- [ ] **Rotate/confirm the credentials that the 2026-02-17 revision of this file exposed.**
      That revision committed `JWT_SECRET`, `JWT_REFRESH_SECRET`, and a local Postgres
      password in plaintext to a **public** repo. They are redacted here and the symmetric JWT
      scheme is obsolete (ES256/JWKS now), but **git history retains them.**

---

*Verified 2026-09-09 against the Render API (`get_service`) and Supabase project
`kxsdzaojfaibhuzmclfq`.*

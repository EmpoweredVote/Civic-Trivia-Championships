# Handoff — engine consolidation: Civic Trivia + Validation Quests backends

**For:** a colleague's Claude Code session working in the Empowered Vote repos.
**Written:** 2026-09-04. **Author:** Chris Andrews' session.
**Updated:** 2026-09-04 — hourly CTC expiration sweep confirmed live on the engine (§3, §6.1); §7
corrected (old CTC backend is suspended, not "still running"); added the engine-deploys-restart-crons
note (§3). All verified against live Render/Supabase reads.
**Scope of this doc:** what has happened to the **Civic Trivia (CTC)** and **Validation Quests (VQ)**
backends as part of the "six engines → one" consolidation. Read this before touching either app, the
`ev-accounts` engine, or the two old Render services.

Full plan of record: `ev-accounts/.planning/2026-08-27-engine-consolidation-phase0.md` (also at
`~/Documents/GitHub/.planning/`). This doc is the current-state summary layered on top of it.

---

## 1. The one-paragraph picture

Empowered Vote is collapsing its separate always-on backends into a single platform engine, the
existing `ev-accounts` backend (Render service `ev-accounts-api`). Civic Trivia and Validation Quests
were each their own Render web service with their own Express app. Both have now been **folded into
the engine as modules** and both **frontends already talk to the engine**. The old CTC and VQ web
services are being retired. This is process consolidation only — the databases were already merged
onto one Supabase project in an earlier effort (`PLATFORM-CONSOLIDATION.md`, 2026-03).

---

## 2. Where each app runs now

The engine mounts each folded app under a **root prefix plus its original `/api/...` path**, served
from BOTH a short alias and the tidy path, so frontends cut over with one env var and no code change:

| App | Engine mounts | Frontend `VITE_API_URL` today |
|---|---|---|
| Civic Trivia | `/ctc/api/...` (alias) **and** `/api/trivia/...` | `https://api.empowered.vote/ctc` |
| Validation Quests | `/vq/api/...` (alias) **and** `/api/vq/...` | `https://api.empowered.vote/vq` |

Engine base URL: `https://ev-accounts-api.onrender.com` (public: `https://api.empowered.vote`).

**Both frontends are already cut over and verified live.** The two old backends now receive only a
health-check heartbeat (~12 requests/hour), no real user traffic.

---

## 3. What was done, per app

### Civic Trivia (CTC) — folded, live, old service SUSPENDED 2026-09-04

- **Routes/request path:** folded into `ev-accounts/backend/src/trivia/` (a runtime import closure of
  CTC's 6 routers), mounted in `backend/src/index.ts`. Shipped **PR #344** (merged `33613deb`),
  auto-deployed. Parity harness **49/49 green** against the live engine.
- **DB access:** CTC keeps its **own pg pool** with `search_path=trivia` and its own `supabaseAdmin`
  — byte-for-byte identical to the old service; the engine's own pool is untouched. Drizzle models
  are `pgSchema('trivia')`.
- **🔴 Required DB grant (already applied):** the engine's DB role `ev_api` had no privileges on the
  `trivia` schema (the old service connected as `ctc_app`). Fixed via migration
  **`CA_0102_grant_trivia_schema_to_ev_api.sql`** (PR #345) — GRANTs on all `trivia` tables/sequences/
  functions to `ev_api`, plus `ALTER DEFAULT PRIVILEGES` so future `trivia` tables auto-grant. Applied
  live. **If the DB is ever rebuilt, re-run CA_0102.**
- **Sessions:** read `TRIVIA_REDIS_URL` (node-redis, TCP). It is set, so CTC sessions are on Redis.
  Do **not** point it at the engine's `REDIS_URL` (that is Upstash REST/HTTPS; node-redis needs TCP).
- **🟢 CTC CRONS ARE NOW ON THE ENGINE (2026-09-04).** The three jobs — expiration sweep (hourly),
  election detection (daily 06:00 ET), pipeline (daily 02:00 ET) — were folded behind flag
  **`TRIVIA_CRONS_ENABLED`** (same pattern as VQ). The flag is set to `true` on `ev-accounts-api`
  (engine startup log: `[trivia] expiration + election-detection + pipeline crons started in-engine`).
  The old `civic-trivia-backend` service is **SUSPENDED** (`suspenders: [user]`, 2026-09-04), so there
  is no double-run.
- ✅ **Verification (2026-09-04 16:00 UTC): the hourly expiration sweep has now fired cleanly on the
  engine.** Engine log:
  `{"job":"expiration-sweep","message":"Sweep complete","newlyExpiredCount":0,"replacedCount":0,`
  `"skippedCount":0,"expiringSoonCount":130,"durationMs":118}` — 118 ms, no errors, 130 questions
  flagged expiring-soon. The daily election-detection (06:00 ET) and pipeline (02:00 ET) runs are
  still unobserved; the pipeline is by far the heaviest of the three.
- ⚠ **New operational property — engine deploys restart CTC's crons.** On a dedicated service the
  crons only restarted when CTC itself deployed. They now restart whenever *anyone* deploys anything
  to the engine. On 2026-09-04 the engine deployed 6 times (PRs #370–#374, compass/la-county work),
  logging `[trivia] ... crons started in-engine` 8 times. The 16:00 sweep finished at 16:00:00.121Z
  and a deploy restarted the process at 16:00:14 — a 14-second margin. A 118 ms sweep is safe; a long
  job landing in a deploy window is not. Treat restart-safety/idempotency of the pipeline job as a
  live concern, not a theoretical one.

### Validation Quests (VQ) — folded, live, old service SUSPENDED 2026-09-04

- **Routes/request path:** folded into `ev-accounts/backend/src/vq/` (29-file closure), one parent
  router at `['/vq/api','/api/vq']` that reproduces VQ's **load-bearing mount order** (transparency
  after quests; notifications/preferences before notifications) and VQ's own JSON error handler.
  Shipped **PR #346** (merged `11edb7c4`). Parity **33/33 green**.
- **DB access:** VQ uses `@supabase/supabase-js` (PostgREST) only — **no pg pool, no DB grant needed**
  (contrast CTC). Shared service_role/anon keys already reach `validation_quests` + `connect` +
  `empower`.
- **One new dependency:** `natural` (JaroWinkler in the normalization path — loaded via `require()`,
  so an import-only tracer misses it; grep `require()` too). Otherwise zero new env vars.
- **🟢 VQ CRONS ARE NOW ON THE ENGINE (2026-09-04).** consensus (every 5 min) + quest rotation (daily
  04:00 UTC) were folded behind flag **`VQ_CRONS_ENABLED`**. The old service was **suspended**, then
  `VQ_CRONS_ENABLED=true` was set on `ev-accounts-api`. Engine startup log confirms
  `[vq] consensus + rotation crons started in-engine`, and a consensus pass **ran cleanly at 16:00:36
  UTC** (222 quests processed, 0 resolved — starved, as expected, no errors). Sequence was
  suspend-first, then flag, to avoid double-execution.
- **Old service `empowered-validation-quests` is SUSPENDED (not deleted)** — reversible.

### Phase 4 — in-process calls (partly done)

Cross-service HTTP "loopback" calls the folded code used to make back to the engine are being replaced
with direct in-process calls:
- **Gems:** CTC and VQ gem awards now call `gemService` in-process (PR #358). CTC yellow + VQ yellow
  gems verified working live.
- **VR adjust (VQ submissions):** now a direct call to `lib/vqService.ts` (PR #352).
- **`/api/account/me`:** extracted to `lib/accountMeService.ts`; folded VQ calls it in-process (PR #360).
- **Remaining:** the VQ consensus job's callbacks and the XP-award loopback still use the service-key
  path; convert them when the VQ consensus cron is confirmed stable on the engine.

---

## 4. Live state snapshot (2026-09-04)

| Thing | State |
|---|---|
| `ev-accounts-api` (engine, `srv-d6h1pahr0fns739kfjfg`) | live, healthy, standard plan, **single instance** — now runs all folded crons |
| `civic-trivia-backend` (`srv-d69ubnk9c44c738h8fh0`) | **SUSPENDED 2026-09-04** (reversible); crons now on engine |
| `empowered-validation-quests` (`srv-d6l39fua2pns73bp3a70`) | **SUSPENDED 2026-09-04** (reversible); crons now on engine |
| `civic-trivia-frontend`, `validation-quests-frontend` | Render static sites, both pointed at the engine |
| `VQ_CRONS_ENABLED` on engine | **`true`** (set 2026-09-04) |
| `TRIVIA_CRONS_ENABLED` on engine | **`true`** (set 2026-09-04) |

---

## 5. Gotchas your Claude MUST know before editing

1. **Do NOT change `ev-accounts/backend/src/middleware/auth.ts` semantics.** A separate WorkOS AuthKit
   migration owns it. The engine is in a stable **dual-issuer** state (accepts Supabase JWKS **and**
   WorkOS tokens; WorkOS carries the internal id in the `external_id` claim). All three apps share the
   same check; the folded apps keep their own auth copies for now.
2. **The engine is strictly single-instance (`numInstances: 1`).** There are memory-store rate
   limiters, in-process locks, and module caches across accounts/CTC/VQ. Do not add anything that
   needs a second instance without addressing those.
3. **Cron flags are the safety valve.** `VQ_CRONS_ENABLED` / `TRIVIA_CRONS_ENABLED` exist so a folded
   cron never double-runs against its still-live old service. Flip a flag ON only at the moment the
   matching old service is suspended.
4. **The gem service-key env var is structured, not a bare string.** Malformed input fails at engine
   boot rather than at first use, so a bad value looks like a startup crash. Check its shape in the
   engine config and the Render dashboard before editing; one older VQ-specific variant is dead and
   read by nothing. Exact schema: see `ev-accounts` config + the Phase 0 plan of record.
5. **Pre-existing broken integration, NOT caused by the fold:** the service-key credential VQ presents
   on its gem/VR callbacks is not one the engine accepts, so those calls have been rejected for 30+
   days and red-gem awards / VR from the **consensus job** never applied. It fails closed — rejected,
   not mis-authorised. The live submissions path was already moved in-process (PR #352) and works; the
   consensus-job callbacks convert when that cron is confirmed on the engine, which removes the
   credential from the path entirely. Specifics of which header and which var are in the engine code
   and the Phase 0 plan — deliberately not restated here, since this repo is public.
6. **Consensus is starved, not broken.** It needs ≥4 credible submissions on the same quest; the DB
   has ~222 active quests, most with zero submissions. Only one quest has ever reached threshold. Low
   `resolvedCount` is a participation gap, a product decision — not a code bug.
7. **`render.yaml` files are inert.** Render services are configured by hand. The VQ `render.yaml`
   even names its service differently from the live one. Read Render from the API/dashboard, never the
   file. The `validation-quests-worker` in that yaml was never deployed (there is no BullMQ queue in
   use — the worker was a stub).
8. **Retire = suspend, not delete.** Suspended services are one click to recover. No Render MCP tool
   suspends or deletes — that is a dashboard action.
9. **Migrations:** namespaced per author. Chris Andrews = `CA_NNNN` from `CA_0020`; Chris Cantrell =
   `CC_NNNN`. Decide the author before the number. See `ev-accounts/CLAUDE.md`.

---

## 6. What remains

Both old backends are now suspended and both cron sets run on the engine, so the core cutover is done.
Remaining items are verification and cleanup:

1. **Confirm the CTC crons fire cleanly on the engine.** ✅ *Hourly expiration sweep confirmed
   2026-09-04 16:00 UTC — clean, 118 ms (see §3).* Still to observe: daily election-detection
   (06:00 ET) and pipeline (02:00 ET). Watch the pipeline in particular — it is the heaviest job, and
   engine deploys now restart the crons mid-flight (see the ⚠ note in §3).
2. **Observation window before deleting anything.** Both old services are *suspended*, not deleted —
   fully reversible. Leave them suspended for a short soak; delete only after the engine's crons and
   both apps are confirmed healthy.
3. **Finish Phase 4** for VQ consensus-job callbacks + XP loopback now that the VQ crons run on the
   engine; then remove the now-internal service keys.
4. **Docs:** update `DEPLOY.md` and `ev-cto/knowledge/STACK.md` to the final one-engine shape.
5. **Treasury enrichment cron** (separate track) is **archived** — never ran (`attempts=0` on 45,068
   rows), left suspended and recoverable. Do not revive without de-duplicating first.

---

## 7. Key identifiers

- **Supabase project:** `kxsdzaojfaibhuzmclfq` (`E.V Backend`, us-west-1).
- **Render workspace:** `tea-d69tn76mcj7s738vmt10` (EmpoweredVote, Oregon).
- **Engine:** `ev-accounts-api` = `srv-d6h1pahr0fns739kfjfg`.
- **Old CTC backend:** `civic-trivia-backend` = `srv-d69ubnk9c44c738h8fh0` (**suspended** 2026-09-04,
  reversible — matches §3/§4; this line previously read "still running", corrected 2026-09-04).
- **Old VQ backend:** `empowered-validation-quests` = `srv-d6l39fua2pns73bp3a70` (suspended).
- **Repos:** `ev-accounts` (engine), `Civic-Trivia-Championships`, `empowered-validation-quests`.

If anything here conflicts with what you observe live, trust the live Render/Supabase read and say so.

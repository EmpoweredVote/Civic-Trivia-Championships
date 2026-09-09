# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Make civic learning fun through game show mechanics — play, not study. No dark patterns, no guilt, no pressure.
**Current focus:** None assigned. Phase 80 (Admin Visibility) is the next unstarted GSD phase; recent work has run outside `.planning/`.

## Current Position

Phase: 79 of 80 complete (Launch Collections)
Plan: 2 of 2 in phase 79
Status: Phase 79 complete; Phase 80 pending and **not yet planned** (no `.planning/phases/80-*` directory)
Last GSD phase activity: 2026-04-09 — Completed 79-02 (Climate Agreements Launch)
Last repo activity: 2026-09-08 — content-quality / answer-placement guard workstream (untracked by `.planning/`)

Progress: [██████████] v1.0–v2.4 complete (Phases 1–74); v2.5 Phases 75–79 complete; Phase 80 pending

**Work done outside `.planning/` since 2026-04-09** (no phase dirs; see git log):
- **Bobit collection feature, stages 1–4** — merged to master (`41179fd`, `f4a1d47`). Specs and plans
  live in `docs/superpowers/`, not `.planning/`.
- **Content-quality workstream, 2026-09-08** — bank-wide answer-position and value-bracket
  remediation, plus a write-path guard (`answerPlacement.ts`) and audit assertion. 19 commits,
  currently **unpushed** on master.

**Deployment Status (verified 2026-09-09):**
- Frontend LIVE: https://civic-trivia-frontend.onrender.com / https://ctc.empowered.vote (Render static site, auto-deploys from master)
- Backend: **this repo's `backend/` is FROZEN and serves nothing.** Production CTC is served by the
  `ev-accounts` engine at https://api.empowered.vote (`/ctc` and `/api/trivia`). See `backend/FROZEN.md`
  and ev-cto decision 0013. Canonical backend source: `ev-accounts/backend/src/trivia/`.
- `civic-trivia-backend` Render service (`srv-d69ubnk9c44c738h8fh0`): **suspended**, auto-deploy **off**.
- Database: Supabase shared project (kxsdzaojfaibhuzmclfq) — `trivia` schema
- Redis: Upstash (stirred-pika-7510) — free tier, 500k commands/month
- Collections: **42 total, 41 active** — 25 city, 14 state, 1 federal, 1 international (War in Iran).
  **Climate Agreements is `is_active = false`** despite Phase 79-02 being marked complete; it holds 91
  active questions but is not playable. Unresolved — see Pending Todos.
- Questions: 3,825 active of 8,389 total; 3,734 active questions sit in active collections.
  All active questions are linked in `collection_questions` (0 unlinked).

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Phase 79-02 decisions (2026-04-09):
- seed-climate-agreements.ts calls runPipeline() programmatically with volatility=medium (CLI has no --volatility flag)
- Blue Marble Earth photo (Apollo 17, NASA public domain) chosen as banner — no attribution required, global imagery
- 3 pipeline runs produced 17 questions: same RSS dynamics as war-in-iran (3 clusters per run, ~5-6 questions each)
- Medium volatility = expires_at +10 days (computeExpiresAt midpoint); verified all clima- questions have correct expiry

Phase 79-01 decisions (2026-04-09):
- MIN_INTERNATIONAL_THRESHOLD=8 added to game.ts — filter is now tier-conditional (8 for international, 50 for others)
- Supabase CLI --file flag requires path relative to workdir (project root), not CWD
- 3 pipeline runs needed for 15 questions: RSS dedup produces 3 clusters per run, ~4-6 questions per cluster set
- world-news topic (id=749) lazy-created by first pipeline run — climate-agreements run will find it

Phase 78-02 decisions (2026-04-09):
- INTERNATIONAL_COLLECTIONS array is empty pending Phase 79 — correct by design; cron logs "skipping" cleanly
- POOL_CEILING = 72 — archive down to 72 so post-generation pool stays ≤80 (at most 8 new per run)
- DRAFT_THROTTLE_LIMIT = 20 — matches CONTEXT.md requirement; prevents Claude spend when reviewer queue is full
- MAX_QUESTIONS_PER_RUN = 8 — matches CONTEXT.md and plan requirement; limits API spend per collection per run
- Failed collection writes own generation_jobs row — maintains audit trail even when pipeline throws

Phase 78-01 decisions (2026-04-09):
- volatility default is 'fast' — existing CLI usage unaffected; backward compatible
- maxQuestions defaults to undefined (no cap) — backward-compatible CLI behavior preserved
- computeExpiresAt uses midpoint of each volatility band: fast=4d, medium=10d, slow=60d, stable=180d
- ESM import guard pattern established: process.argv[1] === fileURLToPath(import.meta.url)
- parseArgs process.exit calls retained in parseArgs() (only called from isDirectRun block)

Phase 77-02 decisions (2026-04-09):
- Low-confidence claims skip Claude Call 2 entirely — extractClaim() returns null, lowConfidenceSkipped counter incremented
- Quality gate is Claude-side in structured output (not post-hoc filter) — failing questions never written to DB
- No draft writes: CONTEXT.md overrides roadmap "save as draft" — questions are active or discarded
- World-news topic lazy-created in writePassingQuestions — no migration dependency
- Notes JSON cast as any to extend beyond narrow generationJobs schema type — widening deferred to future phase
- Dry-run mode skips all Claude calls (clusterArticles runs free) — preserves API budget during testing
- external_id format for international: {prefix}-{NNNN} (4-digit zero-padded)

Phase 77-01 decisions (2026-04-09):
- Feed list stored as typed const array (INTERNATIONAL_FEEDS) in rss-ingestor.ts — not hardcoded in logic, easily swappable to DB/config in Plan 77-02
- articlesSkipped tracked inside processFeed but not in FeedResult.articles (only passing articles stored) — notes JSON currently sets articlesSkipped=0; Plan 77-02 can extend
- HTTP-fetch-first / content:encoded-fallback body extraction strategy confirmed per CONTEXT.md (plan had it reversed in prose, CONTEXT.md is authoritative)
- rss-parser ships own types — @types/rss-parser does not exist on npm

Phase 76-01 decisions (2026-04-09):
- International section appears after Federal in collection picker: Local > State > Federal > International
- Freshness indicator gated on tier === 'international' (not just latestQuestionAt presence) — backend returns field for all tiers
- formatFreshness: < 1m = just now, < 60m = Xm ago, < 24h = Xh ago, >= 24h = Mon D (Intl.DateTimeFormat, no date-fns)
- Same Bebas Neue / #9A8878 / 10px style for freshness indicator as admin question count row

Phase 75-01 decisions (2026-04-09):
- DB Foundation complete: generation_jobs, user_collection_mutes tables created; questions.fact_snapshot, confidence_tier, generation_job_id columns added
- DDL applied directly via Supabase MCP SQL (consistent with project convention — no drizzle-kit push)
- generationJobs placed before questions in schema.ts to satisfy FK forward-reference order
- Supabase CLI multiline SQL in shell arg causes 400 error; use --file flag as standard workaround

v2.5 decisions at roadmap time (2026-04-08):
- International pipeline uses RSS-body-first strategy (`<content:encoded>` primary, HTTP fallback) — bypasses paywall and JS-rendering issues without extra packages
- Partisan framing is a BLOCKING quality gate for International content (not advisory) — err toward omission over queue overload
- expirationSweep.ts replacement generator must skip tier === 'international' collections — guard added in Phase 75 alongside schema work
- Phases 79 (launch collections) and 80 (admin visibility) are independent and can execute in parallel
- user_collection_mutes table is created in Phase 75 (DB foundation) but the muting UI is deferred to v2.6 — table exists, feature does not
- Reuters excluded (discontinued RSS June 2020); AP News excluded (no official RSS); 4 confirmed feeds: BBC World, NPR, The Guardian, DW
- Feed list stored in DB or config file — never hardcoded

### Pending Todos

- **Climate Agreements collection is inactive** (`is_active = false`) with 91 active questions behind it.
  Phase 79-02 is marked complete and this file previously claimed it was launched. Decide whether to
  activate it or record why it is held back.
- **19 commits unpushed on master** (content-quality + guard workstream). Pushing deploys nothing —
  backend service is suspended and the diff touches no `frontend/` files — but the code lands in a
  frozen tree. Decide: push for history, or treat this repo's `backend/` as reference-only.
- Tucson, AZ expiring ratio at 8.3% — below 15% advisory target; ~6 more officeholder questions would close it (non-blocking)
- Phase 80 (Admin Visibility) targets admin views on `generation_jobs` — it is a **backend** phase, so it
  cannot be executed in this repo. It needs replanning against `ev-accounts` or dropping.

**Resolved since last update:**
- ~~trivia_service DB role password reset~~ — superseded 2026-06-03 by the dedicated non-rotating
  `ctc_app` role via Session pooler (region `us-west-1`).
- ~~Decide AP News sourcing strategy before Phase 79~~ — moot; Phase 79 shipped with the 4 confirmed feeds.

### Blockers/Concerns

- Phase 80 as written is unexecutable here (backend frozen). The roadmap has not been reconciled with
  ev-cto decision 0013.

## Session Continuity

Last session: 2026-09-09 — stale-state reconciliation (this update)
Stopped at: Docs reconciled against live DB and Render. No code changes.
Resume file: None

Next action: Chris's call — bobit work (stages 1–4 shipped, base is clean), or resolve the two
decisions in Pending Todos (Climate Agreements activation, unpushed commits).

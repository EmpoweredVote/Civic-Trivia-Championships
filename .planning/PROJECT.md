# Civic Trivia Championship

## What This Is

A game-show-style trivia experience that makes civic learning engaging, social, and repeatable. Players answer multiple-choice questions about government, policy, and civic systems while earning rewards and deepening their understanding of democracy. Includes admin tooling for question quality management, content generation, and collection health monitoring. This is the first feature being built for the Empowered.Vote platform.

## Core Value

Make civic learning fun through game show mechanics — play, not study. No dark patterns, no guilt, no pressure.

## Current State (verified 2026-09-09) — supersedes anything below

The Validated / Key Decisions sections below are **dated delivery records**, accurate as of the
milestone each line is tagged with. Four of those facts have since changed. Where they conflict
with this block, this block wins.

| Recorded below | Current reality |
|---|---|
| Solo game flow is **10 questions** (v1.0) | Game is **5 questions** — `TOTAL_QUESTIONS = 5`, changed 2026-06-17 (8 → 5; it was 10 → 8 earlier). Q1–Q4 standard, **Q5 is the wager question**. |
| Gem awards via **`award_gems` RPC** (v1.8) | The direct RPC is **fully removed** (Phase 66). Gems go over HTTP: POST `{EMPOWERED_ACCOUNTS_API_URL}/api/gems/award` with `TRIVIA_GEMS_KEY`. Same for XP via `/api/xp/award` with `TRIVIA_SERVICE_KEY`. |
| Supabase JWT via **`SUPABASE_JWT_SECRET`** (v1.8) | Supabase moved to **ES256** on 2026-04-03. Verification is JWKS-based via `createRemoteJWKSet`. The shared-secret path is obsolete. |
| Backend deployed as a Render web service | **This repo's `backend/` is FROZEN and serves nothing** (ev-cto decision 0013). Production is the `ev-accounts` engine at `https://api.empowered.vote`. Only `frontend/` and content work ship from here. |

**Scale:** 42 collections (41 active — 25 city, 14 state, 1 federal, 1 international);
3,825 active questions. `Climate Agreements` is inactive despite Phase 79-02 being marked
complete — open decision, see STATE.md.

Note: the "8 questions" figures in **PIPE-05** and in the collection playbook's topic caps refer
to *generation limits*, not game length. Those are current and correct.

## Requirements

### Validated

- Solo game flow (10 questions, timer, answer reveal, wager, results) — v1.0
- Server-side scoring with speed bonus and wager mechanics — v1.0
- Learning content with "Learn more" modals — v1.0
- XP/gems progression and user profile — v1.0
- Auth system (email/password, JWT, session persistence) — v1.0
- WCAG AA accessibility, keyboard nav, screen reader support — v1.0
- 120 question bank with mixed difficulty — v1.0
- Mobile responsive, FCP <1.5s, TTI <3s, bundle <300KB — v1.0
- Redis session storage with graceful degradation — v1.1
- Plausibility detection with difficulty-adjusted thresholds — v1.1
- Learning content expanded to 27.5% coverage (33/120) — v1.1
- Single-click answer selection, improved game UX — v1.1
- Anonymous play (no login required to play) — v1.1
- PostgreSQL-backed question collections with tag-based associations — v1.2
- Card-based collection picker at game start — v1.2
- Federal, Bloomington IN, and Los Angeles CA collections (320 total questions) — v1.2
- Question expiration system with hourly cron sweep and admin review — v1.2
- AI-powered locale-specific content generation tooling — v1.2
- Codified question quality rules (dinner party test, civic utility, no pure lookup facts) — v1.3
- Audit existing questions against quality rules, archive bad ones, generate replacements — v1.3
- Refined AI generation pipeline with quality rules baked in — v1.3
- Admin web UI for exploring collections, questions, and Learn More content — v1.3
- Question telemetry (encounter/correct counts) with difficulty rates in admin UI — v1.3
- Indiana and California state question collections — v1.3
- Admin question editing with quality re-scoring and optimistic updates — v1.3
- ✓ Fremont, CA question collection (92 questions with sources, expiration dates, learning content) — v1.4
- ✓ Fremont topics (city government, Alameda County, California state, civic history, local services, elections, landmarks, budget/finance) — v1.4
- ✓ Fremont collection card with Mission Peak banner image — v1.4
- ✓ Collection seeded, activated, and playable in production — v1.4
- ✓ In-game flagging with optimistic UI, rate limiting, idempotent storage — v1.5
- ✓ Post-game elaboration with reason chips and free-text feedback — v1.5
- ✓ Admin flag review queue with archive/dismiss/restore actions — v1.5
- ✓ Question explorer flag integration with severity badges and cross-navigation — v1.5
- ✓ AI-powered repair of 107 broken source URLs across 320 questions — v1.5
- ✓ ADMIN_EMAIL environment variable with validation — v1.5

- ✓ Semantic duplicate detection infrastructure (OpenAI embeddings, cosine similarity, union-find clustering) — v1.6
- ✓ 268 duplicates archived across 6 collections via human review workflow with admin UI and undo — v1.6
- ✓ Advanced duplicate detectors: answer leakage, same-source factoid clustering, inverse duplicates — v1.6
- ✓ Self-validating AI generation pipeline: gap analysis → Claude → quality retry → semantic dedup → source diversity — v1.6
- ✓ Indiana (97) and California (91) scaled to 90+ questions; 519 total active questions — v1.6
- ✓ Zero active duplicates and zero quality violations confirmed across all collections — v1.6

- ✓ `election_races` table + `questions.election_race_id` FK; admin race creation UI at `/admin/elections` — v1.7
- ✓ `ElectionQuestionGenerator` service: timezone-aware expiry, idempotency, candidate-count-aware MCQ prompts — v1.7
- ✓ Daily 6 AM Eastern election detection cron: auto-generates questions for races within 60 days, idempotent — v1.7
- ✓ `CurrentTermQuestionGenerator`: admin enters winner + term end → current-term questions with term expiry — v1.7
- ✓ Three-tab `/admin/elections` UI: Active / Pending Generation / Awaiting Follow-up lifecycle management — v1.7
- ✓ Election pipeline hardening: unfiltered admin collections endpoint, jurisdiction DB validation, collectionSlug override — v1.7
- ✓ Norwich, England collection: 117 questions, en-GB locale, two-tier governance rules, playable in production — v1.7
- ✓ `checkAddressPhone` advisory quality rule + audit script for 519 active questions — v1.7

- ✓ Trivia tables migrated to `trivia` schema on shared Supabase (UUID FKs, 14 RLS policies, 953 questions, 7 collections) — v1.8
- ✓ Supabase JWT auth (jose jwtVerify) replacing custom bcrypt/JWT; admin guard via `public.admin_users` table — v1.8
- ✓ Gem awards via `award_gems` RPC (yellow gems, civic_trivia source); player stats in `trivia.player_stats` for Connected tier — v1.8
- ✓ Frontend rewired to Empowered Accounts API — login, signup, logout, token refresh; hybrid token storage — v1.8
- ✓ Profile page rebuilt: trivia stats + gem balance + tier badge + display name from accounts API — v1.8
- ✓ Legacy auth stack fully removed: 9 files deleted, 10 packages removed, users table dropped, custom JWT env vars removed — v1.8
- ✓ Auth state hardened: tierResolved flag, AdminGuard race condition fixed, dead exports removed — v1.8

- ✓ DB-driven `COLLECTION_HIERARCHY` (runtime DB tier lookup; zero hardcoded display-name maps) — v1.9
- ✓ State collection configs registered in standard generator workflow (state-configs/ auto-discovery via dynamic import) — v1.9
- ✓ Fremont, CA collection active and playable in production (54 questions) — v1.9
- ✓ Norwich, England collection active and playable in production (117 questions) — v1.9
- ✓ Cambridge, MA — scaffold, generate (125 questions), curate, activate — v1.9
- ✓ Massachusetts State — scaffold, generate (90 questions), curate, activate — v1.9
- ✓ Plano, TX — scaffold, generate (85 questions), curate, activate — v1.9
- ✓ Texas State — scaffold, generate (60 questions, mixed-durability), curate, activate — v1.9

- ✓ XP awards via Empowered Accounts API (server-side, score-proportional 50–200 XP, idempotent by sessionId, non-Connected silently skipped) — v2.0
- ✓ XP start screen: Connected players see level + progress bar (`XpStrip`); non-Connected see "Link account to earn XP" prompt — v2.0
- ✓ XP end screen: `+XP earned` animation (`XpReveal`), level-up overlay (`LevelUpOverlay`), `is_duplicate` neutral "Already recorded" handling — v2.0
- ✓ XP transaction history panel on profile page — paginated, Connected tier only, via `get_ctc_xp_history()` Supabase RPC — v2.0
- ✓ Startup env validation warnings for missing `TRIVIA_SERVICE_KEY` / `EMPOWERED_ACCOUNTS_API_URL` / `EMPOWERED_ACCOUNTS_URL` — v2.0

- ✓ Portland, OR city collection (83 questions, 18.1% expiring) — v2.1
- ✓ Oregon State collection (81 questions, structural 7.4% expiring ceiling) — v2.1
- ✓ Washington, DC collection (154 questions, district framing, 9.7% expiring) — v2.1
- ✓ Biloxi, MS city collection (170 questions, 15.3% expiring) — v2.1
- ✓ Mississippi State collection (86 questions, 15.1% expiring) — v2.1
- ✓ Semantic near-duplicate detection automated in `generate-locale-questions.ts` (`runWithinCollectionSemanticDedup()` auto-runs after seeding) — v2.1
- ✓ Expiring-question ratio warning in `audit-collection-readiness.ts` (non-blocking, warns <15%) — v2.1
- ✓ `COLLECTION-PLAYBOOK.md` bootstrapped with 6 sections and 5 phase retrospectives — v2.1

- ✓ Scaffold Bug 2 fixed — `scaffold-collection.ts` brace scanner starts from ` = {` assignment; post-scaffold `git checkout` workaround permanently eliminated — v2.2
- ✓ `OfficeholderEntry` structured type in LocaleConfig drives prompt injection and post-generation `expiresAt` auto-seeding — zero manual targeted pass for any collection with field populated — v2.2
- ✓ Hourly expiry cron extended: `generateReplacement()` archive-first, never-throw, topic-matching, seeded as active — collections never shrink — v2.2
- ✓ `awardPlatformGems()` migrated from deprecated `connect.credit_gems` RPC to `POST /api/gems/award` with `TRIVIA_GEMS_KEY` and idempotency key — v2.2
- ✓ Public leaderboard at `/leaderboard` — top-25 by XP, podium top-3, sticky-you row, privacy-by-default, no auth required — v2.2
- ✓ Santa Monica, CA (18th collection) — 84 active questions, 19.8% expiring, first collection built end-to-end with officeholders field — v2.2

- ✓ "Next Question" / "Last Question" / "Game Recap" buttons replace tap-anywhere icon — v2.3
- ✓ Full game screen fits without scrolling on mobile and desktop (timer shrinks 80px→56px during reveal; overflow-hidden on both containers) — v2.3
- ✓ Gem threshold: 1 gem at 1,000+ final score (replaces 6/8 or 7/8 accuracy rule); 2 gems for 8/8 perfect unchanged — v2.3
- ✓ Wager screen yellow gem indicator lights up when projected score (currentScore + proposedWager) ≥ 1,000 — v2.3
- ✓ Leaderboard reflects XP within ~1 minute (CACHE_TTL reduced 300s → 60s) — v2.3

- ✓ Arizona state collection — 98 active questions, 15.3% expiring, playable in production — v2.4
- ✓ Tucson, AZ city collection — 96 active questions, zero overlap with AZ state questions, playable in production — v2.4
- ✓ Phoenix, AZ city collection (bonus) — 91 active questions, playable in production — v2.4
- ✓ Collection picker search/filter — debounced text input (150ms) filters 26+ collections by name; flat grid when filtering, full Federal/State/Local grouped view when cleared; case-insensitive substring match — v2.4

### Active

**v2.5 International Collections** — Phases 75–80

- [ ] PIPE-01: System ingests RSS feeds daily from curated Tier 2 sources with per-feed error isolation
- [ ] PIPE-02: System extracts article content with RSS-body-first strategy and 300-word minimum gate
- [ ] PIPE-03: System deduplicates stories before Claude generation (same event → at most one question cluster)
- [ ] PIPE-04: System generates MCQ questions via Claude; partisan framing is blocking; failing questions go to admin review draft queue; passing questions publish active
- [ ] PIPE-05: Pool regulation per collection: 40–80 target, 8 questions/day cap, 3–14 day expiry by volatility class
- [ ] PIPE-06: System logs each pipeline run to `generation_jobs` table
- [ ] INTL-01: "International" section in collection picker alongside Federal/State/City with freshness indicator
- [ ] INTL-02: `scaffold-collection.ts --tier international` + `InternationalLocaleConfig` interface
- [ ] INTL-03: War in Iran collection live at launch (15+ active questions, fast expiry)
- [ ] INTL-04: Climate Agreements collection live at launch (15+ active questions, medium expiry)
- [ ] ADMIN-01: Admin pipeline job history (date, collection, generated/flagged/activated counts)
- [ ] ADMIN-02: Admin pool health monitor per International collection (warning if < 20 active)
- [ ] ADMIN-03: Pending review count on admin dashboard; pipeline throttles when pending > 20

### Out of Scope

- Team/multiplayer mode — Phase 2
- Real-time WebSocket features — Phase 2
- Events/hosted mode — Phase 4
- Question authoring tool — Phase 5
- Leaderboard advanced features (tournaments, seasonal resets) — basic leaderboard shipped v2.2; advanced features deferred
- OAuth login (Google, GitHub) — email/password sufficient for MVP
- Mobile native app — web-first approach
- Video/image questions — text-only for MVP
- Classroom dashboard — future consideration
- Location-based auto-assignment of collections — deferred until Connected account address integration is ready (manual search filter shipped v2.4 as foundation)
- Collection recommendations / "you might like" — not enough user behavior data yet
- Volunteer question authoring portal — AI generation + manual review sufficient for now
- Numeric/date answer questions (Wits & Wagers style) — requires multiplayer first
- Auto-difficulty calibration — collecting telemetry data, calibrate later
- Granular admin permissions (editor, reviewer roles) — boolean is_admin sufficient for now
- Real-time telemetry dashboard — batch/on-demand stats sufficient at current scale

## Context

**Current state (v2.4 shipped 2026-03-23):**
- 26 collections active: Federal, Bloomington IN, Los Angeles CA, Indiana, California, Fremont CA, Norwich UK, Cambridge MA (125), Massachusetts (90), Plano TX (85), Texas (60), Portland OR (83), Oregon (81), Washington DC (154), Biloxi MS (170), Mississippi (86), Santa Monica CA (84), Indio CA (169), Alexandria LA, Louisiana, Springfield MO, St. Louis MO, Missouri, Arizona (98), Tucson AZ (96), Phoenix AZ (91) — all on shared Supabase project (kxsdzaojfaibhuzmclfq); ~2,967 active questions
- Collection picker: search/filter bar at top — debounced (150ms), case-insensitive substring match on collection name; flat grid when filtering, full Federal/State/Local grouped view when cleared; empty state for zero matches
- `/create-collection` skill proven autonomous end-to-end — AZ collections created with no manual steps; DB state is authoritative verification record (no phase dirs required for skill-created collections)
- Game flow: `NextStepButton` component with contextual labels (NEXT QUESTION / LAST QUESTION / GAME RECAP); tap-anywhere fully removed; timer shrinks to 56px during reveal to prevent mobile scroll
- Gem scoring: `GEM_SCORE_THRESHOLD = 1000` in `progressionService.ts`; 1 gem when finalScore ≥ 1000; 2 gems for perfect 8/8; wager strategy meaningful for gem earning; gem award API call skipped when gemsEarned === 0
- Wager preview: gem indicator on wager screen (gold/dim Framer Motion transition) signals gem outcome before final answer
- Leaderboard cache: CACHE_TTL = 60s (down from 300s) — XP rankings reflect earned XP within ~1 minute
- Content ops pipeline: `generateReplacement()` wired into hourly expiry cron — archive-first, topic-matching, seeded as active; collections self-heal after question expiry
- Structured officeholders: `OfficeholderEntry[]` in LocaleConfig drives prompt injection (`buildOfficeholderBlock()`) and post-generation `expiresAt` auto-seeding (`seedOfficeholderExpiresAt()`) — zero manual targeted pass needed
- Scaffold tool clean: `scaffold-collection.ts` brace scanner fixed; no post-scaffold workaround required
- Gems: `awardPlatformGems()` routes to `POST /api/gems/award` with `TRIVIA_GEMS_KEY`; `connect.credit_gems` RPC fully removed
- Leaderboard live at `/leaderboard` — top-25 by XP, podium for top-3, sticky-you row, privacy-by-default, accessible without auth; backend queries `connect.connected_profiles` directly
- XP integration: `awardPlatformXp()` awards 50–200 XP server-side after each game for Connected players; idempotent by sessionId; displayed on start screen, end screen, and profile XP history tab
- XP history: `get_ctc_xp_history()` Supabase SECURITY DEFINER RPC — pattern for cross-schema `connect` data access
- Collection infrastructure: DB-driven tier lookups, state configs auto-discovered — zero hardcoded maps; `audit-collection-readiness.ts` + `verify-post-activation.ts` standardize activation workflow
- Identity: Supabase JWT auth (jose jwtVerify), Connected tier guards, `public.admin_users` admin check — all legacy bcrypt/JWT removed
- Election pipeline: `election_races` table → question generation → daily 6 AM cron → current-term follow-up → admin lifecycle UI
- Quality rules engine with 9 rules; zero active duplicates, zero quality violations across all collections
- Self-validating AI generation pipeline: gap analysis → Claude → quality retry → semantic dedup → source diversity enforcement
- Admin UI: question explorer, collection health, inline editing, flag review queue, duplicate review, election management
- Player-driven quality curation: in-game flagging, post-game elaboration, admin triage
- Live: civic-trivia-frontend.onrender.com / civic-trivia-backend.onrender.com / ctc.empowered.vote

**Tech stack:** React 18, TypeScript, Vite, Tailwind, Framer Motion, Node.js, Express, Supabase (PostgreSQL), Redis (Upstash), jose, Drizzle ORM
- Frontend: ~14,000 LOC TypeScript/React
- Backend: ~31,500 LOC TypeScript/Express

**Question quality philosophy:**
- "Dinner party test" — would knowing this answer be worth sharing at dinner?
- Civic utility — the knowledge should make you a more informed citizen
- Recall satisfaction — pulling up something you didn't think you knew feels great
- Reasoning possible — you can work toward the answer, not just know it or not
- Anti-patterns: phone numbers, addresses, obscure dates, pure lookup facts with no civic value
- Easy questions are welcome — "Who is your mayor?" feels fair and memorable
- Quality rules codified as TypeScript functions with blocking/advisory severity


**Design principles (from design doc):**
1. Play, Not Study — Game show aesthetics, exciting pacing, friendly competition
2. Learn Through Discovery — Questions reveal interesting facts, explanations satisfy curiosity
3. Inclusive Competition — Anyone can play regardless of prior knowledge
4. No Dark Patterns — No daily streaks, loss aversion, or social pressure

**Visual direction:**
- Subtle game show stage aesthetic (curtains, spotlights, modern/clean)
- Empowered.Vote teal + warm accents (red theme for admin areas)
- Typography: Poppins or similar (confident, slightly playful)
- Modest celebrations (subtle confetti, not over-the-top)

**Timer design:**
- Circular progress (like iOS Screen Time)
- Color shifts: Teal → Yellow (50%) → Orange (25%) → Red (final 3s)
- No numeric countdown (reduces anxiety)

**Tone:**
- Never "wrong" — use "not quite"
- Focus on teaching, not judging
- Explanations are neutral, informative (1-3 sentences)
- Sources cited for data-heavy facts

**Reference doc:** `civic-trivia-championship-complete.md` contains full screen specs, interaction patterns, and detailed guidelines.

## Constraints

- **Tech stack**: React 18+, TypeScript, Vite, Tailwind, Framer Motion, Node.js, Express, Supabase (PostgreSQL), Redis (Upstash), jose, Drizzle ORM
- **Performance**: FCP <1.5s, TTI <3s, bundle <300KB gzipped
- **Accessibility**: WCAG AA compliance required
- **Content**: ~1,484 active questions across 12 collections (zero duplicates, zero quality violations), all source URLs validated

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Email/password auth only for MVP | Reduces complexity, OAuth can be added later | Good — sufficient for current usage |
| No leaderboards initially | Could discourage low-performers, needs research | Good — revisit if user demand |
| Visual timer (no digits) | Reduces anxiety while maintaining urgency | Good — positive feedback |
| "Not quite" instead of "Wrong" | Maintains encouraging tone | Good — matches brand tone |
| Tag-based collections over rigid categories | Questions can belong to multiple collections (e.g., Indiana + Bloomington) | Good — enabled clean multi-collection system |
| Quality over quantity for local sets | 50 compelling questions beats 100 half-compelling; target ~120 but don't force it | Good — 100 per locale with strong quality |
| AI-generated + human-reviewed content | AI kickstarts local question banks, volunteers refine over time | Good — efficient pipeline |
| Auto-remove + notify on expiration | Time-sensitive questions drop from rotation and flag for review | Good — admin review UI in place |
| Codify quality rules before scaling content | Phone number questions revealed need for explicit quality criteria | Good — 8 rules with blocking/advisory severity |
| Lightweight telemetry over complex analytics | Two columns (encounter_count, correct_count) give 80% of value | Good — simple and effective |
| Boolean is_admin over roles table | Only a few admins needed; RBAC adds unnecessary complexity | Good — simple and sufficient |
| Red admin theme vs teal player theme | Clear visual separation between admin and player experiences | Good — instantly distinguishable |
| Quality score informational, blocking flag actionable | Score (0-100) for sorting/display, hasBlockingViolations for archival decisions | Good — separates severity levels |
| URL validation deferred for legacy content | All 320 original questions have broken source.url links from CMS migration | Debt — needs dedicated URL update pass |
| State template 40/30/30 topic distribution | Government/civic processes/broader civics avoids "too bureaucratic" feel | Good — balanced content |
| Stable option IDs for drag-and-drop | Options tracked by opt-0/opt-1 ID, not array index, so correct answer follows during reorder | Good — prevents correctAnswer drift |
| History + culture heavy distribution for Fremont | Civic-history=20, landmarks-culture=18 (38% total) honors Fremont's unique consolidation story | Good — distinctive content |
| Overshoot-and-curate generation strategy | Generate 130%, curate to target — provides quality buffer for topic balancing | Good — 92 curated from 123 |
| Cultural sensitivity framework in prompts | Ohlone present-tense, Afghan-American heritage focus, Tesla civic-only, Mission San Jose disambiguation | Good — human spot-check approved |
| Quality guidelines in all locale system prompts | Embed Phase 21 quality rules in generation prompts to reduce validation retries | Good — benefits all future generation |
| Status-filtered question exports | Export only active questions, not drafts — applied to all collections | Good — data integrity improvement |
| Accept 92 questions (below 95 target) | Quality over quantity, all 8 topics represented with minimum 10 each | Good — within acceptable range |
| Fail-open rate limiting on Redis errors | Rate limiting is abuse prevention not security; allow users through if Redis down | Good — availability preserved |
| Denormalize flag_count on questions table | Avoid COUNT(*) aggregation queries on every question fetch | Good — efficient sorting/filtering |
| No rate limiter on batch elaboration | Infrequent post-game action, not an abuse vector | Good — simplicity |
| Equal Skip/Submit button weight | No dark pattern pushing Submit; respect user choice equally | Good — matches brand principles |
| Elaboration after results, not before | User-directed: flag on results screen, elaborate when leaving | Good — better UX flow |
| pendingAction pattern for navigation intercept | Capture Play Again/Home intent, show elaboration, then execute | Good — clean flow control |
| Custom undo toast over Sonner library | 50-line hook avoids 3KB dependency for single use case | Good — minimal bundle impact |
| Hard delete flags on dismiss | Simpler than soft delete; no audit trail needed for dismissed flags | Good — simplicity |
| AI URL suggestions limited to .gov/.edu/civic orgs | Authoritative sources only for civic content | Good — source quality |
| Null source URL for unrepairable links | Better than displaying broken "Learn More" link to users | Good — clean UX |
| text-embedding-3-small for semantic dedup | Balances cost ($0.02/1M tokens) with 1536-dimensional accuracy sufficient for question similarity | Good — effective detection |
| Disk-based embedding cache (.embedding-cache/) | Avoid redundant API calls across scan runs; embeddings stable for unchanged question text | Good — cost and speed |
| Union-find clustering for duplicates | Handles transitive groupings (A≈B, B≈C → one cluster) with O(α(n)) amortized complexity | Good — correct groupings |
| Federal > State > City hierarchy policy | Cross-collection duplicates resolved by keeping the question in the more general collection | Good — consistent curation |
| Human review required for duplicate archival | Educational content curation requires human judgment — auto-resolve at 0.90 threshold only | Good — content quality |
| Accept source exhaustion as collection ceiling | LA/Bloomington/Fremont sources dry after 5+ generation rounds — accepted shortfalls, not endless retries | Good — avoids quality degradation |
| Archive higher-numbered externalId on conflict | Preserves established question IDs with potential user history; discards newly-generated duplicates | Good — data integrity |
| Serial generation (not concurrent) | Reliability over speed for question generation — avoids race conditions in dedup checks | Good — correctness |
| Admin-entered race data for v1.7 (no scrapers) | No reliable free API for US local elections; scraping fragile; admin entry achieves same result | Good — practical for launch |
| `claude-sonnet-4-6` hardcoded in ElectionQuestionGenerator | MODEL constant in anthropic-client.ts was outdated at claude-sonnet-4-5; direct string avoids accidental regression | Good — correct model used |
| Collection slug explicit (not derived from jurisdiction) | String-matching jurisdictions to slugs is fragile; explicit slug parameter is precise and safe | Good — avoids silent mismatches |
| `GenerationBlockedError` as idempotent skip in cron | Running cron twice for same race is expected — treating it as failure would cause false alerts | Good — clean cron semantics |
| `lastCronRun` in-memory module state | Admin banner needs cron status without DB round-trip; module-level let is simple and low-latency | Good — minimal complexity |
| Advisory severity for address/phone rule | Legitimate civic questions can reference addresses; flag for human review, not auto-archive | Good — avoids false positives |
| `election_race_id` as direct FK on questions | Each election question belongs to exactly one race; junction table adds unnecessary complexity | Good — simpler model |
| `checkAddressPhone` scans options only | Question.text and explanation legitimately reference addresses; options contain the answer | Good — correct targeting |
| en-GB localeCode for Norwich | First non-US collection; establishes pattern for future international collections | Good — correct locale treatment |
| Two-tier governance in Norwich voice guidance | City vs County Council attribution encoded as critical accuracy requirement | Good — prevents misattribution |
| DDL applied directly via pg client for election schema | drizzle-kit push requires TTY for create-vs-rename prompt; pg client is safe and non-destructive | Good — unblocked without workaround harm |
| Follow-up questions have `expiresAt = NULL` | "Who won?" is permanent historic fact — time-limiting it would silently hide civic history | Good — correct semantics |
| Jurisdiction validation at runtime (no FK) | DB lookup against `collections.name` gives informative 400; FK would give opaque constraint error | Good — better error UX |
| collectionSlug override with optional chaining | `req.body` may be undefined when frontend sends no body; `?.collectionSlug` prevents TypeError | Good — defensive practice |
| Supabase JWT auth (jose jwtVerify) over custom middleware | Aligns with Empowered Accounts integration guide; SUPABASE_JWT_SECRET verified once per app start | Good — accounts alignment |
| `admin_users` table lookup for admin check | Typed in database.types.ts; `user_roles` join was untyped — table approach is simpler and type-safe | Good — correct and typed |
| `award_gems` RPC with `p_gem_type: 'yellow'` | Platform-level gem ledger; `civic_trivia` source enables per-app tracking on accounts platform | Good — correct RPC params |
| Connected tier check at award time (not session start) | `checkAccountContext` fires at session start; tier gate applied at game result — separation of concerns | Good — clean architecture |
| `tierResolved` flag in authStore | Prevents AdminGuard rendering before authoritative tier arrives from accounts API; all 4 AuthInitializer exits set it | Good — fixes race condition |
| `requireConnected` removed from Express | Frontend handles tier gates; no Express route gated on Connected tier in trivia app | Good — correct removal |
| `storageFactory.getRawClient()` for rate limiter | Rate limiter reuses the factory's Redis connection rather than importing a deleted legacyRedis export | Good — clean architecture |
| Token refresh uses Supabase native `/auth/v1/token` | No custom `/api/auth/refresh` route documented in integration guide; direct Supabase endpoint is correct | Good — platform alignment |
| `setAuth` sets `tierResolved: true` | Fixes admin access after expired-session re-login — login flow establishes complete auth state | Good — closes medium-severity gap |
| Migration history repair via `supabase migration repair` | 24 pre-existing remote entries cleared before pushing new trivia schema; safe and correct approach | Good — migration hygiene |
| DB-driven tier column (text NOT NULL DEFAULT 'city') | Replaces hardcoded COLLECTION_HIERARCHY; runtime query enables zero-hardcoded-map architecture | Good — infinite scalability |
| State config auto-discovery via dynamic import fallback | Drop `.ts` file in `locale-configs/state-configs/` → auto-registered; no code changes to generator | Good — zero-friction collection scaling |
| Mixed-durability generation pattern (Texas State) | texasStateFeatures instructs both expiring (expiresAt) and durable (null) questions in one run; no fixed ratio | Good — flexible for state collections |
| Harvard/MIT strict limitation in Cambridge voice guidance | Universities cannot be primary civic subject; only incidental civic relationships permitted | Good — prevents common LLM over-reliance on universities |
| Governor's Council dedicated topic (Massachusetts) | 8 questions for one of MA's most surprising civic facts; own topic slug separates from general-court | Good — distinctive content that "feels seen" |
| State-only curation rule for state collections | City/regional landmarks explicitly prohibited by name; statewide historical events kept | Good — consistent quality signal across state collections |
| ERCOT cluster reduction (Texas) | 12-question ERCOT cluster reduced to 3 best angles (uniqueness, %, transmission miles) | Good — eliminates near-duplicate saturation |
| `EMPOWERED_ACCOUNTS_API_URL` distinct from `EMPOWERED_ACCOUNTS_URL` | EMPOWERED_ACCOUNTS_URL used by checkAccountContext(); XP API URL kept separate for independent configuration | Good — avoids renaming risk |
| Idempotency key = `ctc-game-{sessionId}-{userId}` | sessionId is already server-generated UUID; no separate gameId field needed | Good — minimal footprint |
| `is_duplicate: true` treated as success | XP API contract: duplicate = already recorded, not an error; no retry | Good — correct semantics |
| Never-throw for external API calls (`awardPlatformXp`) | Mirrors awardPlatformGems pattern; game result must succeed even if XP API is down | Good — resilient UX |
| `console.warn` not `process.exit` for missing XP env vars | Local dev starts cleanly without these vars; warns in production logs | Good — DX friendly |
| `get_ctc_xp_history()` SECURITY DEFINER RPC for history | connect schema not exposed via PostgREST; SECURITY DEFINER function is correct cross-schema access pattern | Good — establishes pattern for future connect schema queries |
| 24h session TTL after XP award | 1h default caused xp: null on repeated /results; 24h only on post-award save | Good — targeted fix, submitAnswer path unaffected |
| Two-tab Profile layout tier-gated on `tierResolved && isConnected` | Prevents flash of tab chrome before account fetch resolves | Good — clean tier gating |
| `priorLevel` captured at game idle state for level-up detection | Comparison at results time requires pre-game snapshot; `levelUpShownRef` prevents double-trigger | Good — correct level-up detection |
| `runWithinCollectionSemanticDedup()` auto-runs in generation pipeline | Eliminates separate manual scan-duplicates.ts pass per collection — every new collection gets dedup automatically | Good — zero-friction dedup |
| Expiring ratio warning non-blocking (exit 0) in audit script | Enforcing as block would prevent activating legacy collections with 0% expiring; forward-looking nudge is correct | Good — avoids regressing older collections |
| COLLECTION-PLAYBOOK.md in .planning/ root | Cross-phase living document; retrospective appended after each collection phase; not per-phase artifact | Good — durable across milestones |
| Wikipedia API fetch fix: w/api.php extracts | en.wikipedia.org/wiki/ HTML scraping blocked by bot protection (0 bytes); API endpoint is reliable and universal | Good — universal fix for all future collections |
| DC uses city tier; district framing via voice guidance | No district tier in schema; voice guidance encodes DC's unique structure cleanly without schema change | Good — pragmatic and correct |
| Oregon State 7.4% expiring ratio is documented structural ceiling | 6 viable statewide offices in 81 questions ≈ 7.4%; forcing artificial expiry would create bad questions | Good — quality over ratio compliance |
| Large-council officeholder budget rule (Biloxi) | 7-ward council needs 2q/ward + 4q/mayor to reach 15% in 130–170 question pool; single-pass only reaches 8–9% | Good — applies to any multi-ward city collection |
| State Speaker Pro Tem must be named in locale config | Generation consistently misses Speaker Pro Tem unless explicitly listed; documented carry-forward rule | Good — prevents repeat gap in future state collections |

---
| Scaffold brace scanner starts from ` = {` assignment (not type annotation) | TypeScript type `Record<string, () => Promise<...>>` contains `{}` chars that threw off old scanner; fix is permanent and eliminates post-scaffold workaround | Good — Scaffold Bug 2 closed |
| `OfficeholderEntry` interface lives in `bloomington-in.ts` | Sole `LocaleConfig` source of truth — one canonical import path for all consumers | Good — zero extra types file |
| `buildOfficeholderBlock` wording is load-bearing ("name them SPECIFICALLY") | Name-match seeder in Plan 02 requires officeholder names to appear in question text; without explicit instruction AI puts names in answer options instead | Good — seeder correctly matches |
| `expiresAt IS NULL` guard in `seedOfficeholderExpiresAt` | Prevents overwriting manually corrected expiry dates on re-runs | Good — safe to run repeatedly |
| Archive-first in `expirationSweep` (db.update before generateReplacement call) | Archival must stand even if generation fails — ordering enforces this contract | Good — correct COPS semantics |
| `generateReplacement()` fully wrapped in outer try/catch (never-throw) | Matches `awardPlatformXp` never-throw pattern — cron must complete even if Claude API is down | Good — resilient cron |
| Leaderboard uses direct `supabaseAdmin.schema('connect')` (not SECURITY DEFINER RPC) | `connect.connected_profiles` is readable with service role key directly; no RPC needed (unlike `xp_transactions` GROUP BY workaround) | Good — simpler than XP history pattern |
| Gem awards: plain try/catch (no withRetry) | CONTEXT explicitly ruled out retry for gems — XP uses withRetry but gems contract did not require it | Good — intentional difference from XP |
| `TRIVIA_GEMS_KEY` is a separate scoped key (not `TRIVIA_SERVICE_KEY`) | Scope ["yellow"] configured on accounts side; separate key enables per-integration revocation | Good — correct scoping |
| Santa Monica 13.1% → 19.8% via Plan 03 gap closure | AI placed officeholder names as answer options (not question text) so name-match seeder couldn't auto-tag; dedicated insertion script closed the gap; 1-per-officeholder rule enforced | Good — playbook retrospective documents for future |
| Privacy-by-default on leaderboard | Other users' display names blanked server-side; only authenticated user's own name shown | Good — consistent with platform trust model |
| StickyYou as page-bottom section (not CSS sticky) | 25-row list has no scroll container; CSS sticky requires scrollable parent — page-bottom avoids layout complexity | Good — simpler and correct |

---
| `NextStepButton` delayed fade-in (delay: 0.55s) | Button fades in after answer reveal settles — avoids accidental tap before reveal completes | Good — correct timing |
| Label derived from props (isFinalQuestion + questionIndex vs totalQuestions - 2) | Contextual label logic in component, not hardcoded question numbers | Good — flexible for game length changes |
| Timer shrinks to 56px during reveal phase | Reclaims vertical space for NextStepButton; prevents mobile scroll on 375×667 | Good — precise fix |
| `GEM_SCORE_THRESHOLD = 1000` exported from `progressionService.ts` | Wager preview UI needs same value — exported constant avoids drift | Good — single source of truth for backend |
| `GEM_SCORE_THRESHOLD` duplicated as local const in `WagerScreen.tsx` and `ResultsScreen.tsx` | Frontend cannot import from backend services; replication intentional; all 3 agree on 1000 | Tech debt — future threshold change needs 3 edits |
| Perfect game check before score threshold in `calculateProgression` | Perfect game (8/8) at low score still earns 2 gems — check order prevents downgrade to 1 gem | Good — correct reward semantics |
| `CACHE_TTL = 60` (single constant, no env var override) | 60s is the right value; env var would be over-engineering per research; both cache key patterns use same constant | Good — minimal complexity |
| Push-based leaderboard cache invalidation (LEAD-F01) deferred | Requires cross-route coordination; 60s polling is sufficient for now | Deferred to v2.4+ |

---
| No auto-focus on CollectionPicker search input | Mobile keyboard would pop up unexpectedly on collection screen load; explicit tap to search is correct | Good — avoids jarring UX |
| 150ms debounce on search input (useDebounce) | Fast enough to feel responsive; avoids per-keystroke re-renders on 26+ collections | Good — minimal complexity |
| Inline styles only on new CollectionPicker elements | Consistent with existing component style approach (no Tailwind on this component) | Good — style consistency |
| Flat grid when filtering — no category headers | Cleaner scan when player is looking for a specific collection; grouped view preserved for default browse | Good — correct UX semantics |
| Search matches name field only — "ariz" matches "Arizona", not "Tucson, AZ" | Substring match on collection.name; state abbreviations in city names require typing "az", "tucson", or "phoenix" — correct by implementation | Good — documented; no code change needed |
| Skip gem award API call when gemsEarned === 0 | Avoids unnecessary HTTP POST to accounts platform; 0-gem games are common (score < 1000, not perfect) | Good — reduces external calls |
| DB state as authoritative verification for skill-created collections | /create-collection phases have no phase dirs; DB query (active count, tier, is_active, collection_questions rows) is the execution record | Good — establishes verification pattern for autonomous skill output |

---
*Last updated: 2026-03-23 after v2.4 milestone*

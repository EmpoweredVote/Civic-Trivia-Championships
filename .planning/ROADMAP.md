# Roadmap: Civic Trivia Championship

## Milestones

- â **v2.2 Pipeline Intelligence** â Phases 63â68 (shipped 2026-03-18) â [archive](milestones/v2.2-ROADMAP.md)
- â **v1.0 MVP** â Phases 1â7 (shipped 2026-02-13)
- â **v1.1 Production Hardening** â Phases 8â12 (shipped 2026-02-18)
- â **v1.2 Community Collections** â Phases 13â17 (shipped 2026-02-19)
- â **v1.3 Question Quality & Admin Tools** â Phases 18â22 (shipped 2026-02-20)
- â **v1.4 Fremont, CA Collection** â Phases 23â26 (shipped 2026-02-21)
- â **v1.5 Feedback Marks** â Phases 27â30 (shipped 2026-02-22)
- â **v1.6 Content Quality & Scale** â Phases 31â34 (shipped 2026-02-24)
- â **v1.7 Live Civic Intelligence** â Phases 35â39 (shipped 2026-02-27)
- â **v1.8 Empowered Identity** â Phases 40â46 (shipped 2026-03-01)
- â **v1.9 Geographic Expansion** â Phases 47â52 (shipped 2026-03-03)
- â **v2.0 XP Integration** â Phases 53â56 (shipped 2026-03-08)
- â **v2.1 Collection Excellence** â Phases 57â62 (shipped 2026-03-15) â [archive](milestones/v2.1-ROADMAP.md)
- â **v2.3 UX & Rewards Polish** â Phases 69â71 (shipped 2026-03-19)
- â **v2.4 Geographic Expansion + Collection UX** â Phases 72â74 (shipped 2026-03-23) â [archive](milestones/v2.4-ROADMAP.md)
- ð§ **v2.5 International Collections** â Phases 75â80 (in progress)

## Phases

<details>
<summary>â v2.4 Geographic Expansion + Collection UX (Phases 72â74) â SHIPPED 2026-03-23</summary>

### Phase 72: Arizona State Collection

**Goal:** Players can choose and play the Arizona state collection in production.

**Dependencies:** None â /create-collection skill operates end-to-end autonomously.

**Requirements:** COLL-01

**Success Criteria:**
1. Arizona collection card appears in the State tier of the collection picker.
2. A player can start and complete a full 8-question game from the Arizona collection.
3. The collection has at least 80 active questions meeting the established quality bar (no blocking violations, zero active duplicates confirmed by semantic dedup).
4. At least 15% of questions are expiring (officeholder questions with expiresAt set), or the structural ceiling is documented if that ratio cannot be reached.

---

### Phase 73: Tucson, AZ City Collection

**Goal:** Players can choose and play the Tucson, AZ city collection in production.

**Dependencies:** Phase 72 (Arizona state collection active â establishes AZ-specific quality guidance that informs Tucson locale config voice guidance and strict state-scale boundary).

**Requirements:** COLL-02

**Success Criteria:**
1. Tucson collection card appears in the City tier of the collection picker.
2. A player can start and complete a full 8-question game from the Tucson collection.
3. The collection has at least 80 active questions with zero overlap with Phase 72 Arizona state questions (city-only scope enforced).
4. At least 15% of questions are expiring (councilmember + mayor officeholder questions with expiresAt set).

---

### Phase 74: Collection Picker Search/Filter

**Goal:** Players can find any collection instantly by typing, without scrolling through the full grouped list.

**Dependencies:** None â pure frontend feature; no backend changes required.

**Requirements:** PICK-01, PICK-02, PICK-03, PICK-04, PICK-05

**Plans:** 1 plan

Plans:
- [x] 74-01-PLAN.md â Add search input and filter logic to CollectionPicker

**Success Criteria:**
1. A search input is visible at the top of the collection picker screen before any interaction.
2. Typing a partial name (e.g., "ariz") shows only matching collections in a flat list, collapsing all tier groupings while the input is non-empty.
3. Clearing the input (by deleting text or pressing the clear button) immediately restores the full grouped view with Federal / State / City sections intact.
4. The filter is case-insensitive â typing "ARIZONA" and "arizona" produce identical results.

</details>

<details>
<summary>â v2.2 Pipeline Intelligence (Phases 63â68) â SHIPPED 2026-03-18</summary>

- [x] Phase 63: Scaffold Fix (1/1 plan) â completed 2026-03-15
- [x] Phase 64: Structured Officeholders (2/2 plans) â completed 2026-03-15
- [x] Phase 65: Auto-Regenerate Expired Questions (2/2 plans) â completed 2026-03-15
- [x] Phase 66: Gem Award Migration (1/1 plan) â completed 2026-03-15
- [x] Phase 67: Leaderboard (3/3 plans) â completed 2026-03-17
- [x] Phase 68: Santa Monica, CA Collection (3/3 plans) â completed 2026-03-18

Full archive: [milestones/v2.2-ROADMAP.md](milestones/v2.2-ROADMAP.md)

</details>

<details>
<summary>â v1.0 MVP (Phases 1â7) â SHIPPED 2026-02-13</summary>

### Phase 1: Foundation Auth
**Goal**: Users can create accounts and access the game securely
**Plans**: 4 plans

### Phase 2: Game Core
**Goal**: Players can complete a full 10-question game session
**Plans**: 4 plans

### Phase 3: Scoring System
**Goal**: Server-side scoring with speed bonus runs correctly
**Plans**: 3 plans

### Phase 4: Learning Content
**Goal**: Players see explanations and Learn More for each question
**Plans**: 3 plans

### Phase 5: Progression & Profile
**Goal**: XP and gems accumulate; profile page shows history
**Plans**: 4 plans

### Phase 6: Wager Mechanics
**Goal**: Wager flow integrated into game at question 10
**Plans**: 3 plans

### Phase 7: Polish & Performance
**Goal**: WCAG AA, keyboard nav, FCP <1.5s, bundle <300KB
**Plans**: 5 plans

</details>

<details>
<summary>â v1.1 Production Hardening (Phases 8â12) â SHIPPED 2026-02-18</summary>

### Phase 8: Dev Tooling & Documentation
### Phase 9: Redis Session Migration
### Phase 10: Game UX Improvements
### Phase 11: Plausibility Enhancement
### Phase 12: Learning Content Expansion

</details>

<details>
<summary>â v1.2 Community Collections (Phases 13â17) â SHIPPED 2026-02-19</summary>

### Phase 13â17: Multi-collection system, question expiration, Bloomington IN and Los Angeles CA collections

</details>

<details>
<summary>â v1.3 Question Quality & Admin Tools (Phases 18â22) â SHIPPED 2026-02-20</summary>

### Phase 18â22: Quality rules engine, admin UI, Indiana and California state collections, AI generation pipeline

</details>

<details>
<summary>â v1.4 Fremont, CA Collection (Phases 23â26) â SHIPPED 2026-02-21</summary>

### Phase 23â26: Fremont collection (92 questions), enhanced generation pipeline, production verification

</details>

<details>
<summary>â v1.5 Feedback Marks (Phases 27â30) â SHIPPED 2026-02-22</summary>

### Phase 27â30: In-game flagging, post-game elaboration, admin flag review queue, AI URL repair

</details>

<details>
<summary>â v1.6 Content Quality & Scale (Phases 31â34) â SHIPPED 2026-02-24</summary>

### Phase 31â34: Semantic dedup infrastructure, 268 duplicates archived, self-validating generation pipeline, Indiana and California scaled to 90+

</details>

<details>
<summary>â v1.7 Live Civic Intelligence (Phases 35â39) â SHIPPED 2026-02-27</summary>

### Phase 35â39: Election pipeline (races table, question generation, daily cron, current-term follow-up, admin lifecycle UI), Norwich England collection, checkAddressPhone quality rule

</details>

<details>
<summary>â v1.8 Empowered Identity (Phases 40â46) â SHIPPED 2026-03-01</summary>

- [x] Phase 40: Database Migration (3/3 plans) â completed 2026-02-28
- [x] Phase 41: Auth & Tier Integration (2/2 plans) â completed 2026-02-28
- [x] Phase 42: Gem & Progression Integration (3/3 plans) â completed 2026-03-01
- [x] Phase 43: Frontend Auth & Profile (3/3 plans) â completed 2026-03-01
- [x] Phase 44: Deprecation & Cleanup (2/2 plans) â completed 2026-03-01
- [x] Phase 45: Auth State Hardening (2/2 plans) â completed 2026-03-01
- [x] Phase 46: Auth Cleanup (1/1 plan) â completed 2026-03-01

Full archive: [milestones/v1.8-ROADMAP.md](milestones/v1.8-ROADMAP.md)

</details>

<details>
<summary>â v1.9 Geographic Expansion (Phases 47â52) â SHIPPED 2026-03-03</summary>

- [x] Phase 47: Collection Infrastructure (3/3 plans) â completed 2026-03-02
- [x] Phase 48: Activate Banked Collections (1/1 plan) â completed 2026-03-03
- [x] Phase 49: Cambridge, MA Collection (3/3 plans) â completed 2026-03-02
- [x] Phase 50: Massachusetts State Collection (3/3 plans) â completed 2026-03-02
- [x] Phase 51: Plano, TX Collection (3/3 plans) â completed 2026-03-03
- [x] Phase 52: Texas State Collection (3/3 plans) â completed 2026-03-03

Full archive: [milestones/v1.9-ROADMAP.md](milestones/v1.9-ROADMAP.md)

</details>

<details>
<summary>â v2.0 XP Integration (Phases 53â56) â SHIPPED 2026-03-08</summary>

- [x] Phase 53: XP Backend Integration (1/1 plans) â completed 2026-03-05
- [x] Phase 54: XP Game UI (5/5 plans) â completed 2026-03-08
- [x] Phase 55: XP History Panel (3/3 plans) â completed 2026-03-08
- [x] Phase 56: Post-v2.0 XP Tech Debt (1/1 plans) â completed 2026-03-08

Full archive: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

<details>
<summary>â v2.1 Collection Excellence (Phases 57â62) â SHIPPED 2026-03-15</summary>

- [x] Phase 57: Pipeline & Playbook Foundation (2/2 plans) â completed 2026-03-09
- [x] Phase 58: Portland, OR Collection (3/3 plans) â completed 2026-03-09
- [x] Phase 59: Oregon State Collection (2/2 plans) â completed 2026-03-12
- [x] Phase 60: Washington, DC Collection (2/2 plans) â completed 2026-03-14
- [x] Phase 61: Biloxi, MS Collection (2/2 plans) â completed 2026-03-14
- [x] Phase 62: Mississippi State Collection (2/2 plans) â completed 2026-03-15

Full archive: [milestones/v2.1-ROADMAP.md](milestones/v2.1-ROADMAP.md)

</details>

<details>
<summary>â v2.3 UX & Rewards Polish (Phases 69â71) â SHIPPED 2026-03-19</summary>

- [x] Phase 69: Game Flow Buttons (1/1 plan) â completed 2026-03-19
- [x] Phase 70: Gem Scoring & Wager Preview (3/3 plans) â completed 2026-03-19
- [x] Phase 71: Leaderboard Cache Fix (1/1 plan) â completed 2026-03-19

Full archive: [milestones/v2.3-ROADMAP.md](milestones/v2.3-ROADMAP.md)

</details>

---

### ð§ v2.5 International Collections (In Progress)

**Milestone Goal:** Add a live International tier to the collection picker, backed by a daily AI news pipeline that ingests RSS feeds, extracts verifiable claims, generates questions via Claude, and auto-regulates pool size â launching with two topic collections (War in Iran, Climate Agreements) and admin visibility into pipeline health.

#### Phase 75: DB Foundation + Type System

**Goal:** The database schema and TypeScript type system are extended to support the International tier â all downstream phases can build without schema migrations.

**Dependencies:** None (first phase of milestone)

**Requirements:** INTL-02

**Success Criteria:**
1. `trivia.generation_jobs` table exists with columns for collection_slug, status, question counts (generated/flagged/activated), and timestamp; queries against it return results without error.
2. `trivia.questions` has three new nullable columns: `fact_snapshot text`, `confidence_tier text`, `generation_job_id integer FK`; existing questions are unaffected.
3. `CollectionTier` TypeScript type includes `'international'`; `scaffold-collection.ts --tier international` scaffolds a collection with `tier: 'international'` set in seed and SQL.
4. `expirationSweep.ts` replacement generator skips collections with `tier === 'international'` â no replacement questions are generated for expired International questions.
5. `InternationalLocaleConfig` interface is defined and exported; it is the required config shape for any international locale config file.

**Plans:** 2 plans

Plans:
- [ ] 75-01-PLAN.md -- SQL DDL (generation_jobs + user_collection_mutes tables, 3 new question columns) and schema.ts sync
- [ ] 75-02-PLAN.md -- CollectionTier type extension, scaffold --tier international, replacement generator guard, InternationalLocaleConfig interface

---

#### Phase 76: Collection Picker International Section

**Goal:** Players see an "International" section in the collection picker alongside Federal/State/City, with a freshness indicator on each International collection card.

**Dependencies:** Phase 75 (CollectionTier type extended to include 'international')

**Requirements:** INTL-01

**Success Criteria:**
1. The collection picker renders an "International" section that is visually grouped separately from Federal, State, and City sections.
2. Each International collection card shows a freshness indicator ("Updated X hours ago") derived from the most recent active question's created_at timestamp.
3. When no International collections are active, the International section does not appear (no empty section).
4. The existing search/filter (Phase 74) correctly matches International collections by name.

**Plans:** 1 plan

Plans:
- [x] 76-01-PLAN.md — Backend latestQuestionAt + frontend International section + freshness indicator

---

#### Phase 77: RSS Ingestion + Claim Extraction Pipeline

**Goal:** The system can ingest RSS feeds from curated Tier 2 sources, extract article text, deduplicate stories, and generate quality-gated MCQ questions via Claude â with per-feed error isolation so no single bad feed aborts the batch.

**Dependencies:** Phase 75 (DB schema and types ready)

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04

**Success Criteria:**
1. Running the ingestion pipeline against all four configured feeds (BBC World, NPR, The Guardian, DW) completes even when one feed returns malformed XML or a network error; the error is logged with the offending feed URL, and the remaining feeds are processed.
2. Articles with fewer than 300 words of extracted body text are skipped and logged; no Claude call is made for them.
3. The same news event covered by multiple feeds in the same run produces at most one question cluster â story-level dedup runs before any Claude generation call.
4. Questions where Claude detects partisan framing are saved as `draft` status (not `active`); questions passing the quality gate are saved as `active`; the distinction is observable by querying `trivia.questions.status`.
5. Generated questions include `fact_snapshot`, `confidence_tier`, and `generation_job_id` columns populated; `source_url` points to the originating article URL.

**Plans:** 2 plans

Plans:
- [x] 77-01-PLAN.md — RssIngestor service (npm install, schema DDL, RSS parsing, per-feed isolation, content extraction, 300-word gate)
- [x] 77-02-PLAN.md — ClaimExtractor + QuestionGenerator services (story dedup, Claude integration, quality gate, active-only routing, DB writes)

---

#### Phase 78: Pipeline Cron Worker + Pool Regulation

**Goal:** The pipeline runs automatically each night, regulates pool size per collection, and logs every run â so the International question pool self-maintains without manual intervention.

**Dependencies:** Phase 77 (ingestion and generation services complete)

**Requirements:** PIPE-05, PIPE-06

**Success Criteria:**
1. The cron job fires at 02:00 AM Eastern daily; each run is logged to `trivia.generation_jobs` with collection_slug, status, questions_generated, questions_flagged, questions_activated, and run timestamp.
2. When an International collection has more than 80 active questions, the pipeline archives the oldest questions until the count returns to the target ceiling before generating new ones.
3. A single pipeline run generates at most 8 new questions per collection; this cap is enforced even when many new articles are available.
4. Each generated question has a `volatility` classification (`fast`/`medium`/`slow`/`stable`) assigned at generation time; `expiresAt` is set based on that classification (fast: 3â5 days, medium: 7â14 days, slow/stable: longer).
5. When a collection's pending review count exceeds 20, the pipeline skips generation for that collection in the current run (auto-throttle).

**Plans:** 2 plans

Plans:
- [ ] 78-01-PLAN.md — Schema DDL (volatility + reason columns), computeExpiresAt(), InternationalLocaleConfig, status fix in run-pipeline.ts
- [ ] 78-02-PLAN.md — poolRegulator.ts + pipelineCron.ts + startCron.ts wiring + server.ts startup

---

#### Phase 79: Launch Collections

**Goal:** Two International collections are live and playable â War in Iran and Climate Agreements â each with at least 15 active questions seeded at launch.

**Dependencies:** Phase 78 (pipeline cron and pool regulation complete; questions can be generated and activated)

**Requirements:** INTL-03, INTL-04

**Success Criteria:**
1. The "War in Iran" collection card appears in the International section of the collection picker; a player can start and complete a full 8-question game from it.
2. The "War in Iran" collection has at least 15 active questions at launch; questions have `fast` volatility with `expiresAt` in the 3â5 day range.
3. The "Climate Agreements" collection card appears in the International section; a player can start and complete a full 8-question game from it.
4. The "Climate Agreements" collection has at least 15 active questions at launch; questions have `medium` volatility with `expiresAt` in the 7â14 day range.
5. Both collections' freshness indicators in the collection picker reflect actual question timestamps (not placeholder values).

**Plans:** 2 plans

Plans:
- [x] 79-01-PLAN.md — War in Iran collection (scaffold + game.ts threshold fix + pipeline seed + activate)
- [x] 79-02-PLAN.md — Climate Agreements collection (scaffold + medium-volatility seed script + pipeline seed + activate)

---

#### Phase 80: Admin Visibility

> **BLOCKED / NEEDS REPLANNING (noted 2026-09-09).** This phase is backend work — admin
> routes and views over `generation_jobs`. Per **ev-cto decision 0013** (2026-09-05) this
> repo's `backend/` is **frozen** and serves nothing; production is the `ev-accounts` engine.
> As written, Phase 80 **cannot be executed here.** It needs replanning against
> `ev-accounts/backend/src/trivia/`, splitting into a frontend half here plus a backend half
> there, or dropping. Do not start it as-is.
>
> Also note: the "full 8-question game" success criteria in Phases 37, 53 and 79 were correct
> when met. The game is **5 questions** as of 2026-06-17 — see PROJECT.md Current State.

**Goal:** Admin can monitor International pipeline health â job history, pool depth, and pending review queue â directly from the admin dashboard.

**Dependencies:** Phase 78 (generation_jobs table populated; pipeline running)

**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03

**Success Criteria:**
1. Admin can navigate to a pipeline job history view showing each run's date, collection, questions generated, questions flagged, and questions activated.
2. The admin dashboard shows active question count per International collection; collections with fewer than 20 active questions display a visible warning indicator.
3. The admin dashboard shows the current pending review count for International draft questions; the count updates without a page reload when new draft questions arrive.
4. When the pending review count for a collection exceeds 20, a visible indicator communicates that the pipeline is throttled for that collection.

**Plans:** 2 plans

Plans:
- [ ] 80-01: Admin pipeline job history view
- [ ] 80-02: Admin pool health monitor + pending review count + throttle indicator

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1â7. MVP Phases | v1.0 | 26/26 | Complete | 2026-02-13 |
| 8â12. Hardening Phases | v1.1 | 11/11 | Complete | 2026-02-18 |
| 13â17. Collections Phases | v1.2 | 15/15 | Complete | 2026-02-19 |
| 18â22. Quality Phases | v1.3 | 17/17 | Complete | 2026-02-20 |
| 23â26. Fremont Phases | v1.4 | 6/6 | Complete | 2026-02-21 |
| 27â30. Feedback Phases | v1.5 | 11/11 | Complete | 2026-02-22 |
| 31â34. Scale Phases | v1.6 | 13/13 | Complete | 2026-02-24 |
| 35â39. Election Phases | v1.7 | 10/10 | Complete | 2026-02-27 |
| 40â46. Empowered Identity Phases | v1.8 | 16/16 | Complete | 2026-03-01 |
| 47. Collection Infrastructure | v1.9 | 3/3 | Complete | 2026-03-02 |
| 48. Activate Banked Collections | v1.9 | 1/1 | Complete | 2026-03-03 |
| 49. Cambridge, MA Collection | v1.9 | 3/3 | Complete | 2026-03-02 |
| 50. Massachusetts State Collection | v1.9 | 3/3 | Complete | 2026-03-02 |
| 51. Plano, TX Collection | v1.9 | 3/3 | Complete | 2026-03-03 |
| 52. Texas State Collection | v1.9 | 3/3 | Complete | 2026-03-03 |
| 53. XP Backend Integration | v2.0 | 1/1 | Complete | 2026-03-05 |
| 54. XP Game UI | v2.0 | 5/5 | Complete | 2026-03-08 |
| 55. XP History Panel | v2.0 | 3/3 | Complete | 2026-03-08 |
| 56. Post-v2.0 XP Tech Debt | v2.0 | 1/1 | Complete | 2026-03-08 |
| 57â62. Collection Excellence Phases | v2.1 | 13/13 | Complete | 2026-03-15 |
| 63. Scaffold Fix | v2.2 | 1/1 | Complete | 2026-03-15 |
| 64. Structured Officeholders | v2.2 | 2/2 | Complete | 2026-03-15 |
| 65. Auto-Regenerate Expired Questions | v2.2 | 2/2 | Complete | 2026-03-15 |
| 66. Gem Award Migration | v2.2 | 1/1 | Complete | 2026-03-15 |
| 67. Leaderboard | v2.2 | 3/3 | Complete | 2026-03-17 |
| 68. Santa Monica, CA Collection | v2.2 | 3/3 | Complete | 2026-03-18 |
| 69â71. UX & Rewards Polish Phases | v2.3 | 5/5 | Complete | 2026-03-19 |
| 72. Arizona State Collection | v2.4 | 1/1 | Complete | 2026-03-23 |
| 73. Tucson, AZ City Collection | v2.4 | 1/1 | Complete | 2026-03-23 |
| 74. Collection Picker Search/Filter | v2.4 | 1/1 | Complete | 2026-03-23 |
| 75. DB Foundation + Type System | v2.5 | 2/2 | Complete | 2026-04-09 |
| 76. Collection Picker International Section | v2.5 | 1/1 | Complete | 2026-04-09 |
| 77. RSS Ingestion + Claim Extraction Pipeline | v2.5 | 2/2 | Complete | 2026-04-09 |
| 78. Pipeline Cron Worker + Pool Regulation | v2.5 | 2/2 | Complete | 2026-04-09 |
| 79. Launch Collections | v2.5 | 2/2 | Complete | 2026-04-09 |
| 80. Admin Visibility | v2.5 | 0/TBD | Not started | â |

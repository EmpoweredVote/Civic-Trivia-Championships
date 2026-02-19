# Roadmap: Civic Trivia Championship

## Overview

This roadmap delivers a polished, educational trivia game across three milestones. v1.0 (Phases 1-7) built the solo MVP with authentication, game flow, scoring, learning content, progression, wager mechanics, and accessibility. v1.1 (Phases 8-12) hardened for production readiness by addressing tech debt: dev tooling fixes, Redis session migration, game UX improvements, plausibility enhancement, and strategic learning content expansion. v1.2 (Phases 13-17) adds community-specific trivia collections, migrating questions from JSON to PostgreSQL, introducing a collection picker, expiration system, and locale-specific content for Bloomington IN and Los Angeles CA.

## Current Milestone: v1.2 Community Collections

**Phases 13-17** transform the single federal question bank into a multi-collection system where players choose community-specific trivia. The critical path is the JSON-to-PostgreSQL migration (Phase 13), which unblocks every downstream feature.

- [x] **Phase 13: Database Schema & Seed Migration** - Questions and collections into PostgreSQL with federal seed data
- [x] **Phase 14: Question Service & Route Integration** - Swap data layer from JSON to database queries
- [x] **Phase 15: Collection Picker UI** - Card-based collection selection before game start
- [x] **Phase 16: Expiration System** - Hourly cron sweep with soft-delete and health monitoring
- [ ] **Phase 17: Community Content Generation** - Bloomington IN and Los Angeles CA question banks

## Phase Details (v1.2)

**Phase Numbering:**
- Integer phases (13, 14, 15): Planned milestone work
- Decimal phases (13.1, 13.2): Urgent insertions (marked with INSERTED)

Phases execute in numeric order: 13 -> 14 -> 15 -> 16 -> 17

### Phase 13: Database Schema & Seed Migration
**Goal**: Questions and collections live in PostgreSQL, with the existing 120-question federal bank migrated and tagged
**Depends on**: Nothing (v1.2 starting point)
**Requirements**: COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, CCONT-01
**Success Criteria** (what must be TRUE):
  1. PostgreSQL contains `questions`, `collections`, and `collection_questions` tables with correct schema
  2. All 120 existing federal questions are in the database with their full content (options, explanations, learning content)
  3. A "Federal Civics" collection exists with name, slug, description, and locale metadata
  4. Each collection can define its own topic categories (not a hardcoded global enum)
  5. Questions have an optional `expires_at` field available for future use
**Plans**: 3 plans in 2 waves
Plans:
- [x] 13-01-PLAN.md — Drizzle ORM setup, schema definitions, SQL migration, rollback script
- [x] 13-02-PLAN.md — Research authoritative sources for 87 unsourced questions
- [x] 13-03-PLAN.md — Seed collections, topics, and migrate 120 questions into PostgreSQL

### Phase 14: Question Service & Route Integration
**Goal**: The game queries PostgreSQL instead of JSON, with collection-scoped question loading and zero regression
**Depends on**: Phase 13
**Requirements**: CGFLOW-03, CGFLOW-04, CGFLOW-05
**Success Criteria** (what must be TRUE):
  1. Game session creation accepts an optional `collectionId` parameter and returns 10 questions from that collection
  2. Omitting `collectionId` defaults to the Federal Civics collection (backward compatible)
  3. Existing game flow (timer, scoring, wager, results, progression, plausibility) works identically with database-sourced questions
  4. The `readFileSync` JSON loading pattern is replaced by QuestionService database queries
**Plans**: 2 plans in 2 waves
Plans:
- [x] 14-01-PLAN.md — QuestionService module with difficulty-balanced selection, recent exclusion, and JSON fallback
- [x] 14-02-PLAN.md — Wire QuestionService into game routes, update frontend for collection metadata

### Phase 15: Collection Picker UI
**Goal**: Players can browse and select a collection before starting a game
**Depends on**: Phase 14
**Requirements**: CGFLOW-01, CGFLOW-02
**Success Criteria** (what must be TRUE):
  1. Player sees a card-based collection picker on the dashboard before starting a game
  2. Each collection card displays name, description, and active question count
  3. Federal Civics is preselected as the default collection
  4. Selecting a collection and starting a game loads questions from that collection
**Plans**: 3 plans in 2 waves
Plans:
- [x] 15-01-PLAN.md — Backend GET /api/game/collections endpoint with question counts
- [x] 15-02-PLAN.md — Collection picker components (types, hook, card, skeleton, picker)
- [x] 15-03-PLAN.md — Dashboard integration, game flow wiring, collection name display

### Phase 16: Expiration System
**Goal**: Time-sensitive questions automatically drop from rotation without disrupting active games
**Depends on**: Phase 14
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, ADM-01
**Success Criteria** (what must be TRUE):
  1. Questions past their `expires_at` date no longer appear in new game sessions
  2. An hourly cron job runs the expiration sweep automatically
  3. Expired questions are logged with structured output and flagged for content review
  4. A player mid-game is not affected if a question expires during their session
  5. A health endpoint reports per-collection question counts, expiring-soon counts, and expired counts
**Plans**: 3 plans in 3 waves
Plans:
- [x] 16-01-PLAN.md — Schema migration (status + audit history fields), node-cron install, hourly expiration sweep
- [x] 16-02-PLAN.md — Collection health endpoint and admin API routes (renew, archive)
- [x] 16-03-PLAN.md — Admin review page with filter tabs, question list, and action buttons

### Phase 17: Community Content Generation
**Goal**: Players can choose Bloomington IN or Los Angeles CA collections with locally relevant civic trivia
**Depends on**: Phase 13 (database ready), Phase 15 (picker available)
**Requirements**: CCONT-02, CCONT-03, CCONT-04, CCONT-05
**Success Criteria** (what must be TRUE):
  1. Bloomington IN collection contains 50-120 questions covering local government and Indiana state civics
  2. Los Angeles CA collection contains 50-120 questions covering local government and California state civics
  3. Content generation tooling supports locale-specific prompts with source-first RAG approach
  4. All locale questions are cross-referenced with authoritative local government sources (no unverifiable claims)
  5. Both collections appear in the collection picker and are playable end-to-end
**Plans**: TBD

## Progress (v1.2)

**Execution Order:**
Phases execute in numeric order: 13 -> 14 -> 15 -> 16 -> 17
Note: Phases 15 and 16 are independent after Phase 14 and could parallelize.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 13. Database Schema & Seed Migration | 3/3 | Complete | 2026-02-18 |
| 14. Question Service & Route Integration | 2/2 | Complete | 2026-02-18 |
| 15. Collection Picker UI | 3/3 | Complete | 2026-02-18 |
| 16. Expiration System | 3/3 | Complete | 2026-02-19 |
| 17. Community Content Generation | 0/TBD | Not started | - |

## Requirement Coverage (v1.2)

All v1.2 requirements mapped: 20/20 (100%)

**By Phase:**
- Phase 13: 6 requirements (COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, CCONT-01)
- Phase 14: 3 requirements (CGFLOW-03, CGFLOW-04, CGFLOW-05)
- Phase 15: 2 requirements (CGFLOW-01, CGFLOW-02)
- Phase 16: 5 requirements (EXP-01, EXP-02, EXP-03, EXP-04, ADM-01)
- Phase 17: 4 requirements (CCONT-02, CCONT-03, CCONT-04, CCONT-05)

---

<details>
<summary>v1.1 History (Phases 8-12) - COMPLETE 2026-02-18</summary>

### Phase 8: Dev Tooling & Documentation
**Goal**: Content generation tooling works and documentation is complete
**Depends on**: Nothing (v1.1 starting point)
**Requirements**: LCONT-01, DOCS-01
**Success Criteria** (what must be TRUE):
  1. generateLearningContent.ts script runs without TypeScript errors
  2. Content generation script can produce new learning content when invoked
  3. Phase 3 VERIFICATION.md exists with test results and acceptance criteria
  4. All v1.0 phases have complete documentation (PLANs, SUMMARYs, VERIFICATIONs)
**Plans**: 2 plans in 1 wave
Plans:
- [x] 08-01-PLAN.md — Fix generateLearningContent.ts (install SDK, fix env var, preview-before-commit)
- [x] 08-02-PLAN.md — Create Phase 3 VERIFICATION.md and audit v1.0 documentation

### Phase 9: Redis Session Migration
**Goal**: Game sessions persist across server restarts and support multi-instance deployment
**Depends on**: Phase 8
**Requirements**: REDIS-01, REDIS-02, REDIS-03
**Success Criteria** (what must be TRUE):
  1. Active game sessions survive server restart without data loss
  2. Sessions stored in Redis with automatic TTL expiry (1-hour)
  3. App gracefully degrades to in-memory storage if Redis unavailable
  4. Session storage performance remains sub-5ms (Redis local latency)
  5. Multiple backend instances can share session state (multi-instance ready)
**Plans**: 3 plans in 3 waves
Plans:
- [x] 09-01-PLAN.md — Storage abstraction layer (interface, MemoryStorage, RedisStorage, Redis config, Docker Compose)
- [x] 09-02-PLAN.md — Async SessionManager migration, game route updates, health endpoint
- [x] 09-03-PLAN.md — Frontend degraded mode banner and end-to-end verification

### Phase 10: Game UX Improvements
**Goal**: Game interface feels more polished with better visual hierarchy and streamlined interactions
**Depends on**: Phase 9
**Requirements**: GUX-01, GUX-02, GUX-03
**Success Criteria** (what must be TRUE):
  1. Question and answers positioned high on screen (top half), not vertically centered
  2. Timer positioned above question for immediate visibility
  3. User can select answer with single click (no lock-in confirmation step)
  4. Visual hierarchy guides eye flow: timer -> question -> options
  5. Answer selection feels more responsive and game-show-like
**Plans**: 2 plans in 2 waves
Plans:
- [x] 10-01-PLAN.md — State machine single-click refactor and timing constants update
- [x] 10-02-PLAN.md — Layout repositioning, visual hierarchy, and answer interaction polish

### Phase 11: Plausibility Enhancement
**Goal**: Plausibility detection is more accurate and actively penalizes suspicious behavior
**Depends on**: Phase 10
**Requirements**: PLAUS-01, PLAUS-02, PLAUS-03
**Success Criteria** (what must be TRUE):
  1. Timing thresholds adjust based on question difficulty (easy allows <1s, medium <0.75s, hard <0.5s)
  2. Flagged answers receive zero speed bonus (not just passive logging)
  3. Users with timer multiplier settings get adjusted thresholds (no false positives)
  4. Legitimate fast correct answers are not penalized
  5. Pattern-based detection requires 3+ suspicious answers before penalties apply
**Plans**: 2 plans in 2 waves
Plans:
- [x] 11-01-PLAN.md — Core detection and penalty logic (thresholds, pattern counting, penalty-aware scoring)
- [x] 11-02-PLAN.md — Response stripping and frontend type cleanup (silent system)

### Phase 12: Learning Content Expansion
**Goal**: Learning content coverage increases from 15% to 25-30% with strategic deep-dives
**Depends on**: Phase 11
**Requirements**: LCONT-02
**Success Criteria** (what must be TRUE):
  1. Learning content coverage reaches 25-30% of question bank (~30-36 out of 120 questions)
  2. Content prioritizes frequently missed questions and high-interest topics
  3. All generated content cross-referenced with authoritative sources
  4. Deep-dive content maintains quality standards (2-3 paragraphs, no hallucinated facts)
  5. Content generation follows batch review process (10-20 at a time)
**Plans**: 2 plans in 2 waves
Plans:
- [x] 12-01-PLAN.md — Script tooling update (CLI flags, prompt update, applyContent.ts, frontend inline links)
- [x] 12-02-PLAN.md — Content generation batch, human review, and application to questions.json

</details>

<details>
<summary>v1.0 History (Phases 1-7) - COMPLETE 2026-02-13</summary>

### Phase 1: Foundation & Auth
**Goal**: Users can create accounts, log in, and maintain authenticated sessions across browser refreshes
**Status**: Complete (2026-02-04)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, PERF-01, PERF-02, PERF-03, PERF-05
**Plans**: 4 plans in 3 waves
- [x] 01-01-PLAN.md — Project foundation (Vite React + Express TypeScript setup)
- [x] 01-02-PLAN.md — Backend auth infrastructure (PostgreSQL, Redis, JWT endpoints)
- [x] 01-03-PLAN.md — Frontend auth (Zustand store, API service, Login/Signup pages)
- [x] 01-04-PLAN.md — Integration (Protected routes, session persistence, verification)

### Phase 2: Game Core
**Goal**: Users can play a full 10-question trivia game with visual timer, answer selection, and explanations
**Status**: Complete (2026-02-10)
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09, GAME-14, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05
**Plans**: 4 plans in 4 waves
- [x] 02-01-PLAN.md — Game types, question bank (100+ questions), API endpoint, dependencies
- [x] 02-02-PLAN.md — Game state machine (reducer, useGameState hook, keyboard shortcuts)
- [x] 02-03-PLAN.md — Game screen UI (timer, answer grid, animations, Millionaire aesthetic)
- [x] 02-04-PLAN.md — Results screen, routing, end-to-end integration, verification

### Phase 3: Scoring System
**Goal**: Scores are calculated server-side with base points and speed bonuses, displayed throughout game
**Status**: Complete (2026-02-10)
**Requirements**: SCORE-01, SCORE-02, SCORE-04, SCORE-05
**Plans**: 3 plans in 3 waves
- [x] 03-01-PLAN.md — Backend session service, score calculation, and API endpoints
- [x] 03-02-PLAN.md — Frontend types, reducer, hook, and API service wiring for server scoring
- [x] 03-03-PLAN.md — Score display UI, animations, popups, and enhanced results screen

### Phase 4: Learning & Content
**Goal**: Users can access deeper educational content without leaving the game flow
**Status**: Complete (2026-02-12)
**Requirements**: LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05, CONT-06
**Plans**: 3 plans in 3 waves
- [x] 04-01-PLAN.md — Data model, types, topic icons, learning content for 15+ questions
- [x] 04-02-PLAN.md — LearnMore UI components (button, tooltip, modal) and GameScreen integration
- [x] 04-03-PLAN.md — Results screen topics, Learn More from results, end-to-end verification

### Phase 5: Progression & Profile
**Goal**: Users earn XP and gems per game, see progression on profile with stats
**Status**: Complete (2026-02-12)
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05
**Plans**: 4 plans in 3 waves
- [x] 05-01-PLAN.md — DB schema, progression service, game route wiring with optional auth
- [x] 05-02-PLAN.md — Results screen XP/gems display with count-up animations
- [x] 05-03-PLAN.md — Profile API endpoints and avatar upload with security validation
- [x] 05-04-PLAN.md — Profile page UI, Avatar component, hamburger menu navigation

### Phase 6: Wager Mechanics
**Goal**: Users can bet up to half their current score on the final question
**Status**: Complete (2026-02-13)
**Requirements**: GAME-10, GAME-11, GAME-12, GAME-13, SCORE-03
**Plans**: 3 plans in 2 waves
- [x] 06-01-PLAN.md — Backend wager validation/scoring, types, state machine, hook, API service
- [x] 06-02-PLAN.md — FinalQuestionAnnouncement, WagerScreen components, GameScreen integration
- [x] 06-03-PLAN.md — Results screen wager breakdown section and Q10 answer review

### Phase 7: Polish & Performance
**Goal**: App meets WCAG AA accessibility standards, runs smoothly at 60fps, and has game-show aesthetic
**Status**: Complete (2026-02-13)
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, PERF-04
**Plans**: 5 plans in 3 waves
- [x] 07-01-PLAN.md — A11Y foundation: deps, ARIA live regions, skip-to-content, focus rings, focus-trap modals
- [x] 07-02-PLAN.md — Timer extension setting: DB column, API endpoint, profile UI, game integration
- [x] 07-03-PLAN.md — Keyboard navigation: arrow/number keys, Escape pause overlay, screen reader announcements
- [x] 07-04-PLAN.md — Color & contrast: icon indicators, timer enhancements, WCAG AA audit, touch targets
- [x] 07-05-PLAN.md — Celebrations & performance: confetti, streak tracking, perfect game effects, Web Vitals

**v1.0 Coverage:** 50/50 requirements (100%)

</details>

---
*Created: 2026-02-03 (v1.0)*
*Updated: 2026-02-18 (Phase 16 planned)*
*Current Milestone: v1.2 Community Collections*
*Phases: 17 (16 complete, 0 in progress, 1 planned)*

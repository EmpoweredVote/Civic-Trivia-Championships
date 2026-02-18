# Roadmap: Civic Trivia Championship

## Overview

This roadmap delivers a polished, educational trivia game across two milestones. v1.0 (Phases 1-7) built the solo MVP with authentication, game flow, scoring, learning content, progression, wager mechanics, and accessibility. v1.1 (Phases 8-12) hardens for production readiness by addressing tech debt: dev tooling fixes, Redis session migration, game UX improvements, plausibility enhancement, and strategic learning content expansion.

## Current Milestone: v1.1 Tech Debt Hardening

**Phases 8-12** address critical gaps from v1.0 audit: Redis session storage (prevent data loss on restart), enhanced plausibility detection, learning content expansion (15% to 25-30%), game UX refinements, and dev tooling fixes.

- [x] **Phase 8: Dev Tooling & Documentation** - Fix content generation script, complete missing docs
- [x] **Phase 9: Redis Session Migration** - Persistent session storage with graceful degradation
- [ ] **Phase 10: Game UX Improvements** - Visual positioning and interaction refinements
- [ ] **Phase 11: Plausibility Enhancement** - Difficulty-adjusted anti-cheat with point penalties
- [ ] **Phase 12: Learning Content Expansion** - Strategic deep-dive content for 25-30% coverage

## Phase Details (v1.1)

**Phase Numbering:**
- Integer phases (8, 9, 10): Planned milestone work
- Decimal phases (8.1, 8.2): Urgent insertions (marked with INSERTED)

Phases execute in numeric order: 8 -> 9 -> 10 -> 11 -> 12

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
  1. Question card positioned at 1/3 from top of screen (not vertically centered)
  2. Answer options positioned at 2/3 from top of screen (below question)
  3. User can select answer with single click (no lock-in confirmation step)
  4. Visual hierarchy guides eye flow: question -> options -> timer
  5. Answer selection feels more responsive and game-show-like
**Plans**: 2 plans in 2 waves
Plans:
- [ ] 10-01-PLAN.md — State machine single-click refactor and timing constants update
- [ ] 10-02-PLAN.md — Layout repositioning, visual hierarchy, and answer interaction polish

### Phase 11: Plausibility Enhancement
**Goal**: Plausibility detection is more accurate and actively penalizes suspicious behavior
**Depends on**: Phase 10
**Requirements**: PLAUS-01, PLAUS-02, PLAUS-03
**Success Criteria** (what must be TRUE):
  1. Timing thresholds adjust based on question difficulty (easy allows <1s, medium <0.75s, hard <0.5s)
  2. Flagged answers receive 30% point reduction (not just passive logging)
  3. Users with timer multiplier settings get adjusted thresholds (no false positives)
  4. Legitimate fast correct answers are not penalized
  5. Pattern-based detection requires 3+ suspicious answers before penalties apply
**Plans**: TBD

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
**Plans**: TBD

## Progress (v1.1)

**Execution Order:**
Phases execute in numeric order: 8 -> 9 -> 10 -> 11 -> 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 8. Dev Tooling & Documentation | 2/2 | Complete | 2026-02-13 |
| 9. Redis Session Migration | 3/3 | Complete | 2026-02-17 |
| 10. Game UX Improvements | 0/2 | In Progress | — |
| 11. Plausibility Enhancement | 0/0 | Not Started | — |
| 12. Learning Content Expansion | 0/0 | Not Started | — |

## Requirement Coverage (v1.1)

All v1.1 requirements mapped: 12/12 (100%)

**By Phase:**
- Phase 8: 2 requirements (LCONT-01, DOCS-01)
- Phase 9: 3 requirements (REDIS-01, REDIS-02, REDIS-03)
- Phase 10: 3 requirements (GUX-01, GUX-02, GUX-03)
- Phase 11: 3 requirements (PLAUS-01, PLAUS-02, PLAUS-03)
- Phase 12: 1 requirement (LCONT-02)

---

## v1.0 History (Phases 1-7)

Reference for completed phases from initial MVP release.

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

---
*Created: 2026-02-03 (v1.0)*
*Updated: 2026-02-17 (Phase 10 planned)*
*Current Milestone: v1.1 Tech Debt Hardening*
*Phases: 12 (9 complete, 3 planned)*

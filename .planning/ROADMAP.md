# Roadmap: Civic Trivia Championship

## Overview

This roadmap delivers a polished, educational trivia game in 7 phases. We build foundation first (project setup + auth), then implement the core game loop with scoring and learning features, add progression mechanics, enable wager betting on final questions, and finish with polish (accessibility, performance, animations). Each phase delivers a complete, verifiable capability that builds toward the solo MVP experience where players learn civic concepts through game-show-style trivia.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Auth** - Project setup and authentication system
- [ ] **Phase 2: Game Core** - Basic game flow with questions, timer, and answer reveal
- [ ] **Phase 3: Scoring System** - Server-side score calculation and validation
- [ ] **Phase 4: Learning & Content** - Educational explanations, modals, and content management
- [ ] **Phase 5: Progression & Profile** - XP, gems, badges, and user profile
- [ ] **Phase 6: Wager Mechanics** - Final question betting system
- [ ] **Phase 7: Polish & Performance** - Accessibility, animations, optimization

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Users can create accounts, log in, and maintain authenticated sessions across browser refreshes
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, PERF-01, PERF-02, PERF-03, PERF-05
**Success Criteria** (what must be TRUE):
  1. User can sign up with email and password
  2. User can log in with email and password
  3. User can log out from any screen
  4. User session persists across browser refresh
  5. User receives clear error messages for auth failures
  6. Frontend loads in under 1.5 seconds (FCP)
  7. App is interactive in under 3 seconds (TTI)
  8. App works on mobile and tablet screens
**Plans**: 4 plans in 3 waves

Plans:
- [ ] 01-01-PLAN.md — Project foundation (Vite React + Express TypeScript setup)
- [ ] 01-02-PLAN.md — Backend auth infrastructure (PostgreSQL, Redis, JWT endpoints)
- [ ] 01-03-PLAN.md — Frontend auth (Zustand store, API service, Login/Signup pages)
- [ ] 01-04-PLAN.md — Integration (Protected routes, session persistence, verification)

### Phase 2: Game Core
**Goal**: Users can play a full 10-question trivia game with visual timer, answer selection, and explanations
**Depends on**: Phase 1
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09, GAME-14, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05
**Success Criteria** (what must be TRUE):
  1. User can start a solo quick play session
  2. Game presents 10 randomized multiple-choice questions with 4 options each
  3. Visual countdown timer shows time remaining with color transitions (teal to yellow to orange to red)
  4. User can select one answer per question with lock-in confirmation
  5. Answer reveal shows correct/incorrect using "Not quite" language (never "Wrong")
  6. Answer reveal includes 1-3 sentence explanation
  7. Questions progress automatically after reveal
  8. Results screen shows final score and accuracy breakdown
**Plans**: TBD

Plans:
- [ ] 02-01: TBD during phase planning
- [ ] 02-02: TBD during phase planning
- [ ] 02-03: TBD during phase planning

### Phase 3: Scoring System
**Goal**: Scores are calculated server-side with base points and speed bonuses, displayed throughout game
**Depends on**: Phase 2
**Requirements**: SCORE-01, SCORE-02, SCORE-04, SCORE-05
**Success Criteria** (what must be TRUE):
  1. Correct answers award base points (+100)
  2. Speed bonus calculated from time remaining (up to +50)
  3. Running score displayed throughout game
  4. Score calculated server-side to prevent manipulation
  5. Results screen shows accurate final score breakdown
**Plans**: TBD

Plans:
- [ ] 03-01: TBD during phase planning
- [ ] 03-02: TBD during phase planning

### Phase 4: Learning & Content
**Goal**: Users can access deeper educational content without leaving the game flow
**Depends on**: Phase 3
**Requirements**: LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05, CONT-06
**Success Criteria** (what must be TRUE):
  1. Answer reveal includes "Learn more" link for deeper content
  2. "Learn more" opens modal without leaving game
  3. Modal shows expanded explanation (2-3 paragraphs)
  4. User can close modal and continue game
  5. Results screen lists topics covered during game
  6. At least 10 topics have "Learn more" content available
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during phase planning
- [ ] 04-02: TBD during phase planning

### Phase 5: Progression & Profile
**Goal**: Users earn XP and gems per game, see progression on profile with stats
**Depends on**: Phase 4
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05
**Success Criteria** (what must be TRUE):
  1. XP earned per game completion (50 base + 1 per correct)
  2. Gems earned per game completion (10 base + 1 per correct)
  3. Results screen shows rewards earned
  4. User can view their profile with total XP and gems
  5. Profile shows games played, best score, and overall accuracy percentage
  6. Progression updates persist to user profile
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during phase planning
- [ ] 05-02: TBD during phase planning

### Phase 6: Wager Mechanics
**Goal**: Users can bet up to half their current score on the final question
**Depends on**: Phase 5
**Requirements**: GAME-10, GAME-11, GAME-12, GAME-13, SCORE-03
**Success Criteria** (what must be TRUE):
  1. Final question includes wager round option
  2. User can wager up to half current score
  3. Wager UI shows potential outcomes before locking in
  4. User can skip wager and play for standard points
  5. Wager points added/subtracted based on final answer
  6. Results screen reflects wager outcome in final score
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during phase planning

### Phase 7: Polish & Performance
**Goal**: App meets WCAG AA accessibility standards, runs smoothly at 60fps, and has game-show aesthetic
**Depends on**: Phase 6
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, PERF-04
**Success Criteria** (what must be TRUE):
  1. All interactive elements are keyboard navigable
  2. Screen reader announces question, options, timer status, and results
  3. Color and icons used together (never color alone for meaning)
  4. All text meets minimum 4.5:1 contrast ratio (WCAG AA)
  5. Touch targets are minimum 48px
  6. Timer extension option available (hidden setting)
  7. Animations run at 60fps on mid-range devices
  8. Game has polished game-show aesthetic with subtle celebrations
**Plans**: TBD

Plans:
- [ ] 07-01: TBD during phase planning
- [ ] 07-02: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 4/4 | Complete | 2026-02-04 |
| 2. Game Core | 0/TBD | Not started | - |
| 3. Scoring System | 0/TBD | Not started | - |
| 4. Learning & Content | 0/TBD | Not started | - |
| 5. Progression & Profile | 0/TBD | Not started | - |
| 6. Wager Mechanics | 0/TBD | Not started | - |
| 7. Polish & Performance | 0/TBD | Not started | - |

## Requirement Coverage

All v1 requirements mapped: 50/50 (100%)

**By Phase:**
- Phase 1: 9 requirements (AUTH, PERF foundation)
- Phase 2: 15 requirements (GAME core, CONT)
- Phase 3: 4 requirements (SCORE)
- Phase 4: 6 requirements (LEARN, CONT)
- Phase 5: 9 requirements (PROG, PROF)
- Phase 6: 5 requirements (GAME wager, SCORE wager)
- Phase 7: 7 requirements (A11Y, PERF polish)

---
*Created: 2026-02-03*
*Milestone: v1.0 (Solo MVP)*
*Phases: 7*

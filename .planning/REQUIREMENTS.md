# Requirements: Civic Trivia Championship

**Defined:** 2026-02-03
**Core Value:** Make civic learning fun through game show mechanics — play, not study

## v1 Requirements

Requirements for initial release (Solo MVP). Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can sign up with email and password
- [x] **AUTH-02**: User can log in with email and password
- [x] **AUTH-03**: User can log out from any screen
- [x] **AUTH-04**: User session persists across browser refresh
- [x] **AUTH-05**: User receives clear error messages for auth failures

### Game Flow

- [x] **GAME-01**: User can start a solo quick play session
- [x] **GAME-02**: Game presents 10 multiple-choice questions (4 options each)
- [x] **GAME-03**: Visual countdown timer shows time remaining (progress bar, not digits)
- [x] **GAME-04**: Timer color transitions: teal → yellow (50%) → orange (25%) → red (final 3s)
- [x] **GAME-05**: User can select one answer per question
- [x] **GAME-06**: Selected answer shows lock-in confirmation
- [x] **GAME-07**: Answer reveal shows correct/incorrect with explanation (1-3 sentences)
- [x] **GAME-08**: Incorrect answers use "Not quite" language (never "Wrong")
- [x] **GAME-09**: Questions progress automatically after reveal
- [x] **GAME-10**: Final question includes wager round option
- [x] **GAME-11**: Wager allows betting up to half current score
- [x] **GAME-12**: Wager shows potential outcomes before locking in
- [x] **GAME-13**: User can skip wager and play for standard points
- [x] **GAME-14**: Results screen shows final score, accuracy, breakdown

### Learning Flow

- [x] **LEARN-01**: Answer reveal includes "Learn more" link for deeper content
- [x] **LEARN-02**: "Learn more" opens modal without leaving game
- [x] **LEARN-03**: Modal shows expanded explanation (2-3 paragraphs)
- [x] **LEARN-04**: User can close modal and continue game
- [x] **LEARN-05**: Results screen lists topics covered during game

### Scoring

- [x] **SCORE-01**: Base points awarded for correct answers (+100)
- [x] **SCORE-02**: Speed bonus calculated from time remaining (up to +50)
- [x] **SCORE-03**: Wager points added/subtracted based on final answer
- [x] **SCORE-04**: Running score displayed throughout game
- [x] **SCORE-05**: Score calculated server-side (prevents manipulation)

### Progression

- [x] **PROG-01**: XP earned per game completion (50 base + 1 per correct)
- [x] **PROG-02**: Gems earned per game completion (10 base + 1 per correct)
- [x] **PROG-03**: Results screen shows rewards earned
- [x] **PROG-04**: Progression updates persist to user profile

### User Profile

- [x] **PROF-01**: User can view their profile
- [x] **PROF-02**: Profile shows total XP and gems
- [x] **PROF-03**: Profile shows games played count
- [x] **PROF-04**: Profile shows best score
- [x] **PROF-05**: Profile shows overall accuracy percentage

### Content

- [x] **CONT-01**: Question pool includes 100+ questions minimum
- [x] **CONT-02**: Questions span easy, medium, and hard difficulty
- [x] **CONT-03**: Each question has exactly one correct answer
- [x] **CONT-04**: Each question has explanation text
- [x] **CONT-05**: Questions randomized per game session
- [x] **CONT-06**: "Learn more" content available for 10+ topics

### Accessibility

- [x] **A11Y-01**: All interactive elements keyboard navigable
- [x] **A11Y-02**: Screen reader announces question, options, timer status, results
- [x] **A11Y-03**: Color + icons used together (never color alone)
- [x] **A11Y-04**: Minimum 4.5:1 contrast ratio (WCAG AA)
- [x] **A11Y-05**: Touch targets minimum 48px
- [x] **A11Y-06**: Timer extension option available (hidden setting)

### Performance

- [x] **PERF-01**: First Contentful Paint under 1.5 seconds
- [x] **PERF-02**: Time to Interactive under 3 seconds
- [x] **PERF-03**: Bundle size under 300KB gzipped
- [x] **PERF-04**: Animations run at 60fps
- [x] **PERF-05**: Mobile responsive design works on phones and tablets

## v1.1 Requirements

Requirements for tech debt hardening. Continues from v1.0 phases.

### Redis Sessions

- [x] **REDIS-01**: Game sessions stored in Redis with automatic TTL expiry
- [x] **REDIS-02**: Sessions persist across server restarts
- [x] **REDIS-03**: Graceful fallback to in-memory storage if Redis unavailable

### Plausibility Enhancement

- [x] **PLAUS-01**: Difficulty-adjusted timing thresholds for plausibility checks
- [x] **PLAUS-02**: Flagged answers receive zero speed bonus (not just logging)
- [x] **PLAUS-03**: Timer multiplier users get adjusted thresholds (no false positives)

### Learning Content

- [x] **LCONT-01**: Fix generateLearningContent.ts TypeScript error (install @anthropic-ai/sdk)
- [x] **LCONT-02**: Expand learningContent coverage to 25-30% of questions (~15 new deep-dives)

### Game UX

- [x] **GUX-01**: Question card positioned at 1/3 from top of screen (not centered)
- [x] **GUX-02**: Answer options positioned at 2/3 from top of screen
- [x] **GUX-03**: Single-click answer selection (remove lock-in confirmation step)

### Documentation

- [x] **DOCS-01**: Generate missing Phase 3 VERIFICATION.md

## v1.2 Requirements

Requirements for Community Collections milestone. Continues from v1.1 phases.

### Collections Data Model

- [x] **COLL-01**: Questions stored in PostgreSQL with collection associations (migrated from JSON)
- [x] **COLL-02**: Collections registry with name, slug, description, and locale metadata
- [x] **COLL-03**: Questions can belong to multiple collections via tag-based mapping
- [x] **COLL-04**: Each collection defines its own topic categories (not a hardcoded global enum)
- [x] **COLL-05**: Questions can have an optional expiration date (expiresAt field)

### Collection Game Flow

- [x] **CGFLOW-01**: Player sees card-based collection picker before starting a game
- [x] **CGFLOW-02**: Each collection card shows name, description, and question count
- [x] **CGFLOW-03**: All 10 questions in a game come from the selected collection
- [x] **CGFLOW-04**: Federal collection is the default/preselected option
- [x] **CGFLOW-05**: Existing game flow (timer, scoring, wager, results, progression) works unchanged with any collection

### Expiration System

- [x] **EXP-01**: Expired questions automatically removed from game rotation
- [x] **EXP-02**: Expiration check runs on an hourly schedule (cron job)
- [x] **EXP-03**: Expired questions logged and flagged for content review
- [x] **EXP-04**: Active game sessions not affected by mid-session expiration (session isolation)

### Content Creation

- [x] **CCONT-01**: Federal collection populated with existing 120-question bank
- [x] **CCONT-02**: Bloomington IN collection with 50-120 local + Indiana state questions
- [x] **CCONT-03**: Los Angeles CA collection with 50-120 local + California state questions
- [x] **CCONT-04**: Content generation tooling supports locale-specific question generation
- [x] **CCONT-05**: All locale content cross-referenced with authoritative local government sources

### Admin & Health

- [x] **ADM-01**: Collection health dashboard showing per-collection question counts, expiring-soon counts, and expired counts

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Bookmarking

- **BOOK-01**: User can save topics for later from answer reveal
- **BOOK-02**: Saved topics appear in Learning Hub
- **BOOK-03**: User can remove saved topics

### Badges

- **BADGE-01**: First Game badge unlocked on completion
- **BADGE-02**: Perfect Score badge for 10/10 correct
- **BADGE-03**: Curious Mind badge for using "Learn more" 10 times
- **BADGE-04**: Badges displayed on profile

### Team Mode

- **TEAM-01**: User can create team game lobby
- **TEAM-02**: Lobby generates shareable code
- **TEAM-03**: Players can join via code
- **TEAM-04**: Teams vote on answers collaboratively
- **TEAM-05**: Team chat during discussion phase

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Daily streaks | Dark pattern — creates guilt/obligation instead of curiosity |
| Energy/lives system | Dark pattern — artificial limits frustrate users |
| Leaderboards | Could discourage low-performers; needs research before adding |
| OAuth login (Google/GitHub) | Email/password sufficient for MVP |
| Mobile native app | Web-first approach; mobile responsive covers use case |
| Video/image questions | Text-only for MVP; adds complexity |
| Real-time multiplayer | Phase 2; requires WebSocket infrastructure |
| Question authoring tool | Phase 5; admin-only for now |
| Classroom dashboard | Future consideration for education market |
| Pay-to-skip/Pay-to-win | Anti-feature — undermines educational integrity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1.0 Requirements (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| GAME-01 | Phase 2 | Complete |
| GAME-02 | Phase 2 | Complete |
| GAME-03 | Phase 2 | Complete |
| GAME-04 | Phase 2 | Complete |
| GAME-05 | Phase 2 | Complete |
| GAME-06 | Phase 2 | Complete |
| GAME-07 | Phase 2 | Complete |
| GAME-08 | Phase 2 | Complete |
| GAME-09 | Phase 2 | Complete |
| GAME-10 | Phase 6 | Complete |
| GAME-11 | Phase 6 | Complete |
| GAME-12 | Phase 6 | Complete |
| GAME-13 | Phase 6 | Complete |
| GAME-14 | Phase 2 | Complete |
| LEARN-01 | Phase 4 | Complete |
| LEARN-02 | Phase 4 | Complete |
| LEARN-03 | Phase 4 | Complete |
| LEARN-04 | Phase 4 | Complete |
| LEARN-05 | Phase 4 | Complete |
| SCORE-01 | Phase 3 | Complete |
| SCORE-02 | Phase 3 | Complete |
| SCORE-03 | Phase 6 | Complete |
| SCORE-04 | Phase 3 | Complete |
| SCORE-05 | Phase 3 | Complete |
| PROG-01 | Phase 5 | Complete |
| PROG-02 | Phase 5 | Complete |
| PROG-03 | Phase 5 | Complete |
| PROG-04 | Phase 5 | Complete |
| PROF-01 | Phase 5 | Complete |
| PROF-02 | Phase 5 | Complete |
| PROF-03 | Phase 5 | Complete |
| PROF-04 | Phase 5 | Complete |
| PROF-05 | Phase 5 | Complete |
| CONT-01 | Phase 2 | Complete |
| CONT-02 | Phase 2 | Complete |
| CONT-03 | Phase 2 | Complete |
| CONT-04 | Phase 2 | Complete |
| CONT-05 | Phase 2 | Complete |
| CONT-06 | Phase 4 | Complete |
| A11Y-01 | Phase 7 | Complete |
| A11Y-02 | Phase 7 | Complete |
| A11Y-03 | Phase 7 | Complete |
| A11Y-04 | Phase 7 | Complete |
| A11Y-05 | Phase 7 | Complete |
| A11Y-06 | Phase 7 | Complete |
| PERF-01 | Phase 1 | Complete |
| PERF-02 | Phase 1 | Complete |
| PERF-03 | Phase 1 | Complete |
| PERF-04 | Phase 7 | Complete |
| PERF-05 | Phase 1 | Complete |

### v1.1 Requirements (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| LCONT-01 | Phase 8 | Complete |
| DOCS-01 | Phase 8 | Complete |
| REDIS-01 | Phase 9 | Complete |
| REDIS-02 | Phase 9 | Complete |
| REDIS-03 | Phase 9 | Complete |
| GUX-01 | Phase 10 | Complete |
| GUX-02 | Phase 10 | Complete |
| GUX-03 | Phase 10 | Complete |
| PLAUS-01 | Phase 11 | Complete |
| PLAUS-02 | Phase 11 | Complete |
| PLAUS-03 | Phase 11 | Complete |
| LCONT-02 | Phase 12 | Complete |

### v1.2 Requirements (Planned)

| Requirement | Phase | Status |
|-------------|-------|--------|
| COLL-01 | Phase 13 | Complete |
| COLL-02 | Phase 13 | Complete |
| COLL-03 | Phase 13 | Complete |
| COLL-04 | Phase 13 | Complete |
| COLL-05 | Phase 13 | Complete |
| CCONT-01 | Phase 13 | Complete |
| CGFLOW-03 | Phase 14 | Complete |
| CGFLOW-04 | Phase 14 | Complete |
| CGFLOW-05 | Phase 14 | Complete |
| CGFLOW-01 | Phase 15 | Complete |
| CGFLOW-02 | Phase 15 | Complete |
| EXP-01 | Phase 16 | Complete |
| EXP-02 | Phase 16 | Complete |
| EXP-03 | Phase 16 | Complete |
| EXP-04 | Phase 16 | Complete |
| ADM-01 | Phase 16 | Complete |
| CCONT-02 | Phase 17 | Complete |
| CCONT-03 | Phase 17 | Complete |
| CCONT-04 | Phase 17 | Complete |
| CCONT-05 | Phase 17 | Complete |

**Coverage (v1.0):**
- v1.0 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0

**By Phase (v1.0):**
- Phase 1 (Foundation & Auth): 9 requirements
- Phase 2 (Game Core): 15 requirements
- Phase 3 (Scoring System): 4 requirements
- Phase 4 (Learning & Content): 6 requirements
- Phase 5 (Progression & Profile): 9 requirements
- Phase 6 (Wager Mechanics): 5 requirements
- Phase 7 (Polish & Performance): 7 requirements

**Coverage (v1.1):**
- v1.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

**By Phase (v1.1):**
- Phase 8 (Dev Tooling & Documentation): 2 requirements
- Phase 9 (Redis Session Migration): 3 requirements
- Phase 10 (Game UX Improvements): 3 requirements
- Phase 11 (Plausibility Enhancement): 3 requirements
- Phase 12 (Learning Content Expansion): 1 requirement

**Coverage (v1.2):**
- v1.2 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

**By Phase (v1.2):**
- Phase 13 (Database Schema & Seed Migration): 6 requirements
- Phase 14 (Question Service & Route Integration): 3 requirements
- Phase 15 (Collection Picker UI): 2 requirements
- Phase 16 (Expiration System): 5 requirements
- Phase 17 (Community Content Generation): 4 requirements

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-18 after Phase 15 complete*

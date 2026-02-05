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

- [ ] **GAME-01**: User can start a solo quick play session
- [ ] **GAME-02**: Game presents 10 multiple-choice questions (4 options each)
- [ ] **GAME-03**: Visual countdown timer shows time remaining (progress bar, not digits)
- [ ] **GAME-04**: Timer color transitions: teal → yellow (50%) → orange (25%) → red (final 3s)
- [ ] **GAME-05**: User can select one answer per question
- [ ] **GAME-06**: Selected answer shows lock-in confirmation
- [ ] **GAME-07**: Answer reveal shows correct/incorrect with explanation (1-3 sentences)
- [ ] **GAME-08**: Incorrect answers use "Not quite" language (never "Wrong")
- [ ] **GAME-09**: Questions progress automatically after reveal
- [ ] **GAME-10**: Final question includes wager round option
- [ ] **GAME-11**: Wager allows betting up to half current score
- [ ] **GAME-12**: Wager shows potential outcomes before locking in
- [ ] **GAME-13**: User can skip wager and play for standard points
- [ ] **GAME-14**: Results screen shows final score, accuracy, breakdown

### Learning Flow

- [ ] **LEARN-01**: Answer reveal includes "Learn more" link for deeper content
- [ ] **LEARN-02**: "Learn more" opens modal without leaving game
- [ ] **LEARN-03**: Modal shows expanded explanation (2-3 paragraphs)
- [ ] **LEARN-04**: User can close modal and continue game
- [ ] **LEARN-05**: Results screen lists topics covered during game

### Scoring

- [ ] **SCORE-01**: Base points awarded for correct answers (+100)
- [ ] **SCORE-02**: Speed bonus calculated from time remaining (up to +50)
- [ ] **SCORE-03**: Wager points added/subtracted based on final answer
- [ ] **SCORE-04**: Running score displayed throughout game
- [ ] **SCORE-05**: Score calculated server-side (prevents manipulation)

### Progression

- [ ] **PROG-01**: XP earned per game completion (50 base + 1 per correct)
- [ ] **PROG-02**: Gems earned per game completion (10 base + 1 per correct)
- [ ] **PROG-03**: Results screen shows rewards earned
- [ ] **PROG-04**: Progression updates persist to user profile

### User Profile

- [ ] **PROF-01**: User can view their profile
- [ ] **PROF-02**: Profile shows total XP and gems
- [ ] **PROF-03**: Profile shows games played count
- [ ] **PROF-04**: Profile shows best score
- [ ] **PROF-05**: Profile shows overall accuracy percentage

### Content

- [ ] **CONT-01**: Question pool includes 100+ questions minimum
- [ ] **CONT-02**: Questions span easy, medium, and hard difficulty
- [ ] **CONT-03**: Each question has exactly one correct answer
- [ ] **CONT-04**: Each question has explanation text
- [ ] **CONT-05**: Questions randomized per game session
- [ ] **CONT-06**: "Learn more" content available for 10+ topics

### Accessibility

- [ ] **A11Y-01**: All interactive elements keyboard navigable
- [ ] **A11Y-02**: Screen reader announces question, options, timer status, results
- [ ] **A11Y-03**: Color + icons used together (never color alone)
- [ ] **A11Y-04**: Minimum 4.5:1 contrast ratio (WCAG AA)
- [ ] **A11Y-05**: Touch targets minimum 48px
- [ ] **A11Y-06**: Timer extension option available (hidden setting)

### Performance

- [x] **PERF-01**: First Contentful Paint under 1.5 seconds
- [x] **PERF-02**: Time to Interactive under 3 seconds
- [x] **PERF-03**: Bundle size under 300KB gzipped
- [ ] **PERF-04**: Animations run at 60fps
- [x] **PERF-05**: Mobile responsive design works on phones and tablets

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

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| GAME-01 | Phase 2 | Pending |
| GAME-02 | Phase 2 | Pending |
| GAME-03 | Phase 2 | Pending |
| GAME-04 | Phase 2 | Pending |
| GAME-05 | Phase 2 | Pending |
| GAME-06 | Phase 2 | Pending |
| GAME-07 | Phase 2 | Pending |
| GAME-08 | Phase 2 | Pending |
| GAME-09 | Phase 2 | Pending |
| GAME-10 | Phase 6 | Pending |
| GAME-11 | Phase 6 | Pending |
| GAME-12 | Phase 6 | Pending |
| GAME-13 | Phase 6 | Pending |
| GAME-14 | Phase 2 | Pending |
| LEARN-01 | Phase 4 | Pending |
| LEARN-02 | Phase 4 | Pending |
| LEARN-03 | Phase 4 | Pending |
| LEARN-04 | Phase 4 | Pending |
| LEARN-05 | Phase 4 | Pending |
| SCORE-01 | Phase 3 | Pending |
| SCORE-02 | Phase 3 | Pending |
| SCORE-03 | Phase 6 | Pending |
| SCORE-04 | Phase 3 | Pending |
| SCORE-05 | Phase 3 | Pending |
| PROG-01 | Phase 5 | Pending |
| PROG-02 | Phase 5 | Pending |
| PROG-03 | Phase 5 | Pending |
| PROG-04 | Phase 5 | Pending |
| PROF-01 | Phase 5 | Pending |
| PROF-02 | Phase 5 | Pending |
| PROF-03 | Phase 5 | Pending |
| PROF-04 | Phase 5 | Pending |
| PROF-05 | Phase 5 | Pending |
| CONT-01 | Phase 2 | Pending |
| CONT-02 | Phase 2 | Pending |
| CONT-03 | Phase 2 | Pending |
| CONT-04 | Phase 2 | Pending |
| CONT-05 | Phase 2 | Pending |
| CONT-06 | Phase 4 | Pending |
| A11Y-01 | Phase 7 | Pending |
| A11Y-02 | Phase 7 | Pending |
| A11Y-03 | Phase 7 | Pending |
| A11Y-04 | Phase 7 | Pending |
| A11Y-05 | Phase 7 | Pending |
| A11Y-06 | Phase 7 | Pending |
| PERF-01 | Phase 1 | Complete |
| PERF-02 | Phase 1 | Complete |
| PERF-03 | Phase 1 | Complete |
| PERF-04 | Phase 7 | Pending |
| PERF-05 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0

**By Phase:**
- Phase 1 (Foundation & Auth): 9 requirements
- Phase 2 (Game Core): 15 requirements
- Phase 3 (Scoring System): 4 requirements
- Phase 4 (Learning & Content): 6 requirements
- Phase 5 (Progression & Profile): 9 requirements
- Phase 6 (Wager Mechanics): 5 requirements
- Phase 7 (Polish & Performance): 7 requirements

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after roadmap creation*

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** Make civic learning fun through game show mechanics — play, not study
**Current focus:** Phase 6 complete, ready for Phase 7

## Current Position

Phase: 7 of 7 (Polish & Performance) — IN PROGRESS
Plan: 2 of 5 (timer extension complete)
Status: Phase in progress - building accessibility and polish features
Last activity: 2026-02-13 - Completed 07-02-PLAN.md

Progress: [████████░░] ~90%

## Performance Metrics

**Velocity:**
- Total plans completed: 23
- Average duration: 3.9 min
- Total execution time: 89 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-auth | 4/4 | 12 min | 3 min |
| 02-game-core | 4/4 | 16 min | 4 min |
| 03-scoring-system | 3/3 | 12 min | 4 min |
| 04-learning-content | 3/3 | 20 min | 7 min |
| 05-progression-profile | 4/4 | 13 min | 3.3 min |
| 06-wager-mechanics | 3/3 | 9 min | 3 min |
| 07-polish-performance | 2/5 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 06-03 (2 min), 06-02 (3 min), 07-01 (3 min), 07-02 (4 min)
- Trend: Excellent consistent 2-4 min velocity continues into Phase 7

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Decision | Plan | Rationale |
|----------|------|-----------|
| Monorepo with separate package.json | 01-01 | Simpler than npm workspaces for this project size |
| tsx for backend dev | 01-01 | Faster than ts-node, good watch mode |
| ESM modules throughout | 01-01 | Modern JavaScript standards |
| Vite proxy for /api | 01-01 | CORS-free development |
| In-memory token storage via Zustand | 01-03 | Security - prevents XSS token theft |
| Auto-login after signup | 01-03 | Better UX than forcing separate login |
| Field-specific error display | 01-03 | Shows server validation under each field |
| AuthInitializer wraps entire app | 01-04 | Session restore on mount before any route renders |
| 401 auto-retry with refresh | 01-04 | Seamless token refresh on API failures |
| fs.readFileSync for JSON in ESM | 02-01 | NodeNext module resolution compatibility |
| Fisher-Yates shuffle for randomization | 02-01 | Performant in-memory randomization for small datasets |
| 120 question bank | 02-01 | Variety reduces gameplay repetition |
| useReducer for game state machine | 02-02 | Pure reducer ensures predictable state transitions |
| 1.5s suspense pause after lock-in | 02-02 | Dramatic tension before reveal |
| 6s auto-advance after reveal | 02-04 | User preference for more reading time (was 4s) |
| Lift useGameState to Game.tsx | 02-04 | Single state instance avoids duplicate state machines |
| 25s question duration | 02-04 | User preference (was 20s) |
| 2s question preview | 02-04 | Read question before options and timer appear |
| Server-authority scoring | 03-01 | Prevents client-side score manipulation |
| 3-tier speed bonus system | 03-01 | >=15s: +50, >=5s: +25, <5s: +0 points |
| In-memory session storage | 03-01 | Simple MVP approach, 1-hour expiry with auto-cleanup |
| Plausibility checks without penalties | 03-01 | Flags suspicious timing but doesn't penalize for MVP |
| Strip correctAnswer from session questions | 03-01 | Prevents client cheat while allowing reveal |
| Anonymous user support | 03-01 | Sessions work without auth (userId='anonymous') |
| SESSION_CREATED replaces START_GAME | 03-02 | Explicit session creation action with sessionId |
| Promise.all for suspense + server | 03-02 | Ensures minimum suspense pause while server responds |
| correctAnswer from server response | 03-02 | Questions lack correctAnswer (stripped), comes in submitAnswer |
| Running totalScore in state | 03-02 | Enables mid-game score display |
| onTimeUpdate callback pattern | 03-02 | GameTimer exposes time for accurate server submission |
| Spring physics for score counter | 03-03 | useMotionValue with spring gives game-show feel |
| 3-state feedback system | 03-03 | Correct (teal/gold), wrong (red/shake), timeout (amber) are distinct |
| Individual question accordions | 03-03 | Each question expandable independently in results |
| Perfect game golden treatment | 03-03 | 10/10 gets amber/gold text + "Perfect Game!" label |
| 9 granular topic categories | 04-01 | More specific than 5 broad categories for better content organization |
| Answer-specific corrections | 04-01 | Each wrong option gets tailored explanation, not generic "incorrect" |
| Build-time AI generation | 04-01 | Static content faster, cheaper, reviewable vs runtime generation |
| Keep existing topic field | 04-01 | Add topicCategory field without breaking existing code |
| Require topicCategory, optional learningContent | 04-01 | Every question categorized, content added incrementally |
| Tooltip only auto-shows once per session | 04-02 | Avoid annoying users with repeated tooltips across 10 questions |
| Timer pause preserves exact remaining time | 04-02 | Users shouldn't be penalized for reading educational content |
| Modal renders answer-aware opener | 04-02 | Contextualize content to user's answer (right/wrong/timeout) |
| No modal header/title | 04-02 | Educational content should feel conversational, not formal |
| overflow-x-hidden instead of overflow-hidden | 04-03 | Prevents clipping Learn More button while avoiding horizontal scroll |
| justify-start pt-[10vh] instead of justify-center | 04-03 | Prevents question card from shifting when answer options fade in |
| XP formula: 50 base + 1 per correct | 05-01 | Simple, predictable progression rewarding both participation and performance |
| Gems formula: 10 base + 1 per correct | 05-01 | Parallel to XP, future currency for cosmetics |
| best_score uses GREATEST, not increment | 05-01 | Keeps maximum score achieved, more meaningful than cumulative |
| Progression on results endpoint | 05-01 | Awards once at completion, not incrementally during play |
| progressionAwarded flag prevents double-award | 05-01 | Idempotent results endpoint safe for multiple calls |
| Icons + numbers only, no rewards label | 05-02 | Cleaner UI, icons are self-explanatory in context |
| Fetch progression from server on complete | 05-02 | Server is source of truth, prevents client manipulation |
| Same spring animation for XP/gems as score | 05-02 | Visual consistency across all count-up animations |
| Golden treatment for perfect game rewards | 05-02 | Matches existing score treatment, reinforces achievement |
| Multer 2.0.2 for uploads | 05-03 | Avoids CVE-2025-47935 and CVE-2025-47944 in Multer 1.x |
| Magic byte validation for avatars | 05-03 | Defense in depth, catches MIME type spoofing attacks |
| UUID filenames for avatars | 05-03 | Prevents path traversal attacks |
| 5MB avatar size limit | 05-03 | Reasonable balance between quality and storage/bandwidth |
| Identity-focused hero section | 05-04 | Profile leads with who you are (name + avatar) not what you have (currency) |
| Deterministic avatar colors | 05-04 | Name hash selects color for consistency across sessions |
| Empty state with CTA | 05-04 | Encouraging message better UX than showing zeros for new users |
| Hamburger menu for navigation | 05-04 | Cleaner header, groups user actions (Profile + Log out) |
| Wager as answer parameter | 06-01 | Integrated into answer submission, avoids race conditions |
| 50s duration for final question | 06-01 | Doubled from 25s for complex final question after wager |
| Wager-only scoring (no base/speed) | 06-01 | Final question uses only wager amount (+/- wager) for game show feel |
| Default wager 25% of max | 06-01 | Pre-populate with 25% of maximum (half score) as middle ground |
| Reuse 'answering' phase for Q10 | 06-01 | After wager locked, existing SELECT/LOCK/REVEAL/TIMEOUT work unchanged |
| Wager section between score and accuracy | 06-03 | Dramatic reveal placement for maximum impact |
| Q1-Q9 base+speed calculated separately | 06-03 | When wager exists, show score composition clearly |
| Negative score displayed in red | 06-03 | Clear visual indication of wager loss |
| Zero wager shows "played for fun" | 06-03 | Maintains positive tone even when not betting |
| Native range input for wager slider | 06-02 | Accessibility and simplicity over third-party library |
| Context-aware button text | 06-02 | "Play for Fun" at 0, "Lock In Wager" above 0 - no separate skip |
| Full-screen phase transitions | 06-02 | Dedicated screens for dramatic moments, not overlays |
| Amber styling for final question | 06-02 | Border glow and badge distinguish Q10 visually |
| Zustand store for announcements | 07-01 | Consistent with app architecture (authStore, gameStore) |
| Clear-then-set announcement pattern | 07-01 | Ensures repeated messages announced by screen readers |
| Custom focus rings match game-show theme | 07-01 | Teal/amber glows instead of browser defaults |
| FocusTrap with returnFocusOnDeactivate | 07-01 | Returns focus to trigger element after modal close |
| Reduced motion removes glow animations | 07-01 | Maintains focus visibility without triggering motion sensitivity |
| Timer multiplier stored as REAL | 07-02 | 1.0, 1.5, 2.0 for flexibility and validation |
| Settings section always visible | 07-02 | Available to all users immediately, not gated by games played |
| Timer multiplier in auth store | 07-02 | Global access without prop drilling through game components |
| Extended Time neutral labeling | 07-02 | Avoids accessibility-specific terminology to prevent stigma |

### Pending Todos

None yet.

### Blockers/Concerns

None — Phase 7 in progress. Accessibility foundation and timer extension complete. Ready for keyboard navigation enhancements.

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 07-02-PLAN.md (timer extension)
Resume file: None

---
*Next step: Continue Phase 7 plans (keyboard nav, celebrations, loading states)*

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** Make civic learning fun through game show mechanics — play, not study
**Current focus:** v1.1 Tech Debt Hardening

## Current Position

Phase: Phase 9 (Redis Session Migration)
Plan: 2 of 3 (In progress)
Status: Plan 09-02 complete - Core session migration to async storage
Last activity: 2026-02-13 — Completed 09-02-PLAN.md (Async SessionManager migration)

Progress: [████████░░░░░░░░░░░░] v1.0: 100% (7/7) | v1.1: 30% (1.7/5 phases)

**Milestone progress:**
- v1.0 (Phases 1-7): Complete - 50/50 requirements delivered
- v1.1 (Phases 8-12): 4/12 requirements delivered (LCONT-01, DOCS-01, STOR-01, STOR-02)

## Performance Metrics

**Velocity:**
- Total plans completed: 30
- Average duration: 3.8 min
- Total execution time: 115 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-auth | 4/4 | 12 min | 3 min |
| 02-game-core | 4/4 | 16 min | 4 min |
| 03-scoring-system | 3/3 | 12 min | 4 min |
| 04-learning-content | 3/3 | 20 min | 7 min |
| 05-progression-profile | 4/4 | 13 min | 3.3 min |
| 06-wager-mechanics | 3/3 | 9 min | 3 min |
| 07-polish-performance | 5/5 | 22 min | 4.4 min |
| 08-dev-tooling-documentation | 2/2 | 4 min | 2 min |
| 09-redis-session-migration | 2/3 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 07-05 (5 min), 08-01 (2 min), 08-02 (2 min), 09-01 (3 min), 09-02 (4 min)
- Trend: Strong 2-5 min velocity maintained

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
| Inline SVG icons with aria-hidden | 07-04 | Icons are decorative (redundant with color), avoid screen reader clutter |
| Pulsing at critical time | 07-04 | Timer pulses at <=5s for both accessibility (motion cue) and drama |
| 48px via class not utility wrapper | 07-04 | Direct min-w/h-[48px] on buttons avoids layout complications |
| text-slate-400 minimum for body text | 07-04 | Provides 4.5:1 contrast on slate-900 backgrounds (WCAG AA) |
| border-slate-500 for UI components | 07-04 | Provides 3:1 contrast for borders/separators on dark backgrounds |
| AnswerGrid handles keyboard internally | 07-03 | Arrow/number keys on buttons with GameScreen global fallback ensures broad coverage |
| Separate isPaused from isTimerPaused | 07-03 | Distinguishes user pause overlay from game-triggered timer pauses |
| Polite vs assertive announcements | 07-03 | Assertive for critical events (Time's up, Final Q), polite for everything else |
| Confetti conductor stored in Zustand | 07-05 | Global access pattern consistent with app architecture (authStore, gameStore) |
| Three-tier celebration escalation | 07-05 | 3-streak (small), 5-streak (medium + "On Fire!"), 7+ (medium + "Unstoppable!") |
| Perfect game confetti rain | 07-05 | 5-second duration on results screen for maximum celebration impact |
| Question transitions use x-axis slide | 07-05 | Left/right slide (30px) feels more natural than vertical for question progression |
| Web Vitals dev-only logging | 07-05 | Console logs in development, silent in production (ready for analytics integration) |
| GPU-only animations | 07-05 | All animations use transform/opacity to maintain 60fps performance |
| Preview-before-commit for AI content | 08-01 | Output to temp file for review instead of auto-writing to questions.json |
| ANTHROPIC_API_KEY for content generation | 08-01 | SDK default, simpler than CLAUDE_API_KEY |
| dotenv for .env support | 08-01 | Allows backend/.env with ANTHROPIC_API_KEY for local development |
| Async storage interface | 09-01 | Accommodates Redis while maintaining MemoryStorage compatibility |
| SETEX for atomic TTL | 09-01 | Prevents race condition between set and expire operations |
| Graceful degradation to MemoryStorage | 09-01 | App always starts even if Redis unavailable, prevents downtime |
| Legacy redis export maintained | 09-01 | Backward compatibility with tokenUtils token storage |
| Docker noeviction policy | 09-01 | 256MB limit prevents session loss from eviction |
| Cleanup interval only for MemoryStorage | 09-02 | Redis TTL handles expiry automatically, manual cleanup redundant |
| Auto-refresh TTL on getSession() | 09-02 | Extends session lifetime on activity, prevents mid-game expiration |
| Persist session after each answer | 09-02 | Ensures Redis has latest state, enables crash recovery mid-game |
| Proxy-based singleton export | 09-02 | Backward compatibility while enforcing initialization |
| Degraded flag in API responses | 09-02 | Frontend detects fallback mode without polling health endpoint |
| Health endpoint 503 for degraded mode | 09-02 | Load balancers can detect Redis failure and route traffic |

### Pending Todos

Phase 9 (Redis Session Migration) - Plan 09-03:
- Test session persistence across server restarts
- Verify graceful degradation when Redis goes down mid-operation
- Document Redis deployment requirements

Phase 10 (Game UX Improvements):
- Reposition question card to 1/3 from top
- Reposition answer options to 2/3 from top
- Remove lock-in confirmation step (single-click answer selection)

Phase 11 (Plausibility Enhancement):
- Implement difficulty-adjusted timing thresholds
- Add 30% point reduction for flagged answers
- Adjust thresholds for timer_multiplier users
- Add pattern counting (3+ suspicious before penalties)

Phase 12 (Learning Content Expansion):
- Generate 12-18 additional deep-dive learning content pieces
- Prioritize frequently missed questions and high-interest topics
- Cross-reference all content with authoritative sources
- Follow batch review process (10-20 at a time)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-13 20:04:10 UTC
Stopped at: Completed 09-02-PLAN.md (Async SessionManager migration)
Resume file: None

---
*v1.1 Tech Debt Hardening — roadmap created*

Config:
{
  "mode": "yolo",
  "depth": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}

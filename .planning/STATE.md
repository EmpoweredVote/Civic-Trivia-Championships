# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Make civic learning fun through game show mechanics — play, not study
**Current focus:** v1.2 Community Collections — Phase 15 complete, ready for Phase 16

## Current Position

Phase: 16 of 17 (Expiration System)
Plan: 1 of 3 in phase 16
Status: In progress
Last activity: 2026-02-18 — Completed 16-01-PLAN.md

Progress: [█████████████░░░░░░░] v1.2: 65% (3.33/5 phases)

**Milestone progress:**
- v1.0 (Phases 1-7): Complete - 50/50 requirements delivered
- v1.1 (Phases 8-12): Complete - 12/12 requirements delivered
- v1.2 (Phases 13-17): In progress - 14/20 requirements delivered

**Deployment Status:**
- Frontend LIVE: https://civic-trivia-frontend.onrender.com
- Backend LIVE: https://civic-trivia-backend.onrender.com
- Database: Supabase EV-Backend-Dev (civic_trivia schema)
- Redis: Upstash (stirred-pika-7510)
- GitHub: EmpoweredVote/Civic-Trivia-Championships

## Performance Metrics

**Velocity:**
- Total plans completed: 43
- Average duration: 3.4 min
- Total execution time: 156.3 min

**Recent Trend:**
- Last 5 plans: 15-01 (1.2 min), 15-02 (1.6 min), 15-03 (2.8 min), 16-01 (3.7 min)
- Trend: Strong velocity — consistently under 4 minutes

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Decision | Context | Rationale |
|----------|---------|-----------|
| Tag-based collections over rigid categories | v1.2 | Questions can belong to multiple collections (e.g., Indiana + Bloomington) |
| AI-generated + human-reviewed content | v1.2 | AI kickstarts local question banks, volunteers refine over time |
| Auto-remove + notify on expiration | v1.2 | Time-sensitive questions drop from rotation and flag for review |
| Quality over quantity for local sets | v1.2 | 50 compelling questions beats 100 half-compelling |
| Preserve existing sources exactly | 13-02 | Original 33 sources kept as-is (including 2 Wikipedia) for continuity |
| Topic-based source assignment | 13-02 | Reuse stable .gov/.edu URLs across questions on same topic |
| Database as single source of truth | 13-03 | questions.json remains as historical reference but is never read by app |
| Link all topics to Federal collection | 13-03 | Enables flexible question selection in Phase 14 without additional seed operations |
| externalId as Question.id (not DB serial) | 14-01 | Backward compat with existing session/answer logic using string IDs like q001 |
| Module-level caching for topicMap and federalCollectionId | 14-01 | Both immutable at runtime — avoids repeated DB round-trips |
| Legacy questionIds path fetches from DB and filters | 14-02 | Backward compat without maintaining removed allQuestions variable |
| In-memory recent question tracking (not persisted) | 14-02 | Sufficient for per-deployment variety; Redis persistence deferred |
| Collections query excludes expired questions from count | 15-01 | Ensures picker shows accurate playable question counts using JOIN through questions table |
| MIN_QUESTION_THRESHOLD applied in JS, not SQL | 15-01 | Allows future configuration without query changes |
| Inline style for themeColor (not dynamic Tailwind) | 15-02 | Tailwind JIT purges dynamic class strings — inline style required for runtime colors |
| CollectionPicker as pure component (props, not hook) | 15-02 | Makes component testable and reusable — Dashboard owns useCollections hook |
| localStorage persistence for last-played collection | 15-02 | Better UX — remembers user preference across sessions with 'lastCollectionId' key |
| Router state for collectionId (not URL params or global state) | 15-03 | Clean separation - Dashboard owns selection, Game receives as navigation context |
| Auto-start game when navigating from Dashboard with collectionId | 15-03 | Seamless UX - one-click flow from "Play Federal Civics" to gameplay |
| Display collection name in both game header and results | 15-03 | Reinforces context throughout game experience |
| JSONB array for expiration audit history | 16-01 | Enables efficient SQL append (||), keeps audit trail co-located with question data, avoids JOIN overhead |
| Default status='active' for new questions | 16-01 | All existing questions automatically get correct status without data migration |
| Cron runs after session manager init | 16-01 | Guarantees DB connection ready when cron fires, doesn't block server startup |
| Structured JSON logging for cron jobs | 16-01 | {level, job, message, metadata} format enables log aggregation and alerting |

### Pending Todos

Deployment Follow-up:
- [ ] Invite volunteers to GitHub org
- [ ] Share live URLs with team
- [ ] Add to ev-prototypes.netlify.app (optional)

### Blockers/Concerns

None currently.

**Research flags for v1.2:**
- Phase 17 (Content Generation): Highest risk — AI hallucination on local facts, RAG pipeline untested
- Phase 16 (Expiration): Moderate uncertainty on grace periods and minimum-size handling

## Session Continuity

Last session: 2026-02-18
Topic: Phase 16 plan 01 execution
Stopped at: Completed 16-01-PLAN.md
Resume file: None

---
*v1.2 Community Collections — ROADMAP CREATED*

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

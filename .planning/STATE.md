# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Make civic learning fun through game show mechanics — play, not study
**Current focus:** v1.2 Community Collections — Phase 14 (Question Service & Route Integration)

## Current Position

Phase: 14 of 17 (Question Service & Route Integration) — Complete
Plan: 2 of 2 in phase 14
Status: Phase 14 complete, ready for Phase 15
Last activity: 2026-02-19 — Completed 14-02-PLAN.md (game route integration)

Progress: [████░░░░░░░░░░░░░░░░] v1.2: 30% (1.5/5 phases, 39/40 total plans)

**Milestone progress:**
- v1.0 (Phases 1-7): Complete - 50/50 requirements delivered
- v1.1 (Phases 8-12): Complete - 12/12 requirements delivered
- v1.2 (Phases 13-17): In progress - 7/20 requirements delivered

**Deployment Status:**
- Frontend LIVE: https://civic-trivia-frontend.onrender.com
- Backend LIVE: https://civic-trivia-backend.onrender.com
- Database: Supabase EV-Backend-Dev (civic_trivia schema)
- Redis: Upstash (stirred-pika-7510)
- GitHub: EmpoweredVote/Civic-Trivia-Championships

## Performance Metrics

**Velocity:**
- Total plans completed: 38
- Average duration: 3.7 min
- Total execution time: 143 min

**Recent Trend:**
- Last 5 plans: 13-01 (4 min), 13-02 (2 min), 13-03 (3 min), 14-01 (2 min), 14-02 (2 min)
- Trend: Consistent 2-4 min velocity maintained

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

Last session: 2026-02-19
Topic: Phase 14 plan 02 execution — game route integration complete
Stopped at: Completed 14-02-PLAN.md — Phase 14 complete, ready for Phase 15 (Collection Picker UI)
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

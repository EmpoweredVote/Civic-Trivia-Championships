# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Make civic learning fun through game show mechanics — play, not study
**Current focus:** v1.2 Community Collections — Phase 17 in progress (Plan 2 of 3 complete)

## Current Position

Phase: 17 of 17 (Community Content Generation) — Complete
Plan: 4 of 4 in phase 17
Status: Phase complete
Last activity: 2026-02-19 — Completed 17-04 (Collection Activation)

Progress: [████████████████████] v1.2: 100% (All 3 collections active and playable: Federal 120q, Bloomington 100q, LA 100q)

**Milestone progress:**
- v1.0 (Phases 1-7): Complete - 50/50 requirements delivered
- v1.1 (Phases 8-12): Complete - 12/12 requirements delivered
- v1.2 (Phases 13-17): Complete - 320 total questions across 3 collections (Federal, Bloomington IN, Los Angeles CA) all active and playable

**Deployment Status:**
- Frontend LIVE: https://civic-trivia-frontend.onrender.com
- Backend LIVE: https://civic-trivia-backend.onrender.com
- Database: Supabase EV-Backend-Dev (civic_trivia schema)
- Redis: Upstash (stirred-pika-7510)
- GitHub: EmpoweredVote/Civic-Trivia-Championships

## Performance Metrics

**Velocity:**
- Total plans completed: 47
- Average duration: 3.8 min
- Total execution time: 189.2 min

**Recent Trend:**
- Last 5 plans: 17-01 (6 min), 17-02 (~20 min), 17-03 (~20 min), 17-04 (5 min)
- Trend: Strong velocity — Phase 17 complete with 4 plans delivering full v1.2 milestone

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
| Health endpoint is public (no auth) | 16-02 | Enables monitoring dashboards and external health checks with aggregated count data |
| Admin uses database serial IDs | 16-02 | Admin route params use questions.id (integer) not externalId (string) for simpler UPDATE queries |
| Tier labels computed in JavaScript | 16-02 | Health tiers (Healthy/At Risk/Critical) computed in JS for flexible threshold tuning |
| Renewal immediately reactivates questions | 16-02 | POST /renew sets status='active' atomically so question returns to game rotation instantly |
| Zod parse over tool_use for AI response validation | 17-01 | BatchSchema.parse() on response text simpler than tool_use; no zod-to-json-schema needed |
| status='draft' for all AI-generated questions | 17-01 | Admin reviews and activates before questions appear in gameplay |
| ON CONFLICT DO NOTHING for question seeding | 17-01 | Idempotent — safe to re-run batches without duplicate entries |
| cache_control: ephemeral on last RAG source block | 17-01 | Caches entire source document prefix across batches, reducing API cost |
| LocaleConfig interface in bloomington-in.ts | 17-01 | Shared type imported by all locale configs and main script |
| Difficulty distribution 30/44/26 accepted | 17-02 | Actual easy/medium/hard split acceptable; local civic content skews medium by nature |
| Human verify checkpoint as blocking gate | 17-02 | AI-generated content always gated by human review before plan completes |
| Difficulty distribution 19/48/33 for LA accepted | 17-03 | Similar to Bloomington, local civic content produces fewer easy questions; distribution acceptable |
| Proceed with partial RAG sources on fetch failures | 17-03 | 7 of 14 LA sources fetched successfully; sufficient authoritative coverage for generation |
| Activated collections in both seed file and live database | 17-04 | Ensures future re-seeds maintain active state while immediate effect in production |
| All 200 community questions activated at once | 17-04 | Batch activation safe after human review in Plans 02+03; no gradual rollout needed |
| Icon fallback pattern for topic categories | 17-04 | TOPIC_ICONS[topicKey] ?? BarChart2 handles community topics gracefully, prevents crashes |

### Pending Todos

Deployment Follow-up:
- [ ] Announce v1.2 Community Collections launch (320 total questions live)
- [ ] Invite volunteers to GitHub org
- [ ] Share live URLs with team
- [ ] Add to ev-prototypes.netlify.app (optional)

Content Generation:
- [x] Run Plan 02: Generate Bloomington questions — 100 questions seeded (bli-001 to bli-100)
- [x] Run Plan 03: Generate LA questions — 100 questions seeded (lac-001 to lac-100)
- [x] Activate community collections — Both collections active with all 200 questions playable

### Blockers/Concerns

None currently.

**Research flags for v1.2:**
- Phase 17 complete: Both Bloomington and LA collections activated and playable — hallucination risk managed via RAG + human checkpoints

## Session Continuity

Last session: 2026-02-19
Topic: Phase 17 Plan 04 — Collection activation (both community collections active, 320 total questions playable)
Stopped at: Completed 17-04-PLAN.md (Phase 17 complete, v1.2 milestone delivered)
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

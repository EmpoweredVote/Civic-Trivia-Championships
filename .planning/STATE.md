# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Make civic learning fun through game show mechanics -- play, not study
**Current focus:** v1.4 Fremont, CA Collection — Phase 24 (Question Generation & Review)

## Current Position

Phase: 24 of 26 (Question Generation & Review) — IN PROGRESS
Plan: 2 of 3 complete
Status: In progress
Last activity: 2026-02-21 — Completed 24-02-PLAN.md (Generate Fremont Questions with Quality Validation)

Progress: [█████████████████████░░░] 88% (72/82 plans across all milestones)

**Milestone progress:**
- v1.0 (Phases 1-7): Complete - 50/50 requirements delivered
- v1.1 (Phases 8-12): Complete - 12/12 requirements delivered
- v1.2 (Phases 13-17): Complete - 20/20 requirements delivered
- v1.3 (Phases 18-22): Complete - 23/23 requirements delivered
- v1.4 (Phases 23-26): In progress - 4/19 requirements delivered

**Deployment Status:**
- Frontend LIVE: https://civic-trivia-frontend.onrender.com
- Backend LIVE: https://civic-trivia-backend.onrender.com
- Database: Supabase EV-Backend-Dev (civic_trivia schema)
- Redis: Upstash (stirred-pika-7510)
- GitHub: EmpoweredVote/Civic-Trivia-Championships

## Performance Metrics

**Velocity:**
- Total plans completed: 72 (26 v1.0 + 11 v1.1 + 15 v1.2 + 17 v1.3 + 3 v1.4)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.2: Quality over quantity for local sets (target ~120 but don't force it) — guides Fremont content generation
- v1.3: Codify quality rules before scaling content — Fremont benefits from established quality framework
- v1.3: State template 40/30/30 topic distribution — informs Fremont topic category structure
- Phase 23: History+culture heavy Fremont distribution (38% total: civic-history=20, landmarks-culture=18)
- Phase 23: Tesla/NUMMI elevated budget allocation (12 questions for economic transition narrative)
- Phase 23: Fremont sortOrder 3 (between Bloomington and LA)
- Phase 24-01: Embed quality guidelines in all locale system prompts (not just Fremont) — improves first-pass validation rate, reduces API costs
- Phase 24-01: Accept 45% RAG source fetch rate for Fremont — common for .gov sites that block scrapers, generation can proceed with available sources
- Phase 24-01: Locale-specific sensitivity instructions conditional on localeSlug — backward-compatible pattern for future locale customization
- Phase 24-02: Overshoot factor 1.3 for Fremont — generates ~130 questions, curate to ~100 in review for quality buffer
- Phase 24-02: Integrate quality validation into generation pipeline — catch violations during generation when AI context is hot, cheaper to regenerate than post-generation fixes
- Phase 24-02: Run batches individually for API rate limits — 10k tokens/min limit requires 70s pauses between batches on low-tier accounts

### Pending Todos

- [ ] Announce v1.2 Community Collections launch (320 total questions live)
- [ ] Invite volunteers to GitHub org
- [ ] Share live URLs with team
- [ ] Add ADMIN_EMAIL environment variable to production backend
- [ ] Update Phase 19 audit script to populate violation_count column when saving quality scores

### Known Tech Debt

- All 320 original questions have broken source.url Learn More links (legacy CMS migration)
- violation_count column may go stale if quality rules change without re-audit
- ILIKE search may degrade beyond 1000 questions (consider pg_trgm GIN index)
- useBlocker unavailable (requires createBrowserRouter) — sidebar nav during edit won't prompt for unsaved changes
- seed-questions.ts comment says status='draft' but scripts insert as 'active'

### Blockers/Concerns

**Phase 24-03 readiness notes:**
- 123 draft Fremont questions in database (fre-001 through fre-125, 2 IDs skipped)
- Quality validation caught 5 questions with blocking violations during generation: 4 fixed and passed on retry, 2 dropped
- Topic distribution imbalance: civic-history under-represented (14 vs 20 target), elections-voting over-represented (18 vs 10 target)
- May need to generate 6 supplemental civic-history questions in Plan 03
- Difficulty distribution close to target: 37% easy, 43% medium, 20% hard (vs 40/40/20 target)
- No blockers for Plan 03 review and curation

## Session Continuity

Last session: 2026-02-21
Topic: Phase 24 Plan 02 execution — Generate Fremont questions with quality validation
Stopped at: Completed 24-02-PLAN.md
Resume file: None

---
*Ready for: Phase 24 Plan 03 (Review, Curation, Finalization)*

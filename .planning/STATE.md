# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Make civic learning fun through game show mechanics -- play, not study
**Current focus:** v1.4 Fremont, CA Collection — Phase 24 (Question Generation & Review)

## Current Position

Phase: 24 of 26 (Question Generation & Review) — IN PROGRESS
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-02-21 — Completed 24-01-PLAN.md (Generation Pipeline Configuration)

Progress: [█████████████████████░░░] 87% (71/82 plans across all milestones)

**Milestone progress:**
- v1.0 (Phases 1-7): Complete - 50/50 requirements delivered
- v1.1 (Phases 8-12): Complete - 12/12 requirements delivered
- v1.2 (Phases 13-17): Complete - 20/20 requirements delivered
- v1.3 (Phases 18-22): Complete - 23/23 requirements delivered
- v1.4 (Phases 23-26): In progress - 3/19 requirements delivered

**Deployment Status:**
- Frontend LIVE: https://civic-trivia-frontend.onrender.com
- Backend LIVE: https://civic-trivia-backend.onrender.com
- Database: Supabase EV-Backend-Dev (civic_trivia schema)
- Redis: Upstash (stirred-pika-7510)
- GitHub: EmpoweredVote/Civic-Trivia-Championships

## Performance Metrics

**Velocity:**
- Total plans completed: 71 (26 v1.0 + 11 v1.1 + 15 v1.2 + 17 v1.3 + 2 v1.4)

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

**Phase 24-02 readiness notes:**
- Fremont locale fully registered in generation pipeline
- System prompt includes Fremont-specific sensitivity instructions (Ohlone present-tense, Afghan-American cultural heritage, Tesla civic-only, Mission San Jose disambiguation)
- Quality guidelines embedded in prompts for improved first-pass validation
- 9 RAG sources cached (Alameda County, California state, regional transit) — 11 fremont.gov sources failed with HTTP 403 errors
- May need to manually verify Fremont-specific facts during spot-check review due to thin local source coverage
- No blockers for question generation in Plan 02

## Session Continuity

Last session: 2026-02-21
Topic: Phase 24 Plan 01 execution — Generation pipeline configuration for Fremont
Stopped at: Completed 24-01-PLAN.md
Resume file: None

---
*Ready for: Phase 24 Plan 02 (Question Generation & Review)*

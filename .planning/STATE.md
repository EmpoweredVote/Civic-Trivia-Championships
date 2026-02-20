# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Make civic learning fun through game show mechanics -- play, not study
**Current focus:** v1.3 Phase 20 - Admin Exploration UI

## Current Position

Phase: 20 (third of 4 in v1.3: Phases 18-21)
Plan: 01 of 3 (COMPLETE)
Status: In progress
Last activity: 2026-02-20 -- Completed 20-01-PLAN.md

Progress: ███████░░░░░░░░░░░░░ v1.3: 47% (7/15 plans)

**Milestone progress:**
- v1.0 (Phases 1-7): Complete - 50/50 requirements delivered
- v1.1 (Phases 8-12): Complete - 12/12 requirements delivered
- v1.2 (Phases 13-17): Complete - 20/20 requirements delivered
- v1.3 (Phases 18-21): In progress - 9/20 requirements, 6/15 plans

**Deployment Status:**
- Frontend LIVE: https://civic-trivia-frontend.onrender.com
- Backend LIVE: https://civic-trivia-backend.onrender.com
- Database: Supabase EV-Backend-Dev (civic_trivia schema)
- Redis: Upstash (stirred-pika-7510)
- GitHub: EmpoweredVote/Civic-Trivia-Championships

## Performance Metrics

**Velocity:**
- Total plans completed: 59 (26 v1.0 + 11 v1.1 + 15 v1.2 + 7 v1.3)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.3]: Admin auth is security prerequisite -- must ship before any new admin features
- [v1.3]: Telemetry schema early so gameplay data accumulates while building other features
- [v1.3]: Quality rules before admin UI -- UI needs scores to display
- [18-01]: Admin role stored as boolean column (is_admin) rather than roles table for simplicity
- [18-01]: ADMIN_EMAIL env var enables first admin promotion without SQL access
- [18-01]: requireAdmin middleware runs synchronously after authenticateToken
- [18-02]: AdminGuard renders Forbidden component (not redirect) for non-admin users
- [18-02]: Admin access hidden - no nav links to /admin, only Admin pill for admins
- [18-02]: Red color theme (red-900, red-800, red-600) for admin areas vs teal for player experience
- [18-02]: Admin shell uses sidebar + header layout, distinct from player experience
- [18-03]: Use externalId for telemetry to avoid extra DB lookup per answer
- [18-03]: Fire-and-forget pattern ensures telemetry never blocks gameplay
- [18-03]: Atomic SQL increment prevents race conditions from concurrent gameplay
- [19-01]: Ambiguity detection uses Jaccard similarity >70% with civic stop words filtered out
- [19-01]: Pure lookup detection uses allowlist (foundational patterns) and blocklist (obscure indicators)
- [19-01]: Link validation treats timeouts as advisory, hard failures as blocking
- [19-01]: Partisan framing is advisory only with conservative keywords (needs LLM upgrade Phase 21)
- [19-01]: Quality score (0-100) is informational only - hasBlockingViolations flag triggers archival
- [19-02]: quality_score starts as NULL (not 100) - indicates "not yet scored" until audit runs
- [19-02]: Index uses DESC NULLS LAST for efficient admin UI sorting (highest quality first)
- [19-02]: Audit script is reusable with CLI flags (--skip-url-check, --save-scores)
- [19-02]: Console summary includes after-archival counts to predict collection health
- [19-03]: URL validation deferred for existing 320 questions - all have broken source.url links (technical debt)
- [19-03]: Only content-quality violations archived (9 questions: ambiguous answers, pure lookup)
- [19-03]: Collection threshold raised from 10 to 50 to ensure robust gameplay
- [19-03]: Archive script uses soft-delete (status='archived') maintaining database integrity
- [19-03]: Quality scores saved for ALL questions during archive operation (not just archived ones)
- [20-01]: violation_count column stored in DB, populated by audit script (not computed per-row)
- [20-01]: /questions/explore path separate from existing /questions (expired/expiring questions)
- [20-01]: Quality violations computed on-demand in detail endpoint (skipUrlCheck: true)
- [20-01]: NULLS LAST for quality_score sorting surfaces scored questions before unscored
- [20-01]: Question list truncates text to 120 chars, full text available in detail panel
- [20-01]: Collection health uses single aggregated SQL query with FILTER clauses

### Pending Todos

- [ ] Announce v1.2 Community Collections launch (320 total questions live)
- [ ] Invite volunteers to GitHub org
- [ ] Share live URLs with team
- [ ] Add ADMIN_EMAIL environment variable to production backend
- [ ] Update Phase 19 audit script to populate violation_count column when saving quality scores

### Blockers/Concerns

- REQUIREMENTS.md lists 22 requirements but only 20 are defined in the traceability table. Coverage validated against the 20 actual requirements.
- **Technical debt:** All 320 existing questions have broken source.url Learn More links (legacy CMS migration issue). URL validation deferred for existing questions but remains active for Phase 21 new question generation. Needs dedicated URL update phase.
- **Violation count population:** violation_count column added to questions table but currently NULL for all rows. Audit script must be updated to populate this column (outside Phase 20 scope). Question list will show NULL until populated.

## Session Continuity

Last session: 2026-02-20
Topic: Phase 20 Plan 01 execution
Stopped at: Completed 20-01-PLAN.md - Admin API endpoints for exploration UI complete
Resume file: None

---
*v1.3 Question Quality & Admin Tools -- Phase 20 IN PROGRESS (1/3 plans)*

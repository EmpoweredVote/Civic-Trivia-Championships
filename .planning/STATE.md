# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Make civic learning fun through game show mechanics -- play, not study
**Current focus:** v1.3 Phase 21 - Generation Pipeline + New Collections

## Current Position

Phase: 21 (fourth of 5 in v1.3: Phases 18-22) — IN PROGRESS
Plan: 2 of 5 complete
Status: In progress
Last activity: 2026-02-20 -- Completed 21-02-PLAN.md (state generation template and script)

Progress: ████████████████░░░░ v1.3: 80% (12/15 plans)

**Milestone progress:**
- v1.0 (Phases 1-7): Complete - 50/50 requirements delivered
- v1.1 (Phases 8-12): Complete - 12/12 requirements delivered
- v1.2 (Phases 13-17): Complete - 20/20 requirements delivered
- v1.3 (Phases 18-22): In progress - 14/23 requirements, 9/15+ plans

**Deployment Status:**
- Frontend LIVE: https://civic-trivia-frontend.onrender.com
- Backend LIVE: https://civic-trivia-backend.onrender.com
- Database: Supabase EV-Backend-Dev (civic_trivia schema)
- Redis: Upstash (stirred-pika-7510)
- GitHub: EmpoweredVote/Civic-Trivia-Championships

## Performance Metrics

**Velocity:**
- Total plans completed: 64 (26 v1.0 + 11 v1.1 + 15 v1.2 + 12 v1.3)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.3]: Admin auth is security prerequisite -- must ship before any new admin features
- [v1.3]: Telemetry schema early so gameplay data accumulates while building other features
- [v1.3]: Quality rules before admin UI -- UI needs scores to display
- [18-01]: Admin role stored as boolean column (is_admin) rather than roles table for simplicity
- [18-01]: ADMIN_EMAIL env var enables first admin promotion without SQL access
- [18-02]: Red color theme (red-900, red-800, red-600) for admin areas vs teal for player experience
- [18-02]: Admin shell uses sidebar + header layout, distinct from player experience
- [19-01]: Quality score (0-100) is informational only - hasBlockingViolations flag triggers archival
- [19-03]: URL validation deferred for existing 320 questions - all have broken source.url links (technical debt)
- [19-03]: Collection threshold raised from 10 to 50 to ensure robust gameplay
- [20-01]: violation_count column stored in DB, populated by audit script (not computed per-row)
- [20-01]: /questions/explore path separate from existing /questions (expired/expiring questions)
- [20-01]: Quality violations computed on-demand in detail endpoint (skipUrlCheck: true)
- [20-01]: Collection health uses single aggregated SQL query with FILTER clauses
- [20-02]: URL searchParams as single source of truth for filter/sort/page state persistence
- [20-02]: Violations shown BOTH inline on content sections AND in summary section below
- [20-02]: Violation-to-section mapping for inline badges (question/options/explanation/source)
- [20-03]: Health indicator thresholds: red (<50 questions OR <50 quality), yellow (<80 OR <70), green (>=80 AND >=70)
- [20-03]: Click-through from collection card to question table via URL params
- [21-01]: Quality guidelines summarized (200-400 tokens) not full implementations - prevents token bloat in prompts
- [21-01]: Validation-retry loop decoupled via RegenerateFn callback - reusable across generation scripts
- [21-01]: URL validation skipped during generation (skipUrlCheck: true) - batch validate after insertion for speed
- [21-02]: State template 40/30/30 distribution (government/civic processes/broader civics) - avoids "too bureaucratic" feel
- [21-02]: State questions auto-insert as 'active' status - quality-validated questions need no manual review
- [21-02]: Topic distribution exactly 100 questions per state - Indiana and California use identical structure for consistency

### Pending Todos

- [ ] Announce v1.2 Community Collections launch (320 total questions live)
- [ ] Invite volunteers to GitHub org
- [ ] Share live URLs with team
- [ ] Add ADMIN_EMAIL environment variable to production backend
- [ ] Update Phase 19 audit script to populate violation_count column when saving quality scores

### Roadmap Evolution

- Phase 22 added: Admin Question Editing — edit questions inline from detail panel, re-score with quality rules after save

### Blockers/Concerns

- REQUIREMENTS.md lists 22 requirements but only 20 are defined in the traceability table. Coverage validated against the 20 actual requirements.
- **Technical debt:** All 320 existing questions have broken source.url Learn More links (legacy CMS migration issue). URL validation deferred for existing questions but remains active for Phase 21 new question generation.
- **Violation count population:** violation_count column added but currently NULL for all rows. Audit script must be updated to populate this column. Question list will show NULL until populated.

## Session Continuity

Last session: 2026-02-20
Topic: Phase 21 plan 02 execution
Stopped at: Completed 21-02-PLAN.md (state generation template and script)
Resume file: None

---
*v1.3 Question Quality & Admin Tools -- Phase 20 COMPLETE (3/3 plans), Phase 21 next, Phase 22 added*

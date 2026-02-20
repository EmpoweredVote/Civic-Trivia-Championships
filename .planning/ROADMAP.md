# Roadmap: Civic Trivia Championship

## Milestones

- v1.0 MVP - Phases 1-7 (shipped 2026-02-13)
- v1.1 Production Hardening - Phases 8-12 (shipped 2026-02-18)
- v1.2 Community Collections - Phases 13-17 (shipped 2026-02-19)
- v1.3 Question Quality & Admin Tools - Phases 18-22 (in progress)

## Phases

### v1.3 Question Quality & Admin Tools (In Progress)

**Milestone Goal:** Build the quality framework and tooling needed to scale question collections -- codify what makes great civic trivia, audit and improve existing content, create admin tools for exploration and review, enhance the AI pipeline, and add Indiana and California state collections.

- [x] **Phase 18: Foundation (Admin Auth + Telemetry)** - Secure admin access and start collecting gameplay data
- [x] **Phase 19: Quality Rules Engine** - Codify quality rules, audit existing content, remove bad questions
- [x] **Phase 20: Admin Exploration UI** - Question explorer, detail view, collection health dashboard
- [x] **Phase 21: Generation Pipeline + New Collections** - Quality-gated AI pipeline, state templates, Indiana and California collections
- [ ] **Phase 22: Admin Question Editing** - Edit questions inline from the detail panel, re-score with quality rules after save

## Phase Details

### Phase 18: Foundation (Admin Auth + Telemetry)
**Goal**: Admin routes are secured behind role checks and gameplay telemetry data begins accumulating
**Depends on**: Nothing (first phase of v1.3; builds on existing v1.2 infrastructure)
**Requirements**: ADMN-01, ADMN-02, ADMN-03, TELE-01, TELE-02
**Success Criteria** (what must be TRUE):
  1. A user without `is_admin = true` receives 403 when hitting any `/api/admin` endpoint
  2. A non-admin user who navigates to `/admin` in the browser is redirected away
  3. An admin user can access `/admin` pages and API endpoints normally
  4. After a player answers a question in gameplay, that question's encounter_count and correct_count reflect the interaction (verified in database)
  5. Telemetry writes do not block or slow down the answer submission response to the player
**Plans**: 3 plans

Plans:
- [x] 18-01-PLAN.md -- Admin role migration, JWT pipeline update, and requireAdmin middleware
- [x] 18-02-PLAN.md -- Frontend admin route guard, 403 page, and admin shell layout
- [x] 18-03-PLAN.md -- Telemetry columns and fire-and-forget recording

### Phase 19: Quality Rules Engine
**Goal**: Question quality is codified as executable rules, all 320 existing questions are audited, and questions that fail blocking rules are archived
**Depends on**: Phase 18 (admin auth needed for any admin-facing audit reports)
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. Running the quality rules against any question returns a score and a list of violations with severity (blocking vs advisory)
  2. A dry-run audit report exists showing how every one of the 320 existing questions scores against the rules
  3. Questions that fail blocking rules are archived/removed from active rotation and no longer appear in gameplay
  4. Collection sizes remain playable after removals (no collection drops below its minimum viable question count)
**Plans**: 3 plans

Plans:
- [x] 19-01-PLAN.md -- Quality rules service (types, rule functions, scoring, audit runner)
- [x] 19-02-PLAN.md -- DB migration (quality_score column) and dry-run audit script
- [x] 19-03-PLAN.md -- Archive blocking violations and update collection safety threshold

### Phase 20: Admin Exploration UI
**Goal**: Admin users can explore, filter, and inspect questions and collection health through a web interface
**Depends on**: Phase 19 (quality scores needed for display; Phase 18 for auth and telemetry data)
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, TELE-03
**Success Criteria** (what must be TRUE):
  1. Admin can view a paginated table of questions and sort by collection, difficulty, quality score, or telemetry stats
  2. Admin can click a question to see its full text, all options, explanation, Learn More link, quality assessment, and telemetry data
  3. Admin can view a collection health dashboard showing question counts, difficulty distribution, quality score summary, and aggregate telemetry
  4. Calculated difficulty rate (correct_count / encounter_count) is displayed for questions with sufficient data and shows "insufficient data" for questions with fewer than 20 encounters
**Plans**: 3 plans

Plans:
- [x] 20-01-PLAN.md -- Admin API endpoints (question list with filtering/sorting, detail with violations, collection health stats)
- [x] 20-02-PLAN.md -- Question explorer table with search, filters, sorting, pagination, and slide-over detail panel
- [x] 20-03-PLAN.md -- Collection health dashboard with expandable cards and updated admin dashboard

### Phase 21: Generation Pipeline + New Collections
**Goal**: AI generation pipeline rejects bad questions before they enter the database, and Indiana and California state collections are live
**Depends on**: Phase 19 (quality rules needed for pipeline gates), Phase 20 (admin UI available for reviewing generated content)
**Requirements**: GENR-01, GENR-02, GENR-03, QUAL-05, COLL-01, COLL-02
**Success Criteria** (what must be TRUE):
  1. Generated questions are checked against quality rules before database insertion -- questions that fail blocking rules are rejected, not inserted
  2. Quality rules language is embedded in generation prompts so the AI avoids common anti-patterns (phone numbers, pure lookup facts, etc.)
  3. A state-level generation template exists that accounts for state government structures (distinct from the city-level template)
  4. Indiana state collection has 80-100 playable questions visible in the collection picker
  5. California state collection has 80-100 playable questions visible in the collection picker
**Plans**: 5 plans

Plans:
- [x] 21-01-PLAN.md -- Quality guidelines prompt text and validation+retry pipeline
- [x] 21-02-PLAN.md -- State system prompt, Indiana/California configs, and state generation script
- [x] 21-03-PLAN.md -- Generate and review Indiana state collection (80-100 questions)
- [x] 21-04-PLAN.md -- Generate and review California state collection (80-100 questions)
- [x] 21-05-PLAN.md -- Replacement question generation for Phase 19 archival backfill

### Phase 22: Admin Question Editing
**Goal**: Admin can edit questions inline from the detail panel, with automatic quality re-scoring and violation count updates
**Depends on**: Phase 20 (detail panel to extend), Phase 19 (quality rules for re-scoring)
**Requirements**: EDIT-01, EDIT-02, EDIT-03
**Success Criteria** (what must be TRUE):
  1. Admin can toggle the question detail panel into edit mode and modify question text, options, explanation, source URL, and difficulty
  2. Saving an edited question re-runs quality rules and updates quality_score and violation_count in the database
  3. The question table row updates to reflect changes after a successful save without full page reload
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 22 to break down)

## Progress

**Execution Order:**
Phases execute in numeric order: 18 -> 19 -> 20 -> 21 -> 22

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. Foundation (Admin Auth + Telemetry) | 3/3 | Complete | 2026-02-19 |
| 19. Quality Rules Engine | 3/3 | Complete | 2026-02-19 |
| 20. Admin Exploration UI | 3/3 | Complete | 2026-02-20 |
| 21. Generation Pipeline + New Collections | 5/5 | Complete | 2026-02-20 |
| 22. Admin Question Editing | 0/? | Not started | - |

## Coverage

**v1.3 Requirements: 23/23 mapped**

| Requirement | Phase |
|-------------|-------|
| ADMN-01 | 18 |
| ADMN-02 | 18 |
| ADMN-03 | 18 |
| TELE-01 | 18 |
| TELE-02 | 18 |
| QUAL-01 | 19 |
| QUAL-02 | 19 |
| QUAL-03 | 19 |
| QUAL-04 | 19 |
| EXPL-01 | 20 |
| EXPL-02 | 20 |
| EXPL-03 | 20 |
| EXPL-04 | 20 |
| TELE-03 | 20 |
| GENR-01 | 21 |
| GENR-02 | 21 |
| GENR-03 | 21 |
| QUAL-05 | 21 |
| COLL-01 | 21 |
| COLL-02 | 21 |
| EDIT-01 | 22 |
| EDIT-02 | 22 |
| EDIT-03 | 22 |

No orphaned requirements. No duplicate mappings.

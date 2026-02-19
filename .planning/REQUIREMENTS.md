# Requirements: Civic Trivia Championship v1.3

**Defined:** 2026-02-19
**Core Value:** Make civic learning fun through game show mechanics — play, not study

## v1.3 Requirements

### Admin Foundation

- [ ] **ADMN-01**: Admin role column (`is_admin`) on users table with migration
- [ ] **ADMN-02**: Admin role-check middleware protecting all `/api/admin` routes
- [ ] **ADMN-03**: Frontend admin route guard (redirect non-admins away from `/admin`)

### Question Quality Rules

- [ ] **QUAL-01**: Codified quality rules as TypeScript functions (dinner party test, civic utility, no pure lookup facts, reasoning possible)
- [ ] **QUAL-02**: Two-tier rule severity — blocking rules (auto-flag for removal) vs advisory rules (flag for review)
- [ ] **QUAL-03**: Dry-run audit of all 320 existing questions against quality rules with report
- [ ] **QUAL-04**: Remove/archive questions that fail blocking rules
- [ ] **QUAL-05**: Generate replacement questions to maintain collection sizes

### Admin Exploration UI

- [ ] **EXPL-01**: Sortable, filterable question table (by collection, difficulty, quality score, telemetry stats)
- [ ] **EXPL-02**: Question detail view showing full question, options, explanation, Learn More, and metadata
- [ ] **EXPL-03**: Collection health dashboard (question counts, difficulty distribution, quality scores, telemetry summary)
- [ ] **EXPL-04**: Admin API endpoints for question listing, detail, and collection health

### Telemetry

- [ ] **TELE-01**: `encounter_count` and `correct_count` columns on questions table
- [ ] **TELE-02**: Increment counters during gameplay (fire-and-forget on answer submission)
- [ ] **TELE-03**: Calculated difficulty rate (correct/encounters) displayed in admin UI

### AI Generation Pipeline

- [ ] **GENR-01**: Quality rules integrated into generation prompts (prevent bad questions at creation)
- [ ] **GENR-02**: Post-generation validation script that runs quality rules on generated batches
- [ ] **GENR-03**: State-level generation template (distinct from city-level — different government structures)

### New Collections

- [ ] **COLL-01**: Indiana state question collection (~80-100 questions)
- [ ] **COLL-02**: California state question collection (~80-100 questions)

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Multiplayer & Live Features

- **MULT-01**: Team/multiplayer game mode
- **MULT-02**: Real-time WebSocket game features
- **MULT-03**: Wits & Wagers-style numeric/date answer questions (spectrum display, closest wins)

### Advanced Analytics

- **ANLY-01**: Auto-difficulty calibration based on telemetry data
- **ANLY-02**: Distractor analysis (which wrong answers get picked most)
- **ANLY-03**: Quality trend tracking over time

### Content Scaling

- **SCAL-01**: Volunteer question authoring portal
- **SCAL-02**: Collection search/browse (when enough collections exist)
- **SCAL-03**: Location-based auto-assignment of collections

## Out of Scope

| Feature | Reason |
|---------|--------|
| Granular admin permissions (editor, reviewer roles) | Only a few admins for now; boolean is_admin sufficient |
| Public-facing admin UI | Admin is internal dev/author tool only |
| Real-time telemetry dashboard | Batch/on-demand stats sufficient at current scale |
| Dynamic rule loading / rule editor UI | Rules are TypeScript functions maintained by devs |
| Question editing in admin UI | Read-only explorer for v1.3; edit via scripts/DB |
| Automated question approval | Automated checks are gatekeepers, not approvers — human review required |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADMN-01 | Phase 18 | Complete |
| ADMN-02 | Phase 18 | Complete |
| ADMN-03 | Phase 18 | Complete |
| TELE-01 | Phase 18 | Complete |
| TELE-02 | Phase 18 | Complete |
| QUAL-01 | Phase 19 | Pending |
| QUAL-02 | Phase 19 | Pending |
| QUAL-03 | Phase 19 | Pending |
| QUAL-04 | Phase 19 | Pending |
| EXPL-01 | Phase 20 | Pending |
| EXPL-02 | Phase 20 | Pending |
| EXPL-03 | Phase 20 | Pending |
| EXPL-04 | Phase 20 | Pending |
| TELE-03 | Phase 20 | Pending |
| GENR-01 | Phase 21 | Pending |
| GENR-02 | Phase 21 | Pending |
| GENR-03 | Phase 21 | Pending |
| QUAL-05 | Phase 21 | Pending |
| COLL-01 | Phase 21 | Pending |
| COLL-02 | Phase 21 | Pending |

**Coverage:**
- v1.3 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after roadmap creation*

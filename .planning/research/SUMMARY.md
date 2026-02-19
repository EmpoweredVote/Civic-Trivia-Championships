# Project Research Summary

**Project:** Civic Trivia Championship v1.3 -- Question Quality & Admin Tools
**Domain:** Civic education trivia -- internal quality tooling and admin infrastructure
**Researched:** 2026-02-19
**Confidence:** HIGH

## Executive Summary

v1.3 layers quality infrastructure and admin visibility onto a stable, deployed trivia game (320 questions, 3 collections, React/Express/PostgreSQL stack). The existing codebase already has admin route scaffolding, JWT auth, Drizzle ORM schema management, and AI generation scripts -- so this milestone is about extension, not creation. The recommended approach: add telemetry counters to track question performance, codify quality rules as pure TypeScript functions, expand the admin UI into a full question explorer with filtering and detail views, and wire quality gates into the AI generation pipeline. Only one new dependency is needed: `@tanstack/react-table` for the admin data tables. Zero new backend packages.

The three most important insights from research are: (1) Question quality has three distinct dimensions -- static (rule-based), perceived (human judgment), and empirical (gameplay data) -- and conflating them leads to false confidence in content quality. Automated rules are gatekeepers, not approvers; human review remains mandatory. (2) Retroactive quality enforcement is the highest-risk activity in this milestone. Running new rules against 320 existing questions could flag 40-60% of them, potentially breaking collections below playable thresholds. The mitigation is a dry-run audit before finalizing any rules, with a two-tier system (blocking vs. advisory). (3) The admin routes currently have NO role-based authorization -- any authenticated user can hit `/api/admin/*`. Adding an `is_admin` column and `requireAdmin` middleware is a security prerequisite before shipping any new admin features.

The work naturally decomposes into five phases ordered by dependency: foundation (auth + telemetry schema), quality rules engine, admin UI, generation pipeline enhancement, and feedback loops. Telemetry data collection should start early because empirical quality metrics require gameplay data to accumulate over time -- every day of delay is data you never get back.

## Key Findings

### Recommended Stack

The existing stack handles all v1.3 requirements with minimal additions. The project runs React 18, TypeScript, Tailwind, Headless UI, Express, Drizzle ORM, PostgreSQL (Supabase), and Zod. The only recommended frontend addition is `@tanstack/react-table` (v8.21.3, ~14KB gzipped) for headless table state management (sorting, filtering, pagination) that integrates with the existing Tailwind patterns. The backend needs zero new packages -- Drizzle ORM handles composable query building, Zod handles input validation, and quality rules are pure TypeScript functions.

**Core technologies:**
- `@tanstack/react-table` (NEW): Headless table engine for admin data tables -- replaces hand-rolled table markup in Admin.tsx with sortable, filterable, paginated tables
- `drizzle-orm` (EXISTING): Schema migration for new telemetry columns, composable server-side queries for admin API
- Pure TypeScript (NO LIBRARY): Quality rules engine as typed predicate functions -- 10-20 rules do not justify a rules engine library
- PostgreSQL atomic increments (EXISTING): `SET encounter_count = encounter_count + 1` for concurrent-safe telemetry

**Explicitly not adding:** react-admin, Chart.js/Recharts, lodash, React Hook Form, json-rules-engine, BullMQ, separate analytics database. Each was evaluated and rejected with clear rationale in STACK.md.

### Expected Features

**Must have (table stakes):**
- TS-1: Quality rules engine -- codified rules producing scores and violation lists, the foundation everything depends on
- TS-2: Admin question explorer -- paginated table with collection/topic/difficulty/status filters, sortable columns, text search
- TS-3: Question detail inspector -- full question preview, metadata, quality assessment, source verification display
- TS-4: Collection health dashboard -- quality distribution, difficulty balance, expiration forecasts, topic coverage

**Should have (differentiators):**
- D-1: Content telemetry -- per-question encounter/correct counters, P-value (difficulty index), distractor selection rates
- D-2: Difficulty calibration feedback -- flag questions whose empirical difficulty diverges from labeled difficulty
- D-3: AI pipeline quality gates -- post-generation quality check that rejects/flags questions before database insertion
- D-4: Human review workflow -- draft/review/active/rejected status lifecycle with admin UI actions
- D-5: Source URL verification -- automated weekly link checks on question source URLs

**Defer (v2+):**
- Full CMS with inline question editing (AF-1) -- keep admin read-only for content, write-only for status
- Real-time analytics dashboard (AF-2) -- batch-computed metrics refreshed daily are sufficient
- A/B testing for question variants (AF-3) -- massive complexity for 320 questions
- AI auto-improvement without human review (AF-4) -- "copilot not autopilot" for civic education content
- Complex RBAC (AF-5) -- single admin role is sufficient for a small team
- ML difficulty prediction (AF-6) -- empirical telemetry will be more reliable once data accumulates

### Architecture Approach

The architecture extends the existing admin infrastructure (routes, pages, hooks) rather than creating new systems. Telemetry is two integer columns on the `questions` table with fire-and-forget atomic increments in the answer handler. The admin UI expands from a single page to nested routes (`/admin/questions`, `/admin/questions/:id`, `/admin/collections`, `/admin/quality`) within the existing React app using an `AdminRoute` guard. Quality rules live as a pure TypeScript service called from admin API endpoints, generation scripts, and batch CLI tools.

**Major components:**
1. **Admin authorization layer** -- `is_admin` column on users table, `requireAdmin` middleware, `AdminRoute` frontend guard. Security prerequisite for all other work.
2. **Telemetry capture service** -- `telemetryService.ts` with fire-and-forget `recordQuestionOutcome()` called from the answer handler. Derived `correct_rate` computed at query time, never stored.
3. **Quality rules engine** -- `qualityRules.ts` as pure functions evaluating questions against ~15-20 rules across stem quality, distractor quality, civic content quality, and difficulty consistency. Returns `{ score, violations[], passesMinimumBar }`.
4. **Admin question explorer** -- `@tanstack/react-table` powered data table with server-side pagination, multi-column filtering via Drizzle ORM composable queries, and question detail views with telemetry and quality data.
5. **AI generation quality gate** -- Post-generation validation step in existing scripts: generate -> Zod validate -> quality rules check -> insert or reject.

### Critical Pitfalls

1. **Retroactive quality rules fail most existing questions** -- Run a dry-run audit against all 320 questions BEFORE finalizing rules. Use two-tier severity: "blocking" rules (phone numbers, duplicate options) auto-flag; "advisory" rules (dinner party test, civic utility) track but do not archive. If any rule flags >20% of a collection, the rule is too broad.

2. **Telemetry counter contention on questions table** -- The questions table is read-heavy for game queries. Adding frequent UPDATEs during gameplay creates write pressure on hot rows. Use fire-and-forget (never await telemetry in the response path). At current scale (~100 writes/day) inline counters are acceptable, but monitor for latency increases and be prepared to migrate to a separate `question_stats` table if concurrent players exceed ~20.

3. **AI content passes automated checks but fails human review** -- Automated rules verify form, not substance. The most important quality dimensions (civic utility, engagement, fairness of distractors) require human judgment. Budget human review time as mandatory, not optional. Track the gap between automated pass rate and human approval rate -- if >15%, the automated rules need revision.

4. **Admin routes lack role-based authorization** -- Any authenticated user can currently access `/api/admin/*`. Add `is_admin` column and `requireAdmin` middleware BEFORE shipping any new admin endpoints. Check `is_admin` from the database per-request (not from JWT) so revoking access takes effect immediately.

5. **Test/dev data pollutes production telemetry** -- Gate telemetry writes on `NODE_ENV === 'production'` from day one. Display "insufficient data" in admin UI for questions with <20 encounters. Provide a counter-reset mechanism for pre-launch cleanup.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Auth + Telemetry Schema)
**Rationale:** Admin authorization is a security prerequisite for all admin features. Telemetry schema must exist before any counters can be recorded, and data collection should start as early as possible because empirical quality metrics require accumulated gameplay data.
**Delivers:** Secure admin access control; telemetry counter columns on questions table; fire-and-forget telemetry recording in answer handler; environment-gated writes.
**Addresses:** Admin authorization gap (Architecture finding), D-1 telemetry data collection start
**Avoids:** Pitfall #4 (no role check on admin routes), Pitfall #6 (test data pollution)

### Phase 2: Quality Rules Engine
**Rationale:** Quality rules are the keystone -- the admin UI needs them for score display, the AI pipeline needs them for gates, and the health dashboard needs them for aggregates. Must be built and dry-run tested against existing content before any downstream features.
**Delivers:** `qualityRules.ts` service with ~15-20 rules; dry-run report on all 320 existing questions; calibrated scoring thresholds (100-point scale); two-tier rule severity system.
**Addresses:** TS-1 (quality rules engine), calibration of blocking vs. advisory rules
**Avoids:** Pitfall #1 (retroactive rules breaking collections), Pitfall #5 (rules becoming stale -- rules live in code with version history)

### Phase 3: Admin UI (Explorer + Detail + Health)
**Rationale:** With auth in place and quality rules defined, the admin UI can display everything: questions with filters, quality scores, telemetry data, and collection health. This is the largest phase by effort but has well-documented patterns (data tables, server-side pagination).
**Delivers:** Question explorer with multi-filter data table; question detail inspector with quality assessment and telemetry; collection health dashboard with quality distribution and difficulty balance; admin navigation structure.
**Uses:** `@tanstack/react-table` (new install), Headless UI for filter dropdowns, existing Tailwind patterns
**Implements:** Admin question explorer (TS-2), question detail (TS-3), collection health (TS-4)
**Avoids:** Pitfall #8 (raw database view -- design for content authors, externalId as primary identifier)

### Phase 4: AI Pipeline Quality Gates + Review Workflow
**Rationale:** With quality rules tested and the admin UI available for reviewing flagged content, the AI pipeline can be enhanced with quality gates and the human review workflow can be implemented. These are the final pieces that close the content quality loop.
**Delivers:** Post-generation quality validation in generation scripts; draft/review/active/rejected status lifecycle; review actions in admin UI; source URL link checking.
**Addresses:** D-3 (pipeline gates), D-4 (review workflow), D-5 (source verification)
**Avoids:** Pitfall #3 (AI passes checks but fails human review -- review workflow makes human judgment explicit and trackable)

### Phase 5: Feedback Loops (After Data Accumulates)
**Rationale:** Difficulty calibration and quality trend tracking require accumulated telemetry data from real gameplay. These features are low-effort once the data infrastructure exists but meaningless without sufficient sample sizes (~30+ encounters per question).
**Delivers:** Difficulty calibration flags (labeled vs. empirical difficulty mismatch); quality score trend tracking over time.
**Addresses:** D-2 (difficulty calibration), D-6 (quality trends)

### Phase Ordering Rationale

- **Auth before everything** because shipping admin features without role checks is a security vulnerability, not just technical debt.
- **Telemetry schema early** because every day without counters is gameplay data you never recover. The columns and capture code are small work items with outsized long-term value.
- **Quality rules before admin UI** because the admin UI needs quality scores to display. Building the UI first means retrofitting quality display later.
- **Admin UI before pipeline gates** because reviewing flagged AI content requires a place to review it. The admin UI is the review surface.
- **Feedback loops last** because they depend on data accumulation, not code. They can ship weeks after telemetry starts, once enough gameplay data exists.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Quality Rules):** The dry-run against 320 existing questions will reveal whether proposed rules are calibrated correctly. Expect rule adjustments based on results. The scoring model (100-point, -25/-10/-3 penalties) is a starting proposal that needs empirical validation.
- **Phase 3 (Admin UI):** The admin UI restructure from a single page to nested routes with tabs requires careful planning of the component hierarchy and data flow. TanStack Table integration patterns need prototyping.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Adding a boolean column, middleware function, and atomic counter increment are well-documented patterns with no ambiguity.
- **Phase 4 (Pipeline Gates):** Extending the existing generation script with a validation step follows the established script pattern. Status lifecycle transitions are straightforward CRUD.
- **Phase 5 (Feedback Loops):** Simple derived metrics from existing telemetry data. Standard aggregation queries.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack verified by codebase analysis. One new dependency with clear rationale. All alternatives evaluated and rejected. |
| Features | MEDIUM-HIGH | Table stakes well-established from item-writing literature (Haladyna) and CMS patterns. Differentiators informed by CTT psychometrics. Effort estimates are approximate. |
| Architecture | HIGH | Every integration point identified by direct file-level analysis. Build order respects verified dependencies. Auth gap confirmed by reading middleware code. |
| Pitfalls | HIGH | Critical pitfalls (retroactive rules, telemetry contention, auth gap) confirmed by codebase analysis. Recovery strategies provided for each. |

**Overall confidence:** HIGH

### Gaps to Address

- **Quality rule threshold calibration:** The 100-point scoring model with -25/-10/-3 penalties is a starting proposal. Must be calibrated by running against existing 320 questions and examining the score distribution. Handle during Phase 2.
- **Minimum sample size for reliable telemetry:** CTT literature suggests 30+ responses per question for stable P-values. At current play volume, how long will it take to reach 30 encounters per question? This determines when Phase 5 feedback loops become actionable. Monitor during Phase 1 deployment.
- **Telemetry contention threshold:** Inline counters on the questions table are acceptable at current scale but the exact concurrency threshold where contention becomes problematic (~20 concurrent games) is an estimate. Monitor answer endpoint latency after Phase 1 deployment; have the separate `question_stats` table migration ready as a contingency.
- **State-level content scaling:** State collections (Indiana, California) need separate locale config templates and topic taxonomies distinct from city-level patterns. This is flagged in PITFALLS.md but is outside v1.3 scope -- address before any state-level content generation.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all backend routes, services, middleware, schema, and frontend components
- `@tanstack/react-table` official documentation and npm registry (v8.21.3)
- Drizzle ORM documentation for migration and query composition patterns
- PostgreSQL atomic increment documentation for concurrent counter safety
- Haladyna et al. MC item-writing guidelines -- foundational taxonomy for quality rule categories
- Classical Test Theory item statistics (assess.com) -- P-value, discrimination index definitions and thresholds

### Secondary (MEDIUM confidence)
- PostgreSQL concurrent counter patterns (Cybertec, async counter architecture)
- QUEST Framework (Springer 2025) -- LLM-generated MCQ quality dimensions; recent but peer-reviewed
- AI content quality evaluation (Walturn, Clarivate) -- automated vs. human review gap analysis
- LiveLike Trivia CMS documentation -- CMS feature patterns for trivia platforms
- Moodle Question Bank -- tag-based filtering and item analysis patterns

### Tertiary (LOW confidence)
- Implementation effort estimates -- based on codebase structure, actual velocity may differ
- Telemetry contention threshold (~20 concurrent games) -- estimated, not measured
- Quality rule pass/fail rate predictions for existing content -- estimated, needs dry-run validation

---
*Research completed: 2026-02-19*
*Ready for roadmap: yes*

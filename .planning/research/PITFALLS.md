# Domain Pitfalls: v1.3 Quality Framework, Admin UI, Telemetry & Content Scaling

**Researched:** 2026-02-19
**Domain:** Adding question quality rules, admin exploration UI, telemetry tracking, and state-level content scaling to existing deployed civic trivia game (v1.2 with 320 questions across 3 collections)
**Confidence:** HIGH (codebase analysis, pattern matching from v1.2 pitfalls) / MEDIUM (telemetry scaling, AI quality gap)

## Executive Summary

This milestone adds internal tooling and quality infrastructure to a working consumer product. The most dangerous pattern here is **retroactive quality enforcement** -- applying new quality rules to 320 existing questions and discovering half of them fail (the phone number question that triggered this work is the tip of the iceberg). The second most dangerous is **telemetry counter contention on the questions table** -- adding `encounter_count` and `correct_count` columns to the same table that serves game queries creates write pressure on hot rows. The admin UI carries lower risk but has a classic integration pitfall: bolting an internal tool onto a consumer app's auth and routing without proper separation.

Unlike v1.2 which changed data architecture (JSON to database), this milestone layers new capabilities onto a stable system. The primary risk is degradation of the existing experience through well-intentioned additions.

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or trust damage.

### 1. Retroactive Quality Rules Fail Most Existing Questions

**What goes wrong:** The team codifies quality rules (the "dinner party test", civic utility requirement, no pure lookup facts, no phone numbers). Then runs the rules against the existing 320 questions and discovers 40-60% fail at least one rule. Now what? Bulk-archive questions and break collection minimum thresholds? Grandfather existing questions and undermine the rules? Spend weeks manually reviewing every question?

**Why it happens:** Quality rules are designed with the worst examples in mind (the phone number question). But those rules, when applied broadly, catch far more than intended. "No pure lookup facts" might flag "How many members are on the Bloomington City Council?" -- which is actually a fine question. "Civic utility" is subjective. Rules that seem clear when written become ambiguous when applied to edge cases at scale.

**Consequences:** Either the quality rules are weakened to avoid mass failures (defeating the purpose), or dozens of questions are flagged/archived and collections drop below playable thresholds. The Bloomington collection (which likely has ~40-60 questions) could lose enough questions to become unplayable if rules are applied strictly.

**Warning signs:**
- Quality rules written without testing against a sample of existing questions first
- More than 30% of existing questions fail the initial rule check
- Rules contain subjective criteria without concrete examples of pass/fail
- No "severity" or "advisory vs blocking" distinction in rules
- Collection question counts drop below 30 after quality filtering

**Prevention:**
- **Audit before codifying:** Run proposed rules against ALL 320 existing questions as a dry run before finalizing the rules. Use the results to calibrate rule strictness
- **Two-tier rules:** "Blocking" rules (phone numbers, factually wrong answers, multiple correct answers) auto-flag for immediate removal. "Advisory" rules (dinner party test, civic utility) flag for review but do not auto-archive
- **Grandfather clause for v1.2 content:** Existing questions that pass blocking rules remain active. Advisory rule violations are tracked but not acted on until replacement questions are available
- **Rule-per-rule impact analysis:** Before adding each rule, count how many existing questions it would flag. If a rule flags >20% of a collection, the rule is too broad or needs refinement
- **Living rules with version history:** Each quality rule gets a version number and effective date. "Questions created before rule v2 are evaluated under rule v1 unless manually upgraded"

**Phase to address:** Quality framework phase -- dry run against existing content as the FIRST task, before finalizing rules

**Source confidence:** HIGH -- Direct analysis of existing question schema (`C:/Project Test/backend/src/db/schema.ts`) and content generation prompt (`system-prompt.ts`) which has minimal quality guardrails beyond structure validation

---

### 2. Telemetry Counters Create Hot Row Contention on Questions Table

**What goes wrong:** Adding `encounter_count` and `correct_count` columns directly to the `questions` table means every answer submission triggers an UPDATE on a question row. In a 10-question game with 50 concurrent players, that is 500 UPDATEs hitting the questions table in rapid succession. Popular questions (especially in the federal collection with 120 questions serving as default) become hot rows. PostgreSQL row-level locks cause write contention. Game response times degrade. The `/answer` endpoint, which currently returns in <100ms, starts taking 500ms+ due to lock waits.

**Why it happens:** The simplest telemetry implementation is `UPDATE questions SET encounter_count = encounter_count + 1 WHERE id = $1`. This is correct for low concurrency but creates contention when many concurrent sessions answer the same popular question. The existing `questions` table is read-heavy (game queries via `selectQuestionsForGame`). Adding frequent writes to the same table pollutes the read path.

**Consequences:** Game performance degrades during peak usage. The `/answer` endpoint -- the most latency-sensitive endpoint in the app (players waiting for score feedback) -- slows down. In extreme cases, database connection pool exhaustion as connections wait for row locks. Supabase free/pro tier connection limits (around 60 direct connections) become a bottleneck.

**Warning signs:**
- Answer submission latency increases after deploying telemetry
- PostgreSQL `pg_stat_activity` shows `waiting` states on questions table UPDATEs
- Connection pool utilization spikes during peak play times
- `selectQuestionsForGame` queries slow down (competing with telemetry writes for table locks)

**Prevention:**
- **Separate telemetry table:** Create a `question_stats` table with `question_id`, `encounter_count`, `correct_count`, and `updated_at`. JOIN when needed for admin queries. Never write to the `questions` table during gameplay
- **Async counter updates:** Do not UPDATE synchronously in the `/answer` handler. Instead, INSERT into a lightweight `answer_events` table (append-only, no contention) and aggregate periodically via a background job or PostgreSQL materialized view
- **Batch aggregation:** A cron job (the project already has `cron/expirationSweep.ts` as precedent) runs every 5 minutes to aggregate `answer_events` into `question_stats`. This converts 500 concurrent writes into one batch UPDATE
- **If direct counters are chosen:** Use PostgreSQL's `SET encounter_count = encounter_count + 1` (atomic increment) and ensure the `questions` table has `fillfactor = 70` to enable HOT (Heap Only Tuple) updates, reducing index bloat
- **Never block the answer response on telemetry:** The counter UPDATE must be fire-and-forget from the answer handler's perspective. If the counter fails, the game continues normally

**Phase to address:** Telemetry phase -- architecture decision (separate table vs inline counters) must happen before implementation

**Source confidence:** HIGH -- Based on existing schema analysis showing questions table serves read-heavy game queries, combined with PostgreSQL hot row contention patterns documented at [Cybertec](https://www.cybertec-postgresql.com/en/how-to-count-hits-on-a-website-in-postgresql/) and [async counter approach](https://medium.com/@timanovsky/ultra-fast-asynchronous-counters-in-postgres-44c5477303c3). The cron pattern already exists in the codebase at `C:/Project Test/backend/src/cron/expirationSweep.ts`

---

### 3. AI Content Passes Automated Quality Checks But Fails Human Review

**What goes wrong:** The content generation pipeline already has Zod schema validation (`question-schema.ts`) that checks structure: 4 options, correct answer index 0-3, explanation contains "According to", source URL is valid. New quality rules add automated checks: no phone numbers in answers, minimum explanation length, difficulty distribution. AI-generated questions pass ALL these automated checks while still being bad questions. Examples:
- "What year was the Indiana State Constitution ratified?" -- passes all structural checks, fails "dinner party test" (boring lookup fact)
- "According to the Indiana government website, the state bird is the Cardinal." -- passes citation check, fails civic utility (not civic content)
- Question with four answer options where two are plausibly correct -- passes 4-option check, fails fairness test

**Why it happens:** Automated checks verify form, not substance. The quality rules that matter most (dinner party test, civic utility, no questions with arguable answers) are inherently subjective and require human judgment. LLMs are excellent at producing content that satisfies machine-readable constraints while missing the spirit of those constraints. An LLM evaluating another LLM's output replicates the same blind spots.

**Consequences:** Content that technically passes the quality pipeline ships to users but creates a mediocre experience. Worse, the team develops false confidence ("it passed all quality checks") and reduces human review. Quality slowly degrades as the automated pipeline produces more content with less oversight.

**Warning signs:**
- Automated quality pass rate is suspiciously high (>95% of AI-generated questions pass)
- Human reviewers still reject 20-30% of "passing" questions for subjective reasons
- Generated questions are structurally diverse but topically repetitive
- "According to" citations are technically present but cite overly generic pages
- Players report questions feel "samey" or "boring" despite passing quality checks

**Prevention:**
- **Automated checks are gatekeepers, not approvers:** Automated rules filter out obviously bad content (structural failures, phone numbers, missing sources). They do NOT certify content as good. Every question still requires human review
- **Stratified review approach:** Automated checks catch ~30% of bad questions (structural failures). Human review catches the remaining ~70% (subjective quality). Budget human review time accordingly -- it is NOT optional
- **Quality rule examples, not just definitions:** For each subjective rule (dinner party test, civic utility), provide 3 PASS examples and 3 FAIL examples. These examples become the real quality standard, not the rule text
- **LLM-as-evaluator with explicit limitations:** If using an LLM to pre-screen for human reviewers, give it the pass/fail examples and ask it to rate questions. But treat LLM ratings as "triage" (priority for human review), not as pass/fail decisions
- **Track the gap:** Measure what percentage of automated-passing questions get rejected by human reviewers. If the gap stays above 15%, the automated rules need revision -- they are not catching what matters

**Phase to address:** Quality framework phase -- define the human review workflow ALONGSIDE the automated rules, not as an afterthought

**Source confidence:** MEDIUM -- Based on [AI quality evaluation research from Walturn](https://www.walturn.com/insights/evaluating-ai-generated-content) and [Clarivate evaluation best practices](https://clarivate.com/academia-government/blog/evaluating-the-quality-of-generative-ai-output-methods-metrics-and-best-practices/) noting that automated metrics miss factual accuracy and contextual relevance. Applied specifically to the project's existing Zod validation pipeline

---

### 4. Admin UI Shares Auth/Routing with Consumer App, Creating Coupling

**What goes wrong:** The existing admin routes (`/api/admin/*` in `routes/admin.ts`) use the same JWT `authenticateToken` middleware as the consumer app. The new admin exploration UI needs richer capabilities: browse ALL questions, filter by quality score, view telemetry stats, approve/reject content. Building this as new routes on the existing Express server and a new React page in the consumer app creates tight coupling. Deploying admin UI changes risks breaking the consumer game. Admin-specific database queries (full table scans for exploration) compete for the same connection pool as game queries. Admin bugs (uncaught exception in a new route) crash the entire server.

**Why it happens:** Adding admin routes to the existing server is the path of least resistance. The auth system already works. The database connection is already configured. Building a separate admin app feels like over-engineering for an internal tool used by 2-3 people.

**Consequences:** Admin exploration queries (scanning 320+ questions with joins for stats) slow down game queries during active play. An admin query that accidentally does a full table scan locks rows needed by the game. Admin UI bugs crash the production server. Admin auth changes (adding roles/permissions) require changes to consumer auth middleware.

**Warning signs:**
- Admin routes added to the same Express `server.ts` file as game routes
- Admin queries do not have separate connection pool or query timeout limits
- Admin UI components imported into the consumer React app bundle (increases bundle size for all users)
- A bug in admin code returns 500 on game endpoints
- Admin "browse all questions" query runs without pagination or LIMIT

**Prevention:**
- **Separate route module with error isolation:** The existing pattern (`routes/admin.ts` with `router.use(authenticateToken)`) is acceptable for v1.3's scope (internal tool for 2-3 devs). BUT: wrap all admin route handlers in try/catch that NEVER propagates to the main Express error handler. Admin failures return 500 on admin routes only
- **Query guardrails for admin endpoints:** All admin exploration queries MUST have `LIMIT` and pagination. No unbounded SELECTs. Add query timeout (`SET statement_timeout = '5000'`) for admin queries specifically
- **Separate frontend entry point:** Do NOT add admin UI components to the consumer React app. Create a separate route (e.g., `/admin`) that loads a separate bundle. This can be a separate Vite entry point or even a separate mini-app. Consumer bundle size stays unchanged
- **Connection pool awareness:** If using Supabase with limited connections, admin queries should use a separate connection string or at minimum use `SET idle_in_transaction_session_timeout` to avoid holding connections
- **Do NOT add admin role to JWT yet:** For v1.3, admin access can be gated by a simple allowlist of user IDs checked in middleware. Role-based access control is a v1.4 concern. Keep it simple

**Phase to address:** Admin UI phase -- architecture decision (separate entry point vs embedded in consumer app) must happen before building any UI

**Source confidence:** HIGH -- Direct analysis of existing `routes/admin.ts` showing it already uses `authenticateToken` middleware and runs on the same Express server. Pattern confirmed by examining `server.ts` mount points

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded experience.

### 5. Quality Rules Document Becomes Stale or Ignored

**What goes wrong:** Quality rules start as a carefully crafted living document. Six months later, new question types exist that the rules do not address. Edge cases accumulate ("Does this count as a lookup fact?"). Nobody updates the rules because the document lives in a planning folder and is not integrated into the workflow. New content creators have not read the rules. The rules say one thing, the automated checks enforce a subset, and human reviewers apply their own interpretation.

**Why it happens:** Rules are written as a document, not encoded as a process. There is no forcing function that requires engagement with the rules during content creation or review. The rules evolve informally through Slack conversations and verbal agreements that never get written down.

**Warning signs:**
- Quality rules document has not been updated in 60+ days
- Different reviewers give different pass/fail judgments on the same question
- Content creators ask "where are the rules?" or "did this rule change?"
- Automated checks diverge from the written rules (rules updated but checks not, or vice versa)
- New rule added verbally ("we decided no geography questions") never written down

**Prevention:**
- **Rules live next to the code, not in a planning folder:** Quality rules should be in a machine-readable format (JSON/YAML) in the repository, with human-readable descriptions. Changes go through pull requests, creating a version history
- **Automated checks must map to documented rules:** Each automated quality check function should reference the specific rule it implements (e.g., `// Implements QUALITY_RULE_003: No phone numbers in question text or options`). If a rule has no automated check, it is explicitly marked as "human review only"
- **Review checklist generated from rules:** The admin UI review workflow should present the current quality rules as a checklist. Reviewer must explicitly mark each subjective rule as pass/fail for every question
- **Quarterly rule review cadence:** Schedule a recurring task to review rules against recent content decisions. Add new rules for newly-discovered failure modes. Retire rules that no longer apply
- **Example library grows with the rules:** Every time a question is rejected or accepted for a subjective rule, add it to the examples for that rule. The examples become the ground truth

**Phase to address:** Quality framework phase -- rule storage format and integration with review workflow

**Source confidence:** MEDIUM -- General content governance patterns applied to this specific domain

---

### 6. Telemetry Data Skewed by Development and Testing Activity

**What goes wrong:** Developers testing the game locally increment `encounter_count` and `correct_count` on questions. QA runs automated tests that answer all questions correctly. Before launch, question stats show 50 encounters and 100% correct rate on some questions -- all from internal testing. Real player data gets mixed with test data. Analytics are unreliable from day one.

**Why it happens:** Telemetry is added to the answer submission handler without any filtering for environment or user type. The same code path runs in development, staging, and production. No mechanism to distinguish real gameplay from testing.

**Consequences:** Initial analytics are meaningless. Questions that appear "too easy" (100% correct from testing) get flagged for difficulty adjustment when they are actually fine. Questions that appear heavily-played (high encounter count from load testing) get deprioritized for new players when they should not be. Incorrect data leads to incorrect content decisions.

**Warning signs:**
- Questions have non-zero encounter_count before public launch
- Correct rate is exactly 100% or 0% on multiple questions (testing artifact)
- Encounter counts spike in patterns matching deployment times, not player activity
- Development environment writes to production telemetry tables

**Prevention:**
- **Environment-aware telemetry:** Telemetry writes ONLY in production. Check `NODE_ENV === 'production'` before incrementing counters. In development/staging, log the would-be increment instead
- **Exclude known test users:** Filter out encounters from users in a `test_users` allowlist. Or better: anonymous sessions in development never write telemetry
- **Telemetry reset mechanism:** Ability to zero out stats for a specific question or all questions. Run before public launch to clear testing data
- **Separate dev and prod Supabase instances:** If not already done, development should use a separate database entirely. This is the most robust prevention
- **Minimum sample size for analytics:** Do not act on telemetry data until a question has 20+ real encounters. Display "insufficient data" in admin UI below that threshold

**Phase to address:** Telemetry phase -- environment filtering as a day-one implementation requirement, not a later optimization

**Source confidence:** HIGH -- Based on existing codebase analysis showing no environment gating on the answer submission path in `routes/game.ts`, and the project uses a single Supabase instance

---

### 7. State-Level Collections (Indiana, California) Inherit Federal Question Assumptions

**What goes wrong:** The content generation pipeline and quality rules are calibrated for federal civics and local city government. State-level collections (Indiana, California) are a different domain with different characteristics. State legislatures have different structures (Indiana General Assembly bicameral, California has term limits). State-level questions about agencies, courts, and constitutional provisions do not fit the existing topicCategory taxonomy. The generation prompt (`system-prompt.ts`) references "local" government patterns that do not apply at the state level.

**Why it happens:** State-level content is treated as "just another locale" when it is actually a distinct tier of government with different structures, different source authorities, and different question patterns. The existing locale configs (`bloomington-in.ts`, `los-angeles-ca.ts`) model cities, not states.

**Consequences:** State-level questions end up feeling like city questions scaled up, missing the distinctive aspects of state government (legislative process, state constitutional amendments, gubernatorial powers, state agency structures). Quality rules calibrated for city-level facts may not apply (state budget figures are in billions, not millions). Topic categories do not map cleanly.

**Warning signs:**
- State-level locale config is a copy-paste of city config with names changed
- Generation prompt uses "city council" language for state legislature content
- Topic categories like "city-government" appear in state-level questions
- Source URLs point to city websites for state-level questions
- State constitutional questions are absent despite being a rich topic area

**Prevention:**
- **Separate locale config template for states:** Create a state-level locale config that captures state-specific structures: legislature (chambers, term limits, session patterns), executive branch (governor, lieutenant governor, attorney general), judicial system (state supreme court structure), and state agencies
- **State-specific topic taxonomy:** Add state-level topic categories: `state-legislature`, `state-constitution`, `state-agencies`, `state-courts`, `gubernatorial`. These sit alongside but do not replace city-level categories
- **Adapt quality rules per government tier:** "No pure lookup facts" applies differently at state level. "Who is the current Governor?" is a reasonable question (tests basic civic awareness) even though it is technically a lookup. Adjust rule interpretations per tier
- **Source hierarchy for states:** .gov > state legislature website > state constitution text > state agency sites > state-level news media. Different from the city-level hierarchy
- **Pilot one state fully before the second:** Do Indiana first (smaller state, less content to manage), learn from the process, then apply lessons to California (much larger, more complex government structure)

**Phase to address:** Content scaling phase -- state-level template and taxonomy BEFORE generating any state questions

**Source confidence:** MEDIUM -- Analysis of existing locale configs and generation prompt structure, applied to state government domain knowledge

---

### 8. Admin Exploration UI Exposes Raw Database IDs and Internal State

**What goes wrong:** The admin UI for question exploration shows database serial IDs (`id: 47`), internal status codes, raw JSONB fields, and telemetry counters. Content authors who are not developers see confusing internal state. They try to reference questions by database ID in discussions ("question 47 needs editing") when the meaningful identifier is the `externalId` ("fed-q047"). Internal fields like `expirationHistory` JSONB are displayed raw. The admin UI becomes a database viewer, not a content management tool.

**Why it happens:** The quickest path to building an admin UI is exposing the API response directly in a table. The existing admin API (`routes/admin.ts`) already returns raw database fields including `expirationHistory` as a JSONB array. Developers building the UI for themselves naturally expose everything. When content authors use the same tool, it is overwhelming.

**Consequences:** Content authors are confused by the interface. They make errors referencing wrong question IDs. They misinterpret internal status codes. The tool that should empower content review instead creates a barrier to non-developer content authors participating in quality review.

**Warning signs:**
- Admin UI shows database `id` column prominently instead of `externalId`
- Raw JSON shown in table cells instead of formatted, human-readable values
- Status shown as `active`/`expired`/`archived` text without visual indicators
- No search/filter by question text -- only by database columns
- Content authors ask developers to look up questions for them instead of using the UI

**Prevention:**
- **Design for content authors first, developers second:** The primary admin UI user is someone reviewing question quality, not debugging database state. Lead with question text, collection name, difficulty, and quality status. Hide database internals behind a "Details" expandable section
- **externalId is the public-facing identifier:** All UI references use `externalId` ("fed-q047", "bli-023"). Database `id` is visible only in the details panel. Copy-to-clipboard on `externalId` for easy reference
- **Formatted displays for complex fields:** `expirationHistory` shown as a timeline, not raw JSON. Quality rule results shown as pass/fail badges, not raw scores. Source URLs shown as clickable links
- **Full-text search on question text:** The most natural way for content authors to find a question is by searching its text. Implement this before any column-based filtering
- **Start with read-only exploration:** v1.3 admin UI should be read-only with quality review actions. Full CRUD editing is a later milestone. This reduces the surface area for mistakes

**Phase to address:** Admin UI phase -- wireframe the content author workflow before building any components

**Source confidence:** MEDIUM -- Analysis of existing admin API response shape in `routes/admin.ts` combined with general internal tools UX patterns

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Telemetry counters on questions table directly | No new table, simple UPDATE | Hot row contention at scale, mixed read/write concerns | Only if concurrent players < 10 |
| Quality rules as code comments only | Fast to add | Rules diverge from enforcement, no version history | Never -- even v1 rules need a file |
| Admin UI in consumer React bundle | One build pipeline | Bundle size bloat for all users, deployment coupling | Only for initial prototype, split before launch |
| Hardcoded quality thresholds | Simple implementation | Cannot adjust without code changes | Acceptable for v1.3, extract to config by v1.4 |
| Skip telemetry in dev/test | Faster development | Cannot test telemetry features locally | Never -- use mock telemetry in dev |
| Grandfather all existing questions | Avoid disruption | Known-bad questions stay in rotation | Acceptable for advisory rules only, not blocking rules |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Inline telemetry UPDATE in answer handler | Answer latency increases | Async write or separate table | >20 concurrent games |
| Admin "browse all" query without pagination | Admin page loads slowly | LIMIT/OFFSET with cursor pagination | >500 questions |
| Quality rule evaluation on every question load | Game startup slows | Cache quality scores, recalculate on content change | >1000 questions |
| Full question text search without index | Search returns slowly | Add `gin_trgm_ops` index on `questions.text` | >500 questions |
| Telemetry aggregation query on raw events | Admin dashboard slow | Materialized view refreshed by cron | >10,000 answer events |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Admin UI accessible without auth (dev oversight) | Anyone can view all questions and answers | Admin routes already gated by `authenticateToken`; verify this covers new endpoints |
| Admin endpoints expose `correctAnswer` for all questions | Cheating -- someone scrapes admin API to get answers | Admin API must require admin-level auth, not just any authenticated user |
| Telemetry data reveals user answer patterns | Privacy concern -- can correlate user sessions to question performance | Aggregate telemetry data only, no per-user answer tracking in telemetry tables |
| Quality rules source URLs expose internal review notes | Internal deliberations about "why this question is bad" become public | Quality rule results are admin-only; never include in game API responses |
| Admin user ID allowlist hardcoded in source code | Anyone with repo access knows who admins are | Use environment variable for admin user IDs, not hardcoded values |

## UX Pitfalls

Common user experience mistakes for admin/internal tools in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Quality review requires evaluating questions out of context (no topic, no collection shown) | Reviewer cannot judge civic utility without knowing the collection | Show question in context: collection name, topic, related questions in same topic |
| No bulk actions in admin UI | Reviewing 320 questions one-by-one takes hours | Batch approve/flag with quality filter presets ("show all questions failing rule X") |
| Telemetry shown as raw numbers without context | "encounter_count: 47" means nothing without knowing total games played | Show as percentages: "Encountered in 47% of Federal Civics games" |
| No "preview as player" in admin UI | Cannot see how question looks in the actual game | Add a "preview" button that renders question in game UI format |
| Quality rules shown as technical identifiers | "RULE_003_NO_PHONE" is meaningless to content authors | Show human-readable rule names: "No phone numbers or addresses in answers" |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Quality rules:** Rules are written but not tested against existing 320 questions -- run the dry run before declaring rules complete
- [ ] **Telemetry:** Counters increment but no environment filtering -- verify dev/test data is excluded from production metrics
- [ ] **Admin UI:** Questions are listed but `externalId` is not the primary identifier shown -- content authors need externalId, not database ID
- [ ] **Admin UI:** Browse works but no pagination -- test with "show all questions" and verify it does not timeout
- [ ] **Quality checks:** Automated rules pass but human review workflow is undefined -- who reviews, when, and what happens to flagged questions?
- [ ] **State collections:** Questions generated but topic taxonomy is copied from city-level -- verify state-specific categories exist
- [ ] **Telemetry:** Counters show in admin UI but correct_rate calculation divides by encounter_count without checking for zero -- division by zero for new questions
- [ ] **Quality rules:** Rules document exists but is not referenced by the generation prompt or review workflow -- rules must be wired in, not just written

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Quality rules flag >50% of existing questions | MEDIUM | Implement grandfather clause, split rules into blocking vs advisory, re-run with relaxed advisory rules |
| Telemetry hot row contention in production | HIGH | Emergency migration to separate telemetry table, backfill aggregated counts, update all queries |
| Admin UI bug crashes game server | LOW | Restart server (existing health checks handle this), add error isolation to admin routes |
| AI content passes all checks but is boring/repetitive | MEDIUM | Add "diversity" rule requiring N unique topic categories per batch, increase human review sample rate |
| Test data pollutes production telemetry | MEDIUM | Reset counters to zero, add environment check, re-deploy, communicate data loss to stakeholders |
| State-level questions use city-level taxonomy | LOW | Re-categorize questions with corrected taxonomy, update locale config template |
| Quality rules diverge from automated checks | LOW | Audit rules document against check functions, add mapping comments, write integration test that verifies correspondence |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Quality Framework | Retroactive rule failure on existing content (#1) | CRITICAL | Dry run first, two-tier rules (blocking vs advisory) |
| Quality Framework | Rules become stale or ignored (#5) | MODERATE | Rules in repo, review checklist, quarterly review cadence |
| Quality Framework | AI passes checks but fails human review (#3) | CRITICAL | Automated checks are gatekeepers only, budget human review time |
| Telemetry | Hot row contention on questions table (#2) | CRITICAL | Separate telemetry table or async event insertion |
| Telemetry | Test/dev data pollutes production metrics (#6) | MODERATE | Environment-aware writes, minimum sample size for analytics |
| Admin UI | Coupling with consumer app (#4) | MODERATE | Separate frontend entry point, error isolation on routes |
| Admin UI | Raw database view instead of content tool (#8) | MODERATE | Design for content authors, externalId as primary identifier |
| Content Scaling | State collections inherit city assumptions (#7) | MODERATE | Separate state-level locale template and taxonomy |

## Integration Risks with Existing v1.2 System

These pitfalls are specifically about how new features interact with the deployed system.

| Existing Component | New Feature | Risk | Mitigation |
|--------------------|-------------|------|------------|
| `questions` table (read-heavy for game queries) | Telemetry counter UPDATEs on same table | Write contention degrades game performance | Separate `question_stats` table or async events |
| `authenticateToken` middleware on admin routes | New admin exploration endpoints | Any authenticated user can access admin -- no role check | Add admin user ID allowlist check in middleware |
| `selectQuestionsForGame` with difficulty balancing | Quality rules that archive questions | Archiving questions may break difficulty distribution balance | Check pool sizes after archival, alert if any difficulty pool < 4 |
| Zod schema validation in `question-schema.ts` | New quality rules beyond structural validation | Two validation layers with potential conflicts | Quality rules EXTEND Zod validation, do not replace it |
| `system-prompt.ts` generation prompt | Quality rules for AI-generated content | Prompt does not reference quality rules | Inject quality rule summaries into generation prompt |
| `collections` table with `isActive` flag | State-level collections (Indiana, California) | New collections need topic associations and question thresholds | Follow existing collection activation pattern from `activate-collections.ts` |
| `externalId` format (`bli-001`, `lac-001`) | State-level question IDs | State prefix convention unclear (`ind-001`? `in-001`? `indiana-001`?) | Define prefix convention before generation: 2-3 char state code (`ind-`, `cal-`) |
| In-memory `recentQuestions` Map in `game.ts` | Larger question pools from new collections | Map grows with more users across more collections | Map already bounded by `MAX_RECENT = 30` per user -- acceptable |

---

## Sources

### Telemetry and Counter Patterns (HIGH confidence)
- [PostgreSQL concurrent counter approaches](https://www.cybertec-postgresql.com/en/how-to-count-hits-on-a-website-in-postgresql/) -- HOT updates, sharding strategies
- [Async counter architecture in PostgreSQL](https://medium.com/@timanovsky/ultra-fast-asynchronous-counters-in-postgres-44c5477303c3) -- Event queue pattern for high-write counters
- [Supabase concurrent write handling](https://bootstrapped.app/guide/how-to-handle-concurrent-writes-in-supabase) -- Atomic increment patterns for Supabase

### AI Content Quality Gap (MEDIUM confidence)
- [Evaluating AI-Generated Content](https://www.walturn.com/insights/evaluating-ai-generated-content) -- Automated vs human review limitations
- [Evaluating Generative AI Output](https://clarivate.com/academia-government/blog/evaluating-the-quality-of-generative-ai-output-methods-metrics-and-best-practices/) -- Multi-layer assessment approach
- [Building Better AI Quality Rating](https://www.dataforce.ai/blog/building-better-ai-best-practices-generative-ai-quality-rating) -- Human oversight for subjective quality

### Content Scaling (MEDIUM confidence)
- [AI Content Creation at Scale 2026](https://www.trysight.ai/blog/ai-content-creation-at-scale) -- Quality framework for scaled generation
- [Scaling Content with AI Quality Framework](https://vertu.com/lifestyle/how-to-scale-content-creation-with-ai-while-maintaining-quality/) -- Feedback loops and local reviewer patterns

### Admin UI Patterns (MEDIUM confidence)
- [Modularizing React Applications](https://martinfowler.com/articles/modularizing-react-apps.html) -- Component boundary patterns for admin vs consumer
- [Trivia question quality best practices](https://quiznighthq.com/how-to-create-good-questions/) -- Domain-specific question quality criteria

### Codebase Analysis (HIGH confidence)
- Direct analysis of `C:/Project Test/backend/src/db/schema.ts` -- Questions table structure, no telemetry columns yet
- Direct analysis of `C:/Project Test/backend/src/routes/admin.ts` -- Existing admin routes, auth pattern, API response shape
- Direct analysis of `C:/Project Test/backend/src/routes/game.ts` -- Answer submission handler, session creation, question selection
- Direct analysis of `C:/Project Test/backend/src/scripts/content-generation/question-schema.ts` -- Existing Zod validation
- Direct analysis of `C:/Project Test/backend/src/scripts/content-generation/prompts/system-prompt.ts` -- Generation prompt without quality rules
- Direct analysis of `C:/Project Test/backend/src/cron/expirationSweep.ts` -- Existing cron pattern for background jobs

---

## Metadata

**Confidence breakdown:**
- Quality framework pitfalls: HIGH -- Direct analysis of existing validation pipeline and 320-question corpus characteristics
- Telemetry pitfalls: HIGH -- PostgreSQL hot row contention is well-documented; Supabase connection limits are a known constraint
- Admin UI pitfalls: MEDIUM-HIGH -- Existing admin API pattern analyzed; UX recommendations are general internal tools patterns
- Content scaling pitfalls: MEDIUM -- State-level government structures are known domain knowledge; locale config analysis is direct
- AI quality gap pitfalls: MEDIUM -- External research on automated vs human review; specific pass rates are estimates
- Integration risks: HIGH -- Direct analysis of every affected route, service, and table

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days -- patterns are stable; specific Supabase limits may change with plan tier)

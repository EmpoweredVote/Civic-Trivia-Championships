# Feature Landscape: Question Quality, Admin Tools, Content Telemetry, and AI Pipelines

**Domain:** Civic education trivia -- content quality management and authoring tools
**Researched:** 2026-02-19
**Overall Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone adds the internal tooling layer that transforms content management from "scripts and SQL queries" to "structured quality framework with admin visibility." The existing system has 320 questions across 3 collections, AI generation scripts, Zod schema validation, and basic admin routes for expiration management. What it lacks: a codified definition of "good question," a way to browse and assess content without SQL, telemetry on how questions perform in the wild, and quality gates in the AI pipeline beyond structural validation.

The key insight from research: **question quality is not one thing.** It has three distinct dimensions that are assessed at different times:

1. **Static quality** (assessed at authoring time) -- Does the question follow item-writing rules? Are distractors plausible? Is the source real?
2. **Perceived quality** (assessed by human review) -- Does it pass the "dinner party test"? Is it civically useful? Is it fun?
3. **Empirical quality** (assessed after gameplay) -- Do players get it right at expected rates? Do all distractors attract selections? Is it too easy or too hard?

Most platforms conflate these. The best ones separate them because they require different tools: static quality needs automated rules, perceived quality needs a review UI, and empirical quality needs gameplay telemetry.

---

## Table Stakes

Features that any content quality management system for a trivia/quiz platform should have. Missing these means operating blind.

### TS-1: Question Quality Rules Engine (Static Analysis)

**What:** A codified set of rules that can be run against any question to produce a quality score and list of violations. Rules operate on the question data structure without requiring gameplay data.
**Why expected:** The project already has Zod schema validation (structural correctness). But structural validity is not quality -- a question can pass Zod and still be terrible. Every serious quiz platform has quality rules beyond "is the JSON valid." The existing system prompt encodes quality philosophy in prose but nothing enforces it post-generation.
**Complexity:** MEDIUM
**Dependencies:** Existing question schema in `backend/src/db/schema.ts`
**Notes:**

**Rule categories to codify (derived from item-writing research and project quality philosophy):**

| Category | Rule | Automated? | Example |
|----------|------|------------|---------|
| **Stem clarity** | Question text must end with "?" | YES | Flag "The mayor of Bloomington" (not a question) |
| **Stem clarity** | Question should be answerable without seeing options | PARTIAL (heuristic) | Flag fill-in-the-blank stems like "_____ is the capital" |
| **Stem clarity** | No negatives in stem ("Which is NOT...") | YES (regex) | These confuse players and test reading, not knowledge |
| **Distractor quality** | All 4 options similar in length (within 2x) | YES | Flag when correct answer is 3x longer than others |
| **Distractor quality** | No "All of the above" / "None of the above" | YES | These are item-writing anti-patterns |
| **Distractor quality** | Options should not share a common prefix/suffix | YES (heuristic) | If 3 start with "The City of..." that is a stem issue |
| **Source quality** | Source URL must be HTTPS | YES | Flag HTTP sources |
| **Source quality** | Source URL domain should be .gov/.edu/.us | YES (warning) | .com sources are lower authority for civic content |
| **Source quality** | Explanation must contain "According to" | YES | Already enforced by Zod, keep it |
| **Civic quality** | No partisan language (list of flagged terms) | YES (keyword) | Flag "liberal," "conservative," "Democrat," "Republican" in stem/options |
| **Civic quality** | Question should not reference phone numbers, addresses, or zip codes | YES (regex) | Per project philosophy -- these are lookup facts, not knowledge |
| **Civic quality** | No "pure date" questions | PARTIAL (heuristic) | Flag questions where answer options are all years/dates |
| **Difficulty calibration** | Easy questions should have shorter stems | PARTIAL (heuristic) | Flag easy questions with >40 words |
| **Expiration** | Time-sensitive questions must have expiresAt | PARTIAL (keyword) | Flag "current" or "currently" in stem without expiresAt |

**Implementation recommendation:** A `validateQuestionQuality(question)` function returning `{ score: number, violations: Violation[], warnings: Warning[] }`. Run it in the AI generation pipeline (reject/flag questions) AND in the admin UI (show quality badges). This is the foundation everything else builds on.

**Confidence:** HIGH for the rule categories. These are well-established in item-writing literature (Haladyna et al.) and align with the project's stated quality philosophy.

### TS-2: Admin Question Explorer UI

**What:** A web-based interface for browsing, filtering, and inspecting all questions across collections. Not for editing (that stays in code/scripts), but for assessment and review.
**Why expected:** The current admin route (`/admin/questions`) only surfaces expired/expiring questions. There is no way to browse active content, filter by topic, see quality scores, or inspect individual questions without SQL queries. Any content platform needs a browse interface for its content authors.
**Complexity:** MEDIUM-HIGH
**Dependencies:** Existing admin routes, TS-1 (quality rules for score display)
**Notes:**

**Core capabilities (based on quiz CMS patterns from Moodle, LiveLike, and content management best practices):**

| Capability | Description | Priority |
|------------|-------------|----------|
| **List view** | Paginated table of all questions with key columns | P1 |
| **Filter by collection** | Dropdown to scope to one collection | P1 |
| **Filter by status** | Active / expired / archived | P1 |
| **Filter by difficulty** | Easy / medium / hard | P1 |
| **Filter by topic** | Topic category within collection | P2 |
| **Search by text** | Full-text search on question stem | P2 |
| **Sort by columns** | Sort by difficulty, date, quality score | P1 |
| **Question detail view** | Expand to see full question, options, explanation, source, quality score | P1 |
| **Quality score badge** | Visual indicator of static quality score per question | P2 |
| **Bulk actions** | Select multiple questions for archive/status change | P3 |
| **Export** | CSV/JSON export of filtered results | P3 |

**Key columns for list view:**
- External ID
- Question text (truncated)
- Collection
- Topic
- Difficulty
- Status
- Expires at (if set)
- Quality score (from TS-1)
- Created date

**UX pattern:** This is an internal dev/author tool. Use a data table component, not a fancy consumer UI. Something like a React Table or TanStack Table. Prioritize density and filterability over visual polish.

### TS-3: Question Detail Inspector

**What:** A detail view for a single question showing everything: the question as players see it, the correct answer highlighted, explanation, source link (clickable to verify), quality rule results, and (eventually) telemetry data.
**Why expected:** Content authors need to assess questions holistically. Seeing a question in a table row does not convey whether it "feels right." A detail view lets a reviewer quickly decide "this is good" or "this needs work."
**Complexity:** LOW-MEDIUM
**Dependencies:** TS-2 (explorer), TS-1 (quality rules)
**Notes:**

**Detail view sections:**
1. **Preview** -- Render the question as it appears in-game (stem, 4 options, correct answer highlighted)
2. **Metadata** -- Collection, topic, difficulty, status, external ID, created/updated dates, expiration
3. **Quality assessment** -- Score, list of rule violations/warnings with severity
4. **Source verification** -- Source name, clickable URL, last-verified date (future)
5. **Learning content** -- If present, show paragraphs and per-option corrections
6. **Telemetry** (future) -- Correct rate, distractor selection distribution, skip rate

### TS-4: Collection Health Dashboard (Enhanced)

**What:** Expansion of the existing collection health concept (D-2 from prior research) to include quality distribution, not just expiration counts.
**Why expected:** Knowing "you have 100 active questions" is incomplete. Knowing "you have 100 active questions, 15 have quality warnings, and 8 have no learning content" is actionable.
**Complexity:** LOW-MEDIUM
**Dependencies:** TS-1 (quality rules), existing collection/question schema
**Notes:**

**Health metrics per collection:**

| Metric | Why It Matters |
|--------|---------------|
| Total / active / expired / archived counts | Basic inventory |
| Difficulty distribution (easy/medium/hard %) | Balance check against 40/40/20 target |
| Questions with quality warnings | Content maintenance backlog |
| Questions with quality violations (score < threshold) | Urgent fixes needed |
| Questions without learning content | Completeness gap |
| Questions expiring in 30/60/90 days | Upcoming content needs |
| Average quality score | Overall collection health indicator |
| Topic coverage distribution | Identify over/under-represented topics |

---

## Differentiators

Features that go beyond basic content management and create real quality advantages.

### D-1: Content Telemetry System (Empirical Quality)

**What:** Track per-question gameplay metrics to measure empirical quality: how hard is it actually (not just the author's label), how well do distractors work, and how engaging is it.
**Why valuable:** This is the gap between "we think this is a good question" and "data shows this is a good question." Classical Test Theory (CTT) provides the framework -- it has been used in educational assessment for decades. The key metrics map directly to question quality:

**Core metrics (from CTT item analysis):**

| Metric | Definition | What It Tells You | Good Range |
|--------|-----------|-------------------|------------|
| **P-value (difficulty index)** | % of players who answer correctly | Actual difficulty | 0.30 - 0.90 (too low = too hard, too high = too easy) |
| **Discrimination index** | Correlation between getting this question right and overall game score | Whether the question separates skilled from unskilled players | > 0.20 (below = poor discriminator) |
| **Distractor selection rate** | % choosing each wrong answer | Whether distractors are plausible | Each distractor > 5% (below = non-functioning distractor) |
| **Skip/timeout rate** | % of players who run out of time | Whether the question is confusing or too long | < 15% (above = question may be unclear) |
| **Response time distribution** | Average time to answer | Cognitive load indicator | Varies by difficulty |

**Complexity:** MEDIUM-HIGH
**Dependencies:** Game session data (already captured in sessions), new analytics table(s)
**Notes:**

The existing game flow already records which answers players select and timing data (the plausibility threshold system in `plausibilityThresholds.ts` proves timing is tracked). The missing piece is aggregation: storing per-question tallies that accumulate over many game sessions.

**Implementation approach:** After each game session completes, write per-question outcome records (question_id, selected_option, correct, response_time_ms) to an analytics table. A periodic aggregation job (or materialized view) computes the CTT metrics. The admin detail view (TS-3) displays them.

**Data volume consideration:** At 320 questions and moderate play volume, this is small data. No need for a separate analytics database. PostgreSQL handles this easily with proper indexing.

**Confidence:** HIGH for the metrics (well-established in psychometrics literature). MEDIUM for implementation approach (depends on how game session data is currently stored and what is already captured).

### D-2: Difficulty Calibration Feedback Loop

**What:** Use empirical P-values to flag questions whose actual difficulty diverges from their labeled difficulty. A question labeled "easy" that only 20% of players get right is miscalibrated.
**Why valuable:** Difficulty labels drive the game's progression feel (Q1=easy, Q10=hard). If labels are wrong, the difficulty curve feels random. Calibration flags surface the worst offenders for relabeling.
**Complexity:** LOW (once D-1 exists)
**Dependencies:** D-1 (telemetry system)
**Notes:**

**Calibration rules:**

| Labeled | Expected P-value | Flag If |
|---------|-----------------|---------|
| Easy | 0.70 - 0.95 | P < 0.50 (too hard for "easy") |
| Medium | 0.40 - 0.70 | P < 0.25 or P > 0.85 |
| Hard | 0.20 - 0.50 | P > 0.70 (too easy for "hard") |

Show these as amber/red flags in the admin question detail and in the collection health dashboard. Do NOT auto-relabel -- a human should decide if the label is wrong or if the question needs rewriting.

### D-3: AI Content Pipeline with Quality Gates

**What:** Enhance the existing AI generation pipeline (`generate-locale-questions.ts`) to run quality rules (TS-1) as a post-generation validation step, rejecting or flagging questions that fail quality checks before they reach the database.
**Why valuable:** The current pipeline validates structural correctness via Zod but does not check semantic quality. The QUEST framework research (Springer, 2025) found that LLM-generated MCQs commonly have weak distractors that can be eliminated through simple logic. Catching these automatically reduces the human review burden.
**Complexity:** MEDIUM
**Dependencies:** TS-1 (quality rules engine), existing generation pipeline
**Notes:**

**Proposed pipeline stages:**

```
1. AI Generation (existing)
   |
2. Structural Validation (existing Zod schema)
   |
3. Quality Rules Check (NEW - TS-1 rules engine)
   |-- PASS (score >= threshold) --> 4. Database insert as 'draft'
   |-- WARN (score borderline) ----> 4. Insert as 'draft' with quality_warnings flag
   |-- FAIL (critical violations) -> Log and skip (or retry with feedback)
   |
4. Human Review Queue
   |-- Approve --> status: 'active'
   |-- Reject  --> status: 'archived' with reason
   |-- Edit    --> modify and re-run quality check
```

**Retry with feedback (advanced):** When a question fails quality checks, include the violation in a follow-up prompt to the LLM asking it to fix the specific issue. The QUEST framework research shows iterative refinement (generate -> assess -> revise) significantly improves quality. This is a natural extension of the existing multi-turn conversation capability but adds API cost.

**Recommendation:** Start with gate-and-flag (stages 1-4 without retry). Add iterative refinement as an optional `--refine` flag on the generation script if initial rejection rates are high.

### D-4: Human Review Workflow

**What:** A structured review status on questions (draft -> review -> active / rejected) with the ability for reviewers to approve, reject with reason, or flag for revision in the admin UI.
**Why valuable:** The generation pipeline currently seeds questions as "draft" status but there is no workflow to move them to active. The admin routes only handle expiration (renew/archive). A review workflow closes the gap between "AI generated it" and "a human verified it."
**Complexity:** MEDIUM
**Dependencies:** TS-2 (admin explorer), TS-3 (detail view)
**Notes:**

**Status lifecycle:**

```
draft --> in_review --> active
  |          |            |
  |          +-> rejected  +-> expired --> archived
  |                              |
  +------------------------------+-> archived
```

**Review actions in admin UI:**
- **Approve** -- Move to active (available for gameplay)
- **Reject** -- Move to rejected with required reason text
- **Flag** -- Keep in review, add a note for another reviewer
- **Edit + Approve** -- For minor fixes (typo in explanation, adjust difficulty label)

**Important:** Keep this lightweight. This is a dev tool for a small team, not an enterprise workflow engine. No approval chains, no role-based permissions (everyone with admin access can review), no email notifications. Just status transitions with timestamps and optional notes.

### D-5: Source URL Verification

**What:** Automated or semi-automated checking that question source URLs are still accessible and return relevant content.
**Why valuable:** Source URLs rot. Government websites reorganize. A question citing `bloomington.in.gov/city-council` that now 404s undermines trust. The existing RAG pipeline (`fetch-sources.ts`) already has URL fetching infrastructure that could be repurposed.
**Complexity:** LOW-MEDIUM
**Dependencies:** Existing source URL field on questions
**Notes:**

**Two levels:**
1. **Link check** (automated, run weekly) -- HTTP HEAD request. Flag 404s, 301s (redirects), and timeouts. LOW complexity.
2. **Content check** (semi-automated, run on demand) -- Fetch page, check if key terms from the question/explanation appear. MEDIUM complexity, builds on existing `fetch-sources.ts` cheerio parsing.

**Recommendation:** Start with link checks only. Display last-checked date and status in the question detail view (TS-3). A cron job runs weekly, similar to the existing `expirationSweep.ts` pattern.

### D-6: Quality Score Trend Tracking

**What:** Track how a collection's overall quality metrics change over time as questions are added, reviewed, and receive gameplay data.
**Why valuable:** Answers "is our content getting better?" Without trends, you only see a snapshot. With trends, you can see if new AI-generated batches are improving or degrading average quality.
**Complexity:** LOW (once D-1 and TS-1 exist)
**Dependencies:** D-1 (telemetry), TS-1 (quality rules), TS-4 (health dashboard)
**Notes:** Store periodic snapshots of collection health metrics (daily or weekly). Display as a simple line chart on the collection health dashboard. Not a priority for initial implementation but trivial to add once the data infrastructure exists.

---

## Anti-Features

Features to explicitly NOT build. These are common in content management platforms but wrong for this project's scale and philosophy.

### AF-1: Full CMS with Inline Question Editing

**What:** Edit question text, options, explanations, and metadata directly in the admin web UI.
**Why avoid:** Questions live in the database, seeded from AI generation scripts. The source of truth for content creation is the generation pipeline, not a web form. Adding web-based editing creates two paths to modify content (UI and scripts), leading to inconsistency. At 320 questions across 3 collections, the team does not need a WordPress-style editor.
**What to do instead:** The admin UI is read-only for question content. Status changes (approve, reject, archive) are the only write operations. Content corrections go through the generation pipeline or direct database scripts with proper review.

### AF-2: Real-Time Analytics Dashboard

**What:** Live-updating charts showing player engagement, question performance, and collection metrics updating in real-time.
**Why avoid:** Real-time adds WebSocket complexity for data that changes slowly. Question telemetry aggregates are meaningful over days and weeks, not seconds. No content author needs to watch a P-value change in real-time.
**What to do instead:** Batch-computed analytics refreshed daily (or on-demand via admin button). Static charts that load the latest computed data. This is orders of magnitude simpler and provides the same value.

### AF-3: A/B Testing for Question Variants

**What:** Show different versions of the same question to different players to test which wording performs better.
**Why avoid:** Requires session-level experiment tracking, variant management, statistical significance calculations, and careful question pool management to avoid showing both variants to the same player. Massive complexity for a product with 320 questions. This is a feature for platforms with millions of users, not hundreds.
**What to do instead:** Use telemetry data (D-1) to identify poorly performing questions. Rewrite them based on the data. Test the rewrite by deploying it and checking the next batch of telemetry.

### AF-4: AI Auto-Improvement of Questions

**What:** Automatically feed telemetry data back into an LLM to rewrite underperforming questions without human review.
**Why avoid:** Removes human judgment from civic education content. A question about who the mayor is cannot be "improved" by an LLM if the answer changed -- it needs a human who knows the current political landscape. Auto-modification of educational content without review is an anti-pattern for trust.
**What to do instead:** AI can SUGGEST improvements (e.g., "This question has a non-functioning distractor. Consider replacing Option C."). Humans decide whether to accept. This is the "copilot not autopilot" pattern.

### AF-5: Complex Role-Based Access Control

**What:** Multiple admin roles (content author, reviewer, editor-in-chief, super-admin) with different permission levels.
**Why avoid:** The team is small. Everyone who has admin access should be able to do everything. RBAC adds complexity to every admin endpoint and UI component. Premature for a team of 1-5 content contributors.
**What to do instead:** Single admin role. If the team grows to need role separation, add it then. The existing JWT auth with `authenticateToken` middleware is sufficient.

### AF-6: Question Difficulty Prediction via ML

**What:** Train a machine learning model on question features (word count, topic, readability score) to predict difficulty before gameplay data exists.
**Why avoid:** Requires training data you do not have yet. The author's difficulty label plus the quality rules heuristics (TS-1) are sufficient for initial calibration. Once enough gameplay data accumulates (D-1), empirical difficulty is more reliable than any prediction model.
**What to do instead:** Author labels difficulty at creation. Quality rules flag obvious mismatches (easy question with complex vocabulary). Telemetry eventually provides ground truth. Relabel manually when data shows miscalibration (D-2).

### AF-7: Multi-Language Question Support

**What:** Translating questions into Spanish, Mandarin, etc.
**Why avoid:** Translation of civic education content requires domain expertise, not just language fluency. Legal terminology, government structure names, and civic concepts do not translate 1:1. This is a content strategy decision, not a feature decision, and it is premature.
**What to do instead:** Focus on English-language content quality first. If multilingual becomes a goal, it deserves its own milestone with proper research into civic education translation patterns.

---

## Feature Dependencies

```
TS-1 (Quality Rules Engine) [FOUNDATION]
  |
  +-- TS-2 (Admin Question Explorer)
  |     |
  |     +-- TS-3 (Question Detail Inspector)
  |     |     |
  |     |     +-- D-4 (Human Review Workflow)
  |     |     +-- D-5 (Source URL Verification) [display in detail view]
  |     |
  |     +-- TS-4 (Collection Health Dashboard)
  |           |
  |           +-- D-6 (Quality Score Trends)
  |
  +-- D-3 (AI Pipeline Quality Gates)

D-1 (Content Telemetry) [INDEPENDENT - needs game session data]
  |
  +-- D-2 (Difficulty Calibration Feedback)
  |
  +-- TS-3 (enhanced with telemetry data display)
  |
  +-- TS-4 (enhanced with empirical metrics)
  |
  +-- D-6 (enhanced with telemetry trends)

D-5 (Source URL Verification) [SEMI-INDEPENDENT - needs existing fetch infrastructure]
```

### Dependency Notes

- **TS-1 is the keystone.** Quality rules feed into the admin UI (display), the AI pipeline (gates), and the health dashboard (aggregates). Build this first.
- **D-1 (telemetry) is independent of the admin UI.** It depends on game session data that already exists. Can be built in parallel with the admin UI.
- **D-4 (review workflow) requires TS-2 and TS-3.** You need a place to see questions before you can review them.
- **D-3 (pipeline gates) only requires TS-1.** It is a backend-only enhancement to existing scripts.

---

## Quality Rule Categories (Detailed Specification)

These are the specific, actionable rule categories that should be codified in TS-1. Organized by what they catch.

### Category 1: Stem Quality

Rules about the question text itself.

| Rule ID | Rule | Severity | Check Type | Rationale |
|---------|------|----------|------------|-----------|
| SQ-01 | Ends with question mark | ERROR | Regex | Non-questions confuse players |
| SQ-02 | No negative phrasing ("NOT", "EXCEPT", "NEVER") | WARNING | Keyword | Negatives test reading comprehension, not knowledge |
| SQ-03 | Length between 15-200 characters | WARNING | Length | Too short = vague; too long = reading test |
| SQ-04 | No "fill in the blank" style | WARNING | Regex (`___`) | Incomplete stems are harder to parse |
| SQ-05 | No leading articles that give away answer | WARNING | Heuristic | "An ____" reveals answer starts with vowel |

### Category 2: Distractor Quality

Rules about the answer options.

| Rule ID | Rule | Severity | Check Type | Rationale |
|---------|------|----------|------------|-----------|
| DQ-01 | Exactly 4 options | ERROR | Count | Already enforced by Zod, keep |
| DQ-02 | No option is empty or whitespace-only | ERROR | Trim + length | Data integrity |
| DQ-03 | No "All of the above" / "None of the above" | WARNING | Keyword | Item-writing anti-pattern |
| DQ-04 | Options similar in length (max 3x ratio) | WARNING | Length comparison | Longest option is often correct (test-taking cue) |
| DQ-05 | No duplicate options | ERROR | String comparison | Data integrity |
| DQ-06 | Correct answer index is valid (0-3) | ERROR | Range check | Already enforced by Zod |
| DQ-07 | Options should not all share a long common prefix | WARNING | String prefix | Indicates the prefix belongs in the stem |

### Category 3: Civic Content Quality

Rules specific to the civic education domain and the project's quality philosophy.

| Rule ID | Rule | Severity | Check Type | Rationale |
|---------|------|----------|------------|-----------|
| CQ-01 | No partisan political terms | WARNING | Keyword list | Neutrality requirement |
| CQ-02 | No phone numbers in stem or options | WARNING | Regex | "Dinner party test" -- not worth sharing |
| CQ-03 | No street addresses in stem or options | WARNING | Regex | Lookup fact, not knowledge |
| CQ-04 | No ZIP codes as answers | WARNING | Regex | Lookup fact |
| CQ-05 | Explanation references source ("According to") | ERROR | Keyword | Already enforced by Zod |
| CQ-06 | Source URL is HTTPS | WARNING | Regex | Authority signal |
| CQ-07 | Source URL domain is .gov, .edu, or .us | INFO | Regex | Preferred civic sources |
| CQ-08 | Time-sensitive keywords require expiresAt | WARNING | Keyword + null check | "current," "currently," "as of" without expiration |

### Category 4: Difficulty Consistency

Rules that flag potential difficulty label mismatches.

| Rule ID | Rule | Severity | Check Type | Rationale |
|---------|------|----------|------------|-----------|
| DC-01 | Easy questions: stem < 40 words | INFO | Word count | Easy should be quick to read |
| DC-02 | Hard questions: stem > 15 words | INFO | Word count | Hard questions should require thought |
| DC-03 | Easy questions: no multi-clause stems | INFO | Heuristic | Simple structure for simple questions |

### Scoring Model

Each question gets a quality score from 0-100:
- Start at 100
- ERROR violations: -25 each (question should not be published)
- WARNING violations: -10 each (question needs review)
- INFO violations: -3 each (suggestion, not blocking)

**Thresholds:**
- 80-100: GOOD (publishable)
- 60-79: FAIR (review recommended)
- 0-59: POOR (should not be published without fixes)

---

## MVP Recommendation

### Phase 1: Quality Foundation (Build First)

1. **TS-1** Quality rules engine -- The foundation everything depends on
2. **D-3** AI pipeline quality gates -- Immediate value on next content generation run

### Phase 2: Admin Visibility

3. **TS-2** Admin question explorer -- Browse and filter all content
4. **TS-3** Question detail inspector -- Deep-dive on individual questions
5. **TS-4** Collection health dashboard -- Collection-level quality view

### Phase 3: Workflow and Telemetry

6. **D-4** Human review workflow -- Structured draft-to-active process
7. **D-1** Content telemetry -- Start collecting gameplay data per question
8. **D-5** Source URL verification -- Automated link checking

### Phase 4: Feedback Loops (After Data Accumulates)

9. **D-2** Difficulty calibration -- Requires telemetry data from D-1
10. **D-6** Quality score trends -- Requires history from TS-1 + D-1

### Estimated Scope

| Feature | Effort | Risk |
|---------|--------|------|
| TS-1 (quality rules) | 2-3 days | LOW -- rules are well-defined |
| D-3 (pipeline gates) | 1-2 days | LOW -- extends existing pipeline |
| TS-2 (explorer UI) | 3-4 days | MEDIUM -- new frontend surface |
| TS-3 (detail view) | 1-2 days | LOW -- builds on TS-2 |
| TS-4 (health dashboard) | 1-2 days | LOW -- aggregation queries |
| D-4 (review workflow) | 2-3 days | LOW -- status transitions |
| D-1 (telemetry) | 3-4 days | MEDIUM -- new data pipeline |
| D-5 (source verification) | 1-2 days | LOW -- reuses fetch-sources |
| D-2 (calibration) | 1 day | LOW -- once D-1 exists |
| D-6 (trends) | 1 day | LOW -- once data exists |

**Total: ~16-24 days of development work across 4 phases.**

---

## Competitor/Domain Feature Analysis

| Feature | Moodle Question Bank | Kahoot | LiveLike Trivia CMS | Our Approach |
|---------|---------------------|--------|---------------------|--------------|
| Question browsing | Full bank with tag filters | Library search | CSV upload + manual entry | TS-2: Data table with multi-filter |
| Quality scoring | Item analysis reports (post-exam) | None visible | None visible | TS-1: Static rules + D-1: empirical telemetry |
| Content review | Teacher approval | Creator-only | Admin-only | D-4: Draft -> review -> active workflow |
| Difficulty data | CTT statistics | None visible | None visible | D-1: P-value and discrimination index |
| AI generation | Plugins available | AI question generation | GenAI option | D-3: Pipeline with quality gates |
| Source verification | Not applicable | Not applicable | Not applicable | D-5: Automated link checks (civic-specific need) |
| Distractor analysis | Point-biserial on each option | None | None | D-1: Per-distractor selection rates |
| Bulk operations | Import/export, batch edit | Duplicate/share | CSV upload | TS-2: Bulk status changes |

Key takeaway: Most trivia platforms do not invest in question quality tooling because their content is crowdsourced or disposable. Educational assessment platforms (Moodle, standardized testing) have deep quality tooling. This project sits in between -- it needs assessment-grade quality tools but at trivia-platform scale.

---

## Sources

### Item Writing and Question Quality
- [Haladyna et al. - MC Item Writing Guidelines](https://www.tandfonline.com/doi/abs/10.1207/S15324818AME1503_5) -- Foundational taxonomy of 31 item-writing rules organized by content, stem, and option categories (HIGH confidence, peer-reviewed)
- [UF Pharmacy - MCQ Writing Checklist](https://cpe.pharmacy.ufl.edu/wordpress/files/2022/09/Checklist-for-Writing-MCQs.pdf) -- Practical checklist derived from Haladyna's taxonomy (HIGH confidence, academic institution)
- [ACS MC Item Writing Guidelines](https://www.facs.org/for-medical-professionals/education/cme-resources/test-writing/) -- Medical education item-writing standards (HIGH confidence, professional organization)

### Classical Test Theory and Item Analysis
- [Assessment Systems - CTT Item Statistics](https://assess.com/item-statistics-classical-test-theory/) -- P-value, discrimination index definitions and thresholds (HIGH confidence, assessment industry)
- [Assessment Systems - Distractor Analysis](https://assess.com/distractor-analysis-test-items/) -- Non-functioning distractor identification, point-biserial correlation (HIGH confidence)
- [BYU - Item Analysis Basics](https://open.byu.edu/Assessment_Basics/item_analsyis) -- Educational assessment statistics reference (HIGH confidence, academic institution)
- [PMC - Distractor Efficiency Impact](https://pmc.ncbi.nlm.nih.gov/articles/PMC11040895/) -- Empirical study on distractor efficiency, difficulty, and discrimination (HIGH confidence, peer-reviewed)

### AI-Generated Question Quality
- [QUEST Framework - Springer 2025](https://link.springer.com/chapter/10.1007/978-3-031-95627-0_20) -- Quality, Uniqueness, Effort, Structure, Transparency dimensions for evaluating LLM-generated MCQs (HIGH confidence, peer-reviewed)
- [LLM-Generated Q&A Evaluation - AIED 2025](https://arxiv.org/abs/2505.06591) -- Student-centered study finding generated items exhibit strong discrimination and appropriate difficulty (MEDIUM confidence, preprint)
- [AI-Generated Exam Quality Field Study](https://arxiv.org/html/2508.08314v1) -- Large-scale field evaluation of AI-generated assessment items (MEDIUM confidence, preprint)

### Quiz/Trivia CMS Patterns
- [LiveLike Trivia CMS Docs](https://docs.livelike.com/docs/trivia) -- CMS features: CSV upload, manual, GenAI creation; timer config; result customization (HIGH confidence, official docs)
- [Moodle Question Bank Tag Filter](https://github.com/crs4/moodle.qbank-tag-filter) -- Tag-based filtering for question bank management (MEDIUM confidence, official plugin)

### Item Response Theory
- [Wikipedia - Item Response Theory](https://en.wikipedia.org/wiki/Item_response_theory) -- IRT fundamentals, 1PL/2PL/3PL models (HIGH confidence)
- [Assessment Systems - IRT Difficulty Parameter](https://assess.com/irt-item-difficulty-parameter/) -- Difficulty parameter interpretation (HIGH confidence)
- [Assessment Systems - IRT Discrimination Parameter](https://assess.com/irt-item-discrimination-parameter/) -- Discrimination parameter interpretation (HIGH confidence)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Quality rule categories | HIGH | Well-established in item-writing literature (Haladyna), maps directly to project philosophy |
| Admin UI feature set | HIGH | Standard CMS/data-table patterns; no novel UI problems |
| CTT telemetry metrics | HIGH | Decades of psychometric research; well-defined formulas |
| AI pipeline quality gates | MEDIUM-HIGH | QUEST framework is recent (2025) but well-supported; iterative refinement is newer |
| Implementation complexity estimates | MEDIUM | Based on existing codebase structure; actual effort depends on team velocity |
| Review workflow design | MEDIUM | Adapted from enterprise CMS patterns; may need simplification for small team |

## Research Gaps

- **Minimum gameplay sessions for reliable telemetry:** How many times must a question be played before P-value and discrimination index are statistically meaningful? CTT literature suggests 30+ responses per item for stable estimates, but civic trivia may have lower play volume. Needs investigation during D-1 implementation.
- **Quality rule threshold tuning:** The scoring model (100-point scale, -25/-10/-3 penalties) is a starting proposal. Actual thresholds should be calibrated by running rules against the existing 320 questions and examining the distribution.
- **Admin UI framework choice:** The research does not specify whether to use the existing frontend framework or a separate admin-only framework. This is a stack decision for the STACK.md research.

---
*Research completed: 2026-02-19*
*Researcher: GSD Project Researcher (Features dimension)*
*Confidence: MEDIUM-HIGH overall*

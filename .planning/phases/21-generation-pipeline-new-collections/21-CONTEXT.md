# Phase 21: Generation Pipeline + New Collections - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Quality-gated AI question generation pipeline that embeds quality rules into prompts, validates generated output against the Phase 19 rules engine, and produces Indiana and California state question collections (80-100 each). Also generates replacement questions for collections that lost questions during Phase 19 archival. Does NOT include question editing (Phase 22) or new admin UI features.

</domain>

<decisions>
## Implementation Decisions

### Prompt strategy
- Claude's Discretion on format: whether to use summarized guidelines, full rules with examples, or a hybrid — pick what produces the best generation quality based on the existing Phase 19 rules
- Claude's Discretion on whether to include high-scoring existing questions as few-shot examples in prompts
- Distractor quality: Claude determines if existing quality rules cover plausibility sufficiently or if extra prompt guidance is needed
- When post-generation validation rejects a question, retry with feedback telling the AI why it failed (up to a retry limit)

### Generation workflow
- Auto-insert: questions that pass all quality rules go directly into the database as active — no pending/review state
- Claude's Discretion on batch size — pick based on API limits and cost efficiency
- Replacement questions for Phase 19 removals: mix of matching removed topics AND filling topic coverage gaps
- Detailed generation report required: stats on generated count, pass/fail breakdown, rejection reasons, retry outcomes, final inserted count — persisted as a report file

### State template design
- State questions cover both government structure (legislature, governor, agencies, constitution) AND broader civic topics (history, policy issues, civic processes like voting/taxes) — equal emphasis
- Mix of general state government concepts and state-specific unique features (e.g., Indiana's specific legislature structure, California's ballot proposition process)
- Soft topic guidance: template suggests topic areas (legislature, elections, history, civic processes, etc.) without enforcing strict counts per category
- Difficulty emerges naturally from topics — no forced distribution targets

### Collection targets
- Indiana and California chosen because they're alpha community locations: UX lead in Bloomington, IN (purple university town, poli-sci freshmen target demo); founder in LA, CA (potential foundational grant for LA municipality feature)
- State collections complement existing local city collections — goal is Local/State/Federal coverage for alpha communities
- Consistent style and tone across both states — same template, same approach, only content differs (avoids unintended editorial bias)
- Beginner-friendly knowledge level: no assumed civic knowledge, questions teach through options and explanations
- No must-have topics for either state — trust the template for balanced coverage

### Claude's Discretion
- Prompt format (guidelines vs rules vs examples vs hybrid)
- Whether to include existing high-scoring questions as reference
- Distractor quality prompt guidance
- Batch size for generation runs
- Exact topic categories in soft guidance

</decisions>

<specifics>
## Specific Ideas

- Target audience is poli-sci freshmen — questions should be engaging for people just starting to learn about civic structures
- Alpha communities: Bloomington, IN and Los Angeles, CA — these collections serve real users who will provide feedback
- "Play, not study" core value applies to generation — questions should reward reasoning, not rote memorization
- Existing city-level generation script exists at `backend/src/scripts/content-generation/generate-locale-questions.ts` — state template builds alongside this

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-generation-pipeline-new-collections*
*Context gathered: 2026-02-19*

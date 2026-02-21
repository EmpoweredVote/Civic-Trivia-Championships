# Phase 24: Question Generation & Review - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate ~100 quality-validated Fremont civic trivia questions across 8 topic categories, with cited sources, balanced difficulty, cultural sensitivity, and expiration timestamps. Questions must pass the established v1.3 quality framework. This phase covers generation, validation, and curation — not database seeding or collection activation (Phase 25).

</domain>

<decisions>
## Implementation Decisions

### Generation approach
- Claude's discretion on batch strategy (topic-by-topic vs all-at-once)
- Overshoot ~130 questions, curate down to ~100 best
- Sources: prefer specific URLs, but general authoritative sources acceptable when no specific page exists (e.g., "Fremont city charter")
- When a topic is under-sourced: broaden source types first (local news, community org sites), reduce topic count and redistribute only if still short

### Question voice & style
- Clean & direct tone — clear, not stuffy, not trying to be funny
- Explanations: informative context — neutral, educational, enough background to understand why the answer matters
- Difficulty distribution: skew easier — 40% easy, 40% medium, 20% hard
- Distractors scale with difficulty — easy questions have obvious wrong answers, hard questions have genuinely tricky ones

### Sensitivity & framing
- **Ohlone/Indigenous history:** Land acknowledgment framing — present tense, ongoing presence ("Ohlone people have lived here for thousands of years"), not purely past tense
- **Afghan-American / Little Kabul:** Cultural heritage focus — highlight cultural institutions, food, traditions, and how they've shaped Fremont's identity. Don't reduce to refugee/immigration narrative
- **Tesla/NUMMI:** Strictly civic only — zoning decisions, environmental review, job numbers, tax revenue. No questions about Tesla products, Elon Musk, or corporate strategy
- **Demographics/diversity:** Celebrate diversity, avoid statistics feel — focus on what makes Fremont diverse (cultures, institutions, events) rather than census-style data. No ranking communities against each other

### Review & quality workflow
- Auto-validate all questions against quality rules
- Spot-check sample (~20-30 questions) for gut-check — if sample looks good, bulk approve
- Failed questions: attempt fix once, then drop and replace if still failing
- Expiration timestamps: match known term end dates (e.g., mayor term ends Nov 2026). Use actual dates, not arbitrary defaults
- Final curation from ~130 to ~100: Claude's discretion balancing quality, diversity, and distribution targets

### Claude's Discretion
- Batch generation strategy (topic-by-topic vs all-at-once)
- Final curation method for selecting ~100 from ~130 pool
- Explanation style variations per question
- Source URL specificity when general references are acceptable

</decisions>

<specifics>
## Specific Ideas

- Mission San Jose questions must explicitly disambiguate between 1797 Spanish mission and modern Fremont district (per locale config)
- Five-district consolidation story (1956) should appear across multiple topic categories, not just civic history
- Election schedule documented: November 3, 2026 — use for expiration timestamps on current official questions
- California state sources already cached from LA collection — reuse where applicable

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-question-generation-review*
*Context gathered: 2026-02-21*

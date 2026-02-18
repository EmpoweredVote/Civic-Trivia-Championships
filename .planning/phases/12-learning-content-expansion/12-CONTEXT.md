# Phase 12: Learning Content Expansion - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand learning content coverage from ~15% to 25-30% of the existing 120-question bank (~30-36 questions with learning content). This means adding learning content to ~12-18 additional questions. Update the generation script to support the workflow. No new questions, no new question sets, no new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Content Prioritization
- Prioritize hard-difficulty questions first, then medium
- Use the existing `difficulty` field on questions as the selection criteria
- Claude's Discretion: balance difficulty priority with reasonable topic spread
- New content only — do not review or revise existing learning content
- Focus all effort on uncovered questions

### Content Depth & Tone
- Match existing content length: 2-3 paragraphs per piece
- Match existing content tone (check current 18 pieces and replicate)
- Same content shown regardless of player's answer (right, wrong, or timeout) — not answer-aware
- Include answer-specific corrections: explain why each wrong answer is wrong
- Just the facts — straightforward factual explanation, no anecdotes or embellishments
- Anti-partisan stance: actively remove partisanship from analysis, not merely "balanced"
- Plain language (8th grade reading level) — define jargon, short sentences, clear phrasing
- Mention specific dates, court cases, amendment numbers in passing — don't make them the focus
- Include inline hyperlinks to external sources within the text
- Acceptable link sources: .gov sites, educational orgs (Khan Academy, iCivics), Wikipedia, news archives
- Time-sensitive facts: include with "as of [date]" caveat

### Source Strategy
- Every factual claim must be verifiable against a primary source
- Each learning content piece should cite 1-2 sources (visible to player as inline links)
- Aligns with EmpoweredVote's transparency and accountability values
- Source links formatted as inline hyperlinks on key terms/facts within the text
- Human review via preview file workflow before merging into question bank

### Batch Workflow
- Update generateLearningContent.ts script to support new workflow
- 10-15 questions per batch
- Manual selection of which questions to generate content for (specify question IDs or topics)
- Cherry-pick acceptance: review batch, accept some, reject others, regenerate rejected
- Preview-before-commit workflow (existing pattern — generate to temp file for review)

### Claude's Discretion
- Topic spread balancing within difficulty-first priority
- Exact phrasing and sentence structure
- Which sources to link for each piece
- Script implementation details for cherry-pick and manual selection features

</decisions>

<specifics>
## Specific Ideas

- "Anti-partisan, not non-partisan" — EmpoweredVote distinguishes between tiptoeing down the middle (non-partisan) and actively removing partisanship from analysis (anti-partisan). Content should reflect this.
- EmpoweredVote spends significant effort on fact transparency and accountability elsewhere on their site — learning content source citations should feel consistent with that ethos.

</specifics>

<deferred>
## Deferred Ideas

- **Spreadsheet ingestion system** — Ability to ingest new question sets from a spreadsheet (question, topic, answers, correct answer, learn more info/links). New tooling capability — own phase.
- **LA County question set** — 120-question set specifically for Los Angeles County civics. New content domain — own phase.
- **Player answer challenge system** — Players can challenge/report outdated or incorrect answers. New capability — own phase.

</deferred>

---

*Phase: 12-learning-content-expansion*
*Context gathered: 2026-02-17*

# Phase 19: Quality Rules Engine - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Codify question quality as executable rules, audit all 320 existing questions against those rules, and archive questions that fail blocking violations. Collections that drop below minimum viable count are hidden from gameplay until replenished. The rules engine is reusable for Phase 21's generation pipeline.

</domain>

<decisions>
## Implementation Decisions

### Quality Rule Content
- **Priority anti-patterns (blocking):** Ambiguous/misleading questions are the worst offense, followed by pure lookup facts, then partisan framing
- **Ambiguity detection:** Check for answer overlap (multiple options too similar or both plausibly correct) AND vague qualifiers ("best", "most important", "primarily")
- **Pure lookup test:** Not about format (numbers/dates are fine). The test is "would knowing this make me a more interesting, civically engaged person?" Foundational knowledge (city council size, senators per state) passes. Obscure dates/names with no practical or social value (year of the Comstock Act) fail.
- **Structural checks:** Validate question length, explanation quality, and Learn More links — all three
- **Partisan framing:** Questions with politically biased framing should be flagged

### Severity Model
- **Two tiers:** Blocking (triggers archival) and advisory (flagged but stays active)
- **Strict blocking:** Ambiguous answers, misleading wording, broken Learn More links → blocking. Other issues (weak explanation, short question) → advisory
- **Quality score:** 0-100 numeric score per question, stored persistently in database (new column). Enables sorting/filtering in admin UI (Phase 20)
- **No score-based blocking:** Only specific blocking violations trigger archival. Score is informational for sorting/display, not an archival trigger

### Audit & Archival Behavior
- **Soft delete:** Add status column (active/archived) to questions. Archived questions stay in DB but are excluded from gameplay queries. Easy to restore
- **Dry-run report:** Both console summary (counts, per-collection breakdown, questions that would be archived) AND a generated markdown file for detailed inspection and record-keeping
- **Reusable command:** Build as a reusable script, not one-time. Will be re-run in Phase 21 when new questions are generated
- **Auto-archive with undo:** Archive immediately after audit (no manual review gate). Since it's soft delete, any question can be restored

### Collection Safety Thresholds
- **Minimum viable count:** 50 questions per collection
- **Below-threshold handling:** Archive bad questions regardless of count, then hide the collection entirely from the picker if it drops below 50
- **Hidden collections:** Disappear from picker completely — no grayed-out state, no explanation
- **Auto-re-enable:** When active question count crosses 50+ again (after Phase 21 replacements), collection automatically becomes visible. No manual admin action needed

### Claude's Discretion
- Exact scoring algorithm and weight distribution across rules
- How to detect partisan framing programmatically (heuristics vs keyword lists)
- Console output formatting for the audit summary
- How to handle edge cases in ambiguity detection

</decisions>

<specifics>
## Specific Ideas

- "When I collect knowledge, I want to collect interesting knowledge that when I share it with others, will make them think I am interesting" — this is the quality bar for what constitutes a good civic trivia question
- Pure lookup isn't about format — "How many people sit on your city council?" is great (foundational, useful), "What year was the Comstock Act?" is not (obscure, no practical value)
- The rules engine should be reusable since Phase 21 will need it for pipeline gating

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-quality-rules-engine*
*Context gathered: 2026-02-19*

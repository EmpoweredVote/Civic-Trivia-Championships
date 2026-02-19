# Phase 17: Community Content Generation - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate locale-specific civic trivia question banks for Bloomington IN and Los Angeles CA. Each collection gets ~100 questions sourced from authoritative references, seeded to the database, and playable through the existing collection picker. Content generation tooling is reusable for future locales.

</domain>

<decisions>
## Implementation Decisions

### Topic Coverage
- ~70% city/county level, ~30% state level for each locale
- Include civic history and cultural landmarks alongside government structure
- Both locales cover city + county + state levels (Bloomington: city + Monroe County + Indiana; LA: city + LA County + California)
- Include questions about current elected officials — set `expires_at` to term end dates so expiration system handles rotation
- Each locale gets 5-8 locale-specific topic categories (not mirroring federal categories — derive from the content)
- Target ~100 questions per locale (same count for both)
- Match federal difficulty distribution (easy/medium/hard ratio)
- Avoid partisan content — stick to structural/factual civics, no political parties, controversial votes, or divisive issues

### Question Style & Tone
- Same tone and format as federal questions — consistent game-show feel across all collections
- All distractors must be plausible local alternatives — no obviously wrong throwaway options
- Explanations cite the authoritative source directly (e.g., "According to bloomington.in.gov, the city council has 9 members.")
- Each question stands alone — no cross-references or assumptions about what the player has seen before

### Source Strategy
- Authoritative sources: .gov, .us, official city/county/state websites + university research (.edu) + established local media (Herald-Times, LA Times, etc.)
- Every question must have a verifiable source URL — no exceptions
- Match existing federal schema: single `source` + `sourceUrl` fields per question
- Source URLs cited in player-facing explanations for trust and transparency

### Generation Workflow
- Reusable generation script that accepts locale configuration — designed for adding future cities
- Batch review process: generate 20-30 questions at a time, human reviews/edits, then seed
- Questions go directly to database with 'draft' status — admin reviews and activates (no intermediate JSON file)
- Bloomington first, then LA — learn from the process, refine before second locale

### Claude's Discretion
- IU's civic role in Bloomington content (include if interesting and well-sourced)
- Whether to include learning content (deep-dives) from the start or just questions + explanations
- RAG pipeline direction (sources-first vs generate-then-verify)
- Specific topic categories for each locale (emerge from research)
- Specific must-have topics for each locale (research what's most important)

</decisions>

<specifics>
## Specific Ideas

- Current elected officials with expiration dates is a great showcase for Phase 16's expiration system — demonstrates the full lifecycle
- Bloomington covers city + Monroe County + Indiana state; LA covers city + LA County + California state
- Source hierarchy: .gov > .edu > established local media — prefer higher-authority sources when available
- "According to [source]..." citation style in explanations builds trust and teaches civic sourcing habits

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-community-content-generation*
*Context gathered: 2026-02-18*

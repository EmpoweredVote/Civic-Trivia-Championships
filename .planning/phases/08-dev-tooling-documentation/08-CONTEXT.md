# Phase 8: Dev Tooling & Documentation - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the generateLearningContent.ts script so it runs without errors and can produce new learning content. Complete missing v1.0 documentation (Phase 3 VERIFICATION.md and any other gaps). This phase does NOT add new question/answer ingestion frameworks or expand the question bank itself.

</domain>

<decisions>
## Implementation Decisions

### Content generation workflow
- Script outputs generated content to console/temp file for developer review before committing to data files
- Support both ANTHROPIC_API_KEY environment variable and .env file for API key configuration
- Generated content must include source citations from authoritative sources (e.g., .gov sites, constitutional text) for fact-checking

### Documentation standards
- Phase 3 VERIFICATION.md reconstructed from code analysis, not live testing (feature is already shipping)
- Fill in missing documentation AND do a light audit of existing docs to flag obvious inaccuracies
- Existing docs left as-is unless clearly wrong

### Claude's Discretion
- Batch mode vs single question generation approach (whatever fits the codebase best)
- Documentation depth per phase (thorough vs lightweight based on phase complexity)
- VERIFICATION format (checklist vs narrative — pick what's most useful for downstream reference)

</decisions>

<specifics>
## Specific Ideas

- User wants source citations required on generated content — this is a quality gate, not optional
- Preview-before-commit workflow means the script should NOT auto-modify data files

</specifics>

<deferred>
## Deferred Ideas

- Framework for creating and ingesting new question/answer sets — new capability, potential future phase
- Question bank expansion — separate from learning content, out of scope

</deferred>

---

*Phase: 08-dev-tooling-documentation*
*Context gathered: 2026-02-13*

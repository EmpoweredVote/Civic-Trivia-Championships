---
phase: 12-learning-content-expansion
plan: 01
subsystem: tooling
tags: [ai-generation, anthropic, content-pipeline, react, markdown, tsx, scripts]

# Dependency graph
requires:
  - phase: 08-dev-tooling-documentation
    provides: original generateLearningContent.ts script and preview-before-commit workflow
  - phase: 04-learning-content
    provides: LearnMoreModal component and LearningContent type structure
provides:
  - CLI-filtered content generation with --ids, --difficulty, --topic, --limit flags and safety guard
  - Updated AI prompt with plain language, anti-partisan framing, inline hyperlinks, expanded source allowlist
  - applyContent.ts cherry-pick merge script for applying preview JSON to questions.json
  - Inline markdown link rendering in LearnMoreModal paragraphs
affects:
  - Content workflow operators running batch generation
  - Future phases that extend LearnMoreModal or generation scripts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CLI argument parsing via raw process.argv (no library dependency)
    - Safety-guard pattern: scripts exit(1) with usage help when required flags missing
    - Preview-before-commit content workflow (generate -> review -> apply cherry-pick)
    - Inline markdown link rendering via regex without additional dependencies

key-files:
  created:
    - backend/src/scripts/applyContent.ts
  modified:
    - backend/src/scripts/generateLearningContent.ts
    - frontend/src/features/game/components/LearnMoreModal.tsx

key-decisions:
  - "Safety guard on generateLearningContent.ts: requires at least one filter flag to prevent accidental bulk generation"
  - "--ids flag takes priority over --difficulty/--topic in generateLearningContent.ts filter chain"
  - "renderParagraphWithLinks uses regex exec loop (no external library) for inline [text](url) rendering"
  - "Expanded source allowlist: added khanacademy.org, icivics.org, en.wikipedia.org, major news archives for historical events"
  - "Anti-partisan constraint in prompt: no liberal/conservative/activist characterization of policies or decisions"

patterns-established:
  - "Pattern: CLI scripts use raw process.argv parsing with a parseArgs() function before main()"
  - "Pattern: All content generation scripts use preview-then-apply workflow (never write directly to questions.json)"
  - "Pattern: Inline link renderer returns (string | JSX.Element)[] from regex exec loop"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 12 Plan 01: Content Tooling Update Summary

**CLI-filtered AI content generation with updated prompt (plain language, anti-partisan, inline hyperlinks) and cherry-pick merge script, plus inline markdown link rendering in LearnMoreModal**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-18T07:24:18Z
- **Completed:** 2026-02-18T07:26:48Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- generateLearningContent.ts now requires filter flags (--ids, --difficulty, --topic, --limit) and exits with usage help if none provided — prevents accidental bulk generation
- Updated AI prompt enforces plain language (8th grade), strict nonpartisan framing, inline [text](url) hyperlinks on key terms, expanded source allowlist, and as-of-date caveat for time-sensitive facts
- New applyContent.ts script enables cherry-pick merging of preview JSON into questions.json with --ids support, skip-on-existing behavior, and detailed summary output
- LearnMoreModal renders inline markdown links as teal clickable anchor tags without any new dependencies; existing content without links is unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Update generateLearningContent.ts with CLI flags and new prompt** - `1e7df9d` (feat)
2. **Task 2: Create applyContent.ts and add frontend inline link rendering** - `c9eaeab` (feat)

**Plan metadata:** (docs commit follows this summary creation)

## Files Created/Modified
- `backend/src/scripts/generateLearningContent.ts` - Added parseArgs(), safety guard, updated buildPrompt() with new requirements
- `backend/src/scripts/applyContent.ts` - New cherry-pick merge script for applying preview content to questions.json
- `frontend/src/features/game/components/LearnMoreModal.tsx` - Added renderParagraphWithLinks() helper and updated paragraph render sites

## Decisions Made
- Safety guard on generateLearningContent.ts requires at least one filter flag — script never defaults to processing all uncovered questions
- --ids flag takes priority over --difficulty and --topic in the filter chain; --limit applied last
- Inline link renderer uses a regex exec loop returning (string | JSX.Element)[] — no new dependencies needed
- Expanded source allowlist in prompt: .gov domains, khanacademy.org, icivics.org, en.wikipedia.org, major news archives for historical events only
- Prompt instructs anti-partisan framing: no liberal/conservative/activist characterization of any policy, party, or court decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Content generation tooling is ready for Phase 12 batch generation runs
- Operators can now run targeted batches: `npx tsx src/scripts/generateLearningContent.ts --difficulty hard --limit 15`
- After review, apply with: `npx tsx src/scripts/applyContent.ts generated-content-*.json --ids q076,q078`
- LearnMoreModal ready to render inline hyperlinks as AI-generated content includes them

---
*Phase: 12-learning-content-expansion*
*Completed: 2026-02-18*

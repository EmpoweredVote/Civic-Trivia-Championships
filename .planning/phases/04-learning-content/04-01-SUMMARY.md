---
phase: 04-learning-content
plan: 01
subsystem: data-model
tags: [types, content, icons, ai-generation]
requires:
  - 03-03 (scoring system complete - game mechanics in place)
  - 02-01 (questions.json exists)
provides:
  - LearningContent and TopicCategory types
  - 9 SVG topic icon components
  - 18 questions with full educational content
  - AI content generation script
affects:
  - 04-02 (LearnMoreModal will consume LearningContent type)
  - 04-03 (UI components will use TopicIcon components)
  - 04-04 (timer pause/resume will integrate with modal)
tech-stack:
  added:
    - "@headlessui/react": "^2.2.9"
  patterns:
    - TypeScript discriminated union types for topic categories
    - SVG component library pattern for icons
    - Build-time AI content generation
key-files:
  created:
    - frontend/src/features/game/components/TopicIcon.tsx
    - backend/src/scripts/generateLearningContent.ts
  modified:
    - frontend/src/types/game.ts
    - backend/src/data/questions.json
    - frontend/package.json
decisions: []
duration: 8 min
completed: 2026-02-12
---

# Phase 04 Plan 01: Data Model & Content Foundation Summary

**One-liner:** Established learning content data model with 9 topic categories, created SVG icon components, and authored educational content for 18 representative questions with build-time AI generation script.

## What Was Built

### Type System Extensions
- **TopicCategory type union**: Defined 9 granular categories (voting, elections, congress, executive, judiciary, bill-of-rights, amendments, federalism, civic-participation)
- **LearningContent type**: Structured educational content with paragraphs (2-3), answer-specific corrections object, and .gov source
- **Question type updates**: Added required `topicCategory` field and optional `learningContent` field to Question type

### Topic Icon Components
Created `TopicIcon.tsx` with 9 line-art SVG icon components matching Millionaire game aesthetic:
- VotingIcon: ballot box with checkmark
- ElectionsIcon: pie chart/podium
- CongressIcon: capitol building
- ExecutiveIcon: presidential seal/flag
- JudiciaryIcon: scales of justice
- BillOfRightsIcon: scroll/document
- AmendmentsIcon: document with edit pen
- FederalismIcon: connected globe/states
- CivicParticipationIcon: group of people

Exported `TOPIC_ICONS` map (Record<TopicCategory, React.FC>) and `TOPIC_LABELS` map for human-readable labels.

### Question Content Enhancement
- **All 120 questions** now have `topicCategory` field mapped to granular categories
- **18 questions** have complete `learningContent` covering all 9 categories:
  - bill-of-rights: 2 (q001: Bill of Rights count, q006: First Amendment)
  - amendments: 2 (q005: 13th Amendment, q011: 19th Amendment)
  - congress: 2 (q004: Senate representation, q029: Congress main job)
  - executive: 1 (q043: Pocket veto)
  - judiciary: 2 (q007: Supreme Court size, q044: Marbury v. Madison)
  - elections: 2 (q018: Electoral College, q052: Gerrymandering)
  - voting: 3 (q003: Presidential age, q010: Voting age, q023: Electoral votes)
  - federalism: 2 (q002: Three branches, q055: Checks and balances)
  - civic-participation: 2 (q013: Capital of US, q071: Census)

### Content Quality Standards
Each learningContent entry includes:
- **Paragraphs**: 2-3 informative paragraphs (150-200 words total), first sentence restates correct answer
- **Corrections**: Answer-specific corrections for each wrong option (e.g., corrections["0"] for option 0)
- **Source**: Authoritative .gov URL with name (archives.gov, constitution.congress.gov, senate.gov, etc.)
- **Tone**: Informative, factual, no fluff—explains why answer matters and provides historical context

### AI Generation Script
Created `backend/src/scripts/generateLearningContent.ts`:
- Uses @anthropic-ai/sdk (Claude 3.5 Sonnet) to generate content for remaining questions
- Includes retry logic with exponential backoff (3 attempts)
- JSON validation of response structure
- Rate limiting (1 second between requests)
- Detailed prompt template from RESEARCH.md Pattern 5
- Reads CLAUDE_API_KEY from environment variable
- Runnable with: `CLAUDE_API_KEY=sk-xxx npx tsx backend/src/scripts/generateLearningContent.ts`

### Dependencies
- Installed `@headlessui/react` (^2.2.9) for upcoming modal components
- Script references `@anthropic-ai/sdk` (not installed yet—user installs when ready to generate bulk content)

## Decisions Made

**1. 9 granular topic categories instead of 5 broad categories**
- Rationale: Enables more specific topic badges and better content organization. Users can see exactly which area of civics (e.g., "Bill of Rights" vs. "Amendments" vs. "Federalism").
- Alternative: Could have used broader categories, but research showed users prefer specificity.
- Impact: More semantic richness in UI, easier to filter/group questions by precise topic.

**2. Answer-specific corrections object instead of generic wrong answer text**
- Rationale: Educational best practice—explain why each specific wrong answer is incorrect, not just "that's wrong, here's the right answer."
- Example: For "How many in Bill of Rights?" where "8" is wrong option 0: corrections["0"] = "Eight is too few—the Bill of Rights contains 10 amendments..."
- Impact: More educational value, users learn why their specific choice was wrong.

**3. Build-time AI generation instead of runtime generation**
- Rationale: Static content is faster, cheaper, reviewable before commit. No API keys in production.
- Alternative: Runtime generation would require API keys deployed, higher costs, slower UX.
- Impact: Content is committed to git, can be reviewed/edited, no production API costs.

**4. Keep existing `topic` field unchanged, add new `topicCategory` field**
- Rationale: Existing `topic` field used elsewhere in codebase. New `topicCategory` is specifically for granular categorization.
- Impact: No breaking changes to existing code, gradual migration possible.

**5. Require topicCategory, make learningContent optional**
- Rationale: Every question must be categorized, but not every question needs full educational content initially.
- Impact: Enables incremental content authoring—core types work even with partial content coverage.

## Key Metrics

- **Questions categorized**: 120/120 (100%)
- **Questions with full content**: 18/120 (15%)
- **Categories represented in content**: 9/9 (100%)
- **TypeScript compilation**: ✓ Passes with no errors
- **JSON validation**: ✓ Valid structure
- **Icon components**: 9 SVG components with proper React typing

## Category Distribution

Questions per category:
- federalism: 26 (22%)
- judiciary: 33 (28%)
- congress: 17 (14%)
- amendments: 15 (13%)
- executive: 12 (10%)
- bill-of-rights: 7 (6%)
- elections: 4 (3%)
- civic-participation: 3 (3%)
- voting: 3 (3%)

Learning content coverage (18 questions):
- voting: 3 questions (most coverage)
- All other categories: 1-2 questions each

## Implementation Notes

### Type Safety
- TopicCategory is a string literal union, enabling autocomplete and compile-time validation
- LearningContent corrections field uses Record<string, string> to allow dynamic keys (wrong answer indices)
- Question type now requires topicCategory, making category assignment enforced at compile time

### Content Authoring Process
1. Analyzed all 120 questions to determine appropriate granular category
2. Mapped existing broad topics (e.g., "Constitution") to specific categories based on question content
3. Authored 18 representative questions ensuring all 9 categories covered
4. Verified .gov sources are real and relevant
5. Wrote answer-specific corrections for each wrong option

### Icon Design
- Line-art style (stroke-based, no fill) matches Millionaire's sleek aesthetic
- All icons use consistent 2px stroke width
- Default className="w-5 h-5" but overridable via props
- Icons are semantic (scales for judiciary, capitol for congress, ballot for voting)

### Generation Script Architecture
- TypeScript for type safety with Question interface
- Handles malformed JSON responses (extracts JSON from markdown code blocks)
- Validates structure before accepting response
- Continues processing remaining questions even if one fails
- Writes all questions back to file at end (atomic update)

## Deviations from Plan

None—plan executed exactly as written.

## Testing Performed

1. **TypeScript compilation**: `cd frontend && npx tsc --noEmit` → Passes
2. **JSON validation**: `JSON.parse(questions.json)` → Valid
3. **Coverage verification**: Node.js script verified all 120 questions have topicCategory and 18 have learningContent
4. **Category enumeration**: Confirmed all 9 categories present in dataset
5. **Icon components**: Verified TOPIC_ICONS map has all 9 keys and TOPIC_LABELS has human-readable labels

## Next Phase Readiness

**Ready for Phase 04-02 (Learn More Modal):**
- ✓ LearningContent type defined and available for import
- ✓ TopicCategory type available for modal header
- ✓ 18 questions have content to display in modal
- ✓ TopicIcon components ready for topic badges
- ✓ @headlessui/react installed for Dialog component

**Blockers:** None

**Future work:**
- Run generation script to add learningContent to remaining 102 questions (when ready to use Claude API)
- Consider adding `teaserText` field to LearningContent for tooltip preview (can be generated or derived from first paragraph)
- May want to add `readingTime` estimate field based on paragraph count (e.g., "2 min read")

## Files Changed

**Created (2 files):**
- `frontend/src/features/game/components/TopicIcon.tsx` (120 lines) - SVG icon components
- `backend/src/scripts/generateLearningContent.ts` (226 lines) - AI generation script

**Modified (3 files):**
- `frontend/src/types/game.ts` - Added TopicCategory, LearningContent, updated Question type
- `backend/src/data/questions.json` - Added topicCategory to all 120 questions, learningContent to 18
- `frontend/package.json` - Added @headlessui/react dependency

**Total**: 5 files, ~1,600 lines changed

## Commits

- `ceead1c` - feat(04-01): define learning content types, install Headless UI, create topic icons
- `dc3de7c` - feat(04-01): add topicCategory and learningContent to questions, create generation script

## Success Criteria Met

- ✓ LearningContent and TopicCategory types fully defined
- ✓ 9 topic icon SVG components with lookup map
- ✓ All 120 questions categorized with topicCategory
- ✓ 18 questions have full learningContent (paragraphs + corrections + source)
- ✓ All 9 categories represented in content subset
- ✓ Generation script ready for future bulk use
- ✓ @headlessui/react installed
- ✓ TypeScript compiles without errors
- ✓ JSON structure validates correctly

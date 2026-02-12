# Phase 4: Learning & Content - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can access deeper educational content without leaving the game flow. This includes "Learn More" modals during answer reveal, expanded question-specific explanations, topic categorization, and topic review from the results screen. Content is AI-generated at build time and stored as static data.

</domain>

<decisions>
## Implementation Decisions

### "Learn More" Trigger & Timing
- Styled button in the lower right corner of the answer reveal area
- Button only appears when expanded content exists for that question
- Button fades in subtly after the answer reveal settles
- Tooltip/popover auto-shows briefly (2-3 seconds) with the first sentence of expanded content, then collapses to just the button
- Tapping anywhere dismisses the tooltip early
- Tapping the button (or popover "Read more") opens the full centered card modal
- Keyboard shortcut 'L' opens Learn More during reveal
- Opening the modal pauses the auto-advance timer
- Game behind the modal is visually dimmed to show paused state
- Closing the modal resumes the auto-advance timer where it left off (not reset)
- Content is also accessible from the results screen (not a one-time opportunity)
- No read-state tracking on the button

### Modal Content & Tone
- Informative and clear tone — factual, straightforward, no fluff
- 2-3 paragraphs of question-specific content (not generic topic content)
- Content restates the correct answer explicitly so it stands alone as educational material
- Answer-aware opening lines:
  - Correct answer: Generic "That's right!" opener
  - Wrong answers: Each wrong answer option has its own specific correction (e.g., "No, Congress serves 2-year terms — but Senators have 6-year terms.")
  - Timeout: Encouraging opener (e.g., "Time's up! Here's what you should know...")
- Claude decides paragraph structure (e.g., why it matters + details + fun fact)
- Custom line-art icons per topic category (small set of category icons reused across questions)
- Source citation at bottom with link opening in new tab (e.g., "Source: constitution.congress.gov")
- Centered card modal, scrollable content within the modal
- No header/title — dive straight into the content
- Clear X button in corner plus tap-outside-to-close
- Escape key closes the modal
- Claude decides modal transition animation

### Content Data Model
- Topics span multiple questions (a topic like "Electoral College" maps to several questions)
- 8-10 granular topic categories (e.g., Voting, Elections, Supreme Court, Congress, Bill of Rights, Executive Power, Amendments, Judicial Review, etc.)
- Despite shared topics, each question has unique expanded explanation content
- Each wrong answer option has a "correction" field explaining why it's wrong
- Content is AI-generated at build time and committed as static data
- Claude decides storage location (inline vs separate file)
- Claude decides source citation data model

### Results Screen Topics
- Topic category tag displayed per question in the existing accordion/question breakdown
- All questions with "Learn More" content are tappable from results to open the modal
- Just topic names shown — no accuracy-per-category stats
- Claude decides exact placement relative to existing results content

### Claude's Discretion
- Mobile UX for the two-step tooltip → modal flow (first tap behavior)
- Modal transition animation style
- Content paragraph structure
- Storage model for expanded content (inline vs separate files)
- Source citation data structure
- Skip-ahead behavior after closing modal
- Results screen placement of topic section
- Exact topic category list (8-10 granular categories based on question bank content)

</decisions>

<specifics>
## Specific Ideas

- Two-step reveal: button → auto-showing tooltip with teaser → full modal. Not just a button that opens a modal.
- Answer-specific corrections are the key educational differentiator — "No, Congress serves 2-year terms" is more memorable than "Incorrect."
- Custom line-art icons should match the Millionaire game aesthetic, one icon per topic category
- Content should be AI-generated at build time for efficiency, then committed as static data for review

</specifics>

<deferred>
## Deferred Ideas

- **Question theme/category selection** — User wants to choose themes (Local, State, Judicial, Current Events, etc.) when starting a game. This is a new capability — belongs in its own phase or as a roadmap backlog item.

</deferred>

---

*Phase: 04-learning-content*
*Context gathered: 2026-02-12*

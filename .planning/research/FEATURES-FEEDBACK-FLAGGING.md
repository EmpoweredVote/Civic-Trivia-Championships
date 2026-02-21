# Feature Landscape: In-Game Question Feedback & Flagging

**Domain:** Trivia app question feedback and flagging systems
**Researched:** 2026-02-21
**Project Context:** Adding feedback/flagging to existing civic trivia game with 639 questions, 6 collections, admin UI, and quality rules engine

## Executive Summary

In-game question feedback systems in trivia and educational apps serve two distinct purposes: **quality curation** (helping improve content) and **policy enforcement** (removing harmful content). The best implementations minimize flow interruption, collect actionable feedback, and provide admins with efficient triage tools. For this project, the focus is on quality curation — letting authenticated players flag questions they dislike and providing optional context to help admins improve content.

**Key insight:** The timing and friction of feedback collection dramatically affects both user experience and data quality. Successful systems collect feedback at the moment of dissatisfaction (inline during gameplay) but defer elaboration to post-game to avoid flow interruption.

## Table Stakes

Features users expect. Missing = system feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Inline flag button** | Players need to mark dissatisfaction at the moment they feel it | Low | Thumbs-down or flag icon on answer reveal screen. Duolingo uses flag icon after answer submission. Must be discoverable but not intrusive. |
| **Visual confirmation of flag** | Users need feedback that their action registered | Low | Button state change (filled icon, color shift) + optional subtle animation. No modal/popup needed. |
| **Authenticated-only flagging** | Prevents spam, enables rate limiting, allows curator reputation tracking | Low | Anonymous users see no flag button. Prevents abuse patterns documented in moderation research. |
| **Admin review queue** | Admins need centralized list of flagged content to triage | Medium | Standard moderation pattern. Show flag count, question text, player notes. Kahoot reviews flagged content within 24 hours. |
| **Flag count visibility** | Admins need to prioritize high-volume flags | Low | Display count in review queue and on question detail views. Common pattern in moderation dashboards. |
| **Archive action from queue** | Admins must be able to act on flags efficiently | Low | One-click archive directly from review queue. Reduces workflow friction. |
| **No notification to player** | Flagging is private quality curation, not public reaction | Low | Like/dislike distinction: thumbs-down is private moderation, not visible to others. Prevents social pressure. |

## Differentiators

Features that set product apart. Not expected, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Post-game elaboration** | Collects rich context without interrupting flow | Medium | Progressive disclosure pattern: flag inline, elaborate post-game. Minimizes flow interruption while maximizing actionable feedback. |
| **Optional free-text feedback** | Respects player time while allowing those who care to elaborate | Low | Make feedback optional. Most users won't elaborate, but passionate curators will provide valuable insights. |
| **Flagged questions shown in post-game summary** | Reminds player which questions they flagged, provides context for feedback | Medium | Show flagged questions in post-game results with optional text input per question. Duolingo pattern: report options appear after answer submission. |
| **Multiple flag reasons** | Helps admins understand problem patterns (factually wrong vs unclear vs uninteresting) | Medium | Structured categories + free text. But for MVP, free text alone is sufficient — patterns emerge from text analysis. |
| **Flag status indicator** | Shows players their feedback is being considered | Medium | "Under review" or "Resolved" status. Builds trust but adds complexity. Consider for future iteration. |
| **Admin filter by flag count threshold** | Focus on high-signal flags (5+ flags = likely real problem) | Low | Filter review queue by min flag count. Single-flag items may be player error or preference, not quality issue. |
| **Inline flag context in question detail** | Show flag history without navigating to separate queue | Low | Display recent flags with player notes on existing question detail panel. Contextualizes flags during normal admin workflows. |
| **Bulk actions in review queue** | Archive multiple flagged questions at once if pattern is clear | Medium | Checkboxes + bulk archive. Efficiency gain for large flag volumes, but may not be needed at current scale (639 questions). |
| **Player curator stats** | Track flags-per-player to identify helpful curators vs spammers | Medium | Foundation for future reputation system. Collect data now, act later. Simple count column on users table. |
| **Rate limiting on flags** | Prevent abuse while allowing legitimate heavy users | Medium | E.g., max 20 flags per game session, 100 per day. Authenticated users get higher limits than anonymous (if anonymous allowed). |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Public dislike counts** | Creates negative social proof, discourages engagement, feels hostile | Keep flags private. Admin-only visibility. Focus on quality curation, not popularity contest. |
| **Require explanation on flag** | Interrupts flow, creates friction, reduces flagging rate | Make explanation optional. Collect inline flag (low friction), defer elaboration to post-game (progressive disclosure). |
| **Auto-archive at flag threshold** | Removes human judgment, can be gamed, punishes controversial but valuable questions | Always require human review. Flag count informs priority, doesn't automate decisions. |
| **Flag modal popup** | Breaks game flow, feels heavy-handed, reduces completion rate | Use button state change only. No modals during gameplay. |
| **Notify question author** | Discourages flagging (social pressure), not relevant for admin-curated content | Flags are for admins, not authors. This is quality curation, not social feedback. |
| **"Report problem" language during gameplay** | Sounds like a bug, feels heavy, interrupts flow | Use "thumbs-down" or "dislike" metaphor. "Report" implies system failure, not content preference. Save "report" for policy violations (future: harmful content). |
| **Allow anonymous flagging** | Opens door to spam, makes rate limiting ineffective, prevents reputation tracking | Restrict to authenticated users. Anonymous play is allowed, but feedback requires account. |
| **Force flag reason selection** | Adds friction, slows flagging rate, reduces volume of flags | Allow flag without reason. Optional categories or free text post-game. Low friction = more data. |
| **Show flags to players during gameplay** | Creates anxiety, negative focus, undermines learning-positive tone | Never show flag counts or "this question was flagged" to players. Maintain positive, encouraging tone. |
| **Auto-escalate to moderation team** | Flag = quality feedback, not policy violation. Creates unnecessary process overhead | Flags stay in admin review queue. No escalation needed unless harmful content is detected (rare in trivia). |
| **Daily flag quota/gamification** | Turns quality curation into obligation, encourages frivolous flags | No quotas, no badges for flagging. Flagging is opt-in quality contribution, not game mechanic. |

## Feature Dependencies

Understanding how features relate to existing system:

```
Existing Features Required:
- Auth system (JWT, email/password) → enables authenticated-only flagging
- Answer reveal screen → placement for inline flag button
- Post-game results screen → location for elaboration step
- Admin UI question detail panel → display inline flag count
- Question database schema → store flag relationship

New Features This Milestone:
1. Inline flag button (answer reveal screen, authenticated only)
   ↓
2. Flag state stored (user_question_flags table)
   ↓
3. Post-game flagged questions summary (show which Qs flagged)
   ↓
4. Optional elaboration per flagged question (free text)
   ↓
5. Admin flag count (question list + detail panel)
   ↓
6. Admin review queue (flagged questions + player notes)
   ↓
7. Archive action from queue (direct action)

Future Dependencies (out of scope for this milestone):
- Curator reputation (requires flag history per player)
- Auto-weighting by curator quality (requires reputation + ML)
- Flag categories (requires UI + analytics to prove value)
```

## MVP Recommendation

For v1.5 Feedback Marks milestone, prioritize:

### Must Have (Table Stakes)
1. **Inline thumbs-down button** on answer reveal screen
   - Authenticated users only
   - Visual confirmation (button state change)
   - No modal, no interruption

2. **Post-game flagged questions summary**
   - Show list of questions player flagged this game
   - Optional free-text input per question
   - Skip button (don't force elaboration)

3. **Admin review queue**
   - List all flagged questions
   - Show flag count per question
   - Display player notes (if provided)
   - Archive button per question

4. **Flag count in question list/detail**
   - Inline count on existing admin question views
   - Click to jump to review queue filtered to that question

### Nice to Have (Differentiators)
5. **Filter review queue by flag count** (Low complexity, high value)
   - Show only questions with 3+ flags
   - Focus on high-signal issues first

6. **Basic rate limiting** (Medium complexity, prevents abuse)
   - Max 20 flags per game session (8 questions)
   - Simple check: player can't flag more than 2.5x questions per game

7. **Player flag stats** (Low complexity, data foundation)
   - Add `flags_submitted_count` to users table
   - Increment on flag, display in admin user view
   - Future: use for curator reputation

### Defer to Post-MVP

- Flag reason categories (free text is sufficient for now)
- Flag status tracking (under review / resolved)
- Bulk archive actions (not needed at 639 question scale)
- Auto-weighting by curator reputation (needs data collection first)
- Sophisticated rate limiting (per-day limits, user-based thresholds)

## User Flow Comparison: Inline vs Post-Game Only

**Pattern A: Inline flag only (thumbs-down, no elaboration)**
- Pro: Zero flow interruption, very low friction
- Con: No context for admins, hard to diagnose issues
- Best for: High-volume apps where patterns emerge from flag counts alone

**Pattern B: Inline flag + modal for reason**
- Pro: Captures context immediately
- Con: Breaks flow, reduces flagging rate, feels heavy
- Best for: Low-volume, high-stakes content (customer support, professional platforms)

**Pattern C: Inline flag + post-game elaboration (RECOMMENDED)**
- Pro: Low friction inline, rich context post-game, respects player flow
- Con: Slightly more complex implementation
- Best for: Games and learning apps where flow matters (Duolingo, trivia apps)
- Why: Progressive disclosure minimizes interruption while maximizing feedback quality

## Real-World Examples

### Duolingo
- **Pattern:** Flag icon after answer submission
- **Options:** "My answer should be accepted," "Audio is missing," "Dictionary hints wrong"
- **Timing:** Inline during exercise
- **Elaboration:** Not explicitly mentioned, but report button suggests structured options
- **Admin:** Course maintainers review flagged content
- **Source:** [Duolingo Help Center - How do I report a problem](https://support.duolingo.com/hc/en-us/articles/204752124-How-do-I-report-a-problem-with-a-sentence-or-translation-)

### Kahoot
- **Pattern:** Flag button on public kahoots (content discovery)
- **Options:** Category + sub-category selection, optional text, specify words/pictures
- **Timing:** Not during gameplay, from browse/discover views
- **Visibility:** Red banner on flagged kahoot, removed from search
- **Review:** Human moderators review within 24 hours
- **Action:** Quarantine if violates terms, creator notified
- **Source:** [Kahoot Help - How to flag inappropriate content](https://support.kahoot.com/hc/en-us/articles/115001711568-How-to-flag-inappropriate-Kahoot-content)

### TikTok Comments (dislike distinction)
- **Pattern:** Dislike button on comments (not videos)
- **Purpose:** Quality curation, not policy enforcement
- **Visibility:** Private (disliker and disliked user both unaware)
- **Action:** Reduces comment visibility, doesn't trigger moderation review
- **Distinction:** Separate "report" button for policy violations
- **Source:** [Delivered Social - TikTok Dislike Button Explained](https://deliveredsocial.com/tiktok-dislike-button-explained-will-it-change-the-algorithm/)

### Key Takeaway
**Dislike ≠ Report:** Successful platforms distinguish between quality curation (dislike/thumbs-down, private, affects ranking) and policy violations (report/flag, triggers moderation). For civic trivia, we're building quality curation, not content moderation.

## Implementation Patterns

### Progressive Disclosure (Game Flow)
```
Question 1 → Answer → Reveal → [👎 button (optional)] → Next
Question 2 → Answer → Reveal → [👎 button (optional)] → Next
...
Question 8 → Answer → Reveal → [👎 button (optional)] → Results

Results Screen:
- Score, XP, gems (existing)
- "You flagged 2 questions" (new)
  - Question 3: "Which branch confirms judges?"
    [Optional: Why did you dislike this? ___________]
  - Question 7: "What is the city budget?"
    [Optional: Why did you dislike this? ___________]
- [Skip] [Submit Feedback]
```

### Admin Review Queue
```
Flagged Questions (23)
Filter: [All] [5+ flags] [10+ flags]

┌─────────────────────────────────────────────────┐
│ Federal                               🚩 12     │
│ Which branch of government confirms judges?     │
│                                                 │
│ Player feedback (5 notes):                     │
│ • "Could be Senate or President depending on   │
│    how you read it"                            │
│ • "Confusing wording"                          │
│ • "Trick question"                             │
│ [View Question] [Archive]                      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Bloomington IN                        🚩 7      │
│ What is the city's annual budget?               │
│                                                 │
│ Player feedback (3 notes):                     │
│ • "This is a lookup fact, not interesting"     │
│ • "Changes every year, will be wrong soon"     │
│ [View Question] [Archive]                      │
└─────────────────────────────────────────────────┘
```

### Rate Limiting Strategy
```
Simple approach (recommended for MVP):
- Max 8 flags per game (1 per question)
- No additional per-day limit (auth requirement handles abuse)
- Track flags_submitted_count on users table for future weighting

Future approach (if abuse detected):
- Max 20 flags per game session
- Max 100 flags per 24 hours
- Graduated limits by curator reputation:
  - New users: 50/day
  - Trusted curators: 200/day
  - Admin review if >500/day
```

## Confidence Assessment

| Area | Confidence | Source Quality |
|------|------------|----------------|
| Progressive disclosure pattern | HIGH | Multiple sources (NN/g, game UX research, educational game studies) confirm flow preservation is critical |
| Authenticated-only rationale | HIGH | Content moderation best practices, rate limiting research, spam prevention documentation |
| Admin queue patterns | MEDIUM | Stream, PubNub, and forum moderation docs show common patterns, but less trivia-specific |
| Flag vs dislike distinction | HIGH | TikTok, social platform research clearly distinguish quality curation from policy enforcement |
| Inline timing | MEDIUM | Duolingo example + game flow research support inline placement, but fewer trivia-specific sources |
| Rate limiting specifics | LOW | General API rate limiting well-documented, but trivia-specific thresholds require experimentation |

## Open Questions

1. **Should we show flag counts to admins on question list view, or only in review queue?**
   - Recommendation: Both. Inline counts provide context during normal admin workflows.

2. **Should archived questions remain in review queue with "Archived" status, or disappear?**
   - Recommendation: Disappear by default, add "Show archived" filter for audit trail.

3. **Should we limit elaboration text length?**
   - Recommendation: Yes, 500 characters max. Keeps feedback focused, prevents essay submissions.

4. **Should we allow players to flag the same question multiple times (across games)?**
   - Recommendation: No. One flag per user per question, period. Prevents spam, keeps flag count meaningful.

5. **Should admin review queue show most-recent flags first, or highest-count first?**
   - Recommendation: Highest-count first. High flag count = likely real problem. Recent flags may be outliers.

## Accessibility Considerations

| Concern | Solution |
|---------|----------|
| Thumbs-down button keyboard access | Standard button, focusable, Enter/Space triggers |
| Screen reader feedback on flag | Announce "Question flagged" after button press |
| Flag button contrast | Ensure 4.5:1 contrast for icon/text against background |
| Post-game elaboration form labels | Explicit labels for each textarea, not placeholder-only |
| Review queue keyboard nav | Tab through questions, Enter to view details, Shift+A to archive |

## Analytics to Track (Future)

Not required for v1.5, but valuable for understanding system health:

- Flags per game (avg/median/p95)
- Flag rate by question (flags per 100 encounters)
- Elaboration rate (% of flags with text feedback)
- Admin action rate (% of flags resulting in archive)
- Time-to-triage (hours between flag and admin action)
- Curator accuracy (% of flags leading to archive, by player)

## Sources

### In-Game Feedback Patterns
- [How to Collect and Use Player Feedback Effectively for Game Improvement](https://www.thegamemarketer.com/insight-posts/how-to-collect-and-use-player-feedback-effectively-for-game-improvement)
- [In-game Feedback Forms](https://www.gamedeveloper.com/programming/in-game-feedback-forms)
- [How Player Feedback Shapes Game Development](https://betahub.io/blog/2025/03/19/feedback-in-gamedev.html)

### Progressive Disclosure
- [Progressive Disclosure - NN/G](https://www.nngroup.com/articles/progressive-disclosure/)
- [Investigating the Impact of Progress Feedback and Tutorials](https://link.springer.com/chapter/10.1007/978-3-031-92578-8_1)
- [Progressive Disclosure in UX design - LogRocket](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)

### Real-World Examples
- [Duolingo Help - Report a Problem](https://support.duolingo.com/hc/en-us/articles/204752124-How-do-I-report-a-problem-with-a-sentence-or-translation-)
- [Kahoot - Flag Inappropriate Content](https://support.kahoot.com/hc/en-us/articles/115001711568-How-to-flag-inappropriate-Kahoot-content)
- [TikTok Dislike Button Explained](https://deliveredsocial.com/tiktok-dislike-button-explained-will-it-change-the-algorithm/)

### Content Moderation Best Practices
- [Content Moderation: Types, Tools & Best Practices](https://getstream.io/blog/content-moderation/)
- [8 best practices for content moderation strategy](https://sendbird.com/blog/content-moderation-strategy)
- [User Generated Content Moderation](https://www.cmswire.com/digital-marketing/8-tips-for-effective-user-generated-content-moderation/)

### Rate Limiting & Abuse Prevention
- [The Complete Rate Limiting Handbook](https://saascustomdomains.com/blog/posts/the-complete-rate-limiting-handbook-prevent-abuse-and-optimize-performance)
- [What is rate limiting and how can it protect a system](https://www.designgurus.io/answers/detail/what-is-rate-limiting-and-how-can-it-protect-a-system-from-abuse-or-overload)

### Admin Moderation Tools
- [Build Moderation Dashboard - Stream](https://getstream.io/moderation/docs/quick-start/build-moderation-dashboard/)
- [Review Queues - Stack Overflow](https://internal.stackoverflow.help/en/articles/8075993-review-queues)
- [Reviewing Content - Stream Moderation](https://getstream.io/moderation/docs/dashboard/reviewing-content/)

### UX Anti-Patterns
- [Dark Patterns in UX Design 2026](https://bitskingdom.com/blog/what-are-dark-patterns/)
- [Anti-Patterns of User Experience Design](https://www.ics.com/blog/anti-patterns-user-experience-design)

### Educational Game Research
- [User Experience of Educational Games: A Review](https://www.sciencedirect.com/science/article/pii/S187705091503584X)
- [E-Guess: Usability Evaluation for Educational Games](https://www.researchgate.net/publication/344305440_E-Guess_Usability_Evaluation_for_Educational_Games)

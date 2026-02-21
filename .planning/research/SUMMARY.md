# Project Research Summary: v1.5 Feedback Marks

**Project:** Civic Trivia Championship - v1.5 Feedback Marks
**Domain:** Trivia game question feedback/flagging system + content quality improvements
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

The v1.5 Feedback Marks milestone adds player-driven quality control to Civic Trivia Championship through a two-part feedback system: inline thumbs-down during gameplay (low friction, captures dissatisfaction at the moment) and optional post-game elaboration (provides actionable context without interrupting flow). This pattern, validated by Duolingo and educational game research, follows the **progressive disclosure** principle that minimizes interruption while maximizing feedback quality.

Research reveals a critical distinction: **dislike/thumbs-down is quality curation** (private, helps improve content), not "report" (policy enforcement, removes harmful content). Successful trivia and educational apps keep feedback private, restrict to authenticated users to prevent spam, and provide admins with efficient triage tools. The recommended architecture integrates cleanly with the existing game session management (Redis), admin UI (React + TanStack Table), and database (PostgreSQL + Drizzle ORM) — only one new dependency required (`express-rate-limit`).

The milestone also addresses technical debt: fixing 320 broken source.url Learn More links (identified across all collections) and adding ADMIN_EMAIL environment variable for admin promotion workflow. These are small scope additions that piggyback on the feedback feature's data migration and testing infrastructure.

Key risks center on **flow interruption** (intrusive feedback UI destroys engagement), **feedback black hole** (players stop flagging if nothing happens), and **authentication bypass** (spam floods moderation queue). Each has well-established mitigation patterns from content moderation and educational game research.

## Key Findings

### Recommended Stack (from STACK.md)

The feedback system requires minimal new dependencies because the existing stack already provides authentication (JWT), validation (express-validator 7.3.1), database ORM (Drizzle 0.45.1), state management (Zustand), and PostgreSQL. The primary addition is rate limiting middleware to prevent feedback spam.

**Core technologies:**
- **express-rate-limit (^7.4.1)**: Rate limiting middleware — prevents spam flags from malicious users. Industry standard with 10M+ weekly downloads, supports per-user limits and admin bypass.
- **express-validator (existing)**: Input validation and XSS sanitization — `.escape()` sanitizer sufficient for free-text feedback (max 500 characters). No additional XSS libraries needed.
- **Drizzle ORM (existing)**: Database schema extensions — new `question_flags` table with indexes on `questionId`, `userId`, `createdAt`. Denormalized `flag_count` column on questions table with trigger for fast admin queries.

**What NOT to add:**
- No axios (Fetch API sufficient for simple POST endpoints)
- No react-hook-form (feedback form is simple, controlled inputs sufficient)
- No separate XSS library (express-validator covers needs)
- No rate-limit-redis (single-server deployment, memory store sufficient)

### Expected Features (from FEATURES-FEEDBACK-FLAGGING.md)

**Must have (table stakes):**
- **Inline flag button** — Thumbs-down icon on answer reveal screen. Must be discoverable but not intrusive. Authenticated users only.
- **Visual confirmation** — Button state change (filled icon, color shift) without modal/popup. No interruption to game flow.
- **Admin review queue** — Centralized list of flagged content with flag count, question text, player notes. One-click archive action.
- **Flag count visibility** — Display count in review queue and question detail views for admin prioritization.

**Should have (competitive differentiators):**
- **Post-game elaboration** — Show flagged questions in results screen with optional free-text input. Progressive disclosure pattern avoids flow interruption.
- **Filter by flag count threshold** — Admin queue filter (e.g., 5+ flags) focuses on high-signal issues.
- **Basic rate limiting** — Max 10 flags per 15 minutes per user. Prevents abuse while allowing legitimate heavy users.
- **Inline flag context** — Display recent flags with player notes on existing question detail panel without navigating to separate queue.

**Defer (v2+):**
- Flag reason categories (free text sufficient for MVP, patterns emerge from analysis)
- Flag status tracking (under review / resolved — adds complexity)
- Bulk archive actions (not needed at 639 question scale)
- Curator reputation system (collect flags_submitted_count now, weight later)
- Auto-weighting by curator quality (requires data collection first)

### Architecture Approach (from ARCHITECTURE.md)

The feedback system integrates with existing game flow without breaking changes. Players flag questions during the answer reveal phase, session tracks flagged questionIds in Redis, post-game summary displays flagged questions with optional elaboration, and a new database table stores persistent feedback for admin review.

**Major components:**
1. **Game Session (Redis)** — Add `feedbackFlags: Set<string>` field to track which questions flagged during gameplay. Temporary storage, doesn't persist beyond 1-hour session TTL.
2. **Answer Reveal Screen** — Thumbs-down button in bottom-left corner (24x24px, semi-transparent). Tap toggles visual state, updates session via existing POST /api/game/answer endpoint with optional `flagged: boolean`.
3. **Post-Game Summary** — New "Flagged Questions" section above answer review accordion. Shows question text (truncated) with optional 500-char textarea per flagged question. Submit button POST /api/feedback/submit.
4. **Database Schema** — New `question_flags` table (id, question_id, user_id, session_id, feedback_text, created_at) with indexes. Denormalized `flag_count` on questions table maintained by trigger.
5. **Admin Integration** — Add `flag_count` column to QuestionTable with red badge if > 0. Question detail panel shows count + "View Flags" link. New FlagsReviewPage at `/admin/flags` lists all flagged questions with archive action.

**Key design decisions:**
- Extend POST /api/game/answer (not new endpoint) — single request, matches mental model of "flag as part of answering"
- Store flags in session first, persist to database post-game — consistent with existing answer pattern, allows player to change mind
- Denormalized flag_count — fast admin queries without JOIN, trigger maintains consistency
- Store DB ID in session alongside Question — avoids N queries per feedback submission when mapping frontend string IDs to database numeric IDs

### Critical Pitfalls (from PITFALLS-FEEDBACK-FLAGGING.md)

1. **Breaking Game Flow with Intrusive Feedback UI** — Modal dialogs during gameplay destroy engagement and cause abandonment. **Prevention:** Position thumbs-down as passive indicator during answer reveal (no modal), defer elaboration to post-game screen. Follow 2025 UX consensus: "timing and context are critical" for interruptions.

2. **The Feedback Black Hole - Not Closing the Loop** — Players stop flagging if they never learn what happened. **Prevention:** Send automated thank-you when flag submitted, notify flaggers when report led to action (archive/correction), show aggregate impact ("Your flags helped improve 12 questions this month"). Build loop closure into phase requirements, not post-launch.

3. **Data Model Can't Track Flag Lifecycle** — Initial schema stores flags as simple records without status tracking, timestamps, or resolution metadata. Later analytics and audit trails impossible without painful migration. **Prevention:** Design for lifecycle from start (pending → reviewing → resolved), include timestamp columns (created_at, reviewed_at, resolved_at), use soft delete (archived_at, archived_by), track question versions.

4. **Authentication Bypass Allows Anonymous Flag Spam** — Frontend hides UI but backend endpoint lacks auth check. Anonymous spam floods moderation queue. **Prevention:** Backend auth check on flag endpoint (reject unauthenticated), rate limiting per user ID, integration test attempting flag submission without auth token, monitor flag submission patterns.

5. **Stale Admin Dashboard Counts** — Admin sees "3 pending flags," clicks through, finds 15. Or resolves flag, refreshes, still shows old count. **Prevention:** Add "last updated" timestamp to dashboard, implement cache invalidation on flag status change, aggressive cache TTL (30 seconds max), visual indicator for live vs stale data.

## Implications for Roadmap

Based on research, v1.5 Feedback Marks milestone should follow a four-phase structure that prioritizes foundational data collection, then builds progressive disclosure UI, then admin triage tools:

### Phase 1: Backend Foundation + Inline Flagging
**Rationale:** Data collection is the foundation — without flags being stored, nothing else works. Backend schema and API must support flag lifecycle from the start (timestamps, status, soft delete) to avoid painful migration later. Inline flagging enables immediate capture of player dissatisfaction.

**Delivers:**
- Database schema: question_flags table + flag_count column with trigger
- Session management: feedbackFlags field in GameSession
- API endpoint: POST /api/game/answer accepts optional `flagged: boolean`
- Feedback submission: POST /api/feedback/submit with validation
- Rate limiting: express-rate-limit configured (10 flags per 15 min per user)

**Addresses:**
- Table stakes: inline flag button, authenticated-only, visual confirmation
- Pitfall 3: data model supports flag lifecycle from start
- Pitfall 4: auth check on backend endpoints before launch

**Testing checkpoints:**
- Session stores flagged questionIds correctly
- Backend rejects unauthenticated flag submissions
- Rate limiting triggers after 10 flags
- Question ID mapping (frontend string → database numeric) works

### Phase 2: Progressive Disclosure UI
**Rationale:** Progressive disclosure minimizes flow interruption. Inline thumbs-down captures dissatisfaction in the moment (low friction), post-game elaboration collects rich context when player expects natural breakpoint. This pattern is validated by Duolingo, game flow research, and educational UX studies.

**Delivers:**
- Frontend: FeedbackButton component on answer reveal screen
- Frontend: FlaggedQuestionsSection component in ResultsScreen
- UI: Optional 500-char textarea per flagged question
- Integration: Wire POST /api/feedback/submit to frontend form

**Addresses:**
- Table stakes: post-game flagged questions summary, optional elaboration
- Differentiator: progressive disclosure pattern (research-backed best practice)
- Pitfall 1: no modal interruption, defer elaboration to natural breakpoint
- Pitfall 6: simple form (single optional text field), not complex survey

**Testing checkpoints:**
- Thumbs-down button renders during reveal phase only
- Flagged questions appear in post-game results
- Form submission persists to database
- Mobile tap targets meet 48x48dp minimum (Pitfall 11)

### Phase 3: Admin Review Queue
**Rationale:** Standard moderation pattern provides centralized triage workflow. Flag counts enable prioritization (5+ flags = likely real problem). Integration with existing question explorer contextualizes flags during normal admin workflows.

**Delivers:**
- Frontend: FlagsReviewPage at `/admin/flags`
- Backend: GET /api/admin/flags endpoint (paginated, sortable by flag count)
- UI: Table listing flagged questions, counts, player notes
- Admin actions: Archive button per question

**Addresses:**
- Table stakes: admin review queue, flag count visibility, archive action
- Differentiator: filter by flag count threshold (focus on high-signal issues)
- Pitfall 5: show "last updated" timestamp, cache invalidation on mutations

**Testing checkpoints:**
- Admin queue displays all flagged questions correctly
- Flag count sort/filter works
- Archive action removes question from active pool
- Soft delete preserves audit trail (Pitfall 8)

### Phase 4: Admin Integration + Link Fixes
**Rationale:** Integrate flag counts into existing admin UI so flags are visible during normal question management workflows (not just dedicated review page). Piggyback on database migration to fix 320 broken source.url links identified across collections.

**Delivers:**
- QuestionTable: flag_count column with badge (red if > 0)
- QuestionDetailPanel: flag count badge + "View Flags" link
- Backend: flag_count included in GET /api/admin/questions/explore
- Technical debt: Fix broken source.url Learn More links (320 questions)
- Environment: Add ADMIN_EMAIL env var for admin promotion

**Addresses:**
- Differentiator: inline flag context in question detail panel
- Technical debt: source.url link quality (identified in scope)
- Pitfall 2: close feedback loop by making flags visible to admins

**Testing checkpoints:**
- Flag counts display correctly in question table
- "View Flags" link filters review queue to specific question
- Verify all Learn More links are valid HTTPS
- Admin email promotion works with new env var

### Phase Ordering Rationale

1. **Backend foundation before frontend** — Database schema must support flag lifecycle from start to avoid migration. Rate limiting and auth checks prevent spam from day one.

2. **Inline flagging before post-game elaboration** — Progressive disclosure pattern requires data collection layer first. Players must be able to flag before they can elaborate.

3. **Admin queue after data collection** — Can't build triage tool without flags to triage. Admin workflow depends on flags existing in database.

4. **Admin integration last** — Polish on top of functional system. Flag counts enhance existing workflows but aren't blocking for core feature.

**Research flags:**
- **No phases need deeper research** — Patterns are well-established in educational apps (Duolingo), content moderation tools (Stream, Kahoot), and game UX research. Implementation is straightforward given existing auth system, admin UI, and database.

**Standard patterns (no research needed):**
- Progressive disclosure (NN/g, educational game research)
- Admin moderation queue (Stack Overflow, forum tools, Stream)
- Rate limiting (express-rate-limit industry standard)
- Soft delete (Microsoft Q&A, content moderation standards)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack provides all core capabilities. Only one new dependency (express-rate-limit) which is industry standard. |
| Features | HIGH | Progressive disclosure pattern validated by multiple authoritative sources (NN/g, Duolingo, game UX research). Authenticated-only design strongly supported by content moderation best practices. |
| Architecture | HIGH | Clean integration with existing game flow, session management, and admin UI. No breaking changes. Design decisions validated against existing patterns (answer submission, admin queue). |
| Pitfalls | MEDIUM-HIGH | Flow interruption, feedback black hole, and auth bypass are well-documented with clear mitigation strategies. Stale dashboard and post-game survey complexity have established solutions. |

**Overall confidence:** HIGH

### Gaps to Address

**Rate limiting specifics:** Research shows authenticated users need higher limits than anonymous, but exact thresholds (10 per 15 min? 100 per day?) require experimentation. **Mitigation:** Start conservative (10 flags per 15 min), monitor data, adjust based on abuse patterns.

**Flag count filter thresholds:** Admin queue should filter by min flag count (3+? 5+? 10+?), but optimal threshold depends on question volume and player base size. **Mitigation:** Implement filter with adjustable threshold, monitor data to calibrate.

**Elaboration text length:** No research consensus on optimal character limit. **Mitigation:** Start with 500 characters (standard for feedback forms), adjust if players consistently hit limit or submit mostly short text.

**Mobile testing:** Flag button placement and textarea usability critical on mobile (49% of gaming revenue). **Mitigation:** Test on real devices (iOS/Android) before launch, verify 48x48dp tap targets, thumb-friendly zone placement (lower third of screen).

**Loop closure timing:** Research emphasizes closing feedback loop, but specifics of notification timing and content need experimentation. **Mitigation:** Phase 2+ can add notification system after observing flag submission patterns and admin resolution times.

## Sources

### Primary (HIGH confidence)

**Progressive Disclosure & Game Flow:**
- [Progressive Disclosure - NN/G](https://www.nngroup.com/articles/progressive-disclosure/) — UX pattern definition
- [The High Cost of Interruption: Re-evaluating the Modal Dialog in Modern UX (Medium, Dec 2025)](https://medium.com/@adamshriki/the-high-cost-of-interruption-re-evaluating-the-modal-dialog-in-modern-ux-e448fb7559ff) — Flow interruption research
- [Flow State Design: Applying Game Psychology to Productivity Apps (UX Magazine)](https://uxmag.com/articles/flow-state-design-applying-game-psychology-to-productivity-apps) — Game engagement patterns

**Real-World Examples:**
- [Duolingo Help - How do I report a problem](https://support.duolingo.com/hc/en-us/articles/204752124-How-do-I-report-a-problem-with-a-sentence-or-translation-) — Inline flag pattern after answer submission
- [Kahoot - How to flag inappropriate content](https://support.kahoot.com/hc/en-us/articles/115001711568-How-to-flag-inappropriate-Kahoot-content) — Human moderators review within 24 hours
- [TikTok Dislike Button Explained](https://deliveredsocial.com/tiktok-dislike-button-explained-will-it-change-the-algorithm/) — Dislike vs report distinction

**Stack & Rate Limiting:**
- [express-rate-limit npm package](https://www.npmjs.com/package/express-rate-limit) — Industry standard, 10M+ weekly downloads
- [Rate Limiting in Express.js - Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/rate-limiting-express/) — Configuration patterns
- [express-validator documentation](https://express-validator.github.io/) — Input validation and sanitization

**Content Moderation Best Practices:**
- [Content Moderation: Types, Tools & Best Practices (Stream)](https://getstream.io/blog/content-moderation/) — Moderation queue patterns
- [Treating Online Abuse Like Spam (PEN America)](https://pen.org/report/treating-online-abuse-like-spam/) — "Most abuse reporting systems fail: they never close the feedback loop"
- [Disruption and Harms in Online Gaming: Penalty and Reporting Systems (ADL)](https://www.adl.org/resources/report/disruption-and-harms-online-gaming-resource-penalty-and-reporting-systems) — "If players do not feel their reports matter, they will not report abuse"

### Secondary (MEDIUM confidence)

**Database & Schema:**
- [Drizzle ORM PostgreSQL Best Practices Guide (2025)](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717) — Index patterns, foreign keys
- [Database Versioning Best Practices (Enterprise Craftsmanship)](https://enterprisecraftsmanship.com/posts/database-versioning-best-practices/) — "Every change should be stored explicitly; never edit deployed migrations"
- [Should I Create an Index on Foreign Keys in PostgreSQL? - Percona](https://www.percona.com/blog/should-i-create-an-index-on-foreign-keys-in-postgresql/) — Foreign key indexing

**Admin Dashboard:**
- [From Data To Decisions: UX Strategies For Real-Time Dashboards (Smashing Magazine, Sept 2025)](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/) — Real-time vs stale data
- [Understanding How Reddit Moderators Use the Modqueue (arXiv, Sept 2025)](https://arxiv.org/html/2509.07314v1) — Moderator collision patterns
- [Review Queues - Stack Overflow](https://internal.stackoverflow.help/en/articles/8075993-review-queues) — Queue structure patterns

**Mobile UX:**
- [How to Create a Seamless UI/UX in Mobile Games (AppSamurai, Feb 2025)](https://appsamurai.com/blog/how-to-create-a-seamless-ui-ux-in-mobile-games/) — "All UI components need thumb-friendly zones and proper button dimensions"
- [Mobile Game Statistics 2025 (GameAnalytics)](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks) — Mobile gaming represents 49% of global gaming revenue

### Tertiary (LOW confidence)

**Abuse Prevention:**
- [Challenges in Moderating Disruptive Player Behavior (Frontiers, 2024)](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2024.1283735/full) — "Small group of players engages in disruptive behavior"
- [The Complete Rate Limiting Handbook (SaaS Custom Domains)](https://saascustomdomains.com/blog/posts/the-complete-rate-limiting-handbook-prevent-abuse-and-optimize-performance) — General rate limiting patterns (not trivia-specific)

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes*

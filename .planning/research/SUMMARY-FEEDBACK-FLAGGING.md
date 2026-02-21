# Research Summary: In-Game Question Feedback & Flagging

**Domain:** Trivia app question feedback and flagging systems
**Researched:** 2026-02-21
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

Research into in-game question feedback and flagging systems for trivia and educational apps reveals a clear pattern: successful implementations distinguish between **quality curation** (private, lightweight, helps improve content) and **policy enforcement** (public, heavyweight, removes harmful content). For Civic Trivia Championship's v1.5 milestone, the focus is quality curation — enabling authenticated players to flag questions they dislike, provide optional context, and give admins an efficient triage workflow.

The critical UX insight is **progressive disclosure**: collect flags inline (low friction, moment of dissatisfaction) but defer elaboration to post-game (avoids flow interruption). This pattern is validated by Duolingo, game flow research, and educational UX studies.

Key architectural decisions validated by research:
- **Authenticated-only flagging** prevents spam and enables future curator reputation systems
- **Thumbs-down vs "report"** language distinguishes quality feedback from bug reports
- **No public flag counts** maintains positive, learning-focused tone
- **Admin review queue with flag counts** is standard moderation pattern (Kahoot, Stream, forum tools)

## Key Findings

**Progressive Disclosure Pattern:** Flag inline → elaborate post-game minimizes flow interruption (HIGH confidence)

**Authenticated-Only Rationale:** Prevents abuse, enables rate limiting, foundation for curator reputation (HIGH confidence)

**Admin Queue Design:** Standard moderation pattern with flag counts, player notes, one-click actions (MEDIUM confidence — well-documented for forums, less for trivia)

**Critical Distinction:** Dislike/thumbs-down = quality curation (private), Report/flag = policy violation (public). Civic Trivia needs the former. (HIGH confidence)

## Implications for Roadmap

Based on research, v1.5 Feedback Marks milestone should follow this structure:

### Phase 1: Inline Flagging (Core Flow)
**What:** Thumbs-down button on answer reveal screen, authenticated users only
**Why:** Capture dissatisfaction at moment it occurs, foundation for all downstream features
**Complexity:** Low (button + auth check + DB write)
**Research support:** Duolingo pattern, game flow studies, progressive disclosure UX

### Phase 2: Post-Game Elaboration
**What:** Show flagged questions in results screen with optional free-text input
**Why:** Progressive disclosure — defer elaboration to avoid flow interruption
**Complexity:** Medium (results screen modification + form handling)
**Research support:** NN/g progressive disclosure, educational game UX research

### Phase 3: Admin Review Queue
**What:** Dedicated admin view listing flagged questions, flag counts, player notes
**Why:** Standard moderation pattern, centralized triage workflow
**Complexity:** Medium (new admin route + filtering + sorting)
**Research support:** Stream, Kahoot, Stack Overflow moderation tools

### Phase 4: Admin Quick Actions
**What:** Archive button in review queue, flag count on question detail panel
**Why:** Reduce workflow friction, contextualize flags in normal admin workflows
**Complexity:** Low (action handlers + UI updates)
**Research support:** Moderation dashboard best practices

### Phase Ordering Rationale

1. **Inline flagging must come first** — without data collection, nothing else works
2. **Post-game elaboration enhances inline** — provides context without requiring it
3. **Admin queue needs flag data** — can't build triage tool without flags to triage
4. **Quick actions optimize workflow** — polish on top of functional system

**No research flags needed** — patterns are well-established in educational apps and content moderation tools. Implementation is straightforward given existing auth system and admin UI.

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Progressive disclosure pattern | HIGH | Multiple authoritative sources (NN/g, game UX research, educational studies) |
| Authenticated-only design | HIGH | Content moderation and spam prevention best practices strongly support this |
| Admin queue structure | MEDIUM | Well-documented for forums/social platforms, less trivia-specific but patterns transfer |
| Thumbs-down vs report distinction | HIGH | TikTok, social platforms clearly distinguish quality curation from policy enforcement |
| Inline timing (answer reveal) | MEDIUM | Duolingo example + flow research support, but fewer direct trivia sources |
| Rate limiting thresholds | LOW | General API rate limiting well-documented, but specific trivia thresholds need experimentation |

## Open Questions

1. **Rate limiting specifics:** Research shows authenticated users should have higher limits than anonymous, but exact thresholds (20/game? 100/day?) need experimentation. Start conservative, adjust based on data.

2. **Flag count filter thresholds:** Admin queue should filter by min flag count (3+? 5+?), but optimal threshold depends on question volume and player base size. Monitor data to calibrate.

3. **Archive vs dismiss workflow:** Should archived flagged questions disappear from queue or remain with status indicator? Research leans toward disappearing by default with "Show archived" filter for audit trail.

4. **Elaboration text limits:** No research consensus. Recommend 500 characters max to keep feedback focused.

5. **Allow re-flagging same question?** Recommend NO (one flag per user per question) to prevent spam and keep counts meaningful. No research contradicts this.

## Research Quality Notes

**Strengths:**
- Multiple authoritative sources on progressive disclosure (NN/g, academic game research)
- Clear real-world examples (Duolingo, Kahoot, TikTok) with documented patterns
- Strong convergence on authenticated-only approach from content moderation research
- Well-documented admin moderation queue patterns (Stream, Stack Overflow, forum tools)

**Gaps:**
- Limited trivia-specific research (educational games research transfers, but not exact match)
- Rate limiting thresholds are general API guidance, not feedback-specific
- Exact placement timing (answer reveal vs results screen) has less direct research support
- Elaboration text length limits not addressed in sources

**Mitigation:**
- Educational game UX research validates flow preservation principles
- Start with conservative rate limits, adjust based on data
- Duolingo places reporting inline after answer, strong precedent
- 500 character limit is standard for feedback forms, reasonable default

## Files Created

| File | Purpose |
|------|---------|
| `.planning/research/FEATURES-FEEDBACK-FLAGGING.md` | Comprehensive feature landscape analysis |
| `.planning/research/SUMMARY-FEEDBACK-FLAGGING.md` | Executive summary with roadmap implications |

## Ready for Requirements

Research is complete and comprehensive. Key takeaways for requirements phase:

1. **Follow progressive disclosure pattern** — inline flag, post-game elaboration
2. **Authenticated users only** — no anonymous flagging
3. **Thumbs-down language** — not "report problem" (quality curation, not bug report)
4. **Private flags** — no public counts, admin-only visibility
5. **Standard admin queue** — list, counts, notes, archive action
6. **Start with simple rate limiting** — max 8 flags per game (1 per question), no daily limit initially
7. **Optional elaboration** — don't force players to explain, respect their time
8. **One flag per user per question** — prevent spam, keep counts meaningful

## Sources Summary

**Research drew from:**
- In-game feedback pattern research (game industry, educational games)
- Progressive disclosure UX principles (NN/g, academic research)
- Real-world implementations (Duolingo, Kahoot, TikTok)
- Content moderation best practices (Stream, forum tools, social platforms)
- Rate limiting and abuse prevention (API security, spam prevention)
- Admin moderation dashboard patterns (Stack Overflow, PubNub, Stream)
- UX anti-patterns (dark patterns research, game UX studies)

**Confidence level rationale:**
- HIGH confidence areas have multiple authoritative sources in agreement
- MEDIUM confidence areas have transferable patterns but less domain-specific research
- LOW confidence areas require experimentation (rate limiting thresholds)

All sources cited in FEATURES-FEEDBACK-FLAGGING.md with direct links.

# Roadmap: Civic Trivia Championship

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-02-13)
- ✅ **v1.1 Production Hardening** — Phases 8-12 (shipped 2026-02-18)
- ✅ **v1.2 Community Collections** — Phases 13-17 (shipped 2026-02-19)
- ✅ **v1.3 Question Quality & Admin Tools** — Phases 18-22 (shipped 2026-02-20)
- ✅ **v1.4 Fremont, CA Collection** — Phases 23-26 (shipped 2026-02-21)
- 📋 **v1.5 Feedback Marks** — Phases 27-30 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-02-13</summary>

Complete solo trivia game with authentication, 10-question game flow, server-side scoring, learning content, XP/gems progression, wager mechanics, and WCAG AA accessibility.

**Phases:** 1-7
**Plans:** 26 plans total
**Requirements delivered:** 50

</details>

<details>
<summary>✅ v1.1 Production Hardening (Phases 8-12) — SHIPPED 2026-02-18</summary>

Tech debt cleanup — Redis sessions, game UX improvements, plausibility detection, and learning content expansion.

**Phases:** 8-12
**Plans:** 11 plans total
**Requirements delivered:** 12

</details>

<details>
<summary>✅ v1.2 Community Collections (Phases 13-17) — SHIPPED 2026-02-19</summary>

Multi-collection trivia system with community-specific question banks for Bloomington IN and Los Angeles CA, plus question expiration and admin review tools.

**Phases:** 13-17
**Plans:** 15 plans total
**Requirements delivered:** 20

</details>

<details>
<summary>✅ v1.3 Question Quality & Admin Tools (Phases 18-22) — SHIPPED 2026-02-20</summary>

Quality framework and admin tooling to scale question collections — codified quality rules, audited and improved existing content, built admin exploration and editing UI, enhanced AI generation pipeline, and added Indiana and California state collections.

**Phases:** 18-22
**Plans:** 17 plans total
**Requirements delivered:** 23

</details>

<details>
<summary>✅ v1.4 Fremont, CA Collection (Phases 23-26) — SHIPPED 2026-02-21</summary>

Add a Fremont, CA community collection with 92 quality questions, proper expiration dates for time-sensitive content, and a Mission Peak banner image — following established patterns from Bloomington and LA.

**Phases:** 23-26
**Plans:** 6 plans total
**Requirements delivered:** 19

</details>

### 📋 v1.5 Feedback Marks (Planned)

**Milestone Goal:** Let authenticated players flag questions they dislike during gameplay, provide optional elaboration post-game, and give admins a review queue to triage flagged content — turning players into quality curators.

#### Phase 27: Backend Foundation & Inline Flagging

**Goal:** Establish flag data collection infrastructure and enable authenticated players to thumbs-down questions during gameplay without interrupting game flow.

**Depends on:** Phase 26 (v1.4 complete)

**Requirements:** FLAG-01, FLAG-02, FLAG-03, FLAG-04, FLAG-05, FLAG-06, INFR-01, INFR-02, INFR-03

**Success Criteria** (what must be TRUE):
1. Authenticated player can tap thumbs-down button on answer reveal screen and see immediate visual feedback
2. Anonymous players never see flag button
3. Player can toggle flag on/off before advancing to next question
4. Flag data persists to database with user, question, session, and timestamp
5. Rate limiting prevents spam (max 10 flags per 15 minutes per user)
6. Flagging never interrupts game flow or affects scoring/timer

**Plans:** 3 plans

Plans:
- [ ] 27-01-PLAN.md — Backend infrastructure: database schema, feedback service, rate limiter, API endpoints
- [ ] 27-02-PLAN.md — Frontend: FlagButton component, GameScreen integration, results screen display
- [ ] 27-03-PLAN.md — Human verification: end-to-end flagging flow testing

#### Phase 28: Progressive Disclosure UI

**Goal:** Collect rich feedback context through post-game elaboration without interrupting gameplay — players see flagged questions after game completion and can optionally provide reasons and text.

**Depends on:** Phase 27

**Requirements:** ELAB-01, ELAB-02, ELAB-03, ELAB-04, ELAB-05, ELAB-06

**Success Criteria** (what must be TRUE):
1. Post-game summary displays list of questions flagged during that session
2. Each flagged question shows predefined reason chips (confusing wording, outdated info, wrong answer, not interesting)
3. Player can select multiple reasons per question without requiring any selection
4. Player can add optional free-text feedback (max 500 characters) per question
5. Player can submit all feedback at once with single button tap
6. Feedback persists to database with user, question, session, reasons array, and text

**Plans:** TBD

Plans:
- [ ] 28-01: TBD

#### Phase 29: Admin Review Queue

**Goal:** Provide admins with centralized flags review page for triaging flagged content — sorted by flag count with one-click archive action.

**Depends on:** Phase 28

**Requirements:** ADMN-01, ADMN-02, ADMN-03, ADMN-04

**Success Criteria** (what must be TRUE):
1. Admin can access dedicated flags review page from admin navigation
2. Review page lists flagged questions sorted by flag count (most flagged first)
3. Each flagged question shows aggregate flag count plus individual player feedback (reasons and text)
4. Admin can archive a question directly from the review queue
5. Archived questions disappear from active question pool immediately
6. Flag count updates in real-time when admin archives question

**Plans:** TBD

Plans:
- [ ] 29-01: TBD

#### Phase 30: Admin Integration & Tech Debt

**Goal:** Integrate flag counts into existing admin UI for contextual visibility during question management, plus fix 320 broken Learn More links and add production admin email configuration.

**Depends on:** Phase 29

**Requirements:** ADMN-05, ADMN-06, DEBT-01, DEBT-02

**Success Criteria** (what must be TRUE):
1. Question table in admin UI shows flag count badge (red if count greater than zero)
2. Question detail panel displays flag count and "View Flags" link that filters review queue to that question
3. All 320 original questions have valid HTTPS Learn More links (broken source.url fixed)
4. ADMIN_EMAIL environment variable exists in production backend for admin promotion workflow
5. Flag counts appear correctly in question explorer without performance degradation

**Plans:** TBD

Plans:
- [ ] 30-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 27 → 28 → 29 → 30

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v1.0 | 26/26 | Complete | 2026-02-13 |
| 8-12 | v1.1 | 11/11 | Complete | 2026-02-18 |
| 13-17 | v1.2 | 15/15 | Complete | 2026-02-19 |
| 18-22 | v1.3 | 17/17 | Complete | 2026-02-20 |
| 23-26 | v1.4 | 6/6 | Complete | 2026-02-21 |
| 27. Backend Foundation & Inline Flagging | v1.5 | 0/3 | Not started | - |
| 28. Progressive Disclosure UI | v1.5 | 0/TBD | Not started | - |
| 29. Admin Review Queue | v1.5 | 0/TBD | Not started | - |
| 30. Admin Integration & Tech Debt | v1.5 | 0/TBD | Not started | - |

**Total:** 6 milestones, 30 phases, 75 plans (previous) + 3 (Phase 27) + TBD (Phases 28-30) = 78+ total

---
*Last updated: 2026-02-21 after Phase 27 planning complete*

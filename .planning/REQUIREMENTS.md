# Requirements: Civic Trivia Championship

**Defined:** 2026-02-21
**Core Value:** Make civic learning fun through game show mechanics — play, not study

## v1.5 Requirements

Requirements for Feedback Marks milestone. Each maps to roadmap phases.

### In-Game Flagging

- [ ] **FLAG-01**: Authenticated player can thumbs-down a question on the answer reveal screen
- [ ] **FLAG-02**: Anonymous players do not see the flag button
- [ ] **FLAG-03**: Player can toggle flag off before moving to the next question
- [ ] **FLAG-04**: Flag button provides immediate visual feedback (icon state change)
- [ ] **FLAG-05**: One flag per user per question per session (no duplicate submissions)
- [ ] **FLAG-06**: Flagging does not interrupt game flow or affect scoring/timer

### Post-Game Elaboration

- [ ] **ELAB-01**: Post-game summary shows list of flagged questions from that session
- [ ] **ELAB-02**: Each flagged question offers predefined reason chips (confusing wording, outdated info, wrong answer, not interesting)
- [ ] **ELAB-03**: Each flagged question offers optional free-text field (max 500 characters)
- [ ] **ELAB-04**: Player can select multiple predefined reasons per question
- [ ] **ELAB-05**: Player can submit all feedback at once after reviewing flagged questions
- [ ] **ELAB-06**: Feedback is persisted to database with user, question, session, reasons, and text

### Admin Review

- [ ] **ADMN-01**: Dedicated flags review page accessible from admin navigation
- [ ] **ADMN-02**: Review page shows list of flagged questions sorted by flag count (most flagged first)
- [ ] **ADMN-03**: Each flagged question shows aggregate flag count and individual player feedback (reasons + text)
- [ ] **ADMN-04**: Admin can archive a question directly from the review queue
- [ ] **ADMN-05**: Flag count badge visible on existing question table in admin UI
- [ ] **ADMN-06**: Flag count and feedback notes visible on existing question detail panel

### Backend Infrastructure

- [ ] **INFR-01**: Database table for question flags with user, question, session, reasons, text, and timestamps
- [ ] **INFR-02**: Rate limiting on feedback submission endpoint (prevent spam)
- [ ] **INFR-03**: Flag count denormalized on questions table for efficient sorting

### Tech Debt

- [ ] **DEBT-01**: Fix broken source.url Learn More links on original 320 questions
- [ ] **DEBT-02**: Add ADMIN_EMAIL environment variable to production backend

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Curator Rewards

- **RWRD-01**: Players who provide quality feedback receive XP/gem rewards
- **RWRD-02**: System tracks feedback quality score per user (good flags vs spam)
- **RWRD-03**: Volume reduction for accounts that spam flags (lower weight in flag counts)

### Advanced Moderation

- **MODR-01**: Admin can mark feedback as helpful/unhelpful to train quality signals
- **MODR-02**: Flagged question auto-deactivation threshold (e.g., 5+ flags from trusted curators)
- **MODR-03**: Feedback loop — notify player when their flag led to question improvement

## Out of Scope

| Feature | Reason |
|---------|--------|
| Public flag counts visible to players | Negative social proof, hurts encouraging tone |
| Flag during question (before answer) | Player hasn't seen the full question context yet |
| Anonymous flagging | Cannot track quality, enables spam, no accountability |
| "Report problem" / bug report workflow | This is quality curation, not bug reporting |
| Real-time admin notifications for new flags | Batch review sufficient at current scale |
| Flag categories for admin (duplicate, offensive) | Simple archive workflow sufficient for v1.5 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FLAG-01 | Phase 27 | Pending |
| FLAG-02 | Phase 27 | Pending |
| FLAG-03 | Phase 27 | Pending |
| FLAG-04 | Phase 27 | Pending |
| FLAG-05 | Phase 27 | Pending |
| FLAG-06 | Phase 27 | Pending |
| ELAB-01 | Phase 28 | Pending |
| ELAB-02 | Phase 28 | Pending |
| ELAB-03 | Phase 28 | Pending |
| ELAB-04 | Phase 28 | Pending |
| ELAB-05 | Phase 28 | Pending |
| ELAB-06 | Phase 28 | Pending |
| ADMN-01 | Phase 29 | Pending |
| ADMN-02 | Phase 29 | Pending |
| ADMN-03 | Phase 29 | Pending |
| ADMN-04 | Phase 29 | Pending |
| ADMN-05 | Phase 30 | Pending |
| ADMN-06 | Phase 30 | Pending |
| INFR-01 | Phase 27 | Pending |
| INFR-02 | Phase 27 | Pending |
| INFR-03 | Phase 27 | Pending |
| DEBT-01 | Phase 30 | Pending |
| DEBT-02 | Phase 30 | Pending |

**Coverage:**
- v1.5 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after v1.5 roadmap creation*

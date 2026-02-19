# Project Milestones: Civic Trivia Championship

## v1.2 Community Collections (Shipped: 2026-02-19)

**Delivered:** Multi-collection trivia system with community-specific question banks for Bloomington IN and Los Angeles CA, plus question expiration and admin review tools.

**Phases completed:** 13-17 (15 plans total)

**Key accomplishments:**
- Migrated question data from JSON to PostgreSQL with full relational schema
- Built QuestionService for collection-scoped, difficulty-balanced question selection
- Implemented card-based collection picker with end-to-end game flow wiring
- Added question expiration system with hourly cron sweep and admin review UI
- Generated 200 community questions via AI + human review pipeline
- Deployed 320 playable questions across 3 collections to production

**Stats:**
- 76 files created/modified
- 11,588 lines of TypeScript added
- 5 phases, 15 plans
- 2 days from start to ship (2026-02-18 → 2026-02-19)

**Git range:** `docs(13)` → `fix(17)`

**What's next:** TBD — start with `/gsd:new-milestone`

---

## v1.1 Production Hardening (Shipped: 2026-02-18)

**Delivered:** Tech debt cleanup — Redis sessions, game UX improvements, plausibility detection, and learning content expansion.

**Phases completed:** 8-12 (11 plans total)

**Key accomplishments:**
- Fixed dev tooling and completed v1.0 documentation gaps
- Migrated game sessions to Redis with graceful fallback
- Single-click answer selection and improved visual hierarchy
- Difficulty-adjusted plausibility detection with speed bonus penalties
- Learning content expanded from 15% to 27.5% coverage

**Stats:**
- 5 phases, 11 plans, 12 requirements delivered

**Git range:** `feat(08)` → `feat(12)`

---

## v1.0 MVP (Shipped: 2026-02-13)

**Delivered:** Complete solo trivia game with authentication, 10-question game flow, server-side scoring, learning content, XP/gems progression, wager mechanics, and WCAG AA accessibility.

**Phases completed:** 1-7 (26 plans total)

**Key accomplishments:**
- Full auth system (email/password, JWT, session persistence)
- Game show-style trivia flow with timer, answer reveal, and explanations
- Server-side scoring with speed bonus and wager mechanics
- XP/gems progression system with user profiles
- 120 civic trivia questions with mixed difficulty
- WCAG AA accessibility, keyboard navigation, screen reader support

**Stats:**
- 7 phases, 26 plans, 50 requirements delivered

**Git range:** `feat(01)` → `feat(07)`

---

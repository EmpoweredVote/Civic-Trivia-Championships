# Roadmap: Civic Trivia Championship

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 (shipped 2026-02-13)
- ✅ **v1.1 Production Hardening** - Phases 8-12 (shipped 2026-02-18)
- ✅ **v1.2 Community Collections** - Phases 13-17 (shipped 2026-02-19)
- ✅ **v1.3 Question Quality & Admin Tools** - Phases 18-22 (shipped 2026-02-20)
- 🚧 **v1.4 Fremont, CA Collection** - Phases 23-26 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) - SHIPPED 2026-02-13</summary>

Complete solo trivia game with authentication, 10-question game flow, server-side scoring, learning content, XP/gems progression, wager mechanics, and WCAG AA accessibility.

**Phases:** 1-7
**Plans:** 26 plans total
**Requirements delivered:** 50

</details>

<details>
<summary>✅ v1.1 Production Hardening (Phases 8-12) - SHIPPED 2026-02-18</summary>

Tech debt cleanup — Redis sessions, game UX improvements, plausibility detection, and learning content expansion.

**Phases:** 8-12
**Plans:** 11 plans total
**Requirements delivered:** 12

</details>

<details>
<summary>✅ v1.2 Community Collections (Phases 13-17) - SHIPPED 2026-02-19</summary>

Multi-collection trivia system with community-specific question banks for Bloomington IN and Los Angeles CA, plus question expiration and admin review tools.

**Phases:** 13-17
**Plans:** 15 plans total
**Requirements delivered:** 20

</details>

<details>
<summary>✅ v1.3 Question Quality & Admin Tools (Phases 18-22) - SHIPPED 2026-02-20</summary>

Quality framework and admin tooling to scale question collections — codified quality rules, audited and improved existing content, built admin exploration and editing UI, enhanced AI generation pipeline, and added Indiana and California state collections.

**Phases:** 18-22
**Plans:** 17 plans total
**Requirements delivered:** 23

</details>

### 🚧 v1.4 Fremont, CA Collection (In Progress)

**Milestone Goal:** Add a Fremont, CA community collection with ~100 quality questions, proper expiration dates for time-sensitive content, and a skyline banner image — following established patterns from Bloomington and LA.

---

### Phase 23: Collection Setup & Topic Definition
**Goal**: Fremont collection configuration and topic structure ready for content generation
**Depends on**: Nothing (uses existing v1.2/v1.3 infrastructure)
**Requirements**: COLL-01, COLL-02
**Success Criteria** (what must be TRUE):
  1. Fremont collection exists in database with metadata (slug, description, theme color, sort order)
  2. Eight topic categories defined with distribution targets (city government, county government, state government, civic history, local services, elections & voting, landmarks & culture, budget & finance)
  3. Locale config file created with source URLs, disambiguation rules for Mission San Jose, and five-district structure documented
  4. Election schedule verified and documented for time-sensitive question expiration
**Plans**: 1 plan

Plans:
- [x] 23-01-PLAN.md — Add Fremont collection to seed file and create locale config with topics, distribution, sources, and documentation

---

### Phase 24: Question Generation & Review
**Goal**: 80-100 active, quality-validated Fremont questions ready for gameplay
**Depends on**: Phase 23
**Requirements**: QUES-01, QUES-02, QUES-03, QUES-04, QUES-05, QUES-06, FREM-01, FREM-02, FREM-03, FREM-04, FREM-05, FREM-06
**Success Criteria** (what must be TRUE):
  1. ~100 questions generated across 8 topic categories with weighted distribution (18-20 each for civic history and landmarks/culture, 8-15 for others)
  2. All questions have cited sources from official or authoritative sources
  3. All questions pass quality rules (dinner party test, civic utility, no pure lookup facts, no phone numbers/addresses)
  4. Questions have balanced difficulty distribution (easy/medium/hard)
  5. Mission San Jose questions explicitly disambiguate between 1797 Spanish mission and modern Fremont district
  6. Tesla/NUMMI questions focus on civic angles (economic impact, zoning, environmental review) not pure corporate trivia
  7. Five-district consolidation story (1956) represented across multiple questions
  8. Little Kabul / Afghan-American community represented with cultural sensitivity
  9. Ohlone/Indigenous history treated with appropriate sensitivity
  10. Diversity and demographic questions use percentages/trends, not exact population numbers
  11. Time-sensitive questions (current officials, budget figures) have expiration timestamps matching term end dates
  12. All questions include explanations (1-3 sentences, neutral, informative)
**Plans**: 3 plans

Plans:
- [x] 24-01-PLAN.md — Register Fremont locale in generation pipeline, enhance system prompt with sensitivity notes and quality guidelines, fetch RAG sources
- [x] 24-02-PLAN.md — Generate ~130 Fremont questions with quality validation retry loop, seed as draft to database
- [x] 24-03-PLAN.md — Spot-check sample for cultural sensitivity, curate to ~100 best questions, activate final set

---

### Phase 25: Image, Seed & Activation
**Goal**: Fremont collection activated and visible in collection picker with branded image
**Depends on**: Phase 24
**Requirements**: COLL-03, ACTV-01, ACTV-02
**Success Criteria** (what must be TRUE):
  1. Fremont collection card displays a skyline banner image (fremont-ca.jpg)
  2. Collection seeded to database via community seed script
  3. Collection activated (isActive: true) and appears in collection picker
  4. Collection has minimum 50 questions (gameplay threshold) — targeting ~100
**Plans**: 1 plan

Plans:
- [x] 25-01-PLAN.md — Add Mission Peak banner image, export 92 active questions to JSON with status filter, register Fremont in seed script

---

### Phase 26: Verification & Production Testing
**Goal**: Fremont collection verified as production-ready with end-to-end playability
**Depends on**: Phase 25
**Requirements**: ACTV-03, ACTV-04
**Success Criteria** (what must be TRUE):
  1. Collection has minimum 50 questions confirmed (gameplay threshold met)
  2. Game sessions can be created from Fremont collection with 8-question rounds
  3. Fremont collection playable end-to-end (start to results screen)
  4. Questions verified as Fremont-specific (not federal or other locale)
  5. Difficulty balance confirmed in actual gameplay
  6. Expiration system verified for time-sensitive questions
  7. Admin panel shows Fremont questions correctly
**Plans**: 1 plan

Plans:
- [ ] 26-01-PLAN.md — Deploy, verify all 7 criteria, and finalize v1.4 milestone

---

## Progress

**Execution Order:**
Phases execute in numeric order: 23 → 24 → 25 → 26

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 23. Collection Setup | v1.4 | 1/1 | Complete | 2026-02-21 |
| 24. Question Generation | v1.4 | 3/3 | Complete | 2026-02-21 |
| 25. Image & Activation | v1.4 | 1/1 | Complete | 2026-02-21 |
| 26. Verification | v1.4 | 0/1 | Not started | - |

---
*Last updated: 2026-02-21 after Phase 26 planning*

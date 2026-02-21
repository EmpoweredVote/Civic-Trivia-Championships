---
phase: 23-collection-setup-topic-definition
plan: 01
subsystem: content-infrastructure
tags: [collection-metadata, locale-config, topic-definition, fremont-ca, seed-data]
requires:
  - phase-22-final-fixes-polish
provides:
  - fremont-collection-metadata
  - fremont-locale-config
  - eight-topic-structure
  - rag-source-urls
affects:
  - phase-24-question-generation
  - phase-25-content-review-activation
tech-stack:
  added: []
  patterns: [locale-config-pattern, topic-distribution-schema]
key-files:
  created:
    - backend/src/scripts/content-generation/locale-configs/fremont-ca.ts
  modified:
    - backend/src/db/seed/collections.ts
decisions:
  - title: Fremont sort order position 3
    rationale: Placed between Bloomington (2) and LA (4 updated from 3)
    impact: Clean ordering without gaps, LA moved to accommodate
  - title: Eight topic categories for Fremont
    rationale: Matches Bloomington/LA pattern, covers city/county/state/culture/services
    impact: Structured topic coverage for Phase 24 generation
  - title: History and culture heavy distribution
    rationale: "User decision: civic-history=20, landmarks-culture=18 (history+culture emphasis)"
    impact: 38% of questions focus on Fremont's unique consolidation story and cultural identity
  - title: Elevated budget-finance allocation
    rationale: Tesla/NUMMI dual story (12 questions vs standard 10-12)
    impact: Sufficient coverage for manufacturing-to-EV economic transition narrative
metrics:
  duration: 2m 24s
  completed: 2026-02-21
---

# Phase 23 Plan 01: Add Fremont Collection and Define Topic Structure Summary

**One-liner:** Fremont collection seed metadata + eight-topic locale config with history/culture-heavy distribution (20/18), Tesla/NUMMI economic focus (12), and 20 .gov RAG sources

## What Was Built

### Task 1: Collection Seed Metadata
- Added Fremont, CA collection to `backend/src/db/seed/collections.ts`
- Slug: `fremont-ca`, sortOrder: 3, isActive: false
- Description: "Five towns, one city — how well do you know Fremont?"
- Theme color: #047857 (emerald green, distinct from Federal blue, Bloomington red, LA ocean blue)
- Icon: `flag-ca` (same as LA, both California locales)
- Updated LA sortOrder from 3 → 4 to accommodate Fremont

### Task 2: Locale Configuration
Created `backend/src/scripts/content-generation/locale-configs/fremont-ca.ts` with:

**Eight Topic Categories:**
1. **city-government** (10) — Mayor, six-district council, city manager, departments
2. **alameda-county** (10) — County + regional (BART, AC Transit, Bay Area agencies)
3. **california-state** (10) — Governor, legislature, ballot propositions
4. **civic-history** (20) — Five-town consolidation, Ohlone land, Mission San Jose founding
5. **local-services** (10) — Utilities, parks, police/fire, planning
6. **elections-voting** (10) — District elections, voting process, county registrar
7. **landmarks-culture** (18) — Mission San Jose district, Little Kabul, Mission Peak, multiculturalism
8. **budget-finance** (12) — City budget, Tesla impact, Measure E, NUMMI redevelopment

**Distribution:** Sums to exactly 100, history+culture heavy (38 total), Tesla/NUMMI elevated (12)

**20 RAG Source URLs:** All real .gov domains
- 9 Fremont city (fremont.gov, fremontpolice.gov)
- 4 Alameda County (acgov.org, acvote, board of supervisors)
- 3 Regional agencies (bart.gov, actransit.org)
- 4 California state (ca.gov, gov.ca.gov, legislature, sos elections)

**Documentation Added:**
- **Election schedule:** November 3, 2026 for mayor and county supervisors, staggered council districts
- **Disambiguation rules:** Mission San Jose (historic mission vs modern district), five towns list, NUMMI/Tesla dual coverage (economic + land use)
- **Fremont context:** Five-town consolidation (1956), six-district council, Little Kabul framing, Ohlone land acknowledgment level

## Key Integration Points

**For Phase 24 (Question Generation):**
- Import `fremontConfig` from `./locale-configs/fremont-ca.js`
- Use `topicDistribution` to allocate 100 questions across 8 categories
- Use `sourceUrls` array for RAG content fetching
- Follow `externalIdPrefix: 'fre'` for question IDs (fre-001, fre-002, etc.)

**For Phase 25 (Content Review & Activation):**
- Collection exists in seed with `isActive: false`
- Activate by setting `isActive: true` after question review
- sortOrder 3 positions Fremont between Bloomington and LA in UI

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| backend/src/db/seed/collections.ts | Added Fremont entry, updated LA sortOrder | +12, -1 |
| backend/src/scripts/content-generation/locale-configs/fremont-ca.ts | New locale config with 8 topics, distribution, sources, docs | +149 |

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 0630eb1 | feat | Add Fremont collection to seed file and fix LA sort order |
| 86eb346 | feat | Create Fremont locale config with topics, distribution, sources, and documentation |

## Decisions Made

### 1. Fremont Collection Placement (sortOrder 3)
**Decision:** Place Fremont at sortOrder 3, move LA from 3 to 4
**Rationale:** Clean ordering without gaps, maintains chronological addition order (Federal → Bloomington → Fremont → LA)
**Alternatives considered:** sortOrder 4 (after LA) — rejected to keep California locales together visually
**Impact:** UI displays Federal, Bloomington, Fremont, LA in that order

### 2. History + Culture Heavy Distribution (38%)
**Decision:** Allocate 20 questions to civic-history, 18 to landmarks-culture
**Rationale:** User explicitly requested history/culture emphasis for Fremont's unique consolidation story
**Alternatives considered:** Balanced 12/12 like Bloomington — rejected, doesn't honor Fremont's distinctive narrative
**Impact:** 38% of questions focus on five-town consolidation, Mission San Jose, Little Kabul, multicultural identity

### 3. Elevated Budget-Finance Allocation (12 vs 10-12 standard)
**Decision:** 12 questions for budget-finance topic
**Rationale:** Tesla/NUMMI dual story warrants above-standard coverage (economic impact + land use redevelopment)
**Alternatives considered:** Standard 10 — rejected, insufficient for manufacturing-to-EV transition narrative
**Impact:** Room for Tesla jobs/tax revenue questions AND NUMMI zoning/environmental questions

### 4. Alameda County + Regional Combined Topic
**Decision:** Single "alameda-county" topic covers county government PLUS BART/AC Transit/regional agencies
**Rationale:** Follows LA pattern (la-county includes county services + regional transit)
**Alternatives considered:** Separate regional-agencies topic — rejected, creates 9 topics vs standard 8
**Impact:** County and regional transit questions share 10-question allocation

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed successfully with all must-haves satisfied.

## Testing & Verification

**Compile checks:** Both files pass TypeScript compilation (node_modules errors unrelated)

**Data validation:**
- ✅ Sort orders unique: 1, 2, 3, 4 (no duplicates)
- ✅ Fremont isActive: false (activation in Phase 25)
- ✅ Topic slugs match distribution keys exactly (8 entries each)
- ✅ Distribution sums to 100 (10+10+10+20+10+10+18+12)
- ✅ 20 source URLs, all .gov domains
- ✅ Election schedule documented with November 3, 2026 date
- ✅ Mission San Jose disambiguation rules present

**Pattern conformance:**
- ✅ Follows LA import pattern (`import type { LocaleConfig } from './bloomington-in.js'`)
- ✅ Exports `fremontConfig: LocaleConfig`
- ✅ JSDoc comment block with Fremont-specific context
- ✅ Trailing comment blocks for election schedule and disambiguation

## Next Phase Readiness

**Phase 24 (Question Generation) can now:**
- Import `fremontConfig` from locale-configs/fremont-ca.ts
- Generate 100 questions distributed across 8 topics per topicDistribution
- Fetch RAG content from 20 .gov source URLs
- Assign external IDs with 'fre' prefix

**Phase 25 (Content Review & Activation) can:**
- Query seed database for Fremont collection (slug: fremont-ca)
- Activate collection by updating isActive flag
- Display collection at sortOrder 3 position

**Blockers:** None
**Concerns:** None
**Open questions:** None

---

**Status:** ✅ Complete
**Commits:** 2 (0630eb1, 86eb346)
**Duration:** 2 minutes 24 seconds
**Generated:** 2026-02-21

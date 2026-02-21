# Requirements: Civic Trivia Championship v1.4

**Defined:** 2026-02-20
**Core Value:** Make civic learning fun through game show mechanics — play, not study

## v1.4 Requirements

Requirements for Fremont, CA Collection. Each maps to roadmap phases.

### Collection Setup

- [ ] **COLL-01**: Fremont, CA collection exists in database with slug `fremont-ca`, description, theme color, and sort order
- [ ] **COLL-02**: Fremont collection has 8 topic categories (city government, county government, state government, civic history, local services, elections & voting, landmarks & culture, budget & finance)
- [ ] **COLL-03**: Fremont collection card displays a skyline banner image (`fremont-ca.jpg`)

### Question Content

- [ ] **QUES-01**: ~100 questions across 8 topic categories with weighted distribution (18-20 each for civic history and landmarks/culture, 8-15 for others)
- [ ] **QUES-02**: All questions have cited sources with URLs from official or authoritative sources
- [ ] **QUES-03**: All questions pass quality rules (dinner party test, civic utility, no pure lookup facts, no phone numbers/addresses)
- [ ] **QUES-04**: Questions have balanced difficulty distribution (easy/medium/hard)
- [ ] **QUES-05**: Time-sensitive questions (current officials, budget figures) have `expiresAt` timestamps matching term end dates
- [ ] **QUES-06**: Questions include explanations (1-3 sentences, neutral, informative)

### Fremont-Specific Content Quality

- [ ] **FREM-01**: Mission San Jose questions disambiguate between the 1797 Spanish mission and the modern Fremont district
- [ ] **FREM-02**: Tesla/NUMMI questions focus on civic angles (economic impact, manufacturing evolution) not pure corporate trivia
- [ ] **FREM-03**: Five-district consolidation story (1956) represented across multiple questions
- [ ] **FREM-04**: Little Kabul / Afghan-American community represented with cultural sensitivity
- [ ] **FREM-05**: Ohlone/Indigenous history treated with appropriate sensitivity
- [ ] **FREM-06**: Diversity and demographic questions use percentages/trends, not exact population numbers

### Activation & Playability

- [ ] **ACTV-01**: Fremont collection seeded to database via community seed script
- [ ] **ACTV-02**: Collection activated (`isActive: true`) and appears in collection picker
- [ ] **ACTV-03**: Collection has minimum 50 questions (gameplay threshold) — targeting ~100
- [ ] **ACTV-04**: Game sessions can be created from Fremont collection with 8-question rounds

## Future Requirements

Deferred to later milestones.

### Additional Collections

- **COLL-FUT-01**: Additional Bay Area city collections (San Jose, Oakland, etc.)
- **COLL-FUT-02**: Alameda County collection (county-wide scope)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fremont-specific UI customization | Collection system is generic, no per-collection UI theming |
| Video/image questions about Fremont landmarks | Text-only format established in v1.0 |
| Real-time Fremont civic data integration | Static question bank with expiration dates sufficient |
| Automatic question generation from live city council feeds | AI generation + manual review pipeline sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COLL-01 | TBD | Pending |
| COLL-02 | TBD | Pending |
| COLL-03 | TBD | Pending |
| QUES-01 | TBD | Pending |
| QUES-02 | TBD | Pending |
| QUES-03 | TBD | Pending |
| QUES-04 | TBD | Pending |
| QUES-05 | TBD | Pending |
| QUES-06 | TBD | Pending |
| FREM-01 | TBD | Pending |
| FREM-02 | TBD | Pending |
| FREM-03 | TBD | Pending |
| FREM-04 | TBD | Pending |
| FREM-05 | TBD | Pending |
| FREM-06 | TBD | Pending |
| ACTV-01 | TBD | Pending |
| ACTV-02 | TBD | Pending |
| ACTV-03 | TBD | Pending |
| ACTV-04 | TBD | Pending |

**Coverage:**
- v1.4 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 ⚠️

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after initial definition*

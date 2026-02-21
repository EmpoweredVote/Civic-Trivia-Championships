# Phase 23: Collection Setup & Topic Definition - Research

**Researched:** 2026-02-20
**Domain:** Database seeding, locale configuration files, community collection setup patterns
**Confidence:** HIGH

## Summary

Phase 23 creates the Fremont, CA collection configuration following the established pattern from Bloomington IN and Los Angeles CA (Phase 17, v1.2). This is a configuration-only phase—no question generation occurs here. The work involves: (1) adding a collection row to the database seed file with metadata (slug, description, theme color, sort order), (2) creating a locale config TypeScript file that defines topic categories, question distribution targets, and RAG source URLs, and (3) documenting Fremont-specific context (Mission San Jose disambiguation, five-district structure, election schedule).

The codebase has a well-established pattern for this work. All infrastructure exists from v1.2 Community Collections and v1.3 Quality Framework. California state sources are already cached from the LA collection, providing efficiency gains. The main research challenge is Fremont-specific civic context—particularly Mission San Jose (Spanish mission vs. modern district), five-town consolidation story, Tesla/NUMMI economic/land use duality, and cultural sensitivity around Ohlone history and Afghan-American community representation.

**Primary recommendation:** Follow the Bloomington/LA pattern exactly. Add Fremont entry to `collections.ts`, create `fremont-ca.ts` locale config with 8 topic categories matching the user's distribution decisions, reference the existing California state config for state-level sources, and document disambiguation rules inline as config comments.

## Standard Stack

Phase 23 uses no new libraries—it's pure configuration of existing systems.

### Core Infrastructure (Already Exists)
| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| Collections seed | `backend/src/db/seed/collections.ts` | Defines collection metadata for database seeding | Active |
| Locale configs | `backend/src/scripts/content-generation/locale-configs/*.ts` | Defines topic structure and source URLs for question generation | Active |
| Schema types | `backend/src/db/schema.ts` | Drizzle ORM schema with `NewCollection` type | Active |
| California state config | `backend/src/scripts/content-generation/locale-configs/state-configs/california.ts` | Reusable state-level sources and context | Active |

### Supporting Infrastructure
| Component | Location | Purpose | When Used |
|-----------|----------|---------|-----------|
| Generation script | `backend/src/scripts/content-generation/generate-locale-questions.ts` | Consumes locale config in Phase 24 | Phase 24 only |
| Seed script | `backend/src/db/seed/seed.ts` | Seeds collections on db:seed run | After this phase |
| Topic types | `locale-configs/bloomington-in.ts` | `LocaleConfig` and `TopicCategory` interfaces | Imported by fremont-ca.ts |

**No installation needed:** All dependencies exist from v1.2/v1.3.

## Architecture Patterns

### Pattern 1: Collection Metadata in Seed File

**What:** Add a new entry to the `collectionsData` array in `collections.ts`

**When to use:** Every new collection (Federal, Bloomington, LA, Fremont, etc.)

**Example:**
```typescript
// backend/src/db/seed/collections.ts
export const collectionsData: NewCollection[] = [
  {
    name: 'Fremont, CA',
    slug: 'fremont-ca',
    description: 'Five towns, one city — how well do you know Fremont?',
    localeCode: 'en-US',
    localeName: 'Fremont, California',
    iconIdentifier: 'flag-ca', // Same as LA (both California)
    themeColor: '#047857', // Emerald green (differentiate from LA ocean blue #0369A1, Bloomington red #991B1B)
    isActive: false, // Remains false until Phase 25 activation
    sortOrder: 3 // Fremont takes position 3, LA moves to 4
  }
];
```

**Key fields:**
- `slug`: URL-safe identifier, used in API routes and file paths
- `description`: User-facing hook, appears in collection card
- `themeColor`: 7-char hex, used as card banner fallback before image loads
- `sortOrder`: Controls display order in collection picker (Federal=1, Bloomington=2, Fremont=3, LA=4)
- `isActive: false`: Collection exists but won't appear in picker until Phase 25

**Existing colors to avoid:**
- `#1E3A8A` (Federal deep blue)
- `#991B1B` (Bloomington Indiana red)
- `#0369A1` (LA ocean blue)

### Pattern 2: Locale Config File

**What:** TypeScript config file defining topic categories, distribution targets, and RAG sources

**When to use:** Every community collection that will have AI-generated questions

**Example:**
```typescript
// backend/src/scripts/content-generation/locale-configs/fremont-ca.ts
import type { LocaleConfig } from './bloomington-in.js';

export const fremontConfig: LocaleConfig = {
  locale: 'fremont-ca',
  name: 'Fremont, California',
  externalIdPrefix: 'fre', // fre-001, fre-002, etc.
  collectionSlug: 'fremont-ca',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description: 'Fremont city government — mayor, six-district city council, city manager, and departments',
    },
    {
      slug: 'alameda-county',
      name: 'Alameda County & Regional Agencies',
      description: 'Alameda County governance PLUS regional agencies (BART, AC Transit) serving Fremont',
    },
    {
      slug: 'california-state',
      name: 'California State Government',
      description: 'California state government — governor, legislature, and the ballot propositions system',
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description: 'Five-town consolidation (1956), Fremont founding, civic movements, historical milestones',
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description: 'City utilities, parks and recreation, public safety, planning, municipal services',
    },
    {
      slug: 'elections-voting',
      name: 'Elections & Voting',
      description: 'Local election process, voting districts, district-based elections, civic participation',
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description: 'Mission San Jose district, cultural institutions, multicultural identity, notable places',
    },
    {
      slug: 'budget-finance',
      name: 'Budget & Finance',
      description: 'City budget, tax structure, Tesla economic impact, Measure E, how Fremont funds services',
    },
  ],

  // User decisions from CONTEXT.md: History + Culture heavy (18-20 each),
  // Budget & Finance above standard (12-15), County includes regional context,
  // Remaining categories get standard 8-12 each. Target ~100 total.
  topicDistribution: {
    'city-government': 10,
    'alameda-county': 10,
    'california-state': 10,
    'civic-history': 20,
    'local-services': 10,
    'elections-voting': 10,
    'landmarks-culture': 18,
    'budget-finance': 12,
  },

  // Authoritative source URLs for RAG (Phase 24 will fetch and parse these)
  sourceUrls: [
    // City of Fremont
    'https://www.fremont.gov',
    'https://www.fremont.gov/government',
    'https://www.fremont.gov/government/mayor-city-council',
    'https://www.fremont.gov/government/about-city-government',
    'https://www.fremont.gov/about/our-story',
    'https://www.fremontpolice.gov',

    // Alameda County
    'https://bos.alamedacountyca.gov',
    'https://www.acgov.org',

    // Regional agencies serving Fremont
    'https://www.bart.gov',
    'https://www.actransit.org',

    // California State (reference existing california.ts for full list)
    'https://www.ca.gov',
    'https://www.gov.ca.gov',
    'https://www.legislature.ca.gov',
    'https://www.sos.ca.gov/elections',

    // Election information
    'https://www.fremont.gov/government/election-information',
    'https://acvote.alamedacountyca.gov',
  ],
};
```

**Critical notes:**
- `externalIdPrefix`: Must be unique 3-letter code (bli=Bloomington, lac=LA, fre=Fremont)
- `topicDistribution`: Keys must exactly match `topicCategories[].slug`
- `sourceUrls`: Real .gov/.edu/.org URLs that RAG fetcher will attempt to scrape (some may fail due to access restrictions, that's expected)
- Topic descriptions should be specific to Fremont (not generic templates)

### Pattern 3: Topic Categories Parallel Collection Topics

**What:** The 8 topic categories in the locale config correspond 1:1 with database topics that will be created automatically during generation (Phase 24)

**When to use:** Always for community collections

**How it works:**
1. Phase 23: Define `topicCategories` array in locale config
2. Phase 24: Generation script calls `ensureLocaleTopics(collectionSlug, topicCategories)` before first batch
3. `ensureLocaleTopics` upserts topics to database and links them to collection via `collection_topics` junction table
4. Generation script maps question `topicCategory` field to database `topicId` when seeding

**Example from Bloomington:**
```typescript
// Locale config defines topics
topicCategories: [
  { slug: 'city-government', name: 'City Government', description: '...' },
  { slug: 'monroe-county', name: 'Monroe County', description: '...' },
  // ... 6 more
]

// Generation script automatically creates these in database:
// topics table: { id: 31, slug: 'city-government', name: 'City Government', description: '...' }
// topics table: { id: 32, slug: 'monroe-county', name: 'Monroe County', description: '...' }
// collection_topics: { collectionId: 2, topicId: 31 }
// collection_topics: { collectionId: 2, topicId: 32 }
// ... etc
```

**Result:** Questions can be filtered by topic, collection dashboard shows topic breakdown, admin can explore by topic.

### Anti-Patterns to Avoid

- **Don't reuse sort orders:** Each collection must have unique sortOrder (Fremont=3 means LA must move to 4)
- **Don't skip topic descriptions:** Generic descriptions ("Questions about city government") won't help generation prompt — be specific to locale
- **Don't fabricate source URLs:** Only include URLs you've verified exist (RAG fetcher logs failures but continues, but fake URLs waste fetch attempts)
- **Don't activate prematurely:** Keep `isActive: false` until Phase 25 (questions exist and have been reviewed)

## Don't Hand-Roll

Phase 23 is pure configuration—no custom implementations needed.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Topic creation | Manual SQL inserts for topics | `ensureLocaleTopics` utility (Phase 24 auto-runs) | Handles upsert + junction table linking |
| Source document caching | Custom download/parse logic | Existing RAG fetcher from Phase 17 | Already handles cheerio HTML parsing, timeout handling, .gov domain logic |
| Schema validation | Runtime checks for config structure | TypeScript `LocaleConfig` interface | Compile-time validation catches mistakes before runtime |

**Key insight:** Phase 17 built all the infrastructure. Phase 23 is just data entry following established patterns.

## Common Pitfalls

### Pitfall 1: Mission San Jose Disambiguation

**What goes wrong:** "Mission San Jose" refers to BOTH:
1. The 1797 Spanish mission (historic site, founded by Padre Fermín Lasuén)
2. A modern Fremont district/neighborhood (one of the five consolidated towns)

Questions that don't disambiguate will be ambiguous.

**Why it happens:** Context from user research: "Mission San Jose disambiguation approach (determine per-question when explicit era/district labels are needed vs. when context is sufficient)"

**How to avoid:** Document this in locale config comments for Phase 24 generation prompt:
```typescript
// IMPORTANT: "Mission San Jose" disambiguation
// - 1797 Spanish mission: Use "Mission San Jose (historic mission)" or include date/era context
// - Modern district: Use "Mission San Jose district" or "Mission San Jose neighborhood"
// Example good question: "In what year was Mission San Jose, the historic Spanish mission, founded?"
// Example bad question: "What is the population of Mission San Jose?" (ambiguous—district or mission site?)
```

**Warning signs:** Questions mentioning "Mission San Jose" without qualifying words like "historic", "district", "founded", "1797", "neighborhood"

### Pitfall 2: Sort Order Collision

**What goes wrong:** Adding Fremont with `sortOrder: 3` without updating LA's sort order creates a tie

**Why it happens:** Collections seed file is manually maintained, easy to add new entry without checking existing values

**How to avoid:**
1. Check current sortOrder values before adding new collection
2. Update LA collection entry: `sortOrder: 3` → `sortOrder: 4`
3. Document change in commit message

**Current state:**
- Federal: 1
- Bloomington: 2
- LA: 3 (currently)
- Fremont: 3 (new, causes collision)

**Correct state after Phase 23:**
- Federal: 1
- Bloomington: 2
- Fremont: 3 (new)
- LA: 4 (updated)

**Warning signs:** Collection picker shows collections in unexpected order, or duplicate sort orders in database query results

### Pitfall 3: Topic Distribution Math Errors

**What goes wrong:** Topic distribution values don't sum to target question count, or individual topic counts are unrealistic (e.g., 50 questions in one topic)

**Why it happens:** Manual entry of distribution targets without verification

**How to avoid:**
- Sum all values in `topicDistribution`: Should be ≤ `targetQuestions` (100)
- Individual topic minimums: At least 8 questions per topic (below 8, hard to get difficulty distribution)
- Individual topic maximums: No more than 25 questions per topic (above 25, topic dominates collection)
- Check user decisions: "civic history and landmarks/culture get 18-20 questions each, budget & finance gets 12-15, remaining categories get standard 8-12 each"

**Example validation:**
```
city-government: 10
alameda-county: 10
california-state: 10
civic-history: 20
local-services: 10
elections-voting: 10
landmarks-culture: 18
budget-finance: 12
--------------------
TOTAL: 100 ✓ (matches targetQuestions)
```

**Warning signs:**
- Sum is >110 or <90 (too far from target)
- Any topic <8 questions
- Any topic >25 questions

### Pitfall 4: Election Schedule Not Documented

**What goes wrong:** Phase 24 generates questions about current elected officials without expiration dates, causing stale questions to remain active after terms end

**Why it happens:** Election schedule research is mentioned in CONTEXT.md but easy to skip during config creation

**How to avoid:** Add election schedule as comment in locale config:
```typescript
// ELECTION SCHEDULE (for time-sensitive question expiration):
// - Mayor: 4-year terms, next election November 3, 2026
// - City Council: 4-year terms, staggered, next election November 3, 2026 (Districts 1, 3, 5)
// - Current officials' terms end: TBD (research specific incumbents during Phase 24)
// - Source: https://www.fremont.gov/government/election-information
// - Alameda County source: https://acvote.alamedacountyca.gov/election-information/calendar
```

**Research findings:**
- Fremont uses district-based elections (6 districts + at-large mayor)
- Next general election: November 3, 2026
- Filing deadline: August 7, 2026
- Specific term end dates require researching current officeholders

**Warning signs:** Config has no election date comments, or comments say "TBD" without source URLs

### Pitfall 5: Theme Color Conflicts or Inaccessibility

**What goes wrong:**
1. Theme color too similar to existing collection (confusion)
2. Theme color has poor contrast with white text (fails WCAG AA)

**Why it happens:** Color selection is "Claude's Discretion" and not verified against existing colors or accessibility standards

**How to avoid:**
- Check existing colors in `collections.ts`: Federal=#1E3A8A (deep blue), Bloomington=#991B1B (deep red), LA=#0369A1 (ocean blue)
- Choose visually distinct color: Emerald green (#047857) differentiates from blue/red palette
- Verify contrast: White text on #047857 = 4.8:1 contrast ratio (passes WCAG AA for large text, which collection cards use)

**Recommendation for Fremont:** `#047857` (emerald green)
- Visually distinct from existing collections
- Evokes Bay Area natural environment / Mission Peak
- Passes accessibility contrast requirements

**Warning signs:**
- Color is within same hue family as existing collection (e.g., another shade of blue)
- Lightness value >50% (too light for white text)

## Code Examples

### Example 1: Adding Collection to Seed File

**Source:** Pattern from `backend/src/db/seed/collections.ts`

```typescript
export const collectionsData: NewCollection[] = [
  {
    name: 'Federal',
    slug: 'federal',
    description: 'How well do you really know Uncle Sam? Put your federal know-how to the test.',
    localeCode: 'en-US',
    localeName: 'United States',
    iconIdentifier: 'flag-us',
    themeColor: '#1E3A8A', // deep blue
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'Bloomington, IN',
    slug: 'bloomington-in',
    description: 'B-Town bragging rights are on the line!',
    localeCode: 'en-US',
    localeName: 'Bloomington, Indiana',
    iconIdentifier: 'flag-in',
    themeColor: '#991B1B', // deep red - Indiana
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'Fremont, CA',
    slug: 'fremont-ca',
    description: 'Five towns, one city — how well do you know Fremont?',
    localeCode: 'en-US',
    localeName: 'Fremont, California',
    iconIdentifier: 'flag-ca',
    themeColor: '#047857', // emerald green
    isActive: false, // Activate in Phase 25
    sortOrder: 3
  },
  {
    name: 'Los Angeles, CA',
    slug: 'los-angeles-ca',
    description: 'Think you know the City of Angels?',
    localeCode: 'en-US',
    localeName: 'Los Angeles, California',
    iconIdentifier: 'flag-ca',
    themeColor: '#0369A1', // ocean blue - California
    isActive: true,
    sortOrder: 4 // Updated from 3 to make room for Fremont
  }
];
```

### Example 2: Complete Locale Config File

**Source:** Pattern from Bloomington and LA configs

```typescript
// backend/src/scripts/content-generation/locale-configs/fremont-ca.ts
import type { LocaleConfig } from './bloomington-in.js';

/**
 * Fremont, California locale configuration for civic trivia question generation.
 * Used by generate-locale-questions.ts to produce the Fremont collection.
 *
 * Context from v1.4 planning:
 * - Five-town consolidation (1956): Centerville, Niles, Irvington, Mission San José, Warm Springs
 * - Mission San Jose disambiguation: 1797 Spanish mission vs. modern Fremont district
 * - Tesla/NUMMI: Economic impact AND land use/zoning/environmental (full civic story)
 * - Ohlone history: Land acknowledgment level (1-2 respectful questions)
 * - Little Kabul / Afghan-American community: Celebrated with cultural sensitivity
 * - Six-district city council (district-based elections since bylaws)
 */
export const fremontConfig: LocaleConfig = {
  locale: 'fremont-ca',
  name: 'Fremont, California',
  externalIdPrefix: 'fre',
  collectionSlug: 'fremont-ca',
  targetQuestions: 100,
  batchSize: 25,

  topicCategories: [
    {
      slug: 'city-government',
      name: 'City Government',
      description: 'Fremont city government — mayor, six-district city council, city manager, and departments',
    },
    {
      slug: 'alameda-county',
      name: 'Alameda County & Regional Agencies',
      description: 'Alameda County governance PLUS regional agencies (BART, AC Transit, Bay Area regional bodies) serving Fremont',
    },
    {
      slug: 'california-state',
      name: 'California State Government',
      description: 'California state government — governor, legislature, and the ballot propositions system',
    },
    {
      slug: 'civic-history',
      name: 'Civic History',
      description: 'Five-town consolidation (1956), Fremont incorporation, civic movements, Ohlone land acknowledgment, historical milestones',
    },
    {
      slug: 'local-services',
      name: 'Local Services',
      description: 'City utilities, parks and recreation, police and fire services, planning department, municipal services',
    },
    {
      slug: 'elections-voting',
      name: 'Elections & Voting',
      description: 'District-based elections, voting process, Alameda County Registrar, civic participation in Fremont',
    },
    {
      slug: 'landmarks-culture',
      name: 'Landmarks & Culture',
      description: 'Mission San Jose district, Little Kabul (Afghan-American community), Mission Peak, cultural institutions, multicultural identity',
    },
    {
      slug: 'budget-finance',
      name: 'Budget & Finance',
      description: 'City budget, tax structure, Tesla economic impact, Measure E, NUMMI redevelopment, how Fremont funds services',
    },
  ],

  // Target question counts per topic (user decisions from CONTEXT.md)
  topicDistribution: {
    'city-government': 10,
    'alameda-county': 10,
    'california-state': 10,
    'civic-history': 20,        // History + Culture heavy
    'local-services': 10,
    'elections-voting': 10,
    'landmarks-culture': 18,    // History + Culture heavy
    'budget-finance': 12,       // Above standard for Tesla/NUMMI story
  },

  // Authoritative source URLs for RAG — fetched and parsed before generation
  sourceUrls: [
    // City of Fremont
    'https://www.fremont.gov',
    'https://www.fremont.gov/government',
    'https://www.fremont.gov/government/mayor-city-council',
    'https://www.fremont.gov/government/about-city-government',
    'https://www.fremont.gov/government/departments',
    'https://www.fremont.gov/about',
    'https://www.fremont.gov/about/our-story',
    'https://www.fremont.gov/government/election-information',
    'https://www.fremontpolice.gov',

    // Alameda County
    'https://bos.alamedacountyca.gov',
    'https://www.acgov.org',
    'https://www.acgov.org/government/elected.htm',
    'https://acvote.alamedacountyca.gov',

    // Regional agencies (BART, AC Transit)
    'https://www.bart.gov',
    'https://www.bart.gov/about/planning/alameda',
    'https://www.actransit.org',

    // California State (reference california.ts for full list)
    'https://www.ca.gov',
    'https://www.gov.ca.gov',
    'https://www.legislature.ca.gov',
    'https://www.sos.ca.gov/elections',
  ],
};

// ELECTION SCHEDULE (for time-sensitive question expiration):
// - Mayor: 4-year terms, next election November 3, 2026
// - City Council: 4-year terms, staggered by district
// - Alameda County Board of Supervisors: 4-year terms, next election November 3, 2026
// - Source: https://www.fremont.gov/government/election-information
// - County source: https://acvote.alamedacountyca.gov/election-information/calendar
//
// DISAMBIGUATION NOTES:
// - Mission San Jose: Use "Mission San Jose (historic mission)" for 1797 Spanish mission,
//   "Mission San Jose district" for modern Fremont neighborhood
// - Five towns: Centerville, Niles, Irvington, Mission San José, Warm Springs (consolidated 1956)
// - NUMMI/Tesla: Cover economic impact (jobs, tax revenue) AND land use (zoning, environmental review)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SQL for collections | Seed files with Drizzle ORM | Phase 13 (v1.2) | Type-safe, version-controlled collection metadata |
| JSON files for questions | PostgreSQL with collections schema | Phase 13 (v1.2) | Enables collection filtering, expiration, admin tools |
| Hand-written questions | AI-generated + human-reviewed | Phase 17 (v1.2) | Scales question creation for new locales |
| Hardcoded topic lists | Locale config pattern | Phase 17 (v1.2) | Reusable template for new communities |
| Questions activated immediately | Draft status until admin review | Phase 17 (v1.2) | Quality gate before questions reach players |

**Deprecated/outdated:**
- Manual collection creation via psql: Use seed files instead (version-controlled, repeatable)
- Embedding all source URLs in generation prompt: Use RAG fetch + parse pipeline (cleaner prompts, cacheable)

## Fremont-Specific Research Findings

### Five-Town Consolidation (1956)

**Source:** [Fremont, California - Wikipedia](https://en.wikipedia.org/wiki/Fremont,_California), [City of Fremont - Our Story](https://www.fremont.gov/about/our-story)

- Incorporated January 23, 1956
- Five previously independent towns merged: Centerville, Niles, Irvington, Mission San José, Warm Springs
- Led by Wally Pond (chair of incorporation committee)
- Newark was originally included but declined (incorporated separately in 1955)
- Today these are districts/community plan areas, not separate towns

**Impact on questions:** This is a core Fremont identity story—should appear in civic-history topic (multiple questions) and inform landmarks-culture descriptions

### Mission San Jose Disambiguation

**Sources:** [Historical Overview - Muwekma Ohlone Tribe](https://www.muwekma.org/historical-overview.html), [St. Joseph Catholic Church](https://www.saintjosephmsj.org/mission-images-of-mission-san-jose/mission-museum/mission-the-ohlone-indians/)

- **Historic mission:** Founded June 11, 1797 by Padre Fermín Francisco de Lasuén
- **Modern district:** One of five towns that consolidated in 1956, now a Fremont neighborhood
- Disambiguation critical: Questions must clarify which "Mission San Jose" is referenced

**Impact on questions:** Config comments must instruct generation prompt to use explicit labels ("historic mission founded 1797" vs. "Mission San Jose district")

### Ohlone/Indigenous History

**Sources:** [Muwekma Ohlone Tribe](https://www.muwekma.org/), [Ohlone - Wikipedia](https://en.wikipedia.org/wiki/Ohlone)

- Original inhabitants: Alson and Tuibun tribelets (Chochenyo dialect)
- Ohlone village of Oroysom became Mission San Jose site
- Spanish mission system disrupted Ohlone social structures
- Modern descendants: Muwekma Ohlone Tribe traces lineage through Missions Dolores, Santa Clara, San Jose

**User decision:** "Land acknowledgment level — 1-2 respectful questions about Ohlone presence, not deep dive into ongoing political efforts"

**Impact on questions:** Civic-history topic includes 1-2 questions acknowledging Ohlone as original inhabitants, connected to Mission San Jose founding

### Tesla/NUMMI Economic and Civic Story

**Sources:** [Tesla Fortifies California Roots](https://www.tesery.com/blogs/news/tesla-fortifies-california-roots-with-strategic-108-000-square-foot-r-d-lease-in-fremont), [Tesla Fremont Factory - Wikipedia](https://en.wikipedia.org/wiki/Tesla_Fremont_Factory)

- **NUMMI history:** Joint GM-Toyota venture, closed 2010
- **Tesla acquisition:** Purchased site May 2010 for $42 million
- **Economic impact:** 20,000+ jobs, billions in local economy, largest manufacturing employer
- **2026 developments:** R&D expansion, Optimus robot production hub

**User decision:** "Tesla/NUMMI: cover BOTH economic impact (jobs, tax revenue, supply chain) AND land use/zoning (NUMMI closure, factory reuse, environmental review, city council decisions) — the full civic story"

**Impact on questions:** Budget-finance topic gets 12-15 questions (above standard 8-12) to cover economic and land-use angles

### Little Kabul / Afghan-American Community

**Sources:** [How Did Fremont Come to Be Known as 'Little Kabul'? - KQED](https://www.kqed.org/news/12050357/how-did-fremont-come-to-be-known-as-little-kabul), [The Afghan Heart Of Fremont](https://shunculture.com/article/does-fremont-have-more-afghans-than-most-cities-in-afghanistan)

- **Population:** Estimated 30,000 Afghans (largest Afghan community in North America)
- **Location:** Centerville district known as "Little Kabul"
- **History:** Four waves of immigration since 1979 Soviet invasion
- **Cultural hub:** Afghan restaurants, markets, businesses, cultural institutions

**User decision:** "Little Kabul / Afghan-American community framing (Claude determines appropriate balance of celebration and civic context with cultural sensitivity)"

**Impact on questions:** Landmarks-culture topic includes celebration of multicultural identity with sensitivity (e.g., "Fremont's Centerville district is known as Little Kabul and is home to one of the largest Afghan-American communities in North America")

### Election Schedule

**Sources:** [City of Fremont - Election Information](https://www.fremont.gov/government/election-information), [Alameda County Elections Calendar](https://acvote.alamedacountyca.gov/election-information/calendar)

- **Next general election:** November 3, 2026
- **Filing deadline:** August 7, 2026
- **Structure:** District-based elections (6 districts + at-large mayor)
- **County:** Alameda County Board of Supervisors also up for election November 3, 2026

**Impact on questions:** Elections-voting topic includes district-based system, Phase 24 generation must set `expiresAt` for current official questions

### Government Structure

**Sources:** [City of Fremont - About City Government](https://www.fremont.gov/government/about-city-government), [Mayor & City Council](https://www.fremont.gov/government/mayor-city-council)

- **Mayor:** Elected at-large by all voters
- **City Council:** 6 members, one per district, elected by district voters
- **City Manager:** Manages day-to-day operations (appointed, not elected)
- **County:** Alameda County Board of Supervisors (5 members)

**Impact on questions:** City-government topic covers structure, distinctions between mayor/council/manager roles

## Open Questions

1. **Current elected officials' term end dates**
   - What we know: Next election November 3, 2026, terms are 4 years
   - What's unclear: Specific end dates for current mayor and council members (needed for `expiresAt` field)
   - Recommendation: Research during Phase 24 generation (not blocking for Phase 23 config)

2. **Mission San Jose district boundaries**
   - What we know: It's one of the five consolidated towns, now a district
   - What's unclear: Exact geographic boundaries vs. colloquial usage
   - Recommendation: Use "Mission San Jose district" in questions without requiring precise boundary knowledge

3. **Five-district vs. six-district terminology**
   - What we know: City council has 6 districts, but the 1956 consolidation involved 5 towns
   - What's unclear: Whether "five-district structure" in STATE.md refers to historical consolidation or current governance
   - Recommendation: Context indicates historical consolidation (1956) not current council structure—config should clarify both

## Sources

### Primary (HIGH confidence)
- [City of Fremont, CA Official Website](https://www.fremont.gov/) - City government structure, departments, election information
- [City of Fremont - Our Story](https://www.fremont.gov/about/our-story) - Five-town consolidation history (1956)
- [Alameda County Board of Supervisors](https://bos.alamedacountyca.gov/) - County governance structure
- [Alameda County Elections Calendar](https://acvote.alamedacountyca.gov/election-information/calendar) - Election schedule
- [BART Official Site](https://www.bart.gov/) - Regional transit serving Fremont
- [AC Transit Official Site](https://www.actransit.org/) - Regional transit serving Alameda/Contra Costa
- `backend/src/db/seed/collections.ts` - Existing collection pattern (Bloomington, LA)
- `backend/src/scripts/content-generation/locale-configs/bloomington-in.ts` - Locale config pattern and TypeScript interfaces
- `backend/src/scripts/content-generation/locale-configs/los-angeles-ca.ts` - California community locale config example

### Secondary (MEDIUM confidence)
- [Fremont, California - Wikipedia](https://en.wikipedia.org/wiki/Fremont,_California) - Consolidation history verified against city official sources
- [Fremont: The New City 1956 to 1976 - Washington Township Museum](https://museumoflocalhistory.org/research/fremont-stories-1956-1976/) - Historical context for five-town consolidation
- [Muwekma Ohlone Tribe - Historical Overview](https://www.muwekma.org/historical-overview.html) - Indigenous history and Mission San Jose context
- [How Did Fremont Come to Be Known as 'Little Kabul'? - KQED](https://www.kqed.org/news/12050357/how-did-fremont-come-to-be-known-as-little-kabul) - Afghan-American community documentation
- [Tesla Fremont Factory - Wikipedia](https://en.wikipedia.org/wiki/Tesla_Fremont_Factory) - NUMMI/Tesla history and economic impact

### Tertiary (LOW confidence)
- None used (all findings verified with official sources or cross-referenced)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists from v1.2/v1.3, no new libraries needed
- Architecture: HIGH - Bloomington and LA established clear patterns, Fremont follows exactly
- Pitfalls: HIGH - Mission San Jose disambiguation critical and well-documented, other pitfalls are common config errors

**Research date:** 2026-02-20
**Valid until:** 60 days (stable domain—database schema and config patterns unlikely to change)

**Phase dependencies:**
- Phase 23 depends on: Nothing (uses existing v1.2/v1.3 infrastructure)
- Phase 24 depends on: Phase 23 (consumes locale config)
- California state sources cached from: Phase 21 (LA state question generation)

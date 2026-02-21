# Project Research Summary

**Project:** Fremont, CA Collection (v1.4 Milestone)
**Domain:** Civic Trivia - Community Collection Expansion
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

The Fremont, CA collection can be built entirely with the existing community collection pipeline established in v1.2 and refined in v1.3. No new stack additions, architectural changes, or infrastructure work are required. This is the most efficient community collection to date because California state sources (15% of questions) are already cached from the Los Angeles collection, reducing RAG fetch time and API costs.

Fremont presents unique content challenges despite the straightforward technical implementation. As a composite city formed from five formerly-independent towns in 1956 (Centerville, Niles, Irvington, Mission San Jose, Warm Springs), Fremont requires content that respects distinct district identities rather than treating the city as monolithic. The "Mission San Jose" name creates critical ambiguity — it refers to both a historic 1797 Spanish mission AND a modern Fremont district. Content generators must explicitly disambiguate these entities to avoid factual errors. Additionally, high-profile topics like the Tesla/NUMMI factory and Niles film history (Charlie Chaplin) risk violating "no pure lookup trivia" quality rules unless questions focus on civic angles rather than entertainment facts.

The recommended approach: Create a custom Fremont locale config with a `five-districts` topic category, enforce Mission San Jose disambiguation in generation prompts, require civic angles for Tesla/NUMMI content, and verify Fremont's specific election schedule (district-based voting adopted 2017, November 2026 elections) before generating time-sensitive questions. With these Fremont-specific filters in place, the standard 5-phase workflow (config → fetch sources → generate → review → activate) will produce a high-quality 100-question collection in 8-11 hours.

## Key Findings

### Recommended Stack

**No new stack additions required.** The existing community collection pipeline (validated with Bloomington IN and Los Angeles CA) handles all Fremont requirements. The current infrastructure supports unlimited collections through a parameterized generation system.

**Core technologies (already validated):**
- Claude Sonnet 4.5 via @anthropic-ai/sdk: AI generation with RAG for locale-specific questions — proven for civic content
- cheerio + node-fetch: Web scraping for authoritative .gov sources — works with Fremont/Alameda County sites
- Zod 4.x: Question schema validation — covers all question types
- PostgreSQL (Supabase) + Drizzle ORM: Question storage, collections — schema supports unlimited collections
- p-limit: Rate-limited source fetching — prevents overwhelming .gov servers
- TypeScript 5.x: End-to-end type safety — LocaleConfig interface is stable

**Fremont-specific components (all configuration, no code):**
- `locale-configs/fremont-ca.ts`: Configuration file (~120 lines, follows LA pattern)
- ~10-15 source URLs: Fremont city + Alameda County sources (California state sources reused from LA)
- Collection metadata row in `collections.ts`
- Collection card image: `fremont-ca.jpg`

**Key efficiency gain:** California state sources at `backend/src/scripts/data/sources/california-state/*.txt` already exist from LA collection. No re-fetch needed for 15% of questions. Prompt caching provides ~90% cache hit rate on source documents, reducing cost from $20-25 to $2-3 per collection.

### Expected Features

Fremont collection follows the standard 8-topic category structure established for city collections, with Fremont-specific content requirements.

**Must have (table stakes for Fremont residents):**
- Five-district consolidation story (1956 incorporation of Centerville, Niles, Irvington, Mission San Jose, Warm Springs)
- Mission San Jose landmark (1797 Spanish mission founding, 1868 earthquake, 1985 rebuild)
- Tesla factory prominence (largest employer, 22,000 employees, former NUMMI plant)
- Afghan community "Little Kabul" (largest Afghan population in U.S., Centerville district)
- District-based elections (switched from at-large in 2017, current system has 6 districts + mayor)
- Mayor Raj Salwan (first Indian-American mayor, elected 2024, expires Nov 2028)
- Council-manager government form
- Lake Elizabeth/Central Park (450 acres, 83-acre lake)
- Warm Springs BART extension (opened 2017, TOD development)
- Asian majority population (63.78% Asian, most diverse large city in California)

**Should have (differentiators that make Fremont unique):**
- Most patents per capita nationally (1.4 per 100 residents)
- Most startups per capita (more than any other U.S. city)
- Charlie Chaplin/Niles film history (Essanay Studios 1912-1916, "The Tramp" filmed in Niles)
- Five distinct district identities (each former town maintains civic character)
- 98+ languages spoken (over half population born outside U.S.)
- Don Edwards Bay Wildlife Refuge (first urban wildlife refuge, created 1972)
- NUMMI to Tesla transformation story (manufacturing evolution narrative)
- Coyote Hills Ohlone history (Tuibun village 2,000+ years old)
- Warm Springs Innovation District (850 acres, advanced manufacturing focus)
- "Hardware side of Silicon Valley" positioning (900+ manufacturing companies, 1 in 4 jobs)

**Defer (avoid to maintain civic focus):**
- Pure Tesla/NUMMI trivia (production dates, employee counts, model launches) — violates "no pure lookup" rule
- Niles film industry facts without civic angle (which movies Chaplin made, filming locations) — fails civic utility test
- Generic Bay Area questions not specific to Fremont — lack locale relevance
- Exhaustive lists (all council members by name, all parks) — memorization, not reasoning

**Recommended question distribution across 8 topics:**
- Civic History: 18-20 questions (richest material: consolidation, Mission, film, NUMMI/Tesla, Ohlone)
- Landmarks & Culture: 18-20 questions (district identities, Little Kabul, diversity, sites)
- Local Services: 15-18 questions (schools, parks, public safety innovations like Drone First Responders)
- City Government: 12-15 questions (council-manager system, district elections, current officials)
- Elections & Voting: 8-10 questions (2017 transition story, 2024 election)
- County Government: 8-10 questions (Alameda County services, supervisorial districts)
- State Government: 8-10 questions (multiple overlapping districts, Bay Area legislators)
- Budget & Finance: 8-10 questions (innovation economy, manufacturing, challenges)

### Architecture Approach

The architecture is code-complete. Adding Fremont is a configuration and content operation, not a development project. The collection pipeline follows a convention-based discovery pattern where collections are data-driven, not hardcoded. The frontend collection picker automatically displays any collection with `isActive: true`, and the generation/seeding pipeline is fully parameterized by locale config files.

**Integration workflow (standard 5-phase process):**
1. Configuration: Create `fremont-ca.ts` locale config with topic categories, source URLs, distribution targets
2. Source Fetch: Run `generate-locale-questions.ts --locale fremont-ca --fetch-sources` to scrape .gov sites
3. Generation: Run `generate-locale-questions.ts --locale fremont-ca` to generate 100 questions via Claude AI with RAG
4. Review: Human admin reviews draft questions, activates quality questions, archives failures
5. Export/Seed: Export to `fremont-ca-questions.json`, add to seed scripts, deploy to production

**Major components (all existing, no changes required):**
1. Locale Config System: `LocaleConfig` interface defines topic categories, source URLs, question targets — Fremont follows pattern
2. RAG Source Pipeline: cheerio fetches .gov content, saves to `data/sources/fremont-ca/*.txt`, loaded into Claude context
3. AI Generation Engine: Claude Sonnet 4.5 generates questions with civic angle, prompt caching reduces costs
4. Quality Validation: Zod schema validates structure, quality rules engine checks blocking/advisory violations
5. Database Seeding: Idempotent seed scripts with conflict resolution, questions linked to collections via many-to-many
6. Collection Discovery: Frontend loads collections via `/api/game/collections`, renders cards data-driven

**Files to CREATE:**
- `backend/src/scripts/content-generation/locale-configs/fremont-ca.ts` (locale config)
- `backend/src/db/seed/fremont-topics.ts` (topic documentation/reference)
- `backend/src/data/fremont-ca-questions.json` (portable seed data)
- `backend/src/scripts/data/sources/fremont-ca/*.txt` (RAG source documents)
- `frontend/public/images/collections/fremont-ca.jpg` (collection card image)

**Files to MODIFY (minor additions only):**
- `backend/src/db/seed/collections.ts`: Add Fremont collection metadata row
- `backend/src/scripts/content-generation/generate-locale-questions.ts`: Add 'fremont-ca' to supportedLocales map
- `backend/src/scripts/export-community.ts`: Add fremont-ca export call
- `backend/src/db/seed/seed-community.ts`: Add fremont-ca to LOCALES array

**Files UNCHANGED:** All game routes, frontend components, database schema, question service, admin review page.

### Critical Pitfalls

**1. Mission San Jose Conflation (CRITICAL — causes factual errors)**
Content generators confuse "Mission San Jose" (the 1797 Spanish mission, historical landmark) with "Mission San Jose district" (one of five modern Fremont districts formed 1956). Questions asking "When was Mission San Jose founded?" with answer "1956" (district) when residents expect "1797" (mission) are factually wrong. Mixed sources cite both entities without distinguishing them. **Prevention:** Explicit disambiguation required in ALL content: "Mission San Jose, the historic Spanish mission founded in 1797..." OR "The Mission San Jose district of Fremont (one of the five original communities)...". Add disambiguation rule to generation prompt. Flag all questions containing "Mission San Jose" for human review. Address in: Content generation phase (locale config and generation prompt MUST include disambiguation rules).

**2. Five-District Identity Erasure (CRITICAL — creates inauthentic content)**
Treating Fremont as a single unified city ignores that it is five formerly-independent towns (Centerville, Niles, Irvington, Mission San Jose, Warm Springs) that merged in 1956. Each district has distinct history, demographics, landmarks, and civic identity. Residents identify with their district first, especially in district-based council elections (adopted 2017). Questions asking "What is Fremont known for?" without acknowledging district diversity feel generic and disconnected from lived experience. **Prevention:** Create `five-districts` topic category explicitly for district-specific questions (10-15% of collection). Balance "landmarks-culture" questions across all five districts. Add `districtStructure` field to Fremont config documenting district composition. Include generation prompt guidance: "Fremont was formed from five independent communities. Include questions about district-specific history and character." Address in: Locale config design phase (add district structure BEFORE generating content).

**3. NUMMI/Tesla Factory Lookup Trivia Risk (CRITICAL — violates quality rules)**
The Tesla Fremont Factory (formerly NUMMI GM/Toyota joint venture) is Fremont's most internationally-recognized landmark. But most Tesla/NUMMI facts violate "no pure lookup trivia" blocking rule: "In what year did Tesla purchase the NUMMI plant?" (2010 — pure date lookup), "How many employees work at Tesla?" (22,000 — number lookup). These questions fail the dinner party test and civic utility test. **Prevention:** Require civic angle for all Tesla/NUMMI content: "What type of environmental review did the City of Fremont require when Tesla expanded the factory?" (civic process) is GOOD. "When did Tesla begin producing Model S?" (pure lookup) is BAD. Flag all questions containing "Tesla", "NUMMI", "factory" for human review BEFORE database insertion. Add explicit guidance to generation prompt: "Focus on civic aspects: how factory relates to city government, environmental regulations, tax revenue. Avoid dates, production numbers, company history." Alternative: focus on manufacturing sector broadly (900+ companies) instead of Tesla trivia. Address in: Generation prompt design AND quality review checklist.

**4. Time-Sensitive Content Without Correct Expiration Dates (CRITICAL — creates outdated content)**
Fremont has district-based city council elections (6 districts + mayor) on a rotation schedule. The 2026 election (November 3, 2026) will elect specific seats. Questions asking "Who is the current mayor?" (Raj Salwan, elected December 2024) or "Who represents District 3?" require expiration dates. But Fremont's district rotation differs from Bloomington/LA patterns. Setting incorrect expiration dates or missing upcoming elections causes factually wrong answers after elections. **Prevention:** Verify Fremont election schedule from official city sources (fremont.gov/government/election-information) BEFORE generating any "current official" questions. Document election cycle: mayor term length, council district rotation, which districts up in 2026. Set expiration to end of term OR next election date, whichever is sooner. For questions affected by November 2026 election, expire December 31, 2026. Flag all questions containing "current", "who is", "who represents" for expiration date validation. MUST cite official city government page, not news articles. Address in: Content generation setup phase (document Fremont election schedule BEFORE generating time-sensitive questions).

**5. Partisan Framing Risk in Bay Area Tech Boom Narrative (MODERATE — violates neutral framing advisory rule)**
Fremont's identity as "Silicon Valley's hardware side" invites politically loaded framing: "Fremont's tech industry drives economic prosperity" (pro-tech) vs "Tech boom displaced working-class residents" (anti-gentrification). These violate partisan neutrality advisory rule. Civic trivia should explain HOW government works, not advocate for/against economic policies. Questions should present factual civic structure, not editorial takes. **Prevention:** Neutral framing requirement: "What percentage of Fremont jobs are in advanced manufacturing?" (factual, verifiable) is GOOD. "How has tech growth impacted housing affordability?" (loaded — assumes negative impact) is BAD. Focus on civic mechanics, not outcomes (zoning, housing policy, business licenses). Source restriction: cite official city documents (budget, planning reports), not news articles or advocacy groups. Include partisan framing checklist in human review. Address in: Generation prompt design AND human review checklist.

## Implications for Roadmap

Based on research, the Fremont collection follows the standard community collection pattern with Fremont-specific content considerations. Suggested implementation:

### Phase 1: Configuration & Research
**Rationale:** Fremont requires custom configuration despite using standard pipeline. Five-district structure, Mission San Jose disambiguation, and election schedule verification must be established before generating any content to avoid critical pitfalls.

**Delivers:**
- `locale-configs/fremont-ca.ts` with 8 topic categories including `five-districts`
- 10-15 curated authoritative source URLs (Fremont city + Alameda County + California state reuse)
- Topic distribution targeting ~100 questions
- External ID prefix documented (`frem-` recommended to distinguish from `fed-`)
- Election schedule reference (which officials expire when)
- Budget fiscal year timeline (May presentation, June adoption)

**Addresses (from FEATURES.md):**
- Must-have topics identified: five-district story, Mission San Jose, Tesla/NUMMI, district elections, ethnic diversity
- Differentiators prioritized: patents/startups per capita, film history with civic angle, NUMMI transformation
- Anti-features documented: pure Tesla trivia, Niles film facts without civic utility, generic Bay Area content

**Avoids (from PITFALLS.md):**
- Pitfall #1 (Mission San Jose conflation): Add explicit disambiguation to config documentation and generation prompt template
- Pitfall #2 (Five-district erasure): Create `five-districts` topic category in config with 10-15 question target
- Pitfall #4 (Wrong expiration dates): Document Fremont election schedule and fiscal year before generating

**Time estimate:** 2-3 hours (research Fremont government structure, curate sources, create config)

---

### Phase 2: Source Fetch & Generation
**Rationale:** With Fremont-specific config established, the standard generation pipeline runs without code changes. California state sources already exist from LA collection, making this the fastest source fetch of any collection to date.

**Delivers:**
- `backend/src/scripts/data/sources/fremont-ca/*.txt` (10-15 new files: Fremont city + Alameda County)
- California state sources reused from `california-state/` directory (no re-fetch)
- 100 draft questions in database with `status='draft'`
- `fremont-topics.ts` reference file documenting actual generation results

**Uses (from STACK.md):**
- Claude Sonnet 4.5: Generate questions with RAG context from fetched sources
- cheerio + node-fetch: Scrape Fremont/Alameda County .gov sites
- p-limit: Rate-limit source fetching to avoid overwhelming servers
- Anthropic prompt caching: ~90% cache hit rate on source documents, ~$2-3 cost vs $20-25 without caching
- Zod: Validate all questions against schema during generation

**Implements (from ARCHITECTURE.md):**
- RAG Source Pipeline: Fetch authoritative .gov content, save to text files
- AI Generation Engine: 4 batches of 25 questions each, targeting topic distribution from config
- Quality Validation: Zod schema validation + quality rules engine (blocking/advisory checks)

**Avoids (from PITFALLS.md):**
- Pitfall #3 (Tesla/NUMMI lookup trivia): Pre-filter in prompt, flag all Tesla/NUMMI questions for civic angle verification
- Pitfall #8 (Niles film trivia): Require civic angle or skip topic, flag all film history questions for review
- Pitfall #7 (Election system ambiguity): Prompt includes note about 2017 switch to district-based elections

**Commands:**
```bash
cd backend
npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale fremont-ca --fetch-sources
npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale fremont-ca
```

**Time estimate:** 1-2 hours (3 min source fetch due to California reuse + 10 min generation with caching + documentation)

---

### Phase 3: Review & Activation
**Rationale:** Fremont-specific content risks (Mission San Jose conflation, Tesla trivia, partisan framing) require vigilant human review with Fremont-aware quality checklist.

**Delivers:**
- 80-100 active questions ready for play (target: 70%+ first-pass quality rate)
- Draft questions archived or reworked based on quality violations
- Difficulty distribution balanced (30% easy, 40% medium, 30% hard)
- Time-sensitive questions validated with correct expiration dates

**Quality checklist specific to Fremont:**
- Mission San Jose disambiguation: Does question specify "1797 mission" vs "modern district"?
- Five-district representation: Do questions balance across all five district identities?
- Tesla/NUMMI civic angle: Does question focus on civic process (zoning, environmental review, tax impact) not pure facts (dates, numbers)?
- Niles film civic angle: Does film history question connect to historic preservation or cultural programs?
- Partisan framing: Do tech/housing questions present neutral facts or advocate policy positions?
- Expiration dates: Are November 2026 election questions set to expire December 31, 2026?
- Ethnic diversity representation: Do questions reflect Fremont's multicultural civic participation?

**Avoids (from PITFALLS.md):**
- Pitfall #5 (Partisan framing): Human reviewers check all tech/housing questions for neutral framing
- Pitfall #6 (Demographic non-representation): Verify question set feels representative of Fremont's diversity
- Pitfall #11 (Ohlone history sensitivity): Mandatory human review for Indigenous content, verify present-tense framing, acknowledgment of colonization

**Time estimate:** 3-4 hours (review 100 questions with Fremont-specific filters, expect higher retry rate than generic collections)

---

### Phase 4: Collection Activation & Export
**Rationale:** With quality questions activated, integrate Fremont into collection infrastructure and create portable seed data for production deployment.

**Delivers:**
- Fremont collection metadata added to `collections.ts` (name, slug, description, themeColor, sortOrder)
- `generate-locale-questions.ts` updated with fremont-ca in supportedLocales map
- `export-community.ts` updated with fremont-ca export call
- `seed-community.ts` updated with fremont-ca in LOCALES array
- `fremont-ca-questions.json` generated (portable seed file)
- Collection card image added: `frontend/public/images/collections/fremont-ca.jpg`
- Collection set to `isActive: true`

**Integration points (from ARCHITECTURE.md):**
- Collections.ts: Add Fremont metadata row after Los Angeles entry
- Generate script loader: Add 'fremont-ca' to supportedLocales map (line ~86)
- Export script: Add fremont-ca export call after line 136
- Seed script: Add fremont-ca to LOCALES array (lines 53-56)
- Collection card: Convention-based image loading via `/images/collections/fremont-ca.jpg`

**Commands:**
```bash
cd backend
npx tsx src/scripts/export-community.ts
npm run db:seed:community  # Test seeding
```

**Time estimate:** 1 hour (code updates, export, image sourcing)

---

### Phase 5: Verification & Testing
**Rationale:** End-to-end verification ensures Fremont collection is production-ready with no regressions.

**Delivers:**
- Verified Fremont collection appears in picker with correct metadata
- Game playable using Fremont collection (start to results screen)
- Questions verified as Fremont-specific (not federal or other locale)
- Difficulty balance confirmed
- Collection card image loads correctly
- Expiration system verified for time-sensitive questions
- Admin panel shows Fremont questions

**Success criteria (from ARCHITECTURE.md):**
1. Visible: Collection appears in picker with name "Fremont, CA" and description
2. Playable: User can start and complete a game using only Fremont questions
3. Accurate: Questions are Fremont-specific (verifiable against source documents)
4. Portable: `fremont-ca-questions.json` exists and seeds correctly
5. Documented: `fremont-topics.ts` reference file exists with generation metadata
6. Branded: Collection card displays `fremont-ca.jpg` image

**Time estimate:** 1 hour (end-to-end testing, bug fixes if needed)

---

### Phase Ordering Rationale

**Why this order:**
1. Configuration first to establish Fremont-specific requirements (five-district structure, disambiguation rules, election schedule) before any content generation prevents critical pitfalls
2. Source fetch after config because config defines source URLs; California state source reuse makes this uniquely fast for Fremont
3. Generation after sources because RAG requires fetched documents; prompt caching optimizes cost
4. Review after generation to catch Fremont-specific quality issues (Mission San Jose conflation, Tesla trivia, partisan framing) before activation
5. Activation after review to ensure only quality questions reach production; export creates portable seed data
6. Verification last to confirm end-to-end functionality before declaring complete

**Why this grouping:**
- Phases 1-2 are "content creation" (config + generation) — can be done by single developer with civic research skills
- Phase 3 is "quality assurance" (human review) — requires Fremont domain knowledge, separate from code work
- Phases 4-5 are "deployment" (integration + testing) — standard development tasks, no Fremont-specific skills needed

**How this avoids pitfalls:**
- Phase 1 explicitly addresses Mission San Jose disambiguation (#1), five-district structure (#2), and election schedule (#4) BEFORE generating
- Phase 2 includes Tesla/NUMMI civic angle filter (#3) in generation prompt
- Phase 3 human review catches partisan framing (#5), demographic representation (#6), and Ohlone sensitivity (#11)
- Phase 4 integration uses standard patterns, no architectural changes, avoiding technical debt
- Phase 5 verification ensures no regression in existing collections

### Research Flags

**Phases with standard patterns (skip research-phase):**
- All phases: Fremont collection uses well-established community collection pipeline (validated with Bloomington IN and Los Angeles CA in v1.2, refined in v1.3). No new technical research needed. Pattern is code-complete.

**Fremont-specific content research (already completed):**
- Five-district structure documented: Centerville, Niles, Irvington, Mission San Jose, Warm Springs identities
- Election schedule verified: District-based elections adopted 2017, November 2026 elections, mayor/council terms
- Budget fiscal year confirmed: May presentation, early June adoption, FY calendar
- Mission San Jose entities disambiguated: 1797 historical mission vs modern Fremont district
- Source URLs curated: Fremont city, Alameda County, California state (reuse) all verified functional

**Known gaps requiring attention during implementation:**
- Sister city partnerships: Not found in web search, need official verification from fremont.gov or skip topic entirely (Phase 1)
- State Senate District 10 representation: Aisha Wahab running for Congress, verify current representative as of 2026 (Phase 2 generation or Phase 3 review)
- City Manager current name: Not critical for trivia questions, can skip individual name questions and focus on city-manager system structure (Phase 1 config)
- Exact FY 2025/26 budget deficit figures: General trends sufficient for civic trivia, defer exact numbers to avoid outdated content (Phase 1 config, avoid specific dollar amounts)

**No deep research needed:** All Fremont-specific requirements are configuration and content considerations, not technical/architectural unknowns. The generation pipeline is battle-tested with two prior city collections.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies validated with Bloomington IN and Los Angeles CA collections. No new libraries or tools required for Fremont. California state sources already cached from LA collection, verified to exist in `backend/src/scripts/data/sources/california-state/`. |
| Features | HIGH | Fremont city structure, demographics, landmarks verified via official city sources (fremont.gov) and authoritative references (Wikipedia, Ballotpedia). Table stakes and differentiators identified from multiple civic sources cross-referenced. Time-sensitive content (2026 elections, current officials) confirmed via official election pages. |
| Architecture | HIGH | Integration points verified against existing codebase (direct file analysis of locale-configs, seed scripts, export scripts). File paths confirmed. Standard 5-phase workflow proven with two prior collections. No architectural changes required — purely configuration and content work. |
| Pitfalls | HIGH | Fremont-specific pitfalls (Mission San Jose conflation, five-district identity, Tesla trivia, election schedule) verified via official sources and cross-referenced with existing quality rules (`quality-guidelines.ts`). Content pitfall patterns (lookup trivia, partisan framing, civic utility) are established quality philosophy confirmed via codebase analysis. |

**Overall confidence:** HIGH

### Gaps to Address

**During Phase 1 (Configuration):**
- Sister city partnerships: Web search did not find official Fremont sister city relationships. Verify via fremont.gov official page or city council resolutions. If not readily available, skip sister city topic entirely (not core civic knowledge).
- City Manager current name: Optional — can focus questions on city-manager system structure ("How is Fremont's city manager selected?") rather than current individual ("Who is Fremont's current city manager?"). Verify if individual questions are desired.

**During Phase 2 (Generation) or Phase 3 (Review):**
- State Senate District 10 current representative: Research indicates Aisha Wahab running for Congress, may need to verify current representative as of February 2026. If uncertain, focus state questions on Assembly (Alex Lee, verified) and congressional districts (Swalwell/Khanna, verified) and defer Senate questions.
- Exact budget deficit numbers for FY 2025/26: General trends clear (budget challenges, pension costs, sales tax slowdown) but exact deficit dollar amount not found. Recommendation: avoid specific dollar amount questions, focus on "What are primary revenue sources?" and "What challenges does Fremont face?" with structural answers, not numbers that go stale.

**During Phase 3 (Review):**
- Ohlone/Indigenous history sensitivity: All questions about Ohlone people, Mission San Jose colonization impact, or Indigenous history MUST be flagged for human review by someone with Indigenous history knowledge. Use present-tense for ongoing cultural presence, acknowledge colonization, avoid romanticizing.
- Ethnic diversity representation: After generation, review full question set to verify it feels representative of Fremont's demographics (South Asian, Chinese, Afghan communities). Adjust if all questions feel anglicized or default to majority-culture assumptions.

**Not blocking, proceed with gaps noted:**
- All gaps are minor content considerations (individual officials, specific numbers, sensitivity review) that can be handled during implementation. No architectural or technical unknowns remain. The generation pipeline is ready to run with Fremont config.

## Sources

### Primary (HIGH confidence)

**Stack verification:**
- Existing codebase analysis: `backend/package.json`, `backend/src/scripts/content-generation/generate-locale-questions.ts`, `backend/src/scripts/content-generation/locale-configs/bloomington-in.ts`, `backend/src/scripts/content-generation/locale-configs/los-angeles-ca.ts`
- California state sources confirmed at: `backend/src/scripts/data/sources/california-state/*.txt`
- v1.2 Roadmap: `.planning/milestones/v1.2-ROADMAP.md`

**Fremont civic facts:**
- [City of Fremont Official Website](https://www.fremont.gov/) — City government structure, departments, services
- [Fremont History](https://www.fremont.gov/about/history) — Five-district formation (1956), Ohlone presence, Mission San Jose
- [Mayor & City Council](https://www.fremont.gov/government/mayor-city-council) — City structure, 6 districts + mayor, current officials
- [Fremont, California - Ballotpedia](https://ballotpedia.org/Fremont,_California) — Government structure, election system (district-based adopted June 13, 2017)
- [City elections in Fremont, California (2026) - Ballotpedia](https://ballotpedia.org/City_elections_in_Fremont,_California_(2026)) — November 3, 2026 election, filing deadlines
- [Mission San José Wikipedia](https://en.wikipedia.org/wiki/Mission_San_José_(California)) — 1797 founding, 1868 earthquake, historical mission details
- [California Missions Foundation - Mission San Jose](https://californiamissionsfoundation.org/mission-san-jose/) — Authoritative mission history
- [Tesla Fremont Factory Wikipedia](https://en.wikipedia.org/wiki/Tesla_Fremont_Factory) — NUMMI history, 2010 Tesla purchase, current production
- [Fremont FY 2025/26 Budget](https://www.fremont.gov/Home/Components/News/News/1320/1067) — Budget timeline (May presentation, June adoption)

### Secondary (MEDIUM confidence)

**Fremont demographics and context:**
- [Fremont, California - Wikipedia](https://en.wikipedia.org/wiki/Fremont,_California) — Population (~230K), ethnic diversity (63.78% Asian), five-district structure
- [Fremont Demographics | California Census Data](https://www.california-demographics.com/fremont-demographics) — Demographic breakdown, languages spoken
- [Historic Districts | City of Fremont](https://www.fremont.gov/government/departments/economic-development/real-estate-development-investment/historic-districts) — District identities and characteristics
- [How Did Fremont Come to Be Known as 'Little Kabul'? | KQED](https://www.kqed.org/news/12050357/how-did-fremont-come-to-be-known-as-little-kabul) — Afghan community history
- [How Charlie Chaplin and Silent Films Flourished in the East Bay | KQED](https://www.kqed.org/news/11789138/how-charlie-chaplin-and-silent-films-flourished-in-the-east-bay) — Niles film industry history

**Quality rules and civic trivia philosophy:**
- Codebase analysis: `backend/src/scripts/content-generation/prompts/quality-guidelines.ts`, `backend/src/scripts/content-generation/utils/quality-validation.ts`
- [Trivia question fact-checking best practices](https://trivworks.com/2011/05/making-trivia-questions-bulletproof/)
- [How to write fun trivia questions for adults](https://lastcalltrivia.com/bars/adult-questions/)

### Tertiary (LOW confidence, needs validation during implementation)

**Gaps requiring official verification:**
- Sister city partnerships: Not found in web search, need fremont.gov official page or city council resolutions
- State Senate District 10 current representative (February 2026): Aisha Wahab status unclear, verify current representative
- FY 2025/26 budget deficit exact figures: General trends clear, specific dollar amounts not found

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*

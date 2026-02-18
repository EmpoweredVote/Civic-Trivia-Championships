# Domain Pitfalls: v1.2 Community Question Collections

**Researched:** 2026-02-18
**Domain:** Adding community collections, tagging, content expiration, and locale-specific AI content to existing civics trivia game
**Confidence:** HIGH (architecture analysis from codebase) / MEDIUM (locale-specific AI content risks)

## Executive Summary

Adding community question collections to the Civic Trivia Championship introduces risks across five categories: data migration (JSON file to structured storage), content accuracy (local civic facts are harder to verify than federal), content lifecycle (expiration without game disruption), taxonomy governance (tags that stay useful over time), and integration safety (not breaking the existing 120-question federal game). The most dangerous pitfall is **AI hallucination on local government content**, where LLMs have significantly less training data for small municipalities like Bloomington IN than for federal civics. The second most dangerous is **breaking the existing game during migration** since the current `questions.json` is loaded synchronously at server startup via `readFileSync`.

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or trust damage.

### 1. AI Hallucination on Local Government Content (Especially Small Cities)

**What goes wrong:** AI generates plausible-sounding but incorrect local civic facts. "Bloomington's city council has 7 members" when it actually has 9. "The mayor of Bloomington is elected to 3-year terms" when it is 4-year terms. For a small city of 85K people, LLMs have far less training data than for federal government or even large cities like LA.

**Why it happens:** LLM training data is heavily skewed toward federal and state-level government. Local government structures vary enormously across the US (council-manager vs mayor-council vs commission forms). Bloomington IN has minimal web presence compared to federal institutions. LLMs confidently fabricate specifics (council member counts, budget figures, department names) because they pattern-match from other cities.

**Consequences:** Users learn incorrect civic facts about their own community. For a civics education platform with "no dark patterns" philosophy, this is a trust-destroying failure. Local community members will immediately spot errors that would slip past reviewers who are not from that community.

**Warning signs:**
- Generated questions contain specific numbers (budget amounts, council seats, department counts) without source citations
- Facts are plausible but unverifiable from the provided sources
- Same structural facts appear for Bloomington that match a different Indiana city
- Generated content uses generic phrasing ("the city council" vs "the Bloomington City Council")

**Prevention:**
- **Mandatory RAG approach:** Feed actual city government website content to LLM as context, never rely on training data alone for local facts
- **Source-first generation:** Scrape authoritative sources FIRST (bloomington.in.gov, city council minutes, budget documents), THEN generate questions from that source material
- **Local reviewer requirement:** Every locale's content MUST be reviewed by someone who lives in or deeply knows that community
- **Distinguish "structural" from "current" facts:** "Bloomington uses a council-manager form of government" is structural (stable). "The current city manager is..." is current (changes). Tag accordingly
- **Confidence scoring:** Rate each generated question's verifiability. Reject any question where the fact cannot be traced to an authoritative local government source

**Phase to address:** Locale-specific content generation phase (first task: source collection before any AI generation)

**Source confidence:** HIGH -- Based on [AI Hallucination Report 2026](https://www.allaboutai.com/resources/ai-statistics/ai-hallucinations/) showing domain-specific hallucination rates of 10-20%, [CDT research on local government AI](https://cdt.org/insights/ai-in-local-government-how-counties-cities-are-advancing-ai-governance/) documenting verification requirements, and [CITE Journal analysis](https://citejournal.org/proofing/civic-education-in-the-age-of-ai-should-we-trust-ai-generated-lesson-plans/) showing AI chatbots perform poorly on regional civic facts

---

### 2. Breaking Existing Game Flow During Data Migration

**What goes wrong:** The current game loads all 120 questions synchronously at server startup:
```typescript
// game.ts line 17-19
const questionsPath = join(__dirname, '../data/questions.json');
const questionsData = readFileSync(questionsPath, 'utf-8');
const allQuestions: Question[] = JSON.parse(questionsData);
```
Migrating to a database or adding collection-based filtering requires changing this synchronous load to async database queries. Every route that touches `allQuestions` breaks if the migration is incomplete. The shuffle-and-select-10 logic, the `POST /session` questionIds validation, the `GET /questions` endpoint -- all assume `allQuestions` is a fully-loaded in-memory array.

**Why it happens:** The codebase was designed for a single flat file of questions. Adding collections requires either (a) loading ALL questions into memory and filtering by collection tags, or (b) querying a database per request. Both approaches require changing the data access pattern fundamentally.

**Consequences:** Players cannot start games. Server crashes on startup if database is unavailable. Existing federal trivia breaks while new collection features are being built. Regression in the one feature that is currently working and deployed.

**Warning signs:**
- `readFileSync` call removed before async alternative is tested
- `allQuestions` variable referenced in routes but now returns undefined/empty
- Server startup fails when database connection is slow
- Existing E2E game flow (session -> 10 questions -> wager -> results) breaks

**Prevention:**
- **Keep `questions.json` as fallback:** Do not delete the JSON file. Keep it as the source of truth for the 120 federal questions during migration
- **Additive approach:** Add database/collection layer alongside JSON, not replacing it. Federal questions load from JSON. Community questions load from new storage. Merge at the collection-selection layer
- **Feature flag:** `USE_COLLECTIONS=true/false` environment variable. When false, game works exactly as v1.1 (JSON file, random 10, no collection picker)
- **Backward-compatible API:** `POST /session` without a `collectionId` should behave identically to v1.1 (random 10 from all federal questions)
- **Integration test:** After every migration step, run the full game E2E flow with the EXISTING federal questions

**Phase to address:** First phase (data layer) -- must establish backward compatibility before any new features

**Source confidence:** HIGH -- Direct codebase analysis of `C:/Project Test/backend/src/routes/game.ts` lines 17-19 and route handlers

---

### 3. Content Expiration Removing Questions Mid-Game

**What goes wrong:** A question expires (e.g., "Who is the current mayor of Bloomington?") while a player is mid-game with that question in their session. Three failure modes:
1. Question disappears from collection picker count (was "15 questions", now "14") while someone is about to start
2. Question in an active session references data that is now marked expired
3. Expired question appears in results screen but clicking "Learn More" shows stale/wrong information

**Why it happens:** Expiration is designed for the question catalog, not for active sessions. Sessions contain snapshots of questions (the full Question object is stored in the session). But if expiration also triggers cleanup of source material or learning content, the results page may reference removed data.

**Consequences:** Confusing UX. Player sees a question about a former mayor, gets it "wrong" because the answer changed since the question was created. Or worse: player gets it "right" based on outdated information, reinforcing incorrect civic knowledge.

**Warning signs:**
- Collection question count fluctuates during gameplay
- Players report "the answer was wrong" for time-sensitive political questions
- Expired questions still appear in game results with no indication of staleness
- Notifications fire about expired content that players just answered correctly

**Prevention:**
- **Session snapshot isolation:** Sessions already store the full Question object (see GameSession interface). Expiration should NEVER modify or delete questions from active sessions. Only affect the catalog (what questions are available for NEW games)
- **Expiration = soft delete:** Never hard-delete expired questions. Mark as `expired: true, expiredAt: Date`. Keep the data for historical sessions and results
- **Grace period:** Questions marked for expiration get a 24-hour grace period before removal from new game selection. This prevents mid-session surprises
- **Expiration metadata on time-sensitive questions:** Tag questions as `timeSensitive: true` with `validUntil: Date`. Separate from general expiration. Time-sensitive questions get automatic review reminders, not automatic expiration
- **Never auto-expire without human confirmation** for the initial implementation. Queue expirations for admin review. "This question may be outdated -- review and confirm expiration"

**Phase to address:** Content expiration phase -- design the soft-delete + grace period before implementing any auto-expiration

**Source confidence:** HIGH -- Codebase analysis of session storage pattern (sessions store full Question objects in Redis/memory) combined with [content expiration best practices from Kontent.ai](https://kontent.ai/blog/why-you-should-automate-the-unpublishing-of-outdated-content/) and [Liferay content lifecycle management](https://learn.liferay.com/w/dxp/content-management-system/web-content/web-content-articles/using-expiration-and-review-dates-in-web-content)

---

### 4. Collection Size Imbalance Destroying Game Experience

**What goes wrong:** Federal collection has 120 questions. Bloomington collection has 12 questions. Los Angeles collection has 45 questions. A game requires 10 questions. Bloomington players see the same 12 questions every game with only minor shuffle variation. After 2 plays, they have seen every question. Game becomes boring, users churn.

**Why it happens:** Small communities have fewer civic facts to draw from. An 85K-population city has fewer departments, officials, and programs than a 4M-population city. Content generation is harder (fewer sources, fewer facts). The minimum viable game experience requires enough questions that players do not see heavy repetition.

**Consequences:** Players in small communities have a worse experience. Bloomington users see repeats constantly while LA users get variety. The product appears to favor large cities. Small community engagement drops, which undermines the civic education mission.

**Warning signs:**
- Collection has fewer than 30 questions (guarantees 33%+ repeat rate per 10-question game)
- Player feedback mentions "I keep getting the same questions"
- Analytics show declining play counts for small-collection communities
- Collection picker shows a community with < 20 questions

**Prevention:**
- **Minimum collection threshold:** Do not launch a community collection until it has at least 40 questions (ensures < 25% repeat rate per game). Display as "Coming Soon" if below threshold
- **Mixed collection mode:** Allow games to pull from multiple collections. "Bloomington + Federal" gives 12 + 120 = 132 question pool. Player gets a mix of local and national civics
- **Weighted mixing:** For small collections, automatically supplement with federal questions. E.g., 5 local + 5 federal for a community with < 50 questions
- **Transparency:** Show collection size to players. "Bloomington Collection: 25 questions" so expectations are set
- **Prioritize breadth over depth initially:** For small communities, cover more topics shallowly (1-2 questions per topic) rather than deep coverage of a few topics. This maximizes variety per game
- **Quality gate:** "50 great questions > 100 mediocre ones" -- but 10 great questions is not enough for a good game. Find the floor (30-40) and communicate it

**Phase to address:** Collection architecture phase -- define minimum viable collection size BEFORE generating content for any community

**Source confidence:** MEDIUM -- Mathematical analysis of repeat probability (10 drawn from N without replacement) combined with general UX retention research. The specific threshold of 40 is a recommendation, not empirically validated

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded experience.

### 5. Tag Taxonomy Becomes Unusable Over Time

**What goes wrong:** Tags start clean: `federal`, `bloomington-in`, `los-angeles-ca`, `elections`, `budget`. Six months later: `election`, `elections`, `voting`, `Election Day`, `budget`, `Budget`, `city-budget`, `municipal-budget`, `bloomington`, `bloomington-in`, `Bloomington IN`. Synonyms, case variations, and near-duplicates proliferate. Filtering by tags becomes unreliable. Collection definitions using tags return inconsistent results.

**Why it happens:** No tag governance. Multiple content creators (AI generation, human reviewers, volunteer contributors) each create tags ad hoc. No controlled vocabulary. No validation against existing tags. No merge/alias tooling.

**Warning signs:**
- Two tags that mean the same thing (e.g., `elections` and `voting`)
- Tag count grows faster than question count
- Some tags used by only 1-2 questions
- Search/filter returns unexpected results
- Tag case inconsistency in the database

**Prevention:**
- **Controlled vocabulary from day one:** Define a fixed set of allowed tags. New tags require explicit addition to the vocabulary, not ad hoc creation
- **Canonical form enforcement:** All tags normalized to lowercase-hyphenated format (`city-budget` not `City Budget`). Enforce at the data layer, not just the UI
- **Hierarchical tags:** Use `locale:bloomington-in`, `topic:elections`, `type:time-sensitive` prefixed format. Prevents cross-category confusion
- **Maximum tags per question:** Limit to 5-7 tags per question. Forces intentional tagging
- **Tag audit schedule:** Monthly review of tag usage. Merge synonyms, remove orphans
- **Migration from `topicCategory`:** Existing questions already have `topic` and `topicCategory` fields. Map these to the new tag system rather than creating a parallel taxonomy

**Phase to address:** Tag system design phase -- controlled vocabulary and normalization rules before any content tagging begins

**Source confidence:** MEDIUM -- Based on [taxonomy management research from Alpha Solutions](https://www.alpha-solutions.com/us/insight/optimizing-taxonomies) and [WordPress VIP tagging best practices](https://www.parse.ly/5-tagging-best-practices-content-strategy/) noting 30+ top-level labels become unwieldy

---

### 6. Notification Fatigue from Expiring Content

**What goes wrong:** The system dutifully notifies admins about expiring content. Bloomington has an election -- 8 questions expire at once. Budget season ends -- 5 more expire. LA has a special election -- 12 questions need review. Admin receives 25 notifications in a week. Starts ignoring them. Critical expirations (factually wrong content) get lost in noise. Stale content stays live.

**Why it happens:** Notification system treats all expirations equally. No priority levels. No batching. No distinction between "definitely wrong now" (official left office) and "might be outdated" (budget figures from last year).

**Warning signs:**
- Admin stops responding to expiration notifications within 2 weeks
- Notification count per week exceeds 10
- Expired-but-still-live questions found by users, not admins
- No notification priority or severity levels

**Prevention:**
- **Batch notifications:** Weekly digest instead of per-question alerts. "5 questions expiring this week in Bloomington collection"
- **Priority tiers:**
  - P1 (urgent): Official left office, law changed -- factually wrong now. Immediate notification
  - P2 (review): Budget figures from last fiscal year -- probably outdated. Weekly digest
  - P3 (info): General content approaching review date. Monthly summary
- **Dashboard over email:** Build an admin dashboard showing upcoming expirations, not email-based notifications. Admin checks when ready, not interrupted constantly
- **Seasonal awareness:** Pre-schedule bulk review windows around known events (election cycles, budget seasons, legislative sessions). Don't treat predictable expirations as surprises
- **Start with manual review only:** For v1.2, no auto-notifications. Admin dashboard shows expiration status. Notifications added in v1.3 after understanding actual expiration volume

**Phase to address:** Content expiration phase -- design the priority system and batching before implementing any notification mechanism

**Source confidence:** MEDIUM -- Based on [content fatigue research](https://easycontent.io/resources/content-fatigue-2025-lessons-2026-fixes/) and general notification UX patterns

---

### 7. Bloomington vs LA Content Quality Disparity

**What goes wrong:** AI generates great LA content because there is abundant training data, public documentation, and web sources. AI generates mediocre Bloomington content because sources are sparse, city website is smaller, and fewer public documents are indexed. Result: LA collection has rich, detailed questions with verified sources. Bloomington collection has thin, generic questions ("What form of government does Bloomington use?") with weaker source links.

**Why it happens:** Data availability asymmetry. LA has extensive public records online, news coverage from multiple outlets, detailed budget documents, and civic engagement platforms. Bloomington has a city website, a local newspaper (Herald-Times), and limited online municipal documentation. The AI can only be as good as the source material provided.

**Consequences:** Bloomington users get a worse educational experience. The product appears to work better for large cities, undermining the civic education equity goal. Volunteers in Bloomington feel discouraged when their collection seems inferior.

**Warning signs:**
- Bloomington questions are shorter and less specific than LA questions
- Source URLs for Bloomington questions are harder to verify or point to generic pages
- Learning content paragraphs for Bloomington are thinner (1 paragraph vs 3 for LA)
- Generated questions for Bloomington default to state-level Indiana facts rather than city-specific facts

**Prevention:**
- **Source audit per locale BEFORE generation:** Catalog available authoritative sources for each community. bloomington.in.gov, city council agendas (available online), budget documents, Monroe County resources. Know what you have before generating
- **Accept different collection profiles:** Bloomington collection may focus on municipal structure, local history, and community programs. LA collection may also include transportation, environmental policy, and neighborhood governance. Different cities, different strengths
- **Supplement with county/regional content:** For small cities, include Monroe County government questions alongside Bloomington city questions. This expands the question pool without diluting locality
- **Human-written seed questions:** For small communities, have local volunteers write 10-15 seed questions that AI then expands with learning content. Local knowledge fills gaps that AI cannot
- **Quality parity standard:** Same review checklist for all locales. Do not ship Bloomington content that would not meet the bar for LA content. Fewer good questions is better than more bad ones

**Phase to address:** Content generation phase -- source audit as first task for each new locale

**Source confidence:** MEDIUM -- Based on [Bloomberg Cities data capacity research](https://bloombergcities.jhu.edu/news/how-small-cities-can-make-big-leaps-data) on small vs large city data availability, and logical inference from Bloomington IN web presence analysis

---

### 8. JSON-to-Database Migration Data Loss or Corruption

**What goes wrong:** The 120 existing questions in `questions.json` need to coexist with (or migrate to) a database that supports collections and tags. During migration: (a) question IDs change, breaking historical session references, (b) `learningContent` nested objects lose structure in flattening to relational tables, (c) the 33 questions with learning content lose their content, (d) `topicCategory` mapping to new tags is lossy.

**Why it happens:** JSON's flexible nested structure (learningContent with paragraphs array, corrections object, source object) does not map cleanly to relational tables. Migration scripts have bugs. No validation step compares source JSON to migrated database rows.

**Warning signs:**
- Question count after migration does not equal 120
- `learningContent` paragraphs array becomes a single concatenated string
- `corrections` object keys (option indices) lose their mapping
- Existing `topicCategory` values do not appear in new tag system
- IDs change format (e.g., `q001` becomes auto-increment `1`)

**Prevention:**
- **Keep question IDs stable:** Use the existing `q001`-`q120` string IDs as the primary identifier. Do not auto-generate new IDs
- **Store learningContent as JSONB:** If using PostgreSQL (already in the stack for user data), store the `learningContent` field as a JSONB column rather than normalizing it into separate tables. This preserves the exact structure
- **Migration validation script:** After migration, compare every field of every question between JSON source and database. Automated diff, not manual review
- **Reversible migration:** Keep `questions.json` as the source of truth until the database is validated. Migration script should be re-runnable (idempotent)
- **Incremental approach:** Phase 1: Add new questions to database only (community collections). Phase 2: Optionally migrate federal questions later. Do not force migration of working content

**Phase to address:** Data layer phase -- migration validation tooling before any production migration

**Source confidence:** HIGH -- Based on direct analysis of the question schema in `C:/Project Test/backend/src/data/questions.json` showing nested `learningContent` structure, combined with [data migration best practices from Rivery](https://rivery.io/data-learning-center/complete-data-migration-checklist/) and [common migration challenges from Forbytes](https://forbytes.com/blog/common-data-migration-challenges/)

---

## Minor Pitfalls

Mistakes that cause annoyance or minor technical debt.

### 9. Collection Picker UI Adds Friction to Anonymous Quick-Play

**What goes wrong:** Currently, anonymous users can immediately play (random 10 federal questions). Adding a collection picker means they must now choose before playing. Extra click. Extra decision. For first-time visitors, this is a friction barrier. "I just want to play trivia, why do I have to pick a collection?"

**Why it happens:** Collection picker designed for the "returning user who wants local content" use case. Forgot about the "new visitor who just wants to try the game" use case.

**Prevention:**
- **Default collection:** If no collection selected, default to "Federal" (the existing behavior). Collection picker is optional, not required
- **"Just Play" button:** Prominent "Play Now" button that starts with federal questions immediately. Collection picker is a secondary option
- **Remember selection:** For returning users, remember their last collection choice (localStorage). No re-selection needed
- **Progressive disclosure:** First visit = immediate play. Second visit = "Try your local collection!" prompt

**Phase to address:** Collection picker UI phase -- design with default-play path preserved

---

### 10. Locale Identifier Conflicts and Ambiguity

**What goes wrong:** "Bloomington" is a city in Indiana, Illinois, Minnesota, and California. `bloomington` as a locale ID is ambiguous. Someone adds Bloomington IL content. Questions from two different cities get mixed.

**Why it happens:** Locale identifiers use city name only, not city+state. No namespace scoping. Content creators assume their Bloomington is the only one.

**Prevention:**
- **City+State identifier format:** `bloomington-in`, `los-angeles-ca`, `bloomington-il`. Always include state code
- **Enforce at creation time:** Locale creation requires city + state. System validates against a reference list of US cities
- **Display format:** Show "Bloomington, IN" in UI (human-readable), store `bloomington-in` as identifier (machine-readable)
- **Unique constraint:** Database/storage enforces unique locale identifiers

**Phase to address:** Data model design phase -- locale identifier format defined in schema

---

### 11. AI Content Generation Rate Limiting and Cost Overruns

**What goes wrong:** Generating questions for a new community triggers many LLM API calls. Bloomington needs 40+ questions. Each question needs generation, then learning content, then corrections. That is 3+ API calls per question, 120+ calls per community. At scale (50 communities), this is 6000+ API calls. Costs add up. Rate limits hit. Generation fails midway.

**Why it happens:** No cost estimation before generation. No rate limiting in the generation script. No resume-from-failure capability. Existing `generateLearningContent.ts` script runs sequentially but has no batch budgeting.

**Prevention:**
- **Cost estimation:** Before generating, estimate cost: (questions x calls_per_question x cost_per_call). Display to admin. Require confirmation
- **Batch generation with checkpointing:** Generate in batches of 10. Save progress after each batch. Allow resume from last checkpoint
- **Rate limiting:** Add delay between API calls (e.g., 1 second). Respect API rate limits explicitly
- **Budget caps:** Per-community and per-month generation budget. Alert when 80% consumed. Hard stop at 100%
- **Cache deduplication:** If a question generation fails and is retried, do not double-charge. Use idempotent generation keys

**Phase to address:** AI content generation tooling phase -- cost controls before scaling to multiple communities

---

### 12. Existing `topic` and `topicCategory` Fields Create Confusion with New Tags

**What goes wrong:** Every existing question has `topic` ("Constitution", "Branches of Government") and `topicCategory` ("bill-of-rights", "federalism", "voting"). The new tag system adds another layer. Now questions have topic, topicCategory, AND tags. Three overlapping categorization systems. Developers do not know which to use. Queries use different fields inconsistently.

**Why it happens:** Legacy fields were designed for a single flat collection. Tags are designed for multi-collection filtering. Nobody explicitly deprecates the old fields or maps them to the new system.

**Prevention:**
- **Map legacy fields to tags:** `topicCategory: "bill-of-rights"` becomes tag `topic:bill-of-rights`. `topic: "Constitution"` becomes tag `topic:constitution`. Automated, one-time mapping
- **Deprecate but preserve:** Mark `topic` and `topicCategory` as deprecated in the Question interface. Keep them in the JSON for backward compatibility but do not use them in new code
- **Single source of truth:** All new filtering, collection membership, and categorization uses the tag system only. Old fields are read-only legacy data
- **Document the mapping:** Create a reference table showing old field values to new tag equivalents

**Phase to address:** Tag system design phase -- legacy field mapping as part of schema design

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Data Layer / Migration | Breaking `readFileSync` load pattern (#2) | CRITICAL | Keep JSON as fallback, additive approach |
| Data Layer / Migration | JSON-to-DB data loss (#8) | MODERATE | JSONB for nested content, validation script |
| Data Layer / Migration | Legacy field confusion (#12) | MINOR | Map to tags, deprecate old fields |
| Tag System | Taxonomy rot (#5) | MODERATE | Controlled vocabulary, canonical forms |
| Tag System | Locale ID ambiguity (#10) | MINOR | city+state format |
| Content Generation (AI) | Local content hallucination (#1) | CRITICAL | RAG from authoritative sources, local reviewers |
| Content Generation (AI) | Small-city quality gap (#7) | MODERATE | Source audit first, accept different profiles |
| Content Generation (AI) | Cost overruns (#11) | MINOR | Budget caps, batch checkpointing |
| Content Expiration | Mid-game question removal (#3) | CRITICAL | Soft delete, grace period, session isolation |
| Content Expiration | Notification fatigue (#6) | MODERATE | Batch digests, priority tiers, dashboard |
| Collection Picker UI | Anonymous play friction (#9) | MINOR | Default collection, "Just Play" button |
| Collection Sizing | Repeat question boredom (#4) | CRITICAL | Min 40 questions, mixed-collection mode |

## Integration Risks with Existing v1.1 System

These pitfalls are specifically about how new features interact with the existing deployed system:

| Existing Component | New Feature | Risk | Mitigation |
|--------------------|-------------|------|------------|
| `readFileSync` question loading (game.ts:17-19) | Database-backed collections | Server startup failure if DB slow | Keep JSON as fallback, lazy-load DB |
| `allQuestions` in-memory array (game.ts:19) | Collection filtering | All routes assume full array available | Abstract behind collection service layer |
| `POST /session` with optional `questionIds` | Collection-based session creation | New `collectionId` parameter changes session creation | Backward-compatible: no collectionId = v1.1 behavior |
| `shuffle(allQuestions).slice(0, 10)` random selection | Collection-scoped selection | Must select 10 from filtered subset, not all 120 | Collection-aware shuffle function |
| Question `id` format (`q001`) | New community question IDs | ID collision if same format used | Namespace: `fed-q001`, `bloo-q001`, `la-q001` |
| `learningContent` optional field | Mandatory for new questions | Mixed content (with/without learning content) in same game | UI already handles missing learningContent gracefully |
| Redis session storage | Sessions with collection metadata | Session size increases with collection info | Minimal impact -- collection ID is one string field |
| Progression system (XP/gems) | Multiple collections | Same progression regardless of collection? Collection-specific progress? | Decide explicitly. Recommend: single unified progression for v1.2 |

---

## Sources

### AI Content Accuracy (MEDIUM-HIGH confidence)
- [AI Hallucination Report 2026](https://www.allaboutai.com/resources/ai-statistics/ai-hallucinations/) -- Domain-specific hallucination rates 10-20%
- [AI in Local Government: How Counties and Cities Are Advancing AI Governance](https://cdt.org/insights/ai-in-local-government-how-counties-cities-are-advancing-ai-governance/) -- 15 cities discuss unreliability, require verification
- [Civic Education in the Age of AI: Should We Trust AI-Generated Lesson Plans?](https://citejournal.org/proofing/civic-education-in-the-age-of-ai-should-we-trust-ai-generated-lesson-plans/) -- AI chatbots poor at regional civic history
- [Hallucination Rates in 2025](https://medium.com/@markus_brinsa/hallucination-rates-in-2025-accuracy-refusal-and-liability-aa0032019ca1) -- Accuracy and liability analysis

### Data Migration (HIGH confidence)
- [Complete Data Migration Checklist 2026](https://rivery.io/data-learning-center/complete-data-migration-checklist/) -- Planning and validation frameworks
- [Common Data Migration Challenges](https://forbytes.com/blog/common-data-migration-challenges/) -- Schema mismatch, dependency failure patterns
- [Data Migration Challenges and Fixes](https://www.rudderstack.com/blog/data-migration-challenges/) -- Incremental testing approach

### Content Expiration (MEDIUM confidence)
- [Automate Unpublishing of Outdated Content](https://kontent.ai/blog/why-you-should-automate-the-unpublishing-of-outdated-content/) -- Automation strategies and risks
- [Expiration and Review Dates in Web Content](https://learn.liferay.com/w/dxp/content-management-system/web-content/web-content-articles/using-expiration-and-review-dates-in-web-content) -- Lifecycle management patterns
- [Content Fatigue 2025: Lessons and Fixes for 2026](https://easycontent.io/resources/content-fatigue-2025-lessons-2026-fixes/) -- Notification overload patterns

### Taxonomy and Tagging (MEDIUM confidence)
- [Optimizing Taxonomies for Content Hub](https://www.alpha-solutions.com/us/insight/optimizing-taxonomies) -- Tag proliferation prevention
- [5 Tagging Best Practices for Content Strategy](https://www.parse.ly/5-tagging-best-practices-content-strategy/) -- Max 30 top-level labels, maintenance
- [Content Tagging for Better UX](https://leed.ai/blog/content-tagging-better-user-experience/) -- Consistency and governance

### Small City Data Capacity (MEDIUM confidence)
- [How Small Cities Can Make Big Leaps with Data](https://bloombergcities.jhu.edu/news/how-small-cities-can-make-big-leaps-data) -- Data capacity disparities
- [Data-Driven Government in Large and Small Cities](https://medium.com/what-works-cities-certification/data-driven-government-in-large-small-cities-8d52d5bbaf0) -- Capacity and resource differences

### Codebase Analysis (HIGH confidence)
- Direct analysis of `C:/Project Test/backend/src/routes/game.ts` -- Question loading pattern
- Direct analysis of `C:/Project Test/backend/src/services/sessionService.ts` -- Session storage pattern
- Direct analysis of `C:/Project Test/backend/src/data/questions.json` -- Question schema structure
- Direct analysis of `C:/Project Test/.planning/v1.1-MILESTONE-AUDIT.md` -- Current system state

---

## Metadata

**Confidence breakdown:**
- Data migration pitfalls: HIGH -- Direct codebase analysis of exact loading patterns and data structures
- AI content accuracy pitfalls: MEDIUM-HIGH -- External research on hallucination rates + logical inference about Bloomington data sparsity
- Content expiration pitfalls: HIGH -- Session storage pattern analysis (sessions snapshot full Question objects)
- Tag taxonomy pitfalls: MEDIUM -- General taxonomy management research applied to this domain
- Collection sizing pitfalls: MEDIUM -- Mathematical analysis of repeat probability, specific thresholds are recommendations
- Integration risks: HIGH -- Direct analysis of every affected route and service

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days -- stable patterns, locale-specific risks may shift with LLM capability improvements)

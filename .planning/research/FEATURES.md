# Feature Landscape: Community Question Collections

**Domain:** Civic education trivia with locale-specific content collections
**Researched:** 2026-02-18
**Overall Confidence:** MEDIUM-HIGH

## Executive Summary

Adding community-specific trivia collections (Bloomington IN, Los Angeles CA) to an existing federal civics trivia game. This research maps the feature landscape for collection management, selection UX, content tagging, and time-sensitive question handling. The existing codebase loads questions from a single `questions.json` file, selects 10 randomly, and has no concept of collections or locale. The transition from "one pool of questions" to "multiple curated collections" is the core architectural shift.

Key insight: The civic education domain has a unique content lifecycle problem. Unlike general trivia where questions are evergreen ("What year was the Declaration of Independence signed?"), local civic questions are inherently time-sensitive ("Who is the current mayor of Bloomington?"). This is the hardest design problem in this milestone and must be solved correctly in the data model from day one.

---

## Table Stakes

Features users expect in any collection-based trivia experience. Missing these makes the product feel broken.

### TS-1: Collection Picker Screen

**What:** A screen where players choose which question collection to play before starting a game.
**Why expected:** Every trivia platform with multiple categories (Kahoot, Open Trivia DB, Quizizz, Trivial Pursuit) presents a selection interface. Current Dashboard has only a "Quick Play" button -- adding collections without a picker would force a default that confuses users.
**Complexity:** MEDIUM
**Dependencies:** New route/component, backend collection registry
**Notes:** This replaces or augments the current Dashboard "Quick Play" button. Players must understand what they are choosing and why. Card-based selection (not dropdowns) is the standard pattern in game UX -- each collection gets a visual card showing name, description, question count, and a play button.

**Collection card metadata (minimum):**
| Field | Purpose | Example |
|-------|---------|---------|
| Name | Identity | "Bloomington, IN" |
| Subtitle/scope | What's covered | "Local + Indiana State Government" |
| Question count | Set expectations | "120 questions" |
| Icon/image | Visual identity | City seal or state outline |
| Play button | Primary action | "Play" |

**UX pattern recommendation:** Grid of cards (2-3 columns on desktop, single column on mobile). Federal collection should be visually distinct as the "original" but not hierarchically above community collections. Avoid tree/hierarchy navigation -- keep it flat. Players pick a collection and play. That is it.

### TS-2: Collection-Scoped Question Loading

**What:** Backend loads and serves questions from the selected collection, not the global pool.
**Why expected:** If a player picks "Bloomington" they expect Bloomington questions, not a mix with federal.
**Complexity:** LOW-MEDIUM
**Dependencies:** Collection ID passed in session creation API, question storage refactor
**Notes:** Currently `POST /session` takes no collection parameter and draws from a single `allQuestions` array loaded from one JSON file. Must accept a `collectionId` parameter and load from the correct source. The simplest implementation: one JSON file per collection in a `data/collections/` directory, loaded at startup into a `Map<collectionId, Question[]>`.

### TS-3: Collection Metadata Registry

**What:** A structured registry of available collections with their metadata (name, description, question count, status, region).
**Why expected:** The picker screen needs data to render. The backend needs to know which collections exist. Content authors need to know what is available.
**Complexity:** LOW
**Dependencies:** None (foundational)
**Notes:** This can be a simple JSON file (`collections.json`) or a TypeScript config. Does NOT need to be a database table at this scale. Keep it simple: an array of collection objects with id, name, description, region, questionCount, status (active/draft/retired). The backend serves this via `GET /collections` endpoint.

### TS-4: Question Tagging with Collection Membership

**What:** Each question belongs to exactly one collection. Questions also retain their existing `topicCategory` tag for within-collection topic variety.
**Why expected:** The fundamental data model for multi-collection support. Without this, questions cannot be filtered or grouped.
**Complexity:** LOW
**Dependencies:** Question data model extension
**Notes:** The existing Question type has `topic` (free text like "Constitution") and `topicCategory` (enum like "bill-of-rights"). For community collections, add a `collectionId` field to each question. A question belongs to one collection -- no cross-listing. If the same concept appears in federal and state contexts, they are different questions with different framing. Topic categories will need to expand beyond the current federal-only enum (e.g., add "local-government", "state-legislature", "city-council", "budget", "public-safety").

### TS-5: Backward-Compatible Default Collection

**What:** The existing 120 federal questions become the "Federal" collection. Existing gameplay is unaffected.
**Why expected:** Users who return after the update should not be confused. The game they know still works.
**Complexity:** LOW
**Dependencies:** TS-3 (collection registry)
**Notes:** The current `questions.json` becomes `collections/federal.json` (or stays in place with a `collectionId: "federal"` field added to each question). Anonymous users who hit "Quick Play" should either see the collection picker or default to Federal. Recommendation: show the picker -- it introduces the concept of collections and makes community content discoverable.

### TS-6: Minimum Collection Size Enforcement

**What:** Collections must have enough questions to avoid excessive repetition across play sessions.
**Why expected:** A 10-question game drawn from a 15-question pool means players see 67% of questions every session. This kills replayability fast.
**Complexity:** LOW
**Dependencies:** Collection registry validation
**Notes:**

**Repetition math for a 10-question game:**
| Pool size | % seen per game | Expected games before full coverage | Repetition feel |
|-----------|-----------------|-------------------------------------|-----------------|
| 30 | 33% | ~5 games | Heavy repetition by game 3 |
| 50 | 20% | ~9 games | Noticeable by game 4-5 |
| 80 | 12.5% | ~15 games | Comfortable for weekly play |
| 120 | 8.3% | ~25 games | Low repetition, good for daily |

**Recommendation:** Minimum 50 questions per collection for launch. Target 80-120 for good replayability. The project context says "50 compelling questions > 100 mediocre" which aligns. 50 is the floor, 80 is the target, 120 is the existing federal benchmark.

**Enforcement:** Backend should refuse to serve a collection with fewer than a configured minimum (default: 30). Display collections below target count as "Coming Soon" in the picker rather than offering a degraded experience.

---

## Differentiators

Features that set this product apart from generic trivia apps. Not expected, but create real value for civic education.

### D-1: Time-Sensitive Question Expiration

**What:** Questions that reference current officeholders, recent events, or time-bound facts have an `expiresAt` date. Expired questions are automatically excluded from the active pool.
**Why valuable:** This is THE differentiator for local civic trivia. "Who is the current mayor of Bloomington?" is compelling today but actively harmful if the answer is wrong after the next election. Generic trivia platforms do not solve this because their content is evergreen. Civic education platforms MUST solve this.
**Complexity:** MEDIUM
**Dependencies:** Question data model extension, scheduled validation
**Notes:**

**Data model addition:**
```typescript
type Question = {
  // ... existing fields
  collectionId: string;
  expiresAt?: string;        // ISO date, optional (null = evergreen)
  effectiveAt?: string;       // ISO date, optional (null = always active)
  temporalNote?: string;      // "As of January 2026 election"
};
```

**Expiration patterns observed in content platforms (MEDIUM confidence):**
- **Hard expiration:** Question removed from pool entirely after date. Simple, safe. Recommended for MVP.
- **Soft expiration:** Question flagged for review but stays in pool. Risky -- stale content is worse than missing content.
- **Scheduled replacement:** New version of question auto-activates when old expires. Elegant but complex.

**Recommendation:** Hard expiration for MVP. Backend filters `expiresAt < now()` questions at load time. Content authors set expiration when creating time-sensitive questions. A weekly content health check (even manual) flags collections dropping below minimum size due to expirations.

**Content guidance for authors:**
| Content type | Expiration | Example |
|-------------|------------|---------|
| Historical facts | Never expires | "When was Indiana admitted to the Union?" |
| Structural facts | Rare expiration | "How many city council districts?" (changes with redistricting) |
| Current officeholders | Next election + buffer | "Who is the current mayor?" (set to 1 month after election) |
| Recent events | 6-12 months | "What was the 2025 city budget?" |
| Policy questions | Review annually | "What is the current sales tax rate?" |

### D-2: Collection Health Dashboard (Admin)

**What:** A simple view showing each collection's health: total questions, active questions, expiring-soon questions, below-minimum warnings.
**Why valuable:** Community collections maintained by volunteers need visibility into content health. Without this, collections silently degrade as questions expire.
**Complexity:** LOW-MEDIUM
**Dependencies:** D-1 (expiration), TS-3 (collection registry)
**Notes:** This does not need to be a full admin panel. A JSON endpoint (`GET /admin/collections/health`) that returns counts is sufficient for MVP. A simple page can render it later. The key insight: content health monitoring is not optional for time-sensitive content -- it is infrastructure.

**Health metrics per collection:**
- Total questions (all states)
- Active questions (not expired, within effective date)
- Expiring within 30/60/90 days
- Below minimum threshold warning
- Last content update date

### D-3: Locale-Aware Collection Suggestions

**What:** If the app can detect a user's approximate location (via IP geolocation or browser API), suggest their local collection first in the picker.
**Why valuable:** A Bloomington resident opening the app should see "Bloomington, IN" prominently. This removes friction between "I want to learn about my city" and "I found the right collection."
**Complexity:** MEDIUM
**Dependencies:** TS-1 (collection picker), geolocation mechanism
**Notes:** This is a suggestion, not a restriction. All collections remain visible. IP-based geolocation is lightweight and does not require permission prompts (unlike browser Geolocation API). Accuracy to city level is sufficient. Many free/cheap IP geolocation APIs exist. For alpha with only 2 communities, even a simple prompt ("Are you in Bloomington or LA?") could work as a low-tech alternative.

**Recommendation:** Defer to post-MVP. For alpha with 2 communities, manual selection is trivially easy. Invest in this when there are 10+ collections and discovery becomes a real problem.

### D-4: Mixed Collection Mode ("Surprise Me")

**What:** A play mode that draws questions from multiple collections, giving players exposure to civics beyond their own locale.
**Why valuable:** Cross-community civic literacy. A Bloomington player learns something about LA governance and vice versa. Builds empathy across communities.
**Complexity:** LOW-MEDIUM
**Dependencies:** TS-2 (collection-scoped loading)
**Notes:** Implementation: draw N questions from each of M collections (e.g., 4 federal + 3 local + 3 other locale). Requires at least 3 active collections to be meaningful. Label questions with their collection origin during gameplay so players know the context.

**Recommendation:** Defer to post-alpha. Focus on getting individual collections right first. This is a nice engagement feature once there is enough content diversity.

### D-5: Community Contributor Attribution

**What:** Questions can optionally credit the community member who contributed or reviewed them.
**Why valuable:** Volunteer motivation. People contribute more when they get credit. Builds community ownership of the content.
**Complexity:** LOW
**Dependencies:** Question data model extension
**Notes:** Add optional `contributor` field to question: `{ name: string, role: "author" | "reviewer" }`. Display on learn-more modal, not during active gameplay (would be distracting). Low effort, high community value.

### D-6: Per-Collection Topic Categories

**What:** Each collection defines its own set of topic categories relevant to its scope, rather than using a single global enum.
**Why valuable:** Federal categories (congress, judiciary, amendments) do not apply to local collections. Bloomington needs categories like "city-council", "county-government", "public-safety", "parks-and-rec", "budget". LA needs "city-departments", "county-supervisors", "transportation", "water-and-power".
**Complexity:** MEDIUM
**Dependencies:** TS-4 (question tagging), TopicIcon component refactor
**Notes:** The current `TopicCategory` is a hardcoded TypeScript enum with 9 federal-specific values and matching SVG icons. This needs to become collection-scoped.

**Two approaches:**
1. **Global expanded enum:** Add all categories from all collections to one big enum. Simple but does not scale -- every new community adds to the global type.
2. **Collection-defined categories:** Each collection metadata includes its valid topic categories and labels. Questions reference their collection's categories. More flexible, scales to N communities.

**Recommendation:** Approach 2 (collection-defined categories). The TopicCategory type becomes a string (not enum), and each collection's metadata defines the valid values, display labels, and icon mappings. This scales cleanly as communities are added.

---

## Anti-Features

Features to explicitly NOT build. Common in this domain but wrong for this project.

### AF-1: User-Generated Questions (Open Submission)

**What:** Letting any user submit questions directly through the app.
**Why avoid:** Quality control nightmare. The project context emphasizes "AI-generated starting batches, human-reviewed, volunteers refine over time." Open submission without review creates a moderation burden that volunteer-run communities cannot sustain. Bad questions (factually wrong, politically biased, poorly worded) damage trust in an educational product.
**What to do instead:** Controlled content pipeline: AI generates draft -> designated reviewers approve -> questions enter pool. A "Suggest a question" form (text only, not direct-to-pool) is fine for gathering ideas.

### AF-2: Real-Time Collaborative Editing

**What:** Google Docs-style simultaneous editing of question content by multiple contributors.
**Why avoid:** Massive engineering complexity for minimal benefit. Question editing is low-frequency, low-concurrency work. Two volunteers will not be editing the same question at the same time.
**What to do instead:** Simple review workflow. One person edits, another reviews. Version the question files in git. Use pull request workflow for content changes.

### AF-3: Dynamic Difficulty Adjustment Per Collection

**What:** Automatically adjusting question difficulty based on player performance within a specific collection.
**Why avoid:** Premature optimization. With approximately 120 questions per collection and 3 difficulty levels, the existing random-10-from-pool approach provides natural variety. Adaptive difficulty requires significant analytics infrastructure and can feel patronizing in an educational context.
**What to do instead:** Maintain the existing easy/medium/hard distribution in question authoring. Ensure each collection has a healthy mix (roughly 30% easy, 50% medium, 20% hard).

### AF-4: Collection Subscriptions / Notifications

**What:** Push notifications when new questions are added to a collection or when content is updated.
**Why avoid:** Over-engineering engagement mechanics for a civic education tool. The "no dark patterns" philosophy applies here -- notification-driven engagement is a dark pattern in educational contexts.
**What to do instead:** Show "New questions added!" badges on collection cards when content has been updated since the player's last session. Pull, not push.

### AF-5: Nested Collection Hierarchies

**What:** Collections within collections (e.g., Bloomington -> City Council -> Districts -> District 1).
**Why avoid:** Adds navigation complexity without proportional value. At the current scale (3 collections), hierarchy is nonsensical. Even at 20 collections, a flat list with search/filter is simpler and more effective than tree navigation.
**What to do instead:** Flat collection list. Use tags/filters if the list grows beyond approximately 10 (e.g., filter by state, filter by city size). Topic categories within a collection already provide internal structure.

### AF-6: Cross-Collection Leaderboards

**What:** Global leaderboards comparing scores across different collections.
**Why avoid:** Collections have different difficulty levels and question pools. Comparing a federal score to a Bloomington score is meaningless and creates perverse incentives (players avoid harder collections to protect rankings).
**What to do instead:** Per-collection statistics on the player's profile. "You've played Federal 12 times, Bloomington 5 times." Encourage breadth without competitive comparison.

### AF-7: Content Versioning / Question History

**What:** Full version history for every question edit with diff viewing and rollback.
**Why avoid:** Git already provides this. Questions live in JSON files in the repository. Git history IS the version history. Building a custom versioning system duplicates what git does better.
**What to do instead:** Use git for content versioning. Document the content workflow: edit JSON -> commit -> deploy.

---

## Feature Dependencies

```
TS-3 (Collection Registry)
  |
  +-- TS-5 (Default Federal Collection)
  |
  +-- TS-1 (Collection Picker Screen)
  |     |
  |     +-- D-3 (Locale-Aware Suggestions) [DEFERRED]
  |     +-- D-4 (Mixed Mode) [DEFERRED]
  |
  +-- TS-6 (Minimum Size Enforcement)

TS-4 (Question Tagging)
  |
  +-- TS-2 (Collection-Scoped Loading)
  |     |
  |     +-- D-1 (Expiration Dates)
  |           |
  |           +-- D-2 (Health Dashboard)
  |
  +-- D-6 (Per-Collection Topic Categories)

Independent:
  D-5 (Contributor Attribution) -- can be added to data model at any time
```

---

## MVP Recommendation

### Must Have for Alpha Launch

1. **TS-3** Collection metadata registry (JSON config)
2. **TS-5** Federal questions become "Federal" collection (migration)
3. **TS-4** Add `collectionId` to question data model
4. **TS-2** Backend accepts collection parameter in session creation
5. **TS-1** Collection picker screen replacing bare "Quick Play"
6. **TS-6** Minimum collection size enforcement (floor: 30)
7. **D-1** Expiration dates on time-sensitive questions
8. **D-6** Per-collection topic categories (replacing hardcoded enum)

### Should Have (Alpha Quality of Life)

9. **D-5** Contributor attribution field in data model (low cost to add now)
10. **D-2** Collection health endpoint (needed for content maintenance)

### Defer to Post-Alpha

- **D-3** Locale-aware suggestions (only 2-3 communities, manual selection is fine)
- **D-4** Mixed collection mode (need more collections first)
- All anti-features

### Estimated Scope

| Feature | Effort | Risk |
|---------|--------|------|
| TS-3 + TS-5 (registry + migration) | 1 day | Low |
| TS-4 (data model extension) | 0.5 days | Low |
| TS-2 (backend collection routing) | 1 day | Low |
| TS-1 (picker UI) | 1-2 days | Low |
| TS-6 (minimum enforcement) | 0.5 days | Low |
| D-1 (expiration system) | 1-2 days | Medium -- content authoring guidance needed |
| D-6 (per-collection categories) | 1-2 days | Medium -- TopicIcon refactor |
| D-5 (attribution field) | 0.5 days | Low |
| D-2 (health endpoint) | 0.5 days | Low |
| **Content creation (2 collections)** | **5-10 days** | **HIGH -- this is the real bottleneck** |

**Total technical work:** approximately 7-10 days
**Content creation:** approximately 5-10 days (100-240 questions across 2 collections)
**Content is the bottleneck, not code.**

---

## Civic Education Specific Patterns

### What Makes Civic Trivia Different from General Trivia

| Aspect | General Trivia | Civic Education Trivia |
|--------|---------------|----------------------|
| Content lifecycle | Evergreen (facts don't change) | Time-sensitive (officials change, budgets update) |
| Source authority | Multiple valid sources | Official government sources required |
| Political sensitivity | Low (entertainment) | High (perceived bias can destroy trust) |
| Community ownership | Platform-owned content | Community-contributed, community-validated |
| Engagement model | Competitive/entertainment | Learning-first, engagement second |
| Locale relevance | Universal | Hyper-local (my city, my state) |

### iCivics Content Organization (MEDIUM confidence)

iCivics, the largest civic education game platform, organizes content by:
- **Curricular units** (e.g., "State and Local Governments", "Constitution and Bill of Rights")
- **Game type** (simulation games, not trivia per se)
- **Grade level** (elementary, middle, high school)
- **Standards alignment** (Common Core, state standards)

Relevance: iCivics separates federal from state/local content into distinct curricular units, validating the collection-per-locale approach. They do NOT mix federal and local in the same game.

### Political Neutrality in Question Authoring

**Critical for civic education:** Questions must be factual, not partisan. "Who is the current mayor?" is factual. "Is the mayor doing a good job?" is partisan. Content review must explicitly check for bias. This is especially important for AI-generated content -- LLMs can embed subtle framing biases.

**Content review checklist for civic questions:**
- Is the answer verifiable from official government sources?
- Does the question framing favor any political party or ideology?
- Are all answer options plausible and respectful?
- Is the explanation factual and neutral in tone?
- For time-sensitive questions: is the expiration date set correctly?

---

## Sources

### Trivia Platform Patterns
- [Open Trivia Database API](https://opentdb.com/api_config.php) -- Category-based question filtering, 23 categories with numeric IDs (HIGH confidence, official docs)
- [Kahoot Question Bank](https://support.kahoot.com/hc/en-us/articles/16130620877971-How-to-use-Kahoot-question-bank) -- Keyword search across community questions, folder-based organization (MEDIUM confidence, official help docs)
- [Trivia Game UX Case Study](https://medium.com/design-bootcamp/trivia-dive-intern-challenge-9bcefc186517) -- Category voting patterns in multiplayer trivia (LOW confidence, single blog)
- [Open Trivia Database GitHub](https://github.com/el-cms/Open-trivia-database) -- JSON storage with category_id, tags array, language field (MEDIUM confidence)

### Civic Education Platforms
- [iCivics Platform](https://ed.icivics.org/) -- 20+ games organized by curricular unit, federal/state/local separation (HIGH confidence, official site)
- [iCivics State and Local Governments](https://ed.icivics.org/curriculum/state-and-local-governments?page=1,1) -- Dedicated state/local curriculum track (HIGH confidence, official site)
- [Education Commission of the States - Gamification and Civic Learning](https://www.ecs.org/using-gamification-to-enhance-civic-learning/) -- iCivics as leading example (MEDIUM confidence)
- [Georgetown CERL - Gaming Civics](https://cerl.georgetown.edu/gaming-civics/) -- Academic research on civic education games (MEDIUM confidence)

### Content Lifecycle and Expiration
- [Sensei LMS - Course Access Period](https://senseilms.com/documentation/course-access-expiration/) -- Hard/soft expiration patterns, notification timing (MEDIUM confidence, official docs)
- [Frontify - Asset Lifecycle](https://help.frontify.com/en/articles/2224883-asset-lifecycle-and-notifications) -- "Available until" date pattern for time-sensitive content (MEDIUM confidence)
- [Gameful Civic Engagement Literature Review](https://www.sciencedirect.com/science/article/pii/S0740624X19302606) -- Gamification linked to increased civic learning and engagement (HIGH confidence, peer-reviewed)

### Gamification for Government
- [Harvard Data-Smart City Solutions](https://datasmart.hks.harvard.edu/news/article/boosting-engagement-by-gamifying-government-1122) -- Government gamification case studies (MEDIUM confidence)
- [Swagsoft - Gamification for Government](https://www.swagsoft.com/post/gamification-for-government-enhancing-public-engagement) -- Gamified civic education apps teach about voting, government structures (LOW confidence)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Collection picker UX patterns | HIGH | Consistent across all trivia platforms reviewed |
| Collection data model | HIGH | Standard pattern (category ID on questions + metadata registry) |
| Expiration system design | MEDIUM | Patterns borrowed from CMS/LMS platforms, not trivia-specific |
| Minimum collection size | MEDIUM | Mathematical reasoning sound, but no trivia-specific benchmarks found |
| Civic education patterns | MEDIUM | iCivics structure validated, but iCivics uses simulation games not trivia |
| Content authoring workflow | LOW | No established patterns for volunteer-maintained civic trivia specifically |

## Research Gaps

- **Content generation pipeline specifics:** How to efficiently generate and validate 100+ locale-specific civic questions using AI. The existing `generateLearningContent.ts` script provides a starting pattern but has not been tested for locale-specific content at scale.
- **Volunteer contributor workflow:** No established patterns found for managing volunteer civic content contributors. This needs to be designed from scratch, informed by open-source project contribution models.
- **Expiration notification timing:** When to alert content maintainers about expiring questions (30 days? 60 days?) -- no civic-specific guidance found. Recommendation: start with 60 days and adjust based on content maintenance velocity.

---
*Research completed: 2026-02-18*
*Researcher: GSD Project Researcher (Features dimension)*
*Confidence: MEDIUM-HIGH overall*

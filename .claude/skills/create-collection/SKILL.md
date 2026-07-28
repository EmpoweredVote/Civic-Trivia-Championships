---
name: create-collection
description: Autonomously create a high-quality civic trivia collection for a city — research, write questions, scaffold, seed, and activate, all without extra API spend.
argument-hint: "[City, ST]"
---

# /create-collection — Autonomous City Collection Builder

You are running the **create-collection** skill. Your job is to autonomously build a high-quality civic trivia collection for a city — from research through activation — **without calling any paid generation APIs beyond Claude Code itself**.

All research uses WebSearch + WebFetch. All questions are written by you directly. Questions are inserted via the Supabase MCP tool. The paid `generate-locale-questions.ts` pipeline is **NOT used**.

---

## STEP 0 — Gather Inputs

Ask the user (or parse from `$ARGUMENTS`) for the following. If they provided the city in `$ARGUMENTS`, infer as much as you can and only ask for what's missing.

**Required:**
- **City and state** — e.g. "Austin, TX"
- **Slug** — lowercase, hyphenated, e.g. `austin-tx`
- **External ID prefix** — 3 letters, unique across all collections. Check existing prefixes in memory: `bli bxl cam cas fca fre ica ind ins lac mas mis nur ors pla por smo tex wdc`. Choose something that doesn't conflict.
- **Theme color** — hex, e.g. `#1A3A6B`. If not provided, suggest a color that matches the city's official colors or local identity.

**Confirm before proceeding.** Show the user a summary table and ask for a go/no-go.

---

## STEP 1 — City Research

Use **WebSearch** and **WebFetch** to research the city. Your goal is to gather enough civic facts to write 80–100 high-quality questions spanning government, history, landmarks, services, and community.

### 1a. Core Wikipedia fetch
Always start with the city's main Wikipedia article:
```
https://en.wikipedia.org/wiki/[City,_State]
```
Fetch it and read the full content. Extract:
- Founding date and history
- Government structure (mayor-council? council-manager? strong-mayor?)
- Current mayor name and term end date
- City council structure (districts/wards? at-large? how many members?)
- Notable landmarks, institutions, cultural features
- Demographics, economy, notable industries
- Any unique civic facts that distinguish this city

### 1b. Additional targeted searches
Run WebSearch queries for:
- `"[City] city government council members 2025 2026"`
- `"[City] city history founding landmark"`
- `"[City] mayor [current year]"`
- `"[City] notable facts civic"`

For each promising result, fetch the page if it's Wikipedia or a reputable .gov or .edu source.

### 1c. Officeholder research
You need current officeholder names + term end dates for:
- Mayor
- City Council members (all of them, with district/ward if applicable)
- City Attorney or City Manager if separately elected/notable
- State Assembly member for this city's district
- State Senator for this city's district

Search: `"[City] city council 2025"`, `"[City] mayor term expires"`, `"[City state] assembly district [city]"`

**Only include an officeholder if you found their name from a credible source.** Mark any uncertain names as VERIFY during curation.

### 1d. Landmark deep dives
Fetch Wikipedia articles for 2–3 of the city's most notable landmarks or civic institutions. These will generate the richest questions.

### 1e. Source list assembly
As you research, build a list of **Wikipedia-first source URLs** you successfully fetched. These will go in the locale config. Government portal pages (.gov) are OK as supplemental sources but often return nav content — verify they have substantive text before including.

---

## STEP 2 — Design the Locale Config

Based on your research, design the locale configuration **before** scaffolding. You need to decide:

### 2a. Topic categories (4–7 topics for a city)
Good defaults:
- `city-government` — always include; target 18–22%
- `founding-history` — civic origin story; target 12–18%
- `landmarks-culture` — notable places, arts, events; target 15–20%
- `local-services` — transit, utilities, schools, emergency services; target 12–15%
- `economy-development` — major employers, industries, notable development; target 10–15%
- `community-environment` — parks, environment, demographics, notable communities; target 8–12%

Adjust or rename topics to reflect what's genuinely distinctive about this city. If the city has a major unique angle (civil rights history, military base, seafood heritage, etc.), create a dedicated topic for it.

**Topic distribution must sum to 100.**

### 2b. Voice guidance
Write a critical accuracy block (as a comment at the top of the locale config) covering:
- What makes this city's governance DIFFERENT from what you'd assume (no county confusion, no overlap with a nearby bigger city, unique elected offices)
- Common conflation traps (e.g., "don't attribute county services to the city")
- Officeholder term dates
- Any content caps (e.g., "cap casino questions at 9")
- The "no addresses or phone numbers in answer options" rule
- The "no political party labels" rule — no Democrat/Republican/Independent in any field

### 2c. Tagline
Write a distinctive one-liner for this city. Style: rhetorical question OR punchy stakes using a local nickname or fact.

**Never use:** "Test your X civic knowledge!" — that's the placeholder, it's banned.

Good examples:
- "B-Town bragging rights are on the line!" (Bloomington)
- "From the Gulf Coast to the quiz stage — how well do you know Biloxi?"

---

## STEP 3 — Scaffold and Seed

Run the scaffold script from the `backend/` directory:

```bash
cd "C:/Project Test/backend" && npx tsx src/scripts/scaffold-collection.ts \
  --name "[City, ST]" \
  --slug [slug] \
  --prefix [prefix] \
  --theme "[#RRGGBB]" \
  --description "[tagline]"
```

Then seed the database:

```bash
cd "C:/Project Test/backend" && npx tsx src/db/seed/seed.ts
```

Verify seed output — look for the new collection name in the output. If you see errors, diagnose and fix before continuing.

---

## STEP 4 — Write the Locale Config File

The scaffold created a placeholder at:
```
backend/src/scripts/content-generation/locale-configs/[slug].ts
```

**Replace its contents entirely** with a properly filled locale config using the structure below. Base it on your research from Step 1 and design decisions from Step 2.

```typescript
import type { LocaleConfig } from './bloomington-in.js';

/**
 * [City, ST] locale configuration for civic trivia question generation.
 *
 * CRITICAL ACCURACY NOTES:
 * - [Key governance distinction — what makes this city unique]
 * - [Common conflation trap to avoid]
 * - [Any unique elected offices]
 * - ALL officeholder questions MUST have expiresAt
 * - No addresses or phone numbers in answer options (quality rule)
 *
 * CURRENT OFFICEHOLDERS:
 * - Mayor: [Name] (term ends [YYYY-MM-DD])
 * - [Council members with wards/districts if applicable]
 */
export const [camelCaseSlug]Config: LocaleConfig = {
  locale: '[slug]',
  name: '[City, ST]',
  externalIdPrefix: '[prefix]',
  collectionSlug: '[slug]',
  targetQuestions: 130,
  batchSize: 25,
  overshootFactor: 1.4,

  topicCategories: [
    // ... one entry per topic from Step 2a
    // Each description should be 3–6 sentences of dense guidance
    // Include specific facts, names, dates the generator should use
    // Include what to avoid for this topic
  ],

  topicDistribution: {
    // Must sum to 100
  },

  officeholders: [
    // Only include if you found the name from a credible source
    // { name: '...', role: '...', district: '...', termEnd: 'YYYY-MM-DDT00:00:00Z' }
  ],

  sourceUrls: [
    // Wikipedia-first
    // Verify each URL returns substantive content (not nav/sitemap)
  ],
};
```

After writing, verify the file compiles by checking it has no obvious TypeScript errors (balanced braces, valid JSON arrays, etc.).

---

## STEP 5 — Look Up Collection ID

You need the database `id` of the newly seeded collection to insert questions. Use the Supabase MCP:

> **The live schema is `trivia.*` and snake_case.** Tables must be qualified
> (`trivia.collections`, not `collections`) and columns are `external_id`,
> `correct_answer`, `expires_at`, `is_active`, `topic_id` — not camelCase.

```sql
SELECT id, slug, is_active FROM trivia.collections WHERE slug = '[slug]';
```

Save this ID.

**Topics are global, not owned by a collection.** `trivia.topics` has no
collection column; the link is the `trivia.collection_topics` join table. Create
your topic rows, then link them:

```sql
INSERT INTO trivia.topics (name, slug, description, created_at) VALUES
  ('City Government', '[prefix]-city-government', '...', NOW())
  -- one row per topic
ON CONFLICT (slug) DO NOTHING RETURNING id, slug;

INSERT INTO trivia.collection_topics (collection_id, topic_id, created_at)
SELECT [collection_id], id, NOW() FROM trivia.topics WHERE slug LIKE '[prefix]-%'
ON CONFLICT DO NOTHING;
```

Save the returned topic IDs — every question needs a `topic_id`.

---

## STEP 6 — Write and Insert Questions

This is the core of the skill. You will write **80–100 high-quality civic trivia questions** directly, drawing on your research from Step 1. No external generation API is called.

### 6a. Question quality rules (enforce every question)

1. **Question text** — Stands alone, no "in this city" ambiguity. Clear, specific, factual.
2. **4 answer options** — All must be real, plausible alternatives. No obviously wrong distractors. No addresses or phone numbers.
3. **Correct answer** — 0-indexed (0=A, 1=B, 2=C, 3=D).
4. **Explanation** — Must start with `"According to [source name], ..."`. Cite the specific Wikipedia article or source.
5. **Difficulty mix** — ~40% easy, ~40% medium, ~20% hard.
6. **Topic distribution** — Follow the percentages you defined in Step 2. For 90 questions: multiply each % by 0.9 to get target counts.
7. **External IDs** — Format: `[prefix]-001`, `[prefix]-002`, etc. Sequential, no gaps.
8. **ExpiresAt** — Set to officeholder's termEnd for any question about a specific officeholder. NULL for durable structural/historical questions.
9. **Source** — Every question needs `{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/..." }` or the actual source.
10. **Max 1 question per officeholder** — Do not write two questions about the same person.
11. **No political party labels** — Never use "Democrat", "Republican", "Independent", or any party affiliation in question text, answer options, or explanations. Ask about the person or the role, not their party. This applies to distractors too — do not use party names even as wrong answer choices.

### 6b. Question writing approach

Work through topics one at a time. For each topic, write the target number of questions before moving to the next. Think of question "types" to ensure variety:
- **Structure questions** (how government works, term lengths, how many council members) — durable
- **History questions** (founding date, first mayor, historic events) — durable
- **Current officeholder questions** — always expiring
- **Landmark questions** (what is X, when was Y built, who designed Z) — durable
- **Policy/service questions** (what service does the city provide, what board oversees X) — usually durable

### 6c. Batch insert via Supabase MCP

Insert questions in batches of 20 using `execute_sql`. Use this template for each batch:

**`trivia.questions` has no collection column.** Questions carry a `topic_id`;
the collection link is the `trivia.collection_questions` join table, populated
separately in 6e. The activate script does NOT populate it, and
`/api/game/collections` joins on it — skip 6e and the collection ships empty.

```sql
INSERT INTO trivia.questions (
  external_id, text, options, correct_answer, explanation,
  difficulty, topic_id, source, expires_at,
  status, created_at, updated_at
) VALUES
(
  '[prefix]-001',
  'Question text here?',
  '["Option A", "Option B", "Option C", "Option D"]',
  0,
  'According to Wikipedia''s article on [City], ...',
  'easy',
  [topic_id],
  '{"name": "Wikipedia", "url": "https://en.wikipedia.org/wiki/[City]"}',
  NULL,
  'draft',
  NOW(),
  NOW()
),
-- ... more questions
;
```

**After each batch insert:** run a quick count check:
```sql
SELECT COUNT(*) FROM trivia.questions WHERE external_id LIKE '[prefix]-%';
```

Continue until you have 80–100 questions inserted. Aim for at least 85.

### 6d. Fix answer-position bias — DO NOT SKIP

Writing questions one at a time reliably produces `correct_answer = 0` almost
every time; observed rates have been 78–96%. That makes the collection trivially
gameable — always picking A scores near-perfect. It is invisible unless you
measure it.

Check, then rotate to a forced-uniform spread:

```sql
SELECT correct_answer, COUNT(*) FROM trivia.questions
WHERE external_id LIKE '[prefix]-%' GROUP BY 1 ORDER BY 1;

WITH numbered AS (
  SELECT id, options, correct_answer,
         (row_number() OVER (ORDER BY hashtext(external_id)) - 1)::int % 4 AS target_pos
  FROM trivia.questions
  WHERE external_id LIKE '[prefix]-%' AND jsonb_array_length(options) = 4
),
calc AS (
  SELECT id, options, correct_answer, target_pos,
         ((correct_answer - target_pos) % 4 + 4) % 4 AS k FROM numbered
),
rot AS (
  SELECT id, target_pos,
    jsonb_build_array(options->((0+k)%4), options->((1+k)%4),
                      options->((2+k)%4), options->((3+k)%4)) AS new_options
  FROM calc
)
UPDATE trivia.questions q
SET options = r.new_options, correct_answer = r.target_pos, updated_at = NOW()
FROM rot r WHERE q.id = r.id;
```

Then **spot-check that answers survived** — confirm `options ->> correct_answer`
still returns the right value for several known questions before moving on.

Re-check the difficulty mix the same way; hand-written batches skew medium-heavy,
so promote the genuinely obvious ones to `easy` to reach roughly 40/40/20.

### 6e. Link questions to the collection — REQUIRED

```sql
INSERT INTO trivia.collection_questions (collection_id, question_id, created_at)
SELECT [collection_id], id, NOW() FROM trivia.questions
WHERE external_id LIKE '[prefix]-%'
ON CONFLICT DO NOTHING;
```

### 6f. Expiring question check

```sql
SELECT
  COUNT(*) FILTER (WHERE expires_at IS NOT NULL) AS expiring,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE expires_at IS NOT NULL) / COUNT(*), 1) AS pct
FROM trivia.questions
WHERE external_id LIKE '[prefix]-%' AND status = 'draft';
```

**Target: 15–30% expiring.** If below 15%, write additional officeholder questions (current mayor, council members) and insert them.

**If the city genuinely has too few officeholders, shrink the pool instead of
padding.** A small at-large council caps how many verifiable current officials
exist. Bend, OR has a 7-member at-large council and only 13 verifiable
officeholders, so the collection was sized at 86 questions to clear 15% honestly
rather than inventing officials or guessing at names. Never manufacture an
officeholder to hit the ratio — write down the ceiling in the locale config so a
later run doesn't "fix" it.

Also: if an office is mid-transition (a chief being reappointed, a search under
way), **omit it** rather than shipping a name that expires immediately, and note
the omission in the config.

---

## STEP 7 — Banner Image

Every collection needs a banner image at:
```
frontend/public/images/collections/[slug].jpg
```

**City collections:** iconic local landmark (pier, civic hall, notable structure).
**State collections:** state capitol building (hard rule).

### Source it from the shared EV library first

Empowered Vote hosts curated, licence-checked place banners in a public bucket:
`https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos/`
— `cities/<slug>.jpg`, `states/<ABBR>.jpg`. Prefer these over hand-picking.
Caveats: licences vary (they are NOT all CC0), slugs are state-scoped, and the
real filename may be versioned — check the registry comment block above
`CURATED_LOCAL` / `STATE_PANORAMAS` in the essentials repo's
`src/lib/buildingImages.js` (Bend is served from `cities/bend-v2.jpg`, not
`cities/bend.jpg`). Not every place is covered.

### Licensing — attribution is not optional

CC BY and CC BY-SA require a **visible** credit. Being a nonprofit does not
exempt you; that is the separate NonCommercial term. Add any credit-requiring
image to `frontend/src/data/bannerCredits.ts`, which renders at `/credits`, and
to `frontend/public/images/collections/ATTRIBUTIONS.md`. CC0 and public domain
need nothing. Prefer CC0 when quality is comparable.

### Size and crop for CTC's box — measure, don't assume

- **Resize to ~1600px wide, roughly q82.** Cards render into a 160–180px-tall
  box; multi-megabyte banners are pure waste. The folder was once 71MB with a
  single 15MB file.
- **CTC crops horizontally, not vertically.** The card is a fixed-height box at
  card width (~1.1:1 to 1.9:1), so `object-fit: cover` keeps **100% of the
  height** and only the **middle ~34–59% of the width**. Subjects must be
  **horizontally centred**; wide panoramas lose their ends. This is the opposite
  axis from the essentials app, so guidance written for that app does not
  transfer.
- **Verify the crop with ffmpeg** before accepting an image:
  `ffmpeg -i in.jpg -vf "crop=<w*1.081/aspect>:<h>:<x>:0" out.jpg` and look at it.
- Avoid vintage postcards (printed captions), film scans (dust and scratches),
  and heavy snow or overcast frames — all have been rejected for this reason.

### Search approach:
1. Search for `"[City] [landmark] Wikimedia Commons"` or `"[City landmark] free image"`
2. Use WebFetch to check if a Wikimedia Commons image URL is available
3. If you find a usable URL, tell the user exactly what to download and where to save it

If you can't find a free image programmatically, instruct the user:
> "Please download an image of [specific landmark] from Wikimedia Commons or a free source and save it as `frontend/public/images/collections/[slug].jpg`. It should be at least 800px wide."

Do NOT skip this step — the activate script will fail without the banner.

---

## STEP 8 — Audit and Activate

> ### ⚠ SHIP THE CODE BEFORE YOU ACTIVATE
>
> **Activation is a database change and takes effect instantly. The banner ships
> through git.** Activate first and the card appears in production immediately,
> pointing at an image that 404s until the frontend redeploys.
>
> This happened to Madison, WI and Bend, OR. Milwaukee, WI shipped first and had
> no gap. Correct order:
>
> 1. Audit (8a–8b) and confirm READY.
> 2. Commit, PR, merge the locale config + banner + seed entry.
> 3. Wait for the Render deploy and confirm the banner serves **HTTP 200** with a
>    byte size matching the local file.
> 4. **Then** run the activate script (8c).
>
> Between steps 1 and 4 nothing is user-visible: the collection is
> `is_active = false` and its questions are `draft`. There is no rush.

### 8a. Audit
Run the readiness audit — **`--prefix` is required, not optional**:
```bash
cd "C:/Project Test/backend" && npx tsx src/scripts/audit-collection-readiness.ts --slug [slug] --prefix [prefix]
```

Review the output. If it warns about expiring ratio, go back to Step 6f.
If it warns about fewer than 50 questions, you need to write more before activating.

### 8b. Verify banner exists
```bash
ls "C:/Project Test/frontend/public/images/collections/[slug].jpg"
```

If missing, do not proceed — handle Step 7 first.

### 8c. Activate (dry run first) — only after the code is deployed
```bash
cd "C:/Project Test/backend" && npx tsx src/scripts/activate-collection.ts --slug [slug] --prefix [prefix] --dry-run
```

Review the dry-run output. If everything looks correct:
```bash
cd "C:/Project Test/backend" && npx tsx src/scripts/activate-collection.ts --slug [slug] --prefix [prefix]
```

### 8d. Confirm live
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://civic-trivia-frontend.onrender.com/images/collections/[slug].jpg"
curl -s "https://civic-trivia-backend.onrender.com/api/game/collections" | grep -c '"slug":"[slug]"'
```

---

## STEP 9 — Final Report

After activation, print a summary:

```
✅ [City, ST] collection activated

Stats:
- Total active questions: [N]
- Expiring questions: [N] ([%]%)
- Topic breakdown: [topic: N, ...]
- External ID prefix: [prefix]
- Slug: [slug]
- Theme: [color]
- Banner: ✅ / ⚠️ pending

Quality notes:
- Tagline: "[tagline]"
- Officeholders covered: [list]
- Sources used: [list]

Carry-forward notes for curation:
- [Any topics that need review]
- [Any officeholders that should be verified]
- [Any questions flagged VERIFY]
```

**After printing the report, immediately address every carry-forward note before declaring the skill complete:**

- For each **VERIFY officeholder**: confirm the name from a second source; if unconfirmed, archive the question via SQL (`UPDATE trivia.questions SET status = 'archived' WHERE external_id = '...'`).
- For each **officeholder rule violation** (more than 1 question per official): archive the duplicates, keeping only the most useful question per person.
- For each **topic needing review**: re-read the affected questions and archive any that are inaccurate, ambiguous, or redundant.
- For **expiring ratio below 15%**: document it as a structural ceiling (all viable offices covered) — acceptable if true; do not manufacture expiring questions by inventing unverified officials.

Only after all notes are resolved is the collection ready to push. Do not leave open curation items.

---

## QUALITY CHECKLIST (run mentally before activation)

- [ ] Every question stands alone — no "in this city" ambiguity
- [ ] No addresses or phone numbers in any answer option
- [ ] No political party labels anywhere (question text, options, or explanation)
- [ ] All officeholder questions have expiresAt set
- [ ] No two questions about the same officeholder
- [ ] Tagline is distinctive — not "Test your X civic knowledge!"
- [ ] Banner image exists at the correct path
- [ ] Banner is ~1600px wide, under ~1MB, subject horizontally centred
- [ ] Banner credit added to `bannerCredits.ts` if the licence requires it
- [ ] **Correct answers spread roughly evenly across positions 0–3** (measure it)
- [ ] Difficulty mix is roughly 40/40/20 (measure it — hand-written batches skew medium)
- [ ] Rows exist in `trivia.collection_questions` (Step 6e)
- [ ] Expiring ratio is 15–30%
- [ ] Total active questions ≥ 80
- [ ] No questions that would belong in a future city collection (if this is a state collection)
- [ ] Cross-collection overlap checked in BOTH directions against existing sibling collections
- [ ] All Wikipedia sources are cited by name in explanations
- [ ] **Code merged and banner confirmed serving before activation**

---

## KNOWN PITFALLS (from past collections)

1. **Government portal pages return nav content** — Don't use .gov pages as primary research sources. Wikipedia first.
2. **County vs. City confusion** — Always verify: is the mayor you found the city mayor, not county executive?
3. **Nearby city confusion** — Especially for cities near metros (SM ≠ LA, Fremont ≠ SF, Cambridge ≠ Boston). State clearly in questions.
4. **Speaker Pro Tem gap** — Generation often misses this role for cities with councils. Check if it exists for this city.
5. **At-large vs. district councils** — Verify the council structure before writing any district-specific questions.
6. **State legislators** — Verify which Assembly and Senate district covers this city before writing those questions.
7. **Name spelling** — Look up official spellings (e.g., `"FoFo" Gilich` in Biloxi). Do not guess nicknames.

---

*This skill was designed for the Civic Trivia Championship project. It uses Claude Code's built-in tools only — no extra API keys required.*

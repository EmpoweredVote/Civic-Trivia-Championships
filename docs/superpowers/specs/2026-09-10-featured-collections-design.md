# Featured Collections — Design

> **Status:** approved design, in implementation. **§3's Layer 1 mechanism has been
> replaced** — the design's claim key was falsified by live runs on 2026-09-10 and
> the corrections are recorded inline there. Read §3 before relying on any
> deduplication claim in this document.
> **Written:** 2026-09-10.
> **Input:** `2026-09-08-events-collections-brainstorm-prep.md` (audit + open questions).

## Goal

A **Featured** shelf at the top of the collection picker holding four events-focused collections — **World News**, **US News**, **War in Iran**, **Climate Change** — each drawing on the nightly RSS pipeline.

**Intent: no two of them cover the same fact.** That is the design goal, not a delivered guarantee. §3 records what the deduplication layers have actually been measured to do and where they are still known to miss.

## Scope

In: the `featured` flag and shelf (A); story routing (B); World News and US News scaffolds (C); Climate Change rebuilt with a curated spine (D); cross-day and cross-collection deduplication (E).

Out, deferred to the next milestone: the source/bias occurrence ledger (F) and the question-shape rules engine (G). Both are better designed against real routed data than guessed at now. Note that `claim-extractor.ts:182` already instructs the generator to avoid motive, intent, blame, and prediction claims, so part of G is in place; the audit's motive questions came from curated content, not the pipeline.

---

## 1. Root cause this design corrects

`pipelineCron` loops over registered collections and calls `runPipeline` once per collection. `run-pipeline.ts:109` calls `fetchAllFeeds(INTERNATIONAL_FEEDS)` *inside* that loop. Both registered collections therefore ingest the same four feeds and generate questions independently from identical input.

Measured consequence (2026-09-10): of Climate Agreements' 90 active questions, **36 share a correct answer with a live War in Iran question** — King Harald's age, the AfD's vote share, the CDU's share, Topcider Cemetery, Patriarch Porfirije, Trump's $5,000 pledge, 28 centrifuge cascades, 332 Meta advertisements, Tung Chee-hwa's age, 3,775 Shinjuku lodgings, San Juan. Not drift: the same articles processed twice.

Adding two collections under the present shape would make it four times.

---

## 2. Story routing

Invert the loop: **ingest once per night, route each story to exactly one lane, then generate per lane.**

```
fetchAllFeeds()      ---+
clusterStories()        |  once per night
extractClaims()         |  <- add `lane` to CLAIM_EXTRACTION_SCHEMA
                     ---+
        |
        v  group by lane
war-in-iran | us-news | world-news | climate-change
        |
        v
generateQuestions() per lane
```

Routing costs **no additional API calls**. `claim-extractor.ts:206` already makes one structured-output Claude call per story cluster; `lane` becomes a field in the existing JSON schema.

### Lane precedence

Most specific wins, `world` is the sink:

```
iran  >  climate  >  us  >  world
```

| Story | Lane | Why |
|---|---|---|
| US strikes Iranian oil tankers | `iran` | `iran` outranks `us` |
| EPA emissions rule struck down | `climate` | `climate` outranks `us` |
| Trump's convention pledge | `us` | US domestic, no higher lane |
| King Harald V's funeral | `world` | sink |

Exactly one lane per story, so a single fact cannot appear in two collections sitting side by side on the shelf. This also closes the Iran leak: Iran stories stop arriving in World News, and world stories stop arriving in War in Iran.

`InternationalLocaleConfig` loses `collectionSlug` as the loop key and gains a lane-to-collection mapping resolved once per run.

### Feed set

The current four feeds (BBC World, NPR World, Guardian World, DW) are all world-desk feeds. Routed against them alone, US News would contain only US stories that *foreign* desks choose to cover — tariffs, presidential politics, mass-casualty events — which is a collection about how the US is seen abroad, not a US news collection.

**Add US-domestic feeds to the shared ingest.** Still one ingest, still routed, so this does not disturb the single-assignment guarantee; it widens the input so the US lane has real material.

> **ATTEMPTED AND FAILED, 2026-09-10 — the US lane has no domestic feed.** Both
> candidates this section originally named are unusable, and the surviving feed
> set is three world desks: BBC World, The Guardian, DW.
>
> - **NPR** serves RSS but blocks bot access to article bodies as policy. Measured:
>   `www.npr.org` returns 0 bytes after a 20s timeout for `CivicTriviaBot/1.0`
>   *and* for an honest identifying UA (`CivicTriviaBot/1.0
>   (+https://empowered.vote)`), while returning 200 in ~111ms for a browser UA.
>   We will not spoof a browser UA to defeat a deliberate block. Both NPR feeds
>   were removed — note the long-standing `NPR` world feed had **never** produced
>   a usable article, so the pipeline had been running on three feeds, not four,
>   and burning ~5 min/run on timeouts.
> - **AP** is unreachable: the `rsshub.app/apnews` mirror 403s declaring itself
>   test-only, and every `apnews.com` RSS endpoint sits behind a Cloudflare
>   challenge.
>
> **Consequence for Plan 3:** `us-news` can only receive US stories that foreign
> desks choose to cover — exactly the "how the US is seen abroad" collection this
> section warns against. **Do not create `us-news` until a domestic source is
> found.** The most promising avenue is not another feed URL but the 300-word
> body gate: `rss-ingestor.ts` already falls back to RSS `content:encoded`, and it
> is the word gate rather than the fetch that rejects NPR. A source whose
> `content:encoded` clears 300 words needs no body fetch at all.

---

## 3. Deduplication

No OpenAI, no embeddings, no new service dependency. Two layers, both local.

### Layer 1 — claim fingerprint (primary)

Deduplicate at the **claim** layer, before question generation, not at the question layer after it. This is the load-bearing decision: two nights covering King Harald's death produce the *same claim* (subject `King Harald V`, attribute `age at death`, value `89`). Fingerprint the normalised `(subject, attribute, value)` tuple, and drop any claim whose fingerprint has already produced a question within the last **14 days**.

Because both duplicate questions descend from one claim, catching it here means the second question is never written — cheaper and more reliable than detecting the similarity of two finished questions.

Fingerprints are stored in a new table, `trivia.claim_fingerprints`, pruned beyond 30 days. **The fingerprint is two columns, not one**, and the split carries meaning:

| Match | Verdict |
|---|---|
| same `topic_key` **and** same `value_key` | **duplicate** — the fact is already covered |
| same `topic_key`, **different** `value_key` | **contradiction** — two live answers to one question |

Columns: `id bigserial pk`, `topic_key text not null`, `value_key text not null`, `lane text not null`, `question_external_id text`, `generation_job_id int references generation_jobs(id) on delete set null`, `first_seen_at timestamptz not null default now()`; unique index on `(topic_key, value_key)`, lookup index on `(topic_key, first_seen_at desc)`.

The contradiction verdict is the more valuable half: a duplicate is cosmetic, while two different correct answers to the same question can both be served to a player inside the same window. The audit found both classes live — Meta's India ad count as 84 (`clima-1599`) and 78 (`wiran-1640`), and the AfD's vote share as 43.8% and 44%. Applied 2026-09-10 as migration `create_claim_fingerprints`.

**Both layers are scoped across all four lanes, not per lane.** Single-assignment routing (§2) already makes the same *story* impossible in two collections, so cross-lane checking is not the primary defence — it is the safety net for a routing misclassification, where one night's story is filed under `us` and the next night's under `world`. Cross-lane scope costs nothing and turns a routing error into a skipped duplicate rather than a visible one.

**Correction, 2026-09-11 — the claim key above does not work, and has been replaced.** Everything from "Fingerprint the normalised `(subject, attribute, value)` tuple" onward describes a mechanism that two live runs 90 seconds apart falsified. It is left in place because the table's two-column split and the contradiction verdict survive; the *identity rule* does not.

What failed: the extractor re-authors the claim between runs on identical input. One story came back as `houthi capture mokha port yemen|distance from bab al-mandab strait` = `75km`, then `houthi seizure mokha port yemen|distance from bab al-mandab strait after capture` = `75` — a synonym in the subject, an appended qualifier in the attribute, and a dropped unit in the value. Any one of those breaks string equality. **String-normalised keys are the wrong primitive for deduplicating model-authored text**, because the model varies synonym choice and qualifying phrases between runs and normalisation cannot absorb either.

What replaced it, as implemented in `ev-accounts` (`5508183a`, `7610a4d1`, `9a515d38`):

- **A claim is a duplicate when its normalised value equals a recent claim's value AND the two stories' entity sets overlap by Jaccard ≥ 0.34.** Identity is anchored on the *cluster's named entities*, which the model does not re-author, rather than on its prose.
- **Those entities are the pairwise union of the overlaps that joined the cluster's articles**, not the intersection across all of them. The intersection measured empty on every cluster larger than two articles — that is, on every running story, which is exactly the population that recurs. A leave-one-out membership-drift simulation put the union at 0/18 below the 0.34 threshold, against 14/18 for the intersection and 2/18 for a present-in-most-articles quorum.
- **`normalizeValue` now splits a unit glued to its number** (`75km` → `75`). It did not before, and since value equality is checked first, the whole rule short-circuited on the motivating case.
- **A cluster with fewer than two usable entities falls back to the old topic-key rule.** That fallback is the mechanism described above, with its known weakness; it is now the exception rather than the normal path.

**Proven and not proven.** Proven: 1,646 unit tests green, including regression tests pinning both defects; and on live feeds the shipped code yields usable entity sets for 7 of 9 clusters, up from 4 of 9, with the two previously-blind multi-article clusters going from 0 entities to 8 and 6. **Not proven: no live end-to-end run has yet observed this rule catching a duplicate.** The 0.34 threshold remains a hypothesis rather than a tuned value — there is still no corpus of real cross-day entity measurements behind it, which is why `run-pipeline.ts` logs every computed overlap under `[DedupOverlap]`. Treat §3 as "the known structural blindness is removed", not as "duplicates cannot ship".

### Layer 2 — trigram safety net

`pg_trgm` 1.6 is **already installed** in project `kxsdzaojfaibhuzmclfq` — in the **`extensions`** schema, which is NOT on the database's `search_path` (`"$user", public`). Every call must therefore be schema-qualified as **`extensions.similarity(...)`**; unqualified it fails with `42883: function similarity(unknown, unknown) does not exist`. Qualify rather than altering `search_path`: the application connects as `ctc_app` via the session pooler, whose path may differ again. (Verified 2026-09-10. Note that `pg_available_extensions.installed_version` reporting 1.6 establishes only that the extension is installed, not that the function is reachable.) Before insert, compare each candidate question's text against active and recently expired questions across **all four lanes** using `extensions.similarity()`, and skip above threshold. Starting threshold **0.55**, tuned during implementation against the fixtures below.

This catches paraphrase that survives Layer 1 because the extractor structured the claim differently on two nights — the `89` versus `89 years old` class.

**Correction, 2026-09-11 — Layer 2 is not a net for the Layer 1 miss class.** The sentence above overstates it. Measured on the real questions from the falsifying run: the *true duplicate* scored **0.4468** — below the 0.55 threshold, so it shipped — while a pair of *genuinely different* facts scored **0.5086**, because both carry the boilerplate "7 October 2023 Hamas-led attacks on Israel" while asking about deaths versus hostages. The duplicate scored lower than the non-duplicate. **No threshold on trigram similarity separates the two**, because lexical overlap tracks same-*story*, not same-*fact*.

The 0.55 figure itself came from eight fixtures spanning 0.2759–0.8850, every one a cross-day duplicate of near-identical phrasing. A genuine recurrence in genuinely different words lands around 0.45, inside the band that choice deliberately left uncovered — the fixtures were unrepresentative of the thing being defended against. Layer 2 is therefore a backstop for near-identical phrasing with a known miss band, and the primary defence has to hold on its own.

### Two constraints, both from things that have already bitten

- **Scope by `collection_questions`, never by prefix.** The existing city/state implementation filters `prefix + '-%'` (`generate-locale-questions.ts:386`), which is the documented `ind` collision footgun — `LIKE 'ind-%'` matches questions across both Indiana and Indio CA. Join through the link table.
- **Never skip silently.** The prior embedding dedup was gated on `if (process.env.OPENAI_API_KEY)` and returned quietly when unset, so an unset key made the feature a no-op with no signal. Both layers here are local and unconditional; any skip writes a WARN into `generation_jobs.notes`.

**Correction, 2026-09-10:** an earlier draft of this line claimed skips "surface in admin pipeline health." **No such surface exists.** `trivia.generation_jobs` is written by this pipeline and read by nothing else in `ev-accounts` — verified by grep. "Never skip silently" is therefore satisfied at the *write* side only; detection today is manual SQL against `notes`, which is what §9's "review after the first week" actually requires someone to do. An admin read surface is unbuilt work, not an existing mitigation.

### Regression fixtures

Known duplicate pairs, to be encoded as tests:

| Pair | Layer that must catch it |
|---|---|
| `wiran-1578` / `wiran-1661` — Harald at 89, `89` vs `89 years old` | 2 |
| `wiran-1579` / `wiran-1659` — 35-year reign | 1 |
| `wiran-1615` / `wiran-1635` — Canada tariffs, 8 Sept | 1 |
| `clima-1599` / `wiran-1640` — Meta ads in India, **84 vs 78** (contradiction) | 1, cross-lane |
| `clima-1552` / `clima-1573` / `clima-1614` — AfD, 43.8% twice then 44% | 1 |

Three coincidental same-answer pairs that must **not** be flagged: `wiran-1611`/`1657` (both "2026"), `wiran-1630`/`1635` (both "September 8, 2026"), `wiran-1639`/`1665` (both "August 2026") — unrelated stories. An answer-equality detector flags all three and misses the Harald pairs entirely, which is why answer equality is not used.

### Existing War in Iran contents

No migration. All 71 generated `wiran-1***` questions expire by 2026-09-14 unaided; the 23 curated `wiran-00**` questions remain as the collection's spine. The pool self-cleans within four days of routing shipping.

---

## 4. The `featured` flag and shelf

`featured` is a boolean **orthogonal to `tier`**: a collection keeps its real taxonomy and is additionally featured. The shelf is editorial surface, not a taxonomy, so any collection can be promoted for a while and demoted later.

```sql
ALTER TABLE trivia.collections
  ADD COLUMN featured boolean NOT NULL DEFAULT false;
```

### Deploy order — load-bearing

1. `db/schema.ts:17` (ev-accounts) — add the column beside `tier`
2. `routes/game.ts:68` — add `featured: collections.featured` to the select
3. `frontend/src/features/collections/types.ts:8` — add `featured: boolean`, then the picker

**Steps 1–2 must be deployed and verified in production before step 3.** The frontend static site auto-deploys from `master` on any `frontend/` commit while ev-accounts deploys separately, so a frontend-first merge reads `undefined` and renders an empty shelf. This is the same failure shape as the health-check lesson in CLAUDE.md: deploy the route, verify it returns, *then* point something at it.

### Picker changes

A Featured section rendered first, reading the flag rather than `TIER_ORDER`. Featured collections also continue to appear in their home tier section.

- **React keys must be section-scoped.** A featured collection renders twice, so a bare `key={c.id}` collides. Prefix the key in the shelf (`featured-` plus the id).
- **The shelf collapses while a search query is active.** `filterCollections` runs before grouping, so with the shelf present a search hit would appear twice in a filtered view, which reads as a bug.

### Admin toggle

Add a `featured` toggle to `frontend/src/pages/admin/CollectionsPage.tsx`. Without it the flag can only be changed by SQL, and an editorial shelf nobody but an engineer can edit is not editorial.

---

## 5. Collections

| | slug | prefix | tier | featured |
|---|---|---|---|---|
| World News | `world-news` | `wnews` | `international` | true |
| US News | `us-news` | `usnws` | `federal` | true |
| War in Iran | `war-in-iran` | `wiran` | `international` | true |
| Climate Change | `climate-change` | `climc` | `international` | true |

US News takes `tier = 'federal'`, so it also appears in the Federal section beside the United States collection. This is accepted as the least-wrong option: the collection is US-scoped, and `international` would be actively misleading.

Setup follows the documented manual path, because `seed.ts` and `activate-collection.ts` both hang after "PostgreSQL connected" when run via `npx tsx`: insert the collection, topics, and `collection_topics` rows via SQL, then run the **guarded** `collection_questions` insert (the bare `LIKE '<prefix>-%'` form cross-links on a shared prefix).

Each collection needs a banner at `frontend/public/images/collections/<slug>.jpg` and a tagline of **64 characters or fewer** — never the generic "Test your X knowledge!" placeholder. Draft taglines, to be confirmed:

- World News — "The world moved this week. Did you notice?"
- US News — "Seven days, fifty states. Keep up?"
- Climate Change — "The measurements are public. How well do you know them?"

### Retiring Climate Agreements (id 267)

Collection 267 stays `is_active = false` permanently. Its 90 active questions are **archived now** rather than left to expire, because `status = 'active'` rows inside a dead collection inflate active counts for another ten days and remain exposed to any prefix query reaching for `clima-%`.

The new collection uses prefix **`climc`**, deliberately not `clima`: 267's rows keep that prefix forever, and a shared prefix is the documented collision footgun.

Why 267 is retired rather than renamed: of its 90 questions, roughly **one** is about climate (`clima-1584`, a glacial collapse) and **none** are about climate agreements. It has **no curated anchor block at all** — unlike War in Iran, which has 23 hand-written questions. It was a second unfiltered copy of the world feed, which is why it was switched off.

---

## 6. Curated spines, and why only two collections get one

**War in Iran** (existing, 23 questions) and **Climate Change** (new, target 20–25) get hand-written evergreen spines. Both are topics with genuine background that does not expire.

**World News and US News get no spine.** Manufacturing evergreen US content fails the same test the state-collection rule applies — "could another collection own this question?" — because a general US civics or history question is one the **United States** collection should own. A World News spine has the same problem in a vaguer way.

Instead, **guard availability dynamically**: omit a featured collection when its playable pool is below `TOTAL_QUESTIONS` (5). With `MAX_QUESTIONS_PER_RUN = 8` and four-day expiry a lane sits near ~32 questions at steady state, but a quiet night or a stalled cron can dip it, and a collection that cannot deal a game is worse than one that is not shown.

**The guard belongs in the API, not the picker.** `routes/game.ts` already joins `collection_questions` to build the collections response and is the only place that knows the playable count; the frontend receives a list it cannot second-guess. Implement it as a `HAVING` clause on the existing query rather than a new endpoint, so an under-stocked collection is simply absent from the payload.

---

## 7. Climate Change content charter

The collection must be defensible to a reader who is *sceptical of the politics around the subject* — the test is that someone who works in oil and gas can play it and find it accurate rather than dismiss it as a partisan hit-job. Dramatic is fine when the drama is in the measurement. Advocacy is not.

Every question in the curated spine, and every generated question routed to this lane, must satisfy:

1. **Source-anchored stems.** Any contested quantity names its source in the question. The template already in the bank is `wiran-1567`: "According to the United Nations…". The hedging template is `wiran-0031`: "believed to be a joint US-Israel operation".
2. **Measured over modelled.** Prefer observation — Mauna Loa CO₂, the NOAA and NASA GISS temperature records, satellite altimetry sea level, glacier mass balance, national emissions inventories — to projection. Where a projection is unavoidable, the question names the body, the model, and the scenario.
3. **Documented instruments over interpretation.** What a treaty text says, who ratified and when, what an NDC pledges, what a court ruled, how a vote fell. These are checkable and uncontested as facts about the record.
4. **No motive, intent, or blame stems.** Already the generator's rule (`claim-extractor.ts:182`); it is a hard rule for curated content too.
5. **No characterisation of any actor.** No "big oil", no "deniers", no "greenwashing" asserted as fact. Companies, governments, and campaigners are referred to by name and action only.
6. **Include evidence that complicates a simple narrative**, where it is true and documented: emissions intensity per unit of GDP, coal-to-gas switching effects, nuclear's share of low-carbon generation, energy-access statistics, the published uncertainty range on carbon sinks. A collection whose every fact points one direction reads as advocacy even when each fact is true — and this is the single most important rule for passing the oil-worker test.
7. **Uncertainty is content.** Where a published figure has a range, ask the range rather than inventing a point value.
8. **No policy-preference questions.** Nothing of the form "should X". Only what was measured, signed, ratified, ruled, or voted.
9. **Expiry discipline.** Officeholder and pledge questions carry `expiresAt`; physical-record questions are evergreen. Target 15–30% expiring, per project convention.

### Two mechanical requirements for the spine

- **`placeAnswer()` must be called on every insert.** Generator prompts anchor `correctAnswer` to index 0, so answer position is guarded at write time. Any new question-insert path that skips it ships a collection where the answer is always first.
- **Distractor brackets must not repeat the rank-3 bias.** Project-wide, the correct value sits third of four in 54% of all-numeric questions (1,154 questions, 31% of the bank) because generators pad a true value with two smaller distractors and one larger. For a spine that will be heavily numeric, design distractors so the correct value sometimes sits entirely above or entirely below them, sort options ascending, and target a roughly uniform value rank across the collection. Sorting ascending makes value rank equal display position, so one edit satisfies both checks. Beware that a `1 year` option silently drops a question out of the audit metric on a singular/plural unit mismatch.

---

## 8. Testing

- **Lane precedence and Layer 1 fingerprint normalisation are pure functions** — unit tested in node, which is what this repo's vitest setup supports.
- **Layer 2** tested against fixture rows; `pg_trgm` is in-database, so no service stub is needed.
- **The regression fixtures in §3** are *a* test for E, not the acceptance test. They are all cross-day pairs of near-identical phrasing, and passing them is what made the 0.55 threshold look sound while it missed a real duplicate at 0.4468. **The acceptance test for E is a live run repeated on the same feeds**, because the failure mode is the extractor re-authoring a claim, and no fixture written by hand exhibits it — one that did would have been written from the phrasing you already thought of.
- **The picker cannot be component-tested here.** No DOM-capable component tests exist, by design — vitest is node-only. Three interaction bugs of exactly this class shipped on one branch and were caught by reading the code, not by tests. The shelf therefore gets a deliberate read plus a real page load: `npm run smoke` in `frontend/`. A green build is not evidence — that is the Vite 8 lesson.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Two repos, two deploy cadences, ordering-sensitive | §4 deploy order; verify the API field in production before merging frontend |
| Double-render key collision, search interaction | §4 picker changes; verified by page load |
| Trigram threshold too loose or too tight | **Mitigation falsified 2026-09-11.** The §3 fixtures cannot tune it: they are all near-identical phrasing, and a threshold that passes them still missed a real duplicate at 0.4468 while a non-duplicate scored 0.5086. No threshold separates the classes. Layer 1 must carry it; Layer 2 is a backstop with a known miss band |
| Entity overlap threshold (0.34) is a hypothesis, not a tuned value | `[DedupOverlap]` logs every computed overlap, pass and near-miss alike; revisit once a week of real runs exists. A threshold set too high silently reverts claims to the weak prose fallback |
| Routing misclassifies a story class systematically | Lane distribution logged per run in `generation_jobs.notes`; review after the first week |
| Banners and taglines are content work, not code | Three images and three taglines tracked as explicit tasks |
| `backend/` in this repo is frozen (decision 0013) | All pipeline and API work lands in `ev-accounts/backend/src/trivia/`; only `frontend/` changes here |

## 10. Open items carried to the next milestone

- **F — source/bias occurrence ledger.** Record per question which feed item produced it and every human judgment of bias, so source trust ratings can eventually be earned rather than asserted. `question_flags` exists and may carry the reason taxonomy; `generation_jobs.notes` is already jsonb per run.
- **G — question-shape rules engine.** A shape allowlist (dates, counts, offices, documented votes, treaty text, attributed figures) and banlist (motives, characterisations, party-affiliation-as-answer, private individuals' crimes). The audit's 3c findings — named private individuals' crimes as trivia — are concentrated in the retired 267 pool and are the most urgent class.
- **Renaming the United States collection**, which reads closer to American History, or American Judicial History, than civics.

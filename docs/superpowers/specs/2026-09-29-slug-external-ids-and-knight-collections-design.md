# Slug-derived external IDs, and the Knight Cities/States program

**Date:** 2026-09-29
**Status:** Design approved, ready for implementation planning
**Decided by:** Chris

---

## Why this exists

The next thing CTC wants is a collection for each Knight Foundation community and each of
their states — 35 net-new collections against a current roster of 44. The external-ID prefix
convention cannot absorb that, and it degrades further if city coverage ever broadens beyond
the Knight list.

Two separate problems, one spec, because the second is the reason the first is urgent.

### What was decided

| Question | Decision |
|---|---|
| Rename existing external IDs? | **No — forward-only.** The 47 legacy prefixes stay exactly as they are. |
| New ID scheme? | **Slug-derived**, `<collection-slug>_<NNNN>`. |
| Non-city Knight communities? | **City-only**, anchored on the city Knight names. No county tier. |
| Delivery shape? | **Program spec now**, collections in batches of 2–3 per milestone. |
| Pilot | **Akron OH + Ohio.** |

Forward-only is safe because the prefix stopped being an identifier on 2026-09-08: activation
scopes by `collection_id`, and `trivia.bobit_progress` keys player progress by collection
*slug*. Nothing joins on the prefix. Its only remaining job is being legible to a human
reading a ruling or a fixture (`ins-049`, `pla-172`).

### Why not a better mnemonic scheme

A state-code-first rule (`casjo`, `gacol`, `sccol`) was designed and rejected. It produces
zero collisions across all 35 Knight collections and all 47 legacy prefixes — but it does not
scale past roughly dozens of cities per state, and the failure is not random. Collisions
cluster on shared name-stems:

| Collision | Both derive |
|---|---|
| Fairfield OH / Fairborn OH | `ohfai` |
| Springfield OH / Springdale OH | `ohspr` |
| Westerville OH / Westlake OH | `ohwes` |
| San Mateo CA / San Marcos CA | `casma` |

Ohio produces three collisions at ~30 cities. **Widening the locality segment does not help** —
these names collide precisely because they share a prefix, so `ohfair`/`ohfair` collides too.
Any short mnemonic scheme needs a hand-picked tie-break at roughly one city in ten, which
re-creates by hand the exact problem the change is meant to remove.

---

# Part 1 — The ID scheme

## Format

```
<collection-slug>_<NNNN>

san-jose-ca_0001
akron-oh_0042
macon-ga_0107
```

**Underscore, not hyphen.** Verified against the live database on 2026-09-29:

- **0** collection slugs contain an underscore (all kebab-case)
- **0** existing `external_id` values contain an underscore
- longest slug is 20 chars, so the longest new ID is 25 (`bainbridge-island-wa_0001`)
- `trivia.questions.external_id` is `text`, **unbounded** — no column migration

Therefore:

- `strpos(external_id, '_') > 0` is an **exact and permanent** discriminator between schemes
- `split_part(external_id, '_', 1)` is a **total** parse for new IDs
- no heuristics, no ambiguity, no backfill

Uniqueness is already structural, not conventional:

```
collections_slug_key       UNIQUE (slug)
questions_external_id_key  UNIQUE (external_id)
```

The slug is unique by database constraint, so the ID is unique by construction. There is no
prefix to invent, reserve, register, or check — which is the entire point of the change.

**Four digits** gives 9,999 per collection. Current worst case is `por-673`. The column is
unbounded, so widening later is free.

## The sequence ceiling is a second, independent bug

`question-schema.ts:12` validates `/^[a-z]{2,5}-\d{3}$/` — three digits, 999 per prefix.
Two things are already wrong with that, both measured 2026-09-29:

1. **Sequences are allocated in sparse bands** (batch and backfill blocks), so the ceiling is
   nearer than row counts suggest: `por-673`, `bxl-606`, `mis-403`, `arizs-308`, `mas-307`.
2. **3,501 rows already fail this validator.** The nightly news pipeline mints IDs on a
   different path: `wiran` runs to 1761, `clima` to 1648, and `climc` zero-pads to four digits.

Separately, `CurrentTermQuestionGenerator.ts:55` mints `elc-term-<raceId>-<seq>`, which breaks
both the regex and `split_part(…, '-', 1)` semantics today. Multi-segment external IDs are not
new — they are merely currently undeclared.

Widening the regex to accept both shapes therefore also legalizes 3,501 rows that are
currently invalid against their own validator.

## The helper

A single source of truth, `externalIdentity.ts`:

```ts
mintExternalId(slug: string, seq: number): string   // `${slug}_${pad4(seq)}`
collectionKeyOf(externalId: string): string         // split on '_' if present, else '-'
isLegacyExternalId(externalId: string): boolean     // !externalId.includes('_')
```

**Vendored in both repos**, following the `nested-options` precedent exactly. Per that
precedent, **the tests live only beside the ev-accounts copy**, because this repo has no test
runner. A change made here is untested until it is carried over.

## The 12 sites

### This repo (active — content and collection scripts)

| Site | Change |
|---|---|
| `content-generation/question-schema.ts:12` | regex accepts both shapes (below) |
| `generate-locale-questions.ts:386` semantic dedup | scope by `collection_id` |
| `generate-locale-questions.ts:498` officeholder expiry | scope by `collection_id` |
| `generate-locale-questions.ts:628,635` ID offset | **stays ID-scoped**; use helper, `padStart(4)` |
| `generate-replacements.ts:219` | drop redundant prefix filter; anchor digit extraction |
| `international/question-generator.ts:238` | drop redundant prefix filter |
| `activate-collection.ts:178,184` | display-only; use helper |
| `audit-collection-readiness.ts:194,200` | display-only; use helper |
| `scaffold-collection.ts` | `--prefix` becomes optional and ignored with a warning; ID space derives from slug |

The widened validator, stated exactly so it is not re-derived during implementation:

```ts
/^[a-z][a-z0-9-]*_\d{4}$/     // new: slug-derived
/^[a-z]{2,5}-\d{3,4}$/        // legacy: prefix-derived, widened from \d{3}
```

`--prefix` is accepted rather than rejected because `/create-collection` and the handbook both
pass it today; a hard error would break a documented flow for no benefit. It warns and is
ignored.

### ev-accounts (canonical engine)

This repo's `backend/` is **frozen** per ev-cto decision 0013 — `backend/FROZEN.md`, PR #85,
2026-09-05. Production CTC is served by the ev-accounts engine at `https://api.empowered.vote`.
A change committed to `backend/` here reaches nothing and creates silent drift.

| Site | Change |
|---|---|
| `trivia/scripts/content-generation/question-schema.ts:12` | identical regex — vendored twin |
| `trivia/cron/replacementGenerator.ts:153,237` | mint via helper |
| `trivia/cron/replacementGenerator.ts:381` `getNextExternalId` | ID-scoped; `pad4` |
| `trivia/cron/replacementGenerator.ts:395` | drop redundant prefix filter; anchor digit extraction |

**This group is load-bearing for the Knight program.** Knight collections carry 15–30%
expiring officeholder questions by policy, so the replacement cron will mint IDs for them
nightly. If the scheme lands only in this repo, the cron keeps minting the old shape against
collections that no longer have a prefix.

## What is deliberately not changing

**The ID-offset site stays keyed on the ID, not the collection**
(`generate-locale-questions.ts:628`, `replacementGenerator.ts:381`). External IDs must be
unique per ID-space, not per collection. Scoping that query by `collection_id` is exactly what
would mint duplicate IDs if two collections ever shared an ID space. It reads like the same
bug as its two neighbours at lines 386 and 498 and it is not. **Add a comment at both sites
saying so**, or someone will "fix" it.

**The one-off historical scripts.** `activate-collections.ts` (hardcoded `bli`/`lac`/`ins`/`cas`),
`add-smo-officeholder-questions.ts`, `add-ms-officeholder-questions.ts`, `check-tex*`,
`check-texas*`, `fix-active-dups-*`. These hardcode legacy prefixes for collections whose IDs
will never change. Leave them.

**All 8,389 existing rows.** Forward-only. Every question ID cited in past rulings, audit
records, handoff docs and the 11 pinned `nested-options` fixtures stays valid.

## The prefix-LIKE sites are three different bugs, not one

Verified by reading each site on 2026-09-29. They look alike and are not.

**(a) Genuinely unguarded — cross-collection contamination. 2 sites.**
`generate-locale-questions.ts:386` and `:498` select purely by `LIKE '<prefix>-%'` with no
join to `collection_questions`. This is the same defect the `ind` collision produced;
activation was fixed on 2026-09-08 but **generation never was**. Distinct failure modes:

- **semantic dedup (`:386`)** — compares two collections' questions against each other and
  flags the loser as a near-duplicate of a question in a different collection
- **officeholder expiry (`:498`)** — stamps `expiresAt` on another collection's rows

Mostly prospective today, because Indio's 20 `ind` rows are inactive. Fix: scope by
`collection_id`.

**(b) Already collection-scoped; the prefix filter is redundant and breaks. 3 sites.**
`generate-replacements.ts:219`, `international/question-generator.ts:238`, and ev-accounts
`replacementGenerator.ts:395` already `innerJoin collectionQuestions` and filter on
`collectionQuestions.collectionId`. The prefix `LIKE` is an extra narrowing on top.

Under slug IDs that `LIKE` matches **nothing**, so `MAX(...)` is null, `maxId` falls to 0, and
the next mint is `_0001` — which collides with the existing `_0001` and violates
`questions_external_id_key`. That is a crash on the first replacement run against a Knight
collection, not silent contamination. Fix: delete the prefix filter; the join already scopes it.

Two of the three also extract the sequence with `SUBSTRING(external_id FROM '[0-9]+')` —
**unanchored**, so it takes the first digit run in the string. Harmless while no slug contains
a digit, wrong the moment one does. `international/question-generator.ts` already anchors it
with `'[0-9]+$'`. Fix: anchor the other two to match.

**(c) Intentionally ID-space scoped. 1 site.**
`generate-locale-questions.ts:628` has no collection join *by design* — see the next section.

---

# Part 2 — The Knight Cities/States program

## Roster

Knight Foundation funds 26 communities. **Biloxi MS** and **Philadelphia PA** already have
collections; **Mississippi, Pennsylvania, North Carolina, California** and **Indiana** already
have state collections. Net-new: **24 cities + 11 states = 35 collections.**

### Cities (24)

Aberdeen SD · Akron OH · Boulder CO · Bradenton FL · Charlotte NC · Columbia SC ·
Columbus GA · Detroit MI · Duluth MN · Fort Wayne IN · Gary IN · Grand Forks ND ·
Lexington KY · Long Beach CA · Macon GA · Miami FL · Milledgeville GA · Myrtle Beach SC ·
West Palm Beach FL · San Jose CA · St. Paul MN · State College PA · Tallahassee FL ·
Wichita KS

### States (11)

South Dakota · Ohio · Colorado · Florida · South Carolina · Georgia · Michigan ·
Minnesota · North Dakota · Kentucky · Kansas

### Non-city communities: resolved

Four Knight communities are not plain cities. CTC has only `city`, `state` and `federal`
tiers, and county-scale civics (commission districts, sheriff, property appraiser, school
board) do not fit the city generator's topic model and would overlap any city collection
inside them.

**Decision: city-only, anchored on the city Knight actually names.**

| Knight community | CTC collection |
|---|---|
| Miami / Miami-Dade County FL | **Miami** |
| West Palm Beach / Palm Beach County FL | **West Palm Beach** |
| Myrtle Beach / Conway SC | **Myrtle Beach** |
| Biloxi / Gulfport MS | **Biloxi** — already exists; **no Gulfport** |

Gulfport is explicitly excluded: Knight names Biloxi as the anchor, and Biloxi is already
built. Building Gulfport would add a collection Knight did not ask for.

A `county` tier remains possible later. It is a third project, not part of this one.

## Quality bar

Every Knight collection carries the full existing bar. Nothing here is new; it is restated so
the program cannot quietly drop it at collection 19.

- **CRITICAL ACCURACY NOTES block written *before* generating.** The single strongest
  defect-prevention lever measured to date: `milwaukee-wi` had ~60 lines of it and was the
  first collection in twelve sessions with zero wrong facts; `bloomington-in` had none and
  shipped five. The block is a list and protects exactly what is on it — put the countable,
  confusable facts on it (seat counts, elected vs appointed, which body appoints whom).
- **Never ship a stub config.** `war-in-iran` went live with the city template unedited and
  produced two questions about European heat pump sales. A stub does not produce nothing; it
  produces whatever the feed carried.
- **Fetch and grep every source URL before listing it.** Four consecutive audits found
  bot-walled or content-free hosts. Try the open-data subdomain before giving up on a
  municipal host.
- **Expiring questions 15–30%, hard floor 10%** (ruled 2026-09-27). Never buy the ratio with
  duplicate officeholders or repeated question shapes. Check expiry *dates*, not just counts.
- **At least 25–33% easy.** Medium-heavy is a defect, not a neutral choice.
- **Max one question per officeholder per collection**, counted by person.
- **Search the office + next election year** before writing any officeholder question; prefer
  six-year staggered seats.
- **No roll-call questions.** Build officeholder tiers on the `madison-wi` model — distinct
  offices, never more slot-holders.
- **`placeAnswer()` on every insert path.** Generator prompts anchor `correctAnswer` to index
  0; raw-SQL backfills bypass the guard and humans anchor to A too.
- **Re-run the leakage sweep after inserting.** Self-inflicted leaks appeared in six of six
  backfills.
- **State collections are strict state-scale.** Test: "could a future city collection own this
  question?" If yes, cut it. This matters more than usual here — 11 new states, and several
  have a Knight city landing in them.
- **Tagline** ≤64 chars, distinctive, never the generic placeholder. **Banner**: city =
  landmark, state = capitol building (hard rule).

## Sequencing

**Batch 1 is a pilot of two: Akron OH and Ohio.**

Akron is a mid-size city with a real council structure and readable municipal sources; pairing
it with its own state exercises the state-vs-city overlap rule on the first attempt rather
than the thirtieth. The pilot must survive scaffold → generation → activation → readiness
audit → **one nightly replacement-cron run** before batch 2 starts. That last step is the only
way to prove the ev-accounts half of Part 1 works against a real slug-based collection.

Batches 2+ proceed 2–3 per milestone via `/create-collection`.

---

## Verification

Part 1 has no test runner in this repo, so verification is: unit tests for
`externalIdentity.ts` beside the **ev-accounts** copy, plus these live checks after the pilot.

```sql
-- 1. Pilot IDs have the new shape, and nothing else does
SELECT strpos(external_id,'_') > 0 AS new_scheme, count(*)
FROM trivia.questions GROUP BY 1;

-- 2. No question is cross-linked to the wrong collection
SELECT c.slug, split_part(q.external_id,'_',1) AS key, count(*)
FROM trivia.collection_questions cq
JOIN trivia.collections c ON c.id = cq.collection_id
JOIN trivia.questions q ON q.id = cq.question_id
WHERE strpos(q.external_id,'_') > 0
GROUP BY 1,2 HAVING c.slug <> split_part(q.external_id,'_',1);

-- 3. Nothing violates the widened validator
SELECT count(*) FROM trivia.questions
WHERE external_id !~ '^[a-z][a-z0-9-]*_[0-9]{4}$'
  AND external_id !~ '^[a-z]{2,5}-[0-9]{3,4}$'
  AND external_id !~ '^q[0-9]{3}$';
```

Check 3 should return only `elc-term-*` rows; if it returns anything else, the regex is wrong.

## Risks

| Risk | Mitigation |
|---|---|
| Two ID shapes forever | The `_` discriminator is exact and DB-verified. One helper, not scattered conditionals. |
| The two repos drift | Known hazard — the fold vendored runtime code with no dependency link. Land both halves in the same session; tests beside the ev-accounts copy. |
| Part 1 lands here only | The replacement cron is in ev-accounts. Pilot is not complete until one nightly run has minted against `akron-oh`. |
| 35 collections erode the quality bar | Pilot of two first; bar restated above; `audit-collection-readiness.ts` run per collection. |
| A Knight city's sources are bot-walled | Fetch-and-grep before listing. Local press over city sites. |

## Out of scope

- Renaming any existing external ID
- A `county` tier for Miami-Dade or Palm Beach
- Gulfport MS and Conway SC
- Re-auditing Biloxi MS and Philadelphia PA to a Knight-specific standard
- Fixing `CurrentTermQuestionGenerator`'s `elc-term-*` IDs — noted, not addressed
- Importing the rules registry into the quality-rules gate (explicitly forbidden elsewhere)

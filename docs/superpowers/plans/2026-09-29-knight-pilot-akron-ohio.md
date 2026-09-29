# Knight Pilot: Akron OH + Ohio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two collections — Akron OH and Ohio — as the first users of slug-derived external IDs, proving the whole path end-to-end before the other 33 Knight collections are attempted.

**Architecture:** Ordinary collection creation via the `/create-collection` flow, with three differences: external IDs come from the slug, the locale configs carry no `externalIdPrefix`, and the pilot is not complete until one nightly replacement-cron run has minted against `akron-oh` in production. Akron is paired with its own state so the state-vs-city overlap rule is exercised on the first attempt rather than the thirtieth.

**Tech Stack:** TypeScript content scripts, Supabase Postgres (project `kxsdzaojfaibhuzmclfq`), Render cron (`ev-jobs-trivia-pipeline`), WebSearch/WebFetch for sourcing

**Spec:** `docs/superpowers/specs/2026-09-29-slug-external-ids-and-knight-collections-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-29-slug-derived-external-ids.md` — **both** PRs from that plan must be merged first. The ev-accounts half is not optional; without it the replacement cron crashes on the first expiring Akron question.

## Global Constraints

- **`_` is a LIKE wildcard.** `LIKE 'akron-oh_%'` also matches `akron-ohX0001`. Always scope with `split_part(external_id, '_', 1) = 'akron-oh'`, or escape as `LIKE 'akron-oh\_%'`. This is new with the slug scheme and is the single easiest way to corrupt a collection link.
- **Expiring questions:** 15–30% target, **10% hard floor**. Check expiry *dates*, not just the count — the tier is front-loaded bank-wide.
- **Difficulty:** at least 25–33% easy. Medium-heavy is a defect.
- **Max one question per officeholder per collection**, counted by person (inverse pairs count).
- **No roll-call questions.** Build officeholder tiers on the `madison-wi` model: distinct offices, never more slot-holders.
- **`placeAnswer()` on every insert path.** Generator prompts anchor `correctAnswer` to index 0. Raw-SQL inserts bypass the guard, and humans anchor to A too — re-run the readiness script after every insert batch.
- **No addresses or phone numbers in answer options.**
- **Tagline ≤64 chars**, distinctive, never the generic placeholder. **Banner:** city = landmark, state = capitol building (hard rule).
- **State collections are strict state-scale.** Test every Ohio question: "could a future city collection own this?" If yes, cut it. Akron is being built in the same pilot, so this is directly checkable.
- **Attribution boilerplate is banned.** Explanations must not open "According to …". Attribution belongs in `source.url`.
- **`seed.ts` and `activate-collection.ts` hang** after "PostgreSQL connected" when run via `npx tsx`. Insert collections, topics and `collection_topics` directly via Supabase MCP SQL.
- **Officeholders come from `essentials.offices`, not from hand research** (decided 2026-09-29). It is in the same Supabase project. It gives office titles, seat structure and current holders; it does **not** give term ends, elected-vs-appointed flags, or any appointed office. Cross-check against the charter — where they disagree, the charter wins and the disagreement is reported back.
- **Every change goes through a PR.** Do not use the admin bypass; never rename CI job names.

## Review Focus

Five conditions that will not surface on the happy path, each pinned to the task that owns it.

1. **`_` treated as a literal in a LIKE** — silently links the wrong questions to the collection. Pinned to Task 4, verified by an explicit count assertion.
2. **Akron/Ohio overlap** — a question about Akron's city government sitting in the Ohio collection, or an Ohio-scale question in Akron. Pinned to Task 6, which diffs the two.
3. **A source URL that returns 200 but carries no fact** — bot walls, React shells, byte-identical pages at every path. Pinned to Tasks 1 and 5, before generation.
4. **An expiring tier that meets the ratio but expires all at once** — the count passes while the collection dies in one month. Pinned to Task 7.
5. **The replacement cron never actually runs against the pilot** — an empty night proves nothing; `audited: 0` means untested, not working. Pinned to Task 8.
6. **`essentials.offices` is trusted where it is silent** — `is_appointed_position` is NULL rather than false on all 14 Akron offices, and the clerk, law director and treasurer are absent entirely. Reading "not marked appointed" as "elected", or "absent from the table" as "does not exist", produces a confidently wrong question. Pinned to Task 1, which must state elected-vs-appointed from the charter and not from this column.

---

### Task 1: Research Akron and write the accuracy-notes block

**Files:**
- Create: `C:\Project Test\backend\src\scripts\content-generation\locale-configs\akron-oh.ts` (research notes only at this stage)

**Interfaces:**
- Consumes: nothing.
- Produces: a `CRITICAL ACCURACY NOTES` block and a verified `sourceUrls` list consumed by Task 2.

This task exists before scaffolding because the accuracy-notes block is the strongest defect-prevention lever measured: `milwaukee-wi` had ~60 lines of it and was the first collection in twelve sessions with zero wrong facts; `bloomington-in` had none and shipped five. **The block is a list and protects exactly what is on it.**

- [ ] **Step 1: Pull the office inventory from `essentials.offices` FIRST**

**Decided 2026-09-29 (Chris):** source officeholders from `essentials.offices` rather than
hand-researching them. The ev-accounts Knight program has already seated all 11 Knight states
and their anchor cities in the same Supabase project, with sourcing (Aberdeen SD's inventory
was derived from its Home Rule Charter, including a full-charter scan proving no elected
municipal judge exists).

```sql
SELECT o.title, o.seats, o.representing_city, p.full_name, ot.term_start, ot.term_end
FROM essentials.offices o
LEFT JOIN essentials.office_terms ot ON ot.office_id = o.id
LEFT JOIN essentials.politicians p ON p.id = ot.politician_id
WHERE o.representing_state = 'OH'
  AND (o.representing_city = 'Akron' OR o.representing_city IS NULL)
ORDER BY o.representing_city NULLS LAST, o.title;
```

Measured for Akron on 2026-09-29 — **14 offices, 0 vacant**: Mayor (Shammas Malik, term start
2024-01-01), 3 × Council Member At Large, 10 × Council Member Ward 1–10. So **Akron City
Council is 13 seats: 10 ward + 3 at-large.** Ohio itself has 172 state offices seated.

**WHAT THIS TABLE DOES NOT GIVE YOU — you must still research these:**

| Missing | Consequence |
|---|---|
| `term_end` is **NULL on all 14** (9 of 2,288 statewide have one, none future) | Every `expiresAt` still needs the election-calendar check in Step 4. The table cannot date your expiring tier. |
| `is_appointed_position` is **NULL, not false** | Elected-vs-appointed is **not** derivable. Research it — it is one of the confusable facts the accuracy block exists to pin down. |
| Clerk, law director, treasurer, police chief **absent entirely** | The roster is council + mayor only. Any question about an appointed office is unsourced by this table. |

So still research and source, for the accuracy-notes block:
- Whether the mayor is strong or weak, and the term length
- Which offices are elected vs appointed, and which body appoints whom
- Which level of government runs schools, transit, water, courts
- Summit County's relationship to Akron — what the county runs that the city does not

**Cross-check, do not just copy.** This data was seated for a different product. If it
disagrees with the city charter, the charter wins and the disagreement goes in your report —
it may be a defect in the shared data that the other workstream needs to hear about.

- [ ] **Step 2: Fetch and grep every candidate source URL**

For each URL, fetch it and grep the page for a fact you expect it to contain. Do not list a URL you have not read.

Known failure shapes to check for:
- 403 bot walls (Cloudflare interstitials) — `city.milwaukee.gov` and `bendoregon.gov` both do this, with and without `www`
- **200-status bot walls** (Incapsula) that look fine and carry nothing
- React shells that return the same ~700-byte document at every path
- Byte-identical content at every path — detect by comparing two `md5`s, including one for an invented path
- Meta-refresh stubs with empty bodies
- A live, readable page that simply does not contain the fact

Try the **open-data subdomain** before giving up on a municipal host (`data.milwaukee.gov` was readable when `city.milwaukee.gov` was not). Local press is often better than the city site.

**Review Focus 3.** Record for each URL: fetched OK / grep hit / the fact it supports.

- [ ] **Step 3: Verify Wikipedia article titles in one call**

```
https://en.wikipedia.org/w/api.php?action=query&titles=Akron,%20Ohio|Akron%20City%20Council|Summit%20County,%20Ohio&redirects=1&format=json&formatversion=2
```
This verifies dozens of titles at once and reveals redirects so canonical names can be cited.

- [ ] **Step 4: Check the election calendar before writing any officeholder question**

Search the **office plus the next election year** for every officeholder you intend to ask about. `texas-state` came within five weeks of losing most of its executive tier while every incumbent still looked correct. Prefer offices with long or staggered terms.

Record each officeholder's term end — Task 3 needs it for `expiresAt`.

- [ ] **Step 5: Commit the research**

```bash
cd "/c/Project Test" && git checkout -b feat/knight-pilot-akron-ohio
git add backend/src/scripts/content-generation/locale-configs/akron-oh.ts
git commit -m "research(akron-oh): accuracy notes and verified sources"
```

---

### Task 2: Scaffold Akron with a slug-derived ID space

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\content-generation\locale-configs\akron-oh.ts`
- Modify: `C:\Project Test\backend\src\db\seed\collections.ts`

**Interfaces:**
- Consumes: the accuracy block and `sourceUrls` from Task 1.
- Produces: a complete locale config with `collectionSlug: 'akron-oh'` and **no** `externalIdPrefix`.

- [ ] **Step 1: Run the scaffold**

```bash
cd "/c/Project Test/backend" && npx tsx src/scripts/scaffold-collection.ts \
  --name "Akron, OH" --slug akron-oh --theme "#041E42" \
  --description "Rubber City civics: who actually runs Akron?"
```

Note there is no `--prefix`. If you pass one it warns and ignores it.

Tagline must be ≤64 characters. Count it.

- [ ] **Step 2: Confirm the emitted config has no prefix**

```bash
cd "/c/Project Test" && grep -n "externalIdPrefix\|collectionSlug" backend/src/scripts/content-generation/locale-configs/akron-oh.ts
```
Expected: `collectionSlug: 'akron-oh',` present; `externalIdPrefix` **absent**. If the prefix line is there, Task 6 of the ID plan was not applied — stop.

- [ ] **Step 3: Fill in the config completely**

Paste in the accuracy-notes block from Task 1, the verified `sourceUrls`, topic categories, topic distribution, voice guidance, and expiration-date guidance for elected officials.

**Never ship a stub.** `war-in-iran` went live with the city template unedited and produced two questions about European heat pump sales, because the pipeline shares feeds across collections and nothing told it otherwise. A stub does not produce nothing — it produces whatever the feed carried.

- [ ] **Step 4: Insert the collection row via SQL**

`seed.ts` hangs under `npx tsx`, so insert directly. Use the Supabase MCP against `kxsdzaojfaibhuzmclfq`:

```sql
INSERT INTO trivia.collections (name, slug, tier, theme_color, description, is_active)
VALUES ('Akron, OH', 'akron-oh', 'city', '#041E42', '<tagline>', false)
RETURNING id;
```

Keep `is_active = false` until Task 7 passes. Record the returned id.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/content-generation/locale-configs/akron-oh.ts backend/src/db/seed/collections.ts
git commit -m "feat(akron-oh): locale config with slug-derived id space"
```

---

### Task 3: Generate and curate Akron's questions

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\content-generation\locale-configs\akron-oh.ts` (tuning only)

**Interfaces:**
- Consumes: the config from Task 2.
- Produces: draft questions with external IDs of the form `akron-oh_0001`.

- [ ] **Step 1: Generate**

```bash
cd "/c/Project Test/backend" && npx tsx src/scripts/content-generation/generate-locale-questions.ts \
  --locale akron-oh --fetch-sources
```

- [ ] **Step 2: Confirm the ID shape immediately**

```sql
SELECT external_id FROM trivia.questions
WHERE split_part(external_id, '_', 1) = 'akron-oh'
ORDER BY external_id LIMIT 5;
```
Expected: `akron-oh_0001` … `akron-oh_0005`. If you see `akron-0001` or `undefined-0001`, stop — the generator is still reading `externalIdPrefix`.

- [ ] **Step 3: Sweep each source-derived block against itself**

The source list becomes the topic list: give the generator ten articles and a 100-question target and it mines each for ~10 questions. Those single-article blocks share proper nouns, so **each question prints the others' answers**. Every substantive leak in `milwaukee-wi` was inside one such block. Read each block as a block.

- [ ] **Step 4: Run the two cheap greps**

- **A question containing its own answer** — "Who founded **Juneau**town?" → Juneau. Three instances across two sessions.
- **A bracket answer next to an open-ended explanation** — explanation says "more than 500 million board feet", option says "500–999 million". The upper bound is invented.

- [ ] **Step 5: Check for the missing-true-answer defect**

Suspect any deadline, eligibility or threshold question where two similar rules sit side by side — `ins-049` asked about an absentee *request* deadline and offered only *casting* deadlines, so the true answer was absent from all four options. No structural rule can see this; only a source check can.

- [ ] **Step 6: Commit tuning changes**

```bash
git add backend/src/scripts/content-generation/locale-configs/akron-oh.ts
git commit -m "fix(akron-oh): curate generated drafts"
```

---

### Task 4: Link and activate Akron

**Files:** none — SQL only.

**Interfaces:**
- Consumes: draft questions from Task 3, collection id from Task 2.
- Produces: rows in `trivia.collection_questions`.

- [ ] **Step 1: Link questions using the escaped form**

**Review Focus 1.** `_` is a LIKE wildcard. Use `split_part`, not `LIKE`:

```sql
INSERT INTO trivia.collection_questions (collection_id, question_id, created_at)
SELECT <collection_id>, q.id, NOW()
FROM trivia.questions q
WHERE split_part(q.external_id, '_', 1) = 'akron-oh'
  AND q.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM trivia.collection_questions cq WHERE cq.question_id = q.id
  );
```

- [ ] **Step 2: Assert exactly one collection came back**

```sql
SELECT c.slug, count(*)
FROM trivia.collection_questions cq
JOIN trivia.collections c ON c.id = cq.collection_id
JOIN trivia.questions q ON q.id = cq.question_id
WHERE split_part(q.external_id, '_', 1) = 'akron-oh'
GROUP BY 1;
```
Expected: exactly one row, `akron-oh`. Two rows means the wildcard bit.

- [ ] **Step 3: Prove the wildcard hazard is real, once**

Run this so the team has seen the difference with their own eyes:

```sql
SELECT 'akron-ohX0001' LIKE 'akron-oh_%' AS unescaped_matches_wrongly,
       'akron-ohX0001' LIKE 'akron-oh\_%' AS escaped_matches_correctly;
```
Expected: `true`, `false`.

- [ ] **Step 4: Verify answer placement**

```bash
cd "/c/Project Test/backend" && npm run verify:answer-placement
```
Expected: no questions anchored disproportionately to index 0.

- [ ] **Step 5: Activate**

```bash
npx tsx src/scripts/activate-collection.ts --slug akron-oh --dry-run
```
Review the output, then run without `--dry-run`. If it hangs after "PostgreSQL connected", flip `is_active` via SQL instead.

- [ ] **Step 6: Commit nothing; record the counts**

Note the active question count and the namespace advisory output for the PR body.

---

### Task 5: Build Ohio, strictly state-scale

**Files:**
- Create: `C:\Project Test\backend\src\scripts\content-generation\locale-configs\ohio.ts`

**Interfaces:**
- Consumes: Akron's finished question list from Task 4 — Ohio must not overlap it.
- Produces: `ohio` collection, `tier: 'state'`.

- [ ] **Step 1: Repeat Tasks 1–4 for Ohio**

Same accuracy-notes discipline, same fetch-and-grep of every source (**Review Focus 3**), same election-calendar check, same greps. Slug `ohio`, IDs `ohio_0001`.

State collection naming: short form only — "Ohio", never "Ohio State".

- [ ] **Step 2: Fix the tier in both places**

`scaffold-collection.ts` always writes `tier: 'city'`. Correct it in `seed/collections.ts` **and** via SQL:

```sql
UPDATE trivia.collections SET tier = 'state' WHERE slug = 'ohio';
```

- [ ] **Step 3: Apply the strict state-scale test to every question**

For each: "could a future city collection own this?" If yes, cut it. Cities appear only as seats of state institutions — "Ohio's capital is Columbus" is fine; anything about Columbus's local government is not. Natural features only when tied to statewide policy or law.

- [ ] **Step 4: Watch for the Speaker Pro Tem gap**

Generation consistently misses Speaker Pro Tem for state collections. List the officeholder by name in the config or add the question manually.

- [ ] **Step 5: Banner is the state capitol**

Hard rule. `frontend/public/images/collections/ohio.jpg` must be the Ohio Statehouse.

- [ ] **Step 6: Commit**

```bash
git add backend/src/scripts/content-generation/locale-configs/ohio.ts backend/src/db/seed/collections.ts frontend/public/images/collections/ohio.jpg
git commit -m "feat(ohio): state collection, strict state-scale"
```

---

### Task 6: Diff Akron against Ohio

**Files:** none — analysis only.

**Interfaces:**
- Consumes: both finished collections.
- Produces: a list of cut or rewritten questions.

**Review Focus 2.** This is the reason the pilot pairs a city with its own state, and it cannot be done later — once 33 more collections exist, nobody will come back for it.

- [ ] **Step 1: Pull both question sets side by side**

```sql
SELECT split_part(q.external_id,'_',1) AS coll, q.external_id, q.text
FROM trivia.questions q
WHERE split_part(q.external_id,'_',1) IN ('akron-oh','ohio')
  AND q.status = 'active'
ORDER BY 1, 2;
```

- [ ] **Step 2: Cut every Ohio question a city collection could own**

Akron is now a concrete example rather than a hypothetical. Anything in `ohio` that Akron could have asked is a defect in `ohio`, not in Akron.

- [ ] **Step 3: Re-run the leakage sweep on both**

Self-inflicted leaks appeared in **six of six** backfills, including one batch of four. Writing about a collection means writing in its vocabulary. Always sweep *after* inserting, not only before.

- [ ] **Step 4: Commit the cuts**

```bash
git commit -am "fix(ohio): cut questions a city collection could own"
```

---

### Task 7: Readiness audit both collections

**Files:** none.

- [ ] **Step 1: Run the auditor on each**

```bash
cd "/c/Project Test/backend" && npx tsx src/scripts/audit-collection-readiness.ts --slug akron-oh
npx tsx src/scripts/audit-collection-readiness.ts --slug ohio
```

- [ ] **Step 2: Check the expiring ratio — and the dates**

```sql
SELECT split_part(external_id,'_',1) AS coll,
       count(*) FILTER (WHERE expires_at IS NOT NULL) AS expiring,
       count(*) AS total,
       round(100.0 * count(*) FILTER (WHERE expires_at IS NOT NULL) / count(*), 1) AS pct,
       min(expires_at) AS first_expiry,
       count(*) FILTER (WHERE expires_at < now() + interval '6 months') AS expiring_within_6mo
FROM trivia.questions
WHERE split_part(external_id,'_',1) IN ('akron-oh','ohio') AND status = 'active'
GROUP BY 1;
```

**Review Focus 4.** 15–30% is the target and 10% the hard floor — but a collection that passes the ratio while `expiring_within_6mo` equals `expiring` dies all at once. The tier is front-loaded bank-wide; several collections lose their whole tier before March 2027. Spread the dates.

- [ ] **Step 3: Check the difficulty mix**

```sql
SELECT split_part(external_id,'_',1) AS coll, difficulty, count(*),
       round(100.0*count(*)/sum(count(*)) OVER (PARTITION BY split_part(external_id,'_',1)),1) AS pct
FROM trivia.questions
WHERE split_part(external_id,'_',1) IN ('akron-oh','ohio') AND status='active'
GROUP BY 1,2 ORDER BY 1,2;
```
Easy must be ≥25%. Also check the hard tier is not thin — Q5 is the wager question and draws from it.

- [ ] **Step 4: Check the officeholder limit**

Max one question per officeholder per collection, counted by person. Inverse pairs ("who is the mayor?" / "what office does X hold?") count as the same person.

- [ ] **Step 5: Fix anything the audit flags, then re-run**

Note: the auditor's officeholder roster is a **hardcoded locale config, not live data**. It has previously demanded a question about a termed-out legislator and named the wrong Indio mayor for a question that had already been fixed. **Verify each warning against a source before acting on it**, and if the roster is wrong, fix the roster too.

---

### Task 8: Prove the replacement cron works against a slug collection

**Files:** none.

**Interfaces:**
- Consumes: an activated `akron-oh` with expiring questions.
- Produces: evidence that the ev-accounts half of the ID plan works in production.

**This is the step that makes it a pilot rather than just two collections.** Everything before this runs in tooling; only this exercises the production engine.

- [ ] **Step 1: Confirm the ev-accounts PR is deployed**

The replacement cron runs from ev-accounts, not this repo. Verify the merged commit is live before expecting anything.

- [ ] **Step 2: Wait for a run, then read what it actually did**

**Review Focus 5.** An empty night proves nothing — this pipeline legitimately yields 0–4 questions on many nights, and `audited: 0` means the path was never exercised, not that it works.

```sql
SELECT id, created_at, notes
FROM trivia.generation_jobs
ORDER BY created_at DESC LIMIT 5;
```

- [ ] **Step 3: Assert a replacement actually minted a slug ID**

```sql
SELECT external_id, created_at FROM trivia.questions
WHERE split_part(external_id,'_',1) = 'akron-oh'
ORDER BY created_at DESC LIMIT 5;
```
Expected: at least one row created after the cron run, with an `akron-oh_NNNN` ID that continues the sequence rather than restarting at `_0001`.

If it restarted at `_0001` and threw a unique-constraint error, Task 4 of the ID plan did not land in ev-accounts.

- [ ] **Step 4: If no expiring question came due, force the path**

Do not wait indefinitely. Set one Akron officeholder question's `expires_at` to a past timestamp and let the next run pick it up. Record that you did this.

---

### Task 9: Open the PR

- [ ] **Step 1: Push and open**

```bash
cd "/c/Project Test" && git push -u origin feat/knight-pilot-akron-ohio
gh pr create --title "feat(collections): Knight pilot — Akron OH and Ohio" --body "First two collections on slug-derived external IDs. Implements Part 2, batch 1 of docs/superpowers/specs/2026-09-29-slug-external-ids-and-knight-collections-design.md"
```

Include in the body: final question counts, expiring % and first-expiry date for each, difficulty mix, and the evidence from Task 8 Step 3.

- [ ] **Step 2: Note what the merge does**

This branch touches `frontend/public/images/collections/*.jpg`, so **merging is a production deploy** of the frontend static site. There is no staging environment. Docs-only commits would not deploy; this one will.

- [ ] **Step 3: Record the pilot outcome for batch 2**

Write down what the pilot changed about the process before starting the other 33. If the accuracy-notes block caught things, say which. If a source host was bot-walled, add it to the known-bad list in the handbook.

---

## Notes for the executor

- `/create-collection <City, ST>` automates much of Tasks 2–4 and should be used where it fits. This plan is the manual fallback and the checklist the skill does not enforce.
- **Never run `npm ci` in `C:\Project Test\frontend`** — it wipes `node_modules` for every session sharing the checkout. Use a worktree if you need a clean install.
- The Render DB role `ctc_app` is **broken** (`EAUTHQUERY`, role not found). Read-only access is via ev-accounts' `DATABASE_URL`, role `ev_api`, or the Supabase MCP.
- `pg_trgm` lives in the `extensions` schema and is not on the search path — write `extensions.similarity(...)`.
- Do not run `repair-broken-links.ts --apply` under any circumstances.

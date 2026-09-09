# Events-Focused Collections — Brainstorm Prep

> **Status:** prep only. No decisions taken. Input for a `superpowers:brainstorming` session.
> **Written:** 2026-09-08, from an audit of all 95 active `war-in-iran` questions.

## What Chris wants to explore

Three **Events-Focused** collections: **War in Iran**, **World News**, **US News**.

- ~12 questions/day may be the right cadence for World News and US News (that is what the existing pipeline already produces per collection).
- **Anti-partisan is a spectrum, not a binary.** Perfection is not the goal.
- The goal is to **track sources earnestly** — to document, every time it happens, when a source produced a biased question or answer.
- That record is the point: accumulated, it becomes the evidence needed to **rate sources for trustworthiness**. Much more diligence is required before any such rating is credible, and it starts with documenting occurrences.
- Separately: the current **United States / Federal** collection reads more like **American History**, or in places **American Judicial History**, than civics. Possible rename/split.

---

## Audit: the 95 active `war-in-iran` questions

Read individually on 2026-09-08. The collection is really **two unrelated bodies of content**.

### Finding 1 — the collection is ~93% not about Iran

| Block | Count | What it is |
|---|---|---|
| `wiran-0016`–`0040` | 25 | Genuine, well-made Iran background: 1953 coup, hostage crisis, Iran–Iraq war, IRGC/Quds, JCPOA, Stuxnet, Green Movement, Velayat-e Faqih, Strait of Hormuz, enrichment thresholds. Reads curated. |
| `wiran-1556`–`1626` | 70 | Daily RSS output. **Only 5 touch Iran at all** (`1565`, `1566`, `1587`, `1588`, `1626`). |

The other 65 are world news wearing an Iran label: Nepal floods (10), UN "Correct the Map" (6), AfD Saxony-Anhalt (5), Amazon cargo crash at Miami (5), Egyptian drug case (4), Russia–North Korea bridge (3), Canada tariffs (3), White Australia party ban (3), Baja murders trial (3), King Harald V's death (3), World Central Kitchen strike (3), Falklands referendum (2), Indonesia volcano (2), China bank injection (2), Australian flag policy (2), plus singles (Heathrow delays, a Sydney loan fraud, a US mistrial).

**Reading:** Chris's instinct is right, and understated. This is already a World News collection. The 25 curated Iran questions are a different artifact from the 70 generated ones — the split is clean enough that "War in Iran" could keep the curated block and hand the rest to World News.

### Finding 2 — duplication, and live factual contradictions

The pool contains multiple simultaneously-active questions about the same fact, sometimes with **different correct answers**:

| Event | Questions | Problem |
|---|---|---|
| Nepal flood death toll | `1562` (>1,300), `1571` (1,050), `1620` (1,287) | **Three different answers, all active.** |
| Saxony-Anhalt election date | `1591` (Sept 6), `1608` (Sept 7) | Contradictory dates for one election. |
| Miami cargo crash date | `1593` (Sept 6), `1605` (Sept 7) | Same. |
| Trishuli 3A rescue | `1582`/`1602` (9 days), `1583`/`1603` (170 m) | Exact duplicates. |
| UN map vote | `1557`/`1584` (164 nations) | Exact duplicates. |
| Egyptian drug case | `1575`/`1599`, `1576`/`1600` | Exact duplicates. |
| AfD majority threshold | `1592`/`1610` (42 seats) | Exact duplicates. |

At least 9 duplicate pairs and 3 outright contradictions in a 95-question pool. A rolling daily pipeline re-covers the same story as it develops and nothing dedupes across days. Note `runWithinCollectionSemanticDedup()` runs at generation — it is evidently not catching these, which is worth checking before designing anything new.

**RESOLVED in the pool, NOT in the pipeline (2026-09-08).** 13 questions archived, leaving 82 active with no surviving contradiction:

- Duplicates — kept the later-generated copy (more shelf life): archived `1557`, `1575`, `1576`, `1582`, `1583`, `1592`.
- Nepal toll — `1562` and `1571` were generated in the same minute and disagreed (>1,300 vs 1,050); both archived. `1620` survives alone because it dates itself ("as of September 7" → 1,287).
- Saxony-Anhalt — `1591` dated the election Sept 6, `1608` dated it Sept 7; both asked the same 43.8% fact, so one was redundant and one carried a false date, and which is which could not be determined without external verification. Both archived; `1609` (39 seats) and `1610` (42 needed) carry the story dateless.
- Miami crash — `1593`/`1594` said Sept 6, `1605` answered "September 7", same event. All three archived; `1606` (five killed) and `1607` (San Juan) keep the verifiable facts without asserting a date.

The **cause is untouched**: the pipeline will reintroduce this class the next time it covers a developing story. Every one of these questions also expires within 1–4 days of generation, so the pool self-cleans — but a player inside that window can be shown two different correct answers to the same question, which is why waiting it out was not good enough.

### Finding 3 — framing, which is three separate problems

Chris framed this as partisanship; the audit suggests it splits into three, and only one is partisan.

**3a. Inconsistent characterisation of a contested event.** The same conflict is called different things in questions generated days apart:

- `wiran-1587`: "following the US-Israeli **military action against** Iran"
- `wiran-1588`: "during the US-Israeli **war on** Iran"

"War on X" carries an aggressor implication that "military action" does not. Neither is flagged; both are live. This is the clearest instance of source framing arriving unexamined.

**3b. Editorial judgment inside the question stem.**

- `wiran-0025`: Hezbollah "became Iran's most powerful proxy and **a key deterrent against Israeli military pressure**" — strategic analysis presented as setup, not fact.
- `wiran-0016`: "**orchestrated** the 1953 coup that overthrew Iran's **democratically elected** Prime Minister" — defensible on declassified record, but both terms are characterisations.
- `wiran-0017`: "**Why** did the US and UK back the removal of Mosaddegh?" — a motive question. Well-supported here, but motive is the question *type* most exposed to framing.

Contrast the one that gets it right: `wiran-0031` hedges Stuxnet as "**believed to be** a joint US-Israel operation", and `wiran-1567` attributes a contested casualty count to its source ("**According to the United Nations**…"). Those two are the template.

**3c. Named private individuals as trivia.** Not partisan — a taste and dignity problem, and arguably the more urgent one:

- `1575`/`1576`/`1599`/`1600`: a named TV presenter **sentenced to death**, as a quiz question.
- `1617`/`1618`/`1619`: named murder victims and their trial.
- `1581`: a named woman's mistrial (infanticide case), quizzed on jury deliberation hours.
- `1604`: a named individual's loan-fraud guilty plea.

None of these are public figures acting in a public role. Contrast `1590` (a named politician announcing party policy) or `1625` (Panetta's term of office), which are fine.

---

## Threads worth pulling in the brainstorm

Not proposals — open questions the audit raised.

1. **Split or relabel?** The 25 curated Iran questions and the 70 generated ones are different products. Does "War in Iran" become the curated block only, with the pipeline repointed at World News?
2. **What is a US News collection, given Finding 1?** The pipeline already produces US stories inside the Iran feed. Is US News a feed-scope decision or a classification step?
3. **The source ledger — the actual ask.** Chris wants occurrences documented so trust ratings can eventually be earned. That implies recording, per question: which source/feed item produced it, and every time a human judged it biased. There is a `question_flags` table already — worth checking whether it can carry a reason taxonomy, and `generation_jobs.notes` (jsonb) already exists per run.
4. **Question-type constraints may be more tractable than source neutrality.** Every 3b/3c problem above is a *question shape* problem: motive questions, characterisation stems, private individuals. Those are checkable by a rules engine. Source bias is not, directly. A shape allowlist (dates, counts, offices, documented votes, treaty text, attributed figures) plus a banned list (motives, characterisations, party-affiliation-as-answer, private individuals' crimes) would catch most of what the audit found — and would have caught `elc-1-011` too.
5. **Attribution as a pattern.** `wiran-1567` and `wiran-0031` show that a contested fact becomes safe when the question names its source or hedges. Could that be *required* for a defined class of topics?
6. **Dedup across days is unsolved.** Findings 2's contradictions are a correctness bug in the live pool right now, independent of any framing policy.
7. **Renaming United States.** Chris reads it as American History / American Judicial History. Does it split, or get renamed?

## Project-wide finding: distractor bracketing (found 2026-09-08)

Not events-specific, but it belongs with the rules discussion because it is exactly the kind of thing a rules engine can check and a human reviewer cannot see.

For questions whose four options are all numeric, the correct value's **rank among the four offered** is:

| Rank of correct value | Share | Expected |
|---|---|---|
| Smallest | 4.5% | 25% |
| Second | 31.8% | 25% |
| **Third** | **54.2%** | 25% |
| Largest | 9.5% | 25% |

**1,154 questions — 31% of the active bank.** The generator writes the true value then pads it with two smaller and one larger distractor, near-universally. "Sort the numbers, take the third" scores **54% project-wide**; **96% in Pittsburgh, PA** (27 of 28). Massachusetts and California have *zero* questions where the answer is the smallest or largest of the four.

Pittsburgh, ascending, correct value third every time: `7,8,9,11` · `2,3,4,6 years` · `1758,1776,1794,1816` · `1732,1745,1754,1763` · `1958,1965,1974,1981` · `75,100,150,200 feet` · `12,24,36,50 acres`.

**The existing 6d rotation masks this.** Rotation changes where options are *displayed*, so the answer-position histogram comes out uniform (Bloomington: 15/14/14/14 after a rotation on 2026-09-08) while the value-rank exploit survives untouched. The documented anti-bias procedure fixes the symptom it measures and is blind to the bigger one.

Rotation cannot fix it — the bias is in the *values chosen*, so it needs distractors that sometimes sit entirely above or entirely below the true value (for "9 members", offer `9/11/13/15`, not `5/7/9/11`).

Two checkable rules fall out, both cheap:
- **Per question:** flag when the correct value is never at an extreme across a collection's numeric questions.
- **Per collection:** assert the rank distribution is roughly uniform, the same way 6d asserts it for display position.

Methodology caveat: the detector counts any question whose four options all contain a digit, which catches label-style options like "District 1 / District 2 / District 4 / District 8" where the numbers are names rather than magnitudes. Rare enough not to move the numbers, but a real rule would need to exclude them.

### Remediation progress and the recipe

**Done:** Pittsburgh, PA (27 questions) and Asheville, NC (27) — both now 7/7/7/6 on value rank and even on display position. **Remaining: ~1,100.** Next worst by bias, then by size: Washington DC (58), Phoenix AZ (40).

**Pass 1 done, pass 2 outstanding:** Massachusetts and California (2026-09-08). Value rank went 0/6/8/0 → **4/3/3/4** (MA, 57.1% at an extreme) and 0/8/7/0 → **4/4/3/4** (CA, 53.3%), 20 questions rewritten, correct value preserved on every one and verified by diff before the write. Both were at 0.0% before. Their **display-position** pass is still owed — see the position finding below, which is why it was not run blind.

Two things worth keeping from that pass:

- **Sort the options ascending and rank becomes position.** For a magnitude question displayed in ascending order, value rank *is* display position, so a uniform rank distribution delivers a uniform position distribution for free — one edit fixes both, and the options still read cleanly. This is strictly better than rank-then-rotate, which un-sorts the series.
- **Singular/plural silently drops a question out of the audit.** `unitOf("1 year")` is `year` and `unitOf("2 years")` is `years`, so a `1 year` option makes `units.size === 2` and `magnitudeRank` returns null. That is why `mas-006/056/057/089` and `cas-003` are excluded — they are ordinary term-length questions, not edge cases. Repairing a bracket by reaching for `1 year` as the low distractor removes the question from the metric instead of fixing it. Nine of MA's 23 numeric questions are excluded this way; the audit's denominator is smaller than it looks.

The recipe, per collection, is two passes — **both are needed**, and neither alone leaves a clean collection:

1. **Value rank:** redesign distractors so the correct value sometimes sits entirely above or below them. Target 7/7/7/6 across ranks. Never change the correct value; re-derive nothing from it. Roughly a quarter must stay at rank 3, so do not "fix" them all.
2. **Display position:** the existing 6d rotation, scoped by `collection_id`, over the *non-magnitude* questions only — rotating a sorted numeric series un-sorts it.

**Two traps found in Asheville that an automated version must handle:**

- **Prose dates are not magnitude series.** `ashnc-022` offers "December 5, 1791" / "July 4, 1776" / "March 15, 1800"; digit-extraction yields `51791`, `41776`, `151800` — nonsense. Such questions must be excluded from the value-rank pass and **explicitly named into** the display rotation, or they fall through both filters and stay pinned at one position permanently.
- **Mixed units cannot be value-compared.** `ashnc-073` offered "$500 million" against "$3 billion" — extraction sorts `500` above `6`. Normalise the units as a content repair. This also means the **54.2% project-wide figure is understated**, since mixed-unit questions were mis-ranked in the original survey.

Also constrained by hand rather than formula: bounded series like "4 out of 5" cannot reach rank 1, because too few values exist above the answer.

## Project-wide finding: answer-position collapse (found 2026-09-08)

Found while pulling the display-position baseline for the Massachusetts/California bracketing fix. **This is worse than the bracketing bias and it is live in production.**

Options are stored in `trivia.questions.options` and served in stored order. `correct_answer` is stripped by `stripAnswers()` before the payload goes out, but nothing shuffles the options themselves — verified in both `backend/src/routes/game.ts` and the canonical `ev-accounts/backend/src/trivia/routes/game.ts`. Only *questions* are shuffled (`questionService.ts`, `gameModes.ts`), never the options within one. **So the stored index is the position the player sees.**

Across 42 collections, the correct answer's stored position:

| Collection | A | B | C | D | Best blind guess |
|---|---|---|---|---|---|
| Missouri | 91 | 0 | 0 | 0 | **100.0%** |
| St. Louis, MO | 92 | 0 | 0 | 0 | **100.0%** |
| New York | 87 | 0 | 0 | 0 | **100.0%** |
| Louisiana | 93 | 0 | 1 | 0 | **98.9%** |
| Springfield, MO | 93 | 1 | 0 | 0 | **98.9%** |
| Plano, TX | 63 | 21 | 0 | 1 | 74.1% |
| North Carolina | 67 | 9 | 15 | 0 | 73.6% |
| United States (Federal) | 3 | 83 | 23 | 4 | 73.5% |

**In five collections — 457 active questions — the first option is always the right one.** "Always pick A" wins every game in Missouri, St. Louis and New York. Federal, the collection every player sees, sits at 73.5% on "always pick B".

Only six collections are near uniform (Pittsburgh, Bend, Milwaukee, Asheville, Madison, Wisconsin — 25.5–30.0%); those are the ones a 6d rotation has actually been run against. **Twenty-two collections are above 45%.** The unweighted picture: a player who learns one letter per collection beats most of the bank without reading a single question.

Why this hid: the 6d rotation is a per-collection manual step, and the collections it was run on are exactly the collections that look fine. Nothing asserts it. `audit-collection-readiness.ts` gained a *value-rank* check on 2026-09-08 but still has no *position* check, so a 91-of-91-at-A collection passes the audit silently.

### Fixed: the five 100% collections (2026-09-08)

Missouri, St. Louis MO, New York, Louisiana and Springfield MO — **458 active questions, 456 of them pinned at A** — are now uniform:

| Collection | before | after | best guess |
|---|---|---|---|
| Missouri | 91/0/0/0 | 23/23/23/22 | 100.0% → **25.3%** |
| St. Louis, MO | 92/0/0/0 | 23/23/23/23 | 100.0% → **25.0%** |
| New York | 87/0/0/0 | 22/22/22/21 | 100.0% → **25.3%** |
| Louisiana | 93/0/1/0 | 24/24/23/23 | 98.9% → **25.5%** |
| Springfield, MO | 93/1/0/0 | 24/24/23/23 | 98.9% → **25.5%** |

Done in two mechanical passes, no content rewritten:

1. **139 magnitude questions sorted ascending.** Position then equals value rank by construction, so the two metrics coincide and neither can mask the other. Verified first that no question had tied extracted values (sort would be ambiguous) and that all 139 preserved their correct value.
2. **319 prose questions permuted**, swapping the correct option with a target slot. Targets were not uniform-per-subset but chosen to *absorb* the magnitude subset's residual rank skew, so each collection's total lands uniform. Feasible only because prose outnumbers magnitude everywhere here — check `prose_target >= 0` per position before relying on it.

Both writes were gated in SQL on `old_options->>old_ca = new_options->>new_ca`, so a mis-derived index could not have written a wrong answer. Checked beforehand that no collection had "all/none of the above" options needing a fixed slot — none did.

**The value-rank bias in these five is untouched and still owed:** 13/51/66/9 across the 139, 15.8% at an extreme. Because the options are now sorted, fixing that rank distribution will move display position with it — the two passes have merged into one for this subset.

**Twelve mixed-unit questions found here** (`lou-057`, `lou-060`, `misso-068`, `misso-073`, `nysts-043`, `nysts-055`, `nysts-061`, `nysts-070`, `nysts-077`, `nysts-081`, `sprmo-079`, `stlmo-027`). Options mix "million" with "billion", or hedges like "About" with "Over", so `unit_of` differs and they fall out of the magnitude filter into the prose bucket. They were permuted rather than sorted and still read out of order. Same class as `ashnc-073`; they need unit normalisation as a content repair, which will also fold them back into the value-rank metric.

Notes for whoever fixes the rest:

- Rotation is safe on prose options but **un-sorts a numeric series**, so magnitude questions want the sort-ascending-and-rebracket treatment from the section above instead. The two passes have to be applied to disjoint sets.
- The five 100%-at-A collections cannot be repaired by rotation alone in the way the others can: with every answer at A, any rotation is a pure permutation of a degenerate distribution, which is fine — but it means their *value* ranks were never examined either. Expect them to need both passes.
- **The audit assertion now exists** (`audit-collection-readiness.ts`, "Answer Position"). It reports the A/B/C/D histogram and warns when the best single guess exceeds 40% against a 25% baseline. When written it fired on 30 of 42 collections; **it now fires on none**.
### COMPLETE: answer-position collapse cleared bank-wide (2026-09-08)

**All 42 collections are now under the 40% warning line. Zero warn.** 3,815 active questions; best single guess ranges **25.0%–37.8%, average 26.5%**, against a 25% ideal. Started at five collections on 100% and 30 of 42 above the line.

The last batch did 28 collections and 2,533 questions in two set-based passes, and the **answer fingerprint over all 2,533 came back identical** (`e27e5f37…`) — every correct answer provably unchanged, zero duplicate option lists, zero unresolvable indices.

**Water-filling replaced the naive prose target.** The earlier `target_total − magnitude_at_position` formula goes negative when a collection is magnitude-heavy *and* badly bracketed, which three collections were: Climate Agreements (45 of 90 magnitude, 31 at rank 3), Queens NY (60 of 130, 45 at rank 3), War in Iran (38 of 82, 25 at rank 3). For these a uniform total is **mathematically unreachable** without rebracketing values — position C alone is already above target. So prose is now allocated by filling the lowest position first (highest water level whose fill cost fits the prose budget, remainder to the lowest positions). That minimises the maximum instead of chasing an impossible uniform, and it brought all three under the line honestly:

| Collection | Floor | Why |
|---|---|---|
| Climate Agreements | 37.8% | 31 of 45 magnitude questions at rank 3 |
| Queens, NY | 34.6% | 45 of 60 at rank 3 |
| War in Iran | 31.7% | 25 of 38 at rank 3 |

Their residual is **entirely** the value-rank bias, showing through the position metric because the options are sorted. That is the honest reading, not a leftover position problem. Bloomington IN sits at 35.0% for the same reason and was never in the warn set.

**Value rank is now the binding constraint.** Across 972 magnitude questions bank-wide: **65 / 313 / 525 / 69**, only **13.8% at an extreme** against a 50% ideal. This is the original bracketing finding, now the whole of what remains.

One thing that got much cheaper: because every magnitude question in the bank is sorted ascending, **display position now equals value rank everywhere**. Fixing a collection's bracket automatically fixes its position, and the position audit doubles as a bracketing tripwire. The two-pass recipe has collapsed into one pass for all future work.

### Value rank fixed: the four collections above 30% (2026-09-08)

| Collection | Position | Value rank at extreme | Notes |
|---|---|---|---|
| Queens, NY | 34.6% → **25.4%** | 0% → **50.0%** | 30 of 60 rebracketed |
| Bloomington, IN | 35.0% → **25.0%** | 4.8% → **47.6%** | 10 of 21 rebracketed |
| War in Iran | 31.7% → **26.8%** | 0% → 7.9% | only 5 of 38 durable; see below |
| Climate Agreements | 37.8% → **25.6%** | 2.2% → **51.1%** | 23 of 45 rebracketed (done on request) |

**Check expiry before rebracketing an events collection.** This nearly became 143 questions of throwaway work. `expires_at` says:

- **War in Iran — 33 of 38 magnitude questions expire between 2026-09-09 and 09-12.** Only five never expire, and they are exactly the curated `wiran-00xx` block (`0018`, `0019`, `0020`, `0028`, `0040`). Those five were fixed; the 33 RSS-derived ones were left, because they self-clean within four days and the write-time guard means their replacements arrive unbiased. Note the collection's *reported* bracketing will look worse after they expire (3 of 5 at an extreme = 60%), but with only 5 magnitude questions it falls under the audit's 8-question floor and stops reporting at all.
- **Climate Agreements — done on request, after being flagged as not worth it.** The collection is `is_active: false` and all 45 of its magnitude questions expire by 2026-09-18, so this was recorded as zero-player-impact work and skipped; Chris asked for it anyway and it was completed (23 of 45 rebracketed, then the prose pass re-run: 23/23/22/22 on position, 51.1% at a value-rank extreme). Worth reading the numbers as a **method check rather than a player fix** — they confirm the recipe reaches ~25%/~50% even on a badly bracketed, magnitude-heavy collection where water-filling alone had bottomed out at 37.8%.
- Careful reading mattered here: four questions had their correct answer somewhere other than a quick scan suggested (`clima-1509`/`1527` are 16 not 15, `1525`/`1535` are 750 not 500). All 23 were diffed old-correct against new-correct before the write, and all 23 matched.

**Label-style numbers are a third of Queens.** Twelve of its 60 magnitude questions ask "which Queens district?" with options like District 20/21/22/23 — the number identifies a district, it does not measure anything. Unlike the US Civics amendment questions, these *were* safe to rebracket: Queens council districts run roughly 19–32, so the answer can sit anywhere in that band and every neighbouring district remains an equally plausible distractor. The distinction that matters is whether the label's neighbours are interchangeable as distractors (Queens districts: yes) or thematically chosen (Reconstruction amendments: no).

**Two more bounded series found**, both in Bloomington: `bli-005` (council term, 4 years) and `bli-073` (4 sports complexes) cannot reach rank 4, because the only values below the answer include 1 — and "1 year" / "1 sports complex" breaks unit consistency, which would drop the question out of the metric rather than fix it. Both left at rank 3. Same family as `q002` and "4 out of 5".

**Bank-wide after this pass: 42 collections, 3,815 questions, nothing above 30% on position** (worst is Wisconsin at 30.0%, from an early manual rotation). Value rank across 972 magnitude questions is **97/319/460/96 — 19.9% at an extreme**, up from 13.8%. That remains the open work, and it is now the only one of the two metrics still far from target.

- Work anything new in descending order of the audit's reported number.

### The guard: why it kept happening, and what now stops it (2026-09-08)

**Root cause found.** Every generator prompt shows the model a JSON output example containing `"correctAnswer": 0`, and the model copies it verbatim. That is the whole mechanism — seven prompt sites carried it, including the two shared system prompts feeding the nightly 02:00 ET replacement cron.

A prompt instruction cannot be the fix: it is advisory, the model may quietly stop complying, and nothing detects it when it does. The `4a487a3` prompt change for bracketing has the same weakness. So the guard is a **deterministic transform on the write path**, where compliance is not optional:

`backend/src/services/questionQuality/answerPlacement.ts` — `placeAnswer(options, correctAnswer, seed)`:

- **Numeric series → sorted ascending**, not permuted. Deliberate: position then *equals* value rank, so the two metrics coincide and neither can hide behind the other. Permuting numeric options instead is exactly what let the bracketing bias survive the earlier manual rotations.
- **Everything else → permuted** into a slot derived from a hash of the seed. Stateless, so it is safe from any number of concurrent generators; uniform in expectation rather than exactly, so a single 12-question night can be lumpy while a collection converges.
- **Seeded on `externalId`** so regenerating a question does not move its answer between draft reviews.
- **Returns input untouched, never throws**, for malformed payloads, wrong option counts, out-of-range indices, and any "all/none of the above" option whose position is semantic. A bad generator payload degrades to today's behaviour rather than corrupting a question.

**Wired into every ongoing write path** — the two crons and both content paths:

| Path | What it feeds |
|---|---|
| `cron/replacementGenerator.ts` | nightly 02:00 ET replacements |
| `services/generation/ElectionQuestionGenerator.ts` | election-detection cron |
| `services/generation/CurrentTermQuestionGenerator.ts` | post-election officeholder questions |
| `scripts/content-generation/utils/seed-questions.ts` | `generate-locale-questions` and the create-collection flow |
| `db/seed/seed.ts` | rebuilds — the seed JSON banks predate the guard and carry the old answer-first shape, so re-seeding without it would reintroduce the collapse |

`generateQuestions.ts` writes JSON rather than the DB, so it is covered downstream by `seed.ts`. The remaining direct inserters (`add-ms-`/`add-smo-`/`generate-biloxi-`/`generate-wdc-officeholder-questions.ts`, `migrate-to-shared-supabase.ts`) are spent one-offs.

**`magnitudeRank` now has exactly one definition**, in `answerPlacement.ts`, re-exported from the audit script. Two drifting definitions of "is this a number series" is precisely how this class of bug survives.

**Proof it works:** `npm run verify:answer-placement` (backend) — 37 checks, no DB, no network, no API spend. Covers answer-text and option-set preservation across all five option shapes, the refusals, determinism, and a 400-question batch that spreads 100/98/100/102 (25.5% best guess, from a 100% baseline). It runs as a **step inside the existing `Backend build (tsc)` job** — not a new job, because the master ruleset requires checks by name and a new job would not be required, so a red result would not block anything.

### Fixed: Federal / "How Washington Works" (2026-09-08)

Taken out of turn as the collection every player sees. **113 questions, 3/83/23/4 → 29/28/28/28**, best guess 73.5% → **25.7%**. Value rank fixed in the same pass: 1/8/9/0 → **5/4/4/5**, 55.6% at an extreme (was 5.6%).

Verified by fingerprint rather than by trusting the write guards: `md5(string_agg(external_id || '|' || correct option))` taken before the first write and again after the last came back **identical** (`3341cf55…`), so all 113 correct answers provably survived three separate rewrites.

**The label-style trap is real and it bites here.** Six of the 18 "magnitude" questions are amendment *numbers* — `q005`, `q020`, `q033`, `q042`, `q054`, `q073`. The detector reads "13th Amendment" as the value 13 and ranks it, but the number is an identifier, not a quantity. Rebracketing them would mean replacing thematically chosen distractors (the Reconstruction amendments 13/14/15 in `q073`) with unrelated ones, making the questions *easier* while improving the metric. **They were deliberately left alone**, and the 12 genuine magnitudes were skewed to compensate (5/2/0/5) so the reported total still lands uniform. This is the caveat in the methodology note above, no longer hypothetical: on a collection this amendment-heavy it is a third of the numeric pool.

Also note `q002` ("how many branches") is a **bounded series that cannot reach rank 4** — only two values exist below 3, so no set of distractors puts the answer last. Same class as the "4 out of 5" case from Asheville.

### Renamed: Federal → "US Civics" (2026-09-08)

Product decision. The collection is federal *civics*, not history: Constitution + Bill of Rights + Amendments 45, judiciary 31, Congress + executive 29, elections 8, and only **3** questions tagged U.S. History — so "US History" would have misdescribed 97% of it, and "US Judicial" describes 27%.

Settled on **US Civics** after "How Washington Works" was judged too much Washington — the bank already has "Washington, DC" and "Washington", and a third Washington-ish title was one too many.

Three places must agree and all three were changed: `trivia.collections.name`, `backend/src/db/seed/collections.ts`, and the `COLLECTION_NAMES` map in `generateQuestions.ts` (whose comment says names must match the DB `name` column exactly).

Deliberately **not** changed: `slug` stays `federal` — `trivia.bobit_progress` keys player progress by collection slug, and URLs depend on it. `locale_name` stays "United States", which is what `getRegion()` in `CollectionCard.tsx` renders as the eyebrow above the title; the card now reads UNITED STATES / US Civics. Note that card's `tier === 'federal'` fallback is dead code for this collection — `locale_name` is set, so the fallback never fires.

If a "U.S. Judicial" collection is ever split out, note `MIN_QUESTION_THRESHOLD = 50` in `game.ts` — the 31 Supreme Court questions would need ~20 more before the collection is playable.

### COMPLETE: value-rank backlog cleared (2026-09-08)

**Both metrics are now healthy bank-wide.** 42 collections, 3,815 active questions:

| Metric | Start of day | Now |
|---|---|---|
| Answer position — worst collection | **100.0%** (five collections) | **26.8%**, none above 40% |
| Value rank — bank-wide at an extreme | **13.8%** | **49.0%** (242/247/249/234) |

Only **War in Iran** is still below the rank line at 7.9%, and only because 33 of its 38 magnitude questions expire by 09-12; its five durable ones are fixed and the pool drops under the audit's 8-question floor once they go.

Roughly 320 questions rebracketed by hand across ~25 collections, in batches of 4–5 collections. Every batch was diffed old-correct against new-correct before writing and gated on it in SQL; every batch matched. Prose was re-balanced after each, since rebracketing moves magnitude positions.

### ⚠️ The measurement trap that caught me mid-way

**`correct_answer` is only the value rank when the options are sorted.** Reading rank off `correct_answer` is correct for every collection that has been through the sort pass — and silently wrong for any that has not. Five collections had never been sorted, so my reported figures for them were wrong, in both directions:

| Collection | Reported from position | Actual value rank |
|---|---|---|
| Milwaukee, WI | 42.9% "healthy" | **0.0%** |
| Madison, WI | 37.5% | **6.3%** |
| Bend, OR | 60.0% "healthy" | **6.7%** |
| Wisconsin | 46.7% "healthy" | **13.3%** |
| Cambridge, MA | 50.0% | 63.9% (better) |

The three flagged "healthy" were among the worst in the bank. They are exactly the collections the **old 6d rotation** had been run against — rotation un-sorted their numeric options, so position and rank came apart, and reading one as the other hid the bracketing completely. This is the masking failure the original finding warned about, reproduced by accident in the measurement rather than the data.

**Always compute rank from the values**, as the audit's `magnitudeRank` does:
```sql
(SELECT count(*) FROM jsonb_array_elements_text(options) e
 WHERE val_of(e) < val_of(options->>correct_answer))
```
Comparing that against `correct_answer` also gives a cheap "is this collection sorted?" probe. All four were sorted and then rebracketed properly.

### A fourth limitation class: fractions and clock times

Six Cambridge questions are counted as magnitude but their rank is meaningless, because `val_of` takes only the **first** number in the string:

- `cam-018`, `cam-041`, `cam-058`, `cam-083` — "More than 1/20th" / "1/15th" / "1/10th" / "1/5th" all extract to **1**. Genuinely ordered, unreadable to the extractor.
- `cam-114` — "4:30 p.m." extracts to **4**; "5:00 p.m." and "5:30 p.m." both to 5.
- `cam-072` — "6:00 a.m. to 8:00 p.m." extracts to **6**; a range, not a point.

They pass the unit check (identical non-numeric residue) so nothing excludes them. Joins the label-style, mixed-unit, prose-date and bounded-series traps. Cambridge's true figure is 63.9% *including* this noise, so it is fine either way — but a collection built mostly of fraction or time options would report nonsense.

### Mixed units normalised — and the population is 142, not 12 (2026-09-08)

The twelve mixed-unit questions recorded earlier turned out to be **six** by the time they were reached: `nysts-055`, `nysts-061`, `nysts-070`, `lou-060`, `misso-073` and `nysts-043` had become unit-consistent as a side effect of the rebracketing passes. The remaining six are fixed:

| Question | Was | Now |
|---|---|---|
| `nysts-081` | "Over 10 million" / "About 500,000" / … | `Over 3/5/8/12 million` |
| `nysts-077` | "About 100,000" / "About 1 million" / … | `About 100,000/200,000/300,000/400,000` |
| `stlmo-027` | "Over 50 million" / "About 5 million" / "Nearly 19.7 million" | `Nearly 19.7/25/35/50 million` |
| `lou-057` | "Over 850 million pounds" vs "Over 1 billion pounds" | `Over 300/500/700/850 million pounds` |
| `misso-068` | "About 65 million" vs "Nearly 1.5 billion years old" | `Nearly 1/1.5/2/3 billion years old` |
| `sprmo-079` | "More than 70" / "About 10" / … | `More than 70/100/150/200` |

**The trick that avoided rewording the correct answer:** match the *hedge word* across all four options ("Nearly X million" throughout) rather than normalising to a neutral one. `unit_of` then collapses to a single value and the correct option's text survives verbatim, so the standard preservation guard still applies. All six verified text-preserved, single-unit and sorted before the write.

These six were in the prose bucket, so normalising moved them **into** the magnitude pool (972 → 978) and shifted five collections' rank histograms. Targets were chosen to absorb that: Louisiana 53.3%, Springfield 52.0%, New York 51.2%, Missouri 50.0%, St. Louis 48.1% — all still healthy, position 25.5–26.4%.

**⚠️ The real population is 142.** The "twelve" were only the ones earlier passes happened to surface. A bank-wide sweep finds **142 active questions whose options are all numeric but carry more than one unit**, concentrated in Arizona (11), Phoenix (8), US Civics (8), Philadelphia (8), Tucson (6). Breakdown:

- **44 are hedge-or-scale-only** — same underlying quantity, options just disagree on "About" vs "Over" or on million vs billion. 29 of those differ *only* by hedge word, which is close to mechanical.
- **98 are genuinely different things** being offered as alternatives (different nouns entirely), which is a question-quality problem rather than a formatting one and needs reading case by case.

**This is why the bank-wide 49.2% understates the bracketing picture** — the same caveat the original survey raised about its own 54.2%. All 142 sit outside the value-rank metric, and until they are normalised nobody knows how they rank. They are *not* a position exploit: they are in the prose bucket and get position-balanced like any other prose question.

### The "29 hedge-only" questions are not a mechanical batch (2026-09-08)

Attempted; **4 done, 25 deliberately left**. Two things came out of looking at them that the earlier count got wrong.

**The count was wrong: 22 hedge-only, not 29.** The classifier tested whether a scale word was *present* (`~* 'thousand|million|billion|trillion'`), not *which one*, so million/billion/trillion mixes passed as "same scale". Seven are actually scale mixes: `alxla-047`, `benor-046`, `benor-075`, `clima-1502`, `nysts-068`, `tucaz-043`, `tucaz-091`.

**⚠️ Normalising a directional hedge creates multiple correct answers.** This is the reason the batch is not mechanical, and it is easy to miss. `mis-174`'s correct answer is "Over 50%". Normalising every option to "Over" yields:

> Over 25% · Over 35% · **Over 50%** · Over 75%

If the real value is above 50%, then "Over 25%" and "Over 35%" are *also true*. Directional hedges (`over`, `more than`, `at least`, `less than`, `up to`) are half-open ranges, not point estimates, so they cannot be swapped in the way approximation hedges (`about`, `around`, `nearly`, `almost`, `approximately`, `roughly`) can. **18 of the 22 carry a directional hedge on the correct answer.**

There is no safe mechanical escape for those 18:

- Keeping the directional hedge and pushing every distractor above the true value leaves exactly one true option — but it forces the correct answer to be the **smallest**, i.e. rank 1 every time. That trades one bias for another.
- Converting them to point estimates ("About 55%") fixes the unit and the rank freely, but **changes what the correct option claims** — "over 50%" and "about 50%" are different assertions. That breaks the text-preservation guard every other edit today has held to, and is a content decision rather than a formatting one.

So these 18 need the underlying fact checked against the explanation, one at a time, and a deliberate choice about whether the hedge belongs in the question at all. That is question-quality work, not bracketing work.

**Done (4)** — correct answer carries an approximation hedge or none, so normalising is safe and preserves its text:

| Question | Now |
|---|---|
| `ashnc-034` | `About 100/350/1,200/3,500` |
| `ica-102` | `Nearly 50/60/75/95 percent` |
| `lac-022` | `Almost 10/12/15/20%` |
| `nysts-078` | `50/75/93/100%` |

Asheville 50.0%, Indio 60.0%, Los Angeles 45.0%, New York 50.0% on value rank afterwards; all still healthy.

### The 18 directional-hedge ones: closed brackets (2026-09-08)

**Chris's idea, and it is the right one:** replace the hedge with a **closed range** — `25-49%` / `50-74%` / `75-89%` / `90-100%`. Ranges *partition* the space, so exactly one option can contain the true value. Mutual exclusivity is precisely the property directional hedges lack, so the multiple-true-answers hazard disappears rather than being worked around, and the rank becomes free (pick which bracket holds the answer).

Two mechanics worth keeping:

- **All four must be closed ranges.** Mixing an open `Under 35%` with closed ranges gives `unit_of` "under %" vs "%" and drops the question out of the metric again — the same failure this was meant to fix.
- **Put the range's unit once, at the end**: `100-249 miles`, not `100 miles-249 miles`. `unit_of` then collapses to `miles` and `val_of` reads the lower bound, so sorting by lower bound orders the brackets correctly.

All 18 done. Every one verified single-unit, strictly ascending, and — the check that replaces text-preservation here — **the value its own explanation states falls inside the chosen bracket**:

| Question | Was | Now | Rank |
|---|---|---|---|
| `arizs-053` | At least 1150 AD | `1150 AD` (hedge simply dropped — a point date, not a range) | 1 |
| `arizs-061` | More than 60% | `60-74%` | 2 |
| `arizs-070` | More than $500 billion | `$500-749 billion` | 3 |
| `arizs-082` | More than 160,000 | `160,000-199,999` | 4 |
| `benor-073` | More than 30 | `30-49` | 4 |
| `lac-002` | Over 10 million people | `10-14 million people` | 4 |
| `madwi-087` | More than 120 | `120-179` | 1 |
| `milwi-069` | More than 34,000 | `25,000-49,999` | 2 |
| `mis-174` | Over 50% | `50-74%` | 2 |
| `phxaz-047` | Over 40,000 | `40,000-59,999` | 1 |
| `phxaz-056` | Over 250,000 acres | `250,000-499,999 acres` | 2 |
| `phxaz-084` | Over 135 miles | `100-199 miles` | 3 |
| `pla-019` | Over 72,000 | `50,000-99,999` | 1 |
| `queny-067` | More than 200 | `200-299` | 1 |
| `smo-175` | At least 95% | `95-100%` | 4 |
| `tex-069` | Over 500 | `500-999` | 3 |
| `tucaz-038` | More than 4,400 | `4,000-5,999` | 1 |
| `tucaz-040` | More than 56,000 | `50,000-74,999` | 2 |

`smo-175` is another bounded case: a `95-100%` bracket cannot sit at rank 1, because no percentage bracket exists above it. It went to rank 4.

**⚠️ Five brackets rest on inference, not on the explanation.** Where an explanation states only a threshold ("more than 60%"), the true value is known to be *above* it but not by how much, so the bracket is right only if the value also falls below the bracket's top. Tops were chosen generously, but these five should be checked against source if anyone is passing through: `arizs-061` (assumes ~65%, not >74%), `arizs-082` (ASU ~183k, not >199,999), `mis-174` (assumes ~65%), `tex-069` (assumes ~700), `benor-073` (assumes ~30-49). The other thirteen either state a figure or have a threshold comfortably inside a wide bracket.

**Left: the 7 scale mixes** (`alxla-047`, `benor-046`, `benor-075`, `clima-1502`, `nysts-068`, `tucaz-043`, `tucaz-091`).

Neither the scale mixes nor the remaining 98 different-things questions are a position exploit — all sit in the prose bucket and are position-balanced already.

### COMPLETE: the 7 scale mixes (2026-09-08)

All seven fixed. Five were single-option swaps that left the correct answer's text
untouched; two carried a directional hedge on the correct answer and took the
closed-bracket treatment from the 18-question pass.

| Question | Was | Now | Rank |
|---|---|---|---|
| `alxla-047` | `$1 billion` among `$…million` | `$50/200/350/502 million` | 4 |
| `benor-046` | `More than 500 million` vs `More than 5 billion board feet` | `5-49 / 50-249 / 250-499 / 500-999 million board feet` | 4 |
| `benor-075` | `Over $1 billion` vs `About $300 million` | `$0.5-0.9 / $1.0-1.9 / $2.0-2.9 / $3.0-4.9 billion` | 2 |
| `clima-1502` | `850 million barrels` among billions | `1.2/1.7/2.3/4.5 billion barrels` | 2 |
| `nysts-068` | `$500 billion` among trillions | `$1 / $1.5 / $2.3 / $4 trillion` | 3 |
| `tucaz-043` | `About $1 billion` among millions | `About $50/200/500/800 million` | 3 |
| `tucaz-091` | `$800 million` among billions | `$1.4/1.9/2.4/4.1 billion` | 3 |

Ranks were picked to hold each collection at ~50%: Alexandria 50.0%, Bend 50.0%,
Climate 50.0%, New York 48.8%, Tucson 48.6%.

**⚠️ Two rest on inference**, same caveat as the earlier five: `benor-046` (explanation
says only "more than 500 million board feet"; bracket top of 999 assumed) and
`benor-075` ("more than $1 billion"; assumed under $2bn).

### ⚠️ The "98 genuinely different things" was mis-triaged (2026-09-08)

**It is not 98, and it is mostly not a content problem.** Re-sweeping the 113 that
remained after the hedge and scale passes, and bucketing by *why* `unitOf` splits them:

| Bucket | n | What it actually is |
|---|---|---|
| A. Inflection only | 18 | `1 year` vs `2 years`. A real magnitude series; a plural `s` is the only thing splitting the unit. |
| B. Ordinal suffix only | 29 | `1st` / `2nd` / `3rd` / `4th`. Residue is `st`/`nd`/`rd`/`th`, so four distinct "units". |
| D. Genuinely heterogeneous | 46 | Prose options carrying an incidental number — addresses, station names, film titles with years, scripture citations, council structures, opening hours. |

Of the 46, **43 are legitimate and correctly outside the metric.** `por-016` offers four
Portland addresses; `phipa-063` four films with release years; `penns-038` four scripture
verses. These are not magnitude questions and never will be. They should stop being
counted as a bracketing backlog — that is what inflated the original 142.

Twenty of the remaining 113 *were* mechanically fixable and are done (scale mixes of the
`500,000` vs `1 million` shape, plus three open-ended options converted to closed
brackets: `tex-065` `80,000+`, `ashnc-067` `60+`, `ica-140` `Under 4 inches`). Two more
genuine defects fixed: `bxl-150` (correct option was the only one within 1,000× of the
truth *and* the only long one — two tells) and `clima-1511`. One left deliberately:
`wiran-1567` expires 2026-09-09.

### ⚠️ The extractor's blind spots hide a 47-question pocket at 10.6%

Buckets A and B together are 47 questions whose value rank is currently unmeasured. Rank
them anyway and the distribution is **1 / 22 / 20 / 4 — 10.6% at an extreme**, against
49.3% for the measured bank. The term-length questions are the core of it: 16 of 18
inflection cases are rank 2, none at an extreme, because `1 year / 2 years / 4 years /
6 years` with a 2-year answer is the shape the generator reaches for every time.

So the original finding's warning applies to its own instrument: **`unitOf` is not just
understating coverage, it is understating it non-randomly.** The questions it drops are
disproportionately the biased ones.

**The fix is one line in `unitOf` — but it is not obviously the right call, because it
changes `placeAnswer` too.** Folding these in reclassifies them from "prose" to
"magnitude series", so the write path starts *sorting* them instead of permuting them.
For a bounded series that is a downgrade, not an upgrade:

- Term length has a fixed real-world domain — 1, 2, 4, 6 years. A 2-year answer is
  structurally rank 2; there is no plausible distractor below 1 year, so the rank cannot
  be varied without inventing nonsense.
- Sorting therefore pins the answer to **position B in 16 of 18 questions** — creating an
  "always pick B" position exploit where permuting currently has none.

That is the module's own trade-off running backwards: sorting is the right default
*because* it stops position and rank hiding behind each other, but for an irreducibly
bounded series the rank is already known and permuting is the better player-facing
choice. Options, in preference order:

1. **Fix `unitOf`, and teach `placeAnswer` to permute a bounded series** — one whose
   values are drawn from a small fixed domain — rather than sort it. Measures everything,
   exploits nothing. Most work.
2. **Fix `unitOf` for inflection only, leave ordinals alone.** Folds in 18, keeps
   label-style noise (amendments, districts, wings) out of the rank metric. Accepts the
   position clustering.
3. **Leave `unitOf` alone, document the pocket.** Cheapest, and the 47 stay unmeasured.

Needs a decision before anyone "finishes" the bracketing work — today's 49.3% is honest
about what it measures and silent about these 47.

### RESOLVED: fix `unitOf`, and permute bounded series (2026-09-08)

Chris picked option 1. Both halves are implemented in
`services/questionQuality/answerPlacement.ts` and covered by
`scripts/verify-answer-placement.ts` (47/47 checks, `tsc` clean).

**`unitOf` now normalises two things away** before comparing units: an ordinal suffix
glued to its number (`1st District` vs `22nd District`) and plural inflection
(`1 year` vs `2 years`, `constituency` vs `constituencies`). Singularisation is
deliberately crude — it only has to be *consistent* across one question's four options,
never linguistically right.

**`isBoundedSeries()` decides sort vs permute.** A magnitude series of whole numbers
anchored at the domain floor (min ≤ 2) and staying small (max ≤ 12) is permuted rather
than sorted. The reasoning that matters: sorting makes position equal rank, so for a
series whose rank is fixed by the world it would export an unfixable rank bias into a
position bias that did not exist — pinning 16 of 18 term-length questions to position B.
Nothing is lost by permuting, because `magnitudeRank` reads values and never positions,
so the audit measures them exactly the same either way.

The threshold is narrow on purpose. Populations, dollars, acres and distances keep
sorting; so do label-style ordinals (amendments, districts), which read naturally in
numeric order and whose rank was always meaningless.

**The honest bank-wide number is now 47.8%, not 49.3%.** Coverage went 1,029 → 1,077
magnitude questions and the figure fell, which is the expected direction: the 48 newly
visible questions are the biased ones. Best single guess 26.1% against a 25% baseline.
Norwich surfaced below the warning line at 12.5% and was rebracketed to 50.0%
(`nor-107`, `nor-062`, `nor-031` — the three of its eight that are neither bounded nor
label-style). Only **War in Iran** remains under the line, at 7.9%, for the documented
expiry reason.

**A limit worth knowing:** the numeric rule is a proxy for a domain fact it cannot see.
`nor-116` (voting age: 16 / 17 / 18 / 21) is bounded in reality — the real domain is
{16, 18, 21} — but max 21 puts it outside the rule, so it sorts. Rebracketing it would
mean inventing voting ages that do not exist. Left alone deliberately.

### ⚠️ The write-time guard is not running in production (found 2026-09-08)

`placeAnswer()` exists **only in this repo's frozen `backend/`**. The canonical tree —
`ev-accounts/backend/src/trivia/`, per `backend/FROZEN.md` and ev-cto decision 0013 — has
no `answerPlacement.ts` and no `questionQuality/` directory at all. Its
`cron/replacementGenerator.ts` writes `parsedQuestion.correctAnswer` straight through,
where the frozen copy wraps the same insert in `placeAnswer()`.

This is exactly the silent drift `FROZEN.md` warns about, on the one file the anti-bias
work depends on.

What is verified:

- Generation is live — 51 questions created 2026-09-08, and every day through the window.
- Before 2026-09-03 the daily position split was **0 at A and 0 at D** for weeks on end
  (e.g. 08-28: 0/18/22/0) — the collapse in raw form.
- From ~09-04 both extremes appear (09-08: 12/11/19/9). Something improved; this data
  cannot say whether it was the guard, the prompt change in `4a487a3`, or the content
  passes, and it should not be assumed to be the guard.

What is *not* established: which code path actually produced those rows. The canonical
crons are gated behind `TRIVIA_CRONS_ENABLED` (off by default, comment says the standalone
service still owns them) — but that service was suspended 2026-09-04. The active content
scripts in this repo *do* call `placeAnswer`, so they are one candidate. Worth resolving
before the guard is treated as covering production.

Today's `unitOf` and bounded-series change lands in the same frozen file, so it reaches
the audit and the content scripts — both explicitly still active here — and **not** the
production cron.

### RESOLVED: guard ported to ev-accounts (2026-09-08)

`answerPlacement.ts` now exists at
`ev-accounts/backend/src/trivia/services/questionQuality/answerPlacement.ts`, wired into
**all four** of that tree's question-insert paths:

| Path | Was |
|---|---|
| `cron/replacementGenerator.ts` | unguarded |
| `services/generation/ElectionQuestionGenerator.ts` | unguarded |
| `services/generation/CurrentTermQuestionGenerator.ts` | unguarded |
| `scripts/international/question-generator.ts` | **unguarded in *both* copies** — never had the guard anywhere |

That last one is worth noting: the frozen repo guards three insert paths, not four, so
the international generator had been writing unguarded questions since it was built. It
is guarded now in the production copy.

Verification: 31 vitest tests (`answerPlacement.test.ts`, ported from this repo's
`verify-answer-placement.ts`), `tsc --noEmit` clean, `eslint` clean on all touched files.
The CTC-side script still passes 47/47.

**The two copies are now byte-identical, deliberately, including their header comment**,
so `diff` between them is the drift check — that comment says so in both. The duplication
cannot be removed: production needs the engine copy, and this repo's content scripts
(explicitly not frozen) need this one.

## Related work already banked

- `elc-1-011` (Bloomington, archived 2026-09-08) made a named individual's "Republican party activism" the **correct answer** — the same failure class as 3b/3c, from the election-detection cron rather than the news pipeline. Whatever guard gets designed should cover both generators.
- The pipeline runs **daily at 02:00 ET**, 134 consecutive successful runs since 2026-04-09, ~12 questions/collection/night, auto-throttled off when a collection has >20 drafts.

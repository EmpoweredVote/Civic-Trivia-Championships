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
- **The audit assertion now exists** (`audit-collection-readiness.ts`, "Answer Position"). It reports the A/B/C/D histogram and warns when the best single guess exceeds 40% against a 25% baseline. Against the live bank it fires on **30 of 42 collections** and stays quiet on 12 — the six previously rotated, the five fixed above, and Bloomington (35.0%). Worst remaining is **Plano, TX at 74.1%**, then North Carolina 73.6% and Federal 73.5%.
- Work the rest in descending order of that number. Federal deserves priority out of turn: it is the collection every player sees, and it is at 73.5% on "always pick B".

## Related work already banked

- `elc-1-011` (Bloomington, archived 2026-09-08) made a named individual's "Republican party activism" the **correct answer** — the same failure class as 3b/3c, from the election-detection cron rather than the news pipeline. Whatever guard gets designed should cover both generators.
- The pipeline runs **daily at 02:00 ET**, 134 consecutive successful runs since 2026-04-09, ~12 questions/collection/night, auto-throttled off when a collection has >20 drafts.

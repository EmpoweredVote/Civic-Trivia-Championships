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

## Related work already banked

- `elc-1-011` (Bloomington, archived 2026-09-08) made a named individual's "Republican party activism" the **correct answer** — the same failure class as 3b/3c, from the election-detection cron rather than the news pipeline. Whatever guard gets designed should cover both generators.
- The pipeline runs **daily at 02:00 ET**, 134 consecutive successful runs since 2026-04-09, ~12 questions/collection/night, auto-throttled off when a collection has >20 drafts.

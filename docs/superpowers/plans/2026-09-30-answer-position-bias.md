# Answer Position Bias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the correct answer landing on C far more often than chance, by deciding each question's answer position *before* generating its options rather than rearranging them afterwards.

**Architecture:** `placeAnswer()` currently sorts numeric options ascending *after* generation, so the answer lands at its magnitude rank instead of a chosen position. Models write distractors that bracket the true value — typically two below, one above — so the answer ranks third. The fix inverts the order of operations: the script computes a target position from the external ID, the prompt tells the model to build the option set so sorting puts the answer there, and `placeAnswer` verifies rather than imposes.

**Tech Stack:** TypeScript, Vitest (ev-accounts only), Anthropic SDK, Postgres (Supabase)

**Spec:** none. This plan is self-contained; the measurements below are the evidence.

---

## The measurement this exists to fix

Taken from the Akron OH and Ohio collections generated 2026-09-30 (117 draft questions):

| Options | n | A | B | C | D |
|---|---|---|---|---|---|
| **Numeric** | 38 | 1 | 11 | **23 (61%)** | 3 |
| Non-numeric | 79 | 25 | 11 | 25 | 18 |
| **All** | 117 | 26 | 22 | **48 (41%)** | 21 |

C at 61% within numeric questions is exploitable by a player who notices.

**Ruled out by measurement, do not re-investigate:**

- **`hashToPosition` is not the cause.** It is FNV-1a mod 4 and it is uniform. Over 160 real seeds per collection it gives 25.6 / 24.4 / 25.0 / 25.0. Verified 2026-09-30.
- **`placeAnswer` is not being skipped.** `generate-locale-questions.ts` does not call it directly, but it seeds through `utils/seed-questions.ts:155`, which calls `placeAnswer(question.options, question.correctAnswer, question.externalId)`. The guard is in place and seeded on `externalId`, so re-running does not move an answer.

**The actual cause** is `answerPlacement.ts:237-249` — the `sorted` branch. When all four options parse as magnitudes it sorts them ascending and recomputes `correctAnswer` as wherever the true value ranked. That silently overrides any position the model intended. Sorting is not wrong in itself; sorting *after* generation and overriding intent is.

---

## Global Constraints

- **Two repos.** `answerPlacement.ts` is vendored: canonical at `C:\ev-accounts\backend\src\trivia\services\questionQuality\answerPlacement.ts`, copy at `C:\Project Test\backend\src\services\questionQuality\answerPlacement.ts`. Keep them byte-identical and prove it with `cmp`.
- **Tests live ONLY in ev-accounts.** `C:\Project Test` has no test runner. `answerPlacement.test.ts` already exists beside the ev-accounts copy — extend it.
- **Test command:** `cd /c/ev-accounts/backend && npm run test:unit`. Never plain `npm test` — it is red on master with ~25 unrelated flaky failures. Expect a pre-existing baseline of 6 failed suites / 4 failed tests (missing `libsodium-wrappers`, one Windows path assertion) and 2 pre-existing `tsc` errors. Confirm your run matches that baseline rather than assuming.
- **`C:\Project Test\backend\` runtime is FROZEN** (ev-cto decision 0013). `backend/src/scripts/**` and `backend/src/services/questionQuality/**` are content tooling and are still live here — but `backend/src/cron/**` is the frozen twin; do not change behaviour there.
- **Determinism is a requirement, not a nicety.** Position must be a pure function of `externalId`, so regenerating a question does not move its answer between reviews. That is why the current code seeds on `externalId` and the replacement must too.
- **Never modify an existing `external_id`.**
- **Every change goes through a PR.** `master` has a ruleset requiring two build checks and an admin bypass that works — do not use the bypass, and never rename a CI job.

## Review Focus

Conditions no happy-path test will exercise. Each is pinned to a task.

1. **A target that cannot be met plausibly.** Asking for position A on "In what year did X happen?" forces three *later* years; for a recent event those are in the future and the question becomes unanswerable. Pinned to Task 2 (prompt) and Task 3 (fallback).
2. **Duplicate option values.** Two options with the same magnitude make "strictly below / strictly above" ambiguous and can retarget the answer. The existing code already tracks by original index for this reason — do not regress it. Pinned to Task 1.
3. **A bounded series** (`isBoundedSeries`) already falls through to the permute branch deliberately. Do not route it into the new sorted path. Pinned to Task 1.
4. **Options with a fixed-position member** ("All of the above", "None of the above") must stay `unchanged`. `hasFixedPositionOption` guards this. Pinned to Task 1.
5. **Non-numeric questions are also uneven** (A 25 / B 11 / C 25 / D 18 above). They go through the uniform hash, so the residue is either small-sample noise or `unchanged` questions passing through. Pinned to Task 5, which measures placement outcomes rather than guessing.

---

### Task 1: Make `placeAnswer` a verifier for numeric options

**Files:**
- Modify: `C:\ev-accounts\backend\src\trivia\services\questionQuality\answerPlacement.ts:220-258`
- Modify: `C:\Project Test\backend\src\services\questionQuality\answerPlacement.ts` (vendored copy — keep byte-identical)
- Test: `C:\ev-accounts\backend\src\trivia\services\questionQuality\answerPlacement.test.ts`

**Interfaces:**
- Produces: `PlacedAnswer.placement` gains `'sorted-off-target'`. Existing values `'sorted' | 'permuted' | 'unchanged'` keep their meaning.
- `placeAnswer(options, correctAnswer, seed)` keeps its signature.

- [ ] **Step 1: Write the failing tests**

```ts
describe('placeAnswer — numeric options honour the hashed target', () => {
  // The bug: options are sorted ascending AFTER generation, so the answer lands
  // at its magnitude rank. Models bracket the true value (2 below, 1 above), so
  // it ranked third and C hit 61% across 38 real numeric questions.
  it('reports sorted-off-target when the sorted rank misses the target', () => {
    // Build a case where the true value ranks third but the target is not 2.
    const seed = findSeedWithTarget(0);              // helper below
    const r = placeAnswer(['10', '20', '30', '40'], 2, seed);
    expect(r.placement).toBe('sorted-off-target');
  });

  it('reports sorted when the sorted rank already equals the target', () => {
    const seed = findSeedWithTarget(2);
    const r = placeAnswer(['10', '20', '30', '40'], 2, seed);
    expect(r.placement).toBe('sorted');
    expect(r.correctAnswer).toBe(2);
    expect(r.options).toEqual(['10', '20', '30', '40']);
  });

  it('keeps options ascending in both cases — readability is not sacrificed', () => {
    for (const target of [0, 1, 2, 3]) {
      const r = placeAnswer(['10', '20', '30', '40'], 2, findSeedWithTarget(target));
      expect(r.options).toEqual(['10', '20', '30', '40']);
    }
  });

  it('still tracks the answer by original index when option text repeats', () => {
    const r = placeAnswer(['5', '5', '30', '40'], 1, 'any-seed');
    expect(r.options[r.correctAnswer]).toBe('5');
  });

  it('leaves a fixed-position option set unchanged', () => {
    const r = placeAnswer(['10', '20', '30', 'All of the above'], 1, 'any-seed');
    expect(r.placement).toBe('unchanged');
  });
});
```

Add this helper beside them — it exists so the tests do not hard-code hash outputs, which would break if the hash ever changes:

```ts
/** Smallest `q-N` seed whose hashed target is `want`. Keeps tests independent of the hash. */
function findSeedWithTarget(want: number): string {
  for (let i = 0; i < 500; i++) {
    const seed = `q-${i}`;
    if (targetPosition(seed) === want) return seed;
  }
  throw new Error(`no seed found for target ${want}`);
}
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/services/questionQuality/answerPlacement.test.ts`
Expected: FAIL — `targetPosition` is not exported, and `'sorted-off-target'` is never returned.

- [ ] **Step 3: Implement**

Export the existing private hash so callers and tests can compute the same target:

```ts
/** The position an answer should occupy, derived only from the question's id. */
export function targetPosition(seed: string): number {
  return hashToPosition(seed);
}
```

Then change the sorted branch (currently lines 237-249) to verify instead of impose:

```ts
  const values = magnitudeValues(options);
  if (values && !isBoundedSeries(values)) {
    // Sort ascending, tie-broken by original index so the result is stable. Track the
    // correct option by its original index, never by its text -- duplicate option text
    // would otherwise silently retarget the answer.
    const order = values
      .map((v, i) => ({ v, i }))
      .sort((a, b) => (a.v - b.v) || (a.i - b.i));
    const sortedOptions = order.map((o) => options[o.i]);
    const sortedIndex = order.findIndex((o) => o.i === correctAnswer);

    // The options stay ascending either way -- readability is not the thing being
    // traded. What changes is that we now REPORT whether the sorted rank matches the
    // position this question was supposed to use, instead of silently accepting it.
    //
    // Generation is responsible for making these agree: it is told the target and
    // builds distractors around the true value to satisfy it (N strictly below,
    // 3-N strictly above). When it cannot do that plausibly -- asking for position A
    // on "in what year did X happen?" would need three later years, and for a recent
    // event those are in the future -- it is correct for generation to miss, and
    // 'sorted-off-target' is how that surfaces rather than becoming a silent bias.
    return {
      options: sortedOptions,
      correctAnswer: sortedIndex,
      placement: sortedIndex === hashToPosition(seed) ? 'sorted' : 'sorted-off-target',
    };
  }
```

Widen the type: `placement: 'sorted' | 'sorted-off-target' | 'permuted' | 'unchanged'`.

- [ ] **Step 4: Run them and watch them pass**

Run: `cd /c/ev-accounts/backend && npm run test:unit`
Expected: PASS, and the failure set byte-identical to the baseline named in Global Constraints.

- [ ] **Step 5: Vendor the copy and prove it**

```bash
cp /c/ev-accounts/backend/src/trivia/services/questionQuality/answerPlacement.ts \
   "/c/Project Test/backend/src/services/questionQuality/answerPlacement.ts"
cmp /c/ev-accounts/backend/src/trivia/services/questionQuality/answerPlacement.ts \
    "/c/Project Test/backend/src/services/questionQuality/answerPlacement.ts" && echo IDENTICAL
cd "/c/Project Test/backend" && npx tsc --noEmit
```
Expected: `IDENTICAL`, and `tsc` clean.

- [ ] **Step 6: Commit both repos**

---

### Task 2: Tell the generator the target position

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\content-generation\generate-locale-questions.ts` (batch prompt, ~line 242 area where the external-ID range is stated)
- Modify: `C:\Project Test\backend\src\scripts\content-generation\prompts\` — whichever system prompt file states the answer-options rules

**Interfaces:**
- Consumes: `targetPosition(externalId)` from Task 1.
- Produces: nothing importable; this is prompt text.

The batch prompt already states the exact ID range (`akron-oh_0001 through akron-oh_0030`), so the script knows every ID before generation. That is what makes target-first possible.

- [ ] **Step 1: Emit a per-question target table into the batch prompt**

Replace the single "External ID range" line with the range *plus* an explicit assignment, computed with `targetPosition`:

```
External IDs and required answer positions for this batch:
  akron-oh_0001 -> C
  akron-oh_0002 -> A
  ...
```

- [ ] **Step 2: State the construction rule and the plausibility limit in the system prompt**

Add a block to this effect — wording is yours, the four rules are not:

```
ANSWER POSITION
Each question above names the position its correct answer must occupy.

For options that are numbers, years, or quantities, the options will be shown to
the player sorted from smallest to largest. So build the distractors around the
true value to land it in the required position:
  position A -> all three distractors LARGER than the true value
  position B -> one smaller, two larger
  position C -> two smaller, one larger
  position D -> all three distractors SMALLER than the true value

Every distractor must still be plausible on its own. Never produce one that makes
the question unanswerable or absurd:
  - never a future date for something that has already happened
  - never a negative or zero count for a thing that exists
  - never a value outside the real range for that quantity

If the required position cannot be reached with plausible distractors, use the
nearest position you CAN support and say so in one short note. A believable
question in the wrong position is better than an impossible one in the right
position.
```

- [ ] **Step 3: Verify the rendered prompt by eye**

Run a `--dry-run` for one batch only and read the emitted prompt. **`--dry-run` still calls the Anthropic API** — it skips the database, not the model — so kill it after batch 1. Confirm the target table lists one position per ID and that positions are spread rather than constant.

- [ ] **Step 4: Commit**

---

### Task 3: Make the fallback observable

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\content-generation\utils\seed-questions.ts:155`

- [ ] **Step 1: Count and report off-target placements**

`placeAnswer` is already called here. Tally `placement` values across the batch and print a line per batch, e.g.
`Answer placement: 18 sorted, 3 sorted-off-target, 4 permuted, 0 unchanged`.

Review Focus 1 says some off-target results are *correct* — a year question that cannot take position A without inventing future dates. The number existing and being visible is the point; it should be small, not zero.

- [ ] **Step 2: Commit**

---

### Task 4: Fix the existing skew in the two pilot collections

**Files:** none — SQL only, against Supabase project `kxsdzaojfaibhuzmclfq`.

`akron-oh` and `ohio` already hold 117 drafts with C at 41%. New generation will not fix questions that already exist.

- [ ] **Step 1: Re-place the existing numeric questions**

For every draft in `akron-oh` and `ohio` whose four options are all magnitudes, recompute the option order and `correct_answer` with the Task 1 logic. The options stay ascending; only rows whose sorted rank already disagrees with their target change, and they change by being reported, not moved — so in practice this step is: re-run generation for those questions, or accept them.

**Ruling required from the executor:** re-running 38 questions costs a small generation pass; leaving them means the two pilot collections keep a visible C bias while the other 33 do not. Decide, ledger it, and say which you chose.

- [ ] **Step 2: Verify the distribution**

```sql
SELECT split_part(external_id,'_',1) AS coll,
       count(*) FILTER (WHERE correct_answer=0) AS a,
       count(*) FILTER (WHERE correct_answer=1) AS b,
       count(*) FILTER (WHERE correct_answer=2) AS c,
       count(*) FILTER (WHERE correct_answer=3) AS d,
       round(100.0*max(x.cnt)/count(*),1) AS worst_pct
FROM trivia.questions q,
     LATERAL (SELECT count(*) AS cnt FROM trivia.questions q2
              WHERE split_part(q2.external_id,'_',1)=split_part(q.external_id,'_',1)
                AND q2.status='draft' AND q2.correct_answer=q.correct_answer) x
WHERE split_part(q.external_id,'_',1) IN ('akron-oh','ohio') AND q.status='draft'
GROUP BY 1;
```
Expected: no position above ~35%.

---

### Task 5: Gate it so the bias cannot come back

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\audit-collection-readiness.ts`

- [ ] **Step 1: Add an answer-distribution check**

The auditor already calls `placeAnswer`. Add a check over the collection's active and draft questions: compute the A/B/C/D split and emit `DEFECT` when any single position exceeds **35%**, `NOTE` between 30% and 35%, silent below. Follow the existing non-blocking band style used for the expiring ratio.

This is what stops the next 33 collections inheriting the problem silently. Review Focus 5 lives here: the check covers *all* questions, not only numeric ones, so a skew arriving by another route is still caught.

- [ ] **Step 2: Run it against both pilot collections and read the output**

```bash
cd "/c/Project Test/backend" && npx tsx src/scripts/audit-collection-readiness.ts --slug akron-oh
```

**Database note:** CTC's own `DATABASE_URL` (role `ctc_app`) is dead — `XX000 ECIRCUITBREAKER: failed to retrieve database credentials`. Until that role is restored, scripts needing the database must run with ev-accounts' `DATABASE_URL` (role `ev_api`, which has write access) injected. Both `.env` files target the same Supabase project.

- [ ] **Step 3: Commit, and open one PR per repo, cross-linked**

---

## Context a fresh session needs

Everything below was established on 2026-09-29/30 and is not re-derivable from the code.

- **The slug external-ID scheme shipped.** New collections mint `<collection-slug>_<NNNN>` (`akron-oh_0001`); the 47 legacy prefixes are untouched. ev-accounts #844 / #845 and CTC #190 / #192, all merged. **`_` is a LIKE wildcard** — scope with `split_part(external_id,'_',1) = '<slug>'`, never `LIKE '<slug>_%'`.
- **Generation cost was fixed but not yet measured.** Akron and Ohio cost $2.93 and $3.00 each: 6 batch calls produced all 150 questions and 178 were single-question retries, 69% of them `duplicate-text`, because a ~114K-char corpus was asked for 150 questions when it supports ~60. Targets are now 70/80 with `overshootFactor` 1.0, the scaffold defaults to 70/1.0, and retries no longer re-send source documents for shape-only violations. **The next new collection is the first clean measurement.**
- **Validate source URLs through the pipeline's own extractor, never by eye.** `rag/fetch-sources.ts` strips semantic landmarks; `akroncitycouncil.org/members` is built entirely from them and yields **0 characters** while reading perfectly in a browser. A validator script pattern is described in the ledger; the cheap version is to run `--fetch-sources` and read the per-URL `Saved: (N chars)` / `Skipped:` lines before spending anything.
- **The accuracy-notes block is a comment. The model never reads it.** Only `topicCategories` descriptions and the fetched corpus reach the model. A fact asserted in a topic description with no corpus support invites invention — Akron's `veto` claim was removed for exactly this reason.
- **Two collections are unfinished**, both at `is_active = false`: `akron-oh` (59 drafts) and `ohio` (58 drafts). Both breach the 10% expiring floor (3.4% and 5.2%). Ohio's dates are now spread across 2027 / 2028 / 2031. Akron is a **structural** breach — its charter creates only two elected office types, mayor and council, and both are used; reaching 10% needs either banned roll-call questions or scope-blurring into the school board and county. Recommended outcome is a documented breach on the `biloxi-ms` (9.2%) precedent.
- **Open items not covered by this plan:** the `ctc_app` role needs restoring (handover doc in `docs/ops/`); `trivia.topics` id 489 is named "Oregon State Government" but serves Oregon, Ohio and Mississippi; and Knight batch 2 (33 collections) has no plan yet and runs through `/create-collection`, whose `SKILL.md` was corrected for the slug scheme but has never been exercised end to end.

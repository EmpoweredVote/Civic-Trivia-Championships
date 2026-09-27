# Collection Quality Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every same-answer duplicate question, bring every active collection to at least 25% easy under a corrected difficulty rubric, and stop questions that ask what year a past event happened while offering a year that has not arrived.

**Architecture:** Three workstreams over two repos. The anachronism rule is authored and test-driven in `ev-accounts` (the only repo with a test runner) and vendored into CTC, following the precedent set by `answerPlacement.test.ts`. The duplicate purge and the difficulty relabel are database operations driven through Supabase SQL, with per-collection JSON artifacts so the 3,855-question read is resumable and auditable.

**Tech Stack:** TypeScript, vitest (ev-accounts only), `tsx` for CTC scripts, Drizzle `db.execute(sql…)`, PostgreSQL with `extensions.pg_trgm`, Supabase MCP for direct SQL.

**Spec:** `docs/superpowers/specs/2026-09-26-collection-quality-audit-design.md`

## Global Constraints

- **Easy target is a floor, not a band.** "At least 25-33% easy." Never demote an easy question merely to bring a collection under 33%.
- **The only demotions permitted** are the rubric's own: `DISTRACTOR_FAIL`, `SUB_OFFICEHOLDER`, `PRECISE_NUMBER`.
- **Headline executive only.** Mayor, Governor, President, Vice President may be easy. Every other named officeholder may not.
- **Every question-insert path must call `placeAnswer()`.** No exceptions; generator prompts anchor `correctAnswer` to 0.
- **Numeric options follow §6a:** vary which bracket the answer falls in, one unit per question, options ordered ascending. Never move the correct value to achieve placement — change the distractors.
- **Never use the `master` admin bypass in CTC.** Every change lands via PR with both build checks green. Never rename a CI job.
- **Never run `npm ci` in the shared `frontend/` checkout at `C:\Project Test`.**
- **ev-accounts work happens in a worktree, not `c:/ev-accounts`** — Chris is actively seeding Knight cities from `c:/ev-accounts-ky`.
- **Archiving is `status='archived'`.** Never `DELETE` a question.
- **Supabase project ref:** `kxsdzaojfaibhuzmclfq`. Schema `trivia`. `pg_trgm` lives in the `extensions` schema — write `extensions.similarity(...)`.

## Review Focus

Five failure modes the spec implies but which no task's happy path exercises. Each has a test pinned in the task that owns the code.

1. **A past-tense year question whose options are not bare years** — "March 2027", "the 2026-27 school year", "FY2027". Year extraction must find the 2027 inside, or the rule silently passes the exact bug it exists to catch. → Task 1.
2. **A question carrying both a past and a future marker** — "What year was the closure deadline set, and when will it take effect?" The future exemption must not swallow a genuine past-tense violation. → Task 1.
3. **A four-digit number in an option that is not a year** — "2400 seats", "1200 killed". Treating it as a year produces false blocking violations on questions that are fine. → Task 1.
4. **Duplicate answers that differ only in case, whitespace or a leading article** — "Mayor" vs "the Mayor", "Plan E" vs "plan e". These are the same answer and must cluster; if they do not, real duplicates survive the purge. → Task 4.
5. **A relabel record naming an `external_id` that no longer exists**, because the duplicate purge archived it between export and apply. The apply step must fail loudly rather than silently updating zero rows. → Task 8.

---

## Sequencing and why it matters

**Task 4 (duplicate purge) must fully complete before Task 7 (difficulty export).** The purge archives roughly 126 questions. Exporting first would spend judgement on questions about to be archived, and would produce relabel records pointing at archived rows — Review Focus item 5.

**Tasks 1-2 (ev-accounts) land before Task 3 (CTC vendoring)**, because Task 3 copies the file Task 1 produces.

---

## PR 2a — ev-accounts: the anachronism rule

### Task 1: The anachronism rule

**Files:**
- Create: `backend/src/trivia/services/qualityRules/rules/anachronism.ts`
- Create: `backend/src/trivia/services/qualityRules/rules/anachronism.test.ts`

**Interfaces:**
- Consumes: `RuleResult`, `QuestionInput`, `Violation` from `../types.js` (already exist; `QuestionInput` has `text: string`, `options: string[]`, `correctAnswer: number`, `explanation: string`, `difficulty: string`, `source: {name,url}`, `externalId: string`)
- Produces: `checkAnachronisticYear(question: QuestionInput): RuleResult` — a synchronous `QualityRule`, registered in Task 2 and vendored in Task 3

**Setup first:** create the worktree so this never touches Chris's checkout.

```bash
cd /c/ev-accounts
git worktree add ../ev-accounts-anachronism -b claude/trivia-anachronism-rule master
cd ../ev-accounts-anachronism/backend
npm install
npm run steward -- claim code:trivia-quality-rules --label "anachronism rule — CTC quality audit"
```

The steward accepts any `kind:id`; a non-jurisdiction kind parses as `other` and is treated as unrelated to the live `state:ky` and `state:ks` claims, so this registers the work without contending with the Knight seeding.

- [ ] **Step 1: Write the failing test**

Create `backend/src/trivia/services/qualityRules/rules/anachronism.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkAnachronisticYear } from './anachronism.js';
import type { QuestionInput } from '../types.js';

/**
 * Fixtures are real questions from the live bank. The tense distinction is the whole
 * rule, so the three passing fixtures matter as much as the failing one.
 */
function q(over: Partial<QuestionInput>): QuestionInput {
  return {
    externalId: 'test-000',
    text: 'placeholder',
    options: ['a', 'b', 'c', 'd'],
    correctAnswer: 0,
    explanation: 'An explanation long enough to be realistic for the engine.',
    difficulty: 'medium',
    source: { name: 'Test', url: 'https://example.com' },
    ...over,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

/** Pin "now" so the suite does not change behaviour on 1 January. */
function freezeYear(year: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${year}-06-15T00:00:00Z`));
}

describe('checkAnachronisticYear — the bug it was written for', () => {
  it('blocks a past-tense year question offering a year that has not happened', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      externalId: 'wnews-0134',
      text: 'In what year was South African deputy police commissioner Lt Gen Shadrack Sibiya charged with sexual offences and trafficking?',
      options: ['2024', '2025', '2026', '2027'],
      correctAnswer: 2,
    }));
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].rule).toBe('anachronistic-year-option');
    expect(result.violations[0].severity).toBe('blocking');
    expect(result.violations[0].evidence).toContain('2027');
  });
});

describe('checkAnachronisticYear — forward-looking questions are legitimate', () => {
  it('passes "what year will" (por-043)', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      externalId: 'por-043',
      text: "What year will Portland's District 3 and 4 councilors first face re-election?",
      options: ['2025', '2026', '2027', '2028'],
      correctAnswer: 1,
    }));
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('passes "what year is X permitted to" (smo-019)', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      externalId: 'smo-019',
      text: 'What year is Santa Monica permitted to close its municipal airport?',
      options: ['2025', '2028', '2030', '2035'],
      correctAnswer: 1,
    }));
    expect(result.passed).toBe(true);
  });

  it('passes "by what year does X plan to" (ica-100)', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      externalId: 'ica-100',
      text: 'By what year does SunLine Transit Agency plan to convert its fleet to zero-emission buses?',
      options: ['2035', '2040', '2045', '2050'],
      correctAnswer: 0,
    }));
    expect(result.passed).toBe(true);
  });

  it('passes a projection stated in the past tense about the future (climc-0051)', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      externalId: 'climc-0051',
      text: "Australia's seventh intergenerational report, released in September 2026, projects economic and social trends out to what year?",
      options: ['2056', '2061', '2066', '2071'],
      correctAnswer: 2,
    }));
    expect(result.passed).toBe(true);
  });
});

describe('checkAnachronisticYear — Review Focus cases', () => {
  it('finds a future year embedded in a longer option string', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      text: 'In what year was the new city charter adopted?',
      options: ['March 2024', 'March 2025', 'March 2026', 'March 2027'],
      correctAnswer: 2,
    }));
    expect(result.passed).toBe(false);
    expect(result.violations[0].evidence).toContain('2027');
  });

  it('finds a future year in a school-year style range', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      text: 'In what year did the district adopt the new calendar?',
      options: ['2023-24', '2024-25', '2025-26', '2026-27'],
      correctAnswer: 2,
    }));
    expect(result.passed).toBe(false);
  });

  it('does not let a future marker excuse a genuine past-tense violation', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      text: 'What year was the closure deadline set, before it will take effect?',
      options: ['2024', '2025', '2026', '2027'],
      correctAnswer: 1,
    }));
    expect(result.passed).toBe(false);
  });

  it('ignores four-digit numbers that are not years', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      text: 'How many people were killed in the 7 October 2023 attacks?',
      options: ['1200', '2400', '3600', '4800'],
      correctAnswer: 0,
    }));
    expect(result.passed).toBe(true);
  });

  it('passes a past-tense question whose options are all in the past', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      text: 'In what year was the Cambridge Board of Election Commissioners established?',
      options: ['1921', '1938', '1945', '1952'],
      correctAnswer: 1,
    }));
    expect(result.passed).toBe(true);
  });

  it('is not a year question at all, so passes regardless of options', () => {
    freezeYear(2026);
    const result = checkAnachronisticYear(q({
      text: 'Who appoints members of the Cambridge Board of Election Commissioners?',
      options: ['2027 Committee', 'The City Manager', 'The Governor', 'The Mayor'],
      correctAnswer: 1,
    }));
    expect(result.passed).toBe(true);
  });

  it('reads the current year from the clock, not a constant', () => {
    freezeYear(2030);
    const result = checkAnachronisticYear(q({
      text: 'In what year was the new charter adopted?',
      options: ['2027', '2028', '2029', '2031'],
      correctAnswer: 0,
    }));
    expect(result.passed).toBe(false);
    expect(result.violations[0].evidence).toContain('2031');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/ev-accounts-anachronism/backend && npx vitest run src/trivia/services/qualityRules/rules/anachronism.test.ts`
Expected: FAIL — `Failed to resolve import "./anachronism.js"`

- [ ] **Step 3: Write the implementation**

Create `backend/src/trivia/services/qualityRules/rules/anachronism.ts`:

```typescript
/**
 * Anachronism Quality Rule
 *
 * A question that asks what year a past event happened must not offer a year that
 * has not arrived. Such an option tests whether the player parses the question,
 * not whether they know the answer.
 *
 * This is BLOCKING: an impossible option is a correctness defect, not a style issue.
 *
 * Tense is what separates a bug from a legitimate question. "What year WILL the
 * councilors face re-election?" may offer 2028; "In what year WAS he charged?" may not.
 */

import { RuleResult, QuestionInput, Violation } from '../types.js';

/** Does the question ask for a year or a date at all? */
const YEAR_QUESTION = /\b(what|which|in what|by what)\s+year\b|\bwhen\s+(did|was|were|will)\b|\byear\s+(did|was|were|will)\b/i;

/**
 * Forward-looking constructions. Checked FIRST — these make future options correct.
 * `projects?/projected` covers reports that are published in the past about the future.
 */
const FUTURE_MARKER = /\b(will|shall|by\s+what\s+year|plans?\s+to|planned\s+to|is\s+permitted|are\s+permitted|committed\s+to|commits\s+to|targets?|targeting|projects?|projected|projecting|expects?|expected|scheduled|due\s+to|set\s+to|aims?\s+to|goal|deadline\s+(?:is|of))\b/i;

/** Past-tense constructions. */
const PAST_MARKER = /\b(was|were|did|has\s+been|have\s+been|had|became|opened|established|founded|incorporated|chartered|adopted|signed|charged|elected|created|passed|enacted|built|completed|launched|began|started|ended)\b/i;

/**
 * A plausible calendar year: 1000-2999.
 *
 * Deliberately matched anywhere in the option, including inside "March 2027" and
 * "2026-27", because a year that only appears mid-string is still an offered year.
 */
const YEAR_TOKEN = /\b([12]\d{3})\b/g;

/**
 * A four-digit number is only read as a year when the question is asking for one.
 * That gate is the question text, checked before this function is reached — it is
 * what keeps "1200 killed" and "2400 seats" from being misread.
 */
function yearsIn(option: string): number[] {
  const found: number[] = [];
  for (const match of option.matchAll(YEAR_TOKEN)) {
    found.push(Number(match[1]));
  }

  // "2026-27" and "2026/27": expand the abbreviated second half into a full year.
  const span = option.match(/\b([12]\d{3})\s*[-/–]\s*(\d{2})\b/);
  if (span) {
    const century = Math.floor(Number(span[1]) / 100) * 100;
    found.push(century + Number(span[2]));
  }

  return found;
}

/**
 * BLOCKING RULE: no future year may be offered for an event already past.
 *
 * @param question - Question to evaluate
 * @returns Rule result with any violations found
 */
export function checkAnachronisticYear(question: QuestionInput): RuleResult {
  const violations: Violation[] = [];
  const text = question.text;

  // Gate 1: is this even a year question?
  if (!YEAR_QUESTION.test(text)) {
    return { passed: true, violations: [] };
  }

  // Gate 2: forward-looking questions may offer future years.
  //
  // A future marker only exempts the question when there is no past-tense marker
  // alongside it. "What year was the deadline set, before it will take effect?"
  // is a past-tense question that happens to contain "will" — exempting it would
  // let the bug through in the one phrasing most likely to carry both.
  const hasFuture = FUTURE_MARKER.test(text);
  const hasPast = PAST_MARKER.test(text);
  if (hasFuture && !hasPast) {
    return { passed: true, violations: [] };
  }

  // Gate 3: only past-tense questions are constrained.
  if (!hasPast) {
    return { passed: true, violations: [] };
  }

  const currentYear = new Date().getFullYear();
  const offending: number[] = [];

  for (const option of question.options) {
    for (const year of yearsIn(option)) {
      if (year > currentYear) {
        offending.push(year);
      }
    }
  }

  if (offending.length > 0) {
    const unique = [...new Set(offending)].sort((a, b) => a - b);
    violations.push({
      rule: 'anachronistic-year-option',
      severity: 'blocking',
      message:
        'Question asks when a past event happened but offers a year that has not arrived. ' +
        'The option tests comprehension, not knowledge.',
      evidence: `current year ${currentYear}; offered ${unique.join(', ')}`,
    });
  }

  return { passed: violations.length === 0, violations };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/trivia/services/qualityRules/rules/anachronism.test.ts`
Expected: PASS — 13 tests

If the "school-year style range" test fails, the `span` expansion in `yearsIn` is the place to look: `2026-27` must yield `2027`, not only `2026`.

- [ ] **Step 5: Commit**

```bash
git add src/trivia/services/qualityRules/rules/anachronism.ts src/trivia/services/qualityRules/rules/anachronism.test.ts
git commit -m "$(cat <<'EOF'
feat(trivia): block past-tense year questions that offer a future year

wnews-0134 asked what year a man WAS charged and offered 2027. The option
tests whether the player parses the question, not whether they know when it
happened.

Tense decides it, so the passing fixtures carry the weight: por-043 ("what
year WILL they face re-election"), smo-019 ("is permitted to close") and
ica-100 ("by what year does it plan to") all legitimately offer future years
and must stay green. A future marker does not exempt a question that also
carries a past-tense one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Register the rule in the engine

**Files:**
- Modify: `backend/src/trivia/services/qualityRules/index.ts:16` (import block) and `:22-27` (`ALL_SYNC_RULES`)

**Interfaces:**
- Consumes: `checkAnachronisticYear` from Task 1
- Produces: `auditQuestion()` now returns `hasBlockingViolations: true` for anachronistic questions

- [ ] **Step 1: Write the failing test**

Append to `backend/src/trivia/services/qualityRules/rules/anachronism.test.ts`:

```typescript
describe('registration in the rules engine', () => {
  it('auditQuestion reports a blocking violation for wnews-0134', async () => {
    freezeYear(2026);
    const { auditQuestion } = await import('../index.js');
    const result = await auditQuestion(
      q({
        externalId: 'wnews-0134',
        text: 'In what year was South African deputy police commissioner Lt Gen Shadrack Sibiya charged with sexual offences and trafficking?',
        options: ['2024', '2025', '2026', '2027'],
        correctAnswer: 2,
      }),
      { skipUrlCheck: true }
    );
    expect(result.hasBlockingViolations).toBe(true);
    expect(result.violations.map(v => v.rule)).toContain('anachronistic-year-option');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/trivia/services/qualityRules/rules/anachronism.test.ts -t "auditQuestion reports"`
Expected: FAIL — `hasBlockingViolations` is `false`, because the rule is not registered

- [ ] **Step 3: Register the rule**

In `backend/src/trivia/services/qualityRules/index.ts`, add the import after the `checkAddressPhone` import:

```typescript
import { checkAnachronisticYear } from './rules/anachronism.js';
```

and add it to `ALL_SYNC_RULES`:

```typescript
export const ALL_SYNC_RULES: QualityRule[] = [
  checkAmbiguousAnswers,
  checkVagueQualifiers,
  checkPureLookup,
  checkStructuralQuality,
  checkPartisanFraming,
  checkAddressPhone,
  checkAnachronisticYear,
];
```

- [ ] **Step 4: Run the full trivia suite**

Run: `npx vitest run src/trivia`
Expected: PASS — the new tests plus the nine existing trivia test files. `npm test` is red on master for unrelated integration reasons; scope to `src/trivia` here and use `npm run test:unit` as the broader gate.

- [ ] **Step 5: Commit and open PR 2a**

```bash
git add src/trivia/services/qualityRules/index.ts src/trivia/services/qualityRules/rules/anachronism.test.ts
git commit -m "$(cat <<'EOF'
feat(trivia): register the anachronism rule in the quality engine

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin claude/trivia-anachronism-rule
gh pr create --base master --title "feat(trivia): block past-tense year questions offering a future year" --body "See CTC spec docs/superpowers/specs/2026-09-26-collection-quality-audit-design.md §4.3.

Authored here rather than in CTC because CTC's backend has no test runner — the same reason answerPlacement.test.ts was ported here. The CTC copy is vendored from this file and the two must stay in step.

Wiring this rule into pipelineCron is deliberately NOT in this PR; it is the follow-up that closes the gap.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 6: Release the steward claim once merged**

```bash
npm run steward -- release code:trivia-quality-rules
```

---

## PR 1 — CTC: vendored rule, duplicate purge, rubric, relabel, backfill

Branch: `feat/collection-quality-audit` off `master` in `C:\Project Test`.

```bash
cd "/c/Project Test" && git checkout master && git pull --ff-only && git checkout -b feat/collection-quality-audit
```

### Task 3: Vendor the rule into CTC

**Files:**
- Create: `backend/src/services/qualityRules/rules/anachronism.ts`
- Modify: `backend/src/services/qualityRules/index.ts:16` and `:22-27`
- Modify: `backend/src/scripts/test-quality-rules.ts`

**Interfaces:**
- Consumes: the file produced by Task 1
- Produces: `checkAnachronisticYear` available to `content-generation/utils/quality-validation.ts`, which calls `auditQuestion()` — this is what guards newly created collections

- [ ] **Step 1: Copy the tested file verbatim and add the provenance header**

```bash
cp /c/ev-accounts-anachronism/backend/src/trivia/services/qualityRules/rules/anachronism.ts \
   "/c/Project Test/backend/src/services/qualityRules/rules/anachronism.ts"
```

Then insert this immediately below the closing `*/` of the file's top doc comment:

```typescript
/**
 * VENDORED from ev-accounts/backend/src/trivia/services/qualityRules/rules/anachronism.ts.
 * That repo has the test runner and owns the tests; this copy guards the collection-creation
 * scripts this repo still owns. Keep the two in step — same arrangement as answerPlacement.
 */
```

- [ ] **Step 2: Register it**

In `backend/src/services/qualityRules/index.ts`, add after the `checkAddressPhone` import:

```typescript
import { checkAnachronisticYear } from './rules/anachronism.js';
```

and append `checkAnachronisticYear,` to `ALL_SYNC_RULES`.

- [ ] **Step 3: Add a case to the existing manual harness**

CTC has no test runner, so its checks live in `backend/src/scripts/test-quality-rules.ts`. Add alongside the existing fixtures:

```typescript
// Anachronistic year — past tense question offering a year that has not arrived
const anachronisticQuestion: QuestionInput = {
  externalId: 'test-anachronism-001',
  text: 'In what year was the new city charter adopted?',
  options: ['2024', '2025', '2026', '2027'],
  correctAnswer: 2,
  explanation: 'The charter was adopted in 2026.',
  difficulty: 'medium',
  source: { name: 'Test', url: 'https://example.com' }
};

// Forward-looking — must NOT be flagged
const forwardLookingQuestion: QuestionInput = {
  externalId: 'test-anachronism-002',
  text: 'What year will the councilors first face re-election?',
  options: ['2025', '2026', '2027', '2028'],
  correctAnswer: 1,
  explanation: 'They face re-election in 2026.',
  difficulty: 'medium',
  source: { name: 'Test', url: 'https://example.com' }
};
```

Follow the file's existing pattern for invoking `auditQuestion` and printing the result on each fixture.

- [ ] **Step 4: Verify both build and harness**

Run:
```bash
cd "/c/Project Test/backend" && npx tsc --noEmit && npx tsx src/scripts/test-quality-rules.ts
```
Expected: clean typecheck; `test-anachronism-001` shows a blocking `anachronistic-year-option`; `test-anachronism-002` shows none.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/qualityRules/rules/anachronism.ts backend/src/services/qualityRules/index.ts backend/src/scripts/test-quality-rules.ts
git commit -m "$(cat <<'EOF'
feat(quality): vendor the anachronism rule to guard collection creation

Tested in ev-accounts; this copy is what content-generation/utils/
quality-validation.ts reaches through auditQuestion(), so new collections
get the guard too.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Duplicate purge

**Files:**
- Create: `.planning/dedup-reports/answer-duplicates-2026-09-26.md` (the review artifact)
- Database: `trivia.questions.status`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: a bank with zero same-answer duplicate pairs, which Task 7 exports

- [ ] **Step 1: Produce the candidate report**

Run this through Supabase MCP (`execute_sql`, project `kxsdzaojfaibhuzmclfq`). Answer normalisation covers Review Focus item 4 — case, whitespace, punctuation and a leading article:

```sql
with cq as (
  select c.id cid, c.slug, q.id, q.external_id, q.text, q.difficulty,
         q.quality_score, q.encounter_count,
         regexp_replace(
           lower(trim(q.options->>q.correct_answer)),
           '^(the|a|an)\s+', ''
         ) as ans_norm
  from trivia.questions q
  join trivia.collection_questions cq on cq.question_id = q.id
  join trivia.collections c on c.id = cq.collection_id and c.is_active
  where q.status = 'active'
)
select a.slug,
       a.external_id a_id, b.external_id b_id,
       round(extensions.similarity(a.text, b.text)::numeric, 3) sim,
       a.ans_norm,
       a.text a_text, b.text b_text
from cq a
join cq b on a.cid = b.cid and a.id < b.id
where extensions.similarity(a.text, b.text) > 0.55
  and regexp_replace(a.ans_norm, '[^a-z0-9]', '', 'g')
    = regexp_replace(b.ans_norm, '[^a-z0-9]', '', 'g')
order by a.slug, sim desc;
```

Save the output to `.planning/dedup-reports/answer-duplicates-2026-09-26.md`.

- [ ] **Step 2: Build the clusters and print every cluster larger than three**

Connected components over the pairs from Step 1, with the same-answer constraint applied to every member rather than only to linked pairs:

```sql
with recursive cq as (
  select c.id cid, q.id, q.external_id, q.text,
         q.quality_score, q.encounter_count,
         regexp_replace(
           regexp_replace(lower(trim(q.options->>q.correct_answer)), '^(the|a|an)\s+', ''),
           '[^a-z0-9]', '', 'g'
         ) as ans_key
  from trivia.questions q
  join trivia.collection_questions cq on cq.question_id = q.id
  join trivia.collections c on c.id = cq.collection_id and c.is_active
  where q.status = 'active'
),
edges as (
  select a.id a_id, b.id b_id
  from cq a join cq b
    on a.cid = b.cid and a.ans_key = b.ans_key and a.id <> b.id
  where extensions.similarity(a.text, b.text) > 0.55
),
reach as (
  select id as root, id as node from cq
  union
  select r.root, e.b_id
  from reach r join edges e on e.a_id = r.node
),
comp as (
  select node, min(root) as cluster_id
  from reach group by node
)
select comp.cluster_id,
       count(*) over (partition by comp.cluster_id) as cluster_size,
       cq.external_id, cq.ans_key, cq.quality_score, cq.encounter_count, cq.text
from comp join cq on cq.id = comp.node
where comp.cluster_id in (
  select cluster_id from comp group by cluster_id having count(*) > 1
)
order by cluster_size desc, comp.cluster_id, cq.external_id;
```

Because `edges` requires `a.ans_key = b.ans_key`, transitive chaining cannot cross an answer boundary — the `clusterArticles` failure mode cannot occur here.

- [ ] **Step 3: Eyeball every cluster of size 4 or more**

Read them in the output of Step 2. Expect Cambridge's eight-question voting-system cluster among them. For each, confirm every member really does ask the same thing. If a member does not belong, record its `external_id` in an exclusion list and carry that list into Step 4.

This is the one human look the spec calls for. It does not reopen the per-pair review Chris declined.

- [ ] **Step 4: Apply the archive**

Keep rule in order: higher `quality_score` (NULL last — it decides almost nothing, since 92% of the bank is NULL), then higher `encounter_count`, then lower `external_id`.

```sql
with recursive cq as (
  select c.id cid, q.id, q.external_id, q.text,
         q.quality_score, q.encounter_count,
         regexp_replace(
           regexp_replace(lower(trim(q.options->>q.correct_answer)), '^(the|a|an)\s+', ''),
           '[^a-z0-9]', '', 'g'
         ) as ans_key
  from trivia.questions q
  join trivia.collection_questions cq on cq.question_id = q.id
  join trivia.collections c on c.id = cq.collection_id and c.is_active
  where q.status = 'active'
),
edges as (
  select a.id a_id, b.id b_id
  from cq a join cq b
    on a.cid = b.cid and a.ans_key = b.ans_key and a.id <> b.id
  where extensions.similarity(a.text, b.text) > 0.55
),
reach as (
  select id as root, id as node from cq
  union
  select r.root, e.b_id
  from reach r join edges e on e.a_id = r.node
),
comp as ( select node, min(root) as cluster_id from reach group by node ),
ranked as (
  select cq.id, cq.external_id, comp.cluster_id,
         row_number() over (
           partition by comp.cluster_id
           order by cq.quality_score desc nulls last,
                    cq.encounter_count desc,
                    cq.external_id asc
         ) as keep_rank
  from comp join cq on cq.id = comp.node
)
update trivia.questions q
set status = 'archived', updated_at = now()
from ranked
where q.id = ranked.id
  and ranked.keep_rank > 1
  and ranked.external_id not in ( /* exclusions from Step 3, or '' if none */ )
returning q.external_id, ranked.cluster_id;
```

Record the returned rows in the report file.

- [ ] **Step 5: Verify**

Re-run Step 1's query. Expected: **zero rows**.

Then confirm no collection was pushed further below the floor. `war-in-iran` (33) and `world-news` (44) were already under 50 before this ran; the check is that nothing dropped that was not already down:

```sql
select c.slug, count(*) filter (where q.status='active') as active_q
from trivia.collections c
join trivia.collection_questions cq on cq.collection_id = c.id
join trivia.questions q on q.id = cq.question_id
where c.is_active
group by 1 having count(*) filter (where q.status='active') < 50
order by 2;
```
Expected: only `war-in-iran` and `world-news`.

- [ ] **Step 6: Commit the report**

```bash
git add .planning/dedup-reports/answer-duplicates-2026-09-26.md
git commit -m "$(cat <<'EOF'
fix(content): archive same-answer duplicate questions

Cambridge carried an eight-question cluster all asking what voting system
the city uses, and cam-011/cam-093 were the same question at similarity
1.000. Clustering requires a shared normalised answer on every member, not
just on linked pairs, so "polls open"/"polls close" and "Inspector"/"Clerk"
survive as the distinct questions they are.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Scan and fix existing anachronistic questions

**Files:**
- Create: `backend/src/scripts/audit-anachronism.ts`
- Modify: `backend/package.json` (add the npm script)
- Database: the questions the scan flags

**Interfaces:**
- Consumes: `checkAnachronisticYear` registered in Task 3
- Produces: a clean bank by the rule's own measure

- [ ] **Step 1: Write the audit script**

Create `backend/src/scripts/audit-anachronism.ts`, modelled on the existing read-only `audit-address-phone.ts`:

```typescript
/**
 * Anachronism Audit Script
 *
 * Scans all active questions against checkAnachronisticYear and reports every
 * question offering a year that has not arrived for an event already past.
 *
 * READ-ONLY — makes no database mutations. Flagged questions are fixed by hand,
 * because the repair is a new distractor, not a deletion.
 *
 * Usage:
 *   npm run audit-anachronism
 */

import '../env.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { checkAnachronisticYear } from '../services/qualityRules/rules/anachronism.js';
import type { QuestionInput } from '../services/qualityRules/types.js';

interface QuestionRow {
  external_id: string;
  text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty: string;
  source: { name: string; url: string };
  slug: string;
}

async function main() {
  const result = await db.execute(sql`
    SELECT q.external_id, q.text, q.options, q.correct_answer,
           q.explanation, q.difficulty, q.source, c.slug
    FROM trivia.questions q
    JOIN trivia.collection_questions cq ON cq.question_id = q.id
    JOIN trivia.collections c ON c.id = cq.collection_id AND c.is_active
    WHERE q.status = 'active'
    ORDER BY c.slug, q.external_id
  `);

  const rows = result.rows as unknown as QuestionRow[];
  let flagged = 0;

  for (const row of rows) {
    const input: QuestionInput = {
      externalId: row.external_id,
      text: row.text,
      options: row.options,
      correctAnswer: row.correct_answer,
      explanation: row.explanation,
      difficulty: row.difficulty,
      source: row.source,
    };

    const check = checkAnachronisticYear(input);
    if (!check.passed) {
      flagged++;
      console.log(`\n[${row.slug}] ${row.external_id}`);
      console.log(`  ${row.text}`);
      console.log(`  options: ${row.options.join(' | ')}`);
      console.log(`  answer:  ${row.options[row.correct_answer]}`);
      console.log(`  ${check.violations[0].evidence}`);
    }
  }

  console.log(`\nScanned ${rows.length} active questions; flagged ${flagged}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

The explicit `process.exit(0)` matters: CTC's DB scripts are known to hang after "PostgreSQL connected" rather than releasing the pool.

- [ ] **Step 2: Add the npm script**

In `backend/package.json`, beside the other audit entries:

```json
"audit-anachronism": "tsx src/scripts/audit-anachronism.ts",
```

- [ ] **Step 3: Run the scan**

Run: `cd "/c/Project Test/backend" && npm run audit-anachronism`
Expected: `wnews-0134` flagged. The hand-written regex used during the audit found exactly one; the rule is stricter, so treat any number as the real answer.

If the script hangs after connecting, fall back to running the same SELECT through Supabase MCP and applying the rule's logic to the returned rows.

- [ ] **Step 4: Fix each flagged question**

For each, replace the impossible option with a plausible past year. Never move the correct value; change the distractor only, per §6a. For `wnews-0134` the answer is 2026, so the option set becomes `2023 / 2024 / 2025 / 2026` — which also moves the answer out of third place.

```sql
update trivia.questions
set options = '["2023","2024","2025","2026"]'::jsonb,
    correct_answer = 3,
    updated_at = now()
where external_id = 'wnews-0134';
```

Verify `correct_answer` still indexes the right string before and after:

```sql
select external_id, options, correct_answer, options->>correct_answer as answer
from trivia.questions where external_id = 'wnews-0134';
```
Expected: `answer` is `2026`.

- [ ] **Step 5: Re-run the scan to confirm clean**

Run: `npm run audit-anachronism`
Expected: `flagged 0`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/scripts/audit-anachronism.ts backend/package.json
git commit -m "$(cat <<'EOF'
feat(quality): add an anachronism audit over the live bank

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Rewrite the difficulty rubric

**Files:**
- Modify: `.planning/COLLECTION-PLAYBOOK.md` §4
- Modify: `backend/src/scripts/content-generation/prompts/system-prompt.ts`
- Modify: `backend/src/scripts/content-generation/prompts/state-system-prompt.ts`

**Interfaces:**
- Consumes: nothing
- Produces: the written rubric that Tasks 8 and 10 apply

- [ ] **Step 1: Replace the two rubric lines in the playbook**

In `.planning/COLLECTION-PLAYBOOK.md` §4, under "Two rules that fall out of this", replace:

```markdown
- **An officeholder's name is never easy.**
```

with:

```markdown
- **An officeholder's name is not easy — except the single headline executive.**
  The Mayor of a city, the Governor of a state, and the President and Vice President
  are EASY: a resident is expected to know who runs the place. Every other named
  officeholder — council members, commissioners, clerks, auditors, Speakers Pro Tem,
  deputies — is not, and the HARD bullet above ("named holders of offices below the
  headline ones") is where most of them belong.
```

- [ ] **Step 2: Extend the EASY section**

In the same section, append to the EASY bullet list:

```markdown
- **Term lengths.** How long a mayor, governor or council member serves.
- **Founding, incorporation or chartering year** of the city or state.
- **The elementary-civics test.** If it is the kind of fact an elementary school
  history or civics book would state plainly, it is easy — **provided the question is
  well sourced.** The sourcing gate is what keeps this from becoming a licence for
  half-remembered folklore; every active question today has a source, so it costs
  nothing to enforce.
```

- [ ] **Step 3: Add the distractor rule**

Append a new subsection to §4 after the rubric:

```markdown
### The distractor rule for easy questions

A question's difficulty is carried by its option set, not by its subject. Across the
bank, questions labelled easy are answered correctly **50.0%** of the time — identical
to medium, and only 25 points above blind guessing on four options. Relabelling alone
will not change that.

**An easy question's three distractors must be ones a resident rules out instantly.**

- GOOD — "Who is the Mayor of Cambridge?" against three names who plainly do not hold
  the office.
- BAD — the same question against three sitting Cambridge city councillors. The subject
  is easy; the question is not.

When an otherwise-easy question fails only on its distractors, **rewrite the option set
rather than demoting the question.** Never move the correct value to achieve this —
change the distractors around it, and keep §6a's bracket variation in view while you do.
```

- [ ] **Step 4: Mirror the rubric into both generation prompts**

Both files carry an **identical** block — `system-prompt.ts:63-68` and `state-system-prompt.ts:86-91`:

```markdown
## Difficulty Distribution

Distribute difficulty across the full batch:
- Easy: 40% of questions (foundational facts, direct answers)
- Medium: 40% of questions (requires some civic knowledge)
- Hard: 20% of questions (nuanced details, specific facts)
```

**Note what this proves:** the prompt has asked for 40% easy all along, and collections came out at 16-26%. A percentage target without a definition does not work, which is why the replacement leads with what easy *is*.

Replace that block, in both files, with:

```markdown
## Difficulty Distribution

At least 30% of the batch must be EASY. This is a floor, not a target to hover at —
a medium-heavy batch is a defect. Aim for roughly 30% easy / 45% medium / 25% hard.

A percentage alone does not work; classify by **what the player must bring**.

**EASY** — someone who lives there would likely know it without study.
- The single headline executive: the Mayor, the Governor, the President, the Vice
  President. A resident knows who runs the place.
- Term lengths — how long a mayor, governor or council member serves.
- The founding, incorporation or chartering year.
- Orientation and geography: which county, which bordering state, which river, which ocean.
- The single most recognisable landmark, employer or institution.
- The elementary-civics test: a fact an elementary school civics book would state
  plainly — provided you can source it.

**MEDIUM** — a resident could reason to it, or knows it from some familiarity.
Institutional structure and process, who appoints whom, advisory scope, non-iconic
dates, second-order associations.

**HARD** — needs specific study.
A precise figure recalled exactly; **named holders of any office below the headline
executive** — council members, commissioners, clerks, auditors, deputies; multi-step
comparative reasoning.

### The distractor rule

Difficulty is carried by the option set, not the subject. Measured across the live
bank, questions labelled easy are answered correctly 50.0% of the time — identical to
medium, and only 25 points above blind guessing.

**An easy question's three distractors must be ones a resident rules out instantly.**

- GOOD — "Who is the Mayor of Cambridge?" against three names who plainly do not hold
  the office.
- BAD — the same question against three sitting Cambridge city councillors.

If a famous subject has four independently plausible options, it is NOT easy. Never
move the correct value to fix this — change the distractors around it.
```

The state prompt keeps its state-scale rule unchanged: the capital city is allowed as the seat of state institutions; city landmarks are not.

- [ ] **Step 5: Verify the prompts still typecheck**

Run: `cd "/c/Project Test/backend" && npx tsc --noEmit`
Expected: clean. These are template literals, so an unescaped backtick is the likely failure.

- [ ] **Step 6: Commit**

```bash
git add .planning/COLLECTION-PLAYBOOK.md backend/src/scripts/content-generation/prompts/
git commit -m "$(cat <<'EOF'
docs(playbook): headline-executive exception and the distractor rule

"An officeholder's name is never easy" was too broad. A resident knows who
the mayor is; they do not know which councillor chairs which committee. The
general rule stands, with the single headline executive carved out.

Adds term lengths, founding years and a sourced elementary-civics test to
EASY, and the distractor rule — easy questions are answered correctly 50.0%
of the time, identical to medium, because the option sets do the work the
label claims.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Export every collection for review

**Files:**
- Create: `.planning/difficulty-audit/<slug>.json` — one per active collection
- Create: `.planning/difficulty-audit/README.md`

**Interfaces:**
- Consumes: the post-purge bank from Task 4 — **Task 4 must be fully complete and verified first**
- Produces: the JSON files Task 8 fills in and Task 9 applies

**Record shape**, used by Tasks 8 and 9:

```json
{
  "slug": "cambridge-ma",
  "exportedAt": "2026-09-26",
  "questions": [
    {
      "externalId": "cam-004",
      "text": "In Cambridge's Plan E government, who serves as the chief executive...",
      "options": ["...", "...", "...", "..."],
      "answer": "The City Manager",
      "oldDifficulty": "medium",
      "newDifficulty": null,
      "reason": null,
      "rewriteOptions": null,
      "rewriteCorrectAnswer": null
    }
  ]
}
```

`newDifficulty` is one of `easy` / `medium` / `hard`. `reason` is one of `HEADLINE_EXEC`, `TERM_LENGTH`, `FOUNDING_YEAR`, `ELEM_CIVICS`, `LANDMARK_GEO`, `SUB_OFFICEHOLDER`, `PRECISE_NUMBER`, `DISTRACTOR_FAIL`, `NO_CHANGE`.

`rewriteOptions` is `null` unless `reason` is `DISTRACTOR_FAIL`, in which case it is the replacement four-option array. **`rewriteCorrectAnswer` is then mandatory** — the index of the correct value within `rewriteOptions`. A rewrite changes the distractors around an unmoved correct value, but its *index* almost always moves, and §6a asks for the bracket to vary deliberately. Leaving the old index in place would silently mark a distractor as the answer, so Task 9 refuses any rewrite that omits it.

- [ ] **Step 1: Export each collection**

For each active collection slug, run through Supabase MCP and write the result to `.planning/difficulty-audit/<slug>.json` in the shape above:

```sql
select q.external_id, q.text, q.options,
       q.options->>q.correct_answer as answer,
       q.difficulty as old_difficulty
from trivia.questions q
join trivia.collection_questions cq on cq.question_id = q.id
join trivia.collections c on c.id = cq.collection_id
where c.slug = '<slug>' and q.status = 'active'
order by q.external_id;
```

- [ ] **Step 2: Write the README**

Create `.planning/difficulty-audit/README.md` stating: the record shape above, the reason-code table from Task 8, that one file per collection makes the pass resumable, and that these files are the input to `apply-relabel.ts`.

- [ ] **Step 3: Confirm the export is complete**

Expected: 43 files, and the sum of their `questions` arrays equals the active-question count:

```sql
select count(distinct q.id)
from trivia.questions q
join trivia.collection_questions cq on cq.question_id = q.id
join trivia.collections c on c.id = cq.collection_id and c.is_active
where q.status = 'active';
```

- [ ] **Step 4: Commit**

```bash
git add .planning/difficulty-audit/
git commit -m "$(cat <<'EOF'
chore(content): export active questions per collection for difficulty review

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The relabel pass

**Files:**
- Modify: every `.planning/difficulty-audit/<slug>.json`

**Interfaces:**
- Consumes: the exports from Task 7 and the rubric from Task 6
- Produces: filled-in `newDifficulty` / `reason` / `rewriteOptions` for every question

This is the long pole: 3,855 questions. It is **one task with a repeated per-collection procedure**, not 43 tasks, and the per-collection files make it resumable — a collection whose records all have a non-null `reason` is done.

**Reason codes:**

| code | meaning | effect |
|---|---|---|
| `HEADLINE_EXEC` | Mayor / Governor / President / VP | → easy |
| `TERM_LENGTH` | length of a term of office | → easy |
| `FOUNDING_YEAR` | founding, incorporation, chartering year | → easy |
| `ELEM_CIVICS` | elementary civics-book fact, well sourced | → easy |
| `LANDMARK_GEO` | recognisable landmark, orientation, geography | → easy |
| `SUB_OFFICEHOLDER` | named holder below the headline office | → not easy |
| `PRECISE_NUMBER` | exact figure with close distractors | → hard |
| `DISTRACTOR_FAIL` | easy subject, four plausible options | → stays easy, options rewritten |
| `NO_CHANGE` | label already correct | unchanged |

- [ ] **Step 1: Judge one collection**

Start with `cambridge-ma` — it is the collection that prompted this work and the largest at 124 active questions before the purge.

For each record: read `text`, `options` and `answer`; assign `newDifficulty` and `reason`. Apply the distractor test in both directions, not only upward.

Where `reason` is `DISTRACTOR_FAIL`, write the replacement array into `rewriteOptions` — the correct value itself unchanged, three new distractors a resident rules out instantly, §6a bracket variation respected for numeric options — **and set `rewriteCorrectAnswer` to the correct value's index in that new array.** Task 9 refuses the whole run if a rewrite omits it, because the index moves even though the value does not.

- [ ] **Step 2: Sanity-check that collection before continuing**

Count the reason codes in the finished file. If `NO_CHANGE` is over 95%, the pass is not being applied; if promotions to easy exceed 40%, the rubric is being over-applied. The Queens pilot's 13% promotion rate is the reference point — a wildly different rate on the first collection is a signal to re-read §4 before spending the pass on the other 42.

- [ ] **Step 3: Work through the remaining collections**

Same procedure, one file at a time. Commit every few collections so the work is never far from a checkpoint:

```bash
git add .planning/difficulty-audit/
git commit -m "chore(content): difficulty review — <slugs>"
```

- [ ] **Step 4: Verify every record is judged**

Expected: no record anywhere has a null `reason`. Check with:

```bash
cd "/c/Project Test" && node -e "
const fs=require('fs'),d='.planning/difficulty-audit';
let open=0,total=0;
for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.json'))){
  const j=JSON.parse(fs.readFileSync(d+'/'+f,'utf8'));
  for(const q of j.questions){total++;if(!q.reason)open++;}
}
console.log('total',total,'unjudged',open);
"
```
Expected: `unjudged 0`.

- [ ] **Step 5: Report the yield**

Print the reason-code totals across all files. This is success criterion 5 — it puts the cost of the full read on the record against the Queens pilot's 13%.

---

### Task 9: Apply the relabel

**Files:**
- Create: `backend/src/scripts/difficulty-audit/apply-relabel.ts`
- Database: `trivia.questions.difficulty`, `trivia.questions.options`

**Interfaces:**
- Consumes: the filled files from Task 8
- Produces: a relabelled bank for Task 10 to measure

- [ ] **Step 1: Write the failing check first**

The script must refuse to run when a record names an `external_id` that is not an active question — Review Focus item 5. Add a deliberate bad record to a scratch copy of one file:

```json
{ "externalId": "does-not-exist-999", "newDifficulty": "easy", "reason": "ELEM_CIVICS" }
```

- [ ] **Step 2: Write the script**

Create `backend/src/scripts/difficulty-audit/apply-relabel.ts`:

```typescript
/**
 * Apply Difficulty Relabel
 *
 * Reads .planning/difficulty-audit/<slug>.json and applies newDifficulty and any
 * rewriteOptions to the database.
 *
 * Refuses to write anything unless EVERY record resolves to an active question.
 * A record naming an external_id that no longer exists means the export is stale —
 * most likely because the duplicate purge archived it — and applying the rest would
 * silently skip rows while reporting success.
 *
 * Usage:
 *   npx tsx src/scripts/difficulty-audit/apply-relabel.ts --dry-run
 *   npx tsx src/scripts/difficulty-audit/apply-relabel.ts --apply
 */

import '../../env.js';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), '../.planning/difficulty-audit');
const VALID = ['easy', 'medium', 'hard'];

interface Record {
  externalId: string;
  oldDifficulty: string;
  newDifficulty: string | null;
  reason: string | null;
  rewriteOptions: string[] | null;
  rewriteCorrectAnswer: number | null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));
  const records: Record[] = [];

  for (const f of files) {
    const parsed = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    records.push(...parsed.questions);
  }

  // Guard 1: every record judged
  const unjudged = records.filter(r => !r.reason || !r.newDifficulty);
  if (unjudged.length > 0) {
    console.error(`REFUSING: ${unjudged.length} records have no reason or newDifficulty.`);
    console.error(unjudged.slice(0, 10).map(r => r.externalId).join(', '));
    process.exit(1);
  }

  // Guard 2: difficulties are valid
  const bad = records.filter(r => !VALID.includes(r.newDifficulty!));
  if (bad.length > 0) {
    console.error(`REFUSING: invalid difficulty on ${bad.length} records.`);
    process.exit(1);
  }

  // Guard 3: every external_id resolves to an ACTIVE question
  const ids = records.map(r => r.externalId);
  const found = await db.execute(sql`
    SELECT external_id FROM trivia.questions
    WHERE status = 'active' AND external_id = ANY(${ids})
  `);
  const live = new Set((found.rows as unknown as { external_id: string }[]).map(r => r.external_id));
  const missing = ids.filter(id => !live.has(id));
  if (missing.length > 0) {
    console.error(`REFUSING: ${missing.length} records name questions that are not active.`);
    console.error(`The export is stale — re-run the export after the duplicate purge.`);
    console.error(missing.slice(0, 20).join(', '));
    process.exit(1);
  }

  // Guard 4: a rewrite must say where the correct value landed
  const rewrites = records.filter(r => r.rewriteOptions && r.rewriteOptions.length === 4);
  const indexless = rewrites.filter(
    r => typeof r.rewriteCorrectAnswer !== 'number' ||
         r.rewriteCorrectAnswer < 0 ||
         r.rewriteCorrectAnswer > 3
  );
  if (indexless.length > 0) {
    console.error(`REFUSING: ${indexless.length} option rewrites have no valid rewriteCorrectAnswer.`);
    console.error(`A rewrite moves the correct value's index; without it a distractor becomes the answer.`);
    console.error(indexless.slice(0, 10).map(r => r.externalId).join(', '));
    process.exit(1);
  }

  const changed = records.filter(r => r.newDifficulty !== r.oldDifficulty);
  console.log(`${records.length} records; ${changed.length} difficulty changes; ${rewrites.length} option rewrites.`);

  if (!apply) {
    console.log('Dry run — nothing written. Pass --apply to write.');
    process.exit(0);
  }

  for (const r of changed) {
    await db.execute(sql`
      UPDATE trivia.questions
      SET difficulty = ${r.newDifficulty}, updated_at = now()
      WHERE external_id = ${r.externalId} AND status = 'active'
    `);
  }

  for (const r of rewrites) {
    await db.execute(sql`
      UPDATE trivia.questions
      SET options = ${JSON.stringify(r.rewriteOptions)}::jsonb,
          correct_answer = ${r.rewriteCorrectAnswer},
          updated_at = now()
      WHERE external_id = ${r.externalId} AND status = 'active'
    `);
  }

  console.log(`Applied ${changed.length} relabels and ${rewrites.length} rewrites.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

`options` and `correct_answer` are written in the **same** UPDATE. Writing the array first and the index second would leave a window in which the question served a distractor as its answer.

- [ ] **Step 3: Run against the scratch file with the bad record**

Run: `npx tsx src/scripts/difficulty-audit/apply-relabel.ts --dry-run`
Expected: exits 1 with `REFUSING: 1 records name questions that are not active.`

- [ ] **Step 4: Remove the bad record and dry-run for real**

Run: `npx tsx src/scripts/difficulty-audit/apply-relabel.ts --dry-run`
Expected: prints the counts, writes nothing, exits 0.

- [ ] **Step 5: Apply**

Run: `npx tsx src/scripts/difficulty-audit/apply-relabel.ts --apply`

If it hangs after connecting, apply the same UPDATEs through Supabase MCP in batches instead.

- [ ] **Step 6: Verify answer integrity survived the rewrites**

```sql
select external_id, options, correct_answer, options->>correct_answer as answer
from trivia.questions
where status='active' and (correct_answer is null
   or correct_answer < 0
   or correct_answer >= jsonb_array_length(options)
   or options->>correct_answer is null);
```
Expected: **zero rows**.

- [ ] **Step 7: Commit**

```bash
git add backend/src/scripts/difficulty-audit/apply-relabel.ts
git commit -m "$(cat <<'EOF'
feat(content): apply the difficulty relabel from the review artifacts

Refuses to write unless every record resolves to an active question — a stale
export after the duplicate purge would otherwise update zero rows and report
success.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Backfill easy questions to the 25% floor

**Files:**
- Database: new rows in `trivia.questions` and `trivia.collection_questions`

**Interfaces:**
- Consumes: the relabelled bank from Task 9
- Produces: every active collection at or above 25% easy

- [ ] **Step 1: Compute the gap after relabelling**

The backfill list is computed **after** the relabel, not from the pre-relabel figures:

```sql
select c.slug, c.tier,
  count(*) filter (where q.status='active') as total,
  count(*) filter (where q.status='active' and q.difficulty='easy') as easy,
  round(100.0*count(*) filter (where q.status='active' and q.difficulty='easy')
        / nullif(count(*) filter (where q.status='active'),0), 1) as easy_pct,
  greatest(0, ceil((0.25*count(*) filter (where q.status='active')
        - count(*) filter (where q.status='active' and q.difficulty='easy')) / 0.75))::int as need
from trivia.collections c
join trivia.collection_questions cq on cq.collection_id = c.id
join trivia.questions q on q.id = cq.question_id
where c.is_active
group by 1,2
having round(100.0*count(*) filter (where q.status='active' and q.difficulty='easy')
        / nullif(count(*) filter (where q.status='active'),0), 1) < 25.0
order by easy_pct;
```

The `need` column uses `(0.25*total - easy)/0.75`, not `0.25*total - easy` — adding questions raises the denominator too.

- [ ] **Step 2: Write the questions**

For each collection, write `need` new easy questions. The productive seams, in order:

1. **Orientation and geography** — which county, which bordering states, which river, which ocean. Almost always missing and easy by the rubric.
2. **The single most recognisable landmark, employer or institution.**
3. **The headline executive**, now permitted — but only one question per officeholder per collection, and only if the collection does not already have one.
4. **State-scale natural features** for state collections.

Constraints that bind here: max one question per officeholder per collection; no addresses or phone numbers in options; state collections stay state-scale; every question needs a source and an explanation of at least 30 characters; §6a governs any numeric options.

- [ ] **Step 3: Insert, with `placeAnswer()` on the insert path**

Every question-insert path must call `placeAnswer()`. Use the existing content-generation seeding utilities rather than raw INSERTs, or call `placeAnswer()` explicitly before writing.

Then link them — the **guarded** form, never the bare `LIKE '<prefix>-%'`, which cross-links on shared prefixes (`ind` matches both Indiana and Indio CA):

```sql
INSERT INTO trivia.collection_questions (collection_id, question_id, created_at)
SELECT <id>, q.id, NOW() FROM trivia.questions q
WHERE q.external_id LIKE '<prefix>-%' AND q.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM trivia.collection_questions cq WHERE cq.question_id = q.id);
```

- [ ] **Step 4: Verify the floor is met everywhere**

Re-run Step 1's query. Expected: **zero rows**.

- [ ] **Step 5: Verify the backfill introduced no duplicates**

Re-run Task 4 Step 1's query. Expected: **zero rows**. New questions written against an existing bank are exactly where a fresh duplicate would appear.

- [ ] **Step 6: Verify answer placement**

Run: `cd "/c/Project Test/backend" && npm run verify:answer-placement`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
content: backfill easy questions to the 25% floor

Sized with (0.25*total - easy)/0.75 — adding questions raises the
denominator too, so the naive subtraction undershoots.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Refresh STATE.md and open PR 1

**Files:**
- Modify: `.planning/STATE.md`

- [ ] **Step 1: Correct the stale figures**

`.planning/STATE.md` says 42 collections / 41 active and that Climate Agreements "holds 91 active questions". Replace with the live figures, re-queried at this point rather than copied from this plan:

```sql
select
 (select count(*) from trivia.collections) as total,
 (select count(*) from trivia.collections where is_active) as active,
 (select count(*) from trivia.questions where status='active') as questions_active,
 (select count(*) from trivia.questions q join trivia.collection_questions cq on cq.question_id=q.id
  where cq.collection_id=267 and q.status='active') as climate_agreements_active;
```

Note in the same bullet that `world-news` and `climate-change` are now `is_active = true`, having been created inactive on 2026-09-20.

- [ ] **Step 2: Final verification sweep**

Run all four and confirm each:

1. Task 4 Step 1 query → zero rows (no same-answer duplicates)
2. Task 10 Step 1 query → zero rows (every collection at or above 25% easy)
3. `npm run audit-anachronism` → `flagged 0`
4. `npx tsc --noEmit` in `backend/` → clean

- [ ] **Step 3: Commit and open the PR**

```bash
git add .planning/STATE.md
git commit -m "$(cat <<'EOF'
docs(state): refresh collection and question counts

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feat/collection-quality-audit
gh pr create --base master --title "fix(content): collection quality audit — duplicates, difficulty, anachronistic years" --body "Implements docs/superpowers/specs/2026-09-26-collection-quality-audit-design.md.

Nothing under frontend/, so this creates no Render deploy. The database changes are already live — they were applied directly via SQL and production reads the same database.

- Archived same-answer duplicate questions, including Cambridge's eight-question voting-system cluster
- Rewrote the difficulty rubric: headline-executive exception, term lengths, founding years, sourced elementary-civics test, and the distractor rule
- Relabelled every active question against it and backfilled easy questions to the 25% floor
- Vendored the anachronism rule from ev-accounts and cleaned the existing bank

Follow-up, not in this PR: wiring the rules engine into pipelineCron in ev-accounts. Until that lands the nightly pipeline still generates unguarded.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 4: Merge once both checks are green**

Never use the admin bypass. Wait for "Backend build (tsc)" and "Frontend build (tsc + vite)".

---

## Not in this plan

**PR 2b — ev-accounts pipeline wiring** is spec §4.4 and needs its own plan: port §6a and the revised rubric into the ev-accounts prompts, wire the rules engine into `scripts/international/question-generator.ts` behind a flag, and re-measure the numeric-distractor distribution after a week of nightly runs. **Until it lands, the nightly cron still generates unguarded**, which is the accepted consequence of D5.

# Numeric Answer Scales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store numeric questions as a 7-mark ascending scale with the correct answer at mark 4, and roll a 4-mark window at serve time, so the answer's position varies per session while the options still read in ascending order.

**Architecture:** A numeric question gets a new `options_scale` column holding 7 ascending values, answer centred at index 3 (mark 4). At session creation the server rolls `s ∈ {1,2,3,4}` and materialises the window `marks[s-1 .. s+2]`; the answer's index in that window is `4 - s`, so the roll maps bijectively onto positions D/C/B/A. Prose questions get their options shuffled at the same seam. Everything downstream already reads `session.questions`, so nothing else changes.

**Tech Stack:** TypeScript, Vitest (ev-accounts only), Drizzle ORM, Postgres (Supabase), Anthropic SDK

**Spec:** none written. This plan is self-contained; the design was settled with Chris on 2026-09-30 and the rationale is recorded under "Why this shape" below.

---

## Why this shape

Two separate exploits had two separate, partial defences:

| Exploit | Measured | Old defence |
|---|---|---|
| Answer sits at a predictable **position** | A at 100% in five collections (2026-09-08 survey) | `placeAnswer` permute/sort at write time |
| Answer sits at a predictable **value rank** | third-of-four 54%, 96% in one collection | `quality-guidelines` §6a, advisory prose |

A centred scale collapses both into one mechanism. The answer's rank *within the window* is `4 - s`, so a uniform roll makes value rank uniform **by construction** — §6a stops being advice the model may ignore and becomes arithmetic.

It also removes the only thing that made positions client-derivable. Position was `FNV-1a(externalId) mod 4`, and `questionService.ts:106` serves `id: row.externalId` while `stripAnswers()` removes only `correctAnswer` — so the position was computable client-side. Rolling per session defeats that, and unlike a secret-seeded hash it also defeats a crowdsourced `id -> position` lookup table, because no static answer exists to tabulate.

**Measured 2026-09-30, do not re-derive:**

- Across all **3,265 active** questions the answer sits at `FNV-1a(external_id) mod 4` **25.2%** of the time — chance. Prose 24.3%, numeric 28.8%. The live bank is **not** exploitable today; the exposure is forward-looking.
- Active split is **2,587 prose / 678 numeric** (79% / 21%), by `magnitudeValues()`.
- Newly seeded collections already sit at **76% on-target** (akron-oh 45/59, ohio 44/58), because the permute branch hits its target every time.

**Ruled out, do not re-investigate:**

- **A secret-seeded (HMAC) target.** Stops the twenty-line FNV-1a attack but leaves the position static per question forever, and external IDs are served — so a lookup table built by replaying questions defeats it. Only per-session variation is structurally sound.
- **Shuffling numeric options at serve time.** Fixes position but displays `10, 40, 20, 30`. Ascending order is deliberate (`answerPlacement.ts` sorts for exactly this reason) and is not being traded away.
- **Scales shorter or longer than 7.** A window of 4 over `n` marks gives `n-3` placements; `n=7` with the answer centred is the smallest scale reaching all four positions, and every roll is valid. Nothing is gained by more marks.

---

## Global Constraints

- **Bounded series are excluded.** `isBoundedSeries()` (whole numbers, `min ≤ 2`, `max ≤ 12`) already refuses to sort term-lengths and small counts, because a 4-year mayoral term cannot support `1..7 years` — 5-, 6- and 7-year terms do not exist. A bounded series must never get a scale; it keeps permute + serve-time shuffle. Reuse the existing predicate; do not invent a new boundary.
- **`options` stays a 4-element array.** It is `jsonb ... notNull`, documented "Array of 4 strings", and five runtime sites assert exactly 4: `qualityRules/rules/structural.ts:88`, `questionQuality/answerPlacement.ts:156` and `:230`, `generation/CurrentTermQuestionGenerator.ts:217`, `generation/ElectionQuestionGenerator.ts:455`. The scale goes in a **new nullable column**. A question without a scale keeps today's behaviour exactly.
- **Two repos.** `answerPlacement.ts` is vendored: canonical at `C:\ev-accounts\backend\src\trivia\services\questionQuality\answerPlacement.ts`, copy at `C:\Project Test\backend\src\services\questionQuality\answerPlacement.ts`. Keep byte-identical and prove with `cmp`. `externalIdentity.ts` is vendored the same way into `C:\ev-accounts\backend\src\trivia\utils\` — it sits at a different depth there, so never add an import to it that cannot be carried across.
- **Tests live ONLY in ev-accounts.** `C:\Project Test` has no test runner; its stand-in is `backend/src/scripts/verify-answer-placement.ts`, which runs in the `Backend build (tsc)` CI job. If you change placement behaviour, update that script too — the last branch left it red.
- **Test command:** `cd /c/ev-accounts/backend && npm run test:unit`. Never plain `npm test` — red on master with ~25 unrelated flaky failures. Expect a baseline of **6 failed suites / 4 failed tests** (missing `libsodium-wrappers`, one Windows path assertion) and **2 pre-existing `tsc` errors** in `src/lib/idVaultCrypto.ts`. Confirm your run matches rather than assuming; `npm run test:unit` cannot exit 0 in this repo.
- **Redis budget is a hard design constraint.** Upstash free tier is 500,000 commands/month. `getAndRefresh` uses `GETEX` for one command per read — do not regress it to `get()` + `set()`. Rolling at serve time adds **no** commands and **no** payload growth: the session already stores full `Question` objects including `options` and `correctAnswer`.
- **`C:\Project Test\backend\` runtime is FROZEN** (ev-cto decision 0013). `backend/src/scripts/**` and `backend/src/services/questionQuality/**` are live content tooling; `backend/src/cron/**` is the frozen twin — do not change behaviour there, including via shared prompt builders.
- **Migration numbering:** ev-accounts uses `backend/migrations/CC_<NNNN>_<name>.sql`, highest currently `CC_0184`. `npm run check:migrations` and `npm run check:reservations` enforce numbering.
- **Never modify an existing `external_id`.**
- **Every change goes through a PR.** `master` has a ruleset requiring two build checks and an admin bypass that works — do not use the bypass, and never rename a CI job.

## Review Focus

Conditions no happy-path test will exercise. Each is pinned to a task.

1. **A scale that is not strictly ascending, or whose answer is not at index 3.** A malformed scale must degrade to the stored `options`, never serve a window with the answer missing — which would make every answer wrong. Pinned to Task 2.
2. **Classic mode serves the same array it stores.** `game.ts` passes `selectedQuestions` to `createSession()` and then serves `stripAnswers(selectedQuestions)`. If the roll produces a copy, the client gets unshuffled options while the session scores against rolled ones, and every answer scores wrong. Pinned to Task 3.
3. **Adaptive mode appends questions after session creation** (`game.ts:336`, `session.questions.push(nextQ)`). A roll applied only in `createSession` silently leaves adaptive on the old behaviour. Pinned to Task 3.
4. **Fixed-position options must not move.** `hasFixedPositionOption()` guards "All of the above"; a blind shuffle moves it out of last place. Pinned to Task 3.
5. **Duplicate or equal marks in a scale.** Two equal values make the window ambiguous and can mean the displayed answer is not unique. Pinned to Task 2.

---

### Task 1: Add the `options_scale` column

**Files:**
- Create: `C:\ev-accounts\backend\migrations\CC_0185_question_options_scale.sql`
- Modify: `C:\ev-accounts\backend\src\trivia\db\schema.ts:186` (beside `options`)

**Interfaces:**
- Produces: `questions.optionsScale` — `jsonb`, nullable, `string[] | null`, 7 ascending values with the answer at index 3.

- [ ] **Step 1: Write the migration**

```sql
-- CC_0185_question_options_scale.sql
--
-- A numeric question may store a 7-mark ascending scale with its correct answer
-- centred at index 3. At serve time the server rolls s in 1..4 and shows the window
-- marks[s-1 .. s+2]; the answer's index in that window is 4-s, so the roll maps onto
-- positions D/C/B/A uniformly while the options still read ascending.
--
-- Nullable on purpose: `options` remains the 4-element source of truth and a question
-- without a scale behaves exactly as before. This column never replaces `options`.
ALTER TABLE trivia.questions
  ADD COLUMN IF NOT EXISTS options_scale jsonb;

COMMENT ON COLUMN trivia.questions.options_scale IS
  '7 ascending numeric option values, correct answer at index 3. NULL = no scale; serve `options` as stored.';
```

- [ ] **Step 2: Apply it and confirm the column exists**

Run: apply via the Supabase MCP (`apply_migration`) against project `kxsdzaojfaibhuzmclfq`, then:

```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema='trivia' AND table_name='questions' AND column_name='options_scale';
```
Expected: one row, `jsonb`, `YES`.

- [ ] **Step 3: Add it to the Drizzle schema**

In `schema.ts`, directly below the `options` line:

```ts
  options: jsonb('options').$type<string[]>().notNull(), // Array of 4 strings
  // 7 ascending marks, correct answer at index 3. NULL for prose and for any numeric
  // question predating scales. See CC_0185 and rollWindow() in answerScale.ts.
  optionsScale: jsonb('options_scale').$type<string[] | null>(),
```

- [ ] **Step 4: Typecheck**

Run: `cd /c/ev-accounts/backend && npx tsc --noEmit`
Expected: only the 2 pre-existing `idVaultCrypto.ts` errors named in Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/CC_0185_question_options_scale.sql backend/src/trivia/db/schema.ts
git commit -m "feat(trivia): add questions.options_scale for 7-mark numeric scales"
```

---

### Task 2: `answerScale.ts` — validate a scale and roll a window

**Files:**
- Create: `C:\ev-accounts\backend\src\trivia\services\questionQuality\answerScale.ts`
- Test: `C:\ev-accounts\backend\src\trivia\services\questionQuality\answerScale.test.ts`
- Modify: `C:\ev-accounts\backend\src\trivia\services\questionQuality\answerPlacement.ts:129` (export `isBoundedSeries`)
- Modify: `C:\Project Test\backend\src\services\questionQuality\answerPlacement.ts` (re-vendor — must stay byte-identical)

**Interfaces:**
- Consumes: `magnitudeValues` and `isBoundedSeries` from `./answerPlacement.js`. `isBoundedSeries` is currently **not exported** — export it as part of this task.
- Produces:
  - `isValidScale(scale: string[] | null | undefined): boolean`
  - `rollWindow(scale: string[], roll: number): { options: string[]; correctAnswer: number }`
  - `SCALE_LENGTH = 7`, `SCALE_ANSWER_INDEX = 3`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { isValidScale, rollWindow, SCALE_LENGTH, SCALE_ANSWER_INDEX } from './answerScale.js';

describe('isValidScale — what the server is willing to roll against', () => {
  const good = ['7', '9', '11', '13', '15', '17', '19'];

  it('accepts a strictly ascending 7-mark scale', () => {
    expect(isValidScale(good)).toBe(true);
  });

  it('rejects a scale of the wrong length', () => {
    expect(isValidScale(['7', '9', '11', '13', '15', '17'])).toBe(false);
  });

  it('rejects null and undefined — these are the common case, not an error', () => {
    expect(isValidScale(null)).toBe(false);
    expect(isValidScale(undefined)).toBe(false);
  });

  it('rejects a scale that is not ascending', () => {
    expect(isValidScale(['7', '9', '13', '11', '15', '17', '19'])).toBe(false);
  });

  it('rejects equal adjacent marks — a tie makes the shown answer non-unique', () => {
    expect(isValidScale(['7', '9', '11', '11', '15', '17', '19'])).toBe(false);
  });

  it('rejects a scale whose marks are not all parseable magnitudes', () => {
    expect(isValidScale(['7', '9', '11', 'thirteen', '15', '17', '19'])).toBe(false);
  });

  it('rejects mixed units — "$500 million" against "$3 billion" cannot be compared', () => {
    expect(isValidScale(['$1 million', '$2 million', '$3 million', '$4 million',
                         '$5 million', '$6 million', '$3 billion'])).toBe(false);
  });
});

describe('rollWindow — the roll maps bijectively onto A/B/C/D', () => {
  const scale = ['7', '9', '11', '13', '15', '17', '19']; // answer is '13', index 3

  it('places the answer at D when the roll is 1', () => {
    const r = rollWindow(scale, 1);
    expect(r.options).toEqual(['7', '9', '11', '13']);
    expect(r.correctAnswer).toBe(3);
    expect(r.options[r.correctAnswer]).toBe('13');
  });

  it('places the answer at A when the roll is 4', () => {
    const r = rollWindow(scale, 4);
    expect(r.options).toEqual(['13', '15', '17', '19']);
    expect(r.correctAnswer).toBe(0);
    expect(r.options[r.correctAnswer]).toBe('13');
  });

  it('covers every position exactly once across the four rolls', () => {
    const seen = [1, 2, 3, 4].map((s) => rollWindow(scale, s).correctAnswer);
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('always includes the correct answer, and always ascending', () => {
    for (const s of [1, 2, 3, 4]) {
      const r = rollWindow(scale, s);
      expect(r.options).toHaveLength(4);
      expect(r.options[r.correctAnswer]).toBe(scale[SCALE_ANSWER_INDEX]);
      const nums = r.options.map(Number);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    }
  });

  it('throws on a roll outside 1..4 rather than serving a window without the answer', () => {
    expect(() => rollWindow(scale, 0)).toThrow();
    expect(() => rollWindow(scale, 5)).toThrow();
  });

  it('exposes the shape it assumes', () => {
    expect(SCALE_LENGTH).toBe(7);
    expect(SCALE_ANSWER_INDEX).toBe(3);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/services/questionQuality/answerScale.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement**

```ts
import { magnitudeValues } from './answerPlacement.js';

/** Marks in a scale. A window of 4 over n marks gives n-3 placements; 7 is the
 *  smallest n that reaches all four positions, and every roll 1..4 is valid. */
export const SCALE_LENGTH = 7;

/** Where the correct answer sits in a scale. Centred, so all four rolls include it. */
export const SCALE_ANSWER_INDEX = 3;

/**
 * Whether a stored scale is safe to roll against.
 *
 * Deliberately strict and silent: NULL is the common case (prose questions, and every
 * numeric question written before scales existed), not an error. Anything that fails
 * here falls back to the stored `options`, so a bad scale degrades to current
 * behaviour instead of serving a window the answer might not be in.
 */
export function isValidScale(scale: string[] | null | undefined): boolean {
  if (!Array.isArray(scale) || scale.length !== SCALE_LENGTH) return false;
  // magnitudeValues enforces one unit and no prose dates, but is 4-length by contract,
  // so check the scale in overlapping 4-windows -- which is exactly what will be served.
  for (let i = 0; i + 4 <= SCALE_LENGTH; i++) {
    if (!magnitudeValues(scale.slice(i, i + 4))) return false;
  }
  const values = scale.map((s) => magnitudeValues([s, s, s, s])![0]);
  for (let i = 1; i < values.length; i++) {
    if (!(values[i] > values[i - 1])) return false; // strict: a tie is not orderable
  }
  return true;
}

/**
 * The 4 marks shown for a given roll, and where the answer lands among them.
 *
 * roll s shows marks[s-1 .. s+2]; the answer is at SCALE_ANSWER_INDEX, so its index in
 * the window is SCALE_ANSWER_INDEX - (s-1) = 4 - s. s=1 -> D, s=4 -> A.
 *
 * Throws outside 1..4 rather than returning a window without the answer in it: a
 * window missing its answer scores every player wrong, which is worse than a 500.
 */
export function rollWindow(
  scale: string[],
  roll: number
): { options: string[]; correctAnswer: number } {
  if (!Number.isInteger(roll) || roll < 1 || roll > 4) {
    throw new Error(`roll must be an integer 1..4, got ${roll}`);
  }
  const start = roll - 1;
  return {
    options: scale.slice(start, start + 4),
    correctAnswer: SCALE_ANSWER_INDEX - start,
  };
}
```

Also export `isBoundedSeries` from `answerPlacement.ts` (change `function isBoundedSeries` to `export function isBoundedSeries`) — Task 4 needs it in the CTC copy and it is currently private.

- [ ] **Step 4: Run them and watch them pass**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/services/questionQuality/answerScale.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Re-vendor `answerPlacement.ts` and prove it**

Exporting `isBoundedSeries` changed a vendored file. Carry it across in the same task — Task 4 imports it from the CTC copy and will not compile until this is done.

```bash
cp /c/ev-accounts/backend/src/trivia/services/questionQuality/answerPlacement.ts \
   "/c/Project Test/backend/src/services/questionQuality/answerPlacement.ts"
cmp /c/ev-accounts/backend/src/trivia/services/questionQuality/answerPlacement.ts \
    "/c/Project Test/backend/src/services/questionQuality/answerPlacement.ts" && echo IDENTICAL
cd "/c/Project Test/backend" && npx tsc --noEmit && npx tsx src/scripts/verify-answer-placement.ts
```
Expected: `IDENTICAL`, `tsc` exit 0, harness `47/47` exit 0.

- [ ] **Step 6: Run the full suite**

Run: `cd /c/ev-accounts/backend && npm run test:unit`
Expected: failure set identical to the baseline in Global Constraints. Diff it; do not eyeball it.

- [ ] **Step 7: Commit both repos**

```bash
# ev-accounts
git add backend/src/trivia/services/questionQuality/answerScale.ts \
        backend/src/trivia/services/questionQuality/answerScale.test.ts \
        backend/src/trivia/services/questionQuality/answerPlacement.ts
git commit -m "feat(trivia): answerScale — validate 7-mark scales and roll a 4-mark window"

# CTC (vendored copy only)
git -C "/c/Project Test" add backend/src/services/questionQuality/answerPlacement.ts
git -C "/c/Project Test" commit -m "chore(content): re-vendor answerPlacement with isBoundedSeries exported"
```

---

### Task 3: Roll at session creation, and shuffle prose at the same seam

**Files:**
- Create: `C:\ev-accounts\backend\src\trivia\services\servePresentation.ts`
- Test: `C:\ev-accounts\backend\src\trivia\services\servePresentation.test.ts`
- Modify: `C:\ev-accounts\backend\src\trivia\services\sessionService.ts:15-33` (`Question`), `:134-161` (`createSession`)
- Modify: `C:\ev-accounts\backend\src\trivia\routes\game.ts:336` (adaptive push)
- Modify: `C:\ev-accounts\backend\src\trivia\services\questionService.ts:275-290` and `:384-399` (selects), `:101-115` (`transformDBQuestions`)

**Interfaces:**
- Consumes: `isValidScale`, `rollWindow` from Task 2; `hasFixedPositionOption` from `answerPlacement.js`.
- Produces: `presentQuestion(q: Question, rng?: () => number): Question` — returns a question with `options` and `correctAnswer` as the player will see them. `Question` gains `optionsScale?: string[] | null`.

**Why one function for both cases:** prose and numeric differ only in *how* the order is chosen. Doing both here means there is exactly one place a question can enter a session without being presented.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { presentQuestion } from './servePresentation.js';
import type { Question } from './sessionService.js';

const base: Question = {
  id: 'akron-oh_0002', text: 'How many members?', options: ['9', '11', '13', '15'],
  correctAnswer: 2, explanation: '', difficulty: 'easy', topic: 't', topicCategory: 'c',
};

/** Deterministic rng for tests: always returns `v`. */
const rng = (v: number) => () => v;

describe('presentQuestion — numeric with a scale', () => {
  const scaled: Question = {
    ...base,
    options: ['9', '11', '13', '15'],
    correctAnswer: 2,
    optionsScale: ['7', '9', '11', '13', '15', '17', '19'],
  };

  it('serves a window from the scale, answer included, ascending', () => {
    const r = presentQuestion(scaled, rng(0)); // roll 1
    expect(r.options).toEqual(['7', '9', '11', '13']);
    expect(r.options[r.correctAnswer]).toBe('13');
  });

  it('reaches position A on the top roll', () => {
    const r = presentQuestion(scaled, rng(0.99)); // roll 4
    expect(r.correctAnswer).toBe(0);
    expect(r.options[r.correctAnswer]).toBe('13');
  });

  it('never loses the answer across many rolls', () => {
    for (let i = 0; i < 200; i++) {
      const r = presentQuestion(scaled, Math.random);
      expect(r.options[r.correctAnswer]).toBe('13');
      expect(r.options).toHaveLength(4);
    }
  });

  it('falls back to stored options when the scale is malformed', () => {
    const bad = { ...scaled, optionsScale: ['7', '9', '11'] };
    const r = presentQuestion(bad, rng(0));
    expect(r.options).toEqual(['9', '11', '13', '15']);
    expect(r.correctAnswer).toBe(2);
  });
});

describe('presentQuestion — prose', () => {
  const prose: Question = {
    ...base, options: ['Alpha', 'Beta', 'Gamma', 'Delta'], correctAnswer: 1, optionsScale: null,
  };

  it('keeps the answer attached to its own text after shuffling', () => {
    for (let i = 0; i < 200; i++) {
      const r = presentQuestion(prose, Math.random);
      expect(r.options[r.correctAnswer]).toBe('Beta');
      expect([...r.options].sort()).toEqual([...prose.options].sort());
    }
  });

  it('actually varies position across sessions', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(presentQuestion(prose, Math.random).correctAnswer);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('leaves a fixed-position option set untouched', () => {
    const fixed: Question = {
      ...base, options: ['10', '20', '30', 'All of the above'], correctAnswer: 3, optionsScale: null,
    };
    const r = presentQuestion(fixed, rng(0.99));
    expect(r.options).toEqual(['10', '20', '30', 'All of the above']);
    expect(r.correctAnswer).toBe(3);
  });

  it('does not mutate its input', () => {
    const input = { ...prose, options: [...prose.options] };
    presentQuestion(input, rng(0.5));
    expect(input.options).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(input.correctAnswer).toBe(1);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/services/servePresentation.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `presentQuestion`**

```ts
import type { Question } from './sessionService.js';
import { isValidScale, rollWindow } from './questionQuality/answerScale.js';
import { hasFixedPositionOption } from './questionQuality/answerPlacement.js';

/**
 * A question as the player will see it this session.
 *
 * Position is chosen HERE, per session, rather than being baked into the row. That is
 * the whole point: the stored position was a pure function of `externalId`, and the API
 * serves `externalId` as the question `id` (questionService transformDBQuestions) while
 * stripAnswers() removes only `correctAnswer`. Anything static is therefore derivable,
 * or tabulatable by replay. A per-session roll is not.
 *
 * Numeric questions with a scale get a 4-mark window, so they still read ascending.
 * Everything else is shuffled. Fixed-position option sets are left alone.
 *
 * Returns a new object; never mutates the input.
 */
export function presentQuestion(q: Question, rng: () => number = Math.random): Question {
  if (hasFixedPositionOption(q.options)) return { ...q };

  if (isValidScale(q.optionsScale)) {
    const roll = 1 + Math.floor(rng() * 4);
    const { options, correctAnswer } = rollWindow(q.optionsScale!, Math.min(roll, 4));
    return { ...q, options, correctAnswer };
  }

  // Fisher-Yates over indices, so the answer is tracked by position and duplicate
  // option text cannot retarget it.
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return {
    ...q,
    options: idx.map((i) => q.options[i]),
    correctAnswer: idx.indexOf(q.correctAnswer),
  };
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/services/servePresentation.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `optionsScale` to the type and both selects**

In `sessionService.ts`, add to `Question` after `correctAnswer`:

```ts
  /** 7 ascending marks with the answer at index 3, or null. Rolled at serve time. */
  optionsScale?: string[] | null;
```

In `questionService.ts`, add `optionsScale: questions.optionsScale,` to **both** `.select({...})` blocks (around `:279` and `:388`), and carry it in `transformDBQuestions` beside `options`:

```ts
      options: row.options,
      optionsScale: row.optionsScale ?? null,
```

Add the same field to `DBQuestionRow` in `gameModes.ts`.

- [ ] **Step 6: Apply the roll where questions enter a session**

In `sessionService.ts` `createSession`, present every question **in place**, because `game.ts` serves the same array it passes in:

```ts
    // Present in place: the route serves stripAnswers(questions) on this same array, so
    // a copy here would ship unrolled options while the session scores against rolled
    // ones -- every answer would score wrong. See Review Focus 2.
    for (let i = 0; i < questions.length; i++) questions[i] = presentQuestion(questions[i]);
```

immediately before the `const session: GameSession = {` literal.

In `game.ts:336`, the adaptive append — this is a second entry point and is easy to miss (Review Focus 3):

```ts
          const presented = presentQuestion(nextQ);
          session.questions.push(presented);
          session.adaptiveState.usedQuestionIds.push(nextRow.id);
          recordPlayedQuestions(session.userId, [presented.id]);
          nextQuestionStripped = stripAnswer(presented);
```

- [ ] **Step 7: Prove both entry points are covered**

Add to `servePresentation.test.ts`:

```ts
import { readFileSync } from 'node:fs';

describe('every path that puts a question in a session presents it first', () => {
  it('createSession presents', () => {
    const src = readFileSync('src/trivia/services/sessionService.ts', 'utf8');
    expect(src).toMatch(/presentQuestion\(/);
  });

  it('the adaptive append presents — this is the entry point that gets forgotten', () => {
    const src = readFileSync('src/trivia/routes/game.ts', 'utf8');
    const push = src.slice(src.indexOf('session.questions.push('));
    expect(src).toMatch(/const presented = presentQuestion\(nextQ\)/);
    expect(push.slice(0, 40)).toContain('presented');
  });
});
```

- [ ] **Step 8: Run the full suite**

Run: `cd /c/ev-accounts/backend && npm run test:unit`
Expected: failure set identical to baseline. Any *new* failure in `sessionService` or game-route tests is real — those tests assert stored positions that are now rolled, and each needs reading before it is changed.

- [ ] **Step 9: Commit**

```bash
git add backend/src/trivia/services/servePresentation.ts \
        backend/src/trivia/services/servePresentation.test.ts \
        backend/src/trivia/services/sessionService.ts \
        backend/src/trivia/services/questionService.ts \
        backend/src/trivia/services/gameModes.ts \
        backend/src/trivia/routes/game.ts
git commit -m "feat(trivia): choose answer position per session, not per row"
```

---

### Task 4: Generate scales

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\content-generation\question-schema.ts` (add `optionsScale`)
- Modify: `C:\Project Test\backend\src\scripts\content-generation\prompts\quality-guidelines.ts` (§6a)
- Modify: `C:\Project Test\backend\src\scripts\content-generation\utils\seed-questions.ts` (persist + tally)

**Interfaces:**
- Consumes: nothing from Tasks 1-3 at runtime — this repo writes rows, ev-accounts reads them. The column name `options_scale` is the only contract.
- Produces: rows with `options_scale` populated for unbounded numeric questions.

- [ ] **Step 1: Accept a scale in the question schema**

In `question-schema.ts`, add to `QuestionSchema`:

```ts
  /** 7 ascending marks, correct answer at index 3. Optional: prose and bounded
   *  series have none, and a numeric question that cannot support six plausible
   *  marks is expected to omit it rather than invent values. */
  optionsScale: z.array(z.string()).length(7).optional(),
```

- [ ] **Step 2: Replace §6a with the scale rule**

In `quality-guidelines.ts`, the `buildQualityGuidelines(answerPositionAssigned)` branch for numeric distractors becomes — note this **supersedes** the per-ID answer-position table for numerics; that machinery now applies to prose only:

```
### 6a. Numeric options — give a 7-mark scale

For a question whose four options are numbers, quantities, years or percentages,
supply `optionsScale`: SEVEN values in ascending order, with the correct answer
as the FOURTH (index 3), three plausible values below it and three above.

  "How many members does the council have?" answer 13
    optionsScale: ["7","9","11","13","15","17","19"]

The player is shown four consecutive marks from this scale, so:

- Every one of the seven must be independently plausible. A mark that is absurd
  on its own gives the answer away whenever it is shown.
- Space them evenly. One conspicuously round value among irregular ones is a tell.
- One unit throughout. Never mix "$500 million" with "$3 billion".
- Strictly ascending. No repeats.

OMIT `optionsScale` when the quantity cannot support six plausible neighbours —
term lengths, small fixed counts, anything where values outside a narrow range do
not exist in the real world. A four-year term has no plausible 6- or 7-year
neighbour. Omitting is correct and expected; inventing impossible marks is not.
```

- [ ] **Step 3: Persist and report it**

In `seed-questions.ts`, add `optionsScale` to the inserted record, guarded so a bounded series never stores one:

```ts
import { magnitudeValues, isBoundedSeries } from '../../../services/questionQuality/answerPlacement.js';

// A bounded series must never carry a scale -- its neighbours do not exist in the
// world (a 4-year term has no 6-year neighbour), so a scale here would serve
// implausible marks. Mirrors the rule that keeps these out of the sorted path.
const vals = magnitudeValues(question.options);
const scaleAllowed = Boolean(vals) && !isBoundedSeries(vals!);
const optionsScale = scaleAllowed && question.optionsScale?.length === 7
  ? question.optionsScale
  : null;
```

and tally alongside the existing placement line:

```ts
console.log(`  Answer scales: ${withScale} of ${numericTotal} numeric questions`);
```

- [ ] **Step 4: Typecheck and run the CTC placement harness**

Run: `cd "/c/Project Test/backend" && npx tsc --noEmit && npx tsx src/scripts/verify-answer-placement.ts`
Expected: `tsc` clean (exit 0), harness `47/47`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/content-generation/
git commit -m "feat(content): generate 7-mark scales for unbounded numeric questions"
```

---

### Task 5: Make the audit measure the right thing

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\audit-collection-readiness.ts` (the "Answer position" block)

**Interfaces:**
- Consumes: the `options_scale` column from Task 1.

**Why:** the existing check reads stored `correct_answer`. For a scaled question that number is no longer what the player sees — the roll decides. Left alone, the gate measures a field that has stopped meaning anything, and a collection could pass while serving badly.

- [ ] **Step 1: Split the measurement**

Exclude scaled questions from the stored-position histogram — their position is uniform by construction — and report scale coverage instead:

```ts
    // Scaled questions are excluded from this histogram on purpose: their position is
    // rolled per session, so stored correct_answer is a default nobody is served. For
    // them the thing worth measuring is COVERAGE -- a numeric question without a scale
    // is one whose position is still static.
    const scaled = optionRows.filter((r) => isValidScale(r.optionsScale as string[] | null));
    const unscaled = optionRows.filter((r) => !isValidScale(r.optionsScale as string[] | null));
```

Run the existing A/B/C/D bands over `unscaled` only, and add:

```ts
    if (numericTotal > 0) {
      const pctScaled = (100 * scaledNumeric) / numericTotal;
      console.log(`\n  Answer Scales:`);
      console.log(`    Numeric questions with a 7-mark scale: ${scaledNumeric}/${numericTotal} (${pctScaled.toFixed(1)}%)`);
      if (pctScaled < 80) {
        console.warn(`  NOTE: ${(100 - pctScaled).toFixed(1)}% of numeric questions have no scale, so their`);
        console.warn(`  answer position is static. Expected while the bank is being migrated.`);
      }
    }
```

- [ ] **Step 2: Run it against both pilots and read the output**

```bash
cd "/c/Project Test/backend" && npx tsx src/scripts/audit-collection-readiness.ts --slug akron-oh
```

**Database note:** CTC's own `DATABASE_URL` (role `ctc_app`) is dead — `XX000 ECIRCUITBREAKER`. Run with ev-accounts' `DATABASE_URL` (role `ev_api`) injected; both `.env` files target the same Supabase project.

Expected: the existing DEFECT still fires on the unscaled population (akron-oh was 42.4% C), and `Answer Scales` reports `0/23` until Task 6 runs.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/audit-collection-readiness.ts
git commit -m "feat(audit): measure scale coverage; exclude rolled questions from the position histogram"
```

---

### Task 6: Validate on one collection before spending on the bank

**Files:** none — this task produces a measurement and a ruling.

**This is the gate.** The engineering above is arithmetic and will work. What is unproven is whether the model can write **six** plausible marks instead of three. Do not start Task 7 until this passes.

- [ ] **Step 1: Generate one collection with scales**

Pick an unstarted Knight city. Expect roughly $3 at current per-collection cost.

- [ ] **Step 2: Measure against the pass criteria**

```sql
SELECT count(*) FILTER (WHERE options_scale IS NOT NULL) AS scaled,
       count(*) AS numeric_total
FROM trivia.questions
WHERE split_part(external_id,'_',1) = '<slug>'
  AND jsonb_array_length(options) = 4;
```

Pass criteria, all four:

1. **Coverage** — ≥70% of unbounded numeric questions carry a scale. Below that the model is failing to build them and the scheme does not pay for itself.
2. **Plausibility** — read all 7 marks of 15 scales by hand. Zero marks that are absurd on their own. This is the criterion that matters; the others are mechanical.
3. **No tell** — no scale where one mark is conspicuously rounder or differently shaped than its neighbours.
4. **Roll uniformity** — simulate 1,000 rolls per scaled question; every position inside 22–28%.

- [ ] **Step 3: Ledger the ruling**

Record pass or fail with the numbers. On fail, the likely fix is prompt wording on plausibility, not a design change — re-run Step 1 once before concluding the scheme does not work.

---

### Task 7: Regenerative patch for the existing bank

**Files:**
- Create: `C:\Project Test\backend\src\scripts\content-generation\backfill-answer-scales.ts`

**Do not start until Task 6 passes.**

**Interfaces:**
- Consumes: `magnitudeValues`, `isBoundedSeries` from `answerPlacement.js`; the generation client from the existing scripts.

**Why this is cheaper than it sounds:** the question text and the correct answer are already verified and are **kept**. Only the distractors are rebuilt, and distractor plausibility is magnitude realism, not fact — nothing needs to know Akron's real council size to know 7/9/11/15/17/19 are plausible council sizes, because the question text carries the quantity. So this prompt sends **no source corpus**, and writes no new questions, which means no `duplicate-text` retry storm. It is the cheapest generation shape available.

- [ ] **Step 1: Select the candidates**

```sql
SELECT external_id, text, options, correct_answer
FROM trivia.questions
WHERE options_scale IS NULL AND status IN ('active','draft')
ORDER BY external_id;
```
Filter in TypeScript with `magnitudeValues(options) && !isBoundedSeries(values)` — do not try to express that in SQL; the unit and prose-date rules live in the function.

- [ ] **Step 2: Build scales around the known answer**

Prompt per question: the question text, the verified correct answer, and the §6a scale rule from Task 4. Require the answer to appear verbatim at index 3. Reject and retry any response failing `isValidScale`, or whose index 3 is not the original answer — **never** accept a scale that moves the correct value.

- [ ] **Step 3: Write with a guard**

```sql
UPDATE trivia.questions
SET options_scale = $1::jsonb, updated_at = NOW()
WHERE external_id = $2 AND options_scale IS NULL;
```

`options` and `correct_answer` are **not** touched — a scaled question's served window comes from the scale, and leaving `options` intact keeps the fallback correct if a scale is ever found invalid.

- [ ] **Step 4: Verify a sample by hand, then re-audit**

Read all 7 marks of 20 backfilled questions. Then re-run `audit-collection-readiness.ts` across the touched collections and confirm `Answer Scales` coverage rose and no DEFECT appeared.

- [ ] **Step 5: Commit, and open one PR per repo, cross-linked**

---

## Context a fresh session needs

- **The open PRs this supersedes in part.** CTC #193 and ev-accounts #849 aim numeric answers at a per-ID hash target (`targetPosition`, the batch prompt's position table, `sorted-off-target`). Under this plan that machinery applies to **prose only**; numerics are decided by the serve-time roll. Merging those PRs first is deliberate — they fix a measured 61%-on-C bias now, and stripping the numeric half would restore it while this plan is built.
- **Knight batch 2 must not run before this lands.** 33 collections generated under the current scheme would bake static positions into thousands of new numerics and grow Task 7's tail from 678 to several times that.
- **`_` is a LIKE wildcard.** Scope by `split_part(external_id,'_',1) = '<slug>'`, never `LIKE '<slug>_%'` — `ind-%` matches both Indiana and Indio CA.
- **Open items this plan does not cover:** the `ctc_app` role needs restoring (handover doc in `docs/ops/`); `ohio_0151/0152/0153` are drafts with no `collection_questions` row, so the auditor cannot see them; `trivia.topics` id 489 is named "Oregon State Government" but serves Oregon, Ohio and Mississippi.

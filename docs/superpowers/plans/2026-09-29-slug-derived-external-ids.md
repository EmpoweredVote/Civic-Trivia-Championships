# Slug-Derived External IDs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new collections mint external IDs as `<collection-slug>_<NNNN>` so that adding a collection never requires inventing, reserving or checking a prefix.

**Architecture:** One shared helper (`externalIdentity.ts`) is the single source of truth for minting and parsing external IDs. It is vendored into two repos because CTC's `backend/` is frozen and the canonical engine lives in ev-accounts. Every existing ID is left untouched; the two schemes coexist permanently and are told apart by the presence of `_`, which no existing ID and no slug contains.

**Tech Stack:** TypeScript, Drizzle ORM, Zod, Postgres (Supabase), Vitest (ev-accounts only)

**Spec:** `docs/superpowers/specs/2026-09-29-slug-external-ids-and-knight-collections-design.md`

## Global Constraints

- **Forward-only.** No existing `external_id` value may be modified. All 8,389 rows stay as they are.
- **Two repos.** `C:\Project Test\backend\` is FROZEN (ev-cto decision 0013, `backend/FROZEN.md`, PR #85). Engine changes go to `C:\ev-accounts\backend\src\trivia\`. Content/collection scripts stay in `C:\Project Test`.
- **Tests live only beside the ev-accounts copy.** `C:\Project Test` has zero `.test.ts` files and no `test` script. This follows the `nested-options` vendoring precedent.
- **Test command:** `cd /c/ev-accounts/backend && npm run test:unit`. Never `npm test` — it is red on master with ~25 flaky integration failures.
- **ID format:** `<slug>_<NNNN>`, four zero-padded digits, underscore separator.
- **Validator regexes**, verbatim:
  - new: `/^[a-z][a-z0-9-]*_\d{4,}$/`
  - legacy: `/^[a-z]{2,5}-\d{3,4}$/`
- **Every PR goes through the gate.** `master` has a ruleset requiring two build checks and an admin bypass that works. Do not use the bypass. Never rename CI job names.
- **Vendored files must be byte-identical** between repos except for import paths.
- **No attribution boilerplate.** Explanations must not open "According to …" — ruled bank-wide 2026-09-29, 1,978 → 0. Attribution belongs in `source.url`. Task 2 removes the validator refine that currently *requires* it.

## Review Focus

Five conditions the spec implies that no task's happy path exercises. Each has a test pinned to the task that owns the code.

1. **A collection whose slug contains a digit** — `SUBSTRING(external_id FROM '[0-9]+')` unanchored returns the slug's digits, not the sequence, silently minting a duplicate. Pinned to Task 1.
2. **Sequence rollover past 9,999** — `pad4` must not silently truncate; a 5-digit sequence should widen, not corrupt. Pinned to Task 1.
3. **A legacy ID passed to `collectionKeyOf`** — must return the legacy prefix, not the whole string, or the display sites in Task 5 print garbage for 44 collections. Pinned to Task 1.
4. **An `elc-term-<raceId>-<seq>` ID hitting the widened validator** — it matches neither regex and already exists in the bank; the validator must not start rejecting rows it previously accepted. Pinned to Task 2.
5. **A brand-new collection with zero questions** — `MAX(...)` returns null and the first mint must be `_0001`, not `_0000` or a crash. Pinned to Task 4.

---

## File Structure

**ev-accounts** (`C:\ev-accounts\backend\src\trivia\`) — canonical, tested:
- Create: `utils/externalIdentity.ts` — mint/parse/classify. No DB access, no imports beyond none. Pure functions so it is testable without a database.
- Create: `utils/externalIdentity.test.ts` — the only tests in this plan.
- Modify: `scripts/content-generation/question-schema.ts:12`
- Modify: `cron/replacementGenerator.ts:153,237,381,395`

**CTC** (`C:\Project Test\backend\src\`) — vendored copy, untested:
- Create: `scripts/content-generation/externalIdentity.ts` — byte-identical twin
- Modify: `scripts/content-generation/question-schema.ts:12`
- Modify: `scripts/content-generation/generate-locale-questions.ts:386,498,628,635`
- Modify: `scripts/content-generation/generate-replacements.ts:219`
- Modify: `scripts/international/question-generator.ts:238`
- Modify: `scripts/activate-collection.ts:178,184`
- Modify: `scripts/audit-collection-readiness.ts:194,200`
- Modify: `scripts/scaffold-collection.ts`

Task order matters: Task 1 creates the helper both halves depend on. Tasks 3–7 are independent of each other and depend only on Tasks 1–2.

---

### Task 1: The `externalIdentity` helper

**Files:**
- Create: `C:\ev-accounts\backend\src\trivia\utils\externalIdentity.ts`
- Test: `C:\ev-accounts\backend\src\trivia\utils\externalIdentity.test.ts`
- Create: `C:\Project Test\backend\src\scripts\content-generation\externalIdentity.ts` (copy)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `mintExternalId(slug: string, seq: number): string`
  - `collectionKeyOf(externalId: string): string`
  - `isLegacyExternalId(externalId: string): boolean`
  - `NEW_EXTERNAL_ID_RE: RegExp`
  - `LEGACY_EXTERNAL_ID_RE: RegExp`

- [ ] **Step 1: Write the failing test**

Create `C:\ev-accounts\backend\src\trivia\utils\externalIdentity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  mintExternalId,
  collectionKeyOf,
  isLegacyExternalId,
  NEW_EXTERNAL_ID_RE,
  LEGACY_EXTERNAL_ID_RE,
} from './externalIdentity.js';

describe('mintExternalId', () => {
  it('pads the sequence to four digits', () => {
    expect(mintExternalId('akron-oh', 1)).toBe('akron-oh_0001');
    expect(mintExternalId('akron-oh', 42)).toBe('akron-oh_0042');
    expect(mintExternalId('akron-oh', 9999)).toBe('akron-oh_9999');
  });

  // Review Focus 2: rollover must widen, never truncate.
  it('widens past four digits rather than truncating', () => {
    expect(mintExternalId('akron-oh', 10000)).toBe('akron-oh_10000');
  });

  it('rejects a slug containing an underscore', () => {
    expect(() => mintExternalId('akron_oh', 1)).toThrow(/underscore/i);
  });

  it('rejects a non-positive sequence', () => {
    expect(() => mintExternalId('akron-oh', 0)).toThrow(/positive/i);
  });
});

describe('collectionKeyOf', () => {
  it('returns the slug for a new-scheme id', () => {
    expect(collectionKeyOf('akron-oh_0001')).toBe('akron-oh');
    expect(collectionKeyOf('bainbridge-island-wa_0107')).toBe('bainbridge-island-wa');
  });

  // Review Focus 3: legacy ids must still yield their prefix.
  it('returns the prefix for a legacy id', () => {
    expect(collectionKeyOf('ins-049')).toBe('ins');
    expect(collectionKeyOf('pla-172')).toBe('pla');
    expect(collectionKeyOf('wiran-1761')).toBe('wiran');
  });

  it('returns the whole string for an id with no separator', () => {
    expect(collectionKeyOf('q001')).toBe('q001');
  });

  // Review Focus 1: a slug containing digits must not confuse the split.
  it('handles a slug containing digits', () => {
    expect(collectionKeyOf('route-66-ca_0001')).toBe('route-66-ca');
  });
});

describe('isLegacyExternalId', () => {
  it('classifies both schemes', () => {
    expect(isLegacyExternalId('ins-049')).toBe(true);
    expect(isLegacyExternalId('q001')).toBe(true);
    expect(isLegacyExternalId('akron-oh_0001')).toBe(false);
  });
});

describe('regexes', () => {
  it('NEW matches slug ids only', () => {
    expect(NEW_EXTERNAL_ID_RE.test('akron-oh_0001')).toBe(true);
    expect(NEW_EXTERNAL_ID_RE.test('route-66-ca_0001')).toBe(true);
    expect(NEW_EXTERNAL_ID_RE.test('ins-049')).toBe(false);
  });

  it('LEGACY matches three- and four-digit prefix ids', () => {
    expect(LEGACY_EXTERNAL_ID_RE.test('ins-049')).toBe(true);
    expect(LEGACY_EXTERNAL_ID_RE.test('wiran-1761')).toBe(true);
    expect(LEGACY_EXTERNAL_ID_RE.test('akron-oh_0001')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/utils/externalIdentity.test.ts`
Expected: FAIL — cannot resolve `./externalIdentity.js`

- [ ] **Step 3: Write minimal implementation**

Create `C:\ev-accounts\backend\src\trivia\utils\externalIdentity.ts`:

```ts
/**
 * Single source of truth for question external IDs.
 *
 * Two schemes coexist permanently:
 *   legacy  `<prefix>-<NNN|NNNN>`   e.g. ins-049, wiran-1761   (never rewritten)
 *   new     `<collection-slug>_<NNNN>`  e.g. akron-oh_0001
 *
 * They are told apart by '_'. Verified against the live database 2026-09-29:
 * zero collection slugs and zero existing external_ids contain an underscore,
 * so the discriminator is exact and permanent.
 *
 * VENDORED: a byte-identical copy lives at
 * `C:\Project Test\backend\src\scripts\content-generation\externalIdentity.ts`.
 * That repo has no test runner, so these tests are the only tests. Carry any
 * change across by hand.
 */

export const NEW_EXTERNAL_ID_RE = /^[a-z][a-z0-9-]*_\d{4,}$/;
export const LEGACY_EXTERNAL_ID_RE = /^[a-z]{2,5}-\d{3,4}$/;

/** Mint `<slug>_<NNNN>`. Widens past four digits rather than truncating. */
export function mintExternalId(slug: string, seq: number): string {
  if (slug.includes('_')) {
    throw new Error(
      `Collection slug "${slug}" contains an underscore, which is the external-id separator.`
    );
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`External-id sequence must be a positive integer, got ${seq}.`);
  }
  return `${slug}_${String(seq).padStart(4, '0')}`;
}

/**
 * The collection key an external ID belongs to: the slug for new IDs, the
 * prefix for legacy ones. Note a legacy prefix does NOT identify a collection
 * (`ind` is shared by Indiana and Indio CA) — this is for display and for
 * ID-space arithmetic, never for selecting a collection's questions.
 */
export function collectionKeyOf(externalId: string): string {
  if (externalId.includes('_')) return externalId.slice(0, externalId.lastIndexOf('_'));
  const dash = externalId.indexOf('-');
  return dash === -1 ? externalId : externalId.slice(0, dash);
}

export function isLegacyExternalId(externalId: string): boolean {
  return !externalId.includes('_');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/utils/externalIdentity.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Vendor the copy into CTC**

Copy the file to `C:\Project Test\backend\src\scripts\content-generation\externalIdentity.ts`, unchanged. It has no imports, so no path rewriting is needed.

Run: `cd "/c/Project Test" && diff <(sed 's/\r$//' backend/src/scripts/content-generation/externalIdentity.ts) <(sed 's/\r$//' /c/ev-accounts/backend/src/trivia/utils/externalIdentity.ts)`
Expected: no output

- [ ] **Step 6: Commit (both repos)**

```bash
cd /c/ev-accounts && git add backend/src/trivia/utils/externalIdentity.ts backend/src/trivia/utils/externalIdentity.test.ts && git commit -m "feat(trivia): externalIdentity helper for slug-derived question ids"
cd "/c/Project Test" && git add backend/src/scripts/content-generation/externalIdentity.ts && git commit -m "feat(content): vendor externalIdentity helper from ev-accounts"
```

---

### Task 2: Widen the question validator in both repos

**Files:**
- Modify: `C:\ev-accounts\backend\src\trivia\scripts\content-generation\question-schema.ts:8-14`
- Modify: `C:\Project Test\backend\src\scripts\content-generation\question-schema.ts:8-14`
- Test: `C:\ev-accounts\backend\src\trivia\utils\externalIdentity.test.ts` (append)

**Interfaces:**
- Consumes: `NEW_EXTERNAL_ID_RE`, `LEGACY_EXTERNAL_ID_RE` from Task 1.
- Produces: nothing new. `QuestionSchema` keeps its exported name and shape.

- [ ] **Step 1: Write the failing test**

Append to `externalIdentity.test.ts`:

```ts
import { QuestionSchema } from '../scripts/content-generation/question-schema.js';

const VALID_QUESTION = {
  externalId: 'akron-oh_0001',
  text: 'Who presides over Akron City Council meetings?',
  options: ['The mayor', 'The council president', 'The clerk', 'The city manager'],
  correctAnswer: 1,
  explanation:
    'Akron City Council elects a president from among its members, who presides over its meetings.',
  difficulty: 'medium',
  topicCategory: 'city-government',
  source: { name: 'City of Akron', url: 'https://www.akronohio.gov/' },
  expiresAt: null,
};

describe('QuestionSchema externalId', () => {
  it('accepts a slug-derived id', () => {
    expect(QuestionSchema.safeParse(VALID_QUESTION).success).toBe(true);
  });

  it('accepts legacy three- and four-digit ids', () => {
    for (const id of ['ins-049', 'pla-172', 'wiran-1761', 'climc-0092']) {
      const r = QuestionSchema.safeParse({ ...VALID_QUESTION, externalId: id });
      expect(r.success, `${id} should be accepted`).toBe(true);
    }
  });

  it('rejects a malformed id', () => {
    for (const id of ['AKRON-OH_0001', 'akron-oh_1', 'akron-oh-0001', '_0001']) {
      const r = QuestionSchema.safeParse({ ...VALID_QUESTION, externalId: id });
      expect(r.success, `${id} should be rejected`).toBe(false);
    }
  });
});

describe('QuestionSchema explanation', () => {
  // Chris ruled attribution boilerplate out bank-wide on 2026-09-29: 1,978
  // explanations opening "According to ..." were stripped to 0. The validator
  // still REQUIRED that phrase, so every newly generated question would have
  // reintroduced it. Attribution belongs in source.url.
  it('accepts an explanation with no "According to" boilerplate', () => {
    expect(QuestionSchema.safeParse(VALID_QUESTION).success).toBe(true);
  });

  it('still requires a source url', () => {
    const { source, ...withoutSource } = VALID_QUESTION;
    expect(QuestionSchema.safeParse(withoutSource).success).toBe(false);
  });
});
```

Note: if `QuestionSchema` has required fields beyond those in `VALID_QUESTION`, read the file and add them — the object must be otherwise-valid so the test isolates `externalId`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/utils/externalIdentity.test.ts`
Expected: FAIL — `akron-oh_0001` and `wiran-1761` rejected by `/^[a-z]{2,5}-\d{3}$/`

- [ ] **Step 3: Write minimal implementation**

In **both** `question-schema.ts` files, replace lines 8–14:

```ts
  // External ID: either scheme.
  //   new     <collection-slug>_<NNNN>   e.g. "akron-oh_0001"
  //   legacy  <prefix>-<NNN|NNNN>        e.g. "bli-001", "wiran-1761"
  // Widened from /^[a-z]{2,5}-\d{3}$/ on 2026-09-29: that pattern rejected
  // 3,501 rows the nightly news pipeline had already written.
  externalId: z
    .string()
    .refine(
      (v) => NEW_EXTERNAL_ID_RE.test(v) || LEGACY_EXTERNAL_ID_RE.test(v),
      'externalId must look like "akron-oh_0001" (new) or "bli-001" (legacy)'
    ),
```

In the same two files, delete the `.refine(...)` on `explanation` that requires the string
`'According to'` (around line 44). Leave the length bounds alone:

```ts
  // Explanation. Attribution lives in source.url, NOT in the prose — the
  // "According to ..." opener was stripped bank-wide on 2026-09-29 (1,978 -> 0),
  // and this refine would have made the generator write it straight back.
  explanation: z
    .string()
    .min(20, 'Explanation must be at least 20 characters')
    .max(500, 'Explanation must be at most 500 characters'),
```

Add the import at the top of each file. ev-accounts:

```ts
import { NEW_EXTERNAL_ID_RE, LEGACY_EXTERNAL_ID_RE } from '../../utils/externalIdentity.js';
```

CTC:

```ts
import { NEW_EXTERNAL_ID_RE, LEGACY_EXTERNAL_ID_RE } from './externalIdentity.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/ev-accounts/backend && npm run test:unit`
Expected: PASS. Use the full unit suite here, not just this file — the schema is imported by generation code and a regression would surface elsewhere.

- [ ] **Step 5: Verify the live bank against the new rule**

Run this against Supabase (project `kxsdzaojfaibhuzmclfq`):

```sql
SELECT external_id FROM trivia.questions
WHERE external_id !~ '^[a-z][a-z0-9-]*_[0-9]{4,}$'
  AND external_id !~ '^[a-z]{2,5}-[0-9]{3,4}$'
  AND external_id !~ '^q[0-9]{3}$'
LIMIT 50;
```

Expected: only `elc-term-*` rows, if any. **Review Focus 4** — those IDs predate this change and must not start failing. If anything else appears, the regex is wrong; stop and report rather than widening further.

- [ ] **Step 6: Commit (both repos)**

```bash
cd /c/ev-accounts && git add backend/src/trivia/scripts/content-generation/question-schema.ts backend/src/trivia/utils/externalIdentity.test.ts && git commit -m "fix(trivia): accept slug-derived and four-digit external ids

The old /^[a-z]{2,5}-\d{3}$/ rejected 3,501 rows the news pipeline had
already written — wiran runs to 1761."
cd "/c/Project Test" && git add backend/src/scripts/content-generation/question-schema.ts && git commit -m "fix(content): accept slug-derived and four-digit external ids"
```

---

### Task 3: Scope the two genuinely-unguarded generator queries by collection

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\content-generation\generate-locale-questions.ts:374-397` (semantic dedup)
- Modify: `C:\Project Test\backend\src\scripts\content-generation\generate-locale-questions.ts:490-505` (officeholder expiry)
- Modify: `C:\Project Test\backend\src\scripts\content-generation\generate-locale-questions.ts:628-639` (ID offset — **not** scoped by collection; see Step 4)
- Modify: `C:\Project Test\backend\src\scripts\content-generation\generate-locale-questions.ts:894` (call site)

**Interfaces:**
- Consumes: `mintExternalId`, `nextSequence`, `collectionKeyOf` from Task 1 — used only in Step 4. Steps 1–3 remove ID-based selection entirely.
- Produces:
  - `runWithinCollectionSemanticDedup(collectionSlug: string)` — signature changes, one argument dropped
  - `mintFor(config, seq: number): string` — file-local; the single place this file builds an external ID

**Ordering note:** this task uses `nextSequence`, which Task 4 Step 3 adds to the helper. Either
do Task 4 Step 3 first, or add `nextSequence` here and skip it there — it is the same function.

No test: CTC has no test runner. Verification is by dry-run and SQL, in Step 4.

- [ ] **Step 1: Change the semantic-dedup selector**

At line 374, change the signature and the query. Replace:

```ts
async function runWithinCollectionSemanticDedup(prefix: string, collectionSlug: string): Promise<void> {
```

with:

```ts
async function runWithinCollectionSemanticDedup(collectionSlug: string): Promise<void> {
```

Then replace the `prefixPattern` selection (around line 386–397):

```ts
  const { db } = await import('../../db/index.js');
  const { questions, collections, collectionQuestions } = await import('../../db/schema.js');
  const { sql, eq } = await import('drizzle-orm');

  // Scoped by collection, not by external-id prefix. A prefix does not identify
  // a collection: `ind` is shared by Indiana and Indio CA, and five collections
  // use more than one. Selecting by prefix here compared two collections'
  // questions against each other and flagged the loser as a near-duplicate of a
  // question in a different collection.
  const rows = await db
    .select({
      id: questions.id,
      externalId: questions.externalId,
      text: questions.text,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      qualityScore: questions.qualityScore,
    })
    .from(questions)
    .innerJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
    .innerJoin(collections, eq(collections.id, collectionQuestions.collectionId))
    .where(sql`${collections.slug} = ${collectionSlug} AND ${questions.status} IN ('draft', 'active')`);
```

- [ ] **Step 2: Update the call site**

At line 894, replace:

```ts
    await runWithinCollectionSemanticDedup(config.externalIdPrefix, config.collectionSlug);
```

with:

```ts
    await runWithinCollectionSemanticDedup(config.collectionSlug);
```

- [ ] **Step 3: Change the officeholder-expiry selector**

Around line 490–505, replace the `prefixPattern` block. The enclosing function receives `config`; it needs the collection slug, which is `config.collectionSlug`:

```ts
  const { db: dbSeeder } = await import('../../db/index.js');
  const { questions: questionsSeeder, collections: collectionsSeeder, collectionQuestions: cqSeeder } =
    await import('../../db/schema.js');
  const { sql: sqlSeeder, eq: eqSeeder } = await import('drizzle-orm');

  // Scoped by collection, not by external-id prefix — selecting by prefix here
  // stamped expiresAt on another collection's rows.
  const rows = await dbSeeder
    .select({
      id: questionsSeeder.id,
      externalId: questionsSeeder.externalId,
      text: questionsSeeder.text,
    })
    .from(questionsSeeder)
    .innerJoin(cqSeeder, eqSeeder(questionsSeeder.id, cqSeeder.questionId))
    .innerJoin(collectionsSeeder, eqSeeder(collectionsSeeder.id, cqSeeder.collectionId))
    .where(
      sqlSeeder`${collectionsSeeder.slug} = ${config.collectionSlug}
        AND ${questionsSeeder.status} IN ('draft', 'active')
        AND ${questionsSeeder.expiresAt} IS NULL`
    );
```

If the enclosing function does not have `config` in scope, thread `collectionSlug: string` in as a parameter and pass `config.collectionSlug` at its call site rather than reaching for a module-level value.

- [ ] **Step 4: Fix the ID-offset site — WITHOUT scoping it by collection**

At lines 628–639 the ID offset is computed with a bare `LIKE '<prefix>-%'` and **no** join to
`collection_questions`. That is deliberate and must stay. Replace the block:

```ts
  // Determine ID offset: start above the highest sequence already present in
  // this collection's ID NAMESPACE, including archived rows — external_id has a
  // UNIQUE constraint, so a reused number is an insert failure.
  //
  // DELIBERATELY NOT scoped by collection_id, unlike the dedup and expiry
  // queries above. External IDs must be unique per NAMESPACE, not per
  // collection. If two collections ever share one (Indiana and Indio CA both
  // use `ind`), scoping this by collection is exactly what would mint a
  // duplicate. This reads like the same bug as its neighbours and is not.
  let idOffset = 0;
  if (!args.dryRun && collectionId !== null) {
    const { db: dbForOffset } = await import('../../db/index.js');
    const { questions: questionsForOffset } = await import('../../db/schema.js');
    const { sql: sqlForOffset } = await import('drizzle-orm');
    const { nextSequence, collectionKeyOf } = await import('./externalIdentity.js');

    const namespace = config.externalIdPrefix ?? config.collectionSlug;
    const maxIdRows = await dbForOffset
      .select({ externalId: questionsForOffset.externalId })
      .from(questionsForOffset)
      .where(
        sqlForOffset`split_part(${questionsForOffset.externalId}, '_', 1) = ${namespace}
                     OR split_part(${questionsForOffset.externalId}, '-', 1) = ${namespace}`
      );

    if (maxIdRows.length > 0) {
      const maxNum = maxIdRows.reduce((max, row) => {
        const tail = row.externalId.slice(collectionKeyOf(row.externalId).length + 1);
        const num = parseInt(tail, 10);
        return Math.max(max, Number.isNaN(num) ? 0 : num);
      }, 0);
      idOffset = maxNum;
      console.log(`  ID offset: ${idOffset} (next is ${mintFor(config, nextSequence(idOffset))})`);
    }
  }
```

where `mintFor` is a two-line local helper placed just above:

```ts
function mintFor(config: { externalIdPrefix?: string; collectionSlug: string }, seq: number): string {
  return config.externalIdPrefix
    ? `${config.externalIdPrefix}-${String(seq).padStart(3, '0')}`
    : mintExternalId(config.collectionSlug, seq);
}
```

Use `mintFor` everywhere this file concatenates an external ID, so legacy collections keep
their three-digit shape and new ones get four. Import `mintExternalId` at the top.

`split_part` is used rather than `LIKE` because **`_` is a LIKE wildcard** — `LIKE 'akron-oh_%'`
would also match `akron-ohX0001`.

- [ ] **Step 5: Verify against a legacy collection with a shared prefix**

This is the regression that matters: Indiana and Indio CA share the `ind` prefix.

```bash
cd "/c/Project Test/backend" && npx tsc --noEmit
```
Expected: no errors.

Then confirm the new scoping returns one collection's rows, not two:

```sql
-- Before the change this pattern matched 51 rows across TWO collections.
SELECT c.slug, count(*)
FROM trivia.questions q
JOIN trivia.collection_questions cq ON cq.question_id = q.id
JOIN trivia.collections c ON c.id = cq.collection_id
WHERE q.external_id LIKE 'ind-%'
GROUP BY 1;
```
Expected: two rows (`indiana-state`, `indio-ca`) — which is the bug, and is what the collection-scoped query no longer does.

- [ ] **Step 6: Commit**

```bash
cd "/c/Project Test" && git add backend/src/scripts/content-generation/generate-locale-questions.ts && git commit -m "fix(content): scope dedup and expiry backfill by collection, not prefix

Activation was fixed on 2026-09-08; generation never was. Selecting by
LIKE '<prefix>-%' compared Indiana and Indio CA against each other and
could stamp expiresAt on the wrong collection's rows."
```

---

### Task 4: Drop the redundant prefix filter from the three ID-allocation sites

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\content-generation\generate-replacements.ts:208-226`
- Modify: `C:\Project Test\backend\src\scripts\international\question-generator.ts:228-242`
- Modify: `C:\ev-accounts\backend\src\trivia\cron\replacementGenerator.ts:381-400`
- Test: `C:\ev-accounts\backend\src\trivia\utils\externalIdentity.test.ts` (append)

**Interfaces:**
- Consumes: `mintExternalId` from Task 1.
- Produces: `getNextExternalId(collectionId: number): Promise<number>` — the `prefix` parameter is removed at all three sites.

These three already `innerJoin collectionQuestions` and filter on `collectionQuestions.collectionId`. The prefix `LIKE` is redundant narrowing on top of correct scoping. Under slug IDs it matches nothing, `MAX(...)` is null, `maxId` falls to 0, and the next mint collides with the existing `_0001`, violating `questions_external_id_key`.

- [ ] **Step 1: Write the failing test for the null case**

Append to `externalIdentity.test.ts`. This tests the arithmetic, not the query — extract it so it is testable without a database:

```ts
import { nextSequence } from './externalIdentity.js';

describe('nextSequence', () => {
  // Review Focus 5: a brand-new collection has no rows, so MAX() is null.
  it('starts at 1 when the collection is empty', () => {
    expect(nextSequence(null)).toBe(1);
    expect(nextSequence(undefined)).toBe(1);
  });

  it('continues from the highest existing sequence', () => {
    expect(nextSequence('673')).toBe(674);
    expect(nextSequence(673)).toBe(674);
  });

  it('treats an unparseable max as empty', () => {
    expect(nextSequence('not-a-number')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/utils/externalIdentity.test.ts`
Expected: FAIL — `nextSequence` is not exported

- [ ] **Step 3: Add `nextSequence` to the helper (both repos)**

Append to `externalIdentity.ts` in ev-accounts, then re-copy to CTC:

```ts
/**
 * Next sequence number from a `MAX(...)` result. Null/undefined means the
 * collection has no questions yet, so the first mint is 1 — not 0.
 */
export function nextSequence(maxId: string | number | null | undefined): number {
  if (maxId === null || maxId === undefined) return 1;
  const n = typeof maxId === 'number' ? maxId : parseInt(maxId, 10);
  return Number.isFinite(n) && n > 0 ? n + 1 : 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/utils/externalIdentity.test.ts`
Expected: PASS

- [ ] **Step 5: Fix `generate-replacements.ts`**

Replace the body of `getNextExternalId` (lines 208–226):

```ts
async function getNextExternalId(collectionId: number): Promise<number> {
  // Scoped by collectionId via the join. The prefix LIKE that used to sit here
  // was redundant — and under slug-derived ids it matched nothing, so MAX()
  // went null, the sequence reset to 1, and the mint collided with the
  // existing _0001 (questions_external_id_key).
  //
  // '[0-9]+$' is anchored deliberately: unanchored, it takes the FIRST digit
  // run, which is the slug's digits for a slug like `route-66-ca_0001`.
  const result = await db
    .select({
      maxId: sql<string>`MAX(SUBSTRING(${questionsTable.externalId} FROM '[0-9]+$')::int)`,
    })
    .from(questionsTable)
    .innerJoin(collectionQuestions, eq(questionsTable.id, collectionQuestions.questionId))
    .where(eq(collectionQuestions.collectionId, collectionId));

  return nextSequence(result[0]?.maxId);
}
```

Add the import: `import { nextSequence } from './externalIdentity.js';`

Update its call site at line ~635 to drop the second argument.

- [ ] **Step 6: Fix `international/question-generator.ts`**

At lines 228–242, delete the prefix condition and collapse the `and(...)`. This site already anchors with `'[0-9]+$'`, so leave that alone:

```ts
  const maxIdResult = await db
    .select({
      maxId: sql<string>`MAX(SUBSTRING(${questionsTable.externalId} FROM '[0-9]+$')::int)`,
    })
    .from(questionsTable)
    .innerJoin(collectionQuestions, eq(questionsTable.id, collectionQuestions.questionId))
    .where(eq(collectionQuestions.collectionId, collectionId));

  let nextIdNum = nextSequence(maxIdResult[0]?.maxId);
```

Add the import: `import { nextSequence } from '../content-generation/externalIdentity.js';`

Remove the now-unused `and` import if nothing else in the file uses it.

- [ ] **Step 7: Fix ev-accounts `replacementGenerator.ts`**

Replace `getNextExternalId` (lines 381–400) with the same shape, dropping the `prefix` parameter and anchoring the substring:

```ts
async function getNextExternalId(collectionId: number): Promise<number> {
  const { db } = await import('../db/index.js');
  const { questions, collectionQuestions } = await import('../db/schema.js');
  const { eq, sql } = await import('drizzle-orm');
  const { nextSequence } = await import('../utils/externalIdentity.js');

  // Scoped by collectionId via the join; the prefix LIKE that used to sit here
  // was redundant and broke under slug-derived ids. '[0-9]+$' is anchored so a
  // slug containing digits cannot be mistaken for the sequence.
  const result = await db
    .select({
      maxId: sql<string>`MAX(SUBSTRING(${questions.externalId} FROM '[0-9]+$')::int)`,
    })
    .from(questions)
    .innerJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
    .where(eq(collectionQuestions.collectionId, collectionId));

  return nextSequence(result[0]?.maxId);
}
```

Then fix the two mint sites. At lines 151–153 and ~237, replace the manual concatenation:

```ts
    const nextId = await getNextExternalId(collectionId);
    const externalId = config.externalIdPrefix
      ? config.externalIdPrefix + '-' + String(nextId).padStart(3, '0')
      : mintExternalId(config.collectionSlug, nextId);
```

Add `mintExternalId` to the dynamic import at the top of each site. A locale config with no `externalIdPrefix` is a new-scheme collection; one with a prefix is legacy and keeps minting its old shape.

- [ ] **Step 8: Verify both repos compile**

```bash
cd /c/ev-accounts/backend && npx tsc --noEmit && npm run test:unit
cd "/c/Project Test/backend" && npx tsc --noEmit
```
Expected: no errors; unit suite passes.

- [ ] **Step 9: Commit (both repos)**

```bash
cd /c/ev-accounts && git add backend/src/trivia/cron/replacementGenerator.ts backend/src/trivia/utils/ && git commit -m "fix(trivia): drop redundant prefix filter from id allocation

The join already scopes by collectionId. Under slug ids the LIKE matched
nothing, MAX() went null, the sequence reset to 1 and the mint collided
with the existing _0001. Also anchors the digit extraction to '[0-9]+\$'."
cd "/c/Project Test" && git add backend/src/scripts/ && git commit -m "fix(content): drop redundant prefix filter from id allocation"
```

---

### Task 5: The two display-only parse sites

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\activate-collection.ts:175-195`
- Modify: `C:\Project Test\backend\src\scripts\audit-collection-readiness.ts:190-205`

**Interfaces:**
- Consumes: nothing. The fix is SQL-side — it is a `GROUP BY` over the whole table, so it cannot use the TypeScript helper. Keep the SQL expression below and `collectionKeyOf` behaviourally identical; they are the same rule in two languages.
- Produces: nothing.

Both run `split_part(external_id, '-', 1)` in SQL to report which prefixes a collection spans. For `akron-oh_0001` that returns `akron`, which is wrong and would print a confusing advisory.

- [ ] **Step 1: Fix the SQL in `activate-collection.ts`**

At lines 178 and 184, replace `split_part(${questions.externalId}, '-', 1)` in both the select and the groupBy with a shape-aware expression:

```ts
        prefix: sql<string>`CASE WHEN strpos(${questions.externalId}, '_') > 0
                                 THEN left(${questions.externalId}, strpos(${questions.externalId}, '_') - 1)
                                 ELSE split_part(${questions.externalId}, '-', 1) END`,
```

Use the identical expression in the `.groupBy(...)` call — Postgres requires the grouped expression to match.

- [ ] **Step 2: Soften the advisory wording**

The surrounding text calls these "prefixes". For a slug collection the value is the slug. Change the log line at ~188 to:

```ts
      console.log(`Note: "${collection.name}" spans ${ownPrefixes.length} external-id namespaces: ${prefixList}.`);
```

- [ ] **Step 3: Apply the identical change to `audit-collection-readiness.ts`**

Lines 194 and 200, same `CASE` expression in both the select and the groupBy.

- [ ] **Step 4: Verify against a legacy multi-prefix collection**

```bash
cd "/c/Project Test/backend" && npx tsc --noEmit && npx tsx src/scripts/activate-collection.ts --slug bloomington-in --dry-run
```
Expected: reports three namespaces — `bli`, `bloom`, `elc` — exactly as before. **Review Focus 3**: a regression here shows up as `b` or the full ID instead of `bli`.

- [ ] **Step 5: Commit**

```bash
cd "/c/Project Test" && git add backend/src/scripts/activate-collection.ts backend/src/scripts/audit-collection-readiness.ts && git commit -m "fix(scripts): parse both id schemes in the namespace advisory"
```

---

### Task 6: Teach `scaffold-collection.ts` the new scheme

**Files:**
- Modify: `C:\Project Test\backend\src\scripts\scaffold-collection.ts:140-180` (arg parsing/validation)
- Modify: `C:\Project Test\backend\src\scripts\scaffold-collection.ts:325-335` (config emission)
- Modify: `C:\Project Test\backend\src\scripts\scaffold-collection.ts:480-545` (summary/next-steps output)

**Interfaces:**
- Consumes: nothing.
- Produces: generated locale configs that carry `collectionSlug` and **no** `externalIdPrefix`.

- [ ] **Step 1: Make `--prefix` optional and ignored**

In `validate()` (~line 169), remove `if (!args.prefix) errors.push('--prefix is required');`. Replace the regex check with a warning:

```ts
  if (args.prefix) {
    console.warn(
      `Warning: --prefix "${args.prefix}" is ignored. External IDs now derive from the ` +
      `collection slug (e.g. "${args.slug}_0001"). The flag is accepted for compatibility ` +
      `with /create-collection and the handbook, and will be dropped later.`
    );
  }
```

- [ ] **Step 2: Stop emitting `externalIdPrefix` into the generated config**

At line ~330, delete the `externalIdPrefix: '${args.prefix}',` line from the template. Confirm the template already emits `collectionSlug: '${args.slug}',` — if it does not, add it, because the generator reads `config.collectionSlug`.

- [ ] **Step 3: Update `--help` and the printed next steps**

In the help text (~line 145) remove the `--prefix` requirement line and add:

```
  --prefix <string>      DEPRECATED, ignored. External IDs derive from --slug.
```

At lines ~505 and ~543, drop `Prefix: ${prefix}` and remove `--prefix ${prefix}` from the suggested `activate-collection.ts` command.

- [ ] **Step 4: Verify with a throwaway scaffold**

```bash
cd "/c/Project Test/backend" && npx tsc --noEmit
```
Expected: no errors.

Do **not** run the scaffold against a real collection name here — Task 1 of the pilot plan does that for Akron. If you want a smoke test, run it with a name you then `git checkout --` away, and confirm the emitted config contains `collectionSlug` and no `externalIdPrefix`.

- [ ] **Step 5: Commit**

```bash
cd "/c/Project Test" && git add backend/src/scripts/scaffold-collection.ts && git commit -m "feat(scripts): derive external ids from slug; deprecate --prefix"
```

---

### Task 7: Open both pull requests

**Files:** none.

- [ ] **Step 1: Push the CTC branch and open its PR**

```bash
cd "/c/Project Test" && git push -u origin HEAD
gh pr create --title "feat(content): slug-derived external IDs" --body "Implements Part 1 of docs/superpowers/specs/2026-09-29-slug-external-ids-and-knight-collections-design.md (CTC half). Paired with the ev-accounts PR — neither works alone."
```

Both build checks must go green. **Do not use the admin bypass**, and do not rename any CI job.

- [ ] **Step 2: Push the ev-accounts branch and open its PR**

```bash
cd /c/ev-accounts && git push -u origin HEAD
gh pr create --title "feat(trivia): slug-derived external IDs" --body "Implements Part 1 of the CTC spec (engine half). The replacement cron mints IDs nightly for expiring officeholder questions, so the CTC-side change reaches nothing without this."
```

- [ ] **Step 3: Cross-link the two PRs**

Comment each PR's URL on the other. The fold vendored this code with no dependency link, so the only thing preventing drift is a human seeing both.

---

## Notes for the executor

- **`C:\Project Test\backend\` is frozen but you are editing it.** The freeze covers the *server runtime*. `backend/src/scripts/**` is content tooling and is explicitly still active in this repo per `FROZEN.md`. Do not touch routes, middleware, cron, or db schema here.
- **`backend/src/cron/replacementGenerator.ts` in CTC is the frozen twin.** Leave it. Its live counterpart is the ev-accounts file in Task 4.
- **Never run `npm ci` in `C:\Project Test\frontend`** — it wipes `node_modules` for every other session sharing the checkout. Nothing in this plan needs it.
- If a task's line numbers have drifted, search for the code shown rather than trusting the number.

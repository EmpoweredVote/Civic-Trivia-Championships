# Pipeline Routing and Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the nightly news pipeline ingest once and route each story to exactly one collection, and stop it re-authoring facts it has already covered.

**Architecture:** The pipeline currently loops over registered collections, re-fetching the same four RSS feeds inside the loop, so every collection generates independently from identical input. This plan inverts that loop: one ingest per night, one Claude call per story cluster that now also returns topic tags and a structured `(subject, attribute, value)` triple, then deterministic local code assigns a lane and rejects claims already covered. Deduplication happens at the *claim* layer, before a question is authored, with a `pg_trgm` similarity check as a paraphrase net. No external service and no embeddings.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Drizzle ORM, Postgres 15 with `pg_trgm` 1.6, vitest, Anthropic SDK with structured output.

**Spec:** `docs/superpowers/specs/2026-09-10-featured-collections-design.md` (§1, §2, §3)

## Global Constraints

- **All code in this plan lands in `C:\ev-accounts`, not `C:\Project Test`.** `backend/` in Project Test is FROZEN per ev-cto decision 0013; the canonical trivia backend is `ev-accounts/backend/src/trivia/`. This plan touches no files in Project Test.
- **ESM import specifiers end in `.js`** even for TypeScript sources (`from './lanes.js'`). This is the established pattern throughout `src/trivia/`.
- **DB imports are lazy** inside functions (`const { db } = await import('../../db/index.js')`), matching the existing pattern in `run-pipeline.ts:70`.
- **No OpenAI, no embeddings, no new runtime dependency.** Both dedup layers are local. `pg_trgm` 1.6 is already installed in project `kxsdzaojfaibhuzmclfq`, **in the `extensions` schema, which is not on `search_path`** — so every call must be written `extensions.similarity(...)`. Unqualified it fails at runtime with `42883`, and because it is raw SQL in a template string `tsc` cannot catch it.
- **Never scope question queries by external_id prefix.** Join through `trivia.collection_questions`. `LIKE 'ind-%'` matches questions across both Indiana and Indio CA — the documented collision footgun.
- **Never skip silently.** Every guard that rejects or bypasses writes a structured entry into `generation_jobs.notes`.
- **No schema migration tooling exists.** There is no `drizzle/` migrations directory; `src/trivia/db/schema.ts` is hand-maintained. DDL is applied via Supabase against project `kxsdzaojfaibhuzmclfq`, and `schema.ts` is updated to match in the same commit.
- **Test commands:** `npm test` (= `vitest run`) and `npm run test:unit` (= `vitest run src scripts`), run from `C:\ev-accounts\backend`.
- **Tests are colocated** beside their source (`foo.ts` → `foo.test.ts`), matching `src/trivia/services/questionQuality/answerPlacement.test.ts`.
- **Commit attribution:** every commit message ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File Structure

All paths relative to `C:\ev-accounts\backend/`.

**Create:**

| File | Responsibility |
|---|---|
| `src/trivia/scripts/international/lanes.ts` | The `Lane` type, precedence order, and `resolveLane()`. Pure. |
| `src/trivia/scripts/international/lanes.test.ts` | Precedence tests. |
| `src/trivia/scripts/international/claimFingerprint.ts` | Normalising a claim triple into `topicKey` + `valueKey`. Pure. |
| `src/trivia/scripts/international/claimFingerprint.test.ts` | Normalisation and collision tests, including the spec's regression fixtures. |
| `src/trivia/scripts/international/claimGuard.ts` | Duplicate/contradiction verdicts over an injected store. Pure logic, no DB. |
| `src/trivia/scripts/international/claimGuard.test.ts` | Verdict tests against an in-memory store. |
| `src/trivia/scripts/international/claimStore.ts` | Drizzle-backed `FingerprintStore` and the `pg_trgm` similarity probe. |
| `src/trivia/scripts/international/nearDuplicate.ts` | Threshold logic over an injected probe. Pure. |
| `src/trivia/scripts/international/nearDuplicate.test.ts` | Threshold boundary tests. |

**Modify:**

| File | Change |
|---|---|
| `src/trivia/db/schema.ts` | Add `claimFingerprints` table definition. |
| `src/trivia/scripts/international/rss-ingestor.ts:27` | Add two US-domestic feeds to `INTERNATIONAL_FEEDS`. |
| `src/trivia/scripts/international/claim-extractor.ts:163` | Extend `CLAIM_EXTRACTION_SCHEMA` and `ClaimResult` with `topics`, `subject`, `attribute`, `value`; extend the system prompt. |
| `src/trivia/scripts/international/run-pipeline.ts:56` | Replace the per-collection entry point with a single-ingest, multi-lane run. |
| `src/trivia/cron/pipelineCron.ts:27` | Replace the collection loop with a lane-to-collection map and one call. |

**Why these boundaries:** the four pure modules (`lanes`, `claimFingerprint`, `claimGuard`, `nearDuplicate`) hold every decision worth testing and none of the I/O, so they are unit-testable with no DB harness — which matters, because this repo has no DB test fixture infrastructure (only one test file exists, and it is pure). `claimStore.ts` is the single place that touches Postgres, and it is verified against production data read-only in Task 8.

---

### Task 1: Lane type and precedence resolver

Claude will return *which topics apply* to a story; deterministic local code decides the lane. That split is deliberate — recognition is what the model is good at, arbitration should be code you can test.

**Files:**
- Create: `src/trivia/scripts/international/lanes.ts`
- Test: `src/trivia/scripts/international/lanes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Lane = 'iran' | 'climate' | 'us' | 'world'`; `const LANE_PRECEDENCE: readonly Lane[]`; `function resolveLane(topics: readonly string[]): Lane`.

- [ ] **Step 1: Write the failing test**

Create `src/trivia/scripts/international/lanes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveLane, LANE_PRECEDENCE } from './lanes.js';

describe('resolveLane', () => {
  it('prefers iran over us for a US strike on Iran', () => {
    expect(resolveLane(['us', 'iran'])).toBe('iran');
  });

  it('prefers climate over us for a US emissions ruling', () => {
    expect(resolveLane(['us', 'climate'])).toBe('climate');
  });

  it('prefers iran over climate', () => {
    expect(resolveLane(['climate', 'iran'])).toBe('iran');
  });

  it('returns us for a US-domestic story', () => {
    expect(resolveLane(['us'])).toBe('us');
  });

  it('falls back to world when no topic matches', () => {
    expect(resolveLane([])).toBe('world');
  });

  it('ignores unrecognised topics', () => {
    expect(resolveLane(['sport', 'celebrity'])).toBe('world');
  });

  it('ignores unrecognised topics alongside a real one', () => {
    expect(resolveLane(['sport', 'iran'])).toBe('iran');
  });

  it('is order-independent', () => {
    expect(resolveLane(['world', 'us', 'iran'])).toBe(
      resolveLane(['iran', 'us', 'world']),
    );
  });

  it('declares precedence most-specific-first with world last', () => {
    expect(LANE_PRECEDENCE).toEqual(['iran', 'climate', 'us', 'world']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/scripts/international/lanes.test.ts`

Expected: FAIL — `Failed to resolve import "./lanes.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/trivia/scripts/international/lanes.ts`:

```ts
/**
 * Lane assignment for the nightly news pipeline.
 *
 * The claim extractor returns which topics apply to a story; this module
 * decides the single lane it lands in. Exactly one lane per story is what
 * makes it impossible for one fact to appear in two collections that sit
 * side by side on the Featured shelf.
 */

export type Lane = 'iran' | 'climate' | 'us' | 'world';

/** Most specific wins; `world` is the sink. */
export const LANE_PRECEDENCE: readonly Lane[] = ['iran', 'climate', 'us', 'world'] as const;

const KNOWN_LANES = new Set<string>(LANE_PRECEDENCE);

export function isLane(value: string): value is Lane {
  return KNOWN_LANES.has(value);
}

/**
 * Resolve a story's topic tags to exactly one lane.
 * Unrecognised tags are ignored; an empty or fully unrecognised list is `world`.
 */
export function resolveLane(topics: readonly string[]): Lane {
  const present = new Set(topics.filter(isLane));
  for (const lane of LANE_PRECEDENCE) {
    if (present.has(lane)) return lane;
  }
  return 'world';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/scripts/international/lanes.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/ev-accounts
git checkout -b feat/pipeline-routing-and-dedup
git add backend/src/trivia/scripts/international/lanes.ts backend/src/trivia/scripts/international/lanes.test.ts
git commit -m "feat(pipeline): add lane type and precedence resolver

Claude returns which topics apply to a story; this decides the lane.
Precedence is iran > climate > us > world, most-specific-wins with world
as the sink, so exactly one lane owns each story.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Claim fingerprinting

Two nights covering King Harald's death produce the same underlying claim. Normalise it hard enough that `89` and `89 years old` collide, and split the fingerprint into a **topic key** (who and what) and a **value key** (the answer) — because same-topic-different-value is not a duplicate, it is a contradiction, and it deserves a different verdict.

**Files:**
- Create: `src/trivia/scripts/international/claimFingerprint.ts`
- Test: `src/trivia/scripts/international/claimFingerprint.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface ClaimTriple { subject: string; attribute: string; value: string }`; `interface ClaimKeys { topicKey: string; valueKey: string }`; `function fingerprintClaim(triple: ClaimTriple): ClaimKeys`; `function normalizeValue(raw: string): string`.

- [ ] **Step 1: Write the failing test**

Create `src/trivia/scripts/international/claimFingerprint.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fingerprintClaim, normalizeValue } from './claimFingerprint.js';

describe('normalizeValue', () => {
  it('strips unit nouns so 89 and "89 years old" collide', () => {
    expect(normalizeValue('89 years old')).toBe(normalizeValue('89'));
  });

  it('strips thousands separators', () => {
    expect(normalizeValue('1,287 people')).toBe(normalizeValue('1287'));
  });

  it('strips approximation hedges', () => {
    expect(normalizeValue('approximately 5,000 people')).toBe(normalizeValue('over 5000'));
  });

  it('keeps distinct numbers distinct', () => {
    expect(normalizeValue('43.8%')).not.toBe(normalizeValue('44%'));
  });

  it('normalises date spelling but not date identity', () => {
    expect(normalizeValue('September 8, 2026')).toBe(normalizeValue('september 8 2026'));
    expect(normalizeValue('September 8, 2026')).not.toBe(normalizeValue('September 7, 2026'));
  });
});

describe('fingerprintClaim', () => {
  const harald = { subject: 'King Harald V', attribute: 'age at death' };

  it('collides on the same fact expressed two ways (wiran-1578 / wiran-1661)', () => {
    const a = fingerprintClaim({ ...harald, value: '89' });
    const b = fingerprintClaim({ ...harald, value: '89 years old' });
    expect(a.topicKey).toBe(b.topicKey);
    expect(a.valueKey).toBe(b.valueKey);
  });

  it('collides on the 35-year reign (wiran-1579 / wiran-1659)', () => {
    const a = fingerprintClaim({ subject: 'King Harald V', attribute: 'length of reign', value: '35 years' });
    const b = fingerprintClaim({ subject: 'king harald v', attribute: 'Length of Reign', value: '35 years' });
    expect(a).toEqual(b);
  });

  it('collides on the Canada tariff date (wiran-1615 / wiran-1635)', () => {
    const a = fingerprintClaim({
      subject: "Canada's retaliatory tariffs on US goods",
      attribute: 'date took effect',
      value: 'September 8, 2026',
    });
    const b = fingerprintClaim({
      subject: 'Canada retaliatory tariffs on US goods',
      attribute: 'date took effect',
      value: 'september 8 2026',
    });
    expect(a).toEqual(b);
  });

  it('shares a topic key but differs on value for a contradiction (Meta ads in India: 84 vs 78)', () => {
    const a = fingerprintClaim({ subject: 'Meta CSAM advertisements in India', attribute: 'count', value: '84 advertisements' });
    const b = fingerprintClaim({ subject: 'Meta CSAM advertisements in India', attribute: 'count', value: '78 advertisements' });
    expect(a.topicKey).toBe(b.topicKey);
    expect(a.valueKey).not.toBe(b.valueKey);
  });

  it('shares a topic key but differs on value for the AfD share (43.8% vs 44%)', () => {
    const a = fingerprintClaim({ subject: 'AfD Saxony-Anhalt 2026', attribute: 'vote share', value: '43.8%' });
    const b = fingerprintClaim({ subject: 'AfD Saxony-Anhalt 2026', attribute: 'vote share', value: '44%' });
    expect(a.topicKey).toBe(b.topicKey);
    expect(a.valueKey).not.toBe(b.valueKey);
  });

  it('does not collide unrelated stories that share an answer (wiran-1611 / wiran-1657, both "2026")', () => {
    const a = fingerprintClaim({ subject: 'Russia-North Korea Tumen River road bridge', attribute: 'year opened', value: '2026' });
    const b = fingerprintClaim({ subject: 'Uganda withdrawal from the Invictus Games', attribute: 'year announced', value: '2026' });
    expect(a.topicKey).not.toBe(b.topicKey);
  });

  it('does not collide unrelated stories dated the same day (wiran-1630 / wiran-1635)', () => {
    const a = fingerprintClaim({ subject: 'UK sanctions on Israeli settlements', attribute: 'date announced', value: 'September 8, 2026' });
    const b = fingerprintClaim({ subject: "Canada's retaliatory tariffs on US goods", attribute: 'date took effect', value: 'September 8, 2026' });
    expect(a.topicKey).not.toBe(b.topicKey);
  });

  it('distinguishes two attributes of one subject', () => {
    const a = fingerprintClaim({ subject: 'MV June Aster ferry fire', attribute: 'people aboard', value: '134' });
    const b = fingerprintClaim({ subject: 'MV June Aster ferry fire', attribute: 'people missing', value: '86' });
    expect(a.topicKey).not.toBe(b.topicKey);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/scripts/international/claimFingerprint.test.ts`

Expected: FAIL — `Failed to resolve import "./claimFingerprint.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/trivia/scripts/international/claimFingerprint.ts`:

```ts
/**
 * Claim fingerprinting for cross-day and cross-lane deduplication.
 *
 * A fingerprint has two halves, and the split carries meaning:
 *   topicKey — who/what the claim is about (subject + attribute)
 *   valueKey — the answer
 *
 * Same topicKey + same valueKey  => duplicate: the fact is already covered.
 * Same topicKey + different value => contradiction: two live answers to one
 *                                    question, which is worse than a duplicate.
 */

export interface ClaimTriple {
  subject: string;
  attribute: string;
  value: string;
}

export interface ClaimKeys {
  topicKey: string;
  valueKey: string;
}

/**
 * Words carrying no identifying information: unit nouns, approximation hedges,
 * and articles. Dropping them makes "89" and "89 years old" collide, which is
 * the wiran-1578 / wiran-1661 case.
 */
const NOISE_WORDS = new Set([
  // approximation and comparison hedges
  'approximately', 'approx', 'about', 'around', 'over', 'under', 'nearly',
  'almost', 'least', 'at', 'more', 'than', 'up', 'to', 'some', 'roughly',
  // articles and copulas
  'a', 'an', 'the', 'of', 'in', 'on', 'and', 'or', 'is', 'was', 'were',
  // unit and counting nouns
  'year', 'years', 'month', 'months', 'day', 'days', 'hour', 'hours',
  'week', 'weeks', 'old', 'aged', 'age',
  'person', 'people', 'passenger', 'passengers', 'survivor', 'survivors',
  'nation', 'nations', 'country', 'countries', 'state', 'states',
  'seat', 'seats', 'vote', 'votes', 'percent', 'pct',
  'metre', 'metres', 'meter', 'meters', 'km', 'kilometre', 'kilometres',
  'kilometer', 'kilometers', 'foot', 'feet', 'mile', 'miles',
  'advertisement', 'advertisements', 'ad', 'ads',
  'barrel', 'barrels', 'flight', 'flights', 'airport', 'airports',
  'lodging', 'lodgings', 'complaint', 'complaints', 'institution', 'institutions',
  'cascade', 'cascades', 'attack', 'attacks', 'tanker', 'tankers',
  'total', 'each', 'per',
]);

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function baseNormalize(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9.%\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop noise words and re-join. Preserves numbers, including decimals. */
function stripNoise(text: string): string {
  return text
    .split(' ')
    .filter(token => token.length > 0 && !NOISE_WORDS.has(token))
    .join(' ')
    .trim();
}

/**
 * Normalise a claim's value. Thousands separators are removed before
 * punctuation stripping so "1,287" becomes "1287" rather than "1 287".
 */
export function normalizeValue(raw: string): string {
  const digitsJoined = raw.replace(/(\d),(\d{3})\b/g, '$1$2');
  return stripNoise(baseNormalize(digitsJoined));
}

/** Normalise a subject or attribute. Same rules, kept separate for clarity. */
function normalizeText(raw: string): string {
  return stripNoise(baseNormalize(raw));
}

export function fingerprintClaim(triple: ClaimTriple): ClaimKeys {
  const subject = normalizeText(triple.subject);
  const attribute = normalizeText(triple.attribute);
  return {
    topicKey: `${subject}|${attribute}`,
    valueKey: normalizeValue(triple.value),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/scripts/international/claimFingerprint.test.ts`

Expected: PASS, 14 tests. If the `approximately 5,000 people` / `over 5000` case fails, confirm both `approximately` and `over` are in `NOISE_WORDS` — do not relax the assertion.

- [ ] **Step 5: Commit**

```bash
cd /c/ev-accounts
git add backend/src/trivia/scripts/international/claimFingerprint.ts backend/src/trivia/scripts/international/claimFingerprint.test.ts
git commit -m "feat(pipeline): fingerprint claims as topic key plus value key

Normalises a (subject, attribute, value) triple hard enough that 89 and
'89 years old' collide, while keeping 43.8% and 44% distinct.

The two-part split is load-bearing: same topic with the same value is a
duplicate, same topic with a different value is a contradiction, and the
audit found both classes live in the pool.

Regression fixtures cover the five known duplicate pairs and the three
coincidental same-answer pairs that must not be flagged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Claim guard verdicts

The decision logic, over an injected store so it needs no database.

**Files:**
- Create: `src/trivia/scripts/international/claimGuard.ts`
- Test: `src/trivia/scripts/international/claimGuard.test.ts`

**Interfaces:**
- Consumes: `ClaimKeys` from `claimFingerprint.js`; `Lane` from `lanes.js`.
- Produces:
  - `interface FingerprintRow { topicKey: string; valueKey: string; lane: Lane; questionExternalId: string | null; firstSeenAt: Date }`
  - `interface FingerprintStore { findByTopicKey(topicKey: string, since: Date): Promise<FingerprintRow[]>; insert(row: FingerprintRow & { generationJobId: number | null }): Promise<void> }`
  - `type ClaimVerdict = { kind: 'new' } | { kind: 'duplicate'; existing: FingerprintRow } | { kind: 'contradiction'; existing: FingerprintRow }`
  - `const CLAIM_WINDOW_DAYS = 14`
  - `function makeClaimGuard(store: FingerprintStore, now?: () => Date): { check(keys: ClaimKeys): Promise<ClaimVerdict>; record(keys: ClaimKeys, lane: Lane, questionExternalId: string | null, generationJobId: number | null): Promise<void> }`

- [ ] **Step 1: Write the failing test**

Create `src/trivia/scripts/international/claimGuard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeClaimGuard, CLAIM_WINDOW_DAYS, type FingerprintRow, type FingerprintStore } from './claimGuard.js';
import type { Lane } from './lanes.js';

const NOW = new Date('2026-09-10T06:00:00Z');
const nowFn = () => NOW;

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function memoryStore(rows: FingerprintRow[] = []): FingerprintStore & { rows: FingerprintRow[] } {
  const store = {
    rows: [...rows],
    async findByTopicKey(topicKey: string, since: Date) {
      return store.rows.filter(r => r.topicKey === topicKey && r.firstSeenAt >= since);
    },
    async insert(row: FingerprintRow) {
      store.rows.push(row);
    },
  };
  return store;
}

function row(over: Partial<FingerprintRow> = {}): FingerprintRow {
  return {
    topicKey: 'king harald v|age at death',
    valueKey: '89',
    lane: 'world' as Lane,
    questionExternalId: 'wiran-1578',
    firstSeenAt: daysAgo(4),
    ...over,
  };
}

describe('claimGuard.check', () => {
  it('returns new for an unseen topic', async () => {
    const guard = makeClaimGuard(memoryStore(), nowFn);
    const verdict = await guard.check({ topicKey: 'unseen|thing', valueKey: '1' });
    expect(verdict.kind).toBe('new');
  });

  it('returns duplicate when topic and value both match', async () => {
    const guard = makeClaimGuard(memoryStore([row()]), nowFn);
    const verdict = await guard.check({ topicKey: 'king harald v|age at death', valueKey: '89' });
    expect(verdict.kind).toBe('duplicate');
    if (verdict.kind === 'duplicate') {
      expect(verdict.existing.questionExternalId).toBe('wiran-1578');
    }
  });

  it('returns contradiction when the topic matches but the value differs', async () => {
    const guard = makeClaimGuard(
      memoryStore([row({ topicKey: 'meta csam advertisements india|count', valueKey: '84', questionExternalId: 'clima-1599' })]),
      nowFn,
    );
    const verdict = await guard.check({ topicKey: 'meta csam advertisements india|count', valueKey: '78' });
    expect(verdict.kind).toBe('contradiction');
    if (verdict.kind === 'contradiction') {
      expect(verdict.existing.valueKey).toBe('84');
      expect(verdict.existing.questionExternalId).toBe('clima-1599');
    }
  });

  it('prefers duplicate over contradiction when both a matching and a differing value exist', async () => {
    const guard = makeClaimGuard(
      memoryStore([
        row({ valueKey: '89', questionExternalId: 'wiran-1578' }),
        row({ valueKey: '87', questionExternalId: 'wiran-9999' }),
      ]),
      nowFn,
    );
    const verdict = await guard.check({ topicKey: 'king harald v|age at death', valueKey: '89' });
    expect(verdict.kind).toBe('duplicate');
  });

  it('ignores rows older than the window', async () => {
    const guard = makeClaimGuard(memoryStore([row({ firstSeenAt: daysAgo(CLAIM_WINDOW_DAYS + 1) })]), nowFn);
    const verdict = await guard.check({ topicKey: 'king harald v|age at death', valueKey: '89' });
    expect(verdict.kind).toBe('new');
  });

  it('counts a row exactly at the window edge as in-window', async () => {
    const guard = makeClaimGuard(memoryStore([row({ firstSeenAt: daysAgo(CLAIM_WINDOW_DAYS) })]), nowFn);
    const verdict = await guard.check({ topicKey: 'king harald v|age at death', valueKey: '89' });
    expect(verdict.kind).toBe('duplicate');
  });

  it('does not treat a different topic with the same value as related', async () => {
    const guard = makeClaimGuard(
      memoryStore([row({ topicKey: 'russia north korea tumen river road bridge|year opened', valueKey: '2026' })]),
      nowFn,
    );
    const verdict = await guard.check({
      topicKey: 'uganda withdrawal invictus games|year announced',
      valueKey: '2026',
    });
    expect(verdict.kind).toBe('new');
  });

  it('uses a 14-day window', () => {
    expect(CLAIM_WINDOW_DAYS).toBe(14);
  });
});

describe('claimGuard.record', () => {
  it('persists a row that a later check finds as a duplicate', async () => {
    const store = memoryStore();
    const guard = makeClaimGuard(store, nowFn);
    await guard.record({ topicKey: 't|a', valueKey: 'v' }, 'us', 'usnws-0001', 42);

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].lane).toBe('us');
    expect(store.rows[0].firstSeenAt).toEqual(NOW);

    const verdict = await guard.check({ topicKey: 't|a', valueKey: 'v' });
    expect(verdict.kind).toBe('duplicate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/scripts/international/claimGuard.test.ts`

Expected: FAIL — `Failed to resolve import "./claimGuard.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/trivia/scripts/international/claimGuard.ts`:

```ts
import type { ClaimKeys } from './claimFingerprint.js';
import type { Lane } from './lanes.js';

/** How far back a claim counts as already covered. */
export const CLAIM_WINDOW_DAYS = 14;

export interface FingerprintRow {
  topicKey: string;
  valueKey: string;
  lane: Lane;
  questionExternalId: string | null;
  firstSeenAt: Date;
}

export interface FingerprintStore {
  /** Rows for this topic key first seen at or after `since`. */
  findByTopicKey(topicKey: string, since: Date): Promise<FingerprintRow[]>;
  insert(row: FingerprintRow & { generationJobId: number | null }): Promise<void>;
}

export type ClaimVerdict =
  | { kind: 'new' }
  | { kind: 'duplicate'; existing: FingerprintRow }
  | { kind: 'contradiction'; existing: FingerprintRow };

export function makeClaimGuard(store: FingerprintStore, now: () => Date = () => new Date()) {
  function windowStart(): Date {
    return new Date(now().getTime() - CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  }

  return {
    async check(keys: ClaimKeys): Promise<ClaimVerdict> {
      const rows = await store.findByTopicKey(keys.topicKey, windowStart());
      if (rows.length === 0) return { kind: 'new' };

      // A value match is a plain duplicate and takes priority: if we have
      // already published this exact answer, that is the relevant fact,
      // regardless of what else the pool says about the same topic.
      const sameValue = rows.find(r => r.valueKey === keys.valueKey);
      if (sameValue) return { kind: 'duplicate', existing: sameValue };

      // Same topic, different answer: two live answers to one question.
      const differing = rows.reduce((newest, r) =>
        r.firstSeenAt > newest.firstSeenAt ? r : newest,
      );
      return { kind: 'contradiction', existing: differing };
    },

    async record(
      keys: ClaimKeys,
      lane: Lane,
      questionExternalId: string | null,
      generationJobId: number | null,
    ): Promise<void> {
      await store.insert({
        topicKey: keys.topicKey,
        valueKey: keys.valueKey,
        lane,
        questionExternalId,
        firstSeenAt: now(),
        generationJobId,
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/scripts/international/claimGuard.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/ev-accounts
git add backend/src/trivia/scripts/international/claimGuard.ts backend/src/trivia/scripts/international/claimGuard.test.ts
git commit -m "feat(pipeline): add claim guard with duplicate and contradiction verdicts

Decision logic over an injected store, so it unit-tests without a DB
harness (this repo has none). A value match is a duplicate; a topic match
with a differing value is a contradiction and reported separately.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Near-duplicate threshold logic

The paraphrase net, again split so the decision is pure and only the SQL touches Postgres.

**Files:**
- Create: `src/trivia/scripts/international/nearDuplicate.ts`
- Test: `src/trivia/scripts/international/nearDuplicate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface SimilarityHit { externalId: string; similarity: number }`
  - `interface SimilarityProbe { mostSimilar(text: string, collectionIds: readonly number[], since: Date): Promise<SimilarityHit | null> }`
  - `const NEAR_DUP_THRESHOLD = 0.55`
  - `const NEAR_DUP_WINDOW_DAYS = 14`
  - `function makeNearDuplicateCheck(probe: SimilarityProbe, threshold?: number, now?: () => Date): (text: string, collectionIds: readonly number[]) => Promise<SimilarityHit | null>` — resolves to the offending hit, or `null` when the text is acceptable.

- [ ] **Step 1: Write the failing test**

Create `src/trivia/scripts/international/nearDuplicate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  makeNearDuplicateCheck,
  NEAR_DUP_THRESHOLD,
  NEAR_DUP_WINDOW_DAYS,
  type SimilarityHit,
  type SimilarityProbe,
} from './nearDuplicate.js';

const NOW = new Date('2026-09-10T06:00:00Z');

function probeReturning(hit: SimilarityHit | null): SimilarityProbe & { calls: unknown[] } {
  const p = {
    calls: [] as unknown[],
    async mostSimilar(text: string, collectionIds: readonly number[], since: Date) {
      p.calls.push({ text, collectionIds, since });
      return hit;
    },
  };
  return p;
}

describe('nearDuplicateCheck', () => {
  it('accepts text when the probe finds nothing', async () => {
    const check = makeNearDuplicateCheck(probeReturning(null), undefined, () => NOW);
    expect(await check('anything', [266])).toBeNull();
  });

  it('rejects a hit above the threshold', async () => {
    const check = makeNearDuplicateCheck(
      probeReturning({ externalId: 'wiran-1578', similarity: 0.81 }),
      undefined,
      () => NOW,
    );
    const result = await check('At what age did King Harald V of Norway die in 2026?', [266]);
    expect(result?.externalId).toBe('wiran-1578');
  });

  it('accepts a hit below the threshold', async () => {
    const check = makeNearDuplicateCheck(
      probeReturning({ externalId: 'wiran-1611', similarity: 0.22 }),
      undefined,
      () => NOW,
    );
    expect(await check('unrelated question text', [266])).toBeNull();
  });

  it('treats a hit exactly at the threshold as a duplicate', async () => {
    const check = makeNearDuplicateCheck(
      probeReturning({ externalId: 'x-1', similarity: NEAR_DUP_THRESHOLD }),
      undefined,
      () => NOW,
    );
    expect(await check('text', [266])).not.toBeNull();
  });

  it('honours an overridden threshold', async () => {
    const check = makeNearDuplicateCheck(
      probeReturning({ externalId: 'x-1', similarity: 0.6 }),
      0.9,
      () => NOW,
    );
    expect(await check('text', [266])).toBeNull();
  });

  it('probes every supplied collection id, not just one lane', async () => {
    const probe = probeReturning(null);
    const check = makeNearDuplicateCheck(probe, undefined, () => NOW);
    await check('text', [266, 267, 300, 301]);
    expect((probe.calls[0] as { collectionIds: number[] }).collectionIds).toEqual([266, 267, 300, 301]);
  });

  it('probes back exactly the window', async () => {
    const probe = probeReturning(null);
    const check = makeNearDuplicateCheck(probe, undefined, () => NOW);
    await check('text', [266]);
    const since = (probe.calls[0] as { since: Date }).since;
    const expected = new Date(NOW.getTime() - NEAR_DUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    expect(since).toEqual(expected);
  });

  it('defaults the threshold to 0.55', () => {
    expect(NEAR_DUP_THRESHOLD).toBe(0.55);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/scripts/international/nearDuplicate.test.ts`

Expected: FAIL — `Failed to resolve import "./nearDuplicate.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/trivia/scripts/international/nearDuplicate.ts`:

```ts
/**
 * Trigram near-duplicate net.
 *
 * Catches paraphrase that survives claim fingerprinting because the extractor
 * structured the same fact differently on two nights. Scoped across every
 * featured lane's collection ids, not one lane, so a routing misclassification
 * becomes a skipped duplicate rather than a visible one.
 */

/** Tuned against the spec's regression fixtures. */
export const NEAR_DUP_THRESHOLD = 0.55;
export const NEAR_DUP_WINDOW_DAYS = 14;

export interface SimilarityHit {
  externalId: string;
  similarity: number;
}

export interface SimilarityProbe {
  mostSimilar(
    text: string,
    collectionIds: readonly number[],
    since: Date,
  ): Promise<SimilarityHit | null>;
}

/**
 * Returns a checker that resolves to the offending hit when `text` is too
 * similar to something already in the pool, or `null` when it is acceptable.
 */
export function makeNearDuplicateCheck(
  probe: SimilarityProbe,
  threshold: number = NEAR_DUP_THRESHOLD,
  now: () => Date = () => new Date(),
) {
  return async function check(
    text: string,
    collectionIds: readonly number[],
  ): Promise<SimilarityHit | null> {
    const since = new Date(now().getTime() - NEAR_DUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const hit = await probe.mostSimilar(text, collectionIds, since);
    if (!hit) return null;
    return hit.similarity >= threshold ? hit : null;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/ev-accounts/backend && npx vitest run src/trivia/scripts/international/nearDuplicate.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
cd /c/ev-accounts
git add backend/src/trivia/scripts/international/nearDuplicate.ts backend/src/trivia/scripts/international/nearDuplicate.test.ts
git commit -m "feat(pipeline): add trigram near-duplicate threshold logic

Pure threshold decision over an injected probe. Scoped across all featured
lanes so a routing misclassification degrades to a skipped duplicate.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `claim_fingerprints` table and the Postgres-backed store

The only module in this plan that touches the database.

**Files:**
- Create: `src/trivia/scripts/international/claimStore.ts`
- Modify: `src/trivia/db/schema.ts` (append after the `generationJobs` definition ending at line 89)

**Interfaces:**
- Consumes: `FingerprintStore`, `FingerprintRow` from `claimGuard.js`; `SimilarityProbe`, `SimilarityHit` from `nearDuplicate.js`; `Lane` from `lanes.js`.
- Produces: `const claimFingerprints` (Drizzle table); `function createFingerprintStore(): FingerprintStore`; `function createSimilarityProbe(): SimilarityProbe`; `async function pruneClaimFingerprints(olderThanDays: number): Promise<number>`.

- [ ] **Step 1: Apply the DDL**

Run this against Supabase project `kxsdzaojfaibhuzmclfq` (via the Supabase MCP `apply_migration`, name `create_claim_fingerprints`):

```sql
CREATE TABLE trivia.claim_fingerprints (
  id                bigserial PRIMARY KEY,
  topic_key         text        NOT NULL,
  value_key         text        NOT NULL,
  lane              text        NOT NULL,
  question_external_id text,
  generation_job_id integer     REFERENCES trivia.generation_jobs(id) ON DELETE SET NULL,
  first_seen_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX claim_fingerprints_topic_value_uniq
  ON trivia.claim_fingerprints (topic_key, value_key);

CREATE INDEX claim_fingerprints_topic_seen_idx
  ON trivia.claim_fingerprints (topic_key, first_seen_at DESC);
```

The unique index makes `record()` idempotent within a run. The composite index is what `findByTopicKey` reads.

- [ ] **Step 2: Verify the table and the trigram extension**

Run (Supabase MCP `execute_sql`):

```sql
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='trivia' AND table_name='claim_fingerprints') AS cols,
  (SELECT installed_version FROM pg_available_extensions WHERE name='pg_trgm') AS trgm,
  extensions.similarity('At what age did King Harald V of Norway die in 2026?',
             'How old was King Harald V of Norway when he died in 2026?') AS harald_sim;
```

Expected: `cols` = 7, `trgm` = `1.6`, and `harald_sim` returned as a number. **Record the `harald_sim` value** — it is the empirical basis for the 0.55 threshold. If it comes back below 0.55, note it and continue; Task 8 re-tunes the threshold against the full fixture set rather than this single pair.

- [ ] **Step 3: Add the table to `schema.ts`**

Append to `src/trivia/db/schema.ts`, after the `generationJobs` definition:

```ts
export const claimFingerprints = triviaSchema.table('claim_fingerprints', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  topicKey: text('topic_key').notNull(),
  valueKey: text('value_key').notNull(),
  lane: text('lane').notNull(),
  questionExternalId: text('question_external_id'),
  generationJobId: integer('generation_job_id').references(() => generationJobs.id, {
    onDelete: 'set null',
  }),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Add `bigserial` to the existing `drizzle-orm/pg-core` import list at the top of the file if it is not already imported.

- [ ] **Step 4: Write the store**

Create `src/trivia/scripts/international/claimStore.ts`:

```ts
import type { FingerprintRow, FingerprintStore } from './claimGuard.js';
import type { SimilarityHit, SimilarityProbe } from './nearDuplicate.js';
import type { Lane } from './lanes.js';

/**
 * Postgres-backed implementations of the two injected interfaces.
 * Everything else in the dedup path is pure; this is the only DB surface.
 */

export function createFingerprintStore(): FingerprintStore {
  return {
    async findByTopicKey(topicKey: string, since: Date): Promise<FingerprintRow[]> {
      const { db } = await import('../../db/index.js');
      const { claimFingerprints } = await import('../../db/schema.js');
      const { and, eq, gte } = await import('drizzle-orm');

      const rows = await db
        .select({
          topicKey: claimFingerprints.topicKey,
          valueKey: claimFingerprints.valueKey,
          lane: claimFingerprints.lane,
          questionExternalId: claimFingerprints.questionExternalId,
          firstSeenAt: claimFingerprints.firstSeenAt,
        })
        .from(claimFingerprints)
        .where(
          and(
            eq(claimFingerprints.topicKey, topicKey),
            gte(claimFingerprints.firstSeenAt, since),
          ),
        );

      return rows.map(r => ({ ...r, lane: r.lane as Lane }));
    },

    async insert(row): Promise<void> {
      const { db } = await import('../../db/index.js');
      const { claimFingerprints } = await import('../../db/schema.js');

      await db
        .insert(claimFingerprints)
        .values({
          topicKey: row.topicKey,
          valueKey: row.valueKey,
          lane: row.lane,
          questionExternalId: row.questionExternalId,
          generationJobId: row.generationJobId,
          firstSeenAt: row.firstSeenAt,
        })
        .onConflictDoNothing();
    },
  };
}

export function createSimilarityProbe(): SimilarityProbe {
  return {
    async mostSimilar(
      text: string,
      collectionIds: readonly number[],
      since: Date,
    ): Promise<SimilarityHit | null> {
      if (collectionIds.length === 0) return null;

      const { db } = await import('../../db/index.js');
      const { sql } = await import('drizzle-orm');

      // Scoped through collection_questions, never by external_id prefix —
      // a shared prefix cross-links collections (the `ind` footgun).
      const result = await db.execute(sql`
        SELECT q.external_id AS external_id,
               extensions.similarity(q.text, ${text}) AS sim
        FROM trivia.questions q
        JOIN trivia.collection_questions cq ON cq.question_id = q.id
        WHERE cq.collection_id = ANY(${sql.raw(`ARRAY[${collectionIds.join(',')}]::int[]`)})
          AND q.created_at >= ${since.toISOString()}
          AND q.status IN ('active', 'expired')
        ORDER BY sim DESC
        LIMIT 1
      `);

      const row = (result as unknown as { rows?: Array<{ external_id: string; sim: number }> }).rows?.[0]
        ?? (result as unknown as Array<{ external_id: string; sim: number }>)[0];

      if (!row) return null;
      return { externalId: row.external_id, similarity: Number(row.sim) };
    },
  };
}

/** Housekeeping: drop fingerprints beyond the retention horizon. */
export async function pruneClaimFingerprints(olderThanDays: number): Promise<number> {
  const { db } = await import('../../db/index.js');
  const { claimFingerprints } = await import('../../db/schema.js');
  const { lt } = await import('drizzle-orm');

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(claimFingerprints)
    .where(lt(claimFingerprints.firstSeenAt, cutoff))
    .returning({ id: claimFingerprints.id });

  return deleted.length;
}
```

- [ ] **Step 5: Verify it compiles and the suite still passes**

Run: `cd /c/ev-accounts/backend && npx tsc --noEmit && npm run test:unit`

Expected: no type errors; all tests pass. The `db.execute` row-shape fallback in `createSimilarityProbe` exists because Drizzle's return shape differs between drivers — if `tsc` objects, narrow the cast rather than removing the fallback.

- [ ] **Step 6: Commit**

```bash
cd /c/ev-accounts
git add backend/src/trivia/db/schema.ts backend/src/trivia/scripts/international/claimStore.ts
git commit -m "feat(pipeline): add claim_fingerprints table and Postgres-backed store

Table plus the two injected interface implementations. Similarity is scoped
through collection_questions rather than an external_id prefix, because a
shared prefix cross-links collections.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Extend claim extraction with topics and a structured triple

One Claude call already runs per story cluster. Routing and fingerprinting both ride it, so neither costs an extra request.

**Files:**
- Modify: `src/trivia/scripts/international/claim-extractor.ts` (types at lines 13–18, schema at 163–176, prompt at 178–186, parse and return at 224–248)

**Interfaces:**
- Consumes: `Lane`, `resolveLane` from `lanes.js`.
- Produces: `ClaimResult` extended with `lane: Lane`, `subject: string`, `attribute: string`, `value: string`. `extractClaim(cluster)` keeps its existing signature and null-on-failure contract.

- [ ] **Step 1: Extend the schema and the prompt**

In `src/trivia/scripts/international/claim-extractor.ts`, replace `CLAIM_EXTRACTION_SCHEMA` with:

```ts
const CLAIM_EXTRACTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    claim: { type: 'string' as const },
    fact_snapshot: { type: 'string' as const },
    confidence_tier: {
      type: 'string' as const,
      enum: ['high', 'medium', 'low'],
    },
    topics: {
      type: 'array' as const,
      items: { type: 'string' as const, enum: ['iran', 'climate', 'us', 'world'] },
    },
    subject: { type: 'string' as const },
    attribute: { type: 'string' as const },
    value: { type: 'string' as const },
  },
  required: [
    'claim',
    'fact_snapshot',
    'confidence_tier',
    'topics',
    'subject',
    'attribute',
    'value',
  ] as string[],
  additionalProperties: false,
};
```

Append to `CLAIM_EXTRACTION_SYSTEM_PROMPT`, preserving the existing rules:

```
- topics: every tag that applies, from ["iran", "climate", "us", "world"]. Tag
  "iran" for the Iran conflict or Iranian state action; "climate" for climate
  science, emissions, energy transition, or climate policy and litigation; "us"
  for United States domestic affairs; "world" for everything else. Multiple tags
  are expected and correct — a US strike on Iran is ["us", "iran"]. Do not try
  to pick one; tag what is true and the pipeline decides where it lands.
- subject, attribute, value: decompose the claim into what it is about, which
  property of it, and the answer. For "Norway observed 13 days of national
  mourning after King Harald V's death": subject "Norway national mourning for
  King Harald V", attribute "duration in days", value "13". Keep subject stable
  across days for the same story — it is used to detect that a fact has already
  been covered, so name the entity and the event, not the day's angle.
- value must be the bare answer, not a sentence.
```

- [ ] **Step 2: Extend `ClaimResult` and the return**

Replace the `ClaimResult` interface (lines 13–18):

```ts
export interface ClaimResult {
  claim: string;
  factSnapshot: string;
  confidenceTier: 'high' | 'medium' | 'low';
  sourceArticles: ParsedArticle[];
  lane: Lane;
  subject: string;
  attribute: string;
  value: string;
}
```

Add to the imports at the top of the file:

```ts
import { resolveLane, type Lane } from './lanes.js';
```

Widen the parse cast and the returned object inside `extractClaim`:

```ts
    const parsed = JSON.parse(contentBlock.text) as {
      claim: string;
      fact_snapshot: string;
      confidence_tier: 'high' | 'medium' | 'low';
      topics: string[];
      subject: string;
      attribute: string;
      value: string;
    };

    if (parsed.confidence_tier === 'low') {
      console.log(`[ClaimExtractor] Low-confidence claim skipped: "${parsed.claim}"`);
      return null;
    }

    const lane = resolveLane(parsed.topics ?? []);
    console.log(
      `[ClaimExtractor] lane=${lane} topics=[${(parsed.topics ?? []).join(',')}] "${parsed.subject} / ${parsed.attribute}"`,
    );

    return {
      claim: parsed.claim,
      factSnapshot: parsed.fact_snapshot,
      confidenceTier: parsed.confidence_tier,
      sourceArticles: cluster.articles,
      lane,
      subject: parsed.subject,
      attribute: parsed.attribute,
      value: parsed.value,
    };
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /c/ev-accounts/backend && npx tsc --noEmit`

Expected: errors **only** in `run-pipeline.ts`, which still calls the old single-collection shape. Task 7 fixes those. If any other file errors, it is a consumer of `ClaimResult` that this plan missed — stop and report it before continuing.

- [ ] **Step 4: Commit**

```bash
cd /c/ev-accounts
git add backend/src/trivia/scripts/international/claim-extractor.ts
git commit -m "feat(pipeline): return topic tags and a structured claim triple

Routing and fingerprinting both ride the Claude call that already runs per
story cluster, so neither costs an extra request. The model tags what is
true and resolveLane arbitrates, keeping precedence in testable code.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Invert the pipeline loop and wire both guards

**Files:**
- Modify: `src/trivia/scripts/international/run-pipeline.ts` (the whole `runPipeline` body, from line 56)
- Modify: `src/trivia/cron/pipelineCron.ts:27-33`
- Modify: `src/trivia/scripts/international/rss-ingestor.ts:27` (feed list)

**Interfaces:**
- Consumes: everything produced by Tasks 1–6.
- Produces: `interface LaneTarget { lane: Lane; collectionSlug: string; prefix: string; volatility: Volatility }`; `async function runNightlyPipeline(targets: readonly LaneTarget[], options?: { dryRun?: boolean; maxQuestionsPerLane?: number }): Promise<void>`.

- [ ] **Step 1: Add the US-domestic feeds**

In `src/trivia/scripts/international/rss-ingestor.ts`, extend `INTERNATIONAL_FEEDS`:

```ts
export const INTERNATIONAL_FEEDS = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-world' },
  { name: 'NPR National', url: 'https://feeds.npr.org/1003/rss.xml' },
  { name: 'AP US News', url: 'https://rsshub.app/apnews/topics/us-news' },
];
```

- [ ] **Step 2: Verify both new feeds actually fetch**

Run: `cd /c/ev-accounts/backend && npx tsx -e "import('./src/trivia/scripts/international/rss-ingestor.js').then(async m => { const r = await m.fetchAllFeeds(m.INTERNATIONAL_FEEDS); for (const f of r) console.log(f.feedName, f.error ? 'FAILED: ' + f.error : f.articles.length + ' articles'); })"`

Expected: six lines, none `FAILED`. **The ingestor drops a failing feed silently**, so a bad URL would surface only as a permanently thin US lane. If `AP US News` fails, substitute a working AP endpoint or drop it and proceed with NPR National alone — note the substitution in the commit message rather than leaving a broken URL in the list.

- [ ] **Step 3: Rewrite the pipeline entry point**

Replace the `runPipeline` function in `run-pipeline.ts` with the single-ingest, multi-lane version. Keep the existing imports and add the new ones:

```ts
import { resolveLane, type Lane } from './lanes.js';
import { fingerprintClaim } from './claimFingerprint.js';
import { makeClaimGuard } from './claimGuard.js';
import { makeNearDuplicateCheck } from './nearDuplicate.js';
import { createFingerprintStore, createSimilarityProbe, pruneClaimFingerprints } from './claimStore.js';

export interface LaneTarget {
  lane: Lane;
  collectionSlug: string;
  prefix: string;
  volatility: Volatility;
}

interface LaneStats {
  generated: number;
  blocked: number;
  duplicates: number;
  contradictions: number;
  nearDuplicates: number;
}

function emptyStats(): LaneStats {
  return { generated: 0, blocked: 0, duplicates: 0, contradictions: 0, nearDuplicates: 0 };
}

export async function runNightlyPipeline(
  targets: readonly LaneTarget[],
  options: { dryRun?: boolean; maxQuestionsPerLane?: number } = {},
): Promise<void> {
  const { dryRun = false, maxQuestionsPerLane } = options;

  console.log(`[run-pipeline] Nightly run — ${targets.length} lane(s)${dryRun ? ' (DRY RUN)' : ''}`);

  const { db } = await import('../../db/index.js');
  const { generationJobs, collections } = await import('../../db/schema.js');
  const { inArray } = await import('drizzle-orm');

  // ── Resolve every lane's collection up front ─────────────────────────────
  const slugs = targets.map(t => t.collectionSlug);
  const rows = await db
    .select({ id: collections.id, slug: collections.slug })
    .from(collections)
    .where(inArray(collections.slug, slugs));

  const idBySlug = new Map(rows.map(r => [r.slug, r.id]));
  const missing = slugs.filter(s => !idBySlug.has(s));
  if (missing.length > 0) {
    throw new Error(`Collections not found in DB: ${missing.join(', ')}`);
  }

  const targetByLane = new Map(targets.map(t => [t.lane, t]));
  const allCollectionIds = rows.map(r => r.id);

  // ── One generation_jobs row per lane ─────────────────────────────────────
  const jobIdByLane = new Map<Lane, number>();
  if (!dryRun) {
    for (const t of targets) {
      const [job] = await db
        .insert(generationJobs)
        .values({
          collectionSlug: t.collectionSlug,
          status: 'running',
          questionsGenerated: 0,
          questionsFlagged: 0,
          questionsActivated: 0,
          feedsFailed: 0,
        })
        .returning({ id: generationJobs.id });
      jobIdByLane.set(t.lane, job.id);
    }
  }

  // ── Ingest ONCE ──────────────────────────────────────────────────────────
  let feedResults: FeedResult[] = [];
  try {
    feedResults = await fetchAllFeeds(INTERNATIONAL_FEEDS);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[run-pipeline] Fatal error during feed fetch: ${errorMsg}`);
  }

  const feedsFailed = feedResults.filter(r => r.error).length;
  for (const result of feedResults) {
    console.log(
      result.error
        ? `[${result.feedName}] FAILED (${result.feedUrl}): ${result.error}`
        : `[${result.feedName}] ${result.articles.length} articles ready`,
    );
  }

  const allArticles = feedResults.flatMap(r => r.articles);
  const clusters = clusterArticles(allArticles);
  console.log(`[Pipeline] ${allArticles.length} articles → ${clusters.length} clusters`);

  // ── Guards ───────────────────────────────────────────────────────────────
  const guard = makeClaimGuard(createFingerprintStore());
  const checkNearDuplicate = makeNearDuplicateCheck(createSimilarityProbe());

  const stats = new Map<Lane, LaneStats>(targets.map(t => [t.lane, emptyStats()]));
  const rejections: Array<Record<string, unknown>> = [];

  for (const cluster of clusters) {
    const claimResult = dryRun ? null : await extractClaim(cluster);
    if (!claimResult) {
      if (dryRun) console.log(`[DryRun] cluster: "${cluster.representativeTitle}"`);
      continue;
    }

    const target = targetByLane.get(claimResult.lane);
    if (!target) {
      console.log(`[Pipeline] No target registered for lane=${claimResult.lane} — skipping`);
      rejections.push({ reason: 'no-target', lane: claimResult.lane, subject: claimResult.subject });
      continue;
    }

    const laneStats = stats.get(target.lane)!;
    if (maxQuestionsPerLane !== undefined && laneStats.generated >= maxQuestionsPerLane) {
      continue;
    }

    // ── Layer 1: claim fingerprint ─────────────────────────────────────────
    const keys = fingerprintClaim(claimResult);
    const verdict = await guard.check(keys);

    if (verdict.kind === 'duplicate') {
      laneStats.duplicates++;
      console.log(`[Dedup] duplicate of ${verdict.existing.questionExternalId ?? '(unknown)'} — "${claimResult.subject} / ${claimResult.attribute}"`);
      rejections.push({
        reason: 'duplicate-claim', lane: target.lane, topicKey: keys.topicKey,
        valueKey: keys.valueKey, existing: verdict.existing.questionExternalId,
      });
      continue;
    }

    if (verdict.kind === 'contradiction') {
      laneStats.contradictions++;
      console.warn(`[Dedup] CONTRADICTION: "${keys.topicKey}" was ${verdict.existing.valueKey} (${verdict.existing.questionExternalId ?? 'unknown'}), now ${keys.valueKey} — skipping`);
      rejections.push({
        reason: 'contradiction', lane: target.lane, topicKey: keys.topicKey,
        newValue: keys.valueKey, existingValue: verdict.existing.valueKey,
        existing: verdict.existing.questionExternalId,
      });
      continue;
    }

    // ── Generate ───────────────────────────────────────────────────────────
    const questions = await generateQuestions(claimResult);
    const failing = questions.filter(q => !q.qualityGate.passed);
    laneStats.blocked += failing.length;

    let passing = questions.filter(q => q.qualityGate.passed);

    // ── Layer 2: trigram net, per candidate ────────────────────────────────
    const survivors = [];
    for (const q of passing) {
      const hit = await checkNearDuplicate(q.text, allCollectionIds);
      if (hit) {
        laneStats.nearDuplicates++;
        console.log(`[Dedup] near-duplicate of ${hit.externalId} (sim=${hit.similarity.toFixed(2)}) — skipping`);
        rejections.push({
          reason: 'near-duplicate', lane: target.lane,
          existing: hit.externalId, similarity: hit.similarity,
        });
        continue;
      }
      survivors.push(q);
    }
    passing = survivors;

    const jobId = jobIdByLane.get(target.lane);
    if (passing.length > 0 && jobId !== undefined) {
      const written = await writePassingQuestions(
        passing, claimResult, idBySlug.get(target.collectionSlug)!,
        jobId, target.prefix, target.volatility,
      );
      laneStats.generated += written.length;

      await guard.record(keys, target.lane, written[0]?.externalId ?? null, jobId);
    }
  }

  // ── Finalise each lane's job row ─────────────────────────────────────────
  if (!dryRun) {
    const { eq } = await import('drizzle-orm');
    for (const t of targets) {
      const s = stats.get(t.lane)!;
      const jobId = jobIdByLane.get(t.lane)!;
      console.log(
        `[Pipeline] lane=${t.lane}: ${s.generated} generated, ${s.blocked} blocked, ` +
        `${s.duplicates} duplicate, ${s.contradictions} contradiction, ${s.nearDuplicates} near-duplicate`,
      );
      await db
        .update(generationJobs)
        .set({
          status: 'success',
          questionsGenerated: s.generated,
          questionsFlagged: s.blocked,
          questionsActivated: s.generated,
          feedsFailed,
          notes: {
            feedStats: feedResults.map(r => ({
              feedUrl: r.feedUrl,
              articlesFound: r.articles.length,
              articlesSkipped: r.articlesSkipped,
              ...(r.error ? { error: r.error } : {}),
            })),
            laneDistribution: Object.fromEntries(
              [...stats.entries()].map(([lane, v]) => [lane, v.generated]),
            ),
            dedup: {
              duplicates: s.duplicates,
              contradictions: s.contradictions,
              nearDuplicates: s.nearDuplicates,
            },
            rejections: rejections.filter(r => r.lane === t.lane),
          } as never,
        })
        .where(eq(generationJobs.id, jobId));
    }

    const pruned = await pruneClaimFingerprints(30);
    console.log(`[Pipeline] Pruned ${pruned} fingerprints older than 30 days`);
  }
}
```

Delete the old `runPipeline` export and the `parseArgs`-driven CLI block at the bottom of the file, replacing the CLI with:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run');
  const { INTERNATIONAL_LANES } = await import('../../cron/pipelineCron.js');
  runNightlyPipeline(INTERNATIONAL_LANES, { dryRun }).catch(err => {
    console.error('[run-pipeline] Fatal:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Update the cron**

In `src/trivia/cron/pipelineCron.ts`, replace lines 27–33 with:

```ts
import { runNightlyPipeline, type LaneTarget } from '../scripts/international/run-pipeline.js';

export const INTERNATIONAL_LANES: readonly LaneTarget[] = [
  { lane: 'iran',    collectionSlug: 'war-in-iran', prefix: 'wiran', volatility: 'fast' },
  { lane: 'world',   collectionSlug: 'world-news',  prefix: 'wnews', volatility: 'fast' },
  { lane: 'us',      collectionSlug: 'us-news',     prefix: 'usnws', volatility: 'fast' },
  { lane: 'climate', collectionSlug: 'climate-change', prefix: 'climc', volatility: 'medium' },
];
```

Replace the body of `runPipelineCron` that loops `INTERNATIONAL_COLLECTIONS` with a single call, retaining the surrounding try/catch, `regulatePool` call, and `MAX_QUESTIONS_PER_RUN`:

```ts
await runNightlyPipeline(INTERNATIONAL_LANES, { maxQuestionsPerLane: MAX_QUESTIONS_PER_RUN });
```

**Note:** `world-news`, `us-news`, and `climate-change` do not exist yet — they are created in Plan 3. `runNightlyPipeline` throws `Collections not found in DB` for missing slugs, which is the correct loud failure. Until Plan 3 lands, run with only the `iran` lane registered so the cron stays green.

**Deliberate behaviour, do not "fix" it:** the fingerprint is recorded only when at least one question was actually written (`passing.length > 0`). A claim whose candidates were all rejected by the quality gate or the trigram net is therefore *not* remembered, and tomorrow's run will try it again. That is intended — nothing was published, so nothing is duplicated, and a story that failed for a transient reason must not be permanently suppressed. The cost is one wasted generation call per night for a persistently-failing story; if that shows up as a real expense, the fix is a separate `attempt_count` column, not moving this `record()` call outside the `if`.

- [ ] **Step 5: Verify compile and full suite**

Run: `cd /c/ev-accounts/backend && npx tsc --noEmit && npm test`

Expected: no type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /c/ev-accounts
git add backend/src/trivia/scripts/international/run-pipeline.ts backend/src/trivia/scripts/international/rss-ingestor.ts backend/src/trivia/cron/pipelineCron.ts
git commit -m "feat(pipeline): ingest once and route to lanes, with both dedup guards

Inverts the loop that caused the problem. run-pipeline previously fetched
the same four feeds inside a per-collection loop, so every registered
collection generated independently from identical input — 36 of Climate
Agreements' 90 active questions shared an answer with a live War in Iran
question as a direct result.

Now: one ingest, one Claude call per cluster, lane resolved from the
returned topic tags, then claim-fingerprint and trigram guards before any
write. Rejections and lane distribution are recorded in
generation_jobs.notes so nothing is skipped silently.

Adds NPR National and AP US to the feed set so the US lane has domestic
material rather than only what foreign desks cover.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Tune the threshold against real data and verify end to end

The 0.55 threshold is a starting guess. This task replaces it with a measured value.

**Files:**
- Modify: `src/trivia/scripts/international/nearDuplicate.ts` (the `NEAR_DUP_THRESHOLD` constant only, if the measurement warrants it)

**Interfaces:**
- Consumes: everything above.
- Produces: no new interfaces; a tuned constant and a verified pipeline.

- [ ] **Step 1: Measure similarity across the known fixtures**

Run against Supabase project `kxsdzaojfaibhuzmclfq` (read-only):

```sql
WITH pairs(a, b, expect) AS (VALUES
  ('wiran-1578','wiran-1661','duplicate'),
  ('wiran-1579','wiran-1659','duplicate'),
  ('wiran-1615','wiran-1635','duplicate'),
  ('clima-1599','wiran-1640','duplicate'),
  ('clima-1552','clima-1573','duplicate'),
  ('wiran-1611','wiran-1657','distinct'),
  ('wiran-1630','wiran-1635','distinct'),
  ('wiran-1639','wiran-1665','distinct')
)
SELECT p.expect, p.a, p.b,
       round(extensions.similarity(qa.text, qb.text)::numeric, 3) AS sim
FROM pairs p
JOIN trivia.questions qa ON qa.external_id = p.a
JOIN trivia.questions qb ON qb.external_id = p.b
ORDER BY p.expect DESC, sim DESC;
```

- [ ] **Step 2: Choose the threshold**

Pick a value strictly above the highest `distinct` similarity and at or below the lowest `duplicate` similarity. Record both numbers.

If the ranges **overlap** — some distinct pair scores higher than some duplicate pair — do not split the difference. Set the threshold above every `distinct` score (favouring false negatives over false positives, because a duplicate that slips through is a cosmetic problem while a wrongly-suppressed question is lost content), and note in the commit message which duplicate pairs Layer 2 therefore misses. Those pairs are Layer 1's responsibility, and Task 2's tests already prove Layer 1 catches four of the five.

Update `NEAR_DUP_THRESHOLD` in `nearDuplicate.ts` and the assertion in `nearDuplicate.test.ts` (`expect(NEAR_DUP_THRESHOLD).toBe(...)`) to the chosen value.

- [ ] **Step 3: Run the tests**

Run: `cd /c/ev-accounts/backend && npm test`

Expected: all pass, including the updated threshold assertion.

- [ ] **Step 4: Dry-run the pipeline**

Run: `cd /c/ev-accounts/backend && npx tsx src/trivia/scripts/international/run-pipeline.ts --dry-run`

Expected: six feed lines with no failures, an article and cluster count, and one `[DryRun] cluster:` line per cluster. No DB writes and no Claude calls.

- [ ] **Step 5: Live single-lane run**

Temporarily reduce `INTERNATIONAL_LANES` to the `iran` entry alone (the other three collections do not exist until Plan 3), then run:

```bash
cd /c/ev-accounts/backend && npx tsx src/trivia/scripts/international/run-pipeline.ts
```

Expected in the output:
- `lane=` log lines showing a mix of `iran`, `world`, `us`, and possibly `climate`
- `No target registered for lane=world — skipping` for the unregistered lanes, which confirms routing works before the collections exist
- a `lane=iran: N generated` summary line

Then confirm the job row recorded the routing distribution:

```sql
SELECT id, collection_slug, status, questions_generated,
       notes->'laneDistribution' AS lanes,
       notes->'dedup' AS dedup,
       jsonb_array_length(COALESCE(notes->'rejections', '[]'::jsonb)) AS rejections
FROM trivia.generation_jobs
ORDER BY id DESC LIMIT 1;
```

Expected: `lanes` and `dedup` populated. **If `lanes` shows every story routed to `world`, the prompt change in Task 6 is not taking effect** — check that `topics` appears in the schema's `required` array before assuming the precedence logic is at fault.

- [ ] **Step 6: Run it a second time to prove dedup works**

Run the same command again immediately. Expected: `duplicate` and/or `near-duplicate` counts greater than zero, and `generated` far lower than the first run — the second pass sees the same feed articles and must reject nearly all of them. **This is the acceptance test for the whole plan.** If the second run generates as many questions as the first, dedup is not wired in.

- [ ] **Step 7: Restore the lane list and commit**

Restore all four entries in `INTERNATIONAL_LANES` (they activate when Plan 3 creates the collections), then:

```bash
cd /c/ev-accounts
git add backend/src/trivia/scripts/international/nearDuplicate.ts backend/src/trivia/scripts/international/nearDuplicate.test.ts backend/src/trivia/cron/pipelineCron.ts
git commit -m "fix(pipeline): tune trigram threshold against the known fixture pairs

Replaces the 0.55 starting guess with a value measured against the five
known duplicate pairs and the three coincidental same-answer pairs.

Verified end to end: a second consecutive run rejects nearly everything
the first run generated, which is the acceptance test for cross-day dedup.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Handoff to Plan 2 and Plan 3

This plan leaves the pipeline routing correctly but with three of four lanes unregistered, because their collections do not exist. That is intentional and safe — an unregistered lane logs and skips.

- **Plan 2 (Featured shelf)** is independent of this plan and can proceed in parallel: `featured` column, `routes/game.ts` field, picker section, admin toggle, and the API-side pool guard.
- **Plan 3 (Collections)** depends on this plan: it creates `world-news`, `us-news`, and `climate-change`, writes the Climate Change curated spine against the §7 content charter, and archives the retired Climate Agreements pool.

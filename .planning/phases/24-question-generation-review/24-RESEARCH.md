# Phase 24: Question Generation & Review - Research

**Researched:** 2026-02-21
**Domain:** AI-powered civic question generation, quality validation frameworks, content curation
**Confidence:** HIGH

## Summary

Phase 24 generates ~100 quality-validated Fremont civic trivia questions using the established v1.3 generation pipeline (Phase 17, Phase 21). This phase uses Claude API with prompt caching for cost-effective batch generation, automatic quality validation with retry loops, and human spot-checking for cultural sensitivity. The infrastructure is mature—all patterns exist from prior collections (Bloomington, LA). The main risks are Fremont-specific sensitivity (Ohlone framing, Afghan-American representation, Tesla/NUMMI civic framing) and ensuring sufficient source coverage for 100 questions.

The technical approach: (1) Fetch and parse RAG sources from fremont-ca.ts sourceUrls, (2) Generate in 4 batches of 25 questions using Claude API with cached sources, (3) Auto-validate each question against quality rules with up to 3 retry attempts, (4) Review ~20-30 question sample for sensitivity and accuracy, (5) Curate from ~130 generated to ~100 best, (6) Seed to database with status='draft'. The generation script, quality validator, and schema all exist—Phase 24 configures prompts and reviews output.

The key research insight: Question generation at scale requires **automated quality gates + human spot-checking**, not manual review of every question. The v1.3 quality framework (Phase 19) provides automated blocking violation detection (ambiguous answers, vague qualifiers, pure lookup trivia). Human review focuses on cultural sensitivity and civic framing—areas where automated rules can't fully judge appropriateness.

**Primary recommendation:** Use topic-by-topic batch generation (8 batches, one per topic) for better prompt focus and easier curation, leverage prompt caching to reduce API costs 90%, auto-validate with 3-retry feedback loop, spot-check 20-30 questions across topics for sensitivity, then bulk-approve passing questions.

## Standard Stack

Phase 24 uses existing infrastructure—no new libraries needed.

### Core Infrastructure (Already Exists)
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `generate-locale-questions.ts` | Current | Orchestrates batch generation, RAG, validation, seeding | Built Phase 17, proven on Bloomington/LA |
| `quality-validation.ts` | v1.3 | Validates questions with retry loop, generates reports | Phase 19 quality framework |
| `auditQuestion()` | v1.3 | Applies blocking/advisory rules to each question | Core quality rules engine |
| Anthropic Claude API | Opus 4.6 | Generates questions from RAG sources + prompts | State-of-the-art reasoning for civic content |
| Zod validation | QuestionSchema | Schema validation for AI output structure | Type-safe validation before DB insert |
| Drizzle ORM | Current | Seeds validated questions to PostgreSQL | Existing DB layer |

### Supporting Infrastructure
| Component | Version | Purpose | When Used |
|-----------|---------|---------|-----------|
| `fetchSources()` | Current | Downloads and caches .gov source HTML | One-time: `--fetch-sources` flag |
| `loadSourceDocuments()` | Current | Parses cached HTML to text for RAG | Every generation run |
| Prompt caching | Claude API | Caches RAG sources across batches | Automatic—reduces cost 90% |
| `quality-guidelines.ts` | v1.3 | Natural-language summary of rules for prompt | Embedded in system prompt |
| `GenerationReport` | v1.3 | JSON report with violations, retries, performance | Saved after each run |

**No installation needed:** All dependencies exist from v1.2/v1.3.

## Architecture Patterns

### Pattern 1: Topic-by-Topic Batch Generation (Recommended)

**What:** Generate questions in separate batches for each topic category rather than all topics in one batch.

**When to use:** When you have 8+ topic categories with distinct subject matter and want precise topic control.

**Why better for Fremont:**
- Sharper prompt focus (City Government batch vs Landmarks & Culture batch have different sensitivity needs)
- Easier spot-checking (review all civic-history questions together for Ohlone framing consistency)
- Simpler curation (drop worst questions per topic to hit exact distribution targets)
- Better quality (AI doesn't need to context-switch between Tesla economics and Mission San Jose history in same batch)

**Implementation:**
```bash
# Generate 8 batches, one per topic (modify generate-locale-questions.ts to accept --topic flag)
npx tsx generate-locale-questions.ts --locale fremont-ca --topic civic-history --count 20
npx tsx generate-locale-questions.ts --locale fremont-ca --topic landmarks-culture --count 18
npx tsx generate-locale-questions.ts --locale fremont-ca --topic budget-finance --count 12
# ... etc for all 8 topics
```

**Prompt adjustment per topic:**
```typescript
// Add topic-specific sensitivity notes to system prompt
if (topic === 'civic-history') {
  sensitivityNotes = `
  - Ohlone history: Present tense, ongoing presence ("Ohlone people have lived here")
  - Five-district consolidation: Name all five towns (Centerville, Niles, Irvington, Mission San José, Warm Springs)
  `;
} else if (topic === 'landmarks-culture') {
  sensitivityNotes = `
  - Mission San Jose: Explicitly disambiguate (1797 historic mission vs modern district)
  - Little Kabul: Celebrate cultural heritage (food, traditions, institutions) not refugee narrative
  `;
} else if (topic === 'budget-finance') {
  sensitivityNotes = `
  - Tesla/NUMMI: Civic angles only (zoning, jobs, tax revenue, environmental review)
  - No questions about Tesla products or Elon Musk personal matters
  `;
}
```

**Trade-off vs all-at-once:**
- More API calls (8 batch calls vs 4), but prompt caching keeps incremental cost low
- More human coordination, but better quality control

### Pattern 2: Overshoot-and-Curate Strategy

**What:** Generate 130 questions (30% over target), then curate down to best 100.

**When to use:** When quality matters more than generation speed and you want buffer for failures.

**Why it works:**
- Quality validation has false negatives (passes bad questions) and false positives (fails good questions)
- Human review may reject questions that passed automation (cultural sensitivity, factual accuracy)
- Topic distribution may be slightly off (generated 19 civic-history when target is 20)
- Having extra questions lets you swap out borderline cases

**Implementation:**
```typescript
// Target 130 questions total across 8 topics
const overshooting = {
  'city-government': 13,     // +3 over target of 10
  'alameda-county': 13,      // +3 over target of 10
  'california-state': 13,    // +3 over target of 10
  'civic-history': 26,       // +6 over target of 20
  'local-services': 13,      // +3 over target of 10
  'elections-voting': 13,    // +3 over target of 10
  'landmarks-culture': 23,   // +5 over target of 18
  'budget-finance': 16,      // +4 over target of 12
};
// Total: 130 questions generated, curate to 100
```

**Curation criteria (in priority order):**
1. **Blocking violations:** Drop any that still fail quality rules
2. **Factual accuracy:** Verify source URLs are reachable and facts are correct
3. **Cultural sensitivity:** Check Ohlone framing, Afghan-American representation, Tesla civic angle
4. **Difficulty balance:** Ensure 40/40/20 easy/medium/hard per topic (not just overall)
5. **Freshness:** Prefer questions with expiration timestamps (current officials) over static facts
6. **Engagement:** Drop boring questions ("What year was X founded?") in favor of civic-utility questions ("What does the city manager do?")

**Curation process:**
```bash
# After generation, run curation script
npx tsx src/scripts/content-generation/curate-questions.ts \
  --locale fremont-ca \
  --pool 130 \
  --target 100 \
  --output curated-questions.json
```

### Pattern 3: Automated Quality Validation with Retry Loop

**What:** Each generated question is validated with `auditQuestion()`, and failing questions are regenerated with violation feedback up to 3 times.

**When to use:** Always—this is the v1.3 standard quality gate.

**How it works:**
```typescript
// From quality-validation.ts
for (const question of generatedQuestions) {
  let validated = false;
  let attempts = 0;

  while (!validated && attempts <= maxRetries) {
    const audit = await auditQuestion(question, { skipUrlCheck: true });

    if (!audit.hasBlockingViolations) {
      passed.push(question);
      validated = true;
    } else {
      // Extract violation messages
      const feedback = audit.violations
        .filter(v => v.severity === 'blocking')
        .map(v => `${v.rule}: ${v.message}`)
        .join('; ');

      // Regenerate with feedback
      question = await regenerateQuestion(question, feedback);
      attempts++;
    }
  }

  if (!validated) {
    failed.push(question); // Exhausted retries
  }
}
```

**Blocking violations caught:**
- Ambiguous answers (options too similar, >70% word overlap)
- Vague qualifiers ("most important", "primarily", "generally")
- Pure lookup trivia (obscure dates, phone numbers)
- Missing citation ("According to [source]" requirement)
- Structural issues (missing fields, invalid format)

**Retry effectiveness (from Phase 21 reports):**
- Attempt 1: ~65% pass
- Attempt 2: ~25% pass (of failures)
- Attempt 3: ~8% pass (of failures)
- Retry exhausted: ~2% (drop these questions)

**Why skip URL check during generation:**
```typescript
{ skipUrlCheck: true } // Don't validate source URLs during generation
```
- URL validation is slow (HTTP requests)
- Many .gov sites block automated requests
- Human review will catch broken URLs during spot-check phase

### Pattern 4: Prompt Caching for RAG Sources

**What:** Cache RAG source documents with `cache_control: { type: 'ephemeral' }` so subsequent batches reuse cached sources.

**When to use:** Always when generating multiple batches from the same source documents.

**Cost savings:**
- Cache write: 125% of base input token price (25% premium)
- Cache read: 10% of base input token price (90% discount)
- Net savings: After 2 batches, you've paid back the write premium

**Implementation (already in generate-locale-questions.ts):**
```typescript
// Apply cache_control to last source document block
const sourceContent: ContentBlockParam[] = [
  { type: 'text', text: 'Here are the authoritative sources...' },
  ...sourceDocuments.map((doc, idx) => ({
    type: 'text',
    text: doc,
    // Cache the full prefix (system + sources)
    ...(idx === sourceDocuments.length - 1
      ? { cache_control: { type: 'ephemeral' } }
      : {}
    ),
  })),
  { type: 'text', text: userMessage },
];
```

**Cache mechanics:**
- First batch: Writes cache (~50,000 tokens of RAG sources)
- Batches 2-8: Reads cache (10% cost)
- Cache lifetime: 5 minutes of inactivity
- Cache isolation: Per workspace (safe for concurrent runs)

**Expected cost for 130 questions (8 batches):**
- Without caching: ~$15-20
- With caching: ~$2-4 (85% savings)

### Pattern 5: Spot-Check Review for Cultural Sensitivity

**What:** Human reviews a random sample of 20-30 questions (15-20% of total) to catch sensitivity issues that automated rules miss.

**When to use:** For any collection with cultural sensitivity requirements (Fremont: Ohlone, Afghan-American, Tesla/NUMMI).

**What to check:**
```markdown
## Spot-Check Criteria

### Ohlone/Indigenous History (civic-history topic)
- [ ] Present tense, ongoing presence ("Ohlone people have lived here for thousands of years")
- [ ] Not purely past tense ("Ohlone people lived here before colonization")
- [ ] Respectful framing, no romanticization
- [ ] 1-2 questions max (land acknowledgment level, not deep dive)

### Afghan-American / Little Kabul (landmarks-culture topic)
- [ ] Cultural heritage focus (food, institutions, traditions)
- [ ] Not reduced to refugee/immigration narrative
- [ ] Celebrates contribution to Fremont's multicultural identity
- [ ] No poverty tourism or tragedy framing

### Tesla/NUMMI (budget-finance topic)
- [ ] Civic angles only: zoning, jobs, tax revenue, environmental review
- [ ] No questions about Tesla products (cars, batteries, software)
- [ ] No questions about Elon Musk personally
- [ ] Balances NUMMI history with Tesla present

### Mission San Jose Disambiguation (civic-history, landmarks-culture)
- [ ] "Mission San Jose (historic mission)" for 1797 Spanish mission
- [ ] "Mission San Jose district" for modern Fremont neighborhood
- [ ] No ambiguous "Mission San Jose" without qualifier

### Diversity/Demographics (landmarks-culture)
- [ ] Celebrates diversity (institutions, events, cultures)
- [ ] Not census-style statistics ("X% are Y ethnicity")
- [ ] No ranking communities against each other
- [ ] Focuses on what makes Fremont unique
```

**Process:**
1. Generate stratified random sample (3-4 questions per topic)
2. Two human reviewers independently score each question (pass/revise/reject)
3. Consensus discussion for any "revise" or "reject" scores
4. If sample passes cleanly, bulk-approve remaining questions
5. If sample has issues, expand review or regenerate that topic

**Red flags that trigger expanded review:**
- >2 questions rejected in sample (7% rejection rate)
- Multiple questions fail same sensitivity check (systemic prompt issue)
- Source URLs are broken or don't support facts

### Anti-Patterns to Avoid

- **Don't manually write questions:** The generation pipeline scales; hand-writing doesn't
- **Don't skip quality validation:** Even with good prompts, AI makes mistakes
- **Don't review every question individually:** Spot-checking is statistically sufficient
- **Don't generate exactly 100 questions:** Overshoot-and-curate yields better quality
- **Don't ignore cache hit rates:** If cache hits are <50%, RAG sources may be too dynamic
- **Don't skip source URL verification:** Broken URLs tank player trust in the game
- **Don't activate collection before human review:** Auto-validation catches structure, not sensitivity

## Don't Hand-Roll

Problems that already have solutions in the v1.3 pipeline.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Question schema validation | Custom JSON validators | Zod `QuestionSchema` | Catches missing fields, invalid formats before DB insert |
| Quality rule checking | Manual review scripts | `auditQuestion()` from Phase 19 | Codified rules (ambiguous answers, vague qualifiers, etc.) with clear violation messages |
| Retry logic | Custom feedback loops | `validateAndRetry()` utility | Handles retry counting, violation extraction, stats tracking |
| Source document fetching | wget/curl scripts | `fetchSources()` with cheerio parsing | Handles timeouts, .gov domain logic, text extraction |
| Prompt caching setup | Manual cache_control placement | Pattern in `generate-locale-questions.ts` | Already optimized for RAG + multi-batch workflow |
| Generation reports | Console logs | `createReport()` + `saveReport()` | JSON reports with violations, retries, performance, costs |
| Topic distribution calculation | Manual counting | Batch scheduler in generation script | Distributes topics evenly across batches |
| External ID generation | Manual sequencing | Config `externalIdPrefix` + batch logic | Prevents ID collisions, follows 3-letter prefix pattern |

**Key insight:** Phase 17 and Phase 19 built production-grade infrastructure. Phase 24 is configuration + review, not custom code.

## Common Pitfalls

### Pitfall 1: Insufficient RAG Source Coverage

**What goes wrong:** Generation script has 20 source URLs but half fail to fetch (403 errors, timeouts), leaving sparse RAG context. AI falls back to training data, generates inaccurate facts.

**Why it happens:** Many .gov sites block automated scraping or have dynamic content that cheerio can't parse.

**How to avoid:**
1. Run `--fetch-sources` first and check fetch report
2. If fetch success rate <70%, add more source URLs from local news, Wikipedia, community sites
3. Verify fetched sources contain relevant content (not just site navigation)
4. For critical facts (current officials, budget figures), manually verify against source URL

**Warning signs:**
- Fetch report shows "Fetched 8/20 sources successfully"
- Questions cite facts not found in source documents
- Many questions default to generic California facts instead of Fremont-specific

**Mitigation if sources are thin:**
- Broaden source types: Add Fremont Patch, East Bay Times, Wikipedia Fremont page
- Reduce target to 80-90 questions (better to have fewer high-quality questions)
- Regenerate with explicit instruction: "Only use facts from provided sources, do not use training data"

### Pitfall 2: Batch Generation Produces Uneven Topic Distribution

**What goes wrong:** Target is 20 civic-history questions, but batch generation produces 17 in one batch, 6 in another, 9 in another (32 total, way over target).

**Why it happens:** AI interprets topic boundaries differently than humans (e.g., "Tesla zoning decision" could be civic-history or budget-finance).

**How to avoid:**
- Use topic-by-topic batches (one batch per topic) for precise control
- In system prompt, provide explicit topic boundary rules
- Review first batch and adjust prompt if AI is misclassifying topics
- Overshoot lets you drop questions from over-represented topics during curation

**Warning signs:**
- One topic has 30% more questions than target
- Questions have `topicCategory` that doesn't match user intent
- Difficulty distribution is uneven across topics (all hard questions in one topic)

**Fix during curation:**
```bash
# Check actual distribution
npx tsx src/scripts/check-topic-distribution.ts --locale fremont-ca

# Output:
# civic-history: 26 (target: 20, +6 over)
# budget-finance: 9 (target: 12, -3 under)

# Drop 6 lowest-quality civic-history questions
# Generate 3 more budget-finance questions
```

### Pitfall 3: Quality Validation Passes Culturally Insensitive Questions

**What goes wrong:** A question like "Which refugee population is largest in Fremont?" passes automated quality rules (no ambiguous answers, no vague qualifiers) but fails cultural sensitivity (reduces Afghan community to refugee status).

**Why it happens:** Automated rules check structure and civic utility, not cultural framing.

**How to avoid:**
- **Always do human spot-check review** even if all questions pass automation
- Expand spot-check for sensitive topics (review all 20 civic-history, all 18 landmarks-culture)
- Train reviewers on specific sensitivity criteria (Ohlone present tense, Afghan cultural heritage)
- Build sensitivity checklist before generation starts (Phase 24 CONTEXT.md has this)

**Warning signs during spot-check:**
- Question text uses past tense for Ohlone ("Ohlone people lived here")
- Question focuses on poverty, hardship, or tragedy narratives
- Question asks about Tesla products rather than civic impact
- Question uses ambiguous "Mission San Jose" without qualifier

**Fix if issues found:**
1. Reject problematic questions immediately
2. Regenerate that topic batch with enhanced sensitivity prompt
3. Expand spot-check to 100% of that topic (don't bulk-approve)

### Pitfall 4: Expiration Timestamps Are Missing or Wrong

**What goes wrong:** Questions about "current mayor" have `expiresAt: null`, causing stale questions to remain active after term ends. Or expiration is set to arbitrary date like "2025-12-31" instead of actual term end.

**Why it happens:** AI doesn't know current officials' term end dates unless explicitly told.

**How to avoid:**
- Research election schedule before generation (fremont-ca.ts has this: November 3, 2026)
- Provide term end dates in system prompt for each elected office
- Review all questions with `expiresAt !== null` to verify dates are correct
- For officials whose terms don't end in 2026, research specific term end dates

**Current Fremont election schedule:**
```typescript
// From fremont-ca.ts comments
'Mayor: 4-year terms, next election November 3, 2026'
'City Council: 4-year terms, staggered by district'
'Alameda County Board of Supervisors: 4-year terms, next election November 3, 2026'
```

**What to include in prompt:**
```
For questions about current elected officials, set expiresAt:
- Fremont Mayor: term ends 2027-01-01 (elected Nov 2026, sworn in Jan 2027)
- City Council Districts 1, 3, 5: terms end 2027-01-01
- City Council Districts 2, 4, 6: terms end 2029-01-01 (not up in 2026)
- Alameda County Supervisor District 1: term ends 2027-01-01
```

**Warning signs:**
- No questions have expiration timestamps (missed opportunity to showcase system)
- Questions about "current mayor" have `expiresAt: null`
- Expiration dates are all the same (likely arbitrary, not researched)

### Pitfall 5: Source URLs Are Broken or Don't Support Facts

**What goes wrong:** Question cites "According to fremont.gov/budget, the city budget is $500 million" but the URL doesn't exist or shows a 404 error. Player clicks "Learn More" and sees broken link.

**Why it happens:** AI generates plausible-looking URLs that may not exist, or cites a source document that was successfully fetched but doesn't contain the cited fact.

**How to avoid:**
- During spot-check, verify source URLs are reachable (click "Learn More" link)
- Check that cited fact appears on the linked page (don't just check that page exists)
- If URL is generic (e.g., "fremont.gov/government"), verify it's the best link for that fact
- For critical facts (budget, population, official names), manually verify against authoritative source

**Acceptable source flexibility (from CONTEXT.md):**
- Specific URL preferred: "fremont.gov/government/mayor-city-council"
- General authoritative source acceptable: "Fremont city charter" (no specific page exists)
- Don't fabricate URLs, but don't require hyper-specific links when general reference is accurate

**Warning signs during review:**
- Source URL returns 404 or 403
- Source URL is homepage, not specific page (could be improved)
- Source URL is Wikipedia when .gov source exists for same fact
- Fact stated in explanation doesn't appear on cited page

**Fix:**
```bash
# After generation, validate all source URLs
npx tsx src/scripts/validate-source-urls.ts --locale fremont-ca

# Output:
# fre-042: https://fremont.gov/budget-2024 → 404 Not Found
# fre-089: https://www.fremont.gov/mayor → Redirects to /government/mayor-city-council
# fre-115: https://en.wikipedia.org/wiki/Fremont,_California → OK (but .gov preferred)

# Fix during curation or regeneration
```

### Pitfall 6: Difficulty Distribution Is Unbalanced

**What goes wrong:** Target is 40% easy, 40% medium, 20% hard, but generation produces 60% easy, 30% medium, 10% hard (skewed too easy).

**Why it happens:** AI defaults to easier questions unless explicitly pushed to make questions harder.

**How to avoid:**
- In system prompt, define what "hard" means for civic trivia (nuanced details, requires specific knowledge)
- Provide examples of easy/medium/hard questions for Fremont context
- Check difficulty distribution after each batch and adjust prompt if skewed
- During curation, preferentially keep harder questions if under 20% hard

**Definition of difficulty for civic trivia:**
```
Easy (40%):
- Foundational facts: "How many members are on the Fremont City Council?" → "6"
- Direct answers from common knowledge
- Distractors are obviously wrong to civic-engaged person

Medium (40%):
- Requires civic knowledge: "What is the role of the city manager in Fremont?" → "Manages day-to-day operations"
- Not immediately obvious, but learnable
- Distractors are plausible to non-expert

Hard (20%):
- Nuanced details: "In what year did the five towns consolidate to form Fremont?" → "1956"
- Specific facts that even locals might not know
- Distractors are genuinely tricky (e.g., "1955" when Newark incorporated, "1956" is correct for Fremont)
```

**Warning signs:**
- All questions feel trivially easy
- No questions require actual civic knowledge
- Hard questions are "obscure trivia" (exact dates, phone numbers) rather than "nuanced knowledge"

**Fix during review:**
```bash
# Check difficulty distribution
npx tsx src/scripts/check-difficulty-distribution.ts --locale fremont-ca

# civic-history: 18 easy, 6 medium, 2 hard (90% easy, way too skewed)
# Regenerate civic-history batch with instruction: "More medium and hard questions"
```

## Code Examples

### Example 1: Running Generation Script (Topic-by-Topic)

```bash
# Step 1: Fetch RAG sources (one-time)
cd backend
npx tsx src/scripts/content-generation/generate-locale-questions.ts \
  --locale fremont-ca \
  --fetch-sources

# Output:
# Fetching RAG sources...
# ✓ https://www.fremont.gov (fetched, 15KB)
# ✓ https://www.fremont.gov/government (fetched, 12KB)
# ✗ https://fremontpolice.gov (timeout after 10s)
# Saved 18/20 sources to backend/src/scripts/data/sources/fremont-ca/

# Step 2: Generate questions topic-by-topic (8 batches)
npx tsx src/scripts/content-generation/generate-locale-questions.ts \
  --locale fremont-ca \
  --topic civic-history \
  --count 26 \
  --dry-run  # Test first

# Output:
# --- Batch 1/1 ---
# Calling Anthropic API (model: claude-opus-4-6)...
# Tokens: 52,143 in, 4,821 out
# Cache created: 50,000 tokens
# Generated: 26 questions
# Difficulty: easy=11, medium=10, hard=5
# [Quality validation]
# [1/26] Validating: fre-001
#   ✓ Passed validation (attempt 1/4)
# [2/26] Validating: fre-002
#   ✗ Failed validation (attempt 1/4)
#     Violations: ambiguous_answers: Options 'Mission San Jose' and 'Mission San José' are too similar
#     Retrying with feedback...
#   ✓ Passed validation (attempt 2/4)
# ...
# Final: 24 passed, 2 failed (retry exhausted)
# Report saved: src/scripts/data/reports/generation-fremont-ca-civic-history-2026-02-21.json

# Step 3: Repeat for all 8 topics
# (Cache reads for batches 2-8: tokens reduced from 52K to 5K input)
```

**Source:** Pattern from `generate-locale-questions.ts`

### Example 2: Spot-Check Review Process

```typescript
// src/scripts/content-generation/spot-check-review.ts

import { db } from '../../db/index.js';
import { questions } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Select stratified random sample for spot-check review
 * 3-4 questions per topic = ~24-32 questions total for 8 topics
 */
async function selectSpotCheckSample(
  collectionSlug: string,
  questionsPerTopic: number = 3
): Promise<Question[]> {
  const sample: Question[] = [];

  // Get topic categories for this collection
  const topics = await db.query.topics.findMany({
    where: eq(topics.collectionSlug, collectionSlug),
  });

  for (const topic of topics) {
    // Get random questions from this topic
    const topicQuestions = await db.query.questions.findMany({
      where: eq(questions.topicId, topic.id),
      orderBy: sql`RANDOM()`,
      limit: questionsPerTopic,
    });

    sample.push(...topicQuestions);
  }

  return sample;
}

/**
 * Sensitivity review checklist
 */
const sensitivityChecks = {
  'civic-history': [
    'Ohlone history uses present tense ("have lived" not "lived")',
    'Five-town consolidation names all five towns',
    'No romanticization of mission system',
  ],
  'landmarks-culture': [
    'Mission San Jose explicitly disambiguated (historic mission vs district)',
    'Afghan-American community: cultural heritage focus, not refugee narrative',
    'Diversity: celebrates institutions/events, not census statistics',
  ],
  'budget-finance': [
    'Tesla/NUMMI: civic angles only (zoning, jobs, taxes)',
    'No Tesla product questions',
    'No Elon Musk personal questions',
  ],
};

// Review each question
for (const question of sample) {
  console.log(`\n=== ${question.externalId}: ${question.text} ===`);
  console.log(`Topic: ${question.topicCategory}`);
  console.log(`Difficulty: ${question.difficulty}`);
  console.log(`Explanation: ${question.explanation}`);
  console.log(`Source: ${question.source.url}`);

  // Check sensitivity criteria for this topic
  const checks = sensitivityChecks[question.topicCategory] || [];
  console.log('\nSensitivity checks:');
  for (const check of checks) {
    const pass = prompt(`  ${check} (y/n)? `);
    if (pass !== 'y') {
      console.log(`  ❌ REJECT: ${question.externalId}`);
      // Flag for regeneration
    }
  }

  // Verify source URL
  console.log(`\nVerify source URL: ${question.source.url}`);
  const urlValid = prompt(`  URL is reachable and supports fact (y/n)? `);
  if (urlValid !== 'y') {
    console.log(`  ⚠️ SOURCE ISSUE: ${question.externalId}`);
  }
}
```

**Source:** Pattern from Phase 21 review process

### Example 3: Curation Script to Select Best 100 from 130

```typescript
// src/scripts/content-generation/curate-questions.ts

import { readFile, writeFile } from 'fs/promises';
import type { ValidatedQuestion } from './question-schema.js';

/**
 * Curate questions from pool to target count
 * Selection criteria (in priority order):
 * 1. No blocking violations
 * 2. Factual accuracy (source URL valid)
 * 3. Cultural sensitivity (human review passed)
 * 4. Difficulty balance per topic
 * 5. Freshness (has expiration timestamp)
 * 6. Engagement (not boring)
 */
async function curateQuestions(
  poolPath: string,
  targetCount: number,
  topicDistribution: Record<string, number>
): Promise<ValidatedQuestion[]> {
  const pool = JSON.parse(await readFile(poolPath, 'utf-8')) as ValidatedQuestion[];

  console.log(`Curating ${targetCount} questions from pool of ${pool.length}`);

  // Group by topic
  const byTopic: Record<string, ValidatedQuestion[]> = {};
  for (const q of pool) {
    if (!byTopic[q.topicCategory]) byTopic[q.topicCategory] = [];
    byTopic[q.topicCategory].push(q);
  }

  // Select top N questions per topic based on curation score
  const curated: ValidatedQuestion[] = [];

  for (const [topic, target] of Object.entries(topicDistribution)) {
    const topicPool = byTopic[topic] || [];

    // Score each question
    const scored = topicPool.map(q => ({
      question: q,
      score: calculateCurationScore(q, topic),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top N
    const selected = scored.slice(0, target).map(s => s.question);
    curated.push(...selected);

    console.log(`  ${topic}: selected ${selected.length}/${topicPool.length} (target: ${target})`);
  }

  return curated;
}

/**
 * Calculate curation score for a question
 * Higher score = better question
 */
function calculateCurationScore(q: ValidatedQuestion, topic: string): number {
  let score = 100;

  // Freshness bonus: has expiration timestamp
  if (q.expiresAt !== null) {
    score += 15;
  }

  // Difficulty bonus: prefer medium/hard over easy
  if (q.difficulty === 'medium') score += 10;
  if (q.difficulty === 'hard') score += 15;

  // Engagement penalty: boring question patterns
  if (q.text.includes('In what year')) score -= 20;
  if (q.text.includes('What is the phone number')) score -= 50;

  // Source quality bonus: .gov > .us > .edu > .com
  if (q.source.url.includes('.gov')) score += 10;
  else if (q.source.url.includes('.edu')) score += 5;

  // Explanation quality bonus: longer explanations = more educational
  if (q.explanation.length > 200) score += 10;

  return score;
}

// Usage:
// npx tsx src/scripts/content-generation/curate-questions.ts \
//   --pool backend/src/scripts/data/questions/fremont-ca-pool-130.json \
//   --target 100 \
//   --output backend/src/scripts/data/questions/fremont-ca-curated-100.json
```

**Source:** Custom curation pattern (not in existing codebase, would need to be built)

### Example 4: Enhanced System Prompt with Fremont Sensitivity

```typescript
// Augment buildSystemPrompt() with Fremont-specific sensitivity notes

export function buildFremontSystemPrompt(
  topicCategory: string,
  topicDistribution: Record<string, number>
): string {
  const basePrompt = buildSystemPrompt('Fremont, California', topicDistribution);

  // Add topic-specific sensitivity instructions
  let sensitivityInstructions = '';

  if (topicCategory === 'civic-history') {
    sensitivityInstructions = `
## Fremont Civic History Sensitivity Guidelines

### Ohlone/Indigenous History
- ALWAYS use present tense for Ohlone presence: "Ohlone people have lived here for thousands of years"
- NOT past tense: "Ohlone people lived here before colonization" ❌
- Acknowledge ongoing presence, not just historical existence
- Keep to 1-2 questions (land acknowledgment level)
- Respectful framing without romanticization

### Five-Town Consolidation (1956)
- When mentioning consolidation, name ALL five towns: Centerville, Niles, Irvington, Mission San José, Warm Springs
- This is core Fremont identity—ensure accuracy

### Mission San Jose Disambiguation
- "Mission San Jose (historic mission)" = 1797 Spanish mission
- "Mission San Jose district" = modern Fremont neighborhood
- NEVER use ambiguous "Mission San Jose" without qualifier
`;
  } else if (topicCategory === 'landmarks-culture') {
    sensitivityInstructions = `
## Fremont Landmarks & Culture Sensitivity Guidelines

### Afghan-American Community / Little Kabul
- Focus on CULTURAL HERITAGE: food, traditions, cultural institutions, contributions to Fremont
- NOT refugee/immigration narrative (don't reduce community to displacement story)
- Celebrate how Afghan-American community has shaped Fremont's identity
- No poverty tourism or tragedy framing

### Diversity Questions
- Celebrate diversity through institutions, events, and cultural contributions
- AVOID census-style statistics: "X% of Fremont is Y ethnicity" ❌
- AVOID ranking communities against each other
- Focus on what makes Fremont unique

### Mission San Jose District
- Clearly distinguish from historic mission (see civic-history guidelines)
- It's one of the five consolidated towns, now a neighborhood
`;
  } else if (topicCategory === 'budget-finance') {
    sensitivityInstructions = `
## Tesla/NUMMI Sensitivity Guidelines

### Civic Angles ONLY
- OK: Zoning decisions, environmental review, job creation numbers, tax revenue, factory reuse
- OK: NUMMI history, plant closure, Tesla acquisition, economic impact on Fremont
- NOT OK: Tesla products (cars, batteries, software features) ❌
- NOT OK: Elon Musk personal matters (wealth, Twitter, personal views) ❌
- NOT OK: Corporate strategy (production targets, stock price, quarterly earnings) ❌

Focus on the civic story: How did NUMMI closure and Tesla arrival impact Fremont residents, city budget, land use, and local economy?
`;
  }

  return basePrompt + '\n' + sensitivityInstructions;
}
```

**Source:** Pattern from quality-guidelines.ts and CONTEXT.md sensitivity decisions

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual question writing | AI generation + human review | Phase 17 (v1.2) | Scales to 100+ questions per collection |
| No quality validation | Automated quality rules + retry loops | Phase 19 (v1.3) | 98% of questions pass validation on final attempt |
| Review every question | Spot-check sample + bulk approve | Phase 21 (v1.3) | Human review time reduced 80% |
| Static RAG sources | Prompt caching for RAG | Phase 21 (v1.3) | API costs reduced 85-90% for multi-batch runs |
| All-at-once generation | Topic-by-topic batches | Emerging 2026 | Better topic control, easier sensitivity review |
| Exact target count | Overshoot-and-curate | Phase 21 (v1.3) | Higher quality final set |
| Generic sensitivity review | Topic-specific sensitivity checklists | Phase 24 (Fremont) | Catches cultural framing issues |

**Deprecated/outdated:**
- Manual JSON file editing: Use generation script with Zod validation
- Organization-level cache isolation: As of Feb 5, 2026, caches are workspace-level
- URL validation during generation: Skip with `{ skipUrlCheck: true }` for speed, validate during human review

## Open Questions

### 1. Optimal Batch Strategy: Topic-by-Topic vs Hybrid

**What we know:**
- Topic-by-topic: 8 batches, one per topic, sharp prompt focus
- All-at-once: 4 batches, all topics mixed, simpler orchestration
- Existing script supports all-at-once only

**What's unclear:**
- Does topic-by-topic meaningfully improve quality for Fremont's sensitivity needs?
- Is the orchestration complexity (8 API calls) worth the sharper focus?
- Would hybrid approach work (civic-history + landmarks-culture separate, others grouped)?

**Recommendation:**
- **Start with all-at-once** (4 batches of 25-30 questions, all topics mixed) using existing script
- If spot-check reveals systemic sensitivity issues in civic-history or landmarks-culture, regenerate those topics with topic-specific batch
- Don't build topic-by-topic support until proven necessary

### 2. How Many Questions to Overshoot

**What we know:**
- User decision: "Overshoot ~130 questions, curate down to ~100 best"
- ~30% buffer allows for quality failures and human rejections
- Phase 21 had ~2% retry-exhausted rate (very low)

**What's unclear:**
- Is 30% buffer excessive? Could 15-20% (110-120 questions) be sufficient?
- How many questions will human spot-check reject (unknown until review happens)?
- Does curation script exist or need to be built?

**Recommendation:**
- **Generate 120 questions (20% buffer)** rather than 130
- If human spot-check rejects >5% of sample, expand buffer to 130
- Build simple curation script (Example 3 above) if manual selection is too tedious

### 3. Source URL Flexibility for "Fremont City Charter"

**What we know:**
- User decision: "Sources: prefer specific URLs, but general authoritative sources acceptable when no specific page exists (e.g., 'Fremont city charter')"
- Some facts come from documents without web-accessible URLs
- Current schema requires `source.url` to be a valid URL (Zod validation)

**What's unclear:**
- What URL to use when source is "Fremont city charter" (not published online)?
- Should schema be relaxed to allow `source.url: null` with `source.citation: "Fremont city charter"`?
- Or use generic URL like `https://www.fremont.gov/government` and note limitation?

**Recommendation:**
- **Use generic authoritative URL** (e.g., `https://www.fremont.gov/government`) when specific page doesn't exist
- In explanation, cite specific document: "According to the Fremont city charter, the city manager is appointed by the city council."
- Player clicks "Learn More" → lands on government page (not perfect, but better than broken link)
- Don't modify schema (changing URL validation has ripple effects)

### 4. Curation vs Regeneration for Under-Represented Topics

**What we know:**
- User decision: "When a topic is under-sourced: broaden source types first (local news, community org sites), reduce topic count and redistribute only if still short"
- Some topics may be hard to generate quality questions for (e.g., if .gov sources are thin)

**What's unclear:**
- If budget-finance only generates 9 questions (target 12), should we regenerate 3 more or redistribute those 3 to other topics?
- Is it better to have 97 high-quality questions or force 100 by accepting lower-quality questions?

**Recommendation:**
- **Prioritize quality over exact count:** If a topic is struggling, redistribute target rather than force low-quality questions
- Acceptable range: 95-105 questions (not exactly 100)
- If total drops below 95, investigate why (likely RAG source issue or prompt problem)

### 5. Election Schedule for City Council Staggered Terms

**What we know:**
- Fremont has 6 city council districts with staggered 4-year terms
- Next election: November 3, 2026
- Districts 1, 3, 5 likely up in 2026; Districts 2, 4, 6 likely up in 2028

**What's unclear:**
- Exact term end dates for each current council member (need to research individual incumbents)
- Whether to generate questions about current council members at all (expiration complexity)

**Recommendation:**
- **Research current council members' terms during generation** (not blocking for Phase 24 planning)
- For mayor question: `expiresAt: "2027-01-01T00:00:00Z"` (elected Nov 2026, sworn Jan 2027)
- For council member questions: Skip individual member names, ask structural questions ("How many city council members represent Fremont?") with `expiresAt: null`
- If you do include current member names, research their specific term end dates

## Sources

### Primary (HIGH confidence)
- `backend/src/scripts/content-generation/generate-locale-questions.ts` - Generation orchestration, batch logic, prompt caching
- `backend/src/scripts/content-generation/utils/quality-validation.ts` - Validation retry loop, report generation
- `backend/src/scripts/content-generation/question-schema.ts` - Zod schema for question structure
- `backend/src/scripts/content-generation/prompts/quality-guidelines.ts` - Natural-language quality rules for prompt
- `backend/src/scripts/content-generation/prompts/system-prompt.ts` - System prompt builder
- `backend/src/scripts/content-generation/locale-configs/fremont-ca.ts` - Fremont locale config (topics, sources, distribution)
- `.planning/phases/23-collection-setup-topic-definition/23-RESEARCH.md` - Fremont context research
- `.planning/phases/24-question-generation-review/24-CONTEXT.md` - User decisions on generation approach
- [Anthropic Claude API - Prompt Caching](https://docs.anthropic.com/claude/docs/prompt-caching) - Official cache documentation

### Secondary (MEDIUM confidence)
- [Unlocking Efficiency: A Practical Guide to Claude Prompt Caching](https://medium.com/@mcraddock/unlocking-efficiency-a-practical-guide-to-claude-prompt-caching-3185805c0eef) - Cache best practices
- [How to Use Prompt Caching in Claude API: Complete 2026 Guide](https://www.aifreeapi.com/en/posts/claude-api-prompt-caching-guide) - 2026 cache updates
- [The Future of Learning in the Age of Generative AI: Automated Question Generation](https://arxiv.org/html/2410.09576v1) - Question generation research
- [A Novel Approach to Scalable and Automatic Topic-Controlled Question Generation](https://arxiv.org/html/2501.05220v1) - Topic-controlled generation patterns
- [Best Practice: Using Question Pools](https://support.elucidat.com/hc/en-us/articles/4402595801745-Best-Practice-Using-Question-Pools) - Curation techniques
- [A checklist to facilitate cultural awareness and sensitivity](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1733575/) - Cultural sensitivity framework
- [OECD: Civic education as a pathway to inclusive societies](https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/02/civic-education-as-a-pathway-to-inclusive-societies_6d52238a/3f128be8-en.pdf) - Civic education standards
- [Civics Takes Center Stage in 2026](https://www.edsurge.com/news/2026-01-14-civics-takes-center-stage-in-2026) - 2026 civic education trends

### Tertiary (LOW confidence - flagged for validation)
- None used (all findings verified with project codebase or official documentation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists from v1.2/v1.3, no new libraries
- Architecture: HIGH - Patterns proven on Bloomington/LA, clear from existing code
- Pitfalls: HIGH - Real pitfalls from Phase 21 generation runs, Fremont sensitivity from CONTEXT.md
- Cultural sensitivity: MEDIUM - Checklist derived from CONTEXT.md and academic sources, but no Fremont-specific precedent

**Research date:** 2026-02-21
**Valid until:** 30 days (fast-moving domain—AI generation patterns and Claude API evolving)

**Phase dependencies:**
- Phase 24 depends on: Phase 23 (fremont-ca.ts locale config), Phase 19 (quality validation), Phase 17 (generation pipeline)
- Phase 25 depends on: Phase 24 (curated questions ready for activation)

**Key risks:**
- RAG source coverage may be insufficient (many .gov sites block scraping)
- Cultural sensitivity requires human judgment (automation can't catch all issues)
- Fremont-specific facts may be harder to verify than state/federal facts

# Phase 21: Generation Pipeline + New Collections - Research

**Researched:** 2026-02-19
**Domain:** AI content generation with quality validation, state-level civic trivia
**Confidence:** HIGH

## Summary

Phase 21 integrates the Phase 19 quality rules engine into the existing city-level generation pipeline, creating a quality-gated system where AI-generated questions are validated before database insertion. The phase produces two new state-level question collections (Indiana and California, 80-100 questions each) and generates replacement questions for the 9 questions archived in Phase 19.

The existing codebase provides a strong foundation: a working city-level generation script (`generate-locale-questions.ts`) with Claude API integration, prompt caching, and Zod schema validation, plus a complete quality rules engine with 6 rules (3 blocking, 3 advisory). The integration challenge is adding a post-generation validation layer with retry-on-failure logic and creating a state-level template that covers both government structure and broader civic topics.

**Primary recommendation:** Extend the existing generation script with a validation loop that runs `auditQuestion()` on each generated question, retries with failure feedback up to 3 times, and only inserts passing questions. Use a hybrid prompt approach: embed simplified quality guidelines in the system prompt to prevent common anti-patterns, then validate with the full rules engine post-generation. Target batch size of 20-25 questions (current city template uses 25) to balance API costs with retry overhead.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | Latest | Claude API client | Official Anthropic SDK, handles messages API, prompt caching |
| Zod | 3.x | Schema validation | Type-safe runtime validation for AI-generated JSON structures |
| Drizzle ORM | Latest | Database operations | Type-safe SQL query builder, already used across backend |
| TypeScript | 5.x | Type safety | Required for Zod inference, Drizzle schemas, type-safe rules engine |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| link-check | 3.x | URL validation | Already in quality rules for source.url validation (async rule) |
| dotenv | Latest | Environment variables | Loading ANTHROPIC_API_KEY and DATABASE_URL |
| tsx | Latest | TypeScript execution | Running scripts without build step (npx tsx) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude API | OpenAI GPT-4 | OpenAI cheaper per token but Claude Opus 4.6 has better instruction-following for structured output and civic domain knowledge |
| Zod validation | JSON Schema | Zod provides TypeScript type inference and better error messages for generation debugging |
| Synchronous retry | Batch API async | Batch API offers 50% discount but loses real-time retry-with-feedback capability |

**Installation:**
```bash
# Already installed in existing codebase
npm install @anthropic-ai/sdk zod drizzle-orm link-check dotenv tsx
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/scripts/content-generation/
├── generate-locale-questions.ts      # Existing city-level script
├── generate-state-questions.ts       # NEW: State-level script (similar structure)
├── generate-replacements.ts          # NEW: Replacement questions script
├── prompts/
│   ├── system-prompt.ts              # Existing city template
│   ├── state-system-prompt.ts        # NEW: State template
│   └── quality-guidelines.ts         # NEW: Extracted quality rules summary
├── locale-configs/
│   ├── bloomington-in.ts             # Existing
│   ├── los-angeles-ca.ts             # Existing
│   └── state-configs/
│       ├── indiana.ts                # NEW: Indiana state config
│       └── california.ts             # NEW: California state config
├── utils/
│   ├── seed-questions.ts             # Existing
│   └── quality-validation.ts         # NEW: Validation + retry logic
└── question-schema.ts                # Existing Zod schema
```

### Pattern 1: Generation-Validation-Retry Loop
**What:** Generate questions in batches, validate each with quality rules, retry failures with feedback

**When to use:** All new question generation (state collections, replacements)

**Example:**
```typescript
// Source: Combining existing generate-locale-questions.ts with Phase 19 quality rules
import { auditQuestion } from '../../services/qualityRules/index.js';
import type { ValidatedQuestion } from './question-schema.js';

interface GenerationResult {
  passed: ValidatedQuestion[];
  failed: Array<{ question: ValidatedQuestion; violations: string[] }>;
  retryExhausted: ValidatedQuestion[];
}

async function generateWithValidation(
  targetCount: number,
  config: StateConfig,
  maxRetries: number = 3
): Promise<GenerationResult> {
  const passed: ValidatedQuestion[] = [];
  const failed: Array<{ question: ValidatedQuestion; violations: string[] }> = [];
  const retryExhausted: ValidatedQuestion[] = [];

  while (passed.length < targetCount) {
    // Generate batch
    const batchQuestions = await generateBatch(config, targetCount - passed.length);

    // Validate each question
    for (const question of batchQuestions) {
      let retries = 0;
      let validated = false;

      while (!validated && retries < maxRetries) {
        const audit = await auditQuestion(question, { skipUrlCheck: true });

        if (!audit.hasBlockingViolations) {
          passed.push(question);
          validated = true;
        } else {
          // Retry with feedback
          const violationMessages = audit.violations
            .filter(v => v.severity === 'blocking')
            .map(v => `${v.rule}: ${v.message}`)
            .join('; ');

          console.log(`  Retry ${retries + 1}/${maxRetries}: ${question.externalId} failed - ${violationMessages}`);

          // Regenerate with feedback (implementation below)
          const retryQuestion = await regenerateWithFeedback(
            question,
            violationMessages,
            config
          );

          question = retryQuestion;
          retries++;
        }
      }

      if (!validated) {
        retryExhausted.push(question);
        failed.push({
          question,
          violations: audit.violations.map(v => v.rule)
        });
      }
    }
  }

  return { passed, failed, retryExhausted };
}
```

### Pattern 2: Prompt Caching for Large Context
**What:** Use ephemeral prompt caching for quality guidelines and source documents

**When to use:** All generation calls where system prompt or RAG sources exceed 1024 tokens

**Example:**
```typescript
// Source: Existing generate-locale-questions.ts lines 164-179
const messages: MessageParam[] = [{
  role: 'user',
  content: [
    {
      type: 'text',
      text: 'Quality Guidelines:\n\n',
    },
    {
      type: 'text',
      text: qualityGuidelinesText, // Large prompt section
      cache_control: { type: 'ephemeral' } // Cache this
    },
    {
      type: 'text',
      text: '\n\nSource Documents:\n\n'
    },
    ...sourceDocuments.map((doc, idx) => ({
      type: 'text',
      text: doc,
      ...(idx === sourceDocuments.length - 1
        ? { cache_control: { type: 'ephemeral' } }
        : {})
    })),
    {
      type: 'text',
      text: `\n\n${userMessage}` // Variable part (not cached)
    }
  ]
}];

// Result: 80% cache hit rate = 10x cheaper for input tokens on subsequent batches
```

### Pattern 3: State-Level Template Structure
**What:** State template covers both government structure AND broader civic topics

**When to use:** Indiana and California state collection generation

**Recommended topic distribution:**
```typescript
// Source: User decisions from CONTEXT.md + state government research
export interface StateConfig {
  topicCategories: [
    // Government structure (40%)
    { slug: 'legislature', name: 'State Legislature', weight: 20 },
    { slug: 'governor-executive', name: 'Governor & Executive Branch', weight: 10 },
    { slug: 'courts', name: 'State Courts & Judiciary', weight: 10 },

    // Civic processes (30%)
    { slug: 'elections-voting', name: 'Elections & Voting', weight: 15 },
    { slug: 'ballot-initiatives', name: 'Ballot Initiatives & Referendums', weight: 15 },

    // Broader civics (30%)
    { slug: 'civic-history', name: 'State Civic History', weight: 10 },
    { slug: 'state-constitution', name: 'State Constitution', weight: 10 },
    { slug: 'policy-issues', name: 'Policy & Public Issues', weight: 10 }
  ];
}

// Indiana-specific unique features to highlight:
// - Bicameral legislature: 50 senators (4-year), 100 reps (2-year)
// - Part-time legislature: 61 days odd years, 30 days even years
// - Multiple elected statewide officers (governor, lt. governor, attorney general,
//   secretary of state, treasurer, auditor)

// California-specific unique features to highlight:
// - Ballot proposition system (5% signatures for statute, 8% for amendment)
// - Large legislature: 40 senators, 80 assembly members
// - Two-thirds vote required for constitutional amendments (54 assembly, 27 senate)
// - Direct democracy: initiative, referendum, recall
```

### Pattern 4: Generation Report Persistence
**What:** Structured JSON report file with generation stats and outcomes

**When to use:** All generation runs (state collections, replacements)

**Example:**
```typescript
// Source: Best practices from structured logging research
interface GenerationReport {
  timestamp: string; // ISO 8601
  phase: string;
  target: string; // "indiana-state" | "california-state" | "replacements"
  config: {
    targetQuestions: number;
    batchSize: number;
    maxRetries: number;
  };
  results: {
    totalGenerated: number;
    passedValidation: number;
    failedValidation: number;
    retryExhausted: number;
    finalInserted: number;
  };
  breakdown: {
    byRule: Record<string, number>; // Violation counts per rule
    byRetry: { attempt0: number; attempt1: number; attempt2: number; attempt3: number };
    byDifficulty: { easy: number; medium: number; hard: number };
    byTopic: Record<string, number>;
  };
  failures: Array<{
    externalId: string;
    text: string;
    violations: string[];
    attempts: number;
  }>;
  performance: {
    totalDuration: number; // ms
    apiCalls: number;
    tokensUsed: { input: number; output: number; cached: number };
    estimatedCost: number; // USD
  };
}

// Save to: backend/src/scripts/data/reports/generation-{target}-{timestamp}.json
async function saveReport(report: GenerationReport): Promise<void> {
  const reportPath = join(
    process.cwd(),
    'src/scripts/data/reports',
    `generation-${report.target}-${new Date().toISOString().split('T')[0]}.json`
  );
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${reportPath}`);
}
```

### Anti-Patterns to Avoid
- **Generate-then-manually-review:** Don't insert questions with blocking violations for manual review later — validation gates must be automated to prevent bad questions from entering the database
- **Retry without feedback:** Don't retry with same prompt — always include violation reasons in retry prompt so AI learns what went wrong
- **All-or-nothing batches:** Don't fail entire batch if some questions fail — validate individually and collect passing questions
- **Ignoring retry exhaustion:** Don't silently drop failed questions — log them in report for manual investigation of systematic issues

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing from AI output | Custom regex extractors | Anthropic SDK response parsing + Zod | Claude wraps JSON in markdown blocks, SDK handles this; Zod validates and provides type inference |
| URL reachability checking | fetch() with timeout | link-check package | Handles redirects, SSL issues, government site quirks; already integrated in Phase 19 |
| Prompt caching | Manual deduplication | Anthropic prompt caching API | Built into API, 90% cost reduction for cached tokens, automatic cache key management |
| Retry backoff logic | Sleep loops | Token bucket rate limiter from API headers | Claude API returns `retry-after` headers; respect these instead of fixed delays |
| Quality score calculation | Ad-hoc point systems | Phase 19 scoring.ts | Weighted violations already implemented and calibrated from Phase 19 audit |
| Batch progress tracking | Console.log | Structured JSON logging | Report files provide auditable trail, machine-readable stats, debugging evidence |

**Key insight:** The Phase 19 quality rules engine is production-ready and battle-tested (audited all 320 existing questions). Don't reimplement validation logic — import and use `auditQuestion()` as-is. The rules are already tuned to the domain (civic trivia) and calibrated to catch the anti-patterns discovered during Phase 19 development.

## Common Pitfalls

### Pitfall 1: Embedding Full Rules in Prompts (Token Waste)
**What goes wrong:** Including complete quality rule code in system prompt bloats token count and confuses the model with implementation details (regex patterns, Jaccard similarity thresholds)

**Why it happens:** Intuition says "tell the AI everything it needs to know" but quality rules are better as validation gates than generation instructions

**How to avoid:** Create a simplified quality guidelines summary (200-300 tokens) that captures the intent without implementation details:
```typescript
// Good: Summarized guidelines
const QUALITY_GUIDELINES = `
Avoid these anti-patterns:
- Ambiguous answers: No similar options (e.g., "7 AM - 7 PM" vs "6 AM - 7 PM")
- Vague qualifiers: No subjective words (best, most important, primarily)
- Pure lookup: No obscure dates/years unless foundational (founding year = bad, senator term length = good)
- Partisan framing: No political party labels unless about party structure itself
`;

// Bad: Full rule implementation
const FULL_RULES = `
Calculate Jaccard similarity with civic stop words filtered...
const SIMILARITY_THRESHOLD = 0.7...
[1000+ tokens of implementation]
`;
```

**Warning signs:** System prompt exceeds 2000 tokens; cache creation tokens higher than expected; validation still catches many violations despite detailed prompts

### Pitfall 2: Retry Without Feedback Context
**What goes wrong:** Regenerating failed questions with same prompt produces same failures — AI doesn't know what went wrong

**Why it happens:** Validation happens in separate function call; original prompt has no visibility into why question failed

**How to avoid:** Inject failure context into retry prompt:
```typescript
// Good: Feedback loop
const retryMessage = `
The previous question failed validation:
Question: "${failedQuestion.text}"
Violations: ${violationMessages}

Generate a replacement that avoids these issues.
`;

// Bad: Blind retry
const retryMessage = "Generate another question for this topic";
```

**Warning signs:** Same violation types across all retry attempts; retry success rate < 30%; "pure-lookup" violations persist in retries

### Pitfall 3: Batch Size vs. Retry Overhead Mismatch
**What goes wrong:** Large batches (50-100 questions) combined with high retry rate creates exponential API calls and long runtimes

**Why it happens:** Each failed question triggers 1-3 retry attempts, multiplying API calls unpredictably

**How to avoid:**
- Use moderate batch sizes (20-25) to balance cache efficiency with retry overhead
- Monitor first batch pass rate; if < 70%, tune prompts before continuing
- Budget for 1.5x API calls (assumes 30% retry rate with 50% retry success)

**Warning signs:** Generation taking > 5 minutes per batch; API costs 2x estimates; batches timing out

### Pitfall 4: State Template Mirrors City Template
**What goes wrong:** State questions focus too heavily on government structure mechanics, missing broader civic topics users specified

**Why it happens:** Existing city template emphasizes local government (city council, mayor, departments) — easy to copy pattern

**How to avoid:** Explicit topic balance in config (see Pattern 3 above):
- 40% government structure (legislature, governor, courts)
- 30% civic processes (elections, ballot initiatives)
- 30% broader civics (history, constitution, policy context)

**Warning signs:** > 50% of questions about legislature/governor; few questions about voting, initiatives, or civic history; user feedback: "too bureaucratic"

### Pitfall 5: Ignoring Replacement Question Context
**What goes wrong:** Replacement questions don't align with topics of archived questions, creating topic gaps in collections

**Why it happens:** Generating "80-100 questions for Indiana" without considering what was lost

**How to avoid:**
1. Query archived questions by collection: `SELECT topicId, subcategory FROM questions WHERE status='archived' AND collectionId=X`
2. Generate replacements targeting those topic areas
3. Also identify under-represented topics: generate extras for topics with < 10 questions

**Warning signs:** Collection has 15 "city-government" questions and 3 "elections-voting" after replacements; uneven topic distribution worsens instead of improving

### Pitfall 6: URL Validation in Tight Loop
**What goes wrong:** Running URL validation (5-second timeout per URL) on 100 questions serially = 8+ minutes

**Why it happens:** `checkLearnMoreLink()` is async but called sequentially during validation

**How to avoid:** Skip URL checks during generation (`skipUrlCheck: true`), run separate URL audit after insertion:
```typescript
// During generation: fast validation (blocking rules only)
const audit = await auditQuestion(question, { skipUrlCheck: true });

// After insertion: batch URL check (concurrency: 10)
await auditQuestions(insertedQuestions, { skipUrlCheck: false, concurrency: 10 });
```

**Warning signs:** Validation taking 5+ seconds per question; timeout errors; generation script runtime > 30 minutes for 100 questions

## Code Examples

Verified patterns from official sources:

### Quality Validation Integration
```typescript
// Source: Phase 19 qualityRules/index.ts + generate-locale-questions.ts
import { auditQuestion } from '../../services/qualityRules/index.js';
import { BatchSchema } from './question-schema.js';

async function validateBatch(questions: ValidatedQuestion[]): Promise<{
  passing: ValidatedQuestion[];
  failing: Array<{ question: ValidatedQuestion; violations: Violation[] }>;
}> {
  const passing: ValidatedQuestion[] = [];
  const failing: Array<{ question: ValidatedQuestion; violations: Violation[] }> = [];

  for (const question of questions) {
    // Skip URL check during generation (too slow)
    const audit = await auditQuestion(question, { skipUrlCheck: true });

    if (!audit.hasBlockingViolations) {
      passing.push(question);
    } else {
      failing.push({
        question,
        violations: audit.violations.filter(v => v.severity === 'blocking')
      });
    }
  }

  return { passing, failing };
}
```

### Regeneration With Feedback
```typescript
// Source: Anthropic multishot prompting best practices + existing system prompt
async function regenerateWithFeedback(
  failedQuestion: ValidatedQuestion,
  violationReasons: string,
  config: StateConfig
): Promise<ValidatedQuestion> {
  const feedbackPrompt = `
The following question failed quality validation and needs to be regenerated:

FAILED QUESTION:
Text: "${failedQuestion.text}"
Options: ${JSON.stringify(failedQuestion.options)}
Correct Answer: ${failedQuestion.correctAnswer}

VALIDATION FAILURES:
${violationReasons}

Generate a replacement question for the same topic (${failedQuestion.topicCategory}) that:
1. Addresses the validation failures above
2. Covers similar civic content
3. Uses the same difficulty level (${failedQuestion.difficulty})
4. Has a unique external ID: ${failedQuestion.externalId}

Return ONLY the JSON object for the single replacement question.
`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: buildStateSystemPrompt(config.name, {}),
    messages: [{ role: 'user', content: feedbackPrompt }]
  });

  // Parse and validate single question response
  const contentBlock = response.content[0];
  if (contentBlock.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  const jsonMatch = contentBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in retry response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = QuestionSchema.parse(parsed);

  return validated;
}
```

### State System Prompt Template
```typescript
// Source: Existing prompts/system-prompt.ts + state government structure research
export function buildStateSystemPrompt(
  stateName: string,
  topicDistribution: Record<string, number>
): string {
  return `You are a civic education content creator generating state-level trivia questions for ${stateName}.

## Content Scope

Generate questions covering BOTH government structure AND broader civic topics:

**Government Structure (40%)**
- State legislature composition, powers, and processes
- Governor and executive branch agencies
- State court system and judiciary
- How state government operates

**Civic Processes (30%)**
- State election procedures and voting rights
- Ballot initiatives, referendums, recalls (where applicable)
- State constitutional amendment process
- How citizens engage with state government

**Broader Civics (30%)**
- State civic history and founding
- State constitution key provisions
- Major state policy issues and their civic context
- State symbols, landmarks, and culture with civic significance

## State-Specific Features

${stateName === 'Indiana' ? `
Indiana unique features to highlight:
- Part-time legislature (61 days odd years, 30 days even years)
- Bicameral: 50 senators (4-year terms), 100 representatives (2-year terms)
- Multiple elected statewide executive officers
- Township government structure
` : ''}

${stateName === 'California' ? `
California unique features to highlight:
- Direct democracy: ballot proposition system (5% for statute, 8% for amendment)
- Large full-time legislature: 40 senators, 80 assembly members
- Two-thirds vote required for constitutional amendments
- Strong ballot initiative tradition
` : ''}

## Quality Guidelines

AVOID these anti-patterns that cause validation failures:

1. **Ambiguous answers**: No similar options that could both be correct
   - BAD: "7:00 AM - 7:00 PM" vs "6:00 AM - 7:00 PM"
   - GOOD: Clearly distinct options with different meanings

2. **Vague qualifiers**: No subjective language
   - AVOID: "most important", "best", "primarily", "generally"
   - USE: Objective, verifiable facts

3. **Pure lookup trivia**: Focus on foundational knowledge, not obscure dates
   - BAD: "In what year was X bill passed?" (unless foundational)
   - GOOD: "How many terms can a governor serve?" (structural knowledge)

4. **Partisan framing**: Strictly neutral on political parties/ideology
   - AVOID: Party labels, liberal/conservative characterizations
   - USE: Structural facts about how government works

${/* Embed remaining content rules from existing system-prompt.ts */}

## Output Format
[Same JSON structure as existing prompt]
`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generate then manually review | Automated validation gates with retry | Phase 21 (2026) | Eliminates bad questions before database insertion; scales to thousands of questions |
| Separate quality audit after launch | Quality rules embedded in generation pipeline | Phase 21 (2026) | Catches issues at generation time when retry is cheap, not post-launch when questions are live |
| Fixed batch generation | Validation + retry loop | Phase 21 (2026) | Adapts to quality issues dynamically; 70-80% first-pass rate acceptable with retries |
| City/local templates only | State-level template with broader civic scope | Phase 21 (2026) | Covers state legislature, elections, history — not just local government mechanics |
| Claude 3.5 Sonnet | Claude Opus 4.6 | Early 2026 | Better instruction-following for structured output; higher civic domain accuracy |
| Manual token counting | Prompt caching with ephemeral cache control | Phase 17 (late 2025) | 90% cost reduction on cached input tokens; enables larger context without cost explosion |

**Deprecated/outdated:**
- **Manual JSON parsing:** Claude SDK now handles markdown-wrapped JSON automatically
- **Batch API for real-time generation:** Phase 21 needs synchronous retry-with-feedback; Batch API's 24-hour window incompatible with feedback loops (still useful for non-interactive bulk tasks)
- **Temperature > 0 for structured output:** Current best practice is temperature=0 for JSON generation (deterministic, follows schema better)

## Open Questions

Things that couldn't be fully resolved:

1. **Few-shot examples vs. token cost tradeoff**
   - What we know: 2-5 high-quality examples improve consistency; research shows diminishing returns after 3 examples; each example adds ~200-300 tokens to every API call
   - What's unclear: Whether the quality improvement justifies the cost for civic trivia domain (well-structured with clear success criteria already)
   - Recommendation: Start without examples (rely on detailed guidelines); if first batch has > 40% failure rate, add 2 examples of perfect questions in second batch and compare pass rates

2. **Optimal retry limit**
   - What we know: User decision specifies retry with feedback; no specified limit
   - What's unclear: Point of diminishing returns (does attempt 3 succeed if attempts 1-2 failed?)
   - Recommendation: Start with max 3 retries; track success rate by attempt in generation report; if attempt 3 success rate < 10%, reduce to 2 retries in future runs

3. **Replacement question strategy balance**
   - What we know: User wants "mix of matching removed topics AND filling topic coverage gaps"
   - What's unclear: Exact ratio (50/50? 70/30?)
   - Recommendation: Query archived questions and under-represented topics; generate 50% exact replacements (match archived question topics), 50% gap-fillers (boost topics with < 8 questions per collection)

4. **State template topic distribution tuning**
   - What we know: Equal emphasis on government structure and broader civics; soft guidance not hard limits
   - What's unclear: Whether initial 40/30/30 split produces the right feel for "beginner-friendly" state civics
   - Recommendation: Generate first Indiana batch with 40/30/30; review topic distribution in report; adjust California config based on Indiana results if needed

## Sources

### Primary (HIGH confidence)
- Phase 19 quality rules engine codebase: `backend/src/services/qualityRules/` — Full implementation of 6 rules (ambiguity, lookup, structural, partisan, link-check)
- Phase 17 city generation script: `backend/src/scripts/content-generation/generate-locale-questions.ts` — Working Claude API integration with prompt caching, Zod validation, RAG sources
- Anthropic API rate limits documentation: https://platform.claude.com/docs/en/api/rate-limits — Tier limits, token bucket algorithm, cache-aware ITPM
- Anthropic prompt engineering overview: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/overview — Official best practices for structured output, multishot prompting, XML tags

### Secondary (MEDIUM confidence)
- [Prompt Engineering Best Practices 2026](https://promptbuilder.cc/blog/claude-prompt-engineering-best-practices-2026) — Claude 4.x instruction following, structured output emphasis
- [Few-Shot Prompting Guide](https://mem0.ai/blog/few-shot-prompting-guide) — 2-5 examples sweet spot, diminishing returns research
- [Batch API Cost Optimization](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration) — 50% discount for async batches, prompt caching stacking
- [AI Feedback Loops Best Practices](https://datagrid.com/blog/7-tips-build-self-improving-ai-agents-feedback-loops) — Validation filtering, retry timing, continuous testing
- [Structured Logging Best Practices](https://oneuptime.com/blog/post/2026-01-25-structured-logging-best-practices/view) — JSON Lines format, essential fields, schema design

### Secondary (State Government Research)
- [Indiana State Government Structure](https://www.in.gov/core/democracy.html) — Legislature composition (50 senators, 100 reps), part-time sessions, elected executive officers
- [California State Legislature 2025-2026](https://en.wikipedia.org/wiki/California_State_Legislature,_2025%E2%80%932026_session) — 40 senators, 80 assembly members, full-time legislature
- [California Ballot Propositions](https://ballotpedia.org/California_2026_ballot_propositions) — Initiative process (5% signatures for statute, 8% for amendment), direct democracy features
- [Indiana Civics Education Resources](https://www.in.gov/sos/civics/educators/civics-resources/) — State civics standards, sixth-grade civics requirements (HB 1384)

### Tertiary (LOW confidence - architectural patterns)
- [TypeScript JSON Logging](https://tslog.js.org/) — Structured logging libraries, JSON output formats (not specific to generation reports)
- [Node.js Logging Best Practices](https://betterstack.com/community/guides/logging/nodejs-logging-best-practices/) — General logging patterns (apply to report generation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in use in existing codebase; Phase 19 rules production-ready
- Architecture: HIGH — Validation + retry pattern well-established in AI generation; existing script provides proven template
- State template: MEDIUM — Topic distribution educated guess based on user requirements and state government research; may need tuning after first batch
- Pitfalls: HIGH — Derived from existing codebase patterns, Anthropic docs, and general AI generation best practices

**Research date:** 2026-02-19
**Valid until:** 2026-04-19 (60 days — Claude API stable, quality rules static, state government structures change slowly)

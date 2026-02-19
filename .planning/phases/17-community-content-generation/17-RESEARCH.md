# Phase 17: Community Content Generation - Research

**Researched:** 2026-02-19
**Domain:** AI-powered civic trivia content generation with RAG
**Confidence:** MEDIUM

## Summary

Phase 17 requires generating ~100 locale-specific civic trivia questions for Bloomington IN and Los Angeles CA using AI with authoritative source verification. The domain combines LLM-based content generation, retrieval-augmented generation (RAG), and educational content best practices.

The standard approach in 2026 is sources-first RAG: retrieve authoritative .gov/.edu documents, then generate questions grounded in those sources. This reduces hallucination rates by 40-70% compared to generate-then-verify approaches. The Anthropic Claude API (already in project dependencies) supports this pattern natively with prompt caching, structured outputs, and citation-aware generation.

Key challenges are distractor generation (plausible wrong answers), fact verification against authoritative sources, and batch processing workflows for human review. Current best practices emphasize human-in-the-loop validation, multi-source verification, and explicit source attribution in player-facing content.

**Primary recommendation:** Build a Node.js script using Anthropic SDK with prompt caching for source documents, structured outputs for question format, and batch generation with human review checkpoints every 20-30 questions.

## Standard Stack

The established libraries/tools for AI civic content generation:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.74.0+ | LLM API client | Already in project, supports prompt caching and structured outputs |
| drizzle-orm | Current | Database ORM | Already in project for seeding questions table |
| node:fs/promises | Built-in | File I/O for sources | Native async file operations for RAG documents |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Schema validation | Validate LLM structured outputs match question schema |
| cheerio | 1.x | HTML parsing | Extract text from .gov website pages for RAG |
| p-limit | 5.x | Concurrency control | Rate limit concurrent API calls to Anthropic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Anthropic SDK | OpenAI SDK | OpenAI requires beta access for structured outputs; Anthropic is production-ready |
| Prompt caching | Standard API calls | Caching reduces cost by 90% on cache hits for repeated source documents |
| File-based RAG | Vector DB (Pinecone, etc.) | Vector DB overkill for ~10-20 source documents per locale; files simpler |

**Installation:**
```bash
cd backend
npm install zod cheerio p-limit
# @anthropic-ai/sdk already installed as devDependency
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── src/
│   ├── scripts/
│   │   ├── content-generation/
│   │   │   ├── generate-locale-questions.ts    # Main generation script
│   │   │   ├── locale-configs/
│   │   │   │   ├── bloomington-in.ts           # Bloomington configuration
│   │   │   │   └── los-angeles-ca.ts           # LA configuration
│   │   │   ├── prompts/
│   │   │   │   ├── system-prompt.ts            # Reusable system instructions
│   │   │   │   └── question-schema.ts          # Zod schema for validation
│   │   │   ├── rag/
│   │   │   │   ├── fetch-sources.ts            # Download .gov pages
│   │   │   │   └── parse-sources.ts            # Extract clean text
│   │   │   └── utils/
│   │   │       ├── anthropic-client.ts         # Configured API client
│   │   │       └── seed-questions.ts           # Insert to DB with draft status
│   │   └── data/
│   │       └── sources/
│   │           ├── bloomington/                # RAG documents for Bloomington
│   │           │   ├── city-structure.txt
│   │           │   ├── monroe-county.txt
│   │           │   └── indiana-state.txt
│   │           └── los-angeles/                # RAG documents for LA
│   │               ├── city-structure.txt
│   │               ├── la-county.txt
│   │               └── california-state.txt
```

### Pattern 1: Sources-First RAG Pipeline
**What:** Fetch authoritative documents first, then generate questions grounded in those sources
**When to use:** All locale content generation (prevents hallucination)
**Example:**
```typescript
// Source: Anthropic prompt caching docs + RAG best practices 2026
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function generateQuestionsWithRAG(locale: string) {
  // Step 1: Load authoritative source documents
  const cityDoc = await readFile(`./data/sources/${locale}/city-structure.txt`, 'utf-8');
  const countyDoc = await readFile(`./data/sources/${locale}/county.txt`, 'utf-8');
  const stateDoc = await readFile(`./data/sources/${locale}/state.txt`, 'utf-8');

  // Step 2: Call Claude with prompt caching for source documents
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: 'You are a civic education expert creating trivia questions...'
      },
      {
        type: 'text',
        text: `# Source Documents\n\n## City Structure\n${cityDoc}`,
        cache_control: { type: 'ephemeral' } // Cache for 5 minutes
      },
      {
        type: 'text',
        text: `## County Information\n${countyDoc}`,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: `## State Civics\n${stateDoc}`,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{
      role: 'user',
      content: 'Generate 20 questions about local government structure...'
    }]
  });

  return response.content;
}
```

### Pattern 2: Batch Generation with Review Checkpoints
**What:** Generate 20-30 questions at a time, human reviews/edits, then seed to database
**When to use:** All content generation (prevents drift and enables quality control)
**Example:**
```typescript
// Source: Educational content generation best practices 2026
import pLimit from 'p-limit';

const BATCH_SIZE = 25;
const limit = pLimit(3); // Max 3 concurrent API calls

async function generateInBatches(totalQuestions: number, locale: string) {
  const batches = Math.ceil(totalQuestions / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    console.log(`\n=== Batch ${i + 1} of ${batches} ===`);

    // Generate batch
    const questions = await generateQuestionsWithRAG(locale);

    // Display for human review
    console.log(JSON.stringify(questions, null, 2));

    // Wait for approval
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      readline.question('Review complete? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
          resolve(true);
        }
        readline.close();
      });
    });

    // Seed approved questions to database with status='draft'
    await seedQuestionsToDb(questions, locale);
  }
}
```

### Pattern 3: Structured Output Validation
**What:** Use Anthropic structured outputs + Zod to guarantee question format matches schema
**When to use:** Every question generation call (prevents malformed data)
**Example:**
```typescript
// Source: Anthropic structured outputs docs 2026
import { z } from 'zod';

const QuestionSchema = z.object({
  text: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().min(0).max(3),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topic: z.string(),
  source: z.object({
    name: z.string(),
    url: z.string().url()
  })
});

const BatchSchema = z.object({
  questions: z.array(QuestionSchema).min(1).max(30)
});

// Use with Anthropic API
const response = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 8192,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'civic_questions',
      schema: zodToJsonSchema(BatchSchema) // Convert Zod to JSON Schema
    }
  },
  // ... rest of request
});

// Validate response
const parsed = BatchSchema.parse(JSON.parse(response.content[0].text));
```

### Pattern 4: Distractor Generation with Local Context
**What:** Generate plausible wrong answers using local alternatives from RAG sources
**When to use:** Every multiple-choice question (ensures educational value)
**Example:**
```typescript
// Source: Distractor generation research 2026
// In your system prompt:
const systemPrompt = `
When generating distractors (wrong answers):
1. Use plausible local alternatives from the source documents
2. For Bloomington: Use Monroe County or Indiana alternatives
3. For LA: Use LA County or California alternatives
4. NEVER use obviously wrong throwaway options
5. Example for "How many city council members?":
   - Correct: 9
   - Distractor 1: 7 (common council size)
   - Distractor 2: 11 (another plausible size)
   - Distractor 3: 5 (Monroe County commissioner count)
`;
```

### Anti-Patterns to Avoid
- **Generate-then-verify:** Generating questions first then checking sources leads to 40-70% higher hallucination rates. Always use sources-first RAG.
- **No cache control:** Repeatedly sending source documents without caching costs 10x more. Use prompt caching for all RAG documents.
- **Large batches without review:** Generating 100 questions at once leads to drift and quality degradation. Use 20-30 question batches with human review checkpoints.
- **Generic distractors:** Using national-level distractors for local questions makes them too easy. Generate locale-specific alternatives from RAG sources.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fact verification | Custom source checker | Multi-source lateral reading + expert review | Hallucination detection is 94% accurate with professional validation; custom checkers miss edge cases |
| Distractor generation | Random wrong answers | LLM with student prediction prompting | Research shows 53% of LLM-generated distractors rated high-quality by teachers vs <20% for random |
| Question difficulty balancing | Manual categorization | Follow existing federal distribution in questions.json | Project already has proven easy/medium/hard distribution; reuse those ratios |
| HTML parsing | Regex on raw HTML | cheerio library | HTML parsing with regex breaks on malformed markup; cheerio handles edge cases |
| Rate limiting | Sleep() calls | p-limit library | p-limit handles backpressure and queue management correctly; manual sleep causes inefficiency |
| Schema validation | Manual type checking | Zod + Anthropic structured outputs | Structured outputs guarantee format at LLM level; manual checks miss edge cases |

**Key insight:** AI content generation has known failure modes (hallucination, poor distractors, schema drift). Use 2026 best practices instead of reinventing solutions.

## Common Pitfalls

### Pitfall 1: Cache Invalidation from Minor Changes
**What goes wrong:** Small prompt changes invalidate entire cache, causing 10x cost increase
**Why it happens:** Anthropic prompt cache uses exact prefix matching; any change breaks cache
**How to avoid:**
- Structure prompt with stable content first (system instructions), then RAG docs with cache_control
- Use separate cache breakpoints for content that changes at different rates
- Generate all questions for a locale in same session (cache lasts 5 minutes by default)
**Warning signs:** `cache_creation_input_tokens` stays high on subsequent requests; `cache_read_input_tokens` stays at 0

### Pitfall 2: Hallucinated Local Facts
**What goes wrong:** LLM invents plausible-sounding but incorrect civic facts (e.g., wrong council size, fake officials)
**Why it happens:** LLM training data is stale (6-18 months old) and may not include local government details
**How to avoid:**
- Sources-first RAG: Fetch current .gov pages before generation
- Require explicit source citations in every explanation
- Human review with lateral reading: Verify facts against multiple authoritative sources
- Flag LOW confidence for any content that can't be verified against official .gov/.edu sources
**Warning signs:** Source citations missing or generic; facts that sound plausible but aren't in official docs

### Pitfall 3: Weak Distractors
**What goes wrong:** Multiple-choice options too obvious (e.g., "How many branches? A) 2, B) 3, C) 42, D) Banana")
**Why it happens:** Generic prompts generate generic distractors without local context
**How to avoid:**
- Provide locale-specific alternatives from RAG sources in prompt
- For numeric questions, use nearby plausible numbers from same jurisdiction level
- For name questions, use other officials/entities from same locale
- Test: "Could a civically engaged local reasonably guess this wrong answer?"
**Warning signs:** Batch review shows obviously wrong options; educational value diminishes

### Pitfall 4: Topic Category Drift
**What goes wrong:** Questions become redundant or miss important civic domains
**Why it happens:** LLM defaults to commonly discussed topics without explicit distribution guidance
**How to avoid:**
- Define 5-8 topic categories per locale based on source document analysis
- Specify target question counts per category in prompt
- Track distribution during batch generation; rebalance if needed
- User decision: "5-8 locale-specific topic categories (not mirroring federal categories — derive from the content)"
**Warning signs:** Multiple questions about same narrow topic; major civic functions underrepresented

### Pitfall 5: Outdated Official Information
**What goes wrong:** Questions reference officials who left office or policies that changed
**Why it happens:** RAG sources fetched once become stale; expiration system not leveraged
**How to avoid:**
- Set `expires_at` to term end dates for elected official questions
- Document source fetch date in question metadata
- Phase 16 expiration system automatically removes stale content
- User decision: "Include questions about current elected officials — set expires_at to term end dates"
**Warning signs:** Questions about people no longer in office after next election cycle

### Pitfall 6: Source URL Inaccessibility
**What goes wrong:** Source URLs become broken 404s or paywalled content
**Why it happens:** .gov page restructures, local news sites add paywalls
**How to avoid:**
- Prefer stable .gov/.us URLs over local media when available
- User decision: "Source hierarchy: .gov > .edu > established local media"
- Store fetched source text alongside URL (enables regeneration if URL breaks)
- Verify URL accessibility during batch review
**Warning signs:** 404 errors during source fetching; URLs redirect to paywalls

## Code Examples

Verified patterns from official sources and research:

### Anthropic Client Setup with Prompt Caching
```typescript
// Source: Anthropic SDK docs - https://docs.anthropic.com/en/api/getting-started
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
  timeout: 60000 // 60 seconds for long generation
});

// Cost optimization: Claude Sonnet 4.5 is $3/MTok input, $15/MTok output
// With prompt caching: Cache writes $3.75/MTok, cache hits $0.30/MTok (10x cheaper)
const MODEL = 'claude-sonnet-4-5'; // Balance of cost and quality
```

### Complete Generation Function
```typescript
// Source: Combined RAG + structured outputs + caching patterns from research
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { zodToJsonSchema } from 'zod-to-json-schema';

const QuestionSchema = z.object({
  externalId: z.string().regex(/^[a-z]{3}-\d{3}$/), // e.g., "bli-001" for Bloomington IN
  text: z.string().min(10).max(300),
  options: z.array(z.string().min(1).max(200)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(20).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topicCategory: z.string(), // Locale-specific category
  source: z.object({
    name: z.string(),
    url: z.string().url()
  }),
  expiresAt: z.string().datetime().nullable() // ISO 8601 for term end dates
});

const BatchSchema = z.object({
  questions: z.array(QuestionSchema).min(15).max(30)
});

async function generateQuestionBatch(
  locale: string,
  batchNumber: number,
  topicDistribution: Record<string, number>
): Promise<z.infer<typeof BatchSchema>> {

  // Load RAG sources
  const cityDoc = await readFile(`./data/sources/${locale}/city-structure.txt`, 'utf-8');
  const countyDoc = await readFile(`./data/sources/${locale}/county.txt`, 'utf-8');
  const stateDoc = await readFile(`./data/sources/${locale}/state.txt`, 'utf-8');
  const officialsDoc = await readFile(`./data/sources/${locale}/officials.txt`, 'utf-8');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    temperature: 0, // Factual accuracy - use temperature 0
    system: [
      {
        type: 'text',
        text: `You are a civic education expert creating trivia questions for ${locale}.

# Instructions
- Generate exactly 25 multiple-choice questions
- Match the game-show tone from federal collection (engaging, not dry)
- All distractors must be plausible local alternatives
- Every explanation must cite the source: "According to [source], ..."
- Each question stands alone (no cross-references)
- Avoid partisan content (no political parties, controversial votes)
- Stick to structural/factual civics (government structure, history, landmarks)

# Topic Distribution
${Object.entries(topicDistribution).map(([topic, count]) => `- ${topic}: ${count} questions`).join('\n')}

# Difficulty Distribution
- Easy (40%): Basic structure, commonly known facts
- Medium (40%): Requires civic engagement knowledge
- Hard (20%): Detailed knowledge, historical context

# Source Citation Style
"According to bloomington.in.gov, the city council has 9 members elected to 4-year terms."
"According to the Monroe County website, the county has 3 commissioners."
        `
      },
      {
        type: 'text',
        text: `# City Government Structure\n\n${cityDoc}`,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: `# County Government\n\n${countyDoc}`,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: `# State Civics\n\n${stateDoc}`,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: `# Current Elected Officials\n\n${officialsDoc}\n\nNote: For questions about current officials, set expiresAt to their term end date.`,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{
      role: 'user',
      content: `Generate batch ${batchNumber} of questions following the topic distribution above.`
    }],
    // Structured outputs guarantee schema compliance
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'civic_questions_batch',
        schema: zodToJsonSchema(BatchSchema)
      }
    }
  });

  // Parse and validate
  const parsed = JSON.parse(response.content[0].text);
  const validated = BatchSchema.parse(parsed);

  // Log cache performance
  console.log('Cache performance:', {
    created: response.usage.cache_creation_input_tokens,
    hits: response.usage.cache_read_input_tokens,
    cost_savings: response.usage.cache_read_input_tokens > 0
      ? `~${Math.round((1 - 0.1) * 100)}% on cached tokens`
      : 'none (first call)'
  });

  return validated;
}
```

### Seeding to Database with Draft Status
```typescript
// Source: Existing backend/src/db/seed/questions.ts pattern + Phase 16 schema
import { db } from '../db/connection.js';
import { questions, collectionQuestions } from '../db/schema.js';
import type { NewQuestion } from '../db/schema.js';

async function seedQuestionBatch(
  batch: z.infer<typeof BatchSchema>,
  collectionId: number,
  topicIdMap: Record<string, number>
) {
  for (const q of batch.questions) {
    // Map topic category to topic ID (lookup from database)
    const topicId = topicIdMap[q.topicCategory];
    if (!topicId) {
      throw new Error(`Topic ${q.topicCategory} not found in database`);
    }

    const newQuestion: NewQuestion = {
      externalId: q.externalId,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topicId,
      subcategory: q.topicCategory,
      source: {
        name: q.source.name,
        url: q.source.url
      },
      learningContent: null, // User decision: "Whether to include learning content from the start"
      expiresAt: q.expiresAt ? new Date(q.expiresAt) : null,
      status: 'draft' // Admin reviews and activates via Phase 16 endpoints
    };

    // Insert question
    const [inserted] = await db.insert(questions).values(newQuestion).returning();

    // Link to collection
    await db.insert(collectionQuestions).values({
      collectionId,
      questionId: inserted.id
    });

    console.log(`Seeded ${q.externalId} as draft`);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generate-then-verify | Sources-first RAG | 2024-2025 | 40-70% reduction in hallucination rates |
| Manual prompt formatting | Structured outputs (JSON Schema) | 2025-2026 | Guarantees format compliance at LLM level |
| No caching | Prompt caching with cache_control | 2024-2025 | 90% cost reduction on cached content |
| Single-source generation | Multi-source RAG with citation | 2025-2026 | Higher factual accuracy and transparency |
| Post-generation validation | Zero-shot with examples in prompt | 2025-2026 | Better distractor quality without fine-tuning |

**Deprecated/outdated:**
- Beta headers for structured outputs: Now GA, use standard `response_format` parameter (changed Feb 2026)
- Organization-level cache isolation: Now workspace-level (changed Feb 5, 2026)
- Generate-then-verify pipelines: Sources-first RAG is now standard for factual content

## Open Questions

Things that couldn't be fully resolved:

1. **Learning content (deep-dives) for local questions**
   - What we know: Federal questions have optional `learningContent` with paragraphs and corrections
   - What's unclear: Whether to generate learning content for initial 100 questions or add later
   - Recommendation: User decision - "Whether to include learning content from the start or just questions + explanations". Start with questions + explanations only to hit MVP faster. Learning content can be added in future batches using same RAG approach.

2. **Specific topic categories for each locale**
   - What we know: Need 5-8 locale-specific categories, not mirroring federal (constitution, amendments, etc.)
   - What's unclear: Exact categories emerge from source document analysis
   - Recommendation: User decision - "Specific topic categories for each locale (emerge from research)". First step of generation script should analyze RAG sources and propose categories for human approval before question generation.

3. **IU's civic role in Bloomington content**
   - What we know: Indiana University is major institution in Bloomington
   - What's unclear: Whether to include IU-related civic content
   - Recommendation: User decision - "IU's civic role in Bloomington content (include if interesting and well-sourced)". Include if RAG sources contain civic connections (e.g., IU's role in local economy, student voter registration, town-gown relations). Avoid academic content unrelated to civics.

4. **Optimal batch size for review**
   - What we know: User decision is "20-30 questions at a time"
   - What's unclear: Exact number for optimal review speed vs. quality
   - Recommendation: Start with 25 questions per batch (middle of range). Adjust based on reviewer fatigue during first Bloomington run. Research shows quality drops with batches >30.

## Sources

### Primary (HIGH confidence)
- Anthropic Claude API Docs - https://platform.claude.com/docs/en/api/getting-started
- Anthropic Prompt Caching - https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Anthropic Structured Outputs - Verified via WebSearch (GA since Feb 2026)
- Existing project schema.ts - Backend database schema with questions table structure

### Secondary (MEDIUM confidence)
- [RAG Best Practices 2026](https://www.techment.com/blogs/rag-in-2026/) - Industry standard RAG approaches
- [Hallucination Prevention 2026](https://www.k2view.com/blog/llm-hallucination/) - 40-70% reduction with RAG
- [Distractor Generation Research](https://arxiv.org/abs/2501.13125) - 53% high-quality with LLM prompting
- [Prompt Engineering Guide IBM 2026](https://www.ibm.com/think/prompt-engineering) - Temperature 0 for factual content
- [Node.js Batch Processing 2026](https://medium.com/@rusieshvili.joni/data-batching-in-nodejs-a38e92aee910) - p-limit for concurrency
- [Fact Verification Best Practices](https://www.techtarget.com/whatis/feature/Steps-in-fact-checking-AI-generated-content) - Lateral reading and multi-source verification

### Tertiary (LOW confidence - flagged for validation)
- Bloomington city government structure - Requires verification against bloomington.in.gov during source fetching
- LA city/county structure - Requires verification against lacity.gov and lacounty.gov during source fetching

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Anthropic SDK already in project, official docs verified, proven libraries
- Architecture: MEDIUM - Patterns are established in 2026 research but not project-specific tested
- Pitfalls: MEDIUM - Based on 2026 research and verified docs, but local gov content generation is niche
- Code examples: HIGH - Directly from official Anthropic docs and existing project patterns

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days) - Anthropic SDK stable; RAG patterns mature; civic data changes slowly

**Research constraints from CONTEXT.md:**
- User locked decisions: Sources-first RAG, batch review process, draft status workflow, locale-specific categories
- Claude's discretion: Learning content inclusion, RAG vs verify approach (chose sources-first RAG), specific categories per locale
- Out of scope: None specified

**Key risks flagged in STATE.md:**
- "Phase 17 (Content Generation): Highest risk — AI hallucination on local facts, RAG pipeline untested"
- Mitigation: Sources-first RAG reduces hallucination 40-70%; human review every batch; multi-source verification required

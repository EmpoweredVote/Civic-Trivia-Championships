// Usage:
//   npx tsx src/scripts/content-generation/generate-replacements.ts [--dry-run] [--collection slug]
//
// Run from backend/ directory. Requires ANTHROPIC_API_KEY in .env or environment.
// Requires DATABASE_URL in .env for database operations (not needed with --dry-run).
//
// Generates replacement questions for collections that lost questions during Phase 19 archival.
// Uses quality validation pipeline to ensure all replacements meet quality standards.

import 'dotenv/config';
import { join } from 'path';
import type { MessageParam, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js';

import { client, MODEL } from './anthropic-client.js';
import { BatchSchema, type ValidatedQuestion } from './question-schema.js';
import { buildSystemPrompt } from './prompts/system-prompt.js';
import { loadSourceDocuments } from './rag/parse-sources.js';
import type { LocaleConfig } from './locale-configs/bloomington-in.js';
import { validateAndRetry, createReport, saveReport } from './utils/quality-validation.js';
import { db } from '../../db/index.js';
import { questions as questionsTable, collections, collectionQuestions, topics, collectionTopics } from '../../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function parseArgs(): {
  collection: string | null;
  dryRun: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    collection: null as string | null,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--collection' && args[i + 1]) {
      result.collection = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      result.dryRun = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      result.help = true;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Usage: npx tsx src/scripts/content-generation/generate-replacements.ts [options]

Options:
  --collection <slug>  Generate replacements for specific collection only
                       Supported: bloomington-in, los-angeles-ca
  --dry-run           Generate and validate questions but do not seed to database
  --help, -h          Show this help message

Examples:
  npx tsx src/scripts/content-generation/generate-replacements.ts
  npx tsx src/scripts/content-generation/generate-replacements.ts --collection bloomington-in
  npx tsx src/scripts/content-generation/generate-replacements.ts --dry-run
`);
}

// ─── Locale config loader ─────────────────────────────────────────────────────

async function loadLocaleConfig(locale: string): Promise<LocaleConfig> {
  const supportedLocales: Record<string, () => Promise<{ [key: string]: unknown }>> = {
    'bloomington-in': () => import('./locale-configs/bloomington-in.js'),
    'los-angeles-ca': () => import('./locale-configs/los-angeles-ca.js'),
  };

  const loader = supportedLocales[locale];
  if (!loader) {
    const supported = Object.keys(supportedLocales).join(', ');
    throw new Error(`Unknown locale "${locale}". Supported: ${supported}`);
  }

  const module = await loader();

  // Extract the config from the module (different export names per file)
  const configKeys = ['bloomingtonConfig', 'losAngelesConfig'];
  for (const key of configKeys) {
    if (module[key]) return module[key] as LocaleConfig;
  }

  throw new Error(`Could not find config export in locale module for "${locale}"`);
}

// ─── Archived questions analysis ──────────────────────────────────────────────

interface ArchivedAnalysis {
  collectionSlug: string;
  collectionId: number;
  collectionName: string;
  archivedCount: number;
  archivedTopics: Record<string, number>; // topic slug -> count
  topicGaps: Record<string, number>; // topics with < 8 active questions
  targetReplacements: number;
}

async function analyzeArchivedQuestions(
  collectionSlug?: string
): Promise<ArchivedAnalysis[]> {
  console.log('\n[Analyzing archived questionsTable...]');

  // Get collections with archived questions
  const collectionsQuery = await db
    .select({
      collectionId: collections.id,
      collectionSlug: collections.slug,
      collectionName: collections.name,
    })
    .from(collections)
    .where(collectionSlug ? eq(collections.slug, collectionSlug) : sql`true`);

  const analyses: ArchivedAnalysis[] = [];

  for (const collection of collectionsQuery) {
    // Count archived questions per topic
    const archivedQuestions = await db
      .select({
        subcategory: questionsTable.subcategory,
        count: sql<number>`count(*)::int`,
      })
      .from(questionsTable)
      .innerJoin(collectionQuestions, eq(questionsTable.id, collectionQuestions.questionId))
      .where(
        and(
          eq(collectionQuestions.collectionId, collection.collectionId),
          eq(questionsTable.status, 'archived')
        )
      )
      .groupBy(questionsTable.subcategory);

    const archivedCount = archivedQuestions.reduce((sum, row) => sum + row.count, 0);

    if (archivedCount === 0) {
      console.log(`  ${collection.collectionName}: No archived questions (skipping)`);
      continue;
    }

    // Count active questions per topic to find gaps
    const activeTopicCounts = await db
      .select({
        subcategory: questionsTable.subcategory,
        count: sql<number>`count(*)::int`,
      })
      .from(questionsTable)
      .innerJoin(collectionQuestions, eq(questionsTable.id, collectionQuestions.questionId))
      .where(
        and(
          eq(collectionQuestions.collectionId, collection.collectionId),
          eq(questionsTable.status, 'active')
        )
      )
      .groupBy(questionsTable.subcategory);

    const archivedTopics: Record<string, number> = {};
    for (const row of archivedQuestions) {
      if (row.subcategory) {
        archivedTopics[row.subcategory] = row.count;
      }
    }

    const topicGaps: Record<string, number> = {};
    for (const row of activeTopicCounts) {
      if (row.count < 8 && row.subcategory) {
        topicGaps[row.subcategory] = 8 - row.count; // How many needed to reach 8
      }
    }

    const targetReplacements = 18; // ~15-20 per collection as specified

    analyses.push({
      collectionSlug: collection.collectionSlug,
      collectionId: collection.collectionId,
      collectionName: collection.collectionName,
      archivedCount,
      archivedTopics,
      topicGaps,
      targetReplacements,
    });

    console.log(`  ${collection.collectionName}:`);
    console.log(`    Archived: ${archivedCount} questions`);
    console.log(`    Topics affected: ${Object.keys(archivedTopics).join(', ')}`);
    console.log(`    Topic gaps (< 8 active): ${Object.keys(topicGaps).length > 0 ? Object.keys(topicGaps).join(', ') : 'None'}`);
    console.log(`    Target replacements: ${targetReplacements}`);
  }

  return analyses;
}

// ─── External ID management ───────────────────────────────────────────────────

async function getNextExternalId(collectionId: number, prefix: string): Promise<number> {
  // Find max external ID for this collection's prefix
  const result = await db
    .select({
      maxId: sql<string>`MAX(SUBSTRING(${questionsTable.externalId} FROM '[0-9]+')::int)`,
    })
    .from(questionsTable)
    .innerJoin(collectionQuestions, eq(questionsTable.id, collectionQuestions.questionId))
    .where(
      and(
        eq(collectionQuestions.collectionId, collectionId),
        sql`${questionsTable.externalId} LIKE ${prefix + '-%'}`
      )
    );

  const maxId = result[0]?.maxId ? parseInt(result[0].maxId, 10) : 0;
  return maxId + 1;
}

// ─── Topic distribution calculation ───────────────────────────────────────────

function calculateReplacementDistribution(
  analysis: ArchivedAnalysis,
  targetCount: number
): Record<string, number> {
  const distribution: Record<string, number> = {};

  // Allocate ~50% to archived topics
  const archivedTopicSlugs = Object.keys(analysis.archivedTopics);
  const archivedAllocation = Math.floor(targetCount * 0.5);
  const perArchivedTopic = Math.ceil(archivedAllocation / Math.max(archivedTopicSlugs.length, 1));

  for (const topic of archivedTopicSlugs) {
    distribution[topic] = perArchivedTopic;
  }

  // Allocate ~50% to topic gaps
  const gapTopicSlugs = Object.keys(analysis.topicGaps);
  const gapAllocation = targetCount - archivedAllocation;

  if (gapTopicSlugs.length > 0) {
    const perGapTopic = Math.ceil(gapAllocation / gapTopicSlugs.length);
    for (const topic of gapTopicSlugs) {
      distribution[topic] = (distribution[topic] || 0) + perGapTopic;
    }
  } else {
    // No gaps, distribute remaining to archived topics
    for (const topic of archivedTopicSlugs) {
      distribution[topic] += Math.floor(gapAllocation / archivedTopicSlugs.length);
    }
  }

  return distribution;
}

// ─── Question generation with quality validation ──────────────────────────────

async function generateReplacementBatch(
  config: LocaleConfig,
  analysis: ArchivedAnalysis,
  topicDistribution: Record<string, number>,
  startId: number,
  sourceDocuments: string[],
  tokenTracker: {
    input: number;
    output: number;
    cacheCreation: number;
    cacheRead: number;
  }
): Promise<ValidatedQuestion[]> {
  const batchSize = Object.values(topicDistribution).reduce((sum, count) => sum + count, 0);

  console.log(`\n--- Generating ${batchSize} replacements for ${config.name} ---`);
  console.log(`  Topic distribution:`);
  for (const [topic, count] of Object.entries(topicDistribution)) {
    console.log(`    ${topic}: ${count}`);
  }

  const systemPromptText = buildSystemPrompt(config.name, topicDistribution);

  const endId = startId + batchSize - 1;
  const userMessage = `Generate ${batchSize} civic trivia questions for ${config.name}.

These are REPLACEMENT questions for questions that were removed due to quality issues. Focus on:
- Topics that lost questions: ${Object.keys(analysis.archivedTopics).join(', ')}
- Topics needing more coverage: ${Object.keys(analysis.topicGaps).length > 0 ? Object.keys(analysis.topicGaps).join(', ') : 'None'}

External ID range for this batch: ${config.externalIdPrefix}-${String(startId).padStart(3, '0')} through ${config.externalIdPrefix}-${String(endId).padStart(3, '0')}

Topic distribution for this batch:
${Object.entries(topicDistribution).map(([slug, count]) => `- ${slug}: ${count} questions`).join('\n')}

Generate exactly ${batchSize} questionsTable. Return ONLY the JSON object with a "questions" array.`;

  // Build messages with prompt caching for source documents
  const messages: MessageParam[] = [];

  if (sourceDocuments.length > 0) {
    const sourceContent: ContentBlockParam[] = [
      {
        type: 'text',
        text: `Here are the authoritative source documents for ${config.name}. Use these to ensure factual accuracy in your questions:\n\n`,
      },
      ...sourceDocuments.map((doc, idx) => ({
        type: 'text' as const,
        text: doc,
        ...(idx === sourceDocuments.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
      })),
      {
        type: 'text',
        text: `\n\n${userMessage}`,
      },
    ];

    messages.push({ role: 'user', content: sourceContent });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  console.log(`  Calling Anthropic API (model: ${MODEL})...`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    temperature: 0,
    system: systemPromptText,
    messages,
  });

  // Track token usage
  const usage = response.usage as {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  tokenTracker.input += usage.input_tokens;
  tokenTracker.output += usage.output_tokens;
  tokenTracker.cacheCreation += usage.cache_creation_input_tokens || 0;
  tokenTracker.cacheRead += usage.cache_read_input_tokens || 0;

  console.log(`  Tokens: ${usage.input_tokens} in, ${usage.output_tokens} out`);
  if (usage.cache_creation_input_tokens) {
    console.log(`  Cache created: ${usage.cache_creation_input_tokens} tokens`);
  }
  if (usage.cache_read_input_tokens) {
    console.log(`  Cache read: ${usage.cache_read_input_tokens} tokens (saved!)`);
  }

  const contentBlock = response.content[0];
  if (contentBlock.type !== 'text') {
    throw new Error(`Unexpected response content type: ${contentBlock.type}`);
  }

  // Extract JSON from response
  const responseText = contentBlock.text.trim();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON object found in response. Response preview: ${responseText.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(`Failed to parse JSON response: ${err instanceof Error ? err.message : err}`);
  }

  // Validate with Zod schema
  const validated = BatchSchema.parse(parsed);

  return validated.questions;
}

async function regenerateWithFeedback(
  config: LocaleConfig,
  analysis: ArchivedAnalysis,
  topicDistribution: Record<string, number>,
  failedQuestion: ValidatedQuestion,
  violationMessages: string,
  sourceDocuments: string[],
  tokenTracker: {
    input: number;
    output: number;
    cacheCreation: number;
    cacheRead: number;
  }
): Promise<ValidatedQuestion> {
  console.log(`  Regenerating ${failedQuestion.externalId} with feedback...`);

  const systemPromptText = buildSystemPrompt(config.name, topicDistribution);

  const userMessage = `The following question failed quality validation. Please regenerate it addressing these issues:

VIOLATIONS: ${violationMessages}

ORIGINAL QUESTION:
${JSON.stringify(failedQuestion, null, 2)}

Generate a corrected version of this question that fixes the violations. Return ONLY valid JSON with a single "question" object matching the schema.`;

  const messages: MessageParam[] = [{ role: 'user', content: userMessage }];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: systemPromptText,
    messages,
  });

  // Track token usage
  const usage = response.usage as {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  tokenTracker.input += usage.input_tokens;
  tokenTracker.output += usage.output_tokens;
  tokenTracker.cacheCreation += usage.cache_creation_input_tokens || 0;
  tokenTracker.cacheRead += usage.cache_read_input_tokens || 0;

  const contentBlock = response.content[0];
  if (contentBlock.type !== 'text') {
    throw new Error(`Unexpected response content type during regeneration`);
  }

  const responseText = contentBlock.text.trim();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON in regeneration response`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Handle both {question: {...}} and {...} formats
  const questionData = parsed.question || parsed;

  // Validate the regenerated question
  return BatchSchema.parse({ questions: [questionData] }).questions[0];
}

// ─── Seed questions to database ───────────────────────────────────────────────

async function seedReplacements(
  questionsToSeed: ValidatedQuestion[],
  collectionId: number,
  topicIdMap: Record<string, number>
): Promise<{ seeded: number; skipped: number }> {
  let seeded = 0;
  let skipped = 0;

  for (const question of questionsToSeed) {
    const topicId = topicIdMap[question.topicCategory];

    if (!topicId) {
      console.warn(`  Warning: No topicId found for category "${question.topicCategory}" — skipping ${question.externalId}`);
      skipped++;
      continue;
    }

    const newQuestion = {
      externalId: question.externalId,
      text: question.text,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      topicId,
      subcategory: question.topicCategory,
      source: question.source,
      learningContent: null,
      expiresAt: question.expiresAt ? new Date(question.expiresAt) : null,
      status: 'active' as const, // Insert as active per plan requirements
      expirationHistory: [],
    };

    const inserted = await db
      .insert(questionsTable)
      .values(newQuestion)
      .onConflictDoNothing()
      .returning({ id: questionsTable.id });

    if (!inserted || inserted.length === 0) {
      console.log(`  Skipped (duplicate): ${question.externalId}`);
      skipped++;
      continue;
    }

    const questionId = inserted[0].id;

    // Link question to collection
    await db
      .insert(collectionQuestions)
      .values({ collectionId, questionId })
      .onConflictDoNothing();

    seeded++;
  }

  console.log(`  Seeded: ${seeded} questions, Skipped: ${skipped} duplicates`);
  return { seeded, skipped };
}

// ─── Ensure topics exist ──────────────────────────────────────────────────────

async function ensureTopicsExist(
  collectionId: number,
  topicCategories: Array<{ slug: string; name: string; description: string }>
): Promise<Record<string, number>> {
  const topicIdMap: Record<string, number> = {};

  for (const category of topicCategories) {
    const existing = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.slug, category.slug))
      .limit(1);

    let topicId: number;

    if (existing.length > 0) {
      topicId = existing[0].id;
    } else {
      const [inserted] = await db
        .insert(topics)
        .values({
          name: category.name,
          slug: category.slug,
          description: category.description,
        })
        .onConflictDoNothing()
        .returning({ id: topics.id });

      if (!inserted) {
        const [retry] = await db
          .select({ id: topics.id })
          .from(topics)
          .where(eq(topics.slug, category.slug))
          .limit(1);
        topicId = retry.id;
      } else {
        topicId = inserted.id;
      }
    }

    // Link topic to collection
    await db
      .insert(collectionTopics)
      .values({ collectionId, topicId })
      .onConflictDoNothing();

    topicIdMap[category.slug] = topicId;
  }

  return topicIdMap;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('Add ANTHROPIC_API_KEY=sk-... to backend/.env');
    process.exit(1);
  }

  console.log(`\nReplacement Question Generator`);
  console.log(`==============================`);
  console.log(`Dry run: ${args.dryRun}`);
  if (args.collection) console.log(`Collection filter: ${args.collection}`);

  // Analyze archived questions
  const analyses = await analyzeArchivedQuestions(args.collection || undefined);

  if (analyses.length === 0) {
    console.log('\nNo collections found with archived questionsTable. Nothing to do.');
    process.exit(0);
  }

  const tokenTracker = {
    input: 0,
    output: 0,
    cacheCreation: 0,
    cacheRead: 0,
  };

  const allResults: Array<{
    collection: string;
    generated: ValidatedQuestion[];
    seeded: number;
    skipped: number;
  }> = [];

  // Process each collection
  for (const analysis of analyses) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${analysis.collectionName}`);
    console.log(`${'='.repeat(60)}`);

    // Load locale config
    const config = await loadLocaleConfig(analysis.collectionSlug);

    // Load source documents (from existing sources - don't re-fetch)
    const dataDir = join(process.cwd(), 'src/scripts/data/sources', analysis.collectionSlug);
    console.log(`\n[Loading source documents from ${dataDir}...]`);
    const sourceDocuments = await loadSourceDocuments(dataDir);
    console.log(`  Loaded: ${sourceDocuments.length} source documents`);

    // Calculate topic distribution
    const topicDistribution = calculateReplacementDistribution(
      analysis,
      analysis.targetReplacements
    );

    // Get next external ID
    const nextId = await getNextExternalId(analysis.collectionId, config.externalIdPrefix);
    console.log(`  Next external ID: ${config.externalIdPrefix}-${String(nextId).padStart(3, '0')}`);

    // Generate questions
    const batchQuestions = await generateReplacementBatch(
      config,
      analysis,
      topicDistribution,
      nextId,
      sourceDocuments,
      tokenTracker
    );

    console.log(`\n[Quality validation with retry loop...]`);

    // Validate with retry
    const validationResult = await validateAndRetry(
      batchQuestions,
      (failedQ, violations) =>
        regenerateWithFeedback(
          config,
          analysis,
          topicDistribution,
          failedQ,
          violations,
          sourceDocuments,
          tokenTracker
        ),
      { maxRetries: 3, skipUrlCheck: true }
    );

    console.log(`\n  Validation complete:`);
    console.log(`    Passed: ${validationResult.passed.length}`);
    console.log(`    Failed: ${validationResult.failed.length}`);

    let seeded = 0;
    let skipped = 0;

    if (!args.dryRun) {
      console.log(`\n[Seeding to database...]`);

      // Ensure topics exist
      const topicIdMap = await ensureTopicsExist(
        analysis.collectionId,
        config.topicCategories
      );

      // Seed questions
      const result = await seedReplacements(
        validationResult.passed,
        analysis.collectionId,
        topicIdMap
      );
      seeded = result.seeded;
      skipped = result.skipped;
    }

    allResults.push({
      collection: analysis.collectionSlug,
      generated: validationResult.passed,
      seeded,
      skipped,
    });
  }

  const endTime = Date.now();
  const duration = endTime - startTime;

  // Generate report
  console.log(`\n[Generating report...]`);

  const allGenerated = allResults.flatMap(r => r.generated);
  const totalSeeded = allResults.reduce((sum, r) => sum + r.seeded, 0);

  const byDifficulty: Record<string, number> = {};
  const byTopic: Record<string, number> = {};
  for (const q of allGenerated) {
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
    byTopic[q.topicCategory] = (byTopic[q.topicCategory] || 0) + 1;
  }

  // Cost estimation (Claude 3.5 Sonnet pricing)
  const inputCost = (tokenTracker.input * 3) / 1_000_000; // $3 per 1M input tokens
  const outputCost = (tokenTracker.output * 15) / 1_000_000; // $15 per 1M output tokens
  const cacheCost = (tokenTracker.cacheCreation * 3.75) / 1_000_000; // $3.75 per 1M cache write
  const cacheReadCost = (tokenTracker.cacheRead * 0.3) / 1_000_000; // $0.30 per 1M cache read
  const estimatedCost = inputCost + outputCost + cacheCost + cacheReadCost;

  const report = createReport(
    'replacements',
    {
      targetQuestions: analyses.reduce((sum, a) => sum + a.targetReplacements, 0),
      batchSize: allGenerated.length,
      maxRetries: 3,
    },
    {
      passed: allGenerated,
      failed: [],
      stats: {
        totalAttempts: allGenerated.length,
        successByAttempt: { 0: allGenerated.length },
        violationsByRule: {},
      },
    },
    {
      totalDurationMs: duration,
      apiCalls: analyses.length,
      tokensUsed: {
        input: tokenTracker.input,
        output: tokenTracker.output,
        cached: tokenTracker.cacheRead,
      },
      estimatedCostUsd: estimatedCost,
    },
    {
      byDifficulty,
      byTopic,
    }
  );

  await saveReport(report);

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generation Complete`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Collections processed: ${analyses.length}`);
  console.log(`Total generated: ${allGenerated.length} questions`);

  if (!args.dryRun) {
    console.log(`Seeded to database: ${totalSeeded}`);
    console.log(`\nQuestions are 'active' status — ready for gameplay.`);
  } else {
    console.log(`\n[DRY RUN] No questions were seeded to database.`);
  }

  console.log(`\nToken usage:`);
  console.log(`  Input: ${tokenTracker.input.toLocaleString()}`);
  console.log(`  Output: ${tokenTracker.output.toLocaleString()}`);
  console.log(`  Cache creation: ${tokenTracker.cacheCreation.toLocaleString()}`);
  console.log(`  Cache read: ${tokenTracker.cacheRead.toLocaleString()}`);
  console.log(`\nEstimated cost: $${estimatedCost.toFixed(2)}`);

  console.log(`\nPer-collection breakdown:`);
  for (const result of allResults) {
    console.log(`  ${result.collection}: ${result.generated.length} generated, ${result.seeded} seeded`);
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});

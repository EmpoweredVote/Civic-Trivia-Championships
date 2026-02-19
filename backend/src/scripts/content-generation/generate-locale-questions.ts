// Usage:
//   npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale bloomington-in --fetch-sources
//   npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale bloomington-in --batch 1 --dry-run
//   npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale los-angeles-ca
//   npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale los-angeles-ca --batch 2 --dry-run
//   npx tsx src/scripts/content-generation/generate-locale-questions.ts --help
//
// Run from backend/ directory. Requires ANTHROPIC_API_KEY in .env or environment.
// Requires DATABASE_URL in .env for database seeding (not needed with --dry-run).
//
// Generates locale-specific civic trivia questions using Claude AI with RAG source documents.
// Questions are validated with Zod schema and seeded to database with status='draft'.

import 'dotenv/config';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type { MessageParam, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js';

import { client, MODEL } from './anthropic-client.js';
import { BatchSchema, type ValidatedQuestion } from './question-schema.js';
import { buildSystemPrompt } from './prompts/system-prompt.js';
import { fetchSources } from './rag/fetch-sources.js';
import { loadSourceDocuments } from './rag/parse-sources.js';
import type { LocaleConfig } from './locale-configs/bloomington-in.js';

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function parseArgs(): {
  locale: string | null;
  batch: number | null;
  fetchSources: boolean;
  dryRun: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    locale: null as string | null,
    batch: null as number | null,
    fetchSources: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--locale' && args[i + 1]) {
      result.locale = args[i + 1];
      i++;
    } else if (args[i] === '--batch' && args[i + 1]) {
      result.batch = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--fetch-sources') {
      result.fetchSources = true;
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
Usage: npx tsx src/scripts/content-generation/generate-locale-questions.ts [options]

Options:
  --locale <slug>     Locale to generate questions for (required)
                      Supported: bloomington-in, los-angeles-ca
  --batch <N>         Generate only batch N (1-indexed). Default: all batches.
  --fetch-sources     Re-fetch and save RAG source documents before generating
  --dry-run           Generate and validate questions but do not seed to database
  --help, -h          Show this help message

Examples:
  npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale bloomington-in --fetch-sources
  npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale bloomington-in --batch 1 --dry-run
  npx tsx src/scripts/content-generation/generate-locale-questions.ts --locale los-angeles-ca
`);
}

// ─── Locale config loader ─────────────────────────────────────────────────────

async function loadLocaleConfig(locale: string): Promise<LocaleConfig> {
  const supportedLocales: Record<string, () => Promise<{ default?: LocaleConfig; [key: string]: unknown }>> = {
    'bloomington-in': () => import('./locale-configs/bloomington-in.js') as Promise<{ bloomingtonConfig: LocaleConfig }>,
    'los-angeles-ca': () => import('./locale-configs/los-angeles-ca.js') as Promise<{ losAngelesConfig: LocaleConfig }>,
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

// ─── Batch generation ─────────────────────────────────────────────────────────

/**
 * Generates a single batch of questions using the Anthropic API with prompt caching.
 */
async function generateBatch(
  config: LocaleConfig,
  batchIndex: number,
  totalBatches: number,
  sourceDocuments: string[],
  existingExternalIds: Set<string>
): Promise<ValidatedQuestion[]> {
  const batchNumber = batchIndex + 1;
  console.log(`\n--- Batch ${batchNumber}/${totalBatches} ---`);

  // Calculate which topics this batch should focus on
  // Distribute topics evenly across batches
  const topicEntries = Object.entries(config.topicDistribution);
  const topicsPerBatch = Math.ceil(topicEntries.length / totalBatches);
  const batchTopics = topicEntries.slice(
    batchIndex * topicsPerBatch,
    (batchIndex + 1) * topicsPerBatch
  );

  // If we've covered all topics, cycle back to distribute remaining questions
  const activeBatchTopics = batchTopics.length > 0 ? batchTopics : topicEntries;

  const batchTopicDistribution = Object.fromEntries(
    activeBatchTopics.map(([slug]) => [
      slug,
      Math.ceil(config.batchSize / activeBatchTopics.length),
    ])
  );

  const systemPromptText = buildSystemPrompt(config.name, batchTopicDistribution);

  // Determine next ID range for this batch
  const startId = batchIndex * config.batchSize + 1;
  const endId = Math.min(startId + config.batchSize - 1, config.targetQuestions);

  const userMessage = `Generate ${config.batchSize} civic trivia questions for ${config.name}.

External ID range for this batch: ${config.externalIdPrefix}-${String(startId).padStart(3, '0')} through ${config.externalIdPrefix}-${String(endId).padStart(3, '0')}

Already used external IDs (do not reuse): ${existingExternalIds.size > 0 ? [...existingExternalIds].join(', ') : 'None'}

Topic distribution for this batch:
${Object.entries(batchTopicDistribution).map(([slug, count]) => `- ${slug}: ${count} questions`).join('\n')}

Generate exactly ${config.batchSize} questions. Return ONLY the JSON object with a "questions" array.`;

  // Build messages with prompt caching for source documents
  const messages: MessageParam[] = [];

  if (sourceDocuments.length > 0) {
    // Use prompt caching for source documents — ephemeral cache on large text blocks
    const sourceContent: ContentBlockParam[] = [
      {
        type: 'text',
        text: `Here are the authoritative source documents for ${config.name}. Use these to ensure factual accuracy in your questions:\n\n`,
      },
      ...sourceDocuments.map((doc, idx) => ({
        type: 'text' as const,
        text: doc,
        // Apply cache_control to all source blocks (last one caches the full prefix)
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
  console.log(`  Source documents: ${sourceDocuments.length}`);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    temperature: 0,
    system: systemPromptText,
    messages,
  });

  // Log cache performance metrics
  const usage = response.usage as {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
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

  // Extract JSON from response (handle potential markdown code blocks)
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

  // Print batch summary
  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  const byTopic: Record<string, number> = {};
  for (const q of validated.questions) {
    byDifficulty[q.difficulty]++;
    byTopic[q.topicCategory] = (byTopic[q.topicCategory] ?? 0) + 1;
  }

  console.log(`  Generated: ${validated.questions.length} questions`);
  console.log(`  Difficulty: easy=${byDifficulty.easy}, medium=${byDifficulty.medium}, hard=${byDifficulty.hard}`);
  console.log(`  By topic: ${Object.entries(byTopic).map(([t, n]) => `${t}=${n}`).join(', ')}`);

  return validated.questions;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.locale) {
    console.error('Error: --locale is required');
    printHelp();
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('Add ANTHROPIC_API_KEY=sk-... to backend/.env');
    process.exit(1);
  }

  console.log(`\nCivic Trivia Question Generator`);
  console.log(`================================`);
  console.log(`Locale: ${args.locale}`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Fetch sources: ${args.fetchSources}`);
  if (args.batch !== null) console.log(`Batch: ${args.batch}`);

  // Load locale config
  const config = await loadLocaleConfig(args.locale);
  console.log(`\nConfig: ${config.name}`);
  console.log(`Target: ${config.targetQuestions} questions in ${Math.ceil(config.targetQuestions / config.batchSize)} batches`);

  // Paths
  const dataDir = join(process.cwd(), 'src/scripts/data/sources', args.locale);

  // Step 1: Fetch source documents if requested
  if (args.fetchSources) {
    console.log(`\n[Step 1] Fetching RAG sources...`);
    mkdirSync(dataDir, { recursive: true });
    await fetchSources(config.sourceUrls, dataDir);
  }

  // Step 2: Load source documents for RAG
  console.log(`\n[Step 2] Loading source documents...`);
  const sourceDocuments = await loadSourceDocuments(dataDir);

  if (sourceDocuments.length === 0) {
    console.log('  No source documents found. Proceeding without RAG (AI will rely on training data).');
    console.log('  Tip: Run with --fetch-sources to download authoritative sources first.');
  }

  // Step 3: Set up database (unless dry run)
  let collectionId: number | null = null;
  let topicIdMap: Record<string, number> = {};

  if (!args.dryRun) {
    console.log(`\n[Step 3] Setting up database topics...`);
    const { ensureLocaleTopics } = await import('./utils/seed-questions.js');
    topicIdMap = await ensureLocaleTopics(config.collectionSlug, config.topicCategories);

    // Get collection ID
    const { db } = await import('../../db/index.js');
    const { collections } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [col] = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, config.collectionSlug)).limit(1);
    if (!col) throw new Error(`Collection not found: ${config.collectionSlug}`);
    collectionId = col.id;
    console.log(`  Collection ID: ${collectionId}`);
  }

  // Step 4: Generate questions in batches
  console.log(`\n[Step 4] Generating questions...`);

  const totalBatches = Math.ceil(config.targetQuestions / config.batchSize);
  const batchesToRun = args.batch !== null
    ? [args.batch - 1] // Convert 1-indexed to 0-indexed
    : Array.from({ length: totalBatches }, (_, i) => i);

  const allGenerated: ValidatedQuestion[] = [];
  const existingIds = new Set<string>();
  let totalSeeded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const batchIndex of batchesToRun) {
    try {
      const batchQuestions = await generateBatch(
        config,
        batchIndex,
        totalBatches,
        sourceDocuments,
        existingIds
      );

      // Track generated IDs to avoid reuse in next batch
      for (const q of batchQuestions) existingIds.add(q.externalId);
      allGenerated.push(...batchQuestions);

      if (!args.dryRun && collectionId !== null) {
        const { seedQuestionBatch } = await import('./utils/seed-questions.js');
        const result = await seedQuestionBatch(batchQuestions, collectionId, topicIdMap);
        totalSeeded += result.seeded;
        totalSkipped += result.skipped;
      }

      // Brief pause between batches to respect rate limits
      if (batchesToRun.indexOf(batchIndex) < batchesToRun.length - 1) {
        console.log('  Pausing 2s between batches...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      totalErrors++;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  Batch ${batchIndex + 1} failed: ${message}`);

      // Continue to next batch
    }
  }

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generation Complete`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total generated: ${allGenerated.length} questions`);
  console.log(`Batches with errors: ${totalErrors}`);

  if (!args.dryRun) {
    console.log(`Seeded to database: ${totalSeeded}`);
    console.log(`Skipped (duplicates): ${totalSkipped}`);
    console.log(`\nQuestions are in 'draft' status — activate via admin panel.`);
  } else {
    console.log(`\n[DRY RUN] No questions were seeded to database.`);
  }

  // Difficulty breakdown
  const totalByDiff = { easy: 0, medium: 0, hard: 0 };
  const totalByTopic: Record<string, number> = {};
  for (const q of allGenerated) {
    totalByDiff[q.difficulty]++;
    totalByTopic[q.topicCategory] = (totalByTopic[q.topicCategory] ?? 0) + 1;
  }

  console.log(`\nDifficulty breakdown:`);
  console.log(`  Easy:   ${totalByDiff.easy} (${Math.round(totalByDiff.easy / allGenerated.length * 100)}%)`);
  console.log(`  Medium: ${totalByDiff.medium} (${Math.round(totalByDiff.medium / allGenerated.length * 100)}%)`);
  console.log(`  Hard:   ${totalByDiff.hard} (${Math.round(totalByDiff.hard / allGenerated.length * 100)}%)`);

  console.log(`\nBy topic:`);
  for (const [topic, count] of Object.entries(totalByTopic).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${topic}: ${count}`);
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});

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
import { BatchSchema, QuestionSchema, type ValidatedQuestion } from './question-schema.js';
import { buildSystemPrompt } from './prompts/system-prompt.js';
import { fetchSources } from './rag/fetch-sources.js';
import { loadSourceDocuments } from './rag/parse-sources.js';
import type { LocaleConfig } from './locale-configs/bloomington-in.js';
import { validateAndRetry, createReport, saveReport, type RegenerateFn } from './utils/quality-validation.js';

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
                      Supported: bloomington-in, los-angeles-ca, fremont-ca
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
    'fremont-ca': () => import('./locale-configs/fremont-ca.js') as Promise<{ fremontConfig: LocaleConfig }>,
  };

  const loader = supportedLocales[locale];
  if (!loader) {
    const supported = Object.keys(supportedLocales).join(', ');
    throw new Error(`Unknown locale "${locale}". Supported: ${supported}`);
  }

  const module = await loader();

  // Extract the config from the module (different export names per file)
  const configKeys = ['bloomingtonConfig', 'losAngelesConfig', 'fremontConfig'];
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
): Promise<{ questions: ValidatedQuestion[]; usage: { input: number; output: number; cached: number } }> {
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

  const systemPromptText = buildSystemPrompt(config.name, batchTopicDistribution, config.locale);

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

  return {
    questions: validated.questions,
    usage: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cached: usage.cache_read_input_tokens || 0,
    },
  };
}

// ─── Cost calculation helper ──────────────────────────────────────────────────

/**
 * Calculate estimated cost for Claude API usage.
 * Based on Claude 3.5 Sonnet pricing (as of 2024):
 * - Input: $3 per million tokens
 * - Output: $15 per million tokens
 * - Cached input: $0.30 per million tokens (90% discount)
 */
function calculateCost(inputTokens: number, outputTokens: number, cachedTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 3.0;
  const outputCost = (outputTokens / 1_000_000) * 15.0;
  const cachedCost = (cachedTokens / 1_000_000) * 0.30;
  return inputCost + outputCost + cachedCost;
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
  const actualTarget = Math.ceil(config.targetQuestions * (config.overshootFactor ?? 1.0));
  console.log(`\nConfig: ${config.name}`);
  console.log(`Target: ${config.targetQuestions} questions (${actualTarget} with overshoot) in ${Math.ceil(actualTarget / config.batchSize)} batches`);

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

  const totalBatches = Math.ceil(actualTarget / config.batchSize);
  const batchesToRun = args.batch !== null
    ? [args.batch - 1] // Convert 1-indexed to 0-indexed
    : Array.from({ length: totalBatches }, (_, i) => i);

  const allGenerated: ValidatedQuestion[] = [];
  const allPassed: ValidatedQuestion[] = [];
  const existingIds = new Set<string>();
  let totalSeeded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalValidationAttempts = 0;
  let totalFailed = 0;
  const violationsByRule: Record<string, number> = {};
  const successByAttempt: Record<number, number> = {};

  // Performance tracking for report
  const performanceStart = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let totalApiCalls = 0;

  // Define regenerateFn for quality validation retry loop
  const regenerateFn: RegenerateFn = async (failedQuestion, violationMessages) => {
    console.log(`    Regenerating question with feedback...`);

    const userMessage = `This question failed quality validation with the following issues:

${violationMessages}

Please fix the question and return a single question in the same JSON format. The question must:
- Follow all quality guidelines embedded in the system prompt
- Address the specific violations listed above
- Maintain the same external ID: ${failedQuestion.externalId}
- Stay in the topic category: ${failedQuestion.topicCategory}

Return ONLY a JSON object with a "questions" array containing exactly 1 question.`;

    // Build messages with prompt caching (source documents already cached)
    const messages: MessageParam[] = [];

    if (sourceDocuments.length > 0) {
      const sourceContent: ContentBlockParam[] = [
        {
          type: 'text',
          text: `Here are the authoritative source documents for ${config.name}. Use these to ensure factual accuracy:\n\n`,
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

    const systemPromptText = buildSystemPrompt(config.name, config.topicDistribution, config.locale);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: systemPromptText,
      messages,
    });

    totalApiCalls++;

    const usage = response.usage as {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };

    totalInputTokens += usage.input_tokens;
    totalOutputTokens += usage.output_tokens;
    if (usage.cache_read_input_tokens) totalCachedTokens += usage.cache_read_input_tokens;

    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      throw new Error(`Unexpected response content type: ${contentBlock.type}`);
    }

    const responseText = contentBlock.text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON object found in response.`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // For regeneration, we expect a single question, not a batch
    // Try to parse as a batch first (with questions array)
    if (parsed.questions && Array.isArray(parsed.questions)) {
      if (parsed.questions.length !== 1) {
        throw new Error(`Expected 1 question, got ${parsed.questions.length}`);
      }
      return QuestionSchema.parse(parsed.questions[0]);
    }

    // Otherwise parse as a single question object
    return QuestionSchema.parse(parsed);
  };

  for (const batchIndex of batchesToRun) {
    try {
      const batchResult = await generateBatch(
        config,
        batchIndex,
        totalBatches,
        sourceDocuments,
        existingIds
      );

      totalApiCalls++;
      totalInputTokens += batchResult.usage.input;
      totalOutputTokens += batchResult.usage.output;
      totalCachedTokens += batchResult.usage.cached;

      // Track generated IDs
      for (const q of batchResult.questions) existingIds.add(q.externalId);
      allGenerated.push(...batchResult.questions);

      // Run quality validation with retry loop
      console.log(`\n  Running quality validation for batch ${batchIndex + 1}...`);
      const validationResult = await validateAndRetry(batchResult.questions, regenerateFn, {
        maxRetries: 3,
        skipUrlCheck: true, // Skip URL checks during generation for speed
      });

      // Track stats
      totalValidationAttempts += validationResult.stats.totalAttempts;
      totalFailed += validationResult.failed.length;
      for (const [rule, count] of Object.entries(validationResult.stats.violationsByRule)) {
        violationsByRule[rule] = (violationsByRule[rule] || 0) + count;
      }
      for (const [attempt, count] of Object.entries(validationResult.stats.successByAttempt)) {
        const attemptNum = parseInt(attempt, 10);
        successByAttempt[attemptNum] = (successByAttempt[attemptNum] || 0) + count;
      }

      allPassed.push(...validationResult.passed);

      // Seed only questions that passed validation
      if (!args.dryRun && collectionId !== null) {
        const { seedQuestionBatch } = await import('./utils/seed-questions.js');
        const result = await seedQuestionBatch(validationResult.passed, collectionId, topicIdMap);
        totalSeeded += result.seeded;
        totalSkipped += result.skipped;
      }

      console.log(`  Validation complete: ${validationResult.passed.length} passed, ${validationResult.failed.length} failed`);

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

  // Calculate performance metrics
  const performanceDuration = Date.now() - performanceStart;

  // Difficulty and topic breakdown (use allPassed for accurate seeded stats)
  const totalByDiff = { easy: 0, medium: 0, hard: 0 };
  const totalByTopic: Record<string, number> = {};
  for (const q of allPassed) {
    totalByDiff[q.difficulty]++;
    totalByTopic[q.topicCategory] = (totalByTopic[q.topicCategory] ?? 0) + 1;
  }

  // Create and save generation report
  if (!args.dryRun) {
    const report = createReport(
      config.collectionSlug,
      {
        targetQuestions: actualTarget,
        batchSize: config.batchSize,
        maxRetries: 3,
      },
      {
        passed: allPassed,
        failed: [],
        stats: {
          totalAttempts: totalValidationAttempts,
          successByAttempt,
          violationsByRule,
        },
      },
      {
        totalDurationMs: performanceDuration,
        apiCalls: totalApiCalls,
        tokensUsed: {
          input: totalInputTokens,
          output: totalOutputTokens,
          cached: totalCachedTokens,
        },
        estimatedCostUsd: calculateCost(totalInputTokens, totalOutputTokens, totalCachedTokens),
      },
      {
        byDifficulty: totalByDiff,
        byTopic: totalByTopic,
      }
    );

    await saveReport(report);
  }

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generation Complete`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total generated: ${allGenerated.length} questions`);
  console.log(`Passed validation: ${allPassed.length} questions`);
  console.log(`Failed validation: ${totalFailed} questions`);
  console.log(`Batches with errors: ${totalErrors}`);

  if (!args.dryRun) {
    console.log(`Seeded to database: ${totalSeeded}`);
    console.log(`Skipped (duplicates): ${totalSkipped}`);
    console.log(`\nQuestions are in 'draft' status — activate via admin panel.`);
  } else {
    console.log(`\n[DRY RUN] No questions were seeded to database.`);
  }

  // Quality validation summary
  console.log(`\nQuality Validation:`);
  console.log(`  Total attempts: ${totalValidationAttempts}`);
  console.log(`  Success by attempt: ${Object.entries(successByAttempt).map(([a, c]) => `attempt ${a}=${c}`).join(', ')}`);
  if (Object.keys(violationsByRule).length > 0) {
    console.log(`  Violations by rule: ${Object.entries(violationsByRule).map(([r, c]) => `${r}=${c}`).join(', ')}`);
  }

  // Difficulty breakdown
  if (allPassed.length > 0) {
    console.log(`\nDifficulty breakdown:`);
    console.log(`  Easy:   ${totalByDiff.easy} (${Math.round(totalByDiff.easy / allPassed.length * 100)}%)`);
    console.log(`  Medium: ${totalByDiff.medium} (${Math.round(totalByDiff.medium / allPassed.length * 100)}%)`);
    console.log(`  Hard:   ${totalByDiff.hard} (${Math.round(totalByDiff.hard / allPassed.length * 100)}%)`);

    console.log(`\nBy topic:`);
    for (const [topic, count] of Object.entries(totalByTopic).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${topic}: ${count}`);
    }
  }

  // Performance summary
  console.log(`\nPerformance:`);
  console.log(`  Duration: ${Math.round(performanceDuration / 1000)}s`);
  console.log(`  API calls: ${totalApiCalls}`);
  console.log(`  Tokens: ${totalInputTokens} in, ${totalOutputTokens} out, ${totalCachedTokens} cached`);
  console.log(`  Estimated cost: $${calculateCost(totalInputTokens, totalOutputTokens, totalCachedTokens).toFixed(2)}`);
}

main().catch((error) => {
  console.error('\nFatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});

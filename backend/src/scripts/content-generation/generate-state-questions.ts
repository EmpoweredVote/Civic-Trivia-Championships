// Usage:
//   npx tsx src/scripts/content-generation/generate-state-questions.ts --state indiana --fetch-sources
//   npx tsx src/scripts/content-generation/generate-state-questions.ts --state california --batch 1 --dry-run
//   npx tsx src/scripts/content-generation/generate-state-questions.ts --state indiana
//   npx tsx src/scripts/content-generation/generate-state-questions.ts --help
//
// Run from backend/ directory. Requires ANTHROPIC_API_KEY in .env or environment.
// Requires DATABASE_URL in .env for database seeding (not needed with --dry-run).
//
// Generates state-level civic trivia questions using Claude AI with quality validation.
// Questions are validated with Phase 19 quality rules and inserted with status='active'.

import 'dotenv/config';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type { MessageParam, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js';

import { client, MODEL } from './anthropic-client.js';
import { QuestionSchema, type ValidatedQuestion } from './question-schema.js';
import { buildStateSystemPrompt } from './prompts/state-system-prompt.js';
import { fetchSources } from './rag/fetch-sources.js';
import { loadSourceDocuments } from './rag/parse-sources.js';
import { validateAndRetry, createReport, saveReport } from './utils/quality-validation.js';
import type { LocaleConfig } from './locale-configs/bloomington-in.js';

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function parseArgs(): {
  state: string | null;
  batch: number | null;
  fetchSources: boolean;
  dryRun: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    state: null as string | null,
    batch: null as number | null,
    fetchSources: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--state' && args[i + 1]) {
      result.state = args[i + 1];
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
Usage: npx tsx src/scripts/content-generation/generate-state-questions.ts [options]

Options:
  --state <name>      State to generate questions for (required)
                      Supported: indiana, california
  --batch <N>         Generate only batch N (1-indexed). Default: all batches.
  --fetch-sources     Re-fetch and save RAG source documents before generating
  --dry-run           Generate and validate questions but do not seed to database
  --help, -h          Show this help message

Examples:
  npx tsx src/scripts/content-generation/generate-state-questions.ts --state indiana --fetch-sources
  npx tsx src/scripts/content-generation/generate-state-questions.ts --state california --batch 1 --dry-run
  npx tsx src/scripts/content-generation/generate-state-questions.ts --state indiana
`);
}

// ─── State config loader ──────────────────────────────────────────────────────

async function loadStateConfig(state: string): Promise<{
  config: LocaleConfig;
  stateFeatures: string;
}> {
  const supportedStates: Record<
    string,
    () => Promise<{ [key: string]: unknown }>
  > = {
    indiana: () => import('./locale-configs/state-configs/indiana.js'),
    california: () => import('./locale-configs/state-configs/california.js'),
  };

  const loader = supportedStates[state];
  if (!loader) {
    const supported = Object.keys(supportedStates).join(', ');
    throw new Error(`Unknown state "${state}". Supported: ${supported}`);
  }

  const module = await loader();

  // Extract config and state features
  const config =
    (module.indianaConfig as LocaleConfig | undefined) ||
    (module.californiaConfig as LocaleConfig | undefined);
  const stateFeatures =
    (module.indianaStateFeatures as string | undefined) ||
    (module.californiaStateFeatures as string | undefined);

  if (!config || !stateFeatures) {
    throw new Error(
      `Could not find config or stateFeatures export in state module for "${state}"`
    );
  }

  return { config, stateFeatures };
}

// ─── Batch generation with quality validation ─────────────────────────────────

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Generates a single batch of questions using the Anthropic API with prompt caching.
 * Returns raw generated questions (before validation).
 */
async function generateBatch(
  config: LocaleConfig,
  stateFeatures: string,
  batchIndex: number,
  totalBatches: number,
  sourceDocuments: string[],
  existingExternalIds: Set<string>
): Promise<{ questions: ValidatedQuestion[]; usage: TokenUsage }> {
  const batchNumber = batchIndex + 1;
  console.log(`\n--- Batch ${batchNumber}/${totalBatches} ---`);

  // Calculate which topics this batch should focus on
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

  const systemPromptText = buildStateSystemPrompt(
    config.name,
    stateFeatures,
    batchTopicDistribution
  );

  // Determine next ID range for this batch
  const startId = batchIndex * config.batchSize + 1;
  const endId = Math.min(startId + config.batchSize - 1, config.targetQuestions);

  const userMessage = `Generate ${config.batchSize} state-level civic trivia questions for ${config.name}.

External ID range for this batch: ${config.externalIdPrefix}-${String(startId).padStart(3, '0')} through ${config.externalIdPrefix}-${String(endId).padStart(3, '0')}

Already used external IDs (do not reuse): ${existingExternalIds.size > 0 ? [...existingExternalIds].join(', ') : 'None'}

Topic distribution for this batch:
${Object.entries(batchTopicDistribution)
  .map(([slug, count]) => `- ${slug}: ${count} questions`)
  .join('\n')}

Generate exactly ${config.batchSize} questions. Return ONLY the JSON object with a "questions" array.`;

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
        ...(idx === sourceDocuments.length - 1
          ? { cache_control: { type: 'ephemeral' as const } }
          : {}),
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
  const usage = response.usage as TokenUsage;
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
    throw new Error(
      `No JSON object found in response. Response preview: ${responseText.slice(0, 200)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(
      `Failed to parse JSON response: ${err instanceof Error ? err.message : err}`
    );
  }

  // Parse the batch - extract questions array
  const batchData = parsed as { questions: unknown[] };
  if (!batchData.questions || !Array.isArray(batchData.questions)) {
    throw new Error('Response does not contain a "questions" array');
  }

  // Validate each question individually (not using BatchSchema since we validate separately)
  const questions: ValidatedQuestion[] = [];
  for (const q of batchData.questions) {
    try {
      const validated = QuestionSchema.parse(q);
      questions.push(validated);
    } catch (err) {
      console.warn(`  Warning: Question failed Zod validation, skipping: ${err}`);
    }
  }

  console.log(`  Generated: ${questions.length} questions (Zod-validated)`);

  return { questions, usage };
}

/**
 * Regenerates a single question with feedback about validation failures.
 * Used by validateAndRetry callback.
 */
async function regenerateWithFeedback(
  config: LocaleConfig,
  stateFeatures: string,
  failedQuestion: ValidatedQuestion,
  violationMessages: string
): Promise<ValidatedQuestion> {
  const feedbackPrompt = `
The following question failed quality validation and needs to be regenerated:

FAILED QUESTION:
Text: "${failedQuestion.text}"
Options: ${JSON.stringify(failedQuestion.options)}
Correct Answer: ${failedQuestion.correctAnswer}

VALIDATION FAILURES:
${violationMessages}

Generate a replacement question for the same topic (${failedQuestion.topicCategory}) that:
1. Addresses the validation failures above
2. Covers similar civic content
3. Uses the same difficulty level (${failedQuestion.difficulty})
4. Has the same external ID: ${failedQuestion.externalId}

Return ONLY the JSON object for the single replacement question.
`;

  const systemPromptText = buildStateSystemPrompt(
    config.name,
    stateFeatures,
    {} // No topic distribution for single question retry
  );

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: systemPromptText,
    messages: [{ role: 'user', content: feedbackPrompt }],
  });

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

// ─── Collection creation helper ───────────────────────────────────────────────

async function ensureStateCollection(
  collectionSlug: string,
  stateName: string
): Promise<number> {
  const { db } = await import('../../db/index.js');
  const { collections } = await import('../../db/schema.js');
  const { eq } = await import('drizzle-orm');

  // Check if collection exists
  const [existing] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, collectionSlug))
    .limit(1);

  if (existing) {
    console.log(`  Collection exists: ${collectionSlug} (id: ${existing.id})`);
    return existing.id;
  }

  // Create new state collection
  console.log(`  Creating new collection: ${collectionSlug}`);
  const [created] = await db
    .insert(collections)
    .values({
      name: `${stateName} State`,
      slug: collectionSlug,
      description: `State-level civic trivia questions for ${stateName} — covers government structure, civic processes, and broader civics.`,
      localeCode: `${stateName.toLowerCase()}-state`,
      localeName: `${stateName} State`,
      iconIdentifier: 'state',
      themeColor: '#1E3A8A', // Blue for state collections
      isActive: true,
      sortOrder: 1000, // State collections sorted after city collections
    })
    .returning({ id: collections.id });

  console.log(`  Collection created: ${collectionSlug} (id: ${created.id})`);
  return created.id;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.state) {
    console.error('Error: --state is required');
    printHelp();
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('Add ANTHROPIC_API_KEY=sk-... to backend/.env');
    process.exit(1);
  }

  const startTime = Date.now();

  console.log(`\nState-Level Civic Trivia Question Generator`);
  console.log(`============================================`);
  console.log(`State: ${args.state}`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Fetch sources: ${args.fetchSources}`);
  if (args.batch !== null) console.log(`Batch: ${args.batch}`);

  // Load state config
  const { config, stateFeatures } = await loadStateConfig(args.state);
  console.log(`\nConfig: ${config.name}`);
  console.log(
    `Target: ${config.targetQuestions} questions in ${Math.ceil(config.targetQuestions / config.batchSize)} batches`
  );

  // Paths
  const dataDir = join(
    process.cwd(),
    'src/scripts/data/sources',
    config.locale
  );

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
    console.log(
      '  No source documents found. Proceeding without RAG (AI will rely on training data).'
    );
    console.log(
      '  Tip: Run with --fetch-sources to download authoritative sources first.'
    );
  }

  // Step 3: Set up database (unless dry run)
  let collectionId: number | null = null;
  let topicIdMap: Record<string, number> = {};

  if (!args.dryRun) {
    console.log(`\n[Step 3] Setting up database collection and topics...`);

    // Ensure collection exists
    collectionId = await ensureStateCollection(
      config.collectionSlug,
      config.name
    );

    // Ensure topics
    const { ensureLocaleTopics } = await import('./utils/seed-questions.js');
    topicIdMap = await ensureLocaleTopics(
      config.collectionSlug,
      config.topicCategories
    );
  }

  // Step 4: Generate and validate questions in batches
  console.log(`\n[Step 4] Generating and validating questions...`);

  const totalBatches = Math.ceil(config.targetQuestions / config.batchSize);
  const batchesToRun =
    args.batch !== null
      ? [args.batch - 1] // Convert 1-indexed to 0-indexed
      : Array.from({ length: totalBatches }, (_, i) => i);

  const allPassed: ValidatedQuestion[] = [];
  const allFailed: Array<{
    question: ValidatedQuestion;
    violations: string[];
    attempts: number;
  }> = [];
  const existingIds = new Set<string>();
  let totalSeeded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Token tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalCacheReadTokens = 0;
  let totalApiCalls = 0;

  for (const batchIndex of batchesToRun) {
    try {
      // Generate batch
      const { questions: batchQuestions, usage } = await generateBatch(
        config,
        stateFeatures,
        batchIndex,
        totalBatches,
        sourceDocuments,
        existingIds
      );

      totalApiCalls++;
      totalInputTokens += usage.input_tokens;
      totalOutputTokens += usage.output_tokens;
      totalCacheCreationTokens += usage.cache_creation_input_tokens || 0;
      totalCacheReadTokens += usage.cache_read_input_tokens || 0;

      // Validate batch with retry loop
      console.log(`\n  Validating batch ${batchIndex + 1}...`);
      const validationResult = await validateAndRetry(
        batchQuestions,
        (failedQ, violations) =>
          regenerateWithFeedback(config, stateFeatures, failedQ, violations),
        { maxRetries: 3, skipUrlCheck: true }
      );

      // Track passed/failed
      allPassed.push(...validationResult.passed);
      allFailed.push(
        ...validationResult.failed.map((f) => ({
          question: f.question,
          violations: f.violations.map((v) => v.rule),
          attempts: f.attempts,
        }))
      );

      // Track IDs
      for (const q of validationResult.passed) existingIds.add(q.externalId);

      console.log(
        `\n  Batch ${batchIndex + 1} results: ${validationResult.passed.length} passed, ${validationResult.failed.length} failed after retries`
      );

      // Seed passing questions to database (status='active')
      if (!args.dryRun && collectionId !== null) {
        console.log(`  Seeding ${validationResult.passed.length} passing questions to database...`);

        for (const question of validationResult.passed) {
          const topicId = topicIdMap[question.topicCategory];

          if (!topicId) {
            console.warn(
              `  Warning: No topicId found for category "${question.topicCategory}" — skipping ${question.externalId}`
            );
            totalSkipped++;
            continue;
          }

          // Import db modules
          const { db } = await import('../../db/index.js');
          const { questions, collectionQuestions } = await import('../../db/schema.js');

          // Insert question with status='active'
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
            status: 'active' as const, // Auto-insert as active (quality-validated)
            expirationHistory: [],
          };

          const inserted = await db
            .insert(questions)
            .values(newQuestion)
            .onConflictDoNothing()
            .returning({ id: questions.id });

          if (!inserted || inserted.length === 0) {
            console.log(`  Skipped (duplicate): ${question.externalId}`);
            totalSkipped++;
            continue;
          }

          const questionId = inserted[0].id;

          // Link question to collection
          await db
            .insert(collectionQuestions)
            .values({ collectionId, questionId })
            .onConflictDoNothing();

          totalSeeded++;
        }

        console.log(`  Seeded: ${totalSeeded} questions`);
      }

      // Brief pause between batches
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

  const endTime = Date.now();
  const durationMs = endTime - startTime;

  // Calculate breakdowns
  const byDifficulty: Record<string, number> = {};
  const byTopic: Record<string, number> = {};
  for (const q of allPassed) {
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
    byTopic[q.topicCategory] = (byTopic[q.topicCategory] || 0) + 1;
  }

  // Create generation report
  const report = createReport(
    config.collectionSlug,
    {
      targetQuestions: config.targetQuestions,
      batchSize: config.batchSize,
      maxRetries: 3,
    },
    {
      passed: allPassed,
      failed: allFailed.map((f) => ({
        question: f.question,
        violations: f.violations.map((rule) => ({ rule, severity: 'blocking' as const, message: '', section: '' })),
        attempts: f.attempts,
      })),
      stats: {
        totalAttempts: totalApiCalls,
        successByAttempt: {},
        violationsByRule: {},
      },
    },
    {
      totalDurationMs: durationMs,
      apiCalls: totalApiCalls,
      tokensUsed: {
        input: totalInputTokens,
        output: totalOutputTokens,
        cached: totalCacheReadTokens,
      },
      estimatedCostUsd:
        (totalInputTokens * 0.003 +
          totalOutputTokens * 0.015 +
          totalCacheCreationTokens * 0.00375 +
          totalCacheReadTokens * 0.0003) /
        1000,
    },
    { byDifficulty, byTopic }
  );

  // Save report
  await saveReport(report);

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generation Complete`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total generated: ${allPassed.length + allFailed.length} questions`);
  console.log(`Passed validation: ${allPassed.length}`);
  console.log(`Failed after retries: ${allFailed.length}`);
  console.log(`Batches with errors: ${totalErrors}`);

  if (!args.dryRun) {
    console.log(`Seeded to database: ${totalSeeded} (status='active')`);
    console.log(`Skipped (duplicates): ${totalSkipped}`);
    console.log(
      `\nQuestions are ACTIVE — they will appear in gameplay immediately.`
    );
  } else {
    console.log(`\n[DRY RUN] No questions were seeded to database.`);
  }

  // Difficulty breakdown
  console.log(`\nDifficulty breakdown:`);
  for (const [diff, count] of Object.entries(byDifficulty)) {
    const pct = Math.round((count / allPassed.length) * 100);
    console.log(`  ${diff}: ${count} (${pct}%)`);
  }

  console.log(`\nBy topic:`);
  for (const [topic, count] of Object.entries(byTopic).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${topic}: ${count}`);
  }

  console.log(`\nPerformance:`);
  console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`  API calls: ${totalApiCalls}`);
  console.log(`  Input tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`  Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`  Cache read tokens: ${totalCacheReadTokens.toLocaleString()}`);
  console.log(`  Estimated cost: $${report.performance.estimatedCostUsd.toFixed(2)}`);
}

main().catch((error) => {
  console.error('\nFatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});

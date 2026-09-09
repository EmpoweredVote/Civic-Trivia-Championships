// Usage:
//   npx tsx src/scripts/generateQuestions.ts --collection fremont-ca --target 90
//   npx tsx src/scripts/generateQuestions.ts --collection fremont-ca --target 90 --dry-run
//   npx tsx src/scripts/generateQuestions.ts --collection bloomington-in --target 90 --limit 10
// Run from backend/ directory. Requires ANTHROPIC_API_KEY and OPENAI_API_KEY in .env.
//
// Main generation pipeline orchestrator - integrates gap analysis, Claude generation,
// quality validation, semantic dedup, and source diversity tracking into a single repeatable pipeline.

import '../env.js'; // MUST be first import for dotenv
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { GapAnalyzer } from '../services/generation/GapAnalyzer.js';
import { SourceTracker } from '../services/generation/SourceTracker.js';
import { CollectionHierarchy } from '../services/generation/CollectionHierarchy.js';
import type {
  TopicConfig,
  GeneratedQuestion,
  GenerationResult,
  GenerationReport,
  GenerationSlot,
} from '../services/generation/types.js';
import { DEFAULT_DIFFICULTY_DISTRIBUTION } from '../services/generation/types.js';
import { auditQuestion } from '../services/qualityRules/index.js';
import { OpenAIEmbeddingService } from '../services/embeddings/OpenAIEmbeddingService.js';
import { SemanticDupDetector } from '../services/embeddings/SemanticDupDetector.js';
import type { QuestionForDedup } from '../services/embeddings/types.js';
import { loadCollectionTierMap } from '../services/embeddings/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Collection metadata — names must match the DB `name` column exactly
const COLLECTION_NAMES: Record<string, string> = {
  'federal': 'US Civics',
  'bloomington-in': 'Bloomington, IN',
  'los-angeles-ca': 'Los Angeles, CA',
  'indiana-state': 'Indiana',
  'california-state': 'California',
  'fremont-ca': 'Fremont, CA',
};

const COLLECTION_PREFIXES: Record<string, string> = {
  'federal': 'fed',
  'bloomington-in': 'bloom',
  'los-angeles-ca': 'la',
  'indiana-state': 'ind',
  'california-state': 'cal',
  'fremont-ca': 'fre',
};

const JSON_FILE_MAP: Record<string, string> = {
  'federal': 'questions.json',
  'bloomington-in': 'bloomington-in-questions.json',
  'los-angeles-ca': 'los-angeles-ca-questions.json',
  'indiana-state': 'indiana-state-questions.json',
  'california-state': 'california-state-questions.json',
  'fremont-ca': 'fremont-ca-questions.json',
};

interface CLIArgs {
  collection: string;
  target: number;
  dryRun: boolean;
  limit?: number;
}

interface CollectionData {
  collectionName: string;
  collectionSlug: string;
  topics: TopicConfig[];
  existingQuestions: Array<{ topicCategory: string; difficulty: string; source: { name: string; url: string } }>;
}

/**
 * Parse CLI arguments
 */
function parseArgs(): CLIArgs | null {
  const args = process.argv.slice(2);
  const result: Partial<CLIArgs> = { dryRun: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--collection' && args[i + 1]) {
      result.collection = args[i + 1];
      i++;
    } else if (args[i] === '--target' && args[i + 1]) {
      result.target = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      result.dryRun = true;
    } else if (args[i] === '--limit' && args[i + 1]) {
      result.limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  if (!result.collection || !result.target) {
    console.error('Error: --collection and --target are required');
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx src/scripts/generateQuestions.ts --collection fremont-ca --target 90');
    console.error('  npx tsx src/scripts/generateQuestions.ts --collection fremont-ca --target 90 --dry-run');
    console.error('  npx tsx src/scripts/generateQuestions.ts --collection bloomington-in --target 90 --limit 10');
    console.error('');
    console.error('Options:');
    console.error('  --collection <slug>   Collection slug (federal, bloomington-in, los-angeles-ca, indiana-state, california-state, fremont-ca)');
    console.error('  --target <number>     Target total question count for collection');
    console.error('  --dry-run             Show gap analysis only, do not generate');
    console.error('  --limit <number>      Maximum questions to generate (for testing)');
    return null;
  }

  return result as CLIArgs;
}

/**
 * Load collection data from JSON file
 */
function loadCollectionData(collectionSlug: string): CollectionData {
  const jsonFileName = JSON_FILE_MAP[collectionSlug];
  if (!jsonFileName) {
    throw new Error(`Unknown collection slug: ${collectionSlug}`);
  }

  const dataPath = resolve(__dirname, '..', 'data', jsonFileName);
  if (!existsSync(dataPath)) {
    throw new Error(`Collection JSON not found: ${dataPath}`);
  }

  const jsonData = JSON.parse(readFileSync(dataPath, 'utf-8'));

  return {
    collectionName: COLLECTION_NAMES[collectionSlug],
    collectionSlug,
    topics: jsonData.topics,
    existingQuestions: jsonData.questions.map((q: any) => ({
      topicCategory: q.topicCategory,
      difficulty: q.difficulty,
      source: q.source,
    })),
  };
}

/**
 * Load all existing questions from database for dedup checks
 */
async function loadExistingQuestionsForDedup(): Promise<QuestionForDedup[]> {
  console.log('Loading existing questions from database for dedup checks...');

  const query = sql`
    SELECT
      q.external_id as "externalId",
      q.text,
      q.options,
      q.correct_answer as "correctAnswer",
      q.quality_score as "qualityScore",
      array_agg(c.name ORDER BY c.name) as "collections"
    FROM civic_trivia.questions q
    JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
    JOIN civic_trivia.collections c ON cq.collection_id = c.id
    WHERE q.status = 'active'
    GROUP BY q.id, q.external_id, q.text, q.options, q.correct_answer, q.quality_score
    ORDER BY q.external_id
  `;

  const result = await db.execute(query);
  const rows = result.rows as any[];

  console.log(`Loaded ${rows.length} active questions for dedup checks`);

  return rows.map(row => ({
    externalId: row.externalId,
    text: row.text,
    options: row.options,
    correctAnswer: row.correctAnswer,
    collections: row.collections,
    qualityScore: row.qualityScore,
  }));
}

/**
 * Build Claude generation prompt for a specific topic/difficulty slot
 */
function buildGenerationPrompt(
  slot: GenerationSlot,
  topicConfig: TopicConfig,
  collectionName: string,
  collectionSlug: string,
  previousViolations?: string
): string {
  const today = new Date().toISOString().split('T')[0];

  let prompt = `Generate a single U.S. civics trivia question for the "${collectionName}" collection.

**Topic:** ${topicConfig.name}
${topicConfig.description}

**Difficulty:** ${slot.difficulty}

**Requirements:**
1. Write a clear, engaging multiple-choice question with exactly 4 answer options
2. Difficulty level:
   - easy: Basic facts that most informed citizens should know (e.g., "Who is the mayor?")
   - medium: Requires some civic knowledge or reasoning (e.g., "What does the city council vote on?")
   - hard: Requires deeper understanding or less commonly known facts (e.g., "How does the budget amendment process work?")
3. One option must be clearly correct, the other three must be plausible but incorrect
4. Include a 1-3 sentence explanation (plain language, nonpartisan, cite sources)
5. Add "as of ${today}" for time-sensitive facts (population, office-holders, recent laws)
6. Provide a credible source (name + URL from .gov, .edu, khanacademy.org, icivics.org, en.wikipedia.org)
7. No expiration date needed (set to null)

**Quality guidelines (blocking violations will reject the question):**
- Questions must be fun and useful to know, not dry test prep
- No phone numbers, addresses, or pure lookup facts with no civic value
- Avoid ambiguous wording - one answer should be clearly correct
- All four options must be distinct and plausible
- No partisan language (don't label policies as liberal/conservative/progressive/activist)
- Question text must be 10-200 characters, explanation 50-500 characters

**Output format (JSON only, no markdown):**
{
  "text": "Question text here?",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correctAnswer": 0,
  "explanation": "Brief explanation with source citation.",
  "source": {
    "name": "Source name",
    "url": "https://authoritative-url.gov/..."
  }
}`;

  if (previousViolations) {
    prompt += `\n\n**Previous attempt failed quality check:**\n${previousViolations}\n\nPlease revise to address these issues.`;
  }

  return prompt;
}

/**
 * Generate a single question with retry logic for quality and dedup failures
 */
async function generateOneQuestion(
  slot: GenerationSlot,
  topicConfig: TopicConfig,
  collectionName: string,
  collectionSlug: string,
  existingQuestions: QuestionForDedup[],
  batchEmbeddings: Map<string, number[]>,
  sourceTracker: SourceTracker,
  hierarchyChecker: CollectionHierarchy,
  claudeClient: Anthropic,
  externalIdCounter: number
): Promise<GenerationResult> {
  const maxRetries = 3;
  let attempt = 0;
  let previousViolations: string | undefined;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`  Attempt ${attempt}/${maxRetries}...`);

    try {
      // 1. Generate with Claude
      const prompt = buildGenerationPrompt(
        slot,
        topicConfig,
        collectionName,
        collectionSlug,
        previousViolations
      );

      const response = await claudeClient.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentText = response.content[0].type === 'text' ? response.content[0].text : '';

      // 2. Parse JSON from response
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 3. Validate structure
      if (!parsed.text || !Array.isArray(parsed.options) || parsed.options.length !== 4) {
        throw new Error('Invalid question structure: missing text or options');
      }
      if (typeof parsed.correctAnswer !== 'number' || parsed.correctAnswer < 0 || parsed.correctAnswer > 3) {
        throw new Error('Invalid correctAnswer: must be 0-3');
      }
      if (!parsed.explanation || !parsed.source || !parsed.source.name || !parsed.source.url) {
        throw new Error('Invalid question structure: missing explanation or source');
      }

      // 4. Build GeneratedQuestion
      const prefix = COLLECTION_PREFIXES[collectionSlug];
      const externalId = `${prefix}-${String(externalIdCounter).padStart(3, '0')}`;

      const question: GeneratedQuestion = {
        externalId,
        text: parsed.text,
        options: parsed.options,
        correctAnswer: parsed.correctAnswer,
        explanation: parsed.explanation,
        difficulty: slot.difficulty,
        topicCategory: slot.topic,
        source: parsed.source,
        expiresAt: null,
      };

      // 5. Quality audit (skip URL check during generation)
      const auditResult = await auditQuestion(question, { skipUrlCheck: true });

      if (auditResult.hasBlockingViolations) {
        const blockingViolations = auditResult.violations
          .filter(v => v.severity === 'blocking')
          .map(v => `- ${v.rule}: ${v.message}`)
          .join('\n');

        if (attempt < maxRetries) {
          console.log(`    ❌ Blocking violations found, retrying...`);
          previousViolations = blockingViolations;
          continue;
        } else {
          console.log(`    ❌ Blocking violations persist after ${maxRetries} attempts, skipping`);
          return {
            question,
            status: 'skipped',
            attempts: attempt,
            violations: auditResult.violations,
          };
        }
      }

      // 6. Semantic dedup check
      const dedupResult = await hierarchyChecker.checkDuplicate(
        question.text,
        question.options,
        collectionName,
        existingQuestions,
        batchEmbeddings
      );

      if (dedupResult.isDuplicate) {
        if (attempt < maxRetries) {
          console.log(`    ❌ Duplicate detected (${dedupResult.duplicateOf}), retrying...`);
          previousViolations = `Previous question was a duplicate of ${dedupResult.duplicateOf}. Generate a different question on the same topic.`;
          continue;
        } else {
          console.log(`    ❌ Still duplicate after ${maxRetries} attempts, skipping`);
          return {
            question,
            status: 'duplicate',
            attempts: attempt,
            violations: [],
            sourceWarning: dedupResult.reason,
          };
        }
      }

      // 7. Source diversity check
      const sourceCheck = sourceTracker.checkSource(question.source);
      if (sourceCheck.warning) {
        console.log(`    ⚠️  ${sourceCheck.warning}`);
      }

      // 8. Success! Record source and embedding
      sourceTracker.recordSource(question.source);

      // Generate embedding for intra-batch dedup
      const embeddingService = hierarchyChecker['embeddingService']; // Access private field
      const preparedText = SemanticDupDetector.prepareTextForEmbedding({
        text: question.text,
        options: question.options,
        externalId: question.externalId,
        correctAnswer: question.correctAnswer,
        collections: [collectionName],
        qualityScore: auditResult.score,
      });
      const embedding = await embeddingService.embed(preparedText);
      batchEmbeddings.set(question.externalId, embedding);

      console.log(`    ✓ Accepted (quality: ${auditResult.score.toFixed(2)})`);

      return {
        question,
        status: 'accepted',
        attempts: attempt,
        violations: auditResult.violations,
        sourceWarning: sourceCheck.warning,
      };
    } catch (error) {
      console.error(`    ❌ Generation error:`, error instanceof Error ? error.message : error);

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`    Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('All retries exhausted');
}

/**
 * Main orchestrator
 */
async function main() {
  const args = parseArgs();
  if (!args) {
    process.exit(1);
  }

  console.log('=== Question Generation Pipeline ===');
  console.log(`Collection: ${args.collection} (${COLLECTION_NAMES[args.collection]})`);
  console.log(`Target: ${args.target} total questions`);
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'GENERATE'}`);
  if (args.limit) {
    console.log(`Limit: ${args.limit} questions`);
  }
  console.log('');

  // 1. Check environment variables
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not set. Add it to backend/.env');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not set. Add it to backend/.env');
    process.exit(1);
  }

  // 2. Load collection data
  console.log('Loading collection data...');
  const collectionData = loadCollectionData(args.collection);
  console.log(`Loaded ${collectionData.existingQuestions.length} existing questions from JSON`);
  console.log(`Topics: ${collectionData.topics.map(t => t.slug).join(', ')}`);
  console.log('');

  // 3. Load all questions from database for dedup
  const existingDbQuestions = await loadExistingQuestionsForDedup();
  console.log('');

  // 4. Initialize services
  const gapAnalyzer = new GapAnalyzer();
  const sourceTracker = new SourceTracker(collectionData.existingQuestions);
  const embeddingService = new OpenAIEmbeddingService({
    apiKey: process.env.OPENAI_API_KEY,
    cacheDir: resolve(__dirname, '..', '..', '.embedding-cache'),
  });
  const tierMap = await loadCollectionTierMap();
  const hierarchyChecker = new CollectionHierarchy(embeddingService, tierMap);
  const claudeClient = new Anthropic();

  // 5. Run gap analysis
  console.log('Running gap analysis...');
  const gaps = gapAnalyzer.analyzeGaps(
    collectionData.existingQuestions,
    args.target,
    collectionData.topics,
    DEFAULT_DIFFICULTY_DISTRIBUTION
  );
  console.log('');
  console.log(gapAnalyzer.summarize(gaps));
  console.log('');

  // 6. If dry-run, exit here
  if (args.dryRun) {
    console.log('DRY RUN complete. No questions generated.');
    process.exit(0);
  }

  // 7. Generate questions one at a time
  const generationPlan = args.limit
    ? gaps.generationPlan.slice(0, args.limit)
    : gaps.generationPlan;

  console.log(`Generating ${generationPlan.length} questions...`);
  console.log('');

  const results: GenerationResult[] = [];
  const batchEmbeddings = new Map<string, number[]>();
  let externalIdCounter = collectionData.existingQuestions.length + 1;

  for (let i = 0; i < generationPlan.length; i++) {
    const slot = generationPlan[i];
    const topicConfig = collectionData.topics.find(t => t.slug === slot.topic);

    if (!topicConfig) {
      console.error(`❌ Unknown topic: ${slot.topic}, skipping`);
      continue;
    }

    console.log(`[${i + 1}/${generationPlan.length}] Generating ${slot.difficulty} question for ${slot.topic}...`);

    try {
      const result = await generateOneQuestion(
        slot,
        topicConfig,
        collectionData.collectionName,
        args.collection,
        existingDbQuestions,
        batchEmbeddings,
        sourceTracker,
        hierarchyChecker,
        claudeClient,
        externalIdCounter
      );

      results.push(result);

      if (result.status === 'accepted') {
        externalIdCounter++;
      }

      // Rate limiting: 1 second between requests
      if (i < generationPlan.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`❌ Failed to generate question:`, error instanceof Error ? error.message : error);
      // Continue with remaining questions
    }

    console.log('');
  }

  // 8. Save embedding cache
  embeddingService.saveCache();
  console.log('Embedding cache saved');
  console.log('');

  // 9. Build report
  const acceptedQuestions = results.filter(r => r.status === 'accepted').map(r => r.question);
  const skippedResults = results.filter(r => r.status === 'skipped');
  const duplicateResults = results.filter(r => r.status === 'duplicate');

  const topicCounts: Record<string, number> = {};
  const difficultyCounts: Record<string, number> = {};
  for (const q of acceptedQuestions) {
    topicCounts[q.topicCategory] = (topicCounts[q.topicCategory] || 0) + 1;
    difficultyCounts[q.difficulty] = (difficultyCounts[q.difficulty] || 0) + 1;
  }

  const report: GenerationReport = {
    collectionName: collectionData.collectionName,
    timestamp: new Date().toISOString(),
    config: {
      targetCount: args.target,
      difficultyDistribution: DEFAULT_DIFFICULTY_DISTRIBUTION,
    },
    gapAnalysis: {
      totalNeeded: gaps.totalNeeded,
      topicGaps: Object.fromEntries(gaps.topicGaps),
      difficultyGaps: Object.fromEntries(gaps.difficultyGaps),
    },
    results: {
      accepted: acceptedQuestions.length,
      skipped: skippedResults.length,
      duplicates: duplicateResults.length,
      totalAttempted: results.length,
    },
    acceptedQuestions,
    skippedDetails: skippedResults.map(r => ({
      topic: r.question.topicCategory,
      difficulty: r.question.difficulty,
      reason: r.violations.length > 0
        ? r.violations.map(v => v.message).join('; ')
        : 'Unknown',
      attempts: r.attempts,
    })),
    sourceDiversity: sourceTracker.getSummary().map(s => ({
      source: s.sourceKey,
      count: s.count,
      percentage: s.percentage,
    })),
    finalDistribution: {
      topics: topicCounts,
      difficulties: difficultyCounts,
    },
  };

  // 10. Write output files
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputDir = resolve(__dirname, '..', '..');

  // Questions JSON (collection-compatible format)
  const questionsOutputPath = join(outputDir, `generated-questions-${args.collection}-${timestamp}.json`);
  const questionsOutput = {
    topics: collectionData.topics,
    questions: acceptedQuestions,
  };
  writeFileSync(questionsOutputPath, JSON.stringify(questionsOutput, null, 2), 'utf-8');

  // Report JSON
  const reportOutputPath = join(outputDir, `generation-report-${args.collection}-${timestamp}.json`);
  writeFileSync(reportOutputPath, JSON.stringify(report, null, 2), 'utf-8');

  // 11. Print summary
  console.log('='.repeat(60));
  console.log('GENERATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total attempted: ${results.length}`);
  console.log(`Accepted: ${acceptedQuestions.length}`);
  console.log(`Skipped (quality): ${skippedResults.length}`);
  console.log(`Duplicates: ${duplicateResults.length}`);
  console.log('');
  console.log('Final distribution:');
  console.log(`  Topics: ${Object.entries(topicCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  Difficulties: ${Object.entries(difficultyCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log('');
  console.log('Source diversity (top 5):');
  const topSources = sourceTracker.getSummary().slice(0, 5);
  for (const s of topSources) {
    console.log(`  ${s.sourceKey}: ${s.count} (${(s.percentage * 100).toFixed(1)}%)`);
  }
  console.log('');
  console.log('Output files:');
  console.log(`  Questions: ${questionsOutputPath}`);
  console.log(`  Report: ${reportOutputPath}`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

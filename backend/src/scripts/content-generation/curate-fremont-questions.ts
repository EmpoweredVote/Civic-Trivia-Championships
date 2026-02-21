#!/usr/bin/env tsx
/**
 * Fremont Question Curation Script
 *
 * Three modes:
 * 1. --mode sample: Extract stratified spot-check sample (20-30 questions)
 * 2. --mode curate: Score and select best ~100 questions from pool
 * 3. --mode activate: Change status from draft to active
 *
 * Usage:
 *   npx tsx src/scripts/content-generation/curate-fremont-questions.ts --mode sample
 *   npx tsx src/scripts/content-generation/curate-fremont-questions.ts --mode curate
 *   npx tsx src/scripts/content-generation/curate-fremont-questions.ts --mode activate --all-curated
 *   npx tsx src/scripts/content-generation/curate-fremont-questions.ts --mode activate --ids fre-001,fre-002
 */

import 'dotenv/config';
import { db } from '../../db/index.js';
import { questions, collections, collectionQuestions } from '../../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { fremontConfig } from './locale-configs/fremont-ca.js';

// Type for question records from database
interface QuestionRecord {
  id: number;
  externalId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  subcategory: string | null;
  source: { name: string; url: string };
  expiresAt: Date | null;
}

// Scored question for curation
interface ScoredQuestion extends QuestionRecord {
  score: number;
}

// Parse CLI args
const args = process.argv.slice(2);
const modeArg = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'sample';
const allCuratedFlag = args.includes('--all-curated');
const idsArg = args.find(arg => arg.startsWith('--ids='))?.split('=')[1];

// Validate mode
if (!['sample', 'curate', 'activate'].includes(modeArg)) {
  console.error('Invalid mode. Use: --mode=sample, --mode=curate, or --mode=activate');
  process.exit(1);
}

// Get Fremont collection ID
async function getFremontCollectionId(): Promise<number> {
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, 'fremont-ca'))
    .limit(1);

  if (!collection) {
    throw new Error('Fremont collection not found. Run db:seed first.');
  }

  return collection.id;
}

// Fetch all draft Fremont questions
async function fetchDraftQuestions(collectionId: number): Promise<QuestionRecord[]> {
  const result = await db
    .select({
      id: questions.id,
      externalId: questions.externalId,
      text: questions.text,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      explanation: questions.explanation,
      difficulty: questions.difficulty,
      subcategory: questions.subcategory,
      source: questions.source,
      expiresAt: questions.expiresAt,
    })
    .from(questions)
    .innerJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
    .where(
      and(
        eq(collectionQuestions.collectionId, collectionId),
        eq(questions.status, 'draft')
      )
    );

  return result as QuestionRecord[];
}

// MODE 1: Extract spot-check sample
async function runSampleMode() {
  console.log('=== SPOT-CHECK SAMPLE MODE ===\n');

  const collectionId = await getFremontCollectionId();
  const allQuestions = await fetchDraftQuestions(collectionId);

  console.log(`Total draft questions: ${allQuestions.length}\n`);

  // Group by topic category
  const byTopic: Record<string, QuestionRecord[]> = {};
  for (const q of allQuestions) {
    const topic = q.subcategory || 'unknown';
    if (!byTopic[topic]) byTopic[topic] = [];
    byTopic[topic].push(q);
  }

  // Extract 3-4 random questions from each topic
  const sample: QuestionRecord[] = [];
  const sensitiveTopics = ['civic-history', 'landmarks-culture', 'budget-finance'];

  for (const [topic, questions] of Object.entries(byTopic)) {
    // Prioritize sensitive topics: take 4, others take 3
    const sampleSize = sensitiveTopics.includes(topic) ? 4 : 3;
    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(sampleSize, questions.length));
    sample.push(...selected);
  }

  console.log(`Extracted sample: ${sample.length} questions\n`);
  console.log('='.repeat(80));
  console.log('\n');

  // Print each sample question
  for (const q of sample) {
    console.log(`ID: ${q.externalId}`);
    console.log(`Topic: ${q.subcategory}`);
    console.log(`Difficulty: ${q.difficulty}`);
    console.log(`\nQuestion: ${q.text}\n`);

    q.options.forEach((opt, idx) => {
      const marker = idx === q.correctAnswer ? '✓' : ' ';
      console.log(`  [${marker}] ${idx + 1}. ${opt}`);
    });

    console.log(`\nCorrect Answer: ${q.options[q.correctAnswer]}`);
    console.log(`\nExplanation: ${q.explanation}`);
    console.log(`\nSource: ${q.source.name}`);
    console.log(`URL: ${q.source.url}`);
    if (q.expiresAt) {
      console.log(`Expires: ${q.expiresAt.toISOString().split('T')[0]}`);
    }
    console.log('\n' + '-'.repeat(80) + '\n');
  }

  // Print sensitivity checklist
  console.log('\n' + '='.repeat(80));
  console.log('\n=== SENSITIVITY CHECKLIST ===\n');

  console.log('CIVIC HISTORY (Ohlone/Indigenous):\n');
  console.log('  □ Uses present tense for Ohlone presence ("have lived here" not "lived here")');
  console.log('  □ No romanticization of mission system');
  console.log('  □ Five-town consolidation names all five towns when relevant\n');

  console.log('LANDMARKS & CULTURE (Afghan-American/Little Kabul, Mission San Jose):\n');
  console.log('  □ Afghan-American/Little Kabul: cultural heritage focus, not refugee narrative');
  console.log('  □ Mission San Jose: disambiguated (historic mission vs modern district)');
  console.log('  □ Diversity: celebrates institutions/events, not census statistics\n');

  console.log('BUDGET & FINANCE (Tesla/NUMMI):\n');
  console.log('  □ Civic angles only (zoning, jobs, tax revenue)');
  console.log('  □ No Tesla products, no Elon Musk, no corporate strategy\n');

  console.log('ALL QUESTIONS:\n');
  console.log('  □ Clean and direct tone (clear, not stuffy, not trying to be funny)');
  console.log('  □ Explanation is informative and neutral with "According to..." citation');
  console.log('  □ Four plausible answer options (no obviously wrong throwaway answers)');
  console.log('  □ Correct answer is actually correct\n');

  console.log('='.repeat(80) + '\n');
  console.log('Next step: Review the sample above. If approved, run:');
  console.log('  npx tsx src/scripts/content-generation/curate-fremont-questions.ts --mode curate\n');
}

// MODE 2: Curate to ~100
async function runCurateMode() {
  console.log('=== CURATION MODE ===\n');

  const collectionId = await getFremontCollectionId();
  const allQuestions = await fetchDraftQuestions(collectionId);

  console.log(`Total draft questions: ${allQuestions.length}\n`);

  // Group by topic
  const byTopic: Record<string, QuestionRecord[]> = {};
  for (const q of allQuestions) {
    const topic = q.subcategory || 'unknown';
    if (!byTopic[topic]) byTopic[topic] = [];
    byTopic[topic].push(q);
  }

  // Score each question
  const scoredByTopic: Record<string, ScoredQuestion[]> = {};

  for (const [topic, questions] of Object.entries(byTopic)) {
    scoredByTopic[topic] = questions.map(q => {
      let score = 0;

      // Engagement penalties
      if (q.text.toLowerCase().includes('in what year')) score -= 20;
      if (q.text.match(/\d{3}-\d{3}-\d{4}/)) score -= 50; // Phone number pattern

      // Source quality bonuses
      if (q.source.url.includes('.gov')) score += 10;
      if (q.source.url.includes('.edu')) score += 5;

      // Explanation quality bonus
      if (q.explanation.length > 200) score += 10;

      // Difficulty bonus (counter AI's easy-skew)
      if (q.difficulty === 'medium') score += 10;
      if (q.difficulty === 'hard') score += 15;

      // Freshness bonus
      if (q.expiresAt) score += 15;

      return { ...q, score };
    });

    // Sort by score descending
    scoredByTopic[topic].sort((a, b) => b.score - a.score);
  }

  // Select top N per topic matching distribution targets
  const curated: ScoredQuestion[] = [];
  const topicDistribution = fremontConfig.topicDistribution as Record<string, number>;

  console.log('Curation by Topic:\n');

  for (const [topic, targetCount] of Object.entries(topicDistribution)) {
    const available = scoredByTopic[topic] || [];
    const selected = available.slice(0, targetCount);
    curated.push(...selected);

    console.log(`  ${topic}: ${selected.length}/${available.length} kept (target: ${targetCount})`);
  }

  console.log(`\nTotal curated: ${curated.length} questions\n`);

  // Difficulty breakdown
  const difficultyBreakdown: Record<string, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  for (const q of curated) {
    difficultyBreakdown[q.difficulty] = (difficultyBreakdown[q.difficulty] || 0) + 1;
  }

  const total = curated.length;
  console.log('Difficulty Distribution:');
  console.log(`  Easy: ${difficultyBreakdown.easy} (${Math.round((difficultyBreakdown.easy / total) * 100)}%)`);
  console.log(`  Medium: ${difficultyBreakdown.medium} (${Math.round((difficultyBreakdown.medium / total) * 100)}%)`);
  console.log(`  Hard: ${difficultyBreakdown.hard} (${Math.round((difficultyBreakdown.hard / total) * 100)}%)\n`);

  // Write curated IDs to global variable for activate mode
  const curatedIds = curated.map(q => q.externalId).sort();

  console.log('Curated Question IDs:');
  console.log(curatedIds.join(','));
  console.log('\n');

  // Save to temp file for activate mode
  const fs = await import('fs');
  const path = await import('path');
  const tempFile = path.join(process.cwd(), 'src', 'scripts', 'data', 'curated-fremont-ids.txt');
  fs.writeFileSync(tempFile, curatedIds.join(','), 'utf-8');
  console.log(`Curated IDs saved to: ${tempFile}\n`);

  console.log('Next step: Review the curation report above. If approved, run:');
  console.log('  npx tsx src/scripts/content-generation/curate-fremont-questions.ts --mode activate --all-curated\n');
}

// MODE 3: Activate curated questions
async function runActivateMode() {
  console.log('=== ACTIVATION MODE ===\n');

  const collectionId = await getFremontCollectionId();

  let idsToActivate: string[];

  if (allCuratedFlag) {
    // Load from temp file
    const fs = await import('fs');
    const path = await import('path');
    const tempFile = path.join(process.cwd(), 'src', 'scripts', 'data', 'curated-fremont-ids.txt');

    if (!fs.existsSync(tempFile)) {
      console.error('Error: curated-fremont-ids.txt not found. Run --mode curate first.');
      process.exit(1);
    }

    const fileContent = fs.readFileSync(tempFile, 'utf-8');
    idsToActivate = fileContent.split(',').map(id => id.trim()).filter(Boolean);
  } else if (idsArg) {
    idsToActivate = idsArg.split(',').map(id => id.trim()).filter(Boolean);
  } else {
    console.error('Error: Must specify --all-curated or --ids=fre-001,fre-002,...');
    process.exit(1);
  }

  console.log(`Activating ${idsToActivate.length} questions...\n`);

  // Update status to active
  const result = await db
    .update(questions)
    .set({
      status: 'active',
      updatedAt: new Date()
    })
    .where(
      and(
        inArray(questions.externalId, idsToActivate),
        eq(questions.status, 'draft')
      )
    )
    .returning({ externalId: questions.externalId });

  console.log(`Activated: ${result.length} questions\n`);

  if (result.length !== idsToActivate.length) {
    console.warn(`Warning: Expected to activate ${idsToActivate.length}, but only ${result.length} were updated.`);
    console.warn('Some IDs may not exist or are already active.\n');
  }

  // Verify activation
  const activeCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM civic_trivia.questions q
    JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
    WHERE cq.collection_id = ${collectionId} AND q.status = 'active'
  `);

  console.log(`Total active Fremont questions: ${activeCount.rows[0].count}\n`);
  console.log('✓ Activation complete\n');
}

// Main execution
async function main() {
  try {
    if (modeArg === 'sample') {
      await runSampleMode();
    } else if (modeArg === 'curate') {
      await runCurateMode();
    } else if (modeArg === 'activate') {
      await runActivateMode();
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

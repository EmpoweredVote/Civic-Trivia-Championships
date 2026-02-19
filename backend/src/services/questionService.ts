/**
 * Question service - Collection-scoped question selection from PostgreSQL
 * Handles difficulty-balanced ordering, recent-question exclusion, and silent JSON fallback
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../db/index.js';
import { questions, collections, collectionQuestions, topics } from '../db/schema.js';
import { eq, and, notInArray, isNull, or, gt, sql } from 'drizzle-orm';
import { Question } from '../services/sessionService.js';

// Get current file's directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Module-level caches (these values never change during runtime)
let cachedFederalCollectionId: number | null = null;
let cachedTopicMap: Map<number, string> | null = null;

// Type for raw DB rows returned from the question query
interface DBQuestionRow {
  id: number;
  externalId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topicId: number;
  subcategory: string | null;
  source: { name: string; url: string };
  learningContent: { paragraphs: string[]; corrections: Record<string, string> } | null;
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Load topic map from database (cached after first load)
 * Maps topic ID to display name
 */
async function loadTopicMap(): Promise<Map<number, string>> {
  if (cachedTopicMap !== null) {
    return cachedTopicMap;
  }

  const rows = await db.select({ id: topics.id, name: topics.name }).from(topics);
  const map = new Map<number, string>();
  for (const row of rows) {
    map.set(row.id, row.name);
  }
  cachedTopicMap = map;
  return map;
}

/**
 * Transform DB question rows to the existing Question interface
 * Critical: uses externalId as id (NOT the database serial id)
 */
function transformDBQuestions(dbRows: DBQuestionRow[], topicMap: Map<number, string>): Question[] {
  return dbRows.map((row): Question => {
    const topicName = topicMap.get(row.topicId) || 'Unknown';

    const question: Question = {
      id: row.externalId,
      text: row.text,
      options: row.options,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation,
      difficulty: row.difficulty,
      topic: topicName,
      topicCategory: row.subcategory || '',
    };

    if (row.learningContent !== null) {
      question.learningContent = {
        topic: topicName,
        paragraphs: row.learningContent.paragraphs,
        corrections: row.learningContent.corrections,
        source: row.source,
      };
    }

    return question;
  });
}

/**
 * Load questions from JSON file as emergency fallback
 * Shuffled and limited to 10 — no difficulty ordering, no collection filtering
 */
function loadQuestionsFromJSON(): Question[] {
  const questionsPath = join(__dirname, '../data/questions.json');
  const questionsData = readFileSync(questionsPath, 'utf-8');
  const allQuestions: Question[] = JSON.parse(questionsData);
  return shuffle(allQuestions).slice(0, 10);
}

/**
 * Apply difficulty selection algorithm to produce a balanced 10-question set.
 *
 * Target distribution:
 *   Q1  = easy
 *   Q10 = hard
 *   Q2-Q9 = 3 easy + 3 medium + 2 hard (shuffled)
 *
 * Constraint relaxation: if any pool is too small, fill from other pools.
 * Never returns duplicates. Always returns up to 10 unique questions.
 */
function applyDifficultySelection(
  allRows: DBQuestionRow[],
  collectionId: number
): DBQuestionRow[] {
  const easyPool = shuffle(allRows.filter(q => q.difficulty === 'easy'));
  const mediumPool = shuffle(allRows.filter(q => q.difficulty === 'medium'));
  const hardPool = shuffle(allRows.filter(q => q.difficulty === 'hard'));

  const total = allRows.length;

  if (total < 10) {
    console.warn(
      `Relaxed difficulty constraints: only ${total} questions available for collection ${collectionId}`
    );
    return shuffle(allRows);
  }

  // Pick Q1 (easy) — fallback to medium, then hard
  let q1: DBQuestionRow | undefined;
  if (easyPool.length > 0) {
    q1 = easyPool.shift()!;
  } else if (mediumPool.length > 0) {
    q1 = mediumPool.shift()!;
  } else {
    q1 = hardPool.shift()!;
  }

  // Pick Q10 (hard) — fallback to medium, then easy
  let q10: DBQuestionRow | undefined;
  if (hardPool.length > 0) {
    q10 = hardPool.shift()!;
  } else if (mediumPool.length > 0) {
    q10 = mediumPool.shift()!;
  } else {
    q10 = easyPool.shift()!;
  }

  // For Q2-Q9, pick 3 easy + 3 medium + 2 hard
  // Track how many we still need from each pool
  let needEasy = 3;
  let needMedium = 3;
  let needHard = 2;

  const middleQuestions: DBQuestionRow[] = [];

  // Pick from easy pool
  while (needEasy > 0 && easyPool.length > 0) {
    middleQuestions.push(easyPool.shift()!);
    needEasy--;
  }

  // Pick from medium pool
  while (needMedium > 0 && mediumPool.length > 0) {
    middleQuestions.push(mediumPool.shift()!);
    needMedium--;
  }

  // Pick from hard pool
  while (needHard > 0 && hardPool.length > 0) {
    middleQuestions.push(hardPool.shift()!);
    needHard--;
  }

  // Fill remaining gaps from any available pool
  const remaining = needEasy + needMedium + needHard;
  if (remaining > 0) {
    const remainingAll = shuffle([...easyPool, ...mediumPool, ...hardPool]);
    for (let i = 0; i < remaining && i < remainingAll.length; i++) {
      middleQuestions.push(remainingAll[i]);
    }
    if (remaining > remainingAll.length) {
      console.warn(
        `Relaxed difficulty constraints: only ${total} questions available for collection ${collectionId}`
      );
    }
  }

  // Shuffle the 8 middle questions
  const shuffledMiddle = shuffle(middleQuestions);

  // Combine: [Q1_easy, ...middle_8_shuffled, Q10_hard]
  return [q1!, ...shuffledMiddle, q10!];
}

/**
 * Resolve the federal civics collection ID (cached after first lookup)
 * Returns 1 as hardcoded fallback if query fails (seed creates Federal as ID 1)
 */
export async function getFederalCollectionId(): Promise<number> {
  if (cachedFederalCollectionId !== null) {
    return cachedFederalCollectionId;
  }

  try {
    const result = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.slug, 'federal-civics'))
      .limit(1);

    if (result.length > 0) {
      cachedFederalCollectionId = result[0].id;
      return cachedFederalCollectionId;
    }

    // Collection not found — return hardcoded fallback
    console.warn('Federal civics collection not found by slug, using fallback ID 1');
    return 1;
  } catch (error) {
    console.warn('Failed to query federal collection ID, using fallback ID 1:', error);
    return 1;
  }
}

/**
 * Get collection metadata by ID
 * Returns null if not found or on error — never throws
 */
export async function getCollectionMetadata(
  collectionId: number
): Promise<{ id: number; name: string; slug: string } | null> {
  try {
    const result = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
      })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.warn('Failed to query collection metadata:', error);
    return null;
  }
}

/**
 * Select 10 questions for a game session from a specific collection.
 *
 * Algorithm:
 *   1. Resolve collectionId (use federal-civics if null)
 *   2. Query all available questions for the collection (excluding recent + expired)
 *   3. Apply difficulty selection: Q1=easy, Q10=hard, Q2-Q9=balanced mix
 *   4. Transform DB rows to the existing Question interface (externalId -> id)
 *   5. On any error: fall back silently to JSON file
 *
 * @param collectionId - Collection to query (null = federal civics)
 * @param recentQuestionIds - Question external IDs to exclude from selection
 * @returns Array of up to 10 questions shaped as Question interface
 */
export async function selectQuestionsForGame(
  collectionId: number | null,
  recentQuestionIds: string[]
): Promise<Question[]> {
  try {
    // Resolve collection ID
    const targetCollectionId = collectionId ?? await getFederalCollectionId();

    // Load topic map (cached)
    const topicMap = await loadTopicMap();

    // Build query conditions
    const now = new Date();

    // Base conditions: join collection and exclude expired
    const baseConditions = and(
      eq(collectionQuestions.collectionId, targetCollectionId),
      or(isNull(questions.status), eq(questions.status, 'active')),
      or(
        isNull(questions.expiresAt),
        gt(questions.expiresAt, now)
      )
    );

    // Add recent question exclusion if any IDs provided
    const whereCondition = recentQuestionIds.length > 0
      ? and(baseConditions, notInArray(questions.externalId, recentQuestionIds))
      : baseConditions;

    // Query all matching questions for difficulty selection
    const dbRows = await db
      .select({
        id: questions.id,
        externalId: questions.externalId,
        text: questions.text,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        explanation: questions.explanation,
        difficulty: questions.difficulty,
        topicId: questions.topicId,
        subcategory: questions.subcategory,
        source: questions.source,
        learningContent: questions.learningContent,
      })
      .from(questions)
      .innerJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
      .where(whereCondition);

    if (dbRows.length === 0) {
      console.warn(
        `No questions found for collection ${targetCollectionId}, falling back to JSON`
      );
      return loadQuestionsFromJSON();
    }

    // Apply difficulty selection algorithm
    const selectedRows = applyDifficultySelection(
      dbRows as DBQuestionRow[],
      targetCollectionId
    );

    // Transform DB rows to Question interface
    return transformDBQuestions(selectedRows as DBQuestionRow[], topicMap);
  } catch (error) {
    console.warn('Database question query failed, falling back to JSON:', error);
    return loadQuestionsFromJSON();
  }
}

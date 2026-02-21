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
import { gameModes, DEFAULT_GAME_MODE } from './gameModes.js';
import type { DBQuestionRow } from './gameModes.js';

const TOTAL_QUESTIONS = 8;

// Get current file's directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Module-level caches (these values never change during runtime)
let cachedFederalCollectionId: number | null = null;
let cachedTopicMap: Map<number, string> | null = null;

// Re-export DBQuestionRow for external consumers
export type { DBQuestionRow } from './gameModes.js';

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
 * Shuffled and limited to 8 — no difficulty ordering, no collection filtering
 */
function loadQuestionsFromJSON(): Question[] {
  const questionsPath = join(__dirname, '../data/questions.json');
  const questionsData = readFileSync(questionsPath, 'utf-8');
  const allQuestions: Question[] = JSON.parse(questionsData);
  return shuffle(allQuestions).slice(0, TOTAL_QUESTIONS);
}

/**
 * Apply difficulty selection using the pluggable game mode strategy system.
 *
 * Delegates to the selected strategy from gameModes registry.
 * Falls back to DEFAULT_GAME_MODE if the requested mode is unknown.
 *
 * Constraint relaxation: if fewer than TOTAL_QUESTIONS available, returns all shuffled.
 */
function applyDifficultySelection(
  allRows: DBQuestionRow[],
  collectionId: number,
  gameMode?: string
): DBQuestionRow[] {
  const modeName = gameMode && gameModes[gameMode] ? gameMode : DEFAULT_GAME_MODE;
  const strategy = gameModes[modeName];

  const easyPool = shuffle(allRows.filter(q => q.difficulty === 'easy'));
  const mediumPool = shuffle(allRows.filter(q => q.difficulty === 'medium'));
  const hardPool = shuffle(allRows.filter(q => q.difficulty === 'hard'));

  if (allRows.length < TOTAL_QUESTIONS) {
    console.warn(
      `Relaxed difficulty constraints: only ${allRows.length} questions for collection ${collectionId}`
    );
    return shuffle(allRows);
  }

  return strategy(easyPool, mediumPool, hardPool, TOTAL_QUESTIONS);
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
 * Select 8 questions for a game session from a specific collection.
 *
 * Algorithm:
 *   1. Resolve collectionId (use federal-civics if null)
 *   2. Query all available questions for the collection (excluding recent + expired)
 *   3. Apply difficulty selection: Q1=easy, Q8=hard, Q2-Q7=balanced mix
 *   4. Transform DB rows to the existing Question interface (externalId -> id)
 *   5. On any error: fall back silently to JSON file
 *
 * @param collectionId - Collection to query (null = federal civics)
 * @param recentQuestionIds - Question external IDs to exclude from selection
 * @param gameMode - Game mode strategy name (defaults to 'easy-steps')
 * @returns Array of up to 8 questions shaped as Question interface
 */
export async function selectQuestionsForGame(
  collectionId: number | null,
  recentQuestionIds: string[],
  gameMode?: string
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
      eq(questions.status, 'active'),
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

    // Deduplicate DB rows by externalId (safety net against unexpected join duplicates)
    const seenIds = new Set<string>();
    const uniqueRows = (dbRows as DBQuestionRow[]).filter(row => {
      if (seenIds.has(row.externalId)) {
        console.warn(`Duplicate question detected in query results: ${row.externalId}`);
        return false;
      }
      seenIds.add(row.externalId);
      return true;
    });

    console.log(
      `Question selection: collection=${targetCollectionId}, available=${uniqueRows.length}, excluded=${recentQuestionIds.length}`
    );

    // Apply difficulty selection algorithm
    const selectedRows = applyDifficultySelection(
      uniqueRows,
      targetCollectionId,
      gameMode
    );

    // Final dedup safety check on selected questions
    const selectedIds = new Set<string>();
    const dedupedSelected = selectedRows.filter(row => {
      if (selectedIds.has(row.externalId)) {
        console.error(`DUPLICATE in final selection: ${row.externalId} "${row.text.substring(0, 60)}..."`);
        return false;
      }
      selectedIds.add(row.externalId);
      return true;
    });

    // Transform DB rows to Question interface
    return transformDBQuestions(dedupedSelected, topicMap);
  } catch (error) {
    console.warn('Database question query failed, falling back to JSON:', error);
    return loadQuestionsFromJSON();
  }
}

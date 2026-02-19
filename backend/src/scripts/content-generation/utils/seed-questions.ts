import { db } from '../../../db/index.js';
import { questions, collectionQuestions, topics, collections, collectionTopics } from '../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { ValidatedQuestion } from '../question-schema.js';

export interface TopicCategoryInput {
  slug: string;
  name: string;
  description: string;
}

/**
 * Ensures all topic categories exist for a locale collection and links them.
 * Returns a map of topicSlug → topicId for use when seeding questions.
 *
 * @param collectionSlug - The collection's slug (e.g., 'bloomington-in')
 * @param topicCategories - Topic category definitions from locale config
 * @returns Record<topicSlug, topicId>
 */
export async function ensureLocaleTopics(
  collectionSlug: string,
  topicCategories: TopicCategoryInput[]
): Promise<Record<string, number>> {
  // Look up the collection
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, collectionSlug))
    .limit(1);

  if (!collection) {
    throw new Error(`Collection not found for slug: ${collectionSlug}. Run db:seed first.`);
  }

  const collectionId = collection.id;
  const topicIdMap: Record<string, number> = {};

  for (const category of topicCategories) {
    // Upsert topic — insert if not exists, get ID either way
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
        // Race condition — fetch again
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

    // Link topic to collection if not already linked
    await db
      .insert(collectionTopics)
      .values({ collectionId, topicId })
      .onConflictDoNothing();

    topicIdMap[category.slug] = topicId;
    console.log(`  Topic ready: ${category.slug} (id: ${topicId})`);
  }

  return topicIdMap;
}

/**
 * Seeds a batch of validated questions to the database.
 * Questions are inserted with status='draft' for admin review before activation.
 * Skips questions with duplicate externalIds (ON CONFLICT DO NOTHING).
 *
 * @param batch - Array of validated questions from AI generation
 * @param collectionId - Database ID of the target collection
 * @param topicIdMap - Map of topicSlug → topicId from ensureLocaleTopics()
 */
export async function seedQuestionBatch(
  batch: ValidatedQuestion[],
  collectionId: number,
  topicIdMap: Record<string, number>
): Promise<{ seeded: number; skipped: number }> {
  let seeded = 0;
  let skipped = 0;

  for (const question of batch) {
    const topicId = topicIdMap[question.topicCategory];

    if (!topicId) {
      console.warn(`  Warning: No topicId found for category "${question.topicCategory}" — skipping ${question.externalId}`);
      skipped++;
      continue;
    }

    // Build question record matching NewQuestion type from schema
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
      status: 'draft' as const, // Admin reviews and activates
      expirationHistory: [],
    };

    // Insert question — skip if externalId already exists
    const inserted = await db
      .insert(questions)
      .values(newQuestion)
      .onConflictDoNothing()
      .returning({ id: questions.id });

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

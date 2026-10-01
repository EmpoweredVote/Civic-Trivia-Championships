import { db } from '../../../db/index.js';
import { questions, collectionQuestions, topics, collections, collectionTopics } from '../../../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import type { ValidatedQuestion } from '../question-schema.js';
import { DuplicateDetector, normalizeText } from '../../../services/qualityRules/rules/duplicate.js';
import { placeAnswer } from '../../../services/questionQuality/answerPlacement.js';

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
 * Also checks for duplicate question text against existing questions in the collection.
 *
 * @param batch - Array of validated questions from AI generation
 * @param collectionId - Database ID of the target collection
 * @param topicIdMap - Map of topicSlug → topicId from ensureLocaleTopics()
 */
export async function seedQuestionBatch(
  batch: ValidatedQuestion[],
  collectionId: number,
  topicIdMap: Record<string, number>
): Promise<{
  seeded: number;
  skipped: number;
  duplicateTexts: number;
  placements: Record<string, number>;
}> {
  let seeded = 0;
  let skipped = 0;
  let duplicateTexts = 0;
  // Tallied per batch so an off-target answer is visible rather than silent. Some misses
  // are CORRECT -- a "in what year did X happen?" question cannot take position A without
  // inventing three later years -- so this number should be small, not zero.
  // Seeded with the four known outcomes so a zero PRINTS -- "0 sorted-off-target" says
  // the run had no misses, whereas an absent line cannot be told from an unreported one.
  // Not a closed set: an unrecognised placement still appears rather than being dropped.
  const placements: Record<string, number> = {
    sorted: 0,
    'sorted-off-target': 0,
    permuted: 0,
    unchanged: 0,
  };

  // Load existing ACTIVE and DRAFT questions for this collection to detect duplicate text.
  // Archived questions are excluded — they were curated out and must not block regeneration.
  const existingQuestionLinks = await db
    .select({ questionId: collectionQuestions.questionId })
    .from(collectionQuestions)
    .where(eq(collectionQuestions.collectionId, collectionId));

  const detector = new DuplicateDetector();

  if (existingQuestionLinks.length > 0) {
    const existingQIds = existingQuestionLinks.map(l => l.questionId);
    const existingQuestions = await db
      .select({ externalId: questions.externalId, text: questions.text })
      .from(questions)
      .where(
        and(
          inArray(questions.id, existingQIds),
          inArray(questions.status, ['active', 'draft'])
        )
      );

    detector.loadExisting(existingQuestions);
    console.log(`  Loaded ${existingQuestions.length} active/draft questions for duplicate text detection`);
  }

  for (const question of batch) {
    const topicId = topicIdMap[question.topicCategory];

    if (!topicId) {
      console.warn(`  Warning: No topicId found for category "${question.topicCategory}" — skipping ${question.externalId}`);
      skipped++;
      continue;
    }

    // Check for duplicate question text against existing questions
    const dupResult = detector.check(question);
    if (!dupResult.passed) {
      const dupViolation = dupResult.violations[0];
      console.warn(`  Rejected (duplicate text): ${question.externalId} — ${dupViolation.message}`);
      duplicateTexts++;
      skipped++;
      continue;
    }

    // Move the correct answer off wherever the model left it -- the prompt's output
    // example says correctAnswer: 0 and models copy it. Seeded on externalId so
    // regenerating the same question does not move its answer between reviews.
    const placed = placeAnswer(question.options, question.correctAnswer, question.externalId);
    placements[placed.placement] = (placements[placed.placement] ?? 0) + 1;

    // Build question record matching NewQuestion type from schema
    const newQuestion = {
      externalId: question.externalId,
      text: question.text,
      options: placed.options,
      correctAnswer: placed.correctAnswer,
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

    // Track this question for duplicate detection within the batch
    detector.add(question);
    seeded++;
  }

  console.log(`  Seeded: ${seeded} questions, Skipped: ${skipped} (${duplicateTexts} duplicate text, ${skipped - duplicateTexts} duplicate externalId)`);
  // Read as a set, not as individual rows: 'sorted-off-target' is generation failing to
  // build distractors that land the answer where the id said, which is sometimes the only
  // plausible outcome. A large share of it means the prompt is not being followed.
  const placementOrder = ['sorted', 'sorted-off-target', 'permuted', 'unchanged'];
  const placementSummary = Object.entries(placements)
    .sort(([a], [b]) => {
      const ia = placementOrder.indexOf(a);
      const ib = placementOrder.indexOf(b);
      return (ia < 0 ? placementOrder.length : ia) - (ib < 0 ? placementOrder.length : ib)
        || a.localeCompare(b);
    })
    .map(([kind, n]) => `${n} ${kind}`)
    .join(', ');
  console.log(`  Answer placement: ${placementSummary}`);
  return { seeded, skipped, duplicateTexts, placements };
}

import { db } from '../db/index.js';
import { questions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Record a question encounter and optionally a correct answer.
 * Uses atomic SQL increment to avoid race conditions.
 * Designed to be called fire-and-forget -- errors are logged, never thrown to caller.
 *
 * @param externalId - The question's external ID (e.g., "q001")
 * @param wasCorrect - Whether the answer was correct
 */
export async function recordQuestionTelemetry(
  externalId: string,
  wasCorrect: boolean
): Promise<void> {
  try {
    if (wasCorrect) {
      await db.update(questions).set({
        encounterCount: sql`${questions.encounterCount} + 1`,
        correctCount: sql`${questions.correctCount} + 1`,
      }).where(eq(questions.externalId, externalId));
    } else {
      await db.update(questions).set({
        encounterCount: sql`${questions.encounterCount} + 1`,
      }).where(eq(questions.externalId, externalId));
    }
  } catch (error) {
    console.error('Telemetry recording failed for question', externalId, error);
  }
}

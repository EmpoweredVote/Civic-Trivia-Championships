/**
 * Feedback service for question flagging
 * Handles creation and deletion of flags with transactional flag_count updates
 */

import { db } from '../db/index.js';
import { questionFlags, questions } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Create a flag for a question (idempotent)
 * If flag already exists, returns existing flag without error
 * @param userId - User ID creating the flag
 * @param questionId - Question ID being flagged
 * @param sessionId - Game session ID where flag was created
 * @returns Object with created status and flag ID
 */
export async function createFlag(
  userId: number,
  questionId: number,
  sessionId: string
): Promise<{ created: boolean; flagId: number }> {
  return await db.transaction(async (tx) => {
    // Attempt insert with onConflictDoNothing
    const insertResult = await tx
      .insert(questionFlags)
      .values({
        userId,
        questionId,
        sessionId,
        reasons: null,
        elaborationText: null,
      })
      .onConflictDoNothing()
      .returning({ id: questionFlags.id });

    // If insert returned a row, flag was created (increment flag_count)
    if (insertResult.length > 0) {
      await tx
        .update(questions)
        .set({
          flagCount: sql`${questions.flagCount} + 1`,
        })
        .where(eq(questions.id, questionId));

      return { created: true, flagId: insertResult[0].id };
    }

    // Flag already exists - find existing flag ID
    const existingFlag = await tx
      .select({ id: questionFlags.id })
      .from(questionFlags)
      .where(
        and(
          eq(questionFlags.userId, userId),
          eq(questionFlags.questionId, questionId)
        )
      )
      .limit(1);

    return { created: false, flagId: existingFlag[0].id };
  });
}

/**
 * Delete a flag for a question
 * @param userId - User ID removing the flag
 * @param questionId - Question ID being unflagged
 * @returns True if flag was deleted, false if no flag existed
 */
export async function deleteFlag(
  userId: number,
  questionId: number
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    // Delete flag and return if row existed
    const deleteResult = await tx
      .delete(questionFlags)
      .where(
        and(
          eq(questionFlags.userId, userId),
          eq(questionFlags.questionId, questionId)
        )
      )
      .returning({ id: questionFlags.id });

    // If row was deleted, decrement flag_count (prevent negative with GREATEST)
    if (deleteResult.length > 0) {
      await tx
        .update(questions)
        .set({
          flagCount: sql`GREATEST(${questions.flagCount} - 1, 0)`,
        })
        .where(eq(questions.id, questionId));

      return true;
    }

    return false;
  });
}

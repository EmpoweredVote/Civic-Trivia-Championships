import { db } from '../db/index.js';
import { questions } from '../db/schema.js';
import { eq, and, lte, gt, isNotNull, sql } from 'drizzle-orm';

/**
 * Expiration sweep job
 *
 * Finds newly expired questions and updates their status to 'expired'
 * Logs expiring-soon questions (within 30 days) for monitoring
 * Outputs structured JSON logs for observability
 */
export async function runExpirationSweep(): Promise<void> {
  const startTime = Date.now();
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    // Find newly expired questions (expires_at <= now AND status = 'active')
    const expiredQuestions = await db
      .select({
        id: questions.id,
        externalId: questions.externalId,
        expiresAt: questions.expiresAt
      })
      .from(questions)
      .where(
        and(
          isNotNull(questions.expiresAt),
          lte(questions.expiresAt, now),
          eq(questions.status, 'active')
        )
      );

    // Update each newly expired question
    for (const question of expiredQuestions) {
      const historyEntry = {
        action: 'expired' as const,
        timestamp: now.toISOString(),
        previousExpiresAt: question.expiresAt?.toISOString()
      };

      await db
        .update(questions)
        .set({
          status: 'expired',
          expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`
        })
        .where(eq(questions.id, question.id));

      // Log expired question
      console.log(JSON.stringify({
        level: 'warn',
        job: 'expiration-sweep',
        message: 'Question expired',
        questionId: question.id,
        externalId: question.externalId,
        expiresAt: question.expiresAt?.toISOString()
      }));
    }

    // Find expiring-soon questions (expires_at > now AND expires_at <= now + 30 days AND status = 'active')
    const expiringSoonQuestions = await db
      .select({
        id: questions.id,
        externalId: questions.externalId,
        expiresAt: questions.expiresAt
      })
      .from(questions)
      .where(
        and(
          isNotNull(questions.expiresAt),
          gt(questions.expiresAt, now),
          lte(questions.expiresAt, thirtyDaysFromNow),
          eq(questions.status, 'active')
        )
      );

    // Log expiring-soon questions
    for (const question of expiringSoonQuestions) {
      const daysUntilExpiry = question.expiresAt
        ? Math.ceil((question.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      console.log(JSON.stringify({
        level: 'info',
        job: 'expiration-sweep',
        message: 'Question expiring soon',
        questionId: question.id,
        externalId: question.externalId,
        expiresAt: question.expiresAt?.toISOString(),
        daysUntilExpiry
      }));
    }

    // Log sweep summary
    const durationMs = Date.now() - startTime;
    console.log(JSON.stringify({
      level: 'info',
      job: 'expiration-sweep',
      message: 'Sweep complete',
      newlyExpiredCount: expiredQuestions.length,
      expiringSoonCount: expiringSoonQuestions.length,
      durationMs
    }));

  } catch (error) {
    console.log(JSON.stringify({
      level: 'error',
      job: 'expiration-sweep',
      message: 'Sweep failed',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }));
  }
}

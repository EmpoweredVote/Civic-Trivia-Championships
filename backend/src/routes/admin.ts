import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { questions, collections, collectionQuestions } from '../db/schema.js';
import { eq, and, or, lte, gt, isNotNull, sql, inArray } from 'drizzle-orm';

const router = Router();

// Apply authentication middleware to all admin routes
router.use(authenticateToken);

/**
 * GET /questions - List expired and expiring-soon questions
 * Query params:
 *   - status: 'expired' | 'expiring-soon' | 'archived' (optional, default: show all non-active)
 *   - collectionId: number (optional filter)
 */
router.get('/questions', async (req: Request, res: Response) => {
  try {
    const { status, collectionId } = req.query;

    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Build base query
    let whereConditions: any[] = [];

    if (status === 'expired') {
      whereConditions.push(eq(questions.status, 'expired'));
    } else if (status === 'expiring-soon') {
      whereConditions.push(
        and(
          eq(questions.status, 'active'),
          gt(questions.expiresAt, now),
          lte(questions.expiresAt, soonThreshold),
          isNotNull(questions.expiresAt)
        )
      );
    } else if (status === 'archived') {
      whereConditions.push(eq(questions.status, 'archived'));
    } else {
      // Default: show both expired AND expiring-soon
      whereConditions.push(
        or(
          eq(questions.status, 'expired'),
          and(
            eq(questions.status, 'active'),
            gt(questions.expiresAt, now),
            lte(questions.expiresAt, soonThreshold),
            isNotNull(questions.expiresAt)
          )
        )
      );
    }

    // Build query
    let query = db
      .select({
        id: questions.id,
        externalId: questions.externalId,
        text: questions.text,
        difficulty: questions.difficulty,
        expiresAt: questions.expiresAt,
        status: questions.status,
        expirationHistory: questions.expirationHistory,
        collectionId: collections.id,
        collectionName: collections.name
      })
      .from(questions)
      .leftJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
      .leftJoin(collections, eq(collectionQuestions.collectionId, collections.id))
      .where(and(...whereConditions))
      .orderBy(questions.expiresAt);

    const results = await query;

    // Group by question to collect multiple collection names
    const questionMap = new Map<number, any>();

    for (const row of results) {
      if (!questionMap.has(row.id)) {
        questionMap.set(row.id, {
          id: row.id,
          externalId: row.externalId,
          text: row.text,
          difficulty: row.difficulty,
          expiresAt: row.expiresAt,
          status: row.status,
          expirationHistory: row.expirationHistory,
          collectionNames: []
        });
      }

      if (row.collectionName) {
        questionMap.get(row.id)!.collectionNames.push(row.collectionName);
      }
    }

    // Convert map to array
    let questions_list = Array.from(questionMap.values());

    // Apply collectionId filter if specified
    if (collectionId) {
      const collectionIdNum = parseInt(collectionId as string, 10);
      if (!isNaN(collectionIdNum)) {
        // Re-query to get only questions in specified collection
        const collectionQuestionIds = await db
          .select({ questionId: collectionQuestions.questionId })
          .from(collectionQuestions)
          .where(eq(collectionQuestions.collectionId, collectionIdNum));

        const questionIdsInCollection = new Set(collectionQuestionIds.map(cq => cq.questionId));
        questions_list = questions_list.filter(q => questionIdsInCollection.has(q.id));
      }
    }

    res.json(questions_list);
  } catch (error) {
    console.error('Error fetching admin questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

/**
 * POST /questions/:id/renew - Renew an expired question
 * Body: { expiresAt: string } (ISO 8601 date string)
 */
router.post('/questions/:id/renew', async (req: Request, res: Response) => {
  try {
    const questionId = parseInt(req.params.id, 10);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    const { expiresAt } = req.body;
    if (!expiresAt) {
      return res.status(400).json({ error: 'expiresAt is required' });
    }

    // Validate that expiresAt is a valid future date
    const newExpiresAt = new Date(expiresAt);
    if (isNaN(newExpiresAt.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    if (newExpiresAt <= new Date()) {
      return res.status(400).json({ error: 'expiresAt must be in the future' });
    }

    // Fetch current question
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Build history entry
    const historyEntry = {
      action: 'renewed' as const,
      timestamp: new Date().toISOString(),
      previousExpiresAt: question.expiresAt?.toISOString() || null,
      newExpiresAt: newExpiresAt.toISOString()
    };

    // Update question: set status to 'active', update expiresAt, append to history
    const [updatedQuestion] = await db
      .update(questions)
      .set({
        status: 'active',
        expiresAt: newExpiresAt,
        expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(questions.id, questionId))
      .returning();

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Error renewing question:', error);
    res.status(500).json({ error: 'Failed to renew question' });
  }
});

/**
 * POST /questions/:id/archive - Permanently retire a question
 */
router.post('/questions/:id/archive', async (req: Request, res: Response) => {
  try {
    const questionId = parseInt(req.params.id, 10);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    // Fetch current question
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Build history entry
    const historyEntry = {
      action: 'archived' as const,
      timestamp: new Date().toISOString()
    };

    // Update question: set status to 'archived', append to history
    const [updatedQuestion] = await db
      .update(questions)
      .set({
        status: 'archived',
        expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(questions.id, questionId))
      .returning();

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Error archiving question:', error);
    res.status(500).json({ error: 'Failed to archive question' });
  }
});

export { router };

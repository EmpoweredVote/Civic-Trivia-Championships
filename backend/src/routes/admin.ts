import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { questions, collections, collectionQuestions } from '../db/schema.js';
import { eq, and, or, lte, gt, isNotNull, sql, inArray, ilike, desc, asc } from 'drizzle-orm';
import { auditQuestion } from '../services/qualityRules/index.js';
import type { QuestionInput } from '../services/qualityRules/types.js';

const router = Router();

// Apply authentication and admin middleware to all admin routes
router.use(authenticateToken, requireAdmin);

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

    res.json({ questions: questions_list });
  } catch (error: any) {
    console.error('Error fetching admin questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions', detail: error?.message || String(error) });
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

/**
 * GET /questions/explore - List questions with filtering, sorting, and pagination
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 25, max 100)
 *   - sort: 'quality_score' | 'difficulty' | 'encounter_count' | 'correct_count' | 'created_at' (default: 'quality_score')
 *   - order: 'asc' | 'desc' (default: 'asc')
 *   - collection: string (collection slug filter)
 *   - difficulty: 'easy' | 'medium' | 'hard'
 *   - status: 'active' | 'archived' | 'expired'
 *   - search: string (ILIKE search across text, options, explanation)
 */
router.get('/questions/explore', async (req: Request, res: Response) => {
  try {
    // Parse and validate query params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const sort = (req.query.sort as string) || 'quality_score';
    const order = (req.query.order as string) === 'desc' ? 'desc' : 'asc';

    const collectionFilter = req.query.collection as string;
    const difficultyFilter = req.query.difficulty as string;
    const statusFilter = req.query.status as string;
    const searchFilter = req.query.search as string;

    // Validate sort column
    const validSortColumns = ['quality_score', 'difficulty', 'encounter_count', 'correct_count', 'created_at'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'quality_score';

    // Build dynamic filters
    const filters: any[] = [];

    if (collectionFilter) {
      // Join on collection slug filter
      filters.push(eq(collections.slug, collectionFilter));
    }

    if (difficultyFilter && ['easy', 'medium', 'hard'].includes(difficultyFilter)) {
      filters.push(eq(questions.difficulty, difficultyFilter));
    }

    if (statusFilter && ['active', 'archived', 'expired'].includes(statusFilter)) {
      filters.push(eq(questions.status, statusFilter));
    }

    if (searchFilter && searchFilter.trim()) {
      const searchPattern = `%${searchFilter.trim()}%`;
      filters.push(
        or(
          ilike(questions.text, searchPattern),
          sql`${questions.options}::text ILIKE ${searchPattern}`,
          ilike(questions.explanation, searchPattern)
        )
      );
    }

    // Build base query with collection names aggregation
    let query = db
      .select({
        id: questions.id,
        externalId: questions.externalId,
        text: questions.text,
        difficulty: questions.difficulty,
        qualityScore: questions.qualityScore,
        violationCount: questions.violationCount,
        status: questions.status,
        encounterCount: questions.encounterCount,
        correctCount: questions.correctCount,
        createdAt: questions.createdAt,
        collectionNames: sql<string[]>`array_agg(DISTINCT ${collections.name})`
      })
      .from(questions)
      .leftJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
      .leftJoin(collections, eq(collectionQuestions.collectionId, collections.id))
      .groupBy(questions.id);

    // Apply filters
    if (filters.length > 0) {
      query = query.where(and(...filters)) as any;
    }

    // Apply sorting - ALWAYS use NULLS LAST for quality_score
    if (sortColumn === 'quality_score') {
      query = query.orderBy(
        order === 'desc'
          ? sql`${questions.qualityScore} DESC NULLS LAST`
          : sql`${questions.qualityScore} ASC NULLS LAST`
      ) as any;
    } else if (sortColumn === 'difficulty') {
      query = query.orderBy(order === 'desc' ? desc(questions.difficulty) : asc(questions.difficulty)) as any;
    } else if (sortColumn === 'encounter_count') {
      query = query.orderBy(order === 'desc' ? desc(questions.encounterCount) : asc(questions.encounterCount)) as any;
    } else if (sortColumn === 'correct_count') {
      query = query.orderBy(order === 'desc' ? desc(questions.correctCount) : asc(questions.correctCount)) as any;
    } else if (sortColumn === 'created_at') {
      query = query.orderBy(order === 'desc' ? desc(questions.createdAt) : asc(questions.createdAt)) as any;
    }

    // Get total count with same filters
    let countQuery = db
      .select({ count: sql<number>`COUNT(DISTINCT ${questions.id})` })
      .from(questions)
      .leftJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
      .leftJoin(collections, eq(collectionQuestions.collectionId, collections.id));

    if (filters.length > 0) {
      countQuery = countQuery.where(and(...filters)) as any;
    }

    const [{ count: total }] = await countQuery;

    // Apply pagination
    const results = await query.limit(limit).offset((page - 1) * limit);

    // Truncate text to 120 chars for table display
    const data = results.map(q => ({
      ...q,
      text: q.text.length > 120 ? q.text.substring(0, 120) + '...' : q.text
    }));

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching questions for exploration:', error);
    res.status(500).json({ error: 'Failed to fetch questions', detail: error?.message || String(error) });
  }
});

/**
 * GET /questions/:id/detail - Get full question details with quality audit
 * Returns full question data + computed quality violations
 */
router.get('/questions/:id/detail', async (req: Request, res: Response) => {
  try {
    const questionId = parseInt(req.params.id, 10);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    // Fetch full question with collection names
    const result = await db
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
        expiresAt: questions.expiresAt,
        status: questions.status,
        expirationHistory: questions.expirationHistory,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
        encounterCount: questions.encounterCount,
        correctCount: questions.correctCount,
        qualityScore: questions.qualityScore,
        violationCount: questions.violationCount,
        collectionNames: sql<string[]>`array_agg(DISTINCT ${collections.name})`
      })
      .from(questions)
      .leftJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
      .leftJoin(collections, eq(collectionQuestions.collectionId, collections.id))
      .where(eq(questions.id, questionId))
      .groupBy(questions.id)
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const questionData = result[0];

    // Map to QuestionInput format for quality audit
    const questionInput: QuestionInput = {
      text: questionData.text,
      options: questionData.options as string[],
      correctAnswer: questionData.correctAnswer,
      explanation: questionData.explanation,
      difficulty: questionData.difficulty,
      source: questionData.source as { name: string; url: string },
      externalId: questionData.externalId
    };

    // Run quality audit (skip URL check for fast response)
    const auditResult = await auditQuestion(questionInput, { skipUrlCheck: true });

    res.json({
      question: questionData,
      audit: {
        score: auditResult.score,
        violations: auditResult.violations,
        hasBlockingViolations: auditResult.hasBlockingViolations,
        hasAdvisoryOnly: auditResult.hasAdvisoryOnly
      }
    });
  } catch (error: any) {
    console.error('Error fetching question detail:', error);
    res.status(500).json({ error: 'Failed to fetch question detail', detail: error?.message || String(error) });
  }
});

export { router };

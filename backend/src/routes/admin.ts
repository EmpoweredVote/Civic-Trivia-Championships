import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { questions, collections, collectionQuestions } from '../db/schema.js';
import { eq, and, or, lte, gt, isNotNull, sql, inArray, ilike, desc, asc } from 'drizzle-orm';
import { auditQuestion } from '../services/qualityRules/index.js';
import type { QuestionInput } from '../services/qualityRules/types.js';
import { z } from 'zod';

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
 * Zod schema for validating question updates
 */
const UpdateQuestionSchema = z.object({
  text: z.string().min(20, 'Question text must be at least 20 characters').max(300, 'Question text must be at most 300 characters'),
  options: z.array(z.string().min(1, 'Option cannot be empty').max(150, 'Option must be at most 150 characters')).length(4, 'Must provide exactly 4 options'),
  correctAnswer: z.number().int().min(0, 'Correct answer must be between 0 and 3').max(3, 'Correct answer must be between 0 and 3'),
  explanation: z.string().min(30, 'Explanation must be at least 30 characters').max(500, 'Explanation must be at most 500 characters'),
  sourceUrl: z.string().url('Source URL must be a valid URL'),
  difficulty: z.number().int().min(1, 'Difficulty must be between 1 and 10').max(10, 'Difficulty must be between 1 and 10')
}).strict();

/**
 * Map numeric difficulty (1-10) to string difficulty (easy/medium/hard)
 */
function mapDifficultyToString(difficulty: number): string {
  if (difficulty >= 1 && difficulty <= 3) return 'easy';
  if (difficulty >= 4 && difficulty <= 7) return 'medium';
  if (difficulty >= 8 && difficulty <= 10) return 'hard';
  return 'medium'; // Fallback (should never happen with Zod validation)
}

/**
 * PUT /questions/:id - Update a question with validation and quality re-scoring
 * Body: { text, options, correctAnswer, explanation, sourceUrl, difficulty }
 * Returns: { question, qualityDelta: { oldScore, newScore, oldViolations, newViolations, violations } }
 */
router.put('/questions/:id', async (req: Request, res: Response) => {
  try {
    // Parse and validate question ID
    const questionId = parseInt(req.params.id, 10);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    // Validate request body with Zod
    const validation = UpdateQuestionSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.issues.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details
      });
    }

    const validatedData = validation.data;

    // Fetch existing question
    const [existingQuestion] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!existingQuestion) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Capture old quality metrics for delta
    const oldQualityScore = existingQuestion.qualityScore;
    const oldViolationCount = existingQuestion.violationCount;

    // Map numeric difficulty to string
    const difficultyString = mapDifficultyToString(validatedData.difficulty);

    // Preserve existing source.name, update URL
    const existingSource = existingQuestion.source as { name: string; url: string };
    const updatedSource = {
      name: existingSource.name,
      url: validatedData.sourceUrl
    };

    // Update the question in DB
    const [updatedQuestion] = await db
      .update(questions)
      .set({
        text: validatedData.text,
        options: validatedData.options,
        correctAnswer: validatedData.correctAnswer,
        explanation: validatedData.explanation,
        source: updatedSource,
        difficulty: difficultyString,
        updatedAt: new Date()
      })
      .where(eq(questions.id, questionId))
      .returning();

    // Build QuestionInput for quality audit
    const questionInput: QuestionInput = {
      text: validatedData.text,
      options: validatedData.options,
      correctAnswer: validatedData.correctAnswer,
      explanation: validatedData.explanation,
      difficulty: difficultyString,
      source: updatedSource,
      externalId: updatedQuestion.externalId
    };

    // Run quality audit (skip URL check for fast response)
    const auditResult = await auditQuestion(questionInput, { skipUrlCheck: true });

    // Update quality_score and violation_count
    await db
      .update(questions)
      .set({
        qualityScore: auditResult.score,
        violationCount: auditResult.violations.length
      })
      .where(eq(questions.id, questionId));

    // Fetch the fully updated question with collection names
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

    const finalQuestion = result[0];

    // Return updated question with quality delta
    res.json({
      question: finalQuestion,
      qualityDelta: {
        oldScore: oldQualityScore,
        newScore: auditResult.score,
        oldViolations: oldViolationCount,
        newViolations: auditResult.violations.length,
        violations: auditResult.violations
      }
    });
  } catch (error: any) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question', detail: error?.message || String(error) });
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
        totalPages: Math.ceil(total / limit)
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

/**
 * GET /collections/health - Get health stats for all collections
 * Returns aggregated stats for each collection including:
 * - Question counts (active, archived, total)
 * - Difficulty distribution
 * - Quality score summary (avg, min, unscored count)
 * - Telemetry aggregates (encounters, correct rate)
 */
router.get('/collections/health', async (req: Request, res: Response) => {
  try {
    // Single aggregated query for all collections
    const results = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        isActive: collections.isActive,
        themeColor: collections.themeColor,
        // Question counts
        activeCount: sql<number>`COUNT(DISTINCT ${questions.id}) FILTER (WHERE ${questions.status} = 'active')`,
        archivedCount: sql<number>`COUNT(DISTINCT ${questions.id}) FILTER (WHERE ${questions.status} = 'archived')`,
        totalCount: sql<number>`COUNT(DISTINCT ${questions.id})`,
        // Difficulty distribution (active questions only)
        easyCount: sql<number>`COUNT(DISTINCT ${questions.id}) FILTER (WHERE ${questions.difficulty} = 'easy' AND ${questions.status} = 'active')`,
        mediumCount: sql<number>`COUNT(DISTINCT ${questions.id}) FILTER (WHERE ${questions.difficulty} = 'medium' AND ${questions.status} = 'active')`,
        hardCount: sql<number>`COUNT(DISTINCT ${questions.id}) FILTER (WHERE ${questions.difficulty} = 'hard' AND ${questions.status} = 'active')`,
        // Quality score stats (active questions only, non-null scores)
        avgQualityScore: sql<number | null>`AVG(${questions.qualityScore}) FILTER (WHERE ${questions.status} = 'active' AND ${questions.qualityScore} IS NOT NULL)`,
        minQualityScore: sql<number | null>`MIN(${questions.qualityScore}) FILTER (WHERE ${questions.status} = 'active' AND ${questions.qualityScore} IS NOT NULL)`,
        unscoredCount: sql<number>`COUNT(${questions.id}) FILTER (WHERE ${questions.status} = 'active' AND ${questions.qualityScore} IS NULL)`,
        // Telemetry aggregates (active questions only)
        totalEncounters: sql<number>`SUM(${questions.encounterCount}) FILTER (WHERE ${questions.status} = 'active')`,
        totalCorrect: sql<number>`SUM(${questions.correctCount}) FILTER (WHERE ${questions.status} = 'active')`
      })
      .from(collections)
      .leftJoin(collectionQuestions, eq(collections.id, collectionQuestions.collectionId))
      .leftJoin(questions, eq(collectionQuestions.questionId, questions.id))
      .groupBy(collections.id)
      .orderBy(collections.sortOrder);

    // Map to response shape with calculated correct rate
    const collectionsData = results.map(r => {
      const totalEncounters = r.totalEncounters || 0;
      const totalCorrect = r.totalCorrect || 0;
      const overallCorrectRate = totalEncounters > 0
        ? Math.round((totalCorrect / totalEncounters) * 100)
        : null;

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        isActive: r.isActive,
        themeColor: r.themeColor,
        stats: {
          activeCount: Number(r.activeCount),
          archivedCount: Number(r.archivedCount),
          totalCount: Number(r.totalCount),
          difficulty: {
            easy: Number(r.easyCount),
            medium: Number(r.mediumCount),
            hard: Number(r.hardCount)
          },
          quality: {
            avgScore: r.avgQualityScore !== null ? Math.round(Number(r.avgQualityScore)) : null,
            minScore: r.minQualityScore !== null ? Number(r.minQualityScore) : null,
            unscoredCount: Number(r.unscoredCount)
          },
          telemetry: {
            totalEncounters,
            totalCorrect,
            overallCorrectRate
          }
        }
      };
    });

    res.json({ collections: collectionsData });
  } catch (error: any) {
    console.error('Error fetching collection health:', error);
    res.status(500).json({ error: 'Failed to fetch collection health', detail: error?.message || String(error) });
  }
});

export { router };

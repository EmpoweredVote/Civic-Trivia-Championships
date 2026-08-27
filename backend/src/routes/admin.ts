import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import { db } from '../db/index.js';
import { questions, collections, collectionQuestions, questionFlags, electionRaces } from '../db/schema.js';
import { eq, and, or, lte, gt, lt, isNotNull, sql, inArray, ilike, desc, asc } from 'drizzle-orm';
import { auditQuestion } from '../services/qualityRules/index.js';
import type { QuestionInput } from '../services/qualityRules/types.js';
import { z } from 'zod';
import { DuplicateReviewService } from '../services/DuplicateReviewService.js';
import { JSONSyncService } from '../services/JSONSyncService.js';
import { generateElectionQuestions, GenerationBlockedError } from '../services/generation/ElectionQuestionGenerator.js';
import { generateCurrentTermQuestions, FollowupBlockedError } from '../services/generation/CurrentTermQuestionGenerator.js';
import { lastCronRun } from '../cron/electionDetection.js';

const router = Router();

// Apply authentication and admin middleware to all admin routes
router.use(requireAuth, requireAdmin);

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
router.post('/questions/:id/renew', async (req: Request<{ id: string }>, res: Response) => {
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
 * Accepts optional body: { verdict?: string }
 * Records verdict and archiving admin's user ID in expirationHistory.
 */
router.post('/questions/:id/archive', async (req: Request<{ id: string }>, res: Response) => {
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

    // Build history entry with optional verdict and archivedBy
    const historyEntry = {
      action: 'archived' as const,
      timestamp: new Date().toISOString(),
      verdict: req.body.verdict || null,
      archivedBy: req.userId || null,
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
 * POST /questions/by-external-id/:externalId/archive - Archive a question by externalId
 * Used by the game frontend which only has externalId (e.g. "fre-001"), not numeric DB id.
 * Accepts optional body: { verdict?: string }
 * Records verdict and archiving admin's user ID in expirationHistory.
 */
router.post('/questions/by-external-id/:externalId/archive', async (req: Request<{ externalId: string }>, res: Response) => {
  try {
    const { externalId } = req.params;

    // Fetch current question by externalId
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.externalId, externalId))
      .limit(1);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Build history entry with optional verdict and archivedBy
    const historyEntry = {
      action: 'archived' as const,
      timestamp: new Date().toISOString(),
      verdict: req.body.verdict || null,
      archivedBy: req.userId || null,
    };

    // Update question: set status to 'archived', append to history
    const [updatedQuestion] = await db
      .update(questions)
      .set({
        status: 'archived',
        expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(questions.externalId, externalId))
      .returning();

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Error archiving question by external ID:', error);
    res.status(500).json({ error: 'Failed to archive question' });
  }
});

/**
 * POST /questions/:id/restore - Restore an archived question back to draft
 */
router.post('/questions/:id/restore', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const questionId = parseInt(req.params.id, 10);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const historyEntry = {
      action: 'restored' as const,
      timestamp: new Date().toISOString()
    };

    const [updatedQuestion] = await db
      .update(questions)
      .set({
        status: 'draft',
        expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(questions.id, questionId))
      .returning();

    res.json(updatedQuestion);
  } catch (error) {
    console.error('Error restoring question:', error);
    res.status(500).json({ error: 'Failed to restore question' });
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
router.put('/questions/:id', async (req: Request<{ id: string }>, res: Response) => {
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
 *   - status: 'active' | 'draft' | 'archived' | 'expired'
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
    const flaggedFilter = req.query.flagged as string;

    // Validate sort column
    const validSortColumns = ['quality_score', 'difficulty', 'encounter_count', 'correct_count', 'created_at', 'flag_count'];
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

    if (statusFilter && ['active', 'draft', 'archived', 'expired'].includes(statusFilter)) {
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

    if (flaggedFilter === 'true') {
      filters.push(gt(questions.flagCount, 0));
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
        flagCount: questions.flagCount,
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
    } else if (sortColumn === 'flag_count') {
      query = query.orderBy(order === 'desc' ? desc(questions.flagCount) : asc(questions.flagCount)) as any;
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
router.get('/questions/:id/detail', async (req: Request<{ id: string }>, res: Response) => {
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
        flagCount: questions.flagCount,
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
 * GET /collections - List all collections for admin dropdowns.
 * Unlike GET /api/game/collections, this has NO question-count floor
 * and NO is_active filter — admins need to see every collection.
 */
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const result = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        isActive: collections.isActive,
      })
      .from(collections)
      .orderBy(collections.sortOrder);
    res.json({ collections: result });
  } catch (error: any) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections', detail: error?.message || String(error) });
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

/**
 * GET /flags - Paginated list of flagged questions
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 25, max 100)
 *   - sort: 'flag_count' | 'created_at' (default: 'flag_count')
 *   - order: 'asc' | 'desc' (default: 'desc')
 *   - collection: string (collection slug filter)
 *   - tab: 'active' | 'archived' (default: 'active')
 * Returns: { data: FlaggedQuestionRow[], pagination: { page, limit, total, totalPages } }
 */
router.get('/flags', async (req: Request, res: Response) => {
  try {
    // Parse and validate query params
    let page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const sort = (req.query.sort as string) || 'flag_count';
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';
    const collectionFilter = req.query.collection as string;
    const tab = (req.query.tab as string) || 'active';
    const questionIdFilter = req.query.questionId as string;

    // Validate sort column
    const validSortColumns = ['flag_count', 'created_at'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'flag_count';

    // Build filters based on tab
    const filters: any[] = [];
    if (tab === 'active') {
      filters.push(eq(questions.status, 'active'));
      filters.push(gt(questions.flagCount, 0));
    } else if (tab === 'archived') {
      filters.push(eq(questions.status, 'archived'));
    }

    // Apply collection filter if provided
    if (collectionFilter) {
      filters.push(eq(collections.slug, collectionFilter));
    }

    // Apply questionId filter if provided
    if (questionIdFilter) {
      const questionIdNum = parseInt(questionIdFilter, 10);
      if (!isNaN(questionIdNum)) {
        filters.push(eq(questions.id, questionIdNum));
      }
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

    // Reset page to bounds if out of range
    const totalPages = Math.ceil(total / limit);
    if (page > totalPages && totalPages > 0) {
      page = totalPages;
    }

    // Build main query with collection names aggregation
    let query = db
      .select({
        id: questions.id,
        externalId: questions.externalId,
        text: questions.text,
        difficulty: questions.difficulty,
        status: questions.status,
        flagCount: questions.flagCount,
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

    // Apply sorting
    if (sortColumn === 'flag_count') {
      query = query.orderBy(order === 'desc' ? desc(questions.flagCount) : asc(questions.flagCount)) as any;
    } else if (sortColumn === 'created_at') {
      query = query.orderBy(order === 'desc' ? desc(questions.createdAt) : asc(questions.createdAt)) as any;
    }

    // Apply pagination
    const results = await query.limit(limit).offset((page - 1) * limit);

    // For each question, get reason breakdown and lastFlaggedAt
    const questionIds = results.map(r => r.id);

    let reasonsData: { questionId: number; reasons: string[] | null; createdAt: Date }[] = [];
    if (questionIds.length > 0) {
      reasonsData = await db
        .select({
          questionId: questionFlags.questionId,
          reasons: questionFlags.reasons,
          createdAt: questionFlags.createdAt
        })
        .from(questionFlags)
        .where(inArray(questionFlags.questionId, questionIds));
    }

    // Build reason breakdown and lastFlaggedAt for each question
    const flagDataMap = new Map<number, { reasonBreakdown: Record<string, number>; lastFlaggedAt: Date | null }>();

    for (const row of reasonsData) {
      if (!flagDataMap.has(row.questionId)) {
        flagDataMap.set(row.questionId, { reasonBreakdown: {}, lastFlaggedAt: null });
      }

      const flagData = flagDataMap.get(row.questionId)!;

      // Aggregate reasons
      if (row.reasons) {
        for (const reason of row.reasons) {
          flagData.reasonBreakdown[reason] = (flagData.reasonBreakdown[reason] || 0) + 1;
        }
      }

      // Track most recent flag date
      if (!flagData.lastFlaggedAt || row.createdAt > flagData.lastFlaggedAt) {
        flagData.lastFlaggedAt = row.createdAt;
      }
    }

    // Map to response shape
    const data = results.map(q => ({
      id: q.id,
      externalId: q.externalId,
      text: q.text.length > 120 ? q.text.substring(0, 120) + '...' : q.text,
      difficulty: q.difficulty,
      status: q.status,
      flagCount: q.flagCount,
      collectionNames: q.collectionNames.filter(Boolean),
      reasonBreakdown: flagDataMap.get(q.id)?.reasonBreakdown || {},
      lastFlaggedAt: flagDataMap.get(q.id)?.lastFlaggedAt || null
    }));

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching flagged questions:', error);
    res.status(500).json({ error: 'Failed to fetch flagged questions', detail: error?.message || String(error) });
  }
});

/**
 * GET /flags/:questionId/detail - Full question context + individual flags
 * Path param: questionId (numeric question ID)
 * Returns: { question: QuestionDetail, flags: FlagEntry[] }
 */
router.get('/flags/:questionId/detail', async (req: Request<{ questionId: string }>, res: Response) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
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
        flagCount: questions.flagCount,
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

    // Fetch individual flags - no users table JOIN (identity now in Supabase Auth)
    const flagsResult = await db.execute<{
      id: number;
      user_id: string;
      reasons: string[];
      elaboration_text: string | null;
      created_at: string;
    }>(sql`
      SELECT
        qf.id,
        qf.user_id,
        qf.reasons,
        qf.elaboration_text,
        qf.created_at
      FROM trivia.question_flags qf
      WHERE qf.question_id = ${questionId}
      ORDER BY qf.created_at DESC
      LIMIT 20
    `);

    const flags = flagsResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      reasons: row.reasons || [],
      elaboration: row.elaboration_text,
      createdAt: row.created_at
    }));

    res.json({
      question: questionData,
      flags
    });
  } catch (error: any) {
    console.error('Error fetching flag detail:', error);
    res.status(500).json({ error: 'Failed to fetch flag detail', detail: error?.message || String(error) });
  }
});

/**
 * PATCH /flags/:questionId/archive - Archive a flagged question
 * Path param: questionId (numeric question ID)
 * Returns: { success: true }
 */
router.patch('/flags/:questionId/archive', async (req: Request<{ questionId: string }>, res: Response) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    // Fetch current question to verify it exists
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

    // Update question: set status to 'archived', clear flag_count, append to history
    await db
      .update(questions)
      .set({
        status: 'archived',
        flagCount: 0,
        expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(questions.id, questionId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error archiving question:', error);
    res.status(500).json({ error: 'Failed to archive question', detail: error?.message || String(error) });
  }
});

/**
 * POST /flags/:questionId/dismiss - Dismiss flags (keep question active)
 * Path param: questionId (numeric question ID)
 * Returns: { success: true }
 */
router.post('/flags/:questionId/dismiss', async (req: Request<{ questionId: string }>, res: Response) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    // Verify question exists
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete all flag records
      await tx
        .delete(questionFlags)
        .where(eq(questionFlags.questionId, questionId));

      // Clear flag count
      await tx
        .update(questions)
        .set({
          flagCount: 0,
          updatedAt: new Date()
        })
        .where(eq(questions.id, questionId));
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error dismissing flags:', error);
    res.status(500).json({ error: 'Failed to dismiss flags', detail: error?.message || String(error) });
  }
});

/**
 * PATCH /flags/:questionId/restore - Restore an archived question
 * Path param: questionId (numeric question ID)
 * Returns: { success: true }
 */
router.patch('/flags/:questionId/restore', async (req: Request<{ questionId: string }>, res: Response) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
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

    if (question.status !== 'archived') {
      return res.status(400).json({ error: 'Question is not archived' });
    }

    // Build history entry (use 'renewed' to match existing history format)
    const historyEntry = {
      action: 'renewed' as const,
      timestamp: new Date().toISOString()
    };

    // Update question: set status to 'active', append to history
    await db
      .update(questions)
      .set({
        status: 'active',
        expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(questions.id, questionId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error restoring question:', error);
    res.status(500).json({ error: 'Failed to restore question', detail: error?.message || String(error) });
  }
});

// ============================================================================
// Duplicate Review Endpoints
// ============================================================================

// Singleton service instance (persists across requests for in-memory resolution state)
let duplicateReviewService: DuplicateReviewService | null = null;

/**
 * GET /duplicates - Load and return duplicate clusters with advanced flags
 * Query params:
 *   - tier: 'exact' | 'near-duplicate' | 'possible' (optional)
 *   - resolved: 'true' | 'false' (optional)
 * Returns: { clusters, advancedFlags, summary }
 */
router.get('/duplicates', async (req: Request, res: Response) => {
  try {
    // Lazy-initialize singleton service
    if (!duplicateReviewService) {
      duplicateReviewService = new DuplicateReviewService();
      try {
        await duplicateReviewService.loadReport();
      } catch (loadErr: any) {
        if (loadErr?.message?.includes('No scanner reports found')) {
          return res.json({
            clusters: [],
            advancedFlags: [],
            summary: { totalClusters: 0, pendingReview: 0, resolved: 0, autoResolvable: 0 },
            noReports: true,
          });
        }
        throw loadErr;
      }
    }

    // Parse filters
    const tierFilter = req.query.tier as string | undefined;
    const resolvedFilter = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;

    // Build filter object
    const filter: any = {};
    if (tierFilter && ['exact', 'near-duplicate', 'possible'].includes(tierFilter)) {
      filter.tier = tierFilter;
    }
    if (resolvedFilter !== undefined) {
      filter.resolved = resolvedFilter;
    }

    // Get clusters and advanced flags
    const enrichedClusters = duplicateReviewService.getClusters(filter);
    const advancedFlags = duplicateReviewService.getAdvancedFlags();

    // Build summary (field names match frontend DuplicateSummary type)
    const allClusters = duplicateReviewService.getClusters();
    const totalClusters = allClusters.length;
    const resolved = allClusters.filter(c => c.resolved).length;
    const pendingReview = totalClusters - resolved;
    const autoResolvable = allClusters.filter(c => c.autoResolvable && !c.resolved).length;

    res.json({
      clusters: enrichedClusters,
      advancedFlags,
      summary: {
        totalClusters,
        pendingReview,
        resolved,
        autoResolvable,
      },
    });
  } catch (error: any) {
    console.error('Error fetching duplicates:', error);
    res.status(500).json({ error: 'Failed to fetch duplicates', detail: error?.message || String(error) });
  }
});

/**
 * POST /duplicates/resolve - Resolve a single cluster
 * Body: { clusterId: string, keepExternalId: string }
 * Returns: { success: true, archived: string[], jsonSync: SyncSummary[] }
 */
router.post('/duplicates/resolve', async (req: Request, res: Response) => {
  try {
    // Validate body with Zod
    const ResolveSchema = z.object({
      clusterId: z.string(),
      keepExternalIds: z.array(z.string()),
    }).strict();

    const validation = ResolveSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.issues.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }

    const { clusterId, keepExternalIds } = validation.data;

    // Ensure service is loaded
    if (!duplicateReviewService) {
      duplicateReviewService = new DuplicateReviewService();
      await duplicateReviewService.loadReport();
    }

    // Resolve cluster (archive everything not in keepExternalIds)
    const archivedIds = await duplicateReviewService.resolveCluster(clusterId, keepExternalIds);

    // Sync JSON files
    const jsonSyncService = new JSONSyncService();
    const jsonSync = jsonSyncService.syncAfterArchive(archivedIds);

    res.json({
      success: true,
      archivedIds,
      jsonSync,
    });
  } catch (error: any) {
    console.error('Error resolving cluster:', error);
    res.status(500).json({ error: 'Failed to resolve cluster', detail: error?.message || String(error) });
  }
});

/**
 * POST /duplicates/auto-resolve - Auto-resolve all 90%+ clusters
 * Returns: { success: true, clustersResolved: number, totalArchived: number, jsonSync: SyncSummary[] }
 */
router.post('/duplicates/auto-resolve', async (req: Request, res: Response) => {
  try {
    // Ensure service is loaded
    if (!duplicateReviewService) {
      duplicateReviewService = new DuplicateReviewService();
      await duplicateReviewService.loadReport();
    }

    // Auto-resolve all eligible clusters
    const result = await duplicateReviewService.autoResolveAll();

    // Sync JSON files
    const jsonSyncService = new JSONSyncService();
    const jsonSync = jsonSyncService.syncAfterArchive(result.archivedExternalIds);

    res.json({
      success: true,
      clustersResolved: result.clustersResolved,
      totalArchived: result.totalArchived,
      jsonSync,
    });
  } catch (error: any) {
    console.error('Error auto-resolving clusters:', error);
    res.status(500).json({ error: 'Failed to auto-resolve clusters', detail: error?.message || String(error) });
  }
});

/**
 * POST /duplicates/undo - Undo a cluster resolution
 * Body: { clusterId: string }
 * Returns: { success: true, restored: string[] } or { error: 'Undo window expired' } with 400 status
 */
router.post('/duplicates/undo', async (req: Request, res: Response) => {
  try {
    // Validate body with Zod
    const UndoSchema = z.object({
      clusterId: z.string(),
    }).strict();

    const validation = UndoSchema.safeParse(req.body);
    if (!validation.success) {
      const details = validation.error.issues.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }

    const { clusterId } = validation.data;

    // Ensure service is loaded
    if (!duplicateReviewService) {
      duplicateReviewService = new DuplicateReviewService();
      await duplicateReviewService.loadReport();
    }

    // Undo resolution
    const restoredIds = await duplicateReviewService.undoResolve(clusterId);

    // Sync JSON files
    const jsonSyncService = new JSONSyncService();
    await jsonSyncService.syncAfterRestore(restoredIds);

    res.json({
      success: true,
      restored: restoredIds,
    });
  } catch (error: any) {
    console.error('Error undoing cluster resolution:', error);

    // Check if it's an undo window expiration
    if (error.message && error.message.includes('Undo window expired')) {
      return res.status(400).json({ error: 'Undo window expired' });
    }

    res.status(500).json({ error: 'Failed to undo resolution', detail: error?.message || String(error) });
  }
});

/**
 * GET /duplicates/summary - Quick stats without loading full clusters
 * Returns: { collections: [...], totalClusters: number, totalDuplicates: number }
 */
router.get('/duplicates/summary', async (req: Request, res: Response) => {
  try {
    // Ensure service is loaded
    if (!duplicateReviewService) {
      duplicateReviewService = new DuplicateReviewService();
      await duplicateReviewService.loadReport();
    }

    const allClusters = duplicateReviewService.getClusters();

    // Build collection-level stats
    const collectionStats = new Map<string, { questionCount: number; duplicateCount: number }>();

    for (const cluster of allClusters) {
      for (const question of cluster.questions) {
        for (const collectionName of question.collections) {
          if (!collectionStats.has(collectionName)) {
            collectionStats.set(collectionName, { questionCount: 0, duplicateCount: 0 });
          }
          const stats = collectionStats.get(collectionName)!;
          stats.questionCount++;

          // Only count as duplicate if not the keeper
          if (question.externalId !== cluster.recommendation.keep) {
            stats.duplicateCount++;
          }
        }
      }
    }

    // Convert to array
    const collectionsArray = Array.from(collectionStats.entries()).map(([name, stats]) => ({
      name,
      questionCount: stats.questionCount,
      duplicateCount: stats.duplicateCount,
    }));

    res.json({
      collections: collectionsArray,
      totalClusters: allClusters.length,
      totalDuplicates: allClusters.reduce((sum, c) => sum + (c.questions.length - 1), 0),
    });
  } catch (error: any) {
    console.error('Error fetching duplicate summary:', error);
    res.status(500).json({ error: 'Failed to fetch duplicate summary', detail: error?.message || String(error) });
  }
});

// ─── Zod schemas for election race endpoints ──────────────────────────────────

const enterResultSchema = z.object({
  winnerName: z.string().min(1).max(200),
  termEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  collectionSlug: z.string().min(1),
});

const updateRaceSchema = z.object({
  seat: z.string().min(1).max(200).optional(),
  electionType: z.enum(['primary', 'general', 'runoff', 'by-election']).optional(),
  electionDate: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().min(1).optional(),
  jurisdiction: z.string().min(1).max(200).optional(),
  candidates: z.array(z.object({
    name: z.string().min(1),
    party: z.string().min(1),
    incumbent: z.boolean(),
  })).optional(),
});

/**
 * GET /election-races/classified — Return races grouped into three lifecycle categories.
 *
 * Classification (strict priority):
 * 1. Awaiting Follow-up: election_date < now AND followup_generated = FALSE
 * 2. Active Elections:   questions_generated = TRUE AND election_date >= now
 * 3. Pending Generation: questions_generated = FALSE AND election_date >= now
 * Races with followup_generated = TRUE are complete — excluded from all tabs.
 *
 * IMPORTANT: This route is registered BEFORE GET /election-races to prevent
 * Express matching "/classified" as an :id param on the generic route.
 */
router.get('/election-races/classified', async (req: Request, res: Response) => {
  try {
    const now = new Date();

    // Fetch all races
    const allRaces = await db
      .select()
      .from(electionRaces)
      .orderBy(desc(electionRaces.electionDate));

    // Fetch question counts for all races in a single query (avoid N+1)
    const questionCounts = await db
      .select({
        electionRaceId: questions.electionRaceId,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .where(
        and(
          inArray(questions.status, ['active', 'draft']),
          isNotNull(questions.electionRaceId)
        )
      )
      .groupBy(questions.electionRaceId);

    const countMap = new Map(questionCounts.map((r) => [r.electionRaceId, r.count]));

    // Classify races by strict priority
    const activeElections: typeof allRaces = [];
    const pendingGeneration: typeof allRaces = [];
    const awaitingFollowup: typeof allRaces = [];

    for (const race of allRaces) {
      // Priority 1: Awaiting Follow-up (past election, followup not yet generated)
      if (race.electionDate < now && !race.followupGenerated) {
        awaitingFollowup.push(race);
        continue;
      }
      // Complete races (followup done) — excluded from all tabs
      if (race.followupGenerated) {
        continue;
      }
      // Priority 2: Active Elections (questions generated, future election)
      if (race.questionsGenerated && race.electionDate >= now) {
        activeElections.push(race);
        continue;
      }
      // Priority 3: Pending Generation (no questions yet, future election)
      if (!race.questionsGenerated && race.electionDate >= now) {
        pendingGeneration.push(race);
      }
    }

    // Attach questionCount to each race
    const attachCount = (races: typeof allRaces) =>
      races.map((r) => ({ ...r, questionCount: countMap.get(r.id) ?? 0 }));

    res.json({
      activeElections: attachCount(activeElections),
      pendingGeneration: attachCount(pendingGeneration),
      awaitingFollowup: attachCount(awaitingFollowup),
      cronLastRun: lastCronRun,
    });
  } catch (error: any) {
    console.error('Failed to classify election races:', error);
    res.status(500).json({ error: 'Failed to classify election races', detail: error?.message || String(error) });
  }
});

/**
 * GET /election-races — List all election races ordered by createdAt desc
 */
router.get('/election-races', async (req: Request, res: Response) => {
  try {
    const races = await db.select().from(electionRaces).orderBy(desc(electionRaces.createdAt));
    res.json({ races });
  } catch (error) {
    console.error('Failed to fetch election races:', error);
    res.status(500).json({ error: 'Failed to fetch election races' });
  }
});

const createElectionRaceSchema = z.object({
  seat: z.string().min(1).max(200),
  electionType: z.enum(['primary', 'general', 'runoff', 'by-election']),
  electionDate: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
  jurisdiction: z.string().min(1).max(200),
  candidates: z.array(z.object({
    name: z.string().min(1),
    party: z.string().min(1),
    incumbent: z.boolean(),
  })).default([]),
});

/**
 * POST /election-races — Create a new election race
 */
router.post('/election-races', async (req: Request, res: Response) => {
  try {
    const parsed = createElectionRaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { seat, electionType, electionDate, timezone, jurisdiction, candidates } = parsed.data;

    // Validate jurisdiction matches a real collection name
    const [matchedCollection] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.name, jurisdiction))
      .limit(1);

    if (!matchedCollection) {
      return res.status(400).json({
        error: `No collection found with name "${jurisdiction}". The jurisdiction must match a collection name exactly.`,
      });
    }

    const [created] = await db.insert(electionRaces).values({
      seat,
      electionType,
      electionDate: new Date(electionDate),
      timezone,
      jurisdiction,
      candidates,
    }).returning();

    return res.status(201).json({ race: created });
  } catch (error) {
    console.error('Failed to create election race:', error);
    return res.status(500).json({ error: 'Failed to create election race' });
  }
});

// POST /election-races/:id/generate — Trigger question generation for an election race
// Body: { collectionSlug: string, force?: boolean }
router.post('/election-races/:id/generate', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const raceId = parseInt(req.params.id, 10);
    if (isNaN(raceId)) {
      return res.status(400).json({ error: 'Invalid race ID' });
    }

    const { collectionSlug, force } = req.body;
    if (!collectionSlug || typeof collectionSlug !== 'string') {
      return res.status(400).json({ error: 'collectionSlug is required' });
    }

    const result = await generateElectionQuestions(raceId, collectionSlug, { force: force === true });
    return res.status(200).json({
      questionsCreated: result.questionsCreated,
      archived: result.archived,
      jurisdiction: result.jurisdiction,
      collectionSlug: result.collectionSlug,
    });
  } catch (error) {
    if (error instanceof GenerationBlockedError) {
      return res.status(409).json({
        error: 'already_generated',
        message: error.message,
        existingCount: error.existingCount,
        generatedAt: error.generatedAt,
      });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to generate election questions:', error);
    return res.status(500).json({ error: 'Failed to generate election questions', detail: message });
  }
});

/**
 * GET /election-races/:id/question-count — Return active and draft question counts for a race.
 * Used by the re-generate confirmation modal to show "X active questions will be archived."
 */
router.get('/election-races/:id/question-count', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const raceId = parseInt(req.params.id, 10);
    if (isNaN(raceId)) {
      return res.status(400).json({ error: 'Invalid race ID' });
    }

    const [activeRow, draftRow] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(questions)
        .where(and(eq(questions.electionRaceId, raceId), eq(questions.status, 'active'))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(questions)
        .where(and(eq(questions.electionRaceId, raceId), eq(questions.status, 'draft'))),
    ]);

    return res.json({
      activeCount: activeRow[0]?.count ?? 0,
      draftCount: draftRow[0]?.count ?? 0,
    });
  } catch (error: any) {
    console.error('Failed to fetch question count for race:', error);
    return res.status(500).json({ error: 'Failed to fetch question count', detail: error?.message || String(error) });
  }
});

/**
 * POST /election-races/:id/enter-result — Enter election result and generate current-term questions.
 * Body: { winnerName: string, termEndDate: string (YYYY-MM-DD), collectionSlug: string }
 * - 200: { questionsCreated, raceId, jurisdiction, collectionSlug }
 * - 400: validation error
 * - 404: race not found
 * - 409: FollowupBlockedError (already generated)
 * - 500: generation error
 */
router.post('/election-races/:id/enter-result', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const raceId = parseInt(req.params.id, 10);
    if (isNaN(raceId)) {
      return res.status(400).json({ error: 'Invalid race ID' });
    }

    const parsed = enterResultSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { winnerName, termEndDate, collectionSlug } = parsed.data;

    const result = await generateCurrentTermQuestions(raceId, collectionSlug, { winnerName, termEndDate });

    return res.status(200).json({
      questionsCreated: result.questionsCreated,
      raceId: result.raceId,
      jurisdiction: result.jurisdiction,
      collectionSlug: result.collectionSlug,
    });
  } catch (error: any) {
    if (error instanceof FollowupBlockedError) {
      return res.status(409).json({
        error: 'already_generated',
        message: error.message,
        raceId: error.raceId,
      });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to enter result and generate current-term questions:', error);
    return res.status(500).json({
      error: 'Failed to generate current-term questions',
      detail: error?.message || String(error),
    });
  }
});

/**
 * POST /election-races/:id/regenerate — Destructive re-generate flow.
 * Archives active questions, deletes draft questions, resets flag, then regenerates.
 * Body (optional): { collectionSlug?: string } — overrides the name-based collection lookup.
 * Returns: { questionsCreated, archived, deleted, raceId, jurisdiction, collectionSlug }
 */
router.post('/election-races/:id/regenerate', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const raceId = parseInt(req.params.id, 10);
    if (isNaN(raceId)) {
      return res.status(400).json({ error: 'Invalid race ID' });
    }

    // 1. Load race
    const [race] = await db
      .select()
      .from(electionRaces)
      .where(eq(electionRaces.id, raceId))
      .limit(1);

    if (!race) {
      return res.status(404).json({ error: `Election race not found: ID ${raceId}` });
    }

    // 2. Resolve collection slug — use override if provided, else fall back to name-based lookup
    const overrideSlug = typeof req.body?.collectionSlug === 'string' ? req.body.collectionSlug.trim() : '';

    let collectionSlug: string;

    if (overrideSlug) {
      // Admin provided explicit slug override (e.g., collection was renamed)
      const [collectionBySlug] = await db
        .select({ slug: collections.slug })
        .from(collections)
        .where(eq(collections.slug, overrideSlug))
        .limit(1);
      if (!collectionBySlug) {
        return res.status(400).json({ error: `No collection found with slug "${overrideSlug}".` });
      }
      collectionSlug = collectionBySlug.slug;
    } else {
      // Default: resolve from jurisdiction name (existing behavior)
      const [collectionByName] = await db
        .select({ slug: collections.slug })
        .from(collections)
        .where(eq(collections.name, race.jurisdiction))
        .limit(1);
      if (!collectionByName) {
        return res.status(400).json({ error: `No collection found matching jurisdiction "${race.jurisdiction}".` });
      }
      collectionSlug = collectionByName.slug;
    }

    // 3. Archive active questions
    const historyEntry = {
      action: 'archived' as const,
      timestamp: new Date().toISOString(),
    };

    const archivedRows = await db
      .update(questions)
      .set({
        status: 'archived',
        expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(questions.electionRaceId, raceId), eq(questions.status, 'active'))
      )
      .returning({ id: questions.id });

    const archived = archivedRows.length;

    // 4. Delete draft questions — fetch IDs first, then clean up collection_questions and questions
    const draftRows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(eq(questions.electionRaceId, raceId), eq(questions.status, 'draft'))
      );

    const draftIds = draftRows.map((r) => r.id);
    let deleted = 0;

    if (draftIds.length > 0) {
      // Delete from collection_questions first (FK constraint)
      await db
        .delete(collectionQuestions)
        .where(inArray(collectionQuestions.questionId, draftIds));

      // Delete the questions
      await db.delete(questions).where(inArray(questions.id, draftIds));
      deleted = draftIds.length;
    }

    // 5. Reset questionsGenerated flag
    await db
      .update(electionRaces)
      .set({ questionsGenerated: false })
      .where(eq(electionRaces.id, raceId));

    // 6. Regenerate (force: false — flag is already reset)
    const result = await generateElectionQuestions(raceId, collectionSlug, { force: false });

    return res.status(200).json({
      questionsCreated: result.questionsCreated,
      archived,
      deleted,
      raceId,
      jurisdiction: race.jurisdiction,
      collectionSlug,
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to regenerate election questions:', error);
    return res.status(500).json({
      error: 'Failed to regenerate election questions',
      detail: error?.message || String(error),
    });
  }
});

/**
 * PUT /election-races/:id — Update an existing election race.
 * Only updates fields present in body.
 * Returns: { race: updated }
 */
router.put('/election-races/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const raceId = parseInt(req.params.id, 10);
    if (isNaN(raceId)) {
      return res.status(400).json({ error: 'Invalid race ID' });
    }

    const parsed = updateRaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const updateData = parsed.data;

    // Verify race exists
    const [existing] = await db
      .select()
      .from(electionRaces)
      .where(eq(electionRaces.id, raceId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: `Election race not found: ID ${raceId}` });
    }

    // Build update payload — only include fields present in body
    const patch: Record<string, unknown> = {};
    if (updateData.seat !== undefined) patch.seat = updateData.seat;
    if (updateData.electionType !== undefined) patch.electionType = updateData.electionType;
    if (updateData.electionDate !== undefined) patch.electionDate = new Date(updateData.electionDate);
    if (updateData.timezone !== undefined) patch.timezone = updateData.timezone;
    if (updateData.jurisdiction !== undefined) patch.jurisdiction = updateData.jurisdiction;
    if (updateData.candidates !== undefined) patch.candidates = updateData.candidates;

    const [updated] = await db
      .update(electionRaces)
      .set(patch)
      .where(eq(electionRaces.id, raceId))
      .returning();

    return res.status(200).json({ race: updated });
  } catch (error: any) {
    console.error('Failed to update election race:', error);
    return res.status(500).json({ error: 'Failed to update election race', detail: error?.message || String(error) });
  }
});

/**
 * DELETE /election-races/:id — Delete an election race.
 * Questions with election_race_id referencing this race will have it set to NULL
 * (schema uses onDelete: 'set null').
 * Returns: { deleted: true }
 */
router.delete('/election-races/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const raceId = parseInt(req.params.id, 10);
    if (isNaN(raceId)) {
      return res.status(400).json({ error: 'Invalid race ID' });
    }

    // Verify race exists
    const [existing] = await db
      .select()
      .from(electionRaces)
      .where(eq(electionRaces.id, raceId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: `Election race not found: ID ${raceId}` });
    }

    await db.delete(electionRaces).where(eq(electionRaces.id, raceId));

    return res.status(200).json({ deleted: true });
  } catch (error: any) {
    console.error('Failed to delete election race:', error);
    return res.status(500).json({ error: 'Failed to delete election race', detail: error?.message || String(error) });
  }
});

// ─── Admin User Management (super-admin only) ───────────────────────────────

/**
 * GET /admins — List all admin users.
 * Super-admin only.
 */
router.get('/admins', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('user_id, super_admin, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Enrich with email from auth.users
    const enriched = await Promise.all(
      (data ?? []).map(async (row) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
        return {
          userId: row.user_id,
          email: userData?.user?.email ?? '(unknown)',
          superAdmin: row.super_admin,
          createdAt: row.created_at,
        };
      })
    );

    res.json(enriched);
  } catch (error: any) {
    console.error('Failed to list admins:', error);
    res.status(500).json({ error: 'Failed to list admins' });
  }
});

/**
 * POST /admins — Add a user as admin by email.
 * Body: { email: string, superAdmin?: boolean }
 * Super-admin only.
 */
router.post('/admins', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { email, superAdmin = false } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }

    // Look up user by email
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const user = listData.users.find((u) => u.email === email);
    if (!user) {
      return res.status(404).json({ error: `No user found with email: ${email}` });
    }

    const { error } = await supabaseAdmin
      .from('admin_users')
      .upsert({ user_id: user.id, super_admin: superAdmin }, { onConflict: 'user_id' });

    if (error) throw error;

    return res.status(201).json({ userId: user.id, email, superAdmin });
  } catch (error: any) {
    console.error('Failed to add admin:', error);
    return res.status(500).json({ error: 'Failed to add admin' });
  }
});

/**
 * DELETE /admins/:userId — Remove admin access from a user.
 * Super-admins cannot be removed by non-super-admins (enforced by requireSuperAdmin).
 * A super-admin cannot remove themselves.
 */
router.delete('/admins/:userId', requireSuperAdmin, async (req: Request<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;

    if (userId === req.userId) {
      return res.status(400).json({ error: 'You cannot remove your own admin access' });
    }

    const { error } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    return res.json({ deleted: true, userId });
  } catch (error: any) {
    console.error('Failed to remove admin:', error);
    return res.status(500).json({ error: 'Failed to remove admin' });
  }
});

export { router };

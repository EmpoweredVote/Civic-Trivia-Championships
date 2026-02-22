import { Router, Request, Response } from 'express';
import { sessionManager, Question } from '../services/sessionService.js';
import { optionalAuth } from '../middleware/auth.js';
import { updateUserProgression } from '../services/progressionService.js';
import { storageFactory } from '../config/redis.js';
import { selectQuestionsForGame, getCollectionMetadata, getFederalCollectionId, createAdaptiveSession, transformSingleDBQuestion, TOTAL_QUESTIONS } from '../services/questionService.js';
import { getNextQuestionTier, selectNextAdaptiveQuestion } from '../services/gameModes.js';
import { recordQuestionTelemetry } from '../services/telemetryService.js';
import { db } from '../db/index.js';
import { collections, collectionQuestions, questions } from '../db/schema.js';
import { and, eq, sql, isNull, or, gt } from 'drizzle-orm';

const router = Router();

// Minimum question threshold for a collection to be playable
const MIN_QUESTION_THRESHOLD = 50;

// Fisher-Yates shuffle algorithm
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper to strip correctAnswer from questions (prevent client cheating)
function stripAnswers(questions: Question[]): Omit<Question, 'correctAnswer'>[] {
  return questions.map(({ correctAnswer, ...rest }) => rest);
}

// Helper to strip correctAnswer from a single question
function stripAnswer(question: Question): Omit<Question, 'correctAnswer'> {
  const { correctAnswer, ...rest } = question;
  return rest;
}

// Track recent questions per user (last 30 question IDs)
const recentQuestions = new Map<string | number, string[]>();
const MAX_RECENT = 30;

function getRecentQuestionIds(userId: string | number): string[] {
  return recentQuestions.get(userId) || [];
}

function recordPlayedQuestions(userId: string | number, questionIds: string[]): void {
  const existing = recentQuestions.get(userId) || [];
  const updated = [...questionIds, ...existing].slice(0, MAX_RECENT);
  recentQuestions.set(userId, updated);
}

// GET /collections - Returns active collections with question counts
router.get('/collections', async (_req: Request, res: Response) => {
  try {
    const now = new Date();

    // Query active collections with question counts (excluding expired questions)
    const rows = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        themeColor: collections.themeColor,
        sortOrder: collections.sortOrder,
        questionCount: sql<number>`COUNT(DISTINCT ${collectionQuestions.questionId})::int`.as('questionCount')
      })
      .from(collections)
      .leftJoin(collectionQuestions, eq(collections.id, collectionQuestions.collectionId))
      .leftJoin(questions, eq(collectionQuestions.questionId, questions.id))
      .where(
        and(
          eq(collections.isActive, true),
          or(
            isNull(questions.id),
            and(
              eq(questions.status, 'active'),
              or(
                isNull(questions.expiresAt),
                gt(questions.expiresAt, now)
              )
            )
          )
        )
      )
      .groupBy(collections.id)
      .orderBy(collections.sortOrder);

    // Filter out collections with fewer than minimum questions
    const filtered = rows.filter(r => r.questionCount >= MIN_QUESTION_THRESHOLD);

    res.status(200).json({ collections: filtered });
  } catch (error: any) {
    console.error('Error fetching collections:', error);
    const cause = error?.cause;
    res.status(500).json({
      error: 'Failed to fetch collections',
      detail: error?.message || String(error),
      pgError: cause?.message || cause?.detail || undefined
    });
  }
});

// GET /questions - Returns 10 randomized questions (legacy endpoint)
router.get('/questions', async (_req: Request, res: Response) => {
  try {
    const questions = await selectQuestionsForGame(null, []);
    res.status(200).json({ questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      error: 'Failed to fetch questions'
    });
  }
});

// POST /session - Create a new game session
router.post('/session', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { questionIds, collectionId, gameMode } = req.body;

    let selectedQuestions: Question[];

    // Get userId from auth middleware (authenticated) or use 'anonymous'
    const userId = req.user?.userId ?? 'anonymous';

    if (questionIds && Array.isArray(questionIds)) {
      // Legacy path: questionIds provided — fetch from DB and filter to matching IDs
      const allQuestions = await selectQuestionsForGame(null, []);
      selectedQuestions = questionIds.map((id: string) => {
        const question = allQuestions.find((q: Question) => q.id === id);
        if (!question) {
          throw new Error(`Question not found: ${id}`);
        }
        return question;
      });
    } else {
      // Normal path: select questions from collection (defaults to Federal Civics)
      const resolvedMode = gameMode || 'easy-steps';

      if (resolvedMode === 'easy-steps') {
        // Adaptive path: start with 1 question, select rest dynamically
        const { firstQuestion, candidatePools, firstQuestionDbId } = await createAdaptiveSession(
          collectionId ?? null,
          getRecentQuestionIds(userId)
        );

        // Look up collection metadata
        const resolvedCollectionId = collectionId ?? await getFederalCollectionId();
        const collectionMeta = await getCollectionMetadata(resolvedCollectionId);

        const sessionId = await sessionManager.createSession(
          userId,
          [firstQuestion],
          collectionMeta ? { id: collectionMeta.id, name: collectionMeta.name, slug: collectionMeta.slug } : undefined
        );

        // Set adaptive state on the session and persist
        const session = await sessionManager.getSession(sessionId);
        if (session) {
          session.adaptiveState = {
            candidatePools,
            correctCount: 0,
            gameMode: 'easy-steps',
            usedQuestionIds: [firstQuestionDbId],
          };
          await sessionManager.saveSession(session);
        }

        // Record first question for recent-question exclusion
        recordPlayedQuestions(userId, [firstQuestion.id]);

        // Return session with 1 question stripped of correctAnswer
        return res.status(201).json({
          sessionId,
          questions: stripAnswers([firstQuestion]),
          degraded: storageFactory.isDegradedMode(),
          collectionName: collectionMeta?.name ?? 'Federal Civics',
          collectionSlug: collectionMeta?.slug ?? 'federal-civics',
          gameMode: resolvedMode,
          totalQuestions: TOTAL_QUESTIONS,
        });
      }

      // Classic mode: select all questions upfront
      selectedQuestions = await selectQuestionsForGame(
        collectionId ?? null,
        getRecentQuestionIds(userId),
        gameMode
      );
    }

    // Look up collection metadata
    const resolvedCollectionId = collectionId ?? await getFederalCollectionId();
    const collectionMeta = await getCollectionMetadata(resolvedCollectionId);

    const sessionId = await sessionManager.createSession(
      userId,
      selectedQuestions,
      collectionMeta ? { id: collectionMeta.id, name: collectionMeta.name, slug: collectionMeta.slug } : undefined
    );

    // Record played questions for recent-question exclusion
    recordPlayedQuestions(userId, selectedQuestions.map(q => q.id));

    // Return session with questions stripped of correctAnswer
    res.status(201).json({
      sessionId,
      questions: stripAnswers(selectedQuestions),
      degraded: storageFactory.isDegradedMode(),
      collectionName: collectionMeta?.name ?? 'Federal Civics',
      collectionSlug: collectionMeta?.slug ?? 'federal-civics',
      gameMode: gameMode || 'easy-steps',
      totalQuestions: TOTAL_QUESTIONS,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
    res.status(400).json({
      error: errorMessage
    });
  }
});

// POST /answer - Submit an answer for scoring
router.post('/answer', async (req: Request, res: Response) => {
  try {
    const { sessionId, questionId, selectedOption, timeRemaining, wager } = req.body;

    // Validate required fields
    if (!sessionId || !questionId || timeRemaining === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, questionId, timeRemaining'
      });
    }

    // Submit answer to session manager
    const answer = await sessionManager.submitAnswer(
      sessionId,
      questionId,
      selectedOption ?? null,
      timeRemaining,
      wager
    );

    // Get the question to return the correct answer
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    const question = session.questions.find((q: Question) => q.id === questionId);
    if (!question) {
      return res.status(404).json({
        error: 'Question not found'
      });
    }

    // Strip flagged field from response (keep server-side only for analytics)
    const { flagged, ...clientAnswer } = answer;

    // Determine correctness for telemetry
    const wasCorrect = clientAnswer.basePoints > 0 || (clientAnswer.wager !== undefined && clientAnswer.totalPoints > 0);

    // Fire-and-forget telemetry -- do not await, do not block response
    recordQuestionTelemetry(questionId, wasCorrect).catch(() => {});

    // Adaptive next question selection
    let nextQuestionStripped: Omit<Question, 'correctAnswer'> | undefined;

    if (session.adaptiveState) {
      // Update correct count
      if (wasCorrect) {
        session.adaptiveState.correctCount++;
      }

      const questionNumber = session.answers.length; // answers already includes this one
      const totalQ = TOTAL_QUESTIONS;

      if (questionNumber < totalQ) {
        // Determine tier for next question
        const allowedDifficulties = getNextQuestionTier(
          session.adaptiveState.correctCount,
          questionNumber + 1, // next question number (1-indexed)
          totalQ
        );

        // Build usedIds set
        const usedIds = new Set<number>(session.adaptiveState.usedQuestionIds);

        // Pick next question
        const nextRow = selectNextAdaptiveQuestion(
          session.adaptiveState.candidatePools,
          allowedDifficulties,
          usedIds
        );

        if (nextRow) {
          // Transform to Question
          const nextQ = await transformSingleDBQuestion(nextRow);

          // Push onto session questions (server-side)
          session.questions.push(nextQ);
          session.adaptiveState.usedQuestionIds.push(nextRow.id);

          // Record for recent-question exclusion
          recordPlayedQuestions(session.userId, [nextQ.id]);

          // Strip correctAnswer for client
          nextQuestionStripped = stripAnswer(nextQ);

          console.log(
            `[easy-steps-adaptive] Q${questionNumber + 1}: correctCount=${session.adaptiveState.correctCount}, ` +
            `tier=[${allowedDifficulties.join(',')}], picked=${nextRow.difficulty}`
          );

          // Log completion summary when picking the final question
          if (questionNumber + 1 === totalQ) {
            console.log(
              `[easy-steps-adaptive] Session complete: difficulties=[${session.questions.map(q => q.difficulty).join(', ')}]`
            );
          }
        } else {
          console.warn(`[easy-steps-adaptive] Pool exhausted at Q${questionNumber + 1}, no next question available`);
        }
      } else {
        // Game complete - log final summary
        console.log(
          `[easy-steps-adaptive] Session complete: difficulties=[${session.questions.map(q => q.difficulty).join(', ')}]`
        );
      }

      // Persist updated session (adaptiveState + questions changes)
      await sessionManager.saveSession(session);
    }

    // Return score with correct answer for client reveal
    res.status(200).json({
      basePoints: clientAnswer.basePoints,
      speedBonus: clientAnswer.speedBonus,
      totalPoints: clientAnswer.totalPoints,
      correct: wasCorrect,
      correctAnswer: question.correctAnswer,
      ...(clientAnswer.wager !== undefined ? { wager: clientAnswer.wager } : {}),
      ...(nextQuestionStripped ? { nextQuestion: nextQuestionStripped } : {}),
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit answer';
    const statusCode = errorMessage.includes('Invalid or expired session') ? 404 : 400;
    res.status(statusCode).json({
      error: errorMessage
    });
  }
});

// GET /results/:sessionId - Get final game results
router.get('/results/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID required'
      });
    }

    // Get aggregated results
    const results = await sessionManager.getResults(sessionId);

    // Get session to check for authenticated user
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Calculate and award progression for authenticated users (only once)
    let progression: { xpEarned: number; gemsEarned: number } | null = null;

    if (typeof session.userId === 'number' && !session.progressionAwarded) {
      // Authenticated user and progression not yet awarded
      progression = await updateUserProgression(
        session.userId,
        results.totalScore,
        results.totalCorrect,
        results.totalQuestions
      );

      // Mark progression as awarded to prevent double-awarding
      session.progressionAwarded = true;
    }

    // Strip flagged field from all answer records (keep server-internal only)
    const cleanedAnswers = results.answers.map(({ flagged, ...rest }) => rest);

    res.status(200).json({
      ...results,
      answers: cleanedAnswers,
      progression,
      degraded: storageFactory.isDegradedMode(),
      collectionName: session.collectionName ?? 'Federal Civics',
      collectionSlug: session.collectionSlug ?? 'federal-civics',
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch results';
    const statusCode = errorMessage.includes('Invalid or expired session') ? 404 : 500;
    res.status(statusCode).json({
      error: errorMessage
    });
  }
});

export { router };

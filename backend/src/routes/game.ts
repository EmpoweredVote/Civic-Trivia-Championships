import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sessionManager, Question } from '../services/sessionService.js';
import { optionalAuth } from '../middleware/auth.js';
import { updateUserProgression } from '../services/progressionService.js';
import { storageFactory } from '../config/redis.js';

const router = Router();

// Get current file's directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load questions from JSON file
const questionsPath = join(__dirname, '../data/questions.json');
const questionsData = readFileSync(questionsPath, 'utf-8');
const allQuestions: Question[] = JSON.parse(questionsData);

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

// GET /questions - Returns 10 randomized questions
router.get('/questions', (_req: Request, res: Response) => {
  try {
    // Shuffle all questions and take first 10
    const shuffled = shuffle(allQuestions);
    const selectedQuestions = shuffled.slice(0, 10);

    res.status(200).json({
      questions: selectedQuestions
    });
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
    const { questionIds } = req.body;

    let selectedQuestions: Question[];

    if (questionIds && Array.isArray(questionIds)) {
      // Validate that all question IDs exist
      selectedQuestions = questionIds.map((id: string) => {
        const question = allQuestions.find((q: Question) => q.id === id);
        if (!question) {
          throw new Error(`Question not found: ${id}`);
        }
        return question;
      });
    } else {
      // No questionIds provided - pick 10 random questions
      const shuffled = shuffle(allQuestions);
      selectedQuestions = shuffled.slice(0, 10);
    }

    // Get userId from auth middleware (authenticated) or use 'anonymous'
    const userId = req.user?.userId ?? 'anonymous';
    const sessionId = await sessionManager.createSession(userId, selectedQuestions);

    // Return session with questions stripped of correctAnswer
    res.status(201).json({
      sessionId,
      questions: stripAnswers(selectedQuestions),
      degraded: storageFactory.isDegradedMode()
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

    // Return score with correct answer for client reveal
    res.status(200).json({
      basePoints: clientAnswer.basePoints,
      speedBonus: clientAnswer.speedBonus,
      totalPoints: clientAnswer.totalPoints,
      correct: clientAnswer.basePoints > 0 || (clientAnswer.wager !== undefined && clientAnswer.totalPoints > 0),
      correctAnswer: question.correctAnswer,
      ...(clientAnswer.wager !== undefined ? { wager: clientAnswer.wager } : {}),
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
      degraded: storageFactory.isDegradedMode()
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

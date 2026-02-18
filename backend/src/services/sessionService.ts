/**
 * Game session management service
 * Handles session creation, answer submission, scoring, and cleanup
 */

import { randomUUID } from 'crypto';
import { calculateScore, calculateScoreWithPenalty, calculateResponseTime } from './scoreService.js';
import { SessionStorage } from './storage/SessionStorage.js';
import { MemoryStorage } from './storage/MemoryStorage.js';
import { PLAUSIBILITY_THRESHOLDS, getAdjustedThreshold, type PlausibilityDifficulty } from '../config/plausibilityThresholds.js';
import { User } from '../models/User.js';

// Question type matching backend data structure
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topic: string;
  topicCategory: string;
  learningContent?: {
    topic: string;
    paragraphs: string[];
    corrections: Record<string, string>;
    source: {
      name: string;
      url: string;
    };
  };
}

// Server-side answer record with scoring and plausibility flag
export interface ServerAnswer {
  questionId: string;
  selectedOption: number | null;
  timeRemaining: number;
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  responseTime: number;
  flagged: boolean; // Plausibility check flag
  wager?: number; // Optional wager amount for final question
}

// Game session stored in memory
export interface GameSession {
  sessionId: string;
  userId: string | number;
  questions: Question[];
  answers: ServerAnswer[];
  createdAt: Date;
  lastActivityTime: Date;
  progressionAwarded: boolean; // Prevents double-awarding progression
  plausibilityFlags: number; // Count of suspicious answer patterns in this session
}

// Results returned to client
export interface GameSessionResult {
  answers: ServerAnswer[];
  totalScore: number;
  totalBasePoints: number;
  totalSpeedBonus: number;
  totalCorrect: number;
  totalQuestions: number;
  fastestAnswer: {
    questionIndex: number;
    responseTime: number;
    points: number;
  } | null;
  wagerResult?: {
    wagerAmount: number;
    won: boolean;
    pointsChange: number;
  } | null;
}

// Constants
const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const QUESTION_DURATION = 20; // seconds (matches frontend GameScreen.tsx)
const FINAL_QUESTION_DURATION = 50; // seconds (for Q10)
const MAX_PLAUSIBLE_TIME_REMAINING = 20; // seconds (matches QUESTION_DURATION)

/**
 * SessionManager - Handles game session lifecycle
 * Creates sessions, validates answers, calculates scores, aggregates results
 */
export class SessionManager {
  private storage: SessionStorage;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(storage: SessionStorage) {
    this.storage = storage;

    // Start cleanup interval only for MemoryStorage (Redis uses TTL)
    if (storage instanceof MemoryStorage) {
      this.cleanupInterval = setInterval(() => {
        this.storage.cleanup().catch(err => {
          console.error('Error during cleanup:', err);
        });
      }, CLEANUP_INTERVAL_MS);
    }
  }

  /**
   * Create a new game session
   * @param userId - User identifier (number for authenticated, 'anonymous' for unauthenticated)
   * @param questions - Array of questions for this game
   * @returns Session ID
   */
  async createSession(userId: string | number, questions: Question[]): Promise<string> {
    const sessionId = randomUUID();
    const now = new Date();

    const session: GameSession = {
      sessionId,
      userId,
      questions,
      answers: [],
      createdAt: now,
      lastActivityTime: now,
      progressionAwarded: false,
      plausibilityFlags: 0
    };

    await this.storage.set(sessionId, session, 3600); // 1 hour TTL
    return sessionId;
  }

  /**
   * Get a session by ID
   * Updates lastActivityTime on access and refreshes TTL
   * @param sessionId - Session ID to retrieve
   * @returns Session or null if not found
   */
  async getSession(sessionId: string): Promise<GameSession | null> {
    const session = await this.storage.get(sessionId);
    if (session) {
      session.lastActivityTime = new Date();
      // Refresh TTL on access
      await this.storage.set(sessionId, session, 3600);
    }
    return session || null;
  }

  /**
   * Submit an answer for scoring
   * Validates session, question, and calculates score with plausibility checks
   * @param sessionId - Session ID
   * @param questionId - Question ID being answered
   * @param selectedOption - Selected option index (0-3) or null for timeout
   * @param timeRemaining - Time remaining when answer submitted
   * @param wager - Optional wager amount (only allowed on final question)
   * @returns Server answer with scoring
   * @throws Error if session invalid, question not found, or already answered
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    selectedOption: number | null,
    timeRemaining: number,
    wager?: number
  ): Promise<ServerAnswer> {
    // Validate session exists
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Invalid or expired session');
    }

    // Validate question exists in session
    const question = session.questions.find(q => q.id === questionId);
    if (!question) {
      throw new Error('Question not found in session');
    }

    // Check if question already answered (idempotent by questionId)
    const existingAnswer = session.answers.find(a => a.questionId === questionId);
    if (existingAnswer) {
      // Already answered - return existing answer (idempotent)
      return existingAnswer;
    }

    // Determine if this is the final question (Q10 = index 9)
    const questionIndex = session.questions.findIndex(q => q.id === questionId);
    const isFinalQuestion = questionIndex === 9;

    // Wager validation
    if (wager !== undefined) {
      // Wager only allowed on final question
      if (!isFinalQuestion) {
        throw new Error('Wager only allowed on final question');
      }

      // Validate wager is non-negative
      if (wager < 0) {
        throw new Error('Wager must be non-negative');
      }

      // Calculate current score from all previous answers
      const currentScore = session.answers.reduce((sum, a) => sum + a.totalPoints, 0);
      const maxWager = Math.floor(currentScore / 2);

      // Validate wager doesn't exceed maximum
      if (wager > maxWager) {
        throw new Error(`Wager ${wager} exceeds maximum allowed ${maxWager}`);
      }
    }

    // Calculate response time (use appropriate duration for final question)
    const duration = isFinalQuestion ? FINAL_QUESTION_DURATION : QUESTION_DURATION;
    const responseTime = calculateResponseTime(duration, timeRemaining);

    // Determine if answer is correct FIRST (needed for plausibility detection)
    const isCorrect = selectedOption === question.correctAnswer;

    // INVARIANT: flagged=true implies isCorrect=false (detection skips correct answers)
    // This means penalties inherently only apply to wrong answers — by design, not by filter.
    let flagged = false;

    // Plausibility detection: Skip if final question OR anonymous user
    if (!isFinalQuestion && session.userId !== 'anonymous') {
      // Skip flagging if correct (fast correct answers are legitimate knowledge)
      if (!isCorrect) {
        // Fetch user's timer multiplier for threshold adjustment
        const user = await User.findById(session.userId as number);
        const timerMultiplier = user?.timerMultiplier ?? 1.0;

        // Get difficulty-adjusted threshold
        // Runtime guard: if difficulty is not a valid key, fall back to 'hard' (strictest)
        const validDifficulties: PlausibilityDifficulty[] = ['easy', 'medium', 'hard'];
        const difficulty = validDifficulties.includes(question.difficulty as PlausibilityDifficulty)
          ? (question.difficulty as PlausibilityDifficulty)
          : 'hard';

        const threshold = getAdjustedThreshold(difficulty, timerMultiplier);

        // Flag if response time is suspiciously fast
        if (responseTime < threshold) {
          flagged = true;
          session.plausibilityFlags += 1;
          console.warn(
            `⚠️  Plausibility flag: sessionId=${sessionId}, questionIndex=${questionIndex}, ` +
            `difficulty=${difficulty}, timerMultiplier=${timerMultiplier}, ` +
            `threshold=${threshold}s, responseTime=${responseTime}s`
          );
        }
      }
    }

    // Clock manipulation check (orthogonal to difficulty-based detection)
    const maxPlausibleTime = isFinalQuestion ? FINAL_QUESTION_DURATION : MAX_PLAUSIBLE_TIME_REMAINING;
    if (timeRemaining > maxPlausibleTime) {
      console.warn(`⚠️  Clock manipulation detected: timeRemaining ${timeRemaining}s > ${maxPlausibleTime}s (sessionId: ${sessionId}, questionId: ${questionId})`);
      if (!isFinalQuestion && session.userId !== 'anonymous') {
        flagged = true;
        session.plausibilityFlags += 1;
      }
    }

    // Determine if penalty is active (3+ total flags in session)
    const penaltyActive = session.plausibilityFlags >= PLAUSIBILITY_THRESHOLDS.patternThreshold;

    // Calculate score
    let score: { basePoints: number; speedBonus: number; totalPoints: number };

    if (isFinalQuestion && wager !== undefined) {
      // Final question with wager: use wager-only scoring (no base points, no speed bonus)
      score = {
        basePoints: 0,
        speedBonus: 0,
        totalPoints: isCorrect ? wager : -wager,
      };
    } else if (isFinalQuestion && wager === undefined) {
      // Final question without wager: treat as 0 wager
      score = {
        basePoints: 0,
        speedBonus: 0,
        totalPoints: 0,
      };
    } else {
      // Normal question: use penalty-aware scoring
      score = calculateScoreWithPenalty(isCorrect, timeRemaining, flagged, penaltyActive);
    }

    // Create answer record
    const answer: ServerAnswer = {
      questionId,
      selectedOption,
      timeRemaining,
      basePoints: score.basePoints,
      speedBonus: score.speedBonus,
      totalPoints: score.totalPoints,
      responseTime,
      flagged,
      ...(wager !== undefined ? { wager } : {}),
    };

    // Store answer and persist updated session
    session.answers.push(answer);
    await this.storage.set(sessionId, session, 3600);

    return answer;
  }

  /**
   * Get results for a completed game session
   * Aggregates all answers and calculates totals
   * @param sessionId - Session ID
   * @returns Aggregated game results
   * @throws Error if session not found
   */
  async getResults(sessionId: string): Promise<GameSessionResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Invalid or expired session');
    }

    // Calculate totals
    let totalScore = 0;
    let totalBasePoints = 0;
    let totalSpeedBonus = 0;
    let totalCorrect = 0;

    for (const answer of session.answers) {
      totalScore += answer.totalPoints;
      totalBasePoints += answer.basePoints;
      totalSpeedBonus += answer.speedBonus;
      if (answer.basePoints > 0) {
        totalCorrect++;
      }
    }

    // Find fastest correct answer
    let fastestAnswer: GameSessionResult['fastestAnswer'] = null;
    let fastestTime = Infinity;

    for (let i = 0; i < session.answers.length; i++) {
      const answer = session.answers[i];
      // Only consider correct answers
      if (answer.basePoints > 0 && answer.responseTime < fastestTime) {
        fastestTime = answer.responseTime;
        fastestAnswer = {
          questionIndex: i,
          responseTime: answer.responseTime,
          points: answer.totalPoints
        };
      }
    }

    // Check for wager result (final question is index 9)
    let wagerResult: GameSessionResult['wagerResult'] = null;
    if (session.answers.length >= 10) {
      const finalAnswer = session.answers[9];
      if (finalAnswer.wager !== undefined) {
        wagerResult = {
          wagerAmount: finalAnswer.wager,
          won: finalAnswer.totalPoints > 0,
          pointsChange: finalAnswer.totalPoints,
        };
      }
    }

    return {
      answers: session.answers,
      totalScore,
      totalBasePoints,
      totalSpeedBonus,
      totalCorrect,
      totalQuestions: session.questions.length,
      fastestAnswer,
      wagerResult,
    };
  }

  /**
   * Stop cleanup interval (for testing/shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance (initialized during server startup)
let sessionManagerInstance: SessionManager | null = null;

/**
 * Initialize the session manager with a storage backend
 * Must be called before getSessionManager()
 * @param storage - SessionStorage implementation
 * @returns SessionManager instance
 */
export function initializeSessionManager(storage: SessionStorage): SessionManager {
  sessionManagerInstance = new SessionManager(storage);
  return sessionManagerInstance;
}

/**
 * Get the initialized session manager
 * @returns SessionManager instance
 * @throws Error if not initialized
 */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    throw new Error('SessionManager not initialized. Call initializeSessionManager() first.');
  }
  return sessionManagerInstance;
}

/**
 * Singleton export for backward compatibility
 * IMPORTANT: This will throw if accessed before initialization
 */
export const sessionManager = new Proxy({} as SessionManager, {
  get(_target, prop) {
    return getSessionManager()[prop as keyof SessionManager];
  }
});

/**
 * Game session management service
 * Handles session creation, answer submission, scoring, and cleanup
 */

import { randomUUID } from 'crypto';
import { calculateScore, calculateResponseTime } from './scoreService.js';

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
}

// Constants
const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const QUESTION_DURATION = 25; // seconds
const MIN_PLAUSIBLE_RESPONSE_TIME = 0.5; // seconds
const MAX_PLAUSIBLE_TIME_REMAINING = 25; // seconds

/**
 * SessionManager - Handles game session lifecycle
 * Creates sessions, validates answers, calculates scores, aggregates results
 */
export class SessionManager {
  private sessions: Map<string, GameSession>;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.sessions = new Map();

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Create a new game session
   * @param userId - User identifier (number for authenticated, 'anonymous' for unauthenticated)
   * @param questions - Array of questions for this game
   * @returns Session ID
   */
  createSession(userId: string | number, questions: Question[]): string {
    const sessionId = randomUUID();
    const now = new Date();

    const session: GameSession = {
      sessionId,
      userId,
      questions,
      answers: [],
      createdAt: now,
      lastActivityTime: now,
      progressionAwarded: false
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Get a session by ID
   * Updates lastActivityTime on access
   * @param sessionId - Session ID to retrieve
   * @returns Session or null if not found
   */
  getSession(sessionId: string): GameSession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityTime = new Date();
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
   * @returns Server answer with scoring
   * @throws Error if session invalid, question not found, or already answered
   */
  submitAnswer(
    sessionId: string,
    questionId: string,
    selectedOption: number | null,
    timeRemaining: number
  ): ServerAnswer {
    // Validate session exists
    const session = this.getSession(sessionId);
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

    // Calculate response time
    const responseTime = calculateResponseTime(QUESTION_DURATION, timeRemaining);

    // Plausibility checks
    let flagged = false;
    if (responseTime < MIN_PLAUSIBLE_RESPONSE_TIME) {
      console.warn(`⚠️  Suspicious answer: responseTime ${responseTime}s < ${MIN_PLAUSIBLE_RESPONSE_TIME}s (sessionId: ${sessionId}, questionId: ${questionId})`);
      flagged = true;
    }
    if (timeRemaining > MAX_PLAUSIBLE_TIME_REMAINING) {
      console.warn(`⚠️  Suspicious answer: timeRemaining ${timeRemaining}s > ${MAX_PLAUSIBLE_TIME_REMAINING}s (sessionId: ${sessionId}, questionId: ${questionId})`);
      flagged = true;
    }

    // Determine if answer is correct
    const isCorrect = selectedOption === question.correctAnswer;

    // Calculate score
    const score = calculateScore(isCorrect, timeRemaining);

    // Create answer record
    const answer: ServerAnswer = {
      questionId,
      selectedOption,
      timeRemaining,
      basePoints: score.basePoints,
      speedBonus: score.speedBonus,
      totalPoints: score.totalPoints,
      responseTime,
      flagged
    };

    // Store answer
    session.answers.push(answer);

    return answer;
  }

  /**
   * Get results for a completed game session
   * Aggregates all answers and calculates totals
   * @param sessionId - Session ID
   * @returns Aggregated game results
   * @throws Error if session not found
   */
  getResults(sessionId: string): GameSessionResult {
    const session = this.getSession(sessionId);
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

    return {
      answers: session.answers,
      totalScore,
      totalBasePoints,
      totalSpeedBonus,
      totalCorrect,
      totalQuestions: session.questions.length,
      fastestAnswer
    };
  }

  /**
   * Remove expired sessions (> 1 hour since last activity)
   * Runs automatically every 5 minutes
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivityTime.getTime();
      if (timeSinceActivity > SESSION_EXPIRY_MS) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired session(s)`);
    }
  }

  /**
   * Stop cleanup interval (for testing/shutdown)
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

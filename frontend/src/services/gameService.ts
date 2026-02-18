import { apiRequest } from './api';
import type { Question } from '../types/game';

interface FetchQuestionsResponse {
  questions: Question[];
}

// Legacy function - kept for backward compatibility
export async function fetchQuestions(): Promise<Question[]> {
  const response = await apiRequest<FetchQuestionsResponse>('/api/game/questions', {
    method: 'GET',
  });

  return response.questions;
}

// Create a new game session
export async function createGameSession(): Promise<{ sessionId: string; questions: Question[]; degraded: boolean }> {
  const response = await apiRequest<{ sessionId: string; questions: Question[]; degraded?: boolean }>(
    '/api/game/session',
    {
      method: 'POST',
    }
  );

  return {
    sessionId: response.sessionId,
    questions: response.questions,
    degraded: response.degraded ?? false, // Default to false if not present
  };
}

// Submit an answer to the server for scoring
export async function submitAnswer(
  sessionId: string,
  questionId: string,
  selectedOption: number | null,
  timeRemaining: number,
  wager?: number
): Promise<{
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  correct: boolean;
  correctAnswer: number;
  wager?: number;
}> {
  const body: {
    sessionId: string;
    questionId: string;
    selectedOption: number | null;
    timeRemaining: number;
    wager?: number;
  } = {
    sessionId,
    questionId,
    selectedOption,
    timeRemaining,
  };

  // Only include wager if provided
  if (wager !== undefined) {
    body.wager = wager;
  }

  const response = await apiRequest<{
    basePoints: number;
    speedBonus: number;
    totalPoints: number;
    correct: boolean;
    correctAnswer: number;
    wager?: number;
  }>('/api/game/answer', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return response;
}

// Fetch game results for a session
export interface GameSessionResult {
  sessionId: string;
  totalScore: number;
  totalBasePoints: number;
  totalSpeedBonus: number;
  correctCount: number;
  totalQuestions: number;
  fastestAnswer: {
    questionIndex: number;
    responseTime: number;
    points: number;
  } | null;
  answers: Array<{
    questionId: string;
    selectedOption: number | null;
    correct: boolean;
    correctAnswer: number;
    basePoints: number;
    speedBonus: number;
    totalPoints: number;
    responseTime: number;
  }>;
}

export async function fetchGameResults(sessionId: string): Promise<GameSessionResult> {
  const response = await apiRequest<GameSessionResult>(`/api/game/results/${sessionId}`, {
    method: 'GET',
  });

  return response;
}

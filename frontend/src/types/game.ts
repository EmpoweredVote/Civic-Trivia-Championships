// Game type definitions for civic trivia game

export type Difficulty = 'easy' | 'medium' | 'hard';

export type TopicCategory =
  | 'voting'
  | 'elections'
  | 'congress'
  | 'executive'
  | 'judiciary'
  | 'bill-of-rights'
  | 'amendments'
  | 'federalism'
  | 'civic-participation';

export type LearningContent = {
  topic: TopicCategory;
  paragraphs: string[]; // 2-3 paragraphs
  corrections: Record<string, string>; // Keys are option indices as strings for wrong answers
  source: {
    name: string;
    url: string;
  };
};

export type Question = {
  id: string;
  text: string;
  options: string[]; // Always exactly 4 options
  correctAnswer: number; // Index (0-3) of correct option
  explanation: string;
  difficulty: Difficulty;
  topic: string;
  topicCategory: TopicCategory; // Required granular category
  learningContent?: LearningContent; // Optional expanded educational content
};

export type GamePhase =
  | 'idle' // No game in progress
  | 'starting' // Brief countdown before first question
  | 'answering' // Timer running, player can select
  | 'selected' // Player highlighted answer, awaiting lock-in (Q10 only for standard questions)
  | 'locked' // Player confirmed answer, suspense pause
  | 'revealing' // Showing correct/incorrect + explanation
  | 'final-announcement' // "FINAL QUESTION" screen before wagering
  | 'wagering' // Player selecting wager amount
  | 'wager-locked' // Wager confirmed, suspense pause before final question
  | 'complete'; // All 10 questions done, show results

export type GameAnswer = {
  questionId: string;
  selectedOption: number | null;
  correct: boolean;
  correctAnswer: number; // The correct answer index (for UI highlight)
  timeRemaining: number;
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  responseTime: number;
  wager?: number; // Optional wager amount (only present for Q10)
};

export type Progression = {
  xpEarned: number;
  gemsEarned: number;
};

export type GameResult = {
  answers: GameAnswer[];
  totalCorrect: number;
  totalQuestions: number;
  totalScore: number;
  totalBasePoints: number;
  totalSpeedBonus: number;
  fastestAnswer: {
    questionIndex: number;
    responseTime: number;
    points: number;
  } | null;
  progression?: Progression | null;
  wagerResult?: {
    wagerAmount: number;
    won: boolean;
    pointsChange: number;
  } | null;
};

export type GameState = {
  phase: GamePhase;
  questions: Question[];
  currentQuestionIndex: number;
  selectedOption: number | null;
  answers: GameAnswer[];
  isTimerPaused: boolean;
  isPaused: boolean; // User-initiated pause via Escape key
  sessionId: string | null;
  totalScore: number;
  wagerAmount: number; // Wager amount for final question (defaults to 0)
  wagerCategory: string | null; // Category for final question wagering (defaults to null)
  currentStreak: number; // Tracks consecutive correct answers
  degraded: boolean; // True when backend is running in-memory fallback mode
};

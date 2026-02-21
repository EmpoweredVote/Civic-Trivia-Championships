import type { GameState, Question, GameAnswer } from '../../types/game';

// Score data from server response
export type ScoreData = {
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  correct: boolean;
  correctAnswer: number;
};

// Action types for the game state machine
export type GameAction =
  | { type: 'SESSION_CREATED'; sessionId: string; questions: Question[]; degraded: boolean; collectionName?: string | null; collectionSlug?: string | null; totalQuestions: number }
  | { type: 'SELECT_ANSWER'; optionIndex: number }
  | { type: 'LOCK_ANSWER' }
  | { type: 'REVEAL_ANSWER'; timeRemaining: number; scoreData: ScoreData; nextQuestion?: Question }
  | { type: 'TIMEOUT'; timeRemaining: number; scoreData: ScoreData; nextQuestion?: Question }
  | { type: 'NEXT_QUESTION' }
  | { type: 'QUIT_GAME' }
  | { type: 'SHOW_FINAL_ANNOUNCEMENT' }
  | { type: 'START_WAGER'; category: string }
  | { type: 'SET_WAGER'; amount: number }
  | { type: 'LOCK_WAGER' }
  | { type: 'START_FINAL_QUESTION' }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' };

// Initial game state
export const initialGameState: GameState = {
  phase: 'idle',
  questions: [],
  totalQuestions: 0,
  currentQuestionIndex: 0,
  selectedOption: null,
  answers: [],
  isTimerPaused: false,
  isPaused: false,
  sessionId: null,
  totalScore: 0,
  wagerAmount: 0,
  wagerCategory: null,
  currentStreak: 0,
  degraded: false,
  collectionName: null,
  collectionSlug: null,
};

// Pure reducer function for game state transitions
export function gameReducer(state: GameState, action: GameAction): GameState {
  // Use totalQuestions for game flow logic (not questions.length, which grows in adaptive mode)
  const finalIndex = state.totalQuestions - 1;

  switch (action.type) {
    case 'SESSION_CREATED':
      return {
        ...state,
        phase: 'answering',
        questions: action.questions,
        totalQuestions: action.totalQuestions,
        sessionId: action.sessionId,
        currentQuestionIndex: 0,
        selectedOption: null,
        answers: [],
        totalScore: 0,
        isTimerPaused: false,
        wagerAmount: 0,
        wagerCategory: null,
        currentStreak: 0,
        degraded: action.degraded,
        collectionName: action.collectionName ?? null,
        collectionSlug: action.collectionSlug ?? null,
      };

    case 'SELECT_ANSWER': {
      // Only valid during answering phase, or during selected phase for final question (allows re-selection)
      if (state.phase !== 'answering' && !(state.phase === 'selected' && state.currentQuestionIndex === finalIndex)) {
        return state;
      }

      // Final question keeps two-step confirmation for dramatic stakes
      if (state.currentQuestionIndex === finalIndex) {
        return {
          ...state,
          phase: 'selected',
          selectedOption: action.optionIndex,
        };
      }

      // All other questions: immediate lock-in (single-click)
      return {
        ...state,
        phase: 'locked',
        selectedOption: action.optionIndex,
        isTimerPaused: true,
      };
    }

    case 'LOCK_ANSWER': {
      // Final question only: Lock in wager question answer (two-step confirmation preserved for high stakes)
      // Only valid in selected phase with a selected option
      if (state.phase !== 'selected' || state.selectedOption === null) {
        return state;
      }
      return {
        ...state,
        phase: 'locked',
        isTimerPaused: true,
      };
    }

    case 'REVEAL_ANSWER': {
      // Only valid from locked phase
      if (state.phase !== 'locked') {
        return state;
      }

      const currentQuestion = state.questions[state.currentQuestionIndex];
      if (!currentQuestion) {
        return state;
      }

      const answer: GameAnswer = {
        questionId: currentQuestion.id,
        selectedOption: state.selectedOption,
        correct: action.scoreData.correct,
        correctAnswer: action.scoreData.correctAnswer,
        timeRemaining: action.timeRemaining,
        basePoints: action.scoreData.basePoints,
        speedBonus: action.scoreData.speedBonus,
        totalPoints: action.scoreData.totalPoints,
        responseTime: (state.currentQuestionIndex === finalIndex ? 50 : 20) - action.timeRemaining,
        ...(state.currentQuestionIndex === finalIndex && state.wagerAmount > 0 ? { wager: state.wagerAmount } : {}),
      };

      return {
        ...state,
        phase: 'revealing',
        questions: action.nextQuestion
          ? [...state.questions, action.nextQuestion]
          : state.questions,
        answers: [...state.answers, answer],
        totalScore: state.totalScore + action.scoreData.totalPoints,
        currentStreak: action.scoreData.correct ? state.currentStreak + 1 : 0,
      };
    }

    case 'TIMEOUT': {
      // Valid from answering or selected phase
      if (state.phase !== 'answering' && state.phase !== 'selected') {
        return state;
      }

      const currentQuestion = state.questions[state.currentQuestionIndex];
      if (!currentQuestion) {
        return state;
      }

      const answer: GameAnswer = {
        questionId: currentQuestion.id,
        selectedOption: null,
        correct: action.scoreData.correct,
        correctAnswer: action.scoreData.correctAnswer,
        timeRemaining: action.timeRemaining,
        basePoints: action.scoreData.basePoints,
        speedBonus: action.scoreData.speedBonus,
        totalPoints: action.scoreData.totalPoints,
        responseTime: (state.currentQuestionIndex === finalIndex ? 50 : 20) - action.timeRemaining,
        ...(state.currentQuestionIndex === finalIndex && state.wagerAmount > 0 ? { wager: state.wagerAmount } : {}),
      };

      return {
        ...state,
        phase: 'revealing',
        selectedOption: null,
        questions: action.nextQuestion
          ? [...state.questions, action.nextQuestion]
          : state.questions,
        answers: [...state.answers, answer],
        totalScore: state.totalScore + action.scoreData.totalPoints,
        isTimerPaused: true,
        currentStreak: 0,
      };
    }

    case 'NEXT_QUESTION': {
      // Move to next question or complete
      const nextIndex = state.currentQuestionIndex + 1;

      if (nextIndex >= state.totalQuestions) {
        // Game complete
        return {
          ...state,
          phase: 'complete',
        };
      }

      // Check if next question is the final question - trigger final announcement
      if (nextIndex === finalIndex) {
        return {
          ...state,
          phase: 'final-announcement',
          currentQuestionIndex: nextIndex,
          selectedOption: null,
          isTimerPaused: false,
        };
      }

      // Move to next question
      return {
        ...state,
        phase: 'answering',
        currentQuestionIndex: nextIndex,
        selectedOption: null,
        isTimerPaused: false,
      };
    }

    case 'QUIT_GAME':
      return {
        ...initialGameState,
      };

    case 'SHOW_FINAL_ANNOUNCEMENT': {
      // Guard: only valid from revealing phase
      if (state.phase !== 'revealing') {
        return state;
      }
      return {
        ...state,
        phase: 'final-announcement',
      };
    }

    case 'START_WAGER': {
      // Guard: only valid from final-announcement phase
      if (state.phase !== 'final-announcement') {
        return state;
      }
      // Set default wager to 25% of max allowed (half of current score)
      const maxWager = Math.floor(state.totalScore / 2);
      const defaultWager = Math.floor(maxWager * 0.25);
      return {
        ...state,
        phase: 'wagering',
        wagerCategory: action.category,
        wagerAmount: defaultWager,
      };
    }

    case 'SET_WAGER': {
      // Guard: only valid during wagering phase
      if (state.phase !== 'wagering') {
        return state;
      }
      // Clamp wager to valid range [0, half of current score]
      const maxWager = Math.floor(state.totalScore / 2);
      const clampedAmount = Math.max(0, Math.min(action.amount, maxWager));
      return {
        ...state,
        wagerAmount: clampedAmount,
      };
    }

    case 'LOCK_WAGER': {
      // Guard: only valid during wagering phase
      if (state.phase !== 'wagering') {
        return state;
      }
      return {
        ...state,
        phase: 'wager-locked',
        isTimerPaused: true,
      };
    }

    case 'START_FINAL_QUESTION': {
      // Guard: only valid from wager-locked phase
      if (state.phase !== 'wager-locked') {
        return state;
      }
      // Transition to answering phase for final question (reuse existing answering logic)
      return {
        ...state,
        phase: 'answering',
        selectedOption: null,
        isTimerPaused: false,
      };
    }

    case 'PAUSE_GAME': {
      // Guard: only valid during answering or selected phases (when timer is running)
      if (state.phase !== 'answering' && state.phase !== 'selected') {
        return state;
      }
      return {
        ...state,
        isTimerPaused: true,
        isPaused: true,
      };
    }

    case 'RESUME_GAME': {
      return {
        ...state,
        isTimerPaused: false,
        isPaused: false,
      };
    }

    default:
      return state;
  }
}

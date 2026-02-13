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
  | { type: 'SESSION_CREATED'; sessionId: string; questions: Question[] }
  | { type: 'SELECT_ANSWER'; optionIndex: number }
  | { type: 'LOCK_ANSWER' }
  | { type: 'REVEAL_ANSWER'; timeRemaining: number; scoreData: ScoreData }
  | { type: 'TIMEOUT'; timeRemaining: number; scoreData: ScoreData }
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
  currentQuestionIndex: 0,
  selectedOption: null,
  answers: [],
  isTimerPaused: false,
  isPaused: false,
  sessionId: null,
  totalScore: 0,
  wagerAmount: 0,
  wagerCategory: null,
};

// Pure reducer function for game state transitions
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SESSION_CREATED':
      return {
        ...state,
        phase: 'answering',
        questions: action.questions,
        sessionId: action.sessionId,
        currentQuestionIndex: 0,
        selectedOption: null,
        answers: [],
        totalScore: 0,
        isTimerPaused: false,
        wagerAmount: 0,
        wagerCategory: null,
      };

    case 'SELECT_ANSWER': {
      // Only valid during answering or selected phase
      if (state.phase !== 'answering' && state.phase !== 'selected') {
        return state;
      }
      return {
        ...state,
        phase: 'selected',
        selectedOption: action.optionIndex,
      };
    }

    case 'LOCK_ANSWER': {
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
        responseTime: (state.currentQuestionIndex === 9 ? 50 : 25) - action.timeRemaining,
        ...(state.currentQuestionIndex === 9 && state.wagerAmount > 0 ? { wager: state.wagerAmount } : {}),
      };

      return {
        ...state,
        phase: 'revealing',
        answers: [...state.answers, answer],
        totalScore: state.totalScore + action.scoreData.totalPoints,
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
        responseTime: (state.currentQuestionIndex === 9 ? 50 : 25) - action.timeRemaining,
        ...(state.currentQuestionIndex === 9 && state.wagerAmount > 0 ? { wager: state.wagerAmount } : {}),
      };

      return {
        ...state,
        phase: 'revealing',
        selectedOption: null,
        answers: [...state.answers, answer],
        totalScore: state.totalScore + action.scoreData.totalPoints,
        isTimerPaused: true,
      };
    }

    case 'NEXT_QUESTION': {
      // Move to next question or complete
      const nextIndex = state.currentQuestionIndex + 1;

      if (nextIndex >= state.questions.length) {
        // Game complete
        return {
          ...state,
          phase: 'complete',
        };
      }

      // Check if next question is Q10 (0-indexed: 9) - trigger final announcement
      if (nextIndex === 9) {
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
      // Transition to answering phase for Q10 (reuse existing answering logic)
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

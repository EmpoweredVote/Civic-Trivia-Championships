import type { GameState, Question, GameAnswer } from '../../types/game';

// Action types for the game state machine
export type GameAction =
  | { type: 'START_GAME'; questions: Question[] }
  | { type: 'SELECT_ANSWER'; optionIndex: number }
  | { type: 'LOCK_ANSWER' }
  | { type: 'REVEAL_ANSWER'; timeRemaining: number }
  | { type: 'TIMEOUT'; timeRemaining: number }
  | { type: 'NEXT_QUESTION' }
  | { type: 'QUIT_GAME' };

// Initial game state
export const initialGameState: GameState = {
  phase: 'idle',
  questions: [],
  currentQuestionIndex: 0,
  selectedOption: null,
  answers: [],
  isTimerPaused: false,
};

// Pure reducer function for game state transitions
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        phase: 'answering',
        questions: action.questions,
        currentQuestionIndex: 0,
        selectedOption: null,
        answers: [],
        isTimerPaused: false,
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
        correct: state.selectedOption === currentQuestion.correctAnswer,
        timeRemaining: action.timeRemaining,
      };

      return {
        ...state,
        phase: 'revealing',
        answers: [...state.answers, answer],
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
        correct: false,
        timeRemaining: action.timeRemaining,
      };

      return {
        ...state,
        phase: 'revealing',
        selectedOption: null,
        answers: [...state.answers, answer],
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

    default:
      return state;
  }
}

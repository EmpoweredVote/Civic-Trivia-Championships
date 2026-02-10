import { useReducer, useEffect, useRef } from 'react';
import { gameReducer, initialGameState } from '../gameReducer';
import { fetchQuestions } from '../../../services/gameService';
import type { GameState, Question, GameResult } from '../../../types/game';

// Timing constants
const SUSPENSE_PAUSE_MS = 1500; // Pause after lock-in before reveal
const AUTO_ADVANCE_MS = 4000; // Auto-advance after reveal

interface UseGameStateReturn {
  state: GameState;
  currentQuestion: Question | null;
  startGame: () => Promise<void>;
  selectAnswer: (optionIndex: number) => void;
  lockAnswer: (timeRemaining: number) => void;
  handleTimeout: () => void;
  nextQuestion: () => void;
  quitGame: () => void;
  gameResult: GameResult | null;
}

export function useGameState(): UseGameStateReturn {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);

  // Refs to track timeouts for cleanup
  const suspenseTimeoutRef = useRef<number | null>(null);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);

  // Derived values
  const currentQuestion = state.questions[state.currentQuestionIndex] || null;

  const gameResult: GameResult | null =
    state.phase === 'complete'
      ? {
          answers: state.answers,
          totalCorrect: state.answers.filter((a) => a.correct).length,
          totalQuestions: state.questions.length,
        }
      : null;

  // Start game by fetching questions
  const startGame = async () => {
    try {
      const questions = await fetchQuestions();
      dispatch({ type: 'START_GAME', questions });
    } catch (error) {
      console.error('Failed to fetch questions:', error);
      // Stay in idle phase on error
    }
  };

  // Select an answer option
  const selectAnswer = (optionIndex: number) => {
    dispatch({ type: 'SELECT_ANSWER', optionIndex });
  };

  // Lock in the selected answer with suspense pause
  const lockAnswer = (timeRemaining: number) => {
    if (state.phase !== 'selected') return;

    dispatch({ type: 'LOCK_ANSWER' });

    // Clear any existing suspense timeout
    if (suspenseTimeoutRef.current) {
      clearTimeout(suspenseTimeoutRef.current);
    }

    // Start suspense pause before reveal
    suspenseTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'REVEAL_ANSWER', timeRemaining });
    }, SUSPENSE_PAUSE_MS);
  };

  // Handle timer timeout
  const handleTimeout = () => {
    dispatch({ type: 'TIMEOUT', timeRemaining: 0 });
  };

  // Move to next question
  const nextQuestion = () => {
    // Cancel auto-advance if user manually advances
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    dispatch({ type: 'NEXT_QUESTION' });
  };

  // Quit game
  const quitGame = () => {
    dispatch({ type: 'QUIT_GAME' });
  };

  // Auto-advance logic when entering revealing phase
  useEffect(() => {
    if (state.phase === 'revealing') {
      // Clear any existing auto-advance timeout
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }

      // Start auto-advance timer
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'NEXT_QUESTION' });
      }, AUTO_ADVANCE_MS);
    }

    // Cleanup on unmount or phase change
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
  }, [state.phase]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (suspenseTimeoutRef.current) {
        clearTimeout(suspenseTimeoutRef.current);
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    currentQuestion,
    startGame,
    selectAnswer,
    lockAnswer,
    handleTimeout,
    nextQuestion,
    quitGame,
    gameResult,
  };
}

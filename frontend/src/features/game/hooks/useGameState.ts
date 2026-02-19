import { useReducer, useEffect, useRef, useState } from 'react';
import { gameReducer, initialGameState } from '../gameReducer';
import { createGameSession, submitAnswer } from '../../../services/gameService';
import type { GameState, Question, GameResult, Progression } from '../../../types/game';
import { apiRequest } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';

// Timing constants
const SUSPENSE_PAUSE_MS = 750; // Pause after lock-in before reveal (reduced for snappier pacing)
const AUTO_ADVANCE_MS = 4000; // Auto-advance after reveal (reduced for faster flow)
const ANNOUNCEMENT_DURATION_MS = 2500; // 2.5s for "FINAL QUESTION" screen
const WAGER_SUSPENSE_MS = 1500; // Suspense pause after locking wager

interface UseGameStateReturn {
  state: GameState;
  currentQuestion: Question | null;
  startGame: (collectionId?: number) => Promise<void>;
  selectAnswer: (optionIndex: number, timeRemaining?: number) => void;
  lockAnswer: (timeRemaining: number) => void;
  handleTimeout: () => void;
  nextQuestion: () => void;
  quitGame: () => void;
  gameResult: GameResult | null;
  pauseAutoAdvance: () => void;
  resumeAutoAdvance: () => void;
  hasShownTooltip: boolean;
  setHasShownTooltip: (value: boolean) => void;
  startWager: () => void;
  setWagerAmount: (amount: number) => void;
  lockWager: () => void;
  isFinalQuestion: boolean;
  pauseGame: () => void;
  resumeGame: () => void;
}

export function useGameState(): UseGameStateReturn {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [hasShownTooltip, setHasShownTooltip] = useState(false);
  const [progression, setProgression] = useState<Progression | null>(null);

  // Refs to track timeouts for cleanup and sessionId for server calls
  const suspenseTimeoutRef = useRef<number | null>(null);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const autoAdvancePausedAtRef = useRef<number | null>(null);
  const revealStartTimeRef = useRef<number | null>(null);

  // Derived values
  const currentQuestion = state.questions[state.currentQuestionIndex] || null;
  const isFinalQuestion = state.currentQuestionIndex === 9;

  const gameResult: GameResult | null =
    state.phase === 'complete'
      ? {
          answers: state.answers,
          totalCorrect: state.answers.filter((a) => a.correct).length,
          totalQuestions: state.questions.length,
          totalScore: state.totalScore,
          totalBasePoints: state.answers.reduce((sum, a) => sum + a.basePoints, 0),
          totalSpeedBonus: state.answers.reduce((sum, a) => sum + a.speedBonus, 0),
          fastestAnswer: (() => {
            const correctAnswers = state.answers
              .map((a, index) => ({ ...a, index }))
              .filter((a) => a.correct);
            if (correctAnswers.length === 0) return null;
            const fastest = correctAnswers.reduce((min, a) =>
              a.responseTime < min.responseTime ? a : min
            );
            return {
              questionIndex: fastest.index,
              responseTime: fastest.responseTime,
              points: fastest.totalPoints,
            };
          })(),
          progression: progression,
          wagerResult: (() => {
            // Check if final answer (Q10) has a wager
            const finalAnswer = state.answers[9];
            if (finalAnswer?.wager !== undefined) {
              return {
                wagerAmount: finalAnswer.wager,
                won: finalAnswer.correct,
                pointsChange: finalAnswer.totalPoints,
              };
            }
            return null;
          })(),
        }
      : null;

  // Start game by creating a server session
  const startGame = async (collectionId?: number) => {
    try {
      const { sessionId, questions, degraded, collectionName, collectionSlug } = await createGameSession(collectionId);
      sessionIdRef.current = sessionId;
      setHasShownTooltip(false); // Reset tooltip flag for new game
      dispatch({ type: 'SESSION_CREATED', sessionId, questions, degraded, collectionName, collectionSlug });
    } catch (error) {
      console.error('Failed to create game session:', error);
      // Stay in idle phase on error
    }
  };

  // Shared helper: Submit answer to server and reveal after suspense pause
  const submitAndReveal = async (optionIndex: number, timeRemaining: number) => {
    if (!sessionIdRef.current) return;

    // Clear any existing suspense timeout
    if (suspenseTimeoutRef.current) {
      clearTimeout(suspenseTimeoutRef.current);
    }

    const currentQuestion = state.questions[state.currentQuestionIndex];
    if (!currentQuestion) return;

    // Include wager for final question (Q10)
    const wager = state.currentQuestionIndex === 9 ? state.wagerAmount : undefined;

    try {
      const [serverResponse] = await Promise.all([
        submitAnswer(
          sessionIdRef.current,
          currentQuestion.id,
          optionIndex,
          timeRemaining,
          wager
        ),
        new Promise((resolve) => setTimeout(resolve, SUSPENSE_PAUSE_MS)),
      ]);

      dispatch({
        type: 'REVEAL_ANSWER',
        timeRemaining,
        scoreData: {
          basePoints: serverResponse.basePoints,
          speedBonus: serverResponse.speedBonus,
          totalPoints: serverResponse.totalPoints,
          correct: serverResponse.correct,
          correctAnswer: serverResponse.correctAnswer,
        },
      });
    } catch (error) {
      console.error('Failed to submit answer:', error);
      // Fallback: reveal with zero score if server fails
      dispatch({
        type: 'REVEAL_ANSWER',
        timeRemaining,
        scoreData: {
          basePoints: 0,
          speedBonus: 0,
          totalPoints: 0,
          correct: false,
          correctAnswer: currentQuestion.correctAnswer || 0,
        },
      });
    }
  };

  // Select an answer option (Q1-Q9: immediate submission, Q10: two-step with lock-in)
  const selectAnswer = (optionIndex: number, timeRemaining?: number) => {
    dispatch({ type: 'SELECT_ANSWER', optionIndex });

    // For Q1-Q9, immediately submit (reducer already set phase to 'locked')
    if (state.currentQuestionIndex !== 9 && timeRemaining !== undefined) {
      submitAndReveal(optionIndex, timeRemaining);
    }
    // For Q10, just dispatch (lockAnswer handles submission)
  };

  // Lock in the selected answer (Q10-only: two-step confirmation preserved for high stakes)
  const lockAnswer = async (timeRemaining: number) => {
    if (state.phase !== 'selected' || !sessionIdRef.current) return;

    dispatch({ type: 'LOCK_ANSWER' });

    // Submit to server with suspense pause
    if (state.selectedOption !== null) {
      await submitAndReveal(state.selectedOption, timeRemaining);
    }
  };

  // Handle timer timeout - submit null answer to server
  const handleTimeout = async () => {
    if (!sessionIdRef.current) return;

    const currentQuestion = state.questions[state.currentQuestionIndex];
    if (!currentQuestion) return;

    // Include wager for final question (Q10)
    const wager = state.currentQuestionIndex === 9 ? state.wagerAmount : undefined;

    try {
      const serverResponse = await submitAnswer(
        sessionIdRef.current,
        currentQuestion.id,
        null,
        0,
        wager
      );

      dispatch({
        type: 'TIMEOUT',
        timeRemaining: 0,
        scoreData: {
          basePoints: serverResponse.basePoints,
          speedBonus: serverResponse.speedBonus,
          totalPoints: serverResponse.totalPoints,
          correct: serverResponse.correct,
          correctAnswer: serverResponse.correctAnswer,
        },
      });
    } catch (error) {
      console.error('Failed to submit timeout answer:', error);
      // Fallback: reveal with zero score if server fails
      dispatch({
        type: 'TIMEOUT',
        timeRemaining: 0,
        scoreData: {
          basePoints: 0,
          speedBonus: 0,
          totalPoints: 0,
          correct: false,
          correctAnswer: currentQuestion.correctAnswer || 0,
        },
      });
    }
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

  // Start wager phase (called after final announcement timer)
  const startWager = () => {
    const currentQuestion = state.questions[state.currentQuestionIndex];
    if (!currentQuestion) return;

    // Use topicCategory, fallback to topic if not available
    const category = currentQuestion.topicCategory || currentQuestion.topic;
    dispatch({ type: 'START_WAGER', category });
  };

  // Set wager amount during wagering phase
  const setWagerAmount = (amount: number) => {
    dispatch({ type: 'SET_WAGER', amount });
  };

  // Lock in wager with suspense pause before final question
  const lockWager = () => {
    dispatch({ type: 'LOCK_WAGER' });

    // After suspense pause, start the final question
    setTimeout(() => {
      dispatch({ type: 'START_FINAL_QUESTION' });
    }, WAGER_SUSPENSE_MS);
  };

  // Pause auto-advance timer and save remaining time
  const pauseAutoAdvance = () => {
    if (autoAdvanceTimeoutRef.current && revealStartTimeRef.current) {
      const elapsed = Date.now() - revealStartTimeRef.current;
      const remaining = AUTO_ADVANCE_MS - elapsed;
      autoAdvancePausedAtRef.current = remaining > 0 ? remaining : 0;
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  };

  // Resume auto-advance timer with saved remaining time
  const resumeAutoAdvance = () => {
    if (autoAdvancePausedAtRef.current !== null) {
      const remainingTime = autoAdvancePausedAtRef.current;
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        dispatch({ type: 'NEXT_QUESTION' });
      }, remainingTime);
      autoAdvancePausedAtRef.current = null;
      // Update reveal start time to account for the pause
      revealStartTimeRef.current = Date.now() - (AUTO_ADVANCE_MS - remainingTime);
    }
  };

  // Pause game (user-initiated via Escape key)
  const pauseGame = () => {
    dispatch({ type: 'PAUSE_GAME' });
  };

  // Resume game (from pause overlay)
  const resumeGame = () => {
    dispatch({ type: 'RESUME_GAME' });
  };

  // Auto-advance logic when entering revealing phase
  useEffect(() => {
    if (state.phase === 'revealing') {
      // Clear any existing auto-advance timeout
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }

      // Record when reveal phase started
      revealStartTimeRef.current = Date.now();

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

  // Handle final announcement phase - auto-transition to wager screen
  useEffect(() => {
    if (state.phase === 'final-announcement') {
      const timer = setTimeout(() => {
        startWager();
      }, ANNOUNCEMENT_DURATION_MS);

      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  // Fetch progression data when game completes (authenticated users only)
  useEffect(() => {
    if (state.phase === 'complete' && sessionIdRef.current) {
      const isAuthenticated = useAuthStore.getState().isAuthenticated;

      if (isAuthenticated) {
        // Fetch results from server to get progression data
        apiRequest<{ progression: Progression | null }>(`/api/game/results/${sessionIdRef.current}`)
          .then((response) => {
            setProgression(response.progression);
          })
          .catch((error) => {
            console.error('Failed to fetch progression:', error);
            setProgression(null);
          });
      } else {
        // Anonymous user - no progression
        setProgression(null);
      }
    }
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
    pauseAutoAdvance,
    resumeAutoAdvance,
    hasShownTooltip,
    setHasShownTooltip,
    startWager,
    setWagerAmount,
    lockWager,
    isFinalQuestion,
    pauseGame,
    resumeGame,
  };
}

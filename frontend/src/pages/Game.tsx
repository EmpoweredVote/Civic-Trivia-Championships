import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameState } from '../features/game/hooks/useGameState';
import { GameScreen } from '../features/game/components/GameScreen';
import { ResultsScreen } from '../features/game/components/ResultsScreen';
import { announce } from '../utils/announce';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../services/api';

export function Game() {
  const navigate = useNavigate();
  const location = useLocation();
  const collectionId = (location.state as { collectionId?: number } | null)?.collectionId;

  const {
    state,
    currentQuestion,
    startGame,
    selectAnswer,
    lockAnswer,
    handleTimeout,
    nextQuestion,
    quitGame,
    gameResult,
    hasShownTooltip,
    setHasShownTooltip,
    setWagerAmount,
    lockWager,
    isFinalQuestion,
    pauseGame,
    resumeGame,
  } = useGameState();

  // Flag state management
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Auto-start game when navigating from Dashboard with a collectionId
  useEffect(() => {
    if (collectionId !== undefined && state.phase === 'idle') {
      startGame(collectionId);
    }
  }, []);

  // Reset flag state when game starts
  useEffect(() => {
    if (state.phase === 'starting' || (state.phase === 'answering' && state.currentQuestionIndex === 0)) {
      setFlaggedQuestions(new Set());
      setIsRateLimited(false);
    }
  }, [state.phase, state.currentQuestionIndex]);

  const handlePlayAgain = () => {
    startGame(collectionId);
  };

  const handleHome = () => {
    navigate('/dashboard');
  };

  const handleQuit = () => {
    quitGame();
    navigate('/dashboard');
  };

  // Wrapper for GameScreen startGame that passes collectionId
  const handleStartGame = () => startGame(collectionId);

  // Handle flag toggle with API calls
  const handleFlagToggle = async (questionId: string) => {
    const token = useAuthStore.getState().accessToken;
    const sessionId = state.sessionId;

    if (!token || !sessionId) {
      console.error('Cannot flag: missing token or sessionId');
      return;
    }

    const isFlagged = flaggedQuestions.has(questionId);

    if (isFlagged) {
      // Unflag: optimistically remove from set
      const newFlagged = new Set(flaggedQuestions);
      newFlagged.delete(questionId);
      setFlaggedQuestions(newFlagged);

      // Call DELETE API
      try {
        const response = await fetch(`${API_URL}/api/feedback/flag/${questionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          // Rollback on failure
          const rollbackSet = new Set(flaggedQuestions);
          rollbackSet.add(questionId);
          setFlaggedQuestions(rollbackSet);
          console.error('Failed to unflag question:', await response.text());
        }
      } catch (error) {
        // Rollback on error
        const rollbackSet = new Set(flaggedQuestions);
        rollbackSet.add(questionId);
        setFlaggedQuestions(rollbackSet);
        console.error('Error unflagging question:', error);
      }
    } else {
      // Flag: optimistically add to set
      const newFlagged = new Set(flaggedQuestions);
      newFlagged.add(questionId);
      setFlaggedQuestions(newFlagged);

      // Call POST API
      try {
        const response = await fetch(`${API_URL}/api/feedback/flag`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ questionId, sessionId }),
        });

        if (response.status === 429) {
          // Rate limited: set rate limit state and rollback
          setIsRateLimited(true);
          const rollbackSet = new Set(flaggedQuestions);
          rollbackSet.delete(questionId);
          setFlaggedQuestions(rollbackSet);
        } else if (!response.ok) {
          // Other error: rollback
          const rollbackSet = new Set(flaggedQuestions);
          rollbackSet.delete(questionId);
          setFlaggedQuestions(rollbackSet);
          console.error('Failed to flag question:', await response.text());
        }
      } catch (error) {
        // Rollback on error
        const rollbackSet = new Set(flaggedQuestions);
        rollbackSet.delete(questionId);
        setFlaggedQuestions(rollbackSet);
        console.error('Error flagging question:', error);
      }
    }
  };

  // Announce game completion for screen readers
  useEffect(() => {
    if (state.phase === 'complete' && gameResult) {
      announce.polite(
        `Game complete. Your score is ${gameResult.totalScore} points with ${gameResult.totalCorrect} out of ${gameResult.totalQuestions} correct.`
      );
    }
  }, [state.phase, gameResult]);

  // Show results screen when game is complete
  if (state.phase === 'complete' && gameResult) {
    return (
      <ResultsScreen
        result={gameResult}
        questions={state.questions}
        collectionName={state.collectionName}
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
        flaggedQuestions={flaggedQuestions}
      />
    );
  }

  // Hide idle screen flash when auto-starting from Dashboard
  if (state.phase === 'idle' && collectionId !== undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
    );
  }

  // Otherwise show the game screen
  return (
    <GameScreen
      state={state}
      currentQuestion={currentQuestion}
      startGame={handleStartGame}
      selectAnswer={selectAnswer}
      lockAnswer={lockAnswer}
      handleTimeout={handleTimeout}
      quitGame={handleQuit}
      nextQuestion={nextQuestion}
      hasShownTooltip={hasShownTooltip}
      setHasShownTooltip={setHasShownTooltip}
      setWagerAmount={setWagerAmount}
      lockWager={lockWager}
      isFinalQuestion={isFinalQuestion}
      pauseGame={pauseGame}
      resumeGame={resumeGame}
      flaggedQuestions={flaggedQuestions}
      isRateLimited={isRateLimited}
      onFlagToggle={handleFlagToggle}
    />
  );
}

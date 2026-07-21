import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameState } from '../features/game/hooks/useGameState';
import { GameScreen } from '../features/game/components/GameScreen';
import { ResultsScreen } from '../features/game/components/ResultsScreen';
import { FeedbackElaborationScreen } from '../features/game/components/FeedbackElaborationScreen';
import { announce } from '../utils/announce';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../services/api';
import { usePlayerXp } from '../hooks/usePlayerXp';
import { XpStrip } from '../features/game/components/XpStrip';
import { track } from '@empoweredvote/analytics';

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

  // Auth state for conditional flag UI
  const accessToken = useAuthStore((state) => state.accessToken);

  // XP data for start screen and level-up detection
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { xpData, isLoading: isXpLoading, isConnected: isXpConnected } = usePlayerXp(userId);

  // Capture level before game starts for level-up detection on end screen
  const [priorLevel, setPriorLevel] = useState<number | null>(null);

  // Flag state management
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());

  // Archived question tracking (admin only — purely for local UI feedback; read when badge display is added)
  const [, setArchivedQuestions] = useState<Set<string>>(new Set());
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [showElaborationScreen, setShowElaborationScreen] = useState(false);
  const [elaborationComplete, setElaborationComplete] = useState(false);
  const [pendingAction, setPendingAction] = useState<'playAgain' | 'home' | null>(null);

  // Auto-start game when navigating from Dashboard with a collectionId
  useEffect(() => {
    if (collectionId !== undefined && state.phase === 'idle') {
      startGame(collectionId);
    }
  }, []);

  // Capture priorLevel when XP loads on idle screen (before game starts)
  // Only set once (priorLevel === null) — Plan 05 updates it after each game via onLevelCaptured
  useEffect(() => {
    if (state.phase === 'idle' && xpData !== null && priorLevel === null) {
      setPriorLevel(xpData.level);
    }
  }, [state.phase, xpData, priorLevel]);

  // Reset flag state when game starts
  useEffect(() => {
    if (state.phase === 'starting' || (state.phase === 'answering' && state.currentQuestionIndex === 0)) {
      setFlaggedQuestions(new Set());
      setArchivedQuestions(new Set());
      setIsRateLimited(false);
      setShowElaborationScreen(false);
      setElaborationComplete(false);
      setPendingAction(null);
    }
  }, [state.phase, state.currentQuestionIndex]);

  const handlePlayAgain = () => {
    if (flaggedQuestions.size > 0 && !elaborationComplete) {
      setPendingAction('playAgain');
      setShowElaborationScreen(true);
    } else {
      startGame(collectionId);
    }
  };

  const handleHome = () => {
    if (flaggedQuestions.size > 0 && !elaborationComplete) {
      setPendingAction('home');
      setShowElaborationScreen(true);
    } else {
      navigate('/dashboard');
    }
  };

  const handleQuit = () => {
    // Capture answered count before quitGame() resets game state.
    track('ctc_game_abandoned', { answered: state.answers.length });
    quitGame();
    navigate('/dashboard');
  };

  // Wrapper for GameScreen startGame that passes collectionId
  const handleStartGame = () => startGame(collectionId);

  // Handle admin archive — track locally for potential future UI feedback
  const handleArchiveQuestion = (questionId: string) => {
    setArchivedQuestions(prev => new Set(prev).add(questionId));
  };

  // Handle elaboration submission
  const handleSubmitElaborations = async (elaborations: Array<{
    questionId: string;
    reasons: string[];
    elaborationText: string;
  }>) => {
    const token = useAuthStore.getState().accessToken;
    if (!token || !state.sessionId) return;

    const response = await fetch(`${API_URL}/api/feedback/flags/batch`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        sessionId: state.sessionId,
        elaborations,
      }),
    });

    if (!response.ok) {
      console.error('Failed to submit elaborations:', await response.text());
      // Don't block user — still proceed even if API fails
    }

    setElaborationComplete(true);
    setShowElaborationScreen(false);
    // Execute the pending action (play again or go home)
    if (pendingAction === 'playAgain') {
      startGame(collectionId);
    } else if (pendingAction === 'home') {
      navigate('/dashboard');
    }
    setPendingAction(null);
  };

  // Handle elaboration skip
  const handleSkipElaboration = () => {
    setElaborationComplete(true);
    setShowElaborationScreen(false);
    // Execute the pending action (play again or go home)
    if (pendingAction === 'playAgain') {
      startGame(collectionId);
    } else if (pendingAction === 'home') {
      navigate('/dashboard');
    }
    setPendingAction(null);
  };

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

  // Show elaboration screen between game end and results (when questions were flagged)
  if (showElaborationScreen && state.phase === 'complete' && gameResult) {
    return (
      <FeedbackElaborationScreen
        flaggedQuestions={Array.from(flaggedQuestions)}
        questions={state.questions}
        sessionId={state.sessionId!}
        onSubmit={handleSubmitElaborations}
        onSkip={handleSkipElaboration}
      />
    );
  }

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
        onFlagToggle={accessToken ? handleFlagToggle : undefined}
        priorLevel={priorLevel}
        onLevelCaptured={(newLevel) => setPriorLevel(newLevel)}
      />
    );
  }

  // Show XpStrip while session loads (auto-starting from Dashboard)
  if (state.phase === 'idle' && collectionId !== undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        {isXpConnected && <XpStrip xpData={xpData} isLoading={isXpLoading} />}
      </div>
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
      xpData={xpData}
      isXpLoading={isXpLoading}
      isXpConnected={isXpConnected}
      onArchiveQuestion={handleArchiveQuestion}
    />
  );
}

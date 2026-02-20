import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameState } from '../features/game/hooks/useGameState';
import { GameScreen } from '../features/game/components/GameScreen';
import { ResultsScreen } from '../features/game/components/ResultsScreen';
import { announce } from '../utils/announce';

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

  // Auto-start game when navigating from Dashboard with a collectionId
  useEffect(() => {
    if (collectionId !== undefined && state.phase === 'idle') {
      startGame(collectionId);
    }
  }, []);

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
    />
  );
}

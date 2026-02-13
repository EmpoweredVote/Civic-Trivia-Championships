import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '../features/game/hooks/useGameState';
import { GameScreen } from '../features/game/components/GameScreen';
import { ResultsScreen } from '../features/game/components/ResultsScreen';
import { announce } from '../utils/announce';

export function Game() {
  const navigate = useNavigate();
  const {
    state,
    currentQuestion,
    startGame,
    selectAnswer,
    lockAnswer,
    handleTimeout,
    quitGame,
    gameResult,
    pauseAutoAdvance,
    resumeAutoAdvance,
    hasShownTooltip,
    setHasShownTooltip,
    setWagerAmount,
    lockWager,
    isFinalQuestion,
    pauseGame,
    resumeGame,
  } = useGameState();

  const handlePlayAgain = () => {
    startGame();
  };

  const handleHome = () => {
    navigate('/dashboard');
  };

  const handleQuit = () => {
    quitGame();
    navigate('/dashboard');
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
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
      />
    );
  }

  // Otherwise show the game screen
  return (
    <GameScreen
      state={state}
      currentQuestion={currentQuestion}
      startGame={startGame}
      selectAnswer={selectAnswer}
      lockAnswer={lockAnswer}
      handleTimeout={handleTimeout}
      quitGame={handleQuit}
      pauseAutoAdvance={pauseAutoAdvance}
      resumeAutoAdvance={resumeAutoAdvance}
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

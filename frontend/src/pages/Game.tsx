import { useNavigate } from 'react-router-dom';
import { useGameState } from '../features/game/hooks/useGameState';
import { GameScreen } from '../features/game/components/GameScreen';
import { ResultsScreen } from '../features/game/components/ResultsScreen';

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
    />
  );
}

import { useNavigate } from 'react-router-dom';
import { useGameState } from '../features/game/hooks/useGameState';
import { GameScreen } from '../features/game/components/GameScreen';
import { ResultsScreen } from '../features/game/components/ResultsScreen';

export function Game() {
  const navigate = useNavigate();
  const gameState = useGameState();

  const handlePlayAgain = () => {
    gameState.startGame();
  };

  const handleHome = () => {
    navigate('/dashboard');
  };

  // Show results screen when game is complete
  if (gameState.state.phase === 'complete' && gameState.gameResult) {
    return (
      <ResultsScreen
        result={gameState.gameResult}
        questions={gameState.state.questions}
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
      />
    );
  }

  // Otherwise show the game screen
  // Note: GameScreen currently calls useGameState internally
  // For now, we'll let it manage its own state, but in a future refactor
  // we could pass the state down as props to avoid duplicate hook calls
  return <GameScreen />;
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameState } from '../hooks/useGameState';
import { useKeyPress } from '../hooks/useKeyPress';
import { GameTimer } from './GameTimer';
import { ProgressDots } from './ProgressDots';
import { QuestionCard } from './QuestionCard';
import { AnswerGrid } from './AnswerGrid';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';

const QUESTION_DURATION = 20; // seconds

export function GameScreen() {
  const {
    state,
    currentQuestion,
    startGame,
    selectAnswer,
    lockAnswer,
    handleTimeout,
    quitGame,
  } = useGameState();

  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [showTimeoutFlash, setShowTimeoutFlash] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  // Keyboard shortcuts for answer selection
  const canUseKeyboard = state.phase === 'answering' || state.phase === 'selected';
  useKeyPress('a', () => selectAnswer(0), canUseKeyboard);
  useKeyPress('b', () => selectAnswer(1), canUseKeyboard);
  useKeyPress('c', () => selectAnswer(2), canUseKeyboard);
  useKeyPress('d', () => selectAnswer(3), canUseKeyboard);

  // Reset timer when question changes
  useEffect(() => {
    if (state.phase === 'answering') {
      setTimerKey((prev) => prev + 1);
    }
  }, [state.currentQuestionIndex, state.phase]);

  // Handle timeout with flash message
  const onTimeout = () => {
    setShowTimeoutFlash(true);
    setTimeout(() => {
      setShowTimeoutFlash(false);
      handleTimeout();
    }, 1000);
  };

  // Handle lock in with time remaining calculation
  const onLockIn = () => {
    // In a real implementation, we'd get actual time remaining from the timer
    // For now, we'll estimate based on the current state
    const timeRemaining = 10; // Placeholder - would need timer ref to get actual value
    lockAnswer(timeRemaining);
  };

  const handleQuitClick = () => {
    setShowQuitDialog(true);
  };

  const handleQuitConfirm = () => {
    setShowQuitDialog(false);
    quitGame();
  };

  const handleQuitCancel = () => {
    setShowQuitDialog(false);
  };

  // Idle state - show start button
  if (state.phase === 'idle') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h1 className="text-5xl font-bold text-white mb-8">
            Civic Trivia Challenge
          </h1>
          <button
            onClick={startGame}
            className="px-12 py-4 bg-teal-600 hover:bg-teal-700 text-white text-xl font-bold rounded-lg shadow-2xl transition-all transform hover:scale-105"
          >
            Quick Play
          </button>
        </motion.div>
      </div>
    );
  }

  // Complete state - show completion message (results screen will be added in Plan 04)
  if (state.phase === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            Game Complete!
          </h1>
          <p className="text-slate-400 mb-8">
            You answered {state.answers.filter((a) => a.correct).length} out of{' '}
            {state.questions.length} correctly
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition-colors"
          >
            Play Again
          </button>
        </motion.div>
      </div>
    );
  }

  // Main game screen
  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Radial gradient bloom effect */}
      <div className="absolute inset-0 bg-gradient-radial from-teal-900/10 via-transparent to-transparent opacity-30" />

      {/* Main content container */}
      <div className="relative min-h-screen flex flex-col py-8 px-4">
        {/* Top HUD - Quit button, Progress, Timer */}
        <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
          {/* Quit button */}
          <button
            onClick={handleQuitClick}
            className="text-slate-400 hover:text-white transition-colors p-2"
            aria-label="Quit game"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Progress dots */}
          <ProgressDots
            currentIndex={state.currentQuestionIndex}
            total={state.questions.length}
          />

          {/* Timer */}
          <GameTimer
            key={timerKey}
            duration={QUESTION_DURATION}
            onTimeout={onTimeout}
            isPaused={state.isTimerPaused}
          />
        </div>

        {/* Timeout flash message */}
        <AnimatePresence>
          {showTimeoutFlash && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none"
            >
              <div className="bg-red-600 text-white text-3xl font-bold px-12 py-6 rounded-lg shadow-2xl">
                Time's up!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question and answers - with AnimatePresence for transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentQuestionIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col justify-center gap-12"
          >
            {/* Question card */}
            <QuestionCard
              question={currentQuestion}
              questionNumber={state.currentQuestionIndex + 1}
            />

            {/* Answer grid */}
            <AnswerGrid
              options={currentQuestion.options}
              selectedOption={state.selectedOption}
              correctAnswer={currentQuestion.correctAnswer}
              phase={state.phase}
              onSelect={selectAnswer}
              onLockIn={onLockIn}
              explanation={currentQuestion.explanation}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Quit confirmation dialog */}
      <ConfirmDialog
        isOpen={showQuitDialog}
        onConfirm={handleQuitConfirm}
        onCancel={handleQuitCancel}
        title="Quit Game?"
        message="Are you sure you want to quit? Your progress will be lost."
        confirmText="Quit"
        cancelText="Continue Playing"
      />
    </div>
  );
}

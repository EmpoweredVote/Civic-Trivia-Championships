import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyPress } from '../hooks/useKeyPress';
import { GameTimer } from './GameTimer';
import { ProgressDots } from './ProgressDots';
import { QuestionCard } from './QuestionCard';
import { AnswerGrid } from './AnswerGrid';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { ScoreDisplay } from './ScoreDisplay';
import { ScorePopup } from './ScorePopup';
import { LearnMoreButton } from './LearnMoreButton';
import { LearnMoreTooltip } from './LearnMoreTooltip';
import { LearnMoreModal } from './LearnMoreModal';
import type { GameState, Question, LearningContent } from '../../../types/game';

const QUESTION_DURATION = 25; // seconds
const QUESTION_PREVIEW_MS = 2000; // show question before revealing options

interface GameScreenProps {
  state: GameState;
  currentQuestion: Question | null;
  startGame: () => Promise<void>;
  selectAnswer: (optionIndex: number) => void;
  lockAnswer: (timeRemaining: number) => void;
  handleTimeout: () => void;
  quitGame: () => void;
  pauseAutoAdvance: () => void;
  resumeAutoAdvance: () => void;
  hasShownTooltip: boolean;
  setHasShownTooltip: (value: boolean) => void;
}

export function GameScreen({
  state,
  currentQuestion,
  startGame,
  selectAnswer,
  lockAnswer,
  handleTimeout,
  quitGame,
  pauseAutoAdvance,
  resumeAutoAdvance,
  hasShownTooltip,
  setHasShownTooltip,
}: GameScreenProps) {

  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [showTimeoutFlash, setShowTimeoutFlash] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [currentTimeRemaining, setCurrentTimeRemaining] = useState(QUESTION_DURATION);
  const [shouldShake, setShouldShake] = useState(false);
  const [showRedFlash, setShowRedFlash] = useState(false);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine if current question has learning content
  const learningContent = currentQuestion?.learningContent ?? null;
  const latestAnswer = state.answers.length > 0 ? state.answers[state.answers.length - 1] : null;

  // Tooltip auto-show logic: show once per session when first reveal happens
  useEffect(() => {
    if (state.phase === 'revealing' && learningContent && !hasShownTooltip) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
        setHasShownTooltip(true);
      }, 1000); // Delay to let reveal settle
      return () => clearTimeout(timer);
    }
  }, [state.phase, learningContent, hasShownTooltip, setHasShownTooltip]);

  // Handle opening Learn More modal
  const handleOpenLearnMore = () => {
    setShowTooltip(false);
    setIsLearnMoreOpen(true);
    pauseAutoAdvance();
  };

  // Handle closing Learn More modal
  const handleCloseLearnMore = () => {
    setIsLearnMoreOpen(false);
    resumeAutoAdvance();
  };

  // Extract teaser text (first sentence of first paragraph)
  const getTeaserText = (content: LearningContent): string => {
    const firstParagraph = content.paragraphs[0] || '';
    const sentences = firstParagraph.split('. ');
    return sentences[0] + (sentences.length > 1 ? '...' : '');
  };

  // Question preview: show question text for 2s, then reveal options and start timer
  useEffect(() => {
    if (state.phase === 'answering' && !showOptions) {
      const timer = setTimeout(() => {
        setShowOptions(true);
        setTimerKey((prev) => prev + 1);
      }, QUESTION_PREVIEW_MS);
      return () => clearTimeout(timer);
    }
  }, [state.currentQuestionIndex, state.phase, showOptions]);

  // Reset showOptions when moving to a new question
  useEffect(() => {
    if (state.phase === 'answering') {
      setShowOptions(false);
    }
  }, [state.currentQuestionIndex]);

  // Handle score animations and feedback on reveal phase
  useEffect(() => {
    if (state.phase === 'revealing' && state.answers.length > 0) {
      const latestAnswer = state.answers[state.answers.length - 1];

      // Check if it's a wrong answer (not timeout)
      if (!latestAnswer.correct && latestAnswer.selectedOption !== null) {
        setShouldShake(true);
        setShowRedFlash(true);
        setTimeout(() => {
          setShouldShake(false);
          setShowRedFlash(false);
        }, 500);
      } else {
        // Correct answer or timeout - show score popup
        setShowScorePopup(true);
      }
    } else {
      setShowScorePopup(false);
    }
  }, [state.phase, state.answers.length]);

  // Keyboard shortcuts for answer selection (only when options visible)
  const canUseKeyboard = (state.phase === 'answering' || state.phase === 'selected') && showOptions;
  useKeyPress('a', () => selectAnswer(0), canUseKeyboard);
  useKeyPress('b', () => selectAnswer(1), canUseKeyboard);
  useKeyPress('c', () => selectAnswer(2), canUseKeyboard);
  useKeyPress('d', () => selectAnswer(3), canUseKeyboard);

  // Keyboard shortcut for Learn More (only during reveal when content exists)
  const canOpenLearnMore = state.phase === 'revealing' && !!learningContent && !isLearnMoreOpen;
  useKeyPress('l', handleOpenLearnMore, canOpenLearnMore);

  // Handle timeout with flash message
  const onTimeout = () => {
    setShowTimeoutFlash(true);
    setTimeout(() => {
      setShowTimeoutFlash(false);
      handleTimeout();
    }, 1000);
  };

  // Handle lock in with actual time remaining
  const onLockIn = () => {
    lockAnswer(currentTimeRemaining);
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

          {/* Score display */}
          <ScoreDisplay
            score={state.totalScore}
            shouldShake={shouldShake}
            showRedFlash={showRedFlash}
          />

          {/* Timer - paused during question preview */}
          <GameTimer
            key={timerKey}
            duration={QUESTION_DURATION}
            onTimeout={onTimeout}
            onTimeUpdate={setCurrentTimeRemaining}
            isPaused={state.isTimerPaused || !showOptions}
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

        {/* Score popup during reveal phase */}
        {showScorePopup && state.answers.length > 0 && (() => {
          const latestAnswer = state.answers[state.answers.length - 1];
          return (
            <ScorePopup
              basePoints={latestAnswer.basePoints}
              speedBonus={latestAnswer.speedBonus}
              isCorrect={latestAnswer.correct}
              isTimeout={latestAnswer.selectedOption === null}
              onComplete={() => setShowScorePopup(false)}
            />
          );
        })()}

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

            {/* Answer grid - revealed after question preview */}
            <AnimatePresence>
              {(showOptions || state.phase === 'selected' || state.phase === 'locked' || state.phase === 'revealing') && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <AnswerGrid
                    options={currentQuestion.options}
                    selectedOption={state.selectedOption}
                    correctAnswer={
                      state.phase === 'revealing' && state.answers.length > 0
                        ? state.answers[state.answers.length - 1].correctAnswer
                        : 0
                    }
                    phase={state.phase}
                    onSelect={selectAnswer}
                    onLockIn={onLockIn}
                    explanation={currentQuestion.explanation}
                  />

                  {/* Learn More button and tooltip - shown during reveal when content exists */}
                  {state.phase === 'revealing' && learningContent && (
                    <div className="relative flex justify-end mt-6 max-w-5xl mx-auto">
                      <div className="relative">
                        <LearnMoreButton
                          onOpenModal={handleOpenLearnMore}
                          hasContent={!!learningContent}
                        />
                        <LearnMoreTooltip
                          teaserText={getTeaserText(learningContent)}
                          show={showTooltip}
                          onDismiss={() => setShowTooltip(false)}
                          onReadMore={handleOpenLearnMore}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Learn More modal - rendered outside main content */}
      {learningContent && latestAnswer && (
        <LearnMoreModal
          isOpen={isLearnMoreOpen}
          onClose={handleCloseLearnMore}
          content={learningContent}
          userAnswer={latestAnswer.selectedOption}
          correctAnswer={latestAnswer.correctAnswer}
        />
      )}

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

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
import { FinalQuestionAnnouncement } from './FinalQuestionAnnouncement';
import { WagerScreen } from './WagerScreen';
import { PauseOverlay } from './PauseOverlay';
import { CelebrationEffects } from '../../../components/animations/CelebrationEffects';
import { DegradedBanner } from '../../../components/DegradedBanner';
import { useAuthStore } from '../../../store/authStore';
import { useConfettiStore } from '../../../store/confettiStore';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { announce } from '../../../utils/announce';
import type { GameState, Question, LearningContent } from '../../../types/game';

const QUESTION_DURATION = 25; // seconds
const FINAL_QUESTION_DURATION = 50; // seconds for Q10
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
  setWagerAmount: (amount: number) => void;
  lockWager: () => void;
  isFinalQuestion: boolean;
  pauseGame: () => void;
  resumeGame: () => void;
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
  setWagerAmount,
  lockWager,
  isFinalQuestion,
  pauseGame,
  resumeGame,
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

  // Get timer multiplier from auth store (defaults to 1.0)
  const timerMultiplier = useAuthStore((s) => s.timerMultiplier);

  // Confetti store for celebrations
  const { fireSmallBurst, fireMediumBurst } = useConfettiStore();
  const reducedMotion = useReducedMotion();

  // Calculate adjusted durations based on multiplier
  const questionDuration = Math.round(QUESTION_DURATION * timerMultiplier);
  const finalQuestionDuration = Math.round(FINAL_QUESTION_DURATION * timerMultiplier);

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

  // Reset timer when entering answering phase for final question
  useEffect(() => {
    if (state.phase === 'answering' && isFinalQuestion) {
      setTimerKey((prev) => prev + 1);
    }
  }, [state.phase, isFinalQuestion]);

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

  // Global number key handler for answer selection (when AnswerGrid doesn't have focus)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const canUseKeyboard = (state.phase === 'answering' || state.phase === 'selected') && showOptions;
      if (!canUseKeyboard) return;

      if (e.key >= '1' && e.key <= '4') {
        const index = parseInt(e.key) - 1;
        selectAnswer(index);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [state.phase, showOptions, selectAnswer]);

  // Escape key handler for pause overlay
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only pause during answering or selected phases (not during reveal, wager, or already paused)
        if ((state.phase === 'answering' || state.phase === 'selected') && !state.isPaused) {
          pauseGame();
          announce.polite('Game paused');
        }
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [state.phase, state.isPaused, pauseGame]);

  // Timer threshold announcements for screen readers
  useEffect(() => {
    if (state.phase !== 'answering' && state.phase !== 'selected') return;

    if (currentTimeRemaining === 10) {
      announce.polite('10 seconds remaining');
    } else if (currentTimeRemaining === 5) {
      announce.polite('5 seconds remaining');
    }
  }, [currentTimeRemaining, state.phase]);

  // Streak celebrations - fire confetti on milestones
  useEffect(() => {
    if (reducedMotion) return;

    if (state.currentStreak === 3) {
      fireSmallBurst();
    } else if (state.currentStreak === 5) {
      fireMediumBurst();
      announce.polite('On Fire! 5 in a row!');
    } else if (state.currentStreak >= 7) {
      fireMediumBurst();
      if (state.currentStreak === 7) {
        announce.polite('Unstoppable! 7 in a row!');
      }
    }
  }, [state.currentStreak, reducedMotion, fireSmallBurst, fireMediumBurst]);

  // Question number announcements for screen readers
  useEffect(() => {
    if (state.phase === 'answering' && showOptions) {
      if (state.currentQuestionIndex === 0) {
        announce.polite('Question 1 of 10');
      } else if (isFinalQuestion) {
        announce.assertive('Final Question');
      }
    }
  }, [state.phase, state.currentQuestionIndex, isFinalQuestion, showOptions]);

  // Answer reveal announcements for screen readers
  useEffect(() => {
    if (state.phase === 'revealing' && state.answers.length > 0) {
      const latestAnswer = state.answers[state.answers.length - 1];
      const question = state.questions[state.currentQuestionIndex];
      if (!question) return;

      const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
      const correctLetter = OPTION_LETTERS[latestAnswer.correctAnswer];
      const correctText = question.options[latestAnswer.correctAnswer];

      let message = '';
      if (latestAnswer.correct) {
        message = `Correct! The answer is ${correctLetter}, ${correctText}. You earned ${latestAnswer.totalPoints} points.`;
      } else if (latestAnswer.selectedOption !== null) {
        message = `Not quite. The correct answer was ${correctLetter}, ${correctText}.`;
      } else {
        message = `Time's up. The correct answer was ${correctLetter}, ${correctText}.`;
      }

      announce.polite(message);
    }
  }, [state.phase, state.answers.length]);

  // Keyboard shortcut for Learn More (only during reveal when content exists)
  const canOpenLearnMore = state.phase === 'revealing' && !!learningContent && !isLearnMoreOpen;
  useKeyPress('l', handleOpenLearnMore, canOpenLearnMore);

  // Handle timeout with flash message
  const onTimeout = () => {
    setShowTimeoutFlash(true);
    announce.assertive("Time's up");
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

  // Final announcement phase - show dramatic "FINAL QUESTION" screen
  if (state.phase === 'final-announcement') {
    return <FinalQuestionAnnouncement show={true} />;
  }

  // Wagering phases - show wager input screen
  if (state.phase === 'wagering' || state.phase === 'wager-locked') {
    return (
      <WagerScreen
        currentScore={state.totalScore}
        category={state.wagerCategory || 'General'}
        wagerAmount={state.wagerAmount}
        onSetWager={setWagerAmount}
        onLockWager={lockWager}
        isLocked={state.phase === 'wager-locked'}
      />
    );
  }

  // Main game screen
  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-x-hidden">
      {/* Degraded mode banner - shown only when backend is in fallback mode */}
      <DegradedBanner visible={state.degraded} />

      {/* Radial gradient bloom effect */}
      <div className="absolute inset-0 bg-gradient-radial from-teal-900/10 via-transparent to-transparent opacity-30" />

      {/* Celebration effects for streaks */}
      <CelebrationEffects streak={state.currentStreak} />

      {/* Main content container */}
      <div className="relative min-h-screen flex flex-col py-8 px-4">
        {/* Top HUD - Quit button, Progress, Timer */}
        <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto w-full">
          {/* Quit button */}
          <button
            onClick={handleQuitClick}
            className="min-w-[48px] min-h-[48px] text-slate-400 hover:text-white transition-colors p-2 flex items-center justify-center"
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

          {/* Timer - paused during question preview, extended for final question */}
          <GameTimer
            key={timerKey}
            duration={isFinalQuestion ? finalQuestionDuration : questionDuration}
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
              <div className="bg-red-600 text-white text-3xl font-bold px-12 py-6 rounded-lg shadow-2xl flex items-center gap-3">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Time's up!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Score popup during reveal phase - disabled for final question (wager-only scoring) */}
        {showScorePopup && !isFinalQuestion && state.answers.length > 0 && (() => {
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
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: reducedMotion ? 0 : 0.3 }}
            className="flex-1 flex flex-col justify-start pt-[10vh] gap-12"
          >
            {/* Final question badge */}
            {isFinalQuestion && (
              <div className="flex justify-center">
                <div className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-3 py-1 rounded-full text-sm font-bold">
                  FINAL QUESTION
                </div>
              </div>
            )}

            {/* Question card - with amber glow for final question */}
            <div className={isFinalQuestion ? 'border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)] rounded-xl p-1' : ''}>
              <QuestionCard
                question={currentQuestion}
                questionNumber={state.currentQuestionIndex + 1}
              />
            </div>

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

      {/* Pause overlay */}
      {state.isPaused && (
        <PauseOverlay
          onResume={() => {
            resumeGame();
            announce.polite('Game resumed');
          }}
          onQuit={quitGame}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKeyPress } from '../hooks/useKeyPress';
import { GameTimer } from './GameTimer';
import { ProgressDots } from './ProgressDots';
import { QuestionCard } from './QuestionCard';
import { AnswerGrid } from './AnswerGrid';
import { ScoreDisplay } from './ScoreDisplay';
import { ScorePopup } from './ScorePopup';
import { LearnMoreButton } from './LearnMoreButton';
import { LearnMoreTooltip } from './LearnMoreTooltip';
import { LearnMoreModal } from './LearnMoreModal';
import { FinalQuestionAnnouncement } from './FinalQuestionAnnouncement';
import { WagerScreen } from './WagerScreen';
import { PauseOverlay } from './PauseOverlay';
import { FlagButton } from './FlagButton';
import { CelebrationEffects } from '../../../components/animations/CelebrationEffects';
import { DegradedBanner } from '../../../components/DegradedBanner';
import { useAuthStore } from '../../../store/authStore';
import { useConfettiStore } from '../../../store/confettiStore';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { announce } from '../../../utils/announce';
import type { GameState, Question, LearningContent } from '../../../types/game';

const QUESTION_DURATION = 20; // seconds
const FINAL_QUESTION_DURATION = 50; // seconds for final question
const QUESTION_PREVIEW_MS = 1000; // show question before revealing options

interface GameScreenProps {
  state: GameState;
  currentQuestion: Question | null;
  startGame: () => Promise<void>;
  selectAnswer: (optionIndex: number, timeRemaining?: number) => void;
  lockAnswer: (timeRemaining: number) => void;
  handleTimeout: () => void;
  quitGame: () => void;
  nextQuestion: () => void;
  hasShownTooltip: boolean;
  setHasShownTooltip: (value: boolean) => void;
  setWagerAmount: (amount: number) => void;
  lockWager: () => void;
  isFinalQuestion: boolean;
  pauseGame: () => void;
  resumeGame: () => void;
  flaggedQuestions: Set<string>;
  isRateLimited: boolean;
  onFlagToggle: (questionId: string) => void;
}

export function GameScreen({
  state,
  currentQuestion,
  startGame,
  selectAnswer,
  lockAnswer,
  handleTimeout,
  quitGame,
  nextQuestion,
  hasShownTooltip,
  setHasShownTooltip,
  setWagerAmount,
  lockWager,
  isFinalQuestion,
  pauseGame,
  resumeGame,
  flaggedQuestions,
  isRateLimited,
  onFlagToggle,
}: GameScreenProps) {

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

  // Check if user is authenticated for flag button visibility
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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
  };

  // Handle closing Learn More modal
  const handleCloseLearnMore = () => {
    setIsLearnMoreOpen(false);
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
      const canUseKeyboard = state.phase === 'answering' && showOptions;
      if (!canUseKeyboard) return;

      if (e.key >= '1' && e.key <= '4') {
        const index = parseInt(e.key) - 1;
        selectAnswer(index, currentTimeRemaining);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [state.phase, showOptions, selectAnswer, currentTimeRemaining]);

  // Escape key handler for pause overlay
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only pause during answering or selected phases (not during reveal, wager, or already paused)
        if ((state.phase === 'answering' || (state.phase === 'selected' && state.currentQuestionIndex === state.questions.length - 1)) && !state.isPaused) {
          pauseGame();
          announce.polite('Game paused');
        }
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [state.phase, state.isPaused, pauseGame]);

  // Space/Enter to advance during reveal phase
  useEffect(() => {
    if (state.phase !== 'revealing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if Learn More modal is open
      if (isLearnMoreOpen) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        nextQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.phase, isLearnMoreOpen, nextQuestion]);

  // Timer threshold announcements for screen readers
  useEffect(() => {
    if (state.phase !== 'answering' && !(state.phase === 'selected' && state.currentQuestionIndex === state.questions.length - 1)) return;

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
        announce.polite(`Question 1 of ${state.questions.length}`);
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
        message = `Correct! The answer is ${correctLetter}, ${correctText}. You earned ${latestAnswer.totalPoints} points. Press Space or tap Next to continue.`;
      } else if (latestAnswer.selectedOption !== null) {
        message = `Not quite. The correct answer was ${correctLetter}, ${correctText}. Press Space or tap Next to continue.`;
      } else {
        message = `Time's up. The correct answer was ${correctLetter}, ${correctText}. Press Space or tap Next to continue.`;
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
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-x-hidden"
      onClick={() => {
        if (state.phase === 'revealing' && !isLearnMoreOpen) {
          nextQuestion();
        }
      }}
    >
      {/* Degraded mode banner - shown only when backend is in fallback mode */}
      <DegradedBanner visible={state.degraded} />

      {/* Radial gradient bloom effect */}
      <div className="absolute inset-0 bg-gradient-radial from-teal-900/10 via-transparent to-transparent opacity-30" />

      {/* Celebration effects for streaks */}
      <CelebrationEffects streak={state.currentStreak} />

      {/* Main content container */}
      <div className="relative min-h-screen flex flex-col py-4 md:py-8 px-4">
        {/* Top HUD - Score, Timer, Collection name, Progress dots */}
        <div className="flex flex-col items-center mb-[70px] md:mb-[120px] max-w-5xl mx-auto w-full">
          {/* Controls row - three equal columns for true centering */}
          <div className="grid grid-cols-3 items-center w-full">
            {/* Score display (left) */}
            <div className="justify-self-start">
              <ScoreDisplay
                score={state.totalScore}
                shouldShake={shouldShake}
                showRedFlash={showRedFlash}
                compact={true}
              />
            </div>

            {/* Timer (center - grid guarantees true center, min-h reserves space) */}
            <div className="flex items-center justify-center min-h-[80px]">
              {(showOptions || state.phase === 'locked' || state.phase === 'revealing' || (state.phase === 'selected' && state.currentQuestionIndex === state.questions.length - 1)) && (
                <GameTimer
                  key={timerKey}
                  duration={isFinalQuestion ? finalQuestionDuration : questionDuration}
                  onTimeout={onTimeout}
                  onTimeUpdate={setCurrentTimeRemaining}
                  isPaused={state.isTimerPaused || !showOptions}
                  size={80}
                />
              )}
            </div>

            {/* Collection name + Progress dots + question counter (right) */}
            <div className="flex flex-col items-end gap-0.5 justify-self-end">
              {state.collectionName && (
                <div className="text-xs text-slate-500 font-medium tracking-wide uppercase truncate max-w-[160px]">
                  {state.collectionName}
                </div>
              )}
              <div className="hidden md:block">
                <ProgressDots
                  currentIndex={state.currentQuestionIndex}
                  total={state.questions.length}
                />
              </div>
              <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">
                Q{state.currentQuestionIndex + 1} of {state.questions.length}
              </span>
            </div>
          </div>
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
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="flex-1 flex flex-col items-center pt-0 md:pt-2 gap-3 md:gap-8 max-w-[700px] mx-auto w-full px-4"
          >
            {/* Final question badge */}
            {isFinalQuestion && (
              <div className="flex justify-center">
                <div className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-3 py-1 rounded-full text-sm font-bold">
                  FINAL QUESTION
                </div>
              </div>
            )}

            {/* Question card - with amber glow for final question and flag button during reveal */}
            <div className={`relative ${isFinalQuestion ? 'border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)] rounded-xl p-1' : ''}`}>
              <QuestionCard
                question={currentQuestion}
                questionNumber={state.currentQuestionIndex + 1}
                totalQuestions={state.questions.length}
              />

              {/* Flag button - shown during reveal phase for authenticated users only */}
              {state.phase === 'revealing' && isAuthenticated && currentQuestion && (
                <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                  <FlagButton
                    flagged={flaggedQuestions.has(currentQuestion.id)}
                    disabled={isRateLimited}
                    onToggle={() => onFlagToggle(currentQuestion.id)}
                  />
                </div>
              )}
            </div>

            {/* Answer grid - revealed after question preview */}
            <AnimatePresence>
              {(showOptions || state.phase === 'locked' || state.phase === 'revealing' || (state.phase === 'selected' && state.currentQuestionIndex === state.questions.length - 1)) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="w-full pt-[20px] pb-[40px]"
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
                    onSelect={(index) => selectAnswer(index, currentTimeRemaining)}
                    onLockIn={onLockIn}
                    explanation={currentQuestion.explanation}
                  />

                  {/* Learn More button and tooltip - shown during reveal below answers */}
                  {state.phase === 'revealing' && learningContent && (
                    <div className="relative flex justify-center mt-4" onClick={(e) => e.stopPropagation()}>
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

                  {/* Next Question button - pauses until user taps */}
                  {state.phase === 'revealing' && (
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.3 }}
                        onClick={nextQuestion}
                        className="mt-6 mb-4 px-8 py-3 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-lg font-semibold rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 min-h-[48px]"
                        aria-label="Next question"
                      >
                        {state.currentQuestionIndex < state.questions.length - 1 ? 'Next Question' : 'See Results'}
                      </motion.button>
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
        <div onClick={(e) => e.stopPropagation()}>
        <LearnMoreModal
          isOpen={isLearnMoreOpen}
          onClose={handleCloseLearnMore}
          content={learningContent}
          userAnswer={latestAnswer.selectedOption}
          correctAnswer={latestAnswer.correctAnswer}
        />
        </div>
      )}

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

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import type { GameResult, Question, LearningContent } from '../../../types/game';
import { TOPIC_ICONS, TOPIC_LABELS } from './TopicIcon';
import { LearnMoreModal } from './LearnMoreModal';

interface ResultsScreenProps {
  result: GameResult;
  questions: Question[];
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultsScreen({ result, questions, onPlayAgain, onHome }: ResultsScreenProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [learnMoreQuestion, setLearnMoreQuestion] = useState<{ content: LearningContent; userAnswer: number | null; correctAnswer: number } | null>(null);
  const motionScore = useMotionValue(0);

  const accuracy = Math.round((result.totalCorrect / result.totalQuestions) * 100);
  const isPerfectGame = result.totalCorrect === result.totalQuestions;

  // Animate total score with spring physics
  useEffect(() => {
    const controls = animate(motionScore, result.totalScore, {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      mass: 0.5,
      duration: 1.5,
    });

    return () => controls.stop();
  }, [result.totalScore, motionScore]);

  // Subscribe to motion value for display
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const unsubscribe = motionScore.on('change', (latest) => {
      setDisplayScore(Math.round(latest));
    });
    return unsubscribe;
  }, [motionScore]);

  const toggleQuestion = (index: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQuestions(newExpanded);
  };

  const handleOpenLearnMore = (questionIndex: number) => {
    const question = questions[questionIndex];
    const answer = result.answers[questionIndex];
    if (question.learningContent) {
      setLearnMoreQuestion({
        content: question.learningContent,
        userAnswer: answer.selectedOption,
        correctAnswer: answer.correctAnswer,
      });
    }
  };

  const handleCloseLearnMore = () => {
    setLearnMoreQuestion(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Score display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-6">Game Complete!</h1>

          {/* Primary score display with perfect game treatment */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="mb-4"
          >
            <motion.div
              animate={isPerfectGame ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.5, repeat: 2, delay: 0.5 }}
              className={`text-7xl font-bold mb-2 ${
                isPerfectGame ? 'text-yellow-400' : 'text-teal-400'
              }`}
              style={
                isPerfectGame
                  ? {
                      textShadow:
                        '0 0 30px rgba(250, 204, 21, 0.5), 0 0 60px rgba(250, 204, 21, 0.3)',
                    }
                  : {}
              }
            >
              {displayScore.toLocaleString()}
            </motion.div>
            <div className="text-slate-400 text-xl">Total Points</div>

            {/* Perfect game label */}
            {isPerfectGame && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="mt-3 text-2xl font-bold text-yellow-400"
              >
                ⭐ Perfect Game! ⭐
              </motion.div>
            )}
          </motion.div>

          {/* Score breakdown: base + speed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="text-slate-300 text-lg mb-8"
          >
            {result.totalBasePoints.toLocaleString()} base +{' '}
            {result.totalSpeedBonus.toLocaleString()} speed
          </motion.div>

          {/* Accuracy display */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            className="flex items-center justify-center gap-8 mb-8"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {result.totalCorrect}/{result.totalQuestions}
              </div>
              <div className="text-slate-400 text-sm mt-1">Correct</div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-white">{accuracy}%</div>
              <div className="text-slate-400 text-sm mt-1">Accuracy</div>
            </div>
          </motion.div>

          {/* Fastest answer callout */}
          {result.fastestAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="mb-8"
            >
              <div className="inline-block bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/50 rounded-lg px-6 py-3">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-teal-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-white font-bold">
                      Fastest: Q{result.fastestAnswer.questionIndex + 1} (
                      {result.fastestAnswer.responseTime.toFixed(1)}s)
                    </div>
                    <div className="text-teal-300 text-sm">
                      +{result.fastestAnswer.points} pts
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Review answers button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            onClick={() => {
              // Toggle all or clear all
              if (expandedQuestions.size > 0) {
                setExpandedQuestions(new Set());
              } else {
                setExpandedQuestions(new Set(questions.map((_, i) => i)));
              }
            }}
            className="text-teal-400 hover:text-teal-300 transition-colors mb-8 flex items-center gap-2 mx-auto"
          >
            <span>{expandedQuestions.size > 0 ? 'Collapse' : 'Expand'} All Answers</span>
            <svg
              className={`w-5 h-5 transition-transform ${
                expandedQuestions.size > 0 ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </motion.button>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="flex items-center justify-center gap-4 mb-8"
          >
            <button
              onClick={onPlayAgain}
              className="px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white text-lg font-bold rounded-lg shadow-lg transition-colors min-h-[48px]"
            >
              Play Again
            </button>
            <button
              onClick={onHome}
              className="px-8 py-4 bg-transparent border-2 border-slate-600 hover:border-slate-500 text-white text-lg font-bold rounded-lg transition-colors min-h-[48px]"
            >
              Home
            </button>
          </motion.div>
        </motion.div>

        {/* Question review section - individual accordions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <div className="bg-slate-800/50 rounded-lg p-6 max-h-[500px] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Answer Review</h2>
            <div className="space-y-4">
              {questions.map((question, index) => {
                const answer = result.answers[index];
                const isCorrect = answer.correct;
                const timedOut = answer.selectedOption === null;
                const isExpanded = expandedQuestions.has(index);

                return (
                  <div
                    key={question.id}
                    className="border border-slate-700 rounded-lg overflow-hidden"
                  >
                    {/* Collapsed view - question + points badge */}
                    <button
                      onClick={() => toggleQuestion(index)}
                      className="w-full text-left p-4 hover:bg-slate-700/30 transition-colors flex items-start justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-teal-400 font-bold text-sm">
                            Question {index + 1}
                          </span>
                          {question.topicCategory && (() => {
                            const TopicIconComponent = TOPIC_ICONS[question.topicCategory];
                            return (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
                                <TopicIconComponent className="w-4 h-4" />
                                {TOPIC_LABELS[question.topicCategory]}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-white text-base mt-1">{question.text}</p>
                      </div>

                      {/* Points badge */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div
                            className={`text-xl font-bold ${
                              isCorrect
                                ? 'text-teal-400'
                                : timedOut
                                ? 'text-amber-500'
                                : 'text-slate-500'
                            }`}
                          >
                            +{answer.totalPoints}
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-slate-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded view - details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-2 border-t border-slate-700 bg-slate-900/30">
                            {/* Score breakdown */}
                            <div className="mb-4 flex items-center gap-4 text-sm">
                              {isCorrect ? (
                                <>
                                  <span className="text-slate-400">
                                    Base: <span className="text-white">+{answer.basePoints}</span>
                                  </span>
                                  <span className="text-slate-600">|</span>
                                  <span className="text-slate-400">
                                    Speed:{' '}
                                    <span className="text-teal-400">+{answer.speedBonus}</span>
                                  </span>
                                  <span className="text-slate-600">|</span>
                                  <span className="text-slate-400">
                                    Time: <span className="text-white">{answer.responseTime.toFixed(1)}s</span>
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-500">No points awarded</span>
                              )}
                            </div>

                            {/* Player's answer */}
                            <div className="mb-2">
                              <span className="text-slate-400 text-sm">Your answer:</span>
                              {timedOut ? (
                                <div className="text-amber-500 font-medium mt-1">
                                  No answer (timed out)
                                </div>
                              ) : (
                                <div
                                  className={`font-medium mt-1 ${
                                    isCorrect ? 'text-green-400' : 'text-red-400'
                                  }`}
                                >
                                  {question.options[answer.selectedOption!]}
                                </div>
                              )}
                            </div>

                            {/* Correct answer (shown if incorrect) */}
                            {!isCorrect && (
                              <div className="mb-2">
                                <span className="text-slate-400 text-sm">Correct answer:</span>
                                <div className="text-green-400 font-medium mt-1">
                                  {question.options[answer.correctAnswer]}
                                </div>
                              </div>
                            )}

                            {/* Explanation */}
                            <div className="mt-3 text-slate-300 text-sm bg-slate-900/50 p-3 rounded">
                              {question.explanation}
                            </div>

                            {/* Learn More button (only if learningContent exists) */}
                            {question.learningContent && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenLearnMore(index);
                                }}
                                className="mt-3 text-teal-400 hover:text-teal-300 text-sm font-medium flex items-center gap-1 transition-colors"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                  />
                                </svg>
                                Learn More
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* LearnMoreModal - rendered outside scrollable area */}
        <LearnMoreModal
          isOpen={learnMoreQuestion !== null}
          onClose={handleCloseLearnMore}
          content={learnMoreQuestion?.content ?? { topic: 'voting', paragraphs: [], corrections: {}, source: { name: '', url: '' } }}
          userAnswer={learnMoreQuestion?.userAnswer ?? null}
          correctAnswer={learnMoreQuestion?.correctAnswer ?? 0}
        />
      </div>
    </div>
  );
}

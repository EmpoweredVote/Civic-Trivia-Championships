import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameResult, Question } from '../../../types/game';

interface ResultsScreenProps {
  result: GameResult;
  questions: Question[];
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultsScreen({ result, questions, onPlayAgain, onHome }: ResultsScreenProps) {
  const [showReview, setShowReview] = useState(false);

  const accuracy = Math.round((result.totalCorrect / result.totalQuestions) * 100);

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

          {/* Primary score display */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="mb-8"
          >
            <div className="text-7xl font-bold text-teal-400 mb-2">
              {result.totalScore}
            </div>
            <div className="text-slate-400 text-xl">Total Points</div>
          </motion.div>

          {/* Score breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex items-center justify-center gap-8 mb-8"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {result.totalCorrect}/{result.totalQuestions}
              </div>
              <div className="text-slate-400 text-sm mt-1">Correct</div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {accuracy}%
              </div>
              <div className="text-slate-400 text-sm mt-1">Accuracy</div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">
                {result.totalBasePoints}
              </div>
              <div className="text-slate-400 text-sm mt-1">Base Points</div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">
                +{result.totalSpeedBonus}
              </div>
              <div className="text-slate-400 text-sm mt-1">Speed Bonus</div>
            </div>
          </motion.div>

          {/* Fastest answer badge */}
          {result.fastestAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="mb-8"
            >
              <div className="inline-block bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg px-6 py-3">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div>
                    <div className="text-white font-bold">
                      Fastest Answer: {result.fastestAnswer.responseTime.toFixed(1)}s
                    </div>
                    <div className="text-slate-400 text-sm">
                      Question {result.fastestAnswer.questionIndex + 1} ({result.fastestAnswer.points} pts)
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
            transition={{ delay: 0.3 }}
            onClick={() => setShowReview(!showReview)}
            className="text-teal-400 hover:text-teal-300 transition-colors mb-8 flex items-center gap-2 mx-auto"
          >
            <span>{showReview ? 'Hide' : 'Review'} Answers</span>
            <svg
              className={`w-5 h-5 transition-transform ${showReview ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.button>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="flex items-center justify-center gap-4"
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

        {/* Question review section */}
        <AnimatePresence>
          {showReview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-800/50 rounded-lg p-6 max-h-[500px] overflow-y-auto">
                <h2 className="text-2xl font-bold text-white mb-6">Answer Review</h2>
                <div className="space-y-6">
                  {questions.map((question, index) => {
                    const answer = result.answers[index];
                    const isCorrect = answer.correct;
                    const timedOut = answer.selectedOption === null;

                    return (
                      <div key={question.id} className="border-b border-slate-700 pb-6 last:border-b-0">
                        {/* Question number, text, and score */}
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex-1">
                            <span className="text-teal-400 font-bold">Question {index + 1}</span>
                            <p className="text-white text-lg mt-1">{question.text}</p>
                          </div>
                          <div className="ml-4 text-right flex-shrink-0">
                            <div className={`text-2xl font-bold ${isCorrect ? 'text-teal-400' : 'text-slate-600'}`}>
                              {answer.totalPoints}
                            </div>
                            <div className="text-slate-500 text-xs">
                              {answer.basePoints} + {answer.speedBonus}
                            </div>
                            <div className="text-slate-500 text-xs">
                              {answer.responseTime.toFixed(1)}s
                            </div>
                          </div>
                        </div>

                        {/* Player's answer */}
                        <div className="mb-2">
                          <span className="text-slate-400 text-sm">Your answer:</span>
                          {timedOut ? (
                            <div className="text-red-400 font-medium mt-1">
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
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

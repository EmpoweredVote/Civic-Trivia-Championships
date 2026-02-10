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

          {/* Score and accuracy with equal visual weight */}
          <div className="flex items-center justify-center gap-8 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <div className="text-6xl font-bold text-teal-400">
                {result.totalCorrect}/{result.totalQuestions}
              </div>
              <div className="text-slate-400 text-lg mt-2">Questions Correct</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="text-6xl font-bold text-white"
            >
              {accuracy}%
            </motion.div>
          </div>

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
                        {/* Question number and text */}
                        <div className="mb-4">
                          <span className="text-teal-400 font-bold">Question {index + 1}</span>
                          <p className="text-white text-lg mt-1">{question.text}</p>
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

                        {/* Correct answer (always shown) */}
                        {!isCorrect && (
                          <div className="mb-2">
                            <span className="text-slate-400 text-sm">Correct answer:</span>
                            <div className="text-green-400 font-medium mt-1">
                              {question.options[question.correctAnswer]}
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

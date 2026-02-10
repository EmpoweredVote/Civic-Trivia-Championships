import { motion } from 'framer-motion';
import type { GamePhase } from '../../../types/game';

interface AnswerGridProps {
  options: string[];
  selectedOption: number | null;
  correctAnswer: number;
  phase: GamePhase;
  onSelect: (index: number) => void;
  onLockIn: () => void;
  explanation: string;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function AnswerGrid({
  options,
  selectedOption,
  correctAnswer,
  phase,
  onSelect,
  onLockIn,
  explanation,
}: AnswerGridProps) {
  const isAnswering = phase === 'answering' || phase === 'selected';
  const isRevealing = phase === 'revealing';
  const isLocked = phase === 'locked';

  const getOptionStyle = (index: number) => {
    // Revealing phase styling
    if (isRevealing) {
      if (index === correctAnswer) {
        return 'bg-green-600/30 border-green-500 border-2 shadow-lg shadow-green-500/50';
      }
      if (index === selectedOption && index !== correctAnswer) {
        return 'bg-red-600/30 border-red-500 border-2';
      }
      // Other wrong options
      return 'bg-slate-800/30 border-slate-700 opacity-30';
    }

    // Selected option during answering/selected phase
    if (selectedOption === index && (phase === 'selected' || isLocked)) {
      return 'bg-teal-600/40 border-teal-500 border-2 shadow-lg shadow-teal-500/30';
    }

    // Default state
    return 'bg-slate-800 border-slate-600 hover:border-teal-500 hover:bg-slate-700';
  };

  const getOptionScale = (index: number) => {
    if (isRevealing && index === correctAnswer) {
      return 1.05;
    }
    return 1;
  };

  const canSelect = isAnswering && !isLocked;

  return (
    <div className="w-full max-w-3xl mx-auto px-6">
      {/* Answer grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {options.map((option, index) => (
          <motion.button
            key={index}
            onClick={() => canSelect && onSelect(index)}
            disabled={!canSelect}
            animate={{
              scale: getOptionScale(index),
              opacity: isRevealing && index !== correctAnswer && index !== selectedOption ? 0.3 : 1,
            }}
            transition={{ duration: 0.5 }}
            className={`
              relative p-4 rounded-lg border-2 transition-all duration-300
              flex items-center gap-4 text-left
              disabled:cursor-not-allowed
              ${canSelect ? 'cursor-pointer' : 'cursor-default'}
              ${getOptionStyle(index)}
            `}
          >
            {/* Letter label */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900/50 border border-slate-600 flex items-center justify-center text-white font-bold text-lg">
              {OPTION_LETTERS[index]}
            </div>

            {/* Option text */}
            <div className="text-white text-lg font-medium flex-1">
              {option}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Lock In button (shown in 'selected' phase) */}
      {phase === 'selected' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-6"
        >
          <button
            onClick={onLockIn}
            className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg rounded-lg shadow-lg transition-colors"
          >
            Lock In
          </button>
        </motion.div>
      )}

      {/* Revealing phase - explanation and feedback */}
      {isRevealing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          {/* Feedback message */}
          {selectedOption !== null && selectedOption !== correctAnswer && (
            <div className="text-yellow-400 text-lg font-medium mb-2">
              Not quite
            </div>
          )}

          {/* Explanation */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
            <div className="text-slate-300 text-base leading-relaxed">
              {explanation}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

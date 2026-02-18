import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
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
  const reducedMotion = useReducedMotion();

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lockInButtonRef = useRef<HTMLButtonElement>(null);

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

    // Default state - bold hover effect
    return 'bg-slate-800 border-slate-500 hover:border-teal-400 hover:bg-slate-700 hover:shadow-lg hover:shadow-teal-400/20 transition-all duration-200';
  };

  const getOptionScale = (index: number) => {
    if (isRevealing && index === correctAnswer) {
      return 1.05;
    }
    return 1;
  };

  const canSelect = isAnswering && !isLocked;

  // Reset focused index when can't select anymore
  useEffect(() => {
    if (!canSelect) {
      setFocusedIndex(null);
    }
  }, [canSelect]);

  // Focus the button when focusedIndex changes
  useEffect(() => {
    if (focusedIndex !== null && buttonRefs.current[focusedIndex]) {
      buttonRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  // Keyboard handler for answer buttons
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!canSelect) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((index + 1) % 4);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((index + 3) % 4);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (phase === 'selected') {
          onLockIn();
        } else if (phase === 'answering') {
          if (selectedOption === null) {
            onSelect(index);
          } else {
            onLockIn();
          }
        }
        break;
      case '1':
      case '2':
      case '3':
      case '4':
        e.preventDefault();
        const selectedIdx = parseInt(e.key) - 1;
        onSelect(selectedIdx);
        setFocusedIndex(selectedIdx);
        break;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-2 md:px-6">
      {/* Answer grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mb-3 md:mb-6">
        {options.map((option, index) => (
          <motion.button
            key={index}
            ref={(el) => (buttonRefs.current[index] = el)}
            onClick={() => canSelect && onSelect(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={!canSelect}
            tabIndex={focusedIndex === index ? 0 : index === 0 && focusedIndex === null ? 0 : -1}
            aria-label={`Option ${OPTION_LETTERS[index]}: ${option}`}
            whileTap={canSelect && !reducedMotion ? { scale: 0.95 } : undefined}
            animate={{
              scale: getOptionScale(index),
              opacity: (() => {
                // During locked phase (suspense): dim non-selected
                if (phase === 'locked' && selectedOption !== null && index !== selectedOption) return 0.3;
                // During reveal: dim non-selected, non-correct
                if (isRevealing && index !== correctAnswer && index !== selectedOption) return 0.3;
                return 1;
              })(),
              ...(phase === 'locked' && selectedOption === index
                ? reducedMotion
                  ? { boxShadow: '0 0 16px rgba(20, 184, 166, 0.6)' }  // Static glow
                  : {
                      boxShadow: [
                        '0 0 8px rgba(20, 184, 166, 0.4)',
                        '0 0 24px rgba(20, 184, 166, 0.8)',
                        '0 0 8px rgba(20, 184, 166, 0.4)',
                      ],
                    }
                : { boxShadow: '0 0 0px rgba(0,0,0,0)' }),
            }}
            transition={{
              scale: { type: 'spring', stiffness: 400, damping: 17 },
              opacity: { duration: 0.3 },
              boxShadow: reducedMotion ? { duration: 0 } : { duration: 0.75, repeat: Infinity, ease: 'easeInOut' },
            }}
            className={`
              relative p-3 md:p-4 rounded-lg border-2 transition-all duration-300
              flex items-center gap-4 text-left min-h-[48px]
              disabled:cursor-not-allowed
              ${canSelect ? 'cursor-pointer' : 'cursor-default'}
              ${getOptionStyle(index)}
            `}
          >
            {/* Letter label */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900/50 border border-slate-500 flex items-center justify-center text-white font-bold text-lg">
              {OPTION_LETTERS[index]}
            </div>

            {/* Option text */}
            <div className="text-white text-lg font-medium flex-1">
              {option}
            </div>

            {/* Status icons - shown during reveal phase */}
            {isRevealing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {index === correctAnswer && (
                  // Checkmark for correct answer
                  <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {index === selectedOption && index !== correctAnswer && (
                  // X icon for incorrect selected answer
                  <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </motion.div>
            )}
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
            ref={lockInButtonRef}
            onClick={onLockIn}
            className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg rounded-lg shadow-lg transition-colors focus-ring-primary"
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

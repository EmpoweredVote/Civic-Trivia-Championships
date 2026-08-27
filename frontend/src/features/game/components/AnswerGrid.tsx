import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useGameTheme } from '../gameTheme';
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
  const { G } = useGameTheme();
  const isAnswering  = phase === 'answering' || phase === 'selected';
  const isRevealing  = phase === 'revealing';
  const isLocked     = phase === 'locked';
  const reducedMotion = useReducedMotion();

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const canSelect = isAnswering && !isLocked;

  useEffect(() => {
    if (!canSelect) setFocusedIndex(null);
  }, [canSelect]);

  useEffect(() => {
    if (focusedIndex !== null && buttonRefs.current[focusedIndex]) {
      buttonRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const getOpacity = (index: number) => {
    if (isRevealing) {
      const isCorrect  = index === correctAnswer;
      const isSelected = selectedOption === index;
      if (!isCorrect && !isSelected) return G.revealDimOpacity;
    }
    if (phase === 'locked' && selectedOption !== null && index !== selectedOption) return 0.3;
    return 1;
  };

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
        if (phase === 'selected') { onLockIn(); }
        else if (phase === 'answering') {
          if (selectedOption === null) onSelect(index);
          else onLockIn();
        }
        break;
      case '1': case '2': case '3': case '4':
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        onSelect(idx);
        setFocusedIndex(idx);
        break;
    }
  };

  const explanationBorderColor = selectedOption === correctAnswer
    ? G.correct
    : selectedOption === null ? G.rule : G.incorrect;

  return (
    <div className="w-full">
      {/* Answer grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {options.map((option, index) => {
          const isSelected    = selectedOption === index;
          const isCorrectOpt  = index === correctAnswer;
          const isHovered     = hoveredIndex === index;

          // Badge
          let badgeBg      = G.badgeBg;
          let badgeColor   = G.badgeText;
          let badgeContent: React.ReactNode = OPTION_LETTERS[index];

          // Button border + bg
          let btnBg     = G.optionBg;
          let btnBorder = G.optionBorder;

          if (isRevealing) {
            if (isCorrectOpt) {
              btnBg = G.correctBg; btnBorder = G.correct;
              badgeBg = G.correct; badgeColor = '#FFFFFF'; badgeContent = '✓';
            } else if (isSelected) {
              btnBg = G.incorrectBg; btnBorder = G.incorrect;
              badgeBg = G.incorrect; badgeColor = '#FFFFFF'; badgeContent = '✗';
            }
          } else if ((phase === 'selected' || isLocked) && isSelected) {
            btnBorder = G.accent;
            badgeBg = G.accentLeft; badgeColor = '#FFFFFF';
          } else if (canSelect && isHovered) {
            btnBg = G.optionHoverBg;
            badgeBg = G.leftDefault; badgeColor = G.leftDefaultText;
          }

          return (
            <motion.button
              key={index}
              ref={el => { buttonRefs.current[index] = el; }}
              onClick={() => canSelect && onSelect(index)}
              onKeyDown={e => handleKeyDown(e, index)}
              onMouseEnter={() => canSelect && setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              disabled={!canSelect}
              tabIndex={focusedIndex === index ? 0 : index === 0 && focusedIndex === null ? 0 : -1}
              aria-label={`Option ${OPTION_LETTERS[index]}: ${option}`}
              whileTap={canSelect && !reducedMotion ? { scale: 0.98 } : undefined}
              animate={{
                opacity: getOpacity(index),
                ...(phase === 'locked' && isSelected
                  ? reducedMotion
                    ? { boxShadow: `0 0 0 2px ${G.accent}` }
                    : { boxShadow: [`0 0 0 1px ${G.accent}40`, `0 0 0 2px ${G.accent}`, `0 0 0 1px ${G.accent}40`] }
                  : { boxShadow: 'none' }),
              }}
              transition={{
                opacity:   { duration: 0.3 },
                boxShadow: reducedMotion ? { duration: 0 } : { duration: 0.7, repeat: 1, ease: 'easeInOut' },
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: 'clamp(10px, 1vw, 16px) clamp(14px, 1.2vw, 20px)',
                background: btnBg,
                border: `1.5px solid ${btnBorder}`,
                borderRadius: '8px',
                width: '100%',
                textAlign: 'left',
                cursor: canSelect ? 'pointer' : 'default',
                outline: 'none',
                minHeight: 'clamp(46px, 4vw, 62px)',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {/* Letter badge */}
              <div style={{
                width: 'clamp(28px, 2.2vw, 38px)', height: 'clamp(28px, 2.2vw, 38px)',
                borderRadius: '6px',
                background: badgeBg,
                color: badgeColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Manrope', sans-serif",
                fontSize: 'clamp(12px, 1vw, 16px)',
                fontWeight: 700,
                flexShrink: 0,
                transition: 'background 0.15s, color 0.15s',
              }}>
                {badgeContent}
              </div>

              {/* Option text */}
              <span style={{
                fontFamily: "'Manrope', sans-serif",
                color: G.ink,
                fontSize: 'clamp(13px, 1.1vw, 18px)',
                fontWeight: 500,
                lineHeight: 1.4,
                flex: 1,
              }}>
                {option}
              </span>

              {/* Reveal icons */}
              {isRevealing && (isCorrectOpt || (isSelected && !isCorrectOpt)) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 18 }}
                  style={{ flexShrink: 0 }}
                >
                  {isCorrectOpt && (
                    <svg style={{ width: '16px', height: '16px', color: G.correct }} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {isSelected && !isCorrectOpt && (
                    <svg style={{ width: '16px', height: '16px', color: G.incorrect }} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Reveal section */}
      {isRevealing && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{ marginTop: '20px' }}
        >
          {/* Correct! */}
          {selectedOption !== null && selectedOption === correctAnswer && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: "'Manrope', sans-serif",
              fontSize: 'clamp(13px, 1vw, 17px)', fontWeight: 600,
              color: G.correct,
              marginBottom: '8px',
            }}>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Correct!
            </div>
          )}

          {/* Not quite */}
          {selectedOption !== null && selectedOption !== correctAnswer && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: "'Manrope', sans-serif",
              fontSize: 'clamp(13px, 1vw, 17px)', fontWeight: 500,
              color: G.incorrect,
              opacity: 0.85,
              marginBottom: '8px',
            }}>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Not quite
            </div>
          )}

          {/* Explanation */}
          <div style={{
            borderLeft: `3px solid ${explanationBorderColor}`,
            paddingLeft: '12px',
            paddingTop: '2px',
            paddingBottom: '2px',
          }}>
            <div style={{
              fontFamily: "'Lora', Georgia, serif",
              color: G.explanationText,
              fontSize: 'clamp(13px, 1vw, 17px)',
              lineHeight: 1.65,
              fontStyle: 'italic',
            }}>
              {explanation}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

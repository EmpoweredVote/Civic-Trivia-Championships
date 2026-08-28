import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TOPIC_LABELS } from './TopicIcon';
import type { TopicCategory } from '../../../types/game';
import { GemIcon } from '../../../components/icons/GemIcon';
import { useGameTheme } from '../gameTheme';
import { useThemeStore } from '../../../store/themeStore';

const GEM_SCORE_THRESHOLD = 600;

interface WagerScreenProps {
  currentScore: number;
  category: string;
  wagerAmount: number;
  onSetWager: (amount: number) => void;
  onLockWager: () => void;
  isLocked: boolean;
}

export function WagerScreen({
  currentScore,
  category,
  wagerAmount,
  onSetWager,
  onLockWager,
  isLocked,
}: WagerScreenProps) {
  const { G, darkMode } = useGameTheme();
  const { toggleDarkMode } = useThemeStore();
  const maxWager = Math.floor(currentScore / 2);
  const hasPoints = currentScore > 0;
  const categoryLabel = TOPIC_LABELS[category as TopicCategory] || category;
  const ifCorrect = currentScore + wagerAmount;
  const ifWrong   = currentScore - wagerAmount;

  const meetsGemThreshold = ifCorrect >= GEM_SCORE_THRESHOLD;
  const [showTooltip, setShowTooltip] = useState(false);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSetWager(parseInt(e.target.value, 10));
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLocked) return;
    switch (e.key) {
      case 'PageDown': e.preventDefault(); onSetWager(Math.max(0, wagerAmount - 50)); break;
      case 'PageUp':   e.preventDefault(); onSetWager(Math.min(maxWager, wagerAmount + 50)); break;
      case 'Home':     e.preventDefault(); onSetWager(0); break;
      case 'End':      e.preventDefault(); onSetWager(maxWager); break;
    }
  };

  const sliderFillPct = maxWager > 0 ? (wagerAmount / maxWager) * 100 : 0;

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      background: G.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 16px',
      boxSizing: 'border-box',
      fontFamily: "'Manrope', sans-serif",
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggleDarkMode}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'fixed',
          top: '14px',
          right: '16px',
          zIndex: 40,
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: G.hudCard,
          border: `1px solid ${G.hudBorder}`,
          color: G.inkMuted,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
          e.currentTarget.style.color = G.accent;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = G.hudCard;
          e.currentTarget.style.color = G.inkMuted;
        }}
      >
        {darkMode ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ maxWidth: 'clamp(520px, 42vw, 900px)', width: '100%' }}
      >
        {/* Final Question heading + category */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <p style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            letterSpacing: '0.08em',
            fontSize: 'clamp(20px, 2.4vw, 28px)',
            color: G.accent,
            margin: '0 0 6px',
          }}>
            FINAL QUESTION
          </p>
          <p style={{
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: '0.22em',
            fontSize: '11px',
            color: G.inkMuted,
            margin: 0,
          }}>
            CATEGORY: <span style={{ color: G.ink }}>{categoryLabel.toUpperCase()}</span>
          </p>
        </div>

        {/* Current score */}
        <div style={{
          textAlign: 'center',
          borderTop: `1px solid ${G.questionCardBorder}`,
          borderBottom: `1px solid ${G.questionCardBorder}`,
          padding: '8px 0',
          marginBottom: '12px',
        }}>
          <div style={{
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: '0.16em',
            fontSize: '10px',
            color: G.inkMuted,
            marginBottom: '2px',
          }}>
            YOUR SCORE
          </div>
          <div
            onClick={() => setShowTooltip(!showTooltip)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}
          >
            <div style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: 'clamp(40px, 3.4vw, 58px)',
              lineHeight: 1,
              fontWeight: 700,
              color: G.ink,
            }}>
              {currentScore.toLocaleString()}
            </div>
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bottom: '-8px',
                    background: G.ink,
                    color: G.bg,
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontFamily: "'Manrope', sans-serif",
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    borderRadius: '6px',
                  }}
                >
                  Score {GEM_SCORE_THRESHOLD.toLocaleString()}+ to earn a gem. Perfect score earns 2 gems.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Wager card */}
        <div style={{
          background: G.questionCard,
          border: `1px solid ${G.questionCardBorder}`,
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '12px',
        }}>
          {/* Wager amount + gem indicator in one row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Manrope', sans-serif",
                letterSpacing: '0.16em',
                fontSize: '10px',
                color: G.inkMuted,
                marginBottom: '2px',
              }}>
                WAGER
              </div>
              <div style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 'clamp(36px, 3vw, 52px)',
                fontWeight: 700,
                lineHeight: 1,
                color: G.btn,
              }}>
                {wagerAmount.toLocaleString()}
              </div>
              <div style={{
                fontFamily: "'Manrope', sans-serif",
                letterSpacing: '0.12em',
                fontSize: '10px',
                color: G.inkMuted,
                marginTop: '2px',
              }}>
                POINTS
              </div>
            </div>

            {/* Vertical divider */}
            <div style={{
              width: '1px',
              height: '48px',
              background: G.questionCardBorder,
              flexShrink: 0,
            }} />

            {/* Gem indicator */}
            <motion.div
              animate={{
                color: meetsGemThreshold ? '#D4A017' : G.ink,
                opacity: meetsGemThreshold ? 1 : 0.65,
              }}
              transition={{ duration: 0.3 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GemIcon className="w-5 h-5" />
              </div>
              <div style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: '10px',
                letterSpacing: '0.16em',
                color: G.inkMuted,
                marginTop: '4px',
                textAlign: 'center',
                lineHeight: 1.5,
              }}>
                {GEM_SCORE_THRESHOLD.toLocaleString()} PTS<br />FOR A GEM
              </div>
            </motion.div>
          </div>

          {/* Slider */}
          {hasPoints ? (
            <div style={{ marginBottom: '12px' }}>
              <input
                type="range"
                min={0}
                max={maxWager}
                step={10}
                value={wagerAmount}
                onChange={handleSliderChange}
                onKeyDown={handleSliderKeyDown}
                disabled={isLocked}
                aria-label="Wager amount"
                aria-valuemin={0}
                aria-valuemax={maxWager}
                aria-valuenow={wagerAmount}
                aria-valuetext={`${wagerAmount} points`}
                className="ctc-wager-slider"
                style={{
                  width: '100%',
                  height: '4px',
                  appearance: 'none',
                  borderRadius: '2px',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.5 : 1,
                  background: `linear-gradient(to right, ${G.btn} 0%, ${G.btn} ${sliderFillPct}%, ${G.optionBorder} ${sliderFillPct}%, ${G.optionBorder} 100%)`,
                  outline: 'none',
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4px',
                fontFamily: "'Manrope', sans-serif",
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: G.inkMuted,
              }}>
                <span>0</span>
                <span>{maxWager.toLocaleString()} MAX</span>
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0', color: G.inkMuted, fontStyle: 'italic', fontSize: '13px' }}>
              No points to wager
            </div>
          )}

          {/* Outcome preview */}
          <div role="group" aria-label="Wager outcome preview" aria-live="polite">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 0',
              borderTop: `1px solid ${G.optionBorder}`,
            }}>
              <span style={{
                fontFamily: "'Lora', Georgia, serif",
                fontStyle: 'italic',
                fontSize: '13px',
                color: G.inkMuted,
              }}>If correct:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 'clamp(20px, 1.6vw, 28px)',
                  fontWeight: 700,
                  color: G.correct,
                  transition: 'color 0.2s',
                }}>
                  +{ifCorrect.toLocaleString()}
                </span>
                {meetsGemThreshold && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                    <span style={{ color: '#D4A017' }}><GemIcon className="w-4 h-4" /></span>
                    <span style={{
                      fontFamily: "'Manrope', sans-serif",
                      fontSize: '13px',
                      letterSpacing: '0.06em',
                      color: '#D4A017',
                    }}>+1 GEM</span>
                  </span>
                )}
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 0',
              borderTop: `1px solid ${G.optionBorder}`,
            }}>
              <span style={{
                fontFamily: "'Lora', Georgia, serif",
                fontStyle: 'italic',
                fontSize: '13px',
                color: G.inkMuted,
              }}>If wrong:</span>
              <span style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: 'clamp(20px, 1.6vw, 28px)',
                fontWeight: 700,
                color: G.incorrect,
                transition: 'color 0.2s',
              }}>
                {ifWrong.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={onLockWager}
          disabled={isLocked}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 32px',
            minHeight: '40px',
            fontFamily: "'Manrope', sans-serif",
            fontSize: 'clamp(15px, 1.1vw, 19px)',
            fontWeight: 600,
            border: wagerAmount === 0 ? `1px solid ${G.questionCardBorder}` : 'none',
            borderRadius: '10px',
            background: isLocked ? G.optionBorder : wagerAmount === 0 ? 'transparent' : G.btn,
            color: isLocked ? G.inkMuted : wagerAmount === 0 ? G.inkMuted : G.btnText,
            cursor: isLocked ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            if (!isLocked && wagerAmount > 0) e.currentTarget.style.background = G.btnHover;
          }}
          onMouseLeave={e => {
            if (!isLocked && wagerAmount > 0) e.currentTarget.style.background = G.btn;
          }}
        >
          {isLocked ? 'LOCKED — GET READY…' : wagerAmount === 0 ? 'PLAY FOR FUN' : 'LOCK IN WAGER'}
        </button>
      </motion.div>

      <style>{`
        .ctc-wager-slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          background: ${G.btn};
          cursor: pointer;
          border: none;
        }
        .ctc-wager-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          background: ${G.btn};
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}

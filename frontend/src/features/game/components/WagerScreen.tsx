import { motion } from 'framer-motion';
import { TOPIC_LABELS } from './TopicIcon';
import type { TopicCategory } from '../../../types/game';

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
  const maxWager = Math.floor(currentScore / 2);
  const hasPoints = currentScore > 0;

  // Get human-readable category label
  const categoryLabel = TOPIC_LABELS[category as TopicCategory] || category;

  // Calculate potential outcomes
  const ifCorrect = currentScore + wagerAmount;
  const ifWrong = currentScore - wagerAmount;

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    onSetWager(value);
  };

  // Handle keyboard navigation for slider
  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isLocked) return;

    switch (e.key) {
      case 'PageDown':
        e.preventDefault();
        onSetWager(Math.max(0, wagerAmount - 50));
        break;
      case 'PageUp':
        e.preventDefault();
        onSetWager(Math.min(maxWager, wagerAmount + 50));
        break;
      case 'Home':
        e.preventDefault();
        onSetWager(0);
        break;
      case 'End':
        e.preventDefault();
        onSetWager(maxWager);
        break;
    }
  };

  // Determine button text and style
  const buttonText = wagerAmount === 0 ? 'Play for Fun' : 'Lock In Wager';
  const buttonStyle = wagerAmount === 0
    ? 'border-2 border-teal-500 text-teal-400 hover:bg-teal-500/10'
    : 'bg-teal-600 hover:bg-teal-700 text-white';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <img
            src="/images/FinalQuestion_A.png"
            alt="Final Question"
            className="h-[23vh] mx-auto mb-4 object-contain"
          />
          <p className="text-teal-400 text-lg">
            Category: <span className="font-semibold">{categoryLabel}</span>
          </p>
        </div>

        {/* Current Score Display */}
        <div className="text-center mb-8">
          <p className="text-slate-400 text-sm mb-1">Your Score</p>
          <p className="text-white text-4xl font-bold">{currentScore}</p>
        </div>

        {/* Wager Slider Section */}
        <div className="bg-slate-800/50 rounded-xl p-8 mb-6 border border-slate-700">
          {/* Wager Amount Label */}
          <div className="text-center mb-6">
            <p className="text-slate-400 text-sm mb-2">Wager</p>
            <p className="text-2xl font-bold text-white">{wagerAmount} points</p>
          </div>

          {/* Slider */}
          {hasPoints ? (
            <div className="mb-6">
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
                className={`w-full h-3 rounded-full appearance-none cursor-pointer slider-track ${
                  isLocked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  background: `linear-gradient(to right, rgb(20 184 166) 0%, rgb(20 184 166) ${(wagerAmount / maxWager) * 100}%, rgb(51 65 85) ${(wagerAmount / maxWager) * 100}%, rgb(51 65 85) 100%)`,
                }}
              />
              {/* Min/Max Labels */}
              <div className="flex justify-between mt-2 text-sm text-slate-400">
                <span>0</span>
                <span>{maxWager}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-slate-400 text-sm">No points to wager</p>
            </div>
          )}

          {/* Outcome Preview */}
          <div className="space-y-2" role="group" aria-label="Wager outcome preview" aria-live="polite">
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-300">If correct:</span>
              <span className="text-green-400 font-bold text-xl transition-all duration-200">
                {ifCorrect}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <span className="text-slate-300">If wrong:</span>
              <span className="text-red-400 font-bold text-xl transition-all duration-200">
                {ifWrong}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={onLockWager}
            disabled={isLocked}
            className={`px-12 py-4 rounded-lg font-bold text-lg transition-all min-h-[48px] ${buttonStyle} ${
              isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 shadow-lg'
            }`}
          >
            {isLocked ? 'Locked!' : buttonText}
          </button>
        </div>

        {/* Locked Indicator */}
        {isLocked && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-teal-400 mt-4 text-sm"
          >
            Wager locked! Get ready...
          </motion.p>
        )}
      </motion.div>

      <style>{`
        .slider-track::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgb(20 184 166);
          cursor: pointer;
          box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.5);
          transition: box-shadow 0.2s;
        }

        .slider-track::-webkit-slider-thumb:hover:not(:disabled) {
          box-shadow: 0 0 0 8px rgba(20, 184, 166, 0.2);
        }

        .slider-track:focus::-webkit-slider-thumb {
          box-shadow: 0 0 0 8px rgba(20, 184, 166, 0.3);
          outline: none;
        }

        .slider-track::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgb(20 184 166);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.5);
          transition: box-shadow 0.2s;
        }

        .slider-track::-moz-range-thumb:hover:not(:disabled) {
          box-shadow: 0 0 0 8px rgba(20, 184, 166, 0.2);
        }

        .slider-track:focus::-moz-range-thumb {
          box-shadow: 0 0 0 8px rgba(20, 184, 166, 0.3);
          outline: none;
        }
      `}</style>
    </div>
  );
}

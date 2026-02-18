import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScorePopupProps {
  basePoints: number;
  speedBonus: number;
  isCorrect: boolean;
  isTimeout: boolean;
  onComplete: () => void;
}

export function ScorePopup({
  basePoints,
  speedBonus,
  isCorrect,
  isTimeout,
  onComplete,
}: ScorePopupProps) {
  // Auto-complete after animations finish
  useEffect(() => {
    const timeout = setTimeout(() => {
      onComplete();
    }, 1500); // Total animation duration (reduced for snappier pacing)

    return () => clearTimeout(timeout);
  }, [onComplete]);

  // Timeout treatment - orange/amber
  if (isTimeout) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none">
        <AnimatePresence>
          <motion.div
            key="timeout"
            initial={{ opacity: 0, y: 20, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
            }}
            className="text-amber-500 text-4xl font-bold px-8 py-4 bg-slate-900/90 rounded-lg border-2 border-amber-500/50"
          >
            Time's up!
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Wrong answer - no popup (shake/flash handles it)
  if (!isCorrect) {
    return null;
  }

  // Correct answer - show base and speed bonus popups with stagger
  return (
    <div className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none">
      <div className="relative">
        <AnimatePresence>
          {/* Base points popup */}
          <motion.div
            key="base"
            initial={{ opacity: 0, y: 20, scale: 0.5 }}
            animate={{ opacity: 1, y: -40, scale: 1 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
              delay: 0,
            }}
            className="absolute left-1/2 -translate-x-1/2 text-5xl font-bold text-yellow-400"
            style={{
              textShadow: '0 0 20px rgba(250, 204, 21, 0.5)',
            }}
          >
            +{basePoints}
          </motion.div>

          {/* Speed bonus popup (only if bonus > 0) */}
          {speedBonus > 0 && (
            <motion.div
              key="speed"
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: -80, scale: 1 }}
              exit={{ opacity: 0, y: -120 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25,
                delay: 0.15,
              }}
              className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold text-teal-400 whitespace-nowrap"
              style={{
                textShadow: '0 0 20px rgba(45, 212, 191, 0.5)',
              }}
            >
              +{speedBonus} speed bonus
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

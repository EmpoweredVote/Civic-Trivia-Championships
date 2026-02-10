import { useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';

interface ScoreDisplayProps {
  score: number;
  shouldShake: boolean;
  showRedFlash: boolean;
}

export function ScoreDisplay({ score, shouldShake, showRedFlash }: ScoreDisplayProps) {
  const motionScore = useMotionValue(0);

  // Animate score changes with spring physics
  useEffect(() => {
    const controls = animate(motionScore, score, {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      mass: 0.5,
    });

    return () => controls.stop();
  }, [score, motionScore]);

  // Subscribe to motion value for display
  const displayScore = Math.round(motionScore.get());

  // Update display on every frame
  useEffect(() => {
    const unsubscribe = motionScore.on('change', () => {
      // Force re-render when motion value changes
    });
    return unsubscribe;
  }, [motionScore]);

  return (
    <div className="relative">
      {/* Red flash overlay */}
      {showRedFlash && (
        <motion.div
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-red-600 rounded-lg pointer-events-none"
        />
      )}

      {/* Score container with shake animation */}
      <motion.div
        animate={
          shouldShake
            ? {
                x: [0, -10, 10, -10, 10, 0],
                transition: { duration: 0.5 },
              }
            : {}
        }
        className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg px-6 py-3 border border-slate-700"
      >
        <div className="text-center">
          <motion.div
            key={displayScore}
            className="text-3xl font-bold text-teal-400 tabular-nums"
          >
            {displayScore.toLocaleString()}
          </motion.div>
          <div className="text-slate-400 text-xs mt-0.5 uppercase tracking-wide">
            pts
          </div>
        </div>
      </motion.div>
    </div>
  );
}

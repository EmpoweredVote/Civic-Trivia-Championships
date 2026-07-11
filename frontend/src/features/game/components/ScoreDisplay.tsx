import { useEffect } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useGameTheme } from '../gameTheme';

interface ScoreDisplayProps {
  score: number;
  shouldShake: boolean;
  showRedFlash: boolean;
  compact?: boolean;
}

export function ScoreDisplay({ score, shouldShake, showRedFlash, compact = false }: ScoreDisplayProps) {
  const { G } = useGameTheme();
  const motionScore = useMotionValue(0);

  useEffect(() => {
    const controls = animate(motionScore, score, {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      mass: 0.5,
    });
    return () => controls.stop();
  }, [score, motionScore]);

  const displayScore = Math.round(motionScore.get());

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
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 pointer-events-none"
          style={{ background: '#C0152A', borderRadius: '2px' }}
        />
      )}

      {/* Score — just the number, no card */}
      <motion.div
        animate={
          shouldShake
            ? { x: [0, -8, 8, -8, 8, 0], transition: { duration: 0.4 } }
            : {}
        }
        className="relative"
      >
        <div style={{
          background: G.hudCard,
          border: `1px solid ${G.hudBorder}`,
          borderRadius: '8px',
          padding: 'clamp(8px, 0.8vw, 14px) clamp(16px, 1.6vw, 26px)',
          textAlign: 'center',
          minWidth: 'clamp(80px, 8vw, 120px)',
        }}>
          <div style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 'clamp(11px, 0.9vw, 14px)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color: G.accent,
            marginBottom: '2px',
          }}>
            Score
          </div>
          <div style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 700,
            fontSize: compact ? 'clamp(22px, 2.2vw, 34px)' : 'clamp(35px, 3.5vw, 52px)',
            lineHeight: 1,
            letterSpacing: compact ? '0px' : '-0.5px',
            color: G.ink,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {displayScore.toLocaleString()}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

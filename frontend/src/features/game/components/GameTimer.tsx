import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import { motion } from 'framer-motion';
import { useGameTheme } from '../gameTheme';

interface GameTimerProps {
  duration: number;
  onTimeout: () => void;
  isPaused: boolean;
  onTimeUpdate?: (remainingTime: number) => void;
  key?: string | number;
  size?: number;
}

export function GameTimer({
  duration,
  onTimeout,
  isPaused,
  onTimeUpdate,
  size = 80,
}: GameTimerProps) {
  const { G } = useGameTheme();
  const isSmall = size < 60;

  return (
    <div className="flex items-center justify-center">
      <CountdownCircleTimer
        isPlaying={!isPaused}
        duration={duration}
        colors={['#E8A020', '#E07010', '#C0152A', '#C0152A']}
        colorsTime={[duration, Math.round(duration * 0.5), Math.round(duration * 0.25), 0]}
        size={size}
        strokeWidth={isSmall ? 3 : 5}
        trailColor={G.timerTrail as `#${string}`}
        onComplete={() => {
          onTimeout();
          return { shouldRepeat: false };
        }}
      >
        {({ remainingTime, color }) => {
          if (onTimeUpdate) {
            onTimeUpdate(remainingTime);
          }

          const isCritical = remainingTime <= 5;

          return (
            <motion.div
              animate={isCritical ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="flex flex-col items-center justify-center"
            >
              <div
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: isSmall ? 'clamp(18px, 1.6vw, 24px)' : 'clamp(28px, 2.4vw, 36px)',
                  fontWeight: 700,
                  lineHeight: 1,
                  color,
                  letterSpacing: '-0.25px',
                }}
              >
                {remainingTime}
              </div>
            </motion.div>
          );
        }}
      </CountdownCircleTimer>
    </div>
  );
}

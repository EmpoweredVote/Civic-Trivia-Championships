import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import { motion } from 'framer-motion';

interface GameTimerProps {
  duration: number;
  onTimeout: () => void;
  isPaused: boolean;
  onTimeUpdate?: (remainingTime: number) => void;
  key?: string | number;
}

export function GameTimer({
  duration,
  onTimeout,
  isPaused,
  onTimeUpdate,
}: GameTimerProps) {
  return (
    <div className="flex items-center justify-center">
      <CountdownCircleTimer
        isPlaying={!isPaused}
        duration={duration}
        colors={['#14B8A6', '#FBBF24', '#F97316', '#EF4444']}
        colorsTime={[20, 10, 5, 0]}
        size={80}
        strokeWidth={6}
        onComplete={() => {
          onTimeout();
          return { shouldRepeat: false };
        }}
      >
        {({ remainingTime }) => {
          // Update parent with current remaining time
          if (onTimeUpdate) {
            onTimeUpdate(remainingTime);
          }

          // Determine threshold-based styling and icons
          const isWarning = remainingTime <= 10 && remainingTime > 5;
          const isCritical = remainingTime <= 5;

          return (
            <motion.div
              animate={isCritical ? { scale: [1, 1.08, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className={`flex flex-col items-center justify-center rounded-full ${
                isCritical
                  ? 'border border-red-500/70 shadow-lg shadow-red-500/30 px-2 py-2'
                  : isWarning
                  ? 'border border-amber-500/50 px-2 py-2'
                  : ''
              }`}
            >
              <div className="text-2xl font-bold text-white">
                {remainingTime}
              </div>

              {/* Warning icon (amber clock) at <=10s */}
              {isWarning && (
                <svg className="w-4 h-4 text-amber-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}

              {/* Critical icon (red exclamation triangle) at <=5s */}
              {isCritical && (
                <svg className="w-4 h-4 text-red-500 mt-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </motion.div>
          );
        }}
      </CountdownCircleTimer>
    </div>
  );
}

import { CountdownCircleTimer } from 'react-countdown-circle-timer';

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
          return (
            <div className="text-2xl font-bold text-white">
              {remainingTime}
            </div>
          );
        }}
      </CountdownCircleTimer>
    </div>
  );
}

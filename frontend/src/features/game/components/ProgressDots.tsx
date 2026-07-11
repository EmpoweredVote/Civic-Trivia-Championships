import { useGameTheme } from '../gameTheme';

interface ProgressDotsProps {
  currentIndex: number;
  total?: number;
}

export function ProgressDots({ currentIndex, total = 8 }: ProgressDotsProps) {
  const { G, darkMode } = useGameTheme();
  const pct = Math.round((currentIndex / total) * 100);

  return (
    <div style={{ width: '100%' }}>
      {/* Labels row — dark mode only */}
      {darkMode && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}>
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 'clamp(11px, 0.9vw, 14px)',
            fontWeight: 500,
            color: G.inkMuted,
          }}>
            Progress
          </span>
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 'clamp(11px, 0.9vw, 14px)',
            fontWeight: 600,
            color: G.inkMuted,
          }}>
            {pct}%
          </span>
        </div>
      )}

      {/* Dash segments */}
      <div
        style={{ display: 'flex', gap: '4px' }}
        role="progressbar"
        aria-valuenow={currentIndex}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Question ${currentIndex} of ${total}`}
      >
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: filled
                  ? `linear-gradient(to right, ${G.accent}, ${G.accentLeft})`
                  : active
                  ? G.segmentActive
                  : G.segmentEmpty,
                transition: 'background 0.3s',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

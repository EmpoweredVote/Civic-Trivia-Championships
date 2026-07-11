import { motion, useReducedMotion } from 'framer-motion';
import { Avatar } from '../../../components/Avatar';
import { useTheme } from '../../../hooks/useTheme';
import type { LeaderboardEntry } from '../types';

const PODIUM_COLORS: Record<number, string> = {
  1: '#B8860B',
  2: '#9A9A9A',
  3: '#8B4513',
};

const PODIUM_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

const TIER_COLORS = {
  inform: '#9A9A9A',
  connected: '#03B9D2',
  empowered: '#FF5740',
};

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
}

interface PodiumCardProps {
  entry: LeaderboardEntry;
  isCenter: boolean;
  animationDelay: number;
  shouldAnimate: boolean;
  isYou: boolean;
}

function PodiumCard({ entry, isCenter, animationDelay, shouldAnimate, isYou }: PodiumCardProps) {
  const { C } = useTheme();
  const podiumColor = PODIUM_COLORS[entry.rank] ?? '#9A9A9A';
  const tierColor = TIER_COLORS[entry.tier] ?? C.muted;

  return (
    <motion.div
      initial={shouldAnimate ? { y: 20, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, delay: animationDelay }}
      style={{
        flex: 1,
        maxWidth: 'clamp(110px, 9vw, 160px)',
        minWidth: '80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 8px',
        background: `${podiumColor}26`,
        borderTop: `2px solid ${podiumColor}60`,
        borderRadius: '4px',
        marginTop: isCenter ? '-12px' : '0',
        gap: '6px',
      }}
    >
      {/* Medal / rank label */}
      <span style={{ fontSize: 'clamp(20px, 1.8vw, 30px)', lineHeight: 1 }}>
        {PODIUM_MEDALS[entry.rank] ?? `#${entry.rank}`}
      </span>

      {/* Avatar with tier dot */}
      <div style={{ position: 'relative' }}>
        <Avatar name={entry.username || (isYou ? 'You' : '')} size={40} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: tierColor,
            border: `1px solid ${C.paper}`,
          }}
        />
      </div>

      {/* Username */}
      <span
        style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: 'clamp(13px, 1vw, 17px)',
          color: isYou ? C.ink : C.muted,
          fontStyle: 'normal',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 'clamp(90px, 7.5vw, 130px)',
          textAlign: 'center',
          display: 'block',
          width: '100%',
        }}
        title={entry.username || (isYou ? 'You' : '')}
      >
        {entry.username || (isYou ? 'You' : '')}
      </span>

      {/* Level */}
      <span
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '11px',
          letterSpacing: '0.1em',
          color: C.muted,
        }}
      >
        LV {entry.level}
      </span>

      {/* XP */}
      <span
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(13px, 1.1vw, 18px)',
          letterSpacing: '0.06em',
          color: '#E8A020',
        }}
      >
        {entry.total_xp.toLocaleString()}
      </span>
    </motion.div>
  );
}

export function LeaderboardPodium({ entries, currentUserId }: LeaderboardPodiumProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion;

  if (entries.length === 0) return null;

  // Build podium order: 2nd - 1st - 3rd (center elevated)
  const first  = entries.find((e) => e.rank === 1);
  const second = entries.find((e) => e.rank === 2);
  const third  = entries.find((e) => e.rank === 3);

  // Cards in display order with animation delays
  const displayOrder: Array<{ entry: LeaderboardEntry; isCenter: boolean; delay: number }> = [];
  if (second) displayOrder.push({ entry: second, isCenter: false, delay: 0.1 });
  if (first)  displayOrder.push({ entry: first,  isCenter: true,  delay: 0.0 });
  if (third)  displayOrder.push({ entry: third,  isCenter: false, delay: 0.2 });

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: '12px',
        marginBottom: '24px',
      }}
    >
      {displayOrder.map(({ entry, isCenter, delay }) => (
        <PodiumCard
          key={entry.user_id}
          entry={entry}
          isCenter={isCenter}
          animationDelay={delay}
          shouldAnimate={shouldAnimate}
          isYou={entry.user_id === currentUserId}
        />
      ))}
    </div>
  );
}

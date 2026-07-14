import { motion, useReducedMotion } from 'framer-motion';
import { Avatar } from '../../../components/Avatar';
import { useTheme } from '../../../hooks/useTheme';
import type { LeaderboardEntry } from '../types';

const RANK_COLORS: Record<number, string> = {
  1: '#E8A020',
  2: '#94A3B8',
  3: '#D48F63',
};

const TIER_COLORS = {
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
  const { darkMode } = useTheme();
  const cardBg = darkMode ? '#161B22' : '#FFFFFF';
  const inkColor = darkMode ? '#F1F5F9' : '#0F172A';
  const mutedColor = darkMode ? '#7C90AC' : '#94A3B8';
  const rankColor = RANK_COLORS[entry.rank] ?? mutedColor;
  const tierColor = entry.tier === 'inform' ? mutedColor : TIER_COLORS[entry.tier];

  return (
    <motion.div
      initial={shouldAnimate ? { y: 20, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, delay: animationDelay }}
      style={{
        flex: 1,
        maxWidth: 'clamp(110px, 9vw, 170px)',
        minWidth: '90px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '18px 10px 16px',
        background: cardBg,
        border: `2px solid ${isYou ? '#14B8A6' : rankColor}`,
        borderRadius: '16px',
        marginTop: isCenter ? '-14px' : '0',
        gap: '6px',
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          width: '26px', height: '26px', borderRadius: '50%',
          background: `${rankColor}26`, border: `1px solid ${rankColor}80`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '2px',
        }}
      >
        <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900, fontSize: '12px', color: rankColor }}>
          {entry.rank}
        </span>
      </div>

      {/* Avatar with tier dot */}
      <div style={{ position: 'relative' }}>
        <Avatar name={entry.username || (isYou ? 'You' : '')} size={40} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: tierColor,
            border: `1.5px solid ${cardBg}`,
          }}
        />
      </div>

      {/* Username */}
      <span
        style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: isYou ? 800 : 600,
          fontSize: 'clamp(12px, 1vw, 14px)',
          color: isYou ? '#14B8A6' : inkColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 'clamp(90px, 7.5vw, 140px)',
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
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 600,
          fontSize: '10px',
          letterSpacing: '0.06em',
          color: mutedColor,
        }}
      >
        LV {entry.level}
      </span>

      {/* XP */}
      <span
        style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 800,
          fontSize: 'clamp(13px, 1.1vw, 18px)',
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
        gap: '14px',
        marginBottom: '28px',
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

import { Avatar } from '../../../components/Avatar';
import { useTheme } from '../../../hooks/useTheme';
import type { LeaderboardEntry } from '../types';

const TIER_COLORS = {
  connected: '#03B9D2',
  empowered: '#FF5740',
};

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isYou: boolean;
}

export function LeaderboardRow({ entry, isYou }: LeaderboardRowProps) {
  const { darkMode } = useTheme();
  const ruleColor = darkMode ? '#21262D' : '#E2E8F0';
  const inkColor = darkMode ? '#F1F5F9' : '#0F172A';
  const mutedColor = darkMode ? '#7C90AC' : '#94A3B8';

  const tierColor = entry.tier === 'inform' ? mutedColor : TIER_COLORS[entry.tier];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: isYou ? 'rgba(20,184,166,0.08)' : 'transparent',
        borderLeft: isYou ? '3px solid #14B8A6' : '3px solid transparent',
        borderBottom: `1px solid ${ruleColor}`,
      }}
    >
      {/* Rank number */}
      <span
        style={{
          width: '24px',
          textAlign: 'right',
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 800,
          fontSize: '15px',
          color: mutedColor,
          flexShrink: 0,
        }}
      >
        {entry.rank}
      </span>

      {/* Tier badge dot */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: tierColor,
          flexShrink: 0,
        }}
      />

      {/* Avatar */}
      <Avatar name={entry.username || (isYou ? 'You' : '')} size={28} />

      {/* Username + level */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: isYou ? 700 : 500,
            fontSize: '14px',
            color: inkColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.username || (isYou ? 'You' : '')}
        </div>
        <div
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 600,
            fontSize: '11px',
            letterSpacing: '0.04em',
            color: mutedColor,
          }}
        >
          LV {entry.level}
        </div>
      </div>

      {/* Total XP */}
      <span
        style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 800,
          fontSize: '14px',
          color: '#E8A020',
          flexShrink: 0,
        }}
      >
        {entry.total_xp.toLocaleString()} XP
      </span>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useTheme } from '../../../hooks/useTheme';
import type { UserRank } from '../types';

interface LeaderboardStickyYouProps {
  userRank: UserRank | null;
  isAuthenticated: boolean;
  isInTop25: boolean;
}

export function LeaderboardStickyYou({ userRank, isAuthenticated, isInTop25 }: LeaderboardStickyYouProps) {
  const { darkMode } = useTheme();
  const ruleColor = darkMode ? '#21262D' : '#E2E8F0';
  const inkColor = darkMode ? '#F1F5F9' : '#0F172A';
  const mutedColor = darkMode ? '#7C90AC' : '#94A3B8';

  const linkStyle = {
    display: 'inline-block',
    fontFamily: "'Manrope', sans-serif",
    fontWeight: 700,
    fontSize: '13px',
    color: '#E8A020',
    textDecoration: 'none',
    border: '1px solid #E8A020',
    padding: '9px 22px',
    borderRadius: '10px',
  } as const;

  // Logged out: sign-in prompt
  if (!isAuthenticated) {
    return (
      <div
        style={{
          borderTop: `1px solid ${ruleColor}`,
          marginTop: '16px',
          padding: '24px 16px',
          textAlign: 'center' as const,
        }}
      >
        <p
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: '14px',
            color: mutedColor,
            margin: '0 0 14px',
          }}
        >
          Want to see where you rank?
        </p>
        <Link to="/login" style={linkStyle}>
          Sign in to see your rank
        </Link>
      </div>
    );
  }

  // Authenticated + in top 25: nothing (row is highlighted in the main list)
  if (isInTop25) {
    return null;
  }

  // Authenticated + not in top 25 + has rank data
  if (userRank) {
    return (
      <div
        style={{
          borderTop: `1px solid ${ruleColor}`,
          marginTop: '16px',
        }}
      >
        {/* Rank row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'rgba(20,184,166,0.08)',
            borderLeft: '3px solid #14B8A6',
          }}
        >
          {/* YOU label */}
          <span
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.06em',
              color: '#14B8A6',
              flexShrink: 0,
            }}
          >
            YOU
          </span>

          {/* Rank number */}
          <span
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: '15px',
              color: mutedColor,
              flexShrink: 0,
            }}
          >
            #{userRank.rank}
          </span>

          {/* Username + level */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 700,
                fontSize: '14px',
                color: inkColor,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userRank.username}
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
              LV {userRank.level}
            </div>
          </div>

          {/* XP */}
          <span
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: '14px',
              color: '#E8A020',
              flexShrink: 0,
            }}
          >
            {userRank.total_xp.toLocaleString()} XP
          </span>
        </div>

        {/* Gap message */}
        {userRank.gap_to_next > 0 && (
          <p
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontSize: '12px',
              color: mutedColor,
              margin: '8px 16px 0',
              textAlign: 'right' as const,
            }}
          >
            {userRank.gap_to_next.toLocaleString()} XP to move up
          </p>
        )}
      </div>
    );
  }

  // Authenticated + not in top 25 + no rank data (hasn't played)
  return (
    <div
      style={{
        borderTop: `1px solid ${ruleColor}`,
        marginTop: '16px',
        padding: '24px 16px',
        textAlign: 'center' as const,
      }}
    >
      <p
        style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: '14px',
          color: mutedColor,
          margin: '0 0 14px',
        }}
      >
        Play a game to appear on the leaderboard!
      </p>
      <Link to="/play" style={linkStyle}>
        Play now
      </Link>
    </div>
  );
}

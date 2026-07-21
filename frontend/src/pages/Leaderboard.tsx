import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@empoweredvote/analytics';
import { Header } from '../components/layout/Header';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { useLeaderboard } from '../features/leaderboard/hooks/useLeaderboard';
import { LeaderboardTabs } from '../features/leaderboard/components/LeaderboardTabs';
import { LeaderboardRow } from '../features/leaderboard/components/LeaderboardRow';
import { LeaderboardPodium } from '../features/leaderboard/components/LeaderboardPodium';
import { LeaderboardStickyYou } from '../features/leaderboard/components/LeaderboardStickyYou';
import type { LeaderboardTab } from '../features/leaderboard/types';

export function Leaderboard() {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const pageBg = darkMode ? '#0D1117' : '#F0F4F8';
  const cardBorder = darkMode ? '#21262D' : '#E2E8F0';
  const headingColor = darkMode ? '#F1F5F9' : '#0F172A';
  const mutedColor = darkMode ? '#7C90AC' : '#94A3B8';
  const skeletonBg = darkMode ? '#161B22' : '#E2E8F0';

  const [tab, setTab] = useState<LeaderboardTab>('all_time');
  const { data, isLoading, error, refetch } = useLeaderboard(tab, userId);

  useEffect(() => {
    track('ctc_leaderboard_viewed');
  }, []);

  // ── Loading state ─────────────────────────────────────────────────────────────

  const loadingSkeleton = (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: '52px',
            background: skeletonBg,
            borderRadius: '10px',
          }}
        />
      ))}
    </div>
  );

  // ── Error state ───────────────────────────────────────────────────────────────

  const errorState = (
    <div style={{ textAlign: 'center' as const, padding: '48px 0' }}>
      <p
        style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: '15px',
          color: mutedColor,
          margin: '0 0 20px',
        }}
      >
        Leaderboard temporarily unavailable. Try again later.
      </p>
      <button
        onClick={refetch}
        style={{
          padding: '10px 28px',
          background: 'transparent',
          color: mutedColor,
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 700,
          fontSize: '13px',
          border: `1px solid ${cardBorder}`,
          borderRadius: '10px',
          cursor: 'pointer',
          minHeight: '40px',
        }}
      >
        Try again
      </button>
    </div>
  );

  // ── Empty state ───────────────────────────────────────────────────────────────

  const emptyState = (
    <div style={{ textAlign: 'center' as const, padding: '48px 0' }}>
      <p
        style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: '15px',
          color: mutedColor,
          margin: '0 0 16px',
        }}
      >
        No players yet — be the first!
      </p>
      <button
        onClick={() => navigate('/play')}
        style={{
          padding: '13px 32px',
          background: '#E8A020',
          color: '#0F0D09',
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 800,
          fontSize: 'clamp(15px, 1.2vw, 18px)',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          minHeight: '48px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#C88010')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#E8A020')}
      >
        Play Now
      </button>
    </div>
  );

  // ── Ranked list ───────────────────────────────────────────────────────────────

  const rankedList = data && data.entries.length > 0 && (
    <div>
      {/* Podium — top 3 visual treatment */}
      <LeaderboardPodium entries={data.entries.filter((e) => e.rank <= 3)} currentUserId={userId} />

      {/* Positions 4-25 */}
      {data.entries
        .filter((e) => e.rank > 3)
        .map((entry) => (
          <LeaderboardRow
            key={entry.user_id}
            entry={entry}
            isYou={entry.user_id === userId}
          />
        ))}

      {/* Sticky you row — personal rank below list */}
      <LeaderboardStickyYou
        userRank={data.userRank}
        isAuthenticated={isAuthenticated}
        isInTop25={data.entries.some((e) => e.user_id === userId)}
      />
    </div>
  );

  // ── Page ──────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: pageBg,
      }}
    >
      <Header />

      <div style={{ padding: '32px 24px 80px', maxWidth: '860px', margin: '0 auto' }}>
        {/* Page title */}
        <h1
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 900,
            fontSize: 'clamp(28px, 2.5vw, 40px)',
            letterSpacing: '-0.01em',
            color: headingColor,
            margin: '0 0 28px',
          }}
        >
          Leaderboard
        </h1>

        {/* Tab switcher */}
        <LeaderboardTabs active={tab} onChange={setTab} />

        {/* Content */}
        {isLoading && loadingSkeleton}
        {!isLoading && error && errorState}
        {!isLoading && !error && data && data.entries.length === 0 && emptyState}
        {!isLoading && !error && rankedList}

        {/* Sign-in prompt when leaderboard is empty and user is logged out */}
        {!isLoading && !error && data && data.entries.length === 0 && (
          <LeaderboardStickyYou
            userRank={null}
            isAuthenticated={isAuthenticated}
            isInTop25={false}
          />
        )}

        {/* Navigation footer */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '40px',
            paddingTop: '24px',
            borderTop: `1px solid ${cardBorder}`,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              flex: 1,
              padding: '13px',
              background: 'transparent',
              color: mutedColor,
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 700,
              fontSize: '13px',
              border: `1px solid ${cardBorder}`,
              borderRadius: '10px',
              cursor: 'pointer',
              minHeight: '44px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#14B8A6';
              e.currentTarget.style.color = headingColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = cardBorder;
              e.currentTarget.style.color = mutedColor;
            }}
          >
            ← Back
          </button>
          <button
            onClick={() => navigate('/play')}
            style={{
              flex: 1,
              padding: '13px',
              background: '#E8A020',
              color: '#0F0D09',
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: '13px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              minHeight: '44px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#C88010')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#E8A020')}
          >
            Play
          </button>
        </div>
      </div>
    </div>
  );
}

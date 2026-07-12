import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { C } = useTheme();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [tab, setTab] = useState<LeaderboardTab>('all_time');
  const { data, isLoading, error, refetch } = useLeaderboard(tab, userId);

  // ── Loading state ─────────────────────────────────────────────────────────────

  const loadingSkeleton = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: '52px',
            background: C.ruleLight,
            borderRadius: '2px',
            marginBottom: '4px',
          }}
        />
      ))}
    </div>
  );

  // ── Error state ───────────────────────────────────────────────────────────────

  const errorState = (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 0',
      }}
    >
      <p
        style={{
          fontFamily: "'Lora', Georgia, serif",
          fontStyle: 'italic',
          fontSize: '15px',
          color: C.muted,
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
          color: C.muted,
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '15px',
          letterSpacing: '0.14em',
          border: `1px solid ${C.rule}`,
          borderRadius: '2px',
          cursor: 'pointer',
          minHeight: '40px',
        }}
      >
        TRY AGAIN
      </button>
    </div>
  );

  // ── Empty state ───────────────────────────────────────────────────────────────

  const emptyState = (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <p
        style={{
          fontFamily: "'Lora', Georgia, serif",
          fontStyle: 'italic',
          fontSize: '15px',
          color: C.muted,
          margin: '0 0 8px',
        }}
      >
        No players yet — be the first!
      </p>
      <button
        onClick={() => navigate('/play')}
        style={{
          marginTop: '16px',
          padding: '14px 36px',
          background: C.accent,
          color: '#FFFFFF',
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(18px, 1.4vw, 24px)',
          letterSpacing: '0.12em',
          border: 'none',
          borderRadius: '2px',
          cursor: 'pointer',
          minHeight: '48px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = C.accentHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
      >
        PLAY NOW
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
        background: C.paper,
        fontFamily: "'Lora', Georgia, serif",
      }}
    >
      <Header />

      <div
        style={{
          padding: '32px 24px 80px',
        }}
      >
        {/* Page title */}
        <h1
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(28px, 2.2vw, 40px)',
            letterSpacing: '0.1em',
            color: C.ink,
            textAlign: 'center',
            margin: '0 0 32px',
          }}
        >
          LEADERBOARD
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
            borderTop: `1px solid ${C.rule}`,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              flex: 1,
              padding: '13px',
              background: 'transparent',
              color: C.muted,
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '15px',
              letterSpacing: '0.14em',
              border: `1px solid ${C.rule}`,
              borderRadius: '2px',
              cursor: 'pointer',
              minHeight: '44px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.inkLight;
              e.currentTarget.style.color = C.ink;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.rule;
              e.currentTarget.style.color = C.muted;
            }}
          >
            ← BACK
          </button>
          <button
            onClick={() => navigate('/play')}
            style={{
              flex: 1,
              padding: '13px',
              background: C.accent,
              color: '#FFFFFF',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '15px',
              letterSpacing: '0.14em',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              minHeight: '44px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.accentHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
          >
            PLAY
          </button>
        </div>
      </div>
    </div>
  );
}

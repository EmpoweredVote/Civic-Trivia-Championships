import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Avatar } from '../components/Avatar';
import { XpIcon } from '../components/icons/XpIcon';
import { fetchTriviaStats, fetchXpHistory } from '../services/profileService';
import type { ProfileStats, XpHistoryResponse } from '../services/profileService';
import { fetchAccountProfile, ACCOUNTS_WEB_URL } from '../services/accountsApi';
import type { AccountProfile } from '../types/auth';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { track } from '@empoweredvote/analytics';
import { useTheme } from '../hooks/useTheme';
import type { ColorTokens } from '../hooks/useTheme';

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label, colors }: { label: string; colors: ColorTokens }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        letterSpacing: '0.22em',
        fontSize: '12px',
        color: colors.muted,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, borderTop: `1px solid ${colors.rule}` }} />
    </div>
  );
}

function TierBadge({ tier, colors }: { tier: string; colors: ColorTokens }) {
  if (tier === 'connected') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '11px',
        letterSpacing: '0.18em',
        color: colors.correct,
        border: `1px solid ${colors.correct}`,
        background: 'rgba(37,92,63,0.07)',
        borderRadius: '2px',
      }}>
        CONNECTED
      </span>
    );
  }
  if (tier === 'empowered') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '11px',
        letterSpacing: '0.18em',
        color: colors.gold,
        border: `1px solid ${colors.gold}`,
        background: 'rgba(184,134,11,0.07)',
        borderRadius: '2px',
      }}>
        EMPOWERED
      </span>
    );
  }
  return null;
}

function formatDate(isoString: string): string {
  const diffDays = Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000);
  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(isoString));
}

function XpBadge({ amount, colors }: { amount: number; colors: ColorTokens }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      background: 'rgba(232,160,32,0.1)',
      border: '1px solid rgba(232,160,32,0.35)',
      borderRadius: '2px',
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: '13px',
      letterSpacing: '0.06em',
      color: colors.amber,
    }}>
      <XpIcon className="w-3 h-3" />
      +{amount}
    </span>
  );
}

type ActiveTab = 'overview' | 'history';

// ── Main component ─────────────────────────────────────────────────────────────

export function Profile() {
  const navigate = useNavigate();
  const { isAdmin, tier, tierResolved } = useAuthStore();
  const isConnected = tier === 'connected' || tier === 'empowered';

  const { darkMode, toggleDarkMode, C } = useTheme();

  const [triviaStats,    setTriviaStats]    = useState<ProfileStats | null>(null);
  const [accountData,    setAccountData]    = useState<AccountProfile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [triviaError,    setTriviaError]    = useState<string | null>(null);
  const [accountError,   setAccountError]   = useState<string | null>(null);

  const [activeTab,      setActiveTab]      = useState<ActiveTab>('overview');
  const [historyData,    setHistoryData]    = useState<XpHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError,   setHistoryError]   = useState<string | null>(null);
  const [historyPage,    setHistoryPage]    = useState(1);

  useEffect(() => {
    const load = async () => {
      const { accessToken } = useAuthStore.getState();
      if (!accessToken) {
        navigate('/login?from=/profile', { replace: true });
        return;
      }

      track('ctc_profile_viewed');

      const [triviaResult, accountResult] = await Promise.allSettled([
        fetchTriviaStats(),
        fetchAccountProfile(accessToken),
      ]);

      if (triviaResult.status === 'fulfilled') {
        setTriviaStats(triviaResult.value);
        useAuthStore.getState().setTimerMultiplier(triviaResult.value.timerMultiplier);
      } else {
        setTriviaError("Couldn't load game stats");
      }

      if (accountResult.status === 'fulfilled') {
        const profile = accountResult.value;
        setAccountData(profile);
        useAuthStore.getState().setDisplayName(profile.display_name);
        useAuthStore.getState().setTier(profile.tier);
      } else {
        setAccountError("Couldn't load account info");
      }

      try {
        const adminStatus = await apiRequest<{ isAdmin: boolean; isSuperAdmin: boolean }>(
          '/api/users/profile/admin-status'
        );
        useAuthStore.getState().setAdminStatus(adminStatus.isAdmin, adminStatus.isSuperAdmin);
      } catch {
        // Non-critical
      }

      setLoading(false);
    };
    load();
  }, [navigate]);

  useEffect(() => {
    if (activeTab !== 'history' || !isConnected) return;
    const load = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const data = await fetchXpHistory(historyPage);
        setHistoryData(data);
      } catch {
        setHistoryError("Couldn't load XP history. Try refreshing.");
      } finally {
        setHistoryLoading(false);
      }
    };
    load();
  }, [activeTab, historyPage, isConnected]);

  useEffect(() => {
    if (activeTab === 'history') setHistoryPage(1);
  }, [activeTab]);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.paper }}>
        <Header />
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
            <div
              className="animate-spin"
              style={{
                width: '36px',
                height: '36px',
                border: `3px solid ${C.ruleLight}`,
                borderTopColor: '#E8A020',
                borderRadius: '50%',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Shared error notice ──────────────────────────────────────────────────────

  const ErrorNotice = ({ message }: { message: string }) => (
    <div style={{
      marginBottom: '16px',
      padding: '10px 14px',
      border: `1px solid rgba(184,134,11,0.35)`,
      background: 'rgba(184,134,11,0.06)',
      borderRadius: '2px',
      fontFamily: "'Lora', Georgia, serif",
      fontStyle: 'italic',
      fontSize: '13px',
      color: C.gold,
    }}>
      {message}
    </div>
  );

  // ── Play CTA button ──────────────────────────────────────────────────────────

  const PlayButton = ({ label }: { label: string }) => (
    <button
      onClick={() => navigate('/play')}
      style={{
        marginTop: '20px',
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
      onMouseEnter={e => (e.currentTarget.style.background = '#A82F12')}
      onMouseLeave={e => (e.currentTarget.style.background = C.accent)}
    >
      {label}
    </button>
  );

  // ── Hero section ─────────────────────────────────────────────────────────────

  const heroSection = (
    <div style={{ paddingBottom: '32px', borderBottom: `1px solid ${C.rule}` }}>
      {accountError && <ErrorNotice message="Couldn't load account information. Some details may be unavailable." />}

      {accountData && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
            <div style={{ flexShrink: 0 }}>
              <Avatar
                name={accountData.display_name || accountData.email}
                imageUrl={accountData.avatar_url}
                size={80}
              />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 'clamp(26px, 3vw, 56px)',
                  letterSpacing: '0.04em',
                  color: C.ink,
                  margin: 0,
                  lineHeight: 1,
                }}>
                  {accountData.display_name || accountData.email}
                </h1>
                <TierBadge tier={accountData.tier} colors={C} />
              </div>

              <p style={{
                fontFamily: "'Lora', Georgia, serif",
                fontStyle: 'italic',
                color: C.muted,
                fontSize: '14px',
                margin: '6px 0 0',
              }}>
                {accountData.email}
              </p>

              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                <a
                  href={ACCOUNTS_WEB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontFamily: "'Lora', Georgia, serif",
                    fontStyle: 'italic',
                    fontSize: '13px',
                    color: C.accent,
                    textDecoration: 'none',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#A82F12')}
                  onMouseLeave={e => (e.currentTarget.style.color = C.accent)}
                >
                  <span>Manage your Empowered account</span>
                  <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>

                {isAdmin && (
                  <Link
                    to="/admin"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontFamily: "'Lora', Georgia, serif",
                      fontStyle: 'italic',
                      fontSize: '13px',
                      color: C.accent,
                      textDecoration: 'none',
                    }}
                  >
                    <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Admin Panel</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* XP + Gems strip */}
          {accountData.connected_profile && (
            <div style={{
              display: 'flex',
              marginTop: '24px',
              borderTop: `1px solid ${C.rule}`,
              borderBottom: `1px solid ${C.rule}`,
            }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '14px 8px', borderRight: `1px solid ${C.rule}` }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(34px, 2.6vw, 48px)', lineHeight: 1, color: C.amber }}>
                  {(() => {
                    const raw = accountData.connected_profile?.xp;
                    const n = typeof raw === 'object' && raw !== null ? (raw.total_xp ?? raw.total) : raw;
                    return (n ?? 0).toLocaleString();
                  })()}
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.18em', fontSize: '10px', color: C.mutedFg, marginTop: '3px' }}>
                  XP
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '14px 8px' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(34px, 2.6vw, 48px)', lineHeight: 1, color: C.gems }}>
                  {(accountData.connected_profile?.gem_balance ?? 0).toLocaleString()}
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.18em', fontSize: '10px', color: C.mutedFg, marginTop: '3px' }}>
                  GEMS
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Stats section ─────────────────────────────────────────────────────────────

  const statsSection = (
    <div style={{ paddingTop: '32px' }}>
      <SectionHeader label="STATISTICS" colors={C} />

      {triviaError && <ErrorNotice message="Couldn't load game stats. Try refreshing the page." />}

      {triviaStats && triviaStats.gamesPlayed === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted, fontSize: '15px', margin: 0 }}>
            No games played yet.
          </p>
          <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.mutedFg, fontSize: '14px', marginTop: '6px' }}>
            Play your first game to start tracking your stats.
          </p>
          <PlayButton label="PLAY YOUR FIRST GAME" />
        </div>
      )}

      {triviaStats && triviaStats.gamesPlayed > 0 && (
        <div style={{
          display: 'flex',
          borderTop: `1px solid ${C.rule}`,
          borderBottom: `1px solid ${C.rule}`,
        }}>
          {[
            { label: 'GAMES PLAYED', value: triviaStats.gamesPlayed.toLocaleString() },
            { label: 'BEST SCORE',   value: triviaStats.bestScore.toLocaleString() },
            { label: 'ACCURACY',     value: `${triviaStats.overallAccuracy}%` },
          ].map((stat, i, arr) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '16px 8px',
                borderRight: i < arr.length - 1 ? `1px solid ${C.rule}` : 'none',
              }}
            >
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 2.8vw, 50px)', lineHeight: 1, color: C.ink }}>
                {stat.value}
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.15em', fontSize: '10px', color: C.mutedFg, marginTop: '4px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Settings section ──────────────────────────────────────────────────────────

  const settingsSection = (
    <div style={{ paddingTop: '32px' }}>
      <SectionHeader label="SETTINGS" colors={C} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{
            fontFamily: "'Lora', Georgia, serif",
            fontWeight: 600,
            fontSize: '16px',
            color: C.ink,
            margin: 0,
          }}>
            Appearance
          </h3>
          <p style={{
            fontFamily: "'Lora', Georgia, serif",
            fontStyle: 'italic',
            fontSize: '13px',
            color: C.muted,
            margin: '4px 0 0',
          }}>
            Choose your preferred color scheme
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0', border: `1px solid ${C.rule}`, borderRadius: '2px', overflow: 'hidden' }}>
          {(['light', 'dark'] as const).map((mode) => {
            const isActive = mode === 'dark' ? darkMode : !darkMode;
            return (
              <button
                key={mode}
                onClick={toggleDarkMode}
                style={{
                  padding: '8px 20px',
                  minHeight: '40px',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '15px',
                  letterSpacing: '0.1em',
                  border: 'none',
                  background: isActive ? C.accent : 'transparent',
                  color: isActive ? '#FFFFFF' : C.muted,
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {mode === 'light' ? '☀ LIGHT' : '☾ DARK'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── XP History tab ────────────────────────────────────────────────────────────

  const historyTab = (
    <div style={{ paddingTop: '8px' }}>
      <SectionHeader label="XP HISTORY" colors={C} />

      {/* Loading */}
      {historyLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: '44px', background: C.ruleLight, borderRadius: '2px' }}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {historyError && <ErrorNotice message={historyError} />}

      {/* Empty */}
      {!historyLoading && !historyError && historyData?.total === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted, fontSize: '14px', margin: 0 }}>
            No games yet — play your first game to start earning XP!
          </p>
          <PlayButton label="PLAY A GAME" />
        </div>
      )}

      {/* Data */}
      {!historyLoading && !historyError && historyData && historyData.total > 0 && (
        <>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.14em', color: C.mutedFg, marginBottom: '12px' }}>
            {historyData.total} GAMES PLAYED
          </p>

          <div>
            {historyData.entries.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '11px 0',
                  borderBottom: `1px solid ${C.ruleLight}`,
                  gap: '12px',
                }}
              >
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  color: C.mutedFg,
                  width: '72px',
                  flexShrink: 0,
                }}>
                  {formatDate(entry.createdAt)}
                </span>
                <span style={{
                  fontFamily: "'Lora', Georgia, serif",
                  fontStyle: 'italic',
                  fontSize: '13px',
                  color: C.inkLight,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.collectionSlug
                    ? entry.collectionSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    : '—'}
                </span>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '15px',
                  color: C.ink,
                  width: '64px',
                  textAlign: 'right',
                  flexShrink: 0,
                }}>
                  {entry.score !== null ? entry.score.toLocaleString() : '—'}
                </span>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '13px',
                  color: C.muted,
                  width: '40px',
                  textAlign: 'right',
                  flexShrink: 0,
                }}>
                  {entry.correctAnswers !== null ? `${entry.correctAnswers}/10` : '—'}
                </span>
                <div style={{ width: '72px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <XpBadge amount={entry.amount} colors={C} />
                  {entry.isDuplicate && (
                    <span style={{ fontSize: '11px', color: C.mutedFg, fontStyle: 'italic' }}>×</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {historyData.totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '24px' }}>
              {(['prev', ...Array.from({ length: historyData.totalPages }, (_, i) => i + 1), 'next'] as const).map((item) => {
                if (item === 'prev') {
                  return (
                    <button
                      key="prev"
                      onClick={() => setHistoryPage(p => p - 1)}
                      disabled={historyPage === 1}
                      style={{
                        padding: '6px 12px',
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '13px',
                        letterSpacing: '0.1em',
                        background: 'transparent',
                        border: `1px solid ${C.rule}`,
                        color: C.muted,
                        borderRadius: '2px',
                        cursor: historyPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: historyPage === 1 ? 0.4 : 1,
                      }}
                    >
                      PREV
                    </button>
                  );
                }
                if (item === 'next') {
                  return (
                    <button
                      key="next"
                      onClick={() => setHistoryPage(p => p + 1)}
                      disabled={historyPage === historyData.totalPages}
                      style={{
                        padding: '6px 12px',
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '13px',
                        letterSpacing: '0.1em',
                        background: 'transparent',
                        border: `1px solid ${C.rule}`,
                        color: C.muted,
                        borderRadius: '2px',
                        cursor: historyPage === historyData.totalPages ? 'not-allowed' : 'pointer',
                        opacity: historyPage === historyData.totalPages ? 0.4 : 1,
                      }}
                    >
                      NEXT
                    </button>
                  );
                }
                const p = item as number;
                const isActive = p === historyPage;
                return (
                  <button
                    key={p}
                    onClick={() => setHistoryPage(p)}
                    style={{
                      padding: '6px 10px',
                      minWidth: '32px',
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: '13px',
                      letterSpacing: '0.06em',
                      background: isActive ? C.accent : 'transparent',
                      border: isActive ? `1px solid ${C.accent}` : `1px solid ${C.rule}`,
                      color: isActive ? '#FFFFFF' : C.muted,
                      borderRadius: '2px',
                      cursor: 'pointer',
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── Page wrapper ──────────────────────────────────────────────────────────────

  const pageShell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: C.paper, fontFamily: "'Lora', Georgia, serif" }}>
      <Header />
      <div style={{ padding: '32px 24px 80px' }}>
        {children}
      </div>
    </div>
  );

  // Non-Connected: no tabs
  if (!tierResolved || !isConnected) {
    return pageShell(
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {heroSection}
        {statsSection}
        {settingsSection}
      </div>
    );
  }

  // Connected / Empowered: two-tab layout
  return pageShell(
    <>
      {heroSection}

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.rule}`, marginTop: '32px' }}>
        {(['overview', 'history'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 24px',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '14px',
                letterSpacing: '0.18em',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                color: isActive ? C.ink : C.muted,
                cursor: 'pointer',
                marginBottom: '-1px',
                transition: 'color 0.15s',
              }}
            >
              {tab === 'overview' ? 'OVERVIEW' : 'XP HISTORY'}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {statsSection}
          {settingsSection}
        </div>
      )}

      {activeTab === 'history' && historyTab}
    </>
  );
}

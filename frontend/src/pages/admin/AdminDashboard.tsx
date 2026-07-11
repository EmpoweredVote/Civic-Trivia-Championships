import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { API_URL } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';

const ADMIN_ACCENT = '#FF5740';

interface CollectionHealth {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  themeColor: string;
  stats: {
    activeCount: number;
    archivedCount: number;
    totalCount: number;
    difficulty: { easy: number; medium: number; hard: number };
    quality: { avgScore: number | null; minScore: number | null; unscoredCount: number };
    telemetry: { totalEncounters: number; totalCorrect: number; overallCorrectRate: number | null };
  };
}

export function AdminDashboard() {
  const { user, accessToken } = useAuthStore();
  const { C } = useTheme();
  const [collections, setCollections] = useState<CollectionHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/admin/collections/health`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch collection health data');
      }

      const data = await response.json();
      setCollections(data.collections || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary stats
  const totalActiveQuestions = collections.reduce((sum, c) => sum + c.stats.activeCount, 0);
  const totalCollections = collections.filter(c => c.isActive).length;

  // Calculate weighted average quality score
  let totalQualityScore = 0;
  let totalScoredQuestions = 0;
  collections.forEach(c => {
    if (c.stats.quality.avgScore !== null) {
      const scoredCount = c.stats.activeCount - c.stats.quality.unscoredCount;
      totalQualityScore += c.stats.quality.avgScore * scoredCount;
      totalScoredQuestions += scoredCount;
    }
  });
  const avgQualityScore = totalScoredQuestions > 0 ? totalQualityScore / totalScoredQuestions : null;

  // Calculate overall correct rate
  const totalEncounters = collections.reduce((sum, c) => sum + c.stats.telemetry.totalEncounters, 0);
  const totalCorrect = collections.reduce((sum, c) => sum + c.stats.telemetry.totalCorrect, 0);
  const overallCorrectRate = totalEncounters > 0 ? totalCorrect / totalEncounters : null;

  // Find collections needing attention
  const collectionsNeedingAttention = collections.filter(c => {
    if (!c.isActive) return false;
    const hasLowCount = c.stats.activeCount < 50;
    const hasLowQuality = c.stats.quality.avgScore !== null && c.stats.quality.avgScore < 70;
    return hasLowCount || hasLowQuality;
  });

  const sectionHeaderStyle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '12px',
    letterSpacing: '0.22em',
    color: C.muted,
    borderTop: `1px solid ${C.rule}`,
    paddingTop: '12px',
    marginBottom: '16px',
  };

  const statCardStyle: React.CSSProperties = {
    border: `1px solid ${C.rule}`,
    borderRadius: '2px',
    padding: '24px',
    backgroundColor: 'transparent',
  };

  return (
    <div>
      {/* Welcome section */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(28px, 5vw, 40px)',
          color: C.ink,
          letterSpacing: '0.06em',
          margin: 0,
        }}>
          Welcome, {user?.email || 'Admin'}
        </h1>
        <p style={{
          fontFamily: "'Lora', Georgia, serif",
          fontStyle: 'italic',
          color: C.muted,
          marginTop: '8px',
          marginBottom: 0,
        }}>
          Overview of content health and admin tools
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}
          className="lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...statCardStyle, opacity: 0.5 }}>
              <div style={{ height: '12px', backgroundColor: C.ruleLight, borderRadius: '2px', width: '50%', marginBottom: '12px' }} />
              <div style={{ height: '32px', backgroundColor: C.ruleLight, borderRadius: '2px', width: '75%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          border: `1px solid ${C.incorrect}`,
          borderRadius: '2px',
          padding: '16px',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" style={{ color: C.incorrect, marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '14px', color: C.ink, margin: 0 }}>{error}</p>
          </div>
          <button
            onClick={fetchCollections}
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '13px',
              letterSpacing: '0.1em',
              color: ADMIN_ACCENT,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* Stats overview row */}
      {!loading && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}
            className="lg:grid-cols-4">
            {/* Total Active Questions */}
            <div style={statCardStyle}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '11px',
                letterSpacing: '0.16em',
                color: C.mutedFg,
                marginBottom: '8px',
              }}>
                TOTAL ACTIVE QUESTIONS
              </div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(40px, 3vw, 50px)',
                color: C.ink,
                lineHeight: 1,
              }}>
                {totalActiveQuestions.toLocaleString()}
              </div>
            </div>

            {/* Total Collections */}
            <div style={statCardStyle}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '11px',
                letterSpacing: '0.16em',
                color: C.mutedFg,
                marginBottom: '8px',
              }}>
                ACTIVE COLLECTIONS
              </div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(40px, 3vw, 50px)',
                color: C.ink,
                lineHeight: 1,
              }}>
                {totalCollections}
              </div>
            </div>

            {/* Avg Quality Score */}
            <div style={statCardStyle}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '11px',
                letterSpacing: '0.16em',
                color: C.mutedFg,
                marginBottom: '8px',
              }}>
                AVG QUALITY SCORE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 'clamp(40px, 3vw, 50px)',
                  color: C.ink,
                  lineHeight: 1,
                }}>
                  {avgQualityScore !== null ? Math.round(avgQualityScore) : 'N/A'}
                </div>
                {avgQualityScore !== null && (
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor:
                      avgQualityScore >= 70 ? C.correct :
                      avgQualityScore >= 50 ? '#B8860B' : C.incorrect,
                  }} />
                )}
              </div>
            </div>

            {/* Overall Correct Rate */}
            <div style={statCardStyle}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '11px',
                letterSpacing: '0.16em',
                color: C.mutedFg,
                marginBottom: '8px',
              }}>
                OVERALL CORRECT RATE
              </div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(40px, 3vw, 50px)',
                color: C.ink,
                lineHeight: 1,
              }}>
                {overallCorrectRate !== null ? `${Math.round(overallCorrectRate * 100)}%` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Collections needing attention */}
          <div style={{ marginBottom: '32px' }}>
            <div style={sectionHeaderStyle}>COLLECTIONS NEEDING ATTENTION</div>
            {collectionsNeedingAttention.length === 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${C.correct}`,
                borderRadius: '2px',
                padding: '16px',
              }}>
                <svg width="20" height="20" style={{ color: C.correct, marginRight: '8px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '13px',
                  letterSpacing: '0.1em',
                  color: C.correct,
                }}>
                  ALL COLLECTIONS HEALTHY
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {collectionsNeedingAttention.map(c => {
                  const hasLowCount = c.stats.activeCount < 50;
                  const hasLowQuality = c.stats.quality.avgScore !== null && c.stats.quality.avgScore < 70;
                  const isCritical = c.stats.activeCount < 50 || (c.stats.quality.avgScore !== null && c.stats.quality.avgScore < 50);

                  return (
                    <div key={c.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      border: `1px solid ${C.ruleLight}`,
                      borderRadius: '2px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          flexShrink: 0,
                          backgroundColor: isCritical ? C.incorrect : '#B8860B',
                        }} />
                        <div>
                          <div style={{
                            fontFamily: "'Bebas Neue', sans-serif",
                            fontSize: '14px',
                            letterSpacing: '0.08em',
                            color: C.ink,
                          }}>
                            {c.name}
                          </div>
                          <div style={{
                            fontFamily: "'Lora', Georgia, serif",
                            fontSize: '12px',
                            color: C.muted,
                          }}>
                            {hasLowCount && `Only ${c.stats.activeCount} active questions`}
                            {hasLowCount && hasLowQuality && ' • '}
                            {hasLowQuality && `Low quality score (${Math.round(c.stats.quality.avgScore!)})`}
                          </div>
                        </div>
                      </div>
                      <Link
                        to="/admin/collections"
                        style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: '12px',
                          letterSpacing: '0.1em',
                          color: ADMIN_ACCENT,
                          textDecoration: 'none',
                        }}
                      >
                        INVESTIGATE
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links section */}
          <div>
            <div style={sectionHeaderStyle}>QUICK LINKS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="md:grid-cols-2">
              {/* Question Explorer card */}
              <Link
                to="/admin/questions"
                style={{
                  display: 'block',
                  border: `1px solid ${C.rule}`,
                  borderRadius: '2px',
                  padding: '24px',
                  textDecoration: 'none',
                  backgroundColor: 'transparent',
                  transition: 'border-color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = ADMIN_ACCENT)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.rule)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  border: `1px solid ${C.rule}`,
                  borderRadius: '2px',
                  marginBottom: '16px',
                }}>
                  <svg width="20" height="20" style={{ color: ADMIN_ACCENT }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '18px',
                  letterSpacing: '0.1em',
                  color: C.ink,
                  margin: '0 0 8px 0',
                }}>
                  Question Explorer
                </h3>
                <p style={{
                  fontFamily: "'Lora', Georgia, serif",
                  fontSize: '13px',
                  color: C.muted,
                  margin: 0,
                }}>
                  Browse, filter, and inspect all questions
                </p>
              </Link>

              {/* Collection Health card */}
              <Link
                to="/admin/collections"
                style={{
                  display: 'block',
                  border: `1px solid ${C.rule}`,
                  borderRadius: '2px',
                  padding: '24px',
                  textDecoration: 'none',
                  backgroundColor: 'transparent',
                  transition: 'border-color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = ADMIN_ACCENT)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.rule)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  border: `1px solid ${C.rule}`,
                  borderRadius: '2px',
                  marginBottom: '16px',
                }}>
                  <svg width="20" height="20" style={{ color: ADMIN_ACCENT }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '18px',
                  letterSpacing: '0.1em',
                  color: C.ink,
                  margin: '0 0 8px 0',
                }}>
                  Collection Health
                </h3>
                <p style={{
                  fontFamily: "'Lora', Georgia, serif",
                  fontSize: '13px',
                  color: C.muted,
                  margin: 0,
                }}>
                  Monitor question counts and quality
                </p>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

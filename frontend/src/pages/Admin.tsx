import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { useAdminQuestions } from '../features/admin/hooks/useAdminQuestions';
import type { StatusFilter } from '../features/admin/types';
import { useTheme } from '../hooks/useTheme';

const ADMIN_ACCENT = '#FF5740';

export function Admin() {
  const { C } = useTheme();
  const {
    questions,
    loading,
    error,
    filter,
    setFilter,
    renewQuestion,
    archiveQuestion,
  } = useAdminQuestions();

  const [renewingId, setRenewingId] = useState<number | null>(null);
  const [renewDate, setRenewDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const getDefaultRenewDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  };

  const handleRenewClick = (id: number) => {
    setRenewingId(id);
    setRenewDate(getDefaultRenewDate());
  };

  const handleRenewSubmit = async (id: number) => {
    if (!renewDate) return;
    setActionLoading(true);
    try {
      await renewQuestion(id, renewDate);
      setRenewingId(null);
      setRenewDate('');
    } catch (err: any) {
      alert(err?.error || 'Failed to renew question');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveClick = async (id: number) => {
    const confirmed = window.confirm(
      'Archive this question permanently? It will not appear in any future games.'
    );
    if (!confirmed) return;
    setActionLoading(true);
    try {
      await archiveQuestion(id);
    } catch (err: any) {
      alert(err?.error || 'Failed to archive question');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No expiry';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (question: typeof questions[0]) => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '2px',
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: '11px',
      letterSpacing: '0.1em',
    };
    if (question.status === 'archived')
      return <span style={{ ...base, backgroundColor: C.ruleLight, color: C.muted }}>ARCHIVED</span>;
    if (question.status === 'expired')
      return <span style={{ ...base, backgroundColor: 'rgba(192,21,42,0.12)', color: C.incorrect }}>EXPIRED</span>;
    if (question.expiresAt)
      return <span style={{ ...base, backgroundColor: 'rgba(184,134,11,0.12)', color: '#92400E' }}>EXPIRING SOON</span>;
    return <span style={{ ...base, backgroundColor: 'rgba(37,92,63,0.12)', color: C.correct }}>ACTIVE</span>;
  };

  const getDifficultyBadge = (difficulty: string) => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '2px',
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: '11px',
      letterSpacing: '0.1em',
    };
    const variants: Record<string, React.CSSProperties> = {
      easy:   { backgroundColor: 'rgba(37,92,63,0.12)',  color: C.correct },
      medium: { backgroundColor: 'rgba(184,134,11,0.12)', color: '#92400E' },
      hard:   { backgroundColor: 'rgba(192,21,42,0.12)', color: C.incorrect },
    };
    return <span style={{ ...base, ...(variants[difficulty] || variants.medium) }}>{difficulty.toUpperCase()}</span>;
  };

  const filterTabs: { value: StatusFilter; label: string }[] = [
    { value: 'all',           label: 'All' },
    { value: 'expired',       label: 'Expired' },
    { value: 'expiring-soon', label: 'Expiring Soon' },
    { value: 'archived',      label: 'Archived' },
  ];

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: `1px solid ${C.rule}`,
    borderRadius: '2px',
    backgroundColor: C.paper,
    color: C.ink,
    fontFamily: "'Lora', Georgia, serif",
    fontSize: '13px',
    outline: 'none',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '6px 14px',
    backgroundColor: ADMIN_ACCENT,
    color: '#fff',
    border: 'none',
    borderRadius: '2px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '13px',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '6px 14px',
    backgroundColor: 'transparent',
    color: C.muted,
    border: `1px solid ${C.rule}`,
    borderRadius: '2px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '13px',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.paper }}>
      <Header />

      <main style={{ maxWidth: 'clamp(1280px, 85vw, 2400px)', margin: '0 auto', padding: '24px 16px' }} className="sm:px-6 lg:px-8">
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '24px' }}>
          {/* Page Header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '28px',
              letterSpacing: '0.08em',
              color: C.ink,
              margin: '0 0 4px 0',
            }}>
              Content Review
            </h1>
            <p style={{
              fontFamily: "'Lora', Georgia, serif",
              fontStyle: 'italic',
              fontSize: '13px',
              color: C.muted,
              margin: 0,
            }}>
              Manage expired and expiring-soon questions
            </p>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.rule}`, marginBottom: '24px' }}>
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                style={{
                  padding: '10px 20px',
                  minHeight: '44px',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '13px',
                  letterSpacing: '0.12em',
                  background: 'none',
                  border: 'none',
                  borderBottom: filter === tab.value ? `3px solid ${ADMIN_ACCENT}` : '3px solid transparent',
                  color: filter === tab.value ? ADMIN_ACCENT : C.muted,
                  cursor: 'pointer',
                  marginBottom: '-1px',
                }}
              >
                {tab.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <div style={{
                width: '40px', height: '40px',
                border: `3px solid ${C.ruleLight}`,
                borderTopColor: ADMIN_ACCENT,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{ border: `1px solid ${C.incorrect}`, borderRadius: '2px', padding: '16px', marginBottom: '24px' }}>
              <p style={{ fontFamily: "'Lora', Georgia, serif", color: C.incorrect, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Questions List */}
          {!loading && !error && (
            <>
              {questions.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: '16px' }}>
                  <div style={{
                    width: '56px', height: '56px',
                    border: `1px solid ${C.correct}`,
                    borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="28" height="28" style={{ color: C.correct }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '16px', color: C.muted, margin: 0 }}>
                    {filter === 'expired' && 'No expired questions found'}
                    {filter === 'expiring-soon' && 'No expiring-soon questions found'}
                    {filter === 'archived' && 'No archived questions found'}
                    {filter === 'all' && 'No questions need attention'}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Desktop: Table View */}
                  <div className="hidden lg:block" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Status', 'Question', 'Collections', 'Difficulty', 'Expires At', 'Actions'].map(h => (
                            <th key={h} style={{
                              padding: '10px 16px',
                              textAlign: 'left',
                              fontFamily: "'Bebas Neue', sans-serif",
                              fontSize: '11px',
                              letterSpacing: '0.14em',
                              color: C.muted,
                              borderBottom: `1px solid ${C.rule}`,
                              whiteSpace: 'nowrap',
                            }}>
                              {h.toUpperCase()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((question) => (
                          <tr key={question.id} style={{ borderBottom: `1px solid ${C.ruleLight}` }}>
                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                              {getStatusBadge(question)}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink }}>
                                {question.text.length > 80 ? `${question.text.substring(0, 80)}...` : question.text}
                              </div>
                              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', color: C.mutedFg, marginTop: '4px' }}>
                                {question.externalId}
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {question.collectionNames.map((name) => (
                                  <span key={name} style={{
                                    fontFamily: "'Bebas Neue', sans-serif",
                                    fontSize: '10px',
                                    letterSpacing: '0.08em',
                                    padding: '2px 6px',
                                    border: `1px solid ${C.rule}`,
                                    borderRadius: '2px',
                                    color: C.muted,
                                  }}>{name}</span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                              {getDifficultyBadge(question.difficulty)}
                            </td>
                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink }}>
                              {formatDate(question.expiresAt)}
                            </td>
                            <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                              {renewingId === question.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} style={inputStyle} disabled={actionLoading} />
                                  <button onClick={() => handleRenewSubmit(question.id)} disabled={actionLoading} style={{ ...btnPrimary, opacity: actionLoading ? 0.5 : 1 }}>SAVE</button>
                                  <button onClick={() => setRenewingId(null)} disabled={actionLoading} style={{ ...btnSecondary, opacity: actionLoading ? 0.5 : 1 }}>CANCEL</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {(question.status === 'expired' || (question.status === 'active' && question.expiresAt)) && (
                                    <button onClick={() => handleRenewClick(question.id)} disabled={actionLoading} style={{ ...btnPrimary, minHeight: '36px', opacity: actionLoading ? 0.5 : 1 }}>RENEW</button>
                                  )}
                                  {question.status === 'expired' && (
                                    <button onClick={() => handleArchiveClick(question.id)} disabled={actionLoading} style={{ ...btnSecondary, minHeight: '36px', opacity: actionLoading ? 0.5 : 1 }}>ARCHIVE</button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: Card View */}
                  <div className="lg:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {questions.map((question) => (
                      <div key={question.id} style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                              {getStatusBadge(question)}
                              {getDifficultyBadge(question.difficulty)}
                            </div>
                            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, margin: '0 0 4px 0' }}>
                              {question.text.length > 80 ? `${question.text.substring(0, 80)}...` : question.text}
                            </p>
                            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', color: C.mutedFg, margin: 0 }}>{question.externalId}</p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '12px 0' }}>
                          {question.collectionNames.map((name) => (
                            <span key={name} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', letterSpacing: '0.08em', padding: '2px 6px', border: `1px solid ${C.rule}`, borderRadius: '2px', color: C.muted }}>{name}</span>
                          ))}
                        </div>

                        <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.muted, marginBottom: '12px' }}>
                          <span style={{ fontWeight: 600 }}>Expires:</span> {formatDate(question.expiresAt)}
                        </div>

                        {renewingId === question.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} disabled={actionLoading} />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleRenewSubmit(question.id)} disabled={actionLoading} style={{ ...btnPrimary, flex: 1, minHeight: '44px', opacity: actionLoading ? 0.5 : 1 }}>SAVE</button>
                              <button onClick={() => setRenewingId(null)} disabled={actionLoading} style={{ ...btnSecondary, flex: 1, minHeight: '44px', opacity: actionLoading ? 0.5 : 1 }}>CANCEL</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {(question.status === 'expired' || (question.status === 'active' && question.expiresAt)) && (
                              <button onClick={() => handleRenewClick(question.id)} disabled={actionLoading} style={{ ...btnPrimary, flex: 1, minHeight: '44px', opacity: actionLoading ? 0.5 : 1 }}>RENEW</button>
                            )}
                            {question.status === 'expired' && (
                              <button onClick={() => handleArchiveClick(question.id)} disabled={actionLoading} style={{ ...btnSecondary, flex: 1, minHeight: '44px', opacity: actionLoading ? 0.5 : 1 }}>ARCHIVE</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

import { Fragment, useEffect, useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { API_URL } from '../../../services/api';
import { useTheme } from '../../../hooks/useTheme';
import { useWindowSize } from '../../../hooks/useWindowSize';

const ADMIN_ACCENT = '#FF5740';

interface FlagEntry {
  id: number;
  userId: number;
  username: string;
  reasons: string[];
  elaboration: string | null;
  createdAt: string;
}

interface QuestionDetail {
  id: number;
  externalId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  source: {
    name: string;
    url: string | null;
  };
  learningContent: string | null;
  status: string;
}

interface FlagDetailResponse {
  question: QuestionDetail;
  flags: FlagEntry[];
}

interface FlagDetailPanelProps {
  questionId: number | null;
  onClose: () => void;
  onQuestionArchived: (questionId: number) => void;
  onFlagsDismissed: (questionId: number) => void;
  onQuestionRestored: (questionId: number) => void;
  onRefreshNeeded: () => void;
}

interface ToastState {
  message: string;
  undoCallback: (() => void) | null;
  visible: boolean;
}

function useUndoToast() {
  const [toast, setToast] = useState<ToastState>({ message: '', undoCallback: null, visible: false });
  const timeoutRef = useRef<number | undefined>(undefined);

  const showToast = (message: string, undoCallback: () => void) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ message, undoCallback, visible: true });
    timeoutRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 5000);
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return { toast, showToast, hideToast };
}

function Toast({ message, undoCallback, visible, onClose, onUndo }: ToastState & { onClose: () => void; onUndo: () => void }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: '#1C1510',
      color: '#ECE7D9',
      padding: '12px 16px',
      borderRadius: '2px',
      border: '1px solid #3D2E22',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 50,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    }}>
      <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px' }}>{message}</span>
      {undoCallback && (
        <button onClick={onUndo} style={{ color: '#D4A017', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px', letterSpacing: '0.1em' }}>
          UNDO
        </button>
      )}
      <button onClick={onClose} style={{ color: '#7A6A5A', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
    </div>
  );
}

export function FlagDetailPanel({
  questionId,
  onClose,
  onQuestionArchived,
  onFlagsDismissed,
  onQuestionRestored,
  onRefreshNeeded,
}: FlagDetailPanelProps) {
  const { accessToken } = useAuthStore();
  const { C } = useTheme();
  const [questionDetail, setQuestionDetail] = useState<QuestionDetail | null>(null);
  const [flags, setFlags] = useState<FlagEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFlags, setExpandedFlags] = useState<Set<number>>(new Set());
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const { toast, showToast, hideToast } = useUndoToast();

  useEffect(() => {
    if (questionId === null || !accessToken) {
      setQuestionDetail(null);
      setFlags([]);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/admin/flags/${questionId}/detail`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error('Failed to fetch flag details');
        const data: FlagDetailResponse = await response.json();
        setQuestionDetail(data.question);
        setFlags(data.flags);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [questionId, accessToken]);

  const handleArchive = async () => {
    if (!questionDetail || pendingAction) return;
    setPendingAction('archiving');
    onQuestionArchived(questionDetail.id);
    onClose();
    showToast('Question archived', async () => {
      try {
        await fetch(`${API_URL}/api/admin/flags/${questionDetail.id}/restore`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        onRefreshNeeded();
      } catch (err) {
        setError('Failed to restore question');
        onRefreshNeeded();
      }
    });
    try {
      const response = await fetch(`${API_URL}/api/admin/flags/${questionDetail.id}/archive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to archive question');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive');
      onRefreshNeeded();
    } finally {
      setPendingAction(null);
    }
  };

  const handleDismiss = async () => {
    if (!questionDetail || pendingAction) return;
    const confirmed = window.confirm('Dismiss all flags for this question? This will remove all player feedback.');
    if (!confirmed) return;
    setPendingAction('dismissing');
    onFlagsDismissed(questionDetail.id);
    onClose();
    try {
      const response = await fetch(`${API_URL}/api/admin/flags/${questionDetail.id}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to dismiss flags');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss flags');
      onRefreshNeeded();
    } finally {
      setPendingAction(null);
    }
  };

  const handleRestore = async () => {
    if (!questionDetail || pendingAction) return;
    setPendingAction('restoring');
    onQuestionRestored(questionDetail.id);
    onClose();
    try {
      const response = await fetch(`${API_URL}/api/admin/flags/${questionDetail.id}/restore`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to restore question');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore');
      onRefreshNeeded();
    } finally {
      setPendingAction(null);
    }
  };

  const toggleFlagExpansion = (flagId: number) => {
    setExpandedFlags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(flagId)) newSet.delete(flagId); else newSet.add(flagId);
      return newSet;
    });
  };

  const getAggregateReasonSummary = () => {
    const breakdown: Record<string, number> = {};
    for (const flag of flags) {
      for (const reason of flag.reasons || []) {
        breakdown[reason] = (breakdown[reason] || 0) + 1;
      }
    }
    return breakdown;
  };

  const getReasonStyle = (reason: string): { label: string; bg: string; color: string } => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      'confusing-wording': { label: 'Confusing', bg: 'rgba(184,134,11,0.12)', color: '#92400E' },
      'outdated-info':     { label: 'Outdated',  bg: 'rgba(30,90,138,0.12)',  color: '#1E5A8A' },
      'wrong-answer':      { label: 'Wrong',     bg: 'rgba(192,21,42,0.12)',  color: C.incorrect },
      'not-interesting':   { label: 'Boring',    bg: C.ruleLight,             color: C.muted },
    };
    return map[reason] || { label: reason, bg: C.ruleLight, color: C.muted };
  };

  const isOpen = questionId !== null;
  const { width } = useWindowSize();
  const isMobile = width < 768;

  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px',
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
    padding: '8px 16px',
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
    <>
      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={onClose}>
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
          </Transition.Child>

          {/* Panel */}
          <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <div style={{ pointerEvents: 'none', position: 'fixed', top: 0, bottom: 0, right: 0, display: 'flex', maxWidth: '100%', paddingLeft: isMobile ? '0' : '40px' }}>
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-300"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-300"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel style={{ pointerEvents: 'auto', width: '100vw', maxWidth: isMobile ? '100%' : 'clamp(672px, 45vw, 960px)' }}>
                    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', backgroundColor: C.paper, borderLeft: `1px solid ${C.rule}` }}>
                      {/* Header */}
                      <div style={{ backgroundColor: '#3D2E22', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                        <Dialog.Title style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: '18px',
                          letterSpacing: '0.12em',
                          color: '#ECE7D9',
                          margin: 0,
                        }}>
                          FLAG DETAILS
                        </Dialog.Title>
                        <button
                          onClick={onClose}
                          style={{ padding: '6px', color: '#C8BAA6', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '2px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          aria-label="Close panel"
                        >
                          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Body */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                        {loading && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.5 }}>
                            {[...Array(4)].map((_, i) => (
                              <div key={i} style={{ height: i === 0 ? '32px' : '14px', backgroundColor: C.ruleLight, borderRadius: '2px', width: i === 0 ? '75%' : '100%' }} />
                            ))}
                          </div>
                        )}

                        {error && !loading && (
                          <div style={{ border: `1px solid ${C.incorrect}`, borderRadius: '2px', padding: '12px 16px' }}>
                            <p style={{ fontFamily: "'Lora', Georgia, serif", color: C.incorrect, margin: 0, fontSize: '13px' }}>{error}</p>
                          </div>
                        )}

                        {!loading && questionDetail && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Flag Summary */}
                            <div style={{ padding: '16px', border: `1px solid ${C.rule}`, borderRadius: '2px', backgroundColor: C.ruleLight }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <svg width="18" height="18" style={{ color: ADMIN_ACCENT }} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                </svg>
                                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', letterSpacing: '0.1em', color: C.ink }}>
                                  {flags.length} {flags.length === 1 ? 'FLAG' : 'FLAGS'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {Object.entries(getAggregateReasonSummary()).map(([reason, count]) => {
                                  const { label, bg, color } = getReasonStyle(reason);
                                  return (
                                    <span key={reason} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '2px', backgroundColor: bg, color }}>
                                      {label} ×{count}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {questionDetail.status === 'active' ? (
                                <>
                                  <button onClick={handleArchive} disabled={!!pendingAction} style={{ ...btnPrimary, backgroundColor: C.incorrect, opacity: pendingAction ? 0.5 : 1, cursor: pendingAction ? 'not-allowed' : 'pointer' }}>
                                    ARCHIVE QUESTION
                                  </button>
                                  <button onClick={handleDismiss} disabled={!!pendingAction} style={{ ...btnSecondary, opacity: pendingAction ? 0.5 : 1, cursor: pendingAction ? 'not-allowed' : 'pointer' }}>
                                    DISMISS FLAGS
                                  </button>
                                </>
                              ) : (
                                <button onClick={handleRestore} disabled={!!pendingAction} style={{ ...btnPrimary, backgroundColor: C.correct, opacity: pendingAction ? 0.5 : 1, cursor: pendingAction ? 'not-allowed' : 'pointer' }}>
                                  RESTORE QUESTION
                                </button>
                              )}
                            </div>

                            {/* Question Context */}
                            <div>
                              <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '18px', fontWeight: 700, color: C.ink, margin: '0 0 16px 0' }}>
                                {questionDetail.text}
                              </h3>

                              {/* Answer options */}
                              <div style={{ marginBottom: '16px' }}>
                                <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px 0' }}>ANSWER OPTIONS</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {questionDetail.options.map((optionText, idx) => {
                                    const isCorrect = questionDetail.correctAnswer === idx;
                                    const label = String.fromCharCode(65 + idx);
                                    return (
                                      <div key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        padding: '10px 12px',
                                        borderRadius: '2px',
                                        border: `1px solid ${isCorrect ? C.correct : C.rule}`,
                                        backgroundColor: isCorrect ? 'rgba(37,92,63,0.08)' : 'transparent',
                                      }}>
                                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', letterSpacing: '0.08em', color: C.muted, marginRight: '8px', flexShrink: 0 }}>{label}.</span>
                                        <div style={{ flex: 1 }}>
                                          <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink }}>{optionText}</span>
                                          {isCorrect && (
                                            <svg width="18" height="18" style={{ display: 'inline', marginLeft: '6px', color: C.correct, verticalAlign: 'middle' }} fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Explanation */}
                              <div style={{ marginBottom: '16px' }}>
                                <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px 0' }}>EXPLANATION</h4>
                                <div style={{ padding: '12px 16px', border: `1px solid ${C.rule}`, borderRadius: '2px' }}>
                                  <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, margin: 0 }}>{questionDetail.explanation}</p>
                                </div>
                              </div>

                              {/* Learn More */}
                              <div style={{ marginBottom: '16px' }}>
                                <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px 0' }}>LEARN MORE</h4>
                                {questionDetail.source.url ? (
                                  <a href={questionDetail.source.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: ADMIN_ACCENT, textDecoration: 'underline' }}>
                                    {questionDetail.source.name}
                                    <svg width="14" height="14" style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.mutedFg }}>
                                    {questionDetail.source.name || 'No source provided'}
                                  </span>
                                )}
                              </div>

                              {/* Learning Content */}
                              {questionDetail.learningContent && (
                                <div style={{ marginBottom: '16px' }}>
                                  <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px 0' }}>LEARNING CONTENT</h4>
                                  <div style={{ padding: '12px 16px', border: `1px solid ${C.rule}`, borderRadius: '2px' }}>
                                    {questionDetail.learningContent.split('\n').map((para, idx, arr) => (
                                      <p key={idx} style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, margin: idx === arr.length - 1 ? '0' : '0 0 8px 0' }}>
                                        {para}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Edit Question Link */}
                              <div>
                                <Link
                                  to={`/admin/questions?id=${questionDetail.id}`}
                                  onClick={onClose}
                                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.1em', color: ADMIN_ACCENT, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  EDIT IN EXPLORER
                                  <svg width="14" height="14" style={{ marginLeft: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </Link>
                              </div>
                            </div>

                            {/* Individual Flags */}
                            <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: '24px' }}>
                              <h4 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', letterSpacing: '0.12em', color: C.ink, margin: '0 0 16px 0' }}>
                                PLAYER FEEDBACK ({flags.length} {flags.length === 1 ? 'FLAG' : 'FLAGS'})
                              </h4>

                              {flags.length === 0 ? (
                                <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: '13px', color: C.mutedFg }}>No flag entries available</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  {flags.map((flag) => {
                                    const hasReasons = flag.reasons && flag.reasons.length > 0;
                                    const hasElaboration = flag.elaboration && flag.elaboration.trim();
                                    const isExpanded = expandedFlags.has(flag.id);
                                    const needsTruncation = hasElaboration && flag.elaboration!.length > 100;
                                    const displayText = needsTruncation && !isExpanded
                                      ? flag.elaboration!.slice(0, 100) + '...'
                                      : flag.elaboration;

                                    return (
                                      <div key={flag.id} style={{ padding: '12px 16px', border: `1px solid ${C.rule}`, borderRadius: '2px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                          <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', fontWeight: 600, color: C.ink }}>{flag.username}</span>
                                          <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg }}>{new Date(flag.createdAt).toLocaleDateString()}</span>
                                        </div>

                                        {hasReasons && (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                            {flag.reasons.map((reason) => {
                                              const { label, bg, color } = getReasonStyle(reason);
                                              return (
                                                <span key={reason} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '2px', backgroundColor: bg, color }}>
                                                  {label}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {hasElaboration && (
                                          <div>
                                            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, margin: '0 0 4px 0' }}>{displayText}</p>
                                            {needsTruncation && (
                                              <button
                                                onClick={() => toggleFlagExpansion(flag.id)}
                                                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', color: ADMIN_ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                              >
                                                {isExpanded ? 'SHOW LESS' : 'SHOW MORE'}
                                              </button>
                                            )}
                                          </div>
                                        )}

                                        {!hasReasons && !hasElaboration && (
                                          <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: '13px', color: C.mutedFg, margin: 0 }}>Flagged without details</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Toast
        {...toast}
        onClose={hideToast}
        onUndo={() => {
          if (toast.undoCallback) {
            toast.undoCallback();
            hideToast();
          }
        }}
      />
    </>
  );
}

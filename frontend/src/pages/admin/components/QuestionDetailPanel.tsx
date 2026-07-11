import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { API_URL } from '../../../services/api';
import { useTheme } from '../../../hooks/useTheme';
import { useWindowSize } from '../../../hooks/useWindowSize';
import { DifficultyRate } from './DifficultyRate';
import { QuestionEditForm, EditFormData } from './QuestionEditForm';
import { QualityComparisonModal, QualityDelta } from './QualityComparisonModal';

const ADMIN_ACCENT = '#FF5740';

interface Violation {
  rule: string;
  severity: 'blocking' | 'advisory';
  message: string;
  evidence?: string;
}

interface QuestionDetail {
  id: number;
  externalId: string;
  text: string;
  difficulty: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  options: string[];
  correctAnswer: number; // 0-based index
  explanation: string;
  source: {
    name: string;
    url: string | null;
  };
  encounterCount: number;
  correctCount: number;
  qualityScore: number | null;
  flagCount: number;
  violations: Violation[];
}

export interface UpdatedQuestionData {
  id: number;
  text: string;
  difficulty: string;
  qualityScore: number | null;
  violationCount: number;
  status: string;
}

interface QuestionDetailPanelProps {
  questionId: number | null;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
  onQuestionUpdated?: (updatedQuestion: UpdatedQuestionData) => void;
}

// Helper to map violations to content sections
function getViolationsForSection(
  violations: Violation[],
  section: 'question' | 'options' | 'explanation' | 'source'
): Violation[] {
  const sectionRules: Record<string, string[]> = {
    question: ['partisan-framing', 'pure-lookup'],
    options: ['ambiguous-answers', 'multiple-correct'],
    explanation: ['weak-explanation', 'no-explanation'],
    source: ['broken-source-link', 'no-source'],
  };
  return violations.filter((v) => {
    const rules = sectionRules[section];
    return rules ? rules.includes(v.rule) : section === 'question';
  });
}

// Inline violation badge component
function InlineViolationBadge({ violation }: { violation: Violation }) {
  const { C } = useTheme();
  const isBlocking = violation.severity === 'blocking';

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    fontSize: '11px',
    fontFamily: "'Bebas Neue', sans-serif",
    letterSpacing: '0.08em',
    borderRadius: '2px',
    marginRight: '8px',
    marginBottom: '8px',
    backgroundColor: isBlocking ? 'rgba(192,21,42,0.12)' : 'rgba(184,134,11,0.12)',
    color: isBlocking ? C.incorrect : C.amber,
    border: `1px solid ${isBlocking ? 'rgba(192,21,42,0.25)' : 'rgba(184,134,11,0.25)'}`,
  };

  const formatRuleName = (rule: string) =>
    rule.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <div style={badgeStyle}>
      {isBlocking ? (
        <svg style={{ width: '12px', height: '12px', marginRight: '4px' }} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg style={{ width: '12px', height: '12px', marginRight: '4px' }} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      )}
      <span>{formatRuleName(violation.rule)}</span>
      {violation.evidence && (
        <span style={{ marginLeft: '4px', fontStyle: 'italic', opacity: 0.8 }} title={violation.evidence}>
          *
        </span>
      )}
    </div>
  );
}

export function QuestionDetailPanel({
  questionId,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  onQuestionUpdated,
}: QuestionDetailPanelProps) {
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();
  const { C } = useTheme();
  const [questionDetail, setQuestionDetail] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [qualityDelta, setQualityDelta] = useState<QualityDelta | null>(null);
  const [showQualityModal, setShowQualityModal] = useState(false);

  useEffect(() => {
    if (questionId === null || !accessToken) {
      setQuestionDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      setIsSaving(false);

      try {
        const response = await fetch(
          `${API_URL}/api/admin/questions/${questionId}/detail`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!response.ok) throw new Error('Failed to fetch question details');
        const data = await response.json();
        const q = data.question;
        const audit = data.audit || {};
        setQuestionDetail({
          id: q.id,
          externalId: q.externalId,
          text: q.text,
          difficulty: q.difficulty,
          status: q.status,
          createdAt: q.createdAt,
          expiresAt: q.expiresAt ?? null,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          source: q.source || { name: '', url: null },
          encounterCount: q.encounterCount || 0,
          correctCount: q.correctCount || 0,
          qualityScore: audit.score ?? q.qualityScore ?? null,
          flagCount: q.flagCount ?? 0,
          violations: audit.violations || [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [questionId, accessToken]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; }
    };
    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [hasUnsavedChanges]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Discard changes?')) return;
    }
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleSave = async (formData: EditFormData) => {
    if (!questionDetail) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/questions/${questionDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save question');
      }
      const data = await response.json();
      const updatedQuestion = data.question;
      const delta = data.qualityDelta;
      setQuestionDetail({
        ...questionDetail,
        text: updatedQuestion.text,
        options: updatedQuestion.options,
        correctAnswer: updatedQuestion.correctAnswer,
        explanation: updatedQuestion.explanation,
        difficulty: updatedQuestion.difficulty,
        source: updatedQuestion.source,
        qualityScore: updatedQuestion.qualityScore,
        violations: delta.violations || [],
      });
      setQualityDelta(delta);
      setShowQualityModal(true);
      if (onQuestionUpdated) {
        onQuestionUpdated({
          id: updatedQuestion.id,
          text: updatedQuestion.text,
          difficulty: updatedQuestion.difficulty,
          qualityScore: updatedQuestion.qualityScore,
          violationCount: delta.newViolations,
          status: updatedQuestion.status,
        });
      }
      setIsEditMode(false);
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('Discard changes?')) return;
    }
    setIsEditMode(false);
    setHasUnsavedChanges(false);
  };

  const handleArchive = async () => {
    if (!questionDetail) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/questions/${questionDetail.id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to archive question');
      setQuestionDetail({ ...questionDetail, status: 'archived' });
      if (onQuestionUpdated) {
        onQuestionUpdated({ id: questionDetail.id, text: questionDetail.text, difficulty: questionDetail.difficulty, qualityScore: questionDetail.qualityScore, violationCount: questionDetail.violations.length, status: 'archived' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive question');
    }
  };

  const handleRestore = async () => {
    if (!questionDetail) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/questions/${questionDetail.id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to restore question');
      setQuestionDetail({ ...questionDetail, status: 'draft' });
      if (onQuestionUpdated) {
        onQuestionUpdated({ id: questionDetail.id, text: questionDetail.text, difficulty: questionDetail.difficulty, qualityScore: questionDetail.qualityScore, violationCount: questionDetail.violations.length, status: 'draft' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore question');
    }
  };

  const isOpen = questionId !== null;
  const { width } = useWindowSize();
  const isMobile = width < 768;

  const getDifficultyStyle = (difficulty: string): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      easy:   { backgroundColor: 'rgba(37,92,63,0.12)',   color: C.correct },
      medium: { backgroundColor: 'rgba(212,160,23,0.15)', color: C.amber },
      hard:   { backgroundColor: 'rgba(192,21,42,0.12)',  color: C.incorrect },
    };
    return map[difficulty] ?? map.medium;
  };

  const getStatusStyle = (status: string): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      active:   { backgroundColor: 'rgba(37,92,63,0.12)',   color: C.correct },
      draft:    { backgroundColor: 'rgba(30,90,138,0.12)',  color: '#4A80B0' },
      archived: { backgroundColor: 'rgba(192,21,42,0.12)',  color: C.incorrect },
      expired:  { backgroundColor: 'rgba(212,160,23,0.15)', color: C.amber },
    };
    return map[status] ?? { backgroundColor: C.ruleLight, color: C.muted };
  };

  const getQualityScoreStyle = (score: number | null): React.CSSProperties => {
    if (score === null) return { color: C.mutedFg };
    if (score >= 71) return { color: C.correct };
    if (score >= 41) return { color: C.amber };
    return { color: C.incorrect };
  };

  const btnHeaderAction = (variant: 'edit' | 'save' | 'cancel'): React.CSSProperties => ({
    padding: '6px 14px',
    fontSize: '12px',
    fontFamily: "'Bebas Neue', sans-serif",
    letterSpacing: '0.1em',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    ...(variant === 'edit'   ? { backgroundColor: ADMIN_ACCENT, color: '#fff' } :
        variant === 'save'   ? { backgroundColor: C.correct, color: '#fff' } :
                               { backgroundColor: 'rgba(255,255,255,0.15)', color: '#ECE7D9' }),
  });

  const btnIcon: React.CSSProperties = {
    padding: '6px',
    background: 'none',
    border: 'none',
    color: '#ECE7D9',
    cursor: 'pointer',
    borderRadius: '2px',
    display: 'flex',
    alignItems: 'center',
    minWidth: '44px',
    minHeight: '44px',
    justifyContent: 'center',
  };

  const sectionLabel: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '11px',
    letterSpacing: '0.14em',
    color: C.muted,
    marginBottom: '8px',
  };

  return (
    <>
      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" style={{ position: 'relative', zIndex: 50 }} onClose={handleClose}>
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
                        <Dialog.Title style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '0.12em', color: '#ECE7D9', margin: 0 }}>
                          Question Details
                        </Dialog.Title>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {!isEditMode && questionDetail && !loading && (
                            <button onClick={() => setIsEditMode(true)} style={btnHeaderAction('edit')}>
                              EDIT
                            </button>
                          )}
                          {isEditMode && (
                            <>
                              <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                style={{ ...btnHeaderAction('cancel'), opacity: isSaving ? 0.5 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                              >
                                CANCEL
                              </button>
                              <button
                                onClick={() => { const form = document.querySelector('form') as HTMLFormElement; if (form) form.requestSubmit(); }}
                                disabled={isSaving}
                                style={{ ...btnHeaderAction('save'), opacity: isSaving ? 0.5 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                              >
                                {isSaving ? 'SAVING...' : 'SAVE'}
                              </button>
                            </>
                          )}
                          {!isEditMode && (
                            <>
                              <button
                                onClick={() => onNavigate('prev')}
                                disabled={!hasPrev}
                                style={{ ...btnIcon, opacity: hasPrev ? 1 : 0.4, cursor: hasPrev ? 'pointer' : 'not-allowed' }}
                                aria-label="Previous question"
                              >
                                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => onNavigate('next')}
                                disabled={!hasNext}
                                style={{ ...btnIcon, opacity: hasNext ? 1 : 0.4, cursor: hasNext ? 'pointer' : 'not-allowed' }}
                                aria-label="Next question"
                              >
                                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </>
                          )}
                          <button onClick={handleClose} style={btnIcon} aria-label="Close panel">
                            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Body */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: C.paper }}>

                        {/* Loading skeleton */}
                        {loading && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ height: '32px', backgroundColor: C.rule, borderRadius: '2px', width: '75%', opacity: 0.5 }} />
                            <div style={{ height: '16px', backgroundColor: C.rule, borderRadius: '2px', opacity: 0.4 }} />
                            <div style={{ height: '16px', backgroundColor: C.rule, borderRadius: '2px', width: '83%', opacity: 0.4 }} />
                          </div>
                        )}

                        {/* Error */}
                        {error && !loading && (
                          <div style={{ backgroundColor: 'rgba(192,21,42,0.08)', border: `1px solid rgba(192,21,42,0.25)`, borderRadius: '2px', padding: '12px 16px', color: C.incorrect, fontFamily: "'Lora', Georgia, serif", fontSize: '13px' }}>
                            {error}
                          </div>
                        )}

                        {/* Edit mode */}
                        {isEditMode && questionDetail && !loading && (
                          <QuestionEditForm
                            question={questionDetail}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            onDirtyChange={setHasUnsavedChanges}
                            isSaving={isSaving}
                          />
                        )}

                        {/* View mode */}
                        {!isEditMode && questionDetail && !loading && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                            {/* Quality score + actions */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.14em', color: C.muted }}>QUALITY SCORE</span>
                                {questionDetail.qualityScore !== null ? (
                                  <span style={{ ...getQualityScoreStyle(questionDetail.qualityScore), fontSize: '24px', fontWeight: 700, fontFamily: "'Lora', Georgia, serif" }}>
                                    {questionDetail.qualityScore}
                                    <span style={{ fontSize: '13px', fontWeight: 400, color: C.mutedFg }}>/100</span>
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '13px', color: C.mutedFg, fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic' }}>Not scored</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                {questionDetail.status !== 'archived' && (
                                  <button
                                    onClick={handleArchive}
                                    style={{ padding: '6px 14px', fontSize: '12px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em', backgroundColor: 'transparent', color: C.incorrect, border: `1px solid ${C.incorrect}`, borderRadius: '2px', cursor: 'pointer', opacity: 0.85 }}
                                  >
                                    ARCHIVE
                                  </button>
                                )}
                                {questionDetail.status === 'archived' && (
                                  <button
                                    onClick={handleRestore}
                                    style={{ padding: '6px 14px', fontSize: '12px', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em', backgroundColor: 'transparent', color: C.muted, border: `1px solid ${C.rule}`, borderRadius: '2px', cursor: 'pointer' }}
                                  >
                                    RESTORE TO DRAFT
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Question text */}
                            <div>
                              <p style={sectionLabel}>QUESTION</p>
                              <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '16px', color: C.ink, margin: 0, lineHeight: 1.6 }}>
                                {questionDetail.text}
                              </p>
                              {getViolationsForSection(questionDetail.violations, 'question').length > 0 && (
                                <div style={{ borderLeft: `3px solid ${C.incorrect}`, paddingLeft: '12px', marginTop: '12px' }}>
                                  {getViolationsForSection(questionDetail.violations, 'question').map((v, idx) => (
                                    <InlineViolationBadge key={idx} violation={v} />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Answer options */}
                            <div>
                              <p style={sectionLabel}>ANSWER OPTIONS</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {questionDetail.options.map((optionText, idx) => {
                                  const isCorrect = questionDetail.correctAnswer === idx;
                                  const label = String.fromCharCode(65 + idx);
                                  const optionViolations = getViolationsForSection(questionDetail.violations, 'options');
                                  const hasEvidence = optionViolations.some(
                                    (v) => v.evidence && optionText.toLowerCase().includes(v.evidence.toLowerCase())
                                  );

                                  const optionStyle: React.CSSProperties = isCorrect && !hasEvidence
                                    ? { backgroundColor: 'rgba(37,92,63,0.1)', border: `1px solid rgba(37,92,63,0.3)`, borderRadius: '2px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start' }
                                    : hasEvidence
                                    ? { backgroundColor: 'rgba(192,21,42,0.08)', border: `1px solid rgba(192,21,42,0.25)`, borderRadius: '2px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start' }
                                    : { backgroundColor: C.ruleLight, border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start' };

                                  return (
                                    <div key={idx} style={optionStyle}>
                                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px', letterSpacing: '0.08em', color: C.muted, marginRight: '10px', flexShrink: 0 }}>
                                        {label}.
                                      </span>
                                      <div style={{ flex: 1 }}>
                                        <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '14px', color: C.ink }}>
                                          {optionText}
                                        </span>
                                        {isCorrect && (
                                          <svg style={{ display: 'inline-block', width: '16px', height: '16px', marginLeft: '8px', color: C.correct, verticalAlign: 'middle' }} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {getViolationsForSection(questionDetail.violations, 'options').length > 0 && (
                                <div style={{ borderLeft: `3px solid ${C.incorrect}`, paddingLeft: '12px', marginTop: '12px' }}>
                                  {getViolationsForSection(questionDetail.violations, 'options').map((v, idx) => (
                                    <InlineViolationBadge key={idx} violation={v} />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Explanation */}
                            <div>
                              <p style={sectionLabel}>EXPLANATION</p>
                              <div style={{ backgroundColor: C.ruleLight, border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '16px' }}>
                                <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '14px', color: C.ink, margin: 0, lineHeight: 1.6 }}>
                                  {questionDetail.explanation}
                                </p>
                              </div>
                              {getViolationsForSection(questionDetail.violations, 'explanation').length > 0 && (
                                <div style={{ borderLeft: `3px solid ${C.amber}`, paddingLeft: '12px', marginTop: '12px' }}>
                                  {getViolationsForSection(questionDetail.violations, 'explanation').map((v, idx) => (
                                    <InlineViolationBadge key={idx} violation={v} />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Source */}
                            <div>
                              <p style={sectionLabel}>SOURCE</p>
                              {questionDetail.source.url ? (
                                <a
                                  href={questionDetail.source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '14px', color: ADMIN_ACCENT, textDecoration: 'underline' }}
                                >
                                  {questionDetail.source.name}
                                  <svg style={{ display: 'inline-block', width: '14px', height: '14px', marginLeft: '4px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              ) : (
                                <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '14px', color: C.mutedFg, fontStyle: 'italic' }}>
                                  {questionDetail.source.name || 'No source provided'}
                                </span>
                              )}
                              {getViolationsForSection(questionDetail.violations, 'source').length > 0 && (
                                <div style={{ borderLeft: `3px solid ${C.incorrect}`, paddingLeft: '12px', marginTop: '12px' }}>
                                  {getViolationsForSection(questionDetail.violations, 'source').map((v, idx) => (
                                    <InlineViolationBadge key={idx} violation={v} />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Metadata row */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                              <span style={{ ...getDifficultyStyle(questionDetail.difficulty), padding: '3px 10px', borderRadius: '2px', fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.1em' }}>
                                {questionDetail.difficulty}
                              </span>
                              <span style={{ ...getStatusStyle(questionDetail.status), padding: '3px 10px', borderRadius: '2px', fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.1em' }}>
                                {questionDetail.status}
                              </span>
                              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted }}>
                                Created: {new Date(questionDetail.createdAt).toLocaleDateString()}
                              </span>
                              {questionDetail.expiresAt && (
                                <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted }}>
                                  Expires: {new Date(questionDetail.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg }}>
                                ID: {questionDetail.externalId}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted }}>Flags:</span>
                                {questionDetail.flagCount > 0 ? (
                                  <>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '2px',
                                      fontSize: '11px',
                                      fontFamily: "'Bebas Neue', sans-serif",
                                      letterSpacing: '0.08em',
                                      ...(questionDetail.flagCount > 5 ? { backgroundColor: 'rgba(192,21,42,0.12)', color: C.incorrect } :
                                          questionDetail.flagCount > 2 ? { backgroundColor: 'rgba(212,160,23,0.15)', color: C.amber } :
                                          { backgroundColor: C.ruleLight, color: C.muted }),
                                    }}>
                                      {questionDetail.flagCount}
                                    </span>
                                    <button
                                      onClick={() => navigate(`/admin/flags?questionId=${questionDetail.id}&tab=active`)}
                                      style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: ADMIN_ACCENT, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                                    >
                                      View Flags
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg }}>0</span>
                                )}
                              </span>
                            </div>

                            {/* Telemetry */}
                            <div style={{ backgroundColor: C.ruleLight, border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '16px' }}>
                              <p style={{ ...sectionLabel, marginBottom: '12px' }}>TELEMETRY</p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                <div>
                                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted, marginBottom: '4px' }}>Encounters</div>
                                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '20px', fontWeight: 700, color: C.ink }}>{questionDetail.encounterCount}</div>
                                </div>
                                <div>
                                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted, marginBottom: '4px' }}>Correct</div>
                                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '20px', fontWeight: 700, color: C.ink }}>{questionDetail.correctCount}</div>
                                </div>
                                <div>
                                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted, marginBottom: '4px' }}>Calc. Difficulty</div>
                                  <div style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '20px', fontWeight: 700 }}>
                                    <DifficultyRate correctCount={questionDetail.correctCount} encounterCount={questionDetail.encounterCount} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Quality Assessment */}
                            <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: '24px' }}>
                              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px', letterSpacing: '0.1em', color: C.ink, margin: '0 0 16px 0' }}>Quality Assessment</p>
                              <p style={sectionLabel}>VIOLATIONS</p>
                              {questionDetail.violations.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  {questionDetail.violations.map((violation, idx) => (
                                    <div key={idx} style={{ backgroundColor: C.ruleLight, border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{
                                          padding: '2px 8px',
                                          borderRadius: '2px',
                                          fontFamily: "'Bebas Neue', sans-serif",
                                          fontSize: '11px',
                                          letterSpacing: '0.08em',
                                          ...(violation.severity === 'blocking'
                                            ? { backgroundColor: 'rgba(192,21,42,0.12)', color: C.incorrect }
                                            : { backgroundColor: 'rgba(212,160,23,0.12)', color: C.amber }),
                                        }}>
                                          {violation.severity === 'blocking' ? 'Blocking' : 'Advisory'}
                                        </span>
                                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.08em', color: C.muted }}>
                                          {violation.rule.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                        </span>
                                      </div>
                                      <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, margin: 0 }}>
                                        {violation.message}
                                      </p>
                                      {violation.evidence && (
                                        <p style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', color: C.muted, backgroundColor: C.paper, border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '6px 8px', marginTop: '8px', margin: '8px 0 0 0' }}>
                                          {violation.evidence}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.mutedFg, fontStyle: 'italic' }}>
                                  No violations found
                                </p>
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

      {/* Quality Comparison Modal */}
      <QualityComparisonModal
        isOpen={showQualityModal}
        onClose={() => setShowQualityModal(false)}
        delta={qualityDelta}
      />
    </>
  );
}

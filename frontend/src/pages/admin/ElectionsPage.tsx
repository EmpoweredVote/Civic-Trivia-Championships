import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Dialog,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { API_URL } from '../../services/api';
import { rejectedNote, type QuestionGenerationResult } from './generationResult';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';

const ADMIN_ACCENT = '#FF5740';

interface Candidate {
  name: string;
  party: string;
  incumbent: boolean;
}

interface ElectionRace {
  id: number;
  seat: string;
  electionType: string;
  electionDate: string;
  timezone: string;
  jurisdiction: string;
  candidates: Candidate[];
  questionsGenerated: boolean;
  followupGenerated: boolean;
  result: string | null;
  createdAt: string;
}

interface RaceWithCount extends ElectionRace {
  questionCount: number;
}

interface CronLastRun {
  timestamp: string;
  racesDetected: number;
  processed: number;
  failures: number;
}

interface ClassifiedData {
  activeElections: RaceWithCount[];
  pendingGeneration: RaceWithCount[];
  awaitingFollowup: RaceWithCount[];
  cronLastRun: CronLastRun | null;
}

const ELECTION_TYPE_LABELS: Record<string, string> = {
  primary: 'Primary',
  general: 'General',
  runoff: 'Runoff',
  'by-election': 'By-Election',
};

function emptyCandidate(): Candidate {
  return { name: '', party: '', incumbent: false };
}

function emptyForm() {
  return {
    seat: '',
    electionType: 'general' as string,
    electionDate: '',
    jurisdiction: '',
    timezone: '',
    candidates: [emptyCandidate()],
  };
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ElectionsPage() {
  const { accessToken } = useAuthStore();
  const { C } = useTheme();

  const [activeElections, setActiveElections] = useState<RaceWithCount[]>([]);
  const [pendingGeneration, setPendingGeneration] = useState<RaceWithCount[]>([]);
  const [awaitingFollowup, setAwaitingFollowup] = useState<RaceWithCount[]>([]);
  const [cronLastRun, setCronLastRun] = useState<CronLastRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [collections, setCollections] = useState<{ id: number; name: string; slug: string }[]>([]);
  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_URL}/api/admin/collections`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setCollections(data.collections ?? []))
      .catch(() => {});
  }, [accessToken]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [generatingRaceId, setGeneratingRaceId] = useState<number | null>(null);
  const [genCollectionSlug, setGenCollectionSlug] = useState('');
  const [showCollectionPrompt, setShowCollectionPrompt] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<QuestionGenerationResult | null>(null);
  const [genError, setGenError] = useState<{ type: 'blocked' | 'error'; message: string; existingCount?: number; generatedAt?: string | null; } | null>(null);

  const [editingRace, setEditingRace] = useState<RaceWithCount | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingRace, setDeletingRace] = useState<RaceWithCount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [regenRace, setRegenRace] = useState<RaceWithCount | null>(null);
  const [regenCounts, setRegenCounts] = useState<{ activeCount: number; draftCount: number } | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);

  const [resultRace, setResultRace] = useState<RaceWithCount | null>(null);
  const [resultForm, setResultForm] = useState({ winnerName: '', termEndDate: '', collectionSlug: '' });
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  const fetchClassified = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/election-races/classified`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ClassifiedData = await res.json();
      setActiveElections(data.activeElections || []);
      setPendingGeneration(data.pendingGeneration || []);
      setAwaitingFollowup(data.awaitingFollowup || []);
      setCronLastRun(data.cronLastRun || null);
    } catch (err) {
      setError('Failed to load election races.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClassified(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCandidate = (index: number, field: keyof Candidate, value: string | boolean) => {
    setForm((prev) => {
      const updated = [...prev.candidates];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, candidates: updated };
    });
  };

  const addCandidate = () => setForm((prev) => ({ ...prev, candidates: [...prev.candidates, emptyCandidate()] }));

  const removeCandidate = (index: number) => setForm((prev) => ({
    ...prev,
    candidates: prev.candidates.filter((_, i) => i !== index),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    setSubmitError(null);
    const electionDateISO = form.electionDate ? `${form.electionDate}T00:00:00.000Z` : '';
    try {
      const res = await fetch(`${API_URL}/api/admin/election-races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          seat: form.seat,
          electionType: form.electionType,
          electionDate: electionDateISO,
          timezone: form.timezone,
          jurisdiction: form.jurisdiction,
          candidates: form.candidates.filter((c) => c.name.trim() !== ''),
        }),
      });
      if (res.status === 201) {
        await fetchClassified();
        setForm(emptyForm());
        setShowForm(false);
        showToast('Election race created.');
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Failed to create election race.');
      }
    } catch (err) {
      setSubmitError('Network error — could not create election race.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = (race: RaceWithCount) => {
    setGeneratingRaceId(race.id);
    const matched = collections.find(c => c.name === race.jurisdiction);
    setGenCollectionSlug(matched?.slug ?? '');
    setShowCollectionPrompt(true);
  };

  const startGeneration = async (raceId: number, collectionSlug: string, force: boolean = false) => {
    setShowCollectionPrompt(false);
    setGenLoading(true);
    setGenResult(null);
    setGenError(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/election-races/${raceId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ collectionSlug, force }),
      });
      const data = await response.json();
      if (response.ok) {
        setGenResult(data);
        fetchClassified();
      } else if (response.status === 409) {
        setGenError({ type: 'blocked', message: data.message, existingCount: data.existingCount, generatedAt: data.generatedAt });
      } else {
        setGenError({ type: 'error', message: data.detail || data.error || 'Failed to generate questions' });
      }
    } catch {
      setGenError({ type: 'error', message: 'Network error — please try again' });
    } finally {
      setGenLoading(false);
    }
  };

  const openEditModal = (race: RaceWithCount) => {
    setEditingRace(race);
    setEditForm({
      seat: race.seat,
      electionType: race.electionType,
      electionDate: race.electionDate.split('T')[0],
      jurisdiction: race.jurisdiction,
      timezone: race.timezone,
      candidates: race.candidates.length > 0 ? race.candidates.map(c => ({ ...c })) : [emptyCandidate()],
    });
    setEditError(null);
  };

  const updateEditCandidate = (index: number, field: keyof Candidate, value: string | boolean) => {
    setEditForm((prev) => {
      const updated = [...prev.candidates];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, candidates: updated };
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRace || !accessToken) return;
    setEditSubmitting(true);
    setEditError(null);
    const electionDateISO = editForm.electionDate ? `${editForm.electionDate}T00:00:00.000Z` : '';
    try {
      const res = await fetch(`${API_URL}/api/admin/election-races/${editingRace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          seat: editForm.seat,
          electionType: editForm.electionType,
          electionDate: electionDateISO,
          timezone: editForm.timezone,
          jurisdiction: editForm.jurisdiction,
          candidates: editForm.candidates.filter((c) => c.name.trim() !== ''),
        }),
      });
      if (res.ok) {
        await fetchClassified();
        setEditingRace(null);
        showToast('Race updated successfully.');
      } else {
        const data = await res.json();
        setEditError(data.error || 'Failed to update race.');
      }
    } catch {
      setEditError('Network error — could not update race.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRace || !accessToken) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/election-races/${deletingRace.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        await fetchClassified();
        setDeletingRace(null);
        showToast('Race deleted.');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete race.', 'error');
        setDeletingRace(null);
      }
    } catch {
      showToast('Network error — could not delete race.', 'error');
      setDeletingRace(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRegenClick = async (race: RaceWithCount) => {
    setRegenRace(race);
    setRegenCounts(null);
    setRegenConfirmOpen(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/election-races/${race.id}/question-count`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRegenCounts({ activeCount: data.activeCount ?? 0, draftCount: data.draftCount ?? 0 });
      }
    } catch { /* Counts failed — modal still opens */ }
  };

  const handleRegenConfirm = async () => {
    if (!regenRace || !accessToken) return;
    setRegenLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/election-races/${regenRace.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        await fetchClassified();
        setRegenConfirmOpen(false);
        setRegenRace(null);
        showToast(`Re-generated ${data.questionsCreated ?? 0} questions for ${regenRace.jurisdiction}.${rejectedNote(data.questionsRejected)}`);
      } else {
        showToast(data.error || 'Failed to re-generate questions.', 'error');
        setRegenConfirmOpen(false);
        setRegenRace(null);
      }
    } catch {
      showToast('Network error — could not re-generate.', 'error');
      setRegenConfirmOpen(false);
      setRegenRace(null);
    } finally {
      setRegenLoading(false);
    }
  };

  const openResultModal = (race: RaceWithCount) => {
    setResultRace(race);
    const matched = collections.find(c => c.name === race.jurisdiction);
    setResultForm({ winnerName: '', termEndDate: '', collectionSlug: matched?.slug ?? '' });
    setResultError(null);
  };

  const handleResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultRace || !accessToken) return;
    setResultLoading(true);
    setResultError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/election-races/${resultRace.id}/enter-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ winnerName: resultForm.winnerName, termEndDate: resultForm.termEndDate, collectionSlug: resultForm.collectionSlug }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchClassified();
        setResultRace(null);
        showToast(`${data.questionsCreated ?? 0} current-term questions created for ${resultRace.jurisdiction}.${rejectedNote(data.questionsRejected)}`);
      } else if (res.status === 409) {
        setResultError('Current-term questions already generated for this race.');
      } else {
        setResultError(data.error || 'Failed to enter result.');
      }
    } catch {
      setResultError('Network error — please try again.');
    } finally {
      setResultLoading(false);
    }
  };

  const selectedRaceForGen = [...activeElections, ...pendingGeneration, ...awaitingFollowup].find(r => r.id === generatingRaceId);

  // ---- Shared styles ----
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: `1px solid ${C.rule}`,
    borderRadius: '2px',
    backgroundColor: C.paper,
    color: C.ink,
    fontFamily: "'Lora', Georgia, serif",
    fontSize: '13px',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '11px',
    letterSpacing: '0.14em',
    color: C.muted,
    marginBottom: '6px',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 20px',
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
    padding: '8px 20px',
    backgroundColor: 'transparent',
    color: C.muted,
    border: `1px solid ${C.rule}`,
    borderRadius: '2px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '13px',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  };

  const btnDanger: React.CSSProperties = {
    ...btnPrimary,
    backgroundColor: C.incorrect,
  };

  const btnAmber: React.CSSProperties = {
    ...btnPrimary,
    backgroundColor: '#92400E',
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '11px',
    letterSpacing: '0.14em',
    color: C.muted,
    borderBottom: `1px solid ${C.rule}`,
    whiteSpace: 'nowrap',
    backgroundColor: 'transparent',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontFamily: "'Lora', Georgia, serif",
    fontSize: '13px',
    color: C.ink,
    borderBottom: `1px solid ${C.ruleLight}`,
    verticalAlign: 'top',
  };

  const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  };

  const modalPanel: React.CSSProperties = {
    backgroundColor: C.paper,
    border: `1px solid ${C.rule}`,
    borderRadius: '2px',
    padding: '24px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  };

  const modalTitle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '20px',
    letterSpacing: '0.08em',
    color: C.ink,
    margin: '0 0 16px 0',
  };

  const CandidateRow = ({ candidate, idx, onChange, onRemove, canRemove }: {
    candidate: Candidate;
    idx: number;
    onChange: (idx: number, field: keyof Candidate, val: string | boolean) => void;
    onRemove: (idx: number) => void;
    canRemove: boolean;
  }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: `1px solid ${C.rule}`, borderRadius: '2px' }}>
      <input
        type="text"
        placeholder="Full name"
        value={candidate.name}
        onChange={(e) => onChange(idx, 'name', e.target.value)}
        style={{ ...inputStyle, flex: 1, padding: '6px 8px' }}
      />
      <input
        type="text"
        placeholder="Party"
        value={candidate.party}
        onChange={(e) => onChange(idx, 'party', e.target.value)}
        style={{ ...inputStyle, flex: 1, padding: '6px 8px' }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted, whiteSpace: 'nowrap', cursor: 'pointer' }}>
        <input type="checkbox" checked={candidate.incumbent} onChange={(e) => onChange(idx, 'incumbent', e.target.checked)} style={{ accentColor: ADMIN_ACCENT }} />
        Incumbent
      </label>
      {canRemove && (
        <button type="button" onClick={() => onRemove(idx)} style={{ color: C.mutedFg, background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}
          onMouseEnter={e => (e.currentTarget.style.color = C.incorrect)}
          onMouseLeave={e => (e.currentTarget.style.color = C.mutedFg)}>
          &times;
        </button>
      )}
    </div>
  );

  const TableWrapper = ({ children }: { children: React.ReactNode }) => (
    <div style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '0.06em', color: C.ink, margin: '0 0 8px 0' }}>
            Election Management
          </h1>
          <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: '13px', color: C.muted, margin: 0 }}>
            Manage election races and lifecycle actions. Races are entered manually.
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setSubmitError(null); }}
          style={btnPrimary}
        >
          {showForm ? 'CANCEL' : '+ NEW ELECTION RACE'}
        </button>
      </div>

      {/* Cron last-run banner */}
      {cronLastRun ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', border: `1px solid ${C.rule}`, borderRadius: '2px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: C.correct, flexShrink: 0 }} />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.1em', color: C.ink }}>
            CRON LAST RAN {formatRelativeTime(cronLastRun.timestamp).toUpperCase()}
          </span>
          <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted }}>
            — {cronLastRun.racesDetected} race{cronLastRun.racesDetected !== 1 ? 's' : ''} detected, {cronLastRun.processed} processed
            {cronLastRun.failures > 0 && <span style={{ color: '#92400E', fontWeight: 600 }}>, {cronLastRun.failures} failure{cronLastRun.failures !== 1 ? 's' : ''}</span>}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', border: `1px solid ${C.rule}`, borderRadius: '2px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: C.mutedFg, flexShrink: 0 }} />
          <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.muted }}>Cron: No runs recorded since last server restart</span>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '24px' }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '16px', letterSpacing: '0.12em', color: C.ink, margin: '0 0 20px 0', borderBottom: `1px solid ${C.rule}`, paddingBottom: '12px' }}>
            NEW ELECTION RACE
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="md:grid-cols-2">
              <div>
                <label style={labelStyle}>SEAT NAME <span style={{ color: C.incorrect }}>*</span></label>
                <input type="text" required placeholder="e.g., Mayor of Bloomington" value={form.seat} onChange={(e) => setForm((p) => ({ ...p, seat: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ELECTION TYPE <span style={{ color: C.incorrect }}>*</span></label>
                <select required value={form.electionType} onChange={(e) => setForm((p) => ({ ...p, electionType: e.target.value }))} style={selectStyle}>
                  <option value="general">General</option>
                  <option value="primary">Primary</option>
                  <option value="runoff">Runoff</option>
                  <option value="by-election">By-Election</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="md:grid-cols-2">
              <div>
                <label style={labelStyle}>ELECTION DATE <span style={{ color: C.incorrect }}>*</span></label>
                <input type="date" required value={form.electionDate} onChange={(e) => setForm((p) => ({ ...p, electionDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>JURISDICTION <span style={{ color: C.incorrect }}>*</span></label>
                {collections.length > 0 ? (
                  <select required value={form.jurisdiction} onChange={(e) => setForm((p) => ({ ...p, jurisdiction: e.target.value }))} style={selectStyle}>
                    <option value="">— select a collection —</option>
                    {collections.map(c => <option key={c.slug} value={c.name}>{c.name}</option>)}
                  </select>
                ) : (
                  <input type="text" required placeholder="e.g., Bloomington, IN" value={form.jurisdiction} onChange={(e) => setForm((p) => ({ ...p, jurisdiction: e.target.value }))} style={inputStyle} />
                )}
              </div>
            </div>

            <div style={{ maxWidth: '320px' }}>
              <label style={labelStyle}>TIMEZONE <span style={{ color: C.incorrect }}>*</span></label>
              <input type="text" required placeholder="e.g., America/Indiana/Indianapolis" value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} style={inputStyle} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>CANDIDATES</label>
                <button type="button" onClick={addCandidate} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.1em', color: ADMIN_ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}>
                  + ADD CANDIDATE
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {form.candidates.map((candidate, idx) => (
                  <CandidateRow key={idx} candidate={candidate} idx={idx} onChange={updateCandidate} onRemove={removeCandidate} canRemove={form.candidates.length > 1} />
                ))}
              </div>
            </div>

            {submitError && (
              <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.incorrect, margin: 0, padding: '10px 12px', border: `1px solid ${C.incorrect}`, borderRadius: '2px' }}>
                {submitError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'CREATING...' : 'CREATE RACE'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm()); setSubmitError(null); }} style={btnSecondary}>
                CANCEL
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab layout */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted, fontSize: '13px' }}>
          Loading election races...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: "'Lora', Georgia, serif", color: C.incorrect, fontSize: '13px' }}>
          {error}
        </div>
      ) : (
        <TabGroup selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
          <TabList style={{ display: 'flex', borderBottom: `1px solid ${C.rule}` }}>
            {[
              `Active Elections (${activeElections.length})`,
              `Pending Generation (${pendingGeneration.length})`,
              `Awaiting Follow-up (${awaitingFollowup.length})`,
            ].map((label, idx) => (
              <Tab
                key={label}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '12px',
                  letterSpacing: '0.1em',
                  background: 'none',
                  border: 'none',
                  borderBottom: selectedTabIndex === idx ? `3px solid ${ADMIN_ACCENT}` : '3px solid transparent',
                  color: selectedTabIndex === idx ? ADMIN_ACCENT : C.muted,
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {label.toUpperCase()}
              </Tab>
            ))}
          </TabList>

          <TabPanels style={{ marginTop: '16px' }}>
            {/* Tab 1: Active Elections */}
            <TabPanel>
              {activeElections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted, fontSize: '13px' }}>No active elections with generated questions.</p>
                </div>
              ) : (
                <TableWrapper>
                  <thead>
                    <tr>
                      {['Seat', 'Expires', 'Jurisdiction', 'Questions', 'Candidates', 'Status', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeElections.map((race) => (
                      <tr key={race.id}>
                        <td style={tdStyle}>
                          <div style={{ fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: C.ink }}>{race.seat}</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', letterSpacing: '0.08em', color: C.mutedFg, marginTop: '2px' }}>{ELECTION_TYPE_LABELS[race.electionType] || race.electionType}</div>
                        </td>
                        <td style={tdStyle}>{new Date(race.electionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td style={tdStyle}>{race.jurisdiction}</td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', padding: '2px 8px', backgroundColor: 'rgba(30,90,138,0.12)', color: '#1E5A8A', borderRadius: '2px' }}>
                            {race.questionCount} questions
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {race.candidates.length} candidate{race.candidates.length !== 1 ? 's' : ''}
                          {race.candidates.length > 0 && (
                            <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg, marginLeft: '4px' }}>
                              ({race.candidates.map((c) => c.name).join(', ')})
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', padding: '2px 8px', backgroundColor: 'rgba(37,92,63,0.12)', color: C.correct, borderRadius: '2px' }}>ACTIVE</span>
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => handleRegenClick(race)} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', padding: '4px 10px', border: `1px solid ${C.rule}`, borderRadius: '2px', color: C.muted, backgroundColor: 'transparent', cursor: 'pointer' }}>
                            RE-GENERATE
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrapper>
              )}
            </TabPanel>

            {/* Tab 2: Pending Generation */}
            <TabPanel>
              {pendingGeneration.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted, fontSize: '13px' }}>No elections pending generation.</p>
                </div>
              ) : (
                <TableWrapper>
                  <thead>
                    <tr>
                      {['Seat', 'Expires', 'Jurisdiction', 'Candidates', 'Status', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingGeneration.map((race) => (
                      <tr key={race.id}>
                        <td style={tdStyle}>
                          <div style={{ fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: C.ink }}>{race.seat}</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', letterSpacing: '0.08em', color: C.mutedFg, marginTop: '2px' }}>{ELECTION_TYPE_LABELS[race.electionType] || race.electionType}</div>
                        </td>
                        <td style={tdStyle}>{new Date(race.electionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td style={tdStyle}>{race.jurisdiction}</td>
                        <td style={tdStyle}>
                          {race.candidates.length} candidate{race.candidates.length !== 1 ? 's' : ''}
                          {race.candidates.length > 0 && (
                            <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg, marginLeft: '4px' }}>({race.candidates.map((c) => c.name).join(', ')})</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', padding: '2px 8px', backgroundColor: 'rgba(184,134,11,0.12)', color: '#92400E', borderRadius: '2px' }}>PENDING</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => handleGenerate(race)} style={{ ...btnPrimary, padding: '4px 12px', fontSize: '11px' }}>GENERATE QUESTIONS</button>
                            <button onClick={() => openEditModal(race)} style={{ ...btnSecondary, padding: '4px 12px', fontSize: '11px' }}>EDIT RACE</button>
                            <button onClick={() => setDeletingRace(race)} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', color: C.incorrect, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>DELETE</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrapper>
              )}
            </TabPanel>

            {/* Tab 3: Awaiting Follow-up */}
            <TabPanel>
              {awaitingFollowup.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted, fontSize: '13px' }}>No expired elections awaiting follow-up.</p>
                </div>
              ) : (
                <TableWrapper>
                  <thead>
                    <tr>
                      {['Seat', 'Expires', 'Jurisdiction', 'Questions', 'Candidates', 'Status', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {awaitingFollowup.map((race) => (
                      <tr key={race.id}>
                        <td style={tdStyle}>
                          <div style={{ fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: C.ink }}>{race.seat}</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', letterSpacing: '0.08em', color: C.mutedFg, marginTop: '2px' }}>{ELECTION_TYPE_LABELS[race.electionType] || race.electionType}</div>
                        </td>
                        <td style={tdStyle}>{new Date(race.electionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        <td style={tdStyle}>{race.jurisdiction}</td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', padding: '2px 8px', backgroundColor: C.ruleLight, color: C.muted, borderRadius: '2px' }}>
                            {race.questionCount} questions
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {race.candidates.length} candidate{race.candidates.length !== 1 ? 's' : ''}
                          {race.candidates.length > 0 && (
                            <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg, marginLeft: '4px' }}>({race.candidates.map((c) => c.name).join(', ')})</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '0.08em', padding: '2px 8px', backgroundColor: C.ruleLight, color: C.muted, borderRadius: '2px' }}>EXPIRED</span>
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => openResultModal(race)} style={{ ...btnPrimary, padding: '4px 12px', fontSize: '11px' }}>ENTER RESULT</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrapper>
              )}
            </TabPanel>
          </TabPanels>
        </TabGroup>
      )}

      {/* ---- Modals ---- */}

      {/* Modal: Collection Slug Prompt */}
      <Dialog open={showCollectionPrompt} onClose={() => setShowCollectionPrompt(false)} className="relative z-50">
        <div style={modalOverlay} aria-hidden="true" />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <DialogPanel style={modalPanel}>
            <DialogTitle style={modalTitle}>GENERATE ELECTION QUESTIONS</DialogTitle>
            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.muted, marginBottom: '16px' }}>
              {selectedRaceForGen ? `Race: ${selectedRaceForGen.seat} — ${selectedRaceForGen.jurisdiction}` : ''}
            </p>
            <label style={labelStyle}>COLLECTION</label>
            {collections.length > 0 ? (
              <select value={genCollectionSlug} onChange={e => setGenCollectionSlug(e.target.value)} style={{ ...selectStyle, marginBottom: '20px' }}>
                <option value="">— select a collection —</option>
                {collections.map(c => <option key={c.slug} value={c.slug}>{c.name} ({c.slug})</option>)}
              </select>
            ) : (
              <input type="text" value={genCollectionSlug} onChange={e => setGenCollectionSlug(e.target.value)} placeholder="e.g., bloomington-in" style={{ ...inputStyle, marginBottom: '20px' }} />
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCollectionPrompt(false)} style={btnSecondary}>CANCEL</button>
              <button onClick={() => startGeneration(generatingRaceId!, genCollectionSlug)} disabled={!genCollectionSlug.trim()} style={{ ...btnPrimary, opacity: !genCollectionSlug.trim() ? 0.5 : 1, cursor: !genCollectionSlug.trim() ? 'not-allowed' : 'pointer' }}>GENERATE</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Modal: Generation Loading */}
      <Dialog open={genLoading} onClose={() => {}} className="relative z-50">
        <div style={modalOverlay} aria-hidden="true" />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <DialogPanel style={{ ...modalPanel, maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', border: `3px solid ${C.ruleLight}`, borderTopColor: ADMIN_ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
            <DialogTitle style={modalTitle}>GENERATING QUESTIONS</DialogTitle>
            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.muted, margin: '0 0 4px' }}>Creating questions for {selectedRaceForGen?.seat}...</p>
            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg, margin: 0 }}>This may take 1–2 minutes.</p>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Modal: Generation Success */}
      <Dialog open={genResult !== null} onClose={() => setGenResult(null)} className="relative z-50">
        <div style={modalOverlay} aria-hidden="true" />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <DialogPanel style={modalPanel}>
            <DialogTitle style={{ ...modalTitle, color: C.correct }}>QUESTIONS GENERATED</DialogTitle>
            {genResult && (
              <>
                <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, marginBottom: '4px' }}>
                  <strong>{genResult.questionsCreated}</strong> draft questions created for {genResult.jurisdiction}.
                  {genResult.archived > 0 && ` (${genResult.archived} previous questions archived)`}
                </p>
                {(genResult.questionsRejected ?? 0) > 0 && (
                  <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.incorrect, marginBottom: '4px' }}>
                    <strong>{genResult.questionsRejected}</strong> more{' '}
                    {genResult.questionsRejected === 1 ? 'was' : 'were'} refused by the question
                    schema and not written — wrong option count, an answer index outside the
                    options, an unknown difficulty, a missing source or a banned explanation
                    opener. The reason for each is in the generation job log. This is the prompt
                    to look at, not the questions that did land.
                  </p>
                )}
                <div style={{ margin: '16px 0' }}>
                  <Link
                    to={`/admin/questions?collection=${genResult.collectionSlug}&status=draft`}
                    style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px', letterSpacing: '0.1em', color: ADMIN_ACCENT, textDecoration: 'none' }}
                    onClick={() => setGenResult(null)}
                  >
                    VIEW IN EXPLORER &rarr;
                  </Link>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setGenResult(null)} style={btnSecondary}>CLOSE</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Modal: Generation Error / Blocked */}
      <Dialog open={genError !== null} onClose={() => setGenError(null)} className="relative z-50">
        <div style={modalOverlay} aria-hidden="true" />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <DialogPanel style={modalPanel}>
            {genError?.type === 'blocked' ? (
              <>
                <DialogTitle style={{ ...modalTitle, color: '#92400E' }}>QUESTIONS ALREADY GENERATED</DialogTitle>
                <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, marginBottom: '4px' }}>
                  {genError.existingCount} questions already exist for this race.
                </p>
                {genError.generatedAt && (
                  <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg, marginBottom: '12px' }}>
                    Generated: {new Date(genError.generatedAt).toLocaleDateString()}
                  </p>
                )}
                <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.muted, marginBottom: '20px' }}>
                  Force Regenerate will archive the existing questions and create new ones.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setGenError(null)} style={btnSecondary}>CANCEL</button>
                  <button onClick={() => { setGenError(null); startGeneration(generatingRaceId!, genCollectionSlug, true); }} style={btnAmber}>FORCE REGENERATE</button>
                </div>
              </>
            ) : (
              <>
                <DialogTitle style={{ ...modalTitle, color: C.incorrect }}>GENERATION FAILED</DialogTitle>
                <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, marginBottom: '20px' }}>{genError?.message}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setGenError(null)} style={btnSecondary}>CLOSE</button>
                </div>
              </>
            )}
          </DialogPanel>
        </div>
      </Dialog>

      {/* Modal: Edit Race */}
      <Dialog open={editingRace !== null} onClose={() => setEditingRace(null)} className="relative z-50">
        <div style={modalOverlay} aria-hidden="true" />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
          <DialogPanel style={{ ...modalPanel, maxWidth: '560px', margin: '32px 0' }}>
            <DialogTitle style={modalTitle}>EDIT RACE — {editingRace?.seat}</DialogTitle>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="md:grid-cols-2">
                <div>
                  <label style={labelStyle}>SEAT NAME <span style={{ color: C.incorrect }}>*</span></label>
                  <input type="text" required value={editForm.seat} onChange={(e) => setEditForm((p) => ({ ...p, seat: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>ELECTION TYPE <span style={{ color: C.incorrect }}>*</span></label>
                  <select required value={editForm.electionType} onChange={(e) => setEditForm((p) => ({ ...p, electionType: e.target.value }))} style={selectStyle}>
                    <option value="general">General</option>
                    <option value="primary">Primary</option>
                    <option value="runoff">Runoff</option>
                    <option value="by-election">By-Election</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="md:grid-cols-2">
                <div>
                  <label style={labelStyle}>ELECTION DATE <span style={{ color: C.incorrect }}>*</span></label>
                  <input type="date" required value={editForm.electionDate} onChange={(e) => setEditForm((p) => ({ ...p, electionDate: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>JURISDICTION <span style={{ color: C.incorrect }}>*</span></label>
                  {collections.length > 0 ? (
                    <select required value={editForm.jurisdiction} onChange={(e) => setEditForm((p) => ({ ...p, jurisdiction: e.target.value }))} style={selectStyle}>
                      <option value="">— select a collection —</option>
                      {collections.map(c => <option key={c.slug} value={c.name}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" required value={editForm.jurisdiction} onChange={(e) => setEditForm((p) => ({ ...p, jurisdiction: e.target.value }))} style={inputStyle} />
                  )}
                </div>
              </div>
              <div style={{ maxWidth: '260px' }}>
                <label style={labelStyle}>TIMEZONE <span style={{ color: C.incorrect }}>*</span></label>
                <input type="text" required value={editForm.timezone} onChange={(e) => setEditForm((p) => ({ ...p, timezone: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>CANDIDATES</label>
                  <button type="button" onClick={() => setEditForm((p) => ({ ...p, candidates: [...p.candidates, emptyCandidate()] }))} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', letterSpacing: '0.1em', color: ADMIN_ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}>
                    + ADD CANDIDATE
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {editForm.candidates.map((candidate, idx) => (
                    <CandidateRow key={idx} candidate={candidate} idx={idx} onChange={updateEditCandidate} onRemove={(i) => setEditForm((p) => ({ ...p, candidates: p.candidates.filter((_, ci) => ci !== i) }))} canRemove={editForm.candidates.length > 1} />
                  ))}
                </div>
              </div>
              {editError && (
                <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.incorrect, margin: 0, padding: '10px 12px', border: `1px solid ${C.incorrect}`, borderRadius: '2px' }}>{editError}</p>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button type="button" onClick={() => setEditingRace(null)} style={btnSecondary}>CANCEL</button>
                <button type="submit" disabled={editSubmitting} style={{ ...btnPrimary, opacity: editSubmitting ? 0.5 : 1, cursor: editSubmitting ? 'not-allowed' : 'pointer' }}>
                  {editSubmitting ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Modal: Delete Race Confirm */}
      <Dialog open={deletingRace !== null} onClose={() => setDeletingRace(null)} className="relative z-50">
        <div style={modalOverlay} aria-hidden="true" />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <DialogPanel style={modalPanel}>
            <DialogTitle style={modalTitle}>DELETE RACE?</DialogTitle>
            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.muted, marginBottom: '20px' }}>
              Delete <strong style={{ color: C.ink }}>{deletingRace?.seat}</strong>? Questions linked to this race will be unlinked (not deleted).
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeletingRace(null)} style={btnSecondary}>CANCEL</button>
              <button onClick={handleDeleteConfirm} disabled={deleteLoading} style={{ ...btnDanger, opacity: deleteLoading ? 0.5 : 1, cursor: deleteLoading ? 'not-allowed' : 'pointer' }}>
                {deleteLoading ? 'DELETING...' : 'DELETE RACE'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Modal: Re-generate Confirm */}
      <Dialog open={regenConfirmOpen} onClose={() => { setRegenConfirmOpen(false); setRegenRace(null); }} className="relative z-50">
        <div style={modalOverlay} aria-hidden="true" />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <DialogPanel style={modalPanel}>
            <DialogTitle style={{ ...modalTitle, color: '#92400E' }}>RE-GENERATE QUESTIONS?</DialogTitle>
            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.muted, marginBottom: '8px' }}>
              Race: <strong style={{ color: C.ink }}>{regenRace?.seat}</strong>
            </p>
            {regenCounts ? (
              <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.muted, marginBottom: '20px' }}>
                Re-generating will archive <strong style={{ color: C.ink }}>{regenCounts.activeCount}</strong> active question{regenCounts.activeCount !== 1 ? 's' : ''} and
                delete <strong style={{ color: C.ink }}>{regenCounts.draftCount}</strong> draft question{regenCounts.draftCount !== 1 ? 's' : ''}. Continue?
              </p>
            ) : (
              <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: '13px', color: C.mutedFg, marginBottom: '20px' }}>Loading question counts...</p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setRegenConfirmOpen(false); setRegenRace(null); }} style={btnSecondary}>CANCEL</button>
              <button onClick={handleRegenConfirm} disabled={regenLoading} style={{ ...btnAmber, opacity: regenLoading ? 0.5 : 1, cursor: regenLoading ? 'not-allowed' : 'pointer' }}>
                {regenLoading ? 'RE-GENERATING...' : 'RE-GENERATE'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Modal: Enter Result */}
      <Dialog open={resultRace !== null} onClose={() => setResultRace(null)} className="relative z-50">
        <div style={modalOverlay} aria-hidden="true" />
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <DialogPanel style={modalPanel}>
            <DialogTitle style={modalTitle}>ENTER ELECTION RESULT — {resultRace?.seat}</DialogTitle>
            <form onSubmit={handleResultSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>WINNER NAME <span style={{ color: C.incorrect }}>*</span></label>
                <input type="text" required placeholder="e.g., Jane Smith" value={resultForm.winnerName} onChange={(e) => setResultForm((p) => ({ ...p, winnerName: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TERM END DATE <span style={{ color: C.incorrect }}>*</span></label>
                <input type="date" required value={resultForm.termEndDate} onChange={(e) => setResultForm((p) => ({ ...p, termEndDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>COLLECTION <span style={{ color: C.incorrect }}>*</span></label>
                {collections.length > 0 ? (
                  <select required value={resultForm.collectionSlug} onChange={(e) => setResultForm((p) => ({ ...p, collectionSlug: e.target.value }))} style={selectStyle}>
                    <option value="">— select a collection —</option>
                    {collections.map(c => <option key={c.slug} value={c.slug}>{c.name} ({c.slug})</option>)}
                  </select>
                ) : (
                  <input type="text" required placeholder="e.g., bloomington-in" value={resultForm.collectionSlug} onChange={(e) => setResultForm((p) => ({ ...p, collectionSlug: e.target.value }))} style={inputStyle} />
                )}
              </div>
              {resultError && (
                <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.incorrect, margin: 0, padding: '10px 12px', border: `1px solid ${C.incorrect}`, borderRadius: '2px' }}>{resultError}</p>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
                <button type="button" onClick={() => setResultRace(null)} style={btnSecondary}>CANCEL</button>
                <button type="submit" disabled={resultLoading} style={{ ...btnPrimary, opacity: resultLoading ? 0.5 : 1, cursor: resultLoading ? 'not-allowed' : 'pointer' }}>
                  {resultLoading ? 'GENERATING...' : 'GENERATE CURRENT-TERM QUESTIONS'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 100,
          padding: '12px 20px',
          borderRadius: '2px',
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '13px',
          letterSpacing: '0.1em',
          color: '#fff',
          backgroundColor: toast.type === 'success' ? C.correct : C.incorrect,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

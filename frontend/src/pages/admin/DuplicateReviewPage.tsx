import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { API_URL } from '../../services/api';
import { DuplicateClusterCard } from './components/DuplicateClusterCard';
import { EnrichedCluster, AdvancedFlag, DuplicateSummary } from '../../types/duplicates';
import { useTheme } from '../../hooks/useTheme';
import { useWindowSize } from '../../hooks/useWindowSize';

const ADMIN_ACCENT = '#FF5740';

interface ToastState {
  message: string;
  clusterId: string | null;
  visible: boolean;
  countdown: number;
}

function useUndoToast() {
  const [toast, setToast] = useState<ToastState>({ message: '', clusterId: null, visible: false, countdown: 30 });
  const timeoutRef = useRef<number | undefined>(undefined);
  const countdownRef = useRef<number | undefined>(undefined);

  const showToast = (message: string, clusterId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setToast({ message, clusterId, visible: true, countdown: 30 });
    let remaining = 30;
    countdownRef.current = window.setInterval(() => {
      remaining -= 1;
      setToast((prev) => ({ ...prev, countdown: remaining }));
      if (remaining <= 0) { clearInterval(countdownRef.current); setToast((prev) => ({ ...prev, visible: false })); }
    }, 1000);
    timeoutRef.current = window.setTimeout(() => { setToast((prev) => ({ ...prev, visible: false })); }, 30000);
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  return { toast, showToast, hideToast };
}

function UndoToast({ message, countdown, visible, onClose, onUndo }: {
  message: string; countdown: number; visible: boolean; onClose: () => void; onUndo: () => void;
}) {
  const { width: toastWidth } = useWindowSize();
  const toastIsMobile = toastWidth < 480;
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      ...(toastIsMobile
        ? { left: '16px', right: '16px' }
        : { right: '24px', minWidth: '320px' }),
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
      <span style={{ flex: 1, fontFamily: "'Lora', Georgia, serif", fontSize: '13px' }}>{message}</span>
      <button onClick={onUndo} style={{ color: '#D4A017', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px', letterSpacing: '0.1em', padding: '0 8px' }}>
        UNDO ({countdown}s)
      </button>
      <button onClick={onClose} style={{ color: '#7A6A5A', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0' }}>×</button>
    </div>
  );
}

export function DuplicateReviewPage() {
  const { accessToken } = useAuthStore();
  const { C } = useTheme();
  const { width } = useWindowSize();
  const isMobile = width < 768;

  const [clusters, setClusters] = useState<EnrichedCluster[]>([]);
  const [advancedFlags, setAdvancedFlags] = useState<AdvancedFlag[]>([]);
  const [summary, setSummary] = useState<DuplicateSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { toast, showToast, hideToast } = useUndoToast();

  useEffect(() => { fetchClusters(); }, [accessToken]);

  const fetchClusters = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/duplicates`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to fetch duplicate clusters');
      const data = await response.json();
      if (data.noReports) {
        setError('No duplicate scan reports found on this server. Run the scan locally to generate reports.');
        setClusters([]);
        return;
      }
      setClusters(data.clusters || []);
      setAdvancedFlags(data.advancedFlags || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (clusterId: string, keepExternalIds: string[]) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/duplicates/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clusterId, keepExternalIds }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Failed to resolve cluster');
      }
      const result = await response.json();
      const keepSet = new Set(keepExternalIds);
      setClusters((prev) =>
        prev.map((c) =>
          c.clusterId === clusterId
            ? { ...c, resolved: true, resolution: { keepIds: keepExternalIds, archivedIds: result.archivedIds || c.questions.filter(q => !keepSet.has(q.externalId)).map(q => q.externalId), resolvedAt: new Date().toISOString() } }
            : c
        )
      );
      const archivedCount = result.archivedIds?.length || (clusters.find(c => c.clusterId === clusterId)?.questions.length || 0) - keepExternalIds.length;
      showToast(`Cluster resolved. ${archivedCount} ${archivedCount === 1 ? 'question' : 'questions'} archived.`, clusterId);
      if (summary) setSummary({ ...summary, resolved: summary.resolved + 1, pendingReview: summary.pendingReview - 1 });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve cluster');
    }
  };

  const handleUndo = async (clusterId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/duplicates/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ clusterId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to undo resolution');
      }
      setClusters((prev) => prev.map((c) => c.clusterId === clusterId ? { ...c, resolved: false, resolution: undefined } : c));
      hideToast();
      if (summary) setSummary({ ...summary, resolved: summary.resolved - 1, pendingReview: summary.pendingReview + 1 });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to undo resolution');
    }
  };

  const handleAutoResolveAll = async () => {
    if (!accessToken) return;
    const autoResolvableCount = clusters.filter(c => c.autoResolvable && !c.resolved).length;
    if (autoResolvableCount === 0) { alert('No auto-resolvable clusters found'); return; }
    const confirmed = confirm(`Auto-resolve ${autoResolvableCount} high-confidence duplicate ${autoResolvableCount === 1 ? 'cluster' : 'clusters'}?\n\nThis will keep the recommended question and archive the rest.`);
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/duplicates/auto-resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to auto-resolve clusters');
      const result = await response.json();
      await fetchClusters();
      alert(`Successfully resolved ${result.resolvedCount} ${result.resolvedCount === 1 ? 'cluster' : 'clusters'}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to auto-resolve');
    }
  };

  const filteredClusters = clusters.filter((cluster) => {
    if (tierFilter !== 'all' && cluster.tier !== tierFilter) return false;
    if (statusFilter === 'pending' && cluster.resolved) return false;
    if (statusFilter === 'resolved' && !cluster.resolved) return false;
    return true;
  });

  const selectStyle: React.CSSProperties = {
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '11px',
    letterSpacing: '0.14em',
    color: C.muted,
    marginBottom: '6px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '0.06em', color: C.ink, margin: '0 0 8px 0' }}>
          Duplicate Review
        </h1>
        <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: '13px', color: C.muted, margin: 0 }}>
          Review and resolve duplicate question clusters
        </p>
      </div>

      {/* Summary stats strip */}
      {summary && (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
              {[
                { label: 'TOTAL CLUSTERS', value: summary.totalClusters, color: C.ink },
                { label: 'PENDING REVIEW', value: summary.pendingReview, color: '#92400E' },
                { label: 'RESOLVED', value: summary.resolved, color: C.correct },
                { label: 'AUTO-RESOLVABLE', value: summary.autoResolvable, color: '#1E5A8A' },
                ...(advancedFlags.length > 0 ? [{ label: 'ADVANCED FLAGS', value: advancedFlags.length, color: C.incorrect }] : []),
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10px', letterSpacing: '0.12em', color: C.mutedFg, marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>
            {summary.autoResolvable > 0 && (
              <button
                onClick={handleAutoResolveAll}
                style={{
                  padding: '8px 16px',
                  backgroundColor: ADMIN_ACCENT,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '2px',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '13px',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                AUTO-RESOLVE ALL ({summary.autoResolvable})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
        <div>
          <label htmlFor="tier" style={labelStyle}>TIER</label>
          <select id="tier" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} style={selectStyle}>
            <option value="all">All tiers</option>
            <option value="exact">Exact</option>
            <option value="near-duplicate">Near-duplicate</option>
            <option value="possible">Possible</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" style={labelStyle}>STATUS</label>
          <select id="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ border: `1px solid ${C.incorrect}`, borderRadius: '2px', padding: '12px 16px' }}>
          <p style={{ fontFamily: "'Lora', Georgia, serif", color: C.incorrect, margin: 0, fontSize: '13px' }}>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted }}>Loading clusters...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredClusters.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px', border: `1px solid ${C.rule}`, borderRadius: '2px' }}>
          <svg width="40" height="40" style={{ color: C.mutedFg, marginBottom: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted, textAlign: 'center', margin: 0 }}>
            {tierFilter === 'all' && statusFilter === 'all' ? 'No duplicate clusters found' : 'No clusters match the selected filters'}
          </p>
        </div>
      )}

      {/* Cluster list */}
      {!loading && filteredClusters.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredClusters.map((cluster) => (
            <DuplicateClusterCard
              key={cluster.clusterId}
              cluster={cluster}
              onResolve={handleResolve}
              onUndo={handleUndo}
              advancedFlags={advancedFlags}
            />
          ))}
        </div>
      )}

      <UndoToast
        message={toast.message}
        countdown={toast.countdown}
        visible={toast.visible}
        onClose={hideToast}
        onUndo={() => toast.clusterId && handleUndo(toast.clusterId)}
      />
    </div>
  );
}

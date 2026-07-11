import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { API_URL } from '../../services/api';
import { CollectionCard } from './components/CollectionCard';
import { useTheme } from '../../hooks/useTheme';

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

export function CollectionsPage() {
  const { accessToken } = useAuthStore();
  const { C } = useTheme();
  const [collections, setCollections] = useState<CollectionHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => { fetchCollections(); }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/admin/collections/health`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('Failed to fetch collection health data');
      const data = await response.json();
      setCollections(data.collections || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = (id: number) => setExpandedId(expandedId === id ? null : id);
  const activeCollectionsCount = collections.filter(c => c.isActive).length;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '0.06em', color: C.ink, margin: '0 0 8px 0' }}>
          Collection Health
        </h1>
        <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', fontSize: '13px', color: C.muted, margin: 0 }}>
          Monitor question counts, quality scores, and performance across {activeCollectionsCount} active collections
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '24px', opacity: 0.5 }}>
              <div style={{ height: '20px', backgroundColor: C.ruleLight, borderRadius: '2px', width: '75%', marginBottom: '16px' }} />
              <div style={{ height: '14px', backgroundColor: C.ruleLight, borderRadius: '2px', width: '50%', marginBottom: '12px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ height: '32px', backgroundColor: C.ruleLight, borderRadius: '2px' }} />
                <div style={{ height: '32px', backgroundColor: C.ruleLight, borderRadius: '2px' }} />
                <div style={{ height: '32px', backgroundColor: C.ruleLight, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ border: `1px solid ${C.incorrect}`, borderRadius: '2px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" style={{ color: C.incorrect, marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.ink, margin: 0 }}>{error}</p>
            </div>
            <button
              onClick={fetchCollections}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '12px',
                letterSpacing: '0.1em',
                color: '#FF5740',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Collections grid */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              expanded={expandedId === collection.id}
              onToggleExpand={() => handleToggleExpand(collection.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && collections.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <svg width="40" height="40" style={{ color: C.mutedFg, margin: '0 auto 16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '18px', letterSpacing: '0.1em', color: C.ink, margin: '0 0 8px 0' }}>No Collections</h3>
          <p style={{ fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.muted, margin: 0 }}>No collections found in the system.</p>
        </div>
      )}
    </div>
  );
}

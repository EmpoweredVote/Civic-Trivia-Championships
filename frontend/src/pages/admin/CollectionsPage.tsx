import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { API_URL } from '../../services/api';
import { CollectionCard } from './components/CollectionCard';

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
  const [collections, setCollections] = useState<CollectionHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const handleToggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const activeCollectionsCount = collections.filter(c => c.isActive).length;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Collection Health</h1>
        <p className="mt-2 text-gray-600">
          Monitor question counts, quality scores, and performance across {activeCollectionsCount} active collections
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-8 bg-gray-200 rounded" />
                <div className="h-8 bg-gray-200 rounded" />
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={fetchCollections}
              className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Collections grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Collections</h3>
          <p className="text-gray-500">No collections found in the system.</p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { API_URL } from '../../services/api';

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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user?.name || 'Admin'}
        </h1>
        <p className="mt-2 text-gray-600">
          Overview of content health and admin tools
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
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

      {/* Stats overview row */}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Total Active Questions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-500 mb-2">Total Active Questions</div>
              <div className="text-3xl font-bold text-gray-900">{totalActiveQuestions.toLocaleString()}</div>
            </div>

            {/* Total Collections */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-500 mb-2">Total Collections</div>
              <div className="text-3xl font-bold text-gray-900">{totalCollections}</div>
            </div>

            {/* Avg Quality Score */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-500 mb-2">Avg Quality Score</div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-gray-900">
                  {avgQualityScore !== null ? Math.round(avgQualityScore) : 'N/A'}
                </div>
                {avgQualityScore !== null && (
                  <div
                    className={`w-3 h-3 rounded-full ${
                      avgQualityScore >= 70 ? 'bg-green-600' : avgQualityScore >= 50 ? 'bg-yellow-500' : 'bg-red-600'
                    }`}
                  />
                )}
              </div>
            </div>

            {/* Overall Correct Rate */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-500 mb-2">Overall Correct Rate</div>
              <div className="text-3xl font-bold text-gray-900">
                {overallCorrectRate !== null ? `${Math.round(overallCorrectRate * 100)}%` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Collections needing attention */}
          <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Collections Needing Attention</h2>
            {collectionsNeedingAttention.length === 0 ? (
              <div className="flex items-center text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">All collections healthy</span>
              </div>
            ) : (
              <div className="space-y-3">
                {collectionsNeedingAttention.map(c => {
                  const hasLowCount = c.stats.activeCount < 50;
                  const hasLowQuality = c.stats.quality.avgScore !== null && c.stats.quality.avgScore < 70;
                  const healthStatus = c.stats.activeCount < 50 || (c.stats.quality.avgScore !== null && c.stats.quality.avgScore < 50) ? 'red' : 'yellow';

                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${healthStatus === 'red' ? 'bg-red-600' : 'bg-yellow-500'}`} />
                        <div>
                          <div className="font-medium text-gray-900">{c.name}</div>
                          <div className="text-sm text-gray-600">
                            {hasLowCount && `Only ${c.stats.activeCount} active questions`}
                            {hasLowCount && hasLowQuality && ' • '}
                            {hasLowQuality && `Low quality score (${Math.round(c.stats.quality.avgScore!)})`}
                          </div>
                        </div>
                      </div>
                      <Link
                        to="/admin/collections"
                        className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                      >
                        Investigate
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Question Explorer card */}
              <Link
                to="/admin/questions"
                className="bg-white rounded-lg border-2 border-red-100 p-6 hover:border-red-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-lg mb-4 group-hover:bg-red-100 transition-colors">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Question Explorer</h3>
                <p className="text-sm text-gray-600">Browse, filter, and inspect all questions</p>
              </Link>

              {/* Collection Health card */}
              <Link
                to="/admin/collections"
                className="bg-white rounded-lg border-2 border-red-100 p-6 hover:border-red-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-lg mb-4 group-hover:bg-red-100 transition-colors">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Collection Health</h3>
                <p className="text-sm text-gray-600">Monitor question counts and quality</p>
              </Link>
            </div>
          </div>

          {/* Content Generation - Future card */}
          <div className="mt-8 bg-white rounded-lg border-2 border-gray-200 p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Content Generation</h3>
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">AI-powered question pipeline</p>
            <p className="text-xs text-gray-500 font-medium">Coming in Phase 21</p>
          </div>
        </>
      )}
    </div>
  );
}

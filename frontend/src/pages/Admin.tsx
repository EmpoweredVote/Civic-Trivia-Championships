import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { useAdminQuestions } from '../features/admin/hooks/useAdminQuestions';
import type { StatusFilter } from '../features/admin/types';

export function Admin() {
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

  // Default renew date to 1 year from today
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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (question: typeof questions[0]) => {
    if (question.status === 'archived') {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700">
          Archived
        </span>
      );
    }

    if (question.status === 'expired') {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-red-100 text-red-700">
          Expired
        </span>
      );
    }

    // Active with expiresAt = expiring soon
    if (question.expiresAt) {
      return (
        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700">
          Expiring Soon
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
        Active
      </span>
    );
  };

  const getDifficultyBadge = (difficulty: string) => {
    const colors = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      hard: 'bg-red-100 text-red-700',
    };

    const colorClass = colors[difficulty as keyof typeof colors] || colors.medium;

    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colorClass}`}>
        {difficulty}
      </span>
    );
  };

  const filterTabs: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'expired', label: 'Expired' },
    { value: 'expiring-soon', label: 'Expiring Soon' },
    { value: 'archived', label: 'Archived' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Content Review</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage expired and expiring-soon questions
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-2 mb-6 border-b border-gray-200">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-4 py-2 min-h-[48px] font-medium text-sm transition-colors border-b-2 ${
                  filter === tab.value
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Questions List */}
          {!loading && !error && (
            <>
              {questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-gray-600">
                    {filter === 'expired' && 'No expired questions found'}
                    {filter === 'expiring-soon' && 'No expiring-soon questions found'}
                    {filter === 'archived' && 'No archived questions found'}
                    {filter === 'all' && 'No questions need attention'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Desktop: Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Question
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Collections
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Difficulty
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Expires At
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {questions.map((question) => (
                          <tr key={question.id}>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {getStatusBadge(question)}
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-gray-900">
                                {question.text.length > 80
                                  ? `${question.text.substring(0, 80)}...`
                                  : question.text}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {question.externalId}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1">
                                {question.collectionNames.map((name) => (
                                  <span
                                    key={name}
                                    className="inline-flex items-center rounded-full px-2 py-1 text-xs bg-gray-100 text-gray-700"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {getDifficultyBadge(question.difficulty)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                              {formatDate(question.expiresAt)}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                              {renewingId === question.id ? (
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="date"
                                    value={renewDate}
                                    onChange={(e) => setRenewDate(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                    disabled={actionLoading}
                                  />
                                  <button
                                    onClick={() => handleRenewSubmit(question.id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setRenewingId(null)}
                                    disabled={actionLoading}
                                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex space-x-2">
                                  {(question.status === 'expired' ||
                                    (question.status === 'active' && question.expiresAt)) && (
                                    <button
                                      onClick={() => handleRenewClick(question.id)}
                                      disabled={actionLoading}
                                      className="px-3 py-1 min-h-[40px] bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50"
                                    >
                                      Renew
                                    </button>
                                  )}
                                  {question.status === 'expired' && (
                                    <button
                                      onClick={() => handleArchiveClick(question.id)}
                                      disabled={actionLoading}
                                      className="px-3 py-1 min-h-[40px] bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
                                    >
                                      Archive
                                    </button>
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
                  <div className="lg:hidden space-y-4">
                    {questions.map((question) => (
                      <div
                        key={question.id}
                        className="border border-gray-200 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              {getStatusBadge(question)}
                              {getDifficultyBadge(question.difficulty)}
                            </div>
                            <p className="text-sm text-gray-900 mb-1">
                              {question.text.length > 80
                                ? `${question.text.substring(0, 80)}...`
                                : question.text}
                            </p>
                            <p className="text-xs text-gray-500">{question.externalId}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {question.collectionNames.map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center rounded-full px-2 py-1 text-xs bg-gray-100 text-gray-700"
                            >
                              {name}
                            </span>
                          ))}
                        </div>

                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Expires:</span> {formatDate(question.expiresAt)}
                        </div>

                        {renewingId === question.id ? (
                          <div className="space-y-2">
                            <input
                              type="date"
                              value={renewDate}
                              onChange={(e) => setRenewDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded"
                              disabled={actionLoading}
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleRenewSubmit(question.id)}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 min-h-[48px] bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setRenewingId(null)}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 min-h-[48px] bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            {(question.status === 'expired' ||
                              (question.status === 'active' && question.expiresAt)) && (
                              <button
                                onClick={() => handleRenewClick(question.id)}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 min-h-[48px] bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50"
                              >
                                Renew
                              </button>
                            )}
                            {question.status === 'expired' && (
                              <button
                                onClick={() => handleArchiveClick(question.id)}
                                disabled={actionLoading}
                                className="flex-1 px-4 py-2 min-h-[48px] bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
                              >
                                Archive
                              </button>
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

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useDebounce } from '../../hooks/useDebounce';
import { QuestionTable, QuestionRow } from './components/QuestionTable';
import { QuestionDetailPanel } from './components/QuestionDetailPanel';

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ExploreResponse {
  data: QuestionRow[];
  pagination: PaginationMeta;
}

export function QuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken } = useAuthStore();

  // Local state for search input (debounced before syncing to URL)
  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  );
  const debouncedSearch = useDebounce(searchInput, 300);

  // Data state
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Detail panel state
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(
    null
  );
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  // Collections list (hardcoded for now)
  const collections = [
    'Politics 101',
    'Voting & Civics',
    'Bills',
    'Terminology',
    'History',
  ];

  // Get current filter values from URL
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const sort = searchParams.get('sort') || 'quality_score';
  const order = searchParams.get('order') || 'asc';
  const collection = searchParams.get('collection') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  // Sync debounced search to URL
  useEffect(() => {
    if (debouncedSearch !== search) {
      updateParam('search', debouncedSearch);
      // Reset to page 1 when search changes
      if (debouncedSearch !== searchInput) {
        updateParam('page', '1');
      }
    }
  }, [debouncedSearch]);

  // Fetch data when URL params change
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!accessToken) return;

      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('limit', limit.toString());
        params.set('sort', sort);
        params.set('order', order);
        if (collection) params.set('collection', collection);
        if (difficulty) params.set('difficulty', difficulty);
        if (status) params.set('status', status);
        if (search) params.set('search', search);

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/admin/questions/explore?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }

        const data: ExploreResponse = await response.json();
        setQuestions(data.data);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setQuestions([]);
      }
    };

    fetchQuestions();
  }, [searchParams.toString(), accessToken]);

  // Helper to update a single URL param
  const updateParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    updateParam(key, value);
    // Reset to page 1 when filters change
    updateParam('page', '1');
  };

  // Handle sort change
  const handleSortChange = (column: string) => {
    if (sort === column) {
      // Toggle order
      updateParam('order', order === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to asc
      updateParam('sort', column);
      updateParam('order', 'asc');
    }
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    updateParam('page', newPage.toString());
  };

  // Handle question click
  const handleQuestionClick = (id: number, index: number) => {
    setSelectedQuestionId(id);
    setSelectedQuestionIndex(index);
  };

  // Handle detail panel navigation
  const handlePanelNavigate = (direction: 'prev' | 'next') => {
    if (!questions) return;

    if (direction === 'prev' && selectedQuestionIndex > 0) {
      const newIndex = selectedQuestionIndex - 1;
      setSelectedQuestionIndex(newIndex);
      setSelectedQuestionId(questions[newIndex].id);
    } else if (
      direction === 'next' &&
      selectedQuestionIndex < questions.length - 1
    ) {
      const newIndex = selectedQuestionIndex + 1;
      setSelectedQuestionIndex(newIndex);
      setSelectedQuestionId(questions[newIndex].id);
    }
  };

  // Handle detail panel close
  const handlePanelClose = () => {
    setSelectedQuestionId(null);
  };

  // Calculate pagination display
  const startItem = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endItem = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.total)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Question Explorer</h1>
        <p className="mt-2 text-sm text-gray-600">
          Browse, search, and inspect questions across all collections
        </p>
      </div>

      {/* Search */}
      <div>
        <label htmlFor="search" className="sr-only">
          Search questions
        </label>
        <input
          type="text"
          id="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search questions, answers, or explanations..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="collection"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Collection
          </label>
          <select
            id="collection"
            value={collection}
            onChange={(e) => handleFilterChange('collection', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
          >
            <option value="">All collections</option>
            {collections.map((coll) => (
              <option key={coll} value={coll}>
                {coll}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="difficulty"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Difficulty
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => handleFilterChange('difficulty', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
          >
            <option value="">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <QuestionTable
          questions={questions}
          sort={sort}
          order={order}
          onSortChange={handleSortChange}
          onQuestionClick={handleQuestionClick}
        />
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{pagination.total}</span> results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === pagination.totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      <QuestionDetailPanel
        questionId={selectedQuestionId}
        onClose={handlePanelClose}
        onNavigate={handlePanelNavigate}
        hasPrev={selectedQuestionIndex > 0}
        hasNext={questions ? selectedQuestionIndex < questions.length - 1 : false}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import type { AdminQuestion, StatusFilter } from '../types';

interface UseAdminQuestionsReturn {
  questions: AdminQuestion[];
  loading: boolean;
  error: string | null;
  filter: StatusFilter;
  setFilter: (filter: StatusFilter) => void;
  renewQuestion: (id: number, expiresAt: string) => Promise<void>;
  archiveQuestion: (id: number) => Promise<void>;
  fetchQuestions: () => Promise<void>;
}

export function useAdminQuestions(): UseAdminQuestionsReturn {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const url = filter === 'all'
        ? '/api/admin/questions'
        : `/api/admin/questions?status=${filter}`;

      const data = await apiRequest<{ questions: AdminQuestion[] }>(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setQuestions(data.questions);
    } catch (err: any) {
      setError(err?.error || 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [filter]);

  const renewQuestion = async (id: number, expiresAt: string) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    await apiRequest(`/api/admin/questions/${id}/renew`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ expiresAt }),
    });

    await fetchQuestions();
  };

  const archiveQuestion = async (id: number) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    await apiRequest(`/api/admin/questions/${id}/archive`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    await fetchQuestions();
  };

  return {
    questions,
    loading,
    error,
    filter,
    setFilter,
    renewQuestion,
    archiveQuestion,
    fetchQuestions,
  };
}

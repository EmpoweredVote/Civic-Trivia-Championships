import { apiRequest } from './api';
import type { Question } from '../types/game';

interface FetchQuestionsResponse {
  questions: Question[];
}

export async function fetchQuestions(): Promise<Question[]> {
  const response = await apiRequest<FetchQuestionsResponse>('/api/game/questions', {
    method: 'GET',
  });

  return response.questions;
}

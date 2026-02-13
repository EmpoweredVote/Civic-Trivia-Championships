import { apiRequest } from './api';
import { useAuthStore } from '../store/authStore';
import { API_URL } from './api';

export interface ProfileStats {
  totalXp: number;
  totalGems: number;
  gamesPlayed: number;
  bestScore: number;
  overallAccuracy: number;
  avatarUrl: string | null;
  name: string;
  email: string;
}

export async function fetchProfile(): Promise<ProfileStats> {
  const { accessToken } = useAuthStore.getState();

  return apiRequest<ProfileStats>('/api/users/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const { accessToken } = useAuthStore.getState();

  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${API_URL}/api/users/profile/avatar`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw errorData;
  }

  return response.json();
}

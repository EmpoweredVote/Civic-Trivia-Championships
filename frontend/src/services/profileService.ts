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
  timerMultiplier: number;
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

export async function updateTimerMultiplier(multiplier: number): Promise<{ timerMultiplier: number }> {
  const { accessToken } = useAuthStore.getState();

  return apiRequest<{ timerMultiplier: number }>('/api/users/profile/settings', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ timerMultiplier: multiplier }),
  });
}

export async function updateName(name: string): Promise<{ name: string }> {
  const { accessToken } = useAuthStore.getState();

  return apiRequest<{ name: string }>('/api/users/profile/name', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const { accessToken } = useAuthStore.getState();

  return apiRequest<{ message: string }>('/api/users/profile/password', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

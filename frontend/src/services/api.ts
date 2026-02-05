import { useAuthStore } from '../store/authStore';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let isRefreshing = false;

async function refreshToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    useAuthStore.getState().setAuth(data.accessToken, data.user);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const mergedOptions: RequestInit = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options?.headers,
    },
  };

  const response = await fetch(API_URL + url, mergedOptions);

  // Handle 401 with automatic token refresh
  // Skip for refresh endpoint itself to avoid infinite loop
  if (response.status === 401 && !isRefreshing && !url.includes('/auth/refresh')) {
    isRefreshing = true;

    try {
      const newToken = await refreshToken();

      if (newToken) {
        // Retry the original request with new token
        const retryOptions: RequestInit = {
          ...mergedOptions,
          headers: {
            ...mergedOptions.headers,
            Authorization: `Bearer ${newToken}`,
          },
        };

        const retryResponse = await fetch(API_URL + url, retryOptions);

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json();
          throw errorData;
        }

        return retryResponse.json();
      } else {
        // Refresh failed - clear auth, let React Router handle redirect
        useAuthStore.getState().clearAuth();
        throw { error: 'Session expired' };
      }
    } finally {
      isRefreshing = false;
    }
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw errorData;
  }

  return response.json();
}

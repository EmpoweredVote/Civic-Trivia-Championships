import { useAuthStore } from '../store/authStore';
import { exchangeRefreshToken } from './accountsApi';

// Local dev with no VITE_API_URL uses the same-origin /ctc proxy in
// vite.config.ts (live data, no keys). Builds set VITE_API_URL.
export const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/ctc' : 'http://localhost:3000');

let isRefreshing = false;

export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Automatically attach Bearer token from store when available.
  // This removes the need for callers to manually add the auth header.
  if (accessToken) {
    defaultHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  };

  const response = await fetch(API_URL + url, mergedOptions);

  // Handle 401 with automatic token refresh using localStorage-based refresh token.
  // Uses exchangeRefreshToken from accountsApi (not cookie-based).
  if (response.status === 401 && !isRefreshing) {
    isRefreshing = true;

    try {
      const refreshResult = await exchangeRefreshToken();

      if (refreshResult) {
        const { access_token: newToken, refresh_token: newRefresh, user } = refreshResult;

        // Store new refresh token
        localStorage.setItem('ev_refresh_token', newRefresh);

        // Update store with new access token
        useAuthStore.getState().setAuth(newToken, user);

        // Retry the original request with the new token
        const retryOptions: RequestInit = {
          ...mergedOptions,
          headers: {
            ...mergedOptions.headers,
            Authorization: `Bearer ${newToken}`,
          },
        };

        const retryResponse = await fetch(API_URL + url, retryOptions);

        if (!retryResponse.ok) {
          let errorData: unknown;
          try {
            errorData = await retryResponse.json();
          } catch {
            errorData = { error: `Server error: ${retryResponse.status} ${retryResponse.statusText}` };
          }
          throw errorData;
        }

        return retryResponse.json();
      } else {
        // Refresh failed — clear auth and let React Router handle redirect
        useAuthStore.getState().clearAuth();
        throw { error: 'Session expired' };
      }
    } finally {
      isRefreshing = false;
    }
  }

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      // Response wasn't JSON (server error, HTML page, etc.)
      throw { error: `Server error: ${response.status} ${response.statusText}` };
    }
    throw errorData;
  }

  return response.json();
}

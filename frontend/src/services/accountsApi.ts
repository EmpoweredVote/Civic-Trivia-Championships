import type { AccountsUser, AccountProfile } from '../types/auth';

// Local dev with no env uses the same-origin /api proxy in vite.config.ts, so
// the sign-in check gets a clean 401 (signed out) instead of a refused port.
export const ACCOUNTS_API_URL =
  import.meta.env.VITE_EMPOWERED_ACCOUNTS_URL || (import.meta.env.DEV ? '' : 'http://localhost:3001');

export const ACCOUNTS_WEB_URL =
  import.meta.env.VITE_EMPOWERED_ACCOUNTS_WEB_URL || 'https://ev-accounts.onrender.com';

/**
 * Dedicated fetch wrapper for the Empowered Accounts API.
 * Do NOT use credentials: 'include' — accounts API is a different origin
 * and uses Bearer token auth only (no cookies).
 */
export async function accountsApiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(`${ACCOUNTS_API_URL}${path}`, {
    ...options,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: `HTTP ${response.status} ${response.statusText}` };
    }
    throw errorData;
  }

  return response.json() as Promise<T>;
}

/**
 * Exchange a stored refresh token for a new access token.
 * Reads refresh token from localStorage key 'ev_refresh_token'.
 *
 * Uses Supabase native token refresh endpoint directly, which works for any
 * Supabase JWT regardless of which Express service issued the original tokens.
 *
 * Returns null if no refresh token is stored or if refresh fails.
 * On failure, removes the stale refresh token from localStorage.
 */
export async function exchangeRefreshToken(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AccountsUser;
} | null> {
  const refreshToken = localStorage.getItem('ev_refresh_token');

  if (!refreshToken) {
    return null;
  }

  // Try Supabase native refresh endpoint first. The accounts API issues
  // standard Supabase JWTs, so the Supabase Auth endpoint accepts them directly.
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ACCOUNTS_API_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );

    if (!response.ok) {
      localStorage.removeItem('ev_refresh_token');
      return null;
    }

    const data = await response.json();

    // Supabase native refresh returns user with id, email but may not include tier.
    // Map to AccountsUser shape — tier defaults to 'inform' and will be
    // resolved on the next GET /api/account/me call (e.g., Profile page).
    const user: AccountsUser = {
      id: data.user?.id || '',
      email: data.user?.email || '',
      tier: (data.user?.user_metadata?.tier as AccountsUser['tier']) || 'inform',
    };

    const newRefreshToken: string = data.refresh_token;
    localStorage.setItem('ev_refresh_token', newRefreshToken);

    return {
      access_token: data.access_token,
      refresh_token: newRefreshToken,
      expires_in: data.expires_in || 3600,
      user,
    };
  } catch {
    localStorage.removeItem('ev_refresh_token');
    return null;
  }
}

/**
 * Fetch the full account profile from the Empowered Accounts API.
 * Requires a valid Bearer access token.
 */
export async function fetchAccountProfile(accessToken: string): Promise<AccountProfile> {
  return accountsApiFetch<AccountProfile>('/api/account/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Silent SSO session check. Reads the ev_session httpOnly cookie
 * (set by accounts.empowered.vote on login) and exchanges it for tokens.
 * Returns null if no cookie exists or exchange fails.
 *
 * Uses raw fetch with credentials: 'include' — the existing accountsApiFetch
 * wrapper explicitly omits credentials (Bearer-only), so we bypass it here.
 */
export async function ssoSessionCheck(): Promise<{
  access_token: string;
  refresh_token: string;
} | null> {
  const url = `${ACCOUNTS_API_URL}/api/auth/session`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401) return null;
    if (res.ok) return res.json();

    // 5xx: retry once after 1s (with its own 3s timeout)
    await new Promise((r) => setTimeout(r, 1000));
    const retryController = new AbortController();
    const retryTimeoutId = setTimeout(() => retryController.abort(), 3000);
    try {
      const retry = await fetch(url, { credentials: 'include', signal: retryController.signal });
      clearTimeout(retryTimeoutId);
      if (!retry.ok) return null;
      return retry.json();
    } catch {
      clearTimeout(retryTimeoutId);
      return null;
    }
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

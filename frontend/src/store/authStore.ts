import { create } from 'zustand';
import { identify, reset } from '@empoweredvote/analytics';
import type { AccountsUser, Tier } from '../types/auth';

interface AuthStore {
  accessToken: string | null;
  user: AccountsUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tier: Tier | null;
  tierResolved: boolean;
  displayName: string | null;
  timerMultiplier: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  setAuth: (token: string, user: AccountsUser, extras?: { tier?: Tier; displayName?: string }) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setTimerMultiplier: (multiplier: number) => void;
  setDisplayName: (name: string) => void;
  setTier: (tier: Tier) => void;
  setTierResolved: (resolved: boolean) => void;
  setAdminStatus: (isAdmin: boolean, isSuperAdmin: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  tier: null,
  tierResolved: false,
  displayName: null,
  timerMultiplier: 1.0,
  isAdmin: false,
  isSuperAdmin: false,

  setAuth: (token: string, user: AccountsUser, extras?: { tier?: Tier; displayName?: string }) => {
    // Stitch this person across every EV app via the Connected Account UUID
    // (see @empoweredvote/analytics identity model). Covers every login path
    // (interactive login, silent restore, token refresh).
    if (user.id) {
      identify(user.id);
    }
    set({
      accessToken: token,
      user,
      isAuthenticated: true,
      isLoading: false,
      tier: extras?.tier ?? user.tier ?? null,
      tierResolved: true,
      displayName: extras?.displayName ?? null,
    });
  },

  clearAuth: () => {
    localStorage.removeItem('ev_refresh_token');
    // Drop the PostHog identity so a shared device doesn't blend two people.
    // Covers every logout path (explicit logout, refresh failure, cross-app sync).
    reset();
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      tier: null,
      tierResolved: false,
      displayName: null,
      timerMultiplier: 1.0,
      isAdmin: false,
      isSuperAdmin: false,
    });
  },

  setLoading: (loading: boolean) =>
    set({
      isLoading: loading,
    }),

  setTimerMultiplier: (multiplier: number) =>
    set({
      timerMultiplier: multiplier,
    }),

  setDisplayName: (name: string) =>
    set({
      displayName: name,
    }),

  setTier: (tier: Tier) =>
    set({
      tier,
    }),

  setTierResolved: (resolved: boolean) =>
    set({
      tierResolved: resolved,
    }),

  setAdminStatus: (isAdmin: boolean, isSuperAdmin: boolean) =>
    set({ isAdmin, isSuperAdmin }),
}));

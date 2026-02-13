import { create } from 'zustand';
import type { User, AuthState } from '../types/auth';

interface AuthStore extends AuthState {
  timerMultiplier: number;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setTimerMultiplier: (multiplier: number) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  timerMultiplier: 1.0,

  setAuth: (token: string, user: User) =>
    set({
      accessToken: token,
      user,
      isAuthenticated: true,
      isLoading: false,
    }),

  clearAuth: () =>
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      timerMultiplier: 1.0,
    }),

  setLoading: (loading: boolean) =>
    set({
      isLoading: loading,
    }),

  setTimerMultiplier: (multiplier: number) =>
    set({
      timerMultiplier: multiplier,
    }),
}));

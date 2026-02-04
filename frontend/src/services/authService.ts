import { apiRequest } from './api';
import type {
  LoginCredentials,
  SignupData,
  AuthResponse,
  User,
} from '../types/auth';

export const authService = {
  signup: async (data: SignupData): Promise<{ message: string; user: User }> => {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  logout: async (accessToken: string): Promise<{ message: string }> => {
    return apiRequest('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  },

  refresh: async (): Promise<AuthResponse> => {
    return apiRequest('/auth/refresh', {
      method: 'POST',
    });
  },
};

export interface User {
  id: number;
  email: string;
  name: string;
  isAdmin?: boolean;
}

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface AuthError {
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

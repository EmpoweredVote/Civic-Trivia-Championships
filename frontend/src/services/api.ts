export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

  if (!response.ok) {
    const errorData = await response.json();
    throw errorData;
  }

  return response.json();
}

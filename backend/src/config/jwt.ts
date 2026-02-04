// JWT configuration from environment variables

// Secret keys for signing tokens
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

// Token expiry durations
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '30d';
export const REFRESH_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds

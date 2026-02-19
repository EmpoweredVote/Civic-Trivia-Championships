import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { redis } from '../config/redis.js';
import {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_SECONDS
} from '../config/jwt.js';

// Access error classes from jwt object (CommonJS module)
const { TokenExpiredError, JsonWebTokenError } = jwt;

// Re-export error types for use in middleware
export { TokenExpiredError, JsonWebTokenError };

export interface TokenPayload extends JwtPayload {
  userId: number;
  email?: string;
  isAdmin?: boolean;
}

/**
 * Generate access token for a user
 */
export function generateAccessToken(user: { id: number; email: string; isAdmin?: boolean }): string {
  return jwt.sign(
    { userId: user.id, email: user.email, isAdmin: user.isAdmin || false },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
  );
}

/**
 * Generate refresh token for a user
 */
export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY, algorithm: 'HS256' }
  );
}

/**
 * Verify and decode access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
}

/**
 * Verify and decode refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
}

/**
 * Store refresh token in Redis with TTL
 */
export async function storeRefreshToken(userId: number, token: string): Promise<void> {
  const key = `refresh:${userId}:${token}`;
  await redis.set(key, '1', { EX: REFRESH_TOKEN_EXPIRY_SECONDS });
}

/**
 * Check if a refresh token is valid (exists in Redis)
 */
export async function isRefreshTokenValid(userId: number, token: string): Promise<boolean> {
  const key = `refresh:${userId}:${token}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Blacklist a token until its expiry
 */
export async function blacklistToken(token: string, expirySeconds: number): Promise<void> {
  const key = `blacklist:${token}`;
  await redis.set(key, '1', { EX: expirySeconds });
}

/**
 * Check if a token is blacklisted
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const key = `blacklist:${token}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(userId: number, token: string): Promise<void> {
  const key = `refresh:${userId}:${token}`;
  await redis.del(key);
}

/**
 * Get token expiry in seconds from now
 */
export function getTokenExpirySeconds(token: string, secret: string): number {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    if (decoded && decoded.exp) {
      const now = Math.floor(Date.now() / 1000);
      return Math.max(decoded.exp - now, 0);
    }
  } catch {
    // Token decode failed, return 0
  }
  return 0;
}

/**
 * Rate limiting middleware for question flagging
 * Uses Redis INCR+TTL for rolling window rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';

// Constants
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_FLAGS_PER_WINDOW = 10;

/**
 * Rate limit middleware for flag endpoint
 * Limits users to 10 flags per 15-minute window
 * Fails open (allows request) if Redis is unavailable
 */
export async function flagRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Get userId from authenticated token payload
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const key = `rate_limit:flag:${userId}`;

  try {
    // Atomic increment - returns new count
    const count = await redis.incr(key);

    // If this is the first increment, set expiry
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    // Check if over limit
    if (count > MAX_FLAGS_PER_WINDOW) {
      const ttl = await redis.ttl(key);
      res.status(429).json({
        error: 'Too many flags',
        retryAfter: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS,
      });
      return;
    }

    // Under limit - continue
    next();
  } catch (error) {
    // Fail open - if Redis is down, don't block legitimate users
    console.warn('Rate limiter Redis error (failing open):', error);
    next();
  }
}

/**
 * Get current rate limit status for a user
 * @param userId - User ID to check
 * @returns Remaining flags and retry-after seconds
 */
export async function getRateLimitStatus(
  userId: number
): Promise<{ remaining: number; retryAfter: number | null }> {
  const key = `rate_limit:flag:${userId}`;

  try {
    const count = await redis.get(key);
    const currentCount = count ? parseInt(count, 10) : 0;

    if (currentCount >= MAX_FLAGS_PER_WINDOW) {
      const ttl = await redis.ttl(key);
      return {
        remaining: 0,
        retryAfter: ttl > 0 ? ttl : null,
      };
    }

    return {
      remaining: MAX_FLAGS_PER_WINDOW - currentCount,
      retryAfter: null,
    };
  } catch (error) {
    console.warn('Error getting rate limit status:', error);
    // On error, assume no limit
    return {
      remaining: MAX_FLAGS_PER_WINDOW,
      retryAfter: null,
    };
  }
}

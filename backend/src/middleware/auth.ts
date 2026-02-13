import { Request, Response, NextFunction } from 'express';
import {
  verifyAccessToken,
  isTokenBlacklisted,
  TokenExpiredError,
  JsonWebTokenError,
  TokenPayload
} from '../utils/tokenUtils.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware to authenticate JWT access tokens
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    // Check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      res.status(401).json({ error: 'Token revoked' });
      return;
    }

    // Verify the token
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error instanceof JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication middleware - allows both authenticated and anonymous users
 * Sets req.user if valid token present, otherwise continues without error
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  // No token - continue as anonymous
  if (!token) {
    req.user = undefined;
    next();
    return;
  }

  try {
    // Check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      // Invalid token - continue as anonymous
      req.user = undefined;
      next();
      return;
    }

    // Verify the token
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    // Any error - continue as anonymous
    req.user = undefined;
    next();
  }
}

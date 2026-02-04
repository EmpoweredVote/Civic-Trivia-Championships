import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  isRefreshTokenValid,
  blacklistToken,
  revokeRefreshToken,
  getTokenExpirySeconds,
  TokenExpiredError,
  JsonWebTokenError
} from '../utils/tokenUtils.js';
import { JWT_SECRET, JWT_REFRESH_SECRET, REFRESH_TOKEN_EXPIRY_SECONDS } from '../config/jwt.js';

const BCRYPT_COST = 12;

/**
 * POST /auth/signup - Create a new user account
 */
export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // Create user
    const user = await User.create({ email, passwordHash, name });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

/**
 * POST /auth/login - Authenticate user and return tokens
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token in Redis
    await storeRefreshToken(user.id, refreshToken);

    // Set refresh token as HttpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRY_SECONDS * 1000 // Convert to milliseconds
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * POST /auth/logout - Invalidate tokens
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    // Get access token from header
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];

    // Get refresh token from cookie
    const refreshToken = req.cookies.refreshToken;

    // Blacklist access token until expiry
    if (accessToken) {
      const accessExpiry = getTokenExpirySeconds(accessToken, JWT_SECRET);
      if (accessExpiry > 0) {
        await blacklistToken(accessToken, accessExpiry);
      }
    }

    // Handle refresh token
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const userId = decoded.userId;

        // Blacklist refresh token
        const refreshExpiry = getTokenExpirySeconds(refreshToken, JWT_REFRESH_SECRET);
        if (refreshExpiry > 0) {
          await blacklistToken(refreshToken, refreshExpiry);
        }

        // Remove from Redis store
        await revokeRefreshToken(userId, refreshToken);
      } catch {
        // Token already invalid, just continue
      }
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}

/**
 * POST /auth/refresh - Exchange refresh token for new access token
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        res.status(401).json({ error: 'Refresh token expired' });
        return;
      }
      if (error instanceof JsonWebTokenError) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }
      throw error;
    }

    const userId = decoded.userId;

    // Check if refresh token is valid in Redis
    const isValid = await isRefreshTokenValid(userId, refreshToken);
    if (!isValid) {
      res.status(401).json({ error: 'Refresh token revoked' });
      return;
    }

    // Get user data for new token
    const user = await User.findById(userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken({ id: user.id, email: user.email });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
}

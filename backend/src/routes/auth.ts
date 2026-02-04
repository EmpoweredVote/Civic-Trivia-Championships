import { Router } from 'express';
import { signup, login, logout, refresh } from '../controllers/authController.js';
import { signupValidation, loginValidation } from '../utils/validation.js';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// POST /auth/signup - Create new user account
router.post('/signup', signupValidation, validate, signup);

// POST /auth/login - Authenticate user
router.post('/login', loginValidation, validate, login);

// POST /auth/logout - Invalidate tokens (requires auth)
router.post('/logout', authenticateToken, logout);

// POST /auth/refresh - Refresh access token
router.post('/refresh', refresh);

export { router };

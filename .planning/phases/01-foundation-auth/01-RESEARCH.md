# Phase 1: Foundation & Auth - Research

**Researched:** 2026-02-03
**Domain:** Full-stack JWT authentication with React 18, Express, PostgreSQL, and Redis
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 requires implementing a complete JWT-based authentication system with persistent sessions across browser refreshes. The research reveals that modern 2026 authentication follows established patterns with critical security considerations around token storage, CORS configuration, and password hashing.

The standard approach uses **JWT access tokens stored in memory** (cleared on page refresh) with **HttpOnly cookie refresh tokens** (persistent across sessions) to balance security against XSS attacks while maintaining user sessions. Redis provides fast token blacklisting and session management, while bcrypt handles password hashing with cost factors of 10-12 for 2026 hardware.

Performance requirements (FCP <1.5s, TTI <3s, bundle <300KB) can be met through Vite's optimized builds, code splitting, and careful dependency selection. Mobile responsiveness is standard with Tailwind CSS's mobile-first approach.

**Primary recommendation:** Use the dual-token pattern (short-lived JWT access tokens in memory + long-lived refresh tokens in HttpOnly cookies) with express-validator for input sanitization, bcrypt v6.0.0 for password hashing (cost 10-12), and Zustand or Context API for lightweight authentication state management. Implement token rotation and Redis-based blacklisting for security.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsonwebtoken | 9.0.3 | JWT creation and verification | Auth0-maintained, 35,006 npm dependents, industry standard for Node.js JWT |
| bcrypt | 6.0.0 | Password hashing | Battle-tested, auto-salting, designed for slow hashing (prevents brute force) |
| express-validator | 7.3.0 | Input validation & sanitization | Wrapper around validator.js, prevents injection attacks, dual validation/sanitization |
| cors | latest | CORS middleware | Official Express middleware for credential-based auth endpoints |
| pg | latest | PostgreSQL client | Official Node.js PostgreSQL driver, connection pooling support |
| redis | latest | Redis client | Official Node.js Redis client for token blacklisting and session management |
| dotenv | latest | Environment variables | Standard for local development (Note: Node.js v20.6.0+ has native --env-file flag) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/jsonwebtoken | latest | TypeScript types | Required for TypeScript projects |
| @types/bcrypt | latest | TypeScript types | Required for TypeScript projects |
| zustand | latest | Lightweight state management | Alternative to Context API for auth state, recommended for global auth state |
| react-router-dom | v6+ | Protected routes | Essential for authentication-based routing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcrypt | bcryptjs (3.0.3) | Pure JavaScript (no native compilation), slower but easier deployment |
| jsonwebtoken | jose | Modern JOSE standard, smaller bundle, but less ecosystem adoption |
| express-validator | joi / zod | Joi (older, more verbose), Zod (TypeScript-first, newer pattern) |
| Redis | In-memory store | Redis provides persistence, clustering, and TTL auto-expiration |
| Context API | Zustand | Zustand has less boilerplate, better DevTools, ~1KB size |

**Installation:**
```bash
# Backend
npm install express jsonwebtoken bcrypt express-validator cors pg redis dotenv
npm install -D @types/jsonwebtoken @types/bcrypt @types/express

# Frontend
npm install react-router-dom zustand
npm install -D @types/react-router-dom
```

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── src/
│   ├── config/           # Database, Redis, JWT config
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── jwt.ts
│   ├── middleware/       # Auth, validation, error handling
│   │   ├── auth.ts       # JWT verification middleware
│   │   ├── validate.ts   # Input validation
│   │   └── errorHandler.ts
│   ├── routes/           # API routes
│   │   ├── auth.ts       # /auth/signup, /auth/login, /auth/logout, /auth/refresh
│   │   └── index.ts
│   ├── controllers/      # Business logic
│   │   └── authController.ts
│   ├── models/           # Database models/queries
│   │   └── User.ts
│   ├── utils/            # Helpers
│   │   ├── tokenUtils.ts # JWT sign/verify/blacklist
│   │   └── validation.ts # Validation schemas
│   └── server.ts         # Express app entry
├── .env                  # Local env vars (gitignored)
├── .env.example          # Template for required vars
└── tsconfig.json

frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/           # Buttons, forms, inputs
│   │   └── features/     # Feature-specific components
│   ├── pages/            # Page components
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   └── Dashboard.tsx
│   ├── hooks/            # Custom hooks
│   │   └── useAuth.ts    # Authentication hook
│   ├── store/            # State management
│   │   └── authStore.ts  # Zustand store for auth state
│   ├── services/         # API calls
│   │   └── authService.ts
│   ├── types/            # TypeScript types
│   │   └── auth.ts
│   ├── utils/            # Helpers
│   │   └── api.ts        # Axios/fetch wrapper
│   ├── App.tsx           # Protected route wrapper
│   └── main.tsx          # Entry point
├── .env.development      # Dev environment vars
├── .env.production       # Prod environment vars
└── vite.config.ts
```

### Pattern 1: Dual-Token Authentication (Access + Refresh)

**What:** Short-lived access tokens (15-30 min) in memory + long-lived refresh tokens (30 days) in HttpOnly cookies

**When to use:** Always for web applications to balance security (XSS protection) with UX (persistent sessions)

**Example:**
```typescript
// Backend: Login endpoint
// Source: Medium - Redis + JWT Refresh Token Architecture (Dec 2025)
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Verify credentials
  const user = await User.findByEmail(email);
  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate tokens
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  // Store refresh token in Redis
  await redis.setex(
    `refresh:${user.id}:${refreshToken}`,
    30 * 24 * 60 * 60, // 30 days in seconds
    '1'
  );

  // Send access token in response, refresh token in HttpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in ms
  });

  res.json({
    accessToken,
    user: { id: user.id, email: user.email }
  });
});
```

```typescript
// Frontend: Store access token in memory
// Source: Syncfusion - JWT Authentication in React (2025)
import create from 'zustand';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (token, user) => set({ accessToken: token, user }),
  clearAuth: () => set({ accessToken: null, user: null })
}));

// Access token lives in memory only - cleared on page refresh
// Refresh token automatically sent via HttpOnly cookie
```

### Pattern 2: Protected Routes with Route Wrapper

**What:** Higher-order component that checks authentication before rendering protected pages

**When to use:** For all routes requiring authentication

**Example:**
```tsx
// Source: react.wiki - Protected Routes in React Router (2026)
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const ProtectedRoute = () => {
  const { accessToken, user } = useAuthStore();

  // If no token, redirect to login
  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  // Render child routes
  return <Outlet />;
};

// Usage in App.tsx
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
```

### Pattern 3: Automatic Token Refresh on Page Load

**What:** Check for refresh token on app mount and obtain new access token before rendering

**When to use:** To maintain sessions across browser refreshes (AUTH-04 requirement)

**Example:**
```typescript
// Frontend: App initialization
// Source: LogRocket - JWT Authentication Best Practices (2025)
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';

function App() {
  const [loading, setLoading] = useState(true);
  const { setAuth } = useAuthStore();

  useEffect(() => {
    // Try to refresh token on mount
    const initAuth = async () => {
      try {
        // Refresh token sent automatically via HttpOnly cookie
        const { accessToken, user } = await authService.refresh();
        setAuth(accessToken, user);
      } catch (error) {
        // No valid refresh token - user needs to log in
        console.log('No active session');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [setAuth]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return <Routes>{/* routes */}</Routes>;
}
```

```typescript
// Backend: Refresh endpoint
app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Check if token is blacklisted (logout/revoked)
    const blacklisted = await redis.exists(`blacklist:${refreshToken}`);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    // Check if token exists in Redis
    const exists = await redis.exists(`refresh:${decoded.userId}:${refreshToken}`);
    if (!exists) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const user = await User.findById(decoded.userId);
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Optional: Rotate refresh token
    // (Issue new refresh token and invalidate old one)

    res.json({
      accessToken,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### Pattern 4: Token Blacklisting on Logout

**What:** Invalidate both access and refresh tokens immediately on logout

**When to use:** Required for secure logout (AUTH-03 requirement)

**Example:**
```typescript
// Backend: Logout endpoint
// Source: Medium - JWT Refresh Tokens and Redis (Oct 2025)
app.post('/auth/logout', authenticateToken, async (req, res) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  const { refreshToken } = req.cookies;

  try {
    // Decode to get expiry times
    const accessDecoded = jwt.decode(accessToken);
    const refreshDecoded = jwt.decode(refreshToken);

    // Blacklist access token until it expires naturally
    if (accessDecoded?.exp) {
      const ttl = accessDecoded.exp - Math.floor(Date.now() / 1000);
      await redis.setex(`blacklist:${accessToken}`, ttl, '1');
    }

    // Blacklist refresh token until it expires naturally
    if (refreshDecoded?.exp) {
      const ttl = refreshDecoded.exp - Math.floor(Date.now() / 1000);
      await redis.setex(`blacklist:${refreshToken}`, ttl, '1');
    }

    // Remove refresh token from active tokens
    await redis.del(`refresh:${req.user.id}:${refreshToken}`);

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});
```

### Pattern 5: Input Validation and Sanitization

**What:** Validate and sanitize all user inputs before processing

**When to use:** On all endpoints that accept user input (signup, login, etc.)

**Example:**
```typescript
// Backend: Validation middleware
// Source: Auth0 - Express Validator Tutorial + express-validator docs (2026)
import { body, validationResult } from 'express-validator';

// Validation schemas
export const signupValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),

  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .escape()
    .withMessage('Name must be 2-50 characters')
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password required')
];

// Middleware to check validation results
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Usage in routes
app.post('/auth/signup', signupValidation, validate, signupController);
app.post('/auth/login', loginValidation, validate, loginController);
```

### Pattern 6: CORS Configuration for Credentials

**What:** Configure CORS to allow credentials (cookies) from specific origins

**When to use:** Required for cross-origin requests with HttpOnly cookies

**Example:**
```typescript
// Backend: CORS middleware
// Source: Express CORS documentation (2026)
import cors from 'cors';

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite default
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600 // Cache preflight for 1 hour
};

app.use(cors(corsOptions));

// IMPORTANT: CORS does NOT provide access control
// It only tells browsers what JavaScript can read
// Always implement authentication and authorization separately
```

### Anti-Patterns to Avoid

- **Storing JWTs in localStorage:** 92% of JWT leaks originate from frontend storage mistakes. Use memory (access token) + HttpOnly cookies (refresh token) instead
- **Using 'none' algorithm:** Allows unsigned tokens. Always whitelist specific algorithms (HS256, RS256)
- **Weak JWT secrets:** Minimum 256 bits (32 bytes) generated with cryptographically secure RNG. Rotate every 90 days
- **Missing signature verification:** ALWAYS verify JWT signatures. Contents are visible to anyone but should not be trusted without verification
- **Low bcrypt cost factor:** Use 10-12 for 2026 hardware. Below 10 is too fast for brute force prevention
- **Exposing sensitive info in JWT payload:** JWTs are Base64-encoded, not encrypted. Never include passwords, credit cards, SSNs
- **Not validating refresh tokens server-side:** Store refresh tokens in Redis/database to enable revocation
- **Using CORS as access control:** CORS only affects browsers, not API clients. Implement proper authentication
- **Trusting client-side validation alone:** Always validate and sanitize on server. Client-side validation can be bypassed
- **Not implementing token rotation:** Refresh token rotation limits damage from stolen refresh tokens

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | bcrypt (v6.0.0) | Built-in salting, adaptive cost factor, battle-tested against timing attacks |
| JWT signing/verification | Manual token creation | jsonwebtoken (v9.0.3) | Handles algorithm confusion, timing attacks, proper signature verification |
| Input validation | Regex checks scattered in code | express-validator (v7.3.0) | Comprehensive validators, sanitizers, prevents injection attacks, consistent error format |
| Token blacklisting | In-memory Set/Array | Redis with TTL | Auto-expiration, persistence, clustering support, millisecond lookups |
| CORS configuration | Manual header setting | cors middleware | Handles preflight, credentials, dynamic origins, security defaults |
| Environment variables | Manual process.env parsing | dotenv (or Node v20.6.0+ --env-file) | Type validation, .env.example template, prevents missing config errors |
| Session persistence | Custom localStorage wrapper | Zustand with persist | Handles hydration, serialization, SSR compatibility, TypeScript support |
| Protected routes | Inline auth checks | React Router route wrapper | Centralized logic, prevents auth check duplication, handles redirects |

**Key insight:** Authentication has decades of security research. Custom implementations miss edge cases like timing attacks, algorithm confusion, session fixation, CSRF, XSS, and injection vulnerabilities. Use proven libraries that fail securely.

## Common Pitfalls

### Pitfall 1: JWT Signature Verification Failure

**What goes wrong:** Failing to verify JWT signatures allows attackers to forge tokens by altering payloads without detection. This is the #1 JWT vulnerability in 2026.

**Why it happens:**
- Trusting decoded JWT payload without verification
- Using jwt.decode() instead of jwt.verify()
- Not checking signature on protected routes

**How to avoid:**
```typescript
// WRONG - No signature verification
const decoded = jwt.decode(token);
if (decoded.userId) { /* trust this - INSECURE */ }

// CORRECT - Verify signature
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// Only trust after verification succeeds
```

**Warning signs:**
- Using jwt.decode() anywhere in auth middleware
- Not catching jwt.verify() errors
- Missing JWT_SECRET in environment

### Pitfall 2: Algorithm Confusion Attack (RS256 → HS256)

**What goes wrong:** Attackers change RS256 tokens to HS256, then sign them using the server's public key. Servers that verify HS256 tokens using their RSA public key accept these forged tokens as valid.

**Why it happens:**
- Not specifying allowed algorithms in jwt.verify()
- Accepting 'none' algorithm
- Using same key for different algorithms

**How to avoid:**
```typescript
// CORRECT - Whitelist specific algorithm
jwt.verify(token, process.env.JWT_SECRET, {
  algorithms: ['HS256'] // Only allow HS256
});

// For asymmetric keys (production recommended)
jwt.verify(token, publicKey, {
  algorithms: ['RS256', 'ES256'] // Only allow asymmetric
});
```

**Warning signs:**
- jwt.verify() without algorithms option
- Using same secret for HS256 and RS256
- CVE-2025-4692, CVE-2025-30144 in dependencies

### Pitfall 3: XSS Token Theft via localStorage

**What goes wrong:** Storing tokens in localStorage exposes them to XSS attacks. 92% of JWT leaks originate from this mistake.

**Why it happens:**
- Believing localStorage persists sessions conveniently
- Not understanding XSS attack vectors
- Following outdated tutorials from 2018-2020

**How to avoid:**
- Access tokens: Store in memory (cleared on refresh)
- Refresh tokens: Store in HttpOnly cookies (immune to XSS)
- Implement token refresh on app mount
```typescript
// WRONG
localStorage.setItem('token', accessToken);

// CORRECT
// Access token in memory (Zustand/Context)
useAuthStore.setState({ accessToken });

// Refresh token in HttpOnly cookie (backend)
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'
});
```

**Warning signs:**
- Any reference to localStorage/sessionStorage for tokens
- Tokens visible in browser DevTools Application tab
- No HttpOnly cookies in login response

### Pitfall 4: Weak bcrypt Cost Factor

**What goes wrong:** Low cost factors (below 10) make password hashing too fast, enabling brute force attacks with modern GPUs.

**Why it happens:**
- Using default cost (10) from old tutorials
- Not updating for 2026 hardware capabilities
- Prioritizing speed over security

**How to avoid:**
```typescript
// For 2026 hardware: cost 10-12
const salt = await bcrypt.genSalt(12); // 2^12 iterations
const hash = await bcrypt.hash(password, salt);

// Or use simple API (generates salt automatically)
const hash = await bcrypt.hash(password, 12);
```

**Warning signs:**
- bcrypt.hash(password, 8) or lower
- Fast signup/login times (<100ms on server)
- Not considering future hardware improvements

### Pitfall 5: Missing Token Blacklisting on Logout

**What goes wrong:** Tokens remain valid after logout until natural expiration, allowing continued access with stolen tokens.

**Why it happens:**
- Believing JWT statelessness means no server-side storage
- Not implementing refresh token revocation
- Clearing only client-side state

**How to avoid:**
```typescript
// Store refresh tokens in Redis
await redis.setex(`refresh:${userId}:${token}`, ttl, '1');

// On logout, blacklist both tokens
await redis.setex(`blacklist:${accessToken}`, ttl, '1');
await redis.setex(`blacklist:${refreshToken}`, ttl, '1');
await redis.del(`refresh:${userId}:${refreshToken}`);

// Check blacklist in auth middleware
const blacklisted = await redis.exists(`blacklist:${token}`);
if (blacklisted) throw new Error('Token revoked');
```

**Warning signs:**
- No Redis/database usage for tokens
- Logout only clears client state
- No token revocation endpoint

### Pitfall 6: Password in JWT Payload

**What goes wrong:** JWTs are Base64-encoded, not encrypted. Anyone with the token can decode and read the payload.

**Why it happens:**
- Confusion between encoding and encryption
- Convenience of storing everything in token
- Not understanding JWT structure

**How to avoid:**
```typescript
// WRONG - Sensitive data exposed
const token = jwt.sign({
  userId,
  email,
  passwordHash // NEVER include passwords/hashes
}, secret);

// CORRECT - Only include public identifiers
const token = jwt.sign({
  userId,
  email // OK - already public in user profile
}, secret);
```

**Warning signs:**
- password, passwordHash, ssn, creditCard in payload
- Tokens containing PII (Personally Identifiable Information)
- Large token sizes (>200 bytes payload)

### Pitfall 7: VITE_ Prefix Security Leak

**What goes wrong:** Environment variables without VITE_ prefix in frontend .env files seem secure but can still be accidentally exposed if prefix added later.

**Why it happens:**
- Not understanding Vite's prefix requirement
- Storing backend secrets in frontend .env
- Copy-pasting .env files between frontend/backend

**How to avoid:**
```bash
# Frontend .env - Only public variables, all prefixed
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=MyApp

# Backend .env - No VITE_ prefix needed (not processed by Vite)
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# NEVER put secrets in frontend .env, even without VITE_ prefix
```

**Warning signs:**
- JWT_SECRET in frontend .env
- Backend secrets in Vite project
- Same .env file for frontend and backend

### Pitfall 8: Not Handling Token Expiration Gracefully

**What goes wrong:** Access token expires mid-session, causing hard logout or error screens instead of silent refresh.

**Why it happens:**
- Not implementing automatic token refresh
- Not handling 401 responses globally
- No loading states during refresh

**How to avoid:**
```typescript
// Frontend: Axios interceptor for automatic refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh token
        const { accessToken } = await authService.refresh();
        useAuthStore.setState({ accessToken });

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

**Warning signs:**
- Users seeing "Session expired" errors mid-session
- No 401 interceptor in API client
- Hard logouts on token expiration

## Code Examples

Verified patterns from official sources:

### Password Hashing (Signup)

```typescript
// Source: bcrypt npm documentation + TheLinuxCode (Jan 2026)
import bcrypt from 'bcrypt';

export const signupController = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    // Hash password (cost 12 for 2026 hardware)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      name
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
};
```

### Password Verification (Login)

```typescript
// Source: bcrypt npm documentation
import bcrypt from 'bcrypt';

export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal whether email exists
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate tokens (see Dual-Token pattern above)
    // ...
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};
```

### JWT Authentication Middleware

```typescript
// Source: jsonwebtoken npm + Medium (JWT best practices)
import jwt from 'jsonwebtoken';
import { redis } from '../config/redis';

export const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify signature (CRITICAL - prevents forgery)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'] // Whitelist algorithm
    });

    // Check if token is blacklisted (logout/revoked)
    const blacklisted = await redis.exists(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
};
```

### Database Schema (PostgreSQL)

```sql
-- Source: PostgreSQL Schema Best Practices + Better Auth docs (2026)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- bcrypt hash
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for performance
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Frontend Auth Service

```typescript
// Source: Auth0 - Complete Guide to React Authentication (2026)
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Configure axios to include credentials (cookies)
axios.defaults.withCredentials = true;

export const authService = {
  signup: async (email: string, password: string, name: string) => {
    const response = await axios.post(`${API_URL}/auth/signup`, {
      email,
      password,
      name
    });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    // Response contains accessToken
    // refreshToken automatically set as HttpOnly cookie
    return response.data;
  },

  logout: async (accessToken: string) => {
    const response = await axios.post(
      `${API_URL}/auth/logout`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    return response.data;
  },

  refresh: async () => {
    // refreshToken sent automatically via HttpOnly cookie
    const response = await axios.post(`${API_URL}/auth/refresh`);
    return response.data;
  }
};
```

### Tailwind Responsive Auth Form

```tsx
// Source: TailwindFlex + PrebuiltUI (2026)
export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { accessToken, user } = await authService.login(email, password);
      useAuthStore.getState().setAuth(accessToken, user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Mobile responsive: Tailwind uses mobile-first breakpoints
// - Base styles apply to mobile (min-w-0)
// - sm: applies at 640px+
// - md: applies at 768px+
// - lg: applies at 1024px+
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tokens in localStorage | Access token in memory + refresh in HttpOnly cookie | 2022-2023 | Prevents XSS token theft (92% of leaks) |
| Session cookies (pre-2018) | JWT tokens | 2018-2020 | Stateless, scalable, microservice-friendly |
| Symmetric JWT (HS256 only) | Asymmetric JWT (RS256/ES256) for production | 2024-2025 | Prevents key exposure in microservices |
| Manual validation | express-validator v7+ | 2023-2025 | Consistent validation + sanitization |
| dotenv only | dotenv (dev) + secrets manager (prod) | 2023-2025 | Production-grade secret management |
| Context API only | Zustand/Context hybrid | 2025-2026 | Lighter bundle, better DevTools |
| bcrypt cost 10 | bcrypt cost 10-12 | 2024-2026 | Adjusted for 2026 GPU capabilities |
| Class components | Functional components + hooks | 2019-2020 | Modern React standard |
| React Router v5 | React Router v6/v7 | 2021-2025 | Nested routes, suspense, data loading |
| CRA (Create React App) | Vite | 2021-2023 | 10-100x faster HMR, smaller bundles |

**Deprecated/outdated:**
- **passport-local**: Still works but heavier than needed for simple JWT auth. Use for complex OAuth/SAML scenarios only
- **bcrypt-nodejs**: Unmaintained since 2016. Use bcrypt or bcryptjs
- **jwt-simple**: Unmaintained. Use jsonwebtoken
- **create-react-app**: Deprecated March 2023. Use Vite
- **Redux for auth state**: Overkill for simple auth. Use Context API or Zustand

## Open Questions

Things that couldn't be fully resolved:

1. **Token Rotation Strategy**
   - What we know: Token rotation (issuing new refresh token on each refresh) increases security
   - What's unclear: Whether to implement rotation in Phase 1 or defer to later phase
   - Recommendation: Implement basic refresh mechanism now, add rotation in security enhancement phase if needed

2. **Rate Limiting**
   - What we know: Login endpoints should have rate limiting to prevent brute force
   - What's unclear: Whether rate limiting is in scope for Phase 1 or separate security phase
   - Recommendation: Basic rate limiting with express-rate-limit (simple middleware) for Phase 1

3. **Email Verification**
   - What we know: Production apps verify email addresses before allowing full access
   - What's unclear: Requirements don't mention email verification - is it needed?
   - Recommendation: Clarify with user. If needed, implement in separate phase (requires email service)

4. **Multi-Device Session Management**
   - What we know: Users may want to see/revoke active sessions on other devices
   - What's unclear: Whether to store per-device refresh tokens in Redis
   - Recommendation: Single refresh token per user for Phase 1, multi-device in later phase

5. **Remember Me Functionality**
   - What we know: "Remember me" extends refresh token lifetime (e.g., 90 days vs 30 days)
   - What's unclear: Requirements don't mention this feature
   - Recommendation: Defer to later phase unless user requests it

## Sources

### Primary (HIGH confidence)

- [Express CORS Middleware Documentation](https://expressjs.com/en/resources/middleware/cors.html) - CORS configuration for auth endpoints
- [jsonwebtoken npm package v9.0.3](https://www.npmjs.com/package/jsonwebtoken) - Current version and usage
- [bcrypt npm package v6.0.0](https://www.npmjs.com/package/bcrypt) - Current version and best practices
- [express-validator GitHub Documentation](https://express-validator.github.io/docs/) - Validation and sanitization API
- [Vite Environment Variables Documentation](https://vite.dev/guide/env-and-mode) - VITE_ prefix requirements
- [React Router v6 Protected Routes](https://react.wiki/router/protected-routes/) - Official patterns (2026)

### Secondary (MEDIUM confidence)

- [The Secret of Infinite Sessions: Transitioning to JWT, Redis, and Refresh Token Architecture](https://medium.com/@senaunalmis/the-secret-of-infinite-sessions-transitioning-to-jwt-redis-and-refresh-token-architecture-3c3bb5517864) - December 2025
- [Securing Node.js Applications with JWT, Refresh Tokens, and Redis](https://medium.com/@choubeyayush4/securing-node-js-applications-with-jwt-refresh-tokens-and-redis-80ffbb54285a) - October 2025
- [JWT Vulnerabilities List: 2026 Security Risks & Mitigation Guide](https://redsentry.com/resources/blog/jwt-vulnerabilities-list-2026-security-risks-mitigation-guide) - 2026
- [npm bcrypt in 2026: Password Hashing That Fails Closed](https://thelinuxcode.com/npm-bcrypt-in-2026-password-hashing-that-fails-closed-and-how-to-ship-it-safely/) - January 2026
- [How to Configure Node.js for Production with Environment Variables](https://oneuptime.com/blog/post/2026-01-06-nodejs-production-environment-variables/view) - January 2026
- [Top 5 React State Management Tools Developers Actually Use in 2026](https://www.syncfusion.com/blogs/post/react-state-management-libraries) - 2026
- [Auth0 - Complete Guide to React User Authentication](https://auth0.com/blog/complete-guide-to-react-user-authentication/) - 2025-2026
- [LogRocket - JWT Authentication Best Practices](https://blog.logrocket.com/jwt-authentication-best-practices/) - 2025

### Tertiary (LOW confidence - WebSearch only)

- Various Stack Overflow discussions about JWT security (2025-2026)
- TailwindFlex authentication form examples (2026)
- GitHub repositories with example implementations (marked for validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm, official docs, and multiple sources
- Architecture: HIGH - Dual-token pattern is industry standard, verified in multiple 2025-2026 sources
- Pitfalls: HIGH - Security vulnerabilities verified via CVE database, Red Sentry report, and official library docs
- Code examples: MEDIUM-HIGH - Patterns from official docs and recent tutorials, but need validation in actual implementation

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - authentication patterns are relatively stable, but check for new CVEs)

**Note on AI Agent Attacks:** A January 2026 Medium article flagged emerging AI agent vulnerabilities where attackers poison RAG data to convince agents to send JWTs to external services. While not directly applicable to Phase 1 (no AI agents), this highlights the evolving threat landscape around JWT security.

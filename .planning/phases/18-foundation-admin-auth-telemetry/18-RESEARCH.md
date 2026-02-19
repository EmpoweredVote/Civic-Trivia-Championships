# Phase 18: Foundation (Admin Auth + Telemetry) - Research

**Researched:** 2026-02-19
**Domain:** Role-based authorization (RBAC), telemetry tracking, React route guards
**Confidence:** HIGH

## Summary

Phase 18 establishes admin access control through role-based authorization middleware and initiates gameplay telemetry data collection. Research covered five technical domains: Express.js RBAC middleware patterns, Drizzle ORM column migrations, PostgreSQL atomic counter updates, React Router v6 403 error pages, and Tailwind CSS theme overrides.

**Standard approach:** Backend middleware checks JWT token for `isAdmin` flag and returns 403 with error message if missing. Frontend route guard checks auth state and renders 403 page component for non-admins. Telemetry uses PostgreSQL atomic counter increments (`UPDATE questions SET encounter_count = encounter_count + 1`) invoked fire-and-forget style with `.catch()` error handling.

**Primary recommendation:** Use middleware factory pattern (`requireAdmin(req, res, next)`) applied after `authenticateToken`, add `is_admin` boolean column to users table with Drizzle migration, increment telemetry counters via separate async function wrapped in `.catch()` to prevent blocking gameplay responses, and implement 403 page as standard React component routed to `/403` with redirect from admin guard.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | ^4.18.2 | HTTP middleware framework | Industry standard for Node.js APIs; built-in middleware chaining pattern perfect for auth checks |
| jsonwebtoken | ^9.0.2 | JWT verification | Already in project; standard for token-based auth; supports custom payload fields |
| Drizzle ORM | ^0.45.1 | Schema management & migrations | Already in project; code-first migrations with TypeScript safety |
| PostgreSQL | (via pg ^8.11.3) | Relational database | Already in project; supports atomic counter operations natively |
| React Router | ^6.21.1 | Frontend routing | Already in project; v6 has native `<Navigate>` and error handling patterns |
| Tailwind CSS | ^3.4.1 | Utility-first CSS framework | Already in project; supports multiple themes via CSS variables or data attributes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | All functionality achievable with existing stack | Phase uses patterns, not new dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom middleware | express-jwt + express-jwt-permissions | express-jwt packages add 2 dependencies for what 15 lines of custom middleware achieves; custom code is more maintainable for simple boolean role check |
| Boolean column | Separate roles table | Separate table adds join overhead and complexity; premature for single admin/non-admin distinction; CONTEXT.md allows either approach (Claude's discretion) |
| CSS variables | Tailwind plugin | Plugin approach would require dependency; CSS variables are native and simpler for isolated admin section |

**Installation:**
```bash
# No new dependencies required
# All functionality uses existing project stack
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── middleware/
│   └── auth.ts              # Add requireAdmin() middleware factory
├── db/
│   └── schema.ts            # Add is_admin column to users table (or create if missing)
├── models/
│   └── User.ts              # Update User interface with isAdmin field
└── routes/
    └── admin.ts             # Apply requireAdmin to all routes

frontend/src/
├── pages/
│   ├── Admin.tsx            # Wrap in AdminGuard, add red theme
│   └── Forbidden.tsx        # New: friendly 403 page
├── components/
│   └── AdminGuard.tsx       # New: role-based route guard
└── store/
    └── authStore.ts         # Add isAdmin to user object
```

### Pattern 1: Role-Based Middleware Factory
**What:** Higher-order function that returns Express middleware checking user role from JWT payload
**When to use:** Protecting routes that require specific roles (admin, moderator, etc.)
**Example:**
```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory to require admin role
 * Must be used AFTER authenticateToken middleware
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // authenticateToken already populated req.user
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

// Usage in routes:
// router.use(authenticateToken, requireAdmin);
```

**Key principles:**
- Order matters: authentication before authorization
- Return 403 (Forbidden) not 401 (Unauthorized) when user is authenticated but lacks permission
- Keep role logic simple; don't embed complex policies in middleware
- Separation: authenticateToken verifies identity, requireAdmin checks authorization

**Source:** [Implementing Role Based Access Control (RBAC) in Node.js and Express App](https://permify.co/post/role-based-access-control-rbac-nodejs-expressjs/), [Express.js role-based permissions middleware](https://gist.github.com/joshnuss/37ebaf958fe65a18d4ff)

### Pattern 2: Drizzle Schema-First Column Addition
**What:** Add column to TypeScript schema, generate SQL migration, apply to database
**When to use:** Any schema changes; recommended for team environments
**Example:**
```typescript
// backend/src/db/schema.ts (or separate users.ts file)
import { pgTable, serial, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  // NEW: Admin role column
  isAdmin: boolean('is_admin').notNull().default(false),
  // Telemetry columns on questions table:
  // encounterCount: integer('encounter_count').notNull().default(0),
  // correctCount: integer('correct_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Then run:
// npx drizzle-kit generate  → Creates SQL file
// npx drizzle-kit migrate   → Applies to database
```

**PostgreSQL 11+ performance:** Adding column with default value is instant (no table rewrite) since Postgres 11+. Default value stored in catalog, applied on read.

**Source:** [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations), [PostgreSQL: Documentation: Modifying Tables](https://www.postgresql.org/docs/current/ddl-alter.html), [Adding new table columns with default values in PostgreSQL 11](https://www.enterprisedb.com/blog/adding-new-table-columns-default-values-postgresql-11)

### Pattern 3: Atomic Counter Increments
**What:** Use SQL `UPDATE table SET counter = counter + 1` for thread-safe counter updates
**When to use:** Telemetry, analytics, inventory tracking — any concurrent counter updates
**Example:**
```typescript
// backend/src/services/telemetryService.ts
import { db } from '../db/index.js';
import { questions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Fire-and-forget telemetry recording
 * Increments encounter and correct counters atomically
 */
export async function recordQuestionTelemetry(
  questionId: number,
  wasCorrect: boolean
): Promise<void> {
  try {
    if (wasCorrect) {
      // Increment both counters atomically
      await db
        .update(questions)
        .set({
          encounterCount: sql`${questions.encounterCount} + 1`,
          correctCount: sql`${questions.correctCount} + 1`,
        })
        .where(eq(questions.id, questionId));
    } else {
      // Increment only encounter counter
      await db
        .update(questions)
        .set({
          encounterCount: sql`${questions.encounterCount} + 1`,
        })
        .where(eq(questions.id, questionId));
    }
  } catch (error) {
    // Silent fail — telemetry should never block gameplay
    console.error(`[Telemetry] Failed to record for question ${questionId}:`, error);
  }
}

// Usage in game route (fire-and-forget):
// recordQuestionTelemetry(questionId, correct).catch(() => {});
```

**Why atomic:** PostgreSQL row-level lock ensures concurrent updates don't conflict. Using `counter + 1` in SQL is safe; reading then writing from application would lose updates.

**Performance:** Achieves ~25,000 updates/second with 400 concurrent writers in production systems.

**Source:** [Atomic Increment/Decrement operations in SQL](https://medium.com/harrys-engineering/atomic-increment-decrement-operations-in-sql-and-fun-with-locks-f7b124d37873), [Ultra fast asynchronous counters in Postgres](https://medium.com/@timanovsky/ultra-fast-asynchronous-counters-in-postgres-44c5477303c3)

### Pattern 4: Fire-and-Forget with Error Handling
**What:** Invoke async operation without `await`, attach `.catch()` to prevent unhandled rejection
**When to use:** Non-critical background work like telemetry, logging, notifications
**Example:**
```typescript
// In answer submission handler (backend/src/routes/game.ts)
router.post('/answer', async (req: Request, res: Response) => {
  const { sessionId, questionId, selectedOption } = req.body;

  // Score answer (critical — must complete before response)
  const answer = await sessionManager.submitAnswer(
    sessionId,
    questionId,
    selectedOption
  );

  // Record telemetry (non-critical — fire and forget)
  recordQuestionTelemetry(
    question.id,
    answer.correct
  ).catch(() => {
    // Silent fail — already logged inside recordQuestionTelemetry
  });

  // Send response immediately (don't wait for telemetry)
  res.status(200).json({ correct: answer.correct });
});
```

**Critical requirements:**
- Always attach `.catch()` — unhandled rejections crash Node.js (since v15)
- Log errors inside the async function itself (before the catch)
- Never fire-and-forget for transactions, authentication, or business logic
- Consider message queues (Bull, SQS) for high-volume or retry-critical operations

**Source:** [Understanding "Fire and Forget" in Node.js](https://medium.com/@dev.chetan.rathor/understanding-fire-and-forget-in-node-js-what-it-really-means-a83705aca4eb), [fire-and-forgetter npm package](https://www.npmjs.com/package/fire-and-forgetter)

### Pattern 5: React Router v6 403 Page with Route Guard
**What:** Component-based route guard that checks role and renders 403 page or redirects
**When to use:** Protecting frontend routes based on user role
**Example:**
```tsx
// frontend/src/components/AdminGuard.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Forbidden } from '../pages/Forbidden';

export function AdminGuard() {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) {
    return null; // AuthInitializer handles loading UI
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated but not admin — show 403 page
  if (!user?.isAdmin) {
    return <Forbidden />;
  }

  return <Outlet />;
}

// Usage in router config (App.tsx):
// <Route element={<AdminGuard />}>
//   <Route path="/admin" element={<Admin />} />
// </Route>
```

**403 Page Component:**
```tsx
// frontend/src/pages/Forbidden.tsx
import { Link } from 'react-router-dom';

export function Forbidden() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">403</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Admin Access Required
        </h2>
        <p className="text-gray-600 mb-6">
          This area is for admins. If you think you should have access,
          please contact us.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
```

**Key principles:**
- Guard renders 403 page inline (not redirect) per CONTEXT.md requirement
- Check authentication first, then role — prevents leaking route existence
- Server-side validation is still required; frontend guard is UX only

**Source:** [React Router v6 - Private Route Component](https://jasonwatmore.com/post/2022/06/24/react-router-6-private-route-component-to-restrict-access-to-protected-pages), [Unauthorised access Page on response 403 in React](https://medium.com/@_deadlock/unauthorised-access-page-on-response-403-in-react-4eeb8153010c)

### Pattern 6: Section-Specific Theme with CSS Variables
**What:** Apply data attribute or class to section root, override Tailwind color variables
**When to use:** Admin section with distinct theme, multi-tenant apps with per-client branding
**Example:**
```tsx
// frontend/src/pages/Admin.tsx
export function Admin() {
  return (
    <div className="min-h-screen bg-red-50" data-theme="admin">
      <header className="bg-red-700 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </header>

      <aside className="w-64 bg-red-800 text-white h-screen fixed">
        <nav className="p-4">
          <a href="/admin/questions" className="block py-2 px-4 rounded hover:bg-red-700">
            Question Management
          </a>
          {/* More nav links */}
        </nav>
      </aside>

      <main className="ml-64 p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Welcome, Admin
          </h2>
          {/* Placeholder cards */}
        </div>
      </main>
    </div>
  );
}
```

**CSS approach (if needed for utilities):**
```css
/* frontend/src/index.css */
[data-theme="admin"] {
  --color-primary: 220 38 38; /* red-700 */
  --color-primary-dark: 185 28 28; /* red-800 */
  --color-bg: 254 242 242; /* red-50 */
}

/* Override Tailwind utilities for admin section */
[data-theme="admin"] .bg-primary {
  background-color: rgb(var(--color-primary));
}
```

**Simpler approach:** Use Tailwind red palette directly (`bg-red-700`, `hover:bg-red-600`) instead of CSS variables. This avoids abstraction for single-use theme.

**Source:** [Theming in Tailwind CSS v4](https://medium.com/@sir.raminyavari/theming-in-tailwind-css-v4-support-multiple-color-schemes-and-dark-mode-ba97aead5c14), [Theme variables - Tailwind CSS](https://tailwindcss.com/docs/theme)

### Anti-Patterns to Avoid

- **Middleware order violation:** Applying `requireAdmin` before `authenticateToken` → 403 error for all users because `req.user` not yet populated
- **Hardcoded role strings:** Checking `if (req.user.role === 'admin')` scattered across routes → Use middleware function to centralize
- **Reading then writing counters:** `const count = await getCount(); await setCount(count + 1)` → Lost updates under concurrency; use atomic SQL increment
- **Awaiting fire-and-forget:** `await recordTelemetry(...)` → Blocks gameplay response waiting for telemetry
- **Frontend-only auth:** Checking `isAdmin` in React without backend validation → Security bypass via API requests
- **Missing .catch() on fire-and-forget:** `recordTelemetry(...)` without `.catch()` → Unhandled rejection crashes Node.js

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT parsing & verification | Custom base64 decoder + HMAC validator | jsonwebtoken library (already in project) | JWT spec has edge cases (timing attacks, algorithm confusion); library handles them |
| SQL injection prevention | String concatenation with manual escaping | Drizzle ORM parameterized queries | ORM prevents injection; manual escaping misses edge cases (encodings, nested quotes) |
| Session storage | In-memory Map/object | Redis or project's SessionStorage interface (already in project) | In-memory loses data on restart; doesn't scale horizontally |
| Atomic counters | SELECT + UPDATE in transaction | Native SQL increment (`counter = counter + 1`) | Even in transaction, SELECT + UPDATE has race condition window; SQL increment is atomic |
| Admin UI layout | Custom sidebar/header from scratch | Tailwind admin template pattern (see References) | Sidebar navigation, mobile menu, responsive layout solved problem; copy pattern not library |

**Key insight:** Auth middleware and telemetry patterns look simple but have subtle security and concurrency pitfalls. Use established patterns; don't reinvent. However, avoid heavy frameworks (express-jwt, admin template libraries) for this simple use case — copy patterns into project code.

## Common Pitfalls

### Pitfall 1: Token Payload Doesn't Include isAdmin
**What goes wrong:** Middleware checks `req.user.isAdmin` but field doesn't exist in JWT payload; all users denied admin access
**Why it happens:** Token generation (`generateAccessToken`) not updated to include `isAdmin` field from database user record
**How to avoid:** Update token generation when adding role field:
```typescript
// backend/src/utils/tokenUtils.ts
export interface TokenPayload extends JwtPayload {
  userId: number;
  email?: string;
  isAdmin?: boolean; // ADD THIS
}

export function generateAccessToken(user: {
  id: number;
  email: string;
  isAdmin?: boolean; // ADD THIS
}): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin ?? false // ADD THIS
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
  );
}
```
**Warning signs:** All users get 403 on admin routes including designated admins; `req.user.isAdmin` logs as `undefined`

### Pitfall 2: Frontend Auth State Not Updated with isAdmin
**What goes wrong:** Backend returns `isAdmin: true` but frontend auth store doesn't store it; admin guard denies access
**Why it happens:** Auth store User type doesn't include `isAdmin` field; value dropped during store update
**How to avoid:** Update auth types and store:
```typescript
// frontend/src/types/auth.ts
export interface User {
  id: number;
  email: string;
  name: string;
  isAdmin?: boolean; // ADD THIS
  // ... other fields
}

// frontend/src/store/authStore.ts
setAuth: (token: string, user: User) =>
  set({
    accessToken: token,
    user, // Now includes isAdmin if present in response
    isAuthenticated: true,
  }),
```
**Warning signs:** Backend logs show admin user authenticated successfully; frontend admin guard still denies; `user.isAdmin` undefined in React DevTools

### Pitfall 3: Migration Applied But Existing Users Have NULL isAdmin
**What goes wrong:** Column added as nullable; existing users have `is_admin = NULL`; middleware check `!req.user.isAdmin` treats NULL as not admin
**Why it happens:** Migration adds column without default value or backfill; NULL ≠ false in JavaScript
**How to avoid:** Two approaches:

**Approach A: Default value in migration (recommended):**
```typescript
isAdmin: boolean('is_admin').notNull().default(false)
// Generated SQL: ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
// Postgres 11+ applies default instantly without rewrite
```

**Approach B: Nullable with explicit backfill:**
```typescript
isAdmin: boolean('is_admin').default(false)
// Then in migration or after:
// UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL;
```
**Warning signs:** Existing users denied access despite `is_admin` column existing; database query shows NULL values; middleware logs show `isAdmin: undefined`

### Pitfall 4: Telemetry Blocks Gameplay Response
**What goes wrong:** `await recordTelemetry(...)` before sending response; telemetry DB query delays player feedback by 50-200ms
**Why it happens:** Developer adds `await` thinking all async operations need it; telemetry treated as critical path
**How to avoid:** Fire-and-forget pattern:
```typescript
// WRONG:
await recordQuestionTelemetry(questionId, correct);
res.status(200).json({ correct });

// RIGHT:
recordQuestionTelemetry(questionId, correct).catch(() => {});
res.status(200).json({ correct });
```
**Warning signs:** Answer submission takes 100ms+ (normally <20ms); performance degrades with database load; players report "laggy" gameplay

### Pitfall 5: Admin Section Lacks Distinct Visual Identity
**What goes wrong:** Admin section looks identical to player UI; admins accidentally act in wrong context (e.g., delete content thinking they're testing)
**Why it happens:** Admin pages reuse main app theme/header; no visual separation
**How to avoid:** Per CONTEXT.md requirement, use red theme:
```tsx
// Admin pages use red color palette
<div className="bg-red-700"> {/* Not bg-teal-600 like main app */}
<header className="bg-red-800 border-red-900"> {/* Distinct from main header */}
```
**Warning signs:** Admin mistakenly performs destructive action; confusion about which section they're in; request for "better visual indicator"

### Pitfall 6: Admin Route Reveals Existence Before Auth Check
**What goes wrong:** 403 page displays for unauthenticated users; reveals admin section exists
**Why it happens:** Admin guard checks role before authentication; unauthenticated users see 403 instead of login redirect
**How to avoid:** Check authentication first:
```tsx
// WRONG ORDER:
if (!user?.isAdmin) return <Forbidden />;
if (!isAuthenticated) return <Navigate to="/login" />;

// RIGHT ORDER:
if (!isAuthenticated) return <Navigate to="/login" />;
if (!user?.isAdmin) return <Forbidden />; // Only authenticated users see this
```
**Warning signs:** Logged-out users see "Admin Access Required" instead of login page; security audit flags information disclosure

## Code Examples

### Complete Backend Middleware Chain
```typescript
// backend/src/routes/admin.ts
import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Apply authentication + authorization to ALL admin routes
router.use(authenticateToken); // First: verify JWT
router.use(requireAdmin);       // Second: check role

// Now all routes below are admin-protected
router.get('/questions', async (req, res) => {
  // req.user guaranteed to exist and have isAdmin: true
  // ...
});

export { router };
```
**Source:** Project's existing pattern in `backend/src/routes/admin.ts`

### Complete Frontend Admin Guard
```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminGuard } from './components/AdminGuard';
import { Admin } from './pages/Admin';
import { Forbidden } from './pages/Forbidden';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Dashboard />} />

        {/* Admin routes behind guard */}
        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<Admin />} />
        </Route>

        {/* Standalone 403 page (for deep links or bookmarks) */}
        <Route path="/403" element={<Forbidden />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Complete Telemetry Integration
```typescript
// backend/src/routes/game.ts
import { recordQuestionTelemetry } from '../services/telemetryService.js';

router.post('/answer', async (req: Request, res: Response) => {
  const { sessionId, questionId, selectedOption } = req.body;

  // 1. Score answer (critical path)
  const answer = await sessionManager.submitAnswer(
    sessionId,
    questionId,
    selectedOption
  );

  // 2. Get question details for response
  const session = await sessionManager.getSession(sessionId);
  const question = session.questions.find(q => q.id === questionId);

  // 3. Record telemetry (fire-and-forget)
  // Convert string ID to number for database lookup
  const questionDbId = question.databaseId || question.id;
  recordQuestionTelemetry(
    questionDbId,
    answer.basePoints > 0
  ).catch(() => {
    // Error already logged in telemetryService
  });

  // 4. Send response immediately
  res.status(200).json({
    correct: answer.basePoints > 0,
    correctAnswer: question.correctAnswer,
    totalPoints: answer.totalPoints,
  });
});
```

### Admin Shell with Red Theme
```tsx
// frontend/src/pages/Admin.tsx
export function Admin() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with red theme */}
      <header className="bg-red-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm bg-red-800 px-3 py-1 rounded">
              Admin Mode
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar navigation */}
        <aside className="w-64 bg-red-800 text-white min-h-screen">
          <nav className="p-4 space-y-2">
            <a
              href="/admin"
              className="block py-2 px-4 rounded bg-red-700 hover:bg-red-600 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/admin/questions"
              className="block py-2 px-4 rounded hover:bg-red-700 transition-colors"
            >
              Questions
            </a>
            {/* Placeholder links for Phase 20 */}
          </nav>
        </aside>

        {/* Main content area */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Welcome, Admin
            </h2>

            {/* Placeholder cards for upcoming features */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Question Management
                </h3>
                <p className="text-gray-600 text-sm">
                  Coming in Phase 20: Quality score reporting
                </p>
              </div>
              {/* More placeholder cards */}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| express-jwt package | Custom JWT middleware | 2024+ | Removes dependency; 15 lines of middleware is simpler than configuring express-jwt; better type safety with custom TokenPayload |
| Separate roles table | Boolean is_admin column | For simple cases | Reduces joins; sufficient for binary admin/non-admin; upgrade to roles table when >2 roles needed |
| Global .catch() handler | Per-promise .catch() for fire-and-forget | Node.js 15+ (2020) | Unhandled rejections crash process by default; explicit .catch() prevents crashes |
| Manual SQL migrations | Drizzle code-first migrations | 2023+ (Drizzle adoption) | Schema in TypeScript = single source of truth; migrations auto-generated; type-safe queries |
| Redirect to 403 page | Render 403 component inline | React Router v6 (2021) | Better UX (no flicker); preserves URL; cleaner pattern with route guards |

**Deprecated/outdated:**
- `passport.js` for simple JWT auth: Overkill for projects already using jsonwebtoken; adds 5+ dependencies for what custom middleware achieves
- express-jwt v7+ API breaking changes: Many tutorials show v5/v6 syntax; v7+ requires different initialization
- Tailwind v3 @apply for themes: v4 prefers CSS variables and theme() function; @apply still works but not recommended for dynamic theming

**Notable evolution:** PostgreSQL 11 (2018) made `ADD COLUMN ... DEFAULT value` instant for large tables. Pre-v11 tutorials warning about performance issues are outdated for modern Postgres.

## Open Questions

### Question 1: First Admin Designation Method
**What we know:** CONTEXT.md marks this as Claude's discretion; needs mechanism to grant first admin access
**What's unclear:** Best DX for this project — environment variable (`ADMIN_EMAIL=admin@example.com`), migration seed script, or manual database update
**Recommendation:** **Environment variable on first user registration** — if `user.email === process.env.ADMIN_EMAIL`, set `isAdmin: true` on account creation. Pros: No manual DB access needed; easy to configure in Render dashboard; idempotent. Cons: Only works for new accounts (not retroactive). Alternative: Migration seed that updates existing user by email.

**Implementation:**
```typescript
// backend/src/controllers/authController.ts
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export async function signup(req: Request, res: Response) {
  // ... validation ...

  const user = await User.create({
    email,
    passwordHash: hashedPassword,
    name,
    isAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase(), // Grant admin to configured email
  });

  // ...
}
```

### Question 2: Additional Telemetry Fields
**What we know:** CONTEXT.md requires `encounter_count` and `correct_count`; marks additional fields as Claude's discretion
**What's unclear:** Whether to include `last_encountered_at` timestamp, `avg_response_time`, or other analytics fields now or later
**Recommendation:** **Start with just the two required counters** — defer additional fields to Phase 20 (when admin UI displays them). YAGNI principle: Don't add fields until there's a concrete use case. If Phase 20 planning reveals need for timestamp or response time, add in a follow-up migration. Telemetry columns are cheap to add incrementally.

### Question 3: Anonymous User Telemetry Tracking
**What we know:** CONTEXT.md specifies "all users count" including anonymous; existing game route supports `userId = 'anonymous'`
**What's unclear:** Whether anonymous users should have separate telemetry or unified with authenticated
**Recommendation:** **Unified telemetry** — counters are on questions table (not user-specific), so both anonymous and authenticated gameplay increments the same question counters. This gives true "how often is this question encountered/answered correctly" metrics regardless of login status. No special handling needed; telemetry service doesn't care about userId.

### Question 4: Admin Indicator Visibility
**What we know:** CONTEXT.md requires "subtle indicator" so admins know their status
**What's unclear:** Where to place indicator — header badge, profile menu item, or admin section only
**Recommendation:** **Header badge in main app** — small "Admin" pill in header (right side near profile) visible on all pages. Red colored to match admin theme. Links to `/admin` on click. This meets "subtle" requirement (small, out of main flow) while being always visible (admins don't need to guess their status).

```tsx
// frontend/src/components/layout/Header.tsx
{user?.isAdmin && (
  <a
    href="/admin"
    className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded border border-red-300 hover:bg-red-200 transition-colors"
  >
    Admin
  </a>
)}
```

### Question 5: Telemetry Failure Logging Level
**What we know:** CONTEXT.md marks failure handling as Claude's discretion; telemetry must not block gameplay
**What's unclear:** Should failures log to console (development), monitoring service (production), or silently drop
**Recommendation:** **Console.error in all environments** — telemetry failures indicate DB issues (connection lost, table missing) that need investigation. Not critical enough for alerts, but valuable for debugging. Implementation: `console.error('[Telemetry] Failed to record...', error)` inside try/catch. This logs to stdout (captured by Render) without blocking or throwing.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations) - Official migration workflow and code examples
- [Drizzle ORM - PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new) - Column definitions with defaults
- [PostgreSQL: Documentation: Modifying Tables](https://www.postgresql.org/docs/current/ddl-alter.html) - Official ALTER TABLE syntax
- [Adding new table columns with default values in PostgreSQL 11](https://www.enterprisedb.com/blog/adding-new-table-columns-default-values-postgresql-11) - Performance characteristics
- [Atomic Increment/Decrement operations in SQL](https://medium.com/harrys-engineering/atomic-increment-decrement-operations-in-sql-and-fun-with-locks-f7b124d37873) - Counter pattern with concurrency explanation
- [Express.js role-based permissions middleware](https://gist.github.com/joshnuss/37ebaf958fe65a18d4ff) - Reference middleware factory pattern
- [Understanding "Fire and Forget" in Node.js](https://medium.com/@dev.chetan.rathor/understanding-fire-and-forget-in-node-js-what-it-really-means-a83705aca4eb) - Error handling for async operations

### Secondary (MEDIUM confidence)
- [Implementing Role Based Access Control (RBAC) in Node.js and Express App](https://permify.co/post/role-based-access-control-rbac-nodejs-expressjs/) - Best practices for RBAC middleware
- [How to Implement Authorization in an Express Application](https://www.permit.io/blog/implement-rbac-authorization-in-express) - Middleware ordering and separation of concerns
- [React Router v6 - Private Route Component](https://jasonwatmore.com/post/2022/06/24/react-router-6-private-route-component-to-restrict-access-to-protected-pages) - Route guard pattern
- [Unauthorised access Page on response 403 in React](https://medium.com/@_deadlock/unauthorised-access-page-on-response-403-in-react-4eeb8153010c) - 403 page implementation
- [Theming in Tailwind CSS v4](https://medium.com/@sir.raminyavari/theming-in-tailwind-css-v4-support-multiple-color-schemes-and-dark-mode-ba97aead5c14) - Multiple theme patterns
- [Ultra fast asynchronous counters in Postgres](https://medium.com/@timanovsky/ultra-fast-asynchronous-counters-in-postgres-44c5477303c3) - Counter performance benchmarks
- [fire-and-forgetter npm package](https://www.npmjs.com/package/fire-and-forgetter) - Error handling library (pattern reference, not dependency)

### Tertiary (LOW confidence - WebSearch only, marked for validation)
- [How to Use Express Router Effectively](https://oneuptime.com/blog/post/2026-02-03-express-router/view) - Recent guide on router patterns
- Various Tailwind admin dashboard templates - Visual pattern reference, not used as dependencies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project; patterns verified with official docs
- Architecture: HIGH - Drizzle and Postgres patterns confirmed with official documentation; middleware patterns are Express standard
- Pitfalls: HIGH - Based on common RBAC and telemetry issues; token payload and auth store pitfalls are project-specific (observed in codebase)
- Open questions: MEDIUM - Recommendations based on best practices but not validated against project-specific constraints

**Research date:** 2026-02-19
**Valid until:** ~90 days (stable domain — Express/Drizzle/React Router patterns evolve slowly)

**Notes:**
- All proposed patterns use existing project dependencies (no new npm packages)
- Telemetry pattern prioritizes non-blocking gameplay response (CONTEXT.md requirement)
- Admin theme uses Tailwind's red palette directly (no CSS variable abstraction needed)
- Research assumes PostgreSQL 11+ for instant ADD COLUMN with default (Supabase runs Postgres 15+)

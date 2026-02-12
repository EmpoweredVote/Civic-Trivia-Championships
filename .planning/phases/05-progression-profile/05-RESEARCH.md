# Phase 5: Progression & Profile - Research

**Researched:** 2026-02-12
**Domain:** User progression tracking, profile pages, file uploads, database stats
**Confidence:** HIGH

## Summary

This phase implements a progression system with XP and gems earned per game, displayed on the results screen with count-up animations, and a user profile page showing cumulative stats. The implementation leverages existing patterns from the codebase (Framer Motion animations from ResultsScreen, Zustand for state management, PostgreSQL for persistence) while adding new capabilities for stats tracking, avatar uploads, and profile display.

The standard approach uses PostgreSQL atomic increment operations for updating user stats, Framer Motion's `useMotionValue` and `animate()` for count-up animations matching the existing score display, and a simple profile page with hero section and stats list. File uploads for avatars require Multer v2.0.0+ with strict security validation (MIME type, magic bytes, size limits, secure filenames).

Key architectural decisions: Stats updates must be atomic (use transactions when updating multiple fields), store avatar URLs in database (files in disk storage for MVP, cloud storage for production), and implement initials fallback for avatars using SVG-based components.

**Primary recommendation:** Extend existing database schema with user stats columns, use atomic UPDATE queries with relative increments for stats, reuse ResultsScreen animation patterns for XP/gems count-up, and implement simple avatar upload with strict security validation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 8.11.3 | User stats persistence | Already in stack, supports atomic increments |
| Framer Motion | 12.34.0 | Count-up animations | Already in stack, proven pattern in ResultsScreen |
| Multer | 2.0.0+ | Avatar file upload | Industry standard for Express file uploads |
| Zustand | 4.4.7 | Client state management | Already in stack for auth state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| file-type | Latest | Magic byte validation | Avatar upload security (verify file content) |
| sharp | Latest (optional) | Image processing | If implementing resize/optimization (Claude's discretion) |
| express-rate-limit | Latest | Upload rate limiting | Prevent DoS attacks on upload endpoint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Multer | Formidable | Multer more popular, better documented |
| PostgreSQL columns | Separate stats table | Columns simpler for MVP, table better for history tracking |
| SVG initials | Canvas API | SVG more accessible, easier to style with Tailwind |

**Installation:**
```bash
# Backend
cd backend
npm install multer@^2.0.0 file-type express-rate-limit

# Frontend (if using sharp for processing)
# npm install sharp  # Optional, only if implementing server-side resize
```

## Architecture Patterns

### Recommended Database Schema Extension
```sql
-- Add progression columns to users table
ALTER TABLE users
  ADD COLUMN total_xp INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN total_gems INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN games_played INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN best_score INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN total_correct INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN total_questions INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN avatar_url VARCHAR(500);

-- Indexes for profile queries
CREATE INDEX IF NOT EXISTS idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_best_score ON users(best_score DESC);

-- Constraints
ALTER TABLE users
  ADD CONSTRAINT check_non_negative_xp CHECK (total_xp >= 0),
  ADD CONSTRAINT check_non_negative_gems CHECK (total_gems >= 0),
  ADD CONSTRAINT check_non_negative_games CHECK (games_played >= 0);
```

### Pattern 1: Atomic Stats Update
**What:** Use PostgreSQL's atomic increment operations to update user stats after game completion
**When to use:** Every game completion for authenticated users
**Example:**
```typescript
// Source: PostgreSQL official docs + verified WebSearch pattern
// https://www.postgresql.org/docs/current/tutorial-transactions.html

async function updateUserStats(
  userId: number,
  xpEarned: number,
  gemsEarned: number,
  score: number,
  correctAnswers: number,
  totalQuestions: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atomic increments using relative values
    await client.query(
      `UPDATE users
       SET
         total_xp = total_xp + $1,
         total_gems = total_gems + $2,
         games_played = games_played + 1,
         best_score = GREATEST(best_score, $3),
         total_correct = total_correct + $4,
         total_questions = total_questions + $5
       WHERE id = $6`,
      [xpEarned, gemsEarned, score, correctAnswers, totalQuestions, userId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Pattern 2: Count-Up Animation (Reuse Existing Pattern)
**What:** Animate XP and gems using the same technique as the score counter
**When to use:** Results screen reward display
**Example:**
```typescript
// Source: Existing ResultsScreen.tsx implementation
// Lines 17-42 demonstrate the proven pattern

const xpMotionValue = useMotionValue(0);
const gemsMotionValue = useMotionValue(0);

// Animate with spring physics (same config as score)
useEffect(() => {
  const xpControls = animate(xpMotionValue, xpEarned, {
    type: 'spring',
    stiffness: 100,
    damping: 20,
    mass: 0.5,
    duration: 1.5,
  });

  const gemsControls = animate(gemsMotionValue, gemsEarned, {
    type: 'spring',
    stiffness: 100,
    damping: 20,
    mass: 0.5,
    duration: 1.5,
  });

  return () => {
    xpControls.stop();
    gemsControls.stop();
  };
}, [xpEarned, gemsEarned]);

// Subscribe for display
const [displayXP, setDisplayXP] = useState(0);
useEffect(() => {
  const unsubscribe = xpMotionValue.on('change', (latest) => {
    setDisplayXP(Math.round(latest));
  });
  return unsubscribe;
}, [xpMotionValue]);
```

### Pattern 3: Initials Avatar Fallback
**What:** SVG-based avatar component with colored circle and initials when no image uploaded
**When to use:** Profile page and anywhere user avatar is displayed
**Example:**
```typescript
// Source: WebSearch verified pattern from react-avatar libraries
// https://github.com/wbinnssmith/react-user-avatar

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

function getColorFromName(name: string): string {
  // Deterministic color based on name hash
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-pink-500',
    'bg-teal-500', 'bg-amber-500', 'bg-cyan-500'
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function Avatar({ name, imageUrl, size = 48 }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = getInitials(name);
  const bgColor = getColorFromName(name);

  return (
    <div
      className={`${bgColor} rounded-full flex items-center justify-center text-white font-bold`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}
```

### Pattern 4: Secure Avatar Upload
**What:** Multer-based file upload with comprehensive security validation
**When to use:** Profile avatar upload endpoint
**Example:**
```typescript
// Source: Verified best practices from Multer 2026 guide
// https://thelinuxcode.com/multer-npm-in-2026-file-uploads-in-express-that-dont-bite-you-later/
// https://medium.com/@ibrahimhz/securing-file-uploads-in-express-js-best-practices-unveiled-17380185070f

import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: './uploads/avatars',
  filename: (req, file, cb) => {
    // Secure UUID-based filename
    const uniqueName = crypto.randomUUID() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // MIME type check (metadata level)
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP allowed.'));
    return;
  }
  cb(null, true);
};

export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

// Magic byte validation middleware (content level)
export async function validateImageContent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.file) {
    next();
    return;
  }

  try {
    const fileType = await fileTypeFromBuffer(req.file.buffer || await fs.readFile(req.file.path));

    if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      // Delete uploaded file
      await fs.unlink(req.file.path);
      res.status(400).json({ error: 'Invalid image file' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'File validation failed' });
  }
}
```

### Anti-Patterns to Avoid
- **Race conditions in stats updates:** Don't use SELECT + calculate + UPDATE pattern. Use atomic increments with `column = column + $value`.
- **Storing files in database as BYTEA:** Don't store image binary data in PostgreSQL. Store file paths/URLs, files on disk or S3.
- **Client-side XP calculation:** Don't trust client for progression values. Server must calculate XP/gems based on server-validated game results.
- **Missing transaction rollback:** Always wrap multi-table updates in transactions with proper error handling and ROLLBACK.
- **Forgetting perfect game styling:** Must apply golden treatment to XP/gems when isPerfectGame is true (matches existing score styling).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload handling | Custom multipart parser | Multer 2.0.0+ | Security vulnerabilities, CVEs in older versions, handles multipart/form-data correctly |
| Image validation | Extension checking only | file-type package (magic bytes) | Extensions can be spoofed, magic bytes verify actual content |
| Avatar initials | Canvas rendering | SVG with Tailwind | More accessible, easier to style, server-side compatible |
| Number animations | Manual RAF loop | Framer Motion animate() | Already in stack, handles physics calculations, cleanup |
| Stats aggregation | Application-level sum | PostgreSQL aggregate columns | Database handles atomicity, less network overhead |

**Key insight:** Security validations for file uploads have many edge cases (MIME type spoofing, path traversal, DoS attacks). Use battle-tested libraries with active CVE monitoring rather than custom solutions.

## Common Pitfalls

### Pitfall 1: Stats Update Race Conditions
**What goes wrong:** Using SELECT to read current stats, calculate new values, then UPDATE causes lost updates when multiple games finish simultaneously.
**Why it happens:** Developers think of it procedurally: "read current value, add earned value, save total." But concurrent requests overwrite each other.
**How to avoid:** Always use atomic increments with relative values: `UPDATE users SET total_xp = total_xp + $earned` instead of `UPDATE users SET total_xp = $newTotal`.
**Warning signs:** User reports XP not increasing correctly, stats lower than expected, inconsistent totals.

### Pitfall 2: File Upload Security Gaps
**What goes wrong:** Only checking file extension or MIME type header allows malicious uploads (PHP shell disguised as .jpg, SVG with embedded scripts).
**Why it happens:** Developers implement "happy path" validation without considering adversarial users.
**How to avoid:** Implement layered security: 1) MIME type check (fileFilter), 2) Magic byte validation (file-type package), 3) Size limits, 4) Rate limiting, 5) Secure UUID filenames.
**Warning signs:** Files uploaded don't match declared type, server can execute uploaded files, disk fills rapidly.

### Pitfall 3: Animation State Cleanup
**What goes wrong:** Animations continue running after component unmounts or values change, causing memory leaks and incorrect displays.
**Why it happens:** Forgetting to stop animation controls and unsubscribe from motion value listeners in cleanup functions.
**How to avoid:** Always return cleanup function from useEffect that stops animation controls and unsubscribes from listeners (see Pattern 2 example).
**Warning signs:** Memory usage grows over time, animations feel janky, console warnings about state updates on unmounted components.

### Pitfall 4: Anonymous User Handling
**What goes wrong:** Attempting to update stats for anonymous users causes database errors or stores garbage data.
**Why it happens:** Game flow supports anonymous users (per Phase 3 decisions), but progression requires authenticated users.
**How to avoid:** Check authentication status before calculating/displaying progression. Hide XP/gems UI for anonymous users (per CONTEXT.md decision: "Hidden for anonymous users").
**Warning signs:** Database errors with userId='anonymous', progression features shown when not logged in.

### Pitfall 5: Profile Empty State UX
**What goes wrong:** Showing "0 games, 0 XP, 0%" for new users feels discouraging and looks like a bug.
**Why it happens:** Developers focus on the "has data" state and forget the first-time user experience.
**How to avoid:** Implement empty state detection (games_played === 0) and show encouraging message with CTA to play first game (per CONTEXT.md decision).
**Warning signs:** New users confused about what to do, profile page looks broken for new accounts.

### Pitfall 6: Best Score Logic Error
**What goes wrong:** Using standard increment pattern for best_score causes it to always increase instead of keeping the maximum.
**Why it happens:** Copy-paste from other stats without considering the different logic (max vs. sum).
**How to avoid:** Use PostgreSQL's GREATEST() function: `best_score = GREATEST(best_score, $newScore)` (see Pattern 1).
**Warning signs:** Best score increases every game even when score is lower, best score incorrect.

### Pitfall 7: Transaction Forgetting ROLLBACK
**What goes wrong:** When one UPDATE in a transaction fails, previous updates persist, causing inconsistent state (e.g., XP updated but gems not).
**Why it happens:** Missing error handling or forgetting to ROLLBACK before throwing/returning.
**How to avoid:** Always use try/catch/finally pattern with ROLLBACK in catch block (see Pattern 1 example).
**Warning signs:** Stats partially updated, XP and gems out of sync, database state inconsistent after errors.

## Code Examples

Verified patterns from official sources and existing codebase:

### Calculate XP and Gems (Server-Side)
```typescript
// Source: Phase 5 requirements + server-authority pattern from Phase 3
interface ProgressionRewards {
  xpEarned: number;
  gemsEarned: number;
}

function calculateProgression(correctAnswers: number, totalQuestions: number): ProgressionRewards {
  // XP formula: 50 base + 1 per correct
  const xpEarned = 50 + correctAnswers;

  // Gems formula: 10 base + 1 per correct
  const gemsEarned = 10 + correctAnswers;

  return { xpEarned, gemsEarned };
}

// Usage in game completion endpoint
export async function completeGame(req: Request, res: Response) {
  const { userId, sessionId } = req.body;

  // Validate session and get results (existing pattern)
  const gameResult = await validateAndScoreSession(sessionId);

  // Calculate progression (server authority)
  const { xpEarned, gemsEarned } = calculateProgression(
    gameResult.totalCorrect,
    gameResult.totalQuestions
  );

  // Update user stats atomically (if authenticated)
  if (userId && userId !== 'anonymous') {
    await updateUserStats(
      userId,
      xpEarned,
      gemsEarned,
      gameResult.totalScore,
      gameResult.totalCorrect,
      gameResult.totalQuestions
    );
  }

  res.json({
    ...gameResult,
    progression: userId === 'anonymous' ? null : { xpEarned, gemsEarned }
  });
}
```

### Display Rewards on Results Screen
```typescript
// Source: Extending existing ResultsScreen.tsx pattern
interface ResultsScreenProps {
  result: GameResult;
  questions: Question[];
  progression?: { xpEarned: number; gemsEarned: number } | null;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultsScreen({ result, questions, progression, onPlayAgain, onHome }: ResultsScreenProps) {
  const isPerfectGame = result.totalCorrect === result.totalQuestions;

  // Existing score animation
  const motionScore = useMotionValue(0);

  // New progression animations
  const xpMotionValue = useMotionValue(0);
  const gemsMotionValue = useMotionValue(0);

  // Animate all values with same spring config
  useEffect(() => {
    const scoreControls = animate(motionScore, result.totalScore, {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      mass: 0.5,
      duration: 1.5,
    });

    let xpControls, gemsControls;
    if (progression) {
      xpControls = animate(xpMotionValue, progression.xpEarned, {
        type: 'spring',
        stiffness: 100,
        damping: 20,
        mass: 0.5,
        duration: 1.5,
      });

      gemsControls = animate(gemsMotionValue, progression.gemsEarned, {
        type: 'spring',
        stiffness: 100,
        damping: 20,
        mass: 0.5,
        duration: 1.5,
      });
    }

    return () => {
      scoreControls.stop();
      xpControls?.stop();
      gemsControls?.stop();
    };
  }, [result.totalScore, progression]);

  // Subscribe to motion values
  const [displayScore, setDisplayScore] = useState(0);
  const [displayXP, setDisplayXP] = useState(0);
  const [displayGems, setDisplayGems] = useState(0);

  useEffect(() => {
    const unsubScore = motionScore.on('change', (latest) => {
      setDisplayScore(Math.round(latest));
    });

    const unsubXP = xpMotionValue.on('change', (latest) => {
      setDisplayXP(Math.round(latest));
    });

    const unsubGems = gemsMotionValue.on('change', (latest) => {
      setDisplayGems(Math.round(latest));
    });

    return () => {
      unsubScore();
      unsubXP();
      unsubGems();
    };
  }, [motionScore, xpMotionValue, gemsMotionValue]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Existing score display */}
      <motion.div className={`text-7xl font-bold ${isPerfectGame ? 'text-yellow-400' : 'text-teal-400'}`}>
        {displayScore.toLocaleString()}
      </motion.div>

      {/* New: Rewards row (only for authenticated users) */}
      {progression && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-8 mt-6"
        >
          {/* XP display */}
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              {/* Custom XP icon SVG path */}
            </svg>
            <span className={`text-2xl font-bold ${isPerfectGame ? 'text-yellow-400' : 'text-cyan-400'}`}>
              +{displayXP}
            </span>
          </div>

          {/* Gems display */}
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              {/* Custom gem icon SVG path */}
            </svg>
            <span className={`text-2xl font-bold ${isPerfectGame ? 'text-yellow-400' : 'text-purple-400'}`}>
              +{displayGems}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

### Profile Page Stats Display
```typescript
// Source: WebSearch verified patterns + CONTEXT.md decisions
interface ProfileStats {
  totalXp: number;
  totalGems: number;
  gamesPlayed: number;
  bestScore: number;
  overallAccuracy: number; // Calculated: totalCorrect / totalQuestions * 100
}

export function ProfilePage() {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    // Fetch stats on load (refresh on load approach)
    async function loadStats() {
      const response = await fetch('/api/users/profile/stats', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      setStats(data);
      setLoading(false);
    }
    loadStats();
  }, []);

  if (loading) return <div>Loading...</div>;

  const hasPlayedGames = stats && stats.gamesPlayed > 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Hero section: identity-focused */}
      <div className="bg-slate-800 rounded-lg p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar name={user.name} imageUrl={user.avatarUrl} size={80} />
          <div>
            <h1 className="text-3xl font-bold text-white">{user.name}</h1>
            <p className="text-slate-400">{user.email}</p>
          </div>
        </div>

        {/* Currency totals */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              {/* XP icon */}
            </svg>
            <span className="text-cyan-400 font-bold">{stats?.totalXp.toLocaleString()}</span>
            <span className="text-slate-400 text-sm">XP</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              {/* Gem icon */}
            </svg>
            <span className="text-purple-400 font-bold">{stats?.totalGems.toLocaleString()}</span>
            <span className="text-slate-400 text-sm">Gems</span>
          </div>
        </div>
      </div>

      {/* Stats section */}
      <div className="bg-slate-800 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-white mb-6">Statistics</h2>

        {!hasPlayedGames ? (
          // Empty state per CONTEXT.md
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg mb-4">No games played yet!</p>
            <p className="text-slate-500 mb-6">Play your first game to start tracking your stats.</p>
            <button
              onClick={() => navigate('/game')}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg"
            >
              Play Your First Game
            </button>
          </div>
        ) : (
          // Simple vertical list per CONTEXT.md
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-slate-700">
              <span className="text-slate-400">Games Played</span>
              <span className="text-white font-bold">{stats.gamesPlayed}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-slate-700">
              <span className="text-slate-400">Best Score</span>
              <span className="text-white font-bold">{stats.bestScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-400">Overall Accuracy</span>
              <span className="text-white font-bold">{stats.overallAccuracy}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multer 1.x | Multer 2.0.0+ | Dec 2024-Jan 2025 | Critical CVEs fixed (CVE-2025-47935, CVE-2025-47944), must upgrade |
| Extension-only validation | Magic byte validation (file-type) | Ongoing best practice | Prevents spoofed file uploads |
| SERIAL for IDs | GENERATED AS IDENTITY | PostgreSQL 10+ (2017) | More explicit, better tooling support |
| Class components | Functional components + hooks | React 16.8+ (2019) | Simpler code, already adopted in codebase |
| Separate XP/currency tables | Columns in users table | Design choice | Columns simpler for single-value tracking, table better for history |

**Deprecated/outdated:**
- Multer v1.4.4-lts.1 and earlier: Contains critical security vulnerabilities, must use v2.0.0+
- MIME type-only validation: Easily spoofed, always combine with magic byte checking
- SELECT-then-UPDATE for counters: Race condition prone, use atomic increments

## Open Questions

Things that couldn't be fully resolved:

1. **File storage scalability**
   - What we know: Disk storage works for MVP, cloud storage (S3) needed for production scale
   - What's unclear: At what user/upload volume does disk storage become problematic? 100 users? 1000?
   - Recommendation: Start with disk storage (uploads/avatars directory), plan migration path to S3 in future phase. Document storage location in schema comments.

2. **Avatar image optimization**
   - What we know: Sharp library can resize/optimize images server-side, reduces storage and bandwidth
   - What's unclear: Is optimization necessary for MVP? Adds complexity and dependency.
   - Recommendation: Claude's discretion (per CONTEXT.md). If implementing, resize to max 400x400 and convert to WebP for optimal size.

3. **Real-time stats updates**
   - What we know: "Refresh on load" simpler for MVP, "real-time" requires WebSocket or polling
   - What's unclear: Do users expect profile stats to update immediately after game completion?
   - Recommendation: Start with refresh on load (simpler), UX testing can validate if real-time needed. If stats displayed elsewhere (leaderboard), revisit.

4. **Accuracy calculation precision**
   - What we know: Store total_correct and total_questions, calculate percentage on read
   - What's unclear: Should we round to whole number (70%) or show decimals (70.5%)?
   - Recommendation: Whole number percentage per CONTEXT.md ("Accuracy as percentage only"). Use Math.round() client-side.

5. **Hamburger menu implementation**
   - What we know: Profile accessed via hamburger menu item per CONTEXT.md
   - What's unclear: Hamburger menu doesn't exist yet in Header component
   - Recommendation: Planner should create task to add hamburger menu to Header with Profile menu item. On mobile, show hamburger; on desktop, show inline nav.

## Sources

### Primary (HIGH confidence)
- PostgreSQL Official Documentation - Transactions: https://www.postgresql.org/docs/current/tutorial-transactions.html
- Existing codebase patterns - ResultsScreen.tsx animation (lines 17-42), authStore.ts Zustand pattern
- Multer 2026 Security Guide: https://thelinuxcode.com/multer-npm-in-2026-file-uploads-in-express-that-dont-bite-you-later/
- PostgreSQL atomic increments pattern: https://www.depesz.com/2016/06/14/incrementing-counters-in-database/

### Secondary (MEDIUM confidence)
- React Avatar patterns: https://github.com/wbinnssmith/react-user-avatar, https://www.npmjs.com/package/react-initials-avatar
- Profile page UX best practices: https://www.eleken.co/blog-posts/profile-page-design
- File upload security patterns: https://medium.com/@ibrahimhz/securing-file-uploads-in-express-js-best-practices-unveiled-17380185070f
- Framer Motion BuildUI recipe: https://buildui.com/recipes/animated-counter

### Tertiary (LOW confidence)
- Game progression schema patterns: https://vertabelo.com/blog/a-database-model-for-action-games/ (general concepts, not PostgreSQL-specific)
- Spring animation physics: https://blog.maximeheckel.com/posts/the-physics-behind-spring-animations/ (educational, not implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use or industry standard with verified versions
- Architecture: HIGH - Patterns verified from official docs and existing codebase
- Pitfalls: HIGH - Based on verified PostgreSQL transaction patterns and security best practices
- File upload: HIGH - Verified from official Multer 2026 guide with CVE information
- Animation patterns: HIGH - Reusing proven patterns from existing ResultsScreen implementation

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days - stack is stable, file upload security requires ongoing monitoring for new CVEs)

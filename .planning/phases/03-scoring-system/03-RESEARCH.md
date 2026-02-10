# Phase 3: Scoring System - Research

**Researched:** 2026-02-10
**Domain:** Server-side game scoring with animated UI feedback
**Confidence:** HIGH

## Summary

The scoring system requires three key technical areas: (1) Framer Motion animations for score counter and feedback popups, (2) server-side session management for anti-cheat score calculation, and (3) extended game state machine to track scoring data throughout the game flow.

The standard approach uses Framer Motion's `useMotionValue` with `animate()` for performant counter animations, Map-based in-memory session storage on the server for game state tracking, and timing-safe comparison for plausibility validation. The existing game state reducer pattern extends cleanly to include score data.

The project already has Framer Motion (v12.34.0) installed and uses a useReducer-based state machine pattern, so this phase builds on existing architecture without introducing new dependencies.

**Primary recommendation:** Extend the existing GameAnswer type to include score data (basePoints, speedBonus, responseTime), use Framer Motion's useMotionValue + animate() for score counter animations with spring physics, and implement Map-based session storage on the server with crypto.timingSafeEqual for answer validation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Framer Motion | 12.34.0 (installed) | Score animations, popups, transitions | Industry standard for React animations, already in use for game UI |
| Node.js crypto | Built-in | Timing-safe comparison for anti-cheat | Native module prevents timing attacks on validation |
| Map (ES6) | Built-in | In-memory session storage | Better performance than Object for frequent updates, proper key-value semantics |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-countdown-circle-timer | 3.2.1 (installed) | Timer color zones for speed bonus tiers | Already in use, provides visual feedback for bonus tiers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Map sessions | Redis/Memcached | Map is simpler for MVP, sufficient for single-server deployment |
| Framer Motion | React Spring, GSAP | Framer Motion already installed and team familiar |
| useMotionValue | React state + CSS transitions | useMotionValue is more performant (bypasses React render cycle) |

**Installation:**
```bash
# No new dependencies required - all libraries already installed or built-in
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── services/
│   └── scoreService.ts        # Score calculation logic
│   └── sessionService.ts      # Session tracking and validation
├── types/
│   └── game.ts                # Extended types for scoring

frontend/src/
├── features/game/
│   ├── components/
│   │   └── ScoreDisplay.tsx   # Animated score counter
│   │   └── ScorePopup.tsx     # Floating +points feedback
│   ├── hooks/
│   │   └── useScoreAnimation.ts  # Score animation logic
│   └── gameReducer.ts         # Extended with score data
├── types/
│   └── game.ts                # Extended GameAnswer with score fields
```

### Pattern 1: Server-Authoritative Scoring with Session Tracking
**What:** Server creates session when game starts, tracks all answers with timestamps, calculates scores server-side only, validates plausibility before returning results.

**When to use:** Any competitive or score-based game where client-side manipulation must be prevented.

**Example:**
```typescript
// Server-side session store
const gameSessions = new Map<string, GameSession>();

interface GameSession {
  sessionId: string;
  userId: string;
  questions: Question[];
  answers: ServerAnswer[];
  startTime: number;
  lastActivityTime: number;
}

interface ServerAnswer {
  questionId: string;
  selectedOption: number | null;
  submittedAt: number;        // Server timestamp
  questionStartedAt: number;   // When question was shown
  timeRemaining: number;       // Client-reported (validate against server time)
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
}

// Create session when game starts
function createGameSession(userId: string, questions: Question[]): string {
  const sessionId = crypto.randomUUID();
  gameSessions.set(sessionId, {
    sessionId,
    userId,
    questions,
    answers: [],
    startTime: Date.now(),
    lastActivityTime: Date.now()
  });
  return sessionId;
}

// Validate and score answer
function submitAnswer(
  sessionId: string,
  questionId: string,
  selectedOption: number | null,
  clientReportedTimeRemaining: number
): ServerAnswer {
  const session = gameSessions.get(sessionId);
  if (!session) throw new Error('Invalid session');

  const now = Date.now();
  const question = session.questions.find(q => q.id === questionId);
  if (!question) throw new Error('Invalid question');

  // Plausibility check: response time
  const responseTime = (25000 - clientReportedTimeRemaining * 1000) / 1000;
  if (responseTime < 0.5) {
    // Suspiciously fast - flag but don't penalize for MVP
    console.warn(`Suspicious response time: ${responseTime}s`);
  }

  // Calculate score (server authority)
  const isCorrect = selectedOption === question.correctAnswer;
  const basePoints = isCorrect ? 100 : 0;
  const speedBonus = isCorrect ? calculateSpeedBonus(clientReportedTimeRemaining) : 0;

  const answer: ServerAnswer = {
    questionId,
    selectedOption,
    submittedAt: now,
    questionStartedAt: session.lastActivityTime,
    timeRemaining: clientReportedTimeRemaining,
    basePoints,
    speedBonus,
    totalPoints: basePoints + speedBonus
  };

  session.answers.push(answer);
  session.lastActivityTime = now;

  return answer;
}

function calculateSpeedBonus(timeRemaining: number): number {
  // 3 tiers based on CONTEXT.md decisions
  if (timeRemaining >= 15) return 50;  // Fast: 15s+ remaining
  if (timeRemaining >= 5) return 25;   // Medium: 5-15s remaining
  return 0;                            // Slow: <5s remaining
}
```

### Pattern 2: useMotionValue Score Counter Animation
**What:** Uses Framer Motion's `useMotionValue` and `animate()` for performant counter animations that bypass React's render cycle.

**When to use:** Any number that updates frequently and needs smooth animation (score, health, currency, etc.)

**Example:**
```typescript
// Source: BuildUI Animated Counter + Motion docs
import { useMotionValue, animate, useTransform, motion } from 'framer-motion';
import { useEffect } from 'react';

function ScoreDisplay({ score }: { score: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, Math.round);

  useEffect(() => {
    const controls = animate(motionValue, score, {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      mass: 0.5
    });

    return controls.stop;
  }, [score, motionValue]);

  return (
    <motion.div className="text-4xl font-bold">
      <motion.span>{rounded}</motion.span>
    </motion.div>
  );
}
```

### Pattern 3: Staggered Score Popup Animations
**What:** Show base points and speed bonus as separate popups that stagger in, then merge into the total score.

**When to use:** Multi-part score feedback where each component has meaning (base + bonus, kills + combo, etc.)

**Example:**
```typescript
// Source: Framer Motion stagger documentation
import { motion, AnimatePresence } from 'framer-motion';

function ScorePopups({ basePoints, speedBonus, onComplete }: ScorePopupProps) {
  return (
    <AnimatePresence mode="wait" onExitComplete={onComplete}>
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Base points popup */}
        <motion.div
          className="text-2xl font-bold text-white"
          initial={{ y: 20, scale: 0.5, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ delay: 0, type: 'spring', stiffness: 200 }}
        >
          +{basePoints}
        </motion.div>

        {/* Speed bonus popup (staggered) */}
        {speedBonus > 0 && (
          <motion.div
            className="text-xl font-semibold text-teal-400"
            initial={{ y: 20, scale: 0.5, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
          >
            +{speedBonus} speed
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Pattern 4: Extended State Machine for Scoring
**What:** Extend existing useReducer game state pattern to include score data without breaking existing phase transitions.

**When to use:** Building on existing state machine - add new data without changing control flow.

**Example:**
```typescript
// Extend existing GameAnswer type (types/game.ts)
export type GameAnswer = {
  questionId: string;
  selectedOption: number | null;
  correct: boolean;
  timeRemaining: number;
  // NEW: Score data from server
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
  responseTime: number;  // For "fastest answer" stat
};

// Extend GameResult type
export type GameResult = {
  answers: GameAnswer[];
  totalCorrect: number;
  totalQuestions: number;
  // NEW: Score aggregates
  totalScore: number;
  totalBasePoints: number;
  totalSpeedBonus: number;
  fastestAnswer: {
    questionIndex: number;
    responseTime: number;
    points: number;
  } | null;
};

// Reducer action updated to include server response
export type GameAction =
  // ... existing actions
  | {
      type: 'REVEAL_ANSWER';
      timeRemaining: number;
      // NEW: Server returns score calculation
      scoreData: {
        basePoints: number;
        speedBonus: number;
        totalPoints: number;
      };
    };
```

### Anti-Patterns to Avoid
- **Client-side score calculation:** Never trust the client - always calculate scores server-side to prevent manipulation
- **Using React state for counter animations:** `useState` triggers re-renders; use `useMotionValue` for better performance
- **Forgetting AnimatePresence:** Exit animations won't work without wrapping with AnimatePresence
- **Session storage in plain Objects:** Use Map for better performance and cleaner API when doing frequent updates
- **Standard equality for HMAC/signature comparison:** Always use crypto.timingSafeEqual to prevent timing attacks

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number counter animation | Custom interval-based counter | Framer Motion useMotionValue + animate() | Built-in spring physics, proper cleanup, performance optimized |
| Session expiration | setTimeout-based cleanup | Map with periodic sweep or LRU cache | Memory leaks, timer drift issues |
| Timing-safe comparison | Custom byte-by-byte compare | crypto.timingSafeEqual | Prevents timing attacks, native implementation |
| Exit animations | Manual opacity/transform | AnimatePresence + exit props | Handles unmount timing, cleanup, complex transitions |
| Speed bonus tiers | Complex if-else logic | Lookup table or config-driven | Easier to tune, self-documenting |

**Key insight:** Animation performance and security validation are areas where naive implementations fail in production. Use battle-tested libraries and native crypto primitives instead of custom solutions.

## Common Pitfalls

### Pitfall 1: AnimatePresence Not Wrapping Conditional Content
**What goes wrong:** Exit animations don't play when component unmounts. Popup disappears instantly instead of animating out.

**Why it happens:** React removes component from tree immediately. Framer Motion needs AnimatePresence to delay unmount until exit animation completes.

**How to avoid:** Always wrap conditionally-rendered motion components with AnimatePresence. Ensure direct children have unique keys.

**Warning signs:**
- Popups/modals disappear instantly
- Console warning about missing keys
- Exit animations work in isolation but not in app

### Pitfall 2: Race Conditions in Session Validation
**What goes wrong:** Client submits answers out of order or retries failed requests, causing duplicate scoring or validation errors.

**Why it happens:** Network delays mean answers don't arrive in question order. Server assumes sequential submission.

**How to avoid:**
- Track answers by questionId, not submission order
- Use idempotent answer submission (same answer = same result)
- Include question sequence number in validation

**Warning signs:**
- Intermittent "Invalid question" errors
- Duplicate score entries
- Score totals don't match expected values

### Pitfall 3: Client-Server Time Skew in Plausibility Checks
**What goes wrong:** Legitimate fast answers flagged as suspicious due to clock drift between client and server.

**Why it happens:** Client reports "time remaining" based on local clock. Server validates against server clock. Clocks drift.

**How to avoid:**
- Use client-reported timeRemaining for score calculation (but validate range)
- Track server-side duration separately for anomaly detection
- Don't reject on single suspicious response - flag for review instead

**Warning signs:**
- Players report "cheating" warnings despite honest play
- Plausibility checks trigger on first question of game
- Issues correlate with specific timezones or devices

### Pitfall 4: Memory Leaks from Abandoned Sessions
**What goes wrong:** Game sessions accumulate in Map without cleanup. Server memory grows unbounded.

**Why it happens:** Players start games but never finish (close tab, network error, etc.). No expiration logic removes stale sessions.

**How to avoid:**
- Implement periodic cleanup (every 5 minutes, remove sessions >1 hour old)
- Set lastActivityTime on every interaction
- Consider session size limits (max 1000 active sessions)

**Warning signs:**
- Server memory usage grows over time
- Performance degrades after hours of uptime
- Map.size keeps increasing

### Pitfall 5: useMotionValue Stale Closures
**What goes wrong:** Animation doesn't update when prop changes. Counter animates to wrong value or skips updates.

**Why it happens:** useEffect dependencies missing motionValue. Closure captures old value.

**How to avoid:** Include motionValue in useEffect dependencies. Use .get() to read current value inside effect.

**Warning signs:**
- Score counter stuck at 0 or previous value
- Animations trigger on mount but not on updates
- Counter updates on second render only

## Code Examples

Verified patterns from official sources:

### Session Management with Cleanup
```typescript
// Source: Express session best practices + Map documentation
import { randomUUID } from 'crypto';

interface GameSession {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActivityTime: number;
  questions: Question[];
  answers: ServerAnswer[];
}

class SessionManager {
  private sessions = new Map<string, GameSession>();
  private readonly SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Periodic cleanup of expired sessions
    setInterval(() => this.cleanupExpiredSessions(), this.CLEANUP_INTERVAL_MS);
  }

  createSession(userId: string, questions: Question[]): string {
    const sessionId = randomUUID();
    const now = Date.now();

    this.sessions.set(sessionId, {
      sessionId,
      userId,
      createdAt: now,
      lastActivityTime: now,
      questions,
      answers: []
    });

    return sessionId;
  }

  getSession(sessionId: string): GameSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Update activity timestamp
    session.lastActivityTime = Date.now();
    return session;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityTime > this.SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions. Active: ${this.sessions.size}`);
    }
  }
}

export const sessionManager = new SessionManager();
```

### Timing-Safe Answer Validation
```typescript
// Source: Node.js crypto documentation
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET_KEY = process.env.GAME_SECRET || 'fallback-secret-change-in-prod';

function validateAnswerIntegrity(
  sessionId: string,
  questionId: string,
  selectedOption: number,
  clientSignature: string
): boolean {
  // Create expected signature
  const payload = `${sessionId}:${questionId}:${selectedOption}`;
  const expectedSignature = createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison prevents timing attacks
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const clientBuffer = Buffer.from(clientSignature, 'hex');

  // Buffers must be same length
  if (expectedBuffer.length !== clientBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, clientBuffer);
}
```

### Animated Score Counter with Spring Physics
```typescript
// Source: BuildUI Animated Counter + Motion documentation
import { useMotionValue, animate, useTransform, motion } from 'framer-motion';
import { useEffect } from 'react';

interface ScoreDisplayProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreDisplay({ score, size = 'md' }: ScoreDisplayProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, Math.round);

  useEffect(() => {
    const controls = animate(motionValue, score, {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      mass: 0.5,
      velocity: 0
    });

    // Cleanup on unmount or score change
    return () => controls.stop();
  }, [score, motionValue]);

  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl'
  };

  return (
    <div className={`font-bold ${sizeClasses[size]}`}>
      <motion.span>{rounded}</motion.span>
    </div>
  );
}
```

### Shake Animation on Wrong Answer
```typescript
// Source: Framer Motion animation documentation
import { motion } from 'framer-motion';

interface ScoreContainerProps {
  shouldShake: boolean;
  children: React.ReactNode;
}

export function ScoreContainer({ shouldShake, children }: ScoreContainerProps) {
  return (
    <motion.div
      animate={shouldShake ? {
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.5 }
      } : {}}
      className="relative"
    >
      {/* Optional: Red flash overlay */}
      {shouldShake && (
        <motion.div
          className="absolute inset-0 bg-red-500 rounded-lg pointer-events-none"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
      {children}
    </motion.div>
  );
}
```

### Results Screen Score Breakdown
```typescript
// Extending existing GameResult calculation
export function calculateGameResult(answers: GameAnswer[]): GameResult {
  const totalCorrect = answers.filter(a => a.correct).length;
  const totalScore = answers.reduce((sum, a) => sum + a.totalPoints, 0);
  const totalBasePoints = answers.reduce((sum, a) => sum + a.basePoints, 0);
  const totalSpeedBonus = answers.reduce((sum, a) => sum + a.speedBonus, 0);

  // Find fastest answer (only among correct answers)
  const correctAnswers = answers
    .map((a, idx) => ({ ...a, questionIndex: idx }))
    .filter(a => a.correct);

  const fastestAnswer = correctAnswers.length > 0
    ? correctAnswers.reduce((fastest, current) =>
        current.responseTime < fastest.responseTime ? current : fastest
      )
    : null;

  return {
    answers,
    totalCorrect,
    totalQuestions: answers.length,
    totalScore,
    totalBasePoints,
    totalSpeedBonus,
    fastestAnswer: fastestAnswer ? {
      questionIndex: fastestAnswer.questionIndex,
      responseTime: fastestAnswer.responseTime,
      points: fastestAnswer.totalPoints
    } : null
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Spring library | Framer Motion (now Motion) | ~2020-2021 | Simpler API, better TypeScript support, smaller bundle |
| setTimeout counters | useMotionValue + animate() | Motion v6+ (2021) | Better performance, automatic cleanup, spring physics |
| express-session package | Map-based custom sessions | 2024+ (for MVP) | Simpler for single-server, no Redis dependency |
| CSS transitions | Layout animations | Motion v4+ (2020) | Automatic FLIP animations, scale correction |

**Deprecated/outdated:**
- **MemoryStore from express-session:** Officially not for production (memory leaks). Use memorystore package if needed, or custom Map with cleanup.
- **Framer Motion v10 API:** Library rebranded to "Motion" in 2024. API mostly compatible but import paths changed.
- **useAnimation() hook:** Replaced by animate() function for imperative animations (simpler API).

## Open Questions

Things that couldn't be fully resolved:

1. **Batch vs Per-Answer Score Submission**
   - What we know: Can submit each answer immediately for real-time feedback, or batch all at game end
   - What's unclear: User preference on real-time score visibility vs suspense reveal at end
   - Recommendation: Start with per-answer submission (fits existing reveal phase), can add batch mode later

2. **Session Storage Scaling**
   - What we know: Map works for MVP single-server deployment
   - What's unclear: When to migrate to Redis/shared storage
   - Recommendation: Monitor active session count. Migrate when approaching horizontal scaling or seeing memory issues

3. **Plausibility Check Strictness**
   - What we know: Need to flag impossible responses (<0.5s, after timeout)
   - What's unclear: How to handle edge cases (legitimate fast correct answers, network lag)
   - Recommendation: Log warnings for MVP, don't penalize. Review logs to tune thresholds before enforcing

4. **Perfect Game Animation Details**
   - What we know: Should have special visual treatment per CONTEXT.md
   - What's unclear: Specific animation (confetti, golden glow, scale effect?)
   - Recommendation: Research during implementation - check existing game UX patterns for celebration moments

## Sources

### Primary (HIGH confidence)
- [Framer Motion Documentation](https://motion.dev/docs/react-animate-number) - AnimateNumber component
- [Motion Stagger Documentation](https://www.framer.com/motion/stagger/) - Stagger animations
- [BuildUI Animated Counter](https://buildui.com/recipes/animated-counter) - useMotionValue counter pattern
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html) - crypto.timingSafeEqual
- [MDN Map Documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) - ES6 Map API

### Secondary (MEDIUM confidence)
- [When You Should Prefer Map Over Object In JavaScript](https://www.zhenghao.io/posts/object-vs-map) - Performance comparison
- [Securing Game Code in 2025: Modern Anti-Cheat Techniques](https://medium.com/@lzysoul/securing-game-code-in-2025-modern-anti-cheat-techniques-and-best-practices-e2e0f6f14173) - Anti-cheat patterns
- [How to Use the Optimistic UI Pattern](https://www.freecodecamp.org/news/how-to-use-the-optimistic-ui-pattern-with-the-useoptimistic-hook-in-react/) - React 19 optimistic updates
- [Exit animation with framer-motion demystified](https://www.romaintrotard.com/posts/exit-animation-with-framer-motion-demystified/) - AnimatePresence patterns
- [Express Session Middleware](https://expressjs.com/en/resources/middleware/session.html) - Session management patterns

### Tertiary (LOW confidence)
- [Game Anti-Cheat Patterns](https://github.com/hrt/AnticheatJS) - General anti-cheat concepts (not Node-specific)
- [TypeScript State Machine Patterns](https://medium.com/@floyd.may/building-a-typescript-state-machine-cc9e55995fa8) - State machine design (not game-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified, already in use or native Node.js
- Architecture: HIGH - Extends existing patterns (useReducer, Map, Framer Motion), no new paradigms
- Pitfalls: MEDIUM - Based on general Framer Motion and session management knowledge, not scoring-specific testing
- Anti-cheat: MEDIUM - General patterns verified, specific implementation needs testing

**Research date:** 2026-02-10
**Valid until:** 2026-03-12 (30 days - stable libraries, established patterns)

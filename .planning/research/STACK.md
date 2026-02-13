# Stack Research: v1.1 Tech Debt Hardening

**Domain:** Civic Trivia Championship (game-show-style web app)
**Researched:** 2026-02-12
**Confidence:** HIGH (existing patterns verified, current versions confirmed)

## Executive Summary

v1.1 focuses on hardening existing systems without introducing new complexity. The validated stack (React 18+, TypeScript, Express, PostgreSQL, JWT) remains unchanged. Three focused additions are needed:

1. **Redis client already installed** (`redis@4.6.12`) — currently used for token blacklist, needs session storage implementation
2. **@anthropic-ai/sdk** — missing dev dependency for content generation script
3. **Plausibility enhancement** — no new libraries needed, architectural pattern change only

## Redis Client (Session Storage)

### Current State
- **Already installed**: `redis@4.6.12` in `backend/package.json`
- **Already configured**: `backend/src/config/redis.ts` creates client from `REDIS_URL`
- **Already connected**: Used for JWT token blacklist in `tokenUtils.ts`
- **Current gap**: Game sessions stored in-memory Map with 1-hour expiry (see `sessionService.ts`)

### Recommendation: Use Existing `redis` Client

**DO NOT install a new Redis client.** The project already uses the official `redis` package (node-redis), which is:

- **Actively maintained**: Latest version is 5.10.0 (published 3 months ago as of Feb 2026)
- **Redis 8 compatible**: Supports latest Redis Stack features
- **Already wired**: Configuration exists, connection established
- **Upgrade path**: Can upgrade from 4.6.12 → 5.10.0 when convenient

**Why NOT ioredis:**
- Project already standardized on `redis` (node-redis)
- No clustering or Sentinel needs (single-server sessions)
- Latest node-redis (v5.x) is recommended for new projects by Redis.io
- Switching clients adds migration risk with zero benefit

### Implementation Pattern: JSON Serialization

For game session storage, use JSON serialization:

```typescript
// Store session
await redis.set(
  `session:${sessionId}`,
  JSON.stringify(sessionData),
  { EX: 3600 } // 1-hour TTL
);

// Retrieve session
const raw = await redis.get(`session:${sessionId}`);
const session = raw ? JSON.parse(raw) : null;
```

**Why JSON, not Redis hashes:**
- Session data is already structured as objects
- Single atomic read/write operation
- Simpler expiry management (TTL on entire session)
- Matches existing in-memory Map pattern

**Migration strategy:**
1. Replace `new Map()` with Redis client wrapper
2. Keep existing `SessionService` interface unchanged
3. Add error handling for Redis connection failures (fallback logging)

### Optional: Session Store Middleware (NOT RECOMMENDED)

The project could use `connect-redis@9.0.0` with `express-session@1.19.0` for automatic session management, but **DO NOT DO THIS** because:

- **Wrong abstraction**: Sessions are game-specific, not user auth sessions
- **Overhead**: express-session adds cookie middleware complexity
- **Current pattern works**: Direct Redis key-value storage matches existing in-memory approach
- **More dependencies**: Adds 2 packages for functionality that's 10 lines of code

**Verdict:** Direct `redis.set/get` is the right pattern for game sessions.

## Content Generation Tooling

### Current State
- **Script exists**: `backend/src/scripts/generateLearningContent.ts`
- **Error**: `import Anthropic from '@anthropic-ai/sdk'` — package not installed
- **Usage**: Dev-time script (not application code) for generating educational content via Claude API

### Recommendation: Install as Dev Dependency

```bash
npm install -D @anthropic-ai/sdk
```

**Version:** Latest is `0.74.0` (published 4 days ago as of Feb 2026)

**Why devDependency:**
- Script runs outside the application (dev tooling)
- Not imported by production code (`src/server.ts` doesn't reference it)
- Keeps production bundle lean

**Additional dependency:** Script already uses `tsx@4.7.0` (installed) for TypeScript execution.

**No other changes needed:**
- Script structure is sound (retry logic, rate limiting, JSON validation)
- Follows best practices (env var for API key, graceful error handling)
- TypeScript types included in SDK package

### Alternative Considered: @ai-sdk/anthropic

**DO NOT use** `@ai-sdk/anthropic` (Vercel AI SDK wrapper):
- Script already written for official Anthropic SDK
- Direct SDK gives more control (streaming, caching, etc.)
- Official SDK has first-party TypeScript support
- No benefit from Vercel abstraction layer for this use case

## Plausibility Check Enhancement

### Current State
- **Exists**: Timing checks in `sessionService.ts` lines 204-214
- **Behavior**: Logs warnings with `console.warn()`, sets `flagged: true`, but **doesn't penalize**
- **Checks**:
  - Response time < 300ms (suspiciously fast)
  - Time remaining > threshold (manipulated timer)

### Recommendation: Architectural Pattern (No New Libraries)

**DO NOT add new packages.** The enhancement is a business logic change, not a technical capability gap.

#### Pattern 1: Progressive Penalties (Recommended)

```typescript
// In submitAnswer() after plausibility checks
if (flagged) {
  // Log for monitoring
  console.warn(`⚠️ Suspicious answer: sessionId ${sessionId}, questionId ${questionId}`);

  // Apply graduated penalty
  const penaltyFactor = 0.7; // 30% penalty
  basePoints = Math.floor(basePoints * penaltyFactor);
  speedBonus = 0; // No speed bonus for flagged answers
}
```

**Why this approach:**
- Non-blocking: Doesn't reject answers (avoids false positives angering users)
- Graduated: Reduces reward rather than disqualifying
- Observable: Logs remain for pattern analysis
- Tunable: `penaltyFactor` can be adjusted based on data

#### Pattern 2: Threshold Counting

Track flagged answers per session:

```typescript
// Add to GameSession interface
interface GameSession {
  // ... existing fields
  flaggedCount: number;
}

// In submitAnswer()
if (flagged) {
  session.flaggedCount++;

  // After 3 flagged answers, apply session-wide penalty
  if (session.flaggedCount >= 3) {
    // Apply harsher penalties or mark session for review
  }
}
```

**Rationale:** Single anomaly could be network latency, but 3+ suggests manipulation.

#### Pattern 3: Rate Limiting (NOT RECOMMENDED for MVP)

Could use `express-rate-limit@7.4.0` with `rate-limit-redis@5.x` for IP-based limiting, but:

- **Overkill**: Existing plausibility checks are sufficient
- **False positives**: Shared IPs (school, coffee shop) would be penalized
- **Wrong abstraction**: Rate limiting is for API abuse, not in-game cheating
- **More dependencies**: Adds complexity without addressing root issue

**Verdict:** Stick with in-game plausibility penalties (Pattern 1 or 2).

### What NOT to Add: ML-Based Detection

Modern game anti-cheat uses ML for behavioral pattern detection (see academic research on click trajectory analysis, transformer models for cheat detection). **DO NOT implement this** because:

- **Scope creep**: v1.1 is tech debt hardening, not new features
- **Data requirements**: Need thousands of gameplay sessions for training
- **Complexity**: Requires separate infrastructure (model serving, feature pipelines)
- **Premature**: No evidence of widespread cheating to justify investment

**Principle:** Solve problems you have, not problems you imagine.

## What NOT to Add

### 1. Session Store Middleware (connect-redis)
- **Reason**: Direct Redis usage matches existing pattern
- **Confidence**: HIGH (verified current architecture)

### 2. ioredis Client
- **Reason**: Project already standardized on node-redis
- **Confidence**: HIGH (package.json verified)

### 3. Rate Limiting Middleware
- **Reason**: Plausibility checks handle gaming behavior; rate limiting is for API abuse
- **Confidence**: MEDIUM (could be useful later for public API, but not v1.1 scope)

### 4. ML/AI Cheat Detection Libraries
- **Reason**: Premature complexity without evidence of problem
- **Confidence**: HIGH (academic research reviewed, but not applicable to MVP)

### 5. Vercel AI SDK
- **Reason**: Script uses official Anthropic SDK; no benefit from abstraction
- **Confidence**: HIGH (verified script implementation)

### 6. express-validator Upgrades
- **Reason**: Already installed (`express-validator@7.3.1`), no new validation needs
- **Confidence**: HIGH (package.json verified)

## Installation Commands

### Required: Fix Dev Script
```bash
cd backend
npm install -D @anthropic-ai/sdk
```

### Optional: Upgrade Redis Client (Non-Blocking)
```bash
cd backend
npm install redis@5.10.0
```
**Note:** Can defer upgrade; 4.6.12 → 5.10.0 is non-breaking API change.

### Not Needed
```bash
# DO NOT run these
npm install ioredis           # Wrong client
npm install connect-redis     # Wrong abstraction
npm install express-rate-limit # Wrong tool for plausibility
```

## Integration with Existing Stack

### Express + PostgreSQL + JWT (Unchanged)
- **Auth flow**: Already uses Redis for token blacklist (`tokenUtils.ts`)
- **Session storage**: Will share Redis instance (different key namespace)
- **Database**: PostgreSQL remains source of truth for user data, progression

### Redis Namespace Strategy
```
token:blacklist:{jti}       # Existing: JWT token blacklist
session:{sessionId}         # New: Game session storage
```

**No conflicts:** Different key prefixes ensure isolation.

### TypeScript Compilation
- **Frontend**: No changes (frontend doesn't touch Redis)
- **Backend**: Redis client types already installed (`@types/redis` implicit in redis@4.x+)
- **Dev script**: Anthropic SDK includes TypeScript definitions

## Sources

### HIGH Confidence Sources (Official Documentation)

- [Redis Node.js Client (node-redis) — redis.io](https://redis.io/docs/latest/develop/clients/nodejs/)
- [Redis Session Storage — redis.io](https://redis.io/learn/develop/node/nodecrashcourse/sessionstorage)
- [@anthropic-ai/sdk — npm](https://www.npmjs.com/package/@anthropic-ai/sdk)
- [redis — npm](https://www.npmjs.com/package/redis)
- [GitHub: redis/node-redis releases](https://github.com/redis/node-redis/releases)

### MEDIUM Confidence Sources (Verified Web Search)

- [ioredis vs node-redis comparison (npm trends)](https://npmtrends.com/ioredis-vs-node-redis)
- [Redis vs ioredis vs valkey-glide (Glama.ai blog, Jan 2026)](https://glama.ai/blog/2026-01-26-redis-vs-ioredis-vs-valkey-glide)
- [Session Management with Redis guide (OneUpTime, Jan 2026)](https://oneuptime.com/blog/post/2026-01-28-session-storage-redis/view)
- [Express Rate Limiting guide (OneUpTime, Feb 2026)](https://oneuptime.com/blog/post/2026-02-02-express-rate-limiting/view)
- [connect-redis — GitHub](https://github.com/tj/connect-redis)
- [express-session — npm](https://www.npmjs.com/package/express-session)

### LOW Confidence Sources (Informational Only)

- [Gaming cheat detection research (Medium, Academic Papers)](https://medium.com/@amol346bhalerao/how-game-developers-detect-and-stop-cheating-in-real-time-0aa4f1f52e0c)
- [Express.js best practices (TheLinuxCode, 2026)](https://thelinuxcode.com/expressjs-tutorial-2026-practical-scalable-patterns-for-real-projects/)
- [rate-limit-redis — GitHub](https://github.com/express-rate-limit/rate-limit-redis)

*Note: LOW confidence sources informed "What NOT to Add" section but did not drive recommendations.*

---

**Next Steps for Roadmap:**

1. **Phase 1**: Migrate session storage to Redis (update `SessionService` only)
2. **Phase 2**: Fix dev tooling (install `@anthropic-ai/sdk`)
3. **Phase 3**: Enhance plausibility checks (progressive penalties in `submitAnswer()`)

All three are independent and can be implemented in any order.

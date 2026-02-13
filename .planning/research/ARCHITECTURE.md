# Architecture Research: v1.1 Tech Debt Hardening - Redis Migration

**Focus:** Redis migration for game session storage
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

The Civic Trivia Championship app currently stores game sessions in an in-memory Map with 1-hour TTL and cleanup intervals. This works for MVP but causes session loss on server restart. Redis is already installed and configured for JWT token blacklisting, making the migration path straightforward.

**Recommendation:** Migrate to Redis using JSON serialization with the existing `redis` client (v4.6.12), maintaining the current SessionManager API to minimize breaking changes. The migration can be done incrementally with zero downtime using async conversion followed by storage replacement.

## Current Session Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│ SessionManager (sessionService.ts)                      │
│ - In-memory Map<string, GameSession>                    │
│ - 1-hour expiry, 5-minute cleanup interval              │
│ - Synchronous operations (createSession, getSession,    │
│   submitAnswer, getResults)                             │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Game Routes (game.ts)
                         ↓
┌─────────────────────────────────────────────────────────┐
│ POST /api/game/session → sessionManager.createSession() │
│ POST /api/game/answer  → sessionManager.submitAnswer()  │
│ GET  /api/game/results → sessionManager.getResults()    │
└─────────────────────────────────────────────────────────┘
```

### Data Structure

**GameSession Interface:**
```typescript
{
  sessionId: string;           // UUID
  userId: string | number;     // User ID or 'anonymous'
  questions: Question[];       // Array of 10 questions with answers
  answers: ServerAnswer[];     // Submitted answers with scores
  createdAt: Date;            // Session creation time
  lastActivityTime: Date;     // Last access time (for TTL)
  progressionAwarded: boolean; // Prevents double-awarding XP/gems
}
```

**Key Operations:**
- `createSession()` - Creates session, returns sessionId (sync)
- `getSession()` - Retrieves session, updates lastActivityTime (sync)
- `submitAnswer()` - Validates, scores, stores answer (sync)
- `getResults()` - Aggregates answers, calculates totals (sync)

### Current Limitations

1. **Data loss on restart** - Server restart loses all active sessions
2. **Single-server only** - Cannot share sessions across instances
3. **Manual cleanup** - setInterval every 5 minutes to delete expired sessions
4. **Memory leak risk** - If cleanup fails, memory grows unbounded

## Target Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│ SessionManager (sessionService.ts)                      │
│ - Redis client (already configured)                     │
│ - Automatic TTL expiration (1 hour)                     │
│ - Async operations (await on all methods)               │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Redis (config/redis.ts)
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Redis Store                                             │
│ Key: session:{sessionId}                                │
│ Value: JSON-serialized GameSession                      │
│ TTL: 3600 seconds (1 hour)                              │
│ Expiration: Sliding TTL on each access                  │
└─────────────────────────────────────────────────────────┘
```

### Redis Key Schema

**Pattern:** `session:{sessionId}`

**Example:**
```
session:550e8400-e29b-41d4-a716-446655440000
```

**Value:** JSON-serialized GameSession object

**TTL Strategy:** Sliding expiration - reset to 3600s on each access via `getSession()`

### Data Serialization

**Approach:** JSON serialization with Date handling

```typescript
// Store
const sessionData = JSON.stringify({
  ...session,
  createdAt: session.createdAt.toISOString(),
  lastActivityTime: session.lastActivityTime.toISOString()
});
await redis.set(`session:${sessionId}`, sessionData, { EX: 3600 });

// Retrieve
const data = await redis.get(`session:${sessionId}`);
const session = JSON.parse(data);
session.createdAt = new Date(session.createdAt);
session.lastActivityTime = new Date(session.lastActivityTime);
```

**Why JSON over Redis Hashes:**
- Sessions are always retrieved as a whole (no partial updates)
- GameSession contains nested objects (questions, answers arrays)
- Simpler serialization for complex nested data
- Pattern matches existing JWT token storage in tokenUtils.ts

**Alternative Considered:** Redis Hashes for flat data - Rejected because GameSession contains arrays and nested objects, making JSON more natural.

## Migration Strategy

### Phase 1: Async Wrapper (Minimal Breaking Change)

**Goal:** Make SessionManager methods async while maintaining in-memory storage

**Changes:**
```typescript
// Before (sync)
createSession(userId, questions): string

// After (async)
async createSession(userId, questions): Promise<string>
```

**Impact:**
- All route handlers calling sessionManager must await
- No data migration needed yet
- Tests continue to pass with in-memory storage

**Files Modified:**
- `backend/src/services/sessionService.ts` - Add async to all methods
- `backend/src/routes/game.ts` - Add await to all sessionManager calls

### Phase 2: Redis Implementation (Zero Downtime)

**Goal:** Replace Map with Redis while maintaining API compatibility

**Dual-Write Approach (Optional):**
For zero downtime during migration, write to both stores:
```typescript
// Write to both
this.sessions.set(sessionId, session);
await redis.set(`session:${sessionId}`, JSON.stringify(session), { EX: 3600 });

// Read from Redis first, fallback to Map
let session = await this.getSessionFromRedis(sessionId);
if (!session) {
  session = this.sessions.get(sessionId);
}
```

**Direct Migration (Recommended):**
Since sessions are ephemeral (1-hour lifetime), simply switch storage:
```typescript
async createSession(userId, questions): Promise<string> {
  const sessionId = randomUUID();
  const session = { /* ... */ };

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify(session),
    { EX: 3600 }
  );

  return sessionId;
}
```

**Files Modified:**
- `backend/src/services/sessionService.ts` - Replace Map with Redis operations
- Remove cleanup interval (Redis TTL handles expiration)

### Phase 3: Graceful Degradation (Production Hardening)

**Goal:** Handle Redis failures without crashing the server

**Pattern:** Circuit breaker with in-memory fallback

```typescript
async createSession(userId, questions): Promise<string> {
  const sessionId = randomUUID();
  const session = { /* ... */ };

  try {
    if (redis.isReady) {
      await redis.set(
        `session:${sessionId}`,
        JSON.stringify(session),
        { EX: 3600 }
      );
    } else {
      // Fallback to in-memory (degraded mode)
      this.fallbackSessions.set(sessionId, session);
      console.warn('⚠️  Redis unavailable - using in-memory fallback');
    }
  } catch (error) {
    console.error('Redis error:', error);
    this.fallbackSessions.set(sessionId, session);
  }

  return sessionId;
}
```

**Files Modified:**
- `backend/src/services/sessionService.ts` - Add error handling and fallback Map

## Integration Points

### Modified Components

| File | Changes | Impact |
|------|---------|--------|
| `backend/src/services/sessionService.ts` | Convert methods to async, replace Map with Redis calls | HIGH - Core session logic |
| `backend/src/routes/game.ts` | Add await to all sessionManager calls | MEDIUM - Route handlers |
| `backend/src/config/redis.ts` | Already configured - no changes needed | NONE |

### New Components

None required - Redis client already configured and used for JWT tokens.

### Integration with Existing Redis Usage

**Current Pattern (tokenUtils.ts):**
```typescript
await redis.set(key, '1', { EX: expirySeconds });
const exists = await redis.exists(key);
```

**Session Pattern (similar):**
```typescript
await redis.set(`session:${sessionId}`, JSON.stringify(session), { EX: 3600 });
const data = await redis.get(`session:${sessionId}`);
```

**Consistency:** Both use:
- Namespaced keys (`refresh:`, `blacklist:`, `session:`)
- TTL with `EX` option
- Async/await throughout
- Same Redis client instance

## Data Flow Changes

### Before (In-Memory Map)

```
Client Request
    │
    ↓
POST /api/game/session
    │
    ↓
sessionManager.createSession() [SYNC]
    │
    ├─→ Generate UUID
    ├─→ sessions.set(sessionId, session) [Map]
    └─→ Return sessionId
    │
    ↓
201 { sessionId, questions }
```

**Characteristics:**
- Synchronous operations
- Instant read/write (in-process memory)
- Manual cleanup via setInterval
- Lost on server restart

### After (Redis)

```
Client Request
    │
    ↓
POST /api/game/session
    │
    ↓
await sessionManager.createSession() [ASYNC]
    │
    ├─→ Generate UUID
    ├─→ await redis.set(...) [Network call]
    │   └─→ TTL: 3600s
    └─→ Return sessionId
    │
    ↓
201 { sessionId, questions }
```

**Characteristics:**
- Asynchronous operations (network I/O)
- ~1-5ms latency per Redis call (local Redis)
- Automatic TTL expiration (no cleanup interval)
- Survives server restart
- Shareable across multiple server instances

### Sliding TTL Implementation

**Pattern:** Reset TTL on every access

```typescript
async getSession(sessionId: string): Promise<GameSession | null> {
  const data = await redis.get(`session:${sessionId}`);

  if (!data) return null;

  const session = this.deserializeSession(data);

  // Update lastActivityTime and reset TTL
  session.lastActivityTime = new Date();
  await redis.set(
    `session:${sessionId}`,
    JSON.stringify(session),
    { EX: 3600 }  // Reset to 1 hour
  );

  return session;
}
```

**Benefit:** Active sessions stay alive, inactive sessions expire automatically.

## Build Order

### Iteration 1: Async Migration (Non-Breaking)

**Goal:** Prepare codebase for async operations without changing storage

**Tasks:**
1. Add async/await to SessionManager methods
2. Update route handlers to await sessionManager calls
3. Update tests to handle async operations
4. Verify all game flows still work

**Testing:**
- Run existing game flow tests
- Verify no regressions in POST /session, POST /answer, GET /results

**Estimated Effort:** 1-2 hours

### Iteration 2: Redis Implementation

**Goal:** Replace in-memory Map with Redis storage

**Tasks:**
1. Create serialization/deserialization helpers
2. Replace `sessions.set()` with `redis.set()`
3. Replace `sessions.get()` with `redis.get()`
4. Remove cleanup interval (rely on Redis TTL)
5. Update tests to mock Redis client

**Testing:**
- Integration tests with real Redis instance
- Verify session creation, retrieval, expiration
- Test 1-hour TTL behavior

**Estimated Effort:** 2-3 hours

### Iteration 3: Error Handling & Fallback

**Goal:** Graceful degradation when Redis unavailable

**Tasks:**
1. Add fallback Map for degraded mode
2. Wrap Redis calls in try/catch
3. Check `redis.isReady` before operations
4. Add logging for fallback scenarios
5. Add health check endpoint reporting Redis status

**Testing:**
- Simulate Redis connection failure
- Verify fallback to in-memory storage
- Verify recovery when Redis reconnects

**Estimated Effort:** 2-3 hours

### Iteration 4: Production Validation

**Goal:** Verify migration in production environment

**Tasks:**
1. Monitor Redis connection metrics
2. Verify session persistence across server restarts
3. Check for memory leaks (should decrease)
4. Validate TTL expiration behavior
5. Test multi-instance scenario (if applicable)

**Testing:**
- Production smoke tests
- Load testing with concurrent sessions
- Server restart test (sessions should persist)

**Estimated Effort:** 1-2 hours

**Total Estimated Effort:** 6-10 hours

## Performance Considerations

### Latency Impact

| Operation | Before (In-Memory) | After (Redis Local) | Impact |
|-----------|-------------------|---------------------|--------|
| createSession | <1ms | 1-3ms | Negligible |
| getSession | <1ms | 1-3ms | Negligible |
| submitAnswer | <1ms | 1-3ms | Negligible |
| getResults | <1ms | 1-3ms | Negligible |

**Analysis:** For local Redis, network latency adds ~1-2ms per operation. This is imperceptible to users and well within the app's performance budget (FCP <1.5s, TTI <3s).

### Connection Pooling

**Current Setup:** Single Redis client shared across all requests (already configured in `config/redis.ts`)

**Best Practice:** node-redis (v4.6.12) uses connection pooling internally - no additional configuration needed for typical web app loads.

**Monitoring:** Track Redis connection metrics via:
```typescript
redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));
```

Already implemented in `config/redis.ts`.

### Memory Usage

**Before:** All sessions stored in Node.js heap
- 10 sessions × ~50KB = 500KB
- 100 sessions × ~50KB = 5MB
- 1000 sessions × ~50KB = 50MB

**After:** Sessions stored in Redis (separate process)
- Node.js heap: Minimal (only active request data)
- Redis: Same memory footprint, but isolated

**Benefit:** Reduced risk of Node.js heap exhaustion under high load.

## Error Handling Patterns

### Pattern 1: Fail Fast (MVP - Simple)

**When:** Redis is required, no fallback needed

```typescript
async createSession(...): Promise<string> {
  try {
    await redis.set(...);
  } catch (error) {
    console.error('Redis error:', error);
    throw new Error('Session creation failed - try again');
  }
}
```

**Pro:** Simple, clear error reporting
**Con:** Service downtime if Redis unavailable

### Pattern 2: Graceful Degradation (Recommended)

**When:** High availability required, short-term Redis outages acceptable

```typescript
async createSession(...): Promise<string> {
  try {
    if (redis.isReady) {
      await redis.set(...);
      return sessionId;
    }
  } catch (error) {
    console.error('Redis error - using fallback:', error);
  }

  // Fallback to in-memory
  this.fallbackSessions.set(sessionId, session);
  return sessionId;
}
```

**Pro:** Service remains available during Redis outages
**Con:** Sessions created during outage lost on server restart

### Pattern 3: Circuit Breaker (Advanced)

**When:** Protecting Redis from cascading failures

```typescript
class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new Error('Circuit breaker open');
    }

    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      if (this.failures > 5) {
        this.state = 'open';
        setTimeout(() => { this.state = 'half-open'; }, 30000);
      }
      throw error;
    }
  }
}
```

**Pro:** Prevents Redis overload during partial failures
**Con:** Added complexity, may not be needed for MVP

**Recommendation:** Start with Pattern 2 (Graceful Degradation) for v1.1.

## Testing Strategy

### Unit Tests

**Mock Redis Client:**
```typescript
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(JSON.stringify(mockSession)),
  del: jest.fn().mockResolvedValue(1),
  isReady: true
};
```

**Test Cases:**
- ✓ createSession stores session with correct TTL
- ✓ getSession retrieves and deserializes correctly
- ✓ getSession resets TTL (sliding expiration)
- ✓ submitAnswer updates session in Redis
- ✓ getResults aggregates from Redis-stored session
- ✓ Handles Redis errors gracefully (fallback mode)
- ✓ Date serialization/deserialization preserves values

### Integration Tests

**Real Redis Instance:**
Use test Redis instance (redis://localhost:6379/1)

**Test Cases:**
- ✓ Session persists after server restart
- ✓ Session expires after 1 hour of inactivity
- ✓ Sliding TTL extends active session lifetime
- ✓ Concurrent requests don't corrupt session state
- ✓ Multiple sessions isolated by sessionId

### Load Tests

**Scenario:** 100 concurrent users playing games

**Metrics:**
- Redis operations/sec
- 95th percentile latency
- Error rate
- Memory usage (Node.js + Redis)

**Tools:** Artillery, k6, or custom Node.js script

## Security Considerations

### Data Exposure

**Risk:** Session data contains correct answers for all questions

**Mitigation:** Already handled - questions stored without client access to correctAnswer until after submission.

**Redis Security:**
- Use `REDIS_URL` from environment (supports auth)
- Example: `redis://:password@localhost:6379`
- Production: Use TLS (`rediss://`) for encrypted connections

### Session Hijacking

**Current Protection:**
- SessionId is UUID v4 (cryptographically random)
- No session cookies (sessionId in request body)
- Server-side score calculation prevents tampering

**Redis Impact:** No change - same security model applies

### Data Retention

**Current:** 1-hour TTL, then deleted
**Redis:** Same - TTL auto-expires after 3600s

**Compliance:** No PII stored in sessions (userId is numeric ID, questions are public data)

## Rollback Plan

### If Migration Fails

**Step 1:** Revert code changes
```bash
git revert <commit-hash>
```

**Step 2:** Restart server with old code
```bash
npm run build && npm start
```

**Impact:** Active sessions lost (same as current behavior on restart)

### If Redis Performance Issues

**Step 1:** Enable in-memory fallback mode
```typescript
const FORCE_FALLBACK = process.env.USE_MEMORY_SESSIONS === 'true';
```

**Step 2:** Set environment variable
```bash
USE_MEMORY_SESSIONS=true npm start
```

**Impact:** Returns to v1.0 behavior (in-memory sessions)

## Production Deployment Checklist

- [ ] Redis server running and accessible
- [ ] `REDIS_URL` environment variable configured
- [ ] Redis authentication configured (if production)
- [ ] TLS enabled for Redis connection (production only)
- [ ] Health check endpoint reports Redis status
- [ ] Monitoring alerts configured for Redis errors
- [ ] Fallback mode tested and verified
- [ ] Load tests completed successfully
- [ ] Server restart test confirms session persistence
- [ ] Rollback plan documented and tested

## Monitoring & Observability

### Key Metrics

| Metric | What to Track | Alert Threshold |
|--------|---------------|-----------------|
| Redis Connection Status | `redis.isReady` | Alert if false > 30s |
| Redis Operation Latency | Time for set/get operations | Alert if p95 > 50ms |
| Redis Error Rate | Failed operations / total | Alert if > 1% |
| Fallback Mode Activations | Count of fallback usage | Alert on any usage |
| Active Sessions | Total session keys | Monitor for memory planning |

### Logging

**Session Operations:**
```typescript
console.log(`✓ Session created: ${sessionId} (userId: ${userId})`);
console.log(`✓ Session retrieved: ${sessionId}`);
console.warn(`⚠️  Redis unavailable - using fallback`);
console.error(`❌ Redis error:`, error);
```

**Health Check Endpoint:**
```typescript
app.get('/health', async (req, res) => {
  const redisStatus = redis.isReady ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    redis: redisStatus,
    fallbackMode: !redis.isReady
  });
});
```

## Open Questions

**Q1:** Should we implement dual-write for zero-downtime migration?
**A1:** Not needed - sessions are ephemeral (1-hour lifetime), acceptable to lose in-flight sessions during deployment.

**Q2:** Do we need to support multiple Redis instances (Redis Cluster)?
**A2:** Not for v1.1 - single Redis instance sufficient for MVP scale. Consider for future scaling.

**Q3:** Should we migrate existing in-memory sessions to Redis during deployment?
**A3:** Not needed - sessions expire within 1 hour anyway. Simpler to let old sessions expire naturally.

## Sources

**HIGH Confidence (Official Documentation):**
- [node-redis Client Guide](https://redis.io/docs/latest/develop/clients/nodejs/) - Connection management, async patterns
- [node-redis GitHub](https://github.com/redis/node-redis) - TypeScript patterns, error handling
- [Redis Session Storage Tutorial](https://redis.io/learn/develop/node/nodecrashcourse/sessionstorage) - Express + Redis integration
- [Redis Error Handling](https://redis.io/docs/latest/develop/clients/nodejs/error-handling/) - Official error handling patterns
- [Redis TTL Documentation](https://redis.io/commands/ttl/) - Expiration mechanisms

**MEDIUM Confidence (Recent 2026 Articles):**
- [How to Use Redis Key Expiration Effectively](https://oneuptime.com/blog/post/2026-01-25-redis-key-expiration-effectively/view) - TTL best practices
- [How to Implement Sliding TTL in Redis](https://oneuptime.com/blog/post/2026-01-26-redis-sliding-ttl/view) - Sliding expiration pattern
- [How to Build Session Storage with Redis](https://oneuptime.com/blog/post/2026-01-28-session-storage-redis/view) - Session management patterns
- [Redis JSON Storage](https://redis.io/glossary/json-storage/) - JSON serialization approaches
- [How to Configure Connection Pooling for Redis](https://oneuptime.com/blog/post/2026-01-25-redis-connection-pooling/view) - Connection pool patterns

**MEDIUM Confidence (Migration Patterns):**
- [Reliable Redis Connections in Node.js](https://medium.com/@backendwithali/reliable-redis-connections-in-node-js-lazy-loading-retry-logic-circuit-breakers-5d8597bbc62c) - Circuit breaker patterns
- [Building Resilient REST API Integrations](https://medium.com/@oshiryaeva/building-resilient-rest-api-integrations-graceful-degradation-and-combining-patterns-e8352d8e29c0) - Graceful degradation patterns
- [Migrate from ioredis](https://redis.io/docs/latest/develop/clients/nodejs/migration/) - Client comparison context

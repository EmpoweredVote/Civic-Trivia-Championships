# Phase 9: Redis Session Migration - Research

**Researched:** 2026-02-13
**Domain:** Redis session storage with Node.js/TypeScript
**Confidence:** HIGH

## Summary

Redis session migration for Node.js involves replacing in-memory Map storage with Redis-backed persistence while maintaining graceful degradation. The standard approach uses **node-redis** (official Redis client v5.x) with JSON serialization, automatic TTL expiry, and connection retry strategies. The architecture follows a storage abstraction pattern where Redis is the primary backend with in-memory fallback when unavailable.

The existing `SessionManager` class stores complex `GameSession` objects (with nested arrays and metadata) that must be serialized to JSON for Redis storage. Redis operations are atomic and fast (sub-5ms locally), with built-in TTL support eliminating manual cleanup intervals. The migration requires converting synchronous Map operations to async Redis calls, implementing connection health monitoring, and providing graceful degradation through try-catch patterns.

**Primary recommendation:** Use node-redis v5.x with JSON serialization, implement storage abstraction interface for Redis/Map backends, use SETEX for atomic set-with-TTL operations, and follow Pattern 2 (Graceful Degradation) from official Redis error handling documentation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| redis | 5.10.0+ | Redis client for Node.js | Official Redis-maintained client, full TypeScript support, native async/await, modern RESP3 protocol support |
| node:crypto | Built-in | UUID generation | Already used in codebase for session IDs, no additional dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| redis (Docker) | 7.4-alpine | Local Redis instance | Development testing, included in docker-compose.yml |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-redis | ioredis | ioredis offers better cluster/sentinel support but node-redis is official, has better docs, and supports latest Redis features. For single-instance use case, node-redis is simpler |
| JSON serialization | @redis/json (RedisJSON) | RedisJSON enables partial updates and querying but adds complexity and requires Redis Stack. JSON.stringify is sufficient for session objects that are read/written atomically |
| Custom storage abstraction | connect-redis (express-session) | connect-redis is designed for cookie-based sessions, not custom session management. Current architecture uses explicit session IDs passed by client, not cookies |

**Installation:**
```bash
npm install redis
```

No @types/redis needed - TypeScript definitions are built into the redis package.

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── services/
│   ├── sessionService.ts          # SessionManager class (existing)
│   └── storage/
│       ├── SessionStorage.ts      # Storage interface (new)
│       ├── RedisStorage.ts        # Redis implementation (new)
│       └── MemoryStorage.ts       # In-memory implementation (new)
├── config/
│   └── redis.ts                   # Redis client initialization (new)
└── routes/
    └── health.ts                  # Health check endpoint (new)
```

### Pattern 1: Storage Abstraction Interface

**What:** Define a common interface that both Redis and in-memory storage implement

**When to use:** When you need graceful degradation between storage backends

**Example:**
```typescript
// Source: Derived from official node-redis patterns and graceful degradation best practices
export interface SessionStorage {
  get(sessionId: string): Promise<GameSession | null>;
  set(sessionId: string, session: GameSession, ttlSeconds: number): Promise<void>;
  delete(sessionId: string): Promise<void>;
  count(): Promise<number>;
  cleanup(): Promise<void>; // No-op for Redis (TTL handles it)
}

export class RedisStorage implements SessionStorage {
  constructor(private client: RedisClientType) {}

  async get(sessionId: string): Promise<GameSession | null> {
    const data = await this.client.get(`session:${sessionId}`);
    if (!data) return null;

    const parsed = JSON.parse(data);
    // Deserialize Date objects
    parsed.createdAt = new Date(parsed.createdAt);
    parsed.lastActivityTime = new Date(parsed.lastActivityTime);
    return parsed;
  }

  async set(sessionId: string, session: GameSession, ttlSeconds: number): Promise<void> {
    // SETEX is atomic: sets value + TTL in single operation
    await this.client.setEx(
      `session:${sessionId}`,
      ttlSeconds,
      JSON.stringify(session)
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.client.del(`session:${sessionId}`);
  }

  async count(): Promise<number> {
    const keys = await this.client.keys('session:*');
    return keys.length;
  }

  async cleanup(): Promise<void> {
    // No-op: Redis TTL handles expiration automatically
  }
}

export class MemoryStorage implements SessionStorage {
  private sessions: Map<string, GameSession> = new Map();

  async get(sessionId: string): Promise<GameSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async set(sessionId: string, session: GameSession, ttlSeconds: number): Promise<void> {
    this.sessions.set(sessionId, session);
    // No TTL enforcement in memory storage (degraded mode)
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async count(): Promise<number> {
    return this.sessions.size;
  }

  async cleanup(): Promise<void> {
    // Manual cleanup for expired sessions
    const now = Date.now();
    const SESSION_EXPIRY_MS = 60 * 60 * 1000;
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivityTime.getTime() > SESSION_EXPIRY_MS) {
        this.sessions.delete(id);
      }
    }
  }
}
```

### Pattern 2: Graceful Degradation with Connection Management

**What:** Handle Redis connection failures by falling back to in-memory storage without crashing

**When to use:** Production environments where Redis may be temporarily unavailable

**Example:**
```typescript
// Source: https://redis.io/docs/latest/develop/clients/nodejs/error-handling/
import { createClient, RedisClientType } from 'redis';

class SessionStorageFactory {
  private redisClient: RedisClientType | null = null;
  private storage: SessionStorage;
  private isDegraded = false;

  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('ℹ️  REDIS_URL not set, using in-memory storage');
      this.storage = new MemoryStorage();
      this.isDegraded = true;
      return;
    }

    try {
      this.redisClient = createClient({ url: redisUrl });

      // Critical: Always register error handler to prevent process crash
      this.redisClient.on('error', (err) => {
        console.error('Redis client error:', err);
        // Don't throw here - just log
      });

      // Attempt connection with 10-second timeout
      await this.redisClient.connect();

      // Test connection with PING
      await this.redisClient.ping();

      this.storage = new RedisStorage(this.redisClient);
      this.isDegraded = false;
      console.log('✓ Connected to Redis');

    } catch (err) {
      console.warn('⚠️  Redis connection failed, falling back to in-memory storage:', err);
      this.storage = new MemoryStorage();
      this.isDegraded = true;
    }
  }

  getStorage(): SessionStorage {
    return this.storage;
  }

  isDegradedMode(): boolean {
    return this.isDegraded;
  }

  isRedisHealthy(): boolean {
    return this.redisClient?.isReady ?? false;
  }
}

export const storageFactory = new SessionStorageFactory();
```

### Pattern 3: SessionManager Migration (Sync to Async)

**What:** Convert SessionManager methods from synchronous Map operations to async storage calls

**When to use:** When migrating from in-memory to Redis storage

**Example:**
```typescript
// Source: Adapted from existing sessionService.ts
export class SessionManager {
  private storage: SessionStorage;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(storage: SessionStorage) {
    this.storage = storage;

    // Only start cleanup for memory storage (Redis uses TTL)
    if (storage instanceof MemoryStorage) {
      this.cleanupInterval = setInterval(() => {
        this.storage.cleanup().catch(err =>
          console.error('Cleanup error:', err)
        );
      }, 5 * 60 * 1000);
    }
  }

  async createSession(userId: string | number, questions: Question[]): Promise<string> {
    const sessionId = randomUUID();
    const now = new Date();

    const session: GameSession = {
      sessionId,
      userId,
      questions,
      answers: [],
      createdAt: now,
      lastActivityTime: now,
      progressionAwarded: false
    };

    await this.storage.set(sessionId, session, 3600); // 1 hour TTL
    return sessionId;
  }

  async getSession(sessionId: string): Promise<GameSession | null> {
    const session = await this.storage.get(sessionId);
    if (session) {
      // Update lastActivityTime and re-save with fresh TTL
      session.lastActivityTime = new Date();
      await this.storage.set(sessionId, session, 3600);
    }
    return session;
  }

  async submitAnswer(
    sessionId: string,
    questionId: string,
    selectedOption: number | null,
    timeRemaining: number,
    wager?: number
  ): Promise<ServerAnswer> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Invalid or expired session');
    }

    // ... existing validation and scoring logic ...

    // Store updated session
    await this.storage.set(sessionId, session, 3600);

    return answer;
  }
}
```

### Pattern 4: Health Check Endpoint

**What:** Expose Redis connection status and session metrics for monitoring

**When to use:** Production deployments with load balancers and monitoring dashboards

**Example:**
```typescript
// Source: Derived from health check patterns and Redis monitoring best practices
import { Router } from 'express';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    storage: {
      type: storageFactory.isDegradedMode() ? 'memory' : 'redis',
      healthy: storageFactory.isRedisHealthy(),
      sessionCount: await sessionManager.getStorage().count()
    }
  };

  // Return 503 if Redis is expected but down
  const expectedRedis = !!process.env.REDIS_URL;
  if (expectedRedis && storageFactory.isDegradedMode()) {
    return res.status(503).json({
      ...health,
      status: 'degraded',
      message: 'Redis unavailable, using fallback storage'
    });
  }

  res.json(health);
});

export default router;
```

### Anti-Patterns to Avoid

- **Mixing sync and async storage access:** Don't keep old synchronous methods alongside new async ones. Convert all storage operations to async to prevent race conditions
- **Forgetting to update TTL on access:** Session TTL must be refreshed on each access (getSession) to keep active sessions alive
- **Using KEYS in production:** Pattern 3 count() example uses KEYS for simplicity, but in production use SCAN cursor or track count in a separate Redis key
- **Not handling JSON serialization of Dates:** Date objects become strings in JSON. Always deserialize `createdAt` and `lastActivityTime` back to Date objects
- **Setting expiration separately from value:** Use `setEx(key, ttl, value)` not `set()` then `expire()` to avoid race condition where key exists without TTL

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis connection pooling | Custom pool manager | node-redis built-in pool | node-redis handles connection pooling automatically, includes reconnection logic with exponential backoff |
| Session serialization | Custom binary format | JSON.stringify/parse | Sessions contain nested objects and arrays. JSON is standard, debuggable, and sufficient for performance requirements |
| Retry logic | Manual setTimeout loops | node-redis automatic reconnection + Pattern 3 (Retry with Backoff) | Redis client reconnects automatically; use documented retry patterns for specific operations |
| Health monitoring | Custom ping scheduler | On-demand health check in /health endpoint | Load balancers and monitoring tools poll health endpoints; don't add internal polling overhead |
| TTL management | Manual setInterval cleanup | Redis native TTL (SETEX command) | Redis TTL is atomic, reliable, and doesn't require process memory for tracking |

**Key insight:** Redis is mature infrastructure with edge cases already solved. The official node-redis client and documented patterns handle connection management, serialization, and expiration better than custom implementations. Focus effort on application logic (storage abstraction, graceful degradation) rather than reimplementing Redis features.

## Common Pitfalls

### Pitfall 1: Memory Limit Exhaustion (Session Eviction)

**What goes wrong:** Redis reaches maxmemory limit and starts evicting keys, causing active sessions to disappear randomly. Users get logged out mid-game.

**Why it happens:** Redis default eviction policy may remove session keys when memory is full. No monitoring alerts when approaching limit.

**How to avoid:**
- Set `maxmemory-policy noeviction` in Redis config to prevent eviction (fail writes instead)
- Monitor Redis memory usage and alert at 70% capacity
- Sessions are short-lived (1 hour) so memory footprint is bounded

**Warning signs:**
- Intermittent "Invalid or expired session" errors
- Redis logs showing evicted keys
- Memory usage approaching maxmemory limit

**Sources:** [Top 10 Redis Mistakes](https://medium.com/@techInFocus/top-10-redis-mistakes-that-are-killing-your-apps-performance-72a7326907c7), [We Replaced PostgreSQL Sessions with Redis](https://blog.devgenius.io/we-replaced-postgresql-sessions-with-redis-api-response-time-went-from-800ms-to-12ms-bf119fdae8db)

### Pitfall 2: Forgetting Date Deserialization

**What goes wrong:** After retrieving session from Redis, `session.createdAt` is a string instead of Date object. Code calling `session.lastActivityTime.getTime()` crashes with "getTime is not a function."

**Why it happens:** JSON.stringify converts Date objects to ISO strings. JSON.parse doesn't automatically reconstruct Date objects.

**How to avoid:** Always deserialize Date fields explicitly after JSON.parse:
```typescript
const parsed = JSON.parse(data);
parsed.createdAt = new Date(parsed.createdAt);
parsed.lastActivityTime = new Date(parsed.lastActivityTime);
return parsed;
```

**Warning signs:**
- TypeError: X.getTime is not a function
- Date comparison logic failing
- Serialized dates appearing as strings in logs

### Pitfall 3: SETEX Ordering Mistake

**What goes wrong:** Calling `client.setEx(key, value, ttl)` results in cryptic Redis error. API expects `(key, ttl, value)` order.

**Why it happens:** Different Redis clients have different parameter orders. node-redis uses `(key, seconds, value)`.

**How to avoid:**
- Always check official docs for parameter order
- Use TypeScript which will show type error for wrong parameter order
- node-redis signature: `setEx(key: string, seconds: number, value: string)`

**Warning signs:**
- Redis errors about invalid TTL value
- TypeScript errors when passing parameters in wrong order

**Sources:** [node-redis documentation](https://redis.io/docs/latest/develop/clients/nodejs/)

### Pitfall 4: Missing Error Event Listener

**What goes wrong:** Redis connection error occurs, no error listener is registered, Node.js process crashes with uncaught exception.

**Why it happens:** node-redis emits 'error' events on connection issues. Without a listener, these become unhandled errors that crash the process.

**How to avoid:** ALWAYS register error listener before connecting:
```typescript
const client = createClient({ url: redisUrl });
client.on('error', (err) => {
  console.error('Redis client error:', err);
  // Log, don't throw - let graceful degradation handle it
});
await client.connect();
```

**Warning signs:**
- Process exits with "Unhandled error event" when Redis connection fails
- No error logs before process crash

**Sources:** [node-redis error handling](https://redis.io/docs/latest/develop/clients/nodejs/error-handling/), [Production usage docs](https://redis.io/docs/latest/develop/clients/nodejs/produsage/)

### Pitfall 5: TTL Race Condition (SET then EXPIRE)

**What goes wrong:** Call `SET key value` then `EXPIRE key 3600` separately. Between these commands, server crashes. Key exists in Redis without expiration, leaking memory.

**Why it happens:** Two separate commands create a window where key exists without TTL. Not atomic.

**How to avoid:** Use `SETEX` which combines SET + EXPIRE atomically:
```typescript
// Bad: Two commands, not atomic
await client.set(`session:${id}`, data);
await client.expire(`session:${id}`, 3600); // May never execute

// Good: Atomic operation
await client.setEx(`session:${id}`, 3600, data);
```

**Warning signs:**
- Keys without TTL showing up in Redis (check with `TTL key` returning -1)
- Memory usage growing over time despite expecting expiration
- Session count not decreasing as expected

**Sources:** [How to Build Session Storage with Redis](https://oneuptime.com/blog/post/2026-01-28-session-storage-redis/view), [Redis caching strategies](https://miracl.in/blog/redis-caching-strategies-2026/)

### Pitfall 6: No Persistence in Development Docker

**What goes wrong:** Start Redis in Docker for testing, add sessions, restart container, all sessions gone. Can't test session persistence.

**Why it happens:** Default Redis Docker container has no volume mount. Data only lives in container's ephemeral filesystem.

**How to avoid:**
```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7.4-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  redis-data:
```

**Warning signs:**
- Sessions disappear after Docker restart
- Can't reproduce "persist across restart" requirement

**Sources:** [Docker Redis configuration](https://hub.docker.com/_/redis), [Running Redis with Persistence](https://medium.com/neural-engineer/running-redis-with-persistence-1f1819904bed)

## Code Examples

Verified patterns from official sources:

### Basic Connection and Error Handling
```typescript
// Source: https://redis.io/docs/latest/develop/clients/nodejs/
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Critical: Register error handler first
client.on('error', (err) => console.error('Redis Client Error', err));

await client.connect();

// Verify connection
const pong = await client.ping();
console.log('Redis connected:', pong); // "PONG"
```

### Storing Session with TTL
```typescript
// Source: https://redis.io/docs/latest/develop/clients/nodejs/
import { GameSession } from './sessionService.js';

// Store session with 1-hour expiration (atomic)
const session: GameSession = { /* ... */ };
await client.setEx(
  `session:${sessionId}`,
  3600, // seconds
  JSON.stringify(session)
);

// Retrieve session
const data = await client.get(`session:${sessionId}`);
if (data) {
  const session = JSON.parse(data);
  // Don't forget to deserialize dates
  session.createdAt = new Date(session.createdAt);
  session.lastActivityTime = new Date(session.lastActivityTime);
}
```

### Graceful Degradation Pattern
```typescript
// Source: https://redis.io/docs/latest/develop/clients/nodejs/error-handling/
async function getSessionSafe(sessionId: string): Promise<GameSession | null> {
  try {
    const data = await redisClient.get(`session:${sessionId}`);
    if (!data) return null;
    return deserializeSession(data);
  } catch (err) {
    // Pattern 2: Graceful degradation on connection errors
    if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err.code)) {
      console.warn('Redis unavailable, falling back to memory storage');
      return memoryStorage.get(sessionId);
    }
    throw err; // Re-throw non-connection errors
  }
}
```

### Connection Configuration with Timeout
```typescript
// Source: https://redis.io/docs/latest/develop/clients/nodejs/produsage/
const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 10000, // 10 seconds
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis reconnection failed after 10 attempts');
        return new Error('Max reconnection attempts reached');
      }
      // Exponential backoff: 50ms, 100ms, 200ms, 400ms, ...
      return Math.min(retries * 50, 3000);
    }
  }
});
```

### Docker Compose Configuration
```yaml
# Source: https://redis.io/tutorials/operate/orchestration/docker/
version: '3.8'

services:
  redis:
    image: redis:7.4-alpine
    container_name: gameshow-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy noeviction
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
    driver: local
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| express-session + connect-redis | Custom session management with Redis | Not a migration - different patterns | express-session is for cookie-based sessions. This project uses explicit sessionIds passed by client, requiring custom storage abstraction |
| ioredis | node-redis | 2023-2024 | node-redis became official Redis client, added RESP3, auto-pipelining, better TypeScript support. ioredis still valid for advanced clustering needs |
| @types/redis (separate) | Built-in TypeScript | node-redis v4+ (2021) | No separate @types package needed, TypeScript definitions included |
| set() then expire() | setEx() atomic operation | Always recommended, emphasized in 2025+ docs | Prevents TTL race condition, reduces network round-trip |
| redis.createClient() | createClient() from 'redis' | node-redis v4+ (2021) | Modern ESM import style, better tree-shaking |

**Deprecated/outdated:**
- **node_redis (v3 API):** Old callback-based API. node-redis v4+ uses promises/async-await exclusively
- **RedisJSON for simple storage:** RedisJSON (@redis/json) is for advanced partial updates and querying. For simple get/set session storage, plain JSON.stringify is current best practice
- **Manual connection pooling:** node-redis v4+ handles pooling internally. Custom pool implementations are unnecessary

## Open Questions

Things that couldn't be fully resolved:

1. **Redis Cloud/managed service latency**
   - What we know: Local Redis is <5ms. Managed services (AWS ElastiCache, Redis Cloud) add network latency
   - What's unclear: Whether managed Redis will meet sub-5ms requirement (success criteria #4)
   - Recommendation: Plan for success criteria validation after deployment. Local testing will meet requirement but production latency TBD until hosting decided

2. **Session count tracking at scale**
   - What we know: `KEYS session:*` works for counting sessions but doesn't scale (blocks Redis on large datasets)
   - What's unclear: Whether to implement counter tracking (INCR/DECR on session create/delete) or accept KEYS limitation
   - Recommendation: Start with KEYS for /health endpoint. If session count grows beyond ~10K, migrate to counter-based tracking in separate task

3. **Graceful degradation UI indicator implementation**
   - What we know: User should see subtle banner when in degraded mode (from CONTEXT decisions)
   - What's unclear: How frontend detects degraded mode (poll /health? include in game API response?)
   - Recommendation: Include degraded flag in session API responses (`/api/game/session` and `/api/game/answer`). Frontend checks this flag rather than polling separate endpoint

## Sources

### Primary (HIGH confidence)
- [Redis official Node.js documentation](https://redis.io/docs/latest/develop/clients/nodejs/) - Installation, basic usage, connection patterns
- [node-redis GitHub repository](https://github.com/redis/node-redis) - Official client features, TypeScript support
- [node-redis error handling documentation](https://redis.io/docs/latest/develop/clients/nodejs/error-handling/) - Four error handling patterns, reconnection behavior
- [node-redis production usage documentation](https://redis.io/docs/latest/develop/clients/nodejs/produsage/) - Timeout configuration, reconnection strategies
- [Redis Docker official image](https://hub.docker.com/_/redis) - Container configuration, persistence setup

### Secondary (MEDIUM confidence)
- [How to Build Session Storage with Redis (2026-01-28)](https://oneuptime.com/blog/post/2026-01-28-session-storage-redis/view) - Session storage patterns, SETEX usage
- [Redis and Node.js with TypeScript: A Complete Guide](https://medium.com/@erickzanetti/redis-and-node-js-with-typescript-a-complete-guide-2bac6e300497) - TypeScript integration examples
- [Reliable Redis Connections in Node.js](https://medium.com/@backendwithali/reliable-redis-connections-in-node-js-lazy-loading-retry-logic-circuit-breakers-5d8597bbc62c) - Circuit breaker patterns, retry logic
- [We Replaced PostgreSQL Sessions with Redis](https://blog.devgenius.io/we-replaced-postgresql-sessions-with-redis-api-response-time-went-from-800ms-to-12ms-bf119fdae8db) - Real-world migration experience, pitfalls

### Tertiary (LOW confidence)
- [Migrate from ioredis documentation](https://redis.io/docs/latest/develop/clients/nodejs/migration/) - Referenced but not fully verified
- [Top 10 Redis Mistakes](https://medium.com/@techInFocus/top-10-redis-mistakes-that-are-killing-your-apps-performance-72a7326907c7) - Community wisdom, not official source
- npm package search results for version numbers - Marked as 5.10.0 but couldn't verify npm page directly (403 error)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - node-redis is officially documented as recommended client, version verified through GitHub releases
- Architecture patterns: HIGH - Patterns derived from official Redis documentation and verified real-world implementations
- Pitfalls: MEDIUM-HIGH - Mix of official documentation (error handling, SETEX) and community experience (memory limits, eviction)
- Production deployment: MEDIUM - Local Docker setup is clear, managed service latency is unclear until hosting provider chosen

**Research date:** 2026-02-13
**Valid until:** 2026-03-31 (45 days) - Redis is stable infrastructure with slow-moving APIs, but node-redis is actively maintained with quarterly releases

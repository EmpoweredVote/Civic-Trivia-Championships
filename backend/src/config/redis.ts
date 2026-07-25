/**
 * Redis client configuration with graceful degradation
 * Provides SessionStorageFactory for Redis or in-memory fallback
 */

import { createClient, RedisClientType } from 'redis';
import { SessionStorage } from '../services/storage/SessionStorage.js';
import { MemoryStorage } from '../services/storage/MemoryStorage.js';
import { RedisStorage } from '../services/storage/RedisStorage.js';

export class SessionStorageFactory {
  private storage: SessionStorage | null = null;
  private degraded: boolean = false;
  private redisClient: RedisClientType<any, any, any> | null = null;

  /**
   * Initialize storage backend based on REDIS_URL environment variable
   * Falls back to MemoryStorage if Redis unavailable
   */
  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    // No REDIS_URL - use in-memory storage
    if (!redisUrl) {
      console.log('⚠️  REDIS_URL not set, using in-memory storage');
      this.storage = new MemoryStorage();
      this.degraded = true;
      return;
    }

    // REDIS_URL present - attempt Redis connection
    try {
      // Create Redis client with socket config and reconnect strategy
      const client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000, // 10s connection timeout
          reconnectStrategy: (retries: number) => {
            // Stop after 10 retries
            if (retries >= 10) {
              console.error('❌ Redis reconnection failed after 10 attempts');
              return new Error('Max reconnection attempts reached');
            }

            // Exponential backoff: 50ms * 2^retries, capped at 3s
            const delay = Math.min(50 * Math.pow(2, retries), 3000);
            console.log(`🔄 Reconnecting to Redis (attempt ${retries + 1}/10, delay: ${delay}ms)`);
            return delay;
          }
        }
      });

      // Register error handler BEFORE connecting (critical - prevents process crash)
      client.on('error', (err) => {
        console.error('❌ Redis client error:', err);
      });

      // Handle permanent disconnection (after reconnect strategy exhausts retries)
      client.on('end', () => {
        if (!this.degraded) {
          console.warn('⚠️  Redis permanently disconnected — switching to in-memory fallback');
          this.degraded = true;
          this.storage = new MemoryStorage();
        }
      });

      // Connect to Redis
      await client.connect();

      // Verify connection with PING
      const pingResult = await client.ping();
      if (pingResult !== 'PONG') {
        throw new Error('Redis PING test failed');
      }

      // Success - create RedisStorage
      this.redisClient = client;
      this.storage = new RedisStorage(client);
      this.degraded = false;
      console.log('✅ Connected to Redis');

    } catch (err) {
      // Connection failed - fall back to MemoryStorage
      console.warn('⚠️  Redis connection failed, falling back to in-memory storage:', err);

      // Clean up failed client if exists
      if (this.redisClient) {
        try {
          await this.redisClient.disconnect();
        } catch (disconnectErr) {
          // Ignore disconnect errors
        }
        this.redisClient = null;
      }

      this.storage = new MemoryStorage();
      this.degraded = true;
    }
  }

  /**
   * Get the initialized storage backend
   * @returns SessionStorage instance
   * @throws Error if not initialized
   */
  getStorage(): SessionStorage {
    if (!this.storage) {
      throw new Error('StorageFactory not initialized - call initialize() first');
    }
    return this.storage;
  }

  /**
   * Check if storage is in degraded mode (using MemoryStorage instead of Redis)
   * @returns True if degraded (MemoryStorage), false if Redis
   */
  isDegradedMode(): boolean {
    return this.degraded;
  }

  /**
   * Check if Redis connection is healthy
   * Reads the client's local `isReady` state — issues no Redis command, so this
   * is safe to call from high-frequency probes like /health.
   * @returns True if Redis connected, false if degraded or not initialized
   */
  isRedisHealthy(): boolean {
    return !this.degraded && this.redisClient !== null && this.redisClient.isReady === true;
  }

  /**
   * Get the raw Redis client for direct Redis operations (e.g. rate limiting INCR/TTL)
   * Returns null if storage is in degraded (MemoryStorage) mode
   */
  getRawClient(): RedisClientType<any, any, any> | null {
    return this.redisClient;
  }

  /**
   * Shutdown storage backend (disconnect Redis if connected)
   */
  async shutdown(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.disconnect();
        console.log('✅ Redis client disconnected');
      } catch (err) {
        console.error('❌ Error disconnecting Redis client:', err);
      }
      this.redisClient = null;
    }
    this.storage = null;
  }
}

// Export singleton instance
export const storageFactory = new SessionStorageFactory();

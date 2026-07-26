/**
 * RedisStorage - Redis-backed session storage
 * Implements SessionStorage with JSON serialization and atomic TTL
 */

import { RedisClientType } from 'redis';
import { GameSession } from '../sessionService.js';
import { SessionStorage } from './SessionStorage.js';

export class RedisStorage implements SessionStorage {
  private client: RedisClientType<any, any, any>;

  constructor(client: RedisClientType<any, any, any>) {
    this.client = client;
  }

  /**
   * Generate Redis key for session ID
   * @param sessionId - Session ID
   * @returns Redis key
   */
  private getKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Retrieve a session by ID
   * Deserializes Date fields after JSON parsing
   * @param sessionId - Session ID to retrieve
   * @returns Session or null if not found
   */
  async get(sessionId: string): Promise<GameSession | null> {
    const key = this.getKey(sessionId);
    const data = await this.client.get(key);

    if (!data) {
      return null;
    }

    // Parse JSON and deserialize Date fields
    const session = JSON.parse(data);
    session.createdAt = new Date(session.createdAt);
    session.lastActivityTime = new Date(session.lastActivityTime);

    return session;
  }

  /**
   * Retrieve a session and refresh its TTL in one command.
   *
   * GETEX does both in a single round-trip, halving the billed Upstash commands
   * on the hottest path. lastActivityTime is deliberately not rewritten here:
   * on Redis, expiry is driven by the key's TTL, and nothing reads that field
   * (only MemoryStorage.cleanup() does). Paying a second command to update it
   * would be pure waste.
   *
   * @param sessionId - Session ID
   * @param ttlSeconds - TTL to reset on the key
   * @returns Session or null if not found
   */
  async getAndRefresh(sessionId: string, ttlSeconds: number): Promise<GameSession | null> {
    const key = this.getKey(sessionId);
    const data = await this.client.getEx(key, { EX: ttlSeconds });

    if (!data) {
      return null;
    }

    const session = JSON.parse(data);
    session.createdAt = new Date(session.createdAt);
    session.lastActivityTime = new Date(session.lastActivityTime);

    return session;
  }

  /**
   * Store a session with TTL
   * Uses SETEX for atomic set+TTL (no race condition)
   * @param sessionId - Session ID
   * @param session - Session data
   * @param ttlSeconds - Time to live in seconds
   */
  async set(sessionId: string, session: GameSession, ttlSeconds: number): Promise<void> {
    const key = this.getKey(sessionId);
    const serialized = JSON.stringify(session);

    // SETEX is atomic - set value and expiration in one operation
    await this.client.setEx(key, ttlSeconds, serialized);
  }

  /**
   * Delete a session
   * @param sessionId - Session ID to delete
   */
  async delete(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    await this.client.del(key);
  }

  /**
   * Count total sessions in storage
   * Uses KEYS pattern (acceptable for MVP - SCAN optimization deferred)
   *
   * COST WARNING: each call bills one Upstash command and is O(N) over the
   * keyspace. Do NOT call this on any path a monitor can poll — a per-request
   * count() on /health consumed the entire 500k/month free tier in July 2026.
   * Diagnostics only.
   *
   * @returns Number of sessions
   */
  async count(): Promise<number> {
    const keys = await this.client.keys('session:*');
    return keys.length;
  }

  /**
   * Cleanup expired sessions
   * No-op for Redis - TTL handles expiration automatically
   */
  async cleanup(): Promise<void> {
    // Redis handles expiration via TTL - no manual cleanup needed
  }
}

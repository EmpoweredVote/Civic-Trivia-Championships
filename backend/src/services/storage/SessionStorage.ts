/**
 * SessionStorage interface
 * Async storage contract for game sessions
 */

import { GameSession } from '../sessionService.js';

export interface SessionStorage {
  /**
   * Retrieve a session by ID
   * @param sessionId - Session ID to retrieve
   * @returns Session or null if not found
   */
  get(sessionId: string): Promise<GameSession | null>;

  /**
   * Retrieve a session and refresh its expiry in a single operation.
   *
   * Exists so the hot read path costs one backend round-trip instead of two.
   * The naive get()-then-set() pattern spent a second Upstash command purely to
   * persist lastActivityTime, which only MemoryStorage.cleanup() ever reads.
   *
   * @param sessionId - Session ID to retrieve
   * @param ttlSeconds - Expiry to reset on the session
   * @returns Session or null if not found
   */
  getAndRefresh(sessionId: string, ttlSeconds: number): Promise<GameSession | null>;

  /**
   * Store a session with TTL
   * @param sessionId - Session ID
   * @param session - Session data
   * @param ttlSeconds - Time to live in seconds
   */
  set(sessionId: string, session: GameSession, ttlSeconds: number): Promise<void>;

  /**
   * Delete a session
   * @param sessionId - Session ID to delete
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Count total sessions in storage
   * @returns Number of sessions
   */
  count(): Promise<number>;

  /**
   * Cleanup expired sessions
   * Implementation-specific (manual for memory, no-op for Redis)
   */
  cleanup(): Promise<void>;
}

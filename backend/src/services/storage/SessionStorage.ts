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

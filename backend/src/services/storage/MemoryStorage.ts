/**
 * MemoryStorage - In-memory Map-based session storage
 * Implements SessionStorage with manual TTL cleanup
 */

import { GameSession } from '../sessionService.js';
import { SessionStorage } from './SessionStorage.js';

const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export class MemoryStorage implements SessionStorage {
  private sessions: Map<string, GameSession>;

  constructor() {
    this.sessions = new Map();
  }

  /**
   * Retrieve a session by ID
   * @param sessionId - Session ID to retrieve
   * @returns Session or null if not found
   */
  async get(sessionId: string): Promise<GameSession | null> {
    const session = this.sessions.get(sessionId);
    return session || null;
  }

  /**
   * Store a session with TTL
   * TTL is not enforced at write time - cleanup() handles expiration
   * @param sessionId - Session ID
   * @param session - Session data
   * @param ttlSeconds - Time to live in seconds (unused, kept for interface compatibility)
   */
  async set(sessionId: string, session: GameSession, ttlSeconds: number): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  /**
   * Delete a session
   * @param sessionId - Session ID to delete
   */
  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  /**
   * Count total sessions in storage
   * @returns Number of sessions
   */
  async count(): Promise<number> {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions
   * Removes sessions where lastActivityTime is older than 1 hour
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceActivity = now.getTime() - session.lastActivityTime.getTime();
      if (timeSinceActivity > SESSION_EXPIRY_MS) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired session(s) from memory`);
    }
  }
}

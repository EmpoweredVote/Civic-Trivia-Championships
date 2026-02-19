import { pool } from '../config/database.js';

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  totalXp: number;
  totalGems: number;
  gamesPlayed: number;
  bestScore: number;
  totalCorrect: number;
  totalQuestions: number;
  avatarUrl: string | null;
  timerMultiplier: number;
  isAdmin: boolean;
}

export interface UserProfileStats {
  totalXp: number;
  totalGems: number;
  gamesPlayed: number;
  bestScore: number;
  totalCorrect: number;
  totalQuestions: number;
  avatarUrl: string | null;
  timerMultiplier: number;
  isAdmin: boolean;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

export const User = {
  /**
   * Find a user by email address
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query<User>(
      `SELECT id, email, password_hash as "passwordHash", name,
              created_at as "createdAt", updated_at as "updatedAt",
              total_xp as "totalXp", total_gems as "totalGems",
              games_played as "gamesPlayed", best_score as "bestScore",
              total_correct as "totalCorrect", total_questions as "totalQuestions",
              avatar_url as "avatarUrl", timer_multiplier as "timerMultiplier",
              is_admin as "isAdmin"
       FROM users
       WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  },

  /**
   * Find a user by ID
   */
  async findById(id: number): Promise<User | null> {
    const result = await pool.query<User>(
      `SELECT id, email, password_hash as "passwordHash", name,
              created_at as "createdAt", updated_at as "updatedAt",
              total_xp as "totalXp", total_gems as "totalGems",
              games_played as "gamesPlayed", best_score as "bestScore",
              total_correct as "totalCorrect", total_questions as "totalQuestions",
              avatar_url as "avatarUrl", timer_multiplier as "timerMultiplier",
              is_admin as "isAdmin"
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new user
   */
  async create(data: CreateUserData): Promise<User> {
    const result = await pool.query<User>(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash as "passwordHash", name,
                 created_at as "createdAt", updated_at as "updatedAt",
                 total_xp as "totalXp", total_gems as "totalGems",
                 games_played as "gamesPlayed", best_score as "bestScore",
                 total_correct as "totalCorrect", total_questions as "totalQuestions",
                 avatar_url as "avatarUrl"`,
      [data.email, data.passwordHash, data.name]
    );
    return result.rows[0];
  },

  /**
   * Get profile stats for a user
   */
  async getProfileStats(id: number): Promise<UserProfileStats | null> {
    const result = await pool.query<UserProfileStats>(
      `SELECT total_xp as "totalXp", total_gems as "totalGems",
              games_played as "gamesPlayed", best_score as "bestScore",
              total_correct as "totalCorrect", total_questions as "totalQuestions",
              avatar_url as "avatarUrl", timer_multiplier as "timerMultiplier",
              is_admin as "isAdmin"
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Update user stats atomically after game completion
   */
  async updateStats(
    id: number,
    xpToAdd: number,
    gemsToAdd: number,
    score: number,
    correctAnswers: number,
    totalQuestions: number
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE users SET
           total_xp = total_xp + $1,
           total_gems = total_gems + $2,
           games_played = games_played + 1,
           best_score = GREATEST(best_score, $3),
           total_correct = total_correct + $4,
           total_questions = total_questions + $5
         WHERE id = $6`,
        [xpToAdd, gemsToAdd, score, correctAnswers, totalQuestions, id]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Update user avatar URL
   */
  async updateAvatarUrl(id: number, avatarUrl: string): Promise<void> {
    await pool.query(
      `UPDATE users SET avatar_url = $1 WHERE id = $2`,
      [avatarUrl, id]
    );
  },

  /**
   * Update user timer multiplier setting
   */
  async updateTimerMultiplier(id: number, multiplier: number): Promise<void> {
    const validMultipliers = [1.0, 1.5, 2.0];
    if (!validMultipliers.includes(multiplier)) {
      throw new Error('Invalid timer multiplier. Must be 1.0, 1.5, or 2.0');
    }

    await pool.query(
      `UPDATE users SET timer_multiplier = $1 WHERE id = $2`,
      [multiplier, id]
    );
  }
};

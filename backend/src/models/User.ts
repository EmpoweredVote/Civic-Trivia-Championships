import { pool } from '../config/database.js';

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
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
              created_at as "createdAt", updated_at as "updatedAt"
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
              created_at as "createdAt", updated_at as "updatedAt"
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
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [data.email, data.passwordHash, data.name]
    );
    return result.rows[0];
  }
};

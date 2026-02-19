import { pool } from '../config/database.js';

/**
 * Run pending schema migrations on startup.
 * Uses IF NOT EXISTS / IF NOT EXISTS so it's safe to run repeatedly.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Phase 16: Add expiration system columns
    await client.query(`
      ALTER TABLE civic_trivia.questions
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    `);
    await client.query(`
      ALTER TABLE civic_trivia.questions
        ADD COLUMN IF NOT EXISTS expiration_history JSONB DEFAULT '[]';
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_status
        ON civic_trivia.questions (status);
    `);
    console.log('Database migrations complete');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

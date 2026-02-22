import 'dotenv/config';
import { pool } from '../config/database.js';

/**
 * Migration: Add question_flags table and flag_count column
 * This enables question flagging feature for Phase 27.
 */
async function migrateQuestionFlags() {
  const client = await pool.connect();
  try {
    console.log('Starting question flags migration...');

    // Set search path to civic_trivia schema
    await client.query('SET search_path TO civic_trivia, public');

    // Transaction for atomic migration
    await client.query('BEGIN');

    // 1. Add flag_count column to questions table
    await client.query(`
      ALTER TABLE civic_trivia.questions
      ADD COLUMN IF NOT EXISTS flag_count INTEGER NOT NULL DEFAULT 0;
    `);
    console.log('✓ flag_count column added to questions table');

    // 2. Create index on flag_count
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_questions_flag_count
      ON civic_trivia.questions(flag_count);
    `);
    console.log('✓ flag_count index created');

    // 3. Create question_flags table
    await client.query(`
      CREATE TABLE IF NOT EXISTS civic_trivia.question_flags (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        question_id INTEGER NOT NULL REFERENCES civic_trivia.questions(id),
        session_id TEXT NOT NULL,
        reasons JSONB,
        elaboration_text TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, question_id)
      );
    `);
    console.log('✓ question_flags table created');

    // 4. Create indexes on question_flags
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_question_flags_user
      ON civic_trivia.question_flags(user_id);
    `);
    console.log('✓ user_id index created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_question_flags_question
      ON civic_trivia.question_flags(question_id);
    `);
    console.log('✓ question_id index created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_question_flags_created_at
      ON civic_trivia.question_flags(created_at);
    `);
    console.log('✓ created_at index created');

    // Commit transaction
    await client.query('COMMIT');

    // Verify table exists and count columns
    const tableCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='civic_trivia' AND table_name='question_flags'
      ORDER BY ordinal_position;
    `);
    console.log(`\n✓ question_flags table has ${tableCheck.rows.length} columns`);

    const flagCountCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='civic_trivia' AND table_name='questions' AND column_name='flag_count';
    `);
    console.log(`✓ flag_count column exists: ${flagCountCheck.rows.length > 0}`);

    console.log('\nMigration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateQuestionFlags().catch((error) => {
  console.error('Fatal migration error:', error);
  process.exit(1);
});

import '../env.js';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

async function migrateQualityScore() {
  try {
    console.log('Adding quality_score column to questions table...');

    await db.execute(sql`
      ALTER TABLE civic_trivia.questions
      ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT NULL
    `);

    console.log('Creating index on quality_score...');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_questions_quality_score
      ON civic_trivia.questions(quality_score DESC NULLS LAST)
    `);

    console.log('Quality score column and index added successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateQualityScore();

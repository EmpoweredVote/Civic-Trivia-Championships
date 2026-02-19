import '../env.js';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

async function migrateTelemetry() {
  console.log('Adding telemetry columns to questions table...');
  await db.execute(sql`
    ALTER TABLE civic_trivia.questions
    ADD COLUMN IF NOT EXISTS encounter_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS correct_count INTEGER NOT NULL DEFAULT 0
  `);
  console.log('Telemetry columns added successfully.');
  process.exit(0);
}

migrateTelemetry().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

/**
 * migrate-to-shared-supabase.ts
 * Phase 40-02: Migrate content data from civic_trivia (source) to trivia (target)
 *
 * Source: SOURCE_DATABASE_URL  — current EV-Backend-Dev Supabase, civic_trivia schema
 * Target: Supabase Management API /database/query endpoint (project kxsdzaojfaibhuzmclfq)
 *         using SUPABASE_ACCESS_TOKEN for auth (bypasses need for direct DB password)
 *
 * Tables migrated (in FK-dependency order):
 *   1. topics
 *   2. collections
 *   3. election_races
 *   4. questions
 *   5. collection_topics
 *   6. collection_questions
 *
 * Tables NOT migrated (by design):
 *   - question_flags  (integer user_id incompatible with UUID FK; start fresh)
 *   - player_stats    (new table, starts empty)
 *   - player_prefs    (new table, starts empty)
 *
 * Usage:
 *   cd backend && SOURCE_DATABASE_URL="..." SUPABASE_ACCESS_TOKEN="..." \
 *     SUPABASE_PROJECT_REF="kxsdzaojfaibhuzmclfq" npx tsx src/scripts/migrate-to-shared-supabase.ts
 */

import pg from 'pg';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ============================================================
// Config / env validation
// ============================================================

const SOURCE_DATABASE_URL =
  process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || 'kxsdzaojfaibhuzmclfq';

if (!SOURCE_DATABASE_URL) {
  console.error(
    'ERROR: SOURCE_DATABASE_URL (or DATABASE_URL) must be set.\n' +
      '  Set SOURCE_DATABASE_URL to the civic_trivia source database connection string.'
  );
  process.exit(1);
}

if (!SUPABASE_ACCESS_TOKEN) {
  console.error(
    'ERROR: SUPABASE_ACCESS_TOKEN must be set.\n' +
      '  Provide a Supabase Personal Access Token with project access.'
  );
  process.exit(1);
}

console.log('=================================================');
console.log('Phase 40-02: Content Data Migration');
console.log('=================================================');
console.log(`Source DB:  ${SOURCE_DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
console.log(`Target:     Supabase project ${SUPABASE_PROJECT_REF} (trivia schema)`);
console.log(`Token:      ${SUPABASE_ACCESS_TOKEN.slice(0, 12)}...`);
console.log('=================================================\n');

const BATCH_SIZE = 200; // Conservative batch size for Management API queries
const TARGET_API_URL = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`;

// ============================================================
// Helpers
// ============================================================

/** Execute SQL on the target database via Supabase Management API */
async function targetQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const url = new URL(TARGET_API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Management API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
            return;
          }
          // The API returns an array of rows, or an object with error info
          if (Array.isArray(parsed)) {
            resolve(parsed as T[]);
          } else if (parsed && typeof parsed === 'object' && 'message' in parsed) {
            reject(new Error(`Management API error: ${JSON.stringify(parsed)}`));
          } else {
            resolve([parsed] as T[]);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Escape a value for SQL literal insertion.
 *
 * JSONB values use dollar-quoting ($$...$$) to avoid double-escape issues that occur
 * when JSON strings contain backslash sequences (e.g. markdown with \\\" in learning_content).
 * Dollar-quoting is supported by PostgreSQL 8.0+ and requires no escaping of the content.
 * We use a unique tag $JVAL$ to avoid conflicts with content that contains $$.
 */
function sqlLiteral(val: unknown): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (typeof val === 'number') {
    return String(val);
  }
  if (typeof val === 'string') {
    // Escape single quotes only (no backslash doubling needed in standard_conforming_strings mode)
    return `'${val.replace(/'/g, "''")}'`;
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (typeof val === 'object') {
    // JSONB — use dollar-quoting to avoid all escaping issues with embedded backslashes/quotes
    const json = JSON.stringify(val);
    // Use a unique dollar-quote tag to avoid conflicts
    return `$JVAL$${json}$JVAL$::jsonb`;
  }
  return `'${String(val)}'`;
}

// ============================================================
// Migration functions per table
// ============================================================

interface MigrationResult {
  table: string;
  sourceCount: number;
  insertedCount: number;
  targetCount: number;
  match: boolean;
}

/** Migrate trivia.topics */
async function migrateTopics(sourcePool: pg.Pool): Promise<MigrationResult> {
  console.log('\n--- Migrating: topics ---');

  const { rows } = await sourcePool.query<{
    id: number; name: string; slug: string;
    description: string | null; created_at: Date;
  }>('SELECT * FROM civic_trivia.topics ORDER BY id');

  console.log(`  Source rows: ${rows.length}`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(r =>
      `(${r.id}, ${sqlLiteral(r.name)}, ${sqlLiteral(r.slug)}, ${sqlLiteral(r.description)}, ${sqlLiteral(r.created_at)})`
    ).join(',\n');

    const sql = `
INSERT INTO trivia.topics (id, name, slug, description, created_at)
VALUES ${values}
ON CONFLICT (id) DO NOTHING;`;
    await targetQuery(sql);
    inserted += batch.length;
    console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: rows ${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)}`);
  }

  // Reset sequence
  await targetQuery(`
SELECT setval(
  pg_get_serial_sequence('trivia.topics', 'id'),
  (SELECT COALESCE(MAX(id), 0) FROM trivia.topics)
);`);
  console.log('  Sequence reset');

  const [countResult] = await targetQuery<{ count: string }>('SELECT COUNT(*) FROM trivia.topics');
  const targetCount = parseInt(countResult.count, 10);

  return {
    table: 'topics',
    sourceCount: rows.length,
    insertedCount: inserted,
    targetCount,
    match: targetCount === rows.length,
  };
}

/** Migrate trivia.collections */
async function migrateCollections(sourcePool: pg.Pool): Promise<MigrationResult> {
  console.log('\n--- Migrating: collections ---');

  const { rows } = await sourcePool.query<{
    id: number; name: string; slug: string; description: string;
    locale_code: string; locale_name: string; icon_identifier: string;
    theme_color: string; is_active: boolean; sort_order: number;
    created_at: Date; updated_at: Date;
  }>('SELECT * FROM civic_trivia.collections ORDER BY id');

  console.log(`  Source rows: ${rows.length}`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(r =>
      `(${r.id}, ${sqlLiteral(r.name)}, ${sqlLiteral(r.slug)}, ${sqlLiteral(r.description)}, ` +
      `${sqlLiteral(r.locale_code)}, ${sqlLiteral(r.locale_name)}, ${sqlLiteral(r.icon_identifier)}, ` +
      `${sqlLiteral(r.theme_color)}, ${sqlLiteral(r.is_active)}, ${r.sort_order}, ` +
      `${sqlLiteral(r.created_at)}, ${sqlLiteral(r.updated_at)})`
    ).join(',\n');

    const sql = `
INSERT INTO trivia.collections
  (id, name, slug, description, locale_code, locale_name, icon_identifier, theme_color, is_active, sort_order, created_at, updated_at)
VALUES ${values}
ON CONFLICT (id) DO NOTHING;`;
    await targetQuery(sql);
    inserted += batch.length;
    console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: rows ${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)}`);
  }

  // Reset sequence
  await targetQuery(`
SELECT setval(
  pg_get_serial_sequence('trivia.collections', 'id'),
  (SELECT COALESCE(MAX(id), 0) FROM trivia.collections)
);`);
  console.log('  Sequence reset');

  const [countResult] = await targetQuery<{ count: string }>('SELECT COUNT(*) FROM trivia.collections');
  const targetCount = parseInt(countResult.count, 10);

  return {
    table: 'collections',
    sourceCount: rows.length,
    insertedCount: inserted,
    targetCount,
    match: targetCount === rows.length,
  };
}

/** Migrate trivia.election_races */
async function migrateElectionRaces(sourcePool: pg.Pool): Promise<MigrationResult> {
  console.log('\n--- Migrating: election_races ---');

  const { rows } = await sourcePool.query<{
    id: number; seat: string; election_type: string; election_date: Date;
    timezone: string; jurisdiction: string; candidates: unknown;
    questions_generated: boolean; followup_generated: boolean;
    result: string | null; created_at: Date;
  }>('SELECT * FROM civic_trivia.election_races ORDER BY id');

  console.log(`  Source rows: ${rows.length}`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(r =>
      `(${r.id}, ${sqlLiteral(r.seat)}, ${sqlLiteral(r.election_type)}, ${sqlLiteral(r.election_date)}, ` +
      `${sqlLiteral(r.timezone)}, ${sqlLiteral(r.jurisdiction)}, ${sqlLiteral(r.candidates)}, ` +
      `${sqlLiteral(r.questions_generated)}, ${sqlLiteral(r.followup_generated)}, ` +
      `${sqlLiteral(r.result)}, ${sqlLiteral(r.created_at)})`
    ).join(',\n');

    const sql = `
INSERT INTO trivia.election_races
  (id, seat, election_type, election_date, timezone, jurisdiction, candidates, questions_generated, followup_generated, result, created_at)
VALUES ${values}
ON CONFLICT (id) DO NOTHING;`;
    await targetQuery(sql);
    inserted += batch.length;
    console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: rows ${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)}`);
  }

  // Reset sequence
  await targetQuery(`
SELECT setval(
  pg_get_serial_sequence('trivia.election_races', 'id'),
  (SELECT COALESCE(MAX(id), 0) FROM trivia.election_races)
);`);
  console.log('  Sequence reset');

  const [countResult] = await targetQuery<{ count: string }>('SELECT COUNT(*) FROM trivia.election_races');
  const targetCount = parseInt(countResult.count, 10);

  return {
    table: 'election_races',
    sourceCount: rows.length,
    insertedCount: inserted,
    targetCount,
    match: targetCount === rows.length,
  };
}

/** Migrate trivia.questions */
async function migrateQuestions(sourcePool: pg.Pool): Promise<MigrationResult> {
  console.log('\n--- Migrating: questions ---');

  const { rows } = await sourcePool.query<{
    id: number; external_id: string; text: string; options: unknown;
    correct_answer: number; explanation: string; difficulty: string;
    topic_id: number; subcategory: string | null; source: unknown;
    learning_content: unknown | null; expires_at: Date | null;
    status: string; expiration_history: unknown | null;
    encounter_count: number; correct_count: number;
    quality_score: number | null; violation_count: number | null;
    flag_count: number; election_race_id: number | null;
    created_at: Date; updated_at: Date;
  }>('SELECT * FROM civic_trivia.questions ORDER BY id');

  console.log(`  Source rows: ${rows.length}`);

  let inserted = 0;
  // Use smaller batch for questions (large JSONB fields)
  const questionBatchSize = 50;
  for (let i = 0; i < rows.length; i += questionBatchSize) {
    const batch = rows.slice(i, i + questionBatchSize);
    const values = batch.map(r => {
      // Handle expiration_history: source may have NULL but target has NOT NULL DEFAULT '[]'
      const expirationHistory = r.expiration_history ?? [];
      return `(${r.id}, ${sqlLiteral(r.external_id)}, ${sqlLiteral(r.text)}, ${sqlLiteral(r.options)}, ` +
        `${r.correct_answer}, ${sqlLiteral(r.explanation)}, ${sqlLiteral(r.difficulty)}, ` +
        `${r.topic_id}, ${sqlLiteral(r.subcategory)}, ${sqlLiteral(r.source)}, ` +
        `${sqlLiteral(r.learning_content)}, ${sqlLiteral(r.expires_at)}, ` +
        `${sqlLiteral(r.status)}, ${sqlLiteral(expirationHistory)}, ` +
        `${r.encounter_count}, ${r.correct_count}, ` +
        `${sqlLiteral(r.quality_score)}, ${sqlLiteral(r.violation_count)}, ` +
        `${r.flag_count}, ${sqlLiteral(r.election_race_id)}, ` +
        `${sqlLiteral(r.created_at)}, ${sqlLiteral(r.updated_at)})`;
    }).join(',\n');

    const sql = `
INSERT INTO trivia.questions
  (id, external_id, text, options, correct_answer, explanation, difficulty, topic_id,
   subcategory, source, learning_content, expires_at, status, expiration_history,
   encounter_count, correct_count, quality_score, violation_count, flag_count,
   election_race_id, created_at, updated_at)
VALUES ${values}
ON CONFLICT (id) DO NOTHING;`;
    await targetQuery(sql);
    inserted += batch.length;
    if ((Math.floor(i / questionBatchSize) + 1) % 5 === 0 || i + questionBatchSize >= rows.length) {
      console.log(`  Inserted batch ${Math.floor(i / questionBatchSize) + 1}: rows ${i + 1}–${Math.min(i + questionBatchSize, rows.length)}`);
    }
  }

  // Reset sequence
  await targetQuery(`
SELECT setval(
  pg_get_serial_sequence('trivia.questions', 'id'),
  (SELECT COALESCE(MAX(id), 0) FROM trivia.questions)
);`);
  console.log('  Sequence reset');

  const [countResult] = await targetQuery<{ count: string }>('SELECT COUNT(*) FROM trivia.questions');
  const targetCount = parseInt(countResult.count, 10);

  return {
    table: 'questions',
    sourceCount: rows.length,
    insertedCount: inserted,
    targetCount,
    match: targetCount === rows.length,
  };
}

/** Migrate trivia.collection_topics */
async function migrateCollectionTopics(sourcePool: pg.Pool): Promise<MigrationResult> {
  console.log('\n--- Migrating: collection_topics ---');

  const { rows } = await sourcePool.query<{
    collection_id: number; topic_id: number; created_at: Date;
  }>('SELECT * FROM civic_trivia.collection_topics ORDER BY collection_id, topic_id');

  console.log(`  Source rows: ${rows.length}`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(r =>
      `(${r.collection_id}, ${r.topic_id}, ${sqlLiteral(r.created_at)})`
    ).join(',\n');

    const sql = `
INSERT INTO trivia.collection_topics (collection_id, topic_id, created_at)
VALUES ${values}
ON CONFLICT (collection_id, topic_id) DO NOTHING;`;
    await targetQuery(sql);
    inserted += batch.length;
    console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: rows ${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)}`);
  }

  const [countResult] = await targetQuery<{ count: string }>('SELECT COUNT(*) FROM trivia.collection_topics');
  const targetCount = parseInt(countResult.count, 10);

  return {
    table: 'collection_topics',
    sourceCount: rows.length,
    insertedCount: inserted,
    targetCount,
    match: targetCount === rows.length,
  };
}

/** Migrate trivia.collection_questions */
async function migrateCollectionQuestions(sourcePool: pg.Pool): Promise<MigrationResult> {
  console.log('\n--- Migrating: collection_questions ---');

  const { rows } = await sourcePool.query<{
    collection_id: number; question_id: number; created_at: Date;
  }>('SELECT * FROM civic_trivia.collection_questions ORDER BY collection_id, question_id');

  console.log(`  Source rows: ${rows.length}`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const values = batch.map(r =>
      `(${r.collection_id}, ${r.question_id}, ${sqlLiteral(r.created_at)})`
    ).join(',\n');

    const sql = `
INSERT INTO trivia.collection_questions (collection_id, question_id, created_at)
VALUES ${values}
ON CONFLICT (collection_id, question_id) DO NOTHING;`;
    await targetQuery(sql);
    inserted += batch.length;
    console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: rows ${i + 1}–${Math.min(i + BATCH_SIZE, rows.length)}`);
  }

  const [countResult] = await targetQuery<{ count: string }>('SELECT COUNT(*) FROM trivia.collection_questions');
  const targetCount = parseInt(countResult.count, 10);

  return {
    table: 'collection_questions',
    sourceCount: rows.length,
    insertedCount: inserted,
    targetCount,
    match: targetCount === rows.length,
  };
}

// ============================================================
// Main
// ============================================================

async function main() {
  const sourcePool = new pg.Pool({
    connectionString: SOURCE_DATABASE_URL!,
    max: 3,
    idleTimeoutMillis: 30000,
  });

  try {
    // Verify source connection
    await sourcePool.query('SELECT 1');
    console.log('Source DB connection: OK');

    // Verify target connection
    await targetQuery('SELECT 1 AS test');
    console.log('Target API connection: OK\n');

    const results: MigrationResult[] = [];

    // Execute in FK-dependency order
    results.push(await migrateTopics(sourcePool));
    results.push(await migrateCollections(sourcePool));
    results.push(await migrateElectionRaces(sourcePool));
    results.push(await migrateQuestions(sourcePool));
    results.push(await migrateCollectionTopics(sourcePool));
    results.push(await migrateCollectionQuestions(sourcePool));

    // Verify non-migrated tables are empty (as expected)
    console.log('\n--- Verifying non-migrated tables (should be empty) ---');
    const emptyTables = ['question_flags', 'player_stats', 'player_prefs'];
    for (const tbl of emptyTables) {
      const [r] = await targetQuery<{ count: string }>(`SELECT COUNT(*) FROM trivia.${tbl}`);
      console.log(`  trivia.${tbl}: ${r.count} rows (expected 0)`);
    }

    // Summary
    console.log('\n=================================================');
    console.log('MIGRATION SUMMARY');
    console.log('=================================================');
    console.log(
      'Table'.padEnd(24) +
      'Source'.padStart(8) +
      'Target'.padStart(8) +
      'Match'.padStart(8)
    );
    console.log('-'.repeat(48));

    let allMatch = true;
    for (const r of results) {
      const matchIcon = r.match ? 'YES' : 'NO !!!';
      if (!r.match) allMatch = false;
      console.log(
        r.table.padEnd(24) +
        String(r.sourceCount).padStart(8) +
        String(r.targetCount).padStart(8) +
        matchIcon.padStart(8)
      );
    }

    console.log('-'.repeat(48));
    console.log(`\nAll counts match: ${allMatch ? 'YES - migration successful!' : 'NO - MISMATCH DETECTED!'}`);
    console.log('=================================================');

    if (!allMatch) {
      console.error('\nERROR: Row count mismatch detected. Review the output above.');
      process.exit(1);
    } else {
      console.log('\nMigration complete. All content tables populated successfully.');
      process.exit(0);
    }
  } catch (err) {
    console.error('\nFATAL ERROR during migration:', err);
    process.exit(1);
  } finally {
    await sourcePool.end();
  }
}

main();

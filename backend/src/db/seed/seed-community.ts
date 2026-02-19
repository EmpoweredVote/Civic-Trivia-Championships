/**
 * Seeds community (locale-specific) questions into any database.
 * Reads from the JSON data files exported by scripts/export-community.ts.
 *
 * Prerequisites: run `db:seed` first so the collection rows exist.
 *
 * Usage:
 *   npm run db:seed:community
 *   # or: npx tsx src/db/seed/seed-community.ts
 *
 * Idempotent — safe to re-run (uses ON CONFLICT DO NOTHING throughout).
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../index.js';
import {
  collections,
  topics,
  collectionTopics,
  questions,
  collectionQuestions,
} from '../schema.js';
import { eq, sql } from 'drizzle-orm';
import { pool } from '../../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface DataTopic {
  slug: string;
  name: string;
  description: string;
}

interface DataQuestion {
  externalId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topicCategory: string;
  source: { name: string; url: string };
  expiresAt: string | null;
}

interface DataFile {
  topics: DataTopic[];
  questions: DataQuestion[];
}

const LOCALES = [
  { slug: 'bloomington-in', file: 'bloomington-in-questions.json' },
  { slug: 'los-angeles-ca', file: 'los-angeles-ca-questions.json' },
];

function loadDataFile(filename: string): DataFile {
  const filePath = resolve(__dirname, '..', '..', 'data', filename);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function seedLocale(slug: string, data: DataFile) {
  console.log(`\n--- Seeding ${slug} ---`);

  // 1. Look up collection (must already exist from db:seed)
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  if (!collection) {
    throw new Error(
      `Collection "${slug}" not found. Run "npm run db:seed" first.`
    );
  }

  const collectionId = collection.id;
  console.log(`  Collection found: id=${collectionId}`);

  // 2. Upsert topic categories and link to collection
  const topicIdMap: Record<string, number> = {};

  for (const t of data.topics) {
    // Insert topic if it doesn't exist
    const inserted = await db
      .insert(topics)
      .values({ name: t.name, slug: t.slug, description: t.description })
      .onConflictDoNothing({ target: topics.slug })
      .returning({ id: topics.id });

    let topicId: number;
    if (inserted.length > 0) {
      topicId = inserted[0].id;
    } else {
      // Already exists — fetch its id
      const [existing] = await db
        .select({ id: topics.id })
        .from(topics)
        .where(eq(topics.slug, t.slug))
        .limit(1);
      topicId = existing.id;
    }

    // Link topic to collection
    await db
      .insert(collectionTopics)
      .values({ collectionId, topicId })
      .onConflictDoNothing();

    topicIdMap[t.slug] = topicId;
  }

  console.log(`  Topics upserted: ${Object.keys(topicIdMap).length}`);

  // 3. Insert questions
  let seeded = 0;
  let skipped = 0;

  for (const q of data.questions) {
    const topicId = topicIdMap[q.topicCategory];
    if (!topicId) {
      console.warn(
        `  Warning: no topic for "${q.topicCategory}" — skipping ${q.externalId}`
      );
      skipped++;
      continue;
    }

    const inserted = await db
      .insert(questions)
      .values({
        externalId: q.externalId,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topicId,
        subcategory: q.topicCategory,
        source: q.source,
        learningContent: null,
        expiresAt: q.expiresAt ? new Date(q.expiresAt) : null,
        status: 'active',
        expirationHistory: [],
      })
      .onConflictDoNothing({ target: questions.externalId })
      .returning({ id: questions.id });

    if (inserted.length === 0) {
      skipped++;
      continue;
    }

    // 4. Link question to collection
    await db
      .insert(collectionQuestions)
      .values({ collectionId, questionId: inserted[0].id })
      .onConflictDoNothing();

    seeded++;
  }

  console.log(`  Questions seeded: ${seeded}, skipped (duplicates): ${skipped}`);
}

async function main() {
  console.log('=== Community Questions Seed ===');

  try {
    for (const locale of LOCALES) {
      const data = loadDataFile(locale.file);
      await seedLocale(locale.slug, data);
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    const allCollections = await db.select().from(collections);
    const allTopics = await db.select().from(topics);
    const allQuestions = await db.select().from(questions);
    const allCQ = await db.select().from(collectionQuestions);

    console.log(`Collections: ${allCollections.length}`);
    console.log(`Topics: ${allTopics.length}`);
    console.log(`Questions: ${allQuestions.length}`);
    console.log(`Collection-Questions: ${allCQ.length}`);

    console.log('\nCommunity seed complete!');
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

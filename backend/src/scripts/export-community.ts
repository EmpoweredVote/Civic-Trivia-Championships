/**
 * One-time export script: dumps community questions from local PostgreSQL
 * into self-contained JSON data files suitable for production seeding.
 *
 * Usage:
 *   npx tsx src/scripts/export-community.ts
 *
 * Outputs:
 *   src/data/bloomington-in-questions.json
 *   src/data/los-angeles-ca-questions.json
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/index.js';
import {
  collections,
  collectionQuestions,
  questions,
  topics,
  collectionTopics,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { pool } from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ExportedQuestion {
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

interface ExportedTopic {
  slug: string;
  name: string;
  description: string;
}

interface ExportFile {
  topics: ExportedTopic[];
  questions: ExportedQuestion[];
}

async function exportCollection(slug: string, outFile: string) {
  console.log(`\nExporting collection: ${slug}`);

  // 1. Find collection
  const [collection] = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  if (!collection) {
    console.error(`  Collection "${slug}" not found — skipping`);
    return;
  }

  // 2. Get linked topic categories
  const linkedTopics = await db
    .select({
      slug: topics.slug,
      name: topics.name,
      description: topics.description,
    })
    .from(collectionTopics)
    .innerJoin(topics, eq(collectionTopics.topicId, topics.id))
    .where(eq(collectionTopics.collectionId, collection.id));

  // Filter to only topics used by this locale (exclude federal topics)
  const exportedTopics: ExportedTopic[] = linkedTopics.map((t) => ({
    slug: t.slug,
    name: t.name,
    description: t.description ?? '',
  }));

  console.log(`  Found ${exportedTopics.length} topics`);

  // 3. Get all questions linked to this collection
  const linkedQuestions = await db
    .select({
      externalId: questions.externalId,
      text: questions.text,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      explanation: questions.explanation,
      difficulty: questions.difficulty,
      subcategory: questions.subcategory,
      source: questions.source,
      expiresAt: questions.expiresAt,
    })
    .from(collectionQuestions)
    .innerJoin(questions, eq(collectionQuestions.questionId, questions.id))
    .where(eq(collectionQuestions.collectionId, collection.id));

  // 4. Map to export format
  const exportedQuestions: ExportedQuestion[] = linkedQuestions
    .map((q) => ({
      externalId: q.externalId,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topicCategory: q.subcategory ?? '',
      source: q.source,
      expiresAt: q.expiresAt ? q.expiresAt.toISOString() : null,
    }))
    .sort((a, b) => a.externalId.localeCompare(b.externalId));

  console.log(`  Found ${exportedQuestions.length} questions`);

  // 5. Write JSON file
  const output: ExportFile = {
    topics: exportedTopics,
    questions: exportedQuestions,
  };

  const outPath = resolve(__dirname, '..', 'data', outFile);
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`  Written to ${outPath}`);
}

async function main() {
  console.log('=== Community Questions Export ===');

  await exportCollection('bloomington-in', 'bloomington-in-questions.json');
  await exportCollection('los-angeles-ca', 'los-angeles-ca-questions.json');

  console.log('\nDone!');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});

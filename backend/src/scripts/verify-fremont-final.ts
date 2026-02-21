#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function verify() {
  console.log('=== Final Fremont Question Verification ===\n');

  // Active count
  const activeResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM civic_trivia.questions q
    JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
    JOIN civic_trivia.collections c ON cq.collection_id = c.id
    WHERE c.slug = 'fremont-ca' AND q.status = 'active'
  `);
  console.log('Active Fremont questions:', activeResult.rows[0].count);

  // Topic distribution
  const topicResult = await db.execute(sql`
    SELECT q.subcategory, COUNT(*) as count
    FROM civic_trivia.questions q
    JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
    JOIN civic_trivia.collections c ON cq.collection_id = c.id
    WHERE c.slug = 'fremont-ca' AND q.status = 'active'
    GROUP BY q.subcategory ORDER BY count DESC
  `);
  console.log('\nTopic distribution:');
  for (const row of topicResult.rows) {
    console.log(`  ${row.subcategory}: ${row.count}`);
  }

  // Difficulty distribution
  const diffResult = await db.execute(sql`
    SELECT q.difficulty, COUNT(*) as count
    FROM civic_trivia.questions q
    JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
    JOIN civic_trivia.collections c ON cq.collection_id = c.id
    WHERE c.slug = 'fremont-ca' AND q.status = 'active'
    GROUP BY q.difficulty
  `);
  console.log('\nDifficulty distribution:');
  for (const row of diffResult.rows) {
    const r = row as any;
    const pct = ((r.count / (activeResult.rows[0] as any).count) * 100).toFixed(1);
    console.log(`  ${r.difficulty}: ${r.count} (${pct}%)`);
  }

  // Expiration timestamps
  const expiresResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM civic_trivia.questions q
    JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
    JOIN civic_trivia.collections c ON cq.collection_id = c.id
    WHERE c.slug = 'fremont-ca' AND q.status = 'active' AND q.expires_at IS NOT NULL
  `);
  console.log('\nQuestions with expiration timestamps:', expiresResult.rows[0].count);

  // Draft count
  const draftResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM civic_trivia.questions q
    JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
    JOIN civic_trivia.collections c ON cq.collection_id = c.id
    WHERE c.slug = 'fremont-ca' AND q.status = 'draft'
  `);
  console.log('Remaining draft questions:', draftResult.rows[0].count);

  process.exit(0);
}

verify();

import 'dotenv/config';
import { db } from '../db/index.js';
import { collections, questions, collectionQuestions } from '../db/schema.js';
import { sql, eq, and } from 'drizzle-orm';

async function verify() {
  try {
    console.log('=== VERIFYING ACTIVATION ===\n');

    // Get all active collections with question counts
    const result = await db.execute(sql`
      SELECT
        c.name,
        c.slug,
        c.is_active,
        COUNT(CASE WHEN q.status = 'active' THEN 1 END)::int AS active_questions
      FROM civic_trivia.collections c
      LEFT JOIN civic_trivia.collection_questions cq ON c.id = cq.collection_id
      LEFT JOIN civic_trivia.questions q ON cq.question_id = q.id
      GROUP BY c.id, c.name, c.slug, c.is_active
      ORDER BY c.sort_order
    `);

    console.log('Collections with active question counts:');
    console.table(result.rows);

    // Verify Bloomington questions
    const bloomingtonQuestions = await db
      .select({ externalId: questions.externalId, status: questions.status })
      .from(questions)
      .where(sql`${questions.externalId} LIKE 'bli-%'`)
      .limit(5);

    console.log('\nSample Bloomington questions (first 5):');
    console.table(bloomingtonQuestions);

    // Verify LA questions
    const laQuestions = await db
      .select({ externalId: questions.externalId, status: questions.status })
      .from(questions)
      .where(sql`${questions.externalId} LIKE 'lac-%'`)
      .limit(5);

    console.log('\nSample LA questions (first 5):');
    console.table(laQuestions);

    console.log('\n✓ Verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verify();

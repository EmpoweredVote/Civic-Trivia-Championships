/**
 * Anachronism Audit Script
 *
 * Scans all active questions in active collections against checkAnachronisticYear
 * and reports every question that asks when a past event happened while offering a
 * year that has not arrived.
 *
 * READ-ONLY — makes no database mutations. Flagged questions are repaired by hand,
 * because the fix is a replacement distractor, not a deletion.
 *
 * Usage:
 *   npm run audit-anachronism
 */

import '../env.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { checkAnachronisticYear } from '../services/qualityRules/rules/anachronism.js';
import type { QuestionInput } from '../services/qualityRules/types.js';

interface QuestionRow {
  external_id: string;
  text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  difficulty: string;
  source: { name: string; url: string };
  slug: string;
}

async function main() {
  const result = await db.execute(sql`
    SELECT q.external_id, q.text, q.options, q.correct_answer,
           q.explanation, q.difficulty, q.source, c.slug
    FROM trivia.questions q
    JOIN trivia.collection_questions cq ON cq.question_id = q.id
    JOIN trivia.collections c ON c.id = cq.collection_id AND c.is_active
    WHERE q.status = 'active'
    ORDER BY c.slug, q.external_id
  `);

  const rows = result.rows as unknown as QuestionRow[];
  let flagged = 0;

  for (const row of rows) {
    const input: QuestionInput = {
      externalId: row.external_id,
      text: row.text,
      options: row.options,
      correctAnswer: row.correct_answer,
      explanation: row.explanation,
      difficulty: row.difficulty,
      source: row.source,
    };

    const check = checkAnachronisticYear(input);
    if (!check.passed) {
      flagged++;
      console.log(`\n[${row.slug}] ${row.external_id}`);
      console.log(`  ${row.text}`);
      console.log(`  options: ${row.options.join(' | ')}`);
      console.log(`  answer:  ${row.options[row.correct_answer]}`);
      console.log(`  ${check.violations[0].evidence}`);
    }
  }

  console.log(`\nScanned ${rows.length} active questions; flagged ${flagged}.`);

  // The pool does not release on its own here; without this the script hangs
  // after "PostgreSQL connected", which is a known behaviour of this repo's scripts.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

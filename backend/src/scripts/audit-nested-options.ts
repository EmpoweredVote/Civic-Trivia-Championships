/**
 * Nested Options Audit Script
 *
 * Scans all active questions in active collections against checkNestedOptions and
 * reports every question whose answer options can be true at the same time —
 * "More than 50 / More than 80 / More than 138", overlapping ranges, and so on.
 *
 * Blocking hits are correctness defects: a player who picks a weaker-but-true bound
 * is marked wrong. Advisory hits read badly and become defects the moment someone
 * changes which option is correct.
 *
 * READ-ONLY — makes no database mutations. The fix is a rewritten option set, which
 * has to be authored, not deleted.
 *
 * Usage:
 *   npx tsx src/scripts/audit-nested-options.ts
 *   npx tsx src/scripts/audit-nested-options.ts --blocking-only
 */

import '../env.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { checkNestedOptions } from '../services/qualityRules/rules/nested-options.js';
import type { QuestionInput } from '../services/qualityRules/types.js';

const blockingOnly = process.argv.includes('--blocking-only');

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
  let blocking = 0;
  let advisory = 0;

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

    const check = checkNestedOptions(input);
    if (check.passed) continue;

    for (const v of check.violations) {
      if (v.severity === 'blocking') blocking++;
      else advisory++;
      if (blockingOnly && v.severity !== 'blocking') continue;

      console.log(`\n[${v.severity.toUpperCase()}] [${row.slug}] ${row.external_id}`);
      console.log(`  ${row.text}`);
      console.log(`  options: ${row.options.join(' | ')}`);
      console.log(`  answer:  ${row.options[row.correct_answer]}`);
      console.log(`  ${v.evidence}`);
    }
  }

  console.log(
    `\nScanned ${rows.length} active questions; ${blocking} blocking, ${advisory} advisory.`
  );

  // The pool does not release on its own here; without this the script hangs
  // after "PostgreSQL connected", which is a known behaviour of this repo's scripts.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

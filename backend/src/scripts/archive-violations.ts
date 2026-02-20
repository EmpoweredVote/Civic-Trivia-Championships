/**
 * Archive Violations Script
 *
 * Archives questions with blocking quality rule violations.
 * Updates question status to 'archived' (soft delete).
 * Reports collection health and questions that need archival.
 *
 * Usage:
 *   npm run archive-violations                # Archive blocking violations
 *   npm run archive-violations -- --dry-run   # Preview what would be archived
 */

import '../env.js';
import { db } from '../db/index.js';
import { questions, collections, collectionQuestions } from '../db/schema.js';
import { auditQuestion } from '../services/qualityRules/index.js';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { QuestionInput, AuditResult } from '../services/qualityRules/types.js';

interface QuestionRow {
  id: number;
  externalId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  source: { name: string; url: string };
  collectionNames: string[];
  collectionIds: number[];
}

/**
 * Parse CLI flags
 */
function parseFlags() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
  };
}

/**
 * Fetch all active questions with their collection memberships
 */
async function fetchQuestions(): Promise<QuestionRow[]> {
  console.log('Fetching all active questions...');

  // Use raw SQL for aggregation
  const result = await db.execute(sql`
    SELECT
      q.id,
      q.external_id as "externalId",
      q.text,
      q.options,
      q.correct_answer as "correctAnswer",
      q.explanation,
      q.difficulty,
      q.source,
      array_agg(c.name ORDER BY c.name) as "collectionNames",
      array_agg(c.id ORDER BY c.name) as "collectionIds"
    FROM civic_trivia.questions q
    JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
    JOIN civic_trivia.collections c ON cq.collection_id = c.id
    WHERE q.status = 'active'
    GROUP BY q.id, q.external_id, q.text, q.options, q.correct_answer, q.explanation, q.difficulty, q.source
    ORDER BY q.id
  `);

  return result.rows as unknown as QuestionRow[];
}

/**
 * Run audit on all questions with full validation (including URL checks)
 */
async function runAudit(questionRows: QuestionRow[]): Promise<AuditResult[]> {
  console.log(`\nAuditing ${questionRows.length} questions with full validation (including URL checks)...`);
  console.log('This may take several minutes.\n');

  const results: AuditResult[] = [];
  const batchSize = 10; // Process 10 at a time for URL checks

  for (let i = 0; i < questionRows.length; i += batchSize) {
    const batch = questionRows.slice(i, Math.min(i + batchSize, questionRows.length));

    // Process batch
    for (const row of batch) {
      const questionInput: QuestionInput = {
        externalId: row.externalId,
        text: row.text,
        options: row.options,
        correctAnswer: row.correctAnswer,
        explanation: row.explanation,
        difficulty: row.difficulty,
        source: row.source,
      };

      // Run with full validation (skipUrlCheck: false)
      const result = await auditQuestion(questionInput, { skipUrlCheck: false });
      results.push(result);
    }

    // Progress indicator
    const progress = Math.min(i + batchSize, questionRows.length);
    if (progress % 50 === 0 || progress === questionRows.length) {
      console.log(`  Audited ${progress}/${questionRows.length} questions...`);
    }
  }

  return results;
}

/**
 * Calculate per-collection impact
 */
function calculateCollectionImpact(
  questionRows: QuestionRow[],
  blockingExternalIds: Set<string>
): Map<string, {
  current: number;
  toRemove: number;
  after: number;
  status: string;
}> {
  const collectionImpact = new Map<string, {
    current: number;
    toRemove: number;
    after: number;
    status: string;
  }>();

  // Build set of questions to archive
  for (const row of questionRows) {
    for (const collectionName of row.collectionNames) {
      if (!collectionImpact.has(collectionName)) {
        collectionImpact.set(collectionName, {
          current: 0,
          toRemove: 0,
          after: 0,
          status: '',
        });
      }

      const impact = collectionImpact.get(collectionName)!;
      impact.current++;

      if (blockingExternalIds.has(row.externalId)) {
        impact.toRemove++;
      }
    }
  }

  // Calculate after and status
  for (const [name, impact] of collectionImpact.entries()) {
    impact.after = impact.current - impact.toRemove;
    impact.status = impact.after >= 50 ? 'OK (>= 50)' : 'HIDDEN (< 50)';
  }

  return collectionImpact;
}

/**
 * Print pre-archival summary
 */
function printPreArchivalSummary(
  blockingResults: AuditResult[],
  collectionImpact: Map<string, any>
) {
  console.log('\n=== ARCHIVE BLOCKING VIOLATIONS ===\n');
  console.log(`Questions with blocking violations: ${blockingResults.length}`);

  if (blockingResults.length > 0) {
    console.log('\nQuestions to archive:');
    for (const result of blockingResults) {
      const blockingViolations = result.violations
        .filter(v => v.severity === 'blocking')
        .map(v => v.rule)
        .join(', ');
      console.log(`  - ${result.question.externalId}: ${blockingViolations}`);
    }
  } else {
    console.log('  (none)');
  }

  // Per-collection impact
  console.log('\nPer-collection impact:');
  console.log('Collection Name          | Current | To Remove | After | Status');
  console.log('-------------------------|---------|-----------|-------|----------------');

  const sortedCollections = Array.from(collectionImpact.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [name, impact] of sortedCollections) {
    const namePadded = name.padEnd(24);
    const currentPadded = String(impact.current).padStart(7);
    const toRemovePadded = String(impact.toRemove).padStart(9);
    const afterPadded = String(impact.after).padStart(5);

    console.log(
      `${namePadded} | ${currentPadded} | ${toRemovePadded} | ${afterPadded} | ${impact.status}`
    );
  }

  console.log('');
}

/**
 * Archive questions with blocking violations
 */
async function archiveQuestions(externalIds: string[]) {
  if (externalIds.length === 0) {
    console.log('No questions to archive.');
    return;
  }

  console.log(`\nArchiving ${externalIds.length} questions...`);

  await db
    .update(questions)
    .set({
      status: 'archived',
      updatedAt: sql`NOW()`,
    })
    .where(inArray(questions.externalId, externalIds));

  console.log(`Archived ${externalIds.length} questions.`);
}

/**
 * Save quality scores for all audited questions
 */
async function saveQualityScores(auditResults: AuditResult[]) {
  console.log(`\nSaving quality scores for ${auditResults.length} questions...`);

  for (const result of auditResults) {
    await db
      .update(questions)
      .set({ qualityScore: result.score })
      .where(eq(questions.externalId, result.question.externalId));
  }

  console.log(`Quality scores saved for ${auditResults.length} questions.`);
}

/**
 * Print post-archival verification
 */
async function printPostArchivalVerification() {
  console.log('\n=== POST-ARCHIVAL VERIFICATION ===\n');

  // Query active question counts per collection
  const result = await db.execute(sql`
    SELECT
      c.name as "collectionName",
      COUNT(q.id)::int as "activeQuestions"
    FROM civic_trivia.collections c
    LEFT JOIN civic_trivia.collection_questions cq ON c.id = cq.collection_id
    LEFT JOIN civic_trivia.questions q ON cq.question_id = q.id
      AND q.status = 'active'
      AND (q.expires_at IS NULL OR q.expires_at > NOW())
    WHERE c.is_active = true
    GROUP BY c.id, c.name
    ORDER BY c.name
  `);

  const rows = result.rows as unknown as Array<{
    collectionName: string;
    activeQuestions: number;
  }>;

  console.log('Collection Name          | Active Questions | Status');
  console.log('-------------------------|------------------|-------------------');

  for (const row of rows) {
    const status = row.activeQuestions >= 50
      ? 'VISIBLE (>= 50)'
      : 'HIDDEN (< 50) -- will reappear when count >= 50';
    const namePadded = row.collectionName.padEnd(24);
    const countPadded = String(row.activeQuestions).padStart(16);

    console.log(`${namePadded} | ${countPadded} | ${status}`);
  }

  console.log('');
}

/**
 * Main execution
 */
async function main() {
  const flags = parseFlags();

  try {
    // Fetch questions
    const questionRows = await fetchQuestions();
    console.log(`Fetched ${questionRows.length} active questions\n`);

    // Run audit with full validation
    const auditResults = await runAudit(questionRows);

    // Identify blocking violations
    const blockingResults = auditResults.filter(r => r.hasBlockingViolations);
    const blockingExternalIds = new Set(blockingResults.map(r => r.question.externalId));

    // Calculate collection impact
    const collectionImpact = calculateCollectionImpact(questionRows, blockingExternalIds);

    // Print pre-archival summary
    printPreArchivalSummary(blockingResults, collectionImpact);

    if (flags.dryRun) {
      console.log('DRY RUN MODE: No changes made to database.\n');
      process.exit(0);
    }

    // Archive questions with blocking violations
    const idsToArchive = blockingResults.map(r => r.question.externalId);
    await archiveQuestions(idsToArchive);

    // Save quality scores for ALL audited questions
    await saveQualityScores(auditResults);

    // Print post-archival verification
    await printPostArchivalVerification();

    console.log('✓ Archive operation complete.\n');
    process.exit(0);
  } catch (error) {
    console.error('\nArchive operation failed:', error);
    process.exit(1);
  }
}

main();

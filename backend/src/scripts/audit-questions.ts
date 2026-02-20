/**
 * Audit Questions Script
 *
 * Evaluates all active questions against quality rules engine.
 * Produces console summary and detailed markdown report.
 *
 * Usage:
 *   npm run audit-questions                    # Full audit with URL checks
 *   npm run audit-questions -- --skip-url-check # Fast mode (no network calls)
 *   npm run audit-questions -- --save-scores    # Persist scores to database
 */

import '../env.js';
import { db } from '../db/index.js';
import { questions, collections, collectionQuestions } from '../db/schema.js';
import { auditQuestion } from '../services/qualityRules/index.js';
import { eq, sql } from 'drizzle-orm';
import { writeFileSync } from 'fs';
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
    skipUrlCheck: args.includes('--skip-url-check'),
    saveScores: args.includes('--save-scores'),
  };
}

/**
 * Fetch all active questions with their collection memberships
 */
async function fetchQuestions(): Promise<QuestionRow[]> {
  console.log('Fetching all active questions...');

  // Use raw SQL for aggregation since Drizzle doesn't have full GROUP BY support yet
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
 * Run audit on all questions
 */
async function runAudit(
  questionRows: QuestionRow[],
  skipUrlCheck: boolean
): Promise<AuditResult[]> {
  console.log(`\nAuditing ${questionRows.length} questions...`);
  if (skipUrlCheck) {
    console.log('(skipping URL checks for fast mode)\n');
  } else {
    console.log('(including URL validation - may take several minutes)\n');
  }

  const results: AuditResult[] = [];
  const batchSize = skipUrlCheck ? 50 : 10; // Faster batching without URL checks

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

      const result = await auditQuestion(questionInput, { skipUrlCheck });
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
 * Calculate per-collection statistics
 */
async function calculateCollectionStats(
  questionRows: QuestionRow[],
  auditResults: AuditResult[]
): Promise<Map<string, {
  total: number;
  pass: number;
  blocking: number;
  advisory: number;
  afterArchival: number;
}>> {
  // Build map of externalId -> audit result
  const resultMap = new Map<string, AuditResult>();
  for (const result of auditResults) {
    resultMap.set(result.question.externalId, result);
  }

  // Build per-collection stats
  const collectionStats = new Map<string, {
    total: number;
    pass: number;
    blocking: number;
    advisory: number;
    afterArchival: number;
  }>();

  for (const row of questionRows) {
    const result = resultMap.get(row.externalId);
    if (!result) continue;

    for (const collectionName of row.collectionNames) {
      if (!collectionStats.has(collectionName)) {
        collectionStats.set(collectionName, {
          total: 0,
          pass: 0,
          blocking: 0,
          advisory: 0,
          afterArchival: 0,
        });
      }

      const stats = collectionStats.get(collectionName)!;
      stats.total++;

      if (result.hasBlockingViolations) {
        stats.blocking++;
      } else if (result.hasAdvisoryOnly) {
        stats.advisory++;
      } else {
        stats.pass++;
      }

      // After archival = total - blocking
      stats.afterArchival = stats.total - stats.blocking;
    }
  }

  return collectionStats;
}

/**
 * Print console summary
 */
function printConsoleSummary(
  questionRows: QuestionRow[],
  auditResults: AuditResult[],
  collectionStats: Map<string, any>
) {
  const totalQuestions = auditResults.length;
  const passing = auditResults.filter(r => !r.hasBlockingViolations && !r.hasAdvisoryOnly).length;
  const blocking = auditResults.filter(r => r.hasBlockingViolations).length;
  const advisory = auditResults.filter(r => r.hasAdvisoryOnly).length;

  console.log('\n=== QUALITY AUDIT REPORT ===\n');
  console.log(`Total questions audited: ${totalQuestions}`);
  console.log(`Passing all rules: ${passing}`);
  console.log(`Blocking violations (would archive): ${blocking}`);
  console.log(`Advisory only (flagged for review): ${advisory}`);

  // Per-collection breakdown
  console.log('\n--- Per-Collection Breakdown ---\n');
  console.log('Collection Name          | Total | Pass | Block | Advisory | After Archival | Status');
  console.log('-------------------------|-------|------|-------|----------|----------------|--------');

  const sortedCollections = Array.from(collectionStats.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [name, stats] of sortedCollections) {
    const status = stats.afterArchival >= 50 ? 'OK (>= 50)' : 'WARNING (< 50)';
    const namePadded = name.padEnd(24);
    const totalPadded = String(stats.total).padStart(5);
    const passPadded = String(stats.pass).padStart(4);
    const blockPadded = String(stats.blocking).padStart(5);
    const advisoryPadded = String(stats.advisory).padStart(8);
    const afterPadded = String(stats.afterArchival).padStart(14);

    console.log(
      `${namePadded} | ${totalPadded} | ${passPadded} | ${blockPadded} | ${advisoryPadded} | ${afterPadded} | ${status}`
    );
  }

  // Blocking violation summary
  console.log('\n--- Blocking Violation Summary ---\n');
  const blockingViolations = new Map<string, number>();
  for (const result of auditResults) {
    if (result.hasBlockingViolations) {
      for (const violation of result.violations) {
        if (violation.severity === 'blocking') {
          const count = blockingViolations.get(violation.rule) || 0;
          blockingViolations.set(violation.rule, count + 1);
        }
      }
    }
  }

  const sortedBlocking = Array.from(blockingViolations.entries()).sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of sortedBlocking) {
    console.log(`  ${rule}: ${count} questions`);
  }

  // Advisory violation summary
  console.log('\n--- Advisory Violation Summary ---\n');
  const advisoryViolations = new Map<string, number>();
  for (const result of auditResults) {
    for (const violation of result.violations) {
      if (violation.severity === 'advisory') {
        const count = advisoryViolations.get(violation.rule) || 0;
        advisoryViolations.set(violation.rule, count + 1);
      }
    }
  }

  const sortedAdvisory = Array.from(advisoryViolations.entries()).sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of sortedAdvisory) {
    console.log(`  ${rule}: ${count} questions`);
  }

  console.log('');
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(
  questionRows: QuestionRow[],
  auditResults: AuditResult[],
  collectionStats: Map<string, any>,
  skipUrlCheck: boolean
): string {
  const timestamp = new Date().toISOString();
  const mode = skipUrlCheck ? 'skip-url-check' : 'full';

  // Build map of externalId -> collection names
  const collectionMap = new Map<string, string[]>();
  for (const row of questionRows) {
    collectionMap.set(row.externalId, row.collectionNames);
  }

  // Summary metrics
  const totalQuestions = auditResults.length;
  const passing = auditResults.filter(r => !r.hasBlockingViolations && !r.hasAdvisoryOnly).length;
  const blocking = auditResults.filter(r => r.hasBlockingViolations).length;
  const advisory = auditResults.filter(r => r.hasAdvisoryOnly).length;

  let md = '# Question Quality Audit Report\n\n';
  md += `**Generated:** ${timestamp}\n`;
  md += `**Total Questions:** ${totalQuestions}\n`;
  md += `**Mode:** ${mode}\n\n`;

  // Summary table
  md += '## Summary\n\n';
  md += '| Metric | Count |\n';
  md += '|--------|-------|\n';
  md += `| Passing all rules | ${passing} |\n`;
  md += `| Blocking violations | ${blocking} |\n`;
  md += `| Advisory only | ${advisory} |\n\n`;

  // Collection impact table
  md += '## Collection Impact\n\n';
  md += '| Collection | Total | Pass | Block | Advisory | After Archival | Status |\n';
  md += '|------------|-------|------|-------|----------|----------------|--------|\n';

  const sortedCollections = Array.from(collectionStats.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [name, stats] of sortedCollections) {
    const status = stats.afterArchival >= 50 ? 'OK' : 'WARNING';
    md += `| ${name} | ${stats.total} | ${stats.pass} | ${stats.blocking} | ${stats.advisory} | ${stats.afterArchival} | ${status} |\n`;
  }

  md += '\n**Status key:**\n';
  md += '- OK: >= 50 active questions after archival\n';
  md += '- WARNING: collection would be hidden (< 50 after archival)\n\n';

  // Questions to archive (blocking violations)
  md += '## Questions to Archive (Blocking Violations)\n\n';
  const blockingResults = auditResults.filter(r => r.hasBlockingViolations);
  blockingResults.sort((a, b) => a.score - b.score);

  if (blockingResults.length === 0) {
    md += '*No questions with blocking violations.*\n\n';
  } else {
    for (const result of blockingResults) {
      const truncatedText = result.question.text.length > 80
        ? result.question.text.substring(0, 80) + '...'
        : result.question.text;
      const collections = collectionMap.get(result.question.externalId)?.join(', ') || 'Unknown';

      md += `### ${result.question.externalId}: ${truncatedText}\n\n`;
      md += `**Collection(s):** ${collections}\n`;
      md += `**Score:** ${result.score}/100\n\n`;
      md += '**Blocking violations:**\n';

      const blockingViolations = result.violations.filter(v => v.severity === 'blocking');
      for (const violation of blockingViolations) {
        const evidence = violation.evidence ? ` — Evidence: ${violation.evidence}` : '';
        md += `- ${violation.rule} (blocking): ${violation.message}${evidence}\n`;
      }

      md += '\n';
    }
  }

  // Questions flagged (advisory only)
  md += '## Questions Flagged (Advisory Only)\n\n';
  const advisoryResults = auditResults.filter(r => r.hasAdvisoryOnly);
  advisoryResults.sort((a, b) => a.score - b.score);

  if (advisoryResults.length === 0) {
    md += '*No questions with advisory-only violations.*\n\n';
  } else {
    for (const result of advisoryResults) {
      const truncatedText = result.question.text.length > 80
        ? result.question.text.substring(0, 80) + '...'
        : result.question.text;
      const collections = collectionMap.get(result.question.externalId)?.join(', ') || 'Unknown';

      md += `### ${result.question.externalId}: ${truncatedText}\n\n`;
      md += `**Collection(s):** ${collections}\n`;
      md += `**Score:** ${result.score}/100\n\n`;
      md += '**Advisory violations:**\n';

      const advisoryViolations = result.violations.filter(v => v.severity === 'advisory');
      for (const violation of advisoryViolations) {
        const evidence = violation.evidence ? ` — Evidence: ${violation.evidence}` : '';
        md += `- ${violation.rule} (advisory): ${violation.message}${evidence}\n`;
      }

      md += '\n';
    }
  }

  // All questions by score
  md += '## All Questions by Score (Ascending)\n\n';
  md += '| Rank | ID | Score | Blocking | Advisory | Collection(s) |\n';
  md += '|------|-----|-------|----------|----------|---------------|\n';

  const allSorted = [...auditResults].sort((a, b) => a.score - b.score);
  allSorted.forEach((result, index) => {
    const collections = collectionMap.get(result.question.externalId)?.join(', ') || 'Unknown';
    const blockingCount = result.violations.filter(v => v.severity === 'blocking').length;
    const advisoryCount = result.violations.filter(v => v.severity === 'advisory').length;

    md += `| ${index + 1} | ${result.question.externalId} | ${result.score} | ${blockingCount} | ${advisoryCount} | ${collections} |\n`;
  });

  return md;
}

/**
 * Save quality scores to database
 */
async function saveScores(auditResults: AuditResult[]) {
  console.log('\nSaving quality scores to database...');

  for (const result of auditResults) {
    await db
      .update(questions)
      .set({ qualityScore: result.score })
      .where(eq(questions.externalId, result.question.externalId));
  }

  console.log(`Saved quality scores to database for ${auditResults.length} questions`);
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

    // Run audit
    const auditResults = await runAudit(questionRows, flags.skipUrlCheck);

    // Calculate collection stats
    const collectionStats = await calculateCollectionStats(questionRows, auditResults);

    // Print console summary
    printConsoleSummary(questionRows, auditResults, collectionStats);

    // Generate markdown report
    const markdownReport = generateMarkdownReport(
      questionRows,
      auditResults,
      collectionStats,
      flags.skipUrlCheck
    );

    const reportPath = 'audit-report.md';
    writeFileSync(reportPath, markdownReport);
    console.log(`Detailed report written to: ${reportPath}\n`);

    // Save scores if requested
    if (flags.saveScores) {
      await saveScores(auditResults);
    }

    process.exit(0);
  } catch (error) {
    console.error('\nAudit failed:', error);
    process.exit(1);
  }
}

main();

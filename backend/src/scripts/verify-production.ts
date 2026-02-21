#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CheckResult {
  criterion: string;
  status: 'PASS' | 'FAIL';
  details: string;
  evidence?: any;
}

const BACKEND_URL = process.env.BACKEND_URL || 'https://civic-trivia-backend.onrender.com';

async function main() {
  console.log('=== PRODUCTION VERIFICATION ===\n');

  // Log sanitized DATABASE_URL and timestamp
  const dbUrl = process.env.DATABASE_URL || 'Not set';
  const sanitized = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`Database: ${sanitized}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const results: CheckResult[] = [];
  let fremonCollectionId: number | null = null;
  let testSessionIds: string[] = [];

  // ===== CRITERION 1: Minimum 50 questions =====
  try {
    console.log('[1/7] Checking minimum question count...');
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM civic_trivia.questions q
      JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
      JOIN civic_trivia.collections c ON cq.collection_id = c.id
      WHERE c.slug = 'fremont-ca' AND q.status = 'active'
    `);

    const count = parseInt((result.rows[0] as any).count);
    const passed = count >= 50;

    results.push({
      criterion: 'Minimum 50 Active Questions',
      status: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Found ${count} active questions (exceeds minimum of 50)`
        : `Only ${count} active questions (minimum 50 required)`,
      evidence: { count }
    });

    console.log(`   ${passed ? '✓' : '✗'} ${count} active questions\n`);
  } catch (error) {
    results.push({
      criterion: 'Minimum 50 Active Questions',
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    console.log(`   ✗ Error checking question count\n`);
  }

  // ===== CRITERION 2: Game sessions with 8-question rounds =====
  let sessionData: any = null;
  try {
    console.log('[2/7] Testing game session creation...');

    // Get Fremont collection ID
    const collResult = await db.execute(sql`
      SELECT id FROM civic_trivia.collections WHERE slug = 'fremont-ca'
    `);

    if (collResult.rows.length === 0) {
      throw new Error('Fremont collection not found');
    }

    fremonCollectionId = (collResult.rows[0] as any).id;

    // Create 3 test sessions
    let allSessionsValid = true;
    const sessionResults = [];

    for (let i = 1; i <= 3; i++) {
      const response = await fetch(`${BACKEND_URL}/api/game/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: fremonCollectionId })
      });

      if (response.status !== 201) {
        allSessionsValid = false;
        sessionResults.push({ session: i, status: response.status, valid: false });
        continue;
      }

      const data = await response.json();
      testSessionIds.push(data.sessionId);

      // Store first session data for playability test
      if (i === 1) {
        sessionData = data;
      }

      const hasEightQuestions = data.questions && data.questions.length === 8;
      sessionResults.push({
        session: i,
        status: 201,
        questionCount: data.questions?.length || 0,
        valid: hasEightQuestions
      });

      if (!hasEightQuestions) {
        allSessionsValid = false;
      }
    }

    results.push({
      criterion: 'Game Sessions with 8-Question Rounds',
      status: allSessionsValid ? 'PASS' : 'FAIL',
      details: allSessionsValid
        ? 'Created 3 test sessions, all returned exactly 8 questions'
        : 'One or more sessions did not return 8 questions',
      evidence: sessionResults
    });

    console.log(`   ${allSessionsValid ? '✓' : '✗'} ${sessionResults.filter(r => r.valid).length}/3 sessions valid`);
    console.log(`   Note: Test sessions stored in Redis with TTL, no cleanup needed\n`);
  } catch (error) {
    results.push({
      criterion: 'Game Sessions with 8-Question Rounds',
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    console.log(`   ✗ Error creating test sessions\n`);
  }

  // ===== CRITERION 3: End-to-end playability =====
  try {
    console.log('[3/7] Testing end-to-end playability...');

    if (!sessionData || testSessionIds.length === 0) {
      throw new Error('No test session data available for playability test');
    }

    const sessionId = testSessionIds[0];
    const questions = sessionData.questions;

    // Submit answers to all 8 questions
    for (let i = 0; i < questions.length; i++) {
      const answerResponse = await fetch(`${BACKEND_URL}/api/game/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: questions[i].id,
          selectedOption: 0,
          timeRemaining: 15
        })
      });

      if (answerResponse.status !== 200) {
        throw new Error(`Failed to submit answer ${i + 1}: ${answerResponse.status}`);
      }
    }

    // Fetch results
    const resultsResponse = await fetch(`${BACKEND_URL}/api/game/results/${sessionId}`);
    if (resultsResponse.status !== 200) {
      throw new Error(`Failed to fetch results: ${resultsResponse.status}`);
    }

    const resultsData = await resultsResponse.json();
    const valid = resultsData.totalQuestions === 8 && resultsData.totalScore !== undefined;

    results.push({
      criterion: 'End-to-End Playability',
      status: valid ? 'PASS' : 'FAIL',
      details: valid
        ? `Completed full game: answered 8 questions, received results with score ${resultsData.totalScore}`
        : 'Game flow incomplete or results invalid',
      evidence: {
        totalQuestions: resultsData.totalQuestions,
        totalScore: resultsData.totalScore
      }
    });

    console.log(`   ${valid ? '✓' : '✗'} Full game playable (score: ${resultsData.totalScore})\n`);
  } catch (error) {
    results.push({
      criterion: 'End-to-End Playability',
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    console.log(`   ✗ Error testing playability\n`);
  }

  // ===== CRITERION 4: Fremont-specific questions (fre- prefix) =====
  try {
    console.log('[4/7] Checking external ID prefixes...');

    const result = await db.execute(sql`
      SELECT q.external_id
      FROM civic_trivia.questions q
      JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
      JOIN civic_trivia.collections c ON cq.collection_id = c.id
      WHERE c.slug = 'fremont-ca' AND q.status = 'active'
    `);

    const nonMatching = result.rows
      .map(row => (row as any).external_id as string)
      .filter(id => !id.startsWith('fre-'));

    const passed = nonMatching.length === 0;

    results.push({
      criterion: 'Fremont-Specific Questions (fre- prefix)',
      status: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `All ${result.rows.length} active questions have correct fre- prefix`
        : `${nonMatching.length} questions do not have fre- prefix. Flag for user review: ${nonMatching.join(', ')}`,
      evidence: passed ? null : { nonMatchingIds: nonMatching }
    });

    console.log(`   ${passed ? '✓' : '✗'} ${passed ? 'All questions' : `${nonMatching.length} questions`} have correct prefix\n`);
  } catch (error) {
    results.push({
      criterion: 'Fremont-Specific Questions (fre- prefix)',
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    console.log(`   ✗ Error checking external IDs\n`);
  }

  // ===== CRITERION 5: Difficulty balance =====
  try {
    console.log('[5/7] Checking difficulty distribution...');

    const result = await db.execute(sql`
      SELECT q.difficulty, COUNT(*) as count
      FROM civic_trivia.questions q
      JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
      JOIN civic_trivia.collections c ON cq.collection_id = c.id
      WHERE c.slug = 'fremont-ca' AND q.status = 'active'
      GROUP BY q.difficulty
    `);

    const distribution: Record<string, number> = {};
    let total = 0;

    for (const row of result.rows) {
      const r = row as any;
      distribution[r.difficulty] = parseInt(r.count);
      total += parseInt(r.count);
    }

    const hasEasy = (distribution.easy || 0) >= 1;
    const hasMedium = (distribution.medium || 0) >= 1;
    const hasHard = (distribution.hard || 0) >= 1;
    const passed = hasEasy && hasMedium && hasHard;

    const percentages = Object.entries(distribution).map(([level, count]) =>
      `${level}: ${count} (${((count / total) * 100).toFixed(1)}%)`
    ).join(', ');

    results.push({
      criterion: 'Difficulty Balance',
      status: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `All three difficulty levels represented: ${percentages}`
        : `Missing difficulty levels. Distribution: ${percentages}`,
      evidence: distribution
    });

    console.log(`   ${passed ? '✓' : '✗'} ${percentages}\n`);
  } catch (error) {
    results.push({
      criterion: 'Difficulty Balance',
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    console.log(`   ✗ Error checking difficulty distribution\n`);
  }

  // ===== CRITERION 6: Expiration system =====
  try {
    console.log('[6/7] Checking expiration system...');

    const withExpirationResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM civic_trivia.questions q
      JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
      JOIN civic_trivia.collections c ON cq.collection_id = c.id
      WHERE c.slug = 'fremont-ca' AND q.status = 'active' AND q.expires_at IS NOT NULL
    `);

    const expiredActiveResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM civic_trivia.questions q
      JOIN civic_trivia.collection_questions cq ON q.id = cq.question_id
      JOIN civic_trivia.collections c ON cq.collection_id = c.id
      WHERE c.slug = 'fremont-ca' AND q.status = 'active'
        AND q.expires_at IS NOT NULL AND q.expires_at < NOW()
    `);

    const withExpiration = parseInt((withExpirationResult.rows[0] as any).count);
    const expiredActive = parseInt((expiredActiveResult.rows[0] as any).count);

    const passed = withExpiration >= 1 && expiredActive === 0;

    results.push({
      criterion: 'Expiration System',
      status: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `${withExpiration} questions have expiration timestamps, none currently expired`
        : withExpiration === 0
          ? 'No questions have expiration timestamps'
          : `${expiredActive} expired questions are still active (should be 0)`,
      evidence: { withExpiration, expiredActive }
    });

    console.log(`   ${passed ? '✓' : '✗'} ${withExpiration} with expiration, ${expiredActive} expired but active\n`);
  } catch (error) {
    results.push({
      criterion: 'Expiration System',
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    console.log(`   ✗ Error checking expiration system\n`);
  }

  // ===== CRITERION 7: Admin panel / API accessibility =====
  try {
    console.log('[7/7] Checking collection API visibility...');

    const response = await fetch(`${BACKEND_URL}/api/game/collections`);
    if (response.status !== 200) {
      throw new Error(`Collections API returned ${response.status}`);
    }

    const data = await response.json();
    const collections = data.collections || data;
    const fremonCollection = collections.find((c: any) => c.slug === 'fremont-ca');

    const passed = !!fremonCollection;

    results.push({
      criterion: 'Admin Panel / API Accessibility',
      status: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Fremont collection visible in /api/game/collections (${fremonCollection.questionCount} questions)`
        : 'Fremont collection not found in /api/game/collections response',
      evidence: passed ? {
        name: fremonCollection.name,
        questionCount: fremonCollection.questionCount,
        isActive: fremonCollection.isActive
      } : null
    });

    console.log(`   ${passed ? '✓' : '✗'} Collection ${passed ? 'visible' : 'not found'} in API\n`);
  } catch (error) {
    results.push({
      criterion: 'Admin Panel / API Accessibility',
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    console.log(`   ✗ Error checking collections API\n`);
  }

  // ===== SUMMARY =====
  console.log('=== SUMMARY ===\n');
  console.table(results.map(r => ({
    Criterion: r.criterion,
    Status: r.status,
    Details: r.details
  })));

  // ===== GENERATE MARKDOWN REPORT =====
  const allPassed = results.every(r => r.status === 'PASS');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const score = `${passCount}/${results.length}`;

  const report = generateMarkdownReport(results, allPassed, score);

  // Write report to planning directory (go up 3 levels from backend/src/scripts to project root)
  const reportPath = resolve(__dirname, '..', '..', '..', '.planning', 'phases', '26-verification-production-testing', '26-VERIFICATION-REPORT.md');
  writeFileSync(reportPath, report, 'utf-8');

  console.log(`\n✓ Report saved to: ${reportPath}\n`);

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

function generateMarkdownReport(results: CheckResult[], allPassed: boolean, score: string): string {
  const timestamp = new Date().toISOString().split('T')[0];

  let markdown = `---
phase: 26-verification-production-testing
verified: ${timestamp}
status: ${allPassed ? 'passed' : 'failed'}
score: ${score}
---

# Fremont Collection Production Verification Report

**Date:** ${new Date().toISOString()}
**Backend:** ${BACKEND_URL}
**Overall Status:** ${allPassed ? '✅ PASSED' : '❌ FAILED'}
**Score:** ${score}

---

## Verification Results

`;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    markdown += `### ${i + 1}. ${r.criterion}

**Status:** ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}

**Details:** ${r.details}

`;

    if (r.evidence) {
      markdown += `**Evidence:**
\`\`\`json
${JSON.stringify(r.evidence, null, 2)}
\`\`\`

`;
    }
  }

  markdown += `---

## Summary

`;

  if (allPassed) {
    markdown += `All 7 verification criteria have passed. The Fremont, CA collection is ready for production use.

**Next Steps:**
- ✅ Mark v1.4 milestone as complete in ROADMAP.md and STATE.md
- ✅ Collection is live at https://civic-trivia-frontend.onrender.com
`;
  } else {
    markdown += `${results.filter(r => r.status === 'FAIL').length} of 7 criteria failed. Review failed criteria above and address issues before marking v1.4 complete.

**Failed Criteria:**
${results.filter(r => r.status === 'FAIL').map(r => `- ${r.criterion}: ${r.details}`).join('\n')}
`;
  }

  return markdown;
}

main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});

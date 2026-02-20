/**
 * Quality Validation with Retry Loop and Report Generation
 *
 * Integrates Phase 19 quality rules engine into the generation pipeline.
 * Validates generated questions, retries failures with feedback, and produces
 * structured generation reports.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { auditQuestion } from '../../../services/qualityRules/index.js';
import type { ValidatedQuestion } from '../question-schema.js';
import type { AuditResult, Violation } from '../../../services/qualityRules/types.js';

/**
 * Structured report for generation runs
 */
export interface GenerationReport {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Target collection (e.g., "indiana-state", "california-state", "replacements") */
  target: string;

  /** Generation configuration */
  config: {
    targetQuestions: number;
    batchSize: number;
    maxRetries: number;
  };

  /** High-level results */
  results: {
    totalGenerated: number;
    passedValidation: number;
    failedValidation: number;
    retryExhausted: number;
    finalInserted: number;
  };

  /** Detailed breakdowns */
  breakdown: {
    /** Violation counts per rule */
    byRule: Record<string, number>;
    /** Success counts per retry attempt (0 = first attempt) */
    byRetryAttempt: Record<number, number>;
    /** Question counts per difficulty */
    byDifficulty: Record<string, number>;
    /** Question counts per topic */
    byTopic: Record<string, number>;
  };

  /** Failed questions (exhausted retries) */
  failures: Array<{
    externalId: string;
    text: string;
    violations: string[];
    attempts: number;
  }>;

  /** Performance metrics */
  performance: {
    totalDurationMs: number;
    apiCalls: number;
    tokensUsed: {
      input: number;
      output: number;
      cached: number;
    };
    estimatedCostUsd: number;
  };
}

/**
 * Result from validation with retry loop
 */
export interface ValidationResult {
  /** Questions that passed validation */
  passed: ValidatedQuestion[];

  /** Questions that failed after all retries */
  failed: Array<{
    question: ValidatedQuestion;
    violations: Violation[];
    attempts: number;
  }>;

  /** Stats for report generation */
  stats: {
    totalAttempts: number;
    successByAttempt: Record<number, number>;
    violationsByRule: Record<string, number>;
  };
}

/**
 * Callback function for regenerating a failed question
 * Injected by the caller to keep this utility decoupled from the API client
 */
export type RegenerateFn = (
  failedQuestion: ValidatedQuestion,
  violationMessages: string
) => Promise<ValidatedQuestion>;

/**
 * Validate and retry questions with feedback loop
 *
 * For each question:
 * 1. Validate with auditQuestion()
 * 2. If passes: add to passed array
 * 3. If fails: extract blocking violations, call regenerateFn with feedback
 * 4. Retry up to maxRetries times
 * 5. If still failing: add to failed array
 *
 * @param questions - Array of questions to validate
 * @param regenerateFn - Callback to regenerate a failed question with feedback
 * @param options - Configuration options
 * @returns Validation result with passed/failed questions and stats
 */
export async function validateAndRetry(
  questions: ValidatedQuestion[],
  regenerateFn: RegenerateFn,
  options: {
    maxRetries?: number;
    skipUrlCheck?: boolean;
  } = {}
): Promise<ValidationResult> {
  const { maxRetries = 3, skipUrlCheck = true } = options;

  const passed: ValidatedQuestion[] = [];
  const failed: Array<{
    question: ValidatedQuestion;
    violations: Violation[];
    attempts: number;
  }> = [];

  // Track stats for report
  let totalAttempts = 0;
  const successByAttempt: Record<number, number> = {};
  const violationsByRule: Record<string, number> = {};

  for (let i = 0; i < questions.length; i++) {
    let currentQuestion = questions[i];
    let validated = false;
    let attempts = 0;
    let lastAudit: AuditResult | null = null;

    console.log(`\n[${i + 1}/${questions.length}] Validating: ${currentQuestion.externalId}`);

    while (!validated && attempts <= maxRetries) {
      totalAttempts++;

      // Validate with quality rules (skip URL check during generation for speed)
      lastAudit = await auditQuestion(currentQuestion, { skipUrlCheck });

      if (!lastAudit.hasBlockingViolations) {
        // Success!
        passed.push(currentQuestion);
        validated = true;

        // Track which attempt succeeded
        successByAttempt[attempts] = (successByAttempt[attempts] || 0) + 1;

        console.log(`  ✓ Passed validation (attempt ${attempts + 1}/${maxRetries + 1})`);
      } else {
        // Failed validation - extract blocking violations
        const blockingViolations = lastAudit.violations.filter(
          v => v.severity === 'blocking'
        );

        // Track violation counts
        for (const violation of blockingViolations) {
          violationsByRule[violation.rule] = (violationsByRule[violation.rule] || 0) + 1;
        }

        if (attempts < maxRetries) {
          // Retry with feedback
          const violationMessages = blockingViolations
            .map(v => `${v.rule}: ${v.message}${v.evidence ? ` (${v.evidence})` : ''}`)
            .join('; ');

          console.log(`  ✗ Failed validation (attempt ${attempts + 1}/${maxRetries + 1})`);
          console.log(`    Violations: ${violationMessages}`);
          console.log(`    Retrying with feedback...`);

          try {
            currentQuestion = await regenerateFn(currentQuestion, violationMessages);
            attempts++;
          } catch (error) {
            console.error(`    Error regenerating: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Stop retrying this question
            break;
          }
        } else {
          // Exhausted retries
          console.log(`  ✗ Failed after ${attempts + 1} attempts - retry limit reached`);
          break;
        }
      }
    }

    if (!validated && lastAudit) {
      // Add to failed list
      failed.push({
        question: currentQuestion,
        violations: lastAudit.violations.filter(v => v.severity === 'blocking'),
        attempts: attempts + 1
      });
    }
  }

  return {
    passed,
    failed,
    stats: {
      totalAttempts,
      successByAttempt,
      violationsByRule
    }
  };
}

/**
 * Create a generation report from validation results and performance data
 *
 * @param target - Target collection name
 * @param config - Generation configuration
 * @param validationResult - Results from validateAndRetry()
 * @param performanceStats - Performance metrics from generation run
 * @returns Complete generation report
 */
export function createReport(
  target: string,
  config: {
    targetQuestions: number;
    batchSize: number;
    maxRetries: number;
  },
  validationResult: ValidationResult,
  performanceStats: {
    totalDurationMs: number;
    apiCalls: number;
    tokensUsed: {
      input: number;
      output: number;
      cached: number;
    };
    estimatedCostUsd: number;
  },
  questionBreakdown: {
    byDifficulty: Record<string, number>;
    byTopic: Record<string, number>;
  }
): GenerationReport {
  const { passed, failed, stats } = validationResult;

  return {
    timestamp: new Date().toISOString(),
    target,
    config,
    results: {
      totalGenerated: stats.totalAttempts,
      passedValidation: passed.length,
      failedValidation: failed.length,
      retryExhausted: failed.length,
      finalInserted: passed.length
    },
    breakdown: {
      byRule: stats.violationsByRule,
      byRetryAttempt: stats.successByAttempt,
      byDifficulty: questionBreakdown.byDifficulty,
      byTopic: questionBreakdown.byTopic
    },
    failures: failed.map(f => ({
      externalId: f.question.externalId,
      text: f.question.text,
      violations: f.violations.map(v => v.rule),
      attempts: f.attempts
    })),
    performance: performanceStats
  };
}

/**
 * Save generation report to disk
 *
 * Writes JSON to backend/src/scripts/data/reports/generation-{target}-{YYYY-MM-DD}.json
 *
 * @param report - Generation report to save
 */
export async function saveReport(report: GenerationReport): Promise<void> {
  const reportsDir = join(process.cwd(), 'src', 'scripts', 'data', 'reports');

  // Create reports directory if it doesn't exist
  await mkdir(reportsDir, { recursive: true });

  // Generate filename with date
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `generation-${report.target}-${date}.json`;
  const filepath = join(reportsDir, filename);

  // Write report
  await writeFile(filepath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n📊 Generation report saved: ${filepath}`);
}

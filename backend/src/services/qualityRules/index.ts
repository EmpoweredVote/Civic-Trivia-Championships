/**
 * Quality Rules Engine - Main Audit Runner
 *
 * Orchestrates all quality rules to audit civic trivia questions.
 * Exports the main auditQuestion() and auditQuestions() functions.
 */

import { QuestionInput, AuditResult, QualityRule } from './types.js';
import { calculateQualityScore } from './scoring.js';

// Import all rule functions
import { checkAmbiguousAnswers, checkVagueQualifiers } from './rules/ambiguity.js';
import { checkPureLookup } from './rules/lookup.js';
import { checkStructuralQuality, checkLearnMoreLink } from './rules/structural.js';
import { checkPartisanFraming } from './rules/partisan.js';

/**
 * All synchronous rules (fast, no I/O)
 */
export const ALL_SYNC_RULES: QualityRule[] = [
  checkAmbiguousAnswers,
  checkVagueQualifiers,
  checkPureLookup,
  checkStructuralQuality,
  checkPartisanFraming,
];

/**
 * All asynchronous rules (require I/O like URL checks)
 */
export const ALL_ASYNC_RULES: QualityRule[] = [
  checkLearnMoreLink,
];

/**
 * All rules combined
 */
export const ALL_RULES: QualityRule[] = [
  ...ALL_SYNC_RULES,
  ...ALL_ASYNC_RULES,
];

/**
 * Options for audit functions
 */
export interface AuditOptions {
  /**
   * Skip URL validation (for fast dry-run audits without network calls)
   * Default: false (URL checks enabled)
   */
  skipUrlCheck?: boolean;

  /**
   * Maximum concurrent URL checks (only relevant if skipUrlCheck is false)
   * Default: 10
   */
  concurrency?: number;
}

/**
 * Audit a single question against all quality rules
 *
 * Runs all rules (sync + async), aggregates violations, calculates score,
 * and flags blocking status.
 *
 * @param question - Question to audit
 * @param options - Optional configuration
 * @returns Promise resolving to complete audit result
 */
export async function auditQuestion(
  question: QuestionInput,
  options: AuditOptions = {}
): Promise<AuditResult> {
  const { skipUrlCheck = false } = options;

  // Run all sync rules (fast, pure functions) and await them in case they return promises
  const syncResults = await Promise.all(
    ALL_SYNC_RULES.map(rule => Promise.resolve(rule(question)))
  );

  // Run async rules if not skipped
  const asyncResults = !skipUrlCheck
    ? await Promise.all(ALL_ASYNC_RULES.map(rule => Promise.resolve(rule(question))))
    : [];

  // Flatten all violations
  const allResults = [...syncResults, ...asyncResults];
  const allViolations = allResults.flatMap(r => r.violations);

  // Calculate score
  const score = calculateQualityScore(allViolations);

  // Check for blocking violations
  const hasBlockingViolations = allViolations.some(v => v.severity === 'blocking');

  // Check if has violations but none are blocking
  const hasAdvisoryOnly = allViolations.length > 0 && !hasBlockingViolations;

  return {
    question,
    violations: allViolations,
    score,
    hasBlockingViolations,
    hasAdvisoryOnly,
  };
}

/**
 * Audit multiple questions in batch
 *
 * Processes questions in parallel with optional concurrency limit
 * (to avoid hammering URLs).
 *
 * @param questions - Array of questions to audit
 * @param options - Optional configuration
 * @returns Promise resolving to array of audit results
 */
export async function auditQuestions(
  questions: QuestionInput[],
  options: AuditOptions = {}
): Promise<AuditResult[]> {
  const { skipUrlCheck = false, concurrency = 10 } = options;

  // If skipping URL checks, no need for concurrency control (all sync)
  if (skipUrlCheck) {
    return Promise.all(questions.map(q => auditQuestion(q, { skipUrlCheck: true })));
  }

  // With URL checks, batch into chunks to control concurrency
  const results: AuditResult[] = [];
  for (let i = 0; i < questions.length; i += concurrency) {
    const chunk = questions.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(q => auditQuestion(q, { skipUrlCheck: false }))
    );
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Quality Score Calculation
 *
 * Aggregates rule violations into a weighted 0-100 quality score.
 * Score is informational only (for sorting/filtering in admin UI).
 * Only hasBlockingViolations flag determines archival.
 */

import { Violation } from './types.js';

/**
 * Point deductions for each rule violation
 * Higher penalties for blocking violations, lower for advisory
 */
export const SCORE_WEIGHTS: Record<string, number> = {
  // Blocking violations (worst offenses)
  'ambiguous-answers': 40,
  'vague-qualifiers': 30,
  'pure-lookup': 25,
  'broken-learn-more': 40,

  // Advisory violations (flagged but not blocking)
  'partisan-framing': 15,
  'learn-more-timeout': 5, // Might just be slow
  'weak-explanation': 10,
  'short-question': 5,
  'long-question': 5,
  'missing-citation': 8,
  'missing-options': 10,
};

/**
 * Calculate quality score from violations
 *
 * Starts at 100, subtracts weight for each violation, floors at 0.
 * Unknown rule IDs get a default penalty of 10 points.
 *
 * IMPORTANT: Score is informational only. Do NOT use for blocking decisions.
 * Only hasBlockingViolations flag determines archival.
 *
 * @param violations - Array of violations found
 * @returns Quality score from 0-100
 */
export function calculateQualityScore(violations: Violation[]): number {
  let score = 100;

  for (const violation of violations) {
    const penalty = SCORE_WEIGHTS[violation.rule] || 10; // Default penalty for unknown rules
    score -= penalty;
  }

  return Math.max(0, score); // Floor at 0
}

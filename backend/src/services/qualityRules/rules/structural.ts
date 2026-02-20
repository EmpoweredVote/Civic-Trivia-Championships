/**
 * Structural Quality Rules
 *
 * Validates question structure: text length, explanation quality, citation,
 * option completeness, and Learn More link reachability.
 *
 * Most are ADVISORY (weak explanation, short question).
 * Broken Learn More links are BLOCKING.
 */

import { RuleResult, QuestionInput, Violation } from '../types.js';
import linkCheck from 'link-check';

/**
 * ADVISORY RULE: Check structural quality of question
 *
 * Validates:
 * 1. Question text length (20-500 chars)
 * 2. Explanation length (minimum 30 chars)
 * 3. Explanation cites a source
 * 4. All 4 options present and non-empty
 *
 * All structural quality issues are ADVISORY severity.
 *
 * @param question - Question to evaluate
 * @returns Rule result with any violations found
 */
export function checkStructuralQuality(question: QuestionInput): RuleResult {
  const violations: Violation[] = [];

  // Check 1: Question text length
  const questionLength = question.text.length;
  if (questionLength < 20) {
    violations.push({
      rule: 'short-question',
      severity: 'advisory',
      message: 'Question text is too terse (< 20 characters)',
      evidence: `${questionLength} characters`
    });
  } else if (questionLength > 500) {
    violations.push({
      rule: 'long-question',
      severity: 'advisory',
      message: 'Question text is too verbose (> 500 characters)',
      evidence: `${questionLength} characters`
    });
  }

  // Check 2: Explanation length
  const explanationLength = question.explanation.length;
  if (explanationLength < 30) {
    violations.push({
      rule: 'weak-explanation',
      severity: 'advisory',
      message: 'Explanation is too brief to be educational (< 30 characters)',
      evidence: `${explanationLength} characters`
    });
  }

  // Check 3: Explanation should cite a source
  const explanation = question.explanation;
  const sourceName = question.source.name;
  const hasCitation = (
    explanation.includes('According to') ||
    explanation.includes('Source:') ||
    explanation.includes('per the') ||
    explanation.includes(sourceName) ||
    /https?:\/\//i.test(explanation) // Contains a URL
  );

  if (!hasCitation) {
    violations.push({
      rule: 'missing-citation',
      severity: 'advisory',
      message: 'Explanation does not cite a source',
      evidence: 'No citation pattern found (e.g., "According to", "Source:", URL)'
    });
  }

  // Check 4: All 4 options present and non-empty
  const options = question.options;
  if (options.length !== 4) {
    violations.push({
      rule: 'missing-options',
      severity: 'advisory',
      message: `Expected 4 answer options, found ${options.length}`,
      evidence: `${options.length} options`
    });
  } else {
    // Check for empty options
    const emptyIndices = options
      .map((opt, idx) => (opt.trim().length === 0 ? idx : -1))
      .filter(idx => idx !== -1);

    if (emptyIndices.length > 0) {
      violations.push({
        rule: 'missing-options',
        severity: 'advisory',
        message: 'Some answer options are empty',
        evidence: `Empty options at indices: ${emptyIndices.join(', ')}`
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

/**
 * Check URL reachability using link-check package
 *
 * @param url - URL to validate
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise resolving to { isReachable: boolean, isTimeout: boolean }
 */
function checkURL(url: string, timeoutMs: number = 5000): Promise<{ isReachable: boolean; isTimeout: boolean }> {
  return new Promise((resolve) => {
    linkCheck(url, { timeout: timeoutMs }, (err, result) => {
      if (err) {
        // Network error or other failure
        resolve({ isReachable: false, isTimeout: err.message?.includes('timeout') || false });
      } else if (result.status === 'dead') {
        // Link is dead (404, 500, etc.)
        resolve({ isReachable: false, isTimeout: false });
      } else {
        // Link is alive
        resolve({ isReachable: true, isTimeout: false });
      }
    });
  });
}

/**
 * BLOCKING RULE (for hard failures) / ADVISORY (for timeouts):
 * Check Learn More link reachability
 *
 * Uses link-check package to validate source.url.
 * - HTTP 404, 500, connection failures → BLOCKING
 * - Timeouts → ADVISORY (government sites can be slow)
 *
 * @param question - Question to evaluate
 * @returns Promise resolving to rule result with any violations found
 */
export async function checkLearnMoreLink(question: QuestionInput): Promise<RuleResult> {
  const violations: Violation[] = [];
  const url = question.source.url;

  try {
    const { isReachable, isTimeout } = await checkURL(url, 5000);

    if (!isReachable) {
      if (isTimeout) {
        // Timeout: advisory (might just be slow)
        violations.push({
          rule: 'learn-more-timeout',
          severity: 'advisory',
          message: 'Learn More link timed out (may be slow government site)',
          evidence: url
        });
      } else {
        // Hard failure: blocking
        violations.push({
          rule: 'broken-learn-more',
          severity: 'blocking',
          message: 'Learn More link is unreachable or returns error',
          evidence: url
        });
      }
    }
  } catch (error) {
    // Unexpected error: treat as blocking
    violations.push({
      rule: 'broken-learn-more',
      severity: 'blocking',
      message: 'Learn More link validation failed',
      evidence: `${url} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

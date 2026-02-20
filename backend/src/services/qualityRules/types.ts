/**
 * Quality Rules Engine - Type Definitions
 *
 * Defines the core types for the quality rules engine that evaluates
 * civic trivia questions against codified quality standards.
 */

/**
 * Severity level for rule violations
 * - blocking: Question should be archived (ambiguous answers, broken links, pure lookup)
 * - advisory: Question flagged but remains active (weak explanation, partisan framing)
 */
export type Severity = 'blocking' | 'advisory';

/**
 * A single violation of a quality rule
 */
export interface Violation {
  /** Unique identifier for the rule that was violated (e.g., "ambiguous-answers") */
  rule: string;

  /** Severity level determines whether question should be archived */
  severity: Severity;

  /** Human-readable description of the violation */
  message: string;

  /** Optional: Specific text/data that triggered the violation (for evidence) */
  evidence?: string;
}

/**
 * Result from running a single quality rule
 */
export interface RuleResult {
  /** Whether the question passed this rule (no violations) */
  passed: boolean;

  /** List of violations found by this rule (empty if passed) */
  violations: Violation[];
}

/**
 * Subset of Question fields needed for quality rule evaluation
 * Mirrors the Question type from schema.ts but only includes fields rules need
 */
export interface QuestionInput {
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  source: {
    name: string;
    url: string;
  };
  externalId: string;
}

/**
 * Complete audit result for a question
 */
export interface AuditResult {
  /** The question that was audited */
  question: QuestionInput;

  /** All violations found across all rules */
  violations: Violation[];

  /** Numeric quality score (0-100, weighted by violation severity) */
  score: number;

  /** True if any violation has severity 'blocking' (triggers archival) */
  hasBlockingViolations: boolean;

  /** True if has violations but none are blocking */
  hasAdvisoryOnly: boolean;
}

/**
 * A quality rule function
 * Pure function (or async) that takes a question and returns rule result
 */
export type QualityRule = (question: QuestionInput) => RuleResult | Promise<RuleResult>;

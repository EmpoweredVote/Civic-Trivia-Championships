/**
 * Ambiguity Detection Rules
 *
 * Detects questions with ambiguous or vague wording that could make
 * multiple answers seem correct. These are BLOCKING violations.
 */

import { RuleResult, QuestionInput, Violation } from '../types.js';

/**
 * Common civic vocabulary that should be excluded from similarity calculations
 * to prevent false positives when answers share standard civic terms
 */
const CIVIC_STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'in', 'to', 'is', 'for', 'that',
  'federal', 'state', 'local', 'government', 'national', 'public',
  'law', 'act', 'bill', 'court', 'justice', 'congress', 'senate',
  'house', 'representative', 'senator', 'president', 'governor',
  'mayor', 'city', 'county', 'municipal', 'amendment', 'constitution'
]);

/**
 * Calculate Jaccard similarity (word overlap) between two strings
 * Excludes civic stop words to avoid false positives
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score from 0 (no overlap) to 1 (identical)
 */
function calculateWordOverlap(str1: string, str2: string): number {
  // Normalize: lowercase, split on non-word characters
  const words1 = str1.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const words2 = str2.toLowerCase().split(/\W+/).filter(w => w.length > 0);

  // Filter out civic stop words
  const filtered1 = new Set(words1.filter(w => !CIVIC_STOP_WORDS.has(w)));
  const filtered2 = new Set(words2.filter(w => !CIVIC_STOP_WORDS.has(w)));

  // Calculate Jaccard similarity: |intersection| / |union|
  const intersection = new Set([...filtered1].filter(w => filtered2.has(w)));
  const union = new Set([...filtered1, ...filtered2]);

  // Avoid division by zero
  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Find pairs of answer options that are too similar (>70% word overlap)
 *
 * @param options - Array of answer option strings
 * @returns Array of similar option pairs (formatted as "A" vs "B")
 */
function findSimilarOptions(options: string[]): string[] {
  const similarPairs: string[] = [];
  const SIMILARITY_THRESHOLD = 0.7;

  // Check all pairs
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const overlap = calculateWordOverlap(options[i], options[j]);
      if (overlap > SIMILARITY_THRESHOLD) {
        similarPairs.push(`"${options[i]}" vs "${options[j]}"`);
      }
    }
  }

  return similarPairs;
}

/**
 * BLOCKING RULE: Check for ambiguous answer options
 *
 * Detects when multiple answer options are too similar or could both be
 * plausibly correct. Uses Jaccard similarity with civic stop words filtered out.
 *
 * @param question - Question to evaluate
 * @returns Rule result with any violations found
 */
export function checkAmbiguousAnswers(question: QuestionInput): RuleResult {
  const violations: Violation[] = [];

  const similarOptions = findSimilarOptions(question.options);

  if (similarOptions.length > 0) {
    violations.push({
      rule: 'ambiguous-answers',
      severity: 'blocking',
      message: 'Multiple answer options are too similar or both plausibly correct',
      evidence: similarOptions.join('; ')
    });
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

/**
 * Vague qualifiers that create ambiguity in questions
 * These words make questions subjective (multiple answers could be "best", "most important")
 */
const VAGUE_QUALIFIERS = [
  'best',
  'most important',
  'primarily',
  'generally',
  'typically',
  'mainly',
  'usually',
  'often',
  'commonly',
  'frequently'
];

/**
 * BLOCKING RULE: Check for vague qualifiers in question text
 *
 * Detects subjective qualifiers that create ambiguity because multiple
 * answers could be defensible (e.g., "What is the MOST IMPORTANT...").
 *
 * @param question - Question to evaluate
 * @returns Rule result with any violations found
 */
export function checkVagueQualifiers(question: QuestionInput): RuleResult {
  const violations: Violation[] = [];
  const questionLower = question.text.toLowerCase();

  const foundQualifiers = VAGUE_QUALIFIERS.filter(qualifier =>
    questionLower.includes(qualifier)
  );

  if (foundQualifiers.length > 0) {
    violations.push({
      rule: 'vague-qualifiers',
      severity: 'blocking',
      message: 'Question contains vague qualifiers that create ambiguity',
      evidence: foundQualifiers.join(', ')
    });
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

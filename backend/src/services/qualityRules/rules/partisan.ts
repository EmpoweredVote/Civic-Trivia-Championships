/**
 * Partisan Framing Detection Rule
 *
 * Detects overtly partisan language in question text and explanations.
 * This rule is intentionally conservative (high-confidence keywords only)
 * and produces ADVISORY violations (not blocking).
 *
 * NOTE: This rule needs refinement. A future phase may upgrade to LLM-based
 * detection for better accuracy. For now, we use keyword matching to catch
 * the most obvious cases.
 */

import { RuleResult, QuestionInput, Violation } from '../types.js';

/**
 * High-confidence partisan keywords and phrases
 * These are overtly biased terms that should not appear in civic education
 */
const PARTISAN_KEYWORDS = {
  leftLeaning: [
    'radical left',
    'socialist agenda',
    'liberal elite',
    'nanny state',
    'gun-grabbing',
    'tax and spend',
    'bleeding heart'
  ],
  rightLeaning: [
    'far right',
    'extremist',
    'freedom-hating',
    'anti-american',
    'woke',
    'radical right',
    'reactionary'
  ],
  loadedFraming: [
    'scheme',
    'plot',
    'threat to democracy',
    'destroying',
    'ruining',
    'attack on',
    'war on',
    'radical',
    'extreme'
  ]
};

/**
 * Search text for partisan keywords (case-insensitive)
 *
 * @param text - Text to search
 * @returns Array of matched keywords
 */
function findPartisanKeywords(text: string): string[] {
  const textLower = text.toLowerCase();
  const matches: string[] = [];

  // Check all keyword categories
  const allKeywords = [
    ...PARTISAN_KEYWORDS.leftLeaning,
    ...PARTISAN_KEYWORDS.rightLeaning,
    ...PARTISAN_KEYWORDS.loadedFraming
  ];

  for (const keyword of allKeywords) {
    if (textLower.includes(keyword)) {
      matches.push(keyword);
    }
  }

  return matches;
}

/**
 * ADVISORY RULE: Check for partisan framing
 *
 * Scans question text AND explanation for high-confidence partisan keywords.
 * Produces ADVISORY violations (not blocking) because:
 * 1. Keyword detection is imprecise (needs manual review)
 * 2. This rule will be upgraded to LLM-based detection in Phase 21
 *
 * @param question - Question to evaluate
 * @returns Rule result with any violations found
 */
export function checkPartisanFraming(question: QuestionInput): RuleResult {
  const violations: Violation[] = [];

  // Search both question text and explanation
  const combinedText = `${question.text} ${question.explanation}`;
  const matchedKeywords = findPartisanKeywords(combinedText);

  if (matchedKeywords.length > 0) {
    violations.push({
      rule: 'partisan-framing',
      severity: 'advisory',
      message: 'Question or explanation contains partisan framing keywords',
      evidence: matchedKeywords.join(', ')
    });
  }

  return {
    passed: violations.length === 0,
    violations
  };
}

/**
 * Pure Lookup Detection Rule
 *
 * Detects questions that test obscure memorization with no civic utility.
 * The test is NOT about format (numbers/dates are fine).
 * The test is: "Would knowing this make me a more interesting, civically engaged person?"
 *
 * Foundational knowledge (city council size, senators per state) PASSES.
 * Obscure facts (year of obscure law, 14th Secretary of...) FAIL.
 *
 * BLOCKING violation when detected.
 */

import { RuleResult, QuestionInput, Violation } from '../types.js';

/**
 * Regex patterns for foundational civic knowledge (ALLOWLIST)
 * Questions matching these patterns should PASS even if they look like lookup
 */
const FOUNDATIONAL_PATTERNS = [
  // Structural questions about civic institutions
  /how many\s+(senators?|representatives?|council\s*members?|justices?|members?)\s+(are|sit|serve)/i,
  /how many\s+people\s+(are|sit|serve|make up)/i,
  /how long\s+(is|are)\s+the\s+term/i,
  /what\s+(is|are)\s+the\s+term\s+length/i,

  // Current office holders (relevant civic knowledge)
  /who\s+(is|are)\s+(the|our|your)\s+(current\s+)?(president|vice\s*president|governor|mayor|speaker|chief\s+justice)/i,
  /who\s+serves\s+as/i,

  // Functions and powers (what institutions do)
  /what\s+does\s+(the\s+)?(congress|senate|house|court|council|mayor|governor|president|constitution|amendment)/i,
  /what\s+(is|are)\s+the\s+(role|power|duty|function|purpose)/i,
  /what\s+powers?\s+does/i,

  // Constitutional and rights questions
  /what\s+(is|does)\s+(the\s+)?(constitution|bill\s+of\s+rights|amendment|first\s+amendment)/i,
  /which\s+amendment/i,
  /what\s+rights?\s+does/i,

  // Foundational processes
  /how\s+(does|do|is|are)\s+.*(elected|appointed|chosen|selected|work|function)/i,
  /what\s+(is|are)\s+the\s+process/i,
];

/**
 * Regex patterns for obscure trivia (BLOCKLIST)
 * Questions matching these patterns are likely pure lookup with no civic utility
 */
const OBSCURE_INDICATORS = [
  // Dates of specific laws/acts (unless foundational)
  /what\s+year\s+was\s+(the\s+)?[\w\s]+(act|law|statute|bill|treaty|ordinance)\s+(passed|enacted|signed|ratified)/i,
  /in\s+what\s+year\s+(was|did)/i,
  /when\s+was\s+(the\s+)?[\w\s]+(act|law|statute|bill|treaty)\s+(passed|enacted|signed)/i,

  // Specific dates (unless foundational)
  /what\s+date/i,
  /on\s+what\s+date/i,

  // Ordinal position holders (14th Secretary, 3rd mayor, etc.)
  /who\s+was\s+the\s+\d+(st|nd|rd|th)\s+/i,
  /which\s+\d+(st|nd|rd|th)\s+/i,

  // Obscure historical figures (context-dependent, but pattern helps)
  /who\s+(authored|wrote|drafted|signed)\s+the\s+[\w\s]+(act|law|statute|bill)/i,
];

/**
 * BLOCKING RULE: Check for pure lookup questions
 *
 * Detects questions testing obscure memorization with no civic utility.
 * Uses allowlist (foundational patterns) and blocklist (obscure indicators).
 *
 * Logic:
 * 1. If any FOUNDATIONAL_PATTERN matches → PASS (never flag foundational knowledge)
 * 2. Else if any OBSCURE_INDICATOR matches → FLAG as blocking
 * 3. Else → PASS (conservative approach)
 *
 * This can be tuned after the dry-run audit based on false positive/negative rates.
 *
 * @param question - Question to evaluate
 * @returns Rule result with any violations found
 */
export function checkPureLookup(question: QuestionInput): RuleResult {
  const violations: Violation[] = [];
  const questionText = question.text;

  // Step 1: Check for foundational patterns (allowlist)
  const hasFoundationalPattern = FOUNDATIONAL_PATTERNS.some(pattern =>
    pattern.test(questionText)
  );

  if (hasFoundationalPattern) {
    // This is foundational knowledge, always pass
    return {
      passed: true,
      violations: []
    };
  }

  // Step 2: Check for obscure indicators (blocklist)
  const matchedObscurePattern = OBSCURE_INDICATORS.find(pattern =>
    pattern.test(questionText)
  );

  if (matchedObscurePattern) {
    violations.push({
      rule: 'pure-lookup',
      severity: 'blocking',
      message: 'Question tests obscure memorization with no civic utility',
      evidence: `Pattern matched: ${matchedObscurePattern.source.substring(0, 100)}`
    });
  }

  // Step 3: Conservative default - if no pattern matches, pass
  return {
    passed: violations.length === 0,
    violations
  };
}

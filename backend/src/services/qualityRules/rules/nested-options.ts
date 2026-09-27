/**
 * Nested Options Quality Rule
 *
 * A multiple-choice question must have exactly one true option. Bounded options
 * ("More than 50", "Fewer than 200", "0-99") break that quietly, because a bound
 * can be true at the same time as another bound.
 *
 * queny-059 shipped as an active easy question offering
 *   "More than 50" / "More than 80" / "More than 138" / "More than 200"
 * with "More than 138" marked correct. If more than 138 languages are spoken in
 * Queens then more than 50 and more than 80 are also true. Three correct answers.
 * No existing rule saw it: the options are four distinct strings, the answer index
 * is valid, and nothing is ambiguous in the wording.
 *
 * This is BLOCKING when more than one option is simultaneously true. That is a
 * correctness defect, not a style one - a player who picks "More than 50" is right
 * and is marked wrong.
 *
 * It is ADVISORY when the options nest but only one happens to be true (the correct
 * option is the weakest bound). Such a question is still confusing to read and the
 * set will become wrong the moment someone edits which option is correct, but it is
 * not scoring anyone incorrectly today.
 */

/**
 * VENDORED, to be mirrored into
 * ev-accounts/backend/src/trivia/services/qualityRules/rules/nested-options.ts,
 * where the tests live (this repo has no test runner). That copy guards the nightly
 * pipeline; this one guards the collection-creation scripts this repo still owns.
 * Keep the two in step -- same arrangement as answerPlacement and anachronism.
 */

import { RuleResult, QuestionInput, Violation } from '../types.js';

type BoundKind = 'up' | 'down' | 'plain' | 'none';

interface ParsedOption {
  index: number;
  text: string;
  kind: BoundKind;
  /** The threshold, for 'up'/'down'; the value, for 'plain'. */
  value: number;
}

/**
 * Open-ended upward, written BEFORE the number: "Over 5,000 acres".
 * Anchored to the start (after optional hedging) because a comparator word in the
 * middle of an option is usually part of a phrase, not a threshold - see DOWN.
 */
const UP_LEADING =
  /^(?:about|approximately|roughly|around|nearly|well|some)?\s*(more than|greater than|larger than|higher than|over|above|at least|no fewer than|no less than|a minimum of|minimum of)\b/i;

/**
 * Open-ended downward, written before the number: "Fewer than 200".
 *
 * Deliberately NOT matched mid-string. "14 feet below sea level" is an exact
 * measurement whose "below" belongs to "below sea level", and reading it as a
 * threshold made ica-013 a false positive on the first run of this rule.
 */
const DOWN_LEADING =
  /^(?:about|approximately|roughly|around|nearly|well|some)?\s*(less than|fewer than|smaller than|lower than|under|below|at most|no more than|up to|a maximum of|maximum of)\b/i;

/** Open-ended bounds written AFTER the number, which must end the option. */
const UP_TRAILING = /(or more|or above|or higher|and above|and up|and over|\+)\s*$/i;
const DOWN_TRAILING = /(or less|or fewer|or below|and below|and under|or under)\s*$/i;

/** Any number, with thousands separators and decimals. */
const NUMBER = /(\d[\d,]*(?:\.\d+)?)/;

/** Every number in the option. Used to reject options that are not a single bound. */
const ALL_NUMBERS = /\d[\d,]*(?:\.\d+)?/g;

/** Magnitude words that scale the number that precedes them. */
const SCALES: Array<[RegExp, number]> = [
  [/\btrillion\b/i, 1e12],
  [/\bbillion\b/i, 1e9],
  [/\bmillion\b/i, 1e6],
  [/\b(thousand|k)\b/i, 1e3],
];

/** Parse a numeric token, applying any magnitude word that follows it. */
function toNumber(raw: string, context: string): number {
  const base = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(base)) return NaN;
  for (const [pattern, factor] of SCALES) {
    if (pattern.test(context)) return base * factor;
  }
  return base;
}

/**
 * Classify one option as an open-ended bound, a plain value, or neither.
 *
 * An option carrying more than one number is never treated as a bound. A single
 * threshold needs exactly one number, and the multi-number options in the live bank
 * are competing exact claims rather than predicates - "1974 and 1990" (a pair of
 * years), "Districts 1 and 2", and the Paris Agreement's
 * "Well below 2C, pursuing efforts to limit it to 1.5C". Reading any of those as a
 * bound produced false positives on the first run of this rule.
 */
function parseOption(text: string, index: number): ParsedOption {
  const base: ParsedOption = { index, text, kind: 'none', value: NaN };

  const numbers = text.match(ALL_NUMBERS);
  if (!numbers || numbers.length !== 1) return base;

  const num = text.match(NUMBER);
  if (!num) return base;
  const value = toNumber(num[1], text);
  if (!Number.isFinite(value)) return base;

  if (UP_LEADING.test(text) || UP_TRAILING.test(text)) {
    return { ...base, kind: 'up', value };
  }
  if (DOWN_LEADING.test(text) || DOWN_TRAILING.test(text)) {
    return { ...base, kind: 'down', value };
  }
  return { ...base, kind: 'plain', value };
}

/**
 * BLOCKING when more than one option is true at once; ADVISORY when the options
 * nest but today only one is true.
 */
export function checkNestedOptions(question: QuestionInput): RuleResult {
  const violations: Violation[] = [];
  const { options, correctAnswer } = question;

  if (!Array.isArray(options) || options.length === 0) {
    return { passed: true, violations: [] };
  }
  if (correctAnswer < 0 || correctAnswer >= options.length) {
    // Invalid index is a different defect, already caught elsewhere.
    return { passed: true, violations: [] };
  }

  const parsed = options.map(parseOption);
  const correct = parsed[correctAnswer];

  // ---- Same-direction open bounds -----------------------------------------
  //
  // Two upward bounds can never be mutually exclusive across the whole number
  // line: anything satisfying the higher threshold satisfies the lower one too.
  // Whether that actually bites depends on which option is marked correct.
  for (const direction of ['up', 'down'] as const) {
    const sameDirection = parsed.filter(o => o.kind === direction);
    if (sameDirection.length < 2 || correct.kind !== direction) continue;

    // Options that are ALSO true whenever the correct one is.
    const alsoTrue = sameDirection.filter(o =>
      o.index !== correct.index &&
      (direction === 'up' ? o.value < correct.value : o.value > correct.value)
    );

    if (alsoTrue.length > 0) {
      violations.push({
        rule: 'nested-options',
        severity: 'blocking',
        message:
          `Question has ${alsoTrue.length + 1} simultaneously true options. The correct ` +
          `option is a ${direction === 'up' ? 'lower-bound' : 'upper-bound'} threshold, and ` +
          `weaker thresholds in the same direction are satisfied by the same value.`,
        evidence:
          `correct "${correct.text}" also makes true: ` +
          alsoTrue.map(o => `"${o.text}"`).join(', '),
      });
    } else {
      violations.push({
        rule: 'nested-option-scale',
        severity: 'advisory',
        message:
          `All bounded options run in the same direction (${direction === 'up' ? 'lower' : 'upper'} ` +
          `bounds). Only one is true today because the correct option is the weakest bound, but ` +
          `the set becomes multi-answer if the correct option ever changes. Prefer ` +
          `non-overlapping brackets or plain values.`,
        evidence: sameDirection.map(o => `"${o.text}"`).join(', '),
      });
    }
  }

  // Overlapping ranges are deliberately NOT checked.
  //
  // The first version of this rule flagged them and every hit was wrong. Range
  // options are normally competing EXACT claims, not buckets a value falls into:
  // "About 1892 to 1960" against "About 1870 to 1900" for when Milwaukee's sewer
  // socialist movement ran, or the four candidate spans for the construction of
  // Philadelphia City Hall. Only one span is the real one, and overlap does not make
  // a second option true. Separating those from genuine bucket questions needs the
  // question's intent, which this rule cannot see, so it does not guess.

  return { passed: violations.length === 0, violations };
}

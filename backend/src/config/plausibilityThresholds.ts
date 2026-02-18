/**
 * Plausibility threshold configuration
 *
 * Defines minimum response times for different question difficulties.
 * These thresholds are based on cognitive processing times for multiple-choice questions:
 * - Reading comprehension (4 options, ~10-15 words each): ~0.3-0.5s
 * - Option evaluation and decision-making: ~0.2-0.5s
 * - Physical click response: ~0.1-0.2s
 *
 * Easy questions (simpler vocabulary, direct facts): 1.0s minimum
 * Medium questions (complex concepts, inference): 0.75s minimum
 * Hard questions (analysis, multiple-step reasoning): 0.5s minimum
 *
 * Harder questions use stricter thresholds because they should require MORE thinking,
 * so suspiciously fast answers are more likely to be automated/cheating.
 *
 * Timer multiplier adjustment: Users with extended time settings (1.5x, 2.0x) get
 * proportionally scaled thresholds to avoid false positives on accessibility users.
 */

export const PLAUSIBILITY_THRESHOLDS = {
  easy: 1.0,    // seconds
  medium: 0.75, // seconds
  hard: 0.5,    // seconds
  patternThreshold: 3, // Number of flags before penalties apply
} as const;

/**
 * Type representing valid difficulty levels for plausibility checks
 */
export type PlausibilityDifficulty = keyof Omit<typeof PLAUSIBILITY_THRESHOLDS, 'patternThreshold'>;

/**
 * Calculate adjusted threshold for a question based on difficulty and timer multiplier
 * @param difficulty - Question difficulty level (easy, medium, hard)
 * @param timerMultiplier - User's timer multiplier setting (1.0, 1.5, or 2.0)
 * @returns Adjusted threshold in seconds
 *
 * @example
 * // Hard question with standard timing
 * getAdjustedThreshold('hard', 1.0) // 0.5s
 *
 * // Hard question with 2x extended time
 * getAdjustedThreshold('hard', 2.0) // 1.0s
 */
export function getAdjustedThreshold(
  difficulty: PlausibilityDifficulty,
  timerMultiplier: number
): number {
  const baseThreshold = PLAUSIBILITY_THRESHOLDS[difficulty];
  return baseThreshold * timerMultiplier;
}

/**
 * Score calculation service
 * Handles base points and 3-tier speed bonus calculation
 */

/**
 * Calculate speed bonus based on time remaining
 * 3-tier system:
 * - Fast (>= 15s remaining out of 25s): +50 points
 * - Medium (>= 5s remaining): +25 points
 * - Slow (< 5s remaining): +0 points
 */
export function calculateSpeedBonus(timeRemaining: number): number {
  if (timeRemaining >= 15) {
    return 50;
  } else if (timeRemaining >= 5) {
    return 25;
  } else {
    return 0;
  }
}

/**
 * Calculate response time in seconds
 * @param questionDuration - Total time allocated for question (25s)
 * @param timeRemaining - Time remaining when answered
 * @returns Time taken to answer in seconds
 */
export function calculateResponseTime(questionDuration: number, timeRemaining: number): number {
  return questionDuration - timeRemaining;
}

/**
 * Calculate total score for an answer with plausibility penalty support
 * @param isCorrect - Whether the answer was correct
 * @param timeRemaining - Time remaining when answered
 * @param flagged - Whether this answer was flagged as suspicious
 * @param penaltyActive - Whether penalties are active (3+ flags in session)
 * @returns Score breakdown with base points, speed bonus, and total
 */
export function calculateScoreWithPenalty(
  isCorrect: boolean,
  timeRemaining: number,
  flagged: boolean,
  penaltyActive: boolean
): {
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
} {
  const basePoints = isCorrect ? 100 : 0;

  // If flagged AND penalty is active (3+ total flags in session), zero the speed bonus
  // Otherwise use normal speed bonus calculation
  const speedBonus = (flagged && penaltyActive) ? 0 : (isCorrect ? calculateSpeedBonus(timeRemaining) : 0);

  const totalPoints = basePoints + speedBonus;

  return {
    basePoints,
    speedBonus,
    totalPoints
  };
}

/**
 * Calculate total score for an answer
 * @param isCorrect - Whether the answer was correct
 * @param timeRemaining - Time remaining when answered
 * @returns Score breakdown with base points, speed bonus, and total
 */
export function calculateScore(
  isCorrect: boolean,
  timeRemaining: number
): {
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
} {
  const basePoints = isCorrect ? 100 : 0;
  const speedBonus = isCorrect ? calculateSpeedBonus(timeRemaining) : 0;
  const totalPoints = basePoints + speedBonus;

  return {
    basePoints,
    speedBonus,
    totalPoints
  };
}

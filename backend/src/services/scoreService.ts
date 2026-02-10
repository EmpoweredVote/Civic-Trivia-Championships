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

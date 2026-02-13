/**
 * Progression service - XP and gems calculation
 * Handles rewards calculation and user stats updates after game completion
 */

import { User } from '../models/User.js';

/**
 * Calculate XP and gems earned based on game performance
 * @param correctAnswers - Number of correct answers
 * @param totalQuestions - Total questions in the game
 * @returns XP and gems earned
 */
export function calculateProgression(
  correctAnswers: number,
  totalQuestions: number
): { xpEarned: number; gemsEarned: number } {
  // XP formula: 50 base + 1 per correct answer
  const xpEarned = 50 + correctAnswers;

  // Gems formula: 10 base + 1 per correct answer
  const gemsEarned = 10 + correctAnswers;

  return { xpEarned, gemsEarned };
}

/**
 * Update user progression after game completion
 * Calculates rewards and atomically updates user stats
 * @param userId - User ID
 * @param score - Total score achieved
 * @param correctAnswers - Number of correct answers
 * @param totalQuestions - Total questions in the game
 * @returns XP and gems earned
 */
export async function updateUserProgression(
  userId: number,
  score: number,
  correctAnswers: number,
  totalQuestions: number
): Promise<{ xpEarned: number; gemsEarned: number }> {
  // Calculate progression rewards
  const { xpEarned, gemsEarned } = calculateProgression(correctAnswers, totalQuestions);

  // Update user stats atomically
  await User.updateStats(userId, xpEarned, gemsEarned, score, correctAnswers, totalQuestions);

  return { xpEarned, gemsEarned };
}

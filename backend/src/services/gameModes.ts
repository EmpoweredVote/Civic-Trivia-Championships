/**
 * Game mode strategies - pluggable difficulty selection algorithms
 *
 * Each strategy receives pre-shuffled difficulty pools and returns an ordered
 * array of questions for a game session. The final question MUST always be hard.
 *
 * To add a new game mode:
 *   1. Write a GameModeStrategy function
 *   2. Add it to the gameModes registry below
 */

export interface DBQuestionRow {
  id: number;
  externalId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topicId: number;
  subcategory: string | null;
  source: { name: string; url: string };
  learningContent: { paragraphs: string[]; corrections: Record<string, string> } | null;
}

/**
 * A game mode strategy takes shuffled difficulty pools + total question count
 * and returns an ordered array of selected questions.
 * The final question (last position) MUST always be hard.
 */
export type GameModeStrategy = (
  easyPool: DBQuestionRow[],
  mediumPool: DBQuestionRow[],
  hardPool: DBQuestionRow[],
  totalQuestions: number
) => DBQuestionRow[];

/**
 * Helper: pick a question from preferred pools in order, avoiding duplicates.
 * Returns undefined if all pools are exhausted.
 */
function pickFrom(pools: DBQuestionRow[][], pickedIds: Set<number>): DBQuestionRow | undefined {
  for (const pool of pools) {
    while (pool.length > 0) {
      const candidate = pool.shift()!;
      if (!pickedIds.has(candidate.id)) {
        pickedIds.add(candidate.id);
        return candidate;
      }
    }
  }
  return undefined;
}

/**
 * Easy Steps - Progressive difficulty game mode (default)
 *
 * Eases new players in with easy questions first, graduating to harder ones:
 *   Positions 1-2: Easy only
 *   Positions 3-4: Easy or Medium
 *   Positions 5-6: Medium or Hard
 *   Position 7:    Hard only
 *   Position 8:    Hard only (final question)
 *
 * Constraint relaxation: if a pool is exhausted, falls back to adjacent difficulty.
 */
function easySteps(
  easyPool: DBQuestionRow[],
  mediumPool: DBQuestionRow[],
  hardPool: DBQuestionRow[],
  totalQuestions: number
): DBQuestionRow[] {
  const pickedIds = new Set<number>();
  const selected: DBQuestionRow[] = [];

  // Define tier preferences for each position range
  // Each tier is an array of pool preferences (tried in order)
  const tiers: { positions: number; pools: DBQuestionRow[][] }[] = [
    // Positions 1-2: Easy, fallback to medium, then hard
    { positions: 2, pools: [easyPool, mediumPool, hardPool] },
    // Positions 3-4: Easy+Medium combined (shuffle together), fallback to hard
    { positions: 2, pools: [easyPool, mediumPool, hardPool] },
    // Positions 5-6: Medium+Hard combined, fallback to easy
    { positions: 2, pools: [mediumPool, hardPool, easyPool] },
    // Position 7: Hard, fallback to medium, then easy
    { positions: 1, pools: [hardPool, mediumPool, easyPool] },
    // Position 8 (final): Hard, fallback to medium, then easy
    { positions: 1, pools: [hardPool, mediumPool, easyPool] },
  ];

  for (const tier of tiers) {
    for (let i = 0; i < tier.positions; i++) {
      const question = pickFrom(tier.pools, pickedIds);
      if (question) {
        selected.push(question);
      } else {
        console.warn(`[easy-steps] Pool exhausted at position ${selected.length + 1}, could not fill slot`);
      }
    }
  }

  console.log(`[easy-steps] Question difficulties: ${selected.map(q => q.difficulty).join(', ')}`);
  return selected;
}

/**
 * Classic - Original balanced difficulty mode
 *
 * Preserves the original applyDifficultySelection behavior:
 *   Q1  = easy
 *   Q8  = hard
 *   Q2-Q7 = 2 easy + 2 medium + 2 hard (shuffled)
 *
 * Constraint relaxation: if any pool is too small, fill from other pools.
 */
function classic(
  easyPool: DBQuestionRow[],
  mediumPool: DBQuestionRow[],
  hardPool: DBQuestionRow[],
  _totalQuestions: number
): DBQuestionRow[] {
  // Pick Q1 (easy) -- fallback to medium, then hard
  let q1: DBQuestionRow | undefined;
  if (easyPool.length > 0) {
    q1 = easyPool.shift()!;
  } else if (mediumPool.length > 0) {
    q1 = mediumPool.shift()!;
  } else {
    q1 = hardPool.shift()!;
  }

  // Pick final question (hard) -- fallback to medium, then easy
  let qFinal: DBQuestionRow | undefined;
  if (hardPool.length > 0) {
    qFinal = hardPool.shift()!;
  } else if (mediumPool.length > 0) {
    qFinal = mediumPool.shift()!;
  } else {
    qFinal = easyPool.shift()!;
  }

  // For Q2-Q7, pick 2 easy + 2 medium + 2 hard
  let needEasy = 2;
  let needMedium = 2;
  let needHard = 2;

  const middleQuestions: DBQuestionRow[] = [];

  // Pick from easy pool
  while (needEasy > 0 && easyPool.length > 0) {
    middleQuestions.push(easyPool.shift()!);
    needEasy--;
  }

  // Pick from medium pool
  while (needMedium > 0 && mediumPool.length > 0) {
    middleQuestions.push(mediumPool.shift()!);
    needMedium--;
  }

  // Pick from hard pool
  while (needHard > 0 && hardPool.length > 0) {
    middleQuestions.push(hardPool.shift()!);
    needHard--;
  }

  // Fill remaining gaps from any available pool
  const remaining = needEasy + needMedium + needHard;
  if (remaining > 0) {
    const remainingAll = [...easyPool, ...mediumPool, ...hardPool];
    // Shuffle remainingAll in-place (Fisher-Yates)
    for (let i = remainingAll.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingAll[i], remainingAll[j]] = [remainingAll[j], remainingAll[i]];
    }
    for (let i = 0; i < remaining && i < remainingAll.length; i++) {
      middleQuestions.push(remainingAll[i]);
    }
    if (remaining > remainingAll.length) {
      console.warn(`[classic] Could not fill all middle slots: needed ${remaining} more, only ${remainingAll.length} available`);
    }
  }

  // Shuffle the middle questions (Fisher-Yates)
  const shuffledMiddle = [...middleQuestions];
  for (let i = shuffledMiddle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledMiddle[i], shuffledMiddle[j]] = [shuffledMiddle[j], shuffledMiddle[i]];
  }

  const selected = [q1!, ...shuffledMiddle, qFinal!];
  console.log(`[classic] Question difficulties: ${selected.map(q => q.difficulty).join(', ')}`);
  return selected;
}

export const gameModes: Record<string, GameModeStrategy> = {
  'easy-steps': easySteps,
  'classic': classic,
};

export const DEFAULT_GAME_MODE = 'easy-steps';

/**
 * Adaptive tier logic: determine allowed difficulty tiers based on cumulative correct count.
 *
 * Tier rules:
 *   correctCount 0-1 (Tier 1): ['easy']
 *   correctCount 2-3 (Tier 2): ['easy', 'medium']
 *   correctCount 4-5 (Tier 3): ['medium', 'hard']
 *   Final question (questionNumber === totalQuestions): ['hard'] always
 */
export function getNextQuestionTier(
  correctCount: number,
  questionNumber: number,
  totalQuestions: number
): string[] {
  // Final question is always hard
  if (questionNumber === totalQuestions) {
    return ['hard'];
  }

  if (correctCount <= 1) return ['easy'];
  if (correctCount <= 3) return ['easy', 'medium'];
  return ['medium', 'hard'];
}

/**
 * Pick ONE question from candidate pools for the adaptive flow.
 *
 * Tries pools matching allowedDifficulties in order. Falls back to adjacent
 * difficulties if preferred pools are empty.
 *
 * @param candidatePools - Mutable pools keyed by difficulty
 * @param allowedDifficulties - Preferred difficulties in priority order
 * @param usedIds - Set of DB IDs already used in this session
 * @returns The picked question, or undefined if all pools are exhausted
 */
export function selectNextAdaptiveQuestion(
  candidatePools: Record<string, DBQuestionRow[]>,
  allowedDifficulties: string[],
  usedIds: Set<number>
): DBQuestionRow | undefined {
  // Build ordered list of pools to try: preferred first, then fallbacks
  const allDifficulties = ['easy', 'medium', 'hard'];
  const fallbacks = allDifficulties.filter(d => !allowedDifficulties.includes(d));
  const tryOrder = [...allowedDifficulties, ...fallbacks];

  for (const diff of tryOrder) {
    const pool = candidatePools[diff];
    if (!pool) continue;

    while (pool.length > 0) {
      const candidate = pool.shift()!;
      if (!usedIds.has(candidate.id)) {
        usedIds.add(candidate.id);
        return candidate;
      }
    }
  }

  return undefined;
}

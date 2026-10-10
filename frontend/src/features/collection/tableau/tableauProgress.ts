import { TOTAL_LINES } from './blueprint';

/**
 * How much of the tableau is standing.
 *
 * Driven by an ABSOLUTE bobit count, not by a fraction of the collection. Collections run from
 * 31 questions to 393 and are being targeted at 100 going forward, so a percentage would make
 * the same four right answers worth a whole structure in one room and a twelfth of one in
 * another. Four bobits, one line, everywhere.
 *
 * The number handed in is the HIGH-WATER MARK (`bobitPeak.ts`), never the live resident count.
 * Bobits are revoked on a wrong answer, and a house that un-builds itself when you miss a
 * question punishes twice and reads as a bug.
 */
export const BOBITS_PER_LINE = 4;

/** Lines standing at this high-water mark. Never negative, never past the blueprint. */
export function linesBuilt(peak: number): number {
  // Defensive rather than trusting: this is scenery, and a junk value must cost an empty
  // margin rather than a thrown render. NaN fails every comparison, so test for the good case.
  if (typeof peak !== 'number' || Number.isNaN(peak) || peak <= 0) return 0;
  return Math.max(0, Math.min(TOTAL_LINES, Math.floor(peak / BOBITS_PER_LINE)));
}

/** The bobit count at which line `n` goes up. The inverse of `linesBuilt`. */
export function bobitsForLine(n: number): number {
  return n * BOBITS_PER_LINE;
}

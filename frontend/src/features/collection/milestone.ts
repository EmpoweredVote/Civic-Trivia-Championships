/**
 * Building milestones.
 *
 * 25% is the only one this plan implements. 50/75/100 are content added to a finished
 * mechanism (spec, "Milestone set piece"), and the tree is the worked example that proves the
 * seam is real.
 */

export const MILESTONE_FRACTION = 0.25;

/**
 * Has this collection earned its tree?
 *
 * `peak` is the high-water mark, never the current count -- see bobitPeak.ts. The room can lose
 * bobits, and a tree that came and went with the current count would read as a bug rather than
 * as a rule.
 *
 * A null or zero `questionCount` earns NOTHING. It is null while the collection list is in
 * flight and after a failed fetch, and a tree that flickers in on every slow network is worse
 * than one that arrives a second late.
 */
export function treeEarned(peak: number, questionCount: number | null): boolean {
  if (!questionCount || questionCount <= 0) return false;
  return peak >= questionCount * MILESTONE_FRACTION;
}

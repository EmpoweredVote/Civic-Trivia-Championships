/**
 * Stable identity for a collection bobit.
 *
 * Both a figure's colour and its position derive from its question id, so the bobit for
 * `milwi-042` is the same figure in the same spot every match. That is what makes a loss
 * legible: the gap is where a particular person used to stand, not just one fewer body.
 */

/** FNV-1a, 32-bit. Small, dependency-free, and well spread over short ASCII ids. */
export function hashId(questionId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < questionId.length; i++) {
    h ^= questionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Palette index, 0-5, matching FIG_COLORS in rigExtras. */
export function toneOf(questionId: string): number {
  return hashId(questionId) % 6;
}

/**
 * Deterministic slot ordering.
 *
 * Sorted by the id itself, NOT by hash and NOT by grant time. Sorting by hash would be just as
 * stable, but sorting by id keeps a collection's figures grouped in their natural numbering,
 * which reads as a room filling up rather than scattering. Grant time would be wrong outright:
 * it would reshuffle everyone whenever one bobit was lost and re-earned.
 */
export function slotOrder(questionIds: string[]): string[] {
  return [...questionIds].sort();
}

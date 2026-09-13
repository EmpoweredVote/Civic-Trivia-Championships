/**
 * What the room does, as pure pose selection.
 *
 * Deliberately separate from `crowdReducer`: the reducer owns WHEN a reaction is running (it
 * is driven by match events and holds the clock), and this module owns WHAT each bobit plays
 * while it runs. Keeping them apart is what lets the celebration chain be tested at a hundred
 * time offsets without constructing a match.
 *
 * This module must NOT import from `crowdReducer` -- the reducer imports RIPPLE_DUR from here,
 * so an import back would close a cycle. Pose selection takes plain numbers, never CrowdState.
 */

/** Seconds a costless-miss ripple takes to cross the room and settle. */
export const RIPPLE_DUR = 1.5;

/** px/s the ripple travels outward from its origin. */
const RIPPLE_SPEED = 420;

/**
 * Pair neighbours off for a high-five.
 *
 * Greedy nearest-neighbour, walked in ID order so the result never depends on how the caller
 * happened to enumerate its agents -- the pairs have to be identical frame to frame or the
 * partners flicker between each other.
 *
 * Each pair is returned LEFT FIRST, because the two partners need different poses: the left
 * one reaches right and vice versa.
 */
export function pairUp(
  agents: Array<{ id: string; x: number }>, maxGap: number,
): Array<[string, string]> {
  const order = [...agents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const taken = new Set<string>();
  const pairs: Array<[string, string]> = [];

  for (const a of order) {
    if (taken.has(a.id)) continue;
    let best: { id: string; x: number } | null = null;
    let bestGap = Infinity;
    for (const b of order) {
      if (b.id === a.id || taken.has(b.id)) continue;
      const gap = Math.abs(b.x - a.x);
      if (gap <= maxGap && gap < bestGap) { best = b; bestGap = gap; }
    }
    if (!best) continue;
    taken.add(a.id);
    taken.add(best.id);
    pairs.push(a.x <= best.x ? [a.id, best.id] : [best.id, a.id]);
  }

  return pairs;
}

/** Phase boundaries within a celebration, in seconds from its start. */
const CHEER_UNTIL = 0.8;
const CLAP_UNTIL = 1.6;
const HIGHFIVE_UNTIL = 2.4;

/**
 * The escalation ladder, as the celebration's OPENING pose. Tier is the in-match streak, 1-5.
 *
 * This is the old `animForTier` ladder in its new job: it no longer describes the whole
 * reaction, only how hard the room opens before the clap-and-high-five chain takes over.
 */
function openingFor(tier: number): string {
  switch (tier) {
    case 0: return 'standstill';
    case 1: return 'friendly';
    case 2:
    case 3: return 'cheer';
    case 4: return 'jump';
    default: return 'dance';
  }
}

/**
 * What one bobit plays at `elapsed` seconds into a celebration.
 *
 * `paired` is the hand this bobit reaches with, or null if nobody was close enough. The
 * celebrant -- whoever the answer belongs to -- opens one rung harder, which is the only thing
 * distinguishing a repeat correct answer from a brand new arrival.
 *
 * Returns `anim: null` once the celebration is spent, meaning "go back to your own business".
 */
export function celebrationPose(
  elapsed: number, tier: number, isCelebrant: boolean, paired: 'R' | 'L' | null,
): { anim: string | null; hand?: 'R' | 'L' } {
  if (tier <= 0 || elapsed >= HIGHFIVE_UNTIL) return { anim: null };

  if (elapsed < CHEER_UNTIL) {
    return { anim: openingFor(isCelebrant ? Math.min(5, tier + 1) : tier) };
  }
  if (elapsed < CLAP_UNTIL) return { anim: 'clap' };
  if (!paired) return { anim: 'jump' };
  return { anim: 'highfive', hand: paired };
}

/**
 * What one bobit plays during a costless miss, from how far he stands from the origin.
 *
 * A miss on a question you never owned costs nothing, so nothing is taken -- but the room
 * still has to acknowledge it, or a new player's whole first match passes without the crowd
 * reacting to anything. The reaction travels outward so it reads as news spreading rather
 * than as everyone being told at once.
 *
 * `scale` converts the rig-unit sense of "near" into the band's pixels.
 */
export function ripplePose(distancePx: number, elapsed: number, scale: number): string | null {
  if (elapsed <= 0 || elapsed >= RIPPLE_DUR) return null;
  const front = elapsed * RIPPLE_SPEED * scale;
  if (distancePx > front) return null;
  return distancePx <= 100 * scale ? 'shrug' : 'confused';
}

import { hashId } from './crowdIdentity';

/**
 * What one bobit plays on the recap screen, as pure pose selection.
 *
 * Deliberately separate from `crowdReactions`, which owns what the room does DURING a match --
 * a one-shot chain driven by an event, over in 2.4s. The recap has no events and no end: it
 * runs for as long as the player looks at it. Sharing a module would mean one of the two
 * growing a mode flag.
 *
 * Pure, and takes plain numbers, so the whole thing is testable without a canvas or a clock.
 */

/** Seconds one audience bobit takes to get through his own cycle of celebration. */
export const AUDIENCE_CYCLE = 3.2;

/** One bobit in this many is ever a jumper at all. */
const JUMP_ONE_IN = 8;
/** And a jumper only jumps on one cycle in this many. */
const JUMP_EVERY = 4;
/** The slice of a cycle a jump occupies, as fractions of it. */
const JUMP_FROM = 0.55;
const JUMP_TO = 0.8;

/**
 * What this bobit is doing on the recap screen right now.
 *
 * `paired` comes from `pairUp` in crowdReactions, which returns pairs LEFT FIRST -- the left
 * partner reaches RIGHT and vice versa, so two of the same hand miss each other entirely.
 *
 * NOTE there are two independent offsets at work, and both are needed:
 *   - the one below, which spreads WHICH POSE each bobit is playing, and
 *   - `FieldFigure.phase`, which spreads the animation clock INSIDE a pose so neighbours do
 *     not breathe in unison.
 * Dropping either one puts the room in lockstep in a different way.
 */
export function recapPose(
  id: string, elapsed: number, isNew: boolean, paired: 'R' | 'L' | null,
): { anim: string; hand?: 'R' | 'L' } {
  // Earned in the match just finished: he is the cast, and he takes a bow. He does not break
  // off to slap hands -- that is what the audience is for.
  if (isNew) return { anim: 'bow' };

  if (paired) return { anim: 'highfive', hand: paired };

  const h = hashId(id);
  // Stable per-bobit offset into the cycle, so the room does not change pose on one frame.
  const offset = ((h % 1000) / 1000) * AUDIENCE_CYCLE;
  const t = Math.max(0, elapsed) + offset;
  const cycle = Math.floor(t / AUDIENCE_CYCLE);
  const phase = (t % AUDIENCE_CYCLE) / AUDIENCE_CYCLE;

  // Rare by construction: one bobit in eight, one cycle in four, a quarter of that cycle --
  // so a given bobit is jumping well under one percent of the time, and in a room of forty
  // that is somebody jumping every few seconds rather than a wave of them.
  const jumper = h % JUMP_ONE_IN === 0;
  if (jumper && cycle % JUMP_EVERY === 0 && phase >= JUMP_FROM && phase < JUMP_TO) {
    return { anim: 'jump' };
  }

  return { anim: phase < 0.5 ? 'cheer' : 'clap' };
}

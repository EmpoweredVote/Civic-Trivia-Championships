import { SMOKE_PURPLE } from '../../../components/bobbits/rigExtras';
import type { Scene } from './types';

/**
 * The ordinary arrivals: every bobit after the first two.
 *
 * Short, funny, and entirely inside the band. None of them use the overlay -- the relaxation
 * that lets a figure pass in front of the question card is for set pieces only, and an entrance
 * the player will see eighty times is not a set piece.
 *
 * EVERY ONE OF THEM ARRIVES IN SMOKE, and a new entrance must too. Findability is the binding
 * constraint here, not choreography: in a room of ~35 same-size figures on one line, an
 * entrance that is neither a poof nor a flash does not register as an arrival at all. The two
 * that read before this rule -- the swirl and the drop -- read because of their smoke, and the
 * stroll-in that had none was indistinguishable from ambient walking. `scenes.test.ts` holds
 * the rule for whatever gets added next.
 *
 * Deliberately additive: the "large library of random entrances" is more files shaped like
 * these, and `sceneForArrival` picks from whatever is in the array.
 */

/** Poof in, land badly, shrug, dust yourself off. */
const STUMBLE: Scene = {
  id: 'pool-stumble', duration: 2.6, span: 0.12, roles: ['newcomer'],
  beats: [
    { at: 0.0, role: 'newcomer', moveTo: 0.5, hidden: true,
      smoke: { spread: 30, color: SMOKE_PURPLE } },
    { at: 0.35, role: 'newcomer', hidden: false, pose: 'spent', flash: true },
    { at: 1.1, role: 'newcomer', pose: 'shrug' },
    { at: 1.9, role: 'newcomer', pose: 'friendly' },
  ],
};

/** Poof in, stroll off, trip over nothing at all, check whether anybody saw. */
const TRIP: Scene = {
  id: 'pool-trip', duration: 3.0, span: 0.16, roles: ['newcomer'],
  beats: [
    // The poof is the arrival marker, not the pratfall. Without it this beat is a bobit
    // walking, and a bobit walking is what the other thirty-five are already doing.
    //
    // He arrives a little way IN rather than at fraction 0. A scene in a quiet room stages at
    // the band's left edge, and a puff at 0 is centred on that edge with half of it off the
    // screen -- which the first version of this did, and the contact sheet showed.
    { at: 0.0, role: 'newcomer', pose: 'stroll', moveTo: 0.4,
      smoke: { spread: 28, color: SMOKE_PURPLE } },
    { at: 0.3, role: 'newcomer', moveTo: 0.9, path: 'walk' },
    { at: 1.3, role: 'newcomer', pose: 'painhop' },
    { at: 2.0, role: 'newcomer', pose: 'confused' },
  ],
};

/** A head appears from below the floor, looks both ways, and climbs up. */
const PEEK: Scene = {
  id: 'pool-peek', duration: 2.8, span: 0.12, roles: ['newcomer'],
  beats: [
    { at: 0.0, role: 'newcomer', moveTo: 0.5, pose: 'peek',
      smoke: { spread: 26, color: SMOKE_PURPLE } },
    { at: 1.6, role: 'newcomer', pose: 'climb' },
    { at: 2.2, role: 'newcomer', pose: 'friendly' },
  ],
};

/** Falls in from above, lands hard, gets up and waves. */
const DROP: Scene = {
  id: 'pool-drop', duration: 2.6, span: 0.12, roles: ['newcomer'],
  beats: [
    { at: 0.0, role: 'newcomer', moveTo: 0.5, pose: 'fall' },
    { at: 0.7, role: 'newcomer', pose: 'spent', smoke: { spread: 26 } },
    { at: 1.5, role: 'newcomer', pose: 'shrug' },
    { at: 2.1, role: 'newcomer', pose: 'friendly' },
  ],
};

export const POOL: Scene[] = [STUMBLE, TRIP, PEEK, DROP];

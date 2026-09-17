import type { Scene } from './types';

/**
 * 25% on a phone: the crowd notices, and there is no tree.
 *
 * A phone band has no horizontal room for a trunk beside a crowd, so the tree is cut (spec,
 * "Mobile -- the reduced room"). But cutting the MILESTONE with it would leave a phone player
 * with nothing but pool entrances for the rest of a collection, and the tree is the only
 * milestone set piece in this spec. Same beat in the progression, different staging: the room
 * gathers loosely and runs the celebration it already knows.
 *
 * Not anchored. There is nothing fixed to stand next to -- that is the whole difference.
 *
 * Neither role is called `newcomer`, for the same reason as TREE_MILESTONE: `startScene` owns
 * that name and fills it itself, so a role by it cannot be cast from the room.
 */
export const TREE_MILESTONE_MOBILE: Scene = {
  id: 'milestone-mobile',
  duration: 4.4,
  // Wider than the desktop set piece as a FRACTION, because a phone band is narrow: a quarter
  // of 340px is not enough floor for two bobits to walk together and slap hands.
  span: 0.44,
  roles: ['admirer', 'witness'],
  beats: [
    { at: 0.0, role: 'admirer', moveTo: 0.5, pose: 'stroll', path: 'walk' },
    { at: 0.0, role: 'witness', moveTo: 0.38, pose: 'stroll', path: 'walk' },

    { at: 1.3, role: 'admirer', pose: 'cheer' },
    { at: 1.5, role: 'witness', pose: 'cheer' },

    // Paired hands. R and L reach towards each other; two of the same hand miss entirely.
    { at: 2.4, role: 'admirer', pose: 'highfive', hand: 'R' },
    { at: 2.4, role: 'witness', pose: 'highfive', hand: 'L' },

    { at: 3.4, role: 'admirer', pose: 'friendly', moveTo: 0.72, path: 'walk' },
    { at: 3.5, role: 'witness', pose: 'friendly', moveTo: 0.16, path: 'walk' },
  ],
};

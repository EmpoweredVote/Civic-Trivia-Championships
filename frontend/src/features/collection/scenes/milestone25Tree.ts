import { SMOKE_PURPLE } from '../../../components/bobbits/rigExtras';
import type { Scene } from './types';

/**
 * 25% of a collection: the tree arrives.
 *
 * The TREE IS NOT IN THIS SCENE. It is room-owned and grows on its own clock the moment the
 * milestone latches (see treePlacement.TREE_GROW_SEC), because a permanent structure has no
 * business inside a transient Scene -- the scene would end and take it away again, the way a
 * cannon leaves with its shot.
 *
 * What is choreographed here is the ROOM NOTICING: two bobits drift over, look up, and present
 * at it. The climbing is not scripted either; `assignPerch` sends somebody up on its own once
 * the branch exists, and scripting it as well would put two bobits on a one-bobit branch.
 *
 * NEITHER role is called `newcomer`, deliberately. `startScene` hardcodes
 * `cast.newcomer = newcomerId` and applies `castOverrides` only to the OTHER roles, so a role
 * by that name can never be filled from the room -- it would be a synthetic id rendered as an
 * orphan, which is the phantom host this branch already removed once. This scene has no arrival
 * in it: both parts are played by bobits who already live here, so both must be castable.
 *
 * Reserves the right quarter, which is where the trunk is.
 */
export const TREE_MILESTONE: Scene = {
  id: 'milestone-tree',
  duration: 7.0,
  span: 0.25,
  // The trunk is on the right border and these two walk over to admire it. Without this the
  // director packs the scene from the left and they present at an empty stretch of floor.
  anchor: 'right',
  roles: ['admirer', 'witness'],
  beats: [
    // A puff at the foot of the trunk as the sapling breaks ground.
    { at: 0.0, role: 'admirer', moveTo: 0.72, pose: 'stroll', path: 'walk',
      smoke: { spread: 34, color: SMOKE_PURPLE } },
    { at: 0.0, role: 'witness', moveTo: 0.34, pose: 'stroll', path: 'walk' },

    // Both look up at it while it grows.
    { at: 2.0, role: 'admirer', pose: 'ponder' },
    { at: 2.2, role: 'witness', pose: 'ponder' },

    // And present it, a beat apart so it does not read as a drill.
    { at: 3.4, role: 'admirer', pose: 'present' },
    { at: 3.8, role: 'witness', pose: 'present' },

    // Then back to their business, WALKING, so nobody teleports out of the scene.
    { at: 5.4, role: 'admirer', pose: 'friendly', moveTo: 0.86, path: 'walk' },
    { at: 5.6, role: 'witness', pose: 'friendly', moveTo: 0.12, path: 'walk' },
  ],
};

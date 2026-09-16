import { SWIRL } from './arrival01Swirl';
import { CANNON } from './arrival02Cannon';
import { POOL } from './poolEntrances';
import { TREE_MILESTONE } from './milestone25Tree';
import type { Scene } from './types';
import type { Rand } from '../../../components/bobbits/wanderReducer';

export { SWIRL, CANNON, POOL, TREE_MILESTONE };
export type { Scene };

/**
 * Every scene there is, for the dev replay route and for validation.
 *
 * `TREE_MILESTONE` is in here but deliberately NOT in `sceneForArrival`: it is not an arrival,
 * it fires when a collection crosses 25%.
 */
export const ALL_SCENES: Scene[] = [SWIRL, CANNON, ...POOL, TREE_MILESTONE];

/**
 * Which entrance a given arrival gets.
 *
 * `ordinal` is how many bobits the player ALREADY had in this collection when this one was
 * granted, so 0 is the very first the collection has ever given them. It is per collection and
 * for the lifetime of their progress, not per session: a returning player with forty already
 * owned is at ordinal 40, and must not be shown forty cannon shots on page load.
 */
export function sceneForArrival(ordinal: number, rand: Rand): Scene {
  if (ordinal <= 0) return SWIRL;
  if (ordinal === 1) return CANNON;
  return POOL[Math.floor(rand() * POOL.length) % POOL.length];
}

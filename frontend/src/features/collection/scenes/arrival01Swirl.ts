import { SMOKE_PURPLE } from '../../../components/bobbits/rigExtras';
import type { Scene } from './types';

/**
 * Arrival #1: the first bobit a collection ever gives you.
 *
 * Purple smoke gathers around nothing at all, a flash, and he is THERE -- splayed as if held
 * out by both arms and both legs. He drops, lands in a heap, picks himself up and turns about
 * working out where he is, spots you through the monitor and waves, then wanders off still
 * scratching his head.
 *
 * Fires once per collection for the lifetime of a player's progress. Without the dev replay
 * route there is no way to see it a second time.
 *
 * Remember every beat means "from here onward", movement included.
 */
export const SWIRL: Scene = {
  id: 'swirl',
  duration: 4.2,
  span: 0.22,
  roles: ['newcomer'],
  beats: [
    // Smoke gathers around nobody. He is not drawn yet.
    { at: 0.0, role: 'newcomer', moveTo: 0.5, hidden: true,
      smoke: { spread: 26, color: SMOKE_PURPLE } },
    { at: 0.35, role: 'newcomer', smoke: { spread: 40, color: SMOKE_PURPLE } },
    { at: 0.7, role: 'newcomer', smoke: { spread: 52, color: SMOKE_PURPLE } },

    // Flash, and he is hanging there, stretched by all four limbs.
    { at: 1.0, role: 'newcomer', flash: true, hidden: false, pose: 'splayed' },

    // Dropped. Lands badly.
    { at: 1.6, role: 'newcomer', pose: 'spent' },

    // Picks himself up and works out where on earth he is.
    { at: 2.2, role: 'newcomer', pose: 'confused' },

    // Sees you, through the monitor.
    { at: 3.0, role: 'newcomer', pose: 'greet' },

    // Wanders off, none the wiser. Walks from here to the end of the scene.
    { at: 3.6, role: 'newcomer', pose: 'ponder', moveTo: 0.78, path: 'walk' },
  ],
};

import { SMOKE_PURPLE } from '../../../components/bobbits/rigExtras';
import type { Scene } from './types';

/**
 * Arrival #2: the cannon.
 *
 * The host sees smoke gathering beside him and gets excited -- a friend is coming. It is not a
 * friend. It is a cannon, pointed at the far wall. He scratches his head at it, walks round the
 * back, finds the string, and pulls. The newcomer erupts from the muzzle flailing, arcs the
 * length of the room OVER THE QUESTION CARD, and lands in a heap. The cannon poofs away in
 * purple smoke. The host works out what he has just done, throws his hands over his head, runs
 * the length of the room, and they high-five.
 *
 * The flight is the one thing in this app allowed to pass in front of the question card, under
 * the four bounds in the spec's 2026-09-14 addendum: transient, reveal phase only, pointer
 * events off, set pieces only.
 *
 * EVERY beat means "from here onward". The flight beat is therefore the one that carries
 * `path: 'arc'`, `arcPeak` AND `layer: 'air'` -- putting the layer on the landing beat instead
 * would switch canvases at the instant he touches down, which is exactly the bug the format's
 * first draft invited.
 */
export const CANNON: Scene = {
  id: 'cannon',
  duration: 10.6,
  span: 0.85,
  roles: ['host', 'newcomer'],
  beats: [
    { at: 0.0, role: 'host', pose: 'standstill', moveTo: 0.1 },
    { at: 0.0, role: 'newcomer', moveTo: 0.14, hidden: true,
      smoke: { spread: 26, color: SMOKE_PURPLE } },
    { at: 0.4, role: 'newcomer', smoke: { spread: 42, color: SMOKE_PURPLE } },

    // He reads it as a friend arriving, and paces about, delighted.
    { at: 0.8, role: 'host', pose: 'cheer' },
    { at: 1.2, role: 'host', pose: 'scurry', moveTo: 0.03, path: 'run' },

    // Flash. It is not a bobit. It is a cannon, aimed at the far wall.
    { at: 1.6, role: 'newcomer', flash: true, prop: { kind: 'cannon', angle: -34 } },

    // He stops and considers it.
    { at: 2.0, role: 'host', pose: 'ponder', moveTo: 0.07, path: 'walk' },

    // Walks round behind it, and finds the string.
    { at: 3.2, role: 'host', pose: 'stroll', moveTo: 0.0, path: 'walk' },
    { at: 4.0, role: 'host', pose: 'heave' },

    // FIRE. Out of the muzzle, flailing, up over the card and down the far end. This beat
    // carries the flight: arc, peak and the switch to the overlay, all from here.
    { at: 4.3, role: 'newcomer', hidden: false, pose: 'flail', moveTo: 0.95,
      // arcPeak MEASURED BY SCREENSHOT, 2026-09-14. At 240 the apex landed on the Next button,
      // which is over a control but not over the question. 330 carries him across the card
      // itself, which is the shot the scene is for.
      path: 'arc', arcPeak: 330, layer: 'air', smoke: { spread: 58 } },

    // Lands in a heap, back on the floor and back on the band's own canvas.
    { at: 5.9, role: 'newcomer', pose: 'spent', layer: 'ground' },

    // The cannon poofs away.
    { at: 6.1, role: 'host', prop: null, smoke: { spread: 44, color: SMOKE_PURPLE } },

    // The host realises what he has just done.
    { at: 6.4, role: 'host', pose: 'presentup' },

    // And runs the length of the room to him.
    { at: 7.0, role: 'host', pose: 'scurry', moveTo: 0.86, path: 'run' },

    // The newcomer picks himself up. They celebrate.
    { at: 8.6, role: 'newcomer', pose: 'cheer' },
    { at: 9.0, role: 'host', pose: 'cheer' },

    // High five. Opposite hands, so each reaches toward the other.
    { at: 9.8, role: 'host', pose: 'highfive', hand: 'R' },
    { at: 9.8, role: 'newcomer', pose: 'highfive', hand: 'L' },

    // Released back to their own business.
    { at: 10.4, role: 'host', pose: 'standstill', layer: 'ground' },
    { at: 10.4, role: 'newcomer', pose: 'standstill', layer: 'ground' },
  ],
};

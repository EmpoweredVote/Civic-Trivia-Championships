/**
 * A scene is DATA, not code.
 *
 * Every set piece is a list of timed beats. The director interprets them; the scene files say
 * nothing about canvases, agents or React. That is what lets a cannon shot be a deterministic
 * unit test rather than something you have to sit and watch, and it is what makes adding the
 * "large library of random entrances" a matter of dropping files in this folder.
 */

/** Which canvas a figure is on. `air` is the overlay that may pass in front of the card. */
export type SceneLayer = 'ground' | 'air';

export const ROLE_HOST = 'host';
export const ROLE_NEWCOMER = 'newcomer';

/**
 * One instruction on a role's timeline.
 *
 * EVERY field means "from this beat onward", movement included: a beat carrying `moveTo`
 * STARTS a journey there, arriving by that role's next beat (or by the scene's end if it has
 * none). Write the beat at the moment the action BEGINS, not the moment it finishes.
 *
 * Worth stating because the first draft got it wrong in the other direction -- pose was "from
 * here" while `moveTo` was "arrive by here" -- and the very first scene written against it put
 * `layer: 'air'` on the beat where the bobit LANDS.
 */
export interface Beat {
  /** Seconds from the scene's start. The moment this instruction takes effect. */
  at: number;
  /** Which role this beat commands. */
  role: string;
  /** Rig animation key to play from this beat until a later one changes it. */
  pose?: string;
  /** Pose variant, for per-side poses like `highfive`. */
  hand?: 'R' | 'L';
  /**
   * Where to head, as a fraction 0-1 of the scene's OWN span, not of the band. A scene that
   * reserves the middle third still writes 0 and 1 for its own ends.
   */
  moveTo?: number;
  /**
   * How to get there, over the time until this role's next beat. Omitted (or `snap`) arrives
   * instantly. `arc` is the only one that leaves the ground.
   */
  path?: 'snap' | 'walk' | 'run' | 'arc';
  /** Peak height of an `arc`, in px above the ground line. Ignored for every other path. */
  arcPeak?: number;
  /**
   * Where this leg BEGINS, when that is not the ground line.
   *
   * `muzzle` starts it at the mouth of the cannon this scene placed, and the displacement
   * decays to nothing over the leg -- so the journey is a straight line from the muzzle to the
   * landing point, with the arc's lift on top. Without it a bobit fired from a cannon leaves
   * from the floor UNDER the barrel and appears out of thin air beside it, which is the one
   * thing the whole set piece exists to avoid.
   */
  from?: 'muzzle';
  /** Which canvas to draw on from this beat onward. */
  layer?: SceneLayer;
  /** A puff of smoke at this role's position. */
  smoke?: { spread: number; color?: string };
  /** A white flash at this role's position. */
  flash?: boolean;
  /** Place (or with null, remove) a prop at this role's position. */
  prop?: { kind: 'cannon'; angle: number } | null;
  /** Hide this role's figure from here on -- used between the smoke and the flash. */
  hidden?: boolean;
}

export interface Scene {
  id: string;
  /** Seconds. The director releases every cast member when this elapses. */
  duration: number;
  /**
   * Fraction of the band's width this scene needs, 0-1. Two running scenes may never overlap
   * in reserved span.
   */
  span: number;
  /**
   * Which end of the band to reserve from. Left by default.
   *
   * Only matters for a scene tied to a fixed piece of scenery. The milestone's bobits walk over
   * and present at the TREE, which stands on the right border -- packed from the left they
   * admire an empty stretch of floor, which is exactly what the first scene sheet showed.
   */
  anchor?: 'left' | 'right';
  /** Roles this scene casts. `newcomer` is always the arriving bobit. */
  roles: string[];
  beats: Beat[];
}

/**
 * The crowd's choreography, as a pure state machine.
 *
 * Same shape as gameReducer.ts: a reducer for discrete events plus a step function for time.
 * Nothing here touches a canvas, a timer or React, so all of it is unit-testable and the
 * per-frame path stays outside the React render cycle entirely.
 */

import { slotOrder } from './crowdIdentity';
import { RIPPLE_DUR } from './crowdReactions';

/** Seconds a newcomer spends walking in and waving before he settles. */
export const ARRIVAL_DUR = 1.1;
/**
 * Seconds the room celebrates a correct answer: cheer, clap, high-five.
 * MUST match HIGHFIVE_UNTIL in crowdReactions -- that module decides the poses, this one
 * decides how long they run, and a mismatch either truncates the chain or holds a dead pose.
 */
export const CELEBRATE_DUR = 2.4;

// The loss sequence, from the spec: rise, burst, ~0.8s freeze, then look around and shrug,
// with everyone back to normal inside ~2.5s of the burst.
export const LOSS_RISE = 0.9;
export const LOSS_BURST = 0.6;
export const LOSS_STUN = 0.8;
export const LOSS_RECOVER = 1.7;

export type LossPhase = 'rising' | 'burst' | 'stunned' | 'recovering';

export interface CrowdState {
  /** Question ids present in the room, including a victim who has not burst yet. */
  residents: string[];
  /**
   * Whose answer this celebration is for. That bobit celebrates harder than the room around
   * him -- the spec's "steps forward and celebrates personally" -- which is the only thing
   * distinguishing a repeat correct answer from a brand new arrival.
   */
  celebrant: string | null;
  /** Newcomers mid-arrival: id -> seconds elapsed. */
  arriving: Record<string, number>;
  /** Celebration tier 0-5. 0 means nobody is celebrating. */
  celebrating: number;
  celebrateT: number;
  loss: { id: string; phase: LossPhase; t: number } | null;
  /**
   * A miss that cost nothing. The room reacts from `from`'s position outward, but nobody is
   * taken. Distinct from `loss`, which is the abduction.
   */
  ripple: { from: string; t: number } | null;
}

export type CrowdEvent =
  | { type: 'seed'; ids: string[] }
  | { type: 'correct'; id: string; streak: number }
  | { type: 'wrong'; id: string }
  | { type: 'reset' };

export function crowdInit(): CrowdState {
  return {
    residents: [], arriving: {}, celebrant: null, celebrating: 0, celebrateT: 0,
    loss: null, ripple: null,
  };
}

export function crowdApply(state: CrowdState, event: CrowdEvent): CrowdState {
  switch (event.type) {
    case 'reset':
      return crowdInit();

    case 'seed':
      // Replaces rather than merges: seeding happens when a match starts, and the previous
      // match may have been a different collection entirely.
      return { ...crowdInit(), residents: [...event.ids] };

    case 'correct': {
      const known = state.residents.includes(event.id);
      return {
        ...state,
        residents: known ? state.residents : [...state.residents, event.id],
        // A question already owned spawns nobody -- his own bobit steps forward instead.
        arriving: known ? state.arriving : { ...state.arriving, [event.id]: 0 },
        celebrant: event.id,
        celebrating: Math.min(5, Math.max(1, event.streak)),
        celebrateT: 0,
      };
    }

    case 'wrong': {
      // A question the player actually owned costs him that bobit. One loss at a time: a
      // second would fight the first for the room's attention.
      if (state.residents.includes(event.id)) {
        if (state.loss) return state;
        return {
          ...state,
          celebrating: 0, celebrateT: 0, celebrant: null, ripple: null,
          loss: { id: event.id, phase: 'rising', t: 0 },
        };
      }
      // A miss on a question he never owned takes nothing -- but the room still notices, or a
      // new player's first match passes with no reaction to anything at all.
      if (state.loss || !state.residents.length) return state;
      return {
        ...state,
        celebrating: 0, celebrateT: 0, celebrant: null,
        ripple: { from: slotOrder(state.residents)[0], t: 0 },
      };
    }
  }
}

export function crowdStep(state: CrowdState, dt: number): CrowdState {
  const next: CrowdState = { ...state };

  // arrivals
  if (Object.keys(state.arriving).length) {
    const arriving: Record<string, number> = {};
    for (const id of Object.keys(state.arriving)) {
      const t = state.arriving[id] + dt;
      if (t < ARRIVAL_DUR) arriving[id] = t;
    }
    next.arriving = arriving;
  }

  // celebration
  if (state.celebrating > 0) {
    const t = state.celebrateT + dt;
    if (t >= CELEBRATE_DUR) { next.celebrating = 0; next.celebrateT = 0; next.celebrant = null; }
    else next.celebrateT = t;
  }

  // ripple
  if (state.ripple) {
    const t = state.ripple.t + dt;
    next.ripple = t >= RIPPLE_DUR ? null : { ...state.ripple, t };
  }

  // loss
  if (state.loss) {
    const t = state.loss.t + dt;
    const { id, phase } = state.loss;
    if (phase === 'rising' && t >= LOSS_RISE) {
      // He leaves the room at the burst, not before -- until then he is still drawn, rising.
      next.residents = next.residents.filter(r => r !== id);
      next.loss = { id, phase: 'burst', t: 0 };
    } else if (phase === 'burst' && t >= LOSS_BURST) {
      next.loss = { id, phase: 'stunned', t: 0 };
    } else if (phase === 'stunned' && t >= LOSS_STUN) {
      next.loss = { id, phase: 'recovering', t: 0 };
    } else if (phase === 'recovering' && t >= LOSS_RECOVER) {
      next.loss = null;
    } else {
      next.loss = { id, phase, t };
    }
  }

  return next;
}

/** The room is frozen: pinned mid-pose for the beat after somebody vanishes. */
export function isStunned(state: CrowdState): boolean {
  return state.loss?.phase === 'stunned';
}

/**
 * The poof, ported from ev-figures.js (POOF constants at :230, poofTick at :1455).
 *
 * Hold the right mouse button on a Bobit for three seconds: smoke gathers, he is lifted, he
 * bursts. Then the room freezes for a beat and bolts. Release early and it fizzles -- the
 * smoke thins out and he picks himself back up, nobody vanishes.
 *
 * Phases: idle -> holding -> poof -> stunned -> fleeing -> cleared,
 *         with holding -> fizzle -> idle as the cancel branch.
 */

// Timings from ev-figures.js:230, plus the 0.4s fizzle branch in poofTick.
export const POOF_HOLD = 3.0;
export const POOF_BURST = 0.6;
export const POOF_STUN = 1.0;
export const POOF_FIZZLE = 0.4;

export type PoofPhase =
  | 'idle' | 'holding' | 'poof' | 'stunned' | 'fleeing' | 'cleared' | 'fizzle';

export interface PoofState {
  phase: PoofPhase;
  t: number;
  victimId: string | null;
  /**
   * Press point as a fraction of the victim's bounds. The smoke is re-projected through his
   * live bounds every frame, so it sits on the figure the user actually grabbed rather than
   * on the centre of a box he may not be standing in the middle of. Fractions rather than px
   * so a resize cannot strand the cloud.
   */
  fx: number;
  fy: number;
  /** He is off the field; the smoke holds his last spot instead of following his bounds. */
  taken: boolean;
}

export const POOF_IDLE: PoofState = {
  phase: 'idle', t: 0, victimId: null, fx: 0.5, fy: 1, taken: false,
};

export type PoofEvent =
  | { type: 'grab'; id: string; fx: number; fy: number }
  | { type: 'release' }
  | { type: 'tick'; dt: number }
  | { type: 'allGone' };

export function poofReduce(state: PoofState, event: PoofEvent): PoofState {
  switch (event.type) {
    case 'grab':
      if (state.phase !== 'idle') return state;
      return { phase: 'holding', t: 0, victimId: event.id, fx: event.fx, fy: event.fy, taken: false };

    case 'release':
      // Only a hold can be cancelled. Once the burst has fired he is gone, and letting go of
      // the mouse afterwards must not resurrect him.
      if (state.phase !== 'holding') return state;
      return { ...state, phase: 'fizzle', t: 0 };

    case 'allGone':
      if (state.phase !== 'fleeing') return state;
      return { ...state, phase: 'cleared', t: 0 };

    case 'tick': {
      if (state.phase === 'idle' || state.phase === 'cleared') return state;
      const t = state.t + event.dt;

      if (state.phase === 'holding' && t >= POOF_HOLD) {
        return { ...state, phase: 'poof', t: 0, taken: true };
      }
      if (state.phase === 'poof' && t >= POOF_BURST) {
        return { ...state, phase: 'stunned', t: 0 };
      }
      if (state.phase === 'stunned' && t >= POOF_STUN) {
        return { ...state, phase: 'fleeing', t: 0 };
      }
      if (state.phase === 'fizzle' && t >= POOF_FIZZLE) {
        return { ...POOF_IDLE };
      }
      return { ...state, t };
    }
  }
}

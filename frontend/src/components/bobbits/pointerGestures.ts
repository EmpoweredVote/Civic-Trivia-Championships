import type { PoofEvent } from './poofReducer';

/**
 * Turns raw pointer events into PoofEvents.
 *
 * Kept separate from the poof reducer because the mouse and touch rules differ and both are
 * fiddly. The mouse arms instantly on the right button; touch cannot, because every tap would
 * then start smoke.
 */

/**
 * How long a finger must rest on a Bobit before the hold begins. ev-figures.js used to call
 * poofStart on touchstart, so smoke began the instant you touched one and every tap looked
 * like the start of a destruction. Arm on a timer instead: lift before this and nothing
 * poof-related ever happened.
 */
export const TOUCH_ARM_MS = 300;

/** How far the finger may drift before the hold is treated as a scroll instead. */
export const HOLD_SLOP = 12;

export interface GestureState {
  armed: boolean;
  startX: number;
  startY: number;
  touchArmedAt: number | null;
  /** Who the finger landed on, held until the arming delay elapses. */
  pending: { id: string; fx: number; fy: number } | null;
}

export const GESTURE_IDLE: GestureState = {
  armed: false, startX: 0, startY: 0, touchArmedAt: null, pending: null,
};

export type GestureInput =
  | { kind: 'mousedown'; button: number; x: number; y: number; id: string | null; fx: number; fy: number }
  | { kind: 'mouseup'; button: number }
  | { kind: 'touchstart'; touches: number; x: number; y: number; id: string | null; fx: number; fy: number; now: number }
  | { kind: 'touchmove'; x: number; y: number; touches: number; now: number }
  | { kind: 'touchend' }
  | { kind: 'cancel' };

interface Result { state: GestureState; emit: PoofEvent | null; }

/**
 * Ends any gesture. Only emits a release if a hold was actually armed -- a tap that never
 * reached TOUCH_ARM_MS never grabbed anyone, so releasing would be a message about nothing.
 */
function released(state: GestureState): Result {
  if (!state.armed && state.touchArmedAt === null) return { state, emit: null };
  return { state: { ...GESTURE_IDLE }, emit: state.armed ? { type: 'release' } : null };
}

export function gestureReduce(state: GestureState, input: GestureInput): Result {
  switch (input.kind) {
    case 'mousedown':
      if (input.button !== 2 || !input.id) return { state, emit: null };
      return {
        state: { armed: true, startX: input.x, startY: input.y, touchArmedAt: null, pending: null },
        emit: { type: 'grab', id: input.id, fx: input.fx, fy: input.fy },
      };

    case 'mouseup':
      if (input.button !== 2) return { state, emit: null };
      return released(state);

    case 'touchstart':
      if (input.touches !== 1 || !input.id) return { state: { ...GESTURE_IDLE }, emit: null };
      return {
        state: {
          armed: false, startX: input.x, startY: input.y,
          touchArmedAt: input.now,
          pending: { id: input.id, fx: input.fx, fy: input.fy },
        },
        emit: null,
      };

    case 'touchmove': {
      if (state.touchArmedAt === null) return { state, emit: null };
      if (input.touches !== 1) return { state: { ...GESTURE_IDLE }, emit: null };

      const dx = Math.abs(input.x - state.startX);
      const dy = Math.abs(input.y - state.startY);
      if (dx > HOLD_SLOP || dy > HOLD_SLOP) return { state: { ...GESTURE_IDLE }, emit: null };

      if (!state.armed && input.now - state.touchArmedAt >= TOUCH_ARM_MS && state.pending) {
        return { state: { ...state, armed: true }, emit: { type: 'grab', ...state.pending } };
      }
      return { state, emit: null };
    }

    case 'touchend':
    case 'cancel':
      return released(state);
  }
}

/**
 * Firefox fires contextmenu on mousedown (mid-hold), Chrome on mouseup (as the gag lands).
 * Suppressing it unconditionally would break right-click everywhere else on the page, so it
 * is gated on a hold actually being armed.
 */
export function shouldSuppressContextMenu(state: GestureState): boolean {
  return state.armed;
}

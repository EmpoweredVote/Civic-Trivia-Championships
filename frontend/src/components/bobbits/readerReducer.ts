/**
 * The seated reader's interaction machine, ported from ev-figures.js's drawReader
 * (ev-figures.js:3502-3560) and the contract documented above it (3128-3134):
 *
 *   hover  -> he lifts his head off the page but keeps hold of the book
 *   click  -> he sits up, lowers the book into his lap, and a bubble opens with his quote
 *   click  -> back to the book
 *
 * read --click--> lookup --(QUOTE_TRANS)--> hold --click--> resume --(QUOTE_TRANS)--> read
 *
 * Hover only ever drives `glance`, a 0-1 ramp within `read`. That separation is the point of
 * the rework: hovering acknowledges you, clicking is what makes him speak.
 */

/** Seconds to cross between reading and holding, either direction. */
export const QUOTE_TRANS = 0.5;

/** Seconds for the hover glance to ramp fully in or out. */
export const QUOTE_GLANCE = 0.35;

export type ReaderPhase = 'read' | 'lookup' | 'hold' | 'resume';

export interface ReaderState {
  phase: ReaderPhase;
  /** Seconds spent in the current phase. */
  t: number;
  /** 0-1 hover glance, only meaningful during `read`. */
  glance: number;
}

export const READER_IDLE: ReaderState = { phase: 'read', t: 0, glance: 0 };

export type ReaderEvent =
  | { type: 'tick'; dt: number; hovering: boolean }
  | { type: 'click' }
  | { type: 'dismiss' };

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function readerReduce(state: ReaderState, ev: ReaderEvent): ReaderState {
  if (ev.type === 'click') {
    // Only the settled states take a click. A click mid-transition is dropped rather than
    // queued -- ev-figures.js returns early for exactly this, and reversing halfway through
    // the lerp looks like a glitch.
    if (state.phase === 'read') return { phase: 'lookup', t: 0, glance: state.glance };
    if (state.phase === 'hold') return { phase: 'resume', t: 0, glance: 0 };
    return state;
  }

  if (ev.type === 'dismiss') {
    if (state.phase === 'hold') return { phase: 'resume', t: 0, glance: 0 };
    return state;
  }

  const { dt, hovering } = ev;
  const t = state.t + dt;

  switch (state.phase) {
    case 'read': {
      const step = dt / QUOTE_GLANCE;
      return { phase: 'read', t, glance: clamp01(state.glance + (hovering ? step : -step)) };
    }
    case 'lookup':
      return t >= QUOTE_TRANS
        ? { phase: 'hold', t: 0, glance: 0 }
        : { ...state, t };
    case 'hold':
      return { ...state, t };
    case 'resume':
      return t >= QUOTE_TRANS
        ? { phase: 'read', t: 0, glance: 0 }
        : { ...state, t };
  }
}

/** The bubble is open exactly while he is sitting up holding the book in his lap. */
export function bubbleOpen(state: ReaderState): boolean {
  return state.phase === 'hold';
}

/**
 * Whether the book is still in his hands. It drops into the lap once the look-up is more than
 * half done, matching the old component's `hoverAmount < 0.5` handoff.
 */
export function showBook(state: ReaderState): boolean {
  if (state.phase === 'read') return true;
  if (state.phase === 'lookup') return state.t < QUOTE_TRANS / 2;
  if (state.phase === 'resume') return state.t >= QUOTE_TRANS / 2;
  return false;
}

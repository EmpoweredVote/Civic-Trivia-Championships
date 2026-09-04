/**
 * Speech-bubble lifetimes.
 *
 * A bubble is opened against a figure's id, lives for BUBBLE_TTL seconds, and then expires on
 * its own. Dismissal is explicit for the cases that must not wait out the clock -- notably the
 * poof, where ev-figures.js calls dismissBubbles() at the burst with a comment recording why:
 * a closed bubble that leaves a dangling handle on its Bobit means he never goes back to what
 * he was doing.
 */

/** Seconds a bubble stays up before its reader goes back to his book. From ev-figures.js. */
export const BUBBLE_TTL = 12;

export type BubbleState = Record<string, { text: string; ttl: number }>;

export type BubbleEvent =
  | { type: 'open'; id: string; text: string }
  | { type: 'dismiss'; id: string }
  | { type: 'dismissAll' }
  | { type: 'tick' };

export function bubbleReduce(state: BubbleState, event: BubbleEvent, dt: number): BubbleState {
  switch (event.type) {
    case 'open':
      return { ...state, [event.id]: { text: event.text, ttl: BUBBLE_TTL } };

    case 'dismiss': {
      const next = { ...state };
      delete next[event.id];
      return next;
    }

    case 'dismissAll':
      return {};

    case 'tick': {
      const next: BubbleState = {};
      for (const id of Object.keys(state)) {
        const ttl = state[id].ttl - dt;
        if (ttl > 0) next[id] = { text: state[id].text, ttl };
      }
      return next;
    }
  }
}

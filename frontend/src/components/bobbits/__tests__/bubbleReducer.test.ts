import { describe, it, expect } from 'vitest';
import { bubbleReduce, BUBBLE_TTL } from '../dialogue/bubbleReducer';

describe('bubbleReduce', () => {
  it('opens a bubble with a full lifetime', () => {
    const s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    expect(s.a.text).toBe('hi');
    expect(s.a.ttl).toBe(BUBBLE_TTL);
  });

  it('expires a bubble after its lifetime', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'tick' }, BUBBLE_TTL + 0.01);
    expect(s.a).toBeUndefined();
  });

  it('keeps a bubble alive before its lifetime is up', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'tick' }, BUBBLE_TTL - 0.5);
    expect(s.a).toBeDefined();
  });

  it('dismisses one bubble by id', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'open', id: 'b', text: 'yo' }, 0);
    s = bubbleReduce(s, { type: 'dismiss', id: 'a' }, 0);
    expect(s.a).toBeUndefined();
    expect(s.b).toBeDefined();
  });

  it('dismisses every bubble at once', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'open', id: 'b', text: 'yo' }, 0);
    s = bubbleReduce(s, { type: 'dismissAll' }, 0);
    expect(Object.keys(s)).toEqual([]);
  });

  it('re-opening resets the lifetime', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    s = bubbleReduce(s, { type: 'tick' }, BUBBLE_TTL - 0.5);
    s = bubbleReduce(s, { type: 'open', id: 'a', text: 'again' }, 0);
    expect(s.a.ttl).toBe(BUBBLE_TTL);
    expect(s.a.text).toBe('again');
  });

  it('expires each bubble on its own schedule', () => {
    let s = bubbleReduce({}, { type: 'open', id: 'early', text: 'first' }, 0);
    s = bubbleReduce(s, { type: 'tick' }, BUBBLE_TTL - 1);
    s = bubbleReduce(s, { type: 'open', id: 'late', text: 'second' }, 0);
    s = bubbleReduce(s, { type: 'tick' }, 1.5);
    expect(s.early).toBeUndefined();
    expect(s.late).toBeDefined();
  });

  it('does not mutate the previous state', () => {
    const s0 = bubbleReduce({}, { type: 'open', id: 'a', text: 'hi' }, 0);
    bubbleReduce(s0, { type: 'tick' }, 1);
    expect(s0.a.ttl).toBe(BUBBLE_TTL);
  });
});

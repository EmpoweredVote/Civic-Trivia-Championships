import { describe, it, expect } from 'vitest';
import {
  readerReduce, bubbleOpen, showBook, READER_IDLE, QUOTE_TRANS, QUOTE_GLANCE,
} from '../readerReducer';
import type { ReaderState } from '../readerReducer';

const tick = (s: ReaderState, dt: number, hovering = false) =>
  readerReduce(s, { type: 'tick', dt, hovering });

describe('readerReduce — glance on hover', () => {
  it('starts reading with no glance', () => {
    expect(READER_IDLE.phase).toBe('read');
    expect(READER_IDLE.glance).toBe(0);
  });

  it('ramps the glance while hovered', () => {
    const s = tick(READER_IDLE, QUOTE_GLANCE / 2, true);
    expect(s.glance).toBeGreaterThan(0);
    expect(s.glance).toBeLessThan(1);
  });

  it('reaches a full glance and clamps there', () => {
    let s = tick(READER_IDLE, QUOTE_GLANCE, true);
    s = tick(s, QUOTE_GLANCE, true);
    expect(s.glance).toBe(1);
  });

  it('ramps back down when the cursor leaves', () => {
    let s = tick(READER_IDLE, QUOTE_GLANCE, true);
    s = tick(s, QUOTE_GLANCE / 2, false);
    expect(s.glance).toBeLessThan(1);
    expect(s.glance).toBeGreaterThan(0);
  });

  it('clamps the glance at zero', () => {
    let s = tick(READER_IDLE, QUOTE_GLANCE, true);
    s = tick(s, QUOTE_GLANCE * 4, false);
    expect(s.glance).toBe(0);
  });

  it('never opens a bubble from hover alone', () => {
    let s = tick(READER_IDLE, QUOTE_GLANCE, true);
    s = tick(s, QUOTE_GLANCE, true);
    expect(bubbleOpen(s)).toBe(false);
  });

  it('keeps the book in hand while glancing', () => {
    const s = tick(READER_IDLE, QUOTE_GLANCE, true);
    expect(showBook(s)).toBe(true);
  });
});

describe('readerReduce — click to speak', () => {
  it('a click starts the look-up', () => {
    const s = readerReduce(READER_IDLE, { type: 'click' });
    expect(s.phase).toBe('lookup');
    expect(s.t).toBe(0);
  });

  it('the look-up settles into hold after the transition', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    expect(s.phase).toBe('hold');
  });

  it('the bubble opens only once held', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    expect(bubbleOpen(s)).toBe(false);
    s = tick(s, QUOTE_TRANS + 0.01);
    expect(bubbleOpen(s)).toBe(true);
  });

  it('the book goes into the lap once held', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    expect(showBook(s)).toBe(false);
  });

  it('a second click resumes reading', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    s = readerReduce(s, { type: 'click' });
    expect(s.phase).toBe('resume');
    expect(bubbleOpen(s)).toBe(false);
  });

  it('resume lands back in read', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    s = readerReduce(s, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    expect(s.phase).toBe('read');
    expect(s.glance).toBe(0);
  });

  it('ignores clicks mid-transition, as ev-figures.js does', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    const mid = tick(s, QUOTE_TRANS / 2);
    s = readerReduce(mid, { type: 'click' });
    expect(s).toEqual(mid);
  });
});

describe('readerReduce — dismissal', () => {
  it('dismiss from hold resumes reading', () => {
    let s = readerReduce(READER_IDLE, { type: 'click' });
    s = tick(s, QUOTE_TRANS + 0.01);
    s = readerReduce(s, { type: 'dismiss' });
    expect(s.phase).toBe('resume');
  });

  it('dismiss while already reading changes nothing', () => {
    const s = readerReduce(READER_IDLE, { type: 'dismiss' });
    expect(s).toEqual(READER_IDLE);
  });
});

describe('readerReduce — purity', () => {
  it('does not mutate the state it is given', () => {
    const s0 = tick(READER_IDLE, QUOTE_GLANCE / 2, true);
    const before = s0.glance;
    tick(s0, QUOTE_GLANCE / 2, true);
    expect(s0.glance).toBe(before);
  });
});

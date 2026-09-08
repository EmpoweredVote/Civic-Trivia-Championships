import { describe, it, expect } from 'vitest';
import { greetReduce, isGreeting, greetClock, GREET_LINGER } from '../greetReducer';

describe('greetReduce', () => {
  it('starts empty', () => {
    expect(isGreeting({}, 'a')).toBe(false);
  });

  it('begins greeting on first hover', () => {
    const s = greetReduce({}, 'a', 0.016);
    expect(isGreeting(s, 'a')).toBe(true);
  });

  it('advances the greet clock while hovered', () => {
    let s = greetReduce({}, 'a', 0.5);
    s = greetReduce(s, 'a', 0.5);
    expect(greetClock(s, 'a')).toBeCloseTo(1.0, 5);
  });

  it('pins linger at full while hovered', () => {
    let s = greetReduce({}, 'a', 0.5);
    s = greetReduce(s, 'a', 0.5);
    expect(s.a.linger).toBe(GREET_LINGER);
  });

  it('keeps greeting after the cursor leaves, for the linger window', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, null, 1.0);
    expect(isGreeting(s, 'a')).toBe(true);
  });

  it('stops greeting once the linger runs out', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, null, GREET_LINGER + 0.01);
    expect(isGreeting(s, 'a')).toBe(false);
  });

  it('re-arms the linger if the cursor comes back', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, null, 1.0);
    s = greetReduce(s, 'a', 0.1);
    expect(s.a.linger).toBe(GREET_LINGER);
  });

  it('keeps the greet clock running after the cursor leaves', () => {
    let s = greetReduce({}, 'a', 0.5);
    s = greetReduce(s, null, 0.5);
    expect(greetClock(s, 'a')).toBeCloseTo(1.0, 5);
  });

  it('handles two figures independently', () => {
    let s = greetReduce({}, 'a', 0.1);
    s = greetReduce(s, 'b', 0.1);
    expect(isGreeting(s, 'a')).toBe(true);
    expect(isGreeting(s, 'b')).toBe(true);
  });

  it('does not mutate the previous state', () => {
    const s0 = greetReduce({}, 'a', 0.1);
    const before = s0.a.clock;
    greetReduce(s0, 'a', 0.5);
    expect(s0.a.clock).toBe(before);
  });
});

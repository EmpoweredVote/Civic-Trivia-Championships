import { describe, it, expect } from 'vitest';
import {
  crowdInit, crowdApply, crowdStep, isStunned,
  ARRIVAL_DUR, CELEBRATE_DUR, LOSS_RISE, LOSS_BURST, LOSS_STUN, LOSS_RECOVER,
} from '../crowdReducer';

const seeded = (ids: string[]) => crowdApply(crowdInit(), { type: 'seed', ids });

describe('seeding', () => {
  it('starts empty', () => {
    expect(crowdInit().residents).toEqual([]);
  });

  it('takes the owned set as residents, already settled', () => {
    const s = seeded(['a', 'b']);
    expect(s.residents).toEqual(['a', 'b']);
    expect(Object.keys(s.arriving)).toEqual([]);
  });

  it('replaces residents rather than appending, so switching collections is clean', () => {
    const s = crowdApply(seeded(['a', 'b']), { type: 'seed', ids: ['c'] });
    expect(s.residents).toEqual(['c']);
  });
});

describe('a correct answer', () => {
  it('adds a newcomer as arriving, not settled', () => {
    const s = crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 1 });
    expect(s.residents).toContain('a');
    expect(s.arriving.a).toBe(0);
  });

  it('settles the newcomer once the arrival finishes', () => {
    let s = crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 1 });
    s = crowdStep(s, ARRIVAL_DUR + 0.01);
    expect(s.arriving.a).toBeUndefined();
    expect(s.residents).toContain('a');
  });

  it('does not duplicate a question already owned', () => {
    const s = crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 1 });
    expect(s.residents.filter(x => x === 'a').length).toBe(1);
  });

  it('still celebrates for a question already owned', () => {
    const s = crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 3 });
    expect(s.celebrating).toBe(3);
  });

  it('records whose answer the celebration is for', () => {
    expect(crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 2 }).celebrant).toBe('a');
  });

  it('clears the celebrant when the celebration ends', () => {
    let s = crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 2 });
    s = crowdStep(s, CELEBRATE_DUR + 0.01);
    expect(s.celebrant).toBeNull();
  });

  it('records the streak as the celebration tier', () => {
    expect(crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 4 }).celebrating).toBe(4);
  });

  it('clamps the tier to 5', () => {
    expect(crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 9 }).celebrating).toBe(5);
  });

  it('ends the celebration after its duration', () => {
    let s = crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 2 });
    s = crowdStep(s, CELEBRATE_DUR + 0.01);
    expect(s.celebrating).toBe(0);
  });
});

describe('a wrong answer', () => {
  it('does nothing visible for a question never owned', () => {
    const s = crowdApply(seeded(['a']), { type: 'wrong', id: 'b' });
    expect(s.loss).toBeNull();
    expect(s.residents).toEqual(['a']);
  });

  it('starts the loss sequence for a question that was owned', () => {
    const s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    expect(s.loss).toEqual({ id: 'a', phase: 'rising', t: 0 });
  });

  it('keeps the victim in residents while he rises, so he can be drawn', () => {
    const s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    expect(s.residents).toContain('a');
  });

  it('removes him at the burst', () => {
    let s = crowdApply(seeded(['a', 'b']), { type: 'wrong', id: 'a' });
    s = crowdStep(s, LOSS_RISE + 0.01);
    expect(s.loss?.phase).toBe('burst');
    expect(s.residents).not.toContain('a');
    expect(s.residents).toContain('b');
  });

  it('stuns the room after the burst', () => {
    let s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    s = crowdStep(s, LOSS_RISE + 0.01);
    s = crowdStep(s, LOSS_BURST + 0.01);
    expect(s.loss?.phase).toBe('stunned');
    expect(isStunned(s)).toBe(true);
  });

  it('recovers, then clears', () => {
    let s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    s = crowdStep(s, LOSS_RISE + 0.01);
    s = crowdStep(s, LOSS_BURST + 0.01);
    s = crowdStep(s, LOSS_STUN + 0.01);
    expect(s.loss?.phase).toBe('recovering');
    expect(isStunned(s)).toBe(false);
    s = crowdStep(s, LOSS_RECOVER + 0.01);
    expect(s.loss).toBeNull();
  });

  it('cancels any celebration in progress', () => {
    let s = crowdApply(seeded(['a']), { type: 'correct', id: 'a', streak: 3 });
    s = crowdApply(s, { type: 'wrong', id: 'a' });
    expect(s.celebrating).toBe(0);
  });

  it('ignores a second loss while one is running', () => {
    let s = crowdApply(seeded(['a', 'b']), { type: 'wrong', id: 'a' });
    s = crowdApply(s, { type: 'wrong', id: 'b' });
    expect(s.loss?.id).toBe('a');
    expect(s.residents).toContain('b');
  });
});

describe('reset', () => {
  it('clears everything', () => {
    let s = crowdApply(seeded(['a']), { type: 'correct', id: 'b', streak: 2 });
    s = crowdApply(s, { type: 'reset' });
    expect(s).toEqual(crowdInit());
  });
});

describe('purity', () => {
  it('crowdApply does not mutate the previous state', () => {
    const s0 = seeded(['a']);
    crowdApply(s0, { type: 'correct', id: 'b', streak: 1 });
    expect(s0.residents).toEqual(['a']);
  });

  it('crowdStep does not mutate the previous state', () => {
    const s0 = crowdApply(seeded([]), { type: 'correct', id: 'a', streak: 1 });
    crowdStep(s0, 5);
    expect(s0.arriving.a).toBe(0);
  });
});

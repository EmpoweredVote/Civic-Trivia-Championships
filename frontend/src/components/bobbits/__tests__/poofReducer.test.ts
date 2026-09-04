import { describe, it, expect } from 'vitest';
import {
  poofReduce, POOF_IDLE, POOF_HOLD, POOF_BURST, POOF_STUN, POOF_FIZZLE,
} from '../poofReducer';
import type { PoofState } from '../poofReducer';

const grab = (s: PoofState = POOF_IDLE) =>
  poofReduce(s, { type: 'grab', id: 'victim', fx: 0.5, fy: 0.8 });
const tick = (s: PoofState, dt: number) => poofReduce(s, { type: 'tick', dt });

describe('poofReduce', () => {
  it('starts idle', () => {
    expect(POOF_IDLE.phase).toBe('idle');
    expect(POOF_IDLE.victimId).toBeNull();
  });

  it('enters holding on grab and records the victim and press point', () => {
    const s = grab();
    expect(s.phase).toBe('holding');
    expect(s.victimId).toBe('victim');
    expect(s.fx).toBe(0.5);
    expect(s.fy).toBe(0.8);
  });

  it('ignores a second grab while already holding', () => {
    const s = poofReduce(grab(), { type: 'grab', id: 'other', fx: 0, fy: 0 });
    expect(s.victimId).toBe('victim');
  });

  it('stays holding until the full hold elapses', () => {
    const s = tick(grab(), POOF_HOLD - 0.01);
    expect(s.phase).toBe('holding');
  });

  it('bursts once the hold completes, and marks him taken', () => {
    const s = tick(grab(), POOF_HOLD);
    expect(s.phase).toBe('poof');
    expect(s.taken).toBe(true);
    expect(s.t).toBe(0);
  });

  it('goes to stunned after the burst', () => {
    const s = tick(tick(grab(), POOF_HOLD), POOF_BURST);
    expect(s.phase).toBe('stunned');
  });

  it('goes to fleeing after the stun', () => {
    let s = tick(grab(), POOF_HOLD);
    s = tick(s, POOF_BURST);
    s = tick(s, POOF_STUN);
    expect(s.phase).toBe('fleeing');
  });

  it('clears once everyone has left', () => {
    let s = tick(grab(), POOF_HOLD);
    s = tick(s, POOF_BURST);
    s = tick(s, POOF_STUN);
    s = poofReduce(s, { type: 'allGone' });
    expect(s.phase).toBe('cleared');
  });

  it('ignores allGone before the room is fleeing', () => {
    expect(poofReduce(grab(), { type: 'allGone' }).phase).toBe('holding');
  });

  it('fizzles on release during the hold', () => {
    const s = poofReduce(tick(grab(), 1.0), { type: 'release' });
    expect(s.phase).toBe('fizzle');
    expect(s.t).toBe(0);
  });

  it('returns to idle when the fizzle finishes, forgetting the victim', () => {
    let s = poofReduce(tick(grab(), 1.0), { type: 'release' });
    s = tick(s, POOF_FIZZLE);
    expect(s.phase).toBe('idle');
    expect(s.victimId).toBeNull();
  });

  it('ignores release once the burst has already happened', () => {
    const burst = tick(grab(), POOF_HOLD);
    expect(poofReduce(burst, { type: 'release' }).phase).toBe('poof');
  });

  it('does not tick while idle', () => {
    expect(tick(POOF_IDLE, 5).t).toBe(0);
  });

  it('does not tick once cleared', () => {
    let s = tick(grab(), POOF_HOLD);
    s = tick(s, POOF_BURST);
    s = tick(s, POOF_STUN);
    s = poofReduce(s, { type: 'allGone' });
    expect(tick(s, 5).t).toBe(0);
  });

  it('does not mutate the previous state', () => {
    const s0 = grab();
    tick(s0, 1.0);
    expect(s0.t).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  pairUp, celebrationPose, ripplePose, RIPPLE_DUR, reactionOffset, REACTION_SPREAD,
} from '../crowdReactions';
import { CELEBRATE_DUR } from '../crowdReducer';
import { hashId } from '../crowdIdentity';

describe('pairUp', () => {
  it('pairs two neighbours who are close enough', () => {
    expect(pairUp([{ id: 'a', x: 0 }, { id: 'b', x: 20 }], 50)).toEqual([['a', 'b']]);
  });

  it('leaves a bobit unpaired when nobody is within reach', () => {
    expect(pairUp([{ id: 'a', x: 0 }, { id: 'b', x: 500 }], 50)).toEqual([]);
  });

  it('pairs each bobit at most once', () => {
    const pairs = pairUp([{ id: 'a', x: 0 }, { id: 'b', x: 10 }, { id: 'c', x: 20 }], 50);
    expect(pairs).toHaveLength(1);
    const used = pairs.flat();
    expect(new Set(used).size).toBe(used.length);
  });

  it('is deterministic regardless of input order', () => {
    const input = [{ id: 'c', x: 20 }, { id: 'a', x: 0 }, { id: 'b', x: 10 }];
    const shuffled = [{ id: 'b', x: 10 }, { id: 'c', x: 20 }, { id: 'a', x: 0 }];
    expect(pairUp(input, 50)).toEqual(pairUp(shuffled, 50));
  });

  it('always names the left-hand partner first', () => {
    const [[first, second]] = pairUp([{ id: 'z', x: 0 }, { id: 'a', x: 30 }], 50);
    expect(first).toBe('z');    // x=0 is to the left, despite sorting later by id
    expect(second).toBe('a');
  });
});

describe('celebrationPose', () => {
  it('cheers, then claps, then high-fives, then lets go', () => {
    expect(celebrationPose(0.2, 3, false, 'R').anim).toBe('cheer');
    expect(celebrationPose(1.0, 3, false, 'R').anim).toBe('clap');
    expect(celebrationPose(1.8, 3, false, 'R').anim).toBe('highfive');
    expect(celebrationPose(2.5, 3, false, 'R').anim).toBeNull();
  });

  it('passes the hand through so partners reach toward each other', () => {
    expect(celebrationPose(1.8, 3, false, 'R').hand).toBe('R');
    expect(celebrationPose(1.8, 3, false, 'L').hand).toBe('L');
  });

  it('makes the unpaired jump instead of high-fiving thin air', () => {
    expect(celebrationPose(1.8, 3, false, null).anim).toBe('jump');
  });

  it('gives tier 5 a dance where tier 1 only manages a friendly nod', () => {
    expect(celebrationPose(0.2, 5, false, null).anim).toBe('dance');
    expect(celebrationPose(0.2, 1, false, null).anim).toBe('friendly');
  });

  it('celebrates one rung harder for whoever the answer belongs to', () => {
    expect(celebrationPose(0.2, 1, true, null).anim).toBe('cheer');
  });
});

describe('ripplePose', () => {
  it('reaches nobody at t=0', () => {
    expect(ripplePose(200, 0, 1)).toBeNull();
  });

  it('reaches the near bobits before the far ones', () => {
    expect(ripplePose(50, 0.3, 1)).not.toBeNull();
    expect(ripplePose(900, 0.3, 1)).toBeNull();
  });

  it('is over once the ripple duration elapses', () => {
    expect(ripplePose(50, RIPPLE_DUR + 0.1, 1)).toBeNull();
  });

  it('shrugs near the origin and looks confused further out', () => {
    expect(ripplePose(10, 0.6, 1)).toBe('shrug');
    expect(ripplePose(230, 0.6, 1)).toBe('confused');
  });
});

describe('the room reacts in a spatter, not in lockstep', () => {
  it('puts different bobits at different points in the chain at the same instant', () => {
    // The bug this guards: every bobit changed pose on the same frame, so the whole room went
    // cheer -> clap -> high-five together and read as choreography.
    const at = (offset: number) => celebrationPose(0.85, 3, false, null, offset).anim;
    expect(at(0)).toBe('clap');          // already moved on
    expect(at(0.4)).toBe('cheer');       // still opening
  });

  it('holds a bobit at his own business until his turn comes round', () => {
    expect(celebrationPose(0.1, 3, false, null, 0.4).anim).toBeNull();
    expect(celebrationPose(0.5, 3, false, null, 0.4).anim).toBe('cheer');
  });

  it('lets the celebrant lead -- his answer, his reaction first', () => {
    // Offset is ignored for the celebrant, so he is already going while the room catches up.
    expect(celebrationPose(0.1, 3, true, null, 0.5).anim).not.toBeNull();
    expect(celebrationPose(0.1, 3, false, null, 0.5).anim).toBeNull();
  });

  it('gives every bobit a stable offset inside the spread', () => {
    for (const h of [0, 1, 7, 12345, 98765, 4294967295]) {
      const o = reactionOffset(h);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(REACTION_SPREAD);
      expect(reactionOffset(h)).toBe(o);      // same hash, same beat, every frame
    }
  });

  it('spreads a realistic room across the window rather than clumping', () => {
    const offsets = Array.from({ length: 40 }, (_, i) => reactionOffset(hashId(`milwi-${i}`)));
    const lo = offsets.filter(o => o < REACTION_SPREAD / 3).length;
    const hi = offsets.filter(o => o > REACTION_SPREAD * 2 / 3).length;
    expect(lo).toBeGreaterThan(3);
    expect(hi).toBeGreaterThan(3);
  });

  it('runs the room long enough for the last starter to finish', () => {
    // CELEBRATE_DUR must cover the chain PLUS the spread, or stragglers are cut off mid-clap.
    expect(CELEBRATE_DUR).toBeGreaterThanOrEqual(2.4 + REACTION_SPREAD - 0.001);
    const last = celebrationPose(CELEBRATE_DUR - 0.01, 3, false, null, REACTION_SPREAD).anim;
    expect(last).not.toBeNull();
  });
});

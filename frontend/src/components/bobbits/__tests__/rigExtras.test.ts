import { describe, it, expect } from 'vitest';
import {
  ALL_ANIMATIONS, EXTRA_ANIMATIONS, figColor, FIG_COLORS, drawSmokePuff, SMOKE_PURPLE,
} from '../rigExtras';
import { ANIMATIONS, computePose, CFG } from '../leremyRig';

describe('EXTRA_ANIMATIONS', () => {
  it('holds exactly the ten CTC-only poses', () => {
    expect(Object.keys(EXTRA_ANIMATIONS).sort()).toEqual(
      ['bow', 'carryGrip', 'cheer', 'clap', 'dance', 'flail', 'highfive', 'offer', 'ponder',
       'splayed'],
    );
  });

  it('keeps them out of the ported rig', () => {
    for (const k of ['bow', 'carryGrip', 'cheer', 'dance', 'offer', 'ponder']) {
      expect(ANIMATIONS[k], `${k} leaked into the ported rig`).toBeUndefined();
    }
  });
});

describe('ALL_ANIMATIONS', () => {
  it('merges the 41 ported plus the walk alias plus the 10 extras', () => {
    expect(Object.keys(ALL_ANIMATIONS).length).toBe(52);
  });

  it('exposes both families', () => {
    expect(ALL_ANIMATIONS.stroll).toBeDefined();
    expect(ALL_ANIMATIONS.dance).toBeDefined();
  });

  it('gives every extra a label and a mood, like the ported poses', () => {
    for (const k of Object.keys(EXTRA_ANIMATIONS)) {
      expect(typeof EXTRA_ANIMATIONS[k].label).toBe('string');
      expect(EXTRA_ANIMATIONS[k].label.length).toBeGreaterThan(0);
      expect(typeof EXTRA_ANIMATIONS[k].mood).toBe('string');
    }
  });
});

describe('figColor', () => {
  it('picks from the light palette when not dark', () => {
    expect(figColor(0, false)).toBe(FIG_COLORS.light[0]);
  });

  it('picks from the dark palette when dark', () => {
    expect(figColor(0, true)).toBe(FIG_COLORS.dark[0]);
  });

  it('wraps past the end of the palette', () => {
    expect(figColor(6, false)).toBe(FIG_COLORS.light[0]);
    expect(figColor(7, true)).toBe(FIG_COLORS.dark[1]);
  });
});

describe('clap', () => {
  it('is registered in the catalogue', () => {
    expect(ALL_ANIMATIONS.clap).toBeDefined();
  });

  it('is NOT a T-pose: the upper arms stay down at the sides', () => {
    // The original clap passed every other assertion here while rendering as a crucifixion --
    // arms straight out horizontally, hands touching at the fingertips. Symmetry and forearm
    // travel are both satisfied by a T-pose, so neither could see it. This can: 0 deg is
    // straight DOWN and 90 is horizontal, so an upper arm at or past 90 is the failure.
    for (const t of [0, 0.07, 0.15, 0.22, 0.29]) {
      const p = ALL_ANIMATIONS.clap.frame(t);
      expect(Math.abs(p.armRU)).toBeLessThan(60);
      expect(Math.abs(p.armLU)).toBeLessThan(60);
    }
  });

  it('actually brings the two hands together, measured on the joints', () => {
    // Angles are not positions. This solves the pose and checks the hands meet in front of
    // the body rather than trusting that the numbers imply it.
    const gapAt = (t: number) => {
      const j = computePose(ALL_ANIMATIONS.clap.frame(t), CFG, { x: 0, y: 0 });
      return j.hR.x - j.hL.x;
    };
    const samples = [0, 0.04, 0.07, 0.11, 0.15, 0.22, 0.29].map(gapAt);
    const closed = Math.min(...samples.map(Math.abs));
    const open = Math.max(...samples);
    expect(closed).toBeLessThan(6);          // they meet
    expect(open).toBeGreaterThan(12);        // and they part again
    // Never cross through each other: hR is the viewer-right hand and must stay right of hL.
    expect(Math.min(...samples)).toBeGreaterThan(-6);
  });

  it('keeps the two hands symmetric, so they meet instead of passing', () => {
    for (const t of [0, 0.25, 0.5]) {
      const p = ALL_ANIMATIONS.clap.frame(t);
      expect(p.armRF).toBeCloseTo(-p.armLF, 5);
      expect(p.armRU).toBeCloseTo(-p.armLU, 5);
    }
  });

  it('keeps both hands in front of the body, not overhead', () => {
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const p = ALL_ANIMATIONS.clap.frame(t);
      expect(p.armRU).toBeLessThan(120);
      expect(p.armLU).toBeGreaterThan(-120);
    }
  });
});

describe('highfive', () => {
  it('is registered in the catalogue', () => {
    expect(ALL_ANIMATIONS.highfive).toBeDefined();
  });

  it('raises the RIGHT arm for hand R and the LEFT arm for hand L', () => {
    const r = ALL_ANIMATIONS.highfive.frame(0, { hand: 'R' });
    const l = ALL_ANIMATIONS.highfive.frame(0, { hand: 'L' });
    expect(r.armRU).toBeGreaterThan(110);
    expect(l.armLU).toBeLessThan(-110);
  });

  it('leans each partner toward the other', () => {
    const r = ALL_ANIMATIONS.highfive.frame(0, { hand: 'R' });
    const l = ALL_ANIMATIONS.highfive.frame(0, { hand: 'L' });
    expect(Math.sign(r.lean)).toBe(-Math.sign(l.lean));
  });
});

/** Records the fillStyles and ops a draw call actually used. */
function recordingCtx() {
  const fills: string[] = [];
  const calls: string[] = [];
  return {
    fills, calls,
    ctx: {
      save() { calls.push('save'); }, restore() { calls.push('restore'); },
      beginPath() {}, fill() { calls.push('fill'); },
      arc() {},
      set fillStyle(v: string) { fills.push(v); },
      get fillStyle() { return fills[fills.length - 1] ?? ''; },
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D,
  };
}

describe('drawSmokePuff', () => {
  it('paints in the colour it is given, not the rig grey', () => {
    const { ctx, fills } = recordingCtx();
    drawSmokePuff(ctx, 0, 0, 20, 1, 1, 0, SMOKE_PURPLE);
    expect(fills).toContain(SMOKE_PURPLE);
    expect(fills).not.toContain('#8A8F98');
  });

  it('draws nothing at all when it has no alpha or no spread', () => {
    for (const [spread, alpha] of [[20, 0], [0, 1], [-5, 1]]) {
      const { ctx, calls } = recordingCtx();
      drawSmokePuff(ctx, 0, 0, spread, alpha, 1, 0, SMOKE_PURPLE);
      expect(calls).toEqual([]);
    }
  });

  it('restores the context it was handed', () => {
    const { ctx, calls } = recordingCtx();
    drawSmokePuff(ctx, 0, 0, 20, 1, 1, 0, SMOKE_PURPLE);
    expect(calls.filter(c => c === 'save').length)
      .toBe(calls.filter(c => c === 'restore').length);
  });

  it('puts several puffs down, not one blob', () => {
    const { ctx, calls } = recordingCtx();
    drawSmokePuff(ctx, 0, 0, 20, 1, 1, 0, SMOKE_PURPLE);
    expect(calls.filter(c => c === 'fill').length).toBeGreaterThan(4);
  });
});

describe('splayed', () => {
  it('is registered', () => {
    expect(ALL_ANIMATIONS.splayed).toBeDefined();
  });

  it('holds all four limbs out, like something being stretched by them', () => {
    const p = ALL_ANIMATIONS.splayed.frame(0);
    // This is the ONE pose where near-horizontal arms are correct.
    expect(Math.abs(p.armRU)).toBeGreaterThan(70);
    expect(Math.abs(p.armLU)).toBeGreaterThan(70);
    expect(Math.abs(p.legRU)).toBeGreaterThan(25);
    expect(Math.abs(p.legLU)).toBeGreaterThan(25);
  });

  it('keeps left and right mirrored, so he hangs straight', () => {
    const p = ALL_ANIMATIONS.splayed.frame(0.3);
    expect(p.armRU).toBeCloseTo(-p.armLU, 5);
    expect(p.legRU).toBeCloseTo(-p.legLU, 5);
  });

  it('trembles, rather than being a still frame', () => {
    const a = ALL_ANIMATIONS.splayed.frame(0).armRU;
    const b = ALL_ANIMATIONS.splayed.frame(0.25).armRU;
    expect(a).not.toBeCloseTo(b, 3);
  });
});

describe('flail', () => {
  it('is registered', () => {
    expect(ALL_ANIMATIONS.flail).toBeDefined();
  });

  it('windmills the arms out of phase with each other', () => {
    // Both arms moving identically is a jumping-jack, not panic.
    const offsets = [0, 0.1, 0.2, 0.3, 0.4].map(t => {
      const p = ALL_ANIMATIONS.flail.frame(t);
      return p.armRU + p.armLU;      // 0 for a perfectly mirrored pose
    });
    expect(Math.max(...offsets.map(Math.abs))).toBeGreaterThan(15);
  });

  it('travels a long way round, so it reads as windmilling', () => {
    const samples = [0, 0.12, 0.25, 0.37, 0.5].map(t => ALL_ANIMATIONS.flail.frame(t).armRU);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(90);
  });

  it('kicks the legs too -- he is airborne, not standing', () => {
    const samples = [0, 0.15, 0.3, 0.45].map(t => ALL_ANIMATIONS.flail.frame(t).legRU);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(25);
  });
});

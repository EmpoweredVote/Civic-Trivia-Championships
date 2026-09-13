import { describe, it, expect } from 'vitest';
import { ALL_ANIMATIONS, EXTRA_ANIMATIONS, figColor, FIG_COLORS } from '../rigExtras';
import { ANIMATIONS } from '../leremyRig';

describe('EXTRA_ANIMATIONS', () => {
  it('holds exactly the seven CTC-only poses', () => {
    expect(Object.keys(EXTRA_ANIMATIONS).sort()).toEqual(['carryGrip', 'cheer', 'clap', 'dance', 'highfive', 'offer', 'ponder']);
  });

  it('keeps them out of the ported rig', () => {
    for (const k of ['carryGrip', 'cheer', 'dance', 'offer', 'ponder']) {
      expect(ANIMATIONS[k], `${k} leaked into the ported rig`).toBeUndefined();
    }
  });
});

describe('ALL_ANIMATIONS', () => {
  it('merges the 41 ported plus the walk alias plus the 7 extras', () => {
    expect(Object.keys(ALL_ANIMATIONS).length).toBe(49);
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

  it('swings the forearms in and out over time', () => {
    // A static "clap" is just a pose. The forearms must actually travel -- and they travel
    // TOGETHER (mirrored), so comparing the two against each other measures nothing; the
    // quantity that moves is each forearm's own angle across the cycle.
    const samples = [0, 0.07, 0.15, 0.22, 0.29].map(t => ALL_ANIMATIONS.clap.frame(t).armRF);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(20);
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

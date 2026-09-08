import { describe, it, expect } from 'vitest';
import { ALL_ANIMATIONS, EXTRA_ANIMATIONS, figColor, FIG_COLORS } from '../rigExtras';
import { ANIMATIONS } from '../leremyRig';

describe('EXTRA_ANIMATIONS', () => {
  it('holds exactly the four CTC-only poses', () => {
    expect(Object.keys(EXTRA_ANIMATIONS).sort()).toEqual(['cheer', 'dance', 'offer', 'ponder']);
  });

  it('keeps them out of the ported rig', () => {
    for (const k of ['cheer', 'dance', 'offer', 'ponder']) {
      expect(ANIMATIONS[k], `${k} leaked into the ported rig`).toBeUndefined();
    }
  });
});

describe('ALL_ANIMATIONS', () => {
  it('merges the 41 ported plus the walk alias plus the 4 extras', () => {
    expect(Object.keys(ALL_ANIMATIONS).length).toBe(46);
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

import { describe, it, expect } from 'vitest';
import { ANIMATIONS, makeGait, REST } from '../leremyRig';

const EXPECTED_KEYS = [
  'bored', 'friendly', 'present', 'shrug', 'confused', 'spent', 'notlistening',
  'witsend', 'exhausted', 'sassy', 'stroll', 'shuffle', 'strut', 'scurry',
  'march', 'sneak', 'trudge', 'carry', 'hefty', 'climb', 'rope', 'peek', 'jump',
  'sit', 'read', 'holdannoyed', 'annoyed', 'greet', 'greetseat', 'standstill',
  'paddleball', 'toddle', 'elder', 'elderangry', 'fall', 'scold', 'toddlemarch',
  'presentup', 'heave', 'heave2', 'painhop',
];

const POSE_KEYS = [
  'lean', 'headTilt', 'bob', 'hunch',
  'armRU', 'armRF', 'armLU', 'armLF',
  'legRU', 'legRF', 'legLU', 'legLF',
];

describe('ANIMATIONS', () => {
  it('has all 41 ported animations', () => {
    for (const k of EXPECTED_KEYS) {
      expect(ANIMATIONS[k], `missing animation: ${k}`).toBeDefined();
    }
  });

  it('aliases walk to stroll', () => {
    expect(ANIMATIONS.walk).toBe(ANIMATIONS.stroll);
  });

  it.each(EXPECTED_KEYS)('%s returns a finite pose across a full cycle', (key) => {
    for (let t = 0; t < 12; t += 0.05) {
      const p = ANIMATIONS[key].frame(t);
      for (const pk of POSE_KEYS) {
        const v = (p as unknown as Record<string, number>)[pk];
        if (v === undefined) continue; // pose fields are optional
        expect(Number.isFinite(v), `${key}.${pk} at t=${t} was ${v}`).toBe(true);
      }
    }
  });

  it.each(EXPECTED_KEYS)('%s does not mutate REST', (key) => {
    const before = { ...REST };
    ANIMATIONS[key].frame(1.5);
    expect(REST).toEqual(before);
  });

  it.each(EXPECTED_KEYS)('%s carries a label and a mood', (key) => {
    expect(typeof ANIMATIONS[key].label).toBe('string');
    expect(ANIMATIONS[key].label.length).toBeGreaterThan(0);
    expect(typeof ANIMATIONS[key].mood).toBe('string');
  });
});

describe('makeGait', () => {
  it('produces an animation whose legs actually scissor', () => {
    const g = makeGait({
      label: 'Test', mood: 'testing',
      speed: 2, stride: 24, hunch: -7, knee: 30, arm: 14, bob: 3, head: -5,
    });
    const a = g.frame(0);
    const b = g.frame(0.25);
    expect(a.legRU).not.toBe(b.legRU);
  });

  it('is periodic in the walk cycle', () => {
    const g = makeGait({
      label: 'Test', mood: 'testing',
      speed: 2, stride: 24, hunch: -7, knee: 30, arm: 14, bob: 3, head: -5,
    });
    // The stride is sin(t * speed * PI), so a full cycle is 2/speed seconds -- not 1/speed.
    // At 1/speed the sine has flipped sign and the legs are in the opposite phase.
    const period = 2 / 2;
    const round = (n: number) => Math.round(n * 100) / 100;
    expect(round(g.frame(0.1).legRU)).toBe(round(g.frame(0.1 + period).legRU));
  });
});

import { describe, it, expect } from 'vitest';
import { SWIRL } from '../scenes/arrival01Swirl';
import { CANNON } from '../scenes/arrival02Cannon';
import { POOL } from '../scenes/poolEntrances';
import { sceneForArrival } from '../scenes/index';
import type { Scene } from '../scenes/types';
import { ALL_ANIMATIONS } from '../../../components/bobbits/rigExtras';
import { directorInit, startScene, directorStep, actorsOf } from '../sceneDirector';

const ALL: Scene[] = [SWIRL, CANNON, ...POOL];

describe('every scene', () => {
  it('names only poses the rig actually has', () => {
    for (const s of ALL) {
      for (const b of s.beats) {
        if (b.pose) expect(ALL_ANIMATIONS[b.pose], `${s.id}: ${b.pose}`).toBeDefined();
      }
    }
  });

  it('keeps every beat inside its own duration', () => {
    for (const s of ALL) for (const b of s.beats) {
      expect(b.at, s.id).toBeGreaterThanOrEqual(0);
      expect(b.at, s.id).toBeLessThanOrEqual(s.duration);
    }
  });

  it('only commands roles it has cast', () => {
    for (const s of ALL) for (const b of s.beats) {
      expect(s.roles, `${s.id}: ${b.role}`).toContain(b.role);
    }
  });

  it('asks for a span it can actually be given', () => {
    for (const s of ALL) {
      expect(s.span, s.id).toBeGreaterThan(0);
      expect(s.span, s.id).toBeLessThanOrEqual(1);
    }
  });

  it('keeps every destination inside its own reserved span', () => {
    for (const s of ALL) for (const b of s.beats) {
      if (b.moveTo === undefined) continue;
      expect(b.moveTo, `${s.id} @${b.at}`).toBeGreaterThanOrEqual(0);
      expect(b.moveTo, `${s.id} @${b.at}`).toBeLessThanOrEqual(1);
    }
  });

  it('leaves nobody in the air, and nothing hidden, when it ends', () => {
    // Played for real, to the last frame: a scene that finished mid-flight would hand back an
    // agent hovering over the question card, and one that finished hidden would hand back an
    // invisible bobit.
    for (const s of ALL) {
      let d = startScene(directorInit(), s, 'x', 1000, () => 0.5);
      const step = 1 / 60;
      for (let t = 0; t < s.duration - step; t += step) d = directorStep(d, step, 80);
      for (const a of actorsOf(d, 80)) {
        expect(a.layer, `${s.id}: ${a.role} ends in the air`).toBe('ground');
        expect(a.hidden, `${s.id}: ${a.role} ends hidden`).toBe(false);
        expect(a.y, `${s.id}: ${a.role} ends off the floor`).toBeCloseTo(80, 0);
      }
    }
  });

  it('leaves no prop behind when it ends', () => {
    for (const s of ALL) {
      let d = startScene(directorInit(), s, 'x', 1000, () => 0.5);
      d = directorStep(d, s.duration + 0.1, 80);
      expect(d.props, s.id).toHaveLength(0);
    }
  });

  it('plays without ever naming a pose the rig lacks, frame by frame', () => {
    for (const s of ALL) {
      let d = startScene(directorInit(), s, 'x', 1000, () => 0.5);
      const step = 1 / 30;
      for (let t = 0; t < s.duration; t += step) {
        d = directorStep(d, step, 80);
        for (const a of actorsOf(d, 80)) {
          expect(ALL_ANIMATIONS[a.pose], `${s.id} @${t.toFixed(2)}: ${a.pose}`).toBeDefined();
        }
      }
    }
  });
});

describe('the pool', () => {
  it('has four entrances, all short', () => {
    expect(POOL).toHaveLength(4);
    for (const s of POOL) expect(s.duration, s.id).toBeLessThanOrEqual(3.2);
  });

  it('keeps every pool entrance narrow enough to never wait for floor', () => {
    for (const s of POOL) expect(s.span, s.id).toBeLessThanOrEqual(0.2);
  });

  it('stays on the ground -- the overlay is for set pieces only', () => {
    for (const s of POOL) for (const b of s.beats) {
      expect(b.layer ?? 'ground', s.id).toBe('ground');
    }
  });
});

describe('sceneForArrival', () => {
  it('gives the very first bobit of a collection the swirl', () => {
    expect(sceneForArrival(0, () => 0).id).toBe(SWIRL.id);
  });

  it('gives the second the cannon', () => {
    expect(sceneForArrival(1, () => 0).id).toBe(CANNON.id);
  });

  it('draws from the pool after that', () => {
    for (const ordinal of [2, 3, 9, 40]) {
      expect(POOL.map(s => s.id)).toContain(sceneForArrival(ordinal, () => 0.5).id);
    }
  });

  it('varies which pool entrance it picks', () => {
    const picked = new Set([0, 0.3, 0.6, 0.9].map(r => sceneForArrival(5, () => r).id));
    expect(picked.size).toBeGreaterThan(1);
  });

  it('never returns the set pieces again once they are spent', () => {
    for (const ordinal of [2, 7, 99]) {
      const id = sceneForArrival(ordinal, () => 0.5).id;
      expect(id).not.toBe(SWIRL.id);
      expect(id).not.toBe(CANNON.id);
    }
  });
});

describe('the cannon', () => {
  it('sends the newcomer over the card on the overlay', () => {
    const arc = CANNON.beats.find(b => b.path === 'arc');
    expect(arc).toBeDefined();
    expect(arc!.arcPeak ?? 0).toBeGreaterThan(120);
    // The flight beat must ALSO be the one that switches layer, under the from-here rule.
    expect(arc!.layer).toBe('air');
  });

  it('actually leaves the band during the flight', () => {
    let d = startScene(directorInit(), CANNON, 'x', 1000, () => 0.5);
    let highest = 80;
    const step = 1 / 60;
    for (let t = 0; t < CANNON.duration; t += step) {
      d = directorStep(d, step, 80);
      for (const a of actorsOf(d, 80)) highest = Math.min(highest, a.y);
    }
    expect(highest).toBeLessThan(-60);     // well above the band's own 96px
  });

  it('takes the cannon away again after firing', () => {
    const place = CANNON.beats.findIndex(b => b.prop && b.prop.kind === 'cannon');
    const clear = CANNON.beats.findIndex(b => b.prop === null);
    expect(place).toBeGreaterThanOrEqual(0);
    expect(clear).toBeGreaterThan(place);
  });

  it('ends with the two of them high-fiving', () => {
    const late = CANNON.beats.filter(b => b.at > CANNON.duration - 2.5 && b.pose);
    expect(late.map(b => b.pose)).toContain('highfive');
  });

  it('gives the two partners opposite hands, so they reach for each other', () => {
    const hands = CANNON.beats.filter(b => b.pose === 'highfive').map(b => b.hand);
    expect(new Set(hands)).toEqual(new Set(['R', 'L']));
  });
});

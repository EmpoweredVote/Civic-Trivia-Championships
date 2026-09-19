import { describe, it, expect } from 'vitest';
import { recapPose, AUDIENCE_CYCLE } from '../recapPoses';

const ROSTER = Array.from({ length: 200 }, (_, i) => `milwi-${String(i).padStart(3, '0')}`);

describe('recapPose — the new arrivals', () => {
  it('bows, at every moment of the recap', () => {
    for (const id of ROSTER.slice(0, 20)) {
      for (let t = 0; t < 30; t += 0.1) {
        expect(recapPose(id, t, true, null).anim, `${id} at t=${t.toFixed(1)}`).toBe('bow');
      }
    }
  });

  it('bows even when pairUp has offered him a partner', () => {
    // A bower is the cast, not the audience. He does not break off to slap hands.
    expect(recapPose(ROSTER[0], 4, true, 'R').anim).toBe('bow');
  });
});

describe('recapPose — the audience', () => {
  const audience = (id: string, t: number, paired: 'R' | 'L' | null = null) =>
    recapPose(id, t, false, paired);

  it('never bows', () => {
    for (const id of ROSTER) {
      for (let t = 0; t < 20; t += 0.25) {
        expect(audience(id, t).anim, `${id} at t=${t.toFixed(2)}`).not.toBe('bow');
      }
    }
  });

  it('high-fives when it has a partner, and says which hand', () => {
    const r = audience(ROSTER[3], 5, 'R');
    expect(r.anim).toBe('highfive');
    expect(r.hand).toBe('R');
    expect(audience(ROSTER[4], 5, 'L').hand).toBe('L');
  });

  it('never returns highfive without a hand', () => {
    for (const id of ROSTER.slice(0, 40)) {
      for (let t = 0; t < 12; t += 0.2) {
        const r = audience(id, t);
        if (r.anim === 'highfive') expect(r.hand).toBeDefined();
      }
    }
  });

  it('only ever plays poses the rig actually has', () => {
    const known = new Set(['cheer', 'clap', 'jump', 'highfive']);
    for (const id of ROSTER) {
      for (let t = 0; t < 12; t += 0.3) {
        expect(known.has(audience(id, t).anim), audience(id, t).anim).toBe(true);
      }
    }
  });

  /**
   * "Occasional jumps, but those should be rare" -- Chris. Asserted as a RATE over the whole
   * room and a long window, which is the consequence, rather than as a value at one instant,
   * which would be the implementation's arithmetic handed back to it.
   */
  it('jumps rarely, but does jump', () => {
    let jumps = 0;
    let total = 0;
    for (let t = 0; t < 120; t += 0.25) {
      for (const id of ROSTER) {
        total += 1;
        if (audience(id, t).anim === 'jump') jumps += 1;
      }
    }
    const rate = jumps / total;
    expect(rate, 'jumps never happen').toBeGreaterThan(0.001);
    expect(rate, 'jumping is not rare').toBeLessThan(0.03);
  });

  /**
   * THE lockstep test. Without a per-id phase offset every bobit changes pose on the same
   * frame and the room reads as choreography rather than as a crowd -- a lesson the
   * celebration chain already paid for once (see REACTION_SPREAD in crowdReactions).
   */
  it('does not put the room in lockstep', () => {
    for (let t = 0; t < 20; t += 0.37) {
      const counts = new Map<string, number>();
      for (const id of ROSTER) {
        const a = audience(id, t).anim;
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
      const biggest = Math.max(...counts.values());
      expect(biggest / ROSTER.length, `one pose dominates at t=${t.toFixed(2)}`)
        .toBeLessThan(0.8);
    }
  });

  it('is stable: the same id and time always give the same pose', () => {
    for (const id of ROSTER.slice(0, 30)) {
      expect(audience(id, 7.25)).toEqual(audience(id, 7.25));
    }
  });

  it('cycles slowly enough that a pose is legible before it changes', () => {
    expect(AUDIENCE_CYCLE).toBeGreaterThan(2);
  });
});

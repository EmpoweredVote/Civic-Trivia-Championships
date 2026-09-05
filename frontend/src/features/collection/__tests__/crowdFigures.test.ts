import { describe, it, expect } from 'vitest';
import { crowdFigures, overflowCount, animForTier } from '../crowdFigures';
import { crowdInit, crowdApply, crowdStep } from '../crowdReducer';
import { CROWD_CAP } from '../crowdLayout';
import type { FieldFigure } from '../../../components/bobbits/fieldGeometry';

const band = { width: 1000, height: 90, scale: 0.22 };
const seeded = (ids: string[]) => crowdApply(crowdInit(), { type: 'seed', ids });
const many = (n: number) => Array.from({ length: n }, (_, i) => `q-${String(i).padStart(4, '0')}`);

describe('crowdFigures', () => {
  it('renders nobody for an empty crowd', () => {
    expect(crowdFigures(crowdInit(), 0, band, false)).toEqual([]);
  });

  it('renders one figure per resident', () => {
    expect(crowdFigures(seeded(['a', 'b', 'c']), 0, band, false).length).toBe(3);
  });

  it('marks every collection bobit unpoofable', () => {
    // A poof on the game screen must always mean "you got this wrong".
    for (const f of crowdFigures(seeded(['a', 'b']), 0, band, false)) {
      expect(f.poofable).toBe(false);
    }
  });

  it('caps the rendered population', () => {
    expect(crowdFigures(seeded(many(154)), 0, band, false).length).toBe(CROWD_CAP);
  });

  it('reports the overflow', () => {
    expect(overflowCount(seeded(many(154)))).toBe(54);
    expect(overflowCount(seeded(many(80)))).toBe(0);
  });

  it('gives a figure the same id it was seeded with', () => {
    const ids = crowdFigures(seeded(['b', 'a']), 0, band, false).map(f => f.id);
    expect(ids.slice().sort()).toEqual(['a', 'b']);
  });

  it('keeps a figure in the same place as the crowd grows', () => {
    const before = crowdFigures(seeded(['a', 'b']), 0, band, false).find(f => f.id === 'a')!;
    const after = crowdFigures(seeded(['a', 'b', 'c', 'd']), 0, band, false).find(f => f.id === 'a')!;
    expect(after.x).toBe(before.x);
    expect(after.groundY).toBe(before.groundY);
  });

  it('gives a figure the same colour every time', () => {
    const a = crowdFigures(seeded(['a']), 0, band, false)[0];
    const b = crowdFigures(seeded(['a', 'z']), 5, band, false).find(f => f.id === 'a')!;
    expect(b.color).toBe(a.color);
  });

  it('uses a different palette in dark mode', () => {
    const light = crowdFigures(seeded(['a']), 0, band, false)[0];
    const dark = crowdFigures(seeded(['a']), 0, band, true)[0];
    expect(dark.color).not.toBe(light.color);
  });

  it('freezes the phase while the room is stunned', () => {
    let s = crowdApply(seeded(['a', 'b']), { type: 'wrong', id: 'a' });
    s = { ...s, loss: { id: 'a', phase: 'stunned', t: 0.1 } };
    const at1 = crowdFigures(s, 1, band, false).find(f => f.id === 'b')!;
    const at2 = crowdFigures(s, 2, band, false).find(f => f.id === 'b')!;
    expect(at2.phase).toBe(at1.phase);
  });

  it('lifts the victim off the ground while he rises', () => {
    let s = crowdApply(seeded(['a']), { type: 'wrong', id: 'a' });
    const start = crowdFigures(s, 0, band, false).find(f => f.id === 'a')!;
    s = { ...s, loss: { id: 'a', phase: 'rising', t: 0.6 } };
    const later = crowdFigures(s, 0.6, band, false).find(f => f.id === 'a')!;
    expect(later.groundY).toBeLessThan(start.groundY);
  });

  it('holds the lost slot open for the whole loss sequence', () => {
    // The gap is the point: it has to read as one specific person missing, not as a smaller
    // crowd. Everyone else stays exactly where they were until the sequence clears.
    const ids = ['q-1', 'q-2', 'q-3', 'q-4'];
    const before = crowdFigures(seeded(ids), 0, band, false);
    const xOf = (figs: FieldFigure[], id: string) => figs.find(f => f.id === id)?.x;

    let s = crowdApply(seeded(ids), { type: 'wrong', id: 'q-1' });
    const seen: string[] = [];
    // Walk the whole sequence in small steps, checking the room on every frame.
    for (let i = 0; i < 60 && s.loss; i++) {
      const figs = crowdFigures(s, i * 0.1, band, false);
      for (const id of ['q-2', 'q-3', 'q-4']) {
        expect(xOf(figs, id)).toBe(xOf(before, id));
      }
      if (!seen.includes(s.loss.phase)) seen.push(s.loss.phase);
      // The victim is drawn while he rises and gone from the burst onwards -- but his slot
      // stays his, which is why nobody above moved.
      expect(figs.some(f => f.id === 'q-1')).toBe(s.loss.phase === 'rising');
      s = crowdStep(s, 0.1);
    }
    expect(seen).toEqual(['rising', 'burst', 'stunned', 'recovering']);
    expect(s.loss).toBeNull();
  });

  it('lets the room close ranks once the loss sequence clears', () => {
    // Only after the sequence ends -- by then the gap has been read, and a permanent hole
    // would leave the band ragged for every later match.
    const survivors = crowdFigures(seeded(['q-2', 'q-3', 'q-4']), 0, band, false);
    const full = crowdFigures(seeded(['q-1', 'q-2', 'q-3', 'q-4']), 0, band, false);
    expect(survivors.find(f => f.id === 'q-2')!.x).toBe(full.find(f => f.id === 'q-1')!.x);
  });

  it('gives the celebrant a bigger pose than the room', () => {
    const s = crowdApply(seeded(['a', 'b']), { type: 'correct', id: 'a', streak: 1 });
    const figs = crowdFigures(s, 0, band, false);
    const celebrant = figs.find(f => f.id === 'a')!;
    const bystander = figs.find(f => f.id === 'b')!;
    expect(celebrant.anim).not.toBe(bystander.anim);
  });
});

describe('animForTier', () => {
  it('escalates through distinct poses', () => {
    const poses = [1, 2, 3, 4, 5].map(animForTier);
    expect(new Set(poses).size).toBeGreaterThan(2);
  });

  it('idles when nobody is celebrating', () => {
    expect(animForTier(0)).toBe('standstill');
  });

  it('gives the top tier the biggest pose', () => {
    expect(animForTier(5)).toBe('dance');
  });
});

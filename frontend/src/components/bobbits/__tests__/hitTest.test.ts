import { describe, it, expect, vi } from 'vitest';
import { figureAtPoint, boundsCandidates } from '../hitTest';
import type { FieldFigure } from '../bobitField';

const fig = (over: Partial<FieldFigure> = {}): FieldFigure => ({
  id: 'a', anim: 'standstill', color: '#000', x: 0, groundY: 100, scale: 1, ...over,
});

const alwaysInk = () => true;
const neverInk = () => false;

describe('boundsCandidates', () => {
  it('returns nothing when the point is outside every figure', () => {
    expect(boundsCandidates([fig({ x: 0 })], 9999, 9999)).toEqual([]);
  });

  it('returns the figure whose box contains the point', () => {
    const f = fig({ id: 'hit', x: 50, groundY: 200 });
    expect(boundsCandidates([f], 50, 150).map(c => c.id)).toEqual(['hit']);
  });

  it('orders overlapping figures topmost first', () => {
    // Higher groundY paints later, so it is on top and must be tested first.
    const back = fig({ id: 'back', x: 50, groundY: 150 });
    const front = fig({ id: 'front', x: 50, groundY: 160 });
    const got = boundsCandidates([back, front], 50, 120);
    expect(got.map(c => c.id)).toEqual(['front', 'back']);
  });
});

describe('figureAtPoint', () => {
  it('returns null when nothing is under the point', () => {
    expect(figureAtPoint([fig()], 9999, 9999, alwaysInk)).toBeNull();
  });

  it('returns null when the box matches but there is no ink', () => {
    const f = fig({ x: 50, groundY: 200 });
    expect(figureAtPoint([f], 50, 150, neverInk)).toBeNull();
  });

  it('returns the figure when the box matches and there is ink', () => {
    const f = fig({ id: 'hit', x: 50, groundY: 200 });
    expect(figureAtPoint([f], 50, 150, alwaysInk)?.id).toBe('hit');
  });

  it('falls through to the figure behind when the front one is empty there', () => {
    const back = fig({ id: 'back', x: 50, groundY: 150 });
    const front = fig({ id: 'front', x: 50, groundY: 160 });
    const probe = (f: FieldFigure) => f.id === 'back';
    expect(figureAtPoint([back, front], 50, 120, probe)?.id).toBe('back');
  });

  it('probes at most once per candidate', () => {
    const probe = vi.fn(() => true);
    const back = fig({ id: 'back', x: 50, groundY: 150 });
    const front = fig({ id: 'front', x: 50, groundY: 160 });
    figureAtPoint([back, front], 50, 120, probe);
    expect(probe).toHaveBeenCalledTimes(1); // stops at the first hit
  });
});

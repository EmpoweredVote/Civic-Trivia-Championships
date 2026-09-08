import { describe, it, expect } from 'vitest';
import { pelvisOffset, sortByDepth, figureBounds } from '../fieldGeometry';
import type { FieldFigure } from '../fieldGeometry';

const fig = (over: Partial<FieldFigure> = {}): FieldFigure => ({
  id: 'a', anim: 'standstill', color: '#000', x: 0, groundY: 100, scale: 1, ...over,
});

describe('pelvisOffset', () => {
  it('is 112 for standing poses', () => {
    expect(pelvisOffset('standstill')).toBe(112);
    expect(pelvisOffset('stroll')).toBe(112);
    expect(pelvisOffset('greet')).toBe(112);
  });

  it('is 8 for seated poses', () => {
    expect(pelvisOffset('sit')).toBe(8);
    expect(pelvisOffset('read')).toBe(8);
    expect(pelvisOffset('greetseat')).toBe(8);
    expect(pelvisOffset('witsend')).toBe(8);
  });

  it('falls back to standing for an unknown pose', () => {
    expect(pelvisOffset('no-such-anim')).toBe(112);
  });
});

describe('sortByDepth', () => {
  it('draws further-back figures first', () => {
    const out = sortByDepth([
      fig({ id: 'front', groundY: 300 }),
      fig({ id: 'back', groundY: 100 }),
      fig({ id: 'mid', groundY: 200 }),
    ]);
    expect(out.map(f => f.id)).toEqual(['back', 'mid', 'front']);
  });

  it('is stable for equal groundY', () => {
    const out = sortByDepth([
      fig({ id: 'first', groundY: 100 }),
      fig({ id: 'second', groundY: 100 }),
    ]);
    expect(out.map(f => f.id)).toEqual(['first', 'second']);
  });

  it('does not mutate its input', () => {
    const input = [fig({ id: 'front', groundY: 300 }), fig({ id: 'back', groundY: 100 })];
    sortByDepth(input);
    expect(input.map(f => f.id)).toEqual(['front', 'back']);
  });
});

describe('figureBounds', () => {
  it('spans from the head down to the ground line', () => {
    const b = figureBounds(fig({ x: 50, groundY: 200, scale: 1 }));
    expect(b.bottom).toBeGreaterThanOrEqual(200);
    expect(b.top).toBeLessThan(200 - 112);
    expect(b.left).toBeLessThan(50);
    expect(b.right).toBeGreaterThan(50);
  });

  it('scales with the figure', () => {
    const big = figureBounds(fig({ scale: 1 }));
    const small = figureBounds(fig({ scale: 0.5 }));
    expect(big.right - big.left).toBeGreaterThan(small.right - small.left);
  });

  it('sits a seated figure much lower than a standing one', () => {
    const standing = figureBounds(fig({ anim: 'standstill', groundY: 200 }));
    const seated = figureBounds(fig({ anim: 'sit', groundY: 200 }));
    expect(seated.top).toBeGreaterThan(standing.top);
  });
});

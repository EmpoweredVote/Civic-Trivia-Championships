import { describe, it, expect } from 'vitest';
import { armFlee, fleeAdvance, allGone, FLEE_SPEED, FLEE_MARGIN } from '../fleeReducer';
import type { FieldFigure } from '../fieldGeometry';

const fig = (id: string, x: number): FieldFigure => ({
  id, anim: 'standstill', color: '#000', x, groundY: 100, scale: 1,
});

describe('armFlee', () => {
  it('arms every figure except the victim', () => {
    const s = armFlee([fig('a', 10), fig('victim', 50), fig('b', 90)], 'victim', 100);
    expect(Object.keys(s).sort()).toEqual(['a', 'b']);
  });

  it('sends each figure toward its nearer edge', () => {
    const s = armFlee([fig('left', 10), fig('right', 90)], null, 100);
    expect(s.left.dir).toBe(-1);
    expect(s.right.dir).toBe(1);
  });

  it('starts nobody as gone', () => {
    const s = armFlee([fig('a', 10)], null, 100);
    expect(s.a.gone).toBe(false);
    expect(allGone(s)).toBe(false);
  });

  it('reports allGone for an empty field', () => {
    expect(allGone({})).toBe(true);
  });
});

describe('fleeAdvance', () => {
  it('moves a figure toward its edge', () => {
    let s = armFlee([fig('right', 90)], null, 100);
    s = fleeAdvance(s, 0.1, 100);
    expect(s.right.x).toBeCloseTo(90 + FLEE_SPEED * 0.1, 5);
  });

  it('marks a figure gone once it clears the margin', () => {
    let s = armFlee([fig('right', 90)], null, 100);
    s = fleeAdvance(s, 10, 100);
    expect(s.right.gone).toBe(true);
    expect(s.right.x).toBeGreaterThan(100 + FLEE_MARGIN);
  });

  it('sends a left-side figure off the left edge', () => {
    let s = armFlee([fig('left', 10)], null, 100);
    s = fleeAdvance(s, 10, 100);
    expect(s.left.gone).toBe(true);
    expect(s.left.x).toBeLessThan(-FLEE_MARGIN);
  });

  it('reports allGone once everyone has left', () => {
    let s = armFlee([fig('a', 10), fig('b', 90)], null, 100);
    s = fleeAdvance(s, 10, 100);
    expect(allGone(s)).toBe(true);
  });

  it('does not move figures already gone', () => {
    let s = armFlee([fig('a', 90)], null, 100);
    s = fleeAdvance(s, 10, 100);
    const restingX = s.a.x;
    s = fleeAdvance(s, 10, 100);
    expect(s.a.x).toBe(restingX);
  });

  it('accumulates run time for figures still going', () => {
    let s = armFlee([fig('a', 50)], null, 1000);
    s = fleeAdvance(s, 0.2, 1000);
    s = fleeAdvance(s, 0.3, 1000);
    expect(s.a.startedAt).toBeCloseTo(0.5, 5);
  });

  it('does not mutate the previous state', () => {
    const s0 = armFlee([fig('a', 50)], null, 100);
    const x0 = s0.a.x;
    fleeAdvance(s0, 1, 100);
    expect(s0.a.x).toBe(x0);
  });
});

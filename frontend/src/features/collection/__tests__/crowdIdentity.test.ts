import { describe, it, expect } from 'vitest';
import { hashId, toneOf, slotOrder } from '../crowdIdentity';

describe('hashId', () => {
  it('is stable for the same input', () => {
    expect(hashId('milwi-042')).toBe(hashId('milwi-042'));
  });

  it('differs for different inputs', () => {
    expect(hashId('milwi-042')).not.toBe(hashId('milwi-043'));
  });

  it('is always a non-negative integer', () => {
    for (const id of ['a', 'milwi-001', 'wisco-137', '', 'x'.repeat(200)]) {
      const h = hashId(id);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('toneOf', () => {
  it('is stable', () => {
    expect(toneOf('milwi-042')).toBe(toneOf('milwi-042'));
  });

  it('is always a valid palette index', () => {
    for (let i = 0; i < 300; i++) {
      const t = toneOf(`milwi-${i}`);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(6);
    }
  });

  it('spreads across the palette rather than collapsing to one tone', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) seen.add(toneOf(`milwi-${i}`));
    expect(seen.size).toBe(6);
  });
});

describe('slotOrder', () => {
  it('does not depend on the order it was given', () => {
    const a = slotOrder(['milwi-003', 'milwi-001', 'milwi-002']);
    const b = slotOrder(['milwi-001', 'milwi-002', 'milwi-003']);
    expect(a).toEqual(b);
  });

  it('keeps every id', () => {
    const ids = ['milwi-001', 'milwi-002', 'milwi-003'];
    expect(slotOrder(ids).slice().sort()).toEqual(ids.slice().sort());
  });

  it('gives a figure the same slot as the crowd grows around it', () => {
    // The point of the whole mechanic: earning a new bobit must not shuffle everyone else.
    const before = slotOrder(['milwi-001', 'milwi-002', 'milwi-003']);
    const after = slotOrder(['milwi-001', 'milwi-002', 'milwi-003', 'milwi-004']);
    for (const id of before) {
      expect(after.indexOf(id)).toBe(before.indexOf(id));
    }
  });

  it('does not mutate its input', () => {
    const ids = ['milwi-003', 'milwi-001'];
    slotOrder(ids);
    expect(ids).toEqual(['milwi-003', 'milwi-001']);
  });

  it('handles an empty crowd', () => {
    expect(slotOrder([])).toEqual([]);
  });
});

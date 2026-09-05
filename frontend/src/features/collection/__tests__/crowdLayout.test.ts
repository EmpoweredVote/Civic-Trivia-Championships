import { describe, it, expect } from 'vitest';
import { slotPosition, rowsFor, CROWD_CAP } from '../crowdLayout';

const band = { width: 1000, height: 90, scale: 0.22 };

describe('rowsFor', () => {
  it('uses one row for a small crowd', () => {
    expect(rowsFor(8)).toBe(1);
  });

  it('adds rows as the crowd grows', () => {
    expect(rowsFor(60)).toBeGreaterThan(1);
    expect(rowsFor(100)).toBeGreaterThan(rowsFor(20));
  });

  it('never exceeds three rows', () => {
    expect(rowsFor(CROWD_CAP)).toBeLessThanOrEqual(3);
    expect(rowsFor(1000)).toBeLessThanOrEqual(3);
  });
});

describe('slotPosition', () => {
  it('keeps every figure inside the band horizontally', () => {
    for (let i = 0; i < 100; i++) {
      const p = slotPosition(i, 100, band);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(band.width);
    }
  });

  it('keeps every figure inside the band vertically', () => {
    for (let i = 0; i < 100; i++) {
      const p = slotPosition(i, 100, band);
      expect(p.groundY).toBeGreaterThan(0);
      expect(p.groundY).toBeLessThanOrEqual(band.height);
    }
  });

  it('puts back rows higher on screen than front rows', () => {
    const front = slotPosition(0, 100, band);
    const back = slotPosition(99, 100, band);
    expect(back.row).not.toBe(front.row);
    const rowYs = new Map<number, number>();
    for (let i = 0; i < 100; i++) {
      const p = slotPosition(i, 100, band);
      rowYs.set(p.row, p.groundY);
    }
    const sorted = [...rowYs.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i][1]).toBeLessThan(sorted[i - 1][1]);
    }
  });

  it('does not move a figure to another row when the crowd grows', () => {
    // Slot 5 must stay put whether the room holds 20 or 90.
    expect(slotPosition(5, 20, band).row).toBe(slotPosition(5, 90, band).row);
  });

  it('is deterministic', () => {
    expect(slotPosition(7, 50, band)).toEqual(slotPosition(7, 50, band));
  });

  it('spreads figures out rather than stacking them', () => {
    const a = slotPosition(0, 10, band);
    const b = slotPosition(1, 10, band);
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(10);
  });
});

import { describe, it, expect } from 'vitest';
import {
  slotPosition, rowsFor, CROWD_CAP, bandFor, stageBounds, agentPlacement, WANDER_CAST,
} from '../crowdLayout';

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

describe('bandFor', () => {
  it('gives desktop a 190px band at the held 0.2 scale', () => {
    const b = bandFor(false);
    expect(b.height).toBe(190);
    expect(b.scale).toBeCloseTo(0.2, 5);
  });

  it('gives mobile a 100px band at the enlarged 0.20 scale', () => {
    const b = bandFor(true);
    expect(b.height).toBe(100);
    expect(b.scale).toBeCloseTo(0.2, 5);
  });

  it('keeps the nominal 1000px width both ways -- figures are placed proportionally', () => {
    expect(bandFor(false).width).toBe(1000);
    expect(bandFor(true).width).toBe(1000);
  });

  it('is deep enough for four bobit-heights on desktop', () => {
    // A standing figure is 195 rig units tall.
    const b = bandFor(false);
    expect(b.height / (195 * b.scale)).toBeGreaterThan(4);
  });
});

describe('stageBounds', () => {
  it('gives the stage the lower 60% of the band', () => {
    const b = bandFor(false);
    const s = stageBounds(b);
    expect(s.bottom).toBe(b.height);
    expect(s.top).toBeCloseTo(b.height * 0.4, 5);
  });
});

describe('agentPlacement', () => {
  it('puts depth 0 at the front of the stage and depth 1 at the back', () => {
    const b = bandFor(false);
    const front = agentPlacement(0, b);
    const back = agentPlacement(1, b);
    expect(front.groundY).toBeCloseTo(stageBounds(b).bottom, 5);
    expect(back.groundY).toBeCloseTo(stageBounds(b).top, 5);
    expect(back.groundY).toBeLessThan(front.groundY);   // further back sits higher
  });

  it('scales nearer figures up and further ones down, by +/-8%', () => {
    const b = bandFor(false);
    expect(agentPlacement(0, b).scale).toBeCloseTo(b.scale * 1.08, 5);
    expect(agentPlacement(1, b).scale).toBeCloseTo(b.scale * 0.92, 5);
    expect(agentPlacement(0.5, b).scale).toBeCloseTo(b.scale, 5);
  });

  it('clamps depth rather than trusting its caller', () => {
    const b = bandFor(false);
    expect(agentPlacement(-1, b).groundY).toBeCloseTo(agentPlacement(0, b).groundY, 5);
    expect(agentPlacement(2, b).groundY).toBeCloseTo(agentPlacement(1, b).groundY, 5);
  });
});

describe('WANDER_CAST', () => {
  it('is small enough to keep the O(N^2) separation check cheap', () => {
    // wanderAdvance compares every pair each frame. 100 would be 10,000 checks a frame.
    expect(WANDER_CAST * WANDER_CAST).toBeLessThan(2000);
  });
});

describe('stageBounds — nobody is clipped by the top of the band', () => {
  // A standing figure spans pelvisOffset (112) + ABOVE_PELVIS (96) = 208 rig units, and the
  // raised-arm celebration poses go higher still.
  const FIGURE_UNITS = 208;

  it('leaves a whole figure above the back of the stage on mobile', () => {
    const b = bandFor(true);
    const back = agentPlacement(1, b);
    expect(back.groundY).toBeGreaterThanOrEqual(FIGURE_UNITS * back.scale);
  });

  it('leaves a whole figure above the back of the stage on desktop', () => {
    const b = bandFor(false);
    const back = agentPlacement(1, b);
    expect(back.groundY).toBeGreaterThanOrEqual(FIGURE_UNITS * back.scale);
  });

  it('still leaves a usable stage after clamping', () => {
    for (const mobile of [true, false]) {
      const b = bandFor(mobile);
      const s = stageBounds(b);
      expect(s.bottom - s.top).toBeGreaterThan(b.height * 0.3);
    }
  });
});

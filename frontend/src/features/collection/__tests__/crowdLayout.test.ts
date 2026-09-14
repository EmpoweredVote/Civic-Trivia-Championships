import { describe, it, expect } from 'vitest';
import {
  slotPosition, rowsFor, CROWD_CAP, bandFor, stageBounds, agentPlacement, wanderCastFor,
  HEADROOM_UNITS,
} from '../crowdLayout';
import { MIN_SEPARATION } from '../../../components/bobbits/wanderReducer';

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
  it('draws both form factors at the same 0.2 scale', () => {
    expect(bandFor(false).scale).toBeCloseTo(0.2, 5);
    expect(bandFor(true).scale).toBeCloseTo(0.2, 5);
  });

  it('gives desktop a little more air than mobile', () => {
    expect(bandFor(false).height).toBeGreaterThan(bandFor(true).height);
  });

  it('keeps the nominal 1000px width both ways -- figures are placed proportionally', () => {
    expect(bandFor(false).width).toBe(1000);
    expect(bandFor(true).width).toBe(1000);
  });

  it('is tall enough for a figure with its arms up, and not much taller', () => {
    // One ground line, so the band only needs to clear a raised-arm pose. Anything beyond that
    // is empty sky taken out of the question card's allowance.
    for (const mobile of [true, false]) {
      const b = bandFor(mobile);
      expect(b.height).toBeGreaterThanOrEqual(HEADROOM_UNITS * b.scale);
      expect(b.height).toBeLessThan(HEADROOM_UNITS * b.scale * 2.2);
    }
  });
});

describe('stageBounds', () => {
  it('collapses to a single ground line', () => {
    const b = bandFor(false);
    const s = stageBounds(b);
    expect(s.top).toBe(s.bottom);
  });

  it('keeps that line inside the band, clear of the bottom edge', () => {
    for (const mobile of [true, false]) {
      const b = bandFor(mobile);
      const s = stageBounds(b);
      expect(s.bottom).toBeLessThan(b.height);
      expect(s.bottom).toBeGreaterThan(0);
    }
  });
});

describe('agentPlacement', () => {
  it('ignores depth entirely -- one line, one size', () => {
    const b = bandFor(false);
    const a = agentPlacement(0, b);
    for (const d of [-1, 0.25, 0.5, 1, 2]) {
      expect(agentPlacement(d, b)).toEqual(a);
    }
  });

  it('stands everyone on the stage line', () => {
    const b = bandFor(false);
    expect(agentPlacement(0.4, b).groundY).toBe(stageBounds(b).bottom);
  });
});

describe('wanderCastFor', () => {
  // Sized by FLOOR SPACE, not by CPU. The bench (2026-09-13) measured every cast size up to
  // 100 comfortably inside the frame budget; what a narrow band cannot do is fit them.
  it('gives a desktop band room for a real crowd', () => {
    expect(wanderCastFor(1440, bandFor(false))).toBeGreaterThan(25);
  });

  it('gives a phone band far fewer, so they are not jammed shoulder to shoulder', () => {
    const mobile = wanderCastFor(340, bandFor(true));
    expect(mobile).toBeLessThan(15);
    expect(mobile).toBeLessThan(wanderCastFor(1440, bandFor(false)));
  });

  it('keeps every walker at least a comfortable gap apart', () => {
    const band = bandFor(true);
    const width = 340;
    const cast = wanderCastFor(width, band);
    expect(width / cast).toBeGreaterThanOrEqual(MIN_SEPARATION * band.scale);
  });

  it('never exceeds the crowd cap and never empties the floor', () => {
    expect(wanderCastFor(100000, bandFor(false))).toBeLessThanOrEqual(CROWD_CAP);
    expect(wanderCastFor(0, bandFor(false))).toBeGreaterThanOrEqual(1);
    expect(wanderCastFor(10, bandFor(false))).toBeGreaterThanOrEqual(1);
  });
});

describe('stageBounds — nobody is clipped by the top of the band', () => {
  // A standing figure spans pelvisOffset (112) + ABOVE_PELVIS (96) = 208 rig units, and the
  // raised-arm celebration poses go higher still.
  const FIGURE_UNITS = 208;

  it('leaves a whole figure above the ground line, both form factors', () => {
    for (const mobile of [true, false]) {
      const b = bandFor(mobile);
      const a = agentPlacement(0, b);
      expect(a.groundY).toBeGreaterThanOrEqual(FIGURE_UNITS * a.scale);
    }
  });

  it('leaves the whole figure inside the band', () => {
    for (const mobile of [true, false]) {
      const b = bandFor(mobile);
      const { groundY, scale } = agentPlacement(0, b);
      expect(groundY).toBeGreaterThanOrEqual(HEADROOM_UNITS * scale);
      expect(groundY).toBeLessThanOrEqual(b.height);
    }
  });
});

describe('one ground line', () => {
  it('stands every agent on the same line, whatever its depth', () => {
    const b = bandFor(false);
    const ys = [0, 0.25, 0.5, 0.75, 1].map(d => agentPlacement(d, b).groundY);
    expect(new Set(ys).size).toBe(1);
  });

  it('draws every agent at the same size, so nobody reads as further away', () => {
    const b = bandFor(false);
    const scales = [0, 0.5, 1].map(d => agentPlacement(d, b).scale);
    expect(new Set(scales)).toEqual(new Set([b.scale]));
  });

  it('leaves the feet clear of the very bottom edge', () => {
    for (const mobile of [true, false]) {
      const b = bandFor(mobile);
      expect(agentPlacement(0, b).groundY).toBeLessThan(b.height);
    }
  });

  it('is still tall enough that a raised-arm celebration does not clip', () => {
    for (const mobile of [true, false]) {
      const b = bandFor(mobile);
      expect(agentPlacement(0, b).groundY).toBeGreaterThanOrEqual(HEADROOM_UNITS * b.scale);
    }
  });
});

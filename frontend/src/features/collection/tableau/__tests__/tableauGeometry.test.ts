import { describe, it, expect } from 'vitest';
import {
  inkBox, tableauScale, originX, lineEndpoints,
  leftmostInk, rightmostInk, MIN_TABLEAU_MARGIN,
} from '../tableauGeometry';
import { BLUEPRINT } from '../blueprint';

/**
 * Real measured margins, both sides, from the shipped tree's own fixture widths.
 *
 * The last row is not a viewport anybody has: it is there because all three REAL ones turn out
 * to be height-driven, so `tableauScale`'s width fit is never the binding constraint and a
 * regression that dropped it entirely would pass every one of them. A tall narrow margin makes
 * the width fit bind, and bound 1 then fails by 178px if it is missing. Without this row the
 * bound-1 test is weak rather than wrong, which is the harder kind to notice.
 */
const MARGINS = [
  { vw: 1920, width: 432, height: 868 },
  { vw: 1440, width: 372, height: 640 },
  { vw: 1280, width: 264, height: 560 },
  { vw: 'tall-narrow', width: 160, height: 900 },
];

describe('BOUND 1 — nothing the tableau draws crosses the question column', () => {
  /**
   * The canvases ARE the margins. The right canvas is positioned `right: 0` with the measured
   * margin width, so its LEFT edge is the column's right edge; the left canvas is `left: 0`,
   * so its RIGHT edge is the column's left edge. "Ink stays inside the canvas" and "ink stays
   * off the card" are therefore the same statement, and this is the test that holds the
   * standing instruction.
   *
   * Asserted as a CONSEQUENCE -- the extreme pixels the tableau actually puts down -- not by
   * checking that tableauScale took a min(). Three of this feature's earlier tests asserted
   * the implementation's arithmetic back at it and each sat on a real defect.
   */
  it('keeps every pixel inside both measured margins at every width', () => {
    for (const { vw, width, height } of MARGINS) {
      const box = { width, height };
      const s = tableauScale(box, box);
      expect(s, `scale at ${vw}px`).not.toBeNull();
      const scale = s as number;
      expect(leftmostInk('right', width, scale), `right stack left edge at ${vw}px`)
        .toBeGreaterThanOrEqual(0);
      expect(rightmostInk('right', width, scale), `right stack right edge at ${vw}px`)
        .toBeLessThanOrEqual(width);
      expect(leftmostInk('left', width, scale), `left stack left edge at ${vw}px`)
        .toBeGreaterThanOrEqual(0);
      expect(rightmostInk('left', width, scale), `left stack right edge at ${vw}px`)
        .toBeLessThanOrEqual(width);
    }
  });

  it('fits inside the margin\'s height too, so the canopy is not clipped', () => {
    for (const { vw, width, height } of MARGINS) {
      const box = { width, height };
      const scale = tableauScale(box, box) as number;
      for (const side of ['left', 'right'] as const) {
        expect(inkBox(side).top * scale, `${side} stack height at ${vw}px`)
          .toBeLessThanOrEqual(height);
      }
    }
  });
});

describe('tableauScale', () => {
  it('is ONE scale for both stacks, so the cabin is not bigger than the tree', () => {
    // A tall narrow left margin and a short wide right one. The shared scale must satisfy
    // both, which means it is the smaller of the two sides' fits -- not each side's own.
    const left = { width: 400, height: 900 };
    const right = { width: 200, height: 400 };
    const s = tableauScale(left, right) as number;
    expect(rightmostInk('right', right.width, s)).toBeLessThanOrEqual(right.width);
    expect(inkBox('right').top * s).toBeLessThanOrEqual(right.height);
    expect(inkBox('left').top * s).toBeLessThanOrEqual(left.height);
  });

  /**
   * REVIEW FOCUS 1. GameScreen early-returns the wager screen, tearing out the measured nodes,
   * and a detached node reports all zeros. A zero box must yield NO TABLEAU -- never a zero
   * scale (everything collapses onto the floor line) and never an infinite one.
   */
  it('refuses a zero, negative or non-finite box rather than scaling to it', () => {
    expect(tableauScale({ width: 0, height: 0 }, { width: 0, height: 0 })).toBeNull();
    expect(tableauScale({ width: 400, height: 0 }, null)).toBeNull();
    expect(tableauScale({ width: -400, height: 900 }, null)).toBeNull();
    expect(tableauScale({ width: NaN, height: 900 }, null)).toBeNull();
    expect(tableauScale({ width: 400, height: Infinity }, null)).toBeNull();
    expect(tableauScale(null, null)).toBeNull();
  });

  it('refuses a margin narrower than the threshold', () => {
    const tooNarrow = { width: MIN_TABLEAU_MARGIN - 1, height: 900 };
    expect(tableauScale(tooNarrow, tooNarrow)).toBeNull();
  });

  /**
   * REVIEW FOCUS 4. One margin wide enough, the other not -- an asymmetric layout, or a
   * scrollbar on one side only. The wide side still gets its stack.
   */
  it('scales from the one usable margin when only one is wide enough', () => {
    const wide = { width: 420, height: 880 };
    const narrow = { width: 40, height: 880 };
    const s = tableauScale(narrow, wide);
    expect(s).not.toBeNull();
    expect(rightmostInk('right', wide.width, s as number)).toBeLessThanOrEqual(wide.width);
  });
});

describe('lineEndpoints', () => {
  it('puts a ground line\'s joint exactly on the floor', () => {
    const scale = 0.8;
    const ox = originX('left', 432, scale);
    const ground = BLUEPRINT.find(l => l.anchor === 0) as (typeof BLUEPRINT)[number];
    const e = lineEndpoints(ground, ox, 868, scale);
    expect(e.y1).toBe(868);
  });

  it('measures y UPWARD from the floor', () => {
    const scale = 0.8;
    const ox = originX('right', 432, scale);
    const trunk = BLUEPRINT[4];                    // line 5, the trunk: y 0 -> 760
    const e = lineEndpoints(trunk, ox, 868, scale);
    expect(e.y2).toBeLessThan(e.y1);               // canvas y grows downward
    expect(e.y1 - e.y2).toBeCloseTo(760 * scale, 5);
  });
});

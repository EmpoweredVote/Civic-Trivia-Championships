import { describe, it, expect } from 'vitest';
import { BLUEPRINT, STRUCTURES, TOTAL_LINES, linesFor } from '../blueprint';

/** Distance from point p to segment ab, in rig units. */
function distToSegment(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

describe('blueprint integrity', () => {
  it('is exactly 25 lines, numbered 1..25 with no gaps', () => {
    expect(BLUEPRINT).toHaveLength(TOTAL_LINES);
    expect(BLUEPRINT.map(l => l.n)).toEqual(
      Array.from({ length: TOTAL_LINES }, (_, i) => i + 1),
    );
  });

  it('is six structures whose lines are contiguous and sides alternate', () => {
    expect(STRUCTURES).toHaveLength(6);
    let next = 1;
    STRUCTURES.forEach((s, i) => {
      expect(s.from, `structure ${i} starts where the last ended`).toBe(next);
      next = s.to + 1;
      if (i > 0) {
        expect(s.side, `structure ${i} alternates sides`).not.toBe(STRUCTURES[i - 1].side);
      }
    });
    expect(next - 1).toBe(TOTAL_LINES);
  });

  /**
   * NOTHING FLOATS, as a consequence rather than as an assertion about the data's shape.
   * Every line is lashed either to the ground or to a line already standing, and its
   * endpoint 1 physically touches that line. A tableau that passed `anchor < n` while
   * putting the joint 80 units from the wood would still look broken.
   */
  it('anchors every line to the ground or to a lower-numbered line', () => {
    for (const l of BLUEPRINT) {
      expect(l.anchor, `line ${l.n}`).toBeLessThan(l.n);
      expect(l.anchor, `line ${l.n}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('puts endpoint 1 of every line on the thing it is lashed to', () => {
    /**
     * Contact is measured between CENTRE LINES, so two members that physically touch are
     * half of each one's thickness apart -- a w:18 deck resting on a w:17 branch sits 17.5
     * away and is touching. A flat tolerance gets this wrong in both directions: too tight
     * for the thick members at the bottom of a stack, and far too loose for the w:7 stay at
     * the top, where 12 units is most of a mast's width of daylight.
     *
     * SLACK is for authoring, not for floating. Four units at the tableau's real scale is
     * under half a pixel.
     */
    const SLACK = 4;
    for (const l of BLUEPRINT) {
      if (l.anchor === 0) {
        expect(l.y1, `line ${l.n} is on the ground`).toBe(0);
        continue;
      }
      const a = BLUEPRINT[l.anchor - 1];
      expect(a.side, `line ${l.n} is lashed to its own stack`).toBe(l.side);
      const d = distToSegment(l.x1, l.y1, a.x1, a.y1, a.x2, a.y2);
      const touching = (l.w + a.w) / 2 + SLACK;
      expect(d, `line ${l.n} joint to line ${l.anchor}`).toBeLessThanOrEqual(touching);
    }
  });

  it('has exactly one string, the tree canopy, and it is the tree\'s last line', () => {
    const strings = BLUEPRINT.filter(l => l.kind === 'string');
    expect(strings).toHaveLength(1);
    expect(strings[0].n).toBe(9);
    expect(strings[0].structure).toBe('tree');
  });

  it('only lets a bobit perch on a roughly level stick', () => {
    for (const l of BLUEPRINT.filter(x => x.perch)) {
      expect(l.kind, `line ${l.n}`).toBe('stick');
      const slope = Math.abs(l.y2 - l.y1) / Math.max(1, Math.abs(l.x2 - l.x1));
      expect(slope, `line ${l.n} is level enough to sit on`).toBeLessThan(0.2);
    }
  });

  it('keeps every line inside the rig box', () => {
    for (const l of BLUEPRINT) {
      for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) {
        expect(Math.abs(x), `line ${l.n} x`).toBeLessThanOrEqual(200);
        expect(y, `line ${l.n} y`).toBeGreaterThanOrEqual(0);
        expect(y, `line ${l.n} y`).toBeLessThanOrEqual(1000);
      }
    }
  });
});

describe('linesFor', () => {
  it('returns only that side\'s lines, and only those built', () => {
    expect(linesFor('left', 0)).toEqual([]);
    expect(linesFor('left', 4).map(l => l.n)).toEqual([1, 2, 3, 4]);
    expect(linesFor('right', 4)).toEqual([]);
    expect(linesFor('right', 9).map(l => l.n)).toEqual([5, 6, 7, 8, 9]);
  });

  it('clamps above the total rather than throwing', () => {
    expect(linesFor('left', 999).length + linesFor('right', 999).length).toBe(TOTAL_LINES);
  });
});

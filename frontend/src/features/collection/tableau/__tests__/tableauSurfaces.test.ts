import { describe, it, expect } from 'vitest';
import { tableauSurfaces } from '../tableauSurfaces';
import { originX, lineEndpoints } from '../tableauGeometry';
import { BLUEPRINT } from '../blueprint';

const W = 432, FLOOR = 868, S = 0.868;
const ox = (side: 'left' | 'right') => originX(side, W, S);

describe('tableauSurfaces', () => {
  it('offers nothing to sit on before anything is built', () => {
    expect(tableauSurfaces('right', 0, ox('right'), FLOOR, S)).toEqual([]);
  });

  it('offers nothing while a structure has no level line yet', () => {
    // Line 5 is the trunk: a post, not a seat.
    expect(tableauSurfaces('right', 5, ox('right'), FLOOR, S)).toEqual([]);
  });

  it('offers the first branch as soon as it is built, and not before', () => {
    expect(tableauSurfaces('right', 5, ox('right'), FLOOR, S)).toHaveLength(0);
    const after = tableauSurfaces('right', 6, ox('right'), FLOOR, S);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('tableau:right:6');
  });

  it('never offers a seat on something not yet standing', () => {
    for (let built = 0; built <= 25; built++) {
      for (const side of ['left', 'right'] as const) {
        for (const sf of tableauSurfaces(side, built, ox(side), FLOOR, S)) {
          const n = Number(sf.id.split(':')[2]);
          expect(n, `surface ${sf.id} at built=${built}`).toBeLessThanOrEqual(built);
        }
      }
    }
  });

  /**
   * An id names its LINE, not its place in the list. That distinction is load-bearing: a
   * `perchId` is claimed for the whole of a climb and a dwell, and if ids were positional then
   * line 14 arriving would silently rename the branch a bobit was already sitting on, and
   * `canvasOf` would stop recognising him.
   *
   * Note the list is NOT a prefix of the fuller list -- the treehouse deck (line 14, y 245)
   * sits below branch 2 (line 7, y 430), so lowest-first interleaves structures. That is
   * correct, and it is why this asserts membership rather than order.
   */
  it('gives ids that are stable for a line regardless of how much else is built', () => {
    const idsAt = (built: number) =>
      tableauSurfaces('right', built, ox('right'), FLOOR, S).map(s => s.id);
    const at10 = idsAt(10);
    const at25 = new Set(idsAt(25));
    expect(at10).toEqual(['tableau:right:6', 'tableau:right:7', 'tableau:right:8']);
    for (const id of at10) {
      expect(at25.has(id), `${id} still exists, under the same id, at full build`).toBe(true);
    }
  });

  /**
   * A seat's top edge and the wood's top edge are the SAME LINE. The in-band tree drew its
   * branch rect downward from the Surface's y and sank its occupant a branch-width into the
   * wood -- 3px there and invisible, 15px on the margin tree and obvious.
   */
  it('seats a bobit on the top edge of the wood, not inside it', () => {
    const branch = BLUEPRINT[5];                          // line 6, the lowest branch
    const e = lineEndpoints(branch, ox('right'), FLOOR, S);
    const sf = tableauSurfaces('right', 6, ox('right'), FLOOR, S)[0];
    expect(sf.y).toBeCloseTo(Math.min(e.y1, e.y2) - (branch.w * S) / 2, 5);
  });

  it('roots a climb at the joint, so a branch is climbed at the trunk', () => {
    const branch = BLUEPRINT[5];
    const e = lineEndpoints(branch, ox('right'), FLOOR, S);
    const sf = tableauSurfaces('right', 6, ox('right'), FLOOR, S)[0];
    expect(sf.rootX).toBeCloseTo(e.x1, 5);
  });

  it('never offers a seat on the string', () => {
    const all = tableauSurfaces('right', 25, ox('right'), FLOOR, S);
    expect(all.some(s => s.id.endsWith(':9'))).toBe(false);
  });

  it('orders seats lowest first, so a lone climber is not parked in the canopy', () => {
    const ys = tableauSurfaces('right', 25, ox('right'), FLOOR, S).map(s => s.y);
    const descending = [...ys].sort((a, b) => b - a);      // canvas y: bigger is lower
    expect(ys).toEqual(descending);
  });
});

import { describe, it, expect } from 'vitest';
import { phaseAt, lineAt, buildDuration, BUILD_SEC } from '../buildSequence';
import { BLUEPRINT } from '../blueprint';
import { lineEndpoints, originX } from '../tableauGeometry';

const W = 432, FLOOR = 868, S = 0.868;
const OX = originX('right', W, S);
const trunk = BLUEPRINT[4];        // line 5, a ground stick
const branch = BLUEPRINT[5];       // line 6, lashed above the ground
const canopy = BLUEPRINT[8];       // line 9, the string

describe('phaseAt', () => {
  it('runs a ground stick through fetch, haul, raise, lash, done', () => {
    const d = buildDuration(trunk);
    expect(phaseAt(trunk, 0).phase).toBe('fetch');
    expect(phaseAt(trunk, BUILD_SEC.fetch + 0.1).phase).toBe('haul');
    expect(phaseAt(trunk, BUILD_SEC.fetch + BUILD_SEC.haul + 0.1).phase).toBe('raise');
    expect(phaseAt(trunk, d - 0.1).phase).toBe('lash');
    expect(phaseAt(trunk, d).phase).toBe('done');
    expect(phaseAt(trunk, d + 100).phase).toBe('done');
  });

  it('hoists a line whose joint is off the ground instead of hauling it', () => {
    expect(phaseAt(branch, BUILD_SEC.fetch + 0.1).phase).toBe('raise');
  });

  it('pays the string out and curls it, never raising it', () => {
    const d = buildDuration(canopy);
    expect(phaseAt(canopy, BUILD_SEC.fetch + 0.1).phase).toBe('payout');
    expect(phaseAt(canopy, d - 0.1).phase).toBe('curl');
    expect(phaseAt(canopy, d).phase).toBe('done');
  });

  it('reports k as 0..1 within every phase', () => {
    for (let t = 0; t <= buildDuration(trunk); t += 0.25) {
      const { k } = phaseAt(trunk, t);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });
});

describe('lineAt', () => {
  it('shows nothing before the crew has fetched it', () => {
    expect(lineAt(trunk, 0, OX, FLOOR, S)).toBeNull();
  });

  it('carries a ground line flat along the floor', () => {
    const t = BUILD_SEC.fetch + BUILD_SEC.haul * 0.5;
    const e = lineAt(trunk, t, OX, FLOOR, S);
    expect(e).not.toBeNull();
    expect(Math.abs((e as NonNullable<typeof e>).y1 - (e as NonNullable<typeof e>).y2))
      .toBeLessThan(2);
  });

  it('pivots about endpoint 1, which never moves during the raise', () => {
    const final = lineEndpoints(trunk, OX, FLOOR, S);
    const start = BUILD_SEC.fetch + BUILD_SEC.haul;
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const e = lineAt(trunk, start + BUILD_SEC.raise * k, OX, FLOOR, S);
      expect((e as NonNullable<typeof e>).x1, `joint x at k=${k}`).toBeCloseTo(final.x1, 5);
      // The trunk's joint is ON the floor, so it must not move at all -- not in x and not in
      // y. A joint that drifts during the raise is a line being swung by the wrong end.
      expect((e as NonNullable<typeof e>).y1, `joint y at k=${k}`).toBeCloseTo(final.y1, 5);
    }
  });

  it('sweeps the free end through a real arc rather than sliding it into place', () => {
    // A raise that interpolated endpoints linearly would shorten the line in the middle of
    // the lift. Rotating about the joint keeps it rigid, so its length is constant.
    const want = Math.hypot(
      lineEndpoints(trunk, OX, FLOOR, S).x2 - lineEndpoints(trunk, OX, FLOOR, S).x1,
      lineEndpoints(trunk, OX, FLOOR, S).y2 - lineEndpoints(trunk, OX, FLOOR, S).y1,
    );
    const start = BUILD_SEC.fetch + BUILD_SEC.haul;
    for (const k of [0.2, 0.5, 0.8]) {
      const e = lineAt(trunk, start + BUILD_SEC.raise * k, OX, FLOOR, S) as NonNullable<
        ReturnType<typeof lineAt>
      >;
      expect(Math.hypot(e.x2 - e.x1, e.y2 - e.y1), `length at k=${k}`).toBeCloseTo(want, 4);
    }
  });

  /**
   * THE ONE THAT MATTERS. The end of the animation must equal the blueprint EXACTLY. Anything
   * else leaves the line settled a few pixels off its own joint -- which is how the margin
   * tree's branch rect and its Surface came to disagree by half a trunk width, putting a
   * sitter inside the wood.
   */
  it('ends exactly where the blueprint says, for every line', () => {
    for (const line of BLUEPRINT) {
      if (line.kind === 'string') continue;        // the curl has no endpoint to land on
      const ox = originX(line.side, W, S);
      const want = lineEndpoints(line, ox, FLOOR, S);
      const got = lineAt(line, buildDuration(line), ox, FLOOR, S);
      expect(got, `line ${line.n}`).not.toBeNull();
      const e = got as NonNullable<typeof got>;
      expect(e.x1, `line ${line.n} x1`).toBeCloseTo(want.x1, 6);
      expect(e.y1, `line ${line.n} y1`).toBeCloseTo(want.y1, 6);
      expect(e.x2, `line ${line.n} x2`).toBeCloseTo(want.x2, 6);
      expect(e.y2, `line ${line.n} y2`).toBeCloseTo(want.y2, 6);
    }
  });

  it('never puts a line far outside the canvas at any point in its build', () => {
    for (const line of BLUEPRINT) {
      if (line.kind === 'string') continue;
      const ox = originX(line.side, W, S);
      const d = buildDuration(line);
      for (let t = 0; t <= d; t += d / 40) {
        const e = lineAt(line, t, ox, FLOOR, S);
        if (!e) continue;
        for (const y of [e.y1, e.y2]) {
          expect(y, `line ${line.n} y at t=${t.toFixed(1)}`).toBeLessThanOrEqual(FLOOR + 1);
          expect(y, `line ${line.n} y at t=${t.toFixed(1)}`).toBeGreaterThanOrEqual(-1);
        }
      }
    }
  });
});

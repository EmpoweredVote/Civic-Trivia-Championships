import { describe, it, expect } from 'vitest';
import { curlPoints, curlExtent, CURL_SPAN, CURL_R } from '../curl';

describe('curlPoints', () => {
  it('puts no ink down at all before the string is paid out', () => {
    expect(curlPoints(0)).toHaveLength(0);
  });

  it('grows monotonically, so the loops arrive rather than appearing', () => {
    const lengths = [0.1, 0.3, 0.5, 0.8, 1].map(t => curlPoints(t).length);
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i], `t=${i}`).toBeGreaterThan(lengths[i - 1]);
    }
  });

  /**
   * The curl is the one piece of this blueprint that is not a segment, so it is the one piece
   * that could silently breach §2.1 -- `tableauGeometry` bounds it from `curlExtent`, and this
   * is the test that keeps that promise honest. If the path ever reaches further than the
   * extent claims, the ink box is wrong and bound 1 is wrong with it.
   */
  it('never reaches outside the extent that bounds it', () => {
    const { halfW, up } = curlExtent();
    for (const t of [0.25, 0.5, 0.75, 1]) {
      for (const [x, y] of curlPoints(t)) {
        expect(Math.abs(x), `x at t=${t}`).toBeLessThanOrEqual(halfW);
        expect(y, `y at t=${t}`).toBeLessThanOrEqual(up);
        expect(y, `y at t=${t}`).toBeGreaterThanOrEqual(-CURL_R);
      }
    }
  });

  it('travels across the crown rather than piling up in one place', () => {
    const xs = curlPoints(1).map(p => p[0]);
    expect(Math.min(...xs)).toBeLessThan(-CURL_SPAN * 0.5);
    expect(Math.max(...xs)).toBeGreaterThan(CURL_SPAN * 0.5);
  });

  it('loops — it crosses its own horizontal travel many times', () => {
    const pts = curlPoints(1);
    let reversals = 0;
    for (let i = 2; i < pts.length; i++) {
      const a = pts[i - 1][0] - pts[i - 2][0];
      const b = pts[i][0] - pts[i - 1][0];
      if (a * b < 0) reversals++;
    }
    // A plain arch reverses once. Loops reverse twice per loop.
    expect(reversals).toBeGreaterThanOrEqual(8);
  });
});

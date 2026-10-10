import { describe, it, expect } from 'vitest';
import { drawStick, drawTableau } from '../drawTableau';
import { BLUEPRINT } from '../blueprint';
import { originX } from '../tableauGeometry';

interface Pt { x: number; y: number }

/** Records the vertices a fill path visits. Enough to bound the ink without a canvas. */
function recorder() {
  const pts: Pt[] = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo(x: number, y: number) { pts.push({ x, y }); },
    lineTo(x: number, y: number) { pts.push({ x, y }); },
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {}, set lineCap(_v: string) {}, set lineJoin(_v: string) {},
    set globalAlpha(_v: number) {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, pts };
}

describe('drawStick', () => {
  it('draws a quad whose two ends are the line\'s two widths', () => {
    const { ctx, pts } = recorder();
    const line = { ...BLUEPRINT[0], w: 20, w2: 20 };     // vertical post, 20 wide
    drawStick(ctx, line, 100, 500, 1, '#000');
    expect(pts).toHaveLength(4);
    const xs = pts.map(p => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20, 5);
  });

  it('tapers toward endpoint 2 when w2 is smaller', () => {
    const { ctx, pts } = recorder();
    const line = { ...BLUEPRINT[0], x1: 0, y1: 0, x2: 0, y2: 100, w: 40, w2: 4 };
    drawStick(ctx, line, 0, 500, 1, '#000');
    const atFloor = pts.filter(p => Math.abs(p.y - 500) < 0.001);
    const atTip = pts.filter(p => Math.abs(p.y - 400) < 0.001);
    const spread = (ps: Pt[]) => Math.max(...ps.map(p => p.x)) - Math.min(...ps.map(p => p.x));
    expect(spread(atFloor)).toBeCloseTo(40, 5);
    expect(spread(atTip)).toBeCloseTo(4, 5);
  });
});

describe('drawTableau', () => {
  it('draws nothing at all when nothing is built', () => {
    const { ctx, pts } = recorder();
    drawTableau(ctx, 'left', 0, 0, 500, 1, '#000', '#0a0');
    expect(pts).toHaveLength(0);
  });

  it('draws only that side\'s built lines', () => {
    const { ctx, pts } = recorder();
    drawTableau(ctx, 'left', 4, 0, 500, 1, '#000', '#0a0');
    expect(pts).toHaveLength(4 * 4);          // four sticks, four vertices each
  });

  /**
   * The draw and the geometry must agree. They are computed from one definition
   * (`lineEndpoints`), and this is the test that notices if that ever stops being true --
   * which is exactly how the margin tree's seat once extended past the end of its branch.
   */
  it('keeps every drawn vertex inside the canvas at a real scale', () => {
    const width = 432, floorY = 868, scale = 0.868;
    for (const side of ['left', 'right'] as const) {
      const { ctx, pts } = recorder();
      drawTableau(ctx, side, 25, originX(side, width, scale), floorY, scale, '#000', '#0a0');
      expect(pts.length, `${side} drew something`).toBeGreaterThan(0);
      for (const p of pts) {
        expect(p.x, `${side} vertex x`).toBeGreaterThanOrEqual(-0.5);
        expect(p.x, `${side} vertex x`).toBeLessThanOrEqual(width + 0.5);
        expect(p.y, `${side} vertex y`).toBeLessThanOrEqual(floorY + 0.5);
        expect(p.y, `${side} vertex y`).toBeGreaterThanOrEqual(-0.5);
      }
    }
  });
});

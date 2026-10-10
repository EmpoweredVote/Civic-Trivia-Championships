import { describe, it, expect } from 'vitest';
import { drawStick, drawTableau } from '../drawTableau';
import { BLUEPRINT } from '../blueprint';
import { originX } from '../tableauGeometry';
import { BUILD_SEC } from '../buildSequence';

interface Pt { x: number; y: number }

/** Records the vertices a fill path visits. Enough to bound the ink without a canvas. */
function recorder() {
  const pts: Pt[] = [];
  const ops: string[] = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {},
    closePath() {}, fill() { ops.push('fill'); }, stroke() { ops.push('stroke'); },
    moveTo(x: number, y: number) { pts.push({ x, y }); },
    lineTo(x: number, y: number) { pts.push({ x, y }); },
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {}, set lineCap(_v: string) {}, set lineJoin(_v: string) {},
    set globalAlpha(_v: number) {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, pts, ops };
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
   * C2. The line the crew is RAISING must not also be drawn standing.
   *
   * `built` is what is up; the site line is not up. If a caller passes a `built` that already
   * counts the line in flight, the player sees the finished line snap into place and then a
   * second copy of it dragged along the floor and rotated into the same spot over the next
   * fourteen seconds -- the build reads as decorative ghosting rather than as construction,
   * which is the exact opposite of what the feature is for.
   *
   * Guarded here as well as at the call site: the caller passing the wrong counter is a
   * mistake that has already been made once, and a draw that cannot double-paint is cheaper
   * than remembering not to.
   */
  it('draws the line under construction once, in flight, not also standing', () => {
    const line = BLUEPRINT[3];                       // line 4, the cabin's right rafter
    const { ctx, pts } = recorder();
    // `built` counts line 4 even though the crew is still raising it -- the C2 defect.
    drawTableau(ctx, 'left', 4, 0, 500, 1, '#000', '#0a0', { line, t: 8 });
    // Three standing (1-3) plus one in flight. NOT four standing plus one in flight.
    expect(pts).toHaveLength(4 * 4);
  });

  /**
   * I1. The string is a piece of string, not a post.
   *
   * `lineAt` returns the string's final endpoints once it reaches `curl`, so the generic
   * in-flight draw stroked a green BAR from the crown up through the middle of the loops for
   * the whole six-second curl -- and then it vanished at `done`, because the finished path
   * draws only the curl. A stem that pops out of existence is worse than no stem.
   */
  it('draws no stem through the canopy once the string is being curled', () => {
    const canopy = BLUEPRINT[8];                       // line 9, the only string
    const curling = BUILD_SEC.fetch + BUILD_SEC.payout + BUILD_SEC.curl * 0.5;
    const { ctx, ops } = recorder();
    drawTableau(ctx, 'right', 8, 0, 900, 1, '#000', '#0a0', { line: canopy, t: curling });
    // The tree's trunk and three branches fill; the curl strokes. Nothing else may fill.
    expect(ops.filter(o => o === 'fill')).toHaveLength(4);
    expect(ops.filter(o => o === 'stroke')).toHaveLength(1);
  });

  it('does draw the string as a line while it is still being paid out', () => {
    const canopy = BLUEPRINT[8];
    const payingOut = BUILD_SEC.fetch + BUILD_SEC.payout * 0.5;
    const { ctx, ops } = recorder();
    drawTableau(ctx, 'right', 8, 0, 900, 1, '#000', '#0a0', { line: canopy, t: payingOut });
    // Four tree fills plus the string following the climber up. No loops yet.
    expect(ops.filter(o => o === 'fill')).toHaveLength(5);
    expect(ops.filter(o => o === 'stroke')).toHaveLength(0);
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

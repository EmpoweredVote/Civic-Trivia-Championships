import { describe, it, expect } from 'vitest';
import { drawCannon, cannonMuzzle } from '../props';

function recordingCtx() {
  const ops: string[] = [];
  return {
    ops,
    ctx: {
      save() { ops.push('save'); }, restore() { ops.push('restore'); },
      translate() {}, rotate() {}, scale() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
      fill() { ops.push('fill'); }, stroke() { ops.push('stroke'); },
      ellipse() {},
      fillStyle: '', strokeStyle: '', lineWidth: 0, lineJoin: '', lineCap: '',
    } as unknown as CanvasRenderingContext2D,
  };
}

describe('drawCannon', () => {
  it('draws something and leaves the context balanced', () => {
    const { ctx, ops } = recordingCtx();
    drawCannon(ctx, 100, 50, 0.2, -32, false, '#444');
    expect(ops.filter(o => o === 'fill').length).toBeGreaterThan(0);
    expect(ops.filter(o => o === 'save').length).toBe(ops.filter(o => o === 'restore').length);
  });
});

describe('cannonMuzzle', () => {
  it('sits above and ahead of the cannon it belongs to', () => {
    const m = cannonMuzzle(100, 50, 0.2, -32, false);
    expect(m.x).toBeGreaterThan(100);     // ahead, firing right
    expect(m.y).toBeLessThan(50);         // above the ground line
  });

  it('mirrors when the cannon is flipped', () => {
    const r = cannonMuzzle(100, 50, 0.2, -32, false);
    const l = cannonMuzzle(100, 50, 0.2, -32, true);
    expect(100 - l.x).toBeCloseTo(r.x - 100, 5);
    expect(l.y).toBeCloseTo(r.y, 5);
  });

  it('rises with the barrel angle', () => {
    const shallow = cannonMuzzle(100, 50, 0.2, -10, false);
    const steep = cannonMuzzle(100, 50, 0.2, -60, false);
    expect(steep.y).toBeLessThan(shallow.y);
  });
});

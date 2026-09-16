import { describe, it, expect } from 'vitest';
import { drawCannon, cannonMuzzle, accentFor } from '../props';

function recordingCtx() {
  const ops: string[] = [];
  return {
    ops,
    ctx: {
      save() { ops.push('save'); }, restore() { ops.push('restore'); },
      translate() {}, rotate() {}, scale() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
      fill() { ops.push('fill'); }, stroke() { ops.push('stroke'); },
      fillRect() { ops.push('fill'); },
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

describe('accentFor', () => {
  /**
   * The cannon's detail colour used to be hardcoded '#AAB2BF'. In dark mode the body is
   * '#9AA6B8' -- near enough the same tone that the muzzle, hub and bands simply disappeared,
   * which is a fair part of why the prop read as a featureless tube. The accent has to contrast
   * with the BODY, so it has to be derived from it.
   */
  it('goes dark against a light body', () => {
    expect(accentFor('#9AA6B8')).toBe(accentFor('#FFFFFF'));
  });

  it('goes light against a dark body', () => {
    expect(accentFor('#4A5568')).toBe(accentFor('#000000'));
  });

  it('picks opposite accents for the two themes the field actually uses', () => {
    expect(accentFor('#9AA6B8')).not.toBe(accentFor('#4A5568'));
  });

  it('understands three-digit hex', () => {
    expect(accentFor('#fff')).toBe(accentFor('#ffffff'));
  });

  it('falls back to a usable accent for anything it cannot parse', () => {
    expect(accentFor('rebeccapurple')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

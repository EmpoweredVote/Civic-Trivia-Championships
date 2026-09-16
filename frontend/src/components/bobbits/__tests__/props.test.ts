import { describe, it, expect } from 'vitest';
import { drawCannon, cannonMuzzle, accentFor, drawTree, treeSurfaces, TREE_LEDGE_UP } from '../props';
import { bandFor } from '../../../features/collection/crowdLayout';

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

describe('treeSurfaces', () => {
  const BAND = bandFor(false);              // 96px desktop
  const FLOOR = BAND.height - 6;            // GROUND_INSET, the crowd's ground line

  it('offers exactly one branch', () => {
    expect(treeSurfaces(900, FLOOR, BAND.scale)).toHaveLength(1);
  });

  it('puts the branch above a standing bobit head', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    const standingHeadY = FLOOR - 240 * BAND.scale;
    expect(branch.y).toBeLessThan(standingHeadY);
    expect(branch.y).toBeGreaterThan(0);
  });

  /**
   * The constraint that broke pool-peek and pool-drop, asserted rather than assumed: a bobit
   * SEATED on this branch has to fit inside a 96px band.
   *
   * 150 rig units is a deliberate over-estimate of a seated figure -- the real envelope is
   * about 104 (pelvisOffset 8 for a seated pose, plus fieldGeometry's ABOVE_PELVIS 96). Erring
   * high here means the branch has headroom rather than exactly enough.
   */
  it('leaves a seated bobit fully inside the band', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    const seatedHeadY = branch.y - 150 * BAND.scale;
    expect(seatedHeadY).toBeGreaterThanOrEqual(0);
  });

  it('is wide enough to sit on and narrow enough to be a branch', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    const w = branch.right - branch.left;
    expect(w).toBeGreaterThan(20 * BAND.scale);
    expect(w).toBeLessThan(200 * BAND.scale);
  });

  it('reaches LEFT out of the trunk, so it does not hang off the right border', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    expect(branch.right).toBeLessThanOrEqual(900);
    expect(branch.left).toBeLessThan(branch.right);
  });

  it('gives the branch a stable id wherever the tree stands', () => {
    expect(treeSurfaces(900, FLOOR, BAND.scale)[0].id).toBe(
      treeSurfaces(400, FLOOR, BAND.scale)[0].id,
    );
  });

  it('is placed from TREE_LEDGE_UP, in rig units above the ground line', () => {
    const [branch] = treeSurfaces(900, FLOOR, BAND.scale);
    expect(branch.y).toBeCloseTo(FLOOR - TREE_LEDGE_UP * BAND.scale, 6);
  });
});

describe('drawTree', () => {
  it('draws something and leaves the context balanced', () => {
    const { ctx, ops } = recordingCtx();
    drawTree(ctx, 900, 90, 0.2, 1, '#4A5568');
    expect(ops.filter(o => o === 'fill').length).toBeGreaterThan(0);
    expect(ops.filter(o => o === 'save').length).toBe(ops.filter(o => o === 'restore').length);
  });

  it('draws nothing at all before it has started growing', () => {
    const { ctx, ops } = recordingCtx();
    drawTree(ctx, 900, 90, 0.2, 0, '#4A5568');
    expect(ops.filter(o => o === 'fill').length).toBe(0);
  });
});

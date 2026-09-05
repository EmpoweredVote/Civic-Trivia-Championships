import { describe, it, expect } from 'vitest';
import { CFG, REST, computePose, draw, drawBatched, canBatch } from '../leremyRig';

/**
 * A recording stand-in for CanvasRenderingContext2D. There is no canvas in the node test
 * environment, and the property under test is not what the pixels look like but how many
 * calls it takes to produce them -- which a recorder captures exactly.
 */
function recorder() {
  const calls: Array<{ op: string; args: number[] }> = [];
  const rec = (op: string) => (...args: number[]) => { calls.push({ op, args }); };
  const ctx = {
    lineCap: '', lineJoin: '', strokeStyle: '', fillStyle: '', lineWidth: 0,
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    quadraticCurveTo: rec('quadraticCurveTo'),
    arc: rec('arc'),
    stroke: rec('stroke'),
    fill: rec('fill'),
    save: rec('save'),
    restore: rec('restore'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const joints = computePose(REST, CFG, { x: 0, y: 0 });
const count = (calls: Array<{ op: string }>, op: string) => calls.filter(c => c.op === op).length;

describe('drawBatched', () => {
  it('issues four drawing operations, not fifteen', () => {
    const { ctx, calls } = recorder();
    drawBatched(ctx, joints, CFG, '#123456');
    // three strokes (legs, arms, torso) plus one fill (head)
    expect(count(calls, 'stroke')).toBe(3);
    expect(count(calls, 'fill')).toBe(1);
    expect(count(calls, 'beginPath')).toBe(4);
  });

  it('is a large reduction on what draw() issues for the same figure', () => {
    const plain = recorder();
    draw(plain.ctx, joints, CFG, { color: '#123456' });
    const batched = recorder();
    drawBatched(batched.ctx, joints, CFG, '#123456');

    const plainOps = count(plain.calls, 'stroke') + count(plain.calls, 'fill');
    const batchedOps = count(batched.calls, 'stroke') + count(batched.calls, 'fill');
    expect(batchedOps).toBeLessThan(plainOps / 2);
  });

  it('visits every joint the unbatched path visits', () => {
    // Same geometry must be described, whatever order it is issued in. Compare the SET of
    // coordinates touched, since the batched path deliberately reorders them.
    const key = (a: number[]) => a.map(n => n.toFixed(3)).join(',');
    const coordsOf = (calls: Array<{ op: string; args: number[] }>) => new Set(
      calls
        .filter(c => c.op === 'moveTo' || c.op === 'lineTo' || c.op === 'quadraticCurveTo')
        .map(c => key(c.args)),
    );

    const plain = recorder();
    draw(plain.ctx, joints, CFG, { color: '#123456' });
    const batched = recorder();
    drawBatched(batched.ctx, joints, CFG, '#123456');

    for (const c of coordsOf(plain.calls)) {
      expect(coordsOf(batched.calls).has(c), `batched path never touches ${c}`).toBe(true);
    }
  });

  it('draws the head at the same place and radius', () => {
    const plain = recorder();
    draw(plain.ctx, joints, CFG, { color: '#123456' });
    const batched = recorder();
    drawBatched(batched.ctx, joints, CFG, '#123456');

    const arcOf = (calls: Array<{ op: string; args: number[] }>) =>
      calls.find(c => c.op === 'arc')!.args.slice(0, 3);
    expect(arcOf(batched.calls)).toEqual(arcOf(plain.calls));
  });

  it('uses the same line widths as the unbatched path', () => {
    const { ctx, calls } = recorder();
    const widths: number[] = [];
    const spy = new Proxy(ctx, {
      set(t, k, v) {
        if (k === 'lineWidth') widths.push(v as number);
        return Reflect.set(t, k, v);
      },
    });
    drawBatched(spy, joints, CFG, '#123456');
    expect(widths).toEqual([CFG.legW, CFG.armW, CFG.torsoW]);
    expect(calls.length).toBeGreaterThan(0);
  });
});

describe('canBatch', () => {
  it('allows a plain figure', () => {
    expect(canBatch({})).toBe(true);
    expect(canBatch({ color: '#fff' })).toBe(true);
  });

  it('refuses every prop', () => {
    for (const prop of [
      'mega', 'book', 'phone', 'swirl', 'laptop', 'chair', 'desk', 'cane', 'paddle', 'card',
    ] as const) {
      expect(canBatch({ [prop]: true }), `${prop} should block batching`).toBe(false);
    }
  });

  it('refuses a figure whose prop arm is specified', () => {
    // `arm` decides which arm is drawn in FRONT, which only means anything when the
    // per-limb ordering is preserved.
    expect(canBatch({ arm: 'L' })).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  gestureReduce, GESTURE_IDLE, TOUCH_ARM_MS, HOLD_SLOP, shouldSuppressContextMenu,
} from '../pointerGestures';

describe('mouse', () => {
  it('grabs on right mousedown over a figure', () => {
    const r = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    expect(r.emit).toEqual({ type: 'grab', id: 'a', fx: 0.5, fy: 0.9 });
    expect(r.state.armed).toBe(true);
  });

  it('ignores left mousedown', () => {
    const r = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 0, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    expect(r.emit).toBeNull();
    expect(r.state.armed).toBe(false);
  });

  it('ignores right mousedown over empty space', () => {
    const r = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: null, fx: 0, fy: 0,
    });
    expect(r.emit).toBeNull();
  });

  it('releases on right mouseup', () => {
    const down = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    const up = gestureReduce(down.state, { kind: 'mouseup', button: 2 });
    expect(up.emit).toEqual({ type: 'release' });
    expect(up.state.armed).toBe(false);
  });

  it('ignores left mouseup while a right hold is armed', () => {
    const down = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    const up = gestureReduce(down.state, { kind: 'mouseup', button: 0 });
    expect(up.emit).toBeNull();
    expect(up.state.armed).toBe(true);
  });

  it('suppresses the context menu only while armed', () => {
    expect(shouldSuppressContextMenu(GESTURE_IDLE)).toBe(false);
    const down = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    expect(shouldSuppressContextMenu(down.state)).toBe(true);
  });
});

describe('touch', () => {
  const start = () => gestureReduce(GESTURE_IDLE, {
    kind: 'touchstart', touches: 1, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9, now: 1000,
  });

  it('does not grab immediately on touchstart', () => {
    const r = start();
    expect(r.emit).toBeNull();
    expect(r.state.touchArmedAt).toBe(1000);
  });

  it('grabs once the arming delay has passed', () => {
    const held = gestureReduce(start().state, {
      kind: 'touchmove', x: 10, y: 10, touches: 1, now: 1000 + TOUCH_ARM_MS,
    });
    expect(held.emit).toEqual({ type: 'grab', id: 'a', fx: 0.5, fy: 0.9 });
  });

  it('cancels if the finger moves past the slop before arming', () => {
    const moved = gestureReduce(start().state, {
      kind: 'touchmove', x: 10 + HOLD_SLOP + 1, y: 10, touches: 1, now: 1050,
    });
    expect(moved.state.touchArmedAt).toBeNull();
    expect(moved.emit).toBeNull();
  });

  it('cancels on a second finger', () => {
    const two = gestureReduce(start().state, {
      kind: 'touchmove', x: 10, y: 10, touches: 2, now: 1050,
    });
    expect(two.state.touchArmedAt).toBeNull();
  });

  it('ignores a touchstart on empty space', () => {
    const r = gestureReduce(GESTURE_IDLE, {
      kind: 'touchstart', touches: 1, x: 10, y: 10, id: null, fx: 0, fy: 0, now: 1000,
    });
    expect(r.state.touchArmedAt).toBeNull();
    expect(r.emit).toBeNull();
  });

  it('releases on touchend after arming', () => {
    const armed = gestureReduce(start().state, {
      kind: 'touchmove', x: 10, y: 10, touches: 1, now: 1000 + TOUCH_ARM_MS,
    });
    const end = gestureReduce(armed.state, { kind: 'touchend' });
    expect(end.emit).toEqual({ type: 'release' });
  });

  it('emits nothing on touchend if it never armed -- a plain tap', () => {
    const end = gestureReduce(start().state, { kind: 'touchend' });
    expect(end.emit).toBeNull();
  });

  it('grabs only once, not on every subsequent move', () => {
    const armed = gestureReduce(start().state, {
      kind: 'touchmove', x: 10, y: 10, touches: 1, now: 1000 + TOUCH_ARM_MS,
    });
    const again = gestureReduce(armed.state, {
      kind: 'touchmove', x: 10, y: 10, touches: 1, now: 1000 + TOUCH_ARM_MS + 50,
    });
    expect(again.emit).toBeNull();
  });
});

describe('cancel', () => {
  it('releases and disarms', () => {
    const down = gestureReduce(GESTURE_IDLE, {
      kind: 'mousedown', button: 2, x: 10, y: 10, id: 'a', fx: 0.5, fy: 0.9,
    });
    const c = gestureReduce(down.state, { kind: 'cancel' });
    expect(c.emit).toEqual({ type: 'release' });
    expect(c.state.armed).toBe(false);
  });

  it('emits nothing when nothing was armed', () => {
    expect(gestureReduce(GESTURE_IDLE, { kind: 'cancel' }).emit).toBeNull();
  });
});

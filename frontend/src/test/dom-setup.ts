import { afterEach, beforeEach, expect, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Setup for the `dom` lane only (see vitest.config.ts). The `node` lane never loads this.
 *
 * jsdom is a document, not a browser. Three things components here rely on are missing from
 * it, and each is stubbed rather than worked around in the tests, so a test reads like the
 * component instead of like an apology.
 */

// ─── 1. matchMedia ────────────────────────────────────────────────────────────
// jsdom does not implement it at all, so `useReducedMotion` throws on mount without this.
// Defaults to NOT reduced, the common case; `setReducedMotion(true)` flips it, which is the
// branch three shipped defects lived in and no test could reach before this lane existed.

let reducedMotion = false;
const listeners = new Set<(e: MediaQueryListEvent) => void>();

/**
 * Set the `prefers-reduced-motion` answer for the current test. Call it BEFORE render:
 * `useReducedMotion` reads the value in an effect on mount.
 */
export function setReducedMotion(reduce: boolean): void {
  reducedMotion = reduce;
  const event = { matches: reduce, media: '(prefers-reduced-motion: reduce)' } as MediaQueryListEvent;
  for (const listener of listeners) listener(event);
}

// ─── 2. canvas ────────────────────────────────────────────────────────────────
// jsdom's getContext returns null unless the native `canvas` package is installed, and a
// component that draws then dies on the first property access. This records calls instead:
// enough to mount and to assert that a repaint was ATTEMPTED, never what it looked like.

export interface RecordedCanvasCall {
  method: string;
  args: unknown[];
}

const canvasCalls = new WeakMap<HTMLCanvasElement, RecordedCanvasCall[]>();

/** Every 2d call made against this canvas since it was created, in order. */
export function drawCalls(canvas: HTMLCanvasElement): RecordedCanvasCall[] {
  return canvasCalls.get(canvas) ?? [];
}

const CANVAS_METHODS = [
  'save', 'restore', 'beginPath', 'closePath', 'clearRect', 'fillRect', 'strokeRect',
  'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'quadraticCurveTo', 'bezierCurveTo',
  'fill', 'stroke', 'clip', 'translate', 'rotate', 'scale', 'transform', 'setTransform',
  'resetTransform', 'drawImage', 'fillText', 'strokeText', 'setLineDash', 'createLinearGradient',
  'createRadialGradient', 'createPattern', 'measureText', 'getImageData', 'putImageData',
] as const;

function makeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  // Accumulate across calls. A component that re-fetches its context each frame -- which the
  // tableau does -- would otherwise wipe its own history every time it drew, and an assertion
  // about "how much was drawn" would silently measure one frame instead of all of them.
  const calls = canvasCalls.get(canvas) ?? [];
  canvasCalls.set(canvas, calls);
  const ctx: Record<string, unknown> = { canvas };
  for (const method of CANVAS_METHODS) {
    ctx[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      // The few that must return something usable rather than undefined.
      if (method === 'measureText') return { width: 0 } as TextMetrics;
      if (method === 'createLinearGradient' || method === 'createRadialGradient') {
        return { addColorStop: () => {} };
      }
      if (method === 'getImageData') return { data: new Uint8ClampedArray(4) };
      return undefined;
    };
  }
  return ctx as unknown as CanvasRenderingContext2D;
}

// ─── 3. ResizeObserver ─────────────────────────────────────────────────────────────
// Also absent from jsdom, and any canvas component that sizes itself to its box constructs
// one on mount. It never fires here: nothing in jsdom has a size to change. That is a real
// limit of this lane, not an oversight -- a resize-driven bug is a browser-script question.

class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// ─── 3. console.error is a test failure ───────────────────────────────────────
// This is the lane's sharpest edge and the reason defect #4 is covered at all. React reports
// "Cannot update a component while rendering a different component" through console.error and
// nothing else: it logged on EVERY page load for weeks while `npm test`, `tsc` and
// `vite build` all stayed green. A warning nobody fails on is a warning nobody reads.
//
// If a third-party library ever starts logging something benign, silence THAT message by
// name in the test that provokes it. Do not weaken this default.

let consoleErrors: string[] = [];

/** Errors logged so far in this test, for the rare test that asserts on one deliberately. */
export function loggedErrors(): string[] {
  return [...consoleErrors];
}

beforeEach(() => {
  reducedMotion = false;
  listeners.clear();
  consoleErrors = [];

  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));

  vi.stubGlobal('ResizeObserver', StubResizeObserver);

  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
    return makeContext(this);
  } as unknown as HTMLCanvasElement['getContext'];

  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  cleanup();
  const errors = consoleErrors;
  consoleErrors = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  expect(
    errors,
    `console.error during this test:\n${errors.join('\n')}`,
  ).toEqual([]);
});

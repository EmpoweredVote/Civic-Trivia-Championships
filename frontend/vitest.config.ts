import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * TWO LANES, ON PURPOSE.
 *
 * `node` is what this file used to be, unchanged: pure functions — rig geometry, the
 * greet/poof/gesture/flee reducers, selection helpers. It stays node because it is fast and
 * because nothing in it wants a document. Do not move a pure-function test into the dom lane
 * to "be safe"; it only costs seconds.
 *
 * `dom` is the component lane, added 2026-10-11 after SIX defects of a class no test here
 * could see shipped or were caught by eye: a reduced-motion state machine that could never
 * open, a tap that double-fired, a ref left set on touch, a setState during another
 * component's render that logged on every page load, and two smaller. Those are listener
 * wiring, keyboard handling, touch paths and effect cleanup — all of which need a document
 * and none of which a browser smoke script covers, because the smoke scripts drive one happy
 * path and cannot reach a branch like `prefers-reduced-motion`.
 *
 * WHAT THIS LANE STILL CANNOT SEE, stated here so its existence is not read as coverage:
 *   - LAYOUT AND PAINT. jsdom computes no geometry; every box is 0x0 and nothing renders.
 *     A bobit teleporting 691px (CTC #205) is invisible here. That is `check:tableau`'s job.
 *   - CANVAS PIXELS. `getContext('2d')` is a recording stub (see dom-setup.ts). This lane
 *     asserts that drawing was ATTEMPTED and with what calls, never what it looked like.
 *   - BROWSER-SYNTHESIZED EVENTS. A real browser fires a click after touchend; jsdom does
 *     not. Tests that care drive the pair themselves, and say so.
 *   - REAL TIMING. rAF is a timer here, not a frame.
 *
 * Both lanes run under `npm test`, which is what CI runs, so the existing required check
 * covers this without a new job — the master ruleset requires checks BY NAME and a new job
 * would not be required, so a red component test would not block anything.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          // .ts only: the dom lane's files are .tsx and must not be picked up here.
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          globals: true,
          environment: 'jsdom',
          include: ['src/**/*.dom.test.tsx'],
          setupFiles: ['./src/test/dom-setup.ts'],
        },
      },
    ],
  },
});

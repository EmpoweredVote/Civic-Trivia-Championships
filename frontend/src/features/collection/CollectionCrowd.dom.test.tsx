import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { CollectionCrowd } from './CollectionCrowd';
import { BOBITS_PER_LINE } from './tableau/tableauProgress';
import { PEAK_STORAGE_KEY } from './bobitPeak';
import { setReducedMotion, drawCalls } from '../../test/dom-setup';

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * The tableau's worksite -- the part that moves -- had exactly one gate: `npm run check:tableau`,
 * a real-browser script that needs `npm run dev` in another shell and therefore **does not run
 * in CI**. Neither does `smoke:game`. So on every pull request the tableau was covered by
 * `tsc` and by pure-function tests of its geometry, and by nothing that mounted it.
 *
 * These tests do not replace that script and cannot: see the blind-spot list in
 * vitest.config.ts, and note especially that jsdom computes no layout, so every box here is
 * 0x0. The crew teleporting 691px (CTC #205) would still walk straight past this file.
 *
 * What this file does hold is the half that needs a document and runs on every push: that the
 * thing mounts at all, that its frame loop starts and is torn down, that the paint-order fix
 * of CTC #208 is still in place, and that earning a bobit still reaches the tableau.
 */

const MARGIN = { width: 320, height: 700 };

/**
 * A fresh collection per test.
 *
 * The localStorage progress driver is a MODULE SINGLETON whose in-memory mirror is filled on
 * first use and is the source of truth for reads thereafter — so clearing localStorage between
 * tests does not clear it, and seeding localStorage after the module has been touched is not
 * read back. Both are deliberate (see bobitProgress.ts), and the consequence for tests is that
 * isolation has to come from the key, not from the storage. Every test therefore owns a slug.
 */
let slugCounter = 0;
const freshSlug = () => `test-collection-${++slugCounter}`;

type Props = Parameters<typeof CollectionCrowd>[0];

const view = (props: Partial<Props> = {}): Props => ({
  slug: 'unset',
  darkMode: false,
  isMobile: false,
  lastAnswer: null,
  finished5of5: false,
  leftMargin: MARGIN,
  rightMargin: MARGIN,
  ...props,
});

const mount = (props: Partial<Props> = {}) => {
  const resolved = view({ slug: freshSlug(), ...props });
  const utils = render(<CollectionCrowd {...resolved} />);
  /** Re-render with a NEW lastAnswer object, which is how the real screen reveals an answer. */
  const answer = (questionId: string, correct = true) =>
    utils.rerender(
      <CollectionCrowd {...resolved} lastAnswer={{ questionId, correct, streak: 1 }} />,
    );
  return { ...utils, props: resolved, answer };
};

const canvases = (container: HTMLElement): HTMLCanvasElement[] =>
  [...container.querySelectorAll('canvas')];

describe('CollectionCrowd — mount', () => {
  it('renders a margin canvas either side and the band', () => {
    const { container } = mount();
    expect(canvases(container)).toHaveLength(3);
  });

  it('renders no tableau on mobile, but keeps the band', () => {
    // The tableau is desktop-only by decision; the crowd is not. Asserting "nothing renders"
    // would have been wrong — checked against the component rather than assumed.
    const { container } = mount({ isMobile: true });
    expect(canvases(container)).toHaveLength(1);
  });

  it('mounts with no margins measured yet, which is the first frame of every match', () => {
    const { container } = mount({ leftMargin: null, rightMargin: null });
    // The band still draws; the tableau does not. Mounting before GameScreen has measured is
    // the normal case, not an edge one, and it must not throw.
    expect(canvases(container).length).toBeGreaterThan(0);
  });
});

describe('CollectionCrowd — paint order (CTC #208)', () => {
  it('keeps the band positioned and last, so the crowd paints in front of the tableau', () => {
    // The fix was one line: `position: relative` on the band canvas. It works because a
    // positioned element paints in CSS 2.1's step 8 while the non-positioned margin canvases
    // paint at step 4 -- and because, within that step, tree order decides. BOTH halves are
    // load-bearing, so both are asserted: lose either and the trunk covers the crowd again.
    const { container } = mount();
    const all = canvases(container);
    const band = all[all.length - 1];

    expect(getComputedStyle(band).position).toBe('relative');
    for (const margin of all.slice(0, -1)) {
      expect(band.compareDocumentPosition(margin) & Node.DOCUMENT_POSITION_PRECEDING)
        .toBeTruthy();
    }
  });
});

describe('CollectionCrowd — the frame loop', () => {
  it('stops scheduling frames once it unmounts', async () => {
    // An rAF loop that outlives its component keeps stepping a dead scene every frame and
    // holds the whole closure alive. Nothing else here can see that: the browser scripts
    // never unmount anything.
    //
    // Asserting "cancelAnimationFrame was called" would have been the easy version and a
    // WRONG one -- `useWindowSize` cancels a resize frame of its own, so that assertion passes
    // whether or not the tableau's loop (which lives in BobitField) is ever torn down. What is
    // asserted instead is the property itself: after unmount, nothing schedules another frame.
    const raf = vi.spyOn(window, 'requestAnimationFrame');

    const { unmount } = mount();
    await waitFor(() => expect(raf.mock.calls.length).toBeGreaterThan(2));

    unmount();
    const atUnmount = raf.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 100)); // several frames' worth
    expect(raf.mock.calls.length).toBe(atUnmount);
  });

  it('still paints under reduced motion, which has no loop to do it', () => {
    // Reduced motion means no easing, not no destination -- the same rule the reader bobit's
    // quote bubble is held to. A tableau that simply never drew would be a regression.
    setReducedMotion(true);
    const { container } = mount();
    expect(canvases(container).some((c) => drawCalls(c).length > 0)).toBe(true);
  });
});

describe('CollectionCrowd — earning a bobit', () => {
  it('reports a genuinely new correct answer upward exactly once', () => {
    const onBobitEarned = vi.fn();
    const { rerender, props } = mount({ onBobitEarned });

    const answered = { questionId: 'q-new', correct: true, streak: 1 };
    rerender(<CollectionCrowd {...props} lastAnswer={answered} />);
    expect(onBobitEarned).toHaveBeenCalledTimes(1);
    expect(onBobitEarned).toHaveBeenCalledWith('q-new');

    // Re-rendering with the SAME answer object must not earn it twice. The effect keys on
    // object identity precisely so the same question answered again in a later match does
    // count -- which makes "same object, new render" the case worth pinning.
    rerender(<CollectionCrowd {...props} lastAnswer={answered} />);
    expect(onBobitEarned).toHaveBeenCalledTimes(1);
  });

  it('does not report a question this collection had already given him', () => {
    // Earned through the component rather than seeded into storage, because the store's mirror
    // ignores a late write (see freshSlug above). This is also the truer test: it is the path
    // a second match over the same question actually takes.
    const onBobitEarned = vi.fn();
    const { answer } = mount({ onBobitEarned });

    answer('q-repeat');
    expect(onBobitEarned).toHaveBeenCalledTimes(1);

    answer('q-repeat');
    expect(onBobitEarned).toHaveBeenCalledTimes(1);
  });

  it('a wrong answer earns nothing', () => {
    const onBobitEarned = vi.fn();
    const { answer } = mount({ onBobitEarned });

    answer('q-wrong', false);
    expect(onBobitEarned).not.toHaveBeenCalled();
  });
});

describe('CollectionCrowd — the worksite', () => {
  it('keeps repainting the margin canvases frame after frame', async () => {
    // `check:tableau` asserts the rAF loop is still ticking by watching margin ink accumulate
    // in a real browser. It needs `npm run dev` in another shell and does NOT run in CI, so on
    // a pull request nothing watched this at all. This is the part of that assertion a
    // document can carry: the loop reaches the margin canvases and clears them every frame.
    //
    // It is NOT the ink check. In jsdom the canvases have zero width, so the renderer sets up
    // its transform, clears, and draws nothing -- measured, not assumed. Whether anything
    // lands stays `check:tableau`'s question.
    const { container } = mount();
    const left = canvases(container)[0];

    const first = drawCalls(left).length;
    await waitFor(() => expect(drawCalls(left).length).toBeGreaterThan(first), { timeout: 2000 });
  });

  it('records a completed line as a milestone the worksite can build from', () => {
    // The worksite's input is the PEAK, not the live count: `syncMilestone` records it on
    // every answer and `linesBuilt` divides it by BOBITS_PER_LINE. Earning a whole line is
    // therefore observable without any geometry at all -- which is the only way this lane can
    // see the worksite honestly, since it has no layout to put a crew in.
    const { answer, props } = mount();

    for (let i = 1; i <= BOBITS_PER_LINE; i++) answer(`q-line-${i}`);

    const peaks = JSON.parse(localStorage.getItem(PEAK_STORAGE_KEY) ?? '{}');
    expect(peaks[props.slug!]).toBe(BOBITS_PER_LINE);
  });

  it('does not record a line the player has not finished', () => {
    const { answer, props } = mount();

    for (let i = 1; i < BOBITS_PER_LINE; i++) answer(`q-short-${i}`);

    const peaks = JSON.parse(localStorage.getItem(PEAK_STORAGE_KEY) ?? '{}');
    expect(peaks[props.slug!]).toBe(BOBITS_PER_LINE - 1);
  });
});

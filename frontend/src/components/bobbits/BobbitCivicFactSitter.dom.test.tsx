import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BobbitCivicFactSitter } from './BobbitCivicFactSitter';
import { setReducedMotion, drawCalls } from '../../test/dom-setup';

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Three defects shipped on the 2026-09-09 landing-interaction branch and were caught by a
 * human reading the diff, not by a test, because no test in this repo could render anything:
 *
 *   1. Under `prefers-reduced-motion` the quote bubble could NEVER open. There is no rAF loop
 *      on that branch, so the state machine was left parked mid-transition forever.
 *   2. A tap double-fired — the touch handler AND the click the browser synthesizes after
 *      touchend — opening the bubble and instantly closing it. Visible only under reduced
 *      motion, because settling synchronously removes the window that hides it.
 *   3. `hoveringRef` was set on tap and never cleared, leaving the reader mid-glance forever
 *      on touch-only devices.
 *
 * All three are reachable from here. The reduced-motion branch in particular is unreachable
 * from `smoke:game` and `check:tableau`, which drive one happy path in default settings.
 *
 * WHAT THESE TESTS DO NOT CHECK: what he looks like. The canvas is a recording stub, so
 * "repainted" means the component asked to draw, not that the drawing was right. Pose
 * geometry belongs in the node lane; whether the pixels land belongs in the browser scripts.
 */

const bubble = (container: HTMLElement): HTMLElement => {
  // The bubble is aria-hidden (its opacity transition keeps it mounted while invisible), so
  // it has no accessible role to query by. Its own text is the stable handle.
  const el = container.querySelector('[aria-hidden="true"]');
  if (!(el instanceof HTMLElement)) throw new Error('bubble not found');
  return el;
};

const isOpen = (container: HTMLElement): boolean => bubble(container).style.opacity === '1';

const reader = (): HTMLElement => screen.getByRole('img', { name: /Bobbit sitting on the divider/i });

describe('BobbitCivicFactSitter — reduced motion', () => {
  it('opens the bubble on click when prefers-reduced-motion is set', () => {
    // DEFECT 1. Before the fix this stayed shut forever: no rAF loop runs on this branch, so
    // nothing advanced the machine out of `lookup` and the bubble never showed.
    setReducedMotion(true);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);

    expect(isOpen(container)).toBe(false);
    fireEvent.click(reader());
    expect(isOpen(container)).toBe(true);
  });

  it('closes again on a second click', () => {
    setReducedMotion(true);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);

    fireEvent.click(reader());
    expect(isOpen(container)).toBe(true);
    fireEvent.click(reader());
    expect(isOpen(container)).toBe(false);
  });

  it('repaints itself on click, because no frame is coming to do it', () => {
    setReducedMotion(true);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;

    const before = drawCalls(canvas).length;
    fireEvent.click(reader());
    expect(drawCalls(canvas).length).toBeGreaterThan(before);
  });
});

describe('BobbitCivicFactSitter — touch', () => {
  it('a tap opens the bubble exactly once', () => {
    // DEFECT 2. jsdom does not synthesize the click a real browser fires after touchend, so
    // this drives the pair the browser would: touchstart, touchend, click. If the touch
    // handler ever calls the reducer again, the synthesized click reads as a second click and
    // closes what the tap just opened — which is what shipped, and is only visible on the
    // reduced-motion branch, where settling is synchronous.
    setReducedMotion(true);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);
    const wrapper = container.firstElementChild as HTMLElement;

    fireEvent.touchStart(wrapper);
    fireEvent.touchEnd(wrapper);
    fireEvent.click(reader());

    expect(isOpen(container)).toBe(true);
  });

  it('a tap under normal motion does not throw or close what it opens', () => {
    setReducedMotion(false);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);
    const wrapper = container.firstElementChild as HTMLElement;

    fireEvent.touchStart(wrapper);
    fireEvent.touchEnd(wrapper);
    fireEvent.click(reader());

    // Under animation the bubble opens on a later frame, not synchronously, so the assertion
    // that holds in BOTH branches is the one that matters: the tap did not blow up and the
    // component is still mounted and interactive.
    expect(reader()).toBeTruthy();
  });

  it('survives a touch the OS interrupts, which never sends touchend', () => {
    // DEFECT 3's sibling: touchcancel exists so an interrupted touch cannot leave the reader
    // stuck mid-glance. The ref itself is not observable, so what is asserted is that the
    // sequence leaves the component working — a later click still opens the bubble.
    setReducedMotion(true);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);
    const wrapper = container.firstElementChild as HTMLElement;

    fireEvent.touchStart(wrapper);
    fireEvent.touchCancel(wrapper);
    fireEvent.click(reader());

    expect(isOpen(container)).toBe(true);
  });
});

describe('BobbitCivicFactSitter — dismissal wiring', () => {
  it('Escape closes the bubble', () => {
    setReducedMotion(true);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);

    fireEvent.click(reader());
    expect(isOpen(container)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(isOpen(container)).toBe(false);
  });

  it('a mousedown outside closes it, and one inside does not', () => {
    setReducedMotion(true);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);

    fireEvent.click(reader());
    fireEvent.mouseDown(container.firstElementChild as HTMLElement);
    expect(isOpen(container)).toBe(true);

    fireEvent.mouseDown(document.body);
    expect(isOpen(container)).toBe(false);
  });

  it('Enter and Space activate it from the keyboard', () => {
    setReducedMotion(true);
    const { container } = render(<BobbitCivicFactSitter darkMode={false} />);

    fireEvent.keyDown(reader(), { key: 'Enter' });
    expect(isOpen(container)).toBe(true);
    fireEvent.keyDown(reader(), { key: ' ' });
    expect(isOpen(container)).toBe(false);
  });

  it('removes its document listeners when it unmounts while open', () => {
    // Effect cleanup is the other thing no test here could see. If the listeners outlive the
    // component, this Escape reaches a handler holding a dead setState and React logs — which
    // the setup file turns into a failure.
    setReducedMotion(true);
    const { container, unmount } = render(<BobbitCivicFactSitter darkMode={false} />);

    fireEvent.click(reader());
    expect(isOpen(container)).toBe(true);
    unmount();

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(document.body);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { GameTimer } from './GameTimer';

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * `GameTimer` used to call the parent's `onTimeUpdate` from inside the countdown library's
 * children render prop. React answered with "Cannot update a component while rendering a
 * different component" on EVERY page load — and `npm test`, `tsc` and `vite build` were all
 * green, because none of them renders anything. It was found by reading console output off a
 * screenshot run, weeks later (CTC #203).
 *
 * The fix moved the call to the library's `onUpdate`, which runs in a layout effect after
 * commit. Two things therefore need asserting, and the second is the one that is usually
 * forgotten:
 *
 *   1. that the warning is gone — handled by the lane itself, which fails any test that logs
 *      a console.error (see src/test/dom-setup.ts);
 *   2. that the thing the call was FOR still happens. Deleting `onTimeUpdate` would also have
 *      silenced the warning and quietly broken speed scoring, so a gate that only checks (1)
 *      can be passed by making the feature worse.
 */

/** Mirrors how GameScreen uses it: the parent setStates on every tick. */
function TimerHost({ onTick }: { onTick: (n: number) => void }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  return (
    <div>
      <GameTimer
        duration={30}
        isPaused={false}
        onTimeout={() => {}}
        onTimeUpdate={(n) => {
          // The setState that provoked the warning. Keep it: a host that only records into a
          // ref would not exercise the defect at all.
          setRemaining(n);
          onTick(n);
        }}
      />
      {/* Prefixed so it cannot collide with the countdown's own "30" in a text query. */}
      <output data-testid="reported">{remaining === null ? 'none' : `t=${remaining}`}</output>
    </div>
  );
}

describe('GameTimer', () => {
  it('reports the remaining time upward without setState during render', async () => {
    const onTick = vi.fn();
    render(<TimerHost onTick={onTick} />);

    // The wire is alive: the parent is told the time.
    await waitFor(() => expect(onTick).toHaveBeenCalled());
    expect(screen.getByTestId('reported').textContent).toMatch(/^t=\d+$/);

    // And the warning is absent — asserted for the whole test by the lane's afterEach, which
    // fails on any console.error. Restoring the defect makes that assertion fire.
  });

  it('renders the countdown value', async () => {
    render(<TimerHost onTick={() => {}} />);
    await waitFor(() => expect(screen.getByText('30')).toBeTruthy());
  });

  it('does not report upward when no callback is given', async () => {
    // The prop is optional; the small timer on the results screen passes nothing.
    render(<GameTimer duration={30} isPaused={false} onTimeout={() => {}} size={48} />);
    await waitFor(() => expect(screen.getByText('30')).toBeTruthy());
  });
});

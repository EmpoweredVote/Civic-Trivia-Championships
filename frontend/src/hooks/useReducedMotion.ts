import { useState, useEffect } from 'react';

export function useReducedMotion(): boolean {
  /**
   * Read the preference BEFORE the first render, not after it.
   *
   * This was `useState(false)`, and the effect below corrected it on mount -- which is one
   * render too late for anything that acts in an effect of its own. A perfect game fired the
   * confetti rain at the results screen's first commit, when this still said `false`, so a
   * player who had asked for less movement got the full rain anyway. The effect then ran
   * again with `true` and correctly did nothing, having missed.
   *
   * Found by the first dom test written against ResultsScreen (CTC #220). Any consumer that
   * branches in an effect had the same one-frame lie; this removes it for all of them.
   *
   * The guard is for a non-browser environment, where there is no preference to read and
   * `false` -- animate -- is the historical default.
   */
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

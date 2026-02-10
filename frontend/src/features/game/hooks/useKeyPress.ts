import { useEffect } from 'react';

/**
 * Custom hook to handle keyboard shortcuts
 *
 * @param key - The key to listen for (e.g., 'a', 'b', 'c', 'd')
 * @param callback - Function to call when key is pressed
 * @param enabled - Whether the listener is active
 */
export function useKeyPress(
  key: string,
  callback: () => void,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Check if the pressed key matches
      if (event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [key, callback, enabled]);
}

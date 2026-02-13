import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DegradedBannerProps {
  visible: boolean;
}

export function DegradedBanner({ visible }: DegradedBannerProps): JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  // Don't render if not visible or if user dismissed
  if (!visible || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-2"
        role="status"
        aria-live="polite"
      >
        <div className="bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 max-w-3xl">
          {/* Info icon */}
          <svg
            className="w-5 h-5 text-amber-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>

          {/* Message */}
          <span className="flex-1">
            Session storage is temporarily limited — your game progress may not persist if the server restarts
          </span>

          {/* Dismiss button */}
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-300 hover:text-amber-100 transition-colors flex-shrink-0 p-1"
            aria-label="Dismiss message"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

import FocusTrap from 'focus-trap-react';
import { motion } from 'framer-motion';

interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onQuit }: PauseOverlayProps) {
  return (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: '#resume-button',
        escapeDeactivates: false,
        returnFocusOnDeactivate: true,
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-label="Game paused"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        <div className="text-center">
          {/* PAUSED text */}
          <h1 className="text-4xl font-bold text-white mb-8">PAUSED</h1>

          {/* Action buttons */}
          <div className="flex flex-col gap-4">
            <button
              id="resume-button"
              onClick={onResume}
              className="px-12 py-4 bg-teal-600 hover:bg-teal-700 text-white text-lg font-bold rounded-lg shadow-lg transition-colors"
            >
              Resume
            </button>
            <button
              onClick={onQuit}
              className="px-12 py-4 bg-transparent border-2 border-slate-500 hover:border-slate-400 text-white text-lg font-bold rounded-lg transition-colors"
            >
              Quit Game
            </button>
          </div>
        </div>
      </motion.div>
    </FocusTrap>
  );
}

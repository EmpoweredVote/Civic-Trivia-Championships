import { AnimatePresence, motion } from 'framer-motion';
import FocusTrap from 'focus-trap-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 z-40"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                escapeDeactivates: false,
                clickOutsideDeactivates: true,
                returnFocusOnDeactivate: true,
              }}
            >
              <div
                className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                aria-describedby="dialog-message"
              >
                {/* Title */}
                <h2
                  id="dialog-title"
                  className="text-xl font-bold text-white mb-3"
                >
                  {title}
                </h2>

                {/* Message */}
                <p id="dialog-message" className="text-slate-300 mb-6">{message}</p>

                {/* Buttons */}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                  >
                    {confirmText}
                  </button>
                </div>
              </div>
            </FocusTrap>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

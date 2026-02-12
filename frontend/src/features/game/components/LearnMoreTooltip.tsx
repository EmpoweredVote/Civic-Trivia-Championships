import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LearnMoreTooltipProps {
  teaserText: string;
  show: boolean;
  onDismiss: () => void;
  onReadMore: () => void;
}

export function LearnMoreTooltip({
  teaserText,
  show,
  onDismiss,
  onReadMore,
}: LearnMoreTooltipProps) {
  // Auto-dismiss after 2.5 seconds
  useEffect(() => {
    if (!show) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, 2500);

    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  // Tap anywhere to dismiss (capture phase)
  useEffect(() => {
    if (!show) return;

    const handleDocumentClick = () => {
      onDismiss();
    };

    // Use capture phase to catch clicks before they bubble
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [show, onDismiss]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-full mb-3 left-0 right-0 bg-slate-700 rounded-lg shadow-xl p-4 max-w-xs z-10"
          onClick={(e) => e.stopPropagation()} // Prevent self-dismissal
        >
          <p className="text-sm text-white mb-2">
            {teaserText}
          </p>
          <button
            onClick={onReadMore}
            className="text-teal-400 hover:text-teal-300 text-sm font-medium transition-colors"
          >
            Read more →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

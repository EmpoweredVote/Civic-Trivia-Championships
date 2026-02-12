import { Dialog, DialogPanel } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { TOPIC_ICONS, TOPIC_LABELS } from './TopicIcon';
import type { LearningContent } from '../../../types/game';

interface LearnMoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: LearningContent;
  userAnswer: number | null;
  correctAnswer: number;
}

export function LearnMoreModal({
  isOpen,
  onClose,
  content,
  userAnswer,
  correctAnswer,
}: LearnMoreModalProps) {
  // Get the icon component for this topic
  const TopicIconComponent = TOPIC_ICONS[content.topic];
  const topicLabel = TOPIC_LABELS[content.topic];

  // Determine answer-aware opener
  const getOpener = () => {
    if (userAnswer === correctAnswer) {
      // Correct answer
      return `That's right! ${content.paragraphs[0]}`;
    } else if (userAnswer === null) {
      // Timeout
      return `Time's up! Here's what you should know: ${content.paragraphs[0]}`;
    } else {
      // Wrong answer - show specific correction
      const correction = content.corrections[userAnswer.toString()];
      if (correction) {
        return `${correction} ${content.paragraphs[0]}`;
      }
      return `That's not quite right. ${content.paragraphs[0]}`;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog static open={isOpen} onClose={onClose} className="relative z-50">
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal container */}
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <DialogPanel className="relative bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-6 h-6"
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

              {/* Content - NO header/title, dive straight into content */}
              <div className="space-y-4 pr-8">
                {/* Topic icon and label */}
                <div className="flex items-center gap-2 text-teal-400">
                  <TopicIconComponent className="w-5 h-5" />
                  <span className="text-sm font-medium">{topicLabel}</span>
                </div>

                {/* Answer-aware opener paragraph */}
                <p className="text-white text-base leading-relaxed">
                  {getOpener()}
                </p>

                {/* Remaining paragraphs (2nd and 3rd if they exist) */}
                {content.paragraphs.slice(1).map((paragraph, index) => (
                  <p key={index} className="text-slate-300 text-base leading-relaxed">
                    {paragraph}
                  </p>
                ))}

                {/* Source citation */}
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    Source:{' '}
                    <a
                      href={content.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 transition-colors underline"
                    >
                      {content.source.name}
                    </a>
                  </p>
                </div>
              </div>
              </DialogPanel>
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}

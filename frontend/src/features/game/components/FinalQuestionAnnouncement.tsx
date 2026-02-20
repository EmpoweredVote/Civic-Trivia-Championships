import { motion, AnimatePresence } from 'framer-motion';

interface FinalQuestionAnnouncementProps {
  show: boolean;
}

export function FinalQuestionAnnouncement({ show }: FinalQuestionAnnouncementProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center"
        >
          {/* Content */}
          <div className="text-center relative">
            <motion.img
              src="/images/FinalQuestion_A.png"
              alt="Final Question"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-[60%] max-w-4xl mx-auto px-4"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
            {/* Decorative top line */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

            {/* Main announcement text with pulsing animation */}
            <motion.h1
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="text-5xl md:text-7xl font-bold text-white"
              style={{
                textShadow: '0 0 40px rgba(251, 191, 36, 0.4), 0 0 80px rgba(251, 191, 36, 0.2)',
              }}
            >
              FINAL QUESTION
            </motion.h1>

            {/* Decorative bottom line */}
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

            {/* Spotlight gradient effect */}
            <div className="absolute inset-0 -z-10 bg-gradient-radial from-amber-500/10 via-transparent to-transparent blur-3xl" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
          style={{
            minHeight: '100vh',
            background: '#0A0806',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center', padding: '0 16px' }}>
            <motion.h1
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(56px, 11vw, 144px)',
                lineHeight: 1,
                letterSpacing: '0.04em',
                margin: 0,
                background: 'linear-gradient(180deg, #FFF3A3 0%, #FFD60A 45%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 0 24px rgba(255, 196, 0, 0.45)) drop-shadow(0 0 60px rgba(245, 158, 11, 0.25))',
              }}
            >
              Final Question
            </motion.h1>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

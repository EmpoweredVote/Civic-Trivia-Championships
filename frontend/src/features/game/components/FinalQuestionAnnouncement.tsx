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
          <div style={{ textAlign: 'center' }}>
            <motion.img
              src="/images/FinalQuestion_A.png"
              alt="Final Question"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '60%', maxWidth: 'clamp(480px, 40vw, 720px)', margin: '0 auto', display: 'block', padding: '0 16px' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

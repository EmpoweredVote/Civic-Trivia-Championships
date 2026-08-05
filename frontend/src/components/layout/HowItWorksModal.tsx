import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import FocusTrap from 'focus-trap-react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  { title: 'Choose a Collection', desc: 'Select trivia about your city, state, federal government, or important issues.' },
  { title: 'Answer Questions', desc: 'Test your civic knowledge and earn points for correct answers.' },
  { title: 'Climb the Leaderboard', desc: 'Improve your score, unlock achievements, and compete with other players.' },
];

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export function HowItWorksModal({ isOpen, onClose, darkMode }: HowItWorksModalProps) {
  const navigate = useNavigate();
  const panelBg = darkMode ? '#161B22' : '#FFFFFF';
  const titleColor = darkMode ? '#F1F5F9' : '#0F172A';
  const stepTitleColor = darkMode ? '#E2E8F0' : '#0F172A';
  const stepDescColor = darkMode ? '#7C90AC' : '#94A3B8';
  const closeColor = darkMode ? '#7487A1' : '#94A3B8';
  const numBg = darkMode ? 'rgba(0,199,177,0.15)' : 'rgba(0,199,177,0.12)';

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog static open={isOpen} onClose={onClose} className="relative z-[100]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  escapeDeactivates: true,
                  clickOutsideDeactivates: true,
                  returnFocusOnDeactivate: true,
                }}
              >
                <DialogPanel
                  style={{
                    position: 'relative', background: panelBg, borderRadius: 16,
                    padding: 28, maxWidth: 420, width: '100%',
                    maxHeight: '90vh', overflowY: 'auto' as const,
                  }}
                >
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                      position: 'absolute', top: 16, right: 16,
                      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'none', border: 'none', cursor: 'pointer', color: closeColor,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
                    <DialogTitle as="h2" style={{
                      fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 20,
                      color: titleColor, margin: 0,
                    }}>
                      How to Play
                    </DialogTitle>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 20 }}>
                    {STEPS.map((s, i) => (
                      <div key={s.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
                          background: numBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, color: '#00C7B1',
                        }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 700, color: stepTitleColor, lineHeight: 1.3 }}>
                            {s.title}
                          </div>
                          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: stepDescColor, marginTop: 3, lineHeight: 1.45 }}>
                            {s.desc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      navigate('/play');
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', marginTop: 26,
                      padding: '14px 26px', borderRadius: 12,
                      background: '#FFD426', border: 'none', cursor: 'pointer',
                      fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 16,
                      color: '#0F0D09', transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#DBB621'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFD426'; }}
                  >
                    <svg width="12" height="14" viewBox="0 0 14 16" fill="currentColor">
                      <path d="M1.5 1l11 7-11 7V1z"/>
                    </svg>
                    Start Playing
                  </button>
                </DialogPanel>
              </FocusTrap>
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}

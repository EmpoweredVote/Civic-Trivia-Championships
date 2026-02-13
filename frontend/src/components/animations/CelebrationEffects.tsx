import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface CelebrationEffectsProps {
  streak: number;
}

export function CelebrationEffects({ streak }: CelebrationEffectsProps) {
  const reducedMotion = useReducedMotion();
  const [showLabel, setShowLabel] = useState(false);
  const [labelText, setLabelText] = useState('');
  const [labelStyle, setLabelStyle] = useState('');

  useEffect(() => {
    // Only show label at specific milestones (5, 7+)
    if (streak === 5) {
      setLabelText('On Fire!');
      setLabelStyle('text-amber-400 bg-amber-900/20 border-amber-500/30');
      setShowLabel(true);
    } else if (streak >= 7) {
      setLabelText('Unstoppable!');
      setLabelStyle('text-yellow-300 bg-yellow-900/20 border-yellow-500/30');
      setShowLabel(true);
    } else {
      setShowLabel(false);
    }

    // Auto-dismiss after 2 seconds
    if (streak === 5 || streak >= 7) {
      const timeout = setTimeout(() => {
        setShowLabel(false);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [streak]);

  // For reduced motion, show a simple static badge instead of animated label
  if (reducedMotion && showLabel) {
    return (
      <div
        className={`fixed top-1/3 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-6 py-3 rounded-lg border-2 font-bold text-2xl ${labelStyle}`}
      >
        {labelText}
      </div>
    );
  }

  return (
    <AnimatePresence>
      {showLabel && (
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 1.2, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-1/3 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-6 py-3 rounded-lg border-2 font-bold text-2xl ${labelStyle}`}
        >
          {labelText}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameTheme } from '../gameTheme';

interface LockInButtonProps {
  onLockIn: () => void;
}

export function LockInButton({ onLockIn }: LockInButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { G } = useGameTheme();

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="focus-ring-primary"
      aria-label="Lock In"
      onClick={onLockIn}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        fontFamily: "'Manrope', sans-serif",
        fontSize: '15px',
        fontWeight: 600,
        letterSpacing: '0px',
        background: isHovered ? G.btnHover : G.btn,
        color: G.btnText,
        border: 'none',
        borderRadius: '10px',
        padding: '10px 32px',
        width: '100%',
        minHeight: '40px',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      Lock In
    </motion.button>
  );
}

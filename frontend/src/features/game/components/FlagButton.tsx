import { motion } from 'framer-motion';

interface FlagButtonProps {
  flagged: boolean;          // Current flag state (controlled by parent)
  disabled: boolean;         // True when rate-limited
  onToggle: () => void;      // Parent handles the API call
  size?: 'sm' | 'md';       // 'sm' for results screen, 'md' for game screen (default: 'md')
  readOnly?: boolean;        // True on results screen (no click handler)
}

export function FlagButton({
  flagged,
  disabled,
  onToggle,
  size = 'md',
  readOnly = false
}: FlagButtonProps) {
  const handleClick = () => {
    if (!disabled && !readOnly) {
      onToggle();
    }
  };

  // Size classes
  const containerClass = size === 'sm' ? 'p-1.5' : 'p-2';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  // Tooltip text
  const tooltipText = disabled
    ? "Too many flags -- try again later"
    : (flagged ? "Unflag" : "Flag");

  return (
    <div
      className="relative group"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleClick}
        aria-label={flagged ? "Unflag question" : "Flag question"}
        disabled={disabled || readOnly}
        className={`${containerClass} transition-opacity ${
          disabled ? 'opacity-50 cursor-not-allowed' : readOnly ? 'cursor-default' : 'hover:opacity-80'
        }`}
      >
        <motion.svg
          className={`${iconSize} ${flagged ? 'text-amber-400' : 'text-slate-400'}`}
          viewBox="0 0 24 24"
          fill={flagged ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={flagged ? 0 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{
            fill: flagged ? 'currentColor' : 'none',
            strokeWidth: flagged ? 0 : 2,
          }}
          transition={{ duration: 0.2 }}
        >
          <path d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
        </motion.svg>
      </button>

      {/* CSS hover tooltip - only show when not read-only */}
      {!readOnly && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-700 text-white text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          {tooltipText}
        </div>
      )}
    </div>
  );
}

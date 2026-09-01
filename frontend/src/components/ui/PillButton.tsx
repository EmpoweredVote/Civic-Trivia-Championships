import { useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Matches the home page's primary CTA ("Start Playing"): pill shape, bright gold, bold Manrope.
const CTA_BG = '#FFD426';
const CTA_BG_HOVER = '#DBB621';
const CTA_TEXT = '#0F0D09';

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  inkColor?: string; // ghost variant text/border color, defaults to inherited muted ink
}

export function PillButton({
  children,
  variant = 'primary',
  inkColor,
  style,
  disabled,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: PillButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const primaryStyle = {
    background: disabled ? '#E8DAA0' : isHovered ? CTA_BG_HOVER : CTA_BG,
    color: CTA_TEXT,
    border: 'none',
  };

  const ghostStyle = {
    background: 'transparent',
    color: inkColor,
    border: `1px solid ${inkColor}`,
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={(e) => { setIsHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setIsHovered(false); onMouseLeave?.(e); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '14px 28px',
        borderRadius: 12,
        fontFamily: "'Manrope', sans-serif",
        fontWeight: 700,
        fontSize: 16,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 0.2s, color 0.2s, border-color 0.2s, opacity 0.15s',
        ...(variant === 'primary' ? primaryStyle : ghostStyle),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

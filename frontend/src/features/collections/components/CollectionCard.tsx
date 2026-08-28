import { useState } from 'react';
import type { CollectionSummary } from '../types';
import { useTheme } from '../../../hooks/useTheme';

interface CollectionCardProps {
  collection: CollectionSummary;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onPlay?: (id: number) => void;
}

function getRegion(c: CollectionSummary): string {
  if (c.localeName) return c.localeName.toUpperCase();
  if (c.tier === 'federal') return 'UNITED STATES';
  if (c.tier === 'state') return 'STATE LEVEL';
  return 'LOCAL';
}

export function CollectionCard({ collection, isSelected, onSelect, onPlay }: CollectionCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { darkMode } = useTheme();

  const region = getRegion(collection);

  const cardBg = darkMode ? '#161B22' : '#FFFFFF';
  const borderColor = isSelected
    ? '#FFD426'
    : isHovered
    ? 'rgba(0,199,177,0.4)'
    : darkMode ? '#21262D' : '#E2E8F0';
  const shadow = isSelected
    ? '0 0 0 2px #FFD426, 0 8px 24px rgba(255,212,38,0.2)'
    : isHovered
    ? '0 4px 16px rgba(0,0,0,0.18)'
    : darkMode ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.08)';
  // The inline boxShadow above always wins over the app's global `*:focus-visible`
  // rule (inline styles beat stylesheet selectors), which would otherwise make
  // keyboard focus invisible on this tile. Layer an explicit focus ring on top.
  const focusRing = '0 0 0 3px #00C7B1, 0 0 12px rgba(0,199,177,0.5)';
  const combinedShadow = isFocused ? `${shadow}, ${focusRing}` : shadow;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(collection.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(collection.id);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      aria-pressed={isSelected}
      aria-label={`${collection.name}${isSelected ? ', selected' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        textAlign: 'left',
        background: 'none',
        padding: 0,
        cursor: 'pointer',
        outline: 'none',
        borderRadius: 16,
        overflow: 'hidden',
        border: `2px solid ${borderColor}`,
        boxShadow: combinedShadow,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Photo */}
      <div style={{ position: 'relative', height: 160, flexShrink: 0, overflow: 'hidden', background: collection.themeColor }}>
        <img
          src={`/images/collections/${collection.slug}.jpg`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />

        {/* Selected overlay + checkmark */}
        {isSelected && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,212,38,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: '#FFD426',
              boxShadow: '0 0 0 5px rgba(255,212,38,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4.5 11.5l4.5 4.5 8-9" stroke="#0F0D09" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ background: cardBg, padding: '14px 16px 14px', flex: 1, display: 'flex', flexDirection: 'column' as const }}>
        {/* Region */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <svg width="10" height="13" viewBox="0 0 10 13" fill="#D4A017" style={{ flexShrink: 0 }}>
            <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8C10 2.24 7.76 0 5 0zm0 6.5A1.5 1.5 0 115 3.5a1.5 1.5 0 010 3z"/>
          </svg>
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 700, fontSize: 10,
            letterSpacing: '0.12em', color: '#D4A017',
            textTransform: 'uppercase' as const,
          }}>
            {region}
          </span>
        </div>

        {/* City name */}
        <div style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 800, fontSize: 20,
          color: darkMode ? '#F1F5F9' : '#0F172A',
          lineHeight: 1.1, marginBottom: 8,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap' as const,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {collection.name}
        </div>

        {/* Description */}
        <div style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 400, fontSize: 12,
          color: darkMode ? '#7C90AC' : '#94A3B8',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
          height: isSelected && onPlay ? 'auto' : 54,
        }}>
          {collection.description}
        </div>

        {/* Play — only on the selected tile */}
        {isSelected && onPlay && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPlay(collection.id); }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Play ${collection.name}`}
            style={{
              marginTop: 8,
              width: '100%',
              minHeight: 44,
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: '#FFD426',
              color: '#0F0D09',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#DBB621'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FFD426'; }}
          >
            <svg width="11" height="13" viewBox="0 0 14 16" fill="currentColor">
              <path d="M1.5 1l11 7-11 7V1z" />
            </svg>
            Play
          </button>
        )}

      </div>
    </div>
  );
}

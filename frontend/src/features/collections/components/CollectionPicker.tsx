import { useState } from 'react';
import type { CollectionSummary } from '../types';
import { CollectionCard } from './CollectionCard';
import { useTheme } from '../../../hooks/useTheme';
import { BobbitCivicFactSitter } from '../../../components/bobbits/BobbitCivicFactSitter';

const TIER_SECTIONS: { tier: CollectionSummary['tier']; label: string }[] = [
  { tier: 'city', label: 'City' },
  { tier: 'state', label: 'State' },
  { tier: 'federal', label: 'Federal' },
  { tier: 'international', label: 'Issues' },
];

function groupByTier(collections: CollectionSummary[]): Map<string, CollectionSummary[]> {
  const groups = new Map<string, CollectionSummary[]>();
  for (const c of collections) {
    const list = groups.get(c.tier) ?? [];
    list.push(c);
    groups.set(c.tier, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}

function filterCollections(collections: CollectionSummary[], query: string): CollectionSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return collections;
  return collections.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.localeName?.toLowerCase().includes(q) ?? false) ||
    (c.localeCode?.toLowerCase().includes(q) ?? false)
  );
}

const TIER_ORDER: Record<string, number> = { city: 0, state: 1, federal: 2, international: 3 };

function sortByTierThenName(collections: CollectionSummary[]): CollectionSummary[] {
  return [...collections].sort((a, b) => {
    const tierDiff = (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99);
    if (tierDiff !== 0) return tierDiff;
    return a.name.localeCompare(b.name);
  });
}

interface CollectionPickerProps {
  collections: CollectionSummary[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  /** Launches the given collection directly. When provided, the selected tile shows its own Play button. */
  onPlay?: (id: number) => void;
  /** 'full' groups everything into City/State/Federal/Issues sections. 'preview' shows a flat, capped teaser with a "See more" link. */
  variant?: 'full' | 'preview';
  previewLimit?: number;
  onSeeMore?: () => void;
}

function GridSkeleton({ darkMode }: { darkMode: boolean }) {
  const bg = darkMode ? '#161B22' : '#E2E8F0';
  const shimmer = darkMode ? '#21262D' : '#CBD5E1';
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${darkMode ? '#21262D' : '#E2E8F0'}` }}>
      <div style={{ height: 160, background: bg }} />
      <div style={{ background: darkMode ? '#161B22' : '#FFFFFF', padding: '14px 16px 16px' }}>
        <div style={{ height: 10, width: '50%', background: shimmer, borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 18, width: '70%', background: shimmer, borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 10, width: '100%', background: shimmer, borderRadius: 6, marginBottom: 6 }} />
        <div style={{ height: 10, width: '80%', background: shimmer, borderRadius: 6, marginBottom: 6 }} />
        <div style={{ height: 10, width: '60%', background: shimmer, borderRadius: 6 }} />
      </div>
    </div>
  );
}

function SectionDivider({ label, darkMode, isFirst }: { label: string; darkMode: boolean; isFirst: boolean }) {
  const labelColor = darkMode ? '#5EEAD4' : '#0F766E';
  const lineColor = darkMode ? '#21262D' : '#E2E8F0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: isFirst ? '0 0 16px' : '32px 0 16px' }}>
      <span style={{
        fontFamily: "'Manrope', sans-serif",
        fontWeight: 800, fontSize: 13,
        letterSpacing: '0.14em', color: labelColor,
        textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
      }}>
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: lineColor }} />
    </div>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ClearIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronRightIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CollectionPicker({
  collections,
  selectedId,
  loading,
  onSelect,
  onPlay,
  variant = 'full',
  previewLimit = 10,
  onSeeMore,
}: CollectionPickerProps) {
  const { darkMode } = useTheme();
  const [query, setQuery] = useState('');
  const headingColor = darkMode ? '#F1F5F9' : '#0F172A';
  const countColor = darkMode ? '#7487A1' : '#94A3B8';
  const inputBg = darkMode ? '#161B22' : '#FFFFFF';
  const inputBorder = darkMode ? '#21262D' : '#E2E8F0';
  const inputText = darkMode ? '#F1F5F9' : '#0F172A';
  const placeholderColor = darkMode ? '#94A3B8' : '#64748B';
  const accentColor = darkMode ? '#00C7B1' : '#00657C';

  const filtered = filterCollections(collections, query);
  const isPreview = variant === 'preview';
  // Selection is shown via the card's own highlight/badge, never by moving it — the grid's
  // order stays put (tier-then-name) whichever collection is selected.
  const previewItems = isPreview ? sortByTierThenName(filtered).slice(0, previewLimit) : filtered;

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap' as const,
        gap: 16, marginBottom: 16,
      }}>
        <h2 style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 900, fontSize: 28,
          color: headingColor,
          margin: 0, letterSpacing: '-0.01em',
        }}>
          {variant === 'preview' ? 'Featured Collections' : 'All Collections'}
        </h2>

        {!loading && collections.length > 0 && isPreview && (
          <button
            type="button"
            onClick={onSeeMore}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15,
              color: accentColor,
            }}
          >
            Explore
            <ChevronRightIcon color={accentColor} />
          </button>
        )}
      </div>

      {/* Search */}
      {!loading && collections.length > 0 && (
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 10,
          background: inputBg, border: `1px solid ${inputBorder}`,
          borderRadius: 12, padding: '12px 16px',
          width: '100%', boxSizing: 'border-box' as const,
          marginBottom: 24,
        }}>
          {isPreview && <BobbitCivicFactSitter darkMode={darkMode} />}
          <SearchIcon color={placeholderColor} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search collections by city, state, or name..."
            aria-label="Search collections"
            className={darkMode ? 'placeholder:text-[#94A3B8]' : 'placeholder:text-[#64748B]'}
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none',
              background: 'transparent', color: inputText,
              fontFamily: "'Manrope', sans-serif", fontWeight: 400, fontSize: 12,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                color: placeholderColor,
              }}
            >
              <ClearIcon color={placeholderColor} />
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <GridSkeleton key={i} darkMode={darkMode} />
          ))}
        </div>
      ) : collections.length === 0 ? null : filtered.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center' as const,
          fontFamily: "'Manrope', sans-serif", fontSize: 14, color: countColor,
        }}>
          No collections match "{query}".
        </div>
      ) : isPreview ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
          {previewItems.map(c => (
            <CollectionCard
              key={c.id}
              collection={c}
              isSelected={selectedId === c.id}
              onSelect={onSelect}
              onPlay={onPlay}
            />
          ))}
        </div>
      ) : (
        (() => {
          const grouped = groupByTier(filtered);
          const visibleSections = TIER_SECTIONS.filter(({ tier }) => (grouped.get(tier)?.length ?? 0) > 0);
          return visibleSections.map(({ tier, label }, idx) => {
            const items = grouped.get(tier) ?? [];
            return (
              <div key={tier}>
                <SectionDivider label={label} darkMode={darkMode} isFirst={idx === 0} />
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
                  {items.map(c => (
                    <CollectionCard
                      key={c.id}
                      collection={c}
                      isSelected={selectedId === c.id}
                      onSelect={onSelect}
                      onPlay={onPlay}
                    />
                  ))}
                </div>
              </div>
            );
          });
        })()
      )}
    </div>
  );
}

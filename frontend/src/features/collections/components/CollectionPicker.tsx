import type { CollectionSummary } from '../types';
import { CollectionCard } from './CollectionCard';
import { useTheme } from '../../../hooks/useTheme';

const TIER_ORDER: Record<string, number> = { city: 0, state: 1, federal: 2, international: 3 };

function sortCollections(collections: CollectionSummary[]): CollectionSummary[] {
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

export function CollectionPicker({ collections, selectedId, loading, onSelect }: CollectionPickerProps) {
  const { darkMode } = useTheme();
  const headingColor = darkMode ? '#F1F5F9' : '#0F172A';
  const countColor = darkMode ? '#475569' : '#94A3B8';

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <h2 style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 900, fontSize: 28,
          color: headingColor,
          margin: 0, letterSpacing: '-0.01em',
        }}>
          All Collections
        </h2>
        {!loading && collections.length > 0 && (
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 700, fontSize: 12,
            letterSpacing: '0.12em',
            color: countColor,
            textTransform: 'uppercase' as const,
          }}>
            {collections.length} AVAILABLE
          </span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <GridSkeleton key={i} darkMode={darkMode} />
          ))}
        </div>
      ) : collections.length === 0 ? null : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
          {sortCollections(collections).map(c => (
            <CollectionCard
              key={c.id}
              collection={c}
              isSelected={selectedId === c.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

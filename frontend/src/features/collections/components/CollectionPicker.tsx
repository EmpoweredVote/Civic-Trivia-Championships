import type { CollectionSummary } from '../types';
import { CollectionCard } from './CollectionCard';
import { CollectionCardSkeleton } from './CollectionCardSkeleton';

interface CollectionPickerProps {
  collections: CollectionSummary[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
}

export function CollectionPicker({ collections, selectedId, loading, onSelect }: CollectionPickerProps) {
  // Don't render if empty and not loading
  if (!loading && collections.length === 0) {
    return null;
  }

  return (
    <div>
      {/* Section heading */}
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Choose Your Collection
      </h2>

      {/* Cards container - responsive layout */}
      <div className="flex flex-col sm:flex-row gap-3 pb-2">
        {loading ? (
          // Show 3 skeleton placeholders during loading
          <>
            <CollectionCardSkeleton />
            <CollectionCardSkeleton />
            <CollectionCardSkeleton />
          </>
        ) : (
          // Show actual collection cards when loaded
          collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              isSelected={selectedId === collection.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

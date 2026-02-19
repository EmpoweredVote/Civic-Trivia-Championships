export function CollectionCardSkeleton() {
  return (
    <div className="w-full sm:w-48 rounded-xl overflow-hidden flex-shrink-0">
      {/* Header band placeholder */}
      <div className="h-14 bg-slate-700 animate-pulse" />

      {/* Body with placeholder lines */}
      <div className="bg-slate-800 p-3 space-y-2">
        <div className="h-4 bg-slate-700 animate-pulse rounded w-3/4" />
        <div className="h-3 bg-slate-700 animate-pulse rounded w-full" />
        <div className="h-3 bg-slate-700 animate-pulse rounded w-1/2" />
      </div>
    </div>
  );
}

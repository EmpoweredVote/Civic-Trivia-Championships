import type { CollectionSummary } from '../types';
import { useAuthStore } from '../../../store/authStore';

interface CollectionCardProps {
  collection: CollectionSummary;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export function CollectionCard({ collection, isSelected, onSelect }: CollectionCardProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.isAdmin === true;

  return (
    <button
      onClick={() => onSelect(collection.id)}
      className={[
        'relative rounded-xl overflow-hidden transition-all duration-200 text-left w-full sm:w-48 flex-shrink-0',
        isSelected
          ? 'ring-2 ring-teal-400 shadow-xl scale-105'
          : 'opacity-80 hover:opacity-100 hover:scale-[1.02]',
      ].join(' ')}
      aria-pressed={isSelected}
      aria-label={`${collection.name}${isAdmin ? `, ${collection.questionCount} questions` : ''}${isSelected ? ', selected' : ''}`}
    >
      {/* Banner image with themeColor fallback */}
      <div
        className="h-28 rounded-t-xl overflow-hidden"
        style={{ backgroundColor: collection.themeColor }}
      >
        <img
          src={`/images/collections/${collection.slug}.jpg`}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Card body */}
      <div className="bg-slate-800 p-3">
        <div className="text-white font-semibold text-sm leading-tight">
          {collection.name}
        </div>
        <div className="text-slate-400 text-xs mt-1 line-clamp-3 min-h-[3rem]">
          {collection.description}
        </div>
        {isAdmin && (
          <div className="text-slate-500 text-xs mt-2">
            {collection.questionCount} questions
          </div>
        )}
      </div>

      {/* Selected checkmark indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-teal-400 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  );
}

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableOptionProps {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
  onTextChange: (text: string) => void;
  onMarkCorrect: () => void;
}

export function SortableOption({
  id,
  label,
  text,
  isCorrect,
  onTextChange,
  onMarkCorrect,
}: SortableOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600 p-1 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <circle cx="7" cy="5" r="1.5" />
          <circle cx="13" cy="5" r="1.5" />
          <circle cx="7" cy="10" r="1.5" />
          <circle cx="13" cy="10" r="1.5" />
          <circle cx="7" cy="15" r="1.5" />
          <circle cx="13" cy="15" r="1.5" />
        </svg>
      </button>

      {/* Label */}
      <span className="font-semibold text-gray-700 w-6">{label}.</span>

      {/* Text input */}
      <input
        type="text"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        maxLength={150}
        className="flex-1 px-3 py-2 border border-gray-300 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
        placeholder="Enter option text"
      />

      {/* Correct answer radio */}
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="correctAnswer"
          checked={isCorrect}
          onChange={onMarkCorrect}
          className="w-5 h-5 text-red-600 focus:ring-red-500"
        />
        <span className="sr-only">Correct</span>
      </label>
    </div>
  );
}

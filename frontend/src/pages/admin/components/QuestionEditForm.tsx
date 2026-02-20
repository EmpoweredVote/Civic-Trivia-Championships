import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableOption } from './SortableOption';

interface QuestionDetail {
  id: number;
  externalId: string;
  text: string;
  difficulty: string;
  status: string;
  createdAt: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  source: {
    name: string;
    url: string | null;
  };
  encounterCount: number;
  correctCount: number;
  qualityScore: number | null;
  violations: Array<{
    rule: string;
    severity: 'blocking' | 'advisory';
    message: string;
    evidence?: string;
  }>;
}

export interface EditFormData {
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  sourceUrl: string;
  difficulty: number;
}

interface OptionItem {
  id: string;
  text: string;
}

interface QuestionEditFormProps {
  question: QuestionDetail;
  onSave: (data: EditFormData) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (isDirty: boolean) => void;
  isSaving: boolean;
}

export function QuestionEditForm({
  question,
  onSave,
  onCancel,
  onDirtyChange,
  isSaving,
}: QuestionEditFormProps) {
  // Map difficulty string to numeric value
  const difficultyToNumber = (diff: string): number => {
    switch (diff.toLowerCase()) {
      case 'easy':
        return 3;
      case 'medium':
        return 5;
      case 'hard':
        return 8;
      default:
        return 5;
    }
  };

  // Initialize form state from question
  const [text, setText] = useState(question.text);
  const [optionItems, setOptionItems] = useState<OptionItem[]>(
    question.options.map((opt, idx) => ({ id: `opt-${idx}`, text: opt }))
  );
  const [correctOptionId, setCorrectOptionId] = useState(
    `opt-${question.correctAnswer}`
  );
  const [explanation, setExplanation] = useState(question.explanation);
  const [sourceUrl, setSourceUrl] = useState(question.source.url || '');
  const [difficulty, setDifficulty] = useState(
    difficultyToNumber(question.difficulty)
  );
  const [sourceUrlError, setSourceUrlError] = useState('');

  // Store initial state for dirty tracking
  const [initialState] = useState({
    text: question.text,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    sourceUrl: question.source.url || '',
    difficulty: difficultyToNumber(question.difficulty),
  });

  // Dirty tracking
  useEffect(() => {
    const currentCorrectIndex = optionItems.findIndex(
      (item) => item.id === correctOptionId
    );
    const currentOptions = optionItems.map((item) => item.text);

    const isDirty =
      text !== initialState.text ||
      JSON.stringify(currentOptions) !== JSON.stringify(initialState.options) ||
      currentCorrectIndex !== initialState.correctAnswer ||
      explanation !== initialState.explanation ||
      sourceUrl !== initialState.sourceUrl ||
      difficulty !== initialState.difficulty;

    onDirtyChange(isDirty);
  }, [
    text,
    optionItems,
    correctOptionId,
    explanation,
    sourceUrl,
    difficulty,
    initialState,
    onDirtyChange,
  ]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOptionItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle option text change
  const handleOptionTextChange = (id: string, newText: string) => {
    setOptionItems((items) =>
      items.map((item) => (item.id === id ? { ...item, text: newText } : item))
    );
  };

  // URL validation
  const validateUrl = (url: string) => {
    if (!url.trim()) {
      setSourceUrlError('');
      return;
    }

    try {
      new URL(url);
      setSourceUrlError('');
    } catch {
      setSourceUrlError('Invalid URL format');
    }
  };

  // Handle source URL change
  const handleSourceUrlChange = (value: string) => {
    setSourceUrl(value);
    validateUrl(value);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation
    if (sourceUrlError) {
      return;
    }

    // Find the correct answer index
    const correctAnswerIndex = optionItems.findIndex(
      (item) => item.id === correctOptionId
    );

    if (correctAnswerIndex === -1) {
      return; // Should not happen
    }

    const formData: EditFormData = {
      text,
      options: optionItems.map((item) => item.text),
      correctAnswer: correctAnswerIndex,
      explanation,
      sourceUrl,
      difficulty,
    };

    await onSave(formData);
  };

  // Get difficulty label
  const getDifficultyLabel = (value: number): string => {
    if (value <= 3) return 'Easy';
    if (value <= 7) return 'Medium';
    return 'Hard';
  };

  // Get difficulty badge color
  const getDifficultyBadgeColor = (value: number): string => {
    if (value <= 3) return 'bg-green-100 text-green-800';
    if (value <= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Character counter component
  const CharacterCounter = ({
    current,
    max,
  }: {
    current: number;
    max: number;
  }) => {
    const isNearLimit = current > max * 0.9;
    return (
      <div
        className={`text-sm mt-1 ${isNearLimit ? 'text-red-600' : 'text-gray-500'}`}
      >
        {current}/{max} characters
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Question Text */}
      <div>
        <label
          htmlFor="questionText"
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          Question Text <span className="text-red-600">*</span>
        </label>
        <textarea
          id="questionText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          rows={3}
          required
          disabled={isSaving}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <CharacterCounter current={text.length} max={300} />
      </div>

      {/* Options */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Answer Options <span className="text-red-600">*</span>
        </label>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={optionItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {optionItems.map((item, index) => (
                <SortableOption
                  key={item.id}
                  id={item.id}
                  label={String.fromCharCode(65 + index)}
                  text={item.text}
                  isCorrect={item.id === correctOptionId}
                  onTextChange={(newText) =>
                    handleOptionTextChange(item.id, newText)
                  }
                  onMarkCorrect={() => setCorrectOptionId(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Explanation */}
      <div>
        <label
          htmlFor="explanation"
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          Explanation <span className="text-red-600">*</span>
        </label>
        <div className="text-xs text-gray-500 mb-1">
          Supports basic markdown (bold, italic, links)
        </div>
        <textarea
          id="explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          maxLength={500}
          rows={4}
          required
          disabled={isSaving}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <CharacterCounter current={explanation.length} max={500} />
      </div>

      {/* Source URL */}
      <div>
        <label
          htmlFor="sourceUrl"
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          Source URL
        </label>
        <input
          id="sourceUrl"
          type="url"
          value={sourceUrl}
          onChange={(e) => handleSourceUrlChange(e.target.value)}
          onBlur={(e) => validateUrl(e.target.value)}
          disabled={isSaving}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="https://example.com/source"
        />
        {sourceUrlError && (
          <div className="text-sm text-red-600 mt-1">{sourceUrlError}</div>
        )}
      </div>

      {/* Difficulty */}
      <div>
        <label
          htmlFor="difficulty"
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          Difficulty
        </label>
        <input
          id="difficulty"
          type="range"
          min={1}
          max={10}
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value))}
          disabled={isSaving}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-gray-700 font-medium">
            {difficulty}/10
          </span>
          <span
            className={`px-2 py-1 text-xs font-semibold rounded ${getDifficultyBadgeColor(difficulty)}`}
          >
            {getDifficultyLabel(difficulty)}
          </span>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !!sourceUrlError}
          className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

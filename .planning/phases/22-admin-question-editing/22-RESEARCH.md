# Phase 22: Admin Question Editing - Research

**Researched:** 2026-02-19
**Domain:** React inline editing forms, optimistic updates, drag-and-drop reordering, quality re-scoring
**Confidence:** HIGH

## Summary

Phase 22 extends the existing Phase 20 question detail panel with inline editing capabilities. The admin can toggle the panel into edit mode, modify question fields (text, options, explanation, source URL, difficulty), reorder answer options via drag-and-drop, and save changes. On save, the backend re-runs the quality rules engine (Phase 19), updates quality_score and violation_count in the database, and returns before/after quality comparison. The frontend updates the table row optimistically without full page reload.

The project already has all necessary dependencies: React 18.2.0, React Router 6.21.1 (with stable useBlocker for unsaved changes), Headless UI 2.2.9 (Dialog for the panel), Tailwind CSS 3.4.1 (form styling), and Zod 4.3.6 (validation on backend). The standard pattern uses controlled form inputs with useState, character counters for text fields, drag-and-drop with @dnd-kit/sortable for option reordering, and a PUT endpoint that validates with Zod, re-scores with the quality rules engine, and returns delta.

**Primary recommendation:** Build edit mode as a toggle state within QuestionDetailPanel. Use controlled inputs with useState for all fields, add @dnd-kit/sortable for option reordering, implement useBlocker to warn on unsaved changes, create PUT /api/admin/questions/:id endpoint with Zod validation and quality re-scoring, and display before/after quality comparison modal on save. Update the question table row in-place using callback prop.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2.0 | UI framework | Already in project, useState for form state |
| React Router | 6.21.1 | useBlocker for unsaved changes warning | Already in project, stable useBlocker API in v6.21+ |
| Headless UI | 2.2.9 | Dialog component (existing panel), accessible modals | Already in project (Phase 20), used for QuestionDetailPanel |
| Tailwind CSS | 3.4.1 | Form input styling, badges, transitions | Already in project, utility-first for rapid UI |
| Zod | 4.3.6 | Backend validation for PUT request body | Already in project (Phase 19), schema validation |
| Express | 4.18.2 | Backend PUT endpoint | Already in project |
| Drizzle ORM | 0.45.1 | Database update query | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | 6.0.8+ | Drag-and-drop foundation | For option reordering (A/B/C/D position changes) |
| @dnd-kit/sortable | 7.0.2+ | Sortable list preset | Simplifies reorderable option list implementation |
| @dnd-kit/utilities | 3.2.1+ | arrayMove helper | Reorder array on drag end |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | react-beautiful-dnd | react-beautiful-dnd is deprecated and unmaintained since 2021; @dnd-kit is modern, actively maintained, smaller bundle, better touch/keyboard support |
| useState form state | react-hook-form | react-hook-form adds 25kb for features not needed (complex validation, field arrays); simple useState sufficient for 6 controlled inputs |
| useBlocker | window.beforeunload only | beforeunload handles browser close but not React Router navigation; useBlocker covers SPA navigation, combine both for full coverage |
| Inline character counter | No counter | User feedback improves UX; prevents validation errors on submit; minimal implementation cost (10 lines) |
| Optimistic table update | Full table refetch | Optimistic update feels instant; refetch causes flash and scroll jump; callback prop pattern avoids complexity |

**Installation:**
```bash
# New dependencies needed
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/pages/admin/components/
├── QuestionDetailPanel.tsx        # Extend with edit mode toggle
├── QuestionEditForm.tsx           # NEW - Edit mode UI (controlled inputs)
├── SortableOption.tsx             # NEW - Draggable option item component
├── ConfirmationDialog.tsx         # NEW - Reusable confirmation modal
└── QualityComparisonModal.tsx     # NEW - Before/after quality display

backend/src/routes/
└── admin.ts                       # Add PUT /questions/:id endpoint

backend/src/services/
└── questionService.ts             # NEW - Update question + re-score logic
```

### Pattern 1: Edit Mode Toggle in Slide-Over Panel
**What:** Single panel component switches between view and edit modes via boolean state flag
**When to use:** Inline editing where both view and edit need shared context (violations, metadata)
**Example:**
```typescript
// QuestionDetailPanel.tsx
export function QuestionDetailPanel({ questionId, onClose, onQuestionUpdated }: Props) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [questionDetail, setQuestionDetail] = useState<QuestionDetail | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch detail on questionId change
  useEffect(() => {
    if (!questionId) return;
    fetchQuestionDetail(questionId).then(setQuestionDetail);
    setIsEditMode(false); // Reset to view mode when navigating
    setHasUnsavedChanges(false);
  }, [questionId]);

  // Block navigation if unsaved changes
  useBlocker(() => hasUnsavedChanges);

  // Handle save success
  const handleSaveSuccess = (updated: QuestionDetail, qualityDelta: QualityDelta) => {
    setQuestionDetail(updated);
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    onQuestionUpdated(updated); // Update table row via callback
    showQualityComparison(qualityDelta); // Show before/after modal
  };

  return (
    <Dialog open={questionId !== null} onClose={handleClose}>
      <Dialog.Panel>
        {/* Header with Edit/Save/Cancel buttons */}
        <div className="bg-red-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <Dialog.Title>Question Details</Dialog.Title>
            {!isEditMode ? (
              <button onClick={() => setIsEditMode(true)}>Edit</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleSave}>Save</button>
                <button onClick={handleCancel}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Body - conditional render based on mode */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isEditMode ? (
            <QuestionEditForm
              question={questionDetail}
              onSave={handleSaveSuccess}
              onCancel={handleCancel}
              onDirtyChange={setHasUnsavedChanges}
            />
          ) : (
            <QuestionDetailView question={questionDetail} />
          )}
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
```
**Source:** [How to build an inline edit component in React](https://www.emgoto.com/react-inline-edit/), [Atlassian Design Inline Edit](https://atlassian.design/components/inline-edit/)

### Pattern 2: Unsaved Changes Warning with useBlocker
**What:** React Router's useBlocker hook intercepts navigation when form has unsaved changes, shows confirmation dialog
**When to use:** Any form where user might accidentally lose work by navigating away
**Example:**
```typescript
// QuestionEditForm.tsx
import { useBlocker } from 'react-router-dom';

export function QuestionEditForm({ question, onSave, onCancel, onDirtyChange }: Props) {
  const [formData, setFormData] = useState(question);
  const [isDirty, setIsDirty] = useState(false);

  // Track dirty state
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(question);
    setIsDirty(hasChanges);
    onDirtyChange(hasChanges);
  }, [formData, question]);

  // Block navigation if unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Show confirmation dialog on blocked navigation
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const shouldProceed = window.confirm(
        'You have unsaved changes. Discard changes and leave?'
      );
      if (shouldProceed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Also warn on browser close/reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```
**Source:** [React Router useBlocker](https://reactrouter.com/api/hooks/useBlocker), [Building a Custom Confirmation Dialog for Unsaved Changes with React Router v6](https://medium.com/@mohamedmaher_73467/building-a-custom-confirmation-dialog-for-unsaved-changes-with-react-router-v6-d1e4dfe5f58c)

### Pattern 3: Drag-and-Drop Option Reordering with @dnd-kit
**What:** Sortable list of answer options with drag handles, reorders A/B/C/D positions
**When to use:** Reordering fixed-count lists (always 4 options)
**Example:**
```typescript
// QuestionEditForm.tsx
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { SortableOption } from './SortableOption';

export function QuestionEditForm({ question, onSave }: Props) {
  const [options, setOptions] = useState(question.options);
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = options.findIndex((_, idx) => idx === active.id);
    const newIndex = options.findIndex((_, idx) => idx === over.id);

    // Reorder options array
    const reordered = arrayMove(options, oldIndex, newIndex);
    setOptions(reordered);

    // Update correctAnswer index to follow moved option
    if (correctAnswer === oldIndex) {
      setCorrectAnswer(newIndex);
    } else if (oldIndex < correctAnswer && newIndex >= correctAnswer) {
      setCorrectAnswer(correctAnswer - 1);
    } else if (oldIndex > correctAnswer && newIndex <= correctAnswer) {
      setCorrectAnswer(correctAnswer + 1);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={options.map((_, idx) => idx)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {options.map((optionText, idx) => (
            <SortableOption
              key={idx}
              id={idx}
              label={String.fromCharCode(65 + idx)} // A, B, C, D
              text={optionText}
              isCorrect={correctAnswer === idx}
              onTextChange={(newText) => updateOption(idx, newText)}
              onMarkCorrect={() => setCorrectAnswer(idx)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// SortableOption.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  id: number;
  label: string; // A, B, C, D
  text: string;
  isCorrect: boolean;
  onTextChange: (text: string) => void;
  onMarkCorrect: () => void;
}

export function SortableOption({ id, label, text, isCorrect, onTextChange, onMarkCorrect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 bg-white border rounded">
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="cursor-grab p-1 text-gray-400 hover:text-gray-600">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </button>

      {/* Option label */}
      <span className="font-semibold text-gray-700 w-6">{label}.</span>

      {/* Text input */}
      <input
        type="text"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded focus:border-red-500 focus:ring-red-500"
      />

      {/* Correct answer radio */}
      <input
        type="radio"
        name="correctAnswer"
        checked={isCorrect}
        onChange={onMarkCorrect}
        className="w-5 h-5 text-red-600"
      />
    </div>
  );
}
```
**Source:** [@dnd-kit Sortable](https://docs.dndkit.com/presets/sortable), [Create sortable drag and drop in React JS using dnd-kit library](https://medium.com/@kurniawanc/create-sortable-drag-and-drop-in-react-js-using-dnd-kit-library-ba8b2917a6b5)

### Pattern 4: Character Counter for Text Fields
**What:** Display current/max character count below textarea, update in real-time as user types
**When to use:** Text fields with character limits (question text, explanation)
**Example:**
```typescript
// CharacterCountedTextarea.tsx
interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
  required?: boolean;
}

export function CharacterCountedTextarea({
  label,
  value,
  onChange,
  maxLength,
  rows = 4,
  required = false
}: Props) {
  const currentLength = value.length;
  const isNearLimit = currentLength > maxLength * 0.9;
  const isOverLimit = currentLength > maxLength;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 ${
          isOverLimit
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-red-500 focus:ring-red-500'
        }`}
      />
      <div className={`text-sm mt-1 ${isNearLimit ? 'text-red-600' : 'text-gray-500'}`}>
        {currentLength}/{maxLength} characters
      </div>
    </div>
  );
}
```
**Source:** [Get the Number of Characters for a Text Area Using React's useState Hook](https://egghead.io/lessons/egghead-get-the-number-of-characters-for-a-text-area-using-react-s-usestate-hook), [Implementing a character counter in React](https://www.createit.com/blog/character-counter-in-react/)

### Pattern 5: Backend Update with Quality Re-Scoring
**What:** PUT endpoint validates input with Zod, updates database, re-runs quality rules engine, returns before/after delta
**When to use:** Any edit that affects quality score
**Example:**
```typescript
// backend/src/routes/admin.ts
import { z } from 'zod';
import { updateQuestionAndReScore } from '../services/questionService.js';

const UpdateQuestionSchema = z.object({
  text: z.string().min(20).max(300),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(30).max(500),
  sourceUrl: z.string().url(),
  difficulty: z.number().int().min(1).max(10), // Admin uses numeric 1-10
});

router.put('/questions/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const questionId = parseInt(req.params.id);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    // Validate request body
    const validation = UpdateQuestionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const { text, options, correctAnswer, explanation, sourceUrl, difficulty } = validation.data;

    // Fetch existing question for before comparison
    const existingQuestion = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (existingQuestion.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const oldQualityScore = existingQuestion[0].qualityScore;
    const oldViolationCount = existingQuestion[0].violationCount;

    // Update question in database
    await db
      .update(questions)
      .set({
        text,
        options,
        correctAnswer,
        explanation,
        source: {
          name: existingQuestion[0].source.name, // Keep existing name
          url: sourceUrl
        },
        difficulty: mapNumericToDifficulty(difficulty), // Convert 1-10 to easy/medium/hard
        updatedAt: new Date()
      })
      .where(eq(questions.id, questionId));

    // Re-run quality audit
    const questionInput = {
      text,
      options,
      correctAnswer,
      explanation,
      difficulty: mapNumericToDifficulty(difficulty),
      source: { name: existingQuestion[0].source.name, url: sourceUrl },
      externalId: existingQuestion[0].externalId
    };

    const auditResult = await auditQuestion(questionInput, { skipUrlCheck: false });

    // Update quality scores
    await db
      .update(questions)
      .set({
        qualityScore: auditResult.score,
        violationCount: auditResult.violations.length
      })
      .where(eq(questions.id, questionId));

    // Fetch updated question
    const updated = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    res.json({
      question: updated[0],
      qualityDelta: {
        oldScore: oldQualityScore,
        newScore: auditResult.score,
        oldViolations: oldViolationCount,
        newViolations: auditResult.violations.length,
        violations: auditResult.violations
      }
    });
  } catch (error: any) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question', detail: error?.message });
  }
});

// Helper: Map numeric difficulty to easy/medium/hard
function mapNumericToDifficulty(numeric: number): 'easy' | 'medium' | 'hard' {
  if (numeric <= 3) return 'easy';
  if (numeric <= 7) return 'medium';
  return 'hard';
}
```
**Source:** [Zod validation in TypeScript](https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view), Phase 19 quality rules engine patterns

### Pattern 6: Quality Comparison Modal
**What:** Modal displays before/after quality score and violations summary after save
**When to use:** Informational feedback on quality changes without blocking save
**Example:**
```typescript
// QualityComparisonModal.tsx
interface QualityDelta {
  oldScore: number | null;
  newScore: number;
  oldViolations: number;
  newViolations: number;
  violations: Violation[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  delta: QualityDelta;
}

export function QualityComparisonModal({ isOpen, onClose, delta }: Props) {
  const scoreChange = (delta.newScore - (delta.oldScore ?? 0));
  const scoreImproved = scoreChange > 0;
  const violationsChanged = delta.newViolations !== delta.oldViolations;

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <Dialog.Panel className="max-w-md mx-auto mt-20 bg-white rounded-lg shadow-xl">
        <div className="px-6 py-4 border-b">
          <Dialog.Title className="text-lg font-semibold">
            Quality Re-Scoring Complete
          </Dialog.Title>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Score comparison */}
          <div>
            <div className="text-sm text-gray-600 mb-2">Quality Score</div>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-gray-400">
                {delta.oldScore ?? 'N/A'}
              </div>
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <div className={`text-2xl font-bold ${
                scoreImproved ? 'text-green-600' : scoreChange < 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {delta.newScore}
                {scoreChange !== 0 && (
                  <span className="text-sm ml-2">
                    ({scoreChange > 0 ? '+' : ''}{scoreChange})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Violations comparison */}
          {violationsChanged && (
            <div>
              <div className="text-sm text-gray-600 mb-2">Violations</div>
              <div className="flex items-center gap-4">
                <div className="text-xl font-bold text-gray-400">
                  {delta.oldViolations}
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <div className={`text-xl font-bold ${
                  delta.newViolations < delta.oldViolations ? 'text-green-600' : 'text-red-600'
                }`}>
                  {delta.newViolations}
                </div>
              </div>
            </div>
          )}

          {/* Current violations list */}
          {delta.violations.length > 0 && (
            <div className="border-t pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                Current Violations
              </div>
              <div className="space-y-2">
                {delta.violations.map((v, idx) => (
                  <div key={idx} className="text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      v.severity === 'blocking' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {v.severity}
                    </span>
                    <span className="ml-2 text-gray-700">{v.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Close
          </button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
```
**Source:** [Headless UI Dialog](https://headlessui.com/react/dialog), Phase 20 existing modal patterns

### Anti-Patterns to Avoid
- **Saving difficulty as numeric in database:** Store as 'easy'/'medium'/'hard' string to match existing schema. Convert 1-10 numeric scale to string on save
- **Re-running URL validation on every edit:** Skip URL check with `skipUrlCheck: true` for fast response during editing. Only validate URLs on final save
- **Blocking save based on quality score:** Quality scores are informational. ALWAYS allow save, just show warning/comparison. Admin is the ultimate arbiter
- **Full page reload after save:** Update table row in-place via callback prop. Avoid full refetch that causes scroll jump and flash
- **Storing edit state in URL:** Edit mode is transient UI state, not persistent. Use local useState, not query params
- **Mutating props directly:** Never modify question prop directly. Clone to formData state, edit formData, save to backend, update via callback

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom mousedown/mousemove handlers | @dnd-kit/sortable | Handles touch events, keyboard navigation, accessibility (ARIA), smooth animations, collision detection, and cleanup automatically |
| Navigation blocking | Custom window.onbeforeunload + route guard | useBlocker + beforeunload combo | useBlocker handles React Router navigation, beforeunload handles browser close. Both needed for full coverage |
| Form validation | Manual field checking | Zod schema validation | Type-safe, composable, generates TypeScript types, handles nested objects, gives clear error messages |
| Character counting | Manual string.length checks | CharacterCountedTextarea component | Handles edge cases (emoji, multi-byte chars), visual feedback, maxLength enforcement, accessibility |
| Confirmation dialogs | Inline if/else branches | Headless UI Dialog | Focus trap, ESC key, backdrop click, screen reader support, animations, z-index management |

**Key insight:** Inline editing in React benefits from small, focused libraries like @dnd-kit for complex interactions. Avoid heavyweight form libraries (react-hook-form) when simple useState suffices. The challenge is not the form itself but the integrations: drag-and-drop, navigation blocking, quality re-scoring, and optimistic updates.

## Common Pitfalls

### Pitfall 1: Difficulty Mapping Confusion
**What goes wrong:** Storing numeric difficulty (1-10) directly in database breaks existing schema and player UI
**Why it happens:** CONTEXT.md says "admin uses 1-10 numeric scale" but schema stores 'easy'/'medium'/'hard'
**How to avoid:** Admin input is 1-10 range slider, but convert to easy/medium/hard on save: 1-3 = easy, 4-7 = medium, 8-10 = hard. Player-facing UI continues to show Easy/Medium/Hard labels
**Warning signs:** Database errors on save, player UI shows numbers instead of labels, TypeScript errors on difficulty field

### Pitfall 2: Blocking Save on Quality Violations
**What goes wrong:** Admin cannot save question improvements because quality score is still low
**Why it happens:** Treating quality score as validation instead of information
**How to avoid:** ALWAYS allow save. Show quality comparison modal AFTER save succeeds, not before. Warning dialog can say "This will create/increase violations" but never block. CONTEXT.md: "The admin is the ultimate arbiter"
**Warning signs:** Code like `if (auditResult.violations.length > 0) return error`, admin complaints about inability to fix questions

### Pitfall 3: Correct Answer Index Drift During Reordering
**What goes wrong:** Dragging options A/B/C/D changes order, but correctAnswer index points to wrong option
**Why it happens:** Forgetting to update correctAnswer index when options array is reordered
**How to avoid:** Track which option text is correct, not just index. On drag end, find new index of correct option after reorder. Or use option IDs instead of indices
**Warning signs:** Correct answer changes to wrong option after drag-and-drop, player sees wrong answer marked as correct

### Pitfall 4: URL Validation Timeout on Save
**What goes wrong:** Save takes 30+ seconds because link-check validates source URL
**Why it happens:** Default URL validation timeout is slow, blocks save response
**How to avoid:** Run quality audit with `skipUrlCheck: false` but set short timeout (2s). If URL validation fails due to timeout, mark as advisory not blocking. Or run full URL audit async after save returns
**Warning signs:** Save spinner hangs, admin frustrated by slow feedback, timeout errors in logs

### Pitfall 5: Table Row Update Without Key Stability
**What goes wrong:** Table flickers or scrolls to top after save
**Why it happens:** React re-renders entire table, loses scroll position
**How to avoid:** Use callback prop pattern: `onQuestionUpdated(updatedQuestion)` passes data to parent QuestionsPage, which updates single row in questions array using .map(). Keep table row key stable (use question.id)
**Warning signs:** Table jumps, scroll position lost, flash of loading state

### Pitfall 6: Character Counter Allows Over-Limit Input
**What goes wrong:** User types 400 characters in 300-character field, backend validation fails on save
**Why it happens:** Showing character count without enforcing maxLength
**How to avoid:** Use `maxLength` attribute on textarea to hard-stop at limit. Character counter is UX feedback, not enforcement. Backend validation still required
**Warning signs:** User can type beyond limit, red error on save, validation message doesn't match counter

### Pitfall 7: Edit Mode Persists Across Question Navigation
**What goes wrong:** User edits question A, clicks next to question B, still in edit mode with question A data
**Why it happens:** Not resetting edit mode state when questionId changes
**How to avoid:** useEffect on questionId change: reset isEditMode to false, clear formData, reset hasUnsavedChanges. Force view mode on navigation
**Warning signs:** Wrong question data in edit form, save affects wrong question, confusion about which question is being edited

## Code Examples

Verified patterns from official sources:

### useBlocker with Custom Confirmation Dialog
```typescript
// Source: https://reactrouter.com/api/hooks/useBlocker
import { useBlocker } from 'react-router-dom';
import { useEffect, useState } from 'react';

function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const shouldProceed = window.confirm(
        'You have unsaved changes. Discard changes and leave?'
      );
      if (shouldProceed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Also handle browser close/reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
```

### Zod Schema for Question Update Validation
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view
import { z } from 'zod';

const UpdateQuestionSchema = z.object({
  text: z.string()
    .min(20, 'Question must be at least 20 characters')
    .max(300, 'Question must be at most 300 characters'),

  options: z.array(z.string().min(1, 'Option cannot be empty'))
    .length(4, 'Must have exactly 4 options'),

  correctAnswer: z.number()
    .int()
    .min(0)
    .max(3, 'Correct answer must be 0-3 (index of options array)'),

  explanation: z.string()
    .min(30, 'Explanation must be at least 30 characters')
    .max(500, 'Explanation must be at most 500 characters'),

  sourceUrl: z.string()
    .url('Source URL must be a valid URL')
    .regex(/^https?:\/\//, 'Source URL must use http or https'),

  difficulty: z.number()
    .int()
    .min(1, 'Difficulty must be 1-10')
    .max(10, 'Difficulty must be 1-10'),
}).strict();

// Usage in route handler
const validation = UpdateQuestionSchema.safeParse(req.body);
if (!validation.success) {
  return res.status(400).json({
    error: 'Validation failed',
    details: validation.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }))
  });
}
```

### Archive Action with Status Update
```typescript
// Source: Phase 19 soft delete pattern
router.patch('/questions/:id/archive', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const questionId = parseInt(req.params.id);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    // Update status to archived
    await db
      .update(questions)
      .set({
        status: 'archived',
        updatedAt: new Date()
      })
      .where(eq(questions.id, questionId));

    res.json({ success: true, status: 'archived' });
  } catch (error: any) {
    console.error('Error archiving question:', error);
    res.status(500).json({ error: 'Failed to archive question' });
  }
});
```

### Optimistic Table Row Update
```typescript
// QuestionsPage.tsx - Parent component
function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);

  // Callback from detail panel
  const handleQuestionUpdated = (updated: Question) => {
    // Update single row in table without refetch
    setQuestions(prev =>
      prev.map(q => q.id === updated.id ? updated : q)
    );
  };

  return (
    <>
      <QuestionTable
        questions={questions}
        onRowClick={(id) => setSelectedQuestionId(id)}
      />
      <QuestionDetailPanel
        questionId={selectedQuestionId}
        onClose={() => setSelectedQuestionId(null)}
        onQuestionUpdated={handleQuestionUpdated}
      />
    </>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit | 2021-2022 | react-beautiful-dnd unmaintained; @dnd-kit is 10kb smaller, better touch/keyboard support, actively maintained |
| Prompt component (React Router v5) | useBlocker hook (v6.4+) | 2022-2023 | Hooks-based API, stable in v6.21+, better TypeScript support, customizable confirmation UI |
| Full page reload after edit | Optimistic UI updates | 2020+ | Perceived performance 2-3x faster, better UX, no scroll jump |
| Manual form validation | Zod schema validation | 2021+ | Type-safe, generates TypeScript types, composable, better error messages |
| Numeric difficulty storage | Easy/Medium/Hard labels | 2024+ | Player-facing clarity, telemetry data will inform difficulty mapping in future phases |
| Inline markdown editing | Basic textarea (markdown rendering on view) | 2024+ | Simpler for short fields (question, explanation), avoids 850kb MDXEditor bundle |

**Deprecated/outdated:**
- **react-beautiful-dnd:** Archived in 2021, no security updates. Use @dnd-kit instead
- **React Router Prompt component:** Removed in v6, replaced by useBlocker hook
- **Storing numeric difficulty in database:** User context confirms Easy/Medium/Hard for player-facing, numeric scale is admin input only
- **Lodash for array manipulation:** arrayMove from @dnd-kit/utilities is sufficient, avoids extra dependency

## Open Questions

Things that couldn't be fully resolved:

1. **Exact character limits for fields**
   - What we know: Phase 19 research suggests 300 chars for question text, 500 for explanation. Schema validation uses min(20) max(300) for text
   - What's unclear: Should explanation be 500 or 1000? Should options have individual limits?
   - Recommendation: Use conservative limits from Phase 19 research: question 300 chars, explanation 500 chars, options 150 chars each. Can adjust in planning if user provides specifics

2. **Archive button placement**
   - What we know: CONTEXT.md says "admin can archive directly from detail panel"
   - What's unclear: Should archive button be in header (next to Edit), in footer, or in a separate actions dropdown?
   - Recommendation: Place in panel footer (separate from Edit/Save) with confirmation dialog. Red "Archive" button with trash icon, requires "Are you sure?" confirmation. Less likely to be clicked accidentally

3. **Markdown toolbar vs raw markdown input**
   - What we know: CONTEXT.md says "question text and explanation fields support basic markdown (bold, italic, links)"
   - What's unclear: Should admin see markdown syntax (raw **bold**) or WYSIWYG toolbar?
   - Recommendation: Use plain textarea with markdown syntax. Lightweight, no extra dependencies. Admin can see raw markdown, preview is in view mode. Adding toolbar (@uiw/react-md-editor) would add 4.6kb, defer to planner

4. **How before/after quality comparison is visually presented**
   - What we know: CONTEXT.md says "before/after comparison shown: old score → new score, which violations changed"
   - What's unclear: Modal dialog, inline panel section, or toast notification?
   - Recommendation: Use modal dialog (Headless UI Dialog) shown after save succeeds. Explicit close action, allows user to review violations before dismissing. More prominent than toast, doesn't clutter panel

## Sources

### Primary (HIGH confidence)
- [React Router useBlocker](https://reactrouter.com/api/hooks/useBlocker) - Official React Router docs for v6.21+ stable API
- [@dnd-kit Sortable](https://docs.dndkit.com/presets/sortable) - Official @dnd-kit documentation for sortable lists
- [Headless UI Dialog](https://headlessui.com/react/dialog) - Official Headless UI docs for modal dialogs
- [Zod validation in TypeScript](https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view) - Comprehensive Zod validation patterns
- Phase 19 Quality Rules Engine Research - Quality scoring, violation types, re-scoring patterns
- Phase 20 Admin Exploration UI Research - Server-side pagination, detail panel patterns, admin API patterns
- Project codebase: QuestionDetailPanel.tsx, admin.ts routes, schema.ts - Existing patterns and architecture

### Secondary (MEDIUM confidence)
- [How to build an inline edit component in React](https://www.emgoto.com/react-inline-edit/) - Inline editing UX patterns
- [Atlassian Design Inline Edit](https://atlassian.design/components/inline-edit/) - Design system best practices for inline editing
- [Building a Custom Confirmation Dialog for Unsaved Changes with React Router v6](https://medium.com/@mohamedmaher_73467/building-a-custom-confirmation-dialog-for-unsaved-changes-with-react-router-v6-d1e4dfe5f58c) - useBlocker implementation patterns
- [Create sortable drag and drop in React JS using dnd-kit library](https://medium.com/@kurniawanc/create-sortable-drag-and-drop-in-react-js-using-dnd-kit-library-ba8b2917a6b5) - @dnd-kit tutorial with arrayMove
- [Top 5 Drag-and-Drop Libraries for React in 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) - Library comparison showing @dnd-kit as modern standard
- [Implementing a character counter in React](https://www.createit.com/blog/character-counter-in-react/) - Character counting patterns with useState
- [How to Implement Optimistic Updates in React with React Query](https://oneuptime.com/blog/post/2026-01-15-react-optimistic-updates-react-query/view) - Optimistic update patterns (though project doesn't use React Query, pattern applies)

### Tertiary (LOW confidence)
- [5 Best Markdown Editors for React Compared](https://strapi.io/blog/top-5-markdown-editors-for-react) - Markdown editor options, but recommendation is to skip heavy editors for simple use case
- [React Inputs TextArea Characters Counter - KendoReact](https://www.telerik.com/kendo-react-ui/components/inputs/textarea/counter) - Commercial component examples (not used but validates pattern)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already in project, only @dnd-kit needs installation
- Architecture: HIGH - Patterns verified with official docs (useBlocker, @dnd-kit, Headless UI), existing project patterns reviewed (QuestionDetailPanel, admin routes)
- Pitfalls: HIGH - Difficulty mapping confusion from CONTEXT.md analysis, quality score blocking from "admin is ultimate arbiter" principle, correct answer drift is common drag-and-drop issue
- Character limits: MEDIUM - Based on Phase 19 research but not explicitly specified in CONTEXT.md
- UI placement decisions: MEDIUM - Archive button and markdown input approach are recommendations, need planner/user confirmation

**Research date:** 2026-02-19
**Valid until:** 30 days (stable technologies - React 18, React Router 6.21, @dnd-kit, Headless UI are mature)

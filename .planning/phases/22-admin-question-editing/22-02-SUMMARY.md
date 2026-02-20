---
phase: 22-admin-question-editing
plan: 02
subsystem: ui
tags: [react, dnd-kit, forms, tailwind, typescript]

# Dependency graph
requires:
  - phase: 20-admin-question-quality
    provides: "QuestionDetailPanel and QuestionDetail interface for question viewing"
provides:
  - "QuestionEditForm component with drag-and-drop option reordering"
  - "SortableOption component for draggable answer options"
  - "EditFormData interface for form submission data"
  - "@dnd-kit libraries for drag-and-drop functionality"
affects: [22-03]

# Tech tracking
tech-stack:
  added: [@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities]
  patterns: [stable ID tracking for drag-and-drop items, dirty state tracking via useEffect comparison]

key-files:
  created:
    - frontend/src/pages/admin/components/QuestionEditForm.tsx
    - frontend/src/pages/admin/components/SortableOption.tsx
  modified:
    - frontend/package.json

key-decisions:
  - "Options tracked by stable ID (opt-0, opt-1, etc.) not array index - correct answer follows option during reorder"
  - "Difficulty stored as numeric 1-10 internally with visual Easy/Medium/Hard labels"
  - "Character counters change color to red when > 90% of limit"
  - "URL validation on blur and change events with inline error display"
  - "Dirty state tracked via stringified comparison of current vs initial state"

patterns-established:
  - "Stable ID pattern: Generate unique IDs on mount, never use array indices as keys for sortable items"
  - "Form state initialization: Store initial state separately for dirty tracking comparisons"
  - "Character counter component: Inline reusable component with color-coded warnings"

# Metrics
duration: 1.5min
completed: 2026-02-20
---

# Phase 22 Plan 02: QuestionEditForm UI Components Summary

**Drag-and-drop question editor with @dnd-kit, character counters, URL validation, and dirty state tracking**

## Performance

- **Duration:** 1 minute 35 seconds
- **Started:** 2026-02-20T07:51:18Z
- **Completed:** 2026-02-20T07:52:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Complete edit form UI for question editing with all field types
- Drag-and-drop option reordering that preserves correct answer selection
- Character limit enforcement with visual warnings at 90% capacity
- Real-time URL validation with inline error messages
- Dirty state tracking for unsaved changes detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @dnd-kit dependencies** - `2cf8d2c` (chore)
2. **Task 2: Create SortableOption and QuestionEditForm components** - `05fd83b` (feat)

**Plan metadata:** (pending - will be created after STATE.md update)

## Files Created/Modified

**Created:**
- `frontend/src/pages/admin/components/SortableOption.tsx` - Draggable option row with grip handle, text input, correct answer radio button. Uses useSortable hook for drag behavior with visual feedback (opacity change during drag).

- `frontend/src/pages/admin/components/QuestionEditForm.tsx` - Complete question edit form with controlled inputs for question text (300 char max), 4 draggable options (150 char each), explanation (500 char max), source URL (validated), and difficulty slider (1-10 numeric). Exports EditFormData interface for parent integration.

**Modified:**
- `frontend/package.json` - Added @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities dependencies

## Decisions Made

**1. Stable ID tracking for sortable items**
- Options assigned stable IDs (`opt-0`, `opt-1`, etc.) on mount
- Correct answer tracked by option ID, not array index
- Rationale: When options are reordered, the correct answer automatically follows its option because we track by ID, not position

**2. Difficulty stored as numeric value with visual labels**
- Internal state: 1-10 number from range slider
- Visual: Easy (1-3 green), Medium (4-7 yellow), Hard (8-10 red)
- Mapping function converts stored difficulty string to default numeric value
- Rationale: Range slider provides better UX than dropdown, numeric value easier to work with in backend

**3. Character counters with warning threshold**
- Question text: 300 max, Explanation: 500 max
- Color changes to red when > 90% of limit (270+ or 450+ chars)
- Hard limit enforced via maxLength attribute
- Rationale: Visual warning before hitting limit, hard stop prevents form submission issues

**4. URL validation on blur and change**
- Validates via `new URL()` constructor try/catch
- Inline error message shown below input
- Empty URL is valid (optional field)
- Submit button disabled when URL error present
- Rationale: Immediate feedback prevents submission errors, blur validation catches paste operations

**5. Dirty state via comparison of serialized state**
- Initial state snapshot taken on mount
- Current state compared via JSON.stringify for options array
- onDirtyChange callback notifies parent component
- Rationale: Parent (Plan 03) will use this to show unsaved changes warnings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all components implemented smoothly with TypeScript compilation passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 03 (Edit Mode Integration):**
- QuestionEditForm component complete and tested (TypeScript compilation passes)
- EditFormData interface exported for parent consumption
- SortableOption component ready for use in form
- All dependencies installed (@dnd-kit packages)

**Integration requirements for Plan 03:**
- Parent must provide onSave handler that calls PATCH /api/admin/questions/:id endpoint
- Parent must implement useBlocker for unsaved changes warning
- Parent must toggle between view/edit modes
- Parent must handle re-scoring after successful save

**No blockers identified.**

---
*Phase: 22-admin-question-editing*
*Completed: 2026-02-20*

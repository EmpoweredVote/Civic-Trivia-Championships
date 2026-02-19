---
phase: 15
plan: 02
subsystem: frontend-ui
tags: [react, typescript, collections, ui-components, localStorage]
requires: [15-01]
provides: [collection-picker-ui, collection-types, useCollections-hook]
affects: [15-03]
tech-stack:
  added: []
  patterns: [custom-hooks, skeleton-loading, localStorage-persistence, responsive-cards]
key-files:
  created:
    - frontend/src/features/collections/types.ts
    - frontend/src/features/collections/hooks/useCollections.ts
    - frontend/src/features/collections/components/CollectionCard.tsx
    - frontend/src/features/collections/components/CollectionCardSkeleton.tsx
    - frontend/src/features/collections/components/CollectionPicker.tsx
  modified: []
key-decisions:
  - decision: "Use inline style for themeColor instead of dynamic Tailwind classes"
    rationale: "Tailwind JIT purges dynamic class strings — inline style required for runtime colors"
    alternatives: "Safelist colors (impractical) or use CSS variables"
  - decision: "CollectionPicker receives data as props, doesn't own hook"
    rationale: "Makes component pure and testable — Dashboard will own useCollections"
    alternatives: "Hook inside picker (couples to single use case)"
  - decision: "localStorage persistence with lastCollectionId key"
    rationale: "Remember user's last-played collection for better UX on return visits"
    alternatives: "No persistence (always default to Federal) or URL params"
duration: 94s
completed: 2026-02-19
---

# Phase 15 Plan 02: Collection Picker UI Components Summary

**One-liner:** Self-contained collection picker with types, localStorage-backed selection hook, and responsive card components using inline styles for dynamic theme colors

## Performance

- **Duration:** 94 seconds (1.6 minutes)
- **Started:** 2026-02-19T01:56:18Z
- **Completed:** 2026-02-19T01:57:53Z
- **Tasks completed:** 2/2
- **Files created:** 5
- **Commits:** 2

## What Was Accomplished

Built the complete collection picker feature as a self-contained module:

1. **Type definitions:** CollectionSummary interface with id, name, slug, description, themeColor, questionCount
2. **Data hook:** useCollections fetches from `/api/game/collections`, manages selection state, persists to localStorage
3. **UI components:** CollectionCard (with selected states), CollectionCardSkeleton (loading placeholder), CollectionPicker (composition)
4. **Responsive layout:** Vertical stack on mobile, horizontal row on desktop
5. **Accessible interactions:** aria-pressed, aria-label, keyboard-navigable button

The hook defaults to saved collectionId from localStorage, falling back to first collection (Federal Civics by sortOrder).

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a1aa368 | feat(15-02): create collection types and useCollections hook |
| 2 | 354ddd9 | feat(15-02): create collection picker UI components |

## Files Created

**frontend/src/features/collections/types.ts**
- CollectionSummary interface

**frontend/src/features/collections/hooks/useCollections.ts**
- Custom hook: fetch, selection state, localStorage persistence
- Returns: collections, selectedId, selectedCollection, loading, select()

**frontend/src/features/collections/components/CollectionCard.tsx**
- Individual card with colored header band (inline style for themeColor)
- Selected state: ring-2, shadow-xl, scale-105, checkmark indicator
- Unselected state: opacity-80, hover effects
- Full accessibility: aria-pressed, aria-label

**frontend/src/features/collections/components/CollectionCardSkeleton.tsx**
- Skeleton placeholder with animate-pulse
- Matches CollectionCard dimensions

**frontend/src/features/collections/components/CollectionPicker.tsx**
- Composing component: section heading + card grid
- Props-based (pure component, testable)
- Responsive: flex-col (mobile) → sm:flex-row (desktop)
- Shows 3 skeletons during loading, actual cards when loaded

## Files Modified

None — all new files.

## Decisions Made

### 1. Inline Style for themeColor (Not Dynamic Tailwind)

**Context:** CollectionCard needs to render dynamic background colors from database themeColor field.

**Decision:** Use `style={{ backgroundColor: collection.themeColor }}` instead of `className="bg-[...]"`.

**Rationale:** Tailwind's JIT compiler purges dynamic class strings at build time. Inline styles work correctly for runtime-determined colors.

**Impact:** Header band correctly displays collection brand colors in production builds.

### 2. CollectionPicker as Pure Component

**Context:** CollectionPicker needs data from useCollections hook.

**Decision:** CollectionPicker receives data as props (collections, selectedId, loading, onSelect), doesn't call useCollections internally.

**Rationale:** Makes the component pure, reusable, and testable. Dashboard page will own the hook and pass data down.

**Impact:** Clean separation of concerns — picker is UI only, Dashboard owns state.

### 3. localStorage Persistence for Last-Played Collection

**Context:** User selects a collection, navigates away, returns later.

**Decision:** Store selectedId in localStorage with key 'lastCollectionId'. Hook reads on mount and restores selection.

**Rationale:** Better UX — remembers user preference across sessions. Research recommendation.

**Impact:** Returning users see their last-played collection auto-selected.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compilation passed, all verification checks met.

## Next Phase Readiness

**Ready for:** Phase 15-03 (Dashboard integration)

**What's needed:**
- Wire CollectionPicker into Dashboard.tsx
- Pass selectedId to Game page via router state
- Update game header to display collection name

**Blockers:** None

**Risks:** None — all components are self-contained and don't depend on backend being live (hook handles loading/error states gracefully).

**Dependencies satisfied:**
- ✅ 15-01 provides GET /collections endpoint
- ✅ CollectionSummary type matches backend response shape
- ✅ useCollections uses apiRequest from existing services/api.ts
- ✅ All Tailwind utilities available (animate-pulse, responsive prefixes)

---

*Phase 15 Plan 02 complete — collection picker building blocks ready for Dashboard integration*

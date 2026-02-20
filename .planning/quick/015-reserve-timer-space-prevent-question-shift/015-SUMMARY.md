---
phase: quick
plan: "015"
subsystem: game-ui
tags: [layout-shift, timer, css, ux]
completed: 2026-02-20
duration: "<1 min"
tech-stack:
  patterns: ["reserved-space-placeholder"]
key-files:
  modified:
    - frontend/src/features/game/components/GameScreen.tsx
decisions: []
---

# Quick Task 015: Reserve Timer Space to Prevent Question Shift

**One-liner:** Always-rendered min-h-[80px] timer wrapper eliminates layout shift when countdown appears after question preview delay.

## What Was Done

### Task 1: Replace conditional timer rendering with always-present fixed-height wrapper

Wrapped the GameTimer component in an always-rendered `<div className="flex justify-center min-h-[80px] items-center">` container. Previously, the entire timer div was conditionally rendered, causing the QuestionCard and AnswerGrid to shift downward by 80px when the timer appeared after the 1-second `QUESTION_PREVIEW_MS` delay.

**Before:** Timer div only rendered when `showOptions` became true (after 1s delay), pushing content down.

**After:** Outer wrapper div always present with `min-h-[80px]` reserving the timer's exact space. Timer renders inside the wrapper when conditions are met. Question card position is stable from first render.

**Commit:** `df17fa5`

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors (`npx tsc --noEmit` passes cleanly)
- Timer conditional logic unchanged (same showOptions/phase checks)
- Timer props unchanged (key, duration, onTimeout, onTimeUpdate, isPaused)
- `min-h-[80px]` matches GameTimer's `size={80}` prop exactly
- GameTimer.tsx was not modified (as specified)

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/features/game/components/GameScreen.tsx` | Wrapped timer in always-rendered min-h-[80px] container |

## Commits

| Hash | Message |
|------|---------|
| `df17fa5` | fix(quick-015): reserve timer space to prevent question text layout shift |

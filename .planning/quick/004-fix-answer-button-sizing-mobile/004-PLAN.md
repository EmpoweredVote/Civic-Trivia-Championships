---
phase: quick-004
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/features/game/components/AnswerGrid.tsx
  - frontend/src/features/game/components/GameScreen.tsx
autonomous: true

must_haves:
  truths:
    - "All 4 answer buttons have equal width regardless of text length"
    - "Question text and all 4 answer buttons are visible on mobile without scrolling"
    - "Desktop 2-column layout still works correctly"
    - "Existing animations (glow, shake, hover teal shadow, scale) are unbroken"
  artifacts:
    - path: "frontend/src/features/game/components/AnswerGrid.tsx"
      provides: "Consistent-width answer buttons"
    - path: "frontend/src/features/game/components/GameScreen.tsx"
      provides: "Compact mobile layout that fits viewport"
  key_links:
    - from: "GameScreen.tsx"
      to: "AnswerGrid.tsx"
      via: "motion.div wrapper must pass full width"
      pattern: "w-full"
---

<objective>
Fix two related UX issues: (1) answer buttons shrinking to content width instead of being uniform, and (2) mobile users needing to scroll to see all answer options.

Purpose: Game-show UX requires all answers to look equal (no visual hint from button size) and be immediately accessible without scrolling on mobile.
Output: Updated AnswerGrid.tsx and GameScreen.tsx with consistent button widths and a compact mobile layout.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/features/game/components/AnswerGrid.tsx
@frontend/src/features/game/components/GameScreen.tsx

Key design decisions to honor:
- Timer above question (10-02) -- timer -> question -> answers vertical flow
- Content high on screen pt-2/pt-6 (10-02) -- answers in top half
- justify-start pt-[10vh] replaced with current flex-col items-center layout (04-03)
- 48px via class not utility wrapper (07-04) -- min-h-[48px] on buttons
- Hover glow signals finality (10-02) -- teal shadow on hover
- Pulsing glow during suspense (10-02) -- selected answer pulses teal
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix button width consistency and mobile viewport fit</name>
  <files>
    frontend/src/features/game/components/AnswerGrid.tsx
    frontend/src/features/game/components/GameScreen.tsx
  </files>
  <action>
    TWO ROOT CAUSES TO FIX:

    **Root Cause 1 -- Button width inconsistency:**
    In GameScreen.tsx, the AnswerGrid is wrapped in a `motion.div` (around line 480) that has NO width class. The parent flex container uses `items-center` which causes this wrapper to shrink to its content width. Different text lengths = different wrapper widths = visually unequal buttons.

    Fix in GameScreen.tsx:
    - Add `w-full` to the `motion.div` that wraps AnswerGrid (the one at ~line 480 with `initial={{ opacity: 0, y: 10 }}`). This ensures the AnswerGrid container stretches to the full parent width regardless of content.

    **Root Cause 2 -- Mobile scrolling:**
    The game screen has generous spacing that works on desktop but pushes content below the fold on mobile (~667px viewport). The culprits are:
    - `py-8` on the main content container (line 357) -- 32px top+bottom padding
    - `mb-8` on the top HUD (line 359) -- 32px margin below HUD
    - `gap-6 md:gap-8` between question sections (line 445) -- 24px gap on mobile
    - Answer buttons with `p-4` padding (line 161 of AnswerGrid) -- 16px padding is generous for mobile
    - `gap-4` between grid items in AnswerGrid (line 123) -- 16px between buttons
    - `mb-6` after the answer grid (line 123) -- 24px margin below

    Fix in GameScreen.tsx:
    - Change `py-8` to `py-4 md:py-8` on the main content container (line 357)
    - Change `mb-8` to `mb-4 md:mb-8` on the top HUD bar (line 359)
    - Change `gap-6 md:gap-8` to `gap-3 md:gap-8` on the question/answer flex column (line 445)
    - Change `mb-4` to `mb-2 md:mb-4` on the score display wrapper (line 395-396 area)

    Fix in AnswerGrid.tsx:
    - Change `gap-4` to `gap-2 md:gap-4` on the grid container (line 123) -- tighter spacing between buttons on mobile
    - Change `p-4` to `p-3 md:p-4` on each answer button (line 161) -- slightly less padding on mobile
    - Change `mb-6` to `mb-3 md:mb-6` after the grid (line 123)
    - Change the outer container `px-6` to `px-2 md:px-6` (line 121) -- less horizontal padding on mobile

    IMPORTANT -- Do NOT change:
    - `min-h-[48px]` on buttons (accessibility requirement per decision 07-04)
    - Any animation properties (glow, shake, scale, opacity transitions)
    - The grid-cols-1 md:grid-cols-2 layout pattern
    - Any aria-label or keyboard navigation logic
    - The letter label circle (w-10 h-10) or text sizing
    - The Lock In button styling
  </action>
  <verify>
    1. Run `cd /c/"Project Test"/frontend && npx tsc --noEmit` -- no type errors
    2. Run `cd /c/"Project Test"/frontend && npm run build` -- builds successfully
    3. Visual check (developer): Open browser at mobile viewport (375x667), verify:
       - All 4 answer buttons are exactly the same width
       - Timer + question + all 4 buttons visible without scrolling
       - Buttons still have teal hover glow effect
    4. Check desktop (1280px+): 2-column grid still renders correctly
  </verify>
  <done>
    - All 4 answer buttons render at equal width on both mobile and desktop
    - On a 375x667 mobile viewport, timer + question text + all 4 answer buttons are visible without scrolling during the answering phase
    - Desktop 2-column layout unchanged
    - All existing animations (hover glow, suspense pulse, reveal scale, shake) still work
  </done>
</task>

</tasks>

<verification>
- TypeScript compilation passes with no errors
- Production build succeeds
- Mobile viewport (375x667): no scrolling needed to see all answer buttons
- Desktop viewport: 2-column grid layout intact
- Button hover shows teal shadow glow
- Selected answer during locked phase shows pulsing glow
- Reveal phase shows correct/incorrect styling with scale animation
</verification>

<success_criteria>
1. All 4 answer buttons have identical width regardless of answer text length
2. On mobile (375x667), the full answering UI (timer, question, 4 buttons) fits in viewport without scrolling
3. No visual regressions on desktop layout
4. All existing animations preserved
</success_criteria>

<output>
After completion, create `.planning/quick/004-fix-answer-button-sizing-mobile/004-SUMMARY.md`
</output>

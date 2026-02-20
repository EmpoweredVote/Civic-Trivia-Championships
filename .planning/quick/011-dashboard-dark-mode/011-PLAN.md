---
phase: quick
plan: 011
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/Dashboard.tsx
  - frontend/src/components/layout/Header.tsx
  - frontend/src/features/collections/components/CollectionPicker.tsx
autonomous: true

must_haves:
  truths:
    - "Dashboard page has a dark gradient background matching the game page"
    - "Header blends into the dark theme with no white flash"
    - "CollectionCards (already dark) look natural on the dark background"
    - "Play button is bold and visible on the dark surface"
    - "Sign-in nudge text and links are legible on dark background"
    - "Header dropdown menu is dark-styled with proper contrast"
  artifacts:
    - path: "frontend/src/pages/Dashboard.tsx"
      provides: "Dark-themed dashboard page"
      contains: "from-slate-900"
    - path: "frontend/src/components/layout/Header.tsx"
      provides: "Dark-themed header"
      contains: "bg-slate-900"
    - path: "frontend/src/features/collections/components/CollectionPicker.tsx"
      provides: "Dark-compatible section heading"
      contains: "text-slate-400"
  key_links:
    - from: "Dashboard.tsx"
      to: "Header.tsx"
      via: "Header renders inside Dashboard's dark container"
      pattern: "<Header"
---

<objective>
Convert the Dashboard page and Header from light mode (white/gray) to dark mode matching the game's slate/teal visual style.

Purpose: The CollectionCards and game pages are already dark-themed. The Dashboard page wrapper and Header are the remaining light-mode holdouts, creating a jarring visual mismatch. This makes the whole experience cohesive.

Output: Three updated files with dark Tailwind classes replacing light ones.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/pages/Dashboard.tsx
@frontend/src/components/layout/Header.tsx
@frontend/src/features/collections/components/CollectionPicker.tsx

Reference (already dark, do NOT modify):
@frontend/src/features/collections/components/CollectionCard.tsx
@frontend/src/features/collections/components/CollectionCardSkeleton.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Dark-mode the Dashboard page and CollectionPicker heading</name>
  <files>
    frontend/src/pages/Dashboard.tsx
    frontend/src/features/collections/components/CollectionPicker.tsx
  </files>
  <action>
    In Dashboard.tsx, replace Tailwind classes as follows:

    Line 13 — page background:
    - FROM: `min-h-screen bg-gray-50`
    - TO: `min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900`

    Line 17 — card container:
    - FROM: `bg-white shadow rounded-lg p-6`
    - TO: `bg-slate-800/50 border border-slate-700 rounded-lg p-6`
    (Remove the white background and opaque shadow; use a semi-transparent dark card with a subtle border instead)

    Line 18 — welcome heading:
    - FROM: `text-2xl font-bold text-gray-900 mb-4`
    - TO: `text-2xl font-bold text-white mb-4`

    Line 26 — Play button:
    - FROM: `px-12 py-4 min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white text-xl font-bold rounded-lg shadow-lg transition-all transform hover:scale-105`
    - TO: `px-12 py-4 min-h-[48px] bg-teal-600 hover:bg-teal-500 text-white text-xl font-bold rounded-lg shadow-lg shadow-teal-900/30 transition-all transform hover:scale-105 ring-1 ring-teal-500/20`
    (Add a subtle teal glow/ring and lighten the hover state so it pops on dark bg)

    Line 42 — sign-in nudge paragraph:
    - FROM: `text-gray-500 mt-6 text-sm text-center`
    - TO: `text-slate-400 mt-6 text-sm text-center`

    Lines 43, 45 — sign-in/signup links:
    - FROM: `text-teal-600 hover:text-teal-500 font-medium`
    - TO: `text-teal-400 hover:text-teal-300 font-medium`

    In CollectionPicker.tsx, line 21 — section heading:
    - FROM: `text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3`
    - TO: `text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3`
    (Brighten slightly so it reads well on the darker parent background)

    DO NOT modify CollectionCard.tsx, CollectionCardSkeleton.tsx, or any game components.
  </action>
  <verify>
    Run `npx tsc --noEmit` from the frontend directory to confirm no type errors.
    Visually inspect: `npm run dev` and navigate to the dashboard — page should have dark gradient background, dark card, white heading text, teal-glowing Play button, and legible sign-in links.
  </verify>
  <done>
    Dashboard page background is dark gradient (slate-900/800). Card container is semi-transparent dark with border. Heading is white. Play button has teal glow ring. Sign-in nudge uses slate-400 text with teal-400 links. CollectionPicker heading is slate-400.
  </done>
</task>

<task type="auto">
  <name>Task 2: Dark-mode the Header component</name>
  <files>
    frontend/src/components/layout/Header.tsx
  </files>
  <action>
    In Header.tsx, replace Tailwind classes as follows:

    Line 48 — header bar:
    - FROM: `sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200`
    - TO: `sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700`
    (Dark background with slight transparency and backdrop blur for depth)

    Line 53 — logo text:
    - FROM: `text-xl font-bold text-teal-600`
    - TO: `text-xl font-bold text-teal-400`

    Line 59 — user name:
    - FROM: `hidden sm:block text-sm text-gray-700`
    - TO: `hidden sm:block text-sm text-slate-300`

    Lines 66-69 — Admin pill:
    - FROM: `text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full hover:bg-red-200 transition-colors`
    - TO: `text-xs font-medium bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full hover:bg-red-900/70 transition-colors`

    Line 77 — hamburger button:
    - FROM: `min-w-[48px] min-h-[48px] p-2 text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center`
    - TO: `min-w-[48px] min-h-[48px] p-2 text-slate-400 hover:text-white transition-colors flex items-center justify-center`

    Line 93 — dropdown menu container:
    - FROM: `absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2`
    - TO: `absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 py-2`

    Lines 96, 102 — dropdown menu items (Profile, Log out):
    - FROM: `w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors`
    - TO: `w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors`

    Lines 112, 115 — sign-in / sign-up links (unauthenticated state):
    - FROM: `text-sm font-medium text-teal-600 hover:text-teal-500`
    - TO: `text-sm font-medium text-teal-400 hover:text-teal-300`
  </action>
  <verify>
    Run `npx tsc --noEmit` from the frontend directory to confirm no type errors.
    Visually inspect: Header should have dark background with subtle border, teal logo, light text for user name, dark dropdown with proper hover states.
  </verify>
  <done>
    Header has dark background (slate-900/95 with backdrop-blur). Logo is teal-400. User name is slate-300. Admin pill is dark red variant. Hamburger icon is slate-400 with white hover. Dropdown menu is dark (slate-800) with slate-700 border and hover. Auth links are teal-400.
  </done>
</task>

</tasks>

<verification>
1. `cd frontend && npx tsc --noEmit` — no TypeScript errors
2. Visual check: Dashboard has cohesive dark gradient background
3. Visual check: Header blends seamlessly into dark page
4. Visual check: CollectionCards (unchanged) sit naturally on dark surface
5. Visual check: Play button is prominent with teal glow
6. Visual check: Dropdown menu is dark with readable items
7. Visual check: Game page is unaffected (navigate to /play and confirm)
</verification>

<success_criteria>
- All three files updated with dark Tailwind classes
- No light-mode artifacts remain (no bg-white, bg-gray-50, text-gray--* classes in modified files)
- CollectionCard.tsx and CollectionCardSkeleton.tsx are NOT modified
- Game page components are NOT modified
- TypeScript compiles without errors
- Dashboard visually matches the dark slate/teal aesthetic of the game page
</success_criteria>

<output>
After completion, create `.planning/quick/011-dashboard-dark-mode/011-SUMMARY.md`
</output>

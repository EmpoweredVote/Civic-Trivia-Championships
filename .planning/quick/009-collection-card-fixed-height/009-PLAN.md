---
phase: quick
plan: 009
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/features/collections/components/CollectionCard.tsx
  - backend/src/db/seed/collections.ts
autonomous: true

must_haves:
  truths:
    - "All collection cards on the dashboard are the same height regardless of description length"
    - "Description text is short and playful, fitting naturally in 3 lines without ellipsis truncation"
  artifacts:
    - path: "frontend/src/features/collections/components/CollectionCard.tsx"
      provides: "Fixed 3-line description area"
      contains: "line-clamp-3"
    - path: "backend/src/db/seed/collections.ts"
      provides: "Short, fun collection descriptions"
  key_links: []
---

<objective>
Fix collection card height consistency and rewrite descriptions to be short and fun.

Purpose: Cards currently have uneven heights because descriptions vary in length and are clamped at 2 lines. Change to a fixed 3-line description area so all cards match, and rewrite the descriptions to be short enough to fit naturally without ellipsis.

Output: Updated CollectionCard component with fixed-height description area, updated seed data with fun descriptions, and a SQL migration to update live database records.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/features/collections/components/CollectionCard.tsx
@backend/src/db/seed/collections.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix card description to 3-line fixed height and rewrite descriptions</name>
  <files>
    frontend/src/features/collections/components/CollectionCard.tsx
    backend/src/db/seed/collections.ts
  </files>
  <action>
**CSS fix in CollectionCard.tsx (line 37):**

Change the description div classes from:
```
text-slate-400 text-xs mt-1 line-clamp-2
```
to:
```
text-slate-400 text-xs mt-1 line-clamp-3
```

This changes from 2-line clamp to 3-line clamp. With `text-xs` (0.75rem / 12px) and default line-height (~1.5), 3 lines = ~36px. The `line-clamp-3` utility sets `overflow: hidden`, `display: -webkit-box`, `-webkit-line-clamp: 3`, and `-webkit-box-orient: vertical`, which reserves exactly 3 lines of space regardless of content length. All cards will have the same description height.

**Rewrite descriptions in seed file `backend/src/db/seed/collections.ts`:**

Replace current verbose descriptions with short, playful ones that fit in roughly 2-3 lines at `text-xs` in a `w-48` card (~192px wide, roughly 30-35 chars per line). Target ~60-90 characters max per description. Tone: playful, game-like — "play, not study."

New descriptions:
- Federal: `"How well do you really know Uncle Sam? Put your federal know-how to the test."`
- Bloomington, IN: `"B-Town bragging rights on the line. Show off your local civic smarts."`
- Los Angeles, CA: `"Think you know the City of Angels? Prove it — from City Hall to the Capitol."`

These are short enough to display without ellipsis truncation at the card's width.

**Generate SQL for live database update:**

After making the code changes, create a one-time SQL update script and print it to the console so the user can run it against Supabase. The SQL should be:

```sql
UPDATE collections SET description = 'How well do you really know Uncle Sam? Put your federal know-how to the test.' WHERE slug = 'federal';
UPDATE collections SET description = 'B-Town bragging rights on the line. Show off your local civic smarts.' WHERE slug = 'bloomington-in';
UPDATE collections SET description = 'Think you know the City of Angels? Prove it — from City Hall to the Capitol.' WHERE slug = 'los-angeles-ca';
```

Print this SQL clearly in the task output so the user can copy and run it in the Supabase SQL editor.
  </action>
  <verify>
    1. `cd frontend && npx tsc --noEmit` — no TypeScript errors
    2. Visual check: `line-clamp-3` class present on description div in CollectionCard.tsx
    3. Seed file descriptions are short (under 90 chars each) and playful in tone
    4. SQL UPDATE statements printed for user to run against live database
  </verify>
  <done>
    - CollectionCard description div uses `line-clamp-3` (was `line-clamp-2`)
    - All 3 collection descriptions in seed data are rewritten: short, fun, no ellipsis needed
    - SQL migration statements provided for live Supabase database update
  </done>
</task>

</tasks>

<verification>
- `line-clamp-3` class on the description div in CollectionCard.tsx
- All seed descriptions under 90 characters
- TypeScript compiles without errors
- SQL update statements match new seed descriptions exactly
</verification>

<success_criteria>
All collection cards render at the same height with a 3-line description area, and descriptions are short, playful, and display fully without ellipsis truncation.
</success_criteria>

<output>
After completion, create `.planning/quick/009-collection-card-fixed-height/009-SUMMARY.md`
</output>

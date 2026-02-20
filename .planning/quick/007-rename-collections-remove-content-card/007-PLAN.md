---
phase: quick-007
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/db/seed/collections.ts
  - frontend/src/pages/admin/AdminDashboard.tsx
autonomous: true

must_haves:
  truths:
    - "The 3 collection names no longer contain the word 'Civics'"
    - "The admin dashboard no longer shows the Content Generation card"
  artifacts:
    - path: "backend/src/db/seed/collections.ts"
      provides: "Updated collection seed data without 'Civics' in names"
      contains: "name: 'Federal'"
    - path: "frontend/src/pages/admin/AdminDashboard.tsx"
      provides: "Admin dashboard without Content Generation card"
  key_links:
    - from: "backend/src/db/seed/collections.ts"
      to: "Supabase civic_trivia.collections table"
      via: "seed script + direct SQL update for live DB"
      pattern: "name:"
---

<objective>
Two small changes: (1) Remove the word "Civics" from the names of the first 3 collections in seed data AND in the live database, (2) Remove the "Content Generation - Coming Soon" card from the admin dashboard.

Purpose: Clean up naming and remove a placeholder card that is no longer planned.
Output: Updated seed data file and dashboard component.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@backend/src/db/seed/collections.ts
@frontend/src/pages/admin/AdminDashboard.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename collections (seed data + live database)</name>
  <files>backend/src/db/seed/collections.ts</files>
  <action>
  In `backend/src/db/seed/collections.ts`, update the `name` field for each collection to remove the word "Civics":

  - `'Federal Civics'` -> `'Federal'`
  - `'Bloomington, IN Civics'` -> `'Bloomington, IN'`
  - `'Los Angeles, CA Civics'` -> `'Los Angeles, CA'`

  Leave all other fields (slug, description, etc.) unchanged.

  IMPORTANT: The seed script uses `onConflictDoNothing` on slug, so changing the seed file alone will NOT update the live database. The executor must ALSO run a direct SQL update against the live Supabase database to rename the existing rows. Use the project's existing database connection (through a one-off script or `npx tsx` inline) to execute:

  ```sql
  UPDATE civic_trivia.collections SET name = 'Federal', updated_at = NOW() WHERE slug = 'federal';
  UPDATE civic_trivia.collections SET name = 'Bloomington, IN', updated_at = NOW() WHERE slug = 'bloomington-in';
  UPDATE civic_trivia.collections SET name = 'Los Angeles, CA', updated_at = NOW() WHERE slug = 'los-angeles-ca';
  ```

  The simplest approach: create a temporary script `backend/src/scripts/rename-collections.ts` that imports the db connection from `../db/index.js` and runs the SQL updates using drizzle's `sql` tagged template, then delete it after running. Or run the SQL inline via `npx tsx -e "..."` using the existing db module.

  Verify by querying the database afterward to confirm names changed.
  </action>
  <verify>
  1. Read `backend/src/db/seed/collections.ts` and confirm no instance of the word "Civics" remains in name fields
  2. Query the live database: `SELECT name, slug FROM civic_trivia.collections ORDER BY sort_order;` and confirm names are 'Federal', 'Bloomington, IN', 'Los Angeles, CA'
  </verify>
  <done>All 3 collection names in seed data and live database no longer contain "Civics"</done>
</task>

<task type="auto">
  <name>Task 2: Remove Content Generation card from admin dashboard</name>
  <files>frontend/src/pages/admin/AdminDashboard.tsx</files>
  <action>
  In `frontend/src/pages/admin/AdminDashboard.tsx`, remove the entire "Content Generation - Future card" section (lines 248-263 in current file). This is the `<div className="mt-8 ...">` block that contains the lightning bolt icon, "Content Generation" heading, "Coming Soon" badge, and "Coming in Phase 21" text.

  Specifically, remove from the comment `{/* Content Generation - Future card */}` through the closing `</div>` of that card (the div with `className="mt-8 bg-white rounded-lg border-2 border-gray-200 p-6"`).

  Do NOT remove the surrounding fragment tags (`<>` / `</>`) or the Quick Links section above it.
  </action>
  <verify>
  1. `npx tsc --noEmit` in the frontend directory passes (no TypeScript errors)
  2. Read AdminDashboard.tsx and confirm no "Content Generation" text remains
  3. Confirm the Quick Links section and the rest of the dashboard remain intact
  </verify>
  <done>Admin dashboard no longer shows the Content Generation card; component compiles without errors</done>
</task>

</tasks>

<verification>
1. `backend/src/db/seed/collections.ts` has no "Civics" in name fields
2. Live database collections table shows updated names
3. `frontend/src/pages/admin/AdminDashboard.tsx` has no "Content Generation" section
4. Frontend compiles without errors: `cd frontend && npx tsc --noEmit`
</verification>

<success_criteria>
- The 3 collections are named "Federal", "Bloomington, IN", "Los Angeles, CA" in both seed data and live database
- The Content Generation card is gone from the admin dashboard
- No compilation errors in either frontend or backend
</success_criteria>

<output>
After completion, create `.planning/quick/007-rename-collections-remove-content-card/007-SUMMARY.md`
</output>

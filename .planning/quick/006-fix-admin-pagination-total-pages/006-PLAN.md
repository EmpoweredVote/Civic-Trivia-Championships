---
phase: quick
plan: 006
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/routes/admin.ts
autonomous: true

must_haves:
  truths:
    - "Admin Questions tab pagination displays 'Page 1 of N' with a visible total page number"
    - "Previous/Next buttons disable correctly at page boundaries"
  artifacts:
    - path: "backend/src/routes/admin.ts"
      provides: "Explore endpoint returning totalPages in pagination response"
      contains: "totalPages"
  key_links:
    - from: "backend/src/routes/admin.ts (explore endpoint)"
      to: "frontend/src/pages/admin/QuestionsPage.tsx (PaginationMeta.totalPages)"
      via: "JSON response field name match"
      pattern: "totalPages"
---

<objective>
Fix the admin Questions tab pagination display which currently shows "Page 1 of" with a missing total page count.

Purpose: The backend `/api/admin/questions/explore` endpoint returns the total pages field as `pages` (line 525 of admin.ts), but the frontend `PaginationMeta` interface expects it as `totalPages`. This field name mismatch causes `pagination.totalPages` to be `undefined`, rendering blank text after "of".

Output: Backend returns `totalPages` instead of `pages` in the pagination response, making the frontend display "Page 1 of N" correctly.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/src/routes/admin.ts — The explore endpoint (line 411-532). Pagination response on lines 519-527 returns `pages` instead of `totalPages`.
@frontend/src/pages/admin/QuestionsPage.tsx — PaginationMeta interface (lines 9-14) expects `totalPages`. Used on lines 354 and 358.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename pagination field from "pages" to "totalPages" in backend explore endpoint</name>
  <files>backend/src/routes/admin.ts</files>
  <action>
In `backend/src/routes/admin.ts`, find the `/questions/explore` endpoint response (around line 519-527). Change the pagination object's `pages` key to `totalPages`:

Before:
```js
pagination: {
  page,
  limit,
  total,
  pages: Math.ceil(total / limit)
}
```

After:
```js
pagination: {
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit)
}
```

This is the ONLY change needed. The frontend `PaginationMeta` interface already expects `totalPages`, and all frontend references (`pagination.totalPages` on lines 354 and 358 of QuestionsPage.tsx) already use this field name. No frontend changes required.

Do NOT modify any other endpoints or any frontend files.
  </action>
  <verify>
1. Run `npx tsc --noEmit` in the backend directory to confirm no TypeScript errors.
2. Search for any other references to the `pages` key name in the explore endpoint response to ensure nothing else depends on the old name: `grep -r "\.pages" frontend/src/ backend/src/` — confirm no code reads `pagination.pages`.
3. If the dev server is running, hit `GET /api/admin/questions/explore?page=1&limit=25` and confirm the response contains `"totalPages"` (not `"pages"`) in the pagination object.
  </verify>
  <done>
The `/api/admin/questions/explore` endpoint returns `totalPages` in its pagination response object. The admin Questions tab pagination now displays "Page 1 of N" with the correct total page number visible. Previous/Next buttons disable correctly at page boundaries since `pagination.totalPages` is no longer undefined.
  </done>
</task>

</tasks>

<verification>
- The pagination section of QuestionsPage renders "Page {page} of {totalPages}" with both numbers visible
- The Next button is correctly disabled when on the last page (page === pagination.totalPages)
- No TypeScript compilation errors in either frontend or backend
</verification>

<success_criteria>
Admin Questions tab pagination displays "Page 1 of N" (where N is the computed total pages). The "of" text is no longer followed by blank/undefined. Previous/Next buttons work correctly at page boundaries.
</success_criteria>

<output>
After completion, create `.planning/quick/006-fix-admin-pagination-total-pages/006-SUMMARY.md`
</output>

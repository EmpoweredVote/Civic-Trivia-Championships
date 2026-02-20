---
phase: quick
plan: 005
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/features/collections/components/CollectionCard.tsx
autonomous: true

must_haves:
  truths:
    - "Non-admin users do NOT see question count on collection cards"
    - "Admin users DO see question count on collection cards"
    - "Aria-label does NOT leak question count for non-admin users"
  artifacts:
    - path: "frontend/src/features/collections/components/CollectionCard.tsx"
      provides: "Conditional question count display"
      contains: "isAdmin"
  key_links:
    - from: "frontend/src/features/collections/components/CollectionCard.tsx"
      to: "frontend/src/store/authStore.ts"
      via: "useAuthStore hook"
      pattern: "useAuthStore"
---

<objective>
Hide question count on collection cards for non-admin users. Currently, the public-facing
CollectionCard component (used in CollectionPicker on the Dashboard) always displays
"{N} questions" — this should only be visible when the logged-in user has isAdmin=true.

Purpose: Prevent exposing internal content metrics to regular players.
Output: Modified CollectionCard.tsx with conditional question count rendering.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Key files:
@frontend/src/features/collections/components/CollectionCard.tsx
@frontend/src/store/authStore.ts
@frontend/src/types/auth.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Conditionally render question count based on admin role</name>
  <files>frontend/src/features/collections/components/CollectionCard.tsx</files>
  <action>
    Import useAuthStore from '../../../store/authStore'.

    Read isAdmin from the auth store:
    ```
    const user = useAuthStore((state) => state.user);
    const isAdmin = user?.isAdmin === true;
    ```

    1. On line 20, update the aria-label to conditionally include question count:
       - Admin: `${collection.name}, ${collection.questionCount} questions${isSelected ? ', selected' : ''}`
       - Non-admin: `${collection.name}${isSelected ? ', selected' : ''}`

    2. On lines 36-38, wrap the question count div in a conditional:
       ```
       {isAdmin && (
         <div className="text-slate-500 text-xs mt-2">
           {collection.questionCount} questions
         </div>
       )}
       ```

    Do NOT modify the admin-specific CollectionCard at pages/admin/components/CollectionCard.tsx —
    that component is only rendered within admin routes and should continue showing all stats.
  </action>
  <verify>
    Run `npx tsc --noEmit` from the frontend directory to confirm no type errors.
    Visually inspect the component code to confirm:
    - useAuthStore is imported
    - question count div is wrapped in `{isAdmin && ...}`
    - aria-label conditionally includes question count
  </verify>
  <done>
    Non-admin users see collection cards without question count text or count in aria-label.
    Admin users see collection cards with "{N} questions" text and count in aria-label.
    TypeScript compiles without errors.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes in frontend directory
- CollectionCard.tsx imports useAuthStore
- Question count rendering is gated behind isAdmin check
- Aria-label is gated behind isAdmin check
- Admin CollectionCard (pages/admin/components/) is NOT modified
</verification>

<success_criteria>
- Collection cards on the public dashboard hide question count for non-admin users
- Collection cards on the public dashboard show question count for admin users
- No TypeScript compilation errors
- Admin pages unaffected
</success_criteria>

<output>
After completion, create `.planning/quick/005-admin-only-question-count/005-SUMMARY.md`
</output>

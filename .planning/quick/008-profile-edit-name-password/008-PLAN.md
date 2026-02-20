---
phase: quick-008
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/utils/validation.ts
  - backend/src/models/User.ts
  - backend/src/routes/profile.ts
  - frontend/src/services/profileService.ts
  - frontend/src/store/authStore.ts
  - frontend/src/pages/Profile.tsx
autonomous: true

must_haves:
  truths:
    - "User can edit their display name from the profile page"
    - "User can change their password from the profile page by providing current password"
    - "Invalid current password is rejected with a clear error message"
    - "Name and password validation matches signup rules (name 2-50 chars, password 8+ with upper/lower/number)"
    - "Updated name is reflected immediately in the profile display"
  artifacts:
    - path: "backend/src/models/User.ts"
      provides: "updateName and updatePassword model methods"
      contains: "updateName|updatePassword"
    - path: "backend/src/routes/profile.ts"
      provides: "PATCH /name and PATCH /password endpoints"
      contains: "router.patch.*name|router.patch.*password"
    - path: "backend/src/utils/validation.ts"
      provides: "Validation rules for name update and password change"
      contains: "updateNameValidation|updatePasswordValidation"
    - path: "frontend/src/services/profileService.ts"
      provides: "updateName and updatePassword API service functions"
      contains: "updateName|updatePassword"
    - path: "frontend/src/pages/Profile.tsx"
      provides: "Edit UI for name and password in the hero section"
  key_links:
    - from: "frontend/src/pages/Profile.tsx"
      to: "/api/users/profile/name"
      via: "profileService.updateName"
      pattern: "updateName"
    - from: "frontend/src/pages/Profile.tsx"
      to: "/api/users/profile/password"
      via: "profileService.updatePassword"
      pattern: "updatePassword"
    - from: "backend/src/routes/profile.ts"
      to: "backend/src/models/User.ts"
      via: "User.updateName and User.updatePassword"
      pattern: "User\\.(updateName|updatePassword)"
---

<objective>
Add profile editing capabilities: allow logged-in users to change their display name and password from the Profile page.

Purpose: Users currently cannot modify their name or password after signup. This is a basic account management feature needed before shipping.
Output: Two new PATCH endpoints (name + password), User model methods, validation rules, and inline edit UI on the Profile page.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/src/models/User.ts
@backend/src/routes/profile.ts
@backend/src/utils/validation.ts
@backend/src/middleware/validate.ts
@backend/src/controllers/authController.ts (bcrypt pattern reference)
@frontend/src/pages/Profile.tsx
@frontend/src/services/profileService.ts
@frontend/src/store/authStore.ts
@frontend/src/types/auth.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend - User model methods, validation rules, and profile endpoints</name>
  <files>
    backend/src/utils/validation.ts
    backend/src/models/User.ts
    backend/src/routes/profile.ts
  </files>
  <action>
**1. Add validation rules to `backend/src/utils/validation.ts`:**

Add two new exported validation arrays following the existing pattern (uses `express-validator` `body()`):

- `updateNameValidation`: Validate `body('name')` -- trim, length 2-50, escape. Identical to the name rule in `signupValidation`.
- `updatePasswordValidation`: Validate `body('currentPassword')` -- notEmpty with message "Current password is required". Validate `body('newPassword')` -- same rules as signup password (8+ chars, uppercase, lowercase, number).

**2. Add model methods to `backend/src/models/User.ts`:**

Add two methods to the `User` object:

- `updateName(id: number, name: string): Promise<void>` -- runs `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`.
- `updatePassword(id: number, passwordHash: string): Promise<void>` -- runs `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`.

These are simple update methods. The password hashing and current-password verification happen in the route handler, not here.

**3. Add two PATCH routes to `backend/src/routes/profile.ts`:**

Import `bcrypt` from 'bcrypt', import `{ validate }` from '../middleware/validate.js', and import `{ updateNameValidation, updatePasswordValidation }` from '../utils/validation.js'.

**PATCH /name** (placed after the existing PATCH /settings route):
- Apply `updateNameValidation` and `validate` middleware.
- Get `userId` from `req.user!.userId`.
- Get `name` from `req.body.name`.
- Call `await User.updateName(userId, name)`.
- Return `res.json({ name })`.
- Wrap in try/catch, return 500 on error.

**PATCH /password** (placed after PATCH /name):
- Apply `updatePasswordValidation` and `validate` middleware.
- Get `userId` from `req.user!.userId`.
- Get `currentPassword` and `newPassword` from `req.body`.
- Fetch user with `await User.findById(userId)` -- return 404 if not found.
- Verify current password: `await bcrypt.compare(currentPassword, user.passwordHash)` -- if false, return `res.status(401).json({ error: 'Current password is incorrect' })`.
- Hash new password: `await bcrypt.hash(newPassword, 12)` (cost 12, matching authController pattern).
- Call `await User.updatePassword(userId, hashedPassword)`.
- Return `res.json({ message: 'Password updated successfully' })`.
- Wrap in try/catch, return 500 on error.

Note: The `authenticateToken` middleware is already applied to all profile routes via `router.use(authenticateToken)` at line 54, so no additional auth middleware is needed.
  </action>
  <verify>
Run `cd /c/Project\ Test/backend && npx tsc --noEmit` to confirm no TypeScript errors. Manually verify the routes are registered by checking the file.
  </verify>
  <done>
- `User.updateName()` and `User.updatePassword()` methods exist and run correct SQL.
- `PATCH /api/users/profile/name` accepts `{ name }`, validates 2-50 chars, updates DB, returns `{ name }`.
- `PATCH /api/users/profile/password` accepts `{ currentPassword, newPassword }`, verifies current password with bcrypt, validates new password rules, hashes with cost 12, updates DB, returns success message.
- Invalid current password returns 401. Validation failures return 400 with field errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend - Profile service functions and inline edit UI</name>
  <files>
    frontend/src/services/profileService.ts
    frontend/src/store/authStore.ts
    frontend/src/pages/Profile.tsx
  </files>
  <action>
**1. Add service functions to `frontend/src/services/profileService.ts`:**

Add two new exported async functions following the existing `updateTimerMultiplier` pattern (uses `apiRequest` with auth header):

- `updateName(name: string): Promise<{ name: string }>` -- PATCH to `/api/users/profile/name` with `JSON.stringify({ name })`, includes Authorization header from authStore.
- `updatePassword(currentPassword: string, newPassword: string): Promise<{ message: string }>` -- PATCH to `/api/users/profile/password` with `JSON.stringify({ currentPassword, newPassword })`, includes Authorization header from authStore.

**2. Add `setUserName` action to `frontend/src/store/authStore.ts`:**

Add to the AuthStore interface: `setUserName: (name: string) => void;`

Add implementation that updates the user's name in the store state:
```
setUserName: (name: string) => set((state) => ({
  user: state.user ? { ...state.user, name } : null,
})),
```

This keeps the auth store user name in sync after a name change (used by Header, Avatar, etc.).

**3. Add edit UI to the Profile page hero section in `frontend/src/pages/Profile.tsx`:**

Add imports for `updateName` and `updatePassword` from profileService.

Add state variables at the top of the component:
- `editingName: boolean` (default false)
- `nameInput: string` (default '')
- `savingName: boolean` (default false)
- `nameError: string | null` (default null)
- `showPasswordForm: boolean` (default false)
- `currentPassword: string` (default '')
- `newPassword: string` (default '')
- `confirmPassword: string` (default '')
- `savingPassword: boolean` (default false)
- `passwordError: string | null` (default null)
- `passwordSuccess: string | null` (default null)

**Name editing UI** -- In the hero section, replace the static `<h1>` with an inline edit pattern:
- When NOT editing: Show the name in the existing `<h1>` with a small pencil/edit button next to it (use a simple SVG pencil icon or the text "Edit"). Clicking enters edit mode.
- When editing: Show an `<input>` pre-filled with current name, plus "Save" and "Cancel" buttons. Style the input with Tailwind: `bg-slate-700 text-white rounded px-3 py-1 text-2xl font-bold border border-slate-600 focus:border-teal-500 focus:outline-none`. Save and Cancel buttons: small, inline, teal for Save, slate for Cancel.
- On Save: Client-side validate length 2-50 (show error if invalid). Call `updateName(nameInput)`. On success, update `profile.name` in local state AND call `useAuthStore.getState().setUserName(nameInput)` to sync. Exit edit mode. On API error, show error from response (handle both `error` string and `errors` array formats).
- On Cancel: Reset input to current name, clear error, exit edit mode.

**Password change UI** -- Below the email line in the hero section, add a "Change Password" button:
- When NOT showing form: A subtle text button "Change Password" styled like a link (`text-teal-400 hover:text-teal-300 text-sm`).
- When showing form: A card/section with three password inputs (current password, new password, confirm password) and "Update Password" / "Cancel" buttons. Style inputs like the name input but normal text size. Use `type="password"` on all inputs.
- On Submit: Client-side check that newPassword === confirmPassword (show "Passwords do not match" error if not). Client-side validate new password (8+ chars, uppercase, lowercase, number -- show specific error). Call `updatePassword(currentPassword, newPassword)`. On success, show success message ("Password updated successfully"), clear all password fields, hide form after 2 seconds. On API error (especially 401 "Current password is incorrect"), show the error.
- On Cancel: Clear all fields and errors, hide form.

**Layout considerations:**
- Name edit should feel inline and lightweight (not a modal).
- Password form appears below the identity info, still within the hero card.
- Both forms show loading states while saving (disable buttons, show "Saving...").
- Error messages in red-400, success messages in green-400.
  </action>
  <verify>
Run `cd /c/Project\ Test/frontend && npx tsc --noEmit` to confirm no TypeScript errors. Run `npm run build` to verify no build errors.
  </verify>
  <done>
- Profile page shows an edit button next to the display name that enables inline editing.
- Name edit validates 2-50 chars client-side, calls API, updates display and auth store on success.
- "Change Password" link reveals a form with current/new/confirm password fields.
- Password form validates matching passwords and strength client-side, calls API, shows success or error.
- Incorrect current password shows clear error from API (401).
- All interactions have loading states and proper error display.
- Auth store user name stays in sync after name change.
  </done>
</task>

</tasks>

<verification>
1. `cd /c/Project\ Test/backend && npx tsc --noEmit` -- no TypeScript errors
2. `cd /c/Project\ Test/frontend && npx tsc --noEmit` -- no TypeScript errors
3. `cd /c/Project\ Test/frontend && npm run build` -- builds successfully
4. Manual verification flow:
   - Log in, navigate to Profile
   - Click edit on name, change it, save -- name updates in hero and Header
   - Click edit on name, enter 1 char, save -- validation error shown
   - Click "Change Password", enter wrong current password -- 401 error shown
   - Click "Change Password", enter correct current + valid new password -- success shown
   - Log out and log in with new password -- confirms password was actually changed
</verification>

<success_criteria>
- Two new PATCH endpoints functional and validated with express-validator
- Password change requires and verifies current password (bcrypt compare)
- Profile page has inline name editing with immediate UI update
- Profile page has password change form with proper validation
- Auth store stays in sync after name change
- No TypeScript or build errors
</success_criteria>

<output>
After completion, create `.planning/quick/008-profile-edit-name-password/008-SUMMARY.md`
</output>

---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/App.tsx
  - frontend/src/pages/Dashboard.tsx
  - frontend/src/components/layout/Header.tsx
autonomous: true

must_haves:
  truths:
    - "Visitor landing on / sees the Dashboard and can click Quick Play without signing in"
    - "Visitor landing on /play can start and complete a full game without signing in"
    - "Signed-in users see their name in Dashboard and header, with Profile + Log out in menu"
    - "Anonymous visitors see Sign In / Sign Up links in the header"
    - "Profile page (/profile) still requires authentication and redirects anonymous users to /login"
  artifacts:
    - path: "frontend/src/App.tsx"
      provides: "Updated routing with / and /play as public routes"
      contains: "ProtectedRoute"
    - path: "frontend/src/pages/Dashboard.tsx"
      provides: "Dashboard that works for both anonymous and authenticated users"
      contains: "Welcome"
    - path: "frontend/src/components/layout/Header.tsx"
      provides: "Header with conditional auth/anonymous navigation"
      contains: "Sign in"
  key_links:
    - from: "frontend/src/App.tsx"
      to: "ProtectedRoute"
      via: "Only wraps /profile, not / or /play"
      pattern: "ProtectedRoute.*profile"
    - from: "frontend/src/components/layout/Header.tsx"
      to: "authStore.isAuthenticated"
      via: "Conditional rendering of menu items"
      pattern: "isAuthenticated.*Sign in|Log out"
---

<objective>
Make anonymous play the default experience. Visitors can immediately play the game
without signing in. Login/signup remain available via header links. Profile stays
auth-gated.

Purpose: Lower the barrier to entry — anyone with the link can try the game instantly.
Output: Updated routing, dashboard, and header components.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@frontend/src/App.tsx
@frontend/src/pages/Dashboard.tsx
@frontend/src/components/layout/Header.tsx
@frontend/src/components/ProtectedRoute.tsx
@frontend/src/store/authStore.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Open up routing — make Dashboard and Game public</name>
  <files>frontend/src/App.tsx</files>
  <action>
Move the `/` (Dashboard), `/dashboard`, and `/play` (Game) routes OUT of the
ProtectedRoute wrapper so they render for all visitors (anonymous and authenticated).

Keep `/profile` inside ProtectedRoute — it requires auth to fetch profile data.

The updated route structure should be:

```
{/* Public routes */}
<Route path="/login" element={<Login />} />
<Route path="/signup" element={<Signup />} />
<Route path="/" element={<Dashboard />} />
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/play" element={<Game />} />

{/* Protected routes — require auth */}
<Route element={<ProtectedRoute />}>
  <Route path="/profile" element={<Profile />} />
</Route>
```

Keep all existing imports. ProtectedRoute is still used (for /profile), so do NOT
remove its import.
  </action>
  <verify>Run `npx tsc --noEmit` from frontend/ — no type errors. Visually confirm the route structure in App.tsx has / and /play outside ProtectedRoute and /profile inside it.</verify>
  <done>/ and /play render without authentication. /profile still redirects to /login for anonymous users.</done>
</task>

<task type="auto">
  <name>Task 2: Update Dashboard and Header for anonymous visitors</name>
  <files>frontend/src/pages/Dashboard.tsx, frontend/src/components/layout/Header.tsx</files>
  <action>
**Dashboard.tsx changes:**

Update the welcome message to handle anonymous visitors gracefully:
- If `isAuthenticated && user`: show "Welcome, {user.name}!"
- Else: show "Civic Trivia Championship" (a neutral welcome)

Add `isAuthenticated` and `user` from `useAuthStore`. The existing `user` destructure
already exists; add `isAuthenticated` next to it.

The Quick Play button and its description text stay exactly the same — both anonymous
and authenticated users see the same CTA.

Below the Quick Play section, add a small nudge for anonymous users only:
```tsx
{!isAuthenticated && (
  <p className="text-gray-500 mt-6 text-sm">
    <Link to="/login" className="text-teal-600 hover:text-teal-500 font-medium">Sign in</Link>
    {' '}or{' '}
    <Link to="/signup" className="text-teal-600 hover:text-teal-500 font-medium">create an account</Link>
    {' '}to track your progress and earn rewards.
  </p>
)}
```

Add `Link` to the import from 'react-router-dom' (alongside useNavigate).
Add `isAuthenticated` to the useAuthStore destructure.

**Header.tsx changes:**

The header currently only shows user info and hamburger menu when `isAuthenticated && user`.
Update it to ALWAYS show navigation, but with different content:

When `isAuthenticated && user` (current behavior — keep as-is):
- Show user name + hamburger menu with Profile and Log out

When NOT authenticated (new):
- Show two text links: "Sign in" linking to /login and "Sign up" linking to /signup
- Style: `text-sm font-medium text-teal-600 hover:text-teal-500` with a `space-x-4` gap
- Use `Link` from react-router-dom (already imported via useNavigate — add `Link` to the import)

Replace the conditional `{isAuthenticated && user && (` block with:
```tsx
{isAuthenticated && user ? (
  // ... existing hamburger menu code (unchanged) ...
) : (
  <div className="flex items-center space-x-4">
    <Link to="/login" className="text-sm font-medium text-teal-600 hover:text-teal-500">
      Sign in
    </Link>
    <Link to="/signup" className="text-sm font-medium text-teal-600 hover:text-teal-500">
      Sign up
    </Link>
  </div>
)}
```

Add `Link` to the import from 'react-router-dom': `import { useNavigate, Link } from 'react-router-dom';`
  </action>
  <verify>
Run `npx tsc --noEmit` from frontend/ — no type errors.
Run `npm run build` from frontend/ — build succeeds with no errors.
  </verify>
  <done>
Anonymous visitors see "Civic Trivia Championship" heading with Quick Play button and
sign-in nudge on Dashboard. Header shows Sign in / Sign up links for anonymous users.
Authenticated users see their name and hamburger menu as before. No visual or
functional regressions for signed-in users.
  </done>
</task>

</tasks>

<verification>
1. `cd frontend && npx tsc --noEmit` — zero type errors
2. `cd frontend && npm run build` — clean production build
3. Manual smoke test:
   - Open app in incognito (no session) — should see Dashboard with Quick Play, NOT a login wall
   - Click Quick Play — game starts immediately, plays through all 10 questions
   - Header shows "Sign in" and "Sign up" links (no hamburger menu)
   - Click Sign in — login page loads, can sign in
   - After sign in — Dashboard shows "Welcome, {name}!", header shows hamburger menu
   - Navigate to /profile while signed in — profile loads
   - Open /profile in incognito — redirects to /login
</verification>

<success_criteria>
- Anonymous visitors can reach Dashboard and play the full game without any auth gate
- /profile remains protected (redirects to /login for anonymous users)
- Header adapts: sign-in/sign-up links for anonymous, hamburger menu for authenticated
- Dashboard adapts: neutral welcome for anonymous, personalized for authenticated
- Existing auth flow unchanged — login, signup, session restore all work as before
- TypeScript compiles cleanly, production build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/003-anonymous-default-play/003-SUMMARY.md`
</output>

---
phase: 15
plan: 03
subsystem: frontend-integration
tags: [react, typescript, collections, game-flow, dashboard, router-state]
requires: [15-01, 15-02]
provides: [end-to-end-collection-flow, collection-name-display, dashboard-picker-integration]
affects: [future-collection-features]
tech-stack:
  added: []
  patterns: [router-state-passing, auto-start-game, collection-context-propagation]
key-files:
  created: []
  modified:
    - frontend/src/pages/Dashboard.tsx
    - frontend/src/features/game/hooks/useGameState.ts
    - frontend/src/pages/Game.tsx
    - frontend/src/features/game/components/GameScreen.tsx
    - frontend/src/features/game/components/ResultsScreen.tsx
key-decisions:
  - decision: "Pass collectionId via React Router location state"
    rationale: "Clean separation - Dashboard owns collection selection, Game receives it as navigation context"
    alternatives: "URL params (leaks internal IDs), global state (unnecessary coupling)"
  - decision: "Auto-start game when navigating from Dashboard with collectionId"
    rationale: "Seamless UX - user clicks 'Play Federal Civics' and immediately starts playing"
    alternatives: "Show intermediate screen (extra click), always show idle screen (inconsistent)"
  - decision: "Display collection name in both game header and results screen"
    rationale: "Reinforce context throughout game experience, fulfill plan requirements"
    alternatives: "Only in results (misses in-game context), only in header (misses post-game)"
duration: 168s
completed: 2026-02-19
---

# Phase 15 Plan 03: Dashboard Integration & Collection Flow Summary

**Complete end-to-end collection picker flow: Dashboard selection → game start with collection → collection name visible during play and on results**

## Performance

- **Duration:** 168 seconds (2.8 minutes)
- **Started:** 2026-02-19T02:00:50Z
- **Completed:** 2026-02-19T02:03:42Z
- **Tasks completed:** 2/2
- **Files modified:** 5
- **Commits:** 2

## What Was Accomplished

Wired the collection picker into the complete game flow:

1. **Dashboard Integration:**
   - Imported `useCollections` and `CollectionPicker` into Dashboard
   - Start Game button text now dynamic: "Play [Collection Name]" or "Quick Play"
   - Clicking button navigates to `/play` with `collectionId` in router state
   - Collection picker displays below button with full selection capabilities

2. **Game Flow Updates:**
   - Game.tsx reads `collectionId` from React Router location state
   - Auto-starts game when arriving from Dashboard with collectionId
   - Direct navigation to `/play` (no state) shows idle screen with "Quick Play" (backward compat)
   - Play Again button replays same collection
   - `useGameState.startGame()` accepts optional `collectionId` parameter

3. **Collection Name Display:**
   - GameScreen shows collection name badge at top of HUD (subtle, uppercase)
   - ResultsScreen displays collection name below "Game Complete!" heading
   - Both read from `GameState.collectionName` populated by session creation

The complete user journey now works: see picker → select collection → click "Play Federal Civics" → game auto-starts → see "FEDERAL CIVICS" in header → complete game → see "Federal Civics" on results screen.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | be52303 | feat(15-03): integrate CollectionPicker into Dashboard and wire game start |
| 2 | 975e061 | feat(15-03): display collection name in game header and results screen |

## Files Modified

**frontend/src/pages/Dashboard.tsx**
- Added imports: `useCollections`, `CollectionPicker`
- Integrated hook: `const { collections, selectedId, selectedCollection, loading, select } = useCollections()`
- Updated button text: `selectedCollection ? \`Play ${selectedCollection.name}\` : 'Quick Play'`
- Updated button onClick: `navigate('/play', { state: { collectionId: selectedId } })`
- Added `<CollectionPicker />` below button

**frontend/src/features/game/hooks/useGameState.ts**
- Updated `UseGameStateReturn` interface: `startGame: (collectionId?: number) => Promise<void>`
- Updated `startGame` function signature: `async (collectionId?: number)`
- Passed collectionId to `createGameSession(collectionId)`

**frontend/src/pages/Game.tsx**
- Added `useLocation` import from react-router-dom
- Read collectionId from location state: `const collectionId = (location.state as { collectionId?: number } | null)?.collectionId`
- Added useEffect to auto-start game when collectionId present and phase is idle
- Updated `handlePlayAgain`: `startGame(collectionId)` (replay same collection)
- Created wrapper: `const handleStartGame = () => startGame(collectionId)`
- Passed wrapper to GameScreen instead of raw startGame
- Passed `collectionName={state.collectionName}` to ResultsScreen

**frontend/src/features/game/components/GameScreen.tsx**
- Added collection name badge at top of HUD
- Restructured HUD: collection name above controls row
- Collection name shows as: `<div className="text-xs text-slate-500 font-medium tracking-wide uppercase">{state.collectionName}</div>`
- Only renders when `state.collectionName` is truthy (no need for phase check - idle screen returns early)

**frontend/src/features/game/components/ResultsScreen.tsx**
- Added `collectionName?: string | null` to `ResultsScreenProps` interface
- Added collectionName to destructured props
- Display collection name below "Game Complete!" heading: `{collectionName && <div className="text-slate-400 text-sm mb-4">{collectionName}</div>}`

## Decisions Made

### 1. Router State for collectionId (Not URL Params or Global State)

**Context:** Dashboard needs to pass selected collectionId to Game page.

**Decision:** Use React Router location state: `navigate('/play', { state: { collectionId } })`.

**Rationale:**
- Clean separation of concerns: Dashboard owns selection, Game receives as navigation context
- Doesn't expose internal database IDs in URL
- Doesn't require global state management (no Redux/Zustand slice)
- Type-safe with TypeScript casting

**Impact:** Game page cleanly receives collectionId without URL pollution or global state coupling.

**Alternatives considered:**
- URL params (`/play?collection=1`) - exposes internal IDs, uglier URLs
- Global state (useCollectionStore) - unnecessary coupling between Dashboard and Game

### 2. Auto-Start Game When Navigating from Dashboard

**Context:** User clicks "Play Federal Civics" on Dashboard - should game start immediately or show idle screen?

**Decision:** Auto-start game with `useEffect` when `collectionId` present and phase is idle.

**Rationale:**
- Seamless UX: user expects to start playing immediately after clicking "Play Federal Civics"
- Matches user mental model: "I just selected a collection and clicked Play"
- Maintains backward compat: direct navigation to `/play` (no collectionId) shows idle screen

**Impact:** One-click flow from Dashboard to gameplay. No intermediate "are you sure?" screen.

**Alternatives considered:**
- Always show idle screen with collection-specific text - extra click, slower flow
- Show confirmation dialog - unnecessary friction for returning users

### 3. Display Collection Name in Both Header and Results

**Context:** Where should collection name appear during and after gameplay?

**Decision:** Show in both game header (during play) and results screen (post-game).

**Rationale:**
- Reinforces context throughout entire game experience
- Game header: subtle reminder of which collection user is playing
- Results screen: confirms which collection was just completed
- Plan explicitly requires both locations

**Impact:** Collection name visible at key moments: start of each question and completion screen.

**Alternatives considered:**
- Only in results - misses in-game context, user might forget which collection
- Only in header - misses post-game confirmation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

### TypeScript Compilation Error (Resolved)

**Issue:** Initially added check `state.phase !== 'idle'` for collection name display, but TypeScript complained "types have no overlap".

**Root cause:** GameScreen has early return for idle phase (line 299), so by the time we reach line 361, TypeScript knows phase can NEVER be idle. The comparison was redundant.

**Resolution:** Removed the `!== 'idle'` check - only check `state.collectionName` truthiness.

**Learning:** TypeScript's control flow analysis tracks early returns and narrows types accordingly.

## Next Phase Readiness

**Ready for:** Phase 16 (Community Collections API) and Phase 17 (Collection Management)

**What's working:**
- ✅ Complete picker flow: Dashboard → Game → Results
- ✅ Collection name displays in game header and results
- ✅ Play Again replays same collection
- ✅ Direct `/play` navigation shows idle screen (backward compat)
- ✅ Federal Civics preselected by default (localStorage persistence from 15-02)
- ✅ TypeScript compilation passes with no errors

**Blockers:** None

**Risks:** None - all integration points working correctly

**Dependencies satisfied:**
- ✅ 15-01 provides GET /collections endpoint (backend)
- ✅ 15-02 provides CollectionPicker, useCollections, types
- ✅ Existing game flow supports collectionId parameter (gameService.ts)
- ✅ GameState.collectionName populated by SESSION_CREATED action

**Future enhancements ready for:**
- User-created collections (Phase 17) will automatically appear in picker
- Collection-specific stats/leaderboards (Phase 16)
- Collection difficulty ratings (future)

---

*Phase 15 Plan 03 complete - collection picker fully integrated into game flow*

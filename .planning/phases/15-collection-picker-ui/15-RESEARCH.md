# Phase 15: Collection Picker UI - Research

**Researched:** 2026-02-18
**Domain:** React/TypeScript dashboard UI — collection selection cards with localStorage persistence
**Confidence:** HIGH

## Summary

Phase 15 adds a collection picker to the existing Dashboard page. The infrastructure is almost entirely in place: the backend already stores collections with `themeColor`, `name`, `description`, `isActive`, and question counts are derivable via the `collectionQuestions` join table. The frontend already has `collectionId` flowing through `createGameSession()` and `GameState.collectionName`/`collectionSlug` fields. The primary work is:

1. A new backend route `GET /api/game/collections` returning active collections with question counts
2. A new `CollectionPicker` component on the Dashboard
3. Wiring the selected collectionId into `createGameSession()` (already accepts it)
4. Updating the game header and results screen to display the collection name (fields already exist in GameState and GameSessionResult)

The existing tech stack — React 18, Tailwind CSS 3, Framer Motion 12, Zustand 4 — covers all required UI patterns (skeleton loaders, card selection, animation). No new dependencies are needed.

**Primary recommendation:** Add `GET /api/game/collections` backend endpoint, build CollectionPicker as a self-contained dashboard section with its own `useState` for selection and `useEffect` for fetching, then wire the selected collectionId into the `startGame()` call.

## Standard Stack

The project already uses all the tools needed. No new installations required.

### Core (already installed)
| Library | Version | Purpose | Role in this phase |
|---------|---------|---------|-------------------|
| React 18 | ^18.2.0 | UI framework | Component and hooks for picker |
| Tailwind CSS | ^3.4.1 | Utility styles | Card layout, colors, skeleton shimmer |
| Framer Motion | ^12.34.0 | Animation | Card hover/selection micro-animations |
| Zustand | ^4.4.7 | State management | authStore (already used in Dashboard) |
| TypeScript | ^5.3.3 | Type safety | Collection types |

### No New Dependencies Needed

All required patterns (skeleton loading, card selection, localStorage, responsive layout) can be implemented with the existing stack.

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended File Structure

```
frontend/src/
├── features/
│   └── collections/                     # New feature folder
│       ├── components/
│       │   ├── CollectionPicker.tsx     # Main picker section
│       │   ├── CollectionCard.tsx       # Individual card
│       │   └── CollectionCardSkeleton.tsx  # Shimmer placeholder
│       ├── hooks/
│       │   └── useCollections.ts        # Fetch + selection state
│       └── types.ts                     # Collection types for frontend

backend/src/
└── routes/
    └── game.ts                          # Add GET /collections route here
                                         # (keeps game-related routes together)
```

### Pattern 1: Self-Contained Feature Hook

The collection state (loading, collections list, selected ID) lives in a custom hook `useCollections`. This keeps Dashboard.tsx clean and makes the picker independently testable.

**What:** Hook encapsulates fetch, loading state, selection state, and localStorage persistence
**When to use:** Any dashboard section that loads async data and has selection state
**Example:**

```typescript
// Source: project pattern from useGameState.ts
export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore last-played from localStorage
    const saved = localStorage.getItem('lastCollectionId');
    const savedId = saved ? parseInt(saved, 10) : null;

    apiRequest<{ collections: Collection[] }>('/api/game/collections')
      .then(({ collections }) => {
        setCollections(collections);
        // Select: saved if valid, else first active (Federal Civics by sortOrder)
        const validSaved = savedId && collections.find(c => c.id === savedId);
        setSelectedId(validSaved ? savedId : (collections[0]?.id ?? null));
      })
      .finally(() => setLoading(false));
  }, []);

  const select = (id: number) => {
    setSelectedId(id);
    localStorage.setItem('lastCollectionId', String(id));
  };

  // Returns selectedId for Dashboard to pass to startGame
  return { collections, selectedId, loading, select };
}
```

### Pattern 2: Derived Button Label

The "Play Federal Civics" button text derives from the selected collection name. This is computed at render time, not stored in state.

```typescript
// Source: project pattern — derived values from state
const selectedCollection = collections.find(c => c.id === selectedId);
const buttonLabel = selectedCollection
  ? `Play ${selectedCollection.name}`
  : 'Quick Play';
```

### Pattern 3: Tailwind CSS Shimmer Skeleton

The project uses Tailwind 3. CSS animation utilities `animate-pulse` give a pulsing effect. For a shimmer (moving gradient), add a custom animation or use `animate-pulse` which is sufficient and already available.

```typescript
// Source: Tailwind CSS docs — animate-pulse utility
function CollectionCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl overflow-hidden w-48">
      <div className="h-16 bg-slate-700" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-700 rounded w-full" />
        <div className="h-3 bg-slate-600 rounded w-1/2" />
      </div>
    </div>
  );
}
```

### Pattern 4: Backend Collections Endpoint

Add to `backend/src/routes/game.ts`. Query active collections with question counts using Drizzle ORM. Filter out collections with fewer than 10 questions (the configured threshold).

```typescript
// Source: existing questionService.ts patterns (db query shape)
const MIN_QUESTION_THRESHOLD = 10;

router.get('/collections', async (_req: Request, res: Response) => {
  try {
    // Query active collections ordered by sortOrder
    const rows = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        themeColor: collections.themeColor,
        questionCount: sql<number>`count(${collectionQuestions.questionId})::int`,
      })
      .from(collections)
      .leftJoin(collectionQuestions, eq(collections.id, collectionQuestions.collectionId))
      .where(eq(collections.isActive, true))
      .groupBy(collections.id)
      .orderBy(collections.sortOrder);

    // Filter out collections below question threshold
    const filtered = rows.filter(r => r.questionCount >= MIN_QUESTION_THRESHOLD);

    res.json({ collections: filtered });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});
```

### Pattern 5: Dashboard Integration

Dashboard.tsx currently has a simple button. The picker sits below the button, always visible. The button moves to the top of the content block and its onClick passes the selected collectionId.

```typescript
// Source: existing Dashboard.tsx pattern — minimal changes
const { collections, selectedId, loading, select } = useCollections();

const handlePlay = () => {
  // Navigate to /play, passing collectionId via state or localStorage
  // Game page reads it and passes to createGameSession(collectionId)
  navigate('/play', { state: { collectionId: selectedId } });
};
```

### Pattern 6: Passing collectionId to Game Page

`useGameState.startGame()` currently calls `createGameSession()` with no arguments. It needs to accept a collectionId. The Dashboard passes it via React Router state or a shared store. The simplest approach that avoids prop drilling: read from `useLocation()` state in Game.tsx and pass to `startGame(collectionId)`.

```typescript
// Game.tsx — read collectionId from router state
const location = useLocation();
const collectionId = location.state?.collectionId as number | undefined;

// On mount, auto-start with the collection
useEffect(() => {
  startGame(collectionId);
}, []);
```

```typescript
// useGameState.ts — startGame accepts optional collectionId
const startGame = async (collectionId?: number) => {
  const { sessionId, questions, degraded, collectionName, collectionSlug } =
    await createGameSession(collectionId);
  // ...dispatch SESSION_CREATED...
};
```

### Pattern 7: Collection Name in Game Header and Results

`GameState.collectionName` is already populated by `SESSION_CREATED` dispatch. The game header (in GameScreen.tsx idle state and during play) needs to display it. The results screen already has access via `GameSessionResult.collectionName`.

**Game header:** The dark-themed `GameScreen` header area (top HUD) can show the collection name as a small badge.
**Results screen:** Show collection name near the "Game Complete!" heading.

### Anti-Patterns to Avoid

- **Storing collections in Zustand global store:** This is page-local UI state. Use component-level `useState`/`useEffect` in a hook, not a global store.
- **Fetching collections inside CollectionCard:** Fetch once at the CollectionPicker level, pass data down as props.
- **Auto-starting game on card click:** The CONTEXT.md decision is explicit: click selects, "Start Game" button starts. Do not collapse these.
- **Hiding the picker when only one collection:** The CONTEXT.md decision is explicit: show the single card anyway.
- **Reading `isActive` filter only on frontend:** Filter in the SQL query (WHERE isActive = true) to avoid leaking inactive collections.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card shimmer loading animation | Custom CSS keyframe animation | Tailwind `animate-pulse` | Already available, consistent with project style |
| Horizontal scroll on mobile | Custom scroll container | CSS `overflow-x-auto` + flex-nowrap | Simple, no JS needed; mobile stacks vertically anyway |
| Color contrast for card headers | Custom contrast checker | Hard-code from existing `themeColor` DB values | DB values are already chosen; don't over-engineer |
| State persistence | Custom storage abstraction | Direct `localStorage.getItem`/`setItem` | Simple string value, no abstraction needed |

**Key insight:** This phase is primarily component composition within an established codebase. Resist adding new abstractions.

## Common Pitfalls

### Pitfall 1: Stale collectionId on Game Start

**What goes wrong:** Player selects a collection, then navigates away and back. The selection resets because it was only in component state (not localStorage).
**Why it happens:** Component state is destroyed on unmount.
**How to avoid:** Always initialize `selectedId` from localStorage in `useCollections`. The CONTEXT.md decision already specifies remembering last-played.
**Warning signs:** On return visit, button always says "Play Federal Civics" even when user last played a different collection.

### Pitfall 2: Wrong Federal Civics as Default

**What goes wrong:** Federal Civics is not ID=1 in production if seed ran differently.
**Why it happens:** The seed data sets `sortOrder: 1` for Federal Civics and `slug: 'federal'`, but the backend uses `slug: 'federal-civics'` in `getFederalCollectionId()`. The seed file uses slug `'federal'` (not `'federal-civics'`).
**How to avoid:** Select the default collection by `sortOrder: 1` (lowest sort order) from the API response, not by hardcoded ID. The collections endpoint returns results ordered by `sortOrder`, so `collections[0]` is the correct default.
**Warning signs:** `getFederalCollectionId()` logs "Federal civics collection not found by slug, using fallback ID 1" — the slug mismatch between seed and service.

**Note for planner:** The seed file uses slug `'federal'` but `questionService.ts` queries slug `'federal-civics'`. This is an existing discrepancy. Do not fix it in Phase 15 — it's out of scope. Just use `collections[0]` from the API response as the default.

### Pitfall 3: Question Count Off When Collections Have Expired Questions

**What goes wrong:** The count shown on the card includes questions that have `expiresAt` in the past.
**Why it happens:** A simple `COUNT(*)` doesn't filter by expiration.
**How to avoid:** Add the expiration filter to the question count query:
```sql
WHERE (questions.expires_at IS NULL OR questions.expires_at > NOW())
```
**Warning signs:** Card shows 50 questions but game only delivers 10 because most are expired.

### Pitfall 4: Bloomington/LA Collections Showing (isActive = false)

**What goes wrong:** Non-active collections appear in the picker.
**Why it happens:** Forgetting to filter `WHERE is_active = true` in the backend query.
**How to avoid:** Always filter by `isActive = true` in the SQL query. The seed data has Bloomington IN and Los Angeles as `isActive: false`.
**Warning signs:** Picker shows all 3 collections; selecting Bloomington triggers empty game or error.

### Pitfall 5: Game Page Ignoring collectionId on Auto-Start

**What goes wrong:** Player clicks "Play Federal Civics" from Dashboard, but the game starts with default (no collection). The game page auto-starts in the current `Game.tsx` — it doesn't re-read collectionId from router state.
**Why it happens:** Current `Game.tsx` renders `GameScreen` immediately and relies on the user clicking "Quick Play" to call `startGame()`. If the dashboard is changed to navigate directly to `/play`, the game auto-starts without collectionId.
**How to avoid:** Either (a) keep the user clicking "Start Game" within the game screen (but now it's the dashboard's button), or (b) pass collectionId via router state and have the game pick it up in `useGameState.startGame()`. Approach (b) is cleaner given the redesign.

### Pitfall 6: themeColor Used Directly as Tailwind Class

**What goes wrong:** `className={`bg-[${collection.themeColor}]`}` does not work with Tailwind's JIT compiler unless the color is in a safelist or used as an inline style.
**Why it happens:** Tailwind purges dynamic class strings.
**How to avoid:** Use inline style for the dynamic color: `style={{ backgroundColor: collection.themeColor }}`. The header band is a fixed-height div; inline style is correct here.
**Warning signs:** All collection header bands appear with no background color in production build.

## Code Examples

Verified patterns from existing codebase:

### Frontend Collection Type

```typescript
// frontend/src/features/collections/types.ts
export interface CollectionSummary {
  id: number;
  name: string;
  slug: string;
  description: string;
  themeColor: string;        // 7-char hex e.g. '#1E3A8A'
  questionCount: number;
}
```

### CollectionCard Component (Core Pattern)

```typescript
// Source: project patterns — Tailwind + Framer Motion card selection
interface CollectionCardProps {
  collection: CollectionSummary;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export function CollectionCard({ collection, isSelected, onSelect }: CollectionCardProps) {
  return (
    <button
      onClick={() => onSelect(collection.id)}
      className={[
        'relative rounded-xl overflow-hidden transition-all duration-200 text-left w-48 flex-shrink-0',
        isSelected
          ? 'ring-2 ring-teal-400 shadow-xl scale-105'
          : 'opacity-80 hover:opacity-100 hover:scale-102',
      ].join(' ')}
      aria-pressed={isSelected}
      aria-label={`${collection.name}, ${collection.questionCount} questions${isSelected ? ', selected' : ''}`}
    >
      {/* Colored header band */}
      <div
        className="h-14"
        style={{ backgroundColor: collection.themeColor }}
      />
      {/* Card body */}
      <div className="bg-slate-800 p-3">
        <div className="text-white font-semibold text-sm leading-tight">
          {collection.name}
        </div>
        <div className="text-slate-400 text-xs mt-1 line-clamp-2">
          {collection.description}
        </div>
        <div className="text-slate-500 text-xs mt-2">
          {collection.questionCount} questions
        </div>
      </div>
      {/* Selected checkmark indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-teal-400 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  );
}
```

### Responsive Layout — Horizontal on Desktop, Vertical Stack on Mobile

```typescript
// Source: Tailwind CSS responsive prefix pattern
<div className="flex flex-col sm:flex-row sm:overflow-x-auto gap-3 pb-2">
  {collections.map(c => (
    <CollectionCard key={c.id} collection={c} isSelected={selectedId === c.id} onSelect={select} />
  ))}
</div>
```

Breakpoint: `sm:` (640px) switches from vertical stack to horizontal row. This aligns with the project's existing responsive patterns.

### localStorage Persistence

```typescript
// Source: Web Storage API — no library needed
const STORAGE_KEY = 'lastCollectionId';

// Read on init
const saved = localStorage.getItem(STORAGE_KEY);
const savedId = saved ? parseInt(saved, 10) : null;

// Write on selection
localStorage.setItem(STORAGE_KEY, String(id));
```

### Game Header — Collection Name Badge

```typescript
// Source: existing GameScreen.tsx top HUD pattern — add collection badge
// In the top HUD area of GameScreen.tsx (idle phase or during play):
{state.collectionName && (
  <div className="text-xs text-slate-500 font-medium tracking-wide">
    {state.collectionName}
  </div>
)}
```

### Results Screen — Collection Name

```typescript
// Source: existing ResultsScreen.tsx heading area — minimal addition
// Note: collectionName comes from GameSessionResult via fetchGameResults
// GameState already has collectionName — pass it to ResultsScreen via props
<h1 className="text-4xl font-bold text-white mb-2">Game Complete!</h1>
{collectionName && (
  <div className="text-slate-400 text-sm mb-6">{collectionName}</div>
)}
```

## State of the Art

| Old Pattern | Current Pattern | Notes |
|-------------|-----------------|-------|
| Passing collectionId via query params | Passing via React Router state (`location.state`) | Router state is ephemeral (lost on refresh) but correct for a single game flow |
| Fetching in component body | Fetching in custom hook | Project pattern established in useGameState.ts |

**Deprecated/outdated:**
- None relevant to this phase.

## Open Questions

1. **The slug mismatch: `'federal'` in seed vs `'federal-civics'` in questionService.ts**
   - What we know: `collections.ts` seed uses `slug: 'federal'`; `questionService.ts` queries `slug: 'federal-civics'`; the fallback is hardcoded ID 1
   - What's unclear: Whether the deployed database has the slug as `'federal'` or `'federal-civics'`
   - Recommendation: Use `sortOrder` (lowest = Federal Civics) for default selection in the picker, not slug. Do not touch this in Phase 15. Log the discrepancy for Phase 16 or a hotfix.

2. **Game page flow with auto-start vs explicit start**
   - What we know: Current `Game.tsx` shows a "Quick Play" start screen in GameScreen idle phase; Dashboard currently navigates to `/play` and lets the user click start there
   - What's unclear: Should the dashboard's "Play [Collection]" button auto-start the game on arrival at `/play`? The CONTEXT.md decisions say "Start Game button stays at the top" and "clicking a card selects it — does NOT auto-start"
   - Recommendation: Keep the existing two-step flow. The Dashboard button navigates to `/play` and passes `collectionId` via router state. The game page's "Quick Play" button triggers `startGame(collectionId)`. The button text in the game idle screen should be "Start Game" (not "Quick Play"). Alternatively — cleaner — start the game immediately on navigation to `/play` with the collectionId already decided. Either approach is valid. Planner should pick one.

3. **ResultsScreen needs collectionName prop**
   - What we know: `GameState.collectionName` is available at the `complete` phase. `ResultsScreen` currently receives `result: GameResult` which doesn't include `collectionName`. `fetchGameResults()` does return `collectionName` in `GameSessionResult`.
   - What's unclear: Whether to pull `collectionName` from `GameState` (already in memory) or from `GameSessionResult` (fetched from server).
   - Recommendation: Pass `collectionName` from `GameState` (already available via the game reducer) as a separate prop to `ResultsScreen`. Simplest path, no extra fetch needed.

## Sources

### Primary (HIGH confidence)
- Project codebase direct inspection — all findings verified against actual source files
  - `backend/src/db/schema.ts` — collections table structure (themeColor, isActive, sortOrder confirmed)
  - `backend/src/routes/game.ts` — existing session route, collectionId parameter already accepted
  - `backend/src/services/questionService.ts` — Drizzle ORM query patterns
  - `frontend/src/services/gameService.ts` — createGameSession already accepts collectionId
  - `frontend/src/types/game.ts` — GameState has collectionName, collectionSlug
  - `frontend/src/features/game/gameReducer.ts` — SESSION_CREATED action already stores collection fields
  - `frontend/src/pages/Dashboard.tsx` — current dashboard structure
  - `frontend/src/features/game/hooks/useGameState.ts` — hook pattern to follow
  - `frontend/package.json` — confirmed available libraries

### Secondary (MEDIUM confidence)
- Tailwind CSS `animate-pulse` — standard utility documented at tailwindcss.com, verified in Tailwind 3 docs; no library needed for skeleton
- Web Storage API `localStorage` — browser standard, no library needed for simple string persistence

### Tertiary (LOW confidence)
- None — all claims in this research are verifiable from the codebase directly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing source files
- Architecture: HIGH — patterns derived from existing codebase conventions (useGameState, apiRequest, Tailwind patterns)
- Pitfalls: HIGH — derived from actual code inspection (themeColor inline style requirement, isActive filter, slug mismatch documented in source)
- Backend endpoint design: HIGH — follows established Drizzle ORM patterns from questionService.ts

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (30 days — stable stack, no external dependencies)

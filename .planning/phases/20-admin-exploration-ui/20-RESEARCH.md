# Phase 20: Admin Exploration UI - Research

**Researched:** 2026-02-19
**Domain:** React admin UI, data tables, server-side pagination, slide-over panels
**Confidence:** HIGH

## Summary

Phase 20 builds a read-only admin exploration UI for questions and collection health, extending the existing admin shell from Phase 18 (red theme, sidebar nav, Headless UI components). The standard approach for this type of admin interface uses server-side pagination with URL-based filter state, native browser table elements styled with Tailwind CSS (no heavy table library needed for the feature set), and Headless UI Dialog for slide-over panels. Search uses PostgreSQL ILIKE for simplicity since question/answer text fields are moderate length (< 500 chars typical) and the dataset is small (< 500 questions total). Quality violations are computed on-demand from the quality rules engine (not stored in DB), so the detail view must fetch violations dynamically.

The tech stack is already locked in: React 18 with React Router 6, Tailwind CSS, Headless UI, Express with Drizzle ORM, and PostgreSQL. The admin shell, red theme, and navigation patterns are established in Phase 18. The challenge is building efficient server-side data handling with dynamic filtering/sorting and a responsive slide-over pattern that maintains table context.

**Primary recommendation:** Build API-first with Express route handlers that accept standardized query params (page, limit, sort, order, filters), use Drizzle's dynamic query building for flexible WHERE/ORDER BY construction, implement URL state management with React Router's useSearchParams, and use native HTML table with Tailwind styling rather than a heavyweight table library.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2.0 | UI framework | Already in project, stable foundation |
| React Router | 6.21.1 | Routing + URL state | Already in project, useSearchParams hook for filter persistence |
| Tailwind CSS | 3.4.1 | Styling | Already in project, utility-first approach fits admin UI rapid development |
| Headless UI | 2.2.9 | Accessible components | Already in project (Phase 18), Dialog component for slide-over panels |
| Express | 4.18.2 | Backend API | Already in project, standard for admin APIs |
| Drizzle ORM | 0.45.1 | Database queries | Already in project, supports dynamic query building for filters/sorting |
| express-validator | 7.3.1 | Request validation | Already in project, validates pagination/filter params |
| PostgreSQL | 8.11.3+ | Database | Already in project with indexes on quality_score, status |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 12.34.0 | Slide-over animations | Already in project, smooth panel transitions |
| zustand | 4.4.7 | Client state (if needed) | Already in project for auth state, could manage selected question ID |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native table + Tailwind | TanStack Table | TanStack adds 15.2kb for features we don't need (column resizing, virtualization). Native table is simpler for fixed columns and small datasets |
| ILIKE search | PostgreSQL full-text search | Full-text search adds setup complexity (tsvector columns, GIN indexes, stemming config) for marginal benefit on short text fields. ILIKE with pg_trgm index sufficient for < 500 questions |
| useSearchParams | nuqs library | nuqs adds type-safety for URL params but adds dependency. useSearchParams is built-in and sufficient for simple filter state |

**Installation:**
No new dependencies needed - all required libraries already installed in project.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── pages/admin/
│   ├── AdminLayout.tsx           # Already exists - sidebar shell
│   ├── AdminDashboard.tsx        # Already exists - overview
│   ├── QuestionsPage.tsx         # NEW - question table + search/filters
│   ├── CollectionsPage.tsx       # NEW - collection health dashboard
│   └── components/
│       ├── QuestionTable.tsx     # Table with sorting/filtering
│       ├── QuestionDetailPanel.tsx  # Slide-over for question details
│       ├── CollectionCard.tsx    # Collection health summary card
│       └── ProgressBar.tsx       # Custom progress visualization

backend/src/routes/
├── admin.ts                      # Already exists - extend with new endpoints
└── (middleware already exists)
```

### Pattern 1: Server-Side Pagination with URL State
**What:** API returns paginated data subset, frontend syncs filter state with URL query params
**When to use:** Always for admin data tables with 50+ records
**Example:**
```typescript
// Frontend - QuestionsPage.tsx
import { useSearchParams } from 'react-router-dom';

export function QuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read state from URL
  const page = parseInt(searchParams.get('page') || '1');
  const collection = searchParams.get('collection') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const sort = searchParams.get('sort') || 'qualityScore';
  const order = searchParams.get('order') || 'asc';

  // Update URL when filters change
  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(newParams);
  };

  // Fetch data based on URL state
  useEffect(() => {
    fetchQuestions({ page, collection, difficulty, sort, order });
  }, [page, collection, difficulty, sort, order]);
}

// Backend - admin.ts route
router.get('/questions', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const sort = (req.query.sort as string) || 'quality_score';
  const order = (req.query.order as string) === 'desc' ? 'desc' : 'asc';

  // Build dynamic query with Drizzle
  let query = db.select().from(questions);

  // Apply filters
  const filters = [];
  if (req.query.collection) {
    filters.push(eq(collections.slug, req.query.collection));
  }
  if (filters.length > 0) {
    query = query.where(and(...filters));
  }

  // Apply sorting (use desc() or asc() from drizzle-orm)
  query = query.orderBy(
    order === 'desc' ? desc(questions[sort]) : asc(questions[sort])
  );

  // Apply pagination
  query = query.limit(limit).offset((page - 1) * limit);

  const results = await query;
  const total = await db.select({ count: sql`count(*)` }).from(questions);

  res.json({
    data: results,
    pagination: {
      page,
      limit,
      total: total[0].count,
      pages: Math.ceil(total[0].count / limit)
    }
  });
});
```
**Source:** [React Router useSearchParams](https://reactrouter.com/api/hooks/useSearchParams), [Drizzle ORM Dynamic Query Building](https://orm.drizzle.team/docs/dynamic-query-building)

### Pattern 2: Slide-Over Panel with Context Preservation
**What:** Dialog panel slides from right, main content (table) remains visible/interactive underneath
**When to use:** Detail views where user needs to reference main list while inspecting item
**Example:**
```typescript
// QuestionDetailPanel.tsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

interface Props {
  questionId: number | null;
  onClose: () => void;
}

export function QuestionDetailPanel({ questionId, onClose }: Props) {
  const isOpen = questionId !== null;
  const question = useQuestion(questionId); // Fetch question details + violations

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        </Transition.Child>

        {/* Slide-over panel */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-200"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    {/* Header with close button */}
                    <div className="bg-red-900 px-6 py-4">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-xl font-semibold text-white">
                          Question Details
                        </Dialog.Title>
                        <button onClick={onClose} className="text-red-100 hover:text-white">
                          <span className="sr-only">Close panel</span>
                          {/* Close X icon */}
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="relative flex-1 px-6 py-6">
                      {question ? (
                        <QuestionDetail question={question} />
                      ) : (
                        <LoadingSkeleton />
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
```
**Source:** [Headless UI Dialog](https://headlessui.com/react/dialog), [Headless UI Transition](https://headlessui.com/react/transition)

### Pattern 3: Debounced Search Input
**What:** Delay API calls until user stops typing to avoid excessive requests
**When to use:** Search inputs that trigger API calls
**Example:**
```typescript
// useDebounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage in search component
function QuestionSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchInput, 300);

  // Update URL when debounced value changes
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (debouncedSearch) {
      newParams.set('search', debouncedSearch);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  }, [debouncedSearch]);

  return (
    <input
      type="text"
      value={searchInput}
      onChange={(e) => setSearchInput(e.target.value)}
      placeholder="Search questions, answers, explanations..."
    />
  );
}
```
**Source:** [React debounce best practices](https://www.developerway.com/posts/debouncing-in-react)

### Pattern 4: Drizzle Dynamic Filtering with Array Aggregation
**What:** Build WHERE clauses dynamically based on query params, join collections for filtering
**When to use:** Admin APIs with multiple optional filters
**Example:**
```typescript
// Backend - dynamic filtering with collection join
router.get('/admin/questions', authenticateToken, requireAdmin, async (req, res) => {
  const { collection, difficulty, status, search, sort = 'quality_score', order = 'asc' } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;

  // Build dynamic filters array
  const filters = [];

  if (status) {
    filters.push(eq(questions.status, status as string));
  }

  if (difficulty) {
    filters.push(eq(questions.difficulty, difficulty as string));
  }

  if (search) {
    // ILIKE search across question text, options, explanation
    const searchPattern = `%${search}%`;
    filters.push(
      or(
        ilike(questions.text, searchPattern),
        sql`${questions.options}::text ILIKE ${searchPattern}`, // Search in JSONB array
        ilike(questions.explanation, searchPattern)
      )
    );
  }

  // Base query with collection join
  let query = db
    .select({
      id: questions.id,
      externalId: questions.externalId,
      text: questions.text,
      difficulty: questions.difficulty,
      qualityScore: questions.qualityScore,
      status: questions.status,
      encounterCount: questions.encounterCount,
      correctCount: questions.correctCount,
      createdAt: questions.createdAt,
      collectionNames: sql<string[]>`array_agg(DISTINCT ${collections.name})`
    })
    .from(questions)
    .leftJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
    .leftJoin(collections, eq(collectionQuestions.collectionId, collections.id))
    .groupBy(questions.id);

  // Apply filters
  if (filters.length > 0) {
    query = query.where(and(...filters));
  }

  // Apply sorting - handle DESC NULLS LAST for quality_score
  if (sort === 'quality_score') {
    query = query.orderBy(
      order === 'desc'
        ? sql`${questions.qualityScore} DESC NULLS LAST`
        : sql`${questions.qualityScore} ASC NULLS LAST`
    );
  } else {
    query = query.orderBy(
      order === 'desc' ? desc(questions[sort]) : asc(questions[sort])
    );
  }

  // Get total count for pagination
  const countQuery = db
    .select({ count: sql<number>`count(DISTINCT ${questions.id})` })
    .from(questions)
    .leftJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
    .leftJoin(collections, eq(collectionQuestions.collectionId, collections.id));

  if (filters.length > 0) {
    countQuery.where(and(...filters));
  }

  const [{ count }] = await countQuery;

  // Apply pagination
  const results = await query.limit(limit).offset((page - 1) * limit);

  res.json({
    data: results,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});
```
**Source:** [Drizzle ORM Dynamic Query Building](https://orm.drizzle.team/docs/dynamic-query-building), [Drizzle ORM Select](https://orm.drizzle.team/docs/select)

### Anti-Patterns to Avoid
- **Client-side filtering of large datasets:** Don't fetch all questions and filter in React - use server-side filtering with query params
- **Storing derived data in URL:** Don't put computed values (like total pages) in URL - only store filter inputs
- **Fetching violations on table load:** Don't run quality rules engine for every question in list view - only fetch violations when detail panel opens
- **Using controlled state without URL sync:** Don't store filter state only in React state - always sync with URL for shareability
- **Full table re-render on filter change:** Use React.memo and key props properly to avoid re-rendering all table rows

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible slide-over panel | Custom dialog with portal + focus trap | Headless UI Dialog | Handles focus trap, scroll lock, ESC key, backdrop click, screen reader announcements, and keyboard navigation automatically |
| URL query param parsing | Manual URLSearchParams manipulation | React Router useSearchParams | Type-safe, integrates with router navigation, handles encoding/decoding |
| Table sorting state | Custom sort direction toggle logic | useSearchParams with 'sort' and 'order' params | Shareable sort state, works with browser back button |
| Debounced input | Custom setTimeout logic | useDebounce custom hook | Handles cleanup on unmount, prevents memory leaks |
| Loading skeletons | Custom pulse animations | Tailwind animate-pulse utility | Built-in, respects prefers-reduced-motion, consistent across app |
| Progress bars | Custom SVG or canvas | Tailwind width utilities with transitions | Simple, performant, no extra dependencies |

**Key insight:** Admin UIs benefit from using battle-tested primitives (Headless UI) rather than custom implementations. Focus effort on domain logic (quality score presentation, violation display) rather than reinventing UI patterns.

## Common Pitfalls

### Pitfall 1: N+1 Queries for Collection Names
**What goes wrong:** Fetching question list, then making separate query for each question's collections
**Why it happens:** Drizzle ORM doesn't automatically handle many-to-many joins with aggregation
**How to avoid:** Use raw SQL with array_agg or Drizzle's leftJoin + groupBy pattern to get all collection names in single query
**Warning signs:** Query count scales with result set size, admin page loads slowly with 25+ questions

### Pitfall 2: ILIKE Performance Without Index
**What goes wrong:** Search becomes slow as question count grows beyond 100
**Why it happens:** ILIKE with wildcard pattern (%search%) cannot use standard B-tree indexes
**How to avoid:** Add pg_trgm extension and create GIN index: `CREATE INDEX idx_questions_text_trgm ON civic_trivia.questions USING gin(text gin_trgm_ops)`
**Warning signs:** Search queries taking > 100ms on dataset with 300+ questions

### Pitfall 3: Slide-Over Focus Trap Breaking Navigation
**What goes wrong:** User cannot navigate away using keyboard shortcuts or links outside panel
**Why it happens:** Headless UI Dialog traps focus by design for accessibility
**How to avoid:** Ensure all navigation is either inside the panel or via the close button. Don't put links in the backdrop or outside the Dialog.Panel
**Warning signs:** Keyboard users report being "stuck" in detail view

### Pitfall 4: Quality Score NULL Handling in Sorting
**What goes wrong:** Questions without quality scores (NULL) appear first in ascending sort or disappear from results
**Why it happens:** PostgreSQL default NULL sorting behavior
**How to avoid:** Always use `DESC NULLS LAST` or `ASC NULLS LAST` when sorting by quality_score column. This matches the index definition from Phase 19
**Warning signs:** Question count changes when sorting, or unscored questions appear at top

### Pitfall 5: URL State Sync Loops
**What goes wrong:** Infinite re-render loop when syncing URL params with local state
**Why it happens:** useEffect updating searchParams triggers new useSearchParams value, which triggers useEffect again
**How to avoid:** Only update URL from user actions (button clicks, input changes), not from useEffect watching URL params. Use the URL as single source of truth
**Warning signs:** React renders 100+ times per second, browser becomes unresponsive

### Pitfall 6: Fetching Violations for All Questions
**What goes wrong:** Admin question list page takes 30+ seconds to load
**Why it happens:** Running quality rules engine (including async URL checks) for all questions to show violation count
**How to avoid:** Quality violations are NOT stored in DB - they're computed on-demand. Only run quality audit when detail panel opens for a single question. For list view, rely on quality_score and hasBlockingViolations flag (if stored) or omit violation count entirely
**Warning signs:** API response times > 5 seconds, multiple concurrent URL validation requests

### Pitfall 7: Forgetting Pagination Metadata
**What goes wrong:** Frontend cannot build page controls, "Next" button always enabled
**Why it happens:** API returns data array without total count or page count
**How to avoid:** Always return pagination object: `{ page, limit, total, pages }`. Frontend needs total and pages to disable next/prev buttons correctly
**Warning signs:** "Next" button on last page, no page numbers, cannot jump to specific page

## Code Examples

Verified patterns from research and existing project code:

### Loading Skeleton for Table
```typescript
// TableSkeleton.tsx
export function TableSkeleton({ rows = 10, columns = 7 }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-gray-200 py-4">
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: columns }).map((_, j) => (
              <div key={j} className="h-4 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```
**Source:** Project uses Tailwind animate-pulse, pattern from [React Loading Skeleton best practices](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/)

### Progress Bar with Tailwind (No Library)
```typescript
// ProgressBar.tsx
interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  color?: 'green' | 'yellow' | 'red';
}

export function ProgressBar({ value, max = 100, label, color = 'green' }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colorClasses = {
    green: 'bg-green-600',
    yellow: 'bg-yellow-500',
    red: 'bg-red-600'
  };

  return (
    <div>
      {label && (
        <div className="flex justify-between mb-1 text-sm">
          <span className="text-gray-700">{label}</span>
          <span className="text-gray-900 font-medium">{value}/{max}</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```
**Source:** [Tailwind CSS Progress Bar](https://flowbite.com/docs/components/progress/), adapted for project

### Filter Dropdown (Spreadsheet-Style)
```typescript
// FilterDropdown.tsx
interface FilterDropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
      >
        <option value="">All</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```
**Source:** Pattern from admin dashboard research, styled with Tailwind

### Calculated Difficulty Rate Display
```typescript
// DifficultyRate.tsx
interface DifficultyRateProps {
  correctCount: number;
  encounterCount: number;
  minEncounters?: number;
}

export function DifficultyRate({
  correctCount,
  encounterCount,
  minEncounters = 20
}: DifficultyRateProps) {
  if (encounterCount < minEncounters) {
    return (
      <span className="text-gray-400 text-sm">
        Insufficient data ({encounterCount} encounters)
      </span>
    );
  }

  const rate = Math.round((correctCount / encounterCount) * 100);

  // Color coding: red < 30%, yellow 30-60%, green > 60%
  const colorClass =
    rate < 30 ? 'text-red-600' :
    rate < 60 ? 'text-yellow-600' :
    'text-green-600';

  return (
    <span className={`font-medium ${colorClass}`}>
      {rate}% correct
    </span>
  );
}
```
**Source:** Based on TELE-03 requirement for calculated difficulty rate

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side pagination | Server-side pagination with URL state | 2024+ | Handles larger datasets, shareable/bookmarkable filtered views |
| Custom table libraries (react-table v7) | TanStack Table v8 or native HTML + CSS | 2023+ | Headless approach gives full styling control, smaller bundle |
| Imperative modals | Headless UI Dialog with declarative open state | 2021+ | Better accessibility, simpler state management |
| Redux for filter state | URL params as state source | 2022+ | Shareable, works with browser back button, less boilerplate |
| Lodash debounce | Custom useDebounce hook | 2020+ | Avoids extra dependency, better React integration with cleanup |
| Elasticsearch for search | PostgreSQL ILIKE with pg_trgm | 2024+ | Simpler infrastructure for small datasets (< 10k records) |

**Deprecated/outdated:**
- **react-table v7:** Replaced by TanStack Table v8 (headless). However, for simple admin tables, native HTML table is often better
- **Client-side filtering with useMemo:** Works for < 100 rows, but server-side is now standard for admin dashboards
- **Material-UI v4:** Replaced by MUI v5, but project uses Headless UI + Tailwind which is lighter weight

## Open Questions

Things that couldn't be fully resolved:

1. **Violation Storage Strategy**
   - What we know: Phase 19 stores quality_score in DB but NOT individual violations. Violations are computed on-demand by quality rules engine
   - What's unclear: Should we add a violations JSONB column to avoid re-running rules engine on every detail view? Trade-off: storage + staleness vs compute cost
   - Recommendation: For Phase 20, compute violations on-demand when detail panel opens. Monitor performance. If detail views are slow (> 2s), consider caching violations in Phase 21

2. **pg_trgm Extension Availability**
   - What we know: pg_trgm extension dramatically improves ILIKE performance with wildcards
   - What's unclear: Whether extension is available in production environment (some managed PostgreSQL restrict extensions)
   - Recommendation: Attempt to enable extension in migration script with IF EXISTS check. If not available, ILIKE will still work (just slower). Document this as a performance optimization

3. **Collection Health Threshold Values**
   - What we know: CONTEXT.md says "color-coded health indicators on cards: red/yellow/green based on thresholds"
   - What's unclear: Exact threshold values for color coding (e.g., < 30 questions = red, 30-50 = yellow, > 50 = green?)
   - Recommendation: Leave as implementation detail for planning phase. Use conservative defaults based on minimum viable collection size (50 questions from previous phases)

## Sources

### Primary (HIGH confidence)
- [React Router useSearchParams](https://reactrouter.com/api/hooks/useSearchParams) - Official React Router docs
- [Drizzle ORM Dynamic Query Building](https://orm.drizzle.team/docs/dynamic-query-building) - Official Drizzle docs
- [Drizzle ORM Select](https://orm.drizzle.team/docs/select) - Official Drizzle docs
- [Drizzle ORM Pagination Guide](https://orm.drizzle.team/docs/guides/limit-offset-pagination) - Official Drizzle docs
- [Headless UI Dialog](https://headlessui.com/react/dialog) - Official Headless UI docs
- [Headless UI Transition](https://headlessui.com/react/transition) - Official Headless UI docs
- Project codebase: AdminLayout.tsx, admin.ts routes, schema.ts - Already implemented patterns

### Secondary (MEDIUM confidence)
- [TanStack Table Guide](https://www.contentful.com/blog/tanstack-table-react-table/) - Comprehensive overview of when to use table libraries
- [REST API Pagination Best Practices](https://restfulapi.net/api-pagination-sorting-filtering/) - Industry standard patterns
- [Express.js Pagination and Filtering](https://www.leadwithskills.com/blogs/expressjs-pagination-filtering-api) - Query param patterns
- [React Debouncing Guide](https://www.developerway.com/posts/debouncing-in-react) - Best practices for search inputs
- [PostgreSQL ILIKE Performance](https://www.cybertec-postgresql.com/en/postgresql-more-performance-for-like-and-ilike-statements/) - pg_trgm optimization
- [Drizzle ORM PostgreSQL Full-Text Search](https://orm.drizzle.team/docs/guides/postgresql-full-text-search) - Alternative to ILIKE
- [React Loading Skeleton Best Practices](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/) - Loading state patterns
- [Tailwind CSS Progress Bar](https://flowbite.com/docs/components/progress/) - Progress visualization

### Tertiary (LOW confidence - general guidance)
- [React Admin Dashboard Best Practices](https://refine.dev/blog/react-admin-dashboard/) - High-level patterns, not project-specific
- [Data Table UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) - Design patterns for tables

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, versions verified in package.json
- Architecture: HIGH - Patterns verified with official docs (React Router, Drizzle, Headless UI), existing project patterns reviewed
- Pitfalls: HIGH - Based on official docs limitations (NULL sorting, focus trap), common issues documented in community discussions
- Search performance: MEDIUM - ILIKE vs full-text search trade-off depends on dataset size and pg_trgm availability

**Research date:** 2026-02-19
**Valid until:** 30 days (stable technologies - React 18, React Router 6, Drizzle ORM, Headless UI are mature)

# Stack Research: v1.2 Community Collections

**Domain:** Civic Trivia Championship (game-show-style web app)
**Researched:** 2026-02-18
**Confidence:** HIGH (existing stack verified, new additions are minimal)

## Executive Summary

v1.2 introduces community question collections with tagging, expiration, and locale-specific content generation. The critical stack decision is **migrating questions from JSON file to PostgreSQL** -- everything else follows from that. The existing stack (React 18, TypeScript, Express, PostgreSQL, Redis) handles all new requirements without new runtime dependencies. One new dev dependency (node-cron) is needed for expiration checks, and the existing `@anthropic-ai/sdk` script needs enhancement for locale-aware generation.

**Zero new runtime dependencies required.** The existing stack covers everything.

## Critical Decision: Questions Must Move to PostgreSQL

### Current State

Questions live in `backend/src/data/questions.json`, loaded at startup via `readFileSync` into an in-memory array (see `game.ts` lines 17-19). The `allQuestions` constant is module-scoped and immutable at runtime.

### Why JSON No Longer Works

| Requirement | JSON File | PostgreSQL |
|---|---|---|
| Multiple collections | Would need nested structure, complex filtering | Natural with relational tables and joins |
| Tag-based membership (question in multiple collections) | Array-of-arrays, no indexing | Junction table with indexes |
| Expiration dates | No scheduling mechanism, full file rewrite | `WHERE expires_at > NOW()` in queries |
| Add new collections without deploy | Requires code deploy to update file | INSERT into database, immediate |
| Per-collection metadata (name, locale, description) | JSON gets unwieldy | Separate `collections` table |
| Concurrent content review | File conflicts in git | Database transactions |

**Recommendation: Move questions to PostgreSQL.** Use the existing Supabase PostgreSQL instance and `pg` client (`pg@8.11.3` already installed).

### Migration Strategy

Keep `questions.json` as a **seed file** for the initial Federal collection. On startup or via migration script, seed the database if the `questions` table is empty. This preserves the existing 120 questions as the "Federal Civics" collection and allows the JSON file to remain in the repo as a reference/backup.

### Schema Design

Use a relational tagging pattern (not JSONB) because tags are the primary query dimension:

```sql
-- Collections (Federal, Bloomington IN, Los Angeles CA, etc.)
CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,        -- 'federal', 'bloomington-in', 'los-angeles-ca'
  name VARCHAR(200) NOT NULL,               -- 'Federal Civics'
  locale VARCHAR(100),                      -- 'Bloomington, IN' (NULL for federal)
  description TEXT,
  icon_url VARCHAR(500),
  question_count INTEGER DEFAULT 0,         -- Denormalized for fast display
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questions (migrated from JSON)
CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(20) PRIMARY KEY,               -- Keep existing 'q001' format
  text TEXT NOT NULL,
  options JSONB NOT NULL,                   -- ['Option A', 'Option B', ...] (always 4)
  correct_answer INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  topic_category VARCHAR(100) NOT NULL,
  learning_content JSONB,                   -- Entire learningContent object (variable structure)
  expires_at TIMESTAMP,                     -- NULL = never expires
  is_active BOOLEAN DEFAULT true,           -- Soft delete / manual disable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table: questions belong to multiple collections
CREATE TABLE IF NOT EXISTS collection_questions (
  collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
  question_id VARCHAR(20) REFERENCES questions(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id, question_id)
);

-- Indexes for common queries
CREATE INDEX idx_questions_expires_at ON questions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_questions_active ON questions(is_active) WHERE is_active = true;
CREATE INDEX idx_collection_questions_collection ON collection_questions(collection_id);
CREATE INDEX idx_collection_questions_question ON collection_questions(question_id);
CREATE INDEX idx_collections_active ON collections(is_active) WHERE is_active = true;
```

**Why JSONB for `options` and `learning_content` but relational for tags:**
- `options` is always a fixed 4-element array, never queried individually -- JSONB is simpler than 4 columns or a separate table.
- `learning_content` has nested, variable structure (paragraphs, corrections, source) -- relational decomposition would create 3+ tables for no query benefit.
- Tags/collections ARE the primary query dimension ("give me questions in collection X") so they need indexed relational joins. Research confirms: use relational tables for frequently-queried relationships, JSONB for variable nested data.

**Confidence:** HIGH -- this follows standard PostgreSQL tagging patterns. The Heap engineering blog specifically warns against JSONB for data you query by (like tags), recommending relational tables instead.

## Expiration System

### Approach: In-Process Cron with `node-cron`

**Install:** `node-cron@3.0.3` (dev dependency if run as separate script, runtime dependency if in-process)

```bash
cd backend
npm install node-cron
npm install -D @types/node-cron
```

**Why `node-cron` over alternatives:**
- **Over `node-schedule`:** node-cron is lighter (no date-object scheduling needed; pure cron syntax suffices for "check every hour"). Weekly downloads: node-cron ~2.5M vs node-schedule ~1.8M.
- **Over Render Cron Jobs:** Render cron jobs spin up a separate process each run (cold start latency, separate billing). For a simple hourly SQL query, in-process cron is simpler and free.
- **Over `setInterval`:** node-cron handles cron expression parsing, timezone awareness, and is more readable than raw millisecond intervals.

**Implementation pattern:**

```typescript
import cron from 'node-cron';

// Run every hour at :00
cron.schedule('0 * * * *', async () => {
  const result = await pool.query(`
    UPDATE questions
    SET is_active = false
    WHERE expires_at IS NOT NULL
      AND expires_at <= NOW()
      AND is_active = true
    RETURNING id, text, expires_at
  `);

  if (result.rows.length > 0) {
    console.log(`Deactivated ${result.rows.length} expired questions`);
    // Notification logic here (see Notification section)
  }
});
```

**Why hourly, not per-minute:** Questions expire on a date basis, not second-by-second. Hourly granularity means at most ~59 minutes of an expired question remaining in rotation. Acceptable for trivia content.

**Alternative considered: PostgreSQL `pg_cron` extension.**
Supabase supports `pg_cron` for database-level scheduling. However:
- Requires Supabase Pro plan or manual extension setup
- Cannot trigger application-level notifications (email, logs)
- Harder to test locally
- **Verdict:** Keep scheduling in application code for portability and notification integration.

## Notification Mechanism for Expired Questions

### Approach: Logging + Optional Email (No New Dependencies)

For v1.2, expired question notifications target **admin/volunteer reviewers**, not end users. Start simple:

**Tier 1 (MVP): Structured logging**
```typescript
// Already have console.log infrastructure
console.warn(JSON.stringify({
  event: 'questions_expired',
  count: result.rows.length,
  questionIds: result.rows.map(r => r.id),
  timestamp: new Date().toISOString()
}));
```
Render captures stdout/stderr in its log viewer with search. This is sufficient for a small volunteer team.

**Tier 2 (Post-MVP): Email via Render environment**
If email notifications become necessary, use a lightweight transactional email service. Options:
- **Resend** (`resend@4.x`): Modern, developer-friendly, free tier (100 emails/day). Single dependency.
- **Nodemailer** (`nodemailer@6.x`): Established, works with any SMTP provider. More setup.
- **SendGrid** (`@sendgrid/mail`): Enterprise-grade, free tier (100 emails/day).

**Recommendation:** Defer email to post-MVP. Structured logging with Render's log viewer is sufficient for the initial volunteer workflow. If email is needed later, use Resend for its simplicity.

**What NOT to build:**
- Push notifications to end users (no PWA service worker infrastructure exists)
- Slack/Discord webhooks (adds external service dependency for small team)
- Admin dashboard for expiration (scope creep -- logs are fine)

## Collection Picker UI

### No New Frontend Dependencies

The collection picker is a standard UI component. The existing frontend stack handles it:

| Need | Existing Tool |
|---|---|
| Dropdown/listbox component | `@headlessui/react@2.2.9` (Listbox, RadioGroup) |
| State management | `zustand@4.4.7` (add `selectedCollection` to game store) |
| Routing (collection in URL) | `react-router-dom@6.21.1` (query params or route params) |
| Animations | `framer-motion@12.34.0` (collection card transitions) |
| Accessibility | `@headlessui/react` handles ARIA, `eslint-plugin-jsx-a11y` validates |

**Implementation approach:**
- New `CollectionPicker` component using Headless UI `RadioGroup` or `Listbox`
- Fetch collections list from new `GET /api/game/collections` endpoint
- Pass `collectionId` (or `collectionSlug`) to `POST /api/game/session`
- Game route gains optional query param: `/game?collection=bloomington-in`
- Default to "Federal Civics" if no collection specified (backward compatible)

**No new packages needed on frontend.**

## Content Generation Script Enhancement

### Current State
`generateLearningContent.ts` generates federal civics content. It reads from `questions.json` and uses `@anthropic-ai/sdk` (already installed as devDependency at `^0.74.0`).

### Changes Needed (No New Dependencies)

The script needs enhancement, not replacement:

1. **Read from database instead of JSON file**: Replace `readFileSync` with `pg` query
2. **Add `--collection` flag**: Filter by collection slug
3. **Add `--locale` flag**: Pass locale context to Claude prompt for locale-specific content
4. **Locale-aware prompt template**: Include civic context (e.g., "Bloomington, IN city government")

```typescript
// New flags
// npx tsx src/scripts/generateLearningContent.ts --collection bloomington-in --limit 20
// npx tsx src/scripts/generateLearningContent.ts --collection los-angeles-ca --locale "Los Angeles, CA"
```

**Prompt enhancement for locale-specific generation:**
```typescript
function buildLocalePrompt(question: Question, locale: string): string {
  return `Generate educational content for this ${locale} civic trivia question.
Write for a general adult audience at an 8th-grade reading level.
Focus on ${locale}-specific civic knowledge...
// ... rest of existing prompt structure
`;
}
```

**Batch question generation (new script):**
A new companion script `generateCollectionQuestions.ts` will generate entire question batches for new locales:

```typescript
// npx tsx src/scripts/generateCollectionQuestions.ts --locale "Bloomington, IN" --count 60
```

This script:
- Generates questions (not just learning content) via Claude
- Outputs to a review JSON file (same pattern as existing generate/apply workflow)
- Volunteer reviews and edits the JSON
- `applyContent.ts` pattern extended to seed questions into database

**No new dependencies needed.** Uses existing `@anthropic-ai/sdk` and `pg`.

## Recommended Stack (Complete)

### New Runtime Dependencies

| Package | Version | Purpose | Why |
|---|---|---|---|
| `node-cron` | `^3.0.3` | Scheduled expiration checks | Lightweight cron for hourly expired-question sweep. Simpler than Render cron jobs for single-query tasks. |

### New Dev Dependencies

| Package | Version | Purpose | Why |
|---|---|---|---|
| `@types/node-cron` | `^3.0.11` | TypeScript types for node-cron | Type safety for cron schedule setup |

### Existing Dependencies (No Changes)

| Package | Already Installed | Used For |
|---|---|---|
| `pg` | `^8.11.3` | Questions in PostgreSQL (was users-only, now questions too) |
| `redis` | `^4.6.12` | Session storage, token blacklist (unchanged) |
| `@anthropic-ai/sdk` | `^0.74.0` (devDep) | Content generation scripts (enhanced, not replaced) |
| `express` | `^4.18.2` | API endpoints (new collection routes) |
| `express-validator` | `^7.3.1` | Input validation (new collection params) |
| `@headlessui/react` | `^2.2.9` | Collection picker UI component |
| `zustand` | `^4.4.7` | Selected collection state |
| `react-router-dom` | `^6.21.1` | Collection route params |

## What NOT to Add

### 1. Database ORM (Prisma, Drizzle, TypeORM)
**Reason:** Project uses raw `pg` queries throughout (`pool.query()`). Adding an ORM for 5-6 new tables introduces a second data access pattern, migration tooling, and learning curve. The team already has working patterns for raw SQL.
**Confidence:** HIGH (codebase verified)

### 2. Full-Text Search (pg_trgm, Elasticsearch)
**Reason:** Collections are browsed by list, not searched by text. With 5-20 collections, a simple `SELECT` is sufficient. If search is needed later, PostgreSQL's built-in `pg_trgm` extension (available on Supabase) can be added without new dependencies.
**Confidence:** HIGH

### 3. Database Migration Tool (Knex, node-pg-migrate, Flyway)
**Reason:** The project uses a single `schema.sql` file applied manually. For v1.2 (adding 3 tables), extending `schema.sql` with new `CREATE TABLE` statements matches the existing pattern. If the project grows beyond 10+ schema changes, revisit with `node-pg-migrate`.
**Confidence:** MEDIUM -- a migration tool would be better practice, but adding one is itself a scope item. For 3 new tables, manual SQL is pragmatic.

### 4. Separate Cron Service on Render
**Reason:** Render cron jobs are a separate billable service with cold start times. For a single hourly SQL query, in-process `node-cron` running inside the existing web service is simpler and free.
**Confidence:** HIGH (Render docs verified)

### 5. Redis for Question Caching
**Reason:** With ~500 questions across all collections and PostgreSQL on Supabase (low-latency managed service), query times will be <10ms. Redis caching adds cache invalidation complexity (expired questions, new questions) for no measurable benefit at this scale.
**Confidence:** HIGH

### 6. i18n Library (react-intl, i18next)
**Reason:** "Locale" in this project means geographic locale (Bloomington, IN vs Los Angeles, CA), NOT language translation. All content remains in English. The locale is a metadata field on collections, not a UI translation layer.
**Confidence:** HIGH (requirements verified)

### 7. Admin Dashboard Framework
**Reason:** v1.2 manages collections via scripts (CLI) and direct database operations. An admin UI is a separate feature milestone. Building one now is scope creep.
**Confidence:** HIGH

### 8. Webhook/Event System (EventEmitter, Bull, BullMQ)
**Reason:** The expiration check is a single cron job that runs a query and logs results. No event bus, job queue, or pub/sub needed. If notification requirements grow complex, Bull can be added later (it uses the existing Redis).
**Confidence:** HIGH

## Installation Commands

### Required
```bash
cd backend
npm install node-cron
npm install -D @types/node-cron
```

### Database Migration
```sql
-- Run against Supabase PostgreSQL (extend existing schema.sql)
-- See schema design section above for full SQL
```

### Not Needed
```bash
# DO NOT run these
npm install prisma              # No ORM needed
npm install knex                # No migration tool needed
npm install node-schedule       # node-cron is lighter
npm install resend              # Defer email to post-MVP
npm install i18next             # Not a language translation feature
npm install bullmq              # No job queue needed
```

## Integration Points with Existing Stack

### Backend: game.ts Route Changes

**Before (current):**
```typescript
const allQuestions: Question[] = JSON.parse(readFileSync(questionsPath, 'utf-8'));
```

**After (v1.2):**
```typescript
// Questions loaded from database per-request, filtered by collection
router.get('/questions', async (req, res) => {
  const collectionSlug = req.query.collection as string || 'federal';
  const questions = await getQuestionsByCollection(collectionSlug);
  // ... existing shuffle and select logic
});
```

### Backend: session creation

`POST /api/game/session` gains optional `collectionSlug` body parameter. If omitted, defaults to `'federal'` for backward compatibility.

### Frontend: gameService.ts

```typescript
export async function createGameSession(collectionSlug?: string): Promise<...> {
  const response = await apiRequest('/api/game/session', {
    method: 'POST',
    body: JSON.stringify({ collectionSlug }),
  });
  // ...
}
```

### Database: Shared pool

The existing `pool` from `config/database.ts` handles all queries. No new connection needed. The `civic_trivia` schema search path is already configured.

### Expiration Cron: Startup Integration

```typescript
// In server.ts, after startServer()
import { startExpirationCron } from './services/expirationService.js';
startExpirationCron(pool);
```

## Sources

### HIGH Confidence (Official Documentation, Verified Code)
- Existing codebase: `backend/package.json`, `backend/schema.sql`, `backend/src/routes/game.ts`, `backend/src/scripts/generateLearningContent.ts` -- verified by direct file reading
- [PostgreSQL JSON Types Documentation](https://www.postgresql.org/docs/current/datatype-json.html) -- official PostgreSQL docs
- [Render Cron Jobs Documentation](https://render.com/docs/cronjobs) -- official Render docs

### MEDIUM Confidence (Multiple Sources Agree)
- [node-cron npm](https://www.npmjs.com/package/node-cron) -- 3.0.3, ~2.5M weekly downloads
- [node-cron vs node-schedule comparison](https://npm-compare.com/cron,node-cron,node-schedule) -- adoption and feature comparison
- [BetterStack: Schedulers in Node.js](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) -- confirms node-cron as top choice for simple scheduling
- [When to Avoid JSONB in PostgreSQL (Heap)](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema) -- confirms relational tables for query-heavy dimensions like tags
- [PostgreSQL JSONB Best Practices (AWS)](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/) -- confirms hybrid JSONB + relational approach

### LOW Confidence (Informational)
- [Render Cron Job spinup improvements (Feb 2025)](https://render.com/changelog/significantly-reduced-median-spinup-time-for-cron-jobs) -- changelog, not critical to decision

---

**Next Steps for Roadmap:**

1. **Phase 1 (Database):** Create collections/questions/junction tables, seed from JSON, update game routes to query PostgreSQL
2. **Phase 2 (Collection Picker):** Frontend collection selection UI, API endpoint for listing collections
3. **Phase 3 (Expiration):** Add `node-cron`, implement expiration sweep, structured logging
4. **Phase 4 (Content Generation):** Enhance scripts for locale-aware generation, add batch question script

Phase 1 is the critical path -- everything depends on questions being in the database.

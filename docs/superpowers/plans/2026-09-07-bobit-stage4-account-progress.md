# Bobit Stage 4 — Per-Account Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move bobit progress off the browser and onto the account, so a player's crowd follows them across devices — while signed-out play keeps working exactly as it does today.

**Architecture:** The grant is recorded **server-side, on the existing answer submission**, which already knows both who is playing and whether the answer was right. The frontend gains a second `BobitProgressStore` driver that is **read-server, write-local**: it hydrates from one authenticated GET at match start, then mirrors grants in memory for the crowd's instant reaction. No new write endpoint, no optimistic-write reconciliation, no extra round trip per answer.

**Tech Stack:** TypeScript, React 19, Express, Drizzle, Postgres (shared Supabase `kxsdzaojfaibhuzmclfq`), Vitest.

**Stage 3 (shipped):** `docs/superpowers/plans/2026-09-05-bobit-stage3-collection.md`
**Spec:** `docs/superpowers/specs/2026-09-04-bobit-collection-design.md`

## Decisions taken (2026-09-07)

1. **CTC owns the migration.** The `trivia` schema's DDL has always lived in this repo's `supabase/migrations/` (all four existing files created and evolved it); ev-accounts has touched `trivia` once, incidentally. New `trivia` DDL goes here. `FROZEN.md` freezes `backend/` only — it does not freeze `supabase/`.
2. **No backfill.** Progress already sitting in browsers' `ctc.bobits.v1` is not migrated. Player count is small and the collection is cosmetic; everyone starts fresh on the account.
3. **Signed-out play keeps the local driver.** Two drivers, selected on auth state. This is not a replacement of Stage 3's storage, it is a second implementation of the same interface.

## Global Constraints

- **`backend/` in this repo is FROZEN** (ev-cto decision 0013, `backend/FROZEN.md`). Not one line of it may change. The standalone `civic-trivia-backend` Render service is retired — code committed there does not reach production.
- **The ev-accounts change must stay small.** Explicitly the user's preference: CTC is the right home for this work, and ev-accounts should take only what genuinely cannot live elsewhere. Budget: **four files, ~90 lines, one of them new.** Anything beyond that is a signal to stop and re-scope, not to keep going.
- **Gameplay never blocks on the crowd.** Stage 3's rule, unchanged. A failed hydrate degrades to an empty field; a failed grant costs one bobit, never the match. No `await` on the crowd anywhere in the answer path.
- **The grant must be server-authoritative.** The server already knows `wasCorrect`; the client must never be the source of truth for what has been earned. See "Rejected alternative" below for why this rules out the zero-ev-accounts design.
- **Stage 3's public behaviour does not change for signed-out players.** The local driver, its tests and its storage key stay exactly as they are.

---

## The gotcha this plan is built around

`session.collectionSlug` is **`null` for a Federal default session** (`ev-accounts/backend/src/trivia/services/sessionService.ts:153` — `collectionMeta?.slug ?? null`), but the frontend **defaults the same value to `'federal-civics'`** (`frontend/src/services/gameService.ts:52` — `response.collectionSlug ?? 'federal-civics'`).

Stage 3 never noticed because the frontend was the only party that stored anything. The moment both sides write progress keyed by slug, the same collection lands under two different keys and a Federal player's crowd silently splits in half — earned while signed in under one key, read back under the other.

**Every read and write of a progress key on both sides must coalesce `null` to `'federal-civics'`.** Task 2 puts that in one exported helper rather than at each call site, and Task 3's tests pin it.

---

## File Structure

| File | Repo | Responsibility |
|---|---|---|
| `supabase/migrations/20260907000001_add_bobit_progress.sql` | **CTC** | The table, its indexes and its RLS. |
| `frontend/src/features/collection/bobitProgress.ts` | **CTC** | Modify: add `createServerProgressStore()` + optional `hydrate` on the interface. |
| `frontend/src/features/collection/CollectionCrowd.tsx` | **CTC** | Modify: pick a driver on auth state; await hydrate before seeding. |
| `backend/src/trivia/db/schema.ts` | ev-accounts | Modify: Drizzle definition mirroring the table. |
| `backend/src/trivia/services/bobitProgressService.ts` | ev-accounts | **New.** Grant, revoke, read-by-user. The whole server-side surface. |
| `backend/src/trivia/routes/game.ts` | ev-accounts | Modify: fire-and-forget grant/revoke inside `POST /answer`. |
| `backend/src/trivia/routes/profile.ts` | ev-accounts | Modify: `GET /bobits`, the one new endpoint. |

**Migration filename.** CTC's convention is `YYYYMMDDNNNNNN_name.sql` with no sequence counter (unlike ev-accounts, which carries one and is at 342). The latest here is `20260302000001_add_collections_tier.sql`, so today's is **`20260907000001_add_bobit_progress.sql`**. Verify nothing newer landed before committing:

```bash
ls supabase/migrations | sort | tail -3
```

---

## Task 1: The table

**Files:**
- Create: `supabase/migrations/20260907000001_add_bobit_progress.sql`

Keyed by **slug text, not `collection_id`**. Three reasons: the frontend's store is already slug-keyed and its ids are external ids; `collection_id` is nullable-means-Federal on the session, which is exactly the ambiguity the gotcha above warns about; and `collections.slug` is `notNull().unique()`, so it is a legitimate FK target either way.

`question_external_id` is the client-visible question id — `questionService.ts:62` returns `id: row.externalId` deliberately, and `questions.external_id` is `notNull().unique()`.

- [ ] **Step 1: Write the migration**

```sql
-- See supabase/migrations/20260907000001_add_bobit_progress.sql for the applied version.
-- Two things verified against the live project before writing it:
--   * every trivia table has RLS enabled and the per-user ones carry THREE policies
--     (select/insert/delete), so mirror trivia.user_collection_mutes rather than
--     inventing a single-policy shape;
--   * ctc_app, ev_api and trivia_service all have BYPASSRLS, so policies never gate the
--     server -- but BYPASSRLS is not a table privilege and a new table does not inherit
--     its siblings' grants, so the GRANTs are load-bearing. Without them the server gets
--     a bare permission error that no policy change would explain.
CREATE TABLE IF NOT EXISTS trivia.bobit_progress (
  user_id              uuid        NOT NULL,
  collection_slug      text        NOT NULL,
  question_external_id text        NOT NULL,
  earned_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_external_id)
);

CREATE INDEX IF NOT EXISTS idx_bobit_progress_user_collection
  ON trivia.bobit_progress (user_id, collection_slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON trivia.bobit_progress
  TO ctc_app, ev_api, trivia_service, authenticated, service_role;

ALTER TABLE trivia.bobit_progress ENABLE ROW LEVEL SECURITY;

-- Three policies, mirroring trivia.user_collection_mutes.
CREATE POLICY users_select_own_bobits ON trivia.bobit_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY users_insert_own_bobits ON trivia.bobit_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_delete_own_bobits ON trivia.bobit_progress
  FOR DELETE USING (auth.uid() = user_id);
```

PK is `(user_id, question_external_id)` without the slug: a question belongs to exactly one collection, so including the slug would permit the same question under two collections and reintroduce the split-key bug at the schema level.

- [ ] **Step 2: Apply it**

Apply via the Supabase MCP (`apply_migration`) against `kxsdzaojfaibhuzmclfq`. Per CLAUDE.md, `seed.ts`/`activate-collection.ts` hang under `npx tsx`; MCP SQL is the working path for schema work in this project.

- [ ] **Step 3: Verify the table is real**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'trivia' AND table_name = 'bobit_progress'
ORDER BY ordinal_position;
```

Expected: the four columns above. Also confirm `relrowsecurity` is true for the table.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260907000001_add_bobit_progress.sql
git commit -m "feat(db): per-account bobit progress table"
```

---

## Task 2: The server-side service (ev-accounts)

**Files:**
- Create: `backend/src/trivia/services/bobitProgressService.ts`
- Modify: `backend/src/trivia/db/schema.ts`

**Interfaces:**
- Produces:
  - `progressKey(slug: string | null): string` — the coalescing helper the gotcha requires
  - `grantBobit(userId, slug, questionExternalId): Promise<void>`
  - `revokeBobit(userId, slug, questionExternalId): Promise<void>`
  - `readBobits(userId): Promise<Record<string, string[]>>` — slug → external ids

- [ ] **Step 1: Add the Drizzle table**

In `db/schema.ts`, beside `userCollectionMutes` (which is the composite-PK-on-uuid pattern to copy):

```ts
// Bobit progress — one row per question a player has a collection bobit for.
// Slug-keyed on purpose; see the Stage 4 plan's note on the null-slug Federal default.
export const bobitProgress = triviaSchema.table('bobit_progress', {
  userId: uuid('user_id').notNull(),
  collectionSlug: text('collection_slug').notNull(),
  questionExternalId: text('question_external_id').notNull(),
  earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.questionExternalId] }),
  userCollectionIdx: index('idx_bobit_progress_user_collection')
    .on(table.userId, table.collectionSlug),
}));
```

- [ ] **Step 2: Write the service**

```ts
// backend/src/trivia/services/bobitProgressService.ts

/**
 * Per-account bobit progress.
 *
 * Every function is safe to call fire-and-forget: the caller is the answer path, and a
 * player must never lose a match because their crowd could not be written.
 */

/** The Federal default session carries a null slug; the frontend calls it 'federal-civics'.
 *  Coalescing in one place is what stops a Federal player's crowd splitting across two keys. */
export const FEDERAL_SLUG = 'federal-civics';
export function progressKey(slug: string | null | undefined): string {
  return slug ?? FEDERAL_SLUG;
}
```

Then `grantBobit` (idempotent — `onConflictDoNothing`, so a re-answered question does not bump `earned_at` and re-order anything), `revokeBobit` (a plain delete; deleting a row that was never there is a no-op), and `readBobits` (one indexed select, grouped into `Record<slug, externalId[]>`).

- [ ] **Step 3: Typecheck**

Run ev-accounts' typecheck. Expected: clean.

- [ ] **Step 4: Commit** (on a branch in ev-accounts — it is currently on `feat/senate-gun-policy-pass`, so branch from its master first)

---

## Task 3: Grant on answer, and one read endpoint (ev-accounts)

**Files:**
- Modify: `backend/src/trivia/routes/game.ts`
- Modify: `backend/src/trivia/routes/profile.ts`

**Interfaces:**
- Produces: `GET /bobits` on the profile router → served at both `/ctc/api/profile/bobits` and `/api/trivia/profile/bobits` (`app.ts` mounts every router under both shapes).

- [ ] **Step 1: Record the grant inside `POST /answer`**

`routes/game.ts:245`. Everything needed is already in scope by the time `wasCorrect` is computed: `session.userId`, `session.collectionSlug`, `questionId`. Place this immediately after the existing `recordQuestionTelemetry` fire-and-forget call, and match its shape exactly:

```ts
    // Bobit progress. Fire-and-forget for the same reason the telemetry above is:
    // the crowd is cosmetic and must never delay or fail an answer. Anonymous
    // sessions keep their progress in the browser instead (Stage 4 decision 3).
    if (session.userId && session.userId !== 'anonymous') {
      const key = progressKey(session.collectionSlug);
      const write = wasCorrect
        ? grantBobit(session.userId, key, questionId)
        : revokeBobit(session.userId, key, questionId);
      write.catch(() => {});
    }
```

This is the whole write path. No new endpoint, and no extra request per answer.

- [ ] **Step 2: Add the read endpoint**

`routes/profile.ts` already has `router.use(requireAuth)` at line 11, so the handler can trust `req.userId`:

```ts
/** Every bobit this player has earned, grouped by collection slug. */
router.get('/bobits', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ bobits: await readBobits(req.userId!) });
  } catch {
    // An empty crowd is a correct degradation; a 500 here would be a worse answer.
    res.json({ bobits: {} });
  }
});
```

- [ ] **Step 3: Verify against a real session**

With the service running locally, create a session while authenticated, answer one question correctly, and confirm the row lands:

```sql
SELECT * FROM trivia.bobit_progress WHERE user_id = '<uuid>';
```

Then answer that same question wrong in a later session and confirm the row is gone. Also confirm an **anonymous** session writes nothing at all.

- [ ] **Step 4: Confirm the ev-accounts budget held**

```bash
git diff --stat
```

Expected: four files, ~90 lines. If it is materially more, stop and re-scope rather than continuing — keeping this small was an explicit constraint, not a preference.

- [ ] **Step 5: Commit and open a PR against ev-accounts' master**

---

## Task 4: The server driver (CTC frontend)

**Files:**
- Modify: `frontend/src/features/collection/bobitProgress.ts`
- Modify: `frontend/src/features/collection/__tests__/bobitProgress.test.ts`

**Interfaces:**
- Produces:
  - `BobitProgressStore` gains `hydrate?(slug: string): Promise<void>`
  - `createServerProgressStore(fetchBobits?): BobitProgressStore`

**Read-server, write-local.** `grant()` and `revoke()` only update the in-memory mirror — the server has already recorded the truth from the same answer submission that triggered them. This is what removes the entire class of optimistic-write reconciliation bugs: there is nothing to reconcile, because the client never writes.

- [ ] **Step 1: Write the failing tests**

Cover, with an injected fake fetcher (no network in tests):

- hydrate populates `load(slug)` for the hydrated collection
- `load()` is empty before hydrate, and never throws
- a rejected fetch leaves the store empty and does not throw — gameplay never blocks
- `grant()` shows up in `load()` immediately, with no fetch issued
- `revoke()` disappears from `load()` immediately, with no fetch issued
- hydrating a second collection does not discard the first
- re-hydrating replaces that collection's set rather than merging into it (the server is authoritative)
- `summary()` counts across hydrated collections
- the local driver still has no `hydrate` (so `store.hydrate?.()` is a no-op for signed-out play, and every Stage 3 test still passes untouched)

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && npm test -- bobitProgress`

- [ ] **Step 3: Implement**

Add `hydrate?` to the interface as optional, so `createLocalProgressStore` is untouched and Stage 3's twelve tests keep passing verbatim. `createServerProgressStore` takes its fetcher as an injectable parameter defaulting to a call through `apiRequest` — `services/api.ts:20` already attaches the `Bearer` token, so there is no auth plumbing to write.

- [ ] **Step 4: Run the tests**

Expected: the new tests pass, and all twelve Stage 3 tests still pass.

- [ ] **Step 5: Commit**

---

## Task 5: Pick a driver on auth state (CTC frontend)

**Files:**
- Modify: `frontend/src/features/collection/CollectionCrowd.tsx`

Stage 3 has a module-level `const store = createLocalProgressStore()` at `CollectionCrowd.tsx:24`. That becomes a choice.

- [ ] **Step 1: Select the driver**

Keyed on whether the player is signed in (`useAuthStore`, already the source `services/api.ts` reads for its Bearer token). Memoise per auth identity — a driver must not be rebuilt every render, and it **must** be rebuilt on sign-out so one account's crowd cannot leak into the next session's.

- [ ] **Step 2: Hydrate before seeding**

The seed effect becomes async-aware. Two things it must get right:

- **Ignore a stale resolve.** A hydrate that lands after the collection changed must not seed the wrong crowd — use a cancelled flag in the effect's cleanup.
- **Still seed on failure.** A rejected hydrate seeds an empty crowd rather than leaving the band in an indeterminate state.

- [ ] **Step 3: Typecheck and test**

Run: `cd frontend && npm run typecheck && npm test`
Expected: both clean.

- [ ] **Step 4: Verify signed-out play is untouched**

Play a match signed out. The crowd must behave exactly as it does in production today, with progress in `ctc.bobits.v1` and **no** request to `/profile/bobits`.

- [ ] **Step 5: Verify the account path end to end**

The Stage 3 verification harness is the model here — drive a real match with Playwright rather than trusting unit tests for a layout- and timing-sensitive feature:

- sign in, play a match, confirm rows in `trivia.bobit_progress`
- reload: the crowd returns from the server, not from `localStorage`
- **clear `localStorage` entirely** and reload: the crowd still returns. This is the whole point of the stage and the one check that proves it.
- sign out mid-session: the crowd falls back to the local driver without an error
- answer a previously-earned question wrong: the row is deleted and the loss sequence plays
- confirm a **Federal** match reads back the same crowd it wrote — the null-slug gotcha, verified rather than assumed

- [ ] **Step 6: Build, smoke, commit**

```bash
cd frontend && npm run build && npm start & npm run smoke
```

---

## Deploy order

Backend first, and it matters: the frontend's hydrate calls an endpoint that must already exist. In the other order, every signed-in player gets a 404 on `/profile/bobits`, which degrades to an empty crowd — not a crash, but it silently looks like everyone lost their bobits.

1. Merge and deploy the ev-accounts PR. Confirm `GET /ctc/api/profile/bobits` returns `{"bobits":{}}` for a fresh authenticated user in production.
2. Merge the CTC PR. Render auto-deploys `master`; the post-deploy smoke waits for the exact SHA before smoking.
3. Play one signed-in match in production and confirm a row lands.

---

## Rejected alternative: PostgREST direct from the browser

Worth recording, because it is the only design that touches ev-accounts **not at all** — which was the stated preference — and it was rejected on merit rather than effort.

The frontend already holds a real Supabase JWT and the anon key, and already calls Supabase's REST surface directly with plain `fetch` (`services/accountsApi.ts:65`). With `trivia` exposed to PostgREST and RLS policies for insert and delete, the browser could read and write `bobit_progress` itself. No endpoint, no service, no ev-accounts change, and no new dependency.

It was rejected because **it makes the client authoritative over what has been earned.** Two concrete consequences: a player could grant themselves an entire collection from devtools, and — worse for the mechanic — could simply never send the revoke, making the loss sequence purely decorative. The spec's whole premise is that a missing bobit means a specific question was missed. The server already computes `wasCorrect` on the answer it just scored; letting the browser assert it instead trades the mechanic's integrity for about 90 lines.

It would also strand difficulty gating again: selection runs server-side, so the server has to be able to read this table regardless. Once it reads, having it write is nearly free.

---

## Out of scope

- **Backfilling existing browser progress.** Decision 2: everyone starts fresh.
- **Difficulty gating.** This stage unblocks it — the server can now read what a player owns — but selection changes are their own piece of work.
- **Merging an anonymous crowd into an account on sign-in.** Follows from decision 2; revisit only if players ask.
- **Per-collection tallies on collection cards.** `summary()` still exists to serve it.
- **Cross-app bobits.** The table is CTC's; nothing here exposes it to other EV products.

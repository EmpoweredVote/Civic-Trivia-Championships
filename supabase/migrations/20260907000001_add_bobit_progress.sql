-- Per-account bobit progress. Stage 4 of the bobit collection design.
--
-- Keyed by collection SLUG rather than collection_id: the session carries collectionSlug,
-- a session's collection_id is null for the Federal default, and the frontend's own store
-- has been slug-keyed since Stage 3.
--
-- question_external_id is the client-visible question id (questionService returns
-- external_id AS id), not the serial PK.
--
-- PK deliberately omits the slug: a question belongs to exactly one collection, so including
-- it would permit the same question under two slugs and reintroduce the split-key bug at the
-- schema level.
CREATE TABLE IF NOT EXISTS trivia.bobit_progress (
  user_id              uuid        NOT NULL,
  collection_slug      text        NOT NULL,
  question_external_id text        NOT NULL,
  earned_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_external_id)
);

-- The only read this table serves: one player's crowd for one collection.
CREATE INDEX IF NOT EXISTS idx_bobit_progress_user_collection
  ON trivia.bobit_progress (user_id, collection_slug);

-- The service roles that reach trivia tables. All three carry BYPASSRLS, so the policies
-- below never gate them -- but BYPASSRLS is not a table privilege, and a new table does not
-- inherit its siblings' grants, so without these the server gets a bare permission error.
GRANT SELECT, INSERT, UPDATE, DELETE ON trivia.bobit_progress TO ctc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON trivia.bobit_progress TO ev_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON trivia.bobit_progress TO trivia_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON trivia.bobit_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trivia.bobit_progress TO service_role;

ALTER TABLE trivia.bobit_progress ENABLE ROW LEVEL SECURITY;

-- Mirrors trivia.user_collection_mutes, the closest sibling (per-user, per-collection,
-- select/insert/delete). A player can only ever see or touch their own crowd.
DROP POLICY IF EXISTS users_select_own_bobits ON trivia.bobit_progress;
CREATE POLICY users_select_own_bobits ON trivia.bobit_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS users_insert_own_bobits ON trivia.bobit_progress;
CREATE POLICY users_insert_own_bobits ON trivia.bobit_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS users_delete_own_bobits ON trivia.bobit_progress;
CREATE POLICY users_delete_own_bobits ON trivia.bobit_progress
  FOR DELETE USING (auth.uid() = user_id);

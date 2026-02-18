---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/add-timer-column.js.js
  - backend/update-local-schema.js.js
  - backend/generated-content-2026-02-18T07-42-24.json
  - backend/generated-content-2026-02-18T07-47-00.json
  - backend/generated-content-2026-02-18T07-48-10.json
  - backend/generated-content-2026-02-18T07-52-11.json
  - .gitignore
autonomous: true

must_haves:
  truths:
    - "No .js.js files exist in the repository (tracked or untracked)"
    - "No generated-content JSON files exist in backend/"
    - "Future generated-content JSON files are gitignored"
    - "Future .js.js files are gitignored"
  artifacts:
    - path: ".gitignore"
      provides: "Ignore rules for .js.js and generated-content files"
      contains: "generated-content-*.json"
  key_links: []
---

<objective>
Remove accidentally committed .js.js files from git history, delete untracked generated-content JSON files, and add .gitignore entries to prevent both from being tracked in the future.

Purpose: Clean up repository hygiene — remove test artifacts that should never have been committed.
Output: Clean working tree with protective .gitignore entries.
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove .js.js files from git and delete generated JSON files</name>
  <files>
    backend/add-timer-column.js.js
    backend/update-local-schema.js.js
    backend/generated-content-2026-02-18T07-42-24.json
    backend/generated-content-2026-02-18T07-47-00.json
    backend/generated-content-2026-02-18T07-48-10.json
    backend/generated-content-2026-02-18T07-52-11.json
  </files>
  <action>
    1. Run `git rm backend/add-timer-column.js.js backend/update-local-schema.js.js` to remove the .js.js files from git tracking AND delete them from disk.
    2. Run `rm backend/generated-content-2026-02-18T07-42-24.json backend/generated-content-2026-02-18T07-47-00.json backend/generated-content-2026-02-18T07-48-10.json backend/generated-content-2026-02-18T07-52-11.json` to delete the untracked generated JSON files.
    3. Verify no .js.js files remain: `git ls-files '*.js.js'` should return empty, and `find backend/ -name '*.js.js'` should return empty.
    4. Verify no generated-content JSON files remain: `ls backend/generated-content-*.json` should fail with "No such file".
  </action>
  <verify>
    `git ls-files '*.js.js'` returns empty.
    `ls backend/generated-content-*.json 2>&1` returns "No such file or directory".
    `git status` shows the two .js.js files as deleted (staged).
  </verify>
  <done>Both .js.js files removed from git index and disk. All four generated-content JSON files deleted from disk.</done>
</task>

<task type="auto">
  <name>Task 2: Add .gitignore entries to prevent future recurrence</name>
  <files>.gitignore</files>
  <action>
    Append the following two sections to the end of `.gitignore`:

    ```
    # Accidental double-extension files
    *.js.js

    # Generated content artifacts
    backend/generated-content-*.json
    ```

    These entries prevent:
    - Any `.js.js` double-extension files from being tracked (catches typos in any directory)
    - Any `generated-content-*.json` output files in backend/ from being tracked (from the content generation tooling)
  </action>
  <verify>
    `grep 'js.js' .gitignore` returns the entry.
    `grep 'generated-content' .gitignore` returns the entry.
    Create a dummy test: `touch backend/test.js.js && git status` should NOT show the file as untracked, then `rm backend/test.js.js`.
  </verify>
  <done>.gitignore has entries for *.js.js and backend/generated-content-*.json. Git ignores matching files.</done>
</task>

</tasks>

<verification>
- `git ls-files '*.js.js'` returns empty (no tracked .js.js files)
- `ls backend/generated-content-*.json 2>&1` returns error (no generated files exist)
- `git status` shows clean working tree after commit (except .planning/ files)
- `touch backend/foo.js.js && git check-ignore backend/foo.js.js && rm backend/foo.js.js` confirms gitignore works
</verification>

<success_criteria>
1. Zero .js.js files in the repository (tracked or on disk)
2. Zero generated-content JSON files in backend/
3. .gitignore prevents both patterns from future tracking
4. Changes committed to master
</success_criteria>

<output>
After completion, create `.planning/quick/001-clean-up-test-files/001-SUMMARY.md`
</output>

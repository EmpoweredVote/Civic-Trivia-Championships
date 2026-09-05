# ⛔ This backend is FROZEN — it is not the source of truth

**Production Civic Trivia requests are served by the `ev-accounts` platform engine, not by this
repo.** This `backend/` directory was folded into the engine (engine consolidation, Phase 1,
2026-09) and the standalone `civic-trivia-backend` Render service is retired (suspended
2026-09-04; deletion after a soak).

## Where the canonical backend lives

**`ev-accounts/backend/src/trivia/`** — a copy of these routers and services, mounted inside
`ev-accounts-api` at `https://api.empowered.vote/ctc/...` and `/api/trivia/...`. That copy is what
runs in production.

## What this means for you

- **Make backend changes in `ev-accounts/backend/src/trivia/`, not here.** A change committed to
  this repo's `backend/` does **not** reach production and creates silent drift between the two
  copies.
- This `backend/` directory is kept for history and reference only.
- **Still active in this repo — not frozen:** the **frontend** (`frontend/`, a live Render static
  site) and the **question-content / collection scripts**. Keep working on those here.

## Why a copy, and why frozen

The fold vendored the runtime code (there is no dependency link back to this repo), so the two
copies can drift without any alert. Freezing this backend is the chosen mitigation: a frozen file
cannot diverge. See **ev-cto decision 0013** (freeze folded backends; engine canonical) and
`HANDOFF-engine-consolidation-VQ-CTC.md`.

_Frozen 2026-09-04 per decision 0013._

# Quick Resume Guide for Claude

**Last Updated:** 2026-09-09
**For:** Handing off Civic Trivia Championship to another Claude instance

> Everything below was verified on 2026-09-09 against the live Supabase project and the
> Render API. Where a number appears, it came from a query, not from memory.

---

## TL;DR — where things stand

CTC is **live in production and has been since 2026-02-17**. The interesting part of a
handoff today is not "is it deployed" but **which repo owns which half of it**.

- **`frontend/` is live and owned here.** Render static site, auto-deploys from `master`.
- **`backend/` in this repo is FROZEN and serves nothing.** Read `backend/FROZEN.md`.
  Production CTC is served by the **`ev-accounts`** engine, which mounts a vendored copy of
  CTC's routers at `https://api.empowered.vote/ctc` and `/api/trivia`.
- **Question content and collection scripts are owned here** and are the most active work.

**Live URLs:**
- Frontend: https://ctc.empowered.vote (also https://civic-trivia-frontend.onrender.com)
- API: https://api.empowered.vote
- Leaderboard: /leaderboard — public, ranked by total XP

---

## The ownership rule (read before touching backend code)

Per **ev-cto decision 0013** (2026-09-05):

| Change | Goes where |
|---|---|
| UI, components, game screens | `frontend/` — **this repo** |
| Questions, collections, content scripts | `backend/src/scripts/`, DB — **this repo** |
| Routes, tables, migrations, services | **`ev-accounts/backend/src/trivia/`** |

A change committed to this repo's `backend/` **reaches nothing** and creates silent drift —
the fold vendored the runtime with no dependency link back, so the two copies can diverge with
no alert. Freezing is the mitigation.

Anything needing a new route, table, or migration **cannot be done in this repo at all**.
Features needing server persistence are two-repo changes; `docs/superpowers/` has a worked
example in the bobit stage 3 to stage 4 split.

---

## Infrastructure (verified 2026-09-09)

```
GitHub Org: EmpoweredVote
└── Repo: Civic-Trivia-Championships  (this repo, branch: master)
    ├── frontend/   React + Vite  -> Render Static Site  [LIVE, auto-deploys]
    └── backend/    Express + TS  -> FROZEN, deploys nowhere

Repo: ev-accounts
└── backend/src/trivia/  -> https://api.empowered.vote  [LIVE — serves CTC]

Shared services:
├── Supabase project kxsdzaojfaibhuzmclfq, schema `trivia`
└── Upstash Redis  stirred-pika-7510  (free tier, 500k commands/month)
```

**Suspended:** Render service `srv-d69ubnk9c44c738h8fh0` (`civic-trivia-backend`) —
`suspended`, `autoDeploy: no`. A push to `master` cannot deploy it.

**DB connection:** dedicated **`ctc_app`** role (non-rotating) via the **Session pooler**,
region **`us-west-1`**. Do NOT revert to the `postgres` user — it auto-rotates and caused
recurring outages until this was fixed 2026-06-03. `us-east-1` will fail.

**Auth:** Supabase migrated to **ES256** (2026-04-03). Verification is JWKS-based via
`createRemoteJWKSet` — not a static `JWT_SECRET`.

**Platform awards:** `awardPlatformXp()` and `awardPlatformGems()` POST to
`EMPOWERED_ACCOUNTS_API_URL/api/xp/award` and `/api/gems/award` with `TRIVIA_SERVICE_KEY` /
`TRIVIA_GEMS_KEY`. The old `connect.credit_gems` direct RPC is fully removed.

---

## Game structure (current)

- **5 questions**, not 8 and not 10. `TOTAL_QUESTIONS = 5`. Reduced 8 to 5 on 2026-06-17.
- Difficulty curve: Q1 easy; Q2–Q4 one each easy/medium/hard; Q5 hard/final.
- Q1–Q4 standard (100 base + up to 50 speed = 150 max each, so 0–600).
- **Q5 is the wager question** — no base or speed points, plus or minus the wager. Wager max is
  `floor(currentScore / 2)` at the time of Q5. Max reachable score is about 900.
- **XP:** 50 base + up to 150 variable on correct/total, so 50–200 XP.
- **Gems:** 2 for a perfect 5/5; 1 for finalScore >= 600 (`GEM_SCORE_THRESHOLD`); else 0.
  The frontend hardcodes this threshold separately in `WagerScreen.tsx` **and**
  `ResultsScreen.tsx` — both must match the backend.
- **Theming:** game components use `G` from `useGameTheme()`
  (`frontend/src/features/game/gameTheme.ts`); non-game components still use `C` from `useTheme()`.

---

## Content inventory (queried 2026-09-09)

| | Count |
|---|---|
| Collections total | 42 |
| Collections active | **41** — 25 city, 14 state, 1 federal, 1 international |
| Active questions | **3,825** (8,389 total rows) |
| Active questions in active collections | 3,734 |

**Known discrepancy:** **Climate Agreements** is `is_active = false` despite Phase 79-02 being
marked complete. It holds 91 active questions but is not playable. Unresolved — see STATE.md.

**Two content rules that bite:**
1. **NEVER derive a collection from an `external_id` prefix.** A prefix does not identify a
   collection and never has. Five collections use more than one prefix, and `ind` is used by
   **both Indiana and Indio CA**. Join through `trivia.collection_questions` instead.
2. **Any new question-insert path MUST call `placeAnswer()`.** Generator prompts anchor
   `correctAnswer` to index 0, so answer position is guarded at write time
   (`backend/src/services/questionQuality/answerPlacement.ts`, ported to ev-accounts).

Creating a collection: use the **`/create-collection <City, ST>`** skill — it researches,
writes, scaffolds, seeds and activates autonomously. Manual fallback steps are in CLAUDE.md.

---

## Common Commands

```bash
# Local dev
cd frontend && npm run dev
cd backend  && npm run dev      # reference only — this backend serves nothing

# Frontend smoke test — REQUIRED after any bundler/dep bump
cd frontend && npm run smoke
```

**Why the smoke test is not optional:** a Vite 8 bump produced a green build and a **blank
white page** in production (a CJS-only `react-canvas-confetti` triggered React error #130).
A green build is not a page load. Run the smoke test.

**Deploy:** push to `master`. Only `frontend/` changes ship. Deploys are gated on CI, and the
CI job names are **required by the master ruleset — never rename them.**

---

## What's next

**GSD phases:** v1.0–v2.4 (Phases 1–74) and v2.5 (Phases 75–79) are complete.
**Phase 80 (Admin Visibility) is pending, unplanned, and unexecutable in this repo** — it
targets admin views over `generation_jobs`, which is backend work. It needs replanning against
`ev-accounts` or dropping.

**Active work is running outside `.planning/`:**
- **Bobits** — an animated stick-figure meta-progression. Stages 1–4 are merged. Specs and
  plans are in `docs/superpowers/`, not `.planning/`. Crowd cap is **100 figures** (measured,
  not guessed). Standing product constraint: **bobits must never cover the question card or
  any of the four answer options.**
- **Content quality** — bank-wide answer-position and value-bracket remediation, 2026-09-08.
  19 commits currently unpushed on `master`.

---

## Team Context

**Chris (chris@empowered.vote):**
- Executive Director of Empowered.Vote
- Systems designer from the game industry, not a coder — wants clear step-by-step guidance
- Prefers being told the real state of things over reassurance

**Krishna Patel:** ongoing frontend tweaks via **fork PRs**. Review caveats: partial
extractions, test hacks, and PRs that may not pass `tsc`. Read before merging.

---

## Design Philosophy (Important!)

1. **Play, Not Study** — game show aesthetics, exciting pacing
2. **Learn Through Discovery** — questions reveal interesting facts
3. **Inclusive Competition** — anyone can play regardless of knowledge
4. **No Dark Patterns** — no daily streaks, loss aversion, or social pressure

**Tone:** "Not quite" instead of "Wrong". Teach, don't judge.

---

## Red Flags to Watch For

**Don't:**
- Commit backend changes to this repo expecting them to ship — they won't
- Put anything with a dependency on the platform health-check path (`/health/live`).
  Render polls it every 5–10s, about 500k times a month. A `KEYS session:*` on `/health` once
  ate the **entire** Upstash free tier in a month while real gameplay used under 2k commands.
- Regress `getSession` from `GETEX` to `get()` + `set()` — it doubles Redis cost per read
- Derive a collection from an `external_id` prefix (see above)
- Bump a bundler or dep without running `npm run smoke`
- Rename a CI job name — the master ruleset requires them
- Add dark patterns (streaks, pressure, guilt)

**Always:**
- Check which repo owns the change before writing it
- Verify counts against the DB rather than quoting a doc
- Keep Chris in the loop on anything outward-facing

---

## When in Doubt

| Question | Read |
|---|---|
| Infrastructure, deploy | `.planning/DEPLOYMENT.md`, CLAUDE.md |
| Current status | `.planning/STATE.md` |
| Feature priorities | `.planning/ROADMAP.md`, `REQUIREMENTS.md` |
| Design principles | `.planning/PROJECT.md` |
| Collection conventions | CLAUDE.md, `.planning/COLLECTION-PLAYBOOK.md` |
| Backend ownership | `backend/FROZEN.md`, ev-cto decision 0013 |
| Bobits | `docs/superpowers/specs/`, `docs/superpowers/plans/` |

**Most important:** Chris knows his volunteers and org context. When unclear, ask before
implementing.

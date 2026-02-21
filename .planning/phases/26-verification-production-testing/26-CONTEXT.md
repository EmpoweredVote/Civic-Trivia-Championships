# Phase 26: Verification & Production Testing - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify Fremont collection is production-ready and deploy it live. This includes running the seed script against production Supabase, deploying frontend/backend to Render, running automated verification against all 7 success criteria, and marking v1.4 milestone complete if everything passes. No new features or content — purely deployment and validation.

</domain>

<decisions>
## Implementation Decisions

### Verification method
- Automated scripts only — no manual playthroughs required
- Scripts run against the live production database (not local/dev)
- Create 3-5 test game sessions to verify question selection and scoring
- Test sessions cleaned up after verification passes — no test artifacts left in production

### Issue handling
- Fix issues in-phase — if verification catches bad questions, fix or deactivate them here
- Non-Fremont questions (federal/state-level) flagged for user review, not auto-deactivated
- If question count drops below 50 after fixes, phase fails — cannot ship below gameplay minimum
- Difficulty balance: just confirm all three levels represented, no strict ratio enforcement

### Production deployment
- Phase 26 runs seed-community.ts against production Supabase (Phase 25 prepared but didn't execute)
- Full deploy: push code to trigger Render auto-rebuild for both frontend (banner image) and backend
- Deploy method: git push to master triggers Render auto-deploy

### Sign-off process
- Verification output: both terminal pass/fail checklist AND markdown report saved to planning directory
- All 7 success criteria checked (question count, sessions, playability, locale-specificity, difficulty, expiration, admin panel)
- Run all checks and report everything at the end — don't fail fast
- If all 7 criteria pass, mark v1.4 milestone as complete (update STATE.md and ROADMAP.md)

### Claude's Discretion
- Verification script structure and implementation details
- Order of deployment steps (seed first vs deploy first)
- Exact test session parameters (which answers, scoring scenarios)
- Report format and level of detail

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-verification-production-testing*
*Context gathered: 2026-02-21*

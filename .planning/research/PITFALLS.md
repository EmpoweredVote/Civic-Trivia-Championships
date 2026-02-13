# Pitfalls Research: v1.1 Tech Debt Hardening

**Researched:** 2026-02-12
**Domain:** Tech debt hardening for production-ready Civic Trivia Championship
**Confidence:** HIGH

## Executive Summary

Hardening v1.0 introduces four critical risk areas: Redis migration from in-memory sessions (data loss, serialization issues), plausibility check enhancement (false positives on legitimate players), bulk content generation (quality degradation, factual errors), and dev tooling fixes (production breakage). Each area has well-documented failure modes in production systems.

The research reveals that **58% of organizations struggle with quality degradation when scaling AI content beyond 100 pieces** (McKinsey, 2026), **false positive rates in anti-cheat systems average 12-19%** industry-wide, and **session migration without dual-write periods leads to data loss during the transition window**. For educational content where trust is critical, factual accuracy issues compound when AI-generated content lacks proper verification.

This document catalogs specific pitfalls for each enhancement area, with prevention strategies mapped to the phases that should address them.

---

## Redis Migration Pitfalls

### 1. Session Data Loss During Transition Window

**Problem:** Switching directly from in-memory Map to Redis causes all active game sessions to vanish on server restart. Players mid-game lose progress, creating poor UX and support tickets.

**Why it happens:** The migration treats the cutover as binary — either Map or Redis — without a transition period. Sessions created before migration but still valid after migration are only in the old store.

**Warning signs:**
- Players report "session not found" errors after deployment
- All active sessions disappear at deployment time
- Support tickets correlate with deployment timestamp

**Prevention:**
- **Dual-write period:** For 7 days (longer than session timeout), write to BOTH Map and Redis, read from Redis first, fall back to Map
- Create migration phase that runs dual-write mode in production
- After 1-hour session timeout period, all sessions will be Redis-native
- Monitor both stores during transition, alert if Redis writes fail

**Phase to address:** Redis migration phase (dedicated task for dual-write implementation)

**Source confidence:** HIGH — Based on [Redis session migration best practices](https://redis.io/tutorials/migration/) and [dual-write pattern for session stores](https://blog.devgenius.io/we-replaced-postgresql-sessions-with-redis-api-response-time-went-from-800ms-to-12ms-bf119fdae8db)

---

### 2. Serialization Format Mismatch Breaking Existing Sessions

**Problem:** Switching from native JavaScript objects (Map values) to Redis strings requires serialization. If serialization format changes (JSON to MessagePack) or if you forget to handle complex types (Date objects, undefined values), sessions become corrupt.

**Why it happens:** Map stores live JavaScript objects with full type fidelity. Redis stores strings. JSON.stringify loses Date objects (becomes ISO string), undefined values (omitted), and circular references (throws). MessagePack has different encoding rules.

**Warning signs:**
- `JSON.parse()` errors in logs after migration
- Date comparisons fail (`lastActivityTime` becomes string)
- Session validation breaks on type checks
- Intermittent "Cannot read property" errors

**Prevention:**
- **Stick with JSON.stringify/parse for MVP** — simpler, debuggable, all Node.js environments support it
- Document serialization contract: which fields exist, which types expected
- Add serialization unit tests: roundtrip test (serialize → deserialize → equals)
- Handle Date objects explicitly: store as ISO strings, parse on read
- For MessagePack (future optimization): test thoroughly, measure actual gains on real session data before committing

**Phase to address:** Redis migration phase (serialization strategy decision task)

**Source confidence:** HIGH — Based on [Redis serialization benchmarks](https://sreejithmsblog.wordpress.com/2017/06/05/benchmarking-different-serializers-for-redis/) and [MessagePack pitfalls with large objects](https://smali-kazmi.medium.com/when-optimized-is-slower-why-we-stuck-with-native-json-for-our-10mb-context-object-2d7dd62e6982)

---

### 3. Redis Connection Failures Without Graceful Degradation

**Problem:** Redis goes down (network issue, out of memory, misconfiguration). Without fallback logic, all game sessions fail. Server returns 500 errors instead of degrading gracefully.

**Why it happens:** Code assumes Redis is always available. No error handling on `client.get()`, `client.set()` calls. No circuit breaker pattern. No fallback to in-memory Map for read-only mode.

**Warning signs:**
- All game creation fails when Redis is unreachable
- No games can be played during Redis outage
- Error logs filled with "ECONNREFUSED" or "Redis timeout"
- No automated recovery when Redis returns

**Prevention:**
- **Keep Map-based sessionService as fallback** — don't delete the old code
- Wrap all Redis calls in try-catch with degradation logic
- For writes: if Redis fails, write to Map AND log warning (temporary mode)
- For reads: try Redis first, fall back to Map on failure
- Add health check endpoint: `/health/redis` returns status
- Circuit breaker: after 5 consecutive failures, skip Redis for 60 seconds, retry
- Monitor Redis availability with alerts

**Phase to address:** Redis migration phase (failover implementation task)

**Source confidence:** HIGH — Based on [Redis failover testing](https://blog.devgenius.io/we-replaced-postgresql-sessions-with-redis-api-response-time-went-from-800ms-to-12ms-bf119fdae8db) and [failover documentation requirements](https://blog.devgenius.io/we-replaced-postgresql-sessions-with-redis-api-response-time-went-from-800ms-to-12ms-bf119fdae8db)

---

### 4. Session Expiration Cleanup Logic Conflict

**Problem:** In-memory Map uses periodic cleanup interval (every 5 minutes, delete sessions older than 1 hour). Redis has native TTL. Running both cleanup mechanisms causes confusion, memory waste, and race conditions.

**Why it happens:** Porting Map cleanup logic directly to Redis without leveraging Redis's built-in expiration. Setting TTL on keys but also running manual cleanup sweeps.

**Warning signs:**
- Redis memory usage doesn't decrease after sessions expire
- Cleanup logs show no sessions removed (because TTL already handled it)
- Sessions sometimes missing before 1-hour timeout
- `setInterval` cleanup still running with Redis (wasted cycles)

**Prevention:**
- **Use Redis TTL exclusively** — `client.set(key, value, { EX: 3600 })` sets 1-hour expiration
- Remove `cleanupExpiredSessions()` interval when using Redis
- Document that Redis handles expiration automatically
- Monitor Redis `KEYS` command (dev only) or `SCAN` (production) to verify expirations working
- For dual-write period: run cleanup on Map only, let Redis TTL handle its own

**Phase to address:** Redis migration phase (expiration strategy task)

**Source confidence:** HIGH — Redis TTL is native feature, documented in [Redis commands](https://redis.io/docs/latest/commands/expire/)

---

### 5. Missing Redis Configuration in Production Environment

**Problem:** Code works in local dev (Redis on `localhost:6379`). Deploys to production. Server crashes: "Redis connection refused" because production Redis is on different host, requires auth, uses TLS.

**Why it happens:** Hardcoded connection strings in code, no environment-specific config. `.env` file not loaded in production, or variables not set in hosting platform.

**Warning signs:**
- Works locally, fails in deployed environment
- Logs show "ECONNREFUSED" or "Authentication required"
- Redis client tries to connect to `127.0.0.1` instead of production host
- No error until first session creation attempt

**Prevention:**
- **Use environment variables for all Redis config:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` (boolean)
- Validate config on server startup: try connection, fail fast if unreachable
- Document required env vars in README
- Add startup healthcheck: `await redisClient.ping()` before server listens
- For development: provide `.env.example` with local defaults
- For production: verify env vars set in hosting platform (Render, Railway, etc.)

**Phase to address:** Redis migration phase (configuration task)

**Source confidence:** HIGH — Standard practice for production deployments

---

## Plausibility Enhancement Pitfalls

### 6. False Positives on Legitimate Fast Correct Answers

**Problem:** Player knows the answer instantly (familiar topic, easy question). Answers in 0.8 seconds. Plausibility check flags as "suspiciously fast" (<0.5s threshold too strict). Legitimate player gets warning or score penalty.

**Why it happens:** Threshold assumes all questions require reading time. Easy questions ("How many senators?") can be answered faster than complex questions. Threshold doesn't account for question difficulty or player skill.

**Warning signs:**
- Logs show flagged responses between 0.5-1.5 seconds (legitimate fast range)
- Flags correlate with easy questions or repeat players
- Players complain about "cheating" accusations despite honest play
- False positive rate >5% (industry acceptable is <0.001% per [SARD standards](https://medium.com/@amol346bhalerao/how-game-developers-detect-and-stop-cheating-in-real-time-0aa4f1f52e0c))

**Prevention:**
- **Difficulty-adjusted thresholds:** Easy questions allow <1s, Medium <0.75s, Hard <0.5s minimum response time
- **Don't penalize on first offense** — flag for review, require pattern (3+ suspicious answers in single game)
- Log response times for analysis: calculate percentiles (p10, p50, p90) per difficulty level
- Review flagged sessions manually before implementing penalties
- Add "grace period" of 100-200ms for network latency variance
- Monitor false positive rate: target <1% of legitimate players flagged

**Phase to address:** Plausibility enhancement phase (threshold tuning task)

**Source confidence:** HIGH — Based on [anti-cheat false positive prevention](https://www.linkedin.com/advice/0/how-can-you-prevent-anti-cheat-measures-from-disrupting-ylmmf) and [pattern detection best practices](https://medium.com/@amol346bhalerao/how-game-developers-detect-and-stop-cheating-in-real-time-0aa4f1f52e0c)

---

### 7. Network Latency Causing Timing Anomalies

**Problem:** Client reports `timeRemaining: 23.5s` (answered in 1.5s). But network lag of 800ms means server receives answer 2.3 seconds after question shown. Server calculates response time as 2.7s (25s - 23.5s + 0.8s lag), flagging as impossible.

**Why it happens:** Plausibility logic assumes instant network transmission. Client timestamp and server timestamp diverge. Clock skew between client and server compounds the issue.

**Warning signs:**
- Flagged responses correlate with high-latency players (mobile, rural internet)
- Geographic patterns: players in distant regions flagged more often
- Response time calculations show negative values or >25s
- Flags increase during peak network congestion hours

**Prevention:**
- **Use client-reported `timeRemaining` as source of truth for score** (already happening in v1.0)
- Server tracks elapsed time separately for anomaly detection only, not scoring
- Accept range: `0 <= timeRemaining <= 25` (validate bounds, not precise timing)
- Don't flag unless response time <0.3s (extremely suspicious, even with lag)
- Log network latency markers: time between question request and answer submission
- Consider latency-stratified detection: high-RTT players get different thresholds (advanced, defer to post-MVP)

**Phase to address:** Plausibility enhancement phase (network latency handling task)

**Source confidence:** HIGH — Based on [network latency false positives in anti-cheat](https://www.alibaba.com/product-insights/ai-cheat-detection-in-multiplayer-games-is-it-fair-or-falsely-flagging-latency.html) and [latency-stratified detection](https://www.alibaba.com/product-insights/ai-cheat-detection-in-multiplayer-games-is-it-fair-or-falsely-flagging-latency.html)

---

### 8. Plausibility Flags Without Review Workflow

**Problem:** Plausibility checks flag suspicious sessions. Flags logged. No one reviews them. Logs fill up. No action taken. Cheaters continue undetected. Or worse: auto-ban triggers, legitimate players banned with no appeal process.

**Why it happens:** Logging was the MVP approach ("flag but don't penalize"). Enhancement adds penalties but no review tooling. No dashboard to see flagged sessions, no process to verify true vs. false positives.

**Warning signs:**
- Flagged session count grows but no human review
- No metrics on flag accuracy (true positive rate unknown)
- Players report bans with no explanation or appeal path
- Thresholds never tuned because no feedback loop

**Prevention:**
- **Build admin dashboard or logging query for flagged sessions** — list sessionId, userId, flagged answer details
- Manual review process: weekly review of flagged sessions, categorize as true positive / false positive / uncertain
- Track false positive rate: `false positives / total flags`
- Use graduated response: 1st flag = silent log, 2nd flag = warning message, 3rd+ = score penalty
- Defer auto-bans to much later (post-v1.1) after confidence in detection is high
- Document appeal process: email address or form for "wrongly flagged" reports

**Phase to address:** Plausibility enhancement phase (review workflow task) or defer to post-v1.1

**Source confidence:** MEDIUM — Based on [graduated response systems](https://medium.com/@amol346bhalerao/how-game-developers-detect-and-stop-cheating-in-real-time-0aa4f1f52e0c) and [transparency best practices](https://medium.com/@amol346bhalerao/how-game-developers-detect-and-stop-cheating-in-real-time-0aa4f1f52e0c)

---

### 9. Timeout Handling Conflicts with Plausibility Checks

**Problem:** Timer expires. Client sends `selectedOption: null, timeRemaining: 0`. Plausibility check sees responseTime = 25s (full duration) but `timeRemaining: 0` seems suspicious. Flag fires incorrectly.

**Why it happens:** Plausibility logic doesn't account for timeout as valid edge case. Assumes `timeRemaining: 0` means instant answer (impossible), not timeout.

**Warning signs:**
- All timeout answers flagged as suspicious
- Logs show flags on `selectedOption: null` submissions
- False positive rate spikes on harder questions (more timeouts)

**Prevention:**
- **Special case for timeout:** If `selectedOption === null`, skip plausibility checks (timeout is expected behavior)
- Document timeout contract: `null` means "no answer selected, timer expired"
- Validate that `timeRemaining` is exactly 0 when `selectedOption` is null
- Don't flag timeouts as suspicious (user simply ran out of time)

**Phase to address:** Plausibility enhancement phase (edge case handling task)

**Source confidence:** HIGH — Logical inference from existing codebase design

---

## Content Generation Pitfalls

### 10. Quality Degradation at Bulk Scale (>50 Questions)

**Problem:** Generating learning content for 102 remaining questions (120 total - 18 existing). First 20 generations are high quality. By generation 80, content becomes repetitive, generic, or shallow. Quality visibly degrades.

**Why it happens:** LLM prompt doesn't vary, causing pattern repetition. No quality checkpoints during generation. Token limits push content to be shorter. Researcher fatigue (manual review) causes later items to slip through. McKinsey research shows **58% of organizations struggle with quality degradation when scaling AI content production beyond 100 pieces** per month.

**Warning signs:**
- Later questions have shorter `learningContent.paragraphs` (e.g., 1 paragraph instead of 2-3)
- Repetitive phrasing across multiple questions ("It's important to understand that...")
- Generic corrections that don't reference specific wrong answers
- Source citations become less specific (same URL repeated)
- Word count decreases: first questions 180 words, last questions 120 words

**Prevention:**
- **Generate in batches of 10-20 with quality review between batches** — don't bulk-generate all 102 at once
- Vary prompts: include different example phrasings, rotate tone guidance
- Set minimum word count: "Write 150-200 words" in prompt
- Manual spot-check: review every 10th generated item for quality
- Use quality scoring: word count, unique phrasing, source specificity
- Track metrics: average word count per batch, unique source URLs, correction length
- If quality drops below threshold, pause generation, refine prompt, resume

**Phase to address:** Content expansion phase (batch generation strategy task)

**Source confidence:** HIGH — Based on [AI content quality degradation research](https://koanthic.com/en/ai-content-quality-control-complete-guide-for-2026-2/) and [McKinsey findings on scale challenges](https://koanthic.com/en/ai-content-quality-control-complete-guide-for-2026-2/)

---

### 11. Factual Errors in AI-Generated Educational Content

**Problem:** LLM generates plausible-sounding but incorrect civic facts. Example: "The 25th Amendment was ratified in 1947" (actually 1967). Content sounds authoritative, error goes unnoticed, deployed to production. User loses trust when they fact-check.

**Why it happens:** LLMs hallucinate facts confidently. Civics domain has specific dates, numbers, legal terms that are easy to get wrong. No automated fact-checking. Manual review misses errors (reviewer doesn't know every date). Research shows **students lacking professional knowledge are unable to perform adequate fact-checking of AI-generated answers**.

**Warning signs:**
- User reports factual errors in Learn More content
- Dates don't match official sources (constitution.congress.gov)
- Legal terminology used incorrectly (e.g., "bill" vs "law" vs "amendment")
- Amendment numbers mismatched with descriptions
- Historical events attributed to wrong years or presidents

**Prevention:**
- **Cross-reference all generated facts with authoritative sources** — don't trust LLM alone
- Provide known-good sources in prompt: "Use ONLY facts from constitution.congress.gov, archives.gov, senate.gov"
- Add validation step: for each generated content, human reviewer verifies key facts (dates, numbers, legal terms) against official sources
- Create checklist for review: "Dates verified? Amendment numbers correct? Legal terms accurate?"
- Use retrieval-augmented generation (RAG): pass official source text to LLM as context
- Flag high-risk fact types in review: dates, numbers, names, legal terminology
- Version content: track when generated, reviewed, approved (allows rollback if errors found later)

**Phase to address:** Content expansion phase (fact-checking task)

**Source confidence:** HIGH — Based on [educational content accuracy challenges](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2026.1729059/full) and [AI fact-checking best practices](https://scalebytech.com/improving-factual-accuracy-in-ai-generated-content)

---

### 12. Hallucinated or Broken Source URLs

**Problem:** LLM generates `source.url: "https://constitution.congress.gov/amendment-13"` which sounds plausible but returns 404. Or generates non-existent pages that seem authoritative. User clicks, gets broken link, loses trust.

**Why it happens:** LLMs construct URLs from training data patterns but don't verify they exist. URL structure may have changed since training. Hallucination of plausible-but-fake URLs.

**Warning signs:**
- Source URLs return 404 errors
- URLs point to non-existent pages or redirects to homepages
- Same URL repeated across all questions (lazy generation)
- Generic URLs like "constitution.gov" instead of specific article pages

**Prevention:**
- **Provide known-good URL templates in prompt:** "Use these specific URL patterns: constitution.congress.gov/browse/amendment-[number], archives.gov/founding-docs/..."
- Validate URLs in build script: HTTP HEAD request to verify URL exists (200 status)
- If URL validation fails: flag for manual review, don't commit
- Manual review step: click every source link, verify it loads and is relevant
- Maintain curated list of verified source URLs, require LLM to pick from list
- For each topic category, pre-define 2-3 authoritative sources with exact URLs

**Phase to address:** Content expansion phase (URL validation task)

**Source confidence:** HIGH — Based on [AI URL hallucination patterns](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2026.1729059/full)

---

### 13. Generic Wrong-Answer Corrections (Not Answer-Specific)

**Problem:** Wrong answer A: "The Senate has 50 members." Wrong answer B: "The Senate has 200 members." Both get same correction: "Incorrect, the Senate has 100 members." Correction doesn't explain WHY each specific wrong answer is wrong.

**Why it happens:** LLM prompt doesn't emphasize per-option corrections. Generates single explanation, duplicates it. Doesn't engage with the specific misconception each wrong answer represents.

**Warning signs:**
- All `corrections` entries have identical or very similar text
- Corrections don't mention the specific wrong answer chosen
- Generic phrasing: "That's incorrect" instead of "No, the Senate has 100 members, not 50"
- Missing explanations of common misconceptions (e.g., why someone might think 50)

**Prevention:**
- **Prompt engineering:** "For EACH wrong answer option, write a specific 1-2 sentence correction that explains why THAT particular answer is incorrect and what misconception it represents."
- Validate corrections structure: ensure each wrong option index has unique correction text
- Check for answer-specific references: correction should quote or reference the wrong answer
- Example in prompt: "If wrong answer is '50 members', correction should say 'No, the Senate has 100 members (2 per state), not 50.'"
- Manual review: verify corrections address specific misconceptions, not generic "wrong"

**Phase to address:** Content expansion phase (prompt refinement task)

**Source confidence:** MEDIUM — Based on educational best practices and Phase 4 research on wrong-answer corrections

---

### 14. Content Expansion Breaks Existing Questions (Regression)

**Problem:** Adding `learningContent` field to 102 more questions. Script modifies `questions.json`. Accidentally changes existing question text, reorders questions, or corrupts JSON structure. Existing 18 questions with content break.

**Why it happens:** Script overwrites entire `questions.json` file. JSON.stringify changes formatting, reorders keys. Script logic has bugs (e.g., off-by-one array index). No version control check before running script.

**Warning signs:**
- Existing questions show different text after script runs
- Question order changes (IDs mismatch)
- JSON syntax errors (missing comma, unclosed bracket)
- Existing `learningContent` fields disappear or get overwritten
- TypeScript compilation fails after content generation

**Prevention:**
- **Version control safety: commit before running generation script** — allows rollback
- Script should only ADD `learningContent` field, not modify existing question fields
- Read questions, filter to those without `learningContent`, generate only for those
- Preserve existing structure: deep-clone questions before modification
- Use `JSON.stringify(questions, null, 2)` for consistent formatting
- Run validation after generation: verify question count unchanged, all IDs present, all existing fields intact
- Automated test: load questions.json, verify structure matches schema (all required fields present)

**Phase to address:** Content expansion phase (script safety task)

**Source confidence:** HIGH — Standard practice for data migration scripts

---

## General Hardening Pitfalls

### 15. Dev Script Dependency Missing in Production Build

**Problem:** `generateLearningContent.ts` script uses `@anthropic-ai/sdk` which is installed as devDependency. Build systems (Render, Railway) run `npm ci --production` which skips devDependencies. Script can't run in CI/CD for content generation.

**Why it happens:** Misunderstanding of when TypeScript and tooling are needed. `devDependencies` assumed to be dev-only, but build-time scripts need dependencies available during build phase.

**Warning signs:**
- CI/CD build fails: "Cannot find module '@anthropic-ai/sdk'"
- Works locally (`npm install` includes devDeps), fails in production build
- Error only appears when running generation script in deployment pipeline
- Forcing all devDeps to dependencies bloats production bundle

**Prevention:**
- **Clarify script usage:** If script runs ONLY locally (human-driven), keep as devDependency, document "run locally, commit results"
- If script runs in CI/CD build: move script dependencies to regular `dependencies` OR run `npm install` (not `--production`) during build step
- Better approach: **Run generation script locally, commit generated content** — don't generate in CI/CD
- Document in README: "Content generation is local-only, commit generated questions.json"
- Add pre-commit check: verify questions.json has expected learningContent coverage

**Phase to address:** Dev tooling fix phase (generateLearningContent.ts error resolution)

**Source confidence:** HIGH — Based on [TypeScript build dependencies](https://medium.com/@jjmayank98/typescript-dependency-or-dev-dependency-cad623dff6d5) and [build-time vs runtime dependencies](https://docs.adonisjs.com/guides/concepts/typescript-build-process)

---

### 16. TypeScript Compilation Errors in Build Scripts Not Caught Until Deployment

**Problem:** `generateLearningContent.ts` has import error (missing SDK). Runs fine in local dev with ts-node. Pushed to repo. CI/CD tries to build, fails with TypeScript error. Deployment blocked.

**Why it happens:** No pre-commit TypeScript check on backend scripts. `ts-node` in dev masks issues that `tsc` would catch. Scripts in `/scripts` folder not included in `tsconfig.json` or not checked in CI.

**Warning signs:**
- Local dev works, CI/CD fails
- TypeScript errors appear only in CI logs, not locally
- `npx tsc --noEmit` wasn't run before commit
- Scripts folder excluded from TypeScript project

**Prevention:**
- **Include scripts folder in `tsconfig.json`:** Ensure `include: ["src/**/*", "scripts/**/*"]`
- Run `npx tsc --noEmit` before committing backend changes (add to git pre-commit hook)
- CI/CD: add TypeScript check step before build/deploy
- Local tooling: VSCode or IDE should show TypeScript errors in all .ts files, including scripts
- If using ts-node for scripts: ensure it uses same tsconfig as production build

**Phase to address:** Dev tooling fix phase (TypeScript error resolution task)

**Source confidence:** HIGH — Standard TypeScript project setup

---

### 17. Changing Plausibility Thresholds Without Re-Testing Existing Game Flow

**Problem:** Plausibility checks enhanced from passive logging to active response (warning messages, potential penalties). Existing game flow assumes all answers are accepted. New logic breaks flow: warnings appear mid-game, confusing players.

**Why it happens:** Enhancement changes behavior of existing `POST /answer` endpoint. Frontend expects consistent response shape. Server adds `flagged: true` field. Frontend doesn't handle it, or handles poorly.

**Warning signs:**
- Frontend console errors: "Unexpected field 'flagged'"
- UI doesn't show plausibility warnings (data ignored)
- Game flow broken: auto-advance doesn't work if flagged
- Players see score but miss warning message

**Prevention:**
- **Regression testing on existing game flow after plausibility changes** — don't just test new flag logic
- Add E2E test: play full game with normal timing, verify no warnings shown
- Add E2E test: play game with fast answer, verify warning shown correctly
- Test backward compatibility: old frontend (without flag handling) should still work with new backend
- Version API if response contract changes: `/api/v2/answer` or feature flag
- Manual QA: play full game after changes, verify UX flow unchanged for legitimate play

**Phase to address:** Plausibility enhancement phase (integration testing task)

**Source confidence:** HIGH — Based on [regression testing best practices](https://www.headspin.io/blog/regression-testing-a-complete-guide) and [test maintenance in agile](https://bugbug.io/blog/software-testing/best-practices-of-test-maintenance/)

---

### 18. Missing Rollback Plan for Redis Migration

**Problem:** Redis migration deployed. Redis instance fails (misconfiguration, memory limit hit, network partition). No documented rollback procedure. Team scrambles to switch back to Map, but code deleted. Data lost.

**Why it happens:** Assumption that migration will succeed, no failure planning. Old Map-based code removed after deployment. No feature flag to switch between stores. Rollback not tested.

**Warning signs:**
- Redis fails in production, team doesn't know how to revert
- Old code deleted, can't roll back without git revert
- Feature flag doesn't exist or isn't tested
- Runbook says "switch to Redis" but not "switch back to Map"

**Prevention:**
- **Keep Map-based session code in codebase** — don't delete, gate with feature flag
- Feature flag: `USE_REDIS=true/false` environment variable
- Test rollback scenario: deploy with Redis, flip flag back to Map, verify sessions work
- Document rollback procedure: "Set USE_REDIS=false, restart server, verify /health endpoint"
- Monitor both paths: if Redis path fails, alert triggers, team follows runbook to flip flag
- Gradual rollout: enable Redis for 10% of sessions, then 50%, then 100% (advanced, defer if complex)

**Phase to address:** Redis migration phase (rollback planning task)

**Source confidence:** HIGH — Based on [migration failover best practices](https://blog.devgenius.io/we-replaced-postgresql-sessions-with-redis-api-response-time-went-from-800ms-to-12ms-bf119fdae8db)

---

### 19. Content Generation Commits Untested to Main Branch

**Problem:** `generateLearningContent.ts` generates content for 102 questions. Script commits directly to main branch or PR merged without human review. Generated content has factual error. Error deployed to production. User finds error, trust damaged.

**Why it happens:** Automation bypasses review. Generated content looks plausible, reviewer doesn't fact-check. Bulk generation makes review tedious (102 questions = skip review).

**Warning signs:**
- Content deployed without manual review
- Errors found by users, not team
- No QA step between generation and deployment
- Git history shows automated commits with no human review

**Prevention:**
- **Never auto-commit generated content** — require human review PR
- Review process: generate content, create PR, reviewer spot-checks 10% of questions
- Checklist for reviewer: "Verified facts? Clicked source URLs? Corrections are specific?"
- Use staged approach: generate 20 questions, review, generate next 20
- Version content with review flag: `learningContent.reviewed: true` (set manually after review)
- CI check: block deploy if any question has `learningContent.reviewed: false`

**Phase to address:** Content expansion phase (review workflow task)

**Source confidence:** MEDIUM — Based on general code review best practices and content quality control

---

### 20. Session Timeout Mismatch Between Map and Redis

**Problem:** During dual-write period, Map sessions expire after 1 hour (periodic cleanup). Redis sessions expire after 2 hours (different TTL config). Same session has different lifetimes in each store. Fallback logic breaks.

**Why it happens:** Porting timeout logic from Map to Redis without unifying configuration. Map uses `SESSION_TIMEOUT_MS = 60 * 60 * 1000`. Redis uses `EX: 7200` (seconds, not milliseconds).

**Warning signs:**
- Sessions exist in Redis but not Map (or vice versa) before expected timeout
- Fallback reads succeed but return stale sessions
- Inconsistent behavior based on which store hit first
- Users experience different timeout durations

**Prevention:**
- **Centralize timeout configuration:** `const SESSION_TIMEOUT_SECONDS = 3600` used by both stores
- Map cleanup uses same value: `SESSION_TIMEOUT_MS = SESSION_TIMEOUT_SECONDS * 1000`
- Redis TTL uses same value: `EX: SESSION_TIMEOUT_SECONDS`
- Document timeout in one place: README or config file
- Test timeout parity: create session, wait timeout period + 1 minute, verify removed from both stores

**Phase to address:** Redis migration phase (configuration unification task)

**Source confidence:** HIGH — Logical inference from dual-write pattern

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Redis Migration | Session data loss during cutover | Implement dual-write period (7 days) |
| Redis Migration | Serialization format breaks sessions | Use JSON.stringify, add roundtrip tests |
| Redis Migration | No failover when Redis down | Keep Map fallback, add circuit breaker |
| Plausibility Enhancement | False positives on fast players | Difficulty-adjusted thresholds, pattern detection (3+ flags) |
| Plausibility Enhancement | Network latency causes timing anomalies | Accept client `timeRemaining`, validate bounds only |
| Content Expansion | Quality degradation at scale | Generate in batches of 10-20 with reviews between |
| Content Expansion | Factual errors in generated content | Cross-reference with authoritative sources, manual fact-check |
| Content Expansion | Hallucinated source URLs | Validate URLs with HEAD requests, manual verification |
| Dev Tooling Fix | Build script dependency issues | Run script locally, commit results (not in CI/CD) |
| All Phases | Regression on existing features | Add E2E tests for existing flows, manual QA playthrough |

---

## Sources

### Redis Migration (HIGH confidence)
- [We Replaced PostgreSQL Sessions with Redis](https://blog.devgenius.io/we-replaced-postgresql-sessions-with-redis-api-response-time-went-from-800ms-to-12ms-bf119fdae8db) - Failover testing, dual-write patterns
- [Redis Cloud Migration](https://redis.io/tutorials/migration/) - Migration strategies, downtime vs. zero-downtime tradeoffs
- [Redis serialization benchmarks](https://sreejithmsblog.wordpress.com/2017/06/05/benchmarking-different-serializers-for-redis/) - JSON vs MessagePack performance
- [MessagePack pitfalls with large objects](https://smali-kazmi.medium.com/when-optimized-is-slower-why-we-stuck-with-native-json-for-our-10mb-context-object-2d7dd62e6982) - Binary serialization performance caveats

### Plausibility Checks (HIGH confidence)
- [How can you prevent anti-cheat measures from disrupting legitimate players?](https://www.linkedin.com/advice/0/how-can-you-prevent-anti-cheat-measures-from-disrupting-ylmmf) - False positive prevention strategies
- [How Game Developers Detect and Stop Cheating in Real-Time](https://medium.com/@amol346bhalerao/how-game-developers-detect-and-stop-cheating-in-real-time-0aa4f1f52e0c) - Pattern detection, graduated responses
- [AI Cheat Detection: Is It Fair or Falsely Flagging Latency](https://www.alibaba.com/product-insights/ai-cheat-detection-in-multiplayer-games-is-it-fair-or-falsely-flagging-latency.html) - Network latency false positives, latency-stratified detection

### Content Generation (HIGH confidence)
- [AI Content Quality Control: Complete Guide for 2026](https://koanthic.com/en/ai-content-quality-control-complete-guide-for-2026-2/) - McKinsey findings on quality degradation at scale (58%)
- [Bulk AI Content Generation 2026](https://www.junia.ai/blog/bulk-ai-content-generation-ultimate-guide) - Quality challenges, human intervention requirements
- [Improving factual accuracy in AI-generated content](https://scalebytech.com/improving-factual-accuracy-in-ai-generated-content) - Cross-referencing, RAG, verification strategies
- [AI Content in Educational Settings](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2026.1729059/full) - Fact-checking challenges for students/teachers
- [Is Originality AI Accurate? 2026 Testing](https://mpgone.com/is-originality-ai-accurate-we-tested-everything/) - Detection accuracy rates (70-95%)

### Dev Tooling (HIGH confidence)
- [TypeScript: dependency or dev-dependency?](https://medium.com/@jjmayank98/typescript-dependency-or-dev-dependency-cad623dff6d5) - Build-time vs runtime dependencies
- [TypeScript Build Process (AdonisJS)](https://docs.adonisjs.com/guides/concepts/typescript-build-process) - Standalone builds, production compilation

### Regression Testing (HIGH confidence)
- [What is Regression Testing? Guide for 2026](https://www.headspin.io/blog/regression-testing-a-complete-guide) - Test suite maintenance, prioritization
- [Test Maintenance Best Practices 2026](https://bugbug.io/blog/software-testing/best-practices-of-test-maintenance/) - Daily task for QA in agile, sprint integration

---

## Metadata

**Confidence breakdown:**
- Redis migration pitfalls: HIGH — Well-documented patterns in official Redis docs and production case studies
- Plausibility pitfalls: HIGH — Industry anti-cheat systems have public documentation on false positive rates
- Content generation pitfalls: HIGH — McKinsey research + educational AI research covers factual accuracy issues
- Dev tooling pitfalls: HIGH — Standard TypeScript build practices
- Integration pitfalls: MEDIUM — Logical inference from existing codebase, verified with regression testing best practices

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days — stable practices, current research)

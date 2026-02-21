# Civic Trivia Championship

## What This Is

A game-show-style trivia experience that makes civic learning engaging, social, and repeatable. Players answer multiple-choice questions about government, policy, and civic systems while earning rewards and deepening their understanding of democracy. Includes admin tooling for question quality management, content generation, and collection health monitoring. This is the first feature being built for the Empowered.Vote platform.

## Core Value

Make civic learning fun through game show mechanics — play, not study. No dark patterns, no guilt, no pressure.

## Requirements

### Validated

- Solo game flow (10 questions, timer, answer reveal, wager, results) — v1.0
- Server-side scoring with speed bonus and wager mechanics — v1.0
- Learning content with "Learn more" modals — v1.0
- XP/gems progression and user profile — v1.0
- Auth system (email/password, JWT, session persistence) — v1.0
- WCAG AA accessibility, keyboard nav, screen reader support — v1.0
- 120 question bank with mixed difficulty — v1.0
- Mobile responsive, FCP <1.5s, TTI <3s, bundle <300KB — v1.0
- Redis session storage with graceful degradation — v1.1
- Plausibility detection with difficulty-adjusted thresholds — v1.1
- Learning content expanded to 27.5% coverage (33/120) — v1.1
- Single-click answer selection, improved game UX — v1.1
- Anonymous play (no login required to play) — v1.1
- PostgreSQL-backed question collections with tag-based associations — v1.2
- Card-based collection picker at game start — v1.2
- Federal, Bloomington IN, and Los Angeles CA collections (320 total questions) — v1.2
- Question expiration system with hourly cron sweep and admin review — v1.2
- AI-powered locale-specific content generation tooling — v1.2
- Codified question quality rules (dinner party test, civic utility, no pure lookup facts) — v1.3
- Audit existing questions against quality rules, archive bad ones, generate replacements — v1.3
- Refined AI generation pipeline with quality rules baked in — v1.3
- Admin web UI for exploring collections, questions, and Learn More content — v1.3
- Question telemetry (encounter/correct counts) with difficulty rates in admin UI — v1.3
- Indiana and California state question collections — v1.3
- Admin question editing with quality re-scoring and optimistic updates — v1.3
- ✓ Fremont, CA question collection (92 questions with sources, expiration dates, learning content) — v1.4
- ✓ Fremont topics (city government, Alameda County, California state, civic history, local services, elections, landmarks, budget/finance) — v1.4
- ✓ Fremont collection card with Mission Peak banner image — v1.4
- ✓ Collection seeded, activated, and playable in production — v1.4

### Active

**Current Milestone: v1.5 Feedback Marks**

**Goal:** Let authenticated players flag questions they dislike during gameplay, provide optional elaboration post-game, and give admins a review queue to triage flagged content — turning players into quality curators.

**Target features:**
- Thumbs-down button on answer reveal screen (authenticated players only)
- Post-game summary shows flagged questions with optional free-text feedback
- Admin flag count visible on question list + dedicated flags review queue
- Admin can archive flagged questions directly from review queue
- Fix broken source.url Learn More links on original 320 questions
- Add ADMIN_EMAIL environment variable to production backend

### Out of Scope

- Team/multiplayer mode — Phase 2
- Real-time WebSocket features — Phase 2
- Events/hosted mode — Phase 4
- Question authoring tool — Phase 5
- Leaderboards — research needed, may add later
- OAuth login (Google, GitHub) — email/password sufficient for MVP
- Mobile native app — web-first approach
- Video/image questions — text-only for MVP
- Classroom dashboard — future consideration
- Location-based auto-assignment of collections — need more collections first
- Collection search/browse — not enough collections yet to need search
- Volunteer question authoring portal — AI generation + manual review sufficient for now
- Numeric/date answer questions (Wits & Wagers style) — requires multiplayer first
- Auto-difficulty calibration — collecting telemetry data, calibrate later
- Granular admin permissions (editor, reviewer roles) — boolean is_admin sufficient for now
- Real-time telemetry dashboard — batch/on-demand stats sufficient at current scale

## Context

**Current state (v1.4 shipped 2026-02-21):**
- 639 playable questions across 6 collections (Federal 119, Bloomington IN 116, Los Angeles CA 114, Indiana 100, California 98, Fremont CA 92)
- Quality rules engine with 8 rules, blocking/advisory severity, 0-100 scoring
- Admin UI with question explorer, collection health dashboard, inline editing
- Quality-gated AI generation pipeline with overshoot-and-curate strategy, quality validation retry loop, and cultural sensitivity framework
- Gameplay telemetry tracking encounter/correct counts per question
- Production verification script for automated deployment validation

**Question quality philosophy:**
- "Dinner party test" — would knowing this answer be worth sharing at dinner?
- Civic utility — the knowledge should make you a more informed citizen
- Recall satisfaction — pulling up something you didn't think you knew feels great
- Reasoning possible — you can work toward the answer, not just know it or not
- Anti-patterns: phone numbers, addresses, obscure dates, pure lookup facts with no civic value
- Easy questions are welcome — "Who is your mayor?" feels fair and memorable
- Quality rules codified as TypeScript functions with blocking/advisory severity

**Tech stack:** React 18, TypeScript, Vite, Tailwind, Framer Motion, Node.js, Express, PostgreSQL (Supabase), Redis (Upstash), JWT
- Frontend: ~12,000 LOC TypeScript/React
- Backend: ~8,000 LOC TypeScript/Express
- Live: civic-trivia-frontend.onrender.com / civic-trivia-backend.onrender.com

**Design principles (from design doc):**
1. Play, Not Study — Game show aesthetics, exciting pacing, friendly competition
2. Learn Through Discovery — Questions reveal interesting facts, explanations satisfy curiosity
3. Inclusive Competition — Anyone can play regardless of prior knowledge
4. No Dark Patterns — No daily streaks, loss aversion, or social pressure

**Visual direction:**
- Subtle game show stage aesthetic (curtains, spotlights, modern/clean)
- Empowered.Vote teal + warm accents (red theme for admin areas)
- Typography: Poppins or similar (confident, slightly playful)
- Modest celebrations (subtle confetti, not over-the-top)

**Timer design:**
- Circular progress (like iOS Screen Time)
- Color shifts: Teal → Yellow (50%) → Orange (25%) → Red (final 3s)
- No numeric countdown (reduces anxiety)

**Tone:**
- Never "wrong" — use "not quite"
- Focus on teaching, not judging
- Explanations are neutral, informative (1-3 sentences)
- Sources cited for data-heavy facts

**Reference doc:** `civic-trivia-championship-complete.md` contains full screen specs, interaction patterns, and detailed guidelines.

## Constraints

- **Tech stack**: React 18+, TypeScript, Vite, Tailwind, Framer Motion, Node.js, Express, PostgreSQL, Redis, JWT — specified in design doc
- **Performance**: FCP <1.5s, TTI <3s, bundle <300KB gzipped
- **Accessibility**: WCAG AA compliance required
- **Content**: 639 questions across 6 collections (minimum 50 per collection for gameplay)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Email/password auth only for MVP | Reduces complexity, OAuth can be added later | Good — sufficient for current usage |
| No leaderboards initially | Could discourage low-performers, needs research | Good — revisit if user demand |
| Visual timer (no digits) | Reduces anxiety while maintaining urgency | Good — positive feedback |
| "Not quite" instead of "Wrong" | Maintains encouraging tone | Good — matches brand tone |
| Tag-based collections over rigid categories | Questions can belong to multiple collections (e.g., Indiana + Bloomington) | Good — enabled clean multi-collection system |
| Quality over quantity for local sets | 50 compelling questions beats 100 half-compelling; target ~120 but don't force it | Good — 100 per locale with strong quality |
| AI-generated + human-reviewed content | AI kickstarts local question banks, volunteers refine over time | Good — efficient pipeline |
| Auto-remove + notify on expiration | Time-sensitive questions drop from rotation and flag for review | Good — admin review UI in place |
| Codify quality rules before scaling content | Phone number questions revealed need for explicit quality criteria | Good — 8 rules with blocking/advisory severity |
| Lightweight telemetry over complex analytics | Two columns (encounter_count, correct_count) give 80% of value | Good — simple and effective |
| Boolean is_admin over roles table | Only a few admins needed; RBAC adds unnecessary complexity | Good — simple and sufficient |
| Red admin theme vs teal player theme | Clear visual separation between admin and player experiences | Good — instantly distinguishable |
| Quality score informational, blocking flag actionable | Score (0-100) for sorting/display, hasBlockingViolations for archival decisions | Good — separates severity levels |
| URL validation deferred for legacy content | All 320 original questions have broken source.url links from CMS migration | Debt — needs dedicated URL update pass |
| State template 40/30/30 topic distribution | Government/civic processes/broader civics avoids "too bureaucratic" feel | Good — balanced content |
| Stable option IDs for drag-and-drop | Options tracked by opt-0/opt-1 ID, not array index, so correct answer follows during reorder | Good — prevents correctAnswer drift |
| History + culture heavy distribution for Fremont | Civic-history=20, landmarks-culture=18 (38% total) honors Fremont's unique consolidation story | Good — distinctive content |
| Overshoot-and-curate generation strategy | Generate 130%, curate to target — provides quality buffer for topic balancing | Good — 92 curated from 123 |
| Cultural sensitivity framework in prompts | Ohlone present-tense, Afghan-American heritage focus, Tesla civic-only, Mission San Jose disambiguation | Good — human spot-check approved |
| Quality guidelines in all locale system prompts | Embed Phase 21 quality rules in generation prompts to reduce validation retries | Good — benefits all future generation |
| Status-filtered question exports | Export only active questions, not drafts — applied to all collections | Good — data integrity improvement |
| Accept 92 questions (below 95 target) | Quality over quantity, all 8 topics represented with minimum 10 each | Good — within acceptable range |

---
*Last updated: 2026-02-21 after v1.5 milestone started*

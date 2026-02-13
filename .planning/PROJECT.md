# Civic Trivia Championship

## What This Is

A game-show-style trivia experience that makes civic learning engaging, social, and repeatable. Players answer multiple-choice questions about government, policy, and civic systems while earning rewards and deepening their understanding of democracy. This is the first feature being built for the Empowered.Vote platform.

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

### Active

## Current Milestone: v1.1 Tech Debt Hardening

**Goal:** Address tech debt from v1.0 audit — harden for production readiness

**Target items:**
- [ ] Migrate in-memory game sessions to Redis (prevent data loss on restart)
- [ ] Expand learningContent coverage beyond 18/120 questions (15%)
- [ ] Enhance plausibility checks from passive logging to active response
- [ ] Fix dev script TypeScript error (generateLearningContent.ts)
- [ ] Generate missing Phase 3 VERIFICATION.md

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

## Context

**Design principles (from design doc):**
1. Play, Not Study — Game show aesthetics, exciting pacing, friendly competition
2. Learn Through Discovery — Questions reveal interesting facts, explanations satisfy curiosity
3. Inclusive Competition — Anyone can play regardless of prior knowledge
4. No Dark Patterns — No daily streaks, loss aversion, or social pressure

**Visual direction:**
- Subtle game show stage aesthetic (curtains, spotlights, modern/clean)
- Empowered.Vote teal + warm accents
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
- **Content**: 100 questions minimum for MVP launch

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Email/password auth only for MVP | Reduces complexity, OAuth can be added later | — Pending |
| No leaderboards initially | Could discourage low-performers, needs research | — Pending |
| Visual timer (no digits) | Reduces anxiety while maintaining urgency | — Pending |
| "Not quite" instead of "Wrong" | Maintains encouraging tone | — Pending |

---
*Last updated: 2026-02-12 after v1.1 milestone start*

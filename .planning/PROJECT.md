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

### Active

(No active milestone — start next with `/gsd:new-milestone`)

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

## Context

**Current state (v1.2 shipped 2026-02-19):**
- 320 playable questions across 3 collections (Federal 120, Bloomington IN 100, Los Angeles CA 100)
- Tech stack: React 18, TypeScript, Vite, Tailwind, Framer Motion, Node.js, Express, PostgreSQL (Supabase), Redis (Upstash), JWT
- Frontend: ~8,000 LOC TypeScript/React
- Backend: ~4,000 LOC TypeScript/Express
- Live: civic-trivia-frontend.onrender.com / civic-trivia-backend.onrender.com

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
| Email/password auth only for MVP | Reduces complexity, OAuth can be added later | Good — sufficient for current usage |
| No leaderboards initially | Could discourage low-performers, needs research | Good — revisit if user demand |
| Visual timer (no digits) | Reduces anxiety while maintaining urgency | Good — positive feedback |
| "Not quite" instead of "Wrong" | Maintains encouraging tone | Good — matches brand tone |
| Tag-based collections over rigid categories | Questions can belong to multiple collections (e.g., Indiana + Bloomington) | Good — enabled clean multi-collection system |
| Quality over quantity for local sets | 50 compelling questions beats 100 half-compelling; target ~120 but don't force it | Good — 100 per locale with strong quality |
| AI-generated + human-reviewed content | AI kickstarts local question banks, volunteers refine over time | Good — efficient pipeline |
| Auto-remove + notify on expiration | Time-sensitive questions drop from rotation and flag for review | Good — admin review UI in place |

---
*Last updated: 2026-02-19 after v1.2 milestone complete*

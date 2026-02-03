# Civic Trivia Championship

## What This Is

A game-show-style trivia experience that makes civic learning engaging, social, and repeatable. Players answer multiple-choice questions about government, policy, and civic systems while earning rewards and deepening their understanding of democracy. This is the first feature being built for the Empowered.Vote platform.

## Core Value

Make civic learning fun through game show mechanics — play, not study. No dark patterns, no guilt, no pressure.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Solo Game Flow:**
- [ ] Player can start a solo quick play session (10 questions, ~5 minutes)
- [ ] Questions display with visual countdown timer (10-15 seconds)
- [ ] Player selects answer, sees lock-in confirmation
- [ ] Answer reveal shows correct/incorrect with explanation
- [ ] "Learn more" opens deeper content without leaving game
- [ ] "Save for later" bookmarks topics for later exploration
- [ ] Wager round on final question (bet up to half score)
- [ ] Results screen shows score breakdown, topics learned, rewards

**Scoring & Rewards:**
- [ ] Base points (+100 per correct answer)
- [ ] Speed bonus (up to +50 based on time remaining)
- [ ] Wager mechanics (win/lose wagered points)
- [ ] XP earned per game (50 base + 1 per correct)
- [ ] Gems earned per game (10 base + 1 per correct)
- [ ] Badge unlocks (First Game, Perfect Score, Curious Mind, Fact Collector)

**Content:**
- [ ] 100 questions with mixed difficulty (easy/medium/hard)
- [ ] Each question has 4 answer options
- [ ] Each question has 1-3 sentence explanation
- [ ] 10+ "Learn more" deep-dive topics
- [ ] Question content management (add/edit questions)

**Platform Foundation:**
- [ ] Auth system (email/password signup, login, logout)
- [ ] Session persistence across browser refresh
- [ ] User profile with stats (games played, best score, accuracy)
- [ ] Learning Hub (saved topics)
- [ ] Design system foundation (Empowered.Vote aesthetic)

**Accessibility:**
- [ ] WCAG AA contrast compliance
- [ ] Keyboard navigation for all interactions
- [ ] Screen reader support with proper announcements
- [ ] Min 48px touch targets
- [ ] Timer extension option (hidden setting)

**Technical:**
- [ ] Mobile responsive design
- [ ] First Contentful Paint <1.5s
- [ ] Time to Interactive <3s
- [ ] Bundle size <300KB gzipped

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
*Last updated: 2026-02-03 after initialization*

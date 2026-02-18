# Phase 11: Plausibility Enhancement - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the existing passive plausibility detection (flag-only) to an active system with difficulty-adjusted timing thresholds and real penalties. The system detects suspiciously fast answers, requires a pattern of 3+ before penalizing, and adjusts for question difficulty and accessibility settings. Only applies to authenticated users on Q1-Q9.

</domain>

<decisions>
## Implementation Decisions

### Player awareness
- Fully silent system — penalties apply invisibly, player sees lower scores without knowing why
- No UI indicators, no "flagged" labels, no warnings
- Console warnings only for server-side logging (keep existing console.warn approach)
- Pattern count is per game only — resets each new game, no cross-session tracking

### Detection rules
- Only flag fast WRONG answers — fast correct answers are exempt (legitimate knowledge)
- Skip plausibility checks entirely for anonymous (unauthenticated) users
- Skip plausibility checks entirely for Q10 (wager question)
- Difficulty-adjusted thresholds stored in a config object (not scattered constants)
- Timer multiplier adjustment for accessibility users — Claude's discretion on exact math

### Penalty mechanics
- Penalty = zero the speed bonus on flagged answers (not a % reduction of total)
- Deviates from roadmap's "30% reduction" — thematically cleaner: suspicious speed = no speed reward
- Pattern threshold: 3+ flagged answers in one game before penalties apply
- Forward only — first 2 flags are free, penalties start from 3rd flagged answer onward
- No retroactive penalty on earlier flagged answers

### Score presentation
- Flagged answers look identical to normal answers on results screen — no visual difference
- Strip `flagged` field from API responses to client — fully server-side data only
- Lower score from zeroed speed bonuses naturally reduces max wager for Q10 — sufficient consequence

### Wager interaction
- Q10 exempt from plausibility checks entirely
- No carryover from Q1-Q9 flags to Q10 wager (no reduced max wager percentage)
- Natural consequence (lower score = lower max wager) is the only effect on Q10

### Claude's Discretion
- Exact difficulty threshold values (roadmap suggests easy <1s, medium <0.75s, hard <0.5s — tune as appropriate)
- Timer multiplier threshold adjustment math (proportional scaling vs same thresholds)
- Implementation approach for stripping `flagged` from client responses

</decisions>

<specifics>
## Specific Ideas

- Questions already have difficulty ratings: 35 easy, 40 medium, 45 hard — no classification work needed
- Current system uses flat 0.5s threshold and `MIN_PLAUSIBLE_RESPONSE_TIME` constant in sessionService.ts
- Thresholds should live in a config object for future tuning
- The "zero speed bonus" penalty is thematically clean: the 3-tier speed bonus system (>=15s: +50, >=5s: +25, <5s: +0) simply returns +0 for flagged answers

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-plausibility-enhancement*
*Context gathered: 2026-02-17*

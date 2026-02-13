# Phase 6: Wager Mechanics - Research

**Researched:** 2026-02-12
**Domain:** Game state management, UI input patterns, dramatic animations
**Confidence:** HIGH

## Summary

This phase adds a Final Jeopardy-style wager system to the final question (Q10) of the trivia game. The implementation extends existing patterns: the useReducer state machine (from Phase 2), server-authoritative scoring (from Phase 3), and Framer Motion spring animations (from Phase 3). Research focused on three primary domains: accessible range slider inputs, dramatic reveal animations with number counters, and state machine extensions for wager flow.

The standard approach uses native HTML `<input type="range">` for the wager slider due to its built-in accessibility (implicit ARIA slider role), extending the existing gameReducer with new phases ('wagering', 'final-question'), and leveraging Framer Motion's useSpring hook for score count-up/down animations. Server-side validation prevents wager manipulation by enforcing max wager limits and handling timeout edge cases.

Key technical decisions: slider defaults to 25% of max wager with live outcome previews, context-aware button text ("Play for Fun" at 0, "Lock In Wager" above 0), dramatic full-screen transitions using AnimatePresence, and extended timer (45-60s) for the final question with no speed bonus or base points.

**Primary recommendation:** Extend existing state machine with wager-specific phases, use native range input with custom styling, implement score animations using Framer Motion's spring-based counter pattern from BuildUI.

## Standard Stack

The established libraries/tools for this domain (all already in the project stack):

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React useReducer | Built-in | State machine for wager flow | Already used for game phases (02-02), proven finite state machine pattern |
| Native `<input type="range">` | HTML5 | Wager slider input | Built-in accessibility (implicit slider role), cross-browser support, minimal dependencies |
| Framer Motion | Already in stack | Score count animations, screen transitions | Already used for spring physics on score counter (03-03), established for game animations |
| Express.js | Already in stack | Wager validation endpoints | Server-authoritative pattern from Phase 3, same architecture |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript discriminated unions | Built-in | Action type safety in reducer | Extending GameAction type with wager actions |
| Zustand | Already in stack | N/A for this phase | Wager state is game-scoped, lives in reducer not global store |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native range input | react-range library | react-range offers more control but adds 4kb+ and requires custom accessibility implementation. Native is free and accessible by default. |
| useSpring counter | CSS animations | CSS can't dynamically adjust to changing target values mid-animation. Spring physics handles interruptions gracefully. |
| State machine extension | Separate wager component | Wager is tightly coupled to game flow (must happen between Q9 and Q10), keeping in reducer maintains single source of truth. |

**Installation:**
No new dependencies required. All functionality uses existing stack.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/features/game/
├── gameReducer.ts           # Add wager-specific actions and phases
├── hooks/
│   └── useGameState.ts      # Add wager submission logic
├── components/
│   ├── WagerScreen.tsx      # New component for wager input UI
│   ├── FinalQuestionAnnouncement.tsx  # New full-screen announcement
│   └── ScoreCounter.tsx     # Extend for count-up/down animation
backend/src/
├── services/
│   └── sessionService.ts    # Add wager validation to submitAnswer
└── routes/
    └── game.ts              # Extend POST /answer to accept wager field
```

### Pattern 1: State Machine Extension for Wager Flow
**What:** Add new phases to existing gameReducer state machine: 'wagering', 'wager-locked', 'final-question-announcement', 'final-question'

**When to use:** When adding multi-step flows that must occur at specific points in game progression

**Example:**
```typescript
// Source: Based on Kyle Shevlin pattern - https://kyleshevlin.com/how-to-use-usereducer-as-a-finite-state-machine/
// Extending existing gameReducer.ts

export type GamePhase =
  | 'idle'
  | 'starting'
  | 'answering'
  | 'selected'
  | 'locked'
  | 'revealing'
  | 'final-announcement'  // NEW: Full-screen "FINAL QUESTION" screen
  | 'wagering'            // NEW: Wager input screen
  | 'wager-locked'        // NEW: Wager confirmed, suspense pause
  | 'final-question'      // NEW: Q10 with extended timer
  | 'complete';

export type GameAction =
  // ... existing actions
  | { type: 'START_WAGER'; category: string }  // Triggered after Q9 reveal
  | { type: 'SET_WAGER'; amount: number }
  | { type: 'LOCK_WAGER' }
  | { type: 'REVEAL_FINAL_QUESTION' };

// State transition logic (finite state machine pattern)
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'NEXT_QUESTION': {
      const nextIndex = state.currentQuestionIndex + 1;

      // Check if next question is Q10 (final question)
      if (nextIndex === 9) {  // 0-indexed, so 9 is Q10
        return {
          ...state,
          phase: 'final-announcement',  // Go to announcement instead of straight to answering
          currentQuestionIndex: nextIndex,
        };
      }

      if (nextIndex >= state.questions.length) {
        return { ...state, phase: 'complete' };
      }

      return {
        ...state,
        phase: 'answering',
        currentQuestionIndex: nextIndex,
        selectedOption: null,
        isTimerPaused: false,
      };
    }

    case 'START_WAGER': {
      // Only valid from final-announcement phase
      if (state.phase !== 'final-announcement') {
        return state;
      }
      return {
        ...state,
        phase: 'wagering',
        wagerAmount: 0,  // Default to 0
        wagerCategory: action.category,
      };
    }

    case 'SET_WAGER': {
      // Only valid during wagering phase
      if (state.phase !== 'wagering') {
        return state;
      }
      const maxWager = Math.floor(state.totalScore / 2);
      const clampedAmount = Math.max(0, Math.min(action.amount, maxWager));
      return {
        ...state,
        wagerAmount: clampedAmount,
      };
    }

    case 'LOCK_WAGER': {
      // Only valid from wagering phase
      if (state.phase !== 'wagering') {
        return state;
      }
      return {
        ...state,
        phase: 'wager-locked',
        isTimerPaused: true,  // Suspense pause
      };
    }

    case 'REVEAL_FINAL_QUESTION': {
      // Only valid from wager-locked phase
      if (state.phase !== 'wager-locked') {
        return state;
      }
      return {
        ...state,
        phase: 'final-question',
        isTimerPaused: false,
      };
    }

    // ... other cases
  }
}
```

### Pattern 2: Native Range Input with Accessibility
**What:** Use native HTML `<input type="range">` with proper labeling and live region updates

**When to use:** For accessible, keyboard-navigable slider controls

**Example:**
```typescript
// Source: MDN - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range
// WagerScreen.tsx component

interface WagerScreenProps {
  currentScore: number;
  category: string;
  onLockWager: (amount: number) => void;
}

function WagerScreen({ currentScore, category, onLockWager }: WagerScreenProps) {
  const maxWager = Math.floor(currentScore / 2);
  const defaultWager = Math.floor(maxWager * 0.25);  // Default to 25% of max
  const [wagerAmount, setWagerAmount] = useState(defaultWager);

  const potentialWin = currentScore + wagerAmount;
  const potentialLoss = currentScore - wagerAmount;

  return (
    <div className="wager-screen">
      <h2>Final Question Category: {category}</h2>

      {/* Native range input - implicit ARIA slider role */}
      <label htmlFor="wager-slider">
        Wager Amount: {wagerAmount} points
      </label>
      <input
        type="range"
        id="wager-slider"
        name="wager"
        min={0}
        max={maxWager}
        value={wagerAmount}
        step={10}  // Step in increments of 10 points
        onChange={(e) => setWagerAmount(Number(e.target.value))}
        aria-valuetext={`${wagerAmount} points`}
      />

      {/* Live outcome preview - aria-live for screen readers */}
      <div className="outcome-preview" aria-live="polite">
        <div>If correct: <strong>{potentialWin}</strong> points</div>
        <div>If wrong: <strong>{potentialLoss}</strong> points</div>
      </div>

      {/* Context-aware button text */}
      <button
        onClick={() => onLockWager(wagerAmount)}
        className="lock-wager-btn"
      >
        {wagerAmount === 0 ? 'Play for Fun' : 'Lock In Wager'}
      </button>
    </div>
  );
}
```

### Pattern 3: Animated Number Counter with Spring Physics
**What:** Use Framer Motion's useSpring to animate score counting up/down with smooth physics

**When to use:** For dramatic reveal of score changes (wager win/loss)

**Example:**
```typescript
// Source: BuildUI animated counter pattern - https://buildui.com/recipes/animated-counter
// Adapted for React + TypeScript

import { useSpring, useTransform, motion } from 'framer-motion';
import { useEffect } from 'react';

function AnimatedCounter({ value }: { value: number }) {
  // Spring physics for smooth animation
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 30,
    mass: 0.8
  });

  // Update spring when value changes (count up or down)
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  // Transform spring value to rounded display number
  const display = useTransform(spring, (latest) => Math.round(latest));

  return (
    <motion.span className="score-counter">
      {display}
    </motion.span>
  );
}

// Usage in reveal:
// <AnimatedCounter value={wagerResult.finalScore} />
// Score visibly climbs from currentScore to (currentScore + wager) on win
// Score visibly drops from currentScore to (currentScore - wager) on loss
```

### Pattern 4: Full-Screen Announcement with AnimatePresence
**What:** Use AnimatePresence to mount/unmount full-screen announcement with exit animations

**When to use:** For dramatic scene transitions that temporarily take over the screen

**Example:**
```typescript
// Source: Motion AnimatePresence docs - https://motion.dev/docs/react-animate-presence
// FinalQuestionAnnouncement.tsx

import { motion, AnimatePresence } from 'framer-motion';

interface AnnouncementProps {
  show: boolean;
  onComplete: () => void;
}

function FinalQuestionAnnouncement({ show, onComplete }: AnnouncementProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 2000);  // 2s display duration
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="final-question-announcement"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <h1>FINAL QUESTION</h1>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Anti-Patterns to Avoid
- **Client-side wager validation only:** Wager max must be validated server-side to prevent manipulation. Client validates for UX, server for security.
- **Separate wager state outside reducer:** Wager is part of game flow, must be in state machine to maintain phase transition integrity.
- **Skipping AnimatePresence wrapper:** Exit animations won't work without AnimatePresence wrapping conditional renders.
- **Manual digit animation:** Don't manually animate each digit. Use spring physics on the numeric value for smooth, interruptible animations.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Range slider accessibility | Custom div-based slider with mouse drag | Native `<input type="range">` | Native input has built-in keyboard navigation, ARIA slider role, focus management. Custom sliders require extensive ARIA implementation and cross-browser testing. |
| Number count animation | CSS keyframe animations | Framer Motion useSpring + useTransform | CSS can't handle dynamic target changes mid-animation. If score updates while counting, spring physics gracefully adjusts. Handles both count-up and count-down with same code. |
| State machine validation | Manual if/else phase checks | Discriminated unions in reducer | TypeScript narrows types based on action.type. Prevents invalid state transitions at compile time. |
| Wager validation logic | Client-side max calculation | Server-side validation in sessionService | Race conditions possible: user could submit wager after another answer changes their score. Server has authoritative current score. |

**Key insight:** Game state transitions are complex finite state machines. Using established patterns (useReducer with discriminated unions) prevents edge cases like "user clicks wager button during Q8" or "timer expires while on wager screen." The reducer enforces valid transitions at the type level.

## Common Pitfalls

### Pitfall 1: Race Condition Between Score Updates and Wager Submission
**What goes wrong:** User submits wager based on score displayed in UI, but another request (late answer submission) changes their score server-side between wager display and wager lock-in.

**Why it happens:** Client displays score optimistically, but server is source of truth. Network delays can cause state drift.

**How to avoid:** Server validates wager at submission time against current server-side score. If wager exceeds half of current score, reject with 400 error and updated score. Client refetches score before wager screen if needed.

**Warning signs:** Backend logs show rejected wager submissions with "exceeds maximum" errors.

### Pitfall 2: AnimatePresence Exit Animations Not Running
**What goes wrong:** Component disappears instantly instead of animating out when show becomes false.

**Why it happens:** React removes component from DOM immediately unless AnimatePresence keeps it mounted during exit animation.

**How to avoid:**
1. Wrap conditional render in `<AnimatePresence>`
2. Use `{show && <motion.div>...</motion.div>}` pattern (not ternary with null)
3. Ensure exit prop is defined on motion component
4. If using Radix UI or other portals, add forceMount prop to portal

**Warning signs:** Component blinks out instead of smooth fade. Console warning: "AnimatePresence detected a direct conditional child."

### Pitfall 3: Slider Value Exceeding Max After Score Changes
**What goes wrong:** User moves slider to 500 (half of 1000 score), answers another question incorrectly losing points, now score is 900 but slider still shows 500 (exceeds new max of 450).

**Why it happens:** Slider state not recalculated when totalScore changes.

**How to avoid:**
```typescript
useEffect(() => {
  const maxWager = Math.floor(currentScore / 2);
  if (wagerAmount > maxWager) {
    setWagerAmount(maxWager);  // Clamp to new max
  }
}, [currentScore]);
```

**Warning signs:** Slider thumb appears past the visual end of the track. Server rejects wager submission.

### Pitfall 4: Timeout on Final Question Doesn't Account for Wager
**What goes wrong:** User lets final question timer expire. System applies normal timeout behavior (0 points) but forgets to subtract wager amount.

**Why it happens:** Timeout handler doesn't check if current question has an active wager.

**How to avoid:** Server-side scoring logic must check `if (questionIndex === 9 && session.wagerAmount > 0)` then apply wager loss on timeout. Include wager in ScoreData response.

**Warning signs:** User reports score not decreasing when they timed out on final question after betting.

### Pitfall 5: Native Range Input Styling Inconsistencies
**What goes wrong:** Slider looks different across browsers (Chrome vs Firefox vs Safari) or thumb/track styling doesn't apply.

**Why it happens:** Range inputs require vendor-specific pseudo-elements (`::-webkit-slider-thumb`, `::-moz-range-thumb`).

**How to avoid:**
```css
/* Reset appearance first - critical for custom styling */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
}

/* Webkit browsers (Chrome, Safari, Edge) */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  /* custom styles */
}

/* Firefox */
input[type="range"]::-moz-range-thumb {
  /* custom styles */
}

/* Focus styles for accessibility */
input[type="range"]:focus {
  outline: 2px solid blue;
  outline-offset: 2px;
}
```

**Warning signs:** Slider works but looks like default browser control. Styling applied to input but thumb unchanged.

## Code Examples

Verified patterns from official sources:

### Server-Side Wager Validation
```typescript
// Source: Extending existing sessionService.ts pattern from Phase 3
// backend/src/services/sessionService.ts

interface SubmitAnswerParams {
  sessionId: string;
  questionId: string;
  selectedOption: number | null;
  timeRemaining: number;
  wager?: number;  // NEW: Optional wager for Q10
}

class SessionManager {
  submitAnswer(params: SubmitAnswerParams): ServerAnswer {
    const session = this.getSession(params.sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }

    const questionIndex = session.questions.findIndex(q => q.id === params.questionId);
    const isFinalQuestion = questionIndex === 9;  // Q10

    // Validate wager if provided
    if (params.wager !== undefined) {
      if (!isFinalQuestion) {
        throw new Error('Wager only allowed on final question');
      }

      const maxWager = Math.floor(this.calculateCurrentScore(session) / 2);
      if (params.wager > maxWager) {
        throw new Error(`Wager ${params.wager} exceeds maximum ${maxWager}`);
      }

      if (params.wager < 0) {
        throw new Error('Wager cannot be negative');
      }
    }

    const question = session.questions[questionIndex];
    const isCorrect = params.selectedOption === question.correctAnswer;

    let scoreData: ScoreData;

    if (isFinalQuestion && params.wager !== undefined) {
      // Final question scoring: wager only, no base points or speed bonus
      scoreData = {
        basePoints: 0,
        speedBonus: 0,
        totalPoints: isCorrect ? params.wager : -params.wager,
        correct: isCorrect,
        correctAnswer: question.correctAnswer,
      };
    } else {
      // Normal scoring (base + speed bonus)
      scoreData = calculateScore(isCorrect, params.timeRemaining);
    }

    const answer: ServerAnswer = {
      questionId: params.questionId,
      selectedOption: params.selectedOption,
      timeRemaining: params.timeRemaining,
      basePoints: scoreData.basePoints,
      speedBonus: scoreData.speedBonus,
      totalPoints: scoreData.totalPoints,
      responseTime: 25 - params.timeRemaining,  // Or 60 - timeRemaining for final question
      flagged: this.checkPlausibility(params.timeRemaining, answer.responseTime),
      wager: params.wager,  // Store wager in answer record
    };

    session.answers.push(answer);
    return answer;
  }

  private calculateCurrentScore(session: GameSession): number {
    return session.answers.reduce((sum, answer) => sum + answer.totalPoints, 0);
  }
}
```

### Context-Aware Button with Live Preview
```typescript
// Source: React patterns + WCAG live regions
// frontend/src/features/game/components/WagerScreen.tsx

function WagerScreen({ currentScore, category, onLockWager }: WagerScreenProps) {
  const maxWager = Math.floor(currentScore / 2);
  const defaultWager = Math.floor(maxWager * 0.25);
  const [wagerAmount, setWagerAmount] = useState(defaultWager);

  // Clamp wager if score changes (e.g., progression XP applied)
  useEffect(() => {
    if (wagerAmount > maxWager) {
      setWagerAmount(maxWager);
    }
  }, [maxWager, wagerAmount]);

  const potentialWin = currentScore + wagerAmount;
  const potentialLoss = currentScore - wagerAmount;
  const buttonText = wagerAmount === 0 ? 'Play for Fun' : 'Lock In Wager';

  return (
    <motion.div
      className="wager-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="wager-header">
        <h2>Final Question</h2>
        <p className="category-hint">Category: <strong>{category}</strong></p>
      </div>

      <div className="wager-input">
        <label htmlFor="wager-slider" className="wager-label">
          Wager: <span className="wager-value">{wagerAmount}</span> points
        </label>
        <input
          type="range"
          id="wager-slider"
          min={0}
          max={maxWager}
          value={wagerAmount}
          step={10}
          onChange={(e) => setWagerAmount(Number(e.target.value))}
          aria-valuetext={`${wagerAmount} points`}
          className="wager-slider"
        />
        <div className="wager-bounds">
          <span>0</span>
          <span>{maxWager}</span>
        </div>
      </div>

      {/* Live region updates as slider moves - polite for non-disruptive announcements */}
      <div className="outcome-preview" aria-live="polite" aria-atomic="true">
        <div className="outcome-item outcome-win">
          <span className="outcome-label">If correct:</span>
          <span className="outcome-value">{potentialWin} points</span>
        </div>
        <div className="outcome-item outcome-loss">
          <span className="outcome-label">If wrong:</span>
          <span className="outcome-value">{potentialLoss} points</span>
        </div>
      </div>

      <button
        onClick={() => onLockWager(wagerAmount)}
        className="lock-wager-btn"
        disabled={currentScore === 0}  // Can't wager if score is 0
      >
        {buttonText}
      </button>

      {currentScore === 0 && (
        <p className="wager-hint">No points to wager! Play for fun.</p>
      )}
    </motion.div>
  );
}
```

### Dramatic Score Count Animation
```typescript
// Source: BuildUI counter pattern - https://buildui.com/recipes/animated-counter
// frontend/src/features/game/components/ScoreCounter.tsx

import { useSpring, useTransform, motion } from 'framer-motion';
import { useEffect } from 'react';

interface ScoreCounterProps {
  value: number;
  duration?: number;  // Optional override for animation duration
}

export function ScoreCounter({ value, duration }: ScoreCounterProps) {
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 30,
    mass: 0.8,
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  // Round to whole numbers for display
  const display = useTransform(spring, (latest) => Math.round(latest));

  return (
    <motion.span className="score-counter">
      {display}
    </motion.span>
  );
}

// Usage in reveal screen:
function WagerReveal({ previousScore, wagerAmount, isCorrect }: WagerRevealProps) {
  const finalScore = isCorrect
    ? previousScore + wagerAmount
    : previousScore - wagerAmount;

  return (
    <div className="wager-reveal">
      <div className={`result-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
        {isCorrect ? 'Correct!' : 'Incorrect'}
      </div>

      <div className="score-change">
        <span className="score-label">Final Score:</span>
        {/* Score animates from previousScore to finalScore */}
        <ScoreCounter value={finalScore} />
      </div>

      <div className="wager-breakdown">
        <p>Wager: {wagerAmount} points</p>
        <p className={isCorrect ? 'wager-won' : 'wager-lost'}>
          {isCorrect ? '+' : '-'}{wagerAmount} points
        </p>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom slider libraries (react-slider, rc-slider) | Native `<input type="range">` with CSS | 2024-2025 | Browser support improved dramatically. Native input now supports extensive CSS customization via pseudo-elements. Accessibility is built-in rather than library-dependent. |
| Manual state management for multi-step flows | useReducer with discriminated unions | TypeScript 4.x+ | Type narrowing in reducers prevents entire classes of bugs. Action types constrain available payloads. |
| CSS animations for number counters | Framer Motion spring physics | Framer Motion 10+ | Springs handle interruptions (value changes mid-animation) gracefully. CSS keyframes can't dynamically retarget. |
| Props drilling for game state | Context + useReducer (not Zustand) | N/A | Wager state is game-scoped, not global. Zustand is for cross-feature state (user profile). Game state stays in reducer. |

**Deprecated/outdated:**
- **react-slider library**: Native input type="range" now has sufficient cross-browser support and CSS customization. Library adds unnecessary bundle size.
- **Manual aria-* attributes on custom sliders**: Native range input provides implicit slider role. Only need aria-valuetext for enhanced descriptions.
- **Separate wager validation endpoint**: Wager is part of answer submission, not a separate step. Extend existing POST /answer endpoint with optional wager field.

## Open Questions

Things that couldn't be fully resolved:

1. **Exact extended timer duration for final question**
   - What we know: CONTEXT.md specifies 45-60s range (vs standard 25s)
   - What's unclear: Optimal duration for drama vs frustration balance
   - Recommendation: Start with 50s (2x standard timer). A/B test or gather feedback in Phase 10 (Polish). Update TIMER_DURATION constant in both frontend question component and backend session service.

2. **Score counter animation during rapid state changes**
   - What we know: Spring physics handles interruptions well
   - What's unclear: If user rapidly opens/closes results screen, does spring animation queue or reset?
   - Recommendation: Test with rapid state transitions. If queuing occurs, add spring.stop() in cleanup effect. Framer Motion's useSpring should handle this, but verify in component testing.

3. **Wager UI for users with score of 0**
   - What we know: User can't wager if score is 0 (max wager would be 0)
   - What's unclear: Should we skip wager screen entirely or show disabled UI?
   - Recommendation: Show wager screen with slider disabled and button text "Play for Fun" (0 wager). Maintains consistent game flow, user still sees category hint. Alternative: Auto-advance to final question with 0 wager, but this breaks expected rhythm.

4. **AnimatePresence mode for announcement screen**
   - What we know: Announcement screen shows for ~2s then transitions to wager screen
   - What's unclear: Should we use mode="wait" (finish exit before entering next) or "sync" (overlap)?
   - Recommendation: Use mode="wait" for cleaner transition. Announcement exits fully before wager screen enters. Total transition time: announcement exit (0.5s) + wager enter (0.3s) = 0.8s additional, acceptable for dramatic effect.

## Sources

### Primary (HIGH confidence)
- [MDN Web Docs - input type="range"](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/range) - Accessibility requirements for native range inputs
- [BuildUI Animated Counter Recipe](https://buildui.com/recipes/animated-counter) - Framer Motion spring-based counter pattern
- [Kyle Shevlin - useReducer as Finite State Machine](https://kyleshevlin.com/how-to-use-usereducer-as-a-finite-state-machine/) - State machine implementation pattern
- Existing codebase (gameReducer.ts, sessionService.ts) - Current patterns from Phases 2-3

### Secondary (MEDIUM confidence)
- [React Slider Component - Material UI](https://mui.com/material-ui/react-slider/) - Accessibility best practices
- [Motion AnimatePresence Docs](https://motion.dev/docs/react-animate-presence) - Exit animation patterns
- [React Form Validation Patterns](https://react.wiki/hooks/form-validation/) - Double validation (client + server)
- [Creating an Accessible Range Slider with CSS](https://www.a11ywithlindsey.com/blog/creating-accessible-range-slider-css/) - Custom styling techniques
- [Game UI Database - Timers](https://www.gameuidatabase.com/index.php?scrn=137) - Extended timer UX patterns

### Tertiary (LOW confidence)
- WebSearch results on UX design trends 2026 - General motion design trends, not library-specific
- WebSearch results on betting calculation patterns - Domain patterns but not React-specific implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, verified against existing codebase
- Architecture: HIGH - Extending proven patterns from Phases 2-3 (useReducer state machine, server-authoritative scoring)
- Pitfalls: MEDIUM-HIGH - Common pitfalls verified from official docs (AnimatePresence, race conditions) and accessibility sources, but some game-specific edge cases inferred from general patterns

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (30 days - stable ecosystem, core React/Framer Motion patterns unlikely to change)

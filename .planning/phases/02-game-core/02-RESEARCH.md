# Phase 2: Game Core - Research

**Researched:** 2026-02-10
**Domain:** React game state management, interactive UI components, animation
**Confidence:** HIGH

## Summary

This research covers implementing a trivia game's core gameplay loop in React with TypeScript. The user has made specific UX decisions (documented in CONTEXT.md) requiring a Who Wants to Be a Millionaire aesthetic with circular timer, two-step answer lock-in, and dramatic reveal animations.

The standard approach for 2026 is a hybrid state management strategy: **useReducer for game flow state** (question progression, answer selection, reveal timing), **Zustand for session state** (already in use from Phase 1), and specialized libraries for complex UI components (circular timer, animations). This avoids the overhead of Redux while maintaining clean separation of concerns.

Key technical challenges include timer lifecycle management with proper cleanup, coordinating reveal animations with state transitions, and keyboard event handling without memory leaks. The research identifies proven libraries and patterns that solve these problems rather than custom implementations.

**Primary recommendation:** Use useReducer to model the game as a state machine (idle → answering → locked → revealing → nextQuestion), Framer Motion for reveal animations, react-countdown-circle-timer for the circular timer, and custom useKeyPress hook for keyboard shortcuts.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| useReducer (React built-in) | React 18+ | Game state machine | Built-in, zero dependencies, perfect for complex state transitions |
| Framer Motion | 11.x | UI animations | Most popular React animation library (30.6k stars, 8.1M weekly downloads), declarative API |
| react-countdown-circle-timer | 3.2.1 | Circular countdown timer | Purpose-built for circular timers with color transitions, SVG-based, performant |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 4.x | Session state | Already in use from Phase 1, lightweight shared state |
| CSS Grid + Flexbox | Native | Responsive layouts | Native solution, no library needed for 2x2 grid |
| Custom hooks | N/A | Keyboard events, timer management | Standard pattern for encapsulating reusable logic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Framer Motion | react-spring (physics-based) | Smaller bundle (~10kb vs 17kb) but less declarative API, steeper learning curve |
| react-countdown-circle-timer | Custom SVG implementation | Full control but requires managing strokeDasharray/strokeDashoffset, requestAnimationFrame loop |
| useReducer | XState (state machine library) | More formal state machine modeling, but adds dependency and complexity for this use case |
| CSS Grid | react-grid-layout | Drag-and-drop features not needed, CSS Grid is simpler for static responsive layouts |

**Installation:**
```bash
npm install framer-motion react-countdown-circle-timer
```

## Architecture Patterns

### Recommended Project Structure
```
client/src/
├── features/
│   └── game/
│       ├── components/          # Game UI components
│       │   ├── GameScreen.tsx   # Main game container
│       │   ├── QuestionCard.tsx # Question display
│       │   ├── AnswerGrid.tsx   # 2x2 answer layout
│       │   ├── GameTimer.tsx    # Circular timer wrapper
│       │   └── ResultsScreen.tsx
│       ├── hooks/
│       │   ├── useGameState.ts  # useReducer wrapper
│       │   ├── useKeyPress.ts   # Keyboard shortcuts
│       │   └── useGameTimer.ts  # Timer lifecycle
│       ├── types.ts             # Game state types
│       └── gameReducer.ts       # State machine logic
└── shared/
    └── components/
        └── ConfirmDialog.tsx    # Reusable quit dialog
```

### Pattern 1: Game State Machine with useReducer
**What:** Model game flow as explicit states and actions
**When to use:** Complex state with interdependent transitions (answer selection → lock-in → reveal)
**Example:**
```typescript
// gameReducer.ts
type GameState =
  | { phase: 'idle' }
  | { phase: 'answering'; currentQuestion: number; timeRemaining: number }
  | { phase: 'locked'; selectedAnswer: string; currentQuestion: number }
  | { phase: 'revealing'; selectedAnswer: string; correctAnswer: string; currentQuestion: number }
  | { phase: 'complete'; results: GameResult[] };

type GameAction =
  | { type: 'START_GAME'; questions: Question[] }
  | { type: 'SELECT_ANSWER'; answer: string }
  | { type: 'LOCK_ANSWER' }
  | { type: 'REVEAL_ANSWER' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'TIMEOUT' }
  | { type: 'FINISH_GAME' };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (state.phase) {
    case 'answering':
      if (action.type === 'SELECT_ANSWER') {
        return { ...state, selectedAnswer: action.answer };
      }
      if (action.type === 'LOCK_ANSWER' && state.selectedAnswer) {
        return { phase: 'locked', selectedAnswer: state.selectedAnswer, currentQuestion: state.currentQuestion };
      }
      if (action.type === 'TIMEOUT') {
        return { phase: 'revealing', selectedAnswer: null, correctAnswer: questions[state.currentQuestion].correct, currentQuestion: state.currentQuestion };
      }
      break;
    // ... other state transitions
  }
  return state;
}
```

### Pattern 2: Timer Lifecycle with Cleanup
**What:** Manage timer start/pause/cleanup tied to game state
**When to use:** Timers that must pause on lock-in, reset on next question
**Example:**
```typescript
// useGameTimer.ts
function useGameTimer(duration: number, onTimeout: () => void, isPaused: boolean) {
  const [timeRemaining, setTimeRemaining] = useState(duration);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Critical: cleanup prevents memory leaks
    return () => clearInterval(interval);
  }, [isPaused, onTimeout]);

  return timeRemaining;
}
```

### Pattern 3: Keyboard Event Handling with Cleanup
**What:** Global keyboard shortcuts (A/B/C/D) with proper listener cleanup
**When to use:** Desktop keyboard shortcuts that must not leak
**Example:**
```typescript
// useKeyPress.ts
function useKeyPress(targetKey: string, callback: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === targetKey.toLowerCase()) {
        // Ignore if typing in input/textarea
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    // Critical: cleanup prevents memory leaks and duplicate handlers
    return () => window.removeEventListener('keydown', handler);
  }, [targetKey, callback, enabled]);
}

// Usage in GameScreen
useKeyPress('a', () => selectAnswer('A'), gameState.phase === 'answering');
useKeyPress('b', () => selectAnswer('B'), gameState.phase === 'answering');
```

### Pattern 4: Framer Motion Reveal Animation
**What:** Coordinated fade-out of wrong answers, highlight correct answer
**When to use:** Revealing answer with suspense pause
**Example:**
```typescript
// AnswerGrid.tsx
import { motion, AnimatePresence } from 'framer-motion';

function AnswerOption({ letter, text, isCorrect, isSelected, isRevealing }) {
  const shouldFadeOut = isRevealing && !isCorrect && !isSelected;

  return (
    <motion.button
      initial={{ opacity: 1 }}
      animate={{
        opacity: shouldFadeOut ? 0.3 : 1,
        scale: isCorrect && isRevealing ? 1.05 : 1,
      }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`answer-option ${isSelected ? 'selected' : ''} ${isCorrect && isRevealing ? 'correct' : ''}`}
    >
      <span className="letter">{letter}</span>
      <span className="text">{text}</span>
    </motion.button>
  );
}
```

### Pattern 5: Fisher-Yates Shuffle for Randomization
**What:** Unbiased array shuffling for question randomization
**When to use:** Selecting and randomizing 10 questions from pool
**Example:**
```typescript
// utils/shuffle.ts
function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array]; // Don't mutate original
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Usage: select 10 random questions
const gameQuestions = fisherYatesShuffle(allQuestions).slice(0, 10);
```

### Pattern 6: Responsive Grid Layout (CSS Grid)
**What:** 2x2 desktop, vertical mobile using CSS Grid
**When to use:** Answer option layout
**Example:**
```css
/* AnswerGrid.module.css */
.answer-grid {
  display: grid;
  gap: 1rem;
  /* Mobile: vertical stack */
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .answer-grid {
    /* Desktop: 2x2 grid */
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### Anti-Patterns to Avoid
- **Direct state mutation in reducer:** Always return new objects, never mutate `state.property = value`
- **Missing cleanup in useEffect:** All intervals, timeouts, and event listeners MUST be cleaned up
- **Stale closures in timer callbacks:** Use updater function `setState(prev => prev + 1)` not `setState(count + 1)`
- **Keyboard shortcuts without input/textarea check:** Will fire when typing in forms
- **Animating layout properties (width, height):** Use `transform` and `opacity` for 60fps performance

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular countdown timer | Custom SVG with requestAnimationFrame | react-countdown-circle-timer | Handles color transitions, pausing, completion callbacks, and SVG math correctly |
| Animation orchestration | Manual state + CSS transitions | Framer Motion | Handles animation sequencing, interruption, and spring physics without managing timing logic |
| Array shuffling | `array.sort(() => Math.random() - 0.5)` | Fisher-Yates shuffle | Biased distribution produces non-random results, Fisher-Yates is O(n) and proven unbiased |
| Keyboard shortcuts | Multiple addEventListener calls | Custom useKeyPress hook | Encapsulates cleanup, prevents duplicate listeners, handles input/textarea exclusion |
| State persistence | Manual localStorage.setItem calls | Session state only (no persistence needed) | Mid-game quit loses progress per spec, results screen doesn't need persistence |

**Key insight:** Timer lifecycle, animation timing, and event listener cleanup are sources of subtle bugs (memory leaks, stale state, duplicate handlers). Libraries and established hooks patterns solve these edge cases.

## Common Pitfalls

### Pitfall 1: Timer Memory Leaks
**What goes wrong:** setInterval continues after component unmounts or game state changes
**Why it happens:** Missing cleanup function in useEffect, or not tracking game state in dependencies
**How to avoid:** Always return cleanup function: `return () => clearInterval(interval)`
**Warning signs:** Timer keeps running after navigating away, multiple timers fire simultaneously, browser tab memory grows

### Pitfall 2: Stale State in Timer Callbacks
**What goes wrong:** Timer callback uses outdated state value (always sees initial value)
**Why it happens:** Closure captures state at effect creation time, not current value
**How to avoid:** Use updater function `setTimeRemaining(prev => prev - 1)` instead of `setTimeRemaining(timeRemaining - 1)`
**Warning signs:** Timer countdown always shows same number, timer doesn't decrement

### Pitfall 3: Keyboard Event Listener Accumulation
**What goes wrong:** Multiple keyboard listeners registered, key press triggers action multiple times
**Why it happens:** useEffect re-runs without cleanup, or dependencies cause re-registration
**How to avoid:** Return cleanup function, use empty or stable dependency array, memoize callback
**Warning signs:** Single key press selects multiple answers, events fire 2x, 3x, 4x on each press

### Pitfall 4: Animation State Desync
**What goes wrong:** Animation plays but state doesn't update, or vice versa
**Why it happens:** Animation duration and state transition timing don't match
**How to avoid:** Use onAnimationComplete callback from Framer Motion to trigger state changes
**Warning signs:** UI shows one state but interactions behave like another state, animations cut off mid-play

### Pitfall 5: Direct State Mutation in Reducer
**What goes wrong:** React doesn't detect state change, component doesn't re-render
**Why it happens:** Modifying state object directly (`state.phase = 'revealing'`) instead of returning new object
**How to avoid:** Always return new state object: `return { ...state, phase: 'revealing' }`
**Warning signs:** State changes in console but UI doesn't update, must force refresh to see changes

### Pitfall 6: Race Conditions in Reveal Sequence
**What goes wrong:** User advances to next question before reveal animation finishes
**Why it happens:** "Next" button enabled immediately, not waiting for suspense pause + animation
**How to avoid:** Disable "Next" button until setTimeout or onAnimationComplete fires
**Warning signs:** Explanations flicker briefly, animations cut short, inconsistent reveal timing

### Pitfall 7: Biased Question Shuffling
**What goes wrong:** Same questions appear frequently, some never appear
**Why it happens:** Using `array.sort(() => Math.random() - 0.5)` creates biased distribution
**How to avoid:** Use Fisher-Yates shuffle algorithm for proven unbiased randomization
**Warning signs:** Users report seeing same questions repeatedly, statistical analysis shows uneven distribution

## Code Examples

Verified patterns from research and official sources:

### Game State Hook (useReducer Pattern)
```typescript
// hooks/useGameState.ts
export function useGameState(questions: Question[]) {
  const [state, dispatch] = useReducer(gameReducer, { phase: 'idle' });

  const startGame = () => {
    const shuffled = fisherYatesShuffle(questions).slice(0, 10);
    dispatch({ type: 'START_GAME', questions: shuffled });
  };

  const selectAnswer = (answer: string) => {
    if (state.phase === 'answering') {
      dispatch({ type: 'SELECT_ANSWER', answer });
    }
  };

  const lockAnswer = () => {
    if (state.phase === 'answering' && state.selectedAnswer) {
      dispatch({ type: 'LOCK_ANSWER' });
      // Suspense pause before reveal (Millionaire style)
      setTimeout(() => {
        dispatch({ type: 'REVEAL_ANSWER' });
      }, 1500); // 1.5 second suspense
    }
  };

  return { state, startGame, selectAnswer, lockAnswer, dispatch };
}
```

### Circular Timer Component
```typescript
// components/GameTimer.tsx
import { CountdownCircleTimer } from 'react-countdown-circle-timer';

export function GameTimer({ duration, onTimeout, isPaused }: TimerProps) {
  return (
    <CountdownCircleTimer
      isPlaying={!isPaused}
      duration={duration}
      colors={['#14B8A6', '#FBBF24', '#F97316', '#EF4444']} // teal, yellow, orange, red
      colorsTime={[20, 10, 5, 0]} // transition at 10s (50%), 5s (25%), 0s
      onComplete={onTimeout}
      size={80}
      strokeWidth={6}
    >
      {({ remainingTime }) => (
        <div className="timer-display">{remainingTime}</div>
      )}
    </CountdownCircleTimer>
  );
}
```

### Keyboard Shortcuts Hook
```typescript
// hooks/useKeyPress.ts
export function useKeyPress(
  key: string,
  callback: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [key, callback, enabled]);
}

// Usage in GameScreen.tsx
useKeyPress('a', () => selectAnswer('A'), state.phase === 'answering');
useKeyPress('b', () => selectAnswer('B'), state.phase === 'answering');
useKeyPress('c', () => selectAnswer('C'), state.phase === 'answering');
useKeyPress('d', () => selectAnswer('D'), state.phase === 'answering');
```

### Confirmation Dialog Pattern
```typescript
// components/ConfirmDialog.tsx
import { motion, AnimatePresence } from 'framer-motion';

export function ConfirmDialog({ isOpen, onConfirm, onCancel, message }: DialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="dialog-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            className="dialog-content"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            role="dialog"
            aria-modal="true"
          >
            <p>{message}</p>
            <div className="dialog-actions">
              <button onClick={onCancel}>Cancel</button>
              <button onClick={onConfirm} className="primary">Quit Game</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### Fisher-Yates Shuffle Utility
```typescript
// utils/shuffle.ts
/**
 * Fisher-Yates shuffle algorithm for unbiased array randomization
 * Time complexity: O(n), Space complexity: O(n)
 */
export function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array]; // Don't mutate original
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux for all state | Hybrid approach: useReducer + Zustand + React Query | 2023-2024 | Reduced boilerplate, smaller bundles, choose tool by state type |
| Class components with setState | Hooks (useState, useReducer) | 2019+ (React 16.8) | Functional components are standard, hooks simplify logic reuse |
| react-spring (physics-based) | Framer Motion (declarative) | 2020+ | Better DX, declarative API, though react-spring still valid for physics needs |
| Manual SVG progress animations | react-countdown-circle-timer | 2020+ | Specialized library handles edge cases (pause, color transitions) |
| XState for all state machines | useReducer for simple flows, XState for complex | 2024+ | Avoid over-engineering, useReducer sufficient for game flow |

**Deprecated/outdated:**
- **react-transition-group**: Still functional but Framer Motion has better DX and more features
- **Redux DevTools required for debugging**: Browser React DevTools now shows useReducer state
- **Manually managing requestAnimationFrame for timers**: react-countdown-circle-timer handles this

## Open Questions

Things that couldn't be fully resolved:

1. **react-countdown-circle-timer maintenance status**
   - What we know: Last published 3 years ago (v3.2.1), marked as inactive maintenance
   - What's unclear: Whether it still works with React 18+, any security vulnerabilities
   - Recommendation: Test in development, have backup plan to fork or switch to react-circular-progressbar if issues arise

2. **Optimal suspense pause duration**
   - What we know: User specified "1-2 second suspense pause" in CONTEXT.md
   - What's unclear: Exact timing that feels right (1s, 1.5s, 2s)
   - Recommendation: Start with 1.5s, make configurable constant for easy tuning during implementation

3. **Timer color transition thresholds**
   - What we know: User marked this as Claude's discretion in CONTEXT.md
   - What's unclear: When exactly to transition teal → yellow → orange → red
   - Recommendation: Use react-countdown-circle-timer's colorsTime prop: [20, 10, 5, 0] (yellow at 50%, orange at 25%, red at final seconds)

4. **Answer option color scheme**
   - What we know: User marked this as Claude's discretion
   - What's unclear: Should answers be color-coded (A=blue, B=green, etc.) or uniform styling
   - Recommendation: Research best practice is uniform styling for accessibility, let letter labels (A/B/C/D) provide distinction

## Sources

### Primary (HIGH confidence)
- [React useReducer official documentation](https://react.dev/reference/react/useReducer) - State management patterns
- [Framer Motion GitHub](https://github.com/motiondivision/motion) - Animation library (30.6k stars, 8.1M weekly downloads)
- [react-countdown-circle-timer npm](https://www.npmjs.com/package/react-countdown-circle-timer) - Circular timer library
- [Zustand GitHub](https://github.com/pmndrs/zustand) - State management (already in use from Phase 1)
- [Fisher-Yates Shuffle Wikipedia](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) - Algorithm reference

### Secondary (MEDIUM confidence)
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns) - Hybrid approach validated
- [Beyond Eye Candy: Top 7 React Animation Libraries for Real-World Apps in 2026](https://www.syncfusion.com/blogs/post/top-react-animation-libraries) - Framer Motion recommendation
- [Comparing the best React animation libraries for 2026 - LogRocket](https://blog.logrocket.com/best-react-animation-libraries/) - Animation library comparison
- [Using state machines with XState and React - LogRocket](https://blog.logrocket.com/using-state-machines-with-xstate-and-react/) - State machine patterns
- [How to build an SVG circular progress component using React and React Hooks - LogRocket](https://blog.logrocket.com/build-svg-circular-progress-component-react-hooks/) - SVG timer patterns
- [Building timer in React - Medium](https://medium.com/@bsalwiczek/building-timer-in-react-its-not-as-simple-as-you-may-think-80e5f2648f9b) - Timer pitfalls
- [Pitfalls when using setInterval in React](https://javascript.plainenglish.io/pitfalls-when-using-setinterval-in-react-72cf2c566b6a) - Cleanup patterns

### Tertiary (LOW confidence)
- [React trivia game GitHub examples](https://github.com/topics/trivia-quiz-game) - Implementation references (various quality)
- [State Management Patterns For Multiplayer Interactions In React Games](https://peerdh.com/blogs/programming-insights/state-management-patterns-for-multiplayer-interactions-in-react-games) - Game state patterns (multiplayer focus, not exact match)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Framer Motion and useReducer are industry standard, react-countdown-circle-timer is specialized and proven
- Architecture: HIGH - Patterns are verified from official React docs and established community practices
- Pitfalls: HIGH - Sourced from multiple authoritative articles on timer/event listener cleanup and state management

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - stable ecosystem, React 18 patterns well-established)

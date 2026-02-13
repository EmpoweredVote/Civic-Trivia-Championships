# Phase 7: Polish & Performance - Research

**Researched:** 2026-02-12
**Domain:** Web Accessibility (WCAG AA), React Animation Performance, Game-Show UI Polish
**Confidence:** HIGH

## Summary

This phase combines three interrelated domains: WCAG 2.2 Level AA accessibility compliance, 60fps animation performance, and game-show aesthetic polish. The standard approach uses React's built-in accessibility features with ARIA enhancements, Framer Motion for GPU-accelerated animations, specialized confetti libraries for celebration effects, and React performance optimization patterns to maintain 60fps.

WCAG AA requires 4.5:1 contrast ratio for normal text, 3:1 for large text and UI components, full keyboard operability, proper screen reader announcements via ARIA live regions, and visible focus indicators with 3:1 contrast. React accessibility prioritizes semantic HTML over ARIA attributes, uses `focus-trap-react` for modal focus management, and implements keyboard handlers with `onKeyDown` (not the deprecated `onKeyPress`).

For animations, only `transform` (translate, scale, rotate) and `opacity` properties should be animated for GPU acceleration and 60fps performance. Framer Motion provides optimized motion components, but confetti effects require specialized libraries. `react-canvas-confetti` (3,900+ dependents) is the recommended choice over `react-confetti` because it uses canvas-confetti with preset animations and better performance characteristics. React performance optimization uses selective re-renders via `React.memo`, `useCallback`, and `useMemo`, with Zustand's fine-grained subscription model already providing automatic render optimization.

**Primary recommendation:** Build accessibility first using semantic HTML and keyboard navigation, then layer animations using only GPU-accelerated properties (transform/opacity), and optimize performance by preventing unnecessary re-renders and monitoring Web Vitals metrics.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| focus-trap-react | ^10.x | Modal focus management | Official focus-trap React wrapper, WCAG compliant, handles Tab/Shift+Tab cycling |
| react-canvas-confetti | ^2.x | Confetti celebrations | Canvas-based, preset animations (fireworks, explosion), 3,900+ dependents, better performance than CSS-based alternatives |
| web-vitals | ^4.x | Performance monitoring | Official Google Web Vitals library, measures LCP/INP/CLS, minimal overhead |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| eslint-plugin-jsx-a11y | ^6.x | Accessibility linting | Catches common a11y errors during development (missing alt text, ARIA misuse) |
| @axe-core/react | ^4.x | Runtime a11y testing | Development-only, reports violations to console |
| react-use | ^17.x | useWindowSize hook | For dynamic canvas sizing (confetti), includes debouncing and SSR support |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-canvas-confetti | react-confetti | CSS particles (200 pieces default) vs canvas presets; react-confetti requires manual physics tuning, react-canvas-confetti has ready-to-use celebration patterns |
| focus-trap-react | react-focus-lock | Both work well; focus-trap-react is official focus-trap wrapper with simpler API, react-focus-lock has additional features like focus auto-assignment |
| Inline ARIA live regions | react-aria-live | Manual DOM management vs component abstraction; inline gives more control, react-aria-live adds bundle size |

**Installation:**
```bash
npm install focus-trap-react react-canvas-confetti web-vitals
npm install --save-dev eslint-plugin-jsx-a11y @axe-core/react
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── accessibility/
│   │   ├── SkipToContent.tsx      # Skip link (first element in app)
│   │   ├── LiveRegion.tsx         # Polite and assertive announcement containers
│   │   └── FocusTrap.tsx          # Wrapper for modal focus management
│   ├── animations/
│   │   ├── ConfettiController.tsx # Canvas confetti conductor instance
│   │   └── CelebrationEffects.tsx # Streak/perfect game celebration logic
│   └── game/
│       ├── GameTimer.tsx          # Timer with ARIA live announcements
│       ├── AnswerButton.tsx       # Keyboard handlers (1-4, arrows, Enter)
│       └── PauseOverlay.tsx       # Escape key handler, hides question
├── hooks/
│   ├── useKeyboardNavigation.ts   # Arrow key navigation between answers
│   ├── useFocusManagement.ts      # Focus control for modals/overlays
│   ├── useWebVitals.ts            # Performance monitoring setup
│   └── useReducedMotion.ts        # Respect prefers-reduced-motion
└── utils/
    ├── announcements.ts           # Screen reader announcement helpers
    └── contrastChecker.ts         # WCAG AA contrast validation (dev only)
```

### Pattern 1: ARIA Live Regions for Screen Reader Announcements
**What:** Two persistent live regions (polite and assertive) rendered on mount, updated via state for announcements.

**When to use:** Timer thresholds ("10 seconds remaining"), answer feedback ("Correct! The answer is B"), error messages.

**Example:**
```typescript
// Source: MDN ARIA Live Regions + React patterns
// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions

// LiveRegion.tsx - Persistent containers
export const LiveRegions = () => {
  const { politeMessage, assertiveMessage } = useAnnouncementStore();

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </>
  );
};

// announcements.ts - Helper functions
export const announce = {
  polite: (message: string) => {
    // Update polite live region via Zustand store
    useAnnouncementStore.setState({ politeMessage: message });
    // Clear after 1s to allow re-announcements of same message
    setTimeout(() => {
      useAnnouncementStore.setState({ politeMessage: '' });
    }, 1000);
  },
  assertive: (message: string) => {
    useAnnouncementStore.setState({ assertiveMessage: message });
    setTimeout(() => {
      useAnnouncementStore.setState({ assertiveMessage: '' });
    }, 1000);
  }
};

// Usage in GameTimer.tsx
useEffect(() => {
  if (timeRemaining === 10) {
    announce.polite('10 seconds remaining');
  } else if (timeRemaining === 5) {
    announce.polite('5 seconds remaining');
  } else if (timeRemaining === 0) {
    announce.assertive("Time's up");
  }
}, [timeRemaining]);

// Usage after answer reveal
const handleReveal = (isCorrect: boolean, answer: string, points: number) => {
  if (isCorrect) {
    announce.polite(`Correct! The answer is ${answer}. You earned ${points} points.`);
  } else {
    announce.polite(`Incorrect. The correct answer was ${answer}.`);
  }
};
```

### Pattern 2: Keyboard Navigation with Event Handlers
**What:** `onKeyDown` handlers on interactive elements supporting both arrow navigation + Enter and direct number selection (1-4).

**When to use:** Answer selection, accordion toggles, slider adjustments, modal close.

**Example:**
```typescript
// Source: React accessibility best practices, WCAG keyboard operability
// https://legacy.reactjs.org/docs/accessibility.html

// AnswerButton.tsx
interface AnswerButtonProps {
  index: number; // 0-3
  text: string;
  onSelect: () => void;
  isSelected: boolean;
  isFocused: boolean;
  onNavigate: (direction: 'up' | 'down') => void;
}

const AnswerButton = ({ index, text, onSelect, isSelected, isFocused, onNavigate }: AnswerButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null);

  // Auto-focus when isFocused changes (from arrow navigation)
  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        onNavigate('down');
        break;
      case 'ArrowUp':
        e.preventDefault();
        onNavigate('up');
        break;
      case 'Enter':
      case ' ': // Space bar
        e.preventDefault();
        onSelect();
        break;
      case '1':
      case '2':
      case '3':
      case '4':
        // Direct selection - only if this answer matches the number
        if (parseInt(e.key) - 1 === index) {
          e.preventDefault();
          onSelect();
        }
        break;
    }
  };

  return (
    <button
      ref={ref}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      className={cn(
        'answer-button',
        isSelected && 'selected',
        'focus-ring' // Custom focus ring class
      )}
    >
      <span aria-hidden="true">{index + 1}.</span>
      {text}
    </button>
  );
};

// WagerSlider.tsx - Range input keyboard support
const WagerSlider = ({ value, onChange, max }: WagerSliderProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        onChange(Math.max(0, value - 10));
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        onChange(Math.min(max, value + 10));
        break;
      case 'PageDown':
        e.preventDefault();
        onChange(Math.max(0, value - 50));
        break;
      case 'PageUp':
        e.preventDefault();
        onChange(Math.min(max, value + 50));
        break;
    }
  };

  return (
    <input
      type="range"
      min={0}
      max={max}
      step={10}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      onKeyDown={handleKeyDown}
      aria-label="Wager amount"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} points`}
    />
  );
};
```

### Pattern 3: Focus Trap for Modals
**What:** Wrap modal content in `<FocusTrap>` component to cycle Tab focus within modal, auto-focus first element on open.

**When to use:** Learn More modal, pause overlay, any temporary overlay requiring focus containment.

**Example:**
```typescript
// Source: focus-trap-react documentation
// https://github.com/focus-trap/focus-trap-react

import FocusTrap from 'focus-trap-react';

// LearnMoreModal.tsx
const LearnMoreModal = ({ isOpen, onClose, children }: ModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <FocusTrap
        focusTrapOptions={{
          initialFocus: () => closeButtonRef.current!, // Auto-focus close button
          escapeDeactivates: true, // Allow Escape to close
          clickOutsideDeactivates: true,
          returnFocusOnDeactivate: true, // Return to trigger element
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={(e) => e.stopPropagation()}
          className="modal-content"
        >
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close modal"
            className="close-button"
          >
            ×
          </button>
          <h2 id="modal-title">Learn More</h2>
          {children}
        </div>
      </FocusTrap>
    </div>
  );
};

// PauseOverlay.tsx - Escape key pauses, shows overlay with focus trap
const PauseOverlay = ({ onResume, onQuit }: PauseOverlayProps) => {
  return (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: '#resume-button',
        escapeDeactivates: false, // Prevent Escape from closing (first press paused, second shouldn't unpause)
      }}
    >
      <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        {/* Question text hidden to prevent extra reading time */}
        <h2 id="pause-title">Paused</h2>
        <button id="resume-button" onClick={onResume}>Resume</button>
        <button onClick={onQuit}>Quit Game</button>
      </div>
    </FocusTrap>
  );
};
```

### Pattern 4: GPU-Accelerated Animations with Framer Motion
**What:** Animate only `transform` and `opacity` properties using Framer Motion's motion components for 60fps performance.

**When to use:** Score counters, streak celebrations, question transitions, answer reveal animations.

**Example:**
```typescript
// Source: Framer Motion performance best practices
// https://motion.dev/docs/performance (via web search findings)

import { motion, useMotionValue, useSpring } from 'framer-motion';

// Score counter (already exists, verified pattern)
const ScoreDisplay = ({ score }: { score: number }) => {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    stiffness: 100,
    damping: 30
  });

  useEffect(() => {
    motionValue.set(score);
  }, [score, motionValue]);

  return (
    <motion.div className="score">
      {Math.round(springValue.get())}
    </motion.div>
  );
};

// Streak celebration - escalating effects
const StreakCelebration = ({ streak }: { streak: number }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (streak === 3 || streak === 5 || streak >= 7) {
      setShow(true);
      setTimeout(() => setShow(false), 2000);
    }
  }, [streak]);

  if (!show) return null;

  const intensity = streak === 3 ? 'small' : streak === 5 ? 'medium' : 'large';
  const label = streak === 5 ? 'On Fire!' : streak >= 7 ? 'Unstoppable!' : '';

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className={`streak-celebration ${intensity}`}
    >
      {label && (
        <motion.span
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {label}
        </motion.span>
      )}
    </motion.div>
  );
};

// Answer button feedback - transform only
const AnswerButton = ({ isCorrect, revealed }: ButtonProps) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }} // GPU-accelerated
      whileTap={{ scale: 0.98 }}
      animate={revealed ? {
        // Don't animate background color, use CSS class
        scale: isCorrect ? 1.05 : 1,
      } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'answer-button',
        revealed && isCorrect && 'correct',
        revealed && !isCorrect && 'incorrect'
      )}
    >
      {/* Icon changes via CSS class, not animated property */}
    </motion.button>
  );
};
```

### Pattern 5: Confetti Celebrations with Presets
**What:** Use `react-canvas-confetti` conductor pattern with preset animations for different celebration levels.

**When to use:** Perfect game (10/10), high streak (7+), maybe 5-streak. NOT for every correct answer.

**Example:**
```typescript
// Source: react-canvas-confetti documentation
// https://github.com/ulitcos/react-canvas-confetti

import ReactCanvasConfetti from 'react-canvas-confetti';
import { useWindowSize } from 'react-use';

// ConfettiController.tsx - Single canvas, multiple presets
const ConfettiController = () => {
  const { width, height } = useWindowSize(); // Debounced by default
  const conductorRef = useRef<any>(null);

  // Expose methods to Zustand store or context
  useEffect(() => {
    if (conductorRef.current) {
      confettiStore.setState({
        fireSmallBurst: () => conductorRef.current?.shoot(),
        fireBigBurst: () => conductorRef.current?.run({ speed: 3, duration: 1000 }),
        fireConfettiRain: () => conductorRef.current?.run({ speed: 1, duration: 5000 }),
      });
    }
  }, []);

  return (
    <ReactCanvasConfetti
      width={width}
      height={height}
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
      conductor={{
        instance: (instance) => {
          conductorRef.current = instance;
        },
        preset: 'fireworks', // Options: fireworks, crossfire, snow, realistic, explosion, pride
      }}
    />
  );
};

// ResultsScreen.tsx - Perfect game celebration
const ResultsScreen = ({ score, totalQuestions }: ResultsProps) => {
  const isPerfectGame = score === totalQuestions;
  const { fireConfettiRain } = confettiStore();

  useEffect(() => {
    if (isPerfectGame) {
      fireConfettiRain();
      announce.polite('Perfect game! You answered all questions correctly!');
    }
  }, [isPerfectGame, fireConfettiRain]);

  return (
    <div className={cn('results', isPerfectGame && 'perfect-game')}>
      {/* Golden treatment already exists */}
    </div>
  );
};

// GameScreen.tsx - Streak celebrations
const GameScreen = () => {
  const streak = useGameStore((s) => s.currentStreak);
  const { fireSmallBurst, fireBigBurst } = confettiStore();

  useEffect(() => {
    if (streak === 3) {
      fireSmallBurst();
    } else if (streak === 5) {
      fireBigBurst();
      announce.polite('On Fire! 5 in a row!');
    } else if (streak === 7) {
      fireBigBurst();
      announce.polite('Unstoppable! 7 in a row!');
    }
  }, [streak, fireSmallBurst, fireBigBurst]);

  return (/* game UI */);
};
```

### Pattern 6: Custom Focus Rings
**What:** Custom `:focus-visible` styles using `box-shadow` for game-show theme (teal/amber glow) with WCAG AA contrast.

**When to use:** All interactive elements - buttons, links, inputs, custom controls.

**Example:**
```typescript
// Source: WCAG focus indicator guidelines + CSS best practices
// https://www.sarasoueidan.com/blog/focus-indicators/

// globals.css or tailwind.config.js
// Using box-shadow instead of outline for rounded elements

/* Base focus ring - teal glow */
.focus-ring:focus-visible {
  outline: none; /* Remove default */
  box-shadow:
    0 0 0 3px hsl(var(--background)), /* Gap */
    0 0 0 5px hsl(174 84% 50%), /* Teal ring (3:1 contrast with background) */
    0 0 20px hsl(174 84% 50% / 0.5); /* Glow effect */
}

/* Amber focus ring for primary actions */
.focus-ring-primary:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px hsl(var(--background)),
    0 0 0 5px hsl(43 96% 56%), /* Amber ring */
    0 0 20px hsl(43 96% 56% / 0.5);
}

/* For inputs and text fields */
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px hsl(174 84% 50%),
    0 0 10px hsl(174 84% 50% / 0.3);
}

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .focus-ring:focus-visible,
  .focus-ring-primary:focus-visible {
    box-shadow:
      0 0 0 3px hsl(var(--background)),
      0 0 0 5px hsl(174 84% 50%);
    /* Remove glow animation */
  }
}

// Tailwind plugin for focus rings
// tailwind.config.js
module.exports = {
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.focus-ring': {
          '&:focus-visible': {
            outline: 'none',
            boxShadow: '0 0 0 3px hsl(var(--background)), 0 0 0 5px hsl(174 84% 50%), 0 0 20px hsl(174 84% 50% / 0.5)',
          }
        },
        '.focus-ring-primary': {
          '&:focus-visible': {
            outline: 'none',
            boxShadow: '0 0 0 3px hsl(var(--background)), 0 0 0 5px hsl(43 96% 56%), 0 0 20px hsl(43 96% 56% / 0.5)',
          }
        }
      });
    }
  ]
};
```

### Pattern 7: Performance Optimization for Animations
**What:** Prevent unnecessary re-renders during animations using `React.memo`, `useCallback`, and selective Zustand subscriptions.

**When to use:** Components that animate frequently (timer, score), child components of animated parents.

**Example:**
```typescript
// Source: React performance optimization best practices
// https://react.dev/reference/react/memo

// Timer component - re-renders every second
const GameTimer = memo(({ timeRemaining, onTimeUp }: TimerProps) => {
  // Only this component re-renders, not siblings

  const handleTimeUp = useCallback(() => {
    onTimeUp();
  }, [onTimeUp]);

  useEffect(() => {
    if (timeRemaining === 0) {
      handleTimeUp();
    }
  }, [timeRemaining, handleTimeUp]);

  // Timer color via CSS class (not inline style) to avoid style object recreation
  const timerClass = cn(
    'timer',
    timeRemaining <= 5 && 'critical',
    timeRemaining <= 10 && timeRemaining > 5 && 'warning'
  );

  return (
    <motion.div
      className={timerClass}
      animate={{ scale: timeRemaining <= 5 ? [1, 1.1, 1] : 1 }}
      transition={{ repeat: timeRemaining <= 5 ? Infinity : 0, duration: 0.5 }}
    >
      {timeRemaining}s
    </motion.div>
  );
}, (prev, next) => {
  // Custom comparison - only re-render if time changed
  return prev.timeRemaining === next.timeRemaining;
});

// AnswerList - don't re-render when timer updates
const AnswerList = memo(({ answers, onSelect }: AnswerListProps) => {
  // Zustand selective subscription - only subscribes to answers, not timer
  const selectedAnswer = useGameStore((s) => s.selectedAnswer);
  const isRevealed = useGameStore((s) => s.isRevealed);

  // Callbacks wrapped to prevent recreation
  const handleSelect = useCallback((index: number) => {
    onSelect(index);
  }, [onSelect]);

  return (
    <div className="answer-list">
      {answers.map((answer, index) => (
        <AnswerButton
          key={index}
          index={index}
          text={answer}
          onSelect={() => handleSelect(index)}
          isSelected={selectedAnswer === index}
          isRevealed={isRevealed}
        />
      ))}
    </div>
  );
});

// Zustand store - fine-grained subscriptions
// gameStore.ts
export const useGameStore = create<GameState>((set) => ({
  timeRemaining: 25,
  currentQuestion: 0,
  selectedAnswer: null,
  isRevealed: false,
  // ... other state
}));

// Component only subscribes to what it needs
const Timer = () => {
  // Only re-renders when timeRemaining changes
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  return <GameTimer timeRemaining={timeRemaining} />;
};

const QuestionDisplay = () => {
  // Only re-renders when currentQuestion changes, NOT when timer ticks
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const question = questions[currentQuestion];
  return <div>{question.text}</div>;
};
```

### Anti-Patterns to Avoid
- **ARIA overuse:** Don't add ARIA to semantic HTML that already has correct meaning (e.g., `role="button"` on `<button>`). Semantic HTML first, ARIA only when necessary.
- **Color-only indicators:** Never rely solely on color for meaning (red/green). Always pair with icons, text labels, or shape changes.
- **Animating layout properties:** Never animate `width`, `height`, `top`, `left`, `margin`, or `padding`. These trigger layout recalculation and kill performance. Use `transform: scale()` and `transform: translate()` instead.
- **Inline style objects in render:** Recreating style objects on every render breaks memoization. Use CSS classes or useMemo for style objects.
- **Background confetti on every action:** Confetti should be reserved for meaningful achievements (streaks, perfect game). Overuse creates visual noise and degrades performance.
- **Removing focus indicators:** Never set `outline: none` without providing an alternative. Use `:focus-visible` to show indicators for keyboard navigation while hiding them for mouse clicks.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trapping in modals | Custom Tab key handler with querySelectorAll | focus-trap-react | Edge cases: nested tabbable elements, display:none elements, dynamically added elements, Shadow DOM, iframe handling, initial focus, return focus on close |
| Confetti animations | CSS particles with manual physics | react-canvas-confetti | Canvas rendering outperforms CSS for 200+ particles, preset animations are battle-tested, physics calculations (gravity, wind, friction) are complex, particle lifecycle management |
| Screen reader announcements | Direct DOM manipulation of hidden divs | ARIA live regions with React state | Timing issues with DOM updates, browsers don't announce empty-to-empty transitions, need to clear and re-set for duplicate announcements, ARIA atomic and relevant attributes are tricky |
| Contrast checking | Manual color calculations | Browser DevTools or online checkers | WCAG algorithm for relative luminance is non-trivial, must account for alpha transparency, different formulas for text size thresholds |
| Window resize handling | Raw addEventListener('resize') | react-use's useWindowSize | Needs debouncing (100ms standard), cleanup on unmount, SSR compatibility, initial value on mount, avoid layout thrashing |
| Performance monitoring | Custom timing measurements | web-vitals library | Accurate field measurements require PerformanceObserver API, buffering entries, handling multiple interactions, complex CLS calculation across page lifecycle |

**Key insight:** Accessibility and performance are domains with many edge cases that aren't obvious until production. WCAG compliance requires testing across screen readers (NVDA, JAWS, VoiceOver), browsers, and devices. Animation performance varies wildly across devices and browsers. Use battle-tested libraries that have handled these edge cases through years of real-world usage.

## Common Pitfalls

### Pitfall 1: ARIA Live Region Not Announcing Updates
**What goes wrong:** Screen reader doesn't announce when state changes update the live region content.

**Why it happens:** Browsers only announce changes when the text content actually changes. Setting empty string to the same empty string doesn't trigger. Also, announcements may be missed if they happen too quickly in succession.

**How to avoid:**
1. Mount live regions once on app load, keep them in the DOM permanently
2. Use a "clear then set" pattern with setTimeout to ensure text change is detected
3. Add 100ms delay between announcements to prevent screen readers from dropping messages
4. Use `aria-atomic="true"` to announce the entire region content, not just the changed part

**Warning signs:** Testing with screen reader and not hearing expected announcements, messages appearing in DOM inspector but not being spoken.

### Pitfall 2: Animation Jank at 30fps Instead of 60fps
**What goes wrong:** Animations stutter or feel sluggish despite using Framer Motion.

**Why it happens:** Animating CSS properties that trigger layout (width, height, top, left) or paint (background-color, border) instead of composite-only properties (transform, opacity). Browser must recalculate layout for entire document tree, repaint affected areas, and composite layers - too slow for 60fps.

**How to avoid:**
1. Only animate `transform` (translate, scale, rotate, skew) and `opacity`
2. For color changes, use CSS classes that transition instantly or cross-fade with opacity
3. For size changes, use `transform: scale()` even if it's not pixel-perfect
4. Use Chrome DevTools Performance tab to identify layout thrashing (long purple bars)
5. Enable "Paint flashing" in DevTools to see what's being repainted

**Warning signs:** Animations feel choppy on mid-range devices, Performance tab shows >16ms frames (60fps = 16.67ms per frame), excessive layout/paint activity in timeline.

### Pitfall 3: Focus Trap Activating on Component Mount Instead of User Action
**What goes wrong:** Focus trap activates when modal component mounts but before it's visible, trapping focus in hidden modal or causing focus to jump unexpectedly.

**Why it happens:** FocusTrap component activates immediately on mount by default. If modal renders but isn't visible yet (opacity: 0, animation in progress), focus gets trapped in invisible container.

**How to avoid:**
1. Don't render FocusTrap component until modal is truly open (if-statement, not CSS visibility)
2. Or use FocusTrap's `active` prop tied to visibility state
3. Ensure initial focus target is visible and focusable when trap activates
4. Use `returnFocusOnDeactivate: true` to return focus to trigger element on close

**Warning signs:** Focus disappears when opening modal, Tab key doesn't work until clicking somewhere, focus jumps to unexpected element on close.

### Pitfall 4: Keyboard Events Not Firing on Non-Interactive Elements
**What goes wrong:** `onKeyDown` handler on a `<div>` doesn't fire when user presses keys.

**Why it happens:** Non-interactive elements (div, span, etc.) aren't focusable by default and don't receive keyboard events. Only elements that can receive focus will trigger keyboard events.

**How to avoid:**
1. Use semantic interactive elements when possible (button, a, input)
2. If custom element is necessary, add `tabIndex={0}` to make it focusable
3. Add appropriate ARIA role (`role="button"`, `role="listbox"`, etc.)
4. Implement full keyboard support for that role (e.g., buttons need Space and Enter)
5. Provide visible focus indicator

**Warning signs:** Handler works with onClick but not onKeyDown, Tab key skips over the element.

### Pitfall 5: Timer Extension Not Applied Proportionally
**What goes wrong:** User selects 1.5x timer extension but final question still gets 50s instead of 75s.

**Why it happens:** Hardcoded duration values in component instead of reading from calculated base * multiplier.

**How to avoid:**
1. Store base durations as constants (REGULAR_QUESTION_DURATION = 25, FINAL_QUESTION_DURATION = 50)
2. Read timer multiplier from user preferences (stored in profile)
3. Calculate duration on timer initialization: `duration = baseTime * multiplier`
4. Apply same multiplier to ALL timed elements (question preview, auto-advance, etc.)

**Warning signs:** User reports extension not working on final question, inconsistent timing between regular and final questions.

### Pitfall 6: Confetti Canvas Not Resizing on Window Resize
**What goes wrong:** Confetti particles only appear in top-left corner after browser window resize, or canvas is blank.

**Why it happens:** Canvas width/height are set on mount but don't update when window dimensions change. Canvas intrinsic size doesn't match CSS size, causing rendering issues.

**How to avoid:**
1. Use `useWindowSize()` hook from react-use (includes debouncing)
2. Pass `width={width}` and `height={height}` props to canvas component
3. Don't use CSS width/height on canvas - use explicit props
4. Set canvas style to `position: fixed` with `width: 100%`, `height: 100%` for overlay

**Warning signs:** Confetti stops after resize, particles only in corner, canvas appears stretched or squashed.

### Pitfall 7: Color Contrast Failing WCAG AA After Dark Mode
**What goes wrong:** Colors that pass contrast check in light mode fail in dark mode, or vice versa.

**Why it happens:** Same color values used for both themes, but contrast ratio depends on both foreground AND background. A color with 4.5:1 contrast on white might have 2:1 on dark background.

**How to avoid:**
1. Test contrast for BOTH themes separately
2. Use CSS custom properties/Tailwind theme variants to define different shades per theme
3. Use browser DevTools color picker to check contrast ratio
4. Test decorative elements too (borders, dividers) - they need 3:1 for UI components
5. Check focus indicators specifically - 3:1 contrast with adjacent colors

**Warning signs:** Complaints about readability in dark mode, accessibility audit failures for contrast in one theme but not the other.

## Code Examples

Verified patterns from official sources:

### Skip to Content Link
```typescript
// Source: WebAIM skip navigation patterns
// https://webaim.org/techniques/skipnav/

// App.tsx - First element after <body>
const App = () => {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <Navigation />
      <main id="main-content" tabIndex={-1}>
        {/* tabIndex={-1} allows programmatic focus but keeps element out of tab order */}
        <Routes />
      </main>
    </>
  );
};

// globals.css - Hide off-screen, show on focus
.skip-link {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
  z-index: 9999;
}

.skip-link:focus {
  position: fixed;
  top: 10px;
  left: 10px;
  width: auto;
  height: auto;
  padding: 0.5rem 1rem;
  background: hsl(174 84% 50%);
  color: hsl(0 0% 0%);
  border-radius: 0.25rem;
  text-decoration: none;
  font-weight: 600;
  box-shadow: 0 0 0 3px hsl(0 0% 100%), 0 0 0 5px hsl(174 84% 50%);
}
```

### Escape Key Handler for Pause
```typescript
// Source: React keyboard event handling best practices
// https://legacy.reactjs.org/docs/accessibility.html

// GameScreen.tsx - Global escape handler
const GameScreen = () => {
  const [isPaused, setIsPaused] = useState(false);
  const { pauseTimer, resumeTimer } = useGameStore();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isPaused) {
          // Second escape could resume, but requirement says use Resume button
          // So do nothing, or close pause menu
          return;
        } else {
          setIsPaused(true);
          pauseTimer();
          announce.polite('Game paused');
        }
      }
    };

    // Global listener during gameplay
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isPaused, pauseTimer]);

  return (
    <>
      {/* Game UI */}
      {isPaused && (
        <PauseOverlay
          onResume={() => {
            setIsPaused(false);
            resumeTimer();
            announce.polite('Game resumed');
          }}
          onQuit={() => {
            navigate('/');
          }}
        />
      )}
    </>
  );
};
```

### WCAG AA Contrast Checker (Dev Tool)
```typescript
// Source: WCAG 2.1 contrast algorithm
// https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

// utils/contrastChecker.ts - Development-only validation
export const checkContrast = (foreground: string, background: string): {
  ratio: number;
  wcagAA: boolean;
  wcagAALarge: boolean;
} => {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Calculate relative luminance
  const getLuminance = (rgb: {r: number, g: number, b: number}) => {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      const sRGB = val / 255;
      return sRGB <= 0.03928
        ? sRGB / 12.92
        : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  if (!fg || !bg) {
    throw new Error('Invalid hex color');
  }

  const fgLuminance = getLuminance(fg);
  const bgLuminance = getLuminance(bg);

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    wcagAA: ratio >= 4.5, // Normal text
    wcagAALarge: ratio >= 3, // Large text (18pt+) and UI components
  };
};

// Usage in development
if (process.env.NODE_ENV === 'development') {
  const result = checkContrast('#0ea5e9', '#0f172a'); // Sky-500 on Slate-900
  console.log(`Contrast ratio: ${result.ratio}:1`);
  console.log(`WCAG AA (normal text): ${result.wcagAA ? 'PASS' : 'FAIL'}`);
  console.log(`WCAG AA (large text): ${result.wcagAALarge ? 'PASS' : 'FAIL'}`);
}
```

### Web Vitals Monitoring Setup
```typescript
// Source: web-vitals library documentation
// https://github.com/GoogleChrome/web-vitals

// hooks/useWebVitals.ts
import { onCLS, onINP, onLCP } from 'web-vitals';

export const useWebVitals = () => {
  useEffect(() => {
    // Only in production
    if (process.env.NODE_ENV !== 'production') return;

    const handleCLS = (metric: any) => {
      console.log('CLS:', metric.value); // Send to analytics
      // CLS should be < 0.1
      if (metric.value > 0.1) {
        console.warn('CLS exceeds threshold:', metric.value);
      }
    };

    const handleINP = (metric: any) => {
      console.log('INP:', metric.value); // Send to analytics
      // INP should be < 200ms
      if (metric.value > 200) {
        console.warn('INP exceeds threshold:', metric.value);
      }
    };

    const handleLCP = (metric: any) => {
      console.log('LCP:', metric.value); // Send to analytics
      // LCP should be < 2500ms
      if (metric.value > 2500) {
        console.warn('LCP exceeds threshold:', metric.value);
      }
    };

    onCLS(handleCLS);
    onINP(handleINP);
    onLCP(handleLCP);
  }, []);
};

// App.tsx
const App = () => {
  useWebVitals(); // Monitor performance
  return <Routes />;
};
```

### Reduced Motion Preference
```typescript
// Source: prefers-reduced-motion media query
// https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

// hooks/useReducedMotion.ts
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// Usage in animations
const AnimatedComponent = () => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ x: 100 }}
      transition={reducedMotion ? { duration: 0 } : { type: 'spring' }}
    >
      {/* Content */}
    </motion.div>
  );
};

// Or disable animations entirely
const CelebrationEffect = () => {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className="celebration-static">🎉</div>; // Static icon
  }

  return <ConfettiAnimation />; // Full animation
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| onKeyPress event | onKeyDown event | Deprecated in React 17 (2020) | onKeyPress doesn't fire for non-character keys (arrows, Escape, etc.). All keyboard handling should use onKeyDown. |
| Separate ARIA live libraries | Native ARIA live regions | 2020-2021 | React state management works seamlessly with ARIA attributes. No need for wrapper libraries - just persistent DOM elements with aria-live. |
| FID (First Input Delay) | INP (Interaction to Next Paint) | WCAG 3.0 / Web Vitals 2024 | INP captures full interaction latency (including event processing and rendering), not just input delay. More accurate measure of responsiveness. |
| CSS-in-JS for animations | Framer Motion with CSS classes | 2022-2023 | Runtime CSS-in-JS overhead hurts animation performance. Framer Motion handles transforms/opacity, CSS classes handle colors/borders. |
| Manual color contrast calculation | Browser DevTools built-in | 2021-2022 | Chrome/Firefox DevTools now show contrast ratio in color picker with WCAG pass/fail. No need for manual checking in most cases. |
| React.lazy for code splitting | Vite automatic code splitting | 2023-2024 | Vite intelligently splits chunks based on imports. Manual React.lazy still useful for route-level splitting but less critical for performance. |

**Deprecated/outdated:**
- **onKeyPress:** Deprecated in React 17, doesn't work reliably for special keys. Use onKeyDown exclusively.
- **role="button" on <div>:** Use semantic <button> instead. Semantic HTML is always preferred over ARIA.
- **componentWillMount for focus management:** Removed in React 17. Use useEffect for focus side effects.
- **Animating auto height:** `height: auto` can't be animated. Old workaround was max-height transition, new approach is Framer Motion's layout animations.

## Open Questions

Things that couldn't be fully resolved:

1. **Framer Motion latest version and API changes**
   - What we know: Framer Motion was rebranded to "Motion" (motion.dev), still uses same npm package name, focuses on 60fps animation
   - What's unclear: Exact current version number (likely v11.x based on 2026 timeline), whether API has breaking changes from v10
   - Recommendation: Install with `npm install framer-motion` and check installed version. Existing patterns (useMotionValue, useSpring, motion.div) are stable across versions. Consult migration guide if breaking changes exist.

2. **react-canvas-confetti exact preset names**
   - What we know: Library supports presets including "fireworks", "crossfire", "snow", "realistic", "explosion", "pride", and others
   - What's unclear: Full list of available presets, exact parameter names for customization, whether new presets were added in recent versions
   - Recommendation: Install library and reference TypeScript types or documentation. Start with "fireworks" preset (confirmed in research) for perfect game, "explosion" for high streaks. Adjust speed/duration parameters rather than switching presets if effect doesn't feel right.

3. **Touch target size enforcement**
   - What we know: WCAG AA requires minimum 48px touch targets (per requirement A11Y-05)
   - What's unclear: Whether this applies to answer buttons which are already large, or just small UI elements (close buttons, icons)
   - Recommendation: Measure all interactive elements. Answer buttons likely already meet 48px threshold. Focus on: close buttons (must be at least 48x48px), wager slider handle, small navigation elements, profile settings toggles. Use CSS min-width/min-height or padding to ensure compliance.

4. **Question transition animation specifics**
   - What we know: User marked this as "Claude's discretion", should match game-show feel
   - What's unclear: Whether transitions should be dramatic (full-screen slide/fade) or subtle (cross-fade), timing (instant after reveal auto-advance or separate transition phase)
   - Recommendation: Test two options - (A) simple cross-fade with 300ms duration during the 6s auto-advance period, (B) slide transition with question exiting left and new question entering from right (500ms). Choose based on feel during implementation. Ensure animation doesn't delay gameplay - transition should complete before options appear.

5. **Timer extension setting persistence layer**
   - What we know: Setting stored as user preference, located on profile page, applies to all questions proportionally
   - What's unclear: Whether this is stored in database (requires user account) or localStorage (works for guest play)
   - Recommendation: If user authentication exists, store in user profile table as `timerMultiplier` field (1.0, 1.5, or 2.0). If guest play is supported, use localStorage fallback with same key. Load on app mount and apply to all timer initializations.

## Sources

### Primary (HIGH confidence)
- React Official Accessibility Docs: https://legacy.reactjs.org/docs/accessibility.html
- WCAG 2.1 Contrast Minimum Understanding: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html (via WebSearch)
- MDN ARIA Live Regions: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions (via WebSearch)
- react-confetti GitHub: https://github.com/alampros/react-confetti
- react-canvas-confetti GitHub: https://github.com/ulitcos/react-canvas-confetti
- focus-trap-react GitHub: https://github.com/focus-trap/focus-trap-react (via WebSearch)
- web-vitals GitHub: https://github.com/GoogleChrome/web-vitals (via WebSearch)

### Secondary (MEDIUM confidence)
- WebAIM Skip Navigation Links: https://webaim.org/techniques/skipnav/ (via WebSearch)
- Sara Soueidan Focus Indicators Guide: https://www.sarasoueidan.com/blog/focus-indicators/ (via WebSearch)
- LogRocket React Animation Libraries 2026: https://blog.logrocket.com/best-react-animation-libraries/ (via WebSearch)
- AllAccessible WCAG 2.4.13 Focus Appearance: https://www.allaccessible.org/blog/wcag-2413-focus-appearance-guide (via WebSearch)
- Motion Performance Guide (mentioned in search results): https://motion.dev/docs/performance (URL confirmed but content not fully retrieved)
- React Performance with Web Vitals 2025: https://medium.com/@mernstackdevbykevin/react-performance-monitoring-with-web-vitals-the-2025-developers-guide-661559271932 (via WebSearch)

### Tertiary (LOW confidence)
- A11Y Collective ARIA Live Regions: https://www.a11y-collective.com/blog/aria-live/ (via WebSearch - practice guidance)
- Josh Comeau useMemo and useCallback: https://www.joshwcomeau.com/react/usememo-and-usecallback/ (via WebSearch - educational content)
- Zigpoll Complex Animations Performance: https://www.zigpoll.com/content/can-you-explain-the-best-practices-for-optimizing-web-performance-when-implementing-complex-animations-in-react (via WebSearch)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries verified via official repositories and npm package pages, usage patterns confirmed in documentation
- Architecture: HIGH - Patterns based on official React accessibility docs, WCAG 2.1 specifications, and verified library documentation
- Pitfalls: MEDIUM - Common issues identified through WebSearch of developer experiences, some based on official documentation warnings, not all personally encountered

**Research date:** 2026-02-12
**Valid until:** 2026-03-15 (30 days - accessibility standards are stable, animation libraries update frequently but patterns remain consistent)

**Additional notes:**
- Framer Motion/Motion rebranding may have recent changes - verify API in implementation
- WCAG 2.2 is current standard as of 2023, WCAG 3.0 in development but not yet required
- All keyboard navigation patterns should be tested with actual screen readers (NVDA on Windows, VoiceOver on macOS)
- Focus ring contrast requirements tightened in WCAG 2.2 (3:1 minimum with adjacent colors)
- Performance targets (60fps, Web Vitals thresholds) are Google recommendations, not strict requirements, but represent user experience benchmarks

# Phase 4: Learning & Content - Research

**Researched:** 2026-02-12
**Domain:** Educational content modals, tooltips, timer control, AI content generation
**Confidence:** HIGH

## Summary

Phase 4 adds educational depth to the trivia game through "Learn More" modals, auto-showing tooltips with teasers, and AI-generated content stored as static data. The research reveals a mature ecosystem for accessible modal dialogs in React, with the project's existing Headless UI + Tailwind + Framer Motion stack being the ideal combination for this feature.

The core pattern involves: (1) Headless UI Dialog for accessibility and focus management, (2) Framer Motion's AnimatePresence for smooth transitions, (3) auto-dismiss tooltips using setTimeout patterns, (4) timer pause/resume via state flags, and (5) AI-generated content at build time using TypeScript scripts that call LLM APIs (Claude or OpenAI) and commit the output as JSON.

The standard approach for educational content is question-specific explanations with answer-aware corrections (each wrong answer gets a tailored explanation), topic categorization using 8-10 granular categories, and SVG component-based icons for visual categorization. Content should be stored in enhanced question data structures rather than separate files for maintainability.

**Primary recommendation:** Use Headless UI Dialog with Framer Motion AnimatePresence for the modal, implement custom tooltip logic with auto-dismiss timers, enhance the existing Question type with learningContent fields, and create a build-time TypeScript script that generates educational content via Claude API.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @headlessui/react | ^2.1+ | Accessible Dialog component | Best-in-class accessibility, focus trap, portal rendering, composable with Framer Motion |
| framer-motion | ^12.34.0 | Modal/tooltip animations | Already in project, AnimatePresence for exit animations, spring physics match game feel |
| React useState/useEffect | Built-in | Tooltip auto-dismiss & timer control | Native hooks sufficient for timer pause/resume and tooltip lifecycle |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | ^0.32.0+ | AI content generation at build time | For build scripts that generate educational content via Claude API |
| openai | ^4.77.0+ | Alternative AI content provider | If Claude API unavailable or for comparison/fallback |
| focus-trap-react | ^10.2.3 | Enhanced focus management | Only if Headless UI Dialog insufficient (unlikely) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Headless UI Dialog | Radix UI Dialog | More components but heavier bundle, similar accessibility |
| Headless UI Dialog | react-modal | Older pattern, requires more manual accessibility work |
| Custom tooltip | Radix UI Tooltip | More complex for simple auto-dismiss case, adds dependency |
| Build-time generation | Runtime LLM calls | Expensive, slow, requires API keys in production |

**Installation:**
```bash
# Headless UI (if not already installed)
npm install @headlessui/react

# For build-time content generation script
npm install --save-dev @anthropic-ai/sdk
# OR
npm install --save-dev openai
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── features/game/
│   ├── components/
│   │   ├── LearnMoreButton.tsx      # Button with fade-in + tooltip teaser
│   │   ├── LearnMoreModal.tsx       # Headless Dialog with content
│   │   ├── LearnMoreTooltip.tsx     # Auto-dismiss tooltip component
│   │   └── TopicIcon.tsx            # SVG component for category icons
│   └── types/
│       └── learning.ts              # LearningContent, TopicCategory types

backend/src/
├── data/
│   ├── questions.json               # Enhanced with learningContent field
│   └── topicIcons.ts                # Icon SVG components as data
└── scripts/
    └── generateLearningContent.ts   # Build-time AI content generator
```

### Pattern 1: Headless UI Dialog with Framer Motion
**What:** Combine Headless UI's accessible Dialog with Framer Motion's AnimatePresence for animated, accessible modals
**When to use:** Any modal that needs both accessibility (focus trap, ARIA) and smooth animations
**Example:**
```typescript
// Source: https://headlessui.com/react/dialog + https://ariakit.org/examples/dialog-framer-motion
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';

function LearnMoreModal({ isOpen, onClose, content }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog static open={isOpen} onClose={onClose} className="relative z-50">
          {/* Backdrop with fade animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70"
            aria-hidden="true"
          />

          {/* Modal panel with scale + fade */}
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel
              as={motion.div}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="max-w-2xl w-full bg-slate-800 rounded-lg p-6"
            >
              {/* Content - no header/title per design decision */}
              <div className="prose prose-invert">
                {content.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {/* Close button */}
              <button onClick={onClose} className="absolute top-4 right-4">
                <XIcon />
              </button>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
```

### Pattern 2: Auto-Dismiss Tooltip with Teaser
**What:** Show tooltip automatically for 2-3 seconds, then collapse to just button. Dismissible on tap.
**When to use:** Introducing new UI affordances without being intrusive
**Example:**
```typescript
// Source: Pattern derived from https://blog.logrocket.com/controlling-tooltips-pop-up-menus-using-compound-components-in-react-ccedc15c7526/
function LearnMoreButton({ teaserText, onOpenModal }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    // Auto-show tooltip once after button fades in
    if (!hasShown) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
        setHasShown(true);
      }, 500); // After button fade-in

      return () => clearTimeout(timer);
    }
  }, [hasShown]);

  useEffect(() => {
    // Auto-dismiss after 2.5 seconds
    if (showTooltip) {
      const timer = setTimeout(() => {
        setShowTooltip(false);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [showTooltip]);

  const handleDismiss = () => {
    setShowTooltip(false);
  };

  return (
    <div className="relative">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onOpenModal}
        className="px-4 py-2 bg-teal-600 rounded"
      >
        Learn More
      </motion.button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleDismiss}
            className="absolute bottom-full left-0 mb-2 p-3 bg-slate-700 rounded shadow-lg max-w-xs"
          >
            <p className="text-sm text-white mb-2">{teaserText}</p>
            <button onClick={onOpenModal} className="text-teal-400 text-sm">
              Read more →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### Pattern 3: Timer Pause/Resume on Modal Open
**What:** Pause auto-advance timer when modal opens, resume where left off when closed
**When to use:** Any timed game mechanic that should pause for user-initiated content exploration
**Example:**
```typescript
// Source: Derived from https://github.com/amrlabib/react-timer-hook
function GameScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pausedTimeRemaining, setPausedTimeRemaining] = useState(null);

  const handleOpenModal = (currentTimeRemaining: number) => {
    setPausedTimeRemaining(currentTimeRemaining);
    setIsModalOpen(true);
    // Pause auto-advance timer via state flag
    dispatch({ type: 'PAUSE_TIMER' });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Resume timer where it left off
    dispatch({ type: 'RESUME_TIMER', timeRemaining: pausedTimeRemaining });
  };

  return (
    <>
      <GameTimer
        duration={6}
        isPaused={isModalOpen}
        onTimeUpdate={setCurrentTime}
      />
      <LearnMoreModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}
```

### Pattern 4: Enhanced Question Data Model with Learning Content
**What:** Extend Question type to include learning content inline rather than separate files
**When to use:** Content tightly coupled to questions (as in this case)
**Example:**
```typescript
// Source: Project pattern + research on data modeling
export type TopicCategory =
  | 'voting'
  | 'elections'
  | 'congress'
  | 'executive'
  | 'judiciary'
  | 'bill-of-rights'
  | 'amendments'
  | 'federalism'
  | 'checks-balances';

export type LearningContent = {
  topic: TopicCategory;
  paragraphs: string[];  // 2-3 paragraphs of explanation
  corrections: {
    [optionIndex: number]: string;  // Wrong answer → correction text
  };
  source: {
    name: string;
    url: string;
  };
};

export type Question = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;  // Short explanation (existing)
  difficulty: Difficulty;
  topic: string;
  learningContent?: LearningContent;  // Optional expanded content
};
```

### Pattern 5: Build-Time AI Content Generation Script
**What:** TypeScript script that reads questions, calls LLM API to generate learning content, writes back to questions.json
**When to use:** Static content that doesn't change per-session, reviewed before commit
**Example:**
```typescript
// Source: Pattern from https://obot.ai/resources/learning-center/claude-api/
// backend/src/scripts/generateLearningContent.ts
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import { Question, LearningContent } from '../types/question.js';

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

async function generateLearningContent(question: Question): Promise<LearningContent> {
  const prompt = `Generate educational content for this civics trivia question:

Question: ${question.text}
Correct Answer: ${question.options[question.correctAnswer]}
Wrong Answers: ${question.options.filter((_, i) => i !== question.correctAnswer).join(', ')}

Generate:
1. 2-3 informative paragraphs explaining the correct answer in depth
2. For each wrong answer, a 1-2 sentence correction explaining why it's wrong
3. A credible source citation

Format as JSON matching this structure:
{
  "paragraphs": ["..."],
  "corrections": { "0": "...", "2": "..." },
  "source": { "name": "...", "url": "..." }
}`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0].text;
  return JSON.parse(content);
}

async function main() {
  const questionsRaw = await fs.readFile('src/data/questions.json', 'utf-8');
  const questions: Question[] = JSON.parse(questionsRaw);

  for (const question of questions) {
    if (!question.learningContent) {
      console.log(`Generating content for: ${question.id}`);
      question.learningContent = await generateLearningContent(question);
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  await fs.writeFile(
    'src/data/questions.json',
    JSON.stringify(questions, null, 2)
  );
  console.log('✓ Learning content generated');
}

main();
```

### Pattern 6: SVG Component Icons for Topics
**What:** Create React components for each topic icon, store as reusable components
**When to use:** Small set of icons (8-10) that need to match game aesthetic
**Example:**
```typescript
// Source: https://www.robinwieruch.de/react-svg-icon-components/
// frontend/src/features/game/components/icons/TopicIcons.tsx
export const VotingIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

export const CongressIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

// Map topics to icons
export const TOPIC_ICONS: Record<TopicCategory, React.FC<{className?: string}>> = {
  voting: VotingIcon,
  congress: CongressIcon,
  // ... 8 more
};
```

### Anti-Patterns to Avoid
- **Runtime LLM calls for content:** Slow, expensive, requires API keys in production. Generate at build time instead.
- **Separate content files per question:** Harder to maintain relationship between question and learning content. Store inline.
- **Generic wrong answer feedback:** "Incorrect" is less educational than "No, Congress serves 2-year terms — Senators have 6-year terms."
- **Custom focus trap implementation:** Headless UI Dialog handles this perfectly. Don't reinvent.
- **Modal without AnimatePresence:** Abrupt mount/unmount feels jarring. Always use exit animations.
- **Tooltip that never auto-dismisses:** If user ignores it, it blocks content. Auto-dismiss is essential.
- **Resetting timer on modal close:** User loses progress. Resume where paused instead.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible modal dialog | Custom dialog with useRef/useEffect for focus | Headless UI Dialog | Focus trap, ARIA attributes, portal rendering, inert background, escape key handling all built-in |
| Modal animations | Custom CSS transitions + state management | Framer Motion AnimatePresence | Handles mount/unmount timing, coordinates multiple animations, spring physics |
| Focus trap | Manual tabIndex manipulation and event listeners | Headless UI Dialog (built-in) or focus-trap-react | Edge cases: iframes, shadow DOM, dynamically added elements |
| Click-outside detection | Document click listener with ref comparison | Headless UI Dialog onClose | Race conditions, portal rendering, nested modals |
| Keyboard shortcuts in modal context | Window keydown listener with phase checks | useKeyPress hook + phase gates (existing pattern) | Input/textarea exclusion, event cleanup, multiple listeners |
| AI content generation batching | Manual for-loop with rate limiting | async/await with Promise.all + p-limit library | Concurrent requests with rate limiting, retry logic, error handling |
| SVG icon management | Individual SVG files imported per component | Component-based icon library pattern | Type safety, tree-shaking, consistent styling |

**Key insight:** Modal accessibility is deceptively complex. Focus management alone requires handling: initial focus placement, tab cycling within modal, shift+tab reverse cycling, escape key, click outside, return focus on close, prevent background interaction, screen reader announcements. Headless UI Dialog solves all of this. Don't rebuild it.

## Common Pitfalls

### Pitfall 1: Focus Trap Breaks with Multiple Modals
**What goes wrong:** Opening a modal from within another modal breaks focus trap, or closing inner modal doesn't restore focus correctly
**Why it happens:** Focus management assumes single modal stack. Multiple modals create competing focus traps.
**How to avoid:** Headless UI v2.1+ supports sibling dialogs. Use `static` prop and manage open state carefully. For this phase, only one modal type exists (Learn More), so this is low risk but worth noting for future phases.
**Warning signs:** Tab key escapes modal boundary, focus jumps to background, screen reader loses modal context

### Pitfall 2: Timer "Resumes" But Advances Immediately
**What goes wrong:** Modal pauses auto-advance timer at 3.5s remaining. User closes modal, timer "resumes" but immediately advances to next question.
**Why it happens:** Resume logic doesn't restore the paused countdown value. Timer restarts from 0 or uses stale value.
**How to avoid:** Store exact time remaining when pausing. Pass that value back when resuming. Use controlled timer pattern with `isPaused` prop + `timeRemaining` override.
**Warning signs:** Users complain modal causes instant skip, timer always shows 6s after modal close

### Pitfall 3: Modal Content Not Scrollable on Mobile
**What goes wrong:** Long learning content (2-3 paragraphs + corrections + source) overflows viewport on mobile. No scroll, content clipped.
**Why it happens:** Modal panel has fixed height or parent container doesn't allow overflow.
**How to avoid:** Use `max-h-[80vh] overflow-y-auto` on DialogPanel content area. Test on small viewports (320px width).
**Warning signs:** Content cuts off mid-sentence, scroll doesn't work, users can't see source citation

### Pitfall 4: Tooltip Shows Every Time Answer Reveals
**What goes wrong:** Auto-show tooltip triggers on every question's reveal, not just first time user sees feature
**Why it happens:** Tooltip state resets per question instead of per session
**How to avoid:** Track `hasShownTooltip` in session state (Zustand or localStorage). Only auto-show once per game session or user account.
**Warning signs:** Tooltip becomes annoying, users complain about repetitive popups

### Pitfall 5: AI-Generated Content Lacks Answer Context
**What goes wrong:** Learning content says "The answer is the 13th Amendment" but doesn't restate what the question was. Content doesn't stand alone.
**Why it happens:** LLM prompt doesn't emphasize restating context. Generated content assumes question is visible.
**How to avoid:** Prompt engineering: "Write paragraphs that restate the question's correct answer in the opening sentence. Content should be understandable without seeing the question."
**Warning signs:** Content starts with pronouns ("It was ratified...") instead of concrete nouns ("The 13th Amendment was ratified...")

### Pitfall 6: Wrong Answer Corrections Are Generic
**What goes wrong:** All wrong answers get "Incorrect, the right answer is X" instead of specific corrections
**Why it happens:** LLM generates single explanation, not per-option corrections
**How to avoid:** Prompt must explicitly request: "For each wrong answer option, explain specifically why that particular answer is incorrect." Return structured corrections object.
**Warning signs:** Corrections all have same format, don't reference the specific wrong answer chosen

### Pitfall 7: Keyboard Shortcut 'L' Triggers During Input
**What goes wrong:** User types answer in some hypothetical future text input, presses 'L', modal opens unexpectedly
**Why it happens:** Keyboard listener doesn't exclude input/textarea elements
**How to avoid:** Use existing `useKeyPress` pattern which checks `target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA'`. Only enable during 'revealing' phase.
**Warning signs:** Modal opens at unexpected times, interferes with typing

### Pitfall 8: Source URLs Not Validated
**What goes wrong:** AI generates fake or broken source URLs. Users click, get 404, lose trust.
**Why it happens:** LLM hallucinates URLs that sound plausible but don't exist
**How to avoid:** (1) Provide known-good sources in prompt ("Use only these authoritative sources: constitution.congress.gov, archives.gov..."), (2) Validate URLs in build script with HEAD requests, (3) Manual review before committing generated content.
**Warning signs:** 404 errors, users report broken links, sources cite non-existent pages

## Code Examples

Verified patterns from official sources:

### Accessible Modal with Backdrop Dim + Resume Timer
```typescript
// Source: Headless UI + Framer Motion + project patterns
import { Dialog, DialogPanel } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface LearnMoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: LearningContent;
  userAnswer: number | null; // null = timeout
  correctAnswer: number;
}

export function LearnMoreModal({
  isOpen,
  onClose,
  content,
  userAnswer,
  correctAnswer
}: LearnMoreModalProps) {
  // Determine which opener to show
  const getOpener = () => {
    if (userAnswer === correctAnswer) {
      return "That's right!";
    } else if (userAnswer === null) {
      return "Time's up! Here's what you should know...";
    } else {
      return content.corrections[userAnswer] || "Not quite.";
    }
  };

  // Escape key handling (Headless UI handles this automatically)
  // Click outside to close (Headless UI handles this automatically)

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={onClose}
          className="relative z-50"
        >
          {/* Backdrop - dimmed background shows paused state */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal container */}
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel
              as={motion.div}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="max-w-2xl w-full bg-slate-800 rounded-lg p-6 max-h-[80vh] overflow-y-auto"
            >
              {/* Close button - top right corner */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Topic icon */}
              <div className="mb-4">
                {/* TopicIcon component based on content.topic */}
              </div>

              {/* Content - no header/title, dive straight in */}
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-lg font-medium text-white mb-4">{getOpener()}</p>

                {content.paragraphs.map((para, i) => (
                  <p key={i} className="text-slate-200 mb-3">{para}</p>
                ))}

                {/* Source citation */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    Source:{' '}
                    <a
                      href={content.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300"
                    >
                      {content.source.name}
                    </a>
                  </p>
                </div>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
```

### Auto-Dismiss Tooltip with Tap-Anywhere Dismiss
```typescript
// Source: Pattern from https://blog.logrocket.com/controlling-tooltips-pop-up-menus-using-compound-components-in-react-ccedc15c7526/
function LearnMoreTooltip({
  teaserText,
  onReadMore,
  show,
  onDismiss
}: {
  teaserText: string;
  onReadMore: () => void;
  show: boolean;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onDismiss, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  // Tap anywhere dismisses
  useEffect(() => {
    if (show) {
      const handleClick = () => onDismiss();
      document.addEventListener('click', handleClick, { capture: true });
      return () => document.removeEventListener('click', handleClick, { capture: true });
    }
  }, [show, onDismiss]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-slate-700 rounded-lg shadow-xl max-w-xs pointer-events-auto"
          onClick={(e) => e.stopPropagation()} // Prevent dismissing when clicking inside
        >
          <p className="text-sm text-white mb-2">{teaserText}</p>
          <button
            onClick={onReadMore}
            className="text-teal-400 hover:text-teal-300 text-sm font-medium"
          >
            Read more →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Keyboard Shortcut 'L' for Learn More (Phase-Gated)
```typescript
// Source: Existing useKeyPress pattern from project
function AnswerRevealSection({
  phase,
  hasLearningContent,
  onOpenLearnMore
}: {
  phase: GamePhase;
  hasLearningContent: boolean;
  onOpenLearnMore: () => void;
}) {
  // Only enable 'L' shortcut during reveal phase when content exists
  const canOpenLearnMore = phase === 'revealing' && hasLearningContent;

  useKeyPress('l', onOpenLearnMore, canOpenLearnMore);

  // ... rest of component
}
```

### Build Script with Rate Limiting and Error Handling
```typescript
// Source: https://obot.ai/resources/learning-center/claude-api/
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';

async function generateWithRetry(
  client: Anthropic,
  question: Question,
  maxRetries = 3
): Promise<LearningContent> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: buildPrompt(question)
        }],
      });

      const content = JSON.parse(response.content[0].text);

      // Validate structure
      if (!content.paragraphs || !Array.isArray(content.paragraphs)) {
        throw new Error('Invalid content structure');
      }

      return content;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }

  throw new Error('All retries failed');
}

function buildPrompt(question: Question): string {
  return `Generate educational content for this U.S. civics question.

Question: ${question.text}
Options: ${question.options.map((o, i) => `${i}. ${o}`).join(', ')}
Correct Answer: ${question.correctAnswer} (${question.options[question.correctAnswer]})

Requirements:
1. Write 2-3 informative paragraphs (150-200 words total)
2. First sentence should restate the question's correct answer (e.g., "The 13th Amendment abolished slavery in 1865")
3. Explain WHY this answer is important and provide historical context
4. For EACH wrong answer option, write a specific 1-2 sentence correction explaining why it's incorrect
5. Provide a credible .gov or .edu source with real URL

Use only these authoritative sources:
- constitution.congress.gov
- archives.gov
- supremecourt.gov
- senate.gov
- house.gov

Tone: Informative and clear — factual, straightforward, no fluff.

Return ONLY valid JSON matching this structure:
{
  "paragraphs": ["First paragraph...", "Second paragraph..."],
  "corrections": {
    "0": "Correction for option 0 if wrong...",
    "1": "Correction for option 1 if wrong...",
    "3": "Correction for option 3 if wrong..."
  },
  "source": {
    "name": "U.S. Constitution - Congress.gov",
    "url": "https://constitution.congress.gov/browse/amendment-13/"
  }
}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-modal library | Headless UI Dialog or native `<dialog>` | 2022-2023 | Better accessibility out-of-box, less custom code |
| CSS transitions for modals | Framer Motion AnimatePresence | 2020+ | Easier exit animations, coordinated timing |
| Runtime content generation | Build-time static generation | 2023+ (SSG trend) | Faster, cheaper, reviewable content |
| Manual focus trap code | Headless UI / focus-trap-react | 2021+ | Fewer bugs, edge cases handled |
| Class components for modals | Hooks + functional components | 2019+ | Simpler state, less boilerplate |

**Deprecated/outdated:**
- **react-modal as go-to solution:** Still works but Headless UI + native `<dialog>` offer better DX and accessibility
- **Popper.js v1:** Replaced by Popper v2 and Floating UI (but tooltips in this phase are simple enough not to need positioning libraries)
- **Custom data-* attributes for animations:** Framer Motion's declarative API is cleaner

## Open Questions

Things that couldn't be fully resolved:

1. **Topic category icon sourcing**
   - What we know: Line art SVG icons work best, component-based approach is standard
   - What's unclear: Whether to use icon library (Lucide, Heroicons) or commission custom icons to match Millionaire aesthetic
   - Recommendation: Start with Lucide React icons (already line art style), customize if needed. Lucide has government, voting, scales icons suitable for civics topics.

2. **LLM provider choice for content generation**
   - What we know: Both Claude (Sonnet 3.5) and GPT-4 can generate quality educational content
   - What's unclear: Which produces better civics-specific content, cost comparison for ~50 questions
   - Recommendation: Claude 3.5 Sonnet for consistency with dev tooling (Claude Code). Estimated cost: ~$0.50-1.00 for entire question bank (50 questions × $0.015 per 1K tokens × ~1K tokens per question).

3. **Mobile tooltip behavior (first tap)**
   - What we know: Desktop flow is button → auto-show tooltip → dismiss → click button for modal
   - What's unclear: On mobile (touch), should first tap on button (while tooltip showing) dismiss tooltip OR open modal?
   - Recommendation: First tap while tooltip is visible should open modal (tooltip "Read more" is redundant on mobile). Tooltip auto-dismisses after 2.5s anyway, so this is low-friction.

4. **Results screen topic placement**
   - What we know: Topic tags should appear in question breakdown, questions should be tappable to reopen modal
   - What's unclear: Exact visual placement (above question text? below? as badge?)
   - Recommendation: Small badge above question text (like "Question 1" label) showing topic name + icon. Maintains visual hierarchy.

5. **Skip-ahead after modal close**
   - What we know: Auto-advance timer resumes where paused
   - What's unclear: Should user be able to manually skip to next question immediately after closing modal, or must they wait for auto-advance?
   - Recommendation: Allow manual skip. Add "Next Question" button in reveal phase that becomes available after modal closes. User has control but isn't forced to wait.

## Sources

### Primary (HIGH confidence)
- Headless UI Dialog docs - https://headlessui.com/react/dialog - Dialog component API, accessibility features, Framer Motion integration
- Framer Motion v12 changelog - https://motion.dev/changelog - AnimatePresence features, version 12.34.0 capabilities
- Ariakit Dialog + Framer Motion example - https://ariakit.org/examples/dialog-framer-motion - AnimatePresence with Dialog pattern
- Claude API documentation - https://obot.ai/resources/learning-center/claude-api/ - TypeScript SDK usage, content generation patterns

### Secondary (MEDIUM confidence)
- React modal accessibility best practices - https://blog.openreplay.com/common-accessibility-issues-modals-fix/ - Common pitfalls verified across multiple sources
- LogRocket tooltip/popover patterns - https://blog.logrocket.com/controlling-tooltips-pop-up-menus-using-compound-components-in-react-ccedc15c7526/ - Auto-dismiss patterns
- Robin Wieruch SVG in React - https://www.robinwieruch.de/react-svg-icon-components/ - Component-based icon pattern
- Frontend Masters focus trap course - https://frontendmasters.com/courses/react-accessibility/focus-trapping-keyboard-shortcuts/ - Focus management patterns
- React timer hooks research - https://github.com/amrlabib/react-timer-hook - Pause/resume timer patterns

### Tertiary (LOW confidence - community patterns, needs validation)
- LLM error patterns research - https://arxiv.org/html/2502.15140 - Interesting but academic, not directly applicable to content generation quality
- Educational correction strategies - https://www.ideals.illinois.edu/items/18131/bitstreams/64865/data.pdf - Pedagogical background for wrong-answer corrections

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Headless UI + Framer Motion verified in official docs, existing project dependencies
- Architecture: HIGH - Patterns verified across official documentation and established community practices
- Pitfalls: MEDIUM - Common issues documented but some project-specific (timer resume, tooltip auto-show) based on logical inference
- Build-time AI generation: MEDIUM - Pattern is well-established, but specific implementation with Claude API for civics content not pre-verified
- Topic icons: LOW - General SVG patterns HIGH confidence, specific icon sourcing needs validation

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days - stable ecosystem, mature libraries)

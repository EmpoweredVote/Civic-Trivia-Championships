# Architecture Patterns for Trivia/Quiz Game Systems

**Domain:** Trivia/Quiz Game Applications
**Project:** Civic Trivia Championship
**Researched:** 2026-02-03
**Overall Confidence:** HIGH (verified with multiple sources, aligned with project tech stack)

---

## Executive Summary

Trivia/quiz game systems follow well-established patterns with clear separation between **game state management**, **content delivery**, **session orchestration**, and **user progression tracking**. The architecture must balance simplicity for single-player flows with extensibility for future multiplayer features.

**Core insight:** Quiz games are fundamentally **state machines** progressing through well-defined phases (Start → Question → Answer → Reveal → Next). Architecture should embrace this reality rather than fight it.

---

## Recommended Architecture

### High-Level System Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Game Shell   │  │ Question UI  │  │ Learning     │      │
│  │ (State Mgmt) │  │ (Rendering)  │  │ (Modal)      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  Game Service  │                        │
│                    │  (API Client)  │                        │
│                    └───────┬────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │ REST/JSON
┌────────────────────────────┼──────────────────────────────────┐
│                    ┌───────▼────────┐                         │
│                    │  API Gateway   │                         │
│                    │  (Express)     │                         │
│                    └───┬────────┬───┘                         │
│                        │        │                             │
│              ┌─────────┴───┐  ┌─┴──────────┐                 │
│              │ Session     │  │ Content    │                 │
│              │ Controller  │  │ Controller │                 │
│              └──┬──────┬───┘  └─┬──────┬───┘                 │
│                 │      │        │      │                     │
│         ┌───────▼──┐ ┌▼─────┐ ┌▼────┐ ┌▼────────┐           │
│         │ Progress │ │Redis │ │ DB  │ │ Content │           │
│         │ Service  │ │Cache │ │(PG) │ │ Service │           │
│         └──────────┘ └──────┘ └─────┘ └─────────┘           │
│                        SERVER LAYER                           │
└───────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | State Scope |
|-----------|---------------|-------------------|-------------|
| **Game Shell** | State machine orchestration, flow control, timer management | Question UI, Learning Modal, Game Service | Local (React state/Context) |
| **Question UI** | Render question/answers, handle user input, animations | Game Shell | Props only (stateless) |
| **Learning Modal** | Display educational content, "learn more" flows | Game Shell, Content Controller | Local modal state |
| **Game Service** | API client, request/response handling, error boundaries | All UI components → API Gateway | No state (pure service) |
| **Session Controller** | Game session lifecycle, scoring logic, wager handling | Redis Cache, Progress Service | Session stored in Redis |
| **Content Controller** | Question delivery, randomization, difficulty selection | DB (PostgreSQL), Redis Cache | No state (queries DB/cache) |
| **Progress Service** | XP/gems calculation, badge awards, profile updates | DB (PostgreSQL) | Persisted in DB |
| **Redis Cache** | Session state, active game data, leaderboard cache | Session Controller, Content Controller | TTL-based expiry |
| **PostgreSQL DB** | Questions, user profiles, game history, badges | All server-side services | Persistent storage |

---

## Data Flow

### Single-Player Game Session Flow

```
1. START GAME
   Client: User clicks "Start Game" → Game Shell
   ↓
   Game Shell → Game Service.startSession()
   ↓
   API Gateway → Session Controller.createSession()
   ↓
   Session Controller:
     - Generate sessionId
     - Fetch questions from Content Controller
     - Store session in Redis (TTL: 30 min)
     - Return { sessionId, firstQuestion }
   ↓
   Client: Game Shell receives session, transitions to QUESTION state

2. QUESTION DISPLAY
   Game Shell:
     - Starts timer (useEffect with cleanup)
     - Renders Question UI with current question
     - Listens for answer selection

3. ANSWER SUBMISSION
   Client: User selects answer → Question UI → Game Shell
   ↓
   Game Shell → Game Service.submitAnswer(sessionId, questionId, answerId)
   ↓
   Session Controller:
     - Validate answer
     - Calculate points (time bonus)
     - Update session score in Redis
     - Mark question complete
     - Return { correct, points, explanation, nextQuestion }
   ↓
   Client: Game Shell transitions to REVEAL state

4. REVEAL & EXPLANATION
   Game Shell:
     - Shows correct/incorrect animation
     - Displays explanation
     - "Learn more" button → opens Learning Modal
     - After 3s or user action → next question

5. REPEAT 2-4 until all questions answered

6. WAGER QUESTION (if applicable)
   Game Shell transitions to WAGER state
   ↓
   User selects wager amount → submitWager()
   ↓
   Session Controller updates wager in Redis
   ↓
   Present final question with higher stakes

7. GAME COMPLETE
   Game Shell → Game Service.completeSession(sessionId)
   ↓
   Session Controller:
     - Finalize score
     - Trigger Progress Service.awardRewards()
   ↓
   Progress Service:
     - Calculate XP/gems
     - Check badge criteria
     - Update user profile in DB
     - Return rewards summary
   ↓
   Client: Game Shell transitions to RESULTS state
   ↓
   Display: Final score, XP gained, gems earned, badges unlocked
```

### Learning Flow (Parallel to Game Flow)

```
User clicks "Learn more" → Learning Modal opens
↓
Game Service.getLearnMore(questionId)
↓
Content Controller fetches educational content from DB
↓
Learning Modal displays content
↓
User optionally saves for later → Progress Service.saveContent()
↓
User closes modal → returns to game (timer resumes or next question)
```

### Phase 2: Real-Time Multiplayer Flow (Future)

```
[WebSocket connection established on game start]

Host creates room → POST /api/rooms
↓
Server: Session Controller creates room in Redis
↓
Players join → WebSocket: JOIN_ROOM event
↓
Session Controller adds players to room state
↓
Host starts game → WebSocket: START_GAME event
↓
Server broadcasts QUESTION_START to all players
↓
Each player submits answer → WebSocket: SUBMIT_ANSWER
↓
Server collects answers, waits for all or timeout
↓
Server broadcasts REVEAL with all players' answers and updated leaderboard
↓
Repeat for all questions
↓
Server broadcasts GAME_END with final standings
```

---

## State Management Patterns

### Client-Side State Architecture

**Recommended Approach:** React Context + useState/useReducer (START HERE)

**Rationale:** Quiz games have localized, predictable state flows. Context provides sufficient structure without Redux overhead. Graduate to Zustand only if performance issues arise.

#### State Layers

| Layer | Solution | What It Manages | Confidence |
|-------|----------|----------------|------------|
| **Game Session State** | React Context | Current question, score, timer, game phase (FSM) | HIGH |
| **UI State** | Local useState | Animations, modal open/close, button states | HIGH |
| **Server State** | TanStack Query (React Query) | Questions, user profile, game history | MEDIUM |
| **Cache** | TanStack Query cache | Recently fetched questions, user data | MEDIUM |

#### Finite State Machine for Game Flow

Implement game phases as explicit FSM states:

```typescript
type GamePhase =
  | 'IDLE'           // Not started
  | 'LOADING'        // Fetching questions
  | 'QUESTION'       // Displaying question + timer
  | 'ANSWER_LOCKED'  // User selected, waiting to submit
  | 'REVEAL'         // Show correct answer + explanation
  | 'LEARNING'       // "Learn more" modal open
  | 'WAGER'          // Special wager question
  | 'COMPLETE'       // Game finished
  | 'ERROR';         // Error occurred

// Game Shell maintains FSM state
const [gamePhase, setGamePhase] = useState<GamePhase>('IDLE');

// Transitions are explicit
const transitionTo = (nextPhase: GamePhase) => {
  // Validate transition is allowed
  // Log for debugging
  // Update state
  setGamePhase(nextPhase);
};
```

**Why FSM?** Quiz games have well-defined phase transitions. Making these explicit prevents bugs from invalid state combinations (e.g., timer running during REVEAL).

#### Timer Management

**Pattern:** useEffect with cleanup + useRef for interval tracking

```typescript
const useQuestionTimer = (duration: number, onTimeout: () => void) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup prevents memory leaks when component unmounts
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [duration, onTimeout]);

  return { timeLeft, pause: () => clearInterval(intervalRef.current!) };
};
```

**Critical:** Always clear timers in useEffect cleanup. Failing to do so causes multiple timers, memory leaks, and flickering.

### Server-Side State Architecture

**Session State:** Stored in Redis with TTL

```javascript
// Session schema in Redis
{
  "session:{sessionId}": {
    userId: string,
    questions: Question[],
    currentQuestionIndex: number,
    answers: Answer[],
    score: number,
    startedAt: timestamp,
    expiresAt: timestamp,
    wagerAmount: number | null
  }
}

// TTL: 30 minutes (auto-cleanup abandoned games)
```

**Why Redis?**
- Sub-millisecond reads (critical for real-time feel)
- Automatic expiry (no manual cleanup)
- Pub/Sub for Phase 2 multiplayer
- Leaderboard support with sorted sets

**Persistent State:** PostgreSQL

```sql
-- Core tables
users (id, username, email, xp, gems, created_at)
questions (id, text, category, difficulty, explanation)
answers (id, question_id, text, is_correct)
game_history (id, user_id, score, duration, completed_at)
badges (id, name, criteria, icon_url)
user_badges (user_id, badge_id, earned_at)
saved_content (user_id, question_id, saved_at)
```

**Why PostgreSQL?**
- Relational data (questions → answers, users → badges)
- ACID guarantees for XP/gems
- Complex queries for badge criteria
- JSON columns for flexible question metadata

---

## Architecture Patterns to Follow

### Pattern 1: State Machine for Game Flow

**What:** Explicitly model game phases as FSM states with validated transitions.

**When:** Always for quiz games. Phase transitions are predictable and constrained.

**Benefits:**
- Prevents invalid states (e.g., timer running after answer reveal)
- Makes debugging trivial (log state transitions)
- Simplifies testing (test each phase independently)

**Example:**
```typescript
const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  IDLE: ['LOADING'],
  LOADING: ['QUESTION', 'ERROR'],
  QUESTION: ['ANSWER_LOCKED', 'REVEAL', 'ERROR'],
  ANSWER_LOCKED: ['REVEAL'],
  REVEAL: ['LEARNING', 'QUESTION', 'WAGER', 'COMPLETE'],
  LEARNING: ['REVEAL'], // Return to reveal after learning modal
  WAGER: ['QUESTION'], // Wager leads to final question
  COMPLETE: ['IDLE'], // Restart
  ERROR: ['IDLE']
};
```

### Pattern 2: Optimistic UI for Answer Selection

**What:** Update UI immediately when user selects answer, then sync with server.

**When:** Non-wager questions where reversibility is acceptable.

**Benefits:**
- Feels instant (no network latency)
- Better UX on slow connections
- Reduces perceived load time

**Example:**
```typescript
const submitAnswer = async (answerId: string) => {
  // 1. Optimistic update
  setSelectedAnswer(answerId);
  setGamePhase('ANSWER_LOCKED');

  try {
    // 2. Server validation
    const result = await gameService.submitAnswer(sessionId, questionId, answerId);

    // 3. Update with server response
    setScore(result.score);
    setGamePhase('REVEAL');
  } catch (error) {
    // 4. Rollback on error
    setSelectedAnswer(null);
    setGamePhase('QUESTION');
    showError('Failed to submit answer');
  }
};
```

### Pattern 3: Content Preloading

**What:** Fetch next question while user is viewing current question reveal.

**When:** Always. Hides network latency.

**Benefits:**
- Seamless transitions between questions
- Feels faster than it is
- Better perceived performance

**Example:**
```typescript
const preloadNextQuestion = async (currentIndex: number) => {
  if (currentIndex + 1 < questions.length) {
    // TanStack Query will cache this
    await queryClient.prefetchQuery({
      queryKey: ['question', questions[currentIndex + 1].id],
      queryFn: () => gameService.getQuestion(questions[currentIndex + 1].id)
    });
  }
};

// Trigger during REVEAL phase
useEffect(() => {
  if (gamePhase === 'REVEAL') {
    preloadNextQuestion(currentQuestionIndex);
  }
}, [gamePhase, currentQuestionIndex]);
```

### Pattern 4: Session Resurrection

**What:** Store minimal session state in localStorage to recover from page refresh.

**When:** Single-player games where recovery is valuable.

**Benefits:**
- User doesn't lose progress on accidental refresh
- Better UX for mobile (tab switching)

**Example:**
```typescript
// Save to localStorage on each state change
useEffect(() => {
  if (sessionId) {
    localStorage.setItem('activeSession', JSON.stringify({
      sessionId,
      currentQuestionIndex,
      score,
      phase: gamePhase
    }));
  }
}, [sessionId, currentQuestionIndex, score, gamePhase]);

// Attempt recovery on mount
useEffect(() => {
  const saved = localStorage.getItem('activeSession');
  if (saved) {
    const session = JSON.parse(saved);
    // Validate session still exists on server
    gameService.validateSession(session.sessionId)
      .then(isValid => {
        if (isValid) {
          // Resume session
          setSessionId(session.sessionId);
          setGamePhase(session.phase);
        }
      });
  }
}, []);
```

### Pattern 5: Time-Boxed Server Operations

**What:** All server operations have explicit timeouts. Don't wait indefinitely.

**When:** Always. Network is unreliable.

**Benefits:**
- Prevents hanging UI
- Clear error states
- Better UX on poor connections

**Example:**
```typescript
const gameService = {
  submitAnswer: async (sessionId, questionId, answerId) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      const response = await fetch('/api/answers', {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId, answerId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection.');
      }
      throw error;
    }
  }
};
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global Timer State

**What goes wrong:** Storing timer in global state causes unnecessary re-renders across the entire component tree every second.

**Why bad:** Performance tanks. Every component subscribed to Context re-renders 10+ times per question.

**Instead:** Keep timer state local to Timer component. Pass only `onTimeout` callback from parent.

```typescript
// ❌ BAD: Timer in Context causes re-renders
const GameContext = createContext({ timeLeft: 10, ... });

// ✅ GOOD: Timer is local, parent only cares about timeout
const Timer = ({ duration, onTimeout }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  // ... timer logic
};
```

### Anti-Pattern 2: Storing Questions in Component State

**What goes wrong:** Questions stored in useState get lost on page refresh. No cache invalidation strategy.

**Why bad:** Wastes API calls, poor offline support, can't implement preloading.

**Instead:** Use TanStack Query for server state. Automatic caching, invalidation, and background refetching.

```typescript
// ❌ BAD: Manual state management
const [questions, setQuestions] = useState([]);
useEffect(() => {
  fetch('/api/questions').then(r => r.json()).then(setQuestions);
}, []);

// ✅ GOOD: TanStack Query handles caching, refetching, errors
const { data: questions, isLoading, error } = useQuery({
  queryKey: ['session', sessionId, 'questions'],
  queryFn: () => gameService.getQuestions(sessionId),
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
});
```

### Anti-Pattern 3: Synchronous Score Calculation on Client

**What goes wrong:** Client calculates score based on time, sends to server. Client and server can disagree.

**Why bad:** Exploitable (user can manipulate client-side timer), causes bugs when client/server time drift.

**Instead:** Server calculates score based on server timestamp. Client displays optimistic score for UX, reconciles with server response.

```typescript
// ❌ BAD: Client calculates and sends score
const score = calculateScore(isCorrect, timeLeft);
await gameService.submitAnswer(sessionId, questionId, answerId, score);

// ✅ GOOD: Server calculates, client displays optimistic then reconciles
const optimisticScore = calculateScore(isCorrect, timeLeft); // For immediate UI feedback
const result = await gameService.submitAnswer(sessionId, questionId, answerId);
// Server returns authoritative score
setScore(result.score); // Replace optimistic with real
```

### Anti-Pattern 4: No Session Validation

**What goes wrong:** Client assumes sessionId is always valid. Doesn't handle expired sessions.

**Why bad:** Confusing errors when session expires (30 min TTL in Redis).

**Instead:** Validate session before critical operations. Handle expiry gracefully.

```typescript
// ❌ BAD: Assume session is valid
const submitAnswer = async (answerId) => {
  await gameService.submitAnswer(sessionId, questionId, answerId);
};

// ✅ GOOD: Validate session, handle expiry
const submitAnswer = async (answerId) => {
  try {
    await gameService.submitAnswer(sessionId, questionId, answerId);
  } catch (error) {
    if (error.code === 'SESSION_EXPIRED') {
      // Clear local state
      localStorage.removeItem('activeSession');
      // Show modal: "Your session expired. Start a new game?"
      setGamePhase('ERROR');
      showSessionExpiredModal();
    }
  }
};
```

### Anti-Pattern 5: Blocking Real-Time Features with REST

**What goes wrong:** Polling REST endpoints for multiplayer game state (e.g., `/api/game-state` every 500ms).

**Why bad:** Wasteful (99% of polls return no changes), high latency (500ms best case), server load scales with players × poll rate.

**Instead:** WebSockets for real-time events. REST for commands.

```typescript
// ❌ BAD: Polling for game state
useEffect(() => {
  const interval = setInterval(async () => {
    const state = await fetch(`/api/games/${gameId}/state`).then(r => r.json());
    setGameState(state);
  }, 500);
  return () => clearInterval(interval);
}, [gameId]);

// ✅ GOOD: WebSocket for state updates, REST for commands
const socket = io('/game');
socket.on('gameStateUpdate', (state) => setGameState(state));
socket.emit('submitAnswer', { gameId, answerId });
```

---

## Scalability Considerations

### At 100 Users (MVP - Current Target)

**Bottlenecks:** None. Simple architecture works.

**Approach:**
- Single Express server
- PostgreSQL for everything (questions + sessions)
- No Redis yet (sessions in PostgreSQL)
- No CDN (static assets from Express)

**Cost:** ~$20/month (single Heroku dyno + Postgres)

### At 10K Users (Growth Phase)

**Bottlenecks:** Database connections, session lookup latency.

**Approach:**
- Redis introduced for session state (hot data)
- PostgreSQL for persistent data only
- Connection pooling (pg-pool)
- CDN for static assets (Cloudflare)
- Horizontal scaling: 2-3 Express instances behind load balancer

**Cost:** ~$200/month (Redis $10, multiple dynos $50, Postgres $50, CDN free tier)

### At 1M Users (Scale Phase)

**Bottlenecks:** Database writes (game history), question delivery, WebSocket connections.

**Approach:**
- Redis Cluster for session state + leaderboards
- Read replicas for PostgreSQL (questions are read-heavy)
- Separate WebSocket servers from REST servers
- Message queue (Redis Streams) for async processing (badge calculations, XP updates)
- CDN with edge caching for questions (rarely change)
- Separate game history writes to time-series DB (TimescaleDB)

**Cost:** ~$2K/month (managed Redis $200, Postgres with replicas $500, multiple servers $1K, CDN $100)

### Real-Time Multiplayer Considerations (Phase 2)

**Additional Requirements:**
- Sticky sessions (load balancer routes player to same WebSocket server)
- Redis Pub/Sub for cross-server messaging
- Room management (Redis sorted sets for lobbies)
- Latency monitoring (critical for fairness)

**Recommendation:** Start with Socket.io (has fallbacks, room support built-in). Graduate to bare WebSockets only if performance critical.

---

## Suggested Build Order

Build order minimizes rework and validates architecture early.

### Phase 1: Core Game Loop (Week 1-2)

**Why first:** Validates FSM pattern, establishes data flow.

1. **Game Shell (FSM)** - State machine, phase transitions
2. **Question UI** - Render question/answers (static data first)
3. **Timer Component** - useEffect + cleanup pattern
4. **API Client (Game Service)** - Service layer skeleton
5. **Session Controller** - Create session, fetch questions
6. **Integration** - Wire frontend to backend

**Validation:** Can play a full game (hard-coded questions → real DB).

### Phase 2: Scoring & Validation (Week 2)

**Why second:** Establishes server authority pattern.

1. **Answer Validation** - Server-side correctness check
2. **Score Calculation** - Server-side, time-based scoring
3. **Optimistic UI** - Client-side optimistic updates
4. **Error Handling** - Timeout, validation failures

**Validation:** Score calculated on server, client reconciles.

### Phase 3: Learning Flow (Week 3)

**Why third:** Parallel flow, tests modal state management.

1. **Learning Modal** - Modal component, open/close
2. **Content Controller** - Fetch educational content
3. **Save for Later** - Persist saved content to DB
4. **Integration** - "Learn more" button → modal → save

**Validation:** Learning flow works without disrupting game flow.

### Phase 4: Progression System (Week 3-4)

**Why fourth:** Depends on completed game loop.

1. **Progress Service** - XP/gems calculation
2. **Badge System** - Badge criteria evaluation
3. **Profile Updates** - Persist rewards to DB
4. **Results Screen** - Display rewards

**Validation:** Completing game awards XP, gems, badges.

### Phase 5: Redis Introduction (Week 4)

**Why fifth:** Optimization, not core functionality.

1. **Session Storage Migration** - Move sessions from Postgres to Redis
2. **TTL Configuration** - Auto-expire abandoned sessions
3. **Cache Layer** - Cache frequently-accessed questions

**Validation:** Performance improves, functionality unchanged.

### Phase 6: Polish & Error States (Week 5)

**Why last:** Refine based on user testing.

1. **Session Resurrection** - localStorage recovery
2. **Error Boundaries** - Graceful error handling
3. **Loading States** - Skeletons, spinners
4. **Animations** - Framer Motion transitions

**Validation:** Feels polished, handles edge cases.

### Phase 7 (Future): Real-Time Multiplayer

**Dependencies:** Phases 1-5 complete, tested at scale.

1. **WebSocket Server** - Socket.io setup
2. **Room Management** - Redis-backed rooms
3. **Synchronization** - State sync across players
4. **Leaderboard** - Redis sorted sets

**Validation:** Multiple players can compete in real-time.

---

## Technology-Specific Patterns

### React + TypeScript Patterns

**Type-safe FSM:**
```typescript
type GameState =
  | { phase: 'IDLE' }
  | { phase: 'LOADING' }
  | { phase: 'QUESTION'; question: Question; timeLeft: number }
  | { phase: 'REVEAL'; question: Question; isCorrect: boolean; points: number }
  | { phase: 'COMPLETE'; finalScore: number; rewards: Rewards };

// TypeScript enforces valid state access
const GameShell = ({ state }: { state: GameState }) => {
  if (state.phase === 'QUESTION') {
    // TypeScript knows `state.question` exists
    return <QuestionUI question={state.question} timeLeft={state.timeLeft} />;
  }
  // ...
};
```

**Custom Hooks for Reusable Logic:**
```typescript
// useGameSession.ts
export const useGameSession = (sessionId: string) => {
  const [gameState, setGameState] = useState<GameState>({ phase: 'IDLE' });

  const startGame = useCallback(async () => {
    setGameState({ phase: 'LOADING' });
    const session = await gameService.startSession();
    setGameState({
      phase: 'QUESTION',
      question: session.firstQuestion,
      timeLeft: 10
    });
  }, []);

  return { gameState, startGame, submitAnswer, ... };
};
```

### Express + Node.js Patterns

**Controller Layer (Thin):**
```javascript
// sessionController.js
export const createSession = async (req, res, next) => {
  try {
    const { userId } = req.user; // From JWT middleware
    const session = await sessionService.createSession(userId);
    res.json(session);
  } catch (error) {
    next(error); // Pass to error middleware
  }
};
```

**Service Layer (Business Logic):**
```javascript
// sessionService.js
export const createSession = async (userId) => {
  const sessionId = uuidv4();
  const questions = await questionService.getRandomQuestions(10, userId);

  const session = {
    sessionId,
    userId,
    questions: questions.map(q => q.id),
    currentQuestionIndex: 0,
    answers: [],
    score: 0,
    startedAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000 // 30 min
  };

  await redis.setex(`session:${sessionId}`, 1800, JSON.stringify(session));

  return {
    sessionId,
    firstQuestion: questions[0]
  };
};
```

### PostgreSQL Patterns

**Prepared Statements (Prevent SQL Injection):**
```javascript
const getQuestionsByCategory = async (category, limit) => {
  const query = `
    SELECT q.id, q.text, q.explanation, json_agg(a) as answers
    FROM questions q
    JOIN answers a ON a.question_id = q.id
    WHERE q.category = $1
    GROUP BY q.id
    ORDER BY RANDOM()
    LIMIT $2
  `;
  const result = await db.query(query, [category, limit]);
  return result.rows;
};
```

**Transactions for Rewards (ACID):**
```javascript
const awardRewards = async (userId, xp, gems, badgeIds) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Update XP and gems
    await client.query(
      'UPDATE users SET xp = xp + $1, gems = gems + $2 WHERE id = $3',
      [xp, gems, userId]
    );

    // Award badges
    for (const badgeId of badgeIds) {
      await client.query(
        'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, badgeId]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

### Redis Patterns

**Session Management with TTL:**
```javascript
// Store session
await redis.setex(`session:${sessionId}`, 1800, JSON.stringify(session));

// Get session
const sessionData = await redis.get(`session:${sessionId}`);
const session = sessionData ? JSON.parse(sessionData) : null;

// Update session (refresh TTL)
await redis.setex(`session:${sessionId}`, 1800, JSON.stringify(updatedSession));
```

**Leaderboard (Sorted Sets):**
```javascript
// Add player score
await redis.zadd('leaderboard:daily', score, userId);

// Get top 10
const topPlayers = await redis.zrevrange('leaderboard:daily', 0, 9, 'WITHSCORES');

// Get player rank
const rank = await redis.zrevrank('leaderboard:daily', userId);
```

---

## Offline-First Considerations (Future Enhancement)

For PWA support (not MVP requirement):

### App Shell Architecture

**Core Principle:** Cache UI shell separately from dynamic content.

```javascript
// service-worker.js
const CACHE_NAME = 'civic-trivia-v1';
const SHELL_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/fonts/*'
];

// Cache shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_CACHE))
  );
});

// Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
```

### Offline Question Storage

**Strategy:** Cache questions in IndexedDB for offline play.

```typescript
// offlineStorage.ts
import { openDB } from 'idb';

const dbPromise = openDB('civic-trivia', 1, {
  upgrade(db) {
    db.createObjectStore('questions', { keyPath: 'id' });
    db.createObjectStore('offlineSessions', { keyPath: 'sessionId' });
  }
});

export const cacheQuestions = async (questions: Question[]) => {
  const db = await dbPromise;
  const tx = db.transaction('questions', 'readwrite');
  for (const question of questions) {
    await tx.store.put(question);
  }
};

export const getOfflineQuestions = async (limit: number) => {
  const db = await dbPromise;
  const allQuestions = await db.getAll('questions');
  return shuffleArray(allQuestions).slice(0, limit);
};
```

**Sync Strategy:** Background sync when online.

```javascript
// Sync offline session results when connection restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sessions') {
    event.waitUntil(syncOfflineSessions());
  }
});

const syncOfflineSessions = async () => {
  const db = await openDB('civic-trivia', 1);
  const sessions = await db.getAll('offlineSessions');

  for (const session of sessions) {
    try {
      await fetch('/api/sessions/sync', {
        method: 'POST',
        body: JSON.stringify(session)
      });
      await db.delete('offlineSessions', session.sessionId);
    } catch (error) {
      // Keep session for next sync attempt
    }
  }
};
```

---

## Build Order Implications

### Critical Path Dependencies

```
[DB Schema] → [Content Controller] → [Session Controller] → [API Gateway]
                                                                  ↓
                                              [Game Service (Client)] ← [Game Shell FSM]
                                                                  ↓
                                              [Question UI] + [Timer] + [Learning Modal]
```

**Parallelizable Work:**
- **Backend Team:** DB schema → Content Controller → Session Controller
- **Frontend Team:** Game Shell FSM → Question UI → Timer (mock API initially)
- **Integration Point:** Game Service (API client) connects both

### Testing Strategy by Phase

| Phase | What to Test | How |
|-------|-------------|-----|
| Core Game Loop | FSM transitions, timer cleanup | Jest + React Testing Library |
| Scoring & Validation | Server-side calculation, optimistic UI | Integration tests (Supertest) |
| Learning Flow | Modal state, content fetching | E2E (Playwright) |
| Progression System | XP/gems calculation, badge awards | Unit tests (Jest) |
| Redis Introduction | Session persistence, cache hits | Integration tests |
| Real-Time Multiplayer | Synchronization, race conditions | Load testing (Socket.io test suite) |

---

## Phase 2 Real-Time Architecture Preview

### WebSocket Event Architecture

```typescript
// Client → Server Events
type ClientEvent =
  | { type: 'JOIN_ROOM'; roomId: string; userId: string }
  | { type: 'SUBMIT_ANSWER'; roomId: string; questionId: string; answerId: string }
  | { type: 'LEAVE_ROOM'; roomId: string };

// Server → Client Events
type ServerEvent =
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'QUESTION_START'; question: Question; timeLimit: number }
  | { type: 'PLAYER_ANSWERED'; playerId: string }
  | { type: 'REVEAL'; correctAnswer: string; leaderboard: Leaderboard }
  | { type: 'GAME_END'; finalStandings: Player[] };
```

### Room State Management

```javascript
// roomService.js (Redis-backed)
export const createRoom = async (hostId) => {
  const roomId = uuidv4();
  const room = {
    roomId,
    hostId,
    players: [{ id: hostId, name: 'Host', score: 0 }],
    status: 'WAITING', // WAITING | IN_PROGRESS | COMPLETE
    questions: [],
    currentQuestionIndex: 0,
    createdAt: Date.now()
  };

  await redis.setex(`room:${roomId}`, 3600, JSON.stringify(room));
  return room;
};

export const addPlayerToRoom = async (roomId, player) => {
  const roomData = await redis.get(`room:${roomId}`);
  if (!roomData) throw new Error('Room not found');

  const room = JSON.parse(roomData);
  if (room.status !== 'WAITING') throw new Error('Game already started');

  room.players.push(player);
  await redis.setex(`room:${roomId}`, 3600, JSON.stringify(room));

  // Notify all players in room via Pub/Sub
  await redis.publish(`room:${roomId}:events`, JSON.stringify({
    type: 'PLAYER_JOINED',
    player
  }));
};
```

### Synchronization Pattern

**Critical:** All players must see the same question at the same time.

```javascript
// WebSocket server
io.to(roomId).emit('QUESTION_START', {
  question: sanitizeQuestion(question), // Remove correct answer
  timeLimit: 10,
  startsAt: Date.now() // Use for client-side clock sync
});

// Collect answers with timeout
const answerCollector = new AnswerCollector(roomId, players.length, 10000);
answerCollector.on('allAnswered', async (answers) => {
  const results = await scoreAnswers(answers);
  io.to(roomId).emit('REVEAL', {
    correctAnswer: question.correctAnswerId,
    leaderboard: calculateLeaderboard(results)
  });
});
```

---

## Confidence Assessment

| Area | Confidence | Source | Notes |
|------|-----------|--------|-------|
| FSM Pattern | HIGH | Multiple sources, standard practice | Well-established pattern for quiz games |
| State Management (Context) | HIGH | React docs, 2025 comparisons | Context sufficient for MVP, clear upgrade path |
| Timer Implementation | HIGH | Multiple React tutorials, code examples | useEffect + cleanup is standard, well-documented |
| Redis for Sessions | HIGH | Redis docs, scalability articles | Standard use case, proven at scale |
| WebSocket Architecture | MEDIUM | Socket.io docs, examples | Standard for multiplayer, but complex at scale |
| Offline-First | LOW | PWA docs, limited quiz-specific examples | General PWA patterns, quiz-specific implementation unclear |

---

## Sources

### Architecture & Patterns
- [A scalable, realtime quiz framework to build EdTech apps](https://ably.com/blog/a-scalable-realtime-quiz-framework-to-build-edtech-apps)
- [Building a Real-Time Multiplayer Game Server with Socket.io and Redis](https://dev.to/dowerdev/building-a-real-time-multiplayer-game-server-with-socketio-and-redis-architecture-and-583m)
- [Real-time multiplayer quiz on GitHub](https://github.com/harsh5692/quiz-time)
- [Node.js: Novice to Ninja - Chapter 14: Example Real-time Multiplayer Quiz: Architecture](https://www.oreilly.com/library/view/nodejs-novice-to/9781098141004/Text/ultimatenode1-ch14.html)

### State Management
- [State Management in 2025: When to Use Context, Redux, Zustand, or Jotai](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [React State Management in 2025: What You Actually Need](https://www.developerway.com/posts/react-state-management-2025)
- [Do You Need State Management in 2025? React Context vs Zustand vs Jotai vs Redux](https://dev.to/saswatapal/do-you-need-state-management-in-2025-react-context-vs-zustand-vs-jotai-vs-redux-1ho)

### Timer Implementation
- [Adding countdown timer in React quiz app using effect hook](https://medium.com/@biswajitpanda973/adding-countdown-timer-in-our-react-quiz-app-using-effect-hook-7ae4f3750e8f)
- [How to create a countdown timer using React Hooks](https://blog.greenroots.info/how-to-create-a-countdown-timer-using-react-hooks)
- [Creating a Custom Hook - useCountdown](https://www.kodaps.dev/en/blog/creating-a-custom-hook-usecountdown-creating-a-react-quiz-app-part-2)

### Database Design
- [Guide To Design Database For Quiz In MySQL](https://www.tutorials24x7.com/mysql/guide-to-design-database-for-quiz-in-mysql)
- [Question database structure - MoodleDocs](https://docs.moodle.org/dev/Question_database_structure)

### Redis & Caching
- [Intelligent Caching Strategies for High-Performance Applications with Redis](https://medium.com/@elammarisoufiane/intelligent-caching-strategies-for-high-performance-applications-with-redis-bb3b559d6125)
- [Redis Cache - GeeksforGeeks](https://www.geeksforgeeks.org/system-design/redis-cache/)

### PWA & Offline-First
- [Progressive Web Apps: bridging web and mobile in 2025](https://tsh.io/blog/progressive-web-apps-in-2025)
- [Building Real Progressive Web Apps in 2025](https://medium.com/@ancilartech/building-real-progressive-web-apps-in-2025-lessons-from-the-trenches-23422e1970d6)
- [PWA and Offline Games](https://dev.to/aerabi/pwa-and-offline-games-3b2e)

### Frontend Architecture
- [The 5 Frontend Architectures You Must Know in 2025](https://feature-sliced.design/blog/frontend-architecture-guide)
- [Front End System Design Interview](https://www.frontendinterviewhandbook.com/front-end-system-design)

---

**END OF DOCUMENT**

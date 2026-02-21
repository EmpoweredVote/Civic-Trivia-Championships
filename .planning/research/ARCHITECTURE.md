# Architecture: Feedback Marks Integration

**Project:** Civic Trivia Championship
**Feature:** Player Feedback/Flagging System
**Researched:** 2026-02-21

## Executive Summary

The feedback marks feature adds player-driven quality control to the game. Players can flag questions during gameplay, provide optional explanations post-game, and admins review flagged questions through a dedicated interface. This document maps how the feature integrates with existing game flow, session management, and admin UI.

**Core Integration Points:**
1. **Game Session (Redis)** - Track which questions flagged during play
2. **Answer Submission** - Extend existing POST /api/game/answer with optional flagged boolean
3. **Post-Game Summary** - New section in ResultsScreen for flagged questions with text input
4. **Database** - New question_flags table + flag_count column on questions table
5. **Admin UI** - Flag count column in QuestionTable + new FlagsReviewPage

---

## System Context

### Existing Architecture

**Backend (Node.js + Express + TypeScript):**
- RESTful routes: `/api/game/*`, `/api/admin/*`
- Session storage: Redis (Upstash) with graceful degradation to MemoryStorage
- Database: PostgreSQL via Supabase with Drizzle ORM
- Auth: JWT tokens via middleware (authenticateToken, optionalAuth, requireAdmin)
- Game flow: POST /session → POST /answer (per question) → GET /results/:sessionId

**Frontend (React 18 + TypeScript + Vite):**
- Game state: useGameState hook manages phase transitions
- Game components: GameScreen (answering) → ResultsScreen (post-game review)
- Admin components: QuestionsPage (table + filters) + QuestionDetailPanel (side panel)
- Admin routing: /admin/dashboard, /admin/questions, /admin/collections

**Session Management:**
- GameSession interface stores: questions, answers, userId, collectionId, adaptiveState, plausibilityFlags
- ServerAnswer interface stores: questionId, selectedOption, timeRemaining, points, flagged (plausibility check)
- TTL: 1 hour for sessions in Redis

**Admin UI Pattern:**
- Master-detail: QuestionTable (list) + QuestionDetailPanel (side drawer)
- URL-driven filters: searchParams manage page, sort, collection, difficulty, status, search
- Mutations update local state optimistically, refetch on success

---

## Integration Architecture

### Data Flow Overview

```
Player flags question during reveal
    ↓
Session tracks flagged questionIds (Redis)
    ↓
Post-game summary shows flagged questions
    ↓
Player optionally adds text feedback
    ↓
Submit feedback → Database (question_flags table)
    ↓
Admin sees flag count in QuestionTable
    ↓
Admin opens QuestionDetailPanel → sees flag count + link to review
    ↓
Admin navigates to FlagsReviewPage → sees all feedback
    ↓
Admin archives question directly from flags page
```

---

## Component Integration Map

### 1. Game Session (Redis/Memory)

**Current State:**
```typescript
interface GameSession {
  sessionId: string;
  userId: string | number;
  questions: Question[];
  answers: ServerAnswer[];
  createdAt: Date;
  lastActivityTime: Date;
  progressionAwarded: boolean;
  plausibilityFlags: number; // Cheat detection counter
  collectionId: number | null;
  collectionName: string | null;
  collectionSlug: string | null;
  adaptiveState?: { ... };
}
```

**Required Addition:**
```typescript
interface GameSession {
  // ... existing fields
  feedbackFlags: Set<string>; // questionIds flagged by player
}
```

**Rationale:**
- Temporary storage during game (doesn't need to persist beyond session TTL)
- Allows post-game summary to display which questions were flagged
- Set prevents duplicate flags if player accidentally toggles twice

**Files to Modify:**
- `C:\Project Test\backend\src\services\sessionService.ts` - Add feedbackFlags field to GameSession interface and initialization

---

### 2. Answer Reveal Screen (Frontend)

**Current Flow:**
1. Player answers question → POST /api/game/answer
2. GameScreen transitions to 'revealing' phase
3. Shows correct answer, explanation, points earned
4. Player taps anywhere to advance to next question

**New Flow:**
1. Player answers question → POST /api/game/answer
2. GameScreen transitions to 'revealing' phase
3. Shows correct answer, explanation, points earned
4. **NEW:** If authenticated, show thumbs-down icon in bottom-left corner
5. Player can tap thumbs-down to flag question (toggles visual state)
6. Player taps anywhere else to advance to next question

**Visual Treatment:**
- Small thumbs-down icon (24x24px), semi-transparent by default
- Hover: brighten slightly
- Tapped: fill icon + brief haptic/animation feedback
- Position: Bottom-left corner, 16px from edges
- No modal/confirmation needed (low friction)

**Files to Create:**
- `C:\Project Test\frontend\src\features\game\components\FeedbackButton.tsx`

**Files to Modify:**
- `C:\Project Test\frontend\src\features\game\components\GameScreen.tsx` - Add flaggedQuestions state + render FeedbackButton

---

### 3. Post-Game Summary (Frontend)

**New Section:** "Flagged Questions" section above answer review accordion

**Flow:**
1. Game completes → GET /api/game/results/:sessionId (returns flagged question IDs)
2. ResultsScreen displays score, accuracy, answer review accordion
3. **NEW:** If any questions flagged, show "Flagged Questions" section
4. For each flagged question:
   - Show question text (truncated)
   - Optional textarea for feedback (placeholder: "What was wrong with this question?")
   - Character limit: 500 chars
5. "Submit Feedback" button (only enabled if flags exist)
6. POST /api/feedback/submit with { sessionId, flags: [{ questionId, feedback }] }
7. Success → show toast "Feedback submitted, thank you!"

**Files to Create:**
- `C:\Project Test\frontend\src\features\game\components\FlaggedQuestionsSection.tsx`

**Files to Modify:**
- `C:\Project Test\frontend\src\features\game\components\ResultsScreen.tsx` - Add flaggedQuestions prop + render section
- `C:\Project Test\frontend\src\pages\Game.tsx` - Pass flaggedQuestions from GameScreen to ResultsScreen

---

### 4. Backend Session Tracking

**Modified Endpoint: POST /api/game/answer**

Add optional `flagged` boolean to request body:
```json
{
  "sessionId": "uuid",
  "questionId": "q001",
  "selectedOption": 2,
  "timeRemaining": 15,
  "flagged": true  // NEW (optional)
}
```

If flagged=true, add questionId to session.feedbackFlags Set.

**Modified Endpoint: GET /api/game/results/:sessionId**

Add feedbackFlags array to response:
```json
{
  "answers": [...],
  "totalScore": 1500,
  "feedbackFlags": ["q001", "q005"]  // NEW
}
```

**Files to Modify:**
- `C:\Project Test\backend\src\routes\game.ts` - Add flagged handling to POST /answer, add feedbackFlags to GET /results response
- `C:\Project Test\backend\src\services\sessionService.ts` - Add feedbackFlags to GameSession interface

---

### 5. Database Schema

**New Table: `question_flags`**
```sql
CREATE TABLE civic_trivia.question_flags (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES civic_trivia.questions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255), -- Optional: track which game session
  feedback_text TEXT, -- Optional: player's explanation (max 500 chars validated in app)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for admin queries
CREATE INDEX idx_question_flags_question_id ON civic_trivia.question_flags(question_id);
CREATE INDEX idx_question_flags_user_id ON civic_trivia.question_flags(user_id);
CREATE INDEX idx_question_flags_created_at ON civic_trivia.question_flags(created_at DESC);

-- Denormalized flag count on questions table for fast filtering
ALTER TABLE civic_trivia.questions
  ADD COLUMN flag_count INTEGER DEFAULT 0 NOT NULL;

-- Trigger to maintain flag_count
CREATE OR REPLACE FUNCTION update_question_flag_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_trivia.questions
    SET flag_count = flag_count + 1
    WHERE id = NEW.question_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_trivia.questions
    SET flag_count = flag_count - 1
    WHERE id = OLD.question_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_question_flag_count
AFTER INSERT OR DELETE ON civic_trivia.question_flags
FOR EACH ROW
EXECUTE FUNCTION update_question_flag_count();
```

**Files to Create:**
- `C:\Project Test\backend\migrations\XXX-add-question-flags.sql` - Migration script

**Files to Modify:**
- `C:\Project Test\backend\src\db\schema.ts` - Add questionFlags table + flagCount column to questions

---

### 6. Feedback Submission Endpoint

**New Endpoint: POST /api/feedback/submit**
- Auth: Required (authenticateToken middleware)
- Body: `{ sessionId: string, flags: Array<{ questionId: string, feedback?: string }> }`
- Validation:
  - Session must exist and belong to authenticated user
  - questionId must be in session.questions
  - feedback max length 500 chars
  - Deduplicate: Don't insert duplicate flag for same user+question
- Response: `{ success: true, flagsSubmitted: number }`

**Critical Note on Question ID Mapping:**
- Frontend uses string IDs (e.g., "q001" from Question.id)
- Database uses numeric IDs (auto-increment serial)
- Need to map questionId string → numeric DB ID before inserting
- **Recommended Solution:** Store question DB ID alongside each Question in session during creation

**Files to Create:**
- `C:\Project Test\backend\src\routes\feedback.ts`

**Files to Modify:**
- `C:\Project Test\backend\src\server.ts` - Import and mount feedback router

---

### 7. Admin Question Explorer Integration

**Required Changes:**
1. Add `flag_count` column to QuestionTable
2. Make `flag_count` sortable
3. Add flag count visual indicator (red badge if flagCount > 0)

**Files to Modify:**
- `C:\Project Test\frontend\src\pages\admin\components\QuestionTable.tsx` - Add flagCount column with badge
- `C:\Project Test\backend\src\routes\admin.ts` - Add flagCount to GET /admin/questions/explore response

---

### 8. Admin Question Detail Panel Integration

**Required Changes:**
1. Display flag count in header (e.g., "⚠️ 3 flags" badge)
2. Add "View Flags" button that links to FlagsReviewPage with question filter

**Files to Modify:**
- `C:\Project Test\frontend\src\pages\admin\components\QuestionDetailPanel.tsx` - Add flag count badge + link
- `C:\Project Test\backend\src\routes\admin.ts` - Add flagCount to GET /admin/questions/:id/detail response

---

### 9. Admin Flags Review Page (NEW)

**Purpose:** Dedicated page for admins to review flagged questions and player feedback.

**Features:**
1. Table of all flags, sortable by: created_at (default DESC), question ID, user
2. Filterable by: question ID (URL param)
3. Each row shows: question text (truncated), player name, feedback text, timestamp
4. Action: Archive question button

**URL Structure:**
- `/admin/flags` - All flags
- `/admin/flags?question=123` - Flags for specific question

**Files to Create:**
- `C:\Project Test\frontend\src\pages\admin\FlagsReviewPage.tsx`

**Files to Modify:**
- `C:\Project Test\frontend\src\App.tsx` - Add route for /admin/flags
- `C:\Project Test\backend\src\routes\admin.ts` - Add GET /admin/flags endpoint

---

## Build Order Recommendation

**Phase 1: Backend Foundation (Day 1)**
1. Add `feedbackFlags` field to GameSession interface
2. Modify POST /api/game/answer to accept `flagged` boolean
3. Modify GET /api/game/results to return `feedbackFlags` array
4. Create database migration for question_flags table + flag_count column
5. Update Drizzle schema

**Phase 2: Frontend Flagging (Day 2)**
1. Create FeedbackButton component
2. Add flaggedQuestions state to GameScreen
3. Render FeedbackButton during reveal phase
4. Pass flaggedQuestions to ResultsScreen

**Phase 3: Feedback Submission (Day 3)**
1. Create FlaggedQuestionsSection component
2. Integrate into ResultsScreen
3. Create POST /api/feedback/submit endpoint
4. Wire up frontend submission handler
5. Resolve question ID mapping issue

**Phase 4: Admin Integration (Day 4)**
1. Add flag_count to QuestionTable component
2. Modify GET /api/admin/questions/explore to include flagCount
3. Add flag count badge to QuestionDetailPanel
4. Modify GET /api/admin/questions/:id/detail to include flagCount

**Phase 5: Admin Review Page (Day 5)**
1. Create FlagsReviewPage component
2. Create GET /api/admin/flags endpoint
3. Add route to App.tsx
4. Link from QuestionDetailPanel

**Testing Checkpoints:**
- After Phase 1: Verify session stores flagged questionIds
- After Phase 2: Verify frontend can flag questions during gameplay
- After Phase 3: Verify feedback persists to database
- After Phase 4: Verify admin sees flag counts
- After Phase 5: Verify admin can review all feedback

---

## Files Summary

### New Files (5)
1. `C:\Project Test\frontend\src\features\game\components\FeedbackButton.tsx`
2. `C:\Project Test\frontend\src\features\game\components\FlaggedQuestionsSection.tsx`
3. `C:\Project Test\frontend\src\pages\admin\FlagsReviewPage.tsx`
4. `C:\Project Test\backend\src\routes\feedback.ts`
5. `C:\Project Test\backend\migrations\XXX-add-question-flags.sql`

### Modified Files (11)
1. `C:\Project Test\backend\src\services\sessionService.ts` - Add feedbackFlags to GameSession
2. `C:\Project Test\backend\src\routes\game.ts` - Add flagged handling, return feedbackFlags
3. `C:\Project Test\backend\src\db\schema.ts` - Add questionFlags table, flagCount column
4. `C:\Project Test\backend\src\server.ts` - Mount feedback router
5. `C:\Project Test\frontend\src\features\game\components\GameScreen.tsx` - Add flagging state + button
6. `C:\Project Test\frontend\src\features\game\components\ResultsScreen.tsx` - Add flagged section
7. `C:\Project Test\frontend\src\pages\Game.tsx` - Pass flaggedQuestions between components
8. `C:\Project Test\frontend\src\pages\admin\components\QuestionTable.tsx` - Add flagCount column
9. `C:\Project Test\frontend\src\pages\admin\components\QuestionDetailPanel.tsx` - Add flag badge + link
10. `C:\Project Test\frontend\src\App.tsx` - Add /admin/flags route
11. `C:\Project Test\backend\src\routes\admin.ts` - Add flagCount to queries, add GET /flags endpoint

---

## Key Design Decisions

### Decision 1: Extend POST /answer vs New Endpoint

**Choice:** Extend POST /api/game/answer with optional `flagged` boolean

**Rationale:**
- Lower frontend complexity (single request during answer submission)
- Matches mental model: "flag as part of answering"
- No additional network round-trip
- Flag state can be toggled during reveal, then sent on next answer submission

**Alternative Considered:** New POST /api/game/flag endpoint
- Pro: Cleaner separation of concerns
- Con: Additional HTTP request, more complex frontend state management

### Decision 2: Session Storage vs Direct Database

**Choice:** Store flags in session (Redis) first, persist to database post-game

**Rationale:**
- Consistent with existing session-based architecture
- Allows player to change mind (toggle flags during game)
- Single database write at game end (more efficient)
- Matches existing pattern for answers

**Alternative Considered:** Write to database immediately on flag
- Pro: More durable (survives session expiry)
- Con: More write operations, harder to allow un-flagging

### Decision 3: Denormalized flag_count vs JOIN

**Choice:** Maintain flag_count on questions table via trigger

**Rationale:**
- Admin QuestionTable query already complex (8 columns)
- flag_count sortable without JOINing question_flags table
- Acceptable consistency trade-off (trigger maintains count)
- Follows existing pattern (encounterCount, correctCount also denormalized)

**Alternative Considered:** Compute flag count in query
- Pro: No denormalization, always accurate
- Con: Slower queries, can't sort efficiently on flag count

### Decision 4: Question ID Mapping Strategy

**Challenge:** Frontend uses string IDs ("q001"), database uses numeric IDs (serial)

**Recommended Solution:** Store DB ID in session alongside Question during creation
```typescript
interface Question {
  id: string;        // "q001" (for frontend)
  dbId: number;      // 123 (for database operations)
  // ... other fields
}
```

**Rationale:**
- No additional database lookups on feedback submission
- Matches how questions are loaded from database into session
- Clean separation: frontend uses id, backend uses dbId

**Alternative Considered:** Query DB to map externalId → id
- Pro: No schema changes
- Con: N queries per feedback submission (inefficient)

---

## Risk Mitigation

**Risk 1: Session Expiry Before Feedback Submission**
- **Impact:** Player flags questions but session expires before submitting feedback
- **Mitigation:** Extend session TTL on GET /results call (refresh to 30 minutes)
- **Fallback:** Allow feedback submission without session validation (lower security, but better UX)

**Risk 2: Flag Count Inconsistency**
- **Impact:** Trigger fails, flag_count becomes stale
- **Mitigation:** Add database constraint + periodic reconciliation job
- **Fallback:** Recompute flag_count on admin page load (slower but accurate)

**Risk 3: Spam Flags**
- **Impact:** Malicious users flag all questions
- **Mitigation:** Require authentication, rate limit POST /feedback/submit (e.g., max 10 submissions per hour)
- **Fallback:** Admin review dashboard highlights high-frequency flaggers

**Risk 4: Question ID Mapping Bugs**
- **Impact:** Feedback submission fails if questionId format mismatch
- **Mitigation:** Comprehensive validation in POST /feedback/submit
- **Fallback:** Log errors with full context for debugging

---

## Performance Considerations

**Read Performance:**
- QuestionTable query includes flag_count (indexed column, no JOIN needed)
- Admin flags page JOINs question_flags + questions + users (indexes on all foreign keys)
- Expected volume: <1000 flags per day, negligible impact

**Write Performance:**
- INSERT into question_flags is fast (single row)
- Trigger updates flag_count synchronously (acceptable for low volume)
- Session updates in Redis are in-memory (negligible overhead)

**Caching:**
- No caching needed for v1 (low traffic)
- Future: Cache flag counts in Redis for admin dashboard

---

## Success Metrics

**Feature Adoption:**
- % of games where at least 1 question flagged
- Average flags per game (when >0)
- % of flags with feedback text provided

**Quality Impact:**
- % of flagged questions archived
- Average time from flag to archive
- Change in question quality score after addressing flags

**Admin Efficiency:**
- Time spent on flags review page
- Flags reviewed per session
- Archive rate from flags page vs. question explorer

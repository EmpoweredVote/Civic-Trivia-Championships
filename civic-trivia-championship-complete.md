# Civic Trivia Championship - Complete Design Document

**Feature:** Civic Trivia Championship  
**Pillar:** Inform  
**Version:** 1.0  
**Last Updated:** February 3, 2026  
**Status:** Design specification complete, ready for implementation

---

## Executive Summary

Civic Trivia Championship is a game-show-style trivia experience that makes civic learning engaging, social, and repeatable. Players answer multiple-choice questions about government, policy, and civic systems—either solo or in teams—while earning rewards and deepening their understanding of democracy.

### Core Design Principles

1. **Play, Not Study** - Game show aesthetics, exciting pacing, friendly competition
2. **Learn Through Discovery** - Questions reveal interesting facts, explanations satisfy curiosity
3. **Inclusive Competition** - Anyone can play regardless of prior knowledge
4. **No Dark Patterns** - No daily streaks, loss aversion, or social pressure

### Key Features

- **Solo Quick Play:** 10 questions, ~5 minutes, asynchronous
- **Team Championship:** 4-8 players, 12 questions, collaborative decision-making
- **Wager Round:** Optional high-stakes final question
- **Learn More:** Deeper dives into topics that piqued curiosity
- **Save for Later:** Bookmark topics for asynchronous exploration

---

## Complete Design Documentation

This document provides comprehensive specifications across:

1. **User Journeys** - Step-by-step experiences for first-time and experienced players
2. **Screen Specifications** - Detailed layouts for every screen
3. **Interaction Patterns** - Timing, animations, and behavior
4. **Question Design** - Writing guidelines, difficulty calibration, quality standards
5. **Scoring System** - Points, bonuses, rewards
6. **Team Mechanics** - Voting, consensus, chat
7. **Accessibility** - WCAG AA compliance, screen readers, keyboard navigation
8. **Technical Architecture** - Stack, APIs, data models
9. **Content Guidelines** - For question authors
10. **Metrics & Success Criteria**
11. **Implementation Roadmap** - Phased rollout plan

---

## User Journey: First-Time Solo Player

**Sarah, 28, heard about Empowered.Vote from a friend. She's curious but skeptical about civic stuff being "fun."**

### 1. Entry & First Impression

**Screen: Landing**
```
Civic Trivia Championship
Test your civic knowledge. Learn something new. No pressure.

[Play Solo] (primary CTA)
[Play with Teams] (secondary)

New to civic trivia? Start here. →
```

Sarah thinks: "Okay, this looks approachable. Let me try solo first."

She taps "Play Solo"

---

### 2. Mode Selection

**Screen: Solo Setup**
```
Solo Quick Play

Answer 10 questions at your own pace.
No teams, no pressure—just you and the facts.

⏱ Time: ~5 minutes
📊 Difficulty: Mixed (Easy → Hard)
🎯 Questions: 10

[Start Game]
```

Sarah thinks: "5 minutes? I can do that."

She taps "Start Game"

---

### 3. First-Time Tutorial (3 seconds)

**Screen: How It Works**
```
[Brief animated sequence showing question → timer → answer reveal]

Here's how it works:
• 10 questions, multiple choice
• 10-15 seconds per question
• Points for correct answers (+ speed bonus)
• Learn something new after each question

[Got it, let's play!]
```

She taps "Got it"

---

### 4. Question 1 (Easy)

**Screen: Question**
```
Question 1 of 10

How many members are in the U.S. Senate?

⏱ [Circular timer - 15 seconds, visual only]

[ ] 50
[ ] 100
[ ] 435
[ ] It varies
```

Sarah thinks: "Pretty sure it's 100... two per state, right?"

She selects "100" with 8 seconds remaining

---

### 5. Answer Lock & Reveal

**Screen: Locked In (2 second pause)**
```
You selected: 100
[Locked in ✓]
```

**Screen: Answer Reveal**
```
[✓ animation - modest, satisfying]

Correct! +100 points (+20 speed bonus)

100 ✓
Two senators represent each of the 50 states, regardless of population.

[Continue]
Learn more about Senate representation →
Save for later
```

Sarah thinks: "Nice! I knew that one."

She taps "Continue" (doesn't explore "Learn more" yet)

---

### 6-7. Questions 2-4

[Similar flow—Sarah gets 2 more correct, building confidence]

---

### 8. Question 5 (Medium) - First Challenge

**Screen: Question**
```
Question 5 of 10                    Your score: 480

Which of these federal agencies was created most recently?

⏱ [Timer]

[ ] Environmental Protection Agency (EPA)
[ ] Department of Homeland Security (DHS)
[ ] National Security Agency (NSA)
[ ] Federal Bureau of Investigation (FBI)
```

Sarah thinks: "Hmm, I don't actually know this..."

She guesses "Department of Homeland Security" with 3 seconds left

---

**Screen: Correct!**
```
[✓ animation]

Correct! +100 points (+5 speed bonus)

Department of Homeland Security (DHS) ✓

Created in 2002 after 9/11, DHS is the newest cabinet-level department. The EPA was founded in 1970, NSA in 1952, and FBI in 1908.

[Continue]
Learn more about DHS →
Save for later
```

Sarah thinks: "Oh wow, I got it! And that's actually interesting—the FBI is way older than I thought."

She taps "Save for later" (first time using this feature)

**Confirmation:**
```
[Toast notification]
✓ Saved to your Learning Hub
[Dismiss]
```

---

### 9. Question 8 (Hard) - First Wrong Answer

**Screen: Question**
```
Question 8 of 10                    Your score: 790

What percentage of bills introduced in Congress typically become law?

⏱ [Timer]

[ ] About 3-5%
[ ] About 15-20%
[ ] About 30-35%
[ ] About 50-60%
```

Sarah thinks: "I have no idea. Maybe 15-20%?"

She selects "About 15-20%" with 5 seconds left

---

**Screen: Not Quite**
```
[Gentle animation - no harsh red X]

Not quite. +0 points

About 3-5% ✓

Only a small fraction of introduced bills become law. In recent Congresses, this has ranged from 2-6%, with most bills dying in committee or failing to reach a floor vote.

[Continue]
Learn more about the legislative process →
Save for later
```

Sarah thinks: "Oh man, that's WAY lower than I thought. That's... actually kind of important to know."

She taps "Learn more"

---

**Screen: Learn More Modal**
```
← Back to game

Why So Few Bills Become Law

Most bills introduced in Congress never advance beyond committee review. This isn't necessarily dysfunction—it reflects:

• Symbolic bills introduced to make a statement
• Duplicate proposals on the same topic
• Lack of bipartisan support
• Strategic timing issues

The bills that do become law typically have broad support or address urgent needs.

[Continue Game]
Explore this topic in depth (Read & Rank) →
```

Sarah thinks: "Okay, that makes sense."

She taps "Continue Game"

---

### 10. Final Question - Wager Round

**Screen: Wager Setup**
```
Final Question - Wager Round!

You can wager up to half your current score (395 points).

If correct: Win your wager
If incorrect: Lose your wager

How much will you wager?

[Slider: 0 ←───●───→ 395]
Currently: 200 points

Potential outcomes:
✓ Correct: 985 points total
✗ Incorrect: 585 points total

[Lock in wager]
[Skip wager]
```

Sarah adjusts slider to 300 points, taps "Lock in wager"

---

**Screen: Final Question**
```
Question 10 of 10 - WAGER QUESTION

Your wager: 300 points

Which of these requires a two-thirds majority in the Senate?

⏱ [Timer - 20 seconds for wager questions]

[ ] Confirming a Supreme Court justice
[ ] Passing a budget
[ ] Overriding a presidential veto
[ ] Declaring war
```

Sarah thinks: "I think it's overriding a veto... pretty sure..."

She selects "Overriding a presidential veto" with 7 seconds left

---

**Screen: Final Reveal**
```
[Bigger ✓ animation - celebratory but not over-the-top]

Correct! +300 wagered points (+15 speed bonus)

Overriding a presidential veto ✓

A two-thirds majority in BOTH the House and Senate is required to override a veto. Most other actions (like confirming justices) require only a simple majority in the Senate.

Final Score: 1,100 points

[View Results]
```

Sarah thinks: "Yes! I did it!"

---

### 11. Results Screen

**Screen: Game Complete**
```
[Modest confetti animation - 2 seconds]

Solo Quick Play Complete!

Your Score: 1,100 points

Accuracy: 9/10 correct (90%)
Speed Bonus: +85 points
Wager Bonus: +300 points

You learned about:
• Senate representation
• Federal agencies (saved 💾)
• Legislative success rates (saved 💾)
• Veto override process

Rewards Earned:
+50 XP
+10 Empowered Gems 💎
First Game badge unlocked 🏆

[Play Again]
[Share Results]
[Explore Saved Topics]
[Back to Home]
```

Sarah thinks: "That was actually fun. And I feel like I learned things without it being preachy."

She taps "Share Results" and sends the link to her friend.

---

**Sarah's Takeaway:**
- Easier to start than expected
- Questions weren't too hard, but some made her think
- Liked learning interesting things even when wrong
- Wager round made it more exciting
- Would play again, maybe with friends

---

## Screen-by-Screen Specifications

### 1. Entry Point / Civic Trivia Home

**Purpose:** Set tone, explain value, route to game modes

**Layout:**
```
┌─────────────────────────────────────────┐
│  [← Back to Inform]                     │
│                                         │
│  🎯 Civic Trivia Championship           │
│                                         │
│  Test your civic knowledge.             │
│  Learn something new. No pressure.      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [Play Solo]                    │   │
│  │  Quick game, no teams           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [Play with Teams]              │   │
│  │  Collaborate and compete        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [Join Lobby]                   │   │
│  │  Enter code to join friends     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  New to civic trivia? [Learn how →]    │
│                                         │
│  Your Stats:                            │
│  Games played: 8 │ Best: 1,280 │ 82%   │
│                                         │
└─────────────────────────────────────────┘
```

**Visual Design:**
- Subtle game show stage aesthetic (curtains, spotlights, modern/clean)
- Color: Empowered.Vote teal + warm accents
- Typography: Poppins or similar (confident, slightly playful)
- Primary CTA: "Play Solo" (largest)

**Interaction:**
- "Learn how" expands inline explainer
- Stats collapsible for cleaner view

---

### 2. Question Screen (Solo Mode)

**Purpose:** Core gameplay—read question, select answer within time limit

**Layout:**
```
┌─────────────────────────────────────────┐
│  Question 3 of 10          Your score: 240│
│                                         │
│  ⏱ [Circular timer - visual, no digits]│
│                                         │
│  Which of these federal agencies was    │
│  created most recently?                 │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [ ] Environmental Protection    │   │
│  │     Agency (EPA)                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [ ] Department of Homeland      │   │
│  │     Security (DHS)              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [ ] National Security Agency    │   │
│  │     (NSA)                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [ ] Federal Bureau of           │   │
│  │     Investigation (FBI)         │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Timer Design:**
- Circular progress (like iOS Screen Time)
- Starts full (teal), depletes clockwise
- Color shifts: Teal → Yellow (50%) → Orange (25%) → Red (final 3s)
- No numeric countdown (reduces anxiety)
- Smooth 60fps animation

**Answer Options:**
- Min 48px height (touch targets)
- 16px spacing between options
- Hover: Subtle background change
- Selected: Teal border (3px), checkmark

**Accessibility:**
- Keyboard: Tab through options, Enter to select
- Screen reader: "Question 3 of 10. [Question]. Four options. Timer active."
- High contrast mode: Timer as thick border

---

### 3. Answer Reveal (Correct)

**Layout:**
```
┌─────────────────────────────────────────┐
│  Question 3 of 10                       │
│                                         │
│  [✓ animation - 0.5s]                   │
│                                         │
│  Correct! +100 points (+15 speed bonus) │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [✓] Department of Homeland      │   │
│  │     Security (DHS)              │   │ ← Green background
│  └─────────────────────────────────┘   │
│                                         │
│  Created in 2002 after 9/11, DHS is the │
│  newest cabinet-level department. The   │
│  EPA was founded in 1970.               │
│                                         │
│  [Continue] (appears after 2s)          │
│                                         │
│  [Learn more about DHS →]               │
│  [Save for later]                       │
│                                         │
│  New score: 355                         │
└─────────────────────────────────────────┘
```

**Checkmark Animation:**
- Smooth draw-in (like iOS)
- Color: Teal
- Duration: 0.5s
- Optional subtle sound

**Explanation:**
- 1-3 sentences max
- Neutral, informative tone
- Sources cited if data-heavy

**Buttons:**
- "Continue" primary (appears after 2s reading time)
- "Learn more" secondary (opens modal, doesn't leave game)
- "Save for later" tertiary (bookmarks to Learning Hub)

---

### 4. Answer Reveal (Incorrect)

**Layout:**
```
┌─────────────────────────────────────────┐
│  Question 8 of 10          Your score: 790│
│                                         │
│  [Gentle "not quite" animation]         │
│                                         │
│  Not quite. +0 points                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [ ] About 15-20%                │   │ ← Your answer (gray)
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [✓] About 3-5%                  │   │ ← Correct (green)
│  └─────────────────────────────────┘   │
│                                         │
│  Only a small fraction of bills become  │
│  law. In recent Congresses, this has    │
│  ranged from 2-6%, with most dying in   │
│  committee.                             │
│                                         │
│  [Continue]                             │
│                                         │
│  [Learn more about legislative process→]│
│  [Save for later]                       │
└─────────────────────────────────────────┘
```

**"Not Quite" Animation:**
- Subtle shake or cross-fade (NOT harsh red X)
- Gentle, not punishing
- 0.5s duration

**Tone:**
- Never "wrong" or "incorrect" in explanation
- Focus on teaching, not judging
- "Learn more" especially important here

---

### 5. Wager Round Setup

**Layout:**
```
┌─────────────────────────────────────────┐
│  Final Question - Wager Round!          │
│                                         │
│  Your current score: 790 points         │
│                                         │
│  You can wager up to half your score    │
│  (395 points) on the final question.    │
│                                         │
│  How much will you wager?               │
│                                         │
│  [Slider: 0 ←────●────→ 395]            │
│                                         │
│  Currently wagering: 200 points         │
│                                         │
│  Potential outcomes:                    │
│  ✓ If correct: 990 points total         │
│  ✗ If incorrect: 590 points total       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [Lock in wager: 200 pts]       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Skip wager - play for standard points]│
└─────────────────────────────────────────┘
```

**Slider:**
- Range: 0 to (score / 2)
- Increments: 10 points
- Real-time feedback as you drag
- Mobile: Haptic buzz at increments

**Outcomes Display:**
- Updates as slider moves
- Green ✓ for "if correct"
- Orange ✗ for "if incorrect"
- Shows exact totals

**Skip Option:**
- Always available, no penalty
- Question still asked for standard +100

---

### 6. Final Results (Solo)

**Layout:**
```
┌─────────────────────────────────────────┐
│  [Modest confetti - 2s]                 │
│                                         │
│  Solo Quick Play Complete!              │
│                                         │
│  Your Score: 1,100 points               │
│                                         │
│  Accuracy: 9/10 correct (90%)           │
│  Speed Bonus: +85 points                │
│  Wager Bonus: +300 points               │
│                                         │
│  You learned about:                     │
│  • Senate representation                │
│  • Federal agencies (saved 💾)          │
│  • Legislative rates (saved 💾)         │
│  • Veto override process                │
│                                         │
│  Rewards Earned:                        │
│  +50 XP                                 │
│  +10 Empowered Gems 💎                  │
│  🏆 First Game badge unlocked           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      [Play Again]               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Share] [Explore Saved] [Home]         │
└─────────────────────────────────────────┘
```

**Confetti:**
- Subtle, tasteful (not over-the-top)
- Teal + warm colors
- 2s duration, can skip by tapping

**Score Breakdown:**
- Primary: Total score (large)
- Secondary: Accuracy, bonuses
- Clear visual hierarchy

**"You Learned" Section:**
- 3-5 key topics
- Saved topics marked with 💾
- Tappable links

---

## Team Mode Specifications

### Team Lobby (Host View)

**Layout:**
```
┌─────────────────────────────────────────┐
│  [← Leave Lobby]                        │
│                                         │
│  Marcus's Civic Showdown                │
│                                         │
│  Waiting for players... (6/8 max)       │
│                                         │
│  Team Balance (Auto):                   │
│                                         │
│  🔵 Blue Team          🔴 Red Team       │
│  ──────────────         ──────────────  │
│  👤 Marcus (Host)      👤 Jordan         │
│  👤 Alex               👤 Sam            │
│  👤 Chris              👤 Taylor         │
│                                         │
│  Lobby Code: X7K9M2                     │
│  [Copy Code] [Copy Link]                │
│                                         │
│  Game Settings:                         │
│  • 12 questions, mixed difficulty       │
│  • 15 second discussion                 │
│  • Auto-balanced teams                  │
│  [Change Settings]                      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   [Start Game] (disabled)       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Waiting for 1 more player...           │
└─────────────────────────────────────────┘
```

**Features:**
- Real-time player list updates
- Short alphanumeric lobby code (6 chars)
- Host can change settings before start
- Start button disabled until min players (4)

---

### Team Question (Discussion Phase)

**Layout:**
```
┌─────────────────────────────────────────┐
│  Question 3 of 12                       │
│  🔵 Blue: 240    🔴 Red: 220            │
│                                         │
│  ⏱ [Team discussion: 15 seconds]       │
│                                         │
│  How many amendments are in the Bill    │
│  of Rights?                             │
│                                         │
│  Your team's votes:                     │
│  👤 Marcus: 10 ✓✓                       │
│  👤 Alex: 10 ✓✓                         │
│  👤 Chris: 10 ✓✓                        │
│                                         │
│  Consensus: 10 (unanimous!)             │
│  [This will be your team's answer]      │
│                                         │
│  Team Chat:                             │
│  ┌─────────────────────────────────┐   │
│  │ Alex: "definitely 10"           │   │
│  │ Chris: "yeah 10 for sure"       │   │
│  │ Marcus: "agree"                 │   │
│  │ [Type message..._______________]│   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Two-Phase Flow:**
1. **Individual thinking** (15s): Players vote privately
2. **Team discussion** (10-20s): Votes revealed, can change, chat

**Team Votes:**
- Checkmarks show vote distribution (✓✓ = two votes)
- Consensus indicator if unanimous
- Majority shown if split

**Team Chat:**
- Text only, 100 chars max per message
- Auto-scroll to newest
- Optional preset phrases for speed

---

### Team Results

**Layout:**
```
┌─────────────────────────────────────────┐
│  [Confetti for Blue Team - 3s]          │
│                                         │
│  Blue Team Wins! 🔵                     │
│                                         │
│  Final Score:                           │
│  🔵 Blue: 1,150                         │
│  🔴 Red: 1,080                          │
│                                         │
│  Blue Team:                             │
│  👤 Marcus: 9/12 (75%)                  │
│  👤 Alex: 10/12 (83%)                   │
│  👤 Chris: 8/12 (67%)                   │
│                                         │
│  Red Team:                              │
│  👤 Jordan: 9/12 (75%)                  │
│  👤 Sam: 10/12 (83%)                    │
│  👤 Taylor: 8/12 (67%)                  │
│                                         │
│  Team Stats:                            │
│  • Blue accuracy: 75% (9/12)            │
│  • Red accuracy: 67% (8/12)             │
│  • Blue consensus: 83%                  │
│  • Red consensus: 75%                   │
│                                         │
│  All Players Earned:                    │
│  +60 XP │ +12 Gems 💎                   │
│  Blue Bonus: +15 XP                     │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      [Play Again]               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [View Stats] [Share] [Exit]            │
└─────────────────────────────────────────┘
```

**Celebration:**
- Confetti for winning team (color-coded)
- Losing team shown with dignity

**Individual Stats:**
- Each player's accuracy (not ranked)
- Encourages seeing contribution

**Team Stats:**
- Team answer accuracy
- Consensus rate (collaboration metric)

**Rewards:**
- All players get base rewards
- Winners get small bonus (+15 XP)

---

## Question Design System

### Difficulty Bands

**Easy (70-80% correct rate):**
- Basic civic facts
- 1-2 pieces of information
- Examples:
  - "How many members in the U.S. Senate?" (100)
  - "Which branch interprets laws?" (Judicial)

**Medium (40-60% correct rate):**
- Applied understanding
- 2-3 pieces or relationships
- Examples:
  - "What % of bills become law?" (3-5%)
  - "Which state has most electoral votes?" (California)

**Hard (20-40% correct rate):**
- Contextual/historical nuance
- Multiple pieces of knowledge
- Examples:
  - "State of the Union is in which article?" (Article I)
  - "Which agency created most recently?" (DHS)

---

### Question Writing Guidelines

**DO:**
- Use clear, direct language
- Make questions fact-based
- Ensure one objectively correct answer
- Create plausible distractors
- Explain why answer is correct

**DON'T:**
- Use trick questions
- Include partisan language
- Ask about opinions
- Use "all/none of the above"
- Require obscure fact memorization

---

### Example Question Breakdown

**Question:**
"What percentage of bills introduced in Congress typically become law?"

**Options:**
- About 3-5% ← Correct
- About 15-20%
- About 30-35%
- About 50-60%

**Why This Works:**
- Fact-based
- Distractors plausible (people guess higher)
- Tests understanding of process
- Surprising answer creates learning moment

**Explanation:**
"Only a small fraction of introduced bills become law. In recent Congresses, this has ranged from 2-6%, with most bills dying in committee."

**Source:** GovTrack.us, Congressional data (2018-2024)

**Difficulty:** Medium

---

### Distractor Design

**Good Distractors:**
1. **Plausible:** Could sound right without deep knowledge
2. **Common Misconception:** Reflects what people believe
3. **Related:** Connected to topic

**Example:**

**Question:** "How many amendments in Bill of Rights?"

**Bad Distractors:**
- 5 (too obviously wrong)
- 100 (absurd)

**Good Distractors:**
- 8 (close to correct)
- 12 (confusion with 12 colonies)
- 27 (total amendments, common misconception)

---

## Scoring & Rewards

### Point System

**Base Points:**
- Correct: +100 points
- Incorrect: +0 points (no negative)

**Speed Bonus:**
- Max +50 points (answered within 2s)
- Formula: `(time_remaining / total_time) * 50`

**Wager:**
- Player wagers up to half current score
- Final question only
- If correct: +wager points
- If incorrect: -wager points

---

### Rewards

**Solo Quick Play:**
- Base: 50 XP
- Bonus: +1 XP per correct answer
- Gems: 10 base + 1 per correct

**Team Championship:**
- Base: 60 XP (participation)
- Victory: +15 XP (winners only)
- Gems: 12 base + 1 per team correct

**Badges:**
- First Game, Team Player, Perfect Score
- Curious Mind (use "Learn more" 10x)
- Fact Collector (save 10 topics)

---

### No Dark Patterns

**NOT Allowed:**
- ❌ Daily streaks that guilt
- ❌ Social pressure ("Friends earned this!")
- ❌ Limited-time badges (except real civic events)
- ❌ Leaderboards that shame

**Allowed:**
- ✅ Progress bars
- ✅ Achievement unlocks
- ✅ Celebration of completion
- ✅ Related suggestions

---

## Accessibility

### Visual

- WCAG AA contrast minimum (4.5:1 text)
- Color + icons (never color alone)
- High contrast mode available
- Min font: 16px mobile, 18px desktop

### Auditory

- All sounds optional
- No sound-only information
- Captions if spoken content added

### Motor

- Keyboard navigation (all interactive elements)
- Min 48px touch targets
- Voice control compatible
- Timer extension option (+5s, hidden setting)

### Cognitive

- Clear, simple language
- Consistent patterns
- One question at a time
- Option to pause (solo mode)

### Screen Reader

- Semantic HTML
- ARIA labels
- Announcements: "Correct! 115 points. [Explanation]"
- Focus management

---

## Technical Stack

**Frontend:**
- React 18+ with TypeScript
- Vite build tool
- Tailwind CSS
- Framer Motion animations
- WebSocket (Socket.io) for team games

**Backend:**
- Node.js + Express
- PostgreSQL (questions, games, users)
- Redis (caching, sessions)
- JWT auth

**Performance Targets:**
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Bundle: <300KB gzipped

---

## Implementation Roadmap

### Phase 1: MVP Solo Mode (2-3 months)

**Deliverables:**
- Solo Quick Play
- 100 questions (mixed difficulty)
- Answer reveal + explanations
- Basic scoring (base + speed)
- Wager round
- Results + rewards (XP, Gems)
- "Learn more" (10 topics)
- "Save for later"
- Keyboard navigation, screen readers
- Mobile responsive

**Success:** "This is actually fun to play"

---

### Phase 2: Team Mode (2-3 months)

**Deliverables:**
- Team Championship
- Lobby creation + joining (codes)
- Auto-balance + manual assignment
- Two-phase voting (individual + discussion)
- Team chat
- WebSocket infrastructure
- Team results with consensus stats
- +50 questions (total: 150)

**Success:** "Playing with friends is way more fun"

---

### Phase 3: Content Expansion (Ongoing)

**Deliverables:**
- 500+ questions total
- All topics represented (Congress, Elections, Budget, etc.)
- "Learn more" for 50+ topics
- Cross-feature links (Read & Rank, Treasury Tracker)

---

### Phase 4: Events & Hosted Mode (3-4 months)

**Deliverables:**
- Scheduled events calendar
- Host/moderator controls
- Event landing pages
- Civic moment integration (State of Union, Debate nights, Election Day)

**Success:** 1,000+ participants in first event

---

### Phase 5: Advanced Features (Future)

**Possible:**
- Question authoring tool (Mavens/Arbiters create questions)
- Custom tournaments
- Advanced stats dashboard
- Image/chart questions
- Classroom dashboard (teacher view)

---

## Open Questions for Research

1. **Should we include leaderboards?** (Could discourage low-performers)
2. **What's optimal team discussion time?** (10s / 15s / 20s)
3. **Do we need preset chat phrases?** (Or is free text enough?)
4. **How handle classroom use differently?** (vs. casual play)
5. **Should explanations be skippable?** (Speed vs. learning)

---

## Document Status

**Status:** Complete, ready for implementation  
**Created:** February 3, 2026  
**Version:** 1.0  
**Authors:** Chris Cantrell, Claude (AI Assistant)

---

## Related Documents

- `empowered-badges-design-doc-v1.md` - Badge system (integrates with trivia)
- `empowered-compass-detailed.md` - Topic filtering
- `read-and-rank-detailed.md` - Legislative analysis (linked from "Learn more")
- `treasury-tracker-detailed.md` - Budget viz (linked from budget questions)
- `issues-in-focus-detailed.md` - Civic discussions
- `empowered-essentials-detailed.md` - Maven/Arbiter profiles

---

**End of Document**

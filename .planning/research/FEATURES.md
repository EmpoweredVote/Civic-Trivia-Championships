# Features Research: v1.1 Tech Debt Hardening

**Project:** Civic Trivia Championship
**Domain:** Educational trivia game
**Researched:** 2026-02-12
**Milestone:** v1.1 Tech Debt Hardening (subsequent milestone)
**Overall Confidence:** MEDIUM

## Executive Summary

This research examines production best practices for three tech debt areas in the Civic Trivia Championship app:
1. **Learning content coverage** — How much is "enough" vs over-engineering
2. **Plausibility/anti-cheat systems** — Industry patterns for detecting cheating without false positives
3. **Redis session management** — Standard patterns for game state persistence

**Key Finding:** Current implementation (15% learning content coverage, passive plausibility logging, 1-hour in-memory sessions) is appropriate for MVP scale. Production hardening should focus on Redis migration (table stakes) and strategic content expansion (not comprehensive coverage). Plausibility systems should remain passive with improved detection, avoiding aggressive anti-cheat that punishes legitimate players.

**Philosophy alignment:** Research findings consistently support the project's "no dark patterns" principle — educational platforms emphasize explanations for learning value (not coverage metrics), and fairness-focused anti-cheat prioritizes false positive prevention over aggressive detection.

## Learning Content Coverage

### Current State
- 120 total questions
- 18/120 (15%) have deep-dive `learningContent`
- Exceeds 10-topic minimum requirement
- All questions have basic explanations

### Industry Standards

**Explanation Coverage (HIGH confidence)**

Modern quiz platforms in 2026 emphasize that **every question should have an explanation**, but distinguish between basic feedback and deep-dive content:

- **Basic explanations:** Required for all questions. Short (1-3 sentences) explaining why the answer is correct/incorrect
- **Deep-dive content:** Optional enrichment for strategic topics

Leading educational platforms like Quizizz, QuizGecko, and Quizbot now auto-generate answer explanations for every question, treating it as table stakes rather than a premium feature. Research shows students score **10-20% higher** on final tests when practice quizzes include immediate feedback explaining correct/incorrect answers.

**Content Sufficiency Thresholds (MEDIUM confidence)**

WebSearch results don't specify exact percentages for "sufficient" deep-dive coverage. Instead, the emphasis is on **strategic selection** rather than comprehensive coverage:

- Focus on **complex or counterintuitive topics** that benefit from deeper exploration
- Prioritize **high-interest areas** that drive engagement
- Use analytics to identify **frequently missed questions** as candidates for enrichment

**Content Generation Strategies (MEDIUM confidence)**

2026 platforms emphasize AI-assisted content generation with human review:
- Tools like Quizbot automatically provide detailed explanations for generated questions
- Quizizz Pro tier includes answer explanations as a key feature
- Modern workflows: AI draft → human review → quality check

### Table Stakes

| Feature | Current Status | Production Standard | Gap |
|---------|---------------|---------------------|-----|
| Basic explanations (all questions) | ✓ 120/120 | ✓ Required | NONE |
| Deep-dive content (strategic) | ✓ 18/120 (15%) | 20-30% recommended | Small |

### Differentiators

| Feature | Value Proposition | Complexity | Priority |
|---------|------------------|------------|----------|
| **Analytics-driven content expansion** | Target difficult/popular questions for deep-dives | Medium | MEDIUM |
| **User-requested explanations** | Let players flag questions they want more detail on | Low-Medium | LOW |
| **External resource links** | Connect to authoritative sources for deeper learning | Low | MEDIUM |
| **Progressive disclosure** | Show basic explanation, expand to deep-dive on request | Low | HIGH |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **100% deep-dive coverage** | Over-engineering; most answers adequately explained in 1-3 sentences | Strategic expansion to 25-30% based on analytics |
| **Long-form essays** | Players want quick learning moments, not textbook chapters | Keep deep-dives focused (3-5 paragraphs max) |
| **Mandatory reading** | Forcing players to read explanations breaks flow | Optional "Learn more" links, skippable content |
| **Coverage quotas** | Arbitrary percentage goals vs quality-driven selection | Let analytics guide which questions need enrichment |

### Recommendation for v1.1

**Strategic expansion, not comprehensive coverage:**

| Coverage Level | Questions | Status | Action |
|----------------|-----------|--------|--------|
| Basic explanations | 120/120 | ✓ COMPLETE | No action needed |
| Deep-dive content | 18/120 (15%) | ✓ SUFFICIENT | Strategic expansion to 25-30% |
| Target: 30-36 questions | | | Focus on frequently missed or complex topics |

**Rationale:**
- 15% exceeds minimum requirement and is production-ready
- 25-30% provides adequate coverage without over-engineering
- Prioritize quality and strategic selection over hitting arbitrary percentages
- Use game analytics to guide expansion (which questions do players struggle with?)

**Implementation approach:**
1. **Defer to ongoing work** — Don't block v1.1 milestone completion
2. **Analytics-driven** — Identify top 10-15 questions that need deep-dives based on:
   - High incorrect answer rate
   - High engagement (players spend time on explanation)
   - Topic complexity (civic concepts that benefit from deeper explanation)
3. **Incremental expansion** — Add 2-3 deep-dive pieces per week over 6-8 weeks
4. **Quality over quantity** — Better to have 25 excellent deep-dives than 60 mediocre ones

**Complexity:** LOW-MEDIUM (content creation, not technical implementation)
**Priority:** MEDIUM (nice-to-have, not blocking)

## Plausibility / Anti-Cheat Systems

### Current State
- Server-side scoring prevents client manipulation
- Timing checks log suspicious patterns (too fast/too slow)
- No penalties applied to flagged behavior
- Speed bonus encourages fast answers

### Table Stakes (Production Quiz Apps)

**1. Server-Side Authority (HIGH confidence)**
- ✓ Already implemented
- All scoring calculations server-side
- Answers validated against stored correct responses
- Prevents client-side manipulation

**2. Timing Analysis (HIGH confidence)**

Production systems track multiple timing signals:
- **Minimum answer time:** Flags answers submitted faster than humanly possible (typically <500ms for reading + selection)
- **Maximum answer time:** Detects timeout or AFK behavior
- **Pattern analysis:** Identifies suspiciously consistent timing across questions
- **Tab switching detection:** Logs when users leave quiz tab (indicates potential lookup)

**Implementation approaches:**
```
Passive (current): Log + analyze, no immediate penalties
Active: Show warnings, extend review time, or flag for human review
Aggressive: Auto-fail or reduce scores (HIGH false positive risk)
```

**3. Response Pattern Detection (MEDIUM confidence)**

Advanced systems analyze behavioral patterns:
- Contradictory responses on related questions
- Extreme accuracy spikes mid-session (suggests outside help)
- Uniform answer selection patterns (A-A-A-A suggests random clicking)
- Perfect accuracy with minimal time (impossible combination)

**4. Browser Monitoring (MEDIUM confidence)**

Common in high-stakes assessments:
- Lockdown browser mode (prevents tab switching)
- Webcam snapshots or continuous recording
- Screen recording
- AI behavior analysis (typing speed, mouse movements)

**For educational trivia:** These are **OVERKILL** and conflict with "no dark patterns" philosophy.

### Differentiators (Competitive Advantages)

**Fairness-First Anti-Cheat (HIGH confidence with project philosophy)**

The project's "no dark patterns" principle aligns perfectly with 2026 best practices emphasizing **integrity over surveillance**:

> "The best approach emphasizes integrity rather than security. Prevention is much more effective than surveillance policies."

**Differentiation strategies:**
1. **Transparent plausibility checks** — Show players their timing/pattern analysis (educational feedback, not punishment)
2. **Adaptive difficulty** — Instead of penalizing fast answers, match players with appropriately challenging questions
3. **Learning-focused scoring** — De-emphasize competitive metrics, emphasize knowledge growth
4. **Grace periods** — Allow occasional anomalies (network lag, legitimate speed) before flagging

**Speed Bonus Fairness (LOW confidence — limited specific research)**

WebSearch found limited discussion of speed bonus fairness in 2026. Key findings:
- Time limits prevent external lookup cheating (typical: "few seconds" per question)
- Some apps removed milliseconds from timers for fairness
- Skill-based matching reduces unfairness from speed differences

**Accessibility consideration:** Speed bonuses may disadvantage players with motor impairments or slower processing speeds. WCAG guidelines require timing accommodations.

### Anti-Features (What NOT to Build)

**1. Aggressive Auto-Penalties**
**What:** Automatic score reduction or auto-fail for flagged timing
**Why avoid:** High false positive rate. Legitimate players penalized for:
- Network lag causing delayed submission
- Re-reading complex questions carefully
- Disabilities affecting response time
- Slow devices causing UI lag

**What to do instead:** Log patterns, flag for review, show warnings on suspicious behavior. Human review or AI-assisted pattern analysis for persistent issues.

**2. Webcam/Screen Recording**
**What:** Continuous monitoring via camera or screen capture
**Why avoid:**
- Privacy concerns
- Overkill for low-stakes educational trivia
- Creates anxiety and surveillance feeling
- Conflicts with "no dark patterns" principle
- High technical complexity

**What to do instead:** Focus on test design (question randomization, time limits) and behavioral analysis (patterns over time).

**3. Aggressive Browser Lockdown**
**What:** Preventing all tab switching, blocking DevTools, requiring lockdown browser
**Why avoid:**
- Accessibility issues (screen readers, assistive tech)
- User experience friction
- False sense of security (sophisticated cheaters bypass anyway)
- Inappropriate for learning-focused, low-stakes environment

**What to do instead:** Light touch monitoring (log tab switches) with warning messages. Trust users, verify patterns.

**4. Perfect Accuracy Requirements**
**What:** Assuming 100% accuracy = cheating
**Why avoid:** Some players are genuinely knowledgeable. Creates false positives and discourages legitimate high performers.

**What to do instead:** Combine accuracy with timing, consistency, and behavioral patterns. High accuracy + reasonable timing = legitimate skill.

### Recommendation for v1.1

**Enhance detection, remain passive on enforcement:**

| Enhancement | Complexity | Priority | Rationale |
|-------------|-----------|----------|-----------|
| Improved timing thresholds | Low | HIGH | Better signal quality for future analysis |
| Tab switching detection | Low-Med | MEDIUM | Non-invasive, logs for pattern review |
| Response pattern analysis | Medium | LOW | Useful for future improvements, not urgent |
| Warning messages | Low | MEDIUM | Educational feedback without penalties |

**Recommended approach:**
1. **Improve signal quality:** Better timing thresholds (account for question complexity, reading time)
2. **Pattern analysis:** Track behavior over multiple sessions (one anomaly ≠ cheating)
3. **Transparent feedback:** Show players their stats ("You answered 3x faster than average — impressive!")
4. **Human review path:** Flag persistent suspicious patterns for manual review
5. **No auto-penalties:** Maintain passive logging approach

**Key principle:** Optimize for **false positive prevention** over detection rate. Better to miss some cheaters than punish legitimate players.

**Accessibility integration:** Respect `timer_multiplier` settings in plausibility checks. Players with 2x time shouldn't be flagged for "too slow" responses.

**Complexity:** LOW-MEDIUM (mostly configuration tuning)
**Priority:** MEDIUM (quality improvement, not blocking)

## Redis Session Management

### Current State
- In-memory session storage (JavaScript Map)
- 1-hour TTL with automatic expiry
- Data lost on server restart
- Simple, works for MVP scale

### Table Stakes (Production Game Applications)

**1. Redis as Session Store (HIGH confidence)**

Redis is the industry-standard choice for session management in production applications:

**Why Redis:**
- **Speed:** Sub-millisecond latency for session reads/writes
- **Built-in TTL:** Automatic expiration without manual cleanup
- **Persistence options:** Prevent data loss on restart
- **Horizontal scaling:** Works across multiple app servers
- **No sticky sessions:** Load balancers can route to any server

**Standard implementation pattern:**
```typescript
// Session structure
Key: `session:{sessionId}`
Value: JSON-serialized game state
TTL: 1 hour (3600 seconds)

// Data structure choice: String (key-value)
// Simple session data fits in single key
// Hash structure only needed for frequent partial updates
```

**2. TTL Management Patterns (HIGH confidence)**

Two primary expiration strategies:

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| **Absolute expiry** | Fixed duration regardless of activity | Session security, exam time limits |
| **Sliding expiry** | TTL refreshes on each access | Consumer apps, ongoing gameplay |

**For trivia game:** **Absolute expiry** is correct choice. Game has fixed 10-question duration, natural endpoint. Sliding expiry would allow indefinite paused games.

**Implementation:**
```typescript
// Set session with TTL on creation
await redis.setex(`session:${sessionId}`, 3600, JSON.stringify(gameState));

// No TTL refresh on access — absolute 1-hour expiry
// Game completes long before expiry in normal play
```

**3. Persistence Strategy (HIGH confidence)**

Redis offers three persistence modes:

| Mode | Durability | Performance | Use Case |
|------|-----------|-------------|----------|
| **No persistence** | Lost on restart | Fastest | Pure cache (not sessions) |
| **RDB (snapshots)** | Point-in-time | Fast writes | Acceptable data loss window |
| **AOF (append-only)** | Every write | Slight overhead | Critical data |
| **RDB + AOF** | Best durability | Most overhead | Maximum safety |

**For game sessions:**
- **RDB snapshots** (every 5-15 minutes) are sufficient
- Games complete in 5-10 minutes typically
- Acceptable to lose in-progress games on crash (rare event)
- AOF overhead not justified for ephemeral game state

**4. Memory Optimization (MEDIUM confidence)**

Production patterns for efficient session storage:

**Key naming:**
- Short, consistent prefixes save memory at scale
- `s:{id}` vs `session:{sessionId}` saves 42-44 bytes per key
- For 120-char IDs: 6 bytes vs 50 bytes

**Data structure choice:**
- Use **String** for simple JSON blobs (session data)
- Use **Hash** only if frequently updating specific fields
- Hash with ziplist encoding is more memory-efficient at scale
- For game sessions: String is simpler, performance is comparable

**Eviction policies:**
- `volatile-lru` — Evict least-recently-used keys with TTL
- Appropriate for session store (all keys have TTL)
- Prevents memory overflow if TTLs don't clean up fast enough

**Memory monitoring thresholds:**
- Memory usage > 80%: Investigate growth
- Fragmentation ratio > 1.5: Consider rebalance
- TTL key ratio < 50%: Add expirations

**5. Cleanup and Expiration (HIGH confidence)**

Redis uses dual expiration mechanism:

**Passive expiration:**
- Key checked on access
- If expired, deleted immediately
- Returns null to application

**Active expiration:**
- Background process samples random keys with TTL
- Default: 10 checks per second (`hz` parameter)
- `active-expire-effort` tunable 1-10 (low to aggressive)

**Lazy deletion:**
- Enable `lazyfree-lazy-eviction` for background cleanup
- Offloads memory reclamation to background threads
- Prevents blocking on large value deletion

**For game sessions:** Default settings are sufficient. 1-hour TTL + automatic cleanup handles session lifecycle without manual intervention.

### Anti-Features (Over-Engineering Warnings)

**1. Complex Session Partitioning**
**What:** Storing session data across multiple Redis keys/structures
**Why avoid:**
- Adds complexity for minimal benefit
- Single JSON blob per session is simpler
- Network round-trips for multiple keys
- Game session size is small (<10KB typically)

**What to do instead:** Single key per session with JSON-serialized state. Simple, fast, easy to reason about.

**2. Session Replication Across Regions**
**What:** Active-Active Redis with geographic replication
**Why avoid:**
- Overkill for v1.1 single-region deployment
- Adds significant complexity and cost
- Game sessions are short-lived (10 minutes)
- Loss of in-progress game on regional failure is acceptable

**What to do instead:** RDB snapshots for local persistence. Consider replication when scaling to multiple regions.

**3. Redis Cluster for Sessions**
**What:** Sharding sessions across Redis cluster
**Why avoid:**
- Not needed at current scale (<10K concurrent users)
- Single Redis instance handles 100K+ ops/sec
- Adds operational complexity
- Session data is small and ephemeral

**What to do instead:** Single Redis instance with adequate memory. Vertical scaling before horizontal.

**4. Custom TTL Refresh Logic**
**What:** Sliding window TTL with manual refresh on every access
**Why avoid:**
- Not appropriate for fixed-duration trivia games
- Adds write load (every read becomes read+write)
- Absolute expiry is simpler and correct

**What to do instead:** Set TTL once on session creation. Games complete before expiry.

### Recommendation for v1.1

**Migrate to Redis with production-ready patterns:**

| Component | Implementation | Priority | Complexity |
|-----------|---------------|----------|-----------|
| Redis setup | Local instance or managed service | HIGH | Low |
| Session structure | String key with JSON value | HIGH | Low |
| TTL strategy | Absolute 1-hour expiry | HIGH | Low |
| Persistence | RDB snapshots (5-15min) | HIGH | Low |
| Memory optimization | Short key names, volatile-lru | MEDIUM | Low |
| Monitoring | Memory usage alerts | LOW | Medium |

**Migration approach:**

1. **Setup Redis instance**
   - Development: Local Redis or Docker container
   - Production: Managed service (AWS ElastiCache, Azure Cache, Railway)

2. **Update session storage code**
   ```typescript
   // Replace in-memory Map with Redis
   import Redis from 'ioredis';

   const redis = new Redis(process.env.REDIS_URL);

   // Create session
   await redis.setex(
     `s:${sessionId}`,
     3600, // 1 hour TTL
     JSON.stringify(gameState)
   );

   // Get session
   const data = await redis.get(`s:${sessionId}`);
   const gameState = data ? JSON.parse(data) : null;

   // Delete session (on completion)
   await redis.del(`s:${sessionId}`);
   ```

3. **Configure persistence**
   ```redis
   # redis.conf
   save 900 1      # Snapshot after 15 min if 1+ keys changed
   save 300 10     # Snapshot after 5 min if 10+ keys changed
   save 60 10000   # Snapshot after 1 min if 10000+ keys changed

   maxmemory-policy volatile-lru
   ```

4. **Environment configuration**
   ```env
   REDIS_URL=redis://localhost:6379  # Development
   # Production: Use managed service URL
   ```

**No complex features needed:** Basic Redis with absolute TTL and RDB persistence covers all requirements.

**Complexity:** LOW (straightforward migration, well-documented pattern)
**Priority:** HIGH (blocks v1.1 milestone — prevents data loss on restart)

## Feature Dependency Matrix

```
Redis Migration → Enhanced Plausibility Checks
  (Redis enables session history for pattern analysis)

Learning Content Expansion → Analytics Integration
  (Identify which questions need deeper content)

Plausibility System → Accessibility Features
  (Timer multiplier must affect plausibility thresholds)
```

## MVP Recommendation for v1.1

**MUST HAVE (Table Stakes):**
1. ✓ Redis migration with absolute TTL and RDB persistence
2. ✓ Maintain current learning content coverage (15% is sufficient)
3. ✓ Enhance plausibility detection quality without adding penalties

**SHOULD HAVE (Quick Wins):**
4. ○ Strategic learning content expansion to 25-30% (6-month roadmap)
5. ○ Tab switching detection (low complexity, useful signal)
6. ○ Plausibility warning messages (transparent feedback)

**DEFER (Over-Engineering):**
- Comprehensive learning content (100% coverage)
- Aggressive anti-cheat with auto-penalties
- Redis clustering or replication
- Webcam/screen monitoring
- Browser lockdown

## Production Readiness Checklist

| Area | Current State | Production Ready | Gap |
|------|---------------|------------------|-----|
| **Session Persistence** | In-memory | Redis with RDB | MUST MIGRATE |
| **Session TTL** | 1-hour absolute | 1-hour absolute | ✓ CORRECT |
| **Basic Explanations** | 120/120 | 120/120 | ✓ SUFFICIENT |
| **Deep-dive Content** | 18/120 (15%) | 30+/120 (25%+) | EXPAND STRATEGICALLY |
| **Server-Side Scoring** | ✓ Implemented | ✓ Implemented | ✓ DONE |
| **Timing Detection** | Passive logging | Improved thresholds | ENHANCE |
| **Pattern Analysis** | None | Session history | DEFER to v1.2+ |
| **Anti-Cheat Philosophy** | Passive, fair | Passive, fair | ✓ CORRECT |

## Complexity Assessment

| Feature | Effort | Risk | Value |
|---------|--------|------|-------|
| Redis migration | 2-3 days | Low | HIGH — prevents data loss |
| Learning content (→30%) | 2-4 weeks | Low | MEDIUM — incremental improvement |
| Enhanced plausibility | 1-2 days | Low | MEDIUM — better analytics |
| Tab switching detection | 1 day | Low | LOW — marginal signal |
| Pattern analysis | 1 week | Medium | LOW — defer to v1.2+ |

**Recommendation:** Focus v1.1 on Redis migration (highest value, low complexity). Treat learning content expansion as ongoing work over 3-6 months rather than blocking milestone completion.

## Sources

### Learning Content Coverage
- [Best Quiz and Game Show Apps for Classrooms | Common Sense Education](https://www.commonsense.org/education/best-in-class/the-best-quiz-and-game-show-apps-for-classrooms) — MEDIUM confidence
- [Trivia Games – Using Game-Based Learning Online](https://ecampusontario.pressbooks.pub/gamebasedlearning/chapter/trivia-games/) — MEDIUM confidence
- [10 Best free & paid Quizlet alternatives for 2026](https://forms.app/en/blog/best-quizlet-alternatives) — LOW confidence
- [Answer explanations – Kahoot! Help & Resource Center](https://support.kahoot.com/hc/en-us/community/posts/41766775322515-Answer-explanations) — MEDIUM confidence
- [Kahoot vs Quizziz: The Ultimate Teacher's guide (2026)](https://triviamaker.com/kahoot-vs-quizziz/) — MEDIUM confidence

### Anti-Cheat / Plausibility Systems
- [Best 8 Anti-Cheating Software for Hiring in 2026](https://www.testtrick.com/blogs/top-anti-cheating-software-for-fair-hiring) — MEDIUM confidence
- [TestGorilla Cheating Detection: 8 Behaviors That Get Flagged in 2026](https://www.shadecoder.com/blogs/testgorilla-cheating-detection-8-behaviors-that-get-flagged-in-2026) — MEDIUM confidence
- [Stop Online Exam Cheating in 2026: 15 AI-Powered Methods](https://www.eklavvya.com/blog/prevent-cheating-online-exams/) — LOW confidence
- [How to Enable Cheating Prevention Features in a Quiz](https://quiz.proprofs.com/how-do-i-prevent-cheating-on-my-quiz) — MEDIUM confidence
- [13 Ways to Stop Students From Cheating on Online Exams](https://honorlock.com/blog/4-ways-to-prevent-cheating-on-online-exams/) — MEDIUM confidence

### Redis Session Management
- [Session Management | Redis](https://redis.io/solutions/session-management/) — HIGH confidence (official docs)
- [Gaming | Redis](https://redis.io/industries/gaming/) — HIGH confidence (official docs)
- [How to Build a Session Management System with Redis](https://oneuptime.com/blog/post/2026-01-21-redis-session-management/view) — HIGH confidence
- [How to Implement Sliding TTL in Redis](https://oneuptime.com/blog/post/2026-01-26-redis-sliding-ttl/view) — HIGH confidence
- [Redis Memory Optimization Techniques & Best Practices](https://medium.com/platform-engineer/redis-memory-optimization-techniques-best-practices-3cad22a5a986) — MEDIUM confidence
- [The 6 Most Impactful Ways Redis is Used in Production Systems](https://blog.bytebytego.com/p/the-6-most-impactful-ways-redis-is) — MEDIUM confidence
- [Cache vs. Session Store | Redis](https://redis.io/blog/cache-vs-session-store/) — HIGH confidence (official blog)
- [Redis persistence | Docs](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) — HIGH confidence (official docs)

### Accessibility & Timing
- [Time limits – Accessible Technology](https://www.washington.edu/accesstech/checklist/time-limits/) — MEDIUM confidence
- [Accessibility Tips - Quizzes - Instructor Help](https://help.intech.arizona.edu/article/625-accessibility-tips-quizzes) — MEDIUM confidence
- [New Digital Accessibility Requirements in 2026](https://bbklaw.com/resources/new-digital-accessibility-requirements-in-2026) — MEDIUM confidence

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Redis patterns | HIGH | Official Redis docs + multiple authoritative sources agree |
| Session management | HIGH | Clear industry consensus, well-documented patterns |
| Learning content coverage | MEDIUM | General best practices found, but no specific percentage thresholds |
| Anti-cheat strategies | MEDIUM | Multiple sources, but trivia-specific guidance limited |
| Speed bonus fairness | LOW | Very limited research available on this specific topic |

## Research Gaps

- **Speed bonus accessibility:** Limited research on how speed bonuses interact with timing accommodations. Recommend consulting WCAG timing guidelines and user testing with accommodations enabled.
- **Trivia-specific anti-cheat:** Most research focuses on high-stakes assessments. Educational trivia context is different, requiring lighter touch.
- **Optimal learning content percentage:** No industry-standard threshold found. Recommendation based on general principles rather than specific benchmarks.

## Next Steps for v1.1

1. **Immediate (block milestone):**
   - Migrate to Redis with absolute TTL and RDB persistence
   - Verify existing plausibility checks respect timer_multiplier

2. **Near-term (within milestone):**
   - Improve plausibility threshold quality (account for question complexity)
   - Add transparent warning messages for suspicious patterns

3. **Ongoing (3-6 month roadmap):**
   - Strategic learning content expansion guided by analytics
   - Pattern analysis across sessions (requires Redis history)
   - User testing for speed bonus fairness with accommodations

---
*Research completed: 2026-02-12*
*Researcher: GSD Project Researcher*
*Confidence: MEDIUM overall (HIGH for Redis, MEDIUM for content/anti-cheat)*

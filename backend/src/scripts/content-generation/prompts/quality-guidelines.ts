/**
 * Quality Guidelines for AI Question Generation
 *
 * Summarized quality rules for embedding in generation prompts.
 * These guidelines help the AI avoid common anti-patterns that trigger
 * blocking violations in the Phase 19 quality rules engine.
 *
 * This is NOT the full rule implementation - it's a natural-language
 * summary that tells the AI what to avoid.
 */

export const QUALITY_GUIDELINES = `
## Quality Guidelines

Your generated questions will be validated against strict quality rules. Follow these guidelines to ensure all questions pass validation:

### 1. Ambiguous Answers (BLOCKING)
**Rule:** All 4 answer options must be clearly distinct. No similar options that could both be correct.

**Avoid:**
- Overlapping number ranges (e.g., "7:00 AM - 7:00 PM" vs "6:00 AM - 7:00 PM")
- Near-synonyms (e.g., "City Council" vs "Municipal Council")
- Options that share >70% of their meaningful words

**Example of GOOD options:**
- "2 years"
- "4 years"
- "6 years"
- "No term limit"

**Example of BAD options:**
- "The mayor and city council" vs "The city council and mayor" (too similar)
- "7 members" vs "7 council members" (too similar)

### 2. Vague Qualifiers (BLOCKING)
**Rule:** No subjective language that makes multiple answers defensible.

**Forbidden words:**
- "most important"
- "best"
- "primarily"
- "generally"
- "mainly"
- "usually"
- "typically"
- "often"
- "commonly"
- "frequently"

**Use objective, verifiable facts instead.**

**Example of GOOD question:**
"How many members serve on the Indiana Senate?"

**Example of BAD question:**
"What is the MOST IMPORTANT role of the Indiana Senate?" (subjective - many roles could be "most important")

### 3. Pure Lookup Trivia (BLOCKING)
**Rule:** Focus on foundational civic knowledge, not obscure dates or facts.

**GOOD (foundational knowledge):**
- "How many senators does each state have?" (structural knowledge)
- "How long is a U.S. senator's term?" (foundational fact)
- "Who is the current governor of Indiana?" (relevant civic knowledge)
- "What does the state legislature do?" (functional understanding)

**BAD (obscure trivia):**
- "In what year was the Indiana Open Door Law passed?" (obscure date)
- "Who was the 14th Secretary of State of Indiana?" (obscure historical figure)
- "What is the phone number for the state attorney general's office?" (trivial lookup)

**Test:** Would knowing this make someone a more civically engaged citizen? If no, it's pure lookup.

### 4. Partisan Framing (ADVISORY)
**Rule:** Strictly neutral on political parties and ideology.

**Avoid:**
- Political party labels (unless the question is specifically about party structure)
- Liberal/conservative/progressive characterizations
- Loaded language: "scheme", "plot", "threat", "destroying", "radical"
- Partisan keywords: "tax and spend", "nanny state", "woke", etc.

**Focus on how government structures work, not political ideology.**

### 5. Structural Quality (ADVISORY + BLOCKING for Learn More link)
**Rule:** Questions must be well-structured with proper citations.

**Requirements:**
- Question text: 20-500 characters (not too terse, not too verbose)
- Explanation: Must begin with "According to [source]" or similar citation
- Source URL: Must be a real, reachable .gov/.edu/.us page
- Question text: Must end with "?"
- All 4 options: Must be present and non-empty

### 6. Distractor Quality (implicit in ambiguity rules)
**Rule:** All four options must be plausible. No obviously wrong throwaway answers.

**GOOD distractors:**
- Real government structures (if question is about structure)
- Numbers in the right range (if question is about quantity)
- Plausible timeframes (if question is about timing)

**BAD distractors:**
- "None of the above"
- Absurd numbers (e.g., "1,000,000 senators")
- Obviously fake entities (e.g., "The Department of Unicorns")

**All four options should make someone pause and think about the correct answer.**

### 6a. Numeric distractors — VARY WHERE THE ANSWER FALLS

**Rule:** For a question whose four options are numbers, quantities, years or
percentages, the correct value must NOT always sit in the middle of the range.

This is the single most exploitable flaw measured in the existing bank. A survey of
1,154 numeric questions found the correct value was the **third of four** 54% of the
time and at either extreme only 14% — so "sort the four numbers and pick the third"
scored 54% with no knowledge at all, and 96% in one collection. The cause is a habit:
writing the true value, then padding it with two smaller and one larger distractor.

**Vary the bracket deliberately.** Across a batch, aim for roughly equal numbers of:

- answer is the **smallest** offered — "9 members" → 9 / 11 / 13 / 15
- answer is **second** — "9 members" → 7 / 9 / 11 / 13
- answer is **third** — "9 members" → 5 / 7 / 9 / 11
- answer is the **largest** offered — "9 members" → 3 / 5 / 7 / 9

All four remain plausible; only the placement changes. Never move the correct value
itself to achieve this — change the distractors around it.

**Two further requirements for numeric options:**

- **One unit per question.** Never mix scales: "$500 million" alongside "$3 billion"
  cannot be compared at a glance and reads as a trick.
- **Order them ascending.** A sorted series is easier to scan, and it means placement
  is carried by the distractor values rather than by shuffling positions.

**Note:** rotating the answer's POSITION (A/B/C/D) does not fix this. A player who
sorts the numbers mentally is unaffected by position. Only the choice of distractors
fixes it. Both matter and they are separate concerns.

---

**Validation Process:**
After generation, each question is validated with auditQuestion(). Questions with blocking violations are rejected and regenerated with feedback. Follow these guidelines to maximize first-pass success rate.
`;

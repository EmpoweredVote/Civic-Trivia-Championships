# Phase 12: Learning Content Expansion - Research

**Researched:** 2026-02-17
**Domain:** Content generation script enhancement + civics learning content authoring
**Confidence:** HIGH

## Summary

This phase expands learning content coverage from 18 questions (15%) to 30-36 questions (25-30%) by adding 12-18 new pieces of learning content. Two work streams run in parallel: (1) updating the `generateLearningContent.ts` script to support manual question selection, batching, and cherry-pick review, and (2) actually generating and applying the content.

The existing script generates content for ALL uncovered questions in sequence with no targeting capability. It must be updated to support: `--ids q076,q078,q079` selection, `--difficulty hard` filtering, `--limit 15` batching, and `--topic judiciary` filtering. A separate `applyContent.ts` script (referenced in current script output but absent from codebase) must also be created to merge accepted content into `questions.json`. The current prompt must be updated for inline hyperlinks, expanded source allowlist, anti-partisan framing, and 8th-grade plain language.

The data analysis shows 45 hard questions with no content (all in judiciary/federalism/executive), 35 medium, and 22 easy. Priority order per CONTEXT.md: hard first, then medium, skip easy entirely. For 12-18 target, a single batch of 15 hard questions (spanning judiciary, federalism, executive categories with topic spread) achieves the goal.

**Primary recommendation:** Update the script first (adding `--ids`, `--difficulty`, `--topic`, `--limit` flags and updating the prompt), create the missing `applyContent.ts`, then generate one or two batches of hard questions and apply the accepted ones.

## Standard Stack

No new libraries needed. The existing stack handles everything.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.74.0 (installed) | Claude API calls | Already in devDependencies; SDK v0.74.0 supports claude-opus-4-6 |
| `dotenv` | ^16.3.1 (installed) | Load ANTHROPIC_API_KEY from backend/.env | Already in dependencies; existing pattern |
| `tsx` | ^4.7.0 (installed) | Run TypeScript scripts directly | Already in devDependencies; existing run pattern |
| `fs` (Node built-in) | Node 20+ | Read/write questions.json and preview files | No install needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `process.argv` (Node built-in) | Node 20+ | Parse CLI flags without extra deps | No CLI library installed; use raw argv parsing for `--ids`, `--difficulty`, `--topic`, `--limit` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `process.argv` | `commander` or `yargs` | `commander`/`yargs` add cleaner help text but require `npm install`. Project has no CLI arg library. Raw argv parsing is adequate for 4 flags. Don't add new deps. |
| `claude-3-5-sonnet-20241022` (current) | `claude-opus-4-6` or `claude-3-5-sonnet-20241022` | Civics content generation doesn't need opus-level capability; sonnet is faster and cheaper. Keep using `claude-3-5-sonnet-20241022` unless quality is insufficient. |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

No new files or folders. Changes are limited to:

```
backend/src/scripts/
├── generateLearningContent.ts   # MODIFY: add filtering flags, update prompt
└── applyContent.ts              # CREATE: merges preview JSON into questions.json
```

Preview files (generated output) land in `backend/` root (current pattern):
```
backend/
└── generated-content-2026-02-17T14-30-00.json   # temp review file
```

### Pattern 1: Manual Selection via CLI Flags

**What:** Pass `--ids q076,q078,q079` or `--difficulty hard` or `--topic judiciary` or `--limit 15` on command line to filter which questions get generated.
**When to use:** Every run — the script should never generate for all 102 uncovered questions by default.

```typescript
// Source: Node.js built-in process.argv (no library needed)
function parseArgs(): { ids?: string[]; difficulty?: string; topic?: string; limit?: number } {
  const args = process.argv.slice(2);
  const result: { ids?: string[]; difficulty?: string; topic?: string; limit?: number } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ids' && args[i + 1]) {
      result.ids = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--difficulty' && args[i + 1]) {
      result.difficulty = args[i + 1];
      i++;
    } else if (args[i] === '--topic' && args[i + 1]) {
      result.topic = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      result.limit = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return result;
}
```

**Example invocations:**
```bash
# Generate for specific IDs
npx tsx backend/src/scripts/generateLearningContent.ts --ids q076,q078,q079,q080

# Generate for all hard questions, limit 15 (one batch)
npx tsx backend/src/scripts/generateLearningContent.ts --difficulty hard --limit 15

# Generate for judiciary hard questions
npx tsx backend/src/scripts/generateLearningContent.ts --difficulty hard --topic judiciary --limit 10
```

### Pattern 2: Question Filtering Logic

**What:** Apply CLI filters to the uncovered questions list before generation.
**When to use:** In `main()` after loading `questionsNeedingContent`.

```typescript
// Source: Derived from existing script pattern
let questionsToProcess = questionsNeedingContent;

if (args.ids) {
  questionsToProcess = questionsToProcess.filter(q => args.ids!.includes(q.id));
} else {
  if (args.difficulty) {
    questionsToProcess = questionsToProcess.filter(q => q.difficulty === args.difficulty);
  }
  if (args.topic) {
    questionsToProcess = questionsToProcess.filter(q => q.topicCategory === args.topic);
  }
}

// Apply limit last
if (args.limit) {
  questionsToProcess = questionsToProcess.slice(0, args.limit);
}

// Safety guard: refuse to run without any filter
if (!args.ids && !args.difficulty && !args.topic && !args.limit) {
  console.error('Error: provide at least one filter flag (--ids, --difficulty, --topic, or --limit)');
  console.error('Example: --difficulty hard --limit 15');
  process.exit(1);
}
```

### Pattern 3: applyContent.ts — Merge Preview into questions.json

**What:** Reads the generated preview JSON, merges accepted question IDs into `questions.json`. Takes the preview file path as an argument. Optionally takes `--ids q076,q078` to cherry-pick specific IDs from the preview.
**When to use:** After reviewing the preview file and deciding which content to accept.

```typescript
// Source: Existing generateLearningContent.ts output format (generatedContent object)
// Run: npx tsx backend/src/scripts/applyContent.ts generated-content-2026-02-17T14-30-00.json
// Run: npx tsx backend/src/scripts/applyContent.ts generated-content-2026-02-17T14-30-00.json --ids q076,q078

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const [,, previewFile, ...rest] = process.argv;

// Parse optional --ids flag
const idsIdx = rest.indexOf('--ids');
const selectedIds = idsIdx !== -1 && rest[idsIdx + 1]
  ? rest[idsIdx + 1].split(',').map(s => s.trim())
  : null;

const previewPath = previewFile.startsWith('/') ? previewFile : join(process.cwd(), previewFile);
const preview: Record<string, { learningContent: any }> = JSON.parse(readFileSync(previewPath, 'utf-8'));

const questionsPath = join(process.cwd(), 'src/data/questions.json');
const questions = JSON.parse(readFileSync(questionsPath, 'utf-8'));

const toApply = selectedIds
  ? Object.entries(preview).filter(([id]) => selectedIds.includes(id))
  : Object.entries(preview);

let applied = 0;
for (const [id, content] of toApply) {
  const q = questions.find((x: any) => x.id === id);
  if (!q) { console.warn(`Question ${id} not found in questions.json`); continue; }
  if (q.learningContent) { console.warn(`Question ${id} already has content — skipping`); continue; }
  q.learningContent = content.learningContent;
  applied++;
}

writeFileSync(questionsPath, JSON.stringify(questions, null, 2), 'utf-8');
console.log(`Applied ${applied} of ${toApply.length} items to questions.json`);
```

### Pattern 4: Updated Prompt for New Content Requirements

**What:** The existing prompt must be updated to require inline hyperlinks, plain language, and anti-partisan framing. The source allowlist expands.

Key changes to `buildPrompt()`:

1. **Expanded source allowlist** (current prompt is .gov only — decision requires broader):
   - `.gov` sites (existing): archives.gov, senate.gov, house.gov, usa.gov, constitution.congress.gov, supremecourt.gov
   - Educational orgs: khanacademy.org, icivics.org
   - Wikipedia: en.wikipedia.org (for background facts)
   - News archives: specific to historically documented facts

2. **Inline hyperlinks requirement**: The generated paragraphs text must include markdown hyperlinks on key terms, not just a `source` object at the end. The JSON schema needs a new field or the paragraphs must contain `[term](url)` inline.

3. **Plain language**: 8th grade reading level, define jargon, short sentences.

4. **Anti-partisan framing**: Explicitly instruct Claude to present facts without partisan characterization.

5. **"as of [date]" caveat**: For time-sensitive facts.

Updated prompt requirements section:
```
Requirements:
1. Write 2-3 informative paragraphs (150-200 words total)
2. First sentence must restate the correct answer explicitly
3. Plain language: 8th grade reading level. Define legal jargon when first used. Short sentences.
4. Anti-partisan: describe constitutional mechanisms and facts only. Do not characterize rulings or policies as 'liberal,' 'conservative,' 'activist,' or partisan in any direction.
5. For each wrong answer option, write a 1-2 sentence correction explaining why it is incorrect
6. Include inline hyperlinks on key terms within the paragraph text using markdown: [term](url)
7. Include at least 1-2 inline links per content piece to authoritative sources
8. For time-sensitive facts (current officeholders, pending cases), add "as of [date]" caveat
9. Provide a primary source object (name + url) in addition to inline links

Acceptable link sources:
- .gov domains: constitution.congress.gov, archives.gov, supremecourt.gov, senate.gov, house.gov, usa.gov
- Educational: khanacademy.org, icivics.org
- Reference: en.wikipedia.org
- Historical news archives (for documented historical facts)
```

Updated JSON response schema (add `sources` array for inline link tracking):
```json
{
  "paragraphs": ["Text with [inline links](url) on key terms..."],
  "corrections": {
    "0": "Correction text...",
    "1": "Correction text..."
  },
  "source": {
    "name": "Primary source name",
    "url": "https://primary-source-url"
  }
}
```

Note: Inline links are embedded in the paragraph text itself (markdown format). The `source` field remains as the single primary citation.

### Anti-Patterns to Avoid

- **Running without filters**: Never generate for all 102 uncovered questions in one run. The existing script's default behavior (process all uncovered questions) must be gated behind a safety check requiring at least one filter flag.
- **Auto-applying content**: Never write directly to `questions.json` from the generator. Always write to temp file first (existing pattern — keep it).
- **Validating URLs in the script**: Do not write URL-checking code (HTTP requests to verify .gov URLs). It adds complexity and network dependencies. Human review in the preview step catches bad URLs.
- **Storing inline link metadata separately**: Don't add a `links` array to the JSON schema. Keep links embedded in paragraph text as markdown `[term](url)` — simpler, renders in the frontend's existing rendering.
- **Updating existing content**: CONTEXT.md decision is "new content only — do not review or revise existing learning content." The generator and apply scripts must skip questions that already have `learningContent`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom tokenizer | Raw `process.argv` slice | 4 flags max; no edge cases needed. `commander`/`yargs` would add deps without benefit at this scale. |
| Content merging/diffing | Custom diff logic | Simple `find + assign` pattern | Preview file maps question IDs to content objects. Direct assignment into the questions array is sufficient. |
| URL validation | HTTP requests to check links | None (rely on human review) | Human preview step is the validation layer. Automated URL checking adds flakiness and latency. |
| Content quality scoring | Automated scoring | None (human review is the gate) | Cherry-pick workflow IS the quality gate. Don't build automated scoring. |
| Batch management state | Database or state file | None | Batches are small (10-15 questions). State is implied by which questions still lack `learningContent`. Re-querying the JSON on each run is sufficient. |

**Key insight:** This is a one-time content authoring workflow, not a production pipeline. Simplicity and transparency beat automation sophistication. Human review is the quality mechanism — don't automate it away.

## Common Pitfalls

### Pitfall 1: Forgetting the applyContent Script Must Run from backend/

**What goes wrong:** The `generateLearningContent.ts` script uses `join(process.cwd(), 'src/data/questions.json')`. If run from the project root instead of `backend/`, the path resolves to `<project-root>/src/data/questions.json` which doesn't exist.
**Why it happens:** `process.cwd()` is the shell's working directory, not the script's directory.
**How to avoid:** Document in script header: "Run from backend/ directory" or add a path guard that validates the file exists before proceeding.
**Warning signs:** `ENOENT: no such file or directory, open '.../src/data/questions.json'`

### Pitfall 2: Model Name Staleness

**What goes wrong:** The script currently uses `claude-3-5-sonnet-20241022`. This is a hardcoded string that will become stale.
**Why it happens:** Model names are frozen strings; the SDK doesn't auto-update them.
**How to avoid:** The current model `claude-3-5-sonnet-20241022` is still valid in SDK 0.74.0 (confirmed via changelog — no model removals, only additions). Keep using it for this phase; it's appropriate for content generation. Do not switch to claude-opus-4-6 — no capability benefit, higher cost.
**Warning signs:** API error "model not found" (won't happen with current model, but would if switched to a nonexistent model ID).

### Pitfall 3: Inline Links in Paragraph Text Break Frontend Rendering

**What goes wrong:** If the frontend doesn't render markdown links from paragraph text, `[term](url)` appears as raw text to users.
**Why it happens:** The new content requirement adds markdown links inside paragraph strings. Existing content has no inline links — the frontend may not have handled this case before.
**How to avoid:** Verify how paragraphs are rendered in the frontend before generating and applying inline-linked content. If the frontend renders raw text (not markdown), inline link format needs to change to plain text with a source list instead.
**Warning signs:** `[U.S. Constitution](https://archives.gov/...)` appearing as literal text in the game UI.

Research note: This is the most significant risk for this phase. The existing 18 content pieces have no inline links in paragraph text — only a `source` object. A frontend rendering check should precede or accompany the prompt update.

### Pitfall 4: Cherry-Pick by Regenerating Rejected Questions

**What goes wrong:** After generating a batch preview, regenerating just the rejected questions produces a new preview file. If the apply step isn't cherry-pick-aware, it may apply previously-accepted content again or miss the regenerated content.
**Why it happens:** Preview files accumulate; it's unclear which file is authoritative for which IDs.
**How to avoid:** The `applyContent.ts` script must skip questions that already have `learningContent` (already planned). The `--ids` flag allows cherry-picking specific IDs from a preview file, so only accepted ones are applied from the first batch. Regenerated rejections go into a new preview file and get applied separately.

### Pitfall 5: Source URLs Generated by Claude May Not Exist

**What goes wrong:** Claude generates plausible-sounding .gov URLs that return 404. This happened in previous content generation phases — the prompt says "verify it exists" but Claude cannot actually fetch URLs.
**Why it happens:** Claude predicts URLs based on training data patterns, not live HTTP checks.
**How to avoid:** Human reviewer must click every link in the preview file before applying. Make this explicit in reviewer instructions / script output message. The Brennan Center URL in existing q052 (gerrymandering) is already outside the original .gov-only prompt, suggesting Claude deviated — adding educational sources explicitly to the allowlist reduces hallucination by giving Claude more valid targets.

### Pitfall 6: Question IDs q043, q044, q052, q055, q071 Already Have Content

**What goes wrong:** Medium-difficulty questions q043, q044, q052, q055, and q071 already have learning content (they're the only 5 medium questions with content). Generating for `--difficulty medium` will correctly skip them via the `questionsNeedingContent` filter, but confusion can arise when comparing lists.
**Why it happens:** The existing 18 questions with content span all difficulties (16 easy + 2 medium + 0 hard). Wait — correction: the current data shows 16 easy questions with content and 2 medium ones are `q043` (pocket veto) and `q044` (Marbury v. Madison), `q052` (gerrymandering), `q055` (checks and balances), `q071` (census). That's 5 medium with content, 13 easy with content, 0 hard with content.
**How to avoid:** The `questionsNeedingContent` filter (`!q.learningContent`) handles this automatically. No special handling needed.

## Code Examples

### Full Updated buildPrompt() Function

```typescript
// Source: Updated from existing generateLearningContent.ts
function buildPrompt(question: Question): string {
  const wrongOptions = question.options
    .map((opt, idx) => ({ opt, idx }))
    .filter(({ idx }) => idx !== question.correctAnswer);

  return `Generate educational content for this U.S. civics question.

Question: ${question.text}
Options: ${question.options.map((o, i) => `${i}. ${o}`).join(', ')}
Correct Answer: ${question.correctAnswer} (${question.options[question.correctAnswer]})
Topic Category: ${question.topicCategory}

Requirements:
1. Write 2-3 informative paragraphs (150-200 words total)
2. First sentence must explicitly restate the correct answer (e.g., "The 13th Amendment abolished slavery in 1865")
3. Plain language: 8th grade reading level. Define legal or technical terms when first used. Use short sentences.
4. Anti-partisan: describe only constitutional mechanisms, legal standards, and historical facts. Do not characterize rulings or policies as liberal, conservative, activist, or partisan in any direction.
5. For EACH wrong answer option listed below, write a specific 1-2 sentence correction explaining why it is incorrect
6. Include inline hyperlinks on key terms within the paragraph text: [key term](https://url)
7. Include at least 1-2 inline links per content piece to authoritative sources
8. For time-sensitive facts (e.g., current officeholders, pending legislation), add "as of [date]" caveat
9. Provide a primary source in the source field

Acceptable link sources:
- .gov: constitution.congress.gov, archives.gov, supremecourt.gov, senate.gov, house.gov, usa.gov
- Educational: khanacademy.org, icivics.org
- Reference: en.wikipedia.org
- Historical news archives for documented historical facts

Tone: Factual and direct. No anecdotes, no embellishments. Just the facts.

Wrong options to correct:
${wrongOptions.map(({ opt, idx }) => `  ${idx}. ${opt}`).join('\n')}

Return ONLY valid JSON matching this structure:
{
  "paragraphs": ["First paragraph with [inline link](url) on key term...", "Second paragraph..."],
  "corrections": {
${wrongOptions.map(({ idx }) => `    "${idx}": "Correction for option ${idx}..."`).join(',\n')}
  },
  "source": {
    "name": "Source Name - Organization",
    "url": "https://exact-url"
  }
}`;
}
```

### Complete applyContent.ts Script

```typescript
// Source: Derived from generateLearningContent.ts output format
// Run from backend/ directory:
//   npx tsx src/scripts/applyContent.ts generated-content-2026-02-17T14-30-00.json
//   npx tsx src/scripts/applyContent.ts generated-content-2026-02-17T14-30-00.json --ids q076,q078

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface GeneratedContent {
  learningContent: {
    topic: string;
    paragraphs: string[];
    corrections: Record<string, string>;
    source: { name: string; url: string };
  };
}

const args = process.argv.slice(2);
const previewFile = args[0];

if (!previewFile) {
  console.error('Usage: npx tsx src/scripts/applyContent.ts <preview-file.json> [--ids q076,q078]');
  process.exit(1);
}

// Parse optional --ids flag
const idsIdx = args.indexOf('--ids');
const selectedIds: string[] | null = idsIdx !== -1 && args[idsIdx + 1]
  ? args[idsIdx + 1].split(',').map(s => s.trim())
  : null;

// Resolve paths (run from backend/)
const previewPath = previewFile.startsWith('/') || previewFile.startsWith('C:')
  ? previewFile
  : join(process.cwd(), previewFile);

const questionsPath = join(process.cwd(), 'src/data/questions.json');

const preview: Record<string, GeneratedContent> = JSON.parse(readFileSync(previewPath, 'utf-8'));
const questions = JSON.parse(readFileSync(questionsPath, 'utf-8'));

const toApply = selectedIds
  ? Object.entries(preview).filter(([id]) => selectedIds.includes(id))
  : Object.entries(preview);

let applied = 0;
let skipped = 0;

for (const [id, content] of toApply) {
  const q = questions.find((x: any) => x.id === id);
  if (!q) {
    console.warn(`  WARN: Question ${id} not found in questions.json`);
    skipped++;
    continue;
  }
  if (q.learningContent) {
    console.warn(`  SKIP: Question ${id} already has learning content`);
    skipped++;
    continue;
  }
  q.learningContent = content.learningContent;
  applied++;
  console.log(`  OK: Applied content to ${id}`);
}

writeFileSync(questionsPath, JSON.stringify(questions, null, 2), 'utf-8');
console.log(`\nDone: Applied ${applied}, Skipped ${skipped}, Total reviewed ${toApply.length}`);
```

### Coverage Check Script (One-Liner for Verification)

```bash
# Run from project root — verify current coverage
node --input-type=module << 'EOF'
import { readFileSync } from 'fs';
const q = JSON.parse(readFileSync('backend/src/data/questions.json','utf8'));
const wc = q.filter(x => x.learningContent);
console.log(`Coverage: ${wc.length}/${q.length} (${(wc.length/q.length*100).toFixed(1)}%)`);
EOF
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `claude-3-5-sonnet-20241022` hardcoded | Still valid and appropriate | SDK 0.74.0 (Feb 2026) added claude-opus-4-6; sonnet still available | No change needed for this phase |
| Generate all uncovered questions | Generate targeted batches with filters | This phase | Adds `--ids`, `--difficulty`, `--topic`, `--limit` flags |
| `.gov`-only sources | Expanded to include Khan Academy, iCivics, Wikipedia, news archives | This phase | More valid link targets for Claude, fewer hallucinated .gov URLs |
| Single `source` object at bottom | Inline `[term](url)` links in paragraph text + `source` object | This phase | Richer citation experience for players |
| Generate-and-apply in one step | Preview file → human review → cherry-pick apply | Established in Phase 08-01 | Already implemented in current script |

**Deprecated/outdated:**
- The `applyContent.ts` reference in current script output was always broken (file never existed). This phase creates it.

## Data Inventory

Current state (verified from questions.json, 2026-02-17):

| Category | Count |
|----------|-------|
| Total questions | 120 |
| With learning content | 18 (15%) |
| Without learning content | 102 (85%) |
| Target after phase | 30-36 (25-30%) |
| Questions to add | 12-18 |

Questions without content, by difficulty:
- Hard: 45 (judiciary: 23, federalism: 11, executive: 5, congress: 4, civic-participation: 1, amendments: 1)
- Medium: 35
- Easy: 22

**Recommended batch for Phase 12 (15 hard questions for topic spread):**

Batch A — Hard, mixed topics (15 questions):
- Judiciary (8): q078, q079, q080, q084, q086, q087, q092, q094
- Federalism (4): q077, q082, q091, q097
- Executive (2): q083, q109
- Congress (1): q089

This batch delivers judiciary (largest gap, most questions), federalism (second largest), executive, and congress representation. Avoids civic-participation (only 1 hard question without content — q076, the Three-Fifths Compromise — include it in batch B if needed).

If fewer than 15 are accepted from Batch A, run Batch B with 5-10 more hard questions to reach the 30-36 target.

## Open Questions

1. **Does the frontend render markdown inline links in paragraph text?**
   - What we know: Existing learning content has NO inline links in paragraph strings. The `source` field (single source object) is the only citation mechanism currently in the data.
   - What's unclear: Whether `[term](url)` markdown in paragraph strings is processed by the React components or rendered as literal text.
   - Recommendation: Check the frontend learning content display component before finalizing the prompt. If frontend renders raw text, use a `sources` array field in the JSON schema instead of inline markdown, OR convert to plain text with a separate links section.

2. **Which "news archives" are acceptable sources?**
   - What we know: CONTEXT.md says "news archives" are acceptable. The existing q052 (gerrymandering) uses `brennancenter.org` which was apparently acceptable.
   - What's unclear: Specific domains — NYT archives? Washington Post? ProPublica?
   - Recommendation: Treat "news archives" as historical fact sources only (e.g., contemporaneous reporting on court decisions). Instruct Claude to use them sparingly, preferring .gov and educational sources.

3. **Does the script need a `--output` flag to specify the preview file location?**
   - What we know: Current script writes to `backend/generated-content-{timestamp}.json`. This is fine for the workflow.
   - What's unclear: Whether reviewers want to name the file or choose its location.
   - Recommendation: Keep current auto-named timestamp pattern. No `--output` flag needed.

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection: `backend/src/scripts/generateLearningContent.ts` — read in full
- Codebase direct inspection: `backend/src/data/questions.json` — 120 questions analyzed
- Codebase direct inspection: `backend/package.json` — dependency versions confirmed
- Codebase direct inspection: `backend/node_modules/@anthropic-ai/sdk/CHANGELOG.md` — SDK 0.74.0 confirmed, claude-opus-4-6 added Feb 2026
- Codebase direct inspection: `backend/tsconfig.json` — module system confirmed (NodeNext/ES2022)
- Data analysis (Node.js): Coverage statistics, difficulty breakdown, topic distribution — run directly against questions.json

### Secondary (MEDIUM confidence)
- CONTEXT.md Phase 12 decisions — locked requirements for prompt updates, source allowlist, inline links

### Tertiary (LOW confidence)
- Frontend markdown rendering assumption: No frontend component read during this research. The assumption that inline markdown links in paragraph strings need verification is based on the absence of any existing inline links in the 18 current content pieces. The frontend rendering behavior of `[term](url)` within paragraph text is an open question.

## Metadata

**Confidence breakdown:**
- Current data state (coverage, question IDs, difficulty): HIGH — read directly from questions.json
- Standard stack (no new deps needed): HIGH — verified from package.json
- Script modification patterns: HIGH — based on existing code plus Node.js built-ins
- applyContent.ts design: HIGH — derived from existing preview file format
- Prompt updates: HIGH — derived from CONTEXT.md decisions
- Frontend markdown rendering: LOW — not investigated; flagged as open question

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable — questions.json and script don't change between now and planning)

# Phase 19: Quality Rules Engine - Research

**Researched:** 2026-02-19
**Domain:** Question quality validation, rule-based scoring, and database soft-delete patterns
**Confidence:** HIGH

## Summary

This phase builds a composable, reusable quality rules engine to audit civic trivia questions against codified standards. The engine evaluates questions across multiple dimensions (ambiguity, lookup vs. foundational knowledge, structural quality, partisan framing) and produces both a numeric score (0-100) and a list of violations with severity levels (blocking vs. advisory). Questions failing blocking rules are soft-deleted via a status column, and collections dropping below 50 active questions are automatically hidden from gameplay.

The research confirms that the project's existing stack (TypeScript, Zod, Drizzle ORM, PostgreSQL) provides everything needed. Zod 4.3.6 is already installed and used for content validation. The pattern will follow the project's established service-based architecture with pure, testable validation functions. Soft delete is implemented via a status column already in the schema. The rules engine must be reusable since Phase 21 will need it for generated content gating.

**Primary recommendation:** Build the rules engine as composable, pure TypeScript functions that return structured violation objects. Use Zod for structural validation (question length, explanation presence), implement custom rule functions for semantic checks (ambiguity detection, vague qualifiers, partisan keywords), and aggregate results into a weighted 0-100 score plus severity-flagged violations.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.3.6 | Structural validation and schema-based checks | Already in project, TypeScript-first with static inference, battle-tested for content validation in question-schema.ts |
| Drizzle ORM | 0.45.1 | Database queries and schema migrations | Current ORM, supports raw SQL for migrations and complex queries |
| Node.js fs | Built-in | Markdown report file writing | No dependencies needed for simple file I/O |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| link-check | Latest | HTTP HEAD/GET validation for Learn More URLs | For blocking rule that checks if source.url is reachable |
| express-validator | 7.3.1 | Already in project for request validation | Not needed here (Zod handles validation), but shows existing pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | Yup or Joi | Zod has better TypeScript inference and is already installed |
| Custom rules | Effect-TS functional effects | Effect-TS is powerful but adds complexity; pure functions suffice for this domain |
| link-check | @the-node-forge/url-validator | link-check does both syntax + reachability; url-validator only checks syntax |

**Installation:**
```bash
# Only new dependency needed
npm install link-check
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── services/
│   └── qualityRules/              # New rules engine service
│       ├── index.ts               # Main audit runner + score aggregation
│       ├── types.ts               # Violation, RuleResult, QualityReport types
│       ├── rules/                 # Individual rule functions
│       │   ├── ambiguity.ts       # Answer overlap + vague qualifiers
│       │   ├── lookup.ts          # Pure lookup vs. foundational test
│       │   ├── structural.ts      # Question/explanation length, Learn More validation
│       │   └── partisan.ts        # Partisan framing keyword detection
│       └── scoring.ts             # Score calculation (weighted aggregation)
├── scripts/
│   ├── audit-questions.ts         # Dry-run audit script (console + markdown)
│   └── archive-violations.ts      # Apply archival to blocking failures
└── db/
    └── migrations/                # Schema updates for status + quality_score columns
        └── add-quality-columns.ts
```

### Pattern 1: Composable Rule Functions
**What:** Each quality rule is a pure function that takes a question and returns a RuleResult with violations.
**When to use:** For all quality checks. Enables independent testing, parallel execution, and reusability in Phase 21.

**Example:**
```typescript
// Source: Composable validation pattern from https://bespoyasov.me/blog/declarative-rule-based-validation/

// types.ts
export type Severity = 'blocking' | 'advisory';

export interface Violation {
  rule: string;           // e.g., "ambiguous-answers"
  severity: Severity;
  message: string;        // Human-readable description
  evidence?: string;      // Optional: specific text that triggered the rule
}

export interface RuleResult {
  passed: boolean;
  violations: Violation[];
}

export type QualityRule = (question: Question) => RuleResult;

// rules/ambiguity.ts
export const checkAmbiguousAnswers: QualityRule = (question) => {
  const violations: Violation[] = [];

  // Check for answer overlap (multiple plausible answers)
  const similarOptions = findSimilarOptions(question.options);
  if (similarOptions.length > 1) {
    violations.push({
      rule: 'ambiguous-answers',
      severity: 'blocking',
      message: 'Multiple answer options are too similar or both plausibly correct',
      evidence: similarOptions.join(', ')
    });
  }

  // Check for vague qualifiers in question text
  const vaguePhrases = ['best', 'most important', 'primarily', 'generally', 'typically'];
  const foundVague = vaguePhrases.filter(phrase =>
    question.text.toLowerCase().includes(phrase)
  );

  if (foundVague.length > 0) {
    violations.push({
      rule: 'vague-qualifiers',
      severity: 'blocking',
      message: 'Question contains vague qualifiers that create ambiguity',
      evidence: foundVague.join(', ')
    });
  }

  return {
    passed: violations.length === 0,
    violations
  };
};

// Helper: Detect similar options (simple heuristic - can be refined)
function findSimilarOptions(options: string[]): string[] {
  const similar: string[] = [];

  // Check if any two options share >70% word overlap
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const overlap = calculateWordOverlap(options[i], options[j]);
      if (overlap > 0.7) {
        similar.push(options[i], options[j]);
      }
    }
  }

  return [...new Set(similar)]; // Deduplicate
}

function calculateWordOverlap(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}
```

### Pattern 2: Weighted Score Aggregation
**What:** Convert rule violations into a 0-100 numeric score for sorting/filtering in admin UI.
**When to use:** After running all rules, aggregate violations with weights to produce final score.

**Example:**
```typescript
// scoring.ts
interface ScoreWeights {
  [ruleId: string]: number; // Points deducted per violation
}

// Higher penalties for blocking violations
const WEIGHTS: ScoreWeights = {
  'ambiguous-answers': 40,        // Worst offense
  'vague-qualifiers': 30,
  'pure-lookup': 25,
  'partisan-framing': 20,
  'broken-learn-more': 40,        // Blocking
  'weak-explanation': 10,         // Advisory
  'short-question': 5,            // Advisory
};

export function calculateQualityScore(violations: Violation[]): number {
  let score = 100;

  for (const violation of violations) {
    const penalty = WEIGHTS[violation.rule] || 10; // Default penalty
    score -= penalty;
  }

  return Math.max(0, score); // Floor at 0
}
```

### Pattern 3: Dry-Run Audit Report
**What:** Run all rules against all questions, report what would be archived, but don't modify database.
**When to use:** Before applying archival to preview impact and generate audit trail.

**Example:**
```typescript
// scripts/audit-questions.ts
import { db } from '../db/index.js';
import { questions, collections, collectionQuestions } from '../db/schema.js';
import { auditQuestion } from '../services/qualityRules/index.js';
import { writeFileSync } from 'fs';

async function runAudit() {
  console.log('=== DRY-RUN QUALITY AUDIT ===\n');

  // Fetch all active questions
  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.status, 'active'));

  const results = allQuestions.map(q => auditQuestion(q));

  // Aggregate results
  const toArchive = results.filter(r => r.hasBlockingViolations);
  const toFlag = results.filter(r => r.hasAdvisoryOnly);

  // Console summary
  console.log(`Total questions audited: ${allQuestions.length}`);
  console.log(`Questions passing all rules: ${results.length - toArchive.length - toFlag.length}`);
  console.log(`Questions to archive (blocking): ${toArchive.length}`);
  console.log(`Questions flagged (advisory only): ${toFlag.length}\n`);

  // Per-collection breakdown
  const collectionBreakdown = await getCollectionBreakdown(toArchive);
  console.log('Impact per collection:');
  console.table(collectionBreakdown);

  // Generate markdown report
  const markdown = generateMarkdownReport(results, collectionBreakdown);
  const reportPath = './audit-report.md';
  writeFileSync(reportPath, markdown, 'utf-8');
  console.log(`\n✓ Detailed report written to ${reportPath}`);
}

function generateMarkdownReport(results: AuditResult[], breakdown: any): string {
  return `
# Question Quality Audit Report

**Generated:** ${new Date().toISOString()}
**Total Questions:** ${results.length}

## Summary

- Passing all rules: ${results.filter(r => r.violations.length === 0).length}
- Blocking violations (to archive): ${results.filter(r => r.hasBlockingViolations).length}
- Advisory only (flagged): ${results.filter(r => r.hasAdvisoryOnly).length}

## Collection Impact

${breakdown.map(c => `- **${c.name}**: ${c.currentCount} active → ${c.afterArchival} after archival (${c.status})`).join('\n')}

## Questions to Archive

${results.filter(r => r.hasBlockingViolations).map(r => `
### ${r.question.externalId}: ${r.question.text.substring(0, 80)}...

**Score:** ${r.score}/100
**Violations:**
${r.violations.filter(v => v.severity === 'blocking').map(v => `- **${v.rule}** (${v.severity}): ${v.message}`).join('\n')}
`).join('\n---\n')}
`;
}
```

### Pattern 4: Soft Delete via Status Column
**What:** Mark questions as archived by updating status field, never hard delete from database.
**When to use:** After audit, to remove low-quality questions from gameplay while preserving data.

**Example:**
```typescript
// scripts/archive-violations.ts
import { db } from '../db/index.js';
import { questions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

async function archiveBlockingViolations(questionIds: string[]) {
  console.log(`Archiving ${questionIds.length} questions with blocking violations...`);

  await db
    .update(questions)
    .set({ status: 'archived' })
    .where(inArray(questions.externalId, questionIds));

  console.log('✓ Archival complete');
}
```

### Anti-Patterns to Avoid
- **Hard-coding weights in rule functions:** Keep scoring weights separate from rule logic for easy tuning.
- **Mutating question objects in rules:** Rules must be pure functions with no side effects.
- **Blocking on async URL validation:** Use Promise.all to validate all URLs in parallel, not sequentially.
- **Generic error messages:** Include evidence (specific text that violated rule) in Violation objects.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL syntax + reachability validation | Custom regex + fetch wrapper | `link-check` npm package | Handles edge cases (redirects, timeouts, protocols), battle-tested |
| Schema validation for structural checks | Custom validators for length/presence | Zod with `.refine()` and `.min()/.max()` | Already in project, type-safe, composable |
| Similarity detection for answer overlap | Custom string distance algorithms | Word overlap heuristic (Jaccard similarity) or Levenshtein if needed | Simple word-set comparison covers most cases; libraries like `string-similarity` add overhead |
| JSON-to-markdown formatting | Template string concatenation | Native template literals + fs.writeFileSync | No library needed for simple markdown; avoid deps like `markdown-it` for generation |

**Key insight:** This domain is about business logic (what makes a good civic question), not algorithmic complexity. Most checks are keyword-based, pattern-matching, or simple heuristics. Keep rules simple, pure, and testable. Only use libraries for truly complex tasks (URL reachability, structural validation).

## Common Pitfalls

### Pitfall 1: Score-Based Blocking Assumptions
**What goes wrong:** Treating quality score as the archival trigger (e.g., "archive anything below 60").
**Why it happens:** Score is numeric and easy to threshold, but the requirement explicitly states "only specific blocking violations trigger archival."
**How to avoid:** Ignore score in archival logic. Only check `hasBlockingViolations` flag. Score is for display/sorting in admin UI (Phase 20), not enforcement.
**Warning signs:** Code like `if (score < 60) archive(question)` anywhere in archival logic.

### Pitfall 2: False Positives on "Pure Lookup"
**What goes wrong:** Flagging foundational civic knowledge (city council size, number of senators) as "pure lookup" because it involves numbers/dates.
**Why it happens:** User context from CONTEXT.md: "Pure lookup isn't about format. 'How many people sit on your city council?' is great (foundational, useful). 'What year was the Comstock Act?' is not (obscure, no practical value)."
**How to avoid:** The rule is civic utility, not format. Check if the answer makes someone "more interesting and civically engaged," not whether it contains a date/number. Build a keyword allowlist for foundational patterns ("How many", "Who is", "What does") or manually review edge cases.
**Warning signs:** Questions about basic structure (senators per state, council size) flagged as pure lookup.

### Pitfall 3: Synchronous URL Validation in Loop
**What goes wrong:** Validating 320 Learn More URLs sequentially takes minutes and blocks script execution.
**Why it happens:** Forgetting to parallelize async operations.
**How to avoid:** Use `Promise.all()` to validate all URLs concurrently. Set reasonable timeout (5s per URL) and treat timeouts as failures.
```typescript
// BAD: Sequential
for (const q of questions) {
  const valid = await checkURL(q.source.url); // Blocks!
}

// GOOD: Parallel
const validationPromises = questions.map(q => checkURL(q.source.url));
const results = await Promise.all(validationPromises);
```
**Warning signs:** Audit script takes >30 seconds to validate 320 questions.

### Pitfall 4: Ambiguity Detection Over-Triggering
**What goes wrong:** Flagging legitimate questions where options share common civic terms ("federal", "state", "local").
**Why it happens:** Word overlap heuristic is too strict (e.g., 70% threshold too low for civic vocabulary).
**How to avoid:** Tune threshold after seeing real data. Consider excluding stop words and common civic terms from similarity calculation. Or require both high overlap AND expert judgment (manual review in Phase 20).
**Warning signs:** >50% of questions flagged for ambiguous answers.

### Pitfall 5: Partisan Detection Keyword List Brittleness
**What goes wrong:** Hardcoded keyword list misses new framing patterns or flags neutral questions.
**Why it happens:** Political language evolves; static lists decay quickly.
**How to avoid:** Start with HIGH confidence keywords (overtly partisan terms), mark findings as advisory not blocking, and plan to refine based on Phase 20 admin review. Document that this rule may need LLM assistance in future (Phase 21).
**Warning signs:** Zero detections (keywords too strict) or false positives (neutral questions flagged).

### Pitfall 6: Collection Hiding Without Auto-Re-Enable
**What goes wrong:** Collections drop below 50, get hidden, stay hidden even after Phase 21 adds new questions.
**Why it happens:** Forgetting to implement re-enable logic when count crosses back above threshold.
**How to avoid:** Build collection visibility as a computed query, not a static flag. When querying for picker, use `WHERE is_active = true AND (SELECT COUNT(*) FROM collection_questions WHERE status = 'active') >= 50`. Alternatively, add a cron job or trigger to update `is_active` when counts change.
**Warning signs:** Collections stay hidden after new questions added in Phase 21.

## Code Examples

Verified patterns from official sources:

### Zod Structural Validation with Custom Refinement
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view (Zod .refine() pattern)

import { z } from 'zod';

const QuestionStructureSchema = z.object({
  text: z.string()
    .min(20, 'Question must be at least 20 characters')
    .max(300, 'Question must be at most 300 characters'),

  explanation: z.string()
    .min(30, 'Explanation must be at least 30 characters')
    .max(500, 'Explanation must be at most 500 characters')
    .refine(
      (val) => val.includes('According to'),
      'Explanation must cite source with "According to"'
    ),

  source: z.object({
    name: z.string().min(1),
    url: z.string().url('Source URL must be valid')
  }),
}).strict();

// Use in rule
export const checkStructuralQuality: QualityRule = (question) => {
  const result = QuestionStructureSchema.safeParse(question);

  if (!result.success) {
    return {
      passed: false,
      violations: result.error.errors.map(err => ({
        rule: 'structural-quality',
        severity: 'advisory', // Length/explanation quality is advisory
        message: err.message,
        evidence: err.path.join('.')
      }))
    };
  }

  return { passed: true, violations: [] };
};
```

### URL Reachability Check with link-check
```typescript
// Source: https://www.npmjs.com/package/link-check (link-check usage pattern)

import linkCheck from 'link-check';

async function checkURL(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    linkCheck(url, { timeout: 5000 }, (err, result) => {
      if (err || result.status === 'dead') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export const checkLearnMoreLink: QualityRule = async (question) => {
  const isValid = await checkURL(question.source.url);

  if (!isValid) {
    return {
      passed: false,
      violations: [{
        rule: 'broken-learn-more',
        severity: 'blocking', // Broken links are blocking
        message: 'Learn More link is unreachable or invalid',
        evidence: question.source.url
      }]
    };
  }

  return { passed: true, violations: [] };
};
```

### Drizzle Soft Delete Migration
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-21-postgresql-soft-deletes/view (soft delete pattern)
// Pattern: Add status column, update queries to filter by status

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

async function addQualityColumns() {
  console.log('Adding quality_score and updating status column...');

  // Add quality_score column
  await db.execute(sql`
    ALTER TABLE civic_trivia.questions
    ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 100
  `);

  // Status column already exists in schema, no migration needed
  // Just ensure index exists for filtering
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_questions_quality_score
    ON civic_trivia.questions(quality_score DESC)
  `);

  console.log('✓ Quality columns added');
}
```

### Parallel Rule Execution
```typescript
// Source: https://bespoyasov.me/blog/declarative-rule-based-validation/ (composable rules pattern)

import { checkAmbiguousAnswers } from './rules/ambiguity.js';
import { checkPureLookup } from './rules/lookup.js';
import { checkStructuralQuality } from './rules/structural.js';
import { checkPartisanFraming } from './rules/partisan.js';
import { checkLearnMoreLink } from './rules/structural.js';

const ALL_RULES: QualityRule[] = [
  checkAmbiguousAnswers,
  checkPureLookup,
  checkStructuralQuality,
  checkPartisanFraming,
  checkLearnMoreLink
];

export async function auditQuestion(question: Question): Promise<AuditResult> {
  // Run all rules in parallel (some may be async like URL check)
  const ruleResults = await Promise.all(
    ALL_RULES.map(rule => Promise.resolve(rule(question)))
  );

  // Flatten violations
  const allViolations = ruleResults.flatMap(r => r.violations);

  // Check for blocking violations
  const hasBlockingViolations = allViolations.some(v => v.severity === 'blocking');

  // Calculate score
  const score = calculateQualityScore(allViolations);

  return {
    question,
    violations: allViolations,
    score,
    hasBlockingViolations,
    hasAdvisoryOnly: allViolations.length > 0 && !hasBlockingViolations
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual question review | Automated rule-based validation | 2024-2025 (LLM era) | Quality checks codified, reproducible, and applicable at generation time (Phase 21) |
| Hard delete from database | Soft delete with status column | ~2020+ | Data preserved for audits, easy to restore mistakes |
| Yup for TypeScript validation | Zod as TypeScript-first validator | ~2021-2022 | Better type inference, safer parsing, static types match runtime |
| Sequential async operations | Promise.all() parallelism | Always best practice | Massive speedup for batch operations like URL validation |

**Deprecated/outdated:**
- **Joi for TypeScript projects:** Joi is JavaScript-first, requires manual type casting. Zod has native TypeScript inference.
- **Manual string template markdown generation:** Still valid, but tools like `tsdoc-markdown` exist. For this use case (audit reports), template literals are simpler.
- **Hard-coded validation in route handlers:** Modern pattern separates validation schema (Zod) from business logic (services).

## Open Questions

Things that couldn't be fully resolved:

1. **Ambiguity detection accuracy threshold**
   - What we know: Word overlap (Jaccard similarity) is a simple heuristic; 70% threshold is common for fuzzy matching
   - What's unclear: Whether this will produce acceptable false positive/negative rates on real civic trivia questions
   - Recommendation: Start with 70%, run dry-run audit, tune based on results. Consider allowlist for common civic terms that shouldn't count as overlap.

2. **Partisan framing keyword list contents**
   - What we know: Research shows LLMs are better at detecting partisan framing than keyword lists; keyword lists decay quickly as language evolves
   - What's unclear: What specific keywords/phrases to include for initial implementation
   - Recommendation: Start with HIGH confidence keywords (overtly partisan terms like "radical left", "far right", "freedom-hating", "gun-grabbing"), mark as advisory not blocking, plan to upgrade to LLM-based detection in Phase 21. Document this as a known limitation.

3. **Collection auto-re-enable mechanism**
   - What we know: User wants collections to auto-reappear when count crosses 50+ after Phase 21 replacements
   - What's unclear: Best implementation pattern (computed query vs. trigger vs. cron job)
   - Recommendation: Use computed query in picker endpoint initially (simple, no state to manage). If performance becomes issue, add cron job to update `is_active` flag based on question count.

4. **Link validation timeout strategy**
   - What we know: Some government sites are slow; 5s timeout is standard for link-check
   - What's unclear: Should timeouts be treated as blocking failures or advisory warnings?
   - Recommendation: Treat timeouts as advisory on first pass (log for manual review), only hard failures (404, 500) as blocking. Avoids false positives from temporarily slow sites.

## Sources

### Primary (HIGH confidence)
- Zod validation and TypeScript inference: [How to Validate Data with Zod in TypeScript](https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view) - Official usage patterns for schema validation and `.refine()` custom logic
- Soft delete pattern in PostgreSQL: [How to Implement Soft Deletes in PostgreSQL](https://oneuptime.com/blog/post/2026-01-21-postgresql-soft-deletes/view) - Status column approach and query filtering
- PostgreSQL migrations: [How to Handle Database Migrations in PostgreSQL](https://oneuptime.com/blog/post/2026-02-02-postgresql-database-migrations/view) - Column addition and index creation patterns
- Composable validation rules: [Declarative Data Validation with Rule-Based Approach](https://bespoyasov.me/blog/declarative-rule-based-validation/) - Pure function rule pattern, compose function examples
- TypeScript best practices 2026: [TypeScript Best Practices for Large-Scale Web Applications in 2026](https://johal.in/typescript-best-practices-for-large-scale-web-applications-in-2026/) - Type safety, strict mode, architectural boundaries

### Secondary (MEDIUM confidence)
- URL validation libraries: [@the-node-forge/url-validator](https://www.npmjs.com/package/@the-node-forge/url-validator) and [link-check](https://www.npmjs.com/package/link-check) - Compared syntax-only vs. reachability checking
- Markdown generation tools: [tsdoc-markdown](https://www.npmjs.com/package/tsdoc-markdown) and [ts-markdown](https://kgar.github.io/ts-markdown/) - Evaluated but template literals simpler for this use case
- Validation library landscape: [3 runtime validation libraries for Typescript](https://www.jacobparis.com/content/typescript-runtime-validation) - Comparison of Zod, Yup, and alternatives
- Function composition patterns: [Typesafe Function Composition - Codeless Code](https://code.lol/post/programming/typesafe-function-composition/) - Type-safe composition techniques
- Drizzle soft deletes guide: [Implementing Soft Deletions with Drizzle ORM and PostgreSQL](https://subtopik.com/@if-loop/guides/implementing-soft-deletions-with-drizzle-orm-and-postgresql-s2qauA) - Drizzle-specific patterns

### Tertiary (LOW confidence - marked for validation)
- Partisan bias detection research: [BiasLab: Toward Explainable Political Bias Detection](https://arxiv.org/html/2505.16081) - Academic research showing LLMs outperform keyword lists for partisan framing detection. Informs recommendation to start simple (keywords) and plan LLM upgrade in Phase 21.
- NLP ambiguity detection: [A comprehensive review on resolving ambiguities in natural language processing](https://www.sciencedirect.com/science/article/pii/S2666651021000127) - Shows ambiguity detection is complex; validates starting with simple heuristics (word overlap) rather than attempting sophisticated NLP.
- Content quality scoring algorithms: [FTA: Fast TypeScript Analyzer](https://ftaproject.dev/docs/scoring) - Code quality scoring patterns (complexity metrics, weighted aggregation). Similar pattern applicable to content quality.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zod 4.3.6 already installed, Drizzle patterns established, project uses TypeScript throughout
- Architecture: HIGH - Service pattern matches existing questionService.ts, script pattern matches existing migration scripts, Zod usage matches question-schema.ts
- Pitfalls: MEDIUM - Score-based blocking trap and pure lookup false positives are informed by user context; other pitfalls (async loops, keyword brittleness) are general best practices

**Research date:** 2026-02-19
**Valid until:** 2026-04-19 (60 days - stable domain, TypeScript ecosystem moves slowly)

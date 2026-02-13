# Phase 8: Dev Tooling & Documentation - Research

**Researched:** 2026-02-13
**Domain:** TypeScript build tooling, AI SDK integration, software documentation
**Confidence:** HIGH

## Summary

This phase fixes the generateLearningContent.ts script and completes missing v1.0 documentation. The research focused on three areas: (1) Anthropic SDK installation and API key configuration, (2) TypeScript build script environment variable management with tsx and dotenv, and (3) documentation standards for VERIFICATION.md reconstruction from code analysis.

The standard approach for TypeScript build scripts in 2026 uses native Node.js --env-file flag (v20.6+) or dotenv for environment variable management. The Anthropic SDK (@anthropic-ai/sdk) expects ANTHROPIC_API_KEY as the default environment variable name. For documentation reconstruction without live testing, static code analysis combined with the existing codebase structure provides sufficient evidence for verification.

User decisions constrain this phase: (1) script outputs to console/temp for review before committing to data files (preview-before-commit workflow), (2) generated content must include source citations for fact-checking, (3) Phase 3 VERIFICATION.md reconstructed from code analysis not live testing, and (4) light audit of existing docs to flag obvious inaccuracies.

**Primary recommendation:** Install @anthropic-ai/sdk as devDependency, support both ANTHROPIC_API_KEY and .env file, modify script to output to console instead of auto-writing files, and reconstruct Phase 3 VERIFICATION.md using the same format as Phase 1/2 based on code analysis of the scoring system implementation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | Latest (check npm) | Anthropic Claude API client | Official TypeScript SDK, full type safety, streaming support |
| tsx | 4.7.0+ | TypeScript execution for build scripts | Already in backend devDependencies, no additional transpilation needed |
| dotenv | 16.3.1+ | Environment variable loading | Already in backend dependencies, industry standard for .env management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js native --env-file | 20.6.0+ | Built-in .env loading | Alternative to dotenv for modern Node versions, simpler for scripts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dotenv | Node.js --env-file flag | Native flag simpler but dotenv already installed, better validation, ecosystem maturity |
| @anthropic-ai/sdk | Direct HTTP calls | SDK provides type safety, retry logic, error handling, streaming - no reason to hand-roll |

**Installation:**
```bash
cd backend && npm install --save-dev @anthropic-ai/sdk
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── src/
│   └── scripts/              # Build-time scripts
│       └── generateLearningContent.ts
├── .env                      # Local environment variables (gitignored)
├── .env.example              # Template for required env vars
└── package.json              # Script commands
```

### Pattern 1: Preview-Before-Commit Content Generation
**What:** Script generates content to stdout/temp file, developer reviews, then manually commits to data files
**When to use:** AI-generated content that needs human verification before persistence
**Example:**
```typescript
// Source: User decision from CONTEXT.md + WebSearch AI content workflow 2026
// https://medium.com/@addyosmani/my-llm-coding-workflow-going-into-2026-52fe1681325e

async function main() {
  console.log('Starting learning content generation...\n');

  const generatedContent = [];

  for (const question of questionsNeedingContent) {
    try {
      const learningContent = await generateWithRetry(question);
      generatedContent.push({ questionId: question.id, learningContent });
      console.log(`✓ Generated content for ${question.id}`);
    } catch (error) {
      console.error(`✗ Failed for ${question.id}:`, error.message);
    }
  }

  // Output to console for review (NOT auto-writing to questions.json)
  console.log('\n' + '='.repeat(60));
  console.log('GENERATED CONTENT (Review before committing):');
  console.log('='.repeat(60));
  console.log(JSON.stringify(generatedContent, null, 2));

  // Optional: Write to temp file
  const tempPath = join(process.cwd(), 'temp-learning-content.json');
  writeFileSync(tempPath, JSON.stringify(generatedContent, null, 2));
  console.log(`\nContent written to: ${tempPath}`);
  console.log('Review and manually merge into src/data/questions.json');
}
```

### Pattern 2: Environment Variable Configuration Flexibility
**What:** Support both ANTHROPIC_API_KEY env var and .env file loading
**When to use:** Developer scripts that need API keys but should work in multiple environments (local dev, CI, manual invocation)
**Example:**
```typescript
// Source: Anthropic SDK official docs + Node.js --env-file pattern
// https://github.com/anthropics/anthropic-sdk-typescript

// Option 1: Use dotenv (already installed)
import 'dotenv/config'; // Auto-loads .env at top of file

import Anthropic from '@anthropic-ai/sdk';

// SDK automatically reads process.env.ANTHROPIC_API_KEY
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});

// Validate API key is present
if (!client.apiKey) {
  console.error('Error: ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable not set');
  console.error('Usage: ANTHROPIC_API_KEY=sk-xxx npx tsx backend/src/scripts/generateLearningContent.ts');
  console.error('Or add to .env file: ANTHROPIC_API_KEY=sk-xxx');
  process.exit(1);
}
```

**Alternative with Node.js native flag:**
```bash
# In package.json scripts
"generate:learning": "node --env-file=.env --loader tsx src/scripts/generateLearningContent.ts"
```

### Pattern 3: Documentation Reconstruction from Code Analysis
**What:** Create VERIFICATION.md by analyzing code structure, imports, exports, and logic without running the application
**When to use:** Feature already shipped to production, retroactive documentation needed
**Example:**
```markdown
# Source: Static code analysis approach (2026 best practices)
# https://www.codeant.ai/blogs/static-code-analysis-tools

## Verification Approach for Phase 3

1. **Identify Required Artifacts**: Read all 3 PLAN.md files to extract must_haves.artifacts
2. **Verify File Existence**: Use glob/ls to confirm each artifact file exists
3. **Verify Exports**: Grep for exported functions/classes (e.g., `export.*calculateScore`)
4. **Verify Key Links**: Grep for import statements and function calls matching key_links patterns
5. **Verify Requirements**: Map Phase 3 to SCORE-01 through SCORE-05 in REQUIREMENTS.md
6. **Check for Anti-Patterns**: Grep for TODO, FIXME, stub implementations
7. **Document Observable Truths**: Rephrase must_haves.truths as verification statements

Format matches Phase 1 and Phase 2 VERIFICATION.md structure:
- Goal achievement section with observable truths table
- Required artifacts verification
- Key links verification
- Requirements coverage
- Anti-patterns check
- Summary with PASSED/FAILED status
```

### Pattern 4: Source Citation for AI-Generated Content
**What:** Generated content must include verifiable source citations from authoritative domains
**When to use:** AI content generation where factual accuracy is critical
**Example:**
```typescript
// Source: User decision from CONTEXT.md + AI citation best practices
// https://koanthic.com/en/citation-worthy-content-ai-systems-guide-2026/

function buildPrompt(question: Question): string {
  return `Generate educational content for this U.S. civics question.

Requirements:
1. Write 2-3 informative paragraphs (150-200 words total)
2. Explain WHY this answer is important and provide historical context
3. For EACH wrong answer option, write a specific correction
4. Provide a credible .gov source with real URL (verify it exists)

CRITICAL: Use only these authoritative sources:
- constitution.congress.gov
- archives.gov
- supremecourt.gov
- senate.gov
- house.gov
- usa.gov

Return JSON with "source" field containing both name and url.

IMPORTANT: AI can hallucinate citations. The .gov URL must:
- Be a real, existing page (not fabricated)
- Actually contain information about this topic
- Be verifiable by a human reviewer

{
  "paragraphs": [...],
  "corrections": {...},
  "source": {
    "name": "U.S. Constitution - Congress.gov",
    "url": "https://constitution.congress.gov/browse/amendment-13/"
  }
}`;
}
```

### Anti-Patterns to Avoid
- **Auto-writing to production data files:** AI-generated content needs human review before committing to questions.json. Write to console or temp file first. (User decision: preview-before-commit workflow)
- **Hardcoding API keys:** Never commit API keys to source code. Use environment variables or .env files (gitignored).
- **Trusting AI citations blindly:** AI can fabricate sources. Generated content with .gov URLs must be manually verified before using. (Known issue: AI citation hallucination with 94% accuracy at best)
- **Using CLAUDE_API_KEY exclusively:** The official Anthropic SDK expects ANTHROPIC_API_KEY. Support both for backward compatibility but prefer standard naming.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for Anthropic API | Custom fetch/axios wrapper | @anthropic-ai/sdk | SDK handles retry logic, streaming, error codes, type safety, rate limiting |
| Environment variable validation | Custom process.env checks | dotenv with existing validation | Already installed, handles .env parsing, type coercion, defaults |
| JSON schema validation for AI responses | Custom object structure checks | TypeScript interfaces + runtime validation | Type safety at compile time, existing validation in script |
| Markdown/code extraction from AI output | Custom regex for code blocks | Existing jsonMatch pattern | Script already handles JSON extraction from markdown blocks |

**Key insight:** Build scripts are production code too. Use production-quality libraries, not quick hacks. The generateLearningContent.ts script is well-structured with retry logic, exponential backoff, and JSON validation - maintain this quality standard.

## Common Pitfalls

### Pitfall 1: Environment Variable Name Mismatch
**What goes wrong:** Script expects CLAUDE_API_KEY but official SDK docs use ANTHROPIC_API_KEY, causing confusion
**Why it happens:** Script was written before standardization, or copying examples from different sources
**How to avoid:** Support both variable names with fallback: `process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY`
**Warning signs:** Error message says "CLAUDE_API_KEY not set" but documentation examples show ANTHROPIC_API_KEY

### Pitfall 2: .env File Not Loaded Before Import
**What goes wrong:** Script imports modules that depend on environment variables before dotenv is loaded
**Why it happens:** Environment variables need to be loaded at the very top of the file, before any other imports
**How to avoid:** Use `import 'dotenv/config'` as the first import, or use Node.js --env-file flag
**Warning signs:** Environment variables are undefined even though .env file exists

### Pitfall 3: TypeScript Module Resolution for ESM
**What goes wrong:** `import Anthropic from '@anthropic-ai/sdk'` fails with module not found error even after npm install
**Why it happens:** Backend package.json has `"type": "module"` which requires ESM-compatible imports
**How to avoid:** Verify @anthropic-ai/sdk supports ESM (it does). Use tsx which handles both CJS and ESM.
**Warning signs:** Error mentions "Cannot find module" or "require is not defined"

### Pitfall 4: AI Citation Fabrication
**What goes wrong:** Generated content includes fake .gov URLs that look real but return 404
**Why it happens:** LLMs can hallucinate plausible-looking URLs. Even best models have ~6% fabrication rate.
**How to avoid:** Manual verification step for all generated sources. Prompt clearly states "verify it exists" but human must check.
**Warning signs:** Source URL pattern looks correct (constitution.congress.gov/browse/...) but page doesn't exist

### Pitfall 5: Documentation Reconstruction Without Evidence
**What goes wrong:** VERIFICATION.md makes claims about features without code evidence to support them
**Why it happens:** Assuming implementation details without actually reading the code
**How to avoid:** For each verification claim, cite specific file and line number as evidence. Use grep/read to verify.
**Warning signs:** Vague statements like "scoring works correctly" instead of "scoreService.ts line 23 calculates base + speed bonus"

### Pitfall 6: Missing devDependency vs Dependency Classification
**What goes wrong:** Installing @anthropic-ai/sdk as production dependency when it's only used in build scripts
**Why it happens:** Not distinguishing between runtime code (backend server) and build-time code (content generation)
**How to avoid:** Content generation script is dev tooling, not production runtime. Use --save-dev.
**Warning signs:** SDK appears in dependencies instead of devDependencies in package.json

## Code Examples

Verified patterns from official sources:

### Fix TypeScript Error (LCONT-01)
```typescript
// Source: Requirements LCONT-01 + Anthropic SDK official installation
// Install SDK as devDependency
// Terminal command:
// cd backend && npm install --save-dev @anthropic-ai/sdk

// At top of generateLearningContent.ts - verify import exists and works
import Anthropic from '@anthropic-ai/sdk';

// Verify client initialization works (already exists, just needs SDK installed)
const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});
```

### Support Both Environment Variable Names
```typescript
// Source: Anthropic SDK docs + backward compatibility pattern
// https://github.com/anthropics/anthropic-sdk-typescript

import 'dotenv/config'; // Load .env file first
import Anthropic from '@anthropic-ai/sdk';

// Support both naming conventions
const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

const client = new Anthropic({
  apiKey: apiKey || '',
});

// Check API key with helpful error message
if (!apiKey) {
  console.error('Error: API key not found');
  console.error('Set ANTHROPIC_API_KEY environment variable:');
  console.error('  - Via command line: ANTHROPIC_API_KEY=sk-xxx npx tsx ...');
  console.error('  - Via .env file: Add line ANTHROPIC_API_KEY=sk-xxx');
  process.exit(1);
}
```

### Preview-Before-Commit Workflow
```typescript
// Source: User decision from CONTEXT.md + AI coding workflow 2026
// https://addyo.substack.com/p/my-llm-coding-workflow-going-into

async function main() {
  console.log('Starting learning content generation...\n');

  // ... generate content ...

  // DO NOT auto-modify questions.json
  // Instead, output for review:

  console.log('\n' + '='.repeat(60));
  console.log('GENERATED CONTENT - REVIEW BEFORE COMMITTING');
  console.log('='.repeat(60));
  console.log(JSON.stringify(generatedContent, null, 2));

  // Write to temp file for easier review
  const tempPath = join(process.cwd(), 'temp-learning-content.json');
  writeFileSync(tempPath, JSON.stringify(generatedContent, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`Content saved to: ${tempPath}`);
  console.log('Next steps:');
  console.log('1. Review generated content for accuracy');
  console.log('2. Verify all source URLs are real and relevant');
  console.log('3. Manually merge into src/data/questions.json');
  console.log('4. Delete temp file after merging');
  console.log('='.repeat(60));
}

// REMOVE this line (currently at line 195):
// writeFileSync(questionsPath, JSON.stringify(questions, null, 2), 'utf-8');
```

### VERIFICATION.md Structure (From Existing Pattern)
```markdown
<!-- Source: Phase 1 and Phase 2 VERIFICATION.md format analysis -->
---
phase: 03-scoring-system
verified: 2026-02-13T12:00:00Z
status: passed
score: X/X must-haves verified
---

# Phase 3: Scoring System - Verification Report

**Phase Goal:** [From phase description]
**Verified:** 2026-02-13T12:00:00Z
**Status:** PASSED
**Re-verification:** No — retroactive verification from code analysis

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | [Must-have truth from PLAN] | VERIFIED | [File:line evidence from code] |
| 2 | [Must-have truth from PLAN] | VERIFIED | [File:line evidence from code] |

**Score:** X/X truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| [path from PLAN] | [provides from PLAN] | VERIFIED | [Line count, key exports found] |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| [from PLAN] | [to PLAN] | [via PLAN] | WIRED | [Grep evidence of import/call] |

### Requirements Coverage

Phase 3 maps to SCORE-01 through SCORE-05:

| Requirement | Status | Evidence |
|-------------|--------|----------|
| SCORE-01: Base points +100 | SATISFIED | [Code evidence] |
| SCORE-02: Speed bonus | SATISFIED | [Code evidence] |
| SCORE-03: Wager points | SATISFIED | [Code evidence] |
| SCORE-04: Running score displayed | SATISFIED | [Code evidence] |
| SCORE-05: Server-side calculation | SATISFIED | [Code evidence] |

### Anti-Patterns Found

[If any TODO/FIXME found, list here. Otherwise "0 found"]

## Summary

**STATUS: PASSED**

Phase goal achieved. [Summary of what was verified and how]

---
Verified: 2026-02-13T12:00:00Z
Verifier: Claude (gsd-verifier)
Note: Retroactive verification via code analysis (feature already in production)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dotenv only | Node.js --env-file flag OR dotenv | Node.js 20.6.0 (2023) | Native support reduces dependencies but dotenv still widely used for validation/maturity |
| Manual API integration | Official Anthropic SDK | SDK v0.1.0 (2023) | Type safety, retry logic, streaming support built-in |
| Auto-commit AI content | Preview-before-commit workflow | 2026 AI workflow patterns | Human oversight prevents AI hallucinations from reaching production |
| Live testing for docs | Static code analysis verification | 2026 best practices | Enables retroactive documentation for shipped features |

**Deprecated/outdated:**
- Direct HTTP calls to Anthropic API: Official SDK is now standard, provides better DX and type safety
- process.env without validation: Modern apps use dotenv with validation or Zod schemas
- CLAUDE_API_KEY naming: Official SDK standardized on ANTHROPIC_API_KEY (though backward compatibility is good practice)

## Open Questions

Things that couldn't be fully resolved:

1. **Exact @anthropic-ai/sdk version to install**
   - What we know: Package exists on npm, SDK is stable and actively maintained
   - What's unclear: Current latest version number (WebFetch couldn't retrieve from npm page due to 403)
   - Recommendation: Use `npm install --save-dev @anthropic-ai/sdk@latest` to get current version. Check package.json after install to document actual version used.

2. **Phase 3 scoring implementation details**
   - What we know: Phase 3 has 3 plans (01, 02, 03), SCORE-01 through SCORE-05 requirements, session/score services exist
   - What's unclear: Exact structure of speed bonus tiers, plausibility check logic details (will be discovered during code analysis)
   - Recommendation: Read all 3 PLAN files completely, then analyze actual implementation files to reconstruct accurate VERIFICATION.md

3. **Documentation audit scope**
   - What we know: User wants "light audit" to "flag obvious inaccuracies" in existing docs
   - What's unclear: Definition of "obvious" inaccuracies, how deep to audit, which docs to check
   - Recommendation: Scan all PLAN/SUMMARY/VERIFICATION files for: (1) broken file path references, (2) requirement IDs that don't exist in REQUIREMENTS.md, (3) phase numbers that don't match folder structure, (4) claims contradicted by actual code

## Sources

### Primary (HIGH confidence)
- Anthropic SDK TypeScript Official Docs: https://platform.claude.com/docs/en/api/client-sdks (WebFetch verified)
- Anthropic SDK GitHub Repository: https://github.com/anthropics/anthropic-sdk-typescript (WebFetch verified)
- Phase 1 VERIFICATION.md: `C:\Project Test\.planning\phases\01-foundation-auth\01-VERIFICATION.md` (File read)
- Phase 2 VERIFICATION.md: `C:\Project Test\.planning\phases\02-game-core\02-VERIFICATION.md` (File read)
- Phase 8 CONTEXT.md: User decisions from `/gsd:discuss-phase` (File read)
- REQUIREMENTS.md: LCONT-01, DOCS-01 definitions (File read)
- generateLearningContent.ts current implementation: `C:\Project Test\backend\src\scripts\generateLearningContent.ts` (File read)

### Secondary (MEDIUM confidence)
- [TypeScript Best Practices 2026](https://www.bacancytechnology.com/blog/typescript-best-practices) - WebSearch verified
- [Node.js TypeScript Setup 2026](https://reintech.io/blog/how-to-set-up-typescript-with-nodejs-22-modern-configuration-guide) - WebSearch verified
- [Node.js Native .env Support](https://pawelgrzybek.com/node-js-with-native-support-for-env-files-you-may-not-need-dotenv-anymore/) - WebSearch verified multiple sources agree
- [AI Coding Workflow 2026 by Addy Osmani](https://addyo.substack.com/p/my-llm-coding-workflow-going-into) - WebSearch verified, preview-before-commit pattern
- [Static Code Analysis Tools 2026](https://www.codeant.ai/blogs/static-code-analysis-tools) - WebSearch verified
- [AI Citation Accuracy 2026](https://koanthic.com/en/citation-worthy-content-ai-systems-guide-2026/) - WebSearch verified, 94% accuracy Perplexity AI

### Tertiary (LOW confidence)
- npm package @anthropic-ai/sdk version details: WebFetch returned 403, version number not confirmed. Recommendation: Install and verify.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK documented, dotenv/tsx already in use, versions verified in package.json
- Architecture: HIGH - All patterns verified from official sources (Anthropic docs) or user decisions (CONTEXT.md) or existing codebase (VERIFICATION format from Phase 1/2)
- Pitfalls: HIGH - Environment variable issues verified from official Node.js/SDK docs, AI citation issues verified from 2026 research, code analysis approach verified from established patterns

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (30 days - stable ecosystem, SDK is mature, Node.js features are stable)

**Notes:**
- User decisions from CONTEXT.md are locked and constrain implementation choices
- Phase 3 VERIFICATION.md must be reconstructed without live testing (per user decision)
- Generated content workflow modified to preview-before-commit (per user decision)
- Source citations are mandatory for AI-generated content (per user decision)
- ANTHROPIC_API_KEY is standard naming but support CLAUDE_API_KEY for backward compatibility

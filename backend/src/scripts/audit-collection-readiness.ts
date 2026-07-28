/**
 * audit-collection-readiness.ts
 *
 * Blocking pre-activation readiness audit for any collection.
 * Checks question counts and expiration dates before activation.
 *
 * Usage:
 *   cd backend
 *   npx tsx src/scripts/audit-collection-readiness.ts --slug fremont-ca --prefix fre
 *   npx tsx src/scripts/audit-collection-readiness.ts --slug norwich-uk --prefix nor
 *
 * Exit codes:
 *   0 — READY (netCount >= 50)
 *   1 — BLOCKED (netCount < 50) or error
 */

import 'dotenv/config';
import { db } from '../db/index.js';
import { questions, collections } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import type { LocaleConfig } from './content-generation/locale-configs/bloomington-in.js';

// ─── CLI argument parsing ─────────────────────────────────────────────────────

interface ParsedArgs {
  slug: string | null;
  prefix: string | null;
  help: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    slug: null,
    prefix: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug' && args[i + 1]) {
      result.slug = args[i + 1];
      i++;
    } else if (args[i] === '--prefix' && args[i + 1]) {
      result.prefix = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      result.help = true;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Usage: npx tsx src/scripts/audit-collection-readiness.ts [options]

Required:
  --slug <slug>          Collection slug (e.g. fremont-ca)
  --prefix <prefix>      External ID prefix used for this collection's questions (e.g. fre)

Optional:
  --help, -h             Show this help message

Exit codes:
  0 — READY (net question count >= 50)
  1 — BLOCKED (net question count < 50) or error

Examples:
  npx tsx src/scripts/audit-collection-readiness.ts --slug fremont-ca --prefix fre
  npx tsx src/scripts/audit-collection-readiness.ts --slug norwich-uk --prefix nor
`);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(args: ParsedArgs): void {
  const errors: string[] = [];

  if (!args.slug || args.slug.trim() === '') {
    errors.push('--slug is required and must be non-empty');
  }

  if (!args.prefix) {
    errors.push('--prefix is required');
  } else if (!/^[a-z]{2,5}$/.test(args.prefix)) {
    errors.push(`--prefix "${args.prefix}" must match /^[a-z]{2,5}$/ (2–5 lowercase letters)`);
  }

  if (errors.length > 0) {
    console.error('Validation errors:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

// ─── Locale config loader ─────────────────────────────────────────────────────

async function tryLoadLocaleConfig(slug: string): Promise<LocaleConfig | null> {
  const paths = [
    `./content-generation/locale-configs/${slug}.js`,
    `./content-generation/locale-configs/state-configs/${slug}.js`,
  ];

  for (const path of paths) {
    try {
      const mod = await import(path);
      for (const key of Object.keys(mod)) {
        const val = mod[key];
        if (val && typeof val === 'object' && 'locale' in val && 'externalIdPrefix' in val) {
          return val as LocaleConfig;
        }
      }
    } catch {
      // File not found — try next path
    }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  validate(args);

  const slug = args.slug!;
  const prefix = args.prefix!;
  const prefixPattern = prefix + '-%';
  const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  try {
    // Step 1: Verify collection exists
    const [collection] = await db
      .select({ id: collections.id, name: collections.name, isActive: collections.isActive })
      .from(collections)
      .where(eq(collections.slug, slug))
      .limit(1);

    if (!collection) {
      console.error(`Error: No collection found with slug "${slug}".`);
      console.error('Make sure the collection has been seeded to the database first.');
      console.error('  cd backend && npx tsx src/db/seed/seed.ts');
      process.exit(1);
    }

    if (collection.isActive) {
      console.warn(`Warning: Collection "${collection.name}" (${slug}) is already active.`);
    }

    // Step 2: Count DRAFT questions
    const [draftCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(
        sql`${questions.externalId} LIKE ${prefixPattern} AND ${questions.status} = 'draft'`
      );

    const draftCount = draftCountResult?.count ?? 0;

    // Step 3: Count ACTIVE questions
    const [activeCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(
        sql`${questions.externalId} LIKE ${prefixPattern} AND ${questions.status} = 'active'`
      );

    const activeCount = activeCountResult?.count ?? 0;

    // Step 4: Count near-expiring questions (draft + active with expiresAt within 90 days)
    const [expiringCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(
        sql`
          ${questions.externalId} LIKE ${prefixPattern}
          AND ${questions.status} IN ('draft', 'active')
          AND ${questions.expiresAt} IS NOT NULL
          AND ${questions.expiresAt} <= ${ninetyDaysFromNow.toISOString()}
        `
      );

    const expiringCount = expiringCountResult?.count ?? 0;

    // Step 4b: Count questions with ANY expiresAt set (no date filter) — for ratio enforcement
    const [expiringRatioCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(
        sql`
          ${questions.externalId} LIKE ${prefixPattern}
          AND ${questions.status} IN ('draft', 'active')
          AND ${questions.expiresAt} IS NOT NULL
        `
      );

    const expiringRatioCount = expiringRatioCountResult?.count ?? 0;

    // Step 5: Calculate net count
    const totalCount = draftCount + activeCount;
    const netCount = totalCount - expiringCount;
    const isReady = netCount >= 50;

    // Step 6: Print audit report
    console.log('');
    console.log('='.repeat(60));
    console.log('  COLLECTION READINESS AUDIT');
    console.log('='.repeat(60));
    console.log(`  Collection:    ${collection.name} (${slug})`);
    console.log(`  DB Status:     ${collection.isActive ? 'ACTIVE (already live)' : 'INACTIVE (banked)'}`);
    console.log('');
    console.log('  Question Counts:');
    console.log(`    Draft:       ${draftCount}`);
    console.log(`    Active:      ${activeCount}`);
    console.log(`    Total:       ${totalCount}`);
    console.log(`    Expiring:    ${expiringCount} (within 90 days)`);
    console.log(`    With expiresAt:  ${expiringRatioCount} (any date, for ratio)`);
    const expiringRatio = totalCount > 0 ? (expiringRatioCount / totalCount) * 100 : 0;
    console.log(`    Expiring ratio:  ${expiringRatio.toFixed(1)}% (target: 15–30%)`);
    console.log(`    Net:         ${netCount}  (total - expiring)`);
    console.log('');
    console.log(`  Threshold:     50 questions minimum`);
    console.log(`  Verdict:       ${isReady ? 'READY' : 'NOT READY — BLOCKED'}`);
    console.log('='.repeat(60));
    console.log('');

    if (!isReady) {
      console.error(`BLOCKED: Net question count (${netCount}) is below the 50-question minimum.`);
      console.error('Run generate-locale-questions to top up the question pool before activating.');
      process.exit(1);
    }

    // Expiring ratio warning (non-blocking)
    if (totalCount > 0 && expiringRatio < 15) {
      console.warn(`  WARNING: Expiring-question ratio is ${expiringRatio.toFixed(1)}% — below the 15% minimum target.`);
      console.warn(`  Consider adding more current-officeholder questions (mayor, council members, etc.) with expiresAt set.`);
      console.warn(`  Target range: 15–30% of questions should have expiresAt set.`);
      console.warn('');
    }

    // ─── Officeholder coverage check (non-blocking) ──────────────────────────
    const localeConfig = await tryLoadLocaleConfig(slug);
    if (localeConfig?.officeholders && localeConfig.officeholders.length > 0) {
      console.log('\n  Officeholder Coverage:');

      const allWithExpiry = await db
        .select({
          text: questions.text,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          expiresAt: questions.expiresAt,
        })
        .from(questions)
        .where(sql`
          ${questions.externalId} LIKE ${prefixPattern}
          AND ${questions.status} IN ('draft', 'active')
          AND ${questions.expiresAt} IS NOT NULL
        `);

      // A question covers an officeholder if it names them in the question text
      // OR if they are the correct answer. The second case is the common one and
      // used to be missed entirely: well-formed officeholder questions read
      // "Who currently serves as mayor?" and carry the name only in the options,
      // so matching on text alone reported real coverage as zero.
      //
      // A name appearing ONLY as a wrong-answer distractor is deliberately not
      // counted — that is the opposite of coverage.
      const namesQuestion = (
        q: { text: string; options: string[] | null; correctAnswer: number },
        nameLower: string,
      ): boolean => {
        if (q.text.toLowerCase().includes(nameLower)) return true;
        const answer = q.options?.[q.correctAnswer];
        return typeof answer === 'string' && answer.toLowerCase().includes(nameLower);
      };

      let zeroCoverageCount = 0;
      for (const official of localeConfig.officeholders) {
        const nameLower = official.name.toLowerCase();
        const covered = allWithExpiry.filter(q => namesQuestion(q, nameLower));
        const icon = covered.length === 0 ? 'WARNING' : 'OK';
        console.log(`    [${icon}] ${official.role}${official.district ? `, ${official.district}` : ''} — ${official.name}: ${covered.length} question(s)`);
        if (covered.length === 0) zeroCoverageCount++;
      }

      if (zeroCoverageCount > 0) {
        console.warn(`\n  WARNING: ${zeroCoverageCount} officeholder(s) have zero question coverage.`);
        console.warn('  Consider re-running generation with officeholders defined in locale config.\n');
      } else {
        console.log(`    All ${localeConfig.officeholders.length} officeholders have question coverage.\n`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

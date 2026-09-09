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
import { questions, collections, collectionQuestions } from '../db/schema.js';
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

  // --prefix is ADVISORY as of 2026-09-08. Auditing by prefix measured the wrong
  // set: it counted questions carrying a prefix rather than the collection's own,
  // so it reached into other collections on a collision and ignored a collection's
  // remaining questions whenever it used more than one prefix. Bloomington IN has
  // three; auditing it by the documented prefix missed 37 of its 157 questions.
  if (args.prefix && !/^[a-z]{2,5}$/.test(args.prefix)) {
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

// ─── Distractor bracketing ────────────────────────────────────────────────────
// magnitudeRank lives in services/questionQuality/answerPlacement.ts, alongside the
// write-time placeAnswer() guard that consumes the same magnitude definition. Keeping
// one copy is the point: two drifting definitions of "is this a number series" is how
// this class of bug survives. Re-exported so existing importers of this script still
// resolve it.
import { magnitudeRank } from '../services/questionQuality/answerPlacement.js';
export { magnitudeRank };

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  validate(args);

  const slug = args.slug!;
  const prefix = args.prefix;   // advisory only — see validate()
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

    // Every count below is scoped to THIS collection's linked questions. Membership
    // is the join table, never the external-id prefix — a prefix identifies neither
    // a collection nor all of one.
    const inCollection = sql`EXISTS (
      SELECT 1 FROM trivia.collection_questions cq
      WHERE cq.question_id = ${questions.id} AND cq.collection_id = ${collection.id}
    )`;

    // Nothing linked means the link step was skipped, and every number below would
    // be a truthful-looking zero. Refuse to render a verdict on an empty set.
    const [linkedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionQuestions)
      .where(eq(collectionQuestions.collectionId, collection.id));

    if ((linkedResult?.count ?? 0) === 0) {
      console.error(`Error: Collection "${collection.name}" (${slug}) has no linked questions.`);
      console.error('There is nothing to audit. Link its questions first');
      console.error('(create-collection SKILL.md, step 6e), then re-run.');
      process.exit(1);
    }

    // Report the prefixes this collection actually spans, and cross-check the
    // advisory one so a stale invocation is visible rather than silently ignored.
    const ownPrefixes = await db
      .select({
        prefix: sql<string>`split_part(${questions.externalId}, '-', 1)`,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .innerJoin(collectionQuestions, eq(collectionQuestions.questionId, questions.id))
      .where(eq(collectionQuestions.collectionId, collection.id))
      .groupBy(sql`split_part(${questions.externalId}, '-', 1)`);

    const prefixList = ownPrefixes.map(r => `${r.prefix} (${r.count})`).join(', ');
    if (ownPrefixes.length > 1) {
      console.log(`Note: spans ${ownPrefixes.length} external-id prefixes: ${prefixList}. All audited.`);
    }
    if (prefix && !ownPrefixes.some(r => r.prefix === prefix)) {
      console.warn(`Warning: --prefix '${prefix}' matches none of this collection's prefixes (${prefixList}).`);
      console.warn('It is advisory and was ignored.');
    }

    // Step 2: Count DRAFT questions
    const [draftCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(
        sql`${inCollection} AND ${questions.status} = 'draft'`
      );

    const draftCount = draftCountResult?.count ?? 0;

    // Step 3: Count ACTIVE questions
    const [activeCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(
        sql`${inCollection} AND ${questions.status} = 'active'`
      );

    const activeCount = activeCountResult?.count ?? 0;

    // Step 4: Count near-expiring questions (draft + active with expiresAt within 90 days)
    const [expiringCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(
        sql`
          ${inCollection}
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
          ${inCollection}
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
    // ── Distractor bracketing ────────────────────────────────────────────────
    const optionRows = await db
      .select({ options: questions.options, correctAnswer: questions.correctAnswer })
      .from(questions)
      .where(sql`${inCollection} AND ${questions.status} IN ('draft', 'active')`);

    const rankCounts = [0, 0, 0, 0];
    let magnitudeTotal = 0;
    for (const row of optionRows) {
      const opts = (row.options as string[] | null) ?? [];
      const rk = magnitudeRank(opts, row.correctAnswer);
      if (rk === null) continue;
      magnitudeTotal++;
      rankCounts[rk - 1]++;
    }

    if (magnitudeTotal >= 8) {
      const atExtreme = rankCounts[0] + rankCounts[3];
      const pctExtreme = (100 * atExtreme) / magnitudeTotal;
      const worst = Math.max(...rankCounts);
      const pctWorst = (100 * worst) / magnitudeTotal;

      console.log('\n  Distractor Bracketing (numeric questions):');
      console.log(`    Magnitude questions: ${magnitudeTotal}`);
      console.log(
        `    Answer is smallest/2nd/3rd/largest of four: ` +
          `${rankCounts[0]} / ${rankCounts[1]} / ${rankCounts[2]} / ${rankCounts[3]}`
      );
      console.log(
        `    At an extreme: ${pctExtreme.toFixed(1)}% (healthy ~50%)  |  ` +
          `best single guess: ${pctWorst.toFixed(1)}% (random 25%)`
      );

      // 30% is deliberately lenient against the 50% ideal -- small collections are
      // lumpy, and this should fire on a real pattern, not on noise.
      if (pctExtreme < 30) {
        console.log(
          `\n  WARNING: only ${pctExtreme.toFixed(1)}% of numeric answers are the ` +
            `smallest or largest option offered (healthy ~50%).`
        );
        console.log(
          '  Distractors are bracketing the true value, so "sort the numbers and pick ' +
            `the ${rankCounts.indexOf(worst) + 1}${['st', 'nd', 'rd', 'th'][rankCounts.indexOf(worst)]}" ` +
            `scores ${pctWorst.toFixed(1)}% without any knowledge.`
        );
        console.log(
          '  Fix by redesigning distractors so the answer sometimes sits entirely above ' +
            'or below them (for "9 members", offer 9/11/13/15, not 5/7/9/11).'
        );
        console.log('  Rotating answer POSITIONS does not fix this and masks it.');
      }
    }

    // ── Answer position ──────────────────────────────────────────────────────
    /**
     * Where the correct answer sits in the option list as displayed.
     *
     * Options are stored in `questions.options` and served in stored order --
     * `stripAnswers()` removes correctAnswer from the payload, but nothing shuffles
     * the options themselves (only the questions are shuffled, in questionService.ts
     * and gameModes.ts). So the stored index IS the position the player sees.
     *
     * A survey on 2026-09-08 found this had collapsed. In Missouri, St. Louis and New
     * York the answer was at position A in 100% of active questions -- 457 questions
     * across five collections where "always pick A" wins every game. Federal was at
     * 73.5% on B. Only the six collections that had had a manual rotation run against
     * them were near uniform.
     *
     * It hid because the rotation was a manual per-collection step that nothing
     * asserted, and the collections it had been run on were exactly the ones that
     * looked fine. This check is the assertion that was missing.
     *
     * Note this is a strict companion to the bracketing check above, not a substitute:
     * for a magnitude question displayed in ascending order the two measure the same
     * thing (value rank IS display position), which is precisely why sorting numeric
     * options is preferable to rotating them -- rotation moves the answer without
     * touching the values, so it flattens this histogram while leaving the
     * sort-and-pick exploit intact.
     */
    const posCounts = [0, 0, 0, 0];
    let positionTotal = 0;
    for (const row of optionRows) {
      const opts = (row.options as string[] | null) ?? [];
      if (opts.length !== 4) continue;
      if (row.correctAnswer < 0 || row.correctAnswer > 3) continue;
      positionTotal++;
      posCounts[row.correctAnswer]++;
    }

    if (positionTotal >= 8) {
      const worstPos = Math.max(...posCounts);
      const pctWorstPos = (100 * worstPos) / positionTotal;
      const letter = ['A', 'B', 'C', 'D'][posCounts.indexOf(worstPos)];

      console.log('\n  Answer Position:');
      console.log(`    Correct answer at A / B / C / D: ${posCounts.join(' / ')}`);
      console.log(
        `    Best single guess: ${pctWorstPos.toFixed(1)}% (random 25%, ideal ~25%)`
      );

      // 40% against a 25% baseline -- lenient enough that an ordinary lumpy
      // collection stays quiet, tight enough to have caught all 22 collections
      // that were above 45% when this was written.
      if (pctWorstPos > 40) {
        console.log(
          `\n  WARNING: "always pick ${letter}" scores ${pctWorstPos.toFixed(1)}% ` +
            'without reading the question (random 25%).'
        );
        console.log(
          '  Fix by moving the correct answer across positions. For PROSE options, ' +
            'permute freely. For NUMERIC options, sort them ascending instead of ' +
            'rotating -- that fixes position and value rank together and leaves the ' +
            'series readable.'
        );
        console.log(
          '  Check for "all of the above"-style options first; those must stay last.'
        );
      }
    }

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
          ${inCollection}
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

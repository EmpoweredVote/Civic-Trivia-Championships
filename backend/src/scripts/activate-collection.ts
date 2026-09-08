/**
 * activate-collection.ts
 *
 * Parameterized CLI that replaces the hardcoded activate-collections.ts.
 * Activates a collection and its draft questions in the database.
 *
 * Usage:
 *   cd backend
 *   npx tsx src/scripts/activate-collection.ts --slug bloomington-in --prefix bli
 *   npx tsx src/scripts/activate-collection.ts --slug bloomington-in --prefix bli --dry-run
 *   npx tsx src/scripts/activate-collection.ts --help
 */

import 'dotenv/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { db } from '../db/index.js';
import { collections, questions, collectionQuestions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

// ─── CLI argument parsing ─────────────────────────────────────────────────────

interface ParsedArgs {
  slug: string | null;
  prefix: string | null;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    slug: null,
    prefix: null,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug' && args[i + 1]) {
      result.slug = args[i + 1];
      i++;
    } else if (args[i] === '--prefix' && args[i + 1]) {
      result.prefix = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      result.dryRun = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      result.help = true;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Usage: npx tsx src/scripts/activate-collection.ts [options]

Required:
  --slug <slug>          Collection slug (e.g. bloomington-in)
  --prefix <prefix>      ADVISORY only. Cross-checked against the collection's actual
                         prefixes and warned about on a mismatch; it no longer selects
                         what gets activated (that is scoped by collection_id).

Optional:
  --dry-run              Show what would happen without writing to the database
  --help, -h             Show this help message

Examples:
  npx tsx src/scripts/activate-collection.ts --slug bloomington-in --prefix bli
  npx tsx src/scripts/activate-collection.ts --slug austin-tx --prefix aut --dry-run
`);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(args: ParsedArgs): void {
  const errors: string[] = [];

  if (!args.slug || args.slug.trim() === '') {
    errors.push('--slug is required and must be non-empty');
  }

  // --prefix is ADVISORY as of 2026-09-08. It used to select the questions to
  // activate, which was wrong: a prefix does not identify a collection. `ind` is
  // shared by Indiana and Indio CA, and five collections use more than one prefix
  // (Bloomington IN has three, and 15 of its drafts sat stranded under a prefix
  // nobody passed). Activation now scopes through collection_questions; the prefix
  // is only cross-checked, so a stale or wrong one warns instead of mis-activating.
  if (args.prefix && !/^[a-z]{2,5}$/.test(args.prefix)) {
    errors.push(`--prefix "${args.prefix}" must match /^[a-z]{2,5}$/ (2–5 lowercase letters)`);
  }

  if (args.slug && args.slug.trim() !== '') {
    const bannerPath = resolve(process.cwd(), `../frontend/public/images/collections/${args.slug}.jpg`);
    if (!existsSync(bannerPath)) {
      errors.push(`missing banner image: frontend/public/images/collections/${args.slug}.jpg`);
    }
  }

  if (errors.length > 0) {
    console.error('Validation errors:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
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
  const prefix = args.prefix;   // advisory only — see validate()

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
      console.warn(`Warning: Collection "${collection.name}" (${slug}) is already active. Proceeding anyway.`);
    }

    // Step 2: Count this COLLECTION's draft questions, via the join table.
    //
    // Scoped by collection_id rather than by external-id prefix. The prefix was
    // never a collection identifier: it silently reached into other collections on
    // a collision, and silently missed a collection's own questions whenever it
    // used more than one prefix.
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .innerJoin(collectionQuestions, eq(collectionQuestions.questionId, questions.id))
      .where(sql`${collectionQuestions.collectionId} = ${collection.id} AND ${questions.status} = 'draft'`);

    const draftCount = countResult?.count ?? 0;

    // A collection with NOTHING linked means the link step was skipped. Fail loudly:
    // silently activating nothing is how 15 Bloomington drafts went unnoticed.
    const [linkedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionQuestions)
      .where(eq(collectionQuestions.collectionId, collection.id));

    if ((linkedResult?.count ?? 0) === 0) {
      console.error(`Error: Collection "${collection.name}" (${slug}) has no linked questions.`);
      console.error('Nothing can be activated until questions are linked to it.');
      console.error('Run the link step first (create-collection SKILL.md, step 6e):');
      console.error('  INSERT INTO trivia.collection_questions (collection_id, question_id, created_at)');
      console.error(`  SELECT ${collection.id}, q.id, NOW() FROM trivia.questions q`);
      console.error("  WHERE q.external_id LIKE '<prefix>-%'");
      console.error('    AND NOT EXISTS (SELECT 1 FROM trivia.collection_questions cq WHERE cq.question_id = q.id);');
      process.exit(1);
    }

    // Cross-check the advisory prefix against what this collection actually holds.
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
      console.log(`Note: "${collection.name}" spans ${ownPrefixes.length} external-id prefixes: ${prefixList}.`);
      console.log('All of them are covered — activation is scoped by collection, not by prefix.');
    }
    if (prefix && !ownPrefixes.some(r => r.prefix === prefix)) {
      console.warn(`Warning: --prefix '${prefix}' matches none of this collection's prefixes (${prefixList}).`);
      console.warn('It is advisory and will be ignored. Check you named the collection you meant.');
    }

    if (draftCount === 0) {
      console.warn(`Warning: No draft questions in "${collection.name}". Nothing to activate.`);
    } else if (draftCount < 50) {
      console.warn(`Warning: Only ${draftCount} draft questions found (recommended: 50+). Proceeding anyway.`);
    } else {
      console.log(`Found ${draftCount} draft questions in "${collection.name}".`);
    }

    // Step 3: Dry run — show what would happen and exit
    if (args.dryRun) {
      const activeStatus = collection.isActive ? 'active' : 'inactive';
      console.log(`
DRY RUN — no changes made.
Would activate:
  Collection: ${collection.name} (${slug}) — currently ${activeStatus}
  Banner:     frontend/public/images/collections/${slug}.jpg ✓
  Questions:  ${draftCount} draft questions linked to this collection
`);
      process.exit(0);
    }

    // Step 4: Activate collection
    await db
      .update(collections)
      .set({ isActive: true, updatedAt: sql`NOW()` })
      .where(eq(collections.slug, slug));

    // Step 5: Activate questions (only if count > 0)
    let activatedCount = 0;
    if (draftCount > 0) {
      // Scoped to this collection's linked questions. The EXISTS is what makes the
      // write safe: it cannot touch a question belonging to another collection, no
      // matter what --prefix said.
      const activated = await db
        .update(questions)
        .set({ status: 'active', updatedAt: sql`NOW()` })
        .where(sql`${questions.status} = 'draft' AND EXISTS (
          SELECT 1 FROM trivia.collection_questions cq
          WHERE cq.question_id = ${questions.id} AND cq.collection_id = ${collection.id}
        )`)
        .returning({ externalId: questions.externalId });

      activatedCount = activated.length;
    }

    // Step 6: Print summary
    console.log(`
Activation complete!
  Collection: ${collection.name} (${slug}) — now active
  Questions activated: ${activatedCount}
`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

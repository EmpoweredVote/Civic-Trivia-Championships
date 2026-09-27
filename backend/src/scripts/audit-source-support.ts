/**
 * Audit Source Support Script
 *
 * Stage two of the source-drift check. Stage one (`checkSourceDrift`, in the rules
 * engine) is a free heuristic that narrows the bank to questions whose claim rests on
 * a rule, ranking or count an outside body can change. This script takes that shortlist
 * and does the thing a heuristic cannot: reads each cited source and asks whether it
 * still establishes the claim.
 *
 * Written after `lou-018`, which asked in what years Louisiana holds "its statewide
 * elections". Correct when written; Act 1 of Louisiana's 2024 First Extraordinary
 * Session moved congressional, state Supreme Court, PSC and BESE races to closed party
 * primaries in even years. Live source, no date in the text, no expires_at -- nothing
 * in the pipeline could see it. A human reading the question caught it.
 *
 * NOT SCHEDULED, BY DESIGN. Run it against a collection while auditing that collection.
 * There is no cron and it is not wired into the nightly pipeline.
 *
 * DEFAULTS TO A DRY RUN. Without `--judge` it fetches nothing, calls no model and
 * spends nothing -- it prints the shortlist so you can read it yourself. `--judge` is
 * what opts into network and model spend.
 *
 * This script never archives, never rewrites and never changes a question's status.
 * A source judged "not-established" is a reason to go and read, not a verdict. Two
 * questions in this audit looked stale and were correct -- Alexandria's mayor, who left
 * office in 2018 and won it back in 2022, and Phoenix's city manager, whose predecessor
 * was rehired. The only writes it makes are to `fact_snapshot` and `confidence_tier`,
 * which record the supporting excerpt so the NEXT check is a cheap diff rather than a
 * fresh judgement.
 *
 * Usage:
 *   npx tsx src/scripts/audit-source-support.ts --slug louisiana
 *   npx tsx src/scripts/audit-source-support.ts --slug louisiana --judge
 *   npx tsx src/scripts/audit-source-support.ts --slug louisiana --judge --write
 *   npx tsx src/scripts/audit-source-support.ts --all
 */

import '../env.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { checkSourceDrift } from '../services/qualityRules/rules/source-drift.js';
import type { QuestionInput } from '../services/qualityRules/types.js';

/**
 * Haiku is the judge here deliberately. This is a high-volume, narrow classification --
 * "does this page establish this sentence" -- which is the shape the cheap tier is for,
 * and the whole design brief for this check was ongoing cost. Override with --model when
 * a collection's sources are dense enough to need more.
 */
const DEFAULT_MODEL = 'claude-haiku-4-5';

/** Page text beyond this is very unlikely to contain the supporting sentence. */
const MAX_SOURCE_CHARS = 40_000;

/** Matches the excerpt length the news lane already stores in fact_snapshot. */
const MAX_SNAPSHOT_CHARS = 400;

type Verdict = 'supported' | 'not-established' | 'unreachable';

interface QuestionRow {
  id: number;
  externalId: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  source: { name: string; url: string };
  collectionName: string;
}

interface Judgement {
  verdict: Verdict;
  excerpt: string;
  reasoning: string;
}

interface Args {
  slug?: string;
  all: boolean;
  judge: boolean;
  write: boolean;
  model: string;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { all: false, judge: false, write: false, model: DEFAULT_MODEL };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug') args.slug = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--judge') args.judge = true;
    else if (a === '--write') args.write = true;
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
  }

  if (!args.slug && !args.all) {
    throw new Error('Pass --slug <collection-slug> or --all');
  }
  if (args.write && !args.judge) {
    throw new Error('--write requires --judge: there is nothing to write without a judgement');
  }

  return args;
}

async function fetchQuestions(slug?: string): Promise<QuestionRow[]> {
  const result = await db.execute(sql`
    SELECT
      q.id,
      q.external_id  AS "externalId",
      q.text,
      q.options,
      q.correct_answer AS "correctAnswer",
      q.explanation,
      q.difficulty,
      q.source,
      c.name AS "collectionName"
    FROM trivia.questions q
    JOIN trivia.collection_questions cq ON q.id = cq.question_id
    JOIN trivia.collections c ON cq.collection_id = c.id
    WHERE q.status = 'active'
      AND c.is_active
      ${slug ? sql`AND c.slug = ${slug}` : sql``}
    ORDER BY c.name, q.external_id
  `);

  return result.rows as unknown as QuestionRow[];
}

function toInput(row: QuestionRow): QuestionInput {
  return {
    externalId: row.externalId,
    text: row.text,
    options: row.options,
    correctAnswer: row.correctAnswer,
    explanation: row.explanation,
    difficulty: row.difficulty,
    source: row.source,
  };
}

/** The claim as the player meets it: the question plus the answer it rewards. */
function claimOf(row: QuestionRow): string {
  return `${row.text} -- the answer treated as correct is "${row.options[row.correctAnswer]}".`;
}

/**
 * Strip a fetched page to something worth sending. Deliberately crude: we are looking
 * for whether a sentence appears, not rendering the document.
 */
function toPlainText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSource(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'CivicTriviaChampionship-SourceAudit/1.0' },
    });
    if (!res.ok) return null;
    return toPlainText(await res.text()).slice(0, MAX_SOURCE_CHARS);
  } catch {
    return null;
  }
}

/**
 * Parse the judge's reply.
 *
 * Exported and pure so the parsing can be reasoned about on its own. It is deliberately
 * forgiving about surrounding prose and strict about the verdict vocabulary: an
 * unrecognised verdict becomes `not-established`, which routes the question to a human
 * rather than silently blessing it.
 */
export function parseJudgement(raw: string): Judgement {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { verdict: 'not-established', excerpt: '', reasoning: 'unparseable judge reply' };
  }

  try {
    const parsed = JSON.parse(match[0]) as Partial<Judgement>;
    const verdict: Verdict = parsed.verdict === 'supported' ? 'supported' : 'not-established';
    return {
      verdict,
      excerpt: (parsed.excerpt ?? '').slice(0, MAX_SNAPSHOT_CHARS),
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    return { verdict: 'not-established', excerpt: '', reasoning: 'invalid JSON in judge reply' };
  }
}

const JUDGE_SYSTEM = [
  'You check whether a cited source establishes a trivia question\'s answer.',
  '',
  'Answer only from the source text given. Do not use your own knowledge of the subject:',
  'the whole point is to find claims the source no longer supports, and filling the gap',
  'from memory defeats it.',
  '',
  'Reply with JSON only:',
  '{"verdict":"supported"|"not-established","excerpt":"<the sentence that establishes it, verbatim, or empty>","reasoning":"<one sentence>"}',
  '',
  '"supported" requires a passage that establishes the WHOLE claim. If the source covers',
  'part of it, or discusses the topic without stating this fact, that is "not-established".',
].join('\n');

async function judge(model: string, claim: string, sourceText: string): Promise<Judgement> {
  const { client } = await import('./content-generation/anthropic-client.js');

  const response = await client.messages.create({
    model,
    max_tokens: 1000,
    system: JUDGE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `CLAIM:\n${claim}\n\nSOURCE TEXT:\n${sourceText}`,
      },
    ],
  });

  const text = response.content.map(b => (b.type === 'text' ? b.text : '')).join('');

  return parseJudgement(text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const rows = await fetchQuestions(args.slug);
  const flagged = rows.filter(r => !checkSourceDrift(toInput(r)).passed);
  const shortlist = args.limit ? flagged.slice(0, args.limit) : flagged;

  console.log(`\nRead ${rows.length} active questions.`);
  console.log(
    `Stage 1 flagged ${flagged.length} (${((100 * flagged.length) / Math.max(rows.length, 1)).toFixed(1)}%).`
  );

  if (!args.judge) {
    console.log('\nDRY RUN -- no source fetched, no model called, nothing spent.');
    console.log('Re-run with --judge to read each source against its claim.\n');
    for (const r of shortlist) {
      const triggers = checkSourceDrift(toInput(r)).violations[0]?.evidence ?? '';
      console.log(`  ${r.externalId}  [${r.collectionName}]  ${triggers}`);
      console.log(`    ${r.text}`);
      console.log(`    -> ${r.options[r.correctAnswer]}`);
      console.log(`    source: ${r.source.url}\n`);
    }
    console.log(`${shortlist.length} question(s) to read.\n`);
    return;
  }

  console.log(`Judging ${shortlist.length} with ${args.model}${args.write ? ' (writing snapshots)' : ''}.\n`);

  const tally: Record<Verdict, number> = { supported: 0, 'not-established': 0, unreachable: 0 };

  for (const r of shortlist) {
    const sourceText = await fetchSource(r.source.url);

    let result: Judgement;
    if (sourceText === null) {
      result = { verdict: 'unreachable', excerpt: '', reasoning: 'source could not be fetched' };
    } else {
      result = await judge(args.model, claimOf(r), sourceText);
    }

    tally[result.verdict]++;

    const mark =
      result.verdict === 'supported' ? 'OK  ' : result.verdict === 'unreachable' ? '??  ' : '>>  ';
    console.log(`${mark}${r.externalId}  [${r.collectionName}]`);
    if (result.verdict !== 'supported') {
      console.log(`    ${r.text}`);
      console.log(`    -> ${r.options[r.correctAnswer]}`);
      console.log(`    ${result.reasoning}`);
      console.log(`    source: ${r.source.url}`);
    }

    if (args.write && result.verdict === 'supported' && result.excerpt) {
      await db.execute(sql`
        UPDATE trivia.questions
        SET fact_snapshot = ${result.excerpt},
            confidence_tier = 'high',
            updated_at = NOW()
        WHERE id = ${r.id}
      `);
    }
  }

  console.log(
    `\nsupported ${tally.supported}  not-established ${tally['not-established']}  unreachable ${tally.unreachable}`
  );
  console.log('\nNothing was archived or rewritten. Read the not-established rows before changing any.');
  console.log('A source that does not establish a claim is a reason to go and look, not a verdict:');
  console.log('two questions in this audit looked stale and were right.\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

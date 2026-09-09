/**
 * Election Question Generator
 *
 * Core generation logic for election-specific civic trivia questions.
 * Generates draft MCQ questions linked to an election race, computes
 * timezone-aware expiry dates, and seeds questions to the database.
 *
 * Both the CLI script (generate-election-questions.ts) and the API route
 * (POST /api/admin/election-races/:id/generate) call this service.
 */

import { client } from '../../scripts/content-generation/anthropic-client.js';
import { db } from '../../db/index.js';
import { placeAnswer } from '../questionQuality/answerPlacement.js';
import {
  questions,
  collectionQuestions,
  electionRaces,
  collections,
  topics,
  collectionTopics,
  type ElectionRace,
} from '../../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { QUALITY_GUIDELINES } from '../../scripts/content-generation/prompts/quality-guidelines.js';

// ─── Exported interfaces ──────────────────────────────────────────────────────

export interface GenerationResult {
  questionsCreated: number;
  archived: number;
  raceId: number;
  jurisdiction: string;
  collectionSlug: string;
}

// ─── Custom error for blocked generation ─────────────────────────────────────

export class GenerationBlockedError extends Error {
  existingCount: number;
  generatedAt: string | null;

  constructor(existingCount: number, generatedAt: string | null) {
    const dateStr = generatedAt
      ? new Date(generatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })
      : 'unknown date';
    super(
      `Questions already generated for this race (${existingCount} existing, generated ${dateStr}). ` +
        `Use --force to archive existing questions and regenerate.`
    );
    this.name = 'GenerationBlockedError';
    this.existingCount = existingCount;
    this.generatedAt = generatedAt;
  }
}

// ─── Timezone-aware end-of-day computation ────────────────────────────────────

/**
 * Compute the UTC equivalent of 23:59:59.999 on a given local date in a given IANA timezone.
 * Uses only Node.js built-in Intl — no external date library required.
 *
 * Handles DST transitions correctly by anchoring on local noon (not midnight).
 *
 * @param localDateStr - Election date as 'YYYY-MM-DD' in the jurisdiction's timezone
 * @param tz - IANA timezone string (e.g., 'America/Indiana/Indianapolis')
 * @returns UTC Date representing 23:59:59.999 local time on that date
 */
export function getEndOfDayUTC(localDateStr: string, tz: string): Date {
  // Use local noon as reference point — avoids midnight DST edge cases
  const noonUtcGuess = new Date(localDateStr + 'T12:00:00.000Z');

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(noonUtcGuess);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const localHour = parseInt(get('hour'), 10);
  const localMin = parseInt(get('minute'), 10);
  const localSec = parseInt(get('second'), 10);

  // Back-compute: find UTC time that corresponds to local noon, then local midnight, then end-of-day
  const utcOfLocalNoon = new Date(
    noonUtcGuess.getTime() - (localHour - 12) * 3600000 - localMin * 60000 - localSec * 1000
  );
  const utcOfLocalMidnight = new Date(utcOfLocalNoon.getTime() - 12 * 3600000);
  const utcOfEndOfDay = new Date(utcOfLocalMidnight.getTime() + 24 * 3600000 - 1);

  return utcOfEndOfDay;
}

// ─── Question target count by seat type ──────────────────────────────────────

/**
 * Determine question count based on the seat type.
 * Mayor: 15 questions, Council: 10, everything else: 8.
 * Inspects race.seat (not race.electionType).
 */
export function getQuestionTarget(race: ElectionRace): number {
  const seat = race.seat.toLowerCase();
  if (seat.includes('mayor')) return 15;
  if (seat.includes('council')) return 10;
  return 8;
}

// ─── ExternalId builder ───────────────────────────────────────────────────────

/**
 * Build a unique external ID for an election question.
 * Normal:  elc-{raceId}-{seq} (e.g., elc-1-003)
 * Force:   elc-{raceId}-{timestamp36}-{seq} (avoids ON CONFLICT with archived questions)
 */
export function buildExternalId(raceId: number, seq: number, force: boolean): string {
  const seqStr = String(seq).padStart(3, '0');
  if (force) {
    const ts = Date.now().toString(36);
    return `elc-${raceId}-${ts}-${seqStr}`;
  }
  return `elc-${raceId}-${seqStr}`;
}

// ─── System prompt builder ────────────────────────────────────────────────────

/**
 * Build the Claude system prompt for election question generation.
 * Includes race details, question types, MCQ construction guidance
 * (conditional on candidate count), output format, and quality guidelines.
 */
export function buildElectionSystemPrompt(race: ElectionRace, questionTarget: number): string {
  const candidateNames = race.candidates.map((c) => c.name).join(', ') || 'Unknown';
  const candidateCount = race.candidates.length;

  // Format the election date as YYYY-MM-DD (stored as UTC midnight, use ISO string directly)
  const localElectionDate = race.electionDate.toISOString().split('T')[0];

  let mcqGuidance: string;
  if (candidateCount === 2) {
    mcqGuidance = `### Small Pool (2 candidates)
- Avoid "Which candidate...?" questions where only 2 options exist — this creates a degenerate 2-option MCQ padded with invented names.
- For seat civics questions, use real government entities (other offices, real jurisdictions) as distractors.
- For candidate questions, focus on individual roles, backgrounds, and verifiable facts about each candidate separately.`;
  } else if (candidateCount >= 5) {
    mcqGuidance = `### Crowded Primary (${candidateCount} candidates)
- Focus one question on one specific candidate — don't try to compare or list all candidates.
- Distractors can be other real candidates from this race (use actual names from the list above).
- Seat civics questions can use other offices, jurisdictions, or terms as distractors.`;
  } else {
    mcqGuidance = `### Standard Pool (${candidateCount} candidates)
- Mix candidate questions with seat civics questions for variety.
- Distractors should be plausible alternatives: real neighboring jurisdictions, real terms, real government structures.
- Candidate questions should focus on one candidate at a time.`;
  }

  return `You are a civic education content creator generating trivia questions about an upcoming election race.

## Race Details
- Seat: ${race.seat}
- Election Type: ${race.electionType}
- Jurisdiction: ${race.jurisdiction}
- Election Date: ${localElectionDate}
- Candidates: ${candidateNames}

## Question Types
Generate a mix of:
1. **SEAT CIVICS questions** (what does this office do? what powers does it have? how long is the term? what is the salary? how many members?)
   - Include both jurisdiction-specific details AND general rules for this type of office
2. **CANDIDATE questions** (factual only, no comparisons or endorsements — one candidate per question)
   - Stick to verifiable public facts: occupation, prior roles, endorsements from official sources
   - Do NOT editorialize, compare platforms, or express opinions about candidates

## Factual Only — No Comparisons or Endorsements
- Do NOT generate questions that compare candidates against each other
- Do NOT generate questions that could be perceived as favoring a candidate or party
- Focus on verifiable facts about the seat and individual candidates

## Answer Option Construction
${mcqGuidance}

## Output Format
Return ONLY a valid JSON object with no surrounding markdown:
{
  "questions": [
    {
      "text": "Question text ending with ?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "According to [source name], ...",
      "difficulty": "easy",
      "topicCategory": "election-race",
      "source": { "name": "Source Name", "url": "https://example.gov/..." }
    }
  ]
}

Generate exactly ${questionTarget} questions total. All questions must have all 4 options populated.

${QUALITY_GUIDELINES}`;
}

// ─── Collection + topic resolver ──────────────────────────────────────────────

/**
 * Resolve the collection ID and elections-voting topic ID for the given collection slug.
 * Creates the elections-voting topic if it does not already exist for this collection.
 *
 * @throws Error if the collection is not found
 */
export async function resolveCollectionAndTopic(
  collectionSlug: string
): Promise<{ collectionId: number; topicId: number }> {
  // 1. Look up collection by slug
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, collectionSlug))
    .limit(1);

  if (!collection) {
    throw new Error(
      `Collection not found: "${collectionSlug}". ` +
        `Ensure the collection exists before generating election questions.`
    );
  }

  const collectionId = collection.id;

  // 2. Look up the elections-voting topic for this collection
  const [existingTopic] = await db
    .select({ topicId: collectionTopics.topicId })
    .from(collectionTopics)
    .innerJoin(topics, eq(collectionTopics.topicId, topics.id))
    .where(
      and(
        eq(collectionTopics.collectionId, collectionId),
        eq(topics.slug, 'elections-voting')
      )
    )
    .limit(1);

  if (existingTopic) {
    return { collectionId, topicId: existingTopic.topicId };
  }

  // 3. Create elections-voting topic if it doesn't exist
  console.log(`  Creating "elections-voting" topic for collection "${collectionSlug}"...`);

  // Insert topic (use ON CONFLICT DO NOTHING in case slug already exists globally)
  const [newTopic] = await db
    .insert(topics)
    .values({
      name: 'Elections & Voting',
      slug: 'elections-voting',
      description: 'Questions about elections and voting in this jurisdiction',
    })
    .onConflictDoNothing()
    .returning({ id: topics.id });

  let topicId: number;

  if (newTopic) {
    topicId = newTopic.id;
  } else {
    // Topic already exists globally — fetch it
    const [globalTopic] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.slug, 'elections-voting'))
      .limit(1);

    if (!globalTopic) {
      throw new Error(`Failed to find or create "elections-voting" topic.`);
    }
    topicId = globalTopic.id;
  }

  // Link topic to collection
  await db
    .insert(collectionTopics)
    .values({ collectionId, topicId })
    .onConflictDoNothing();

  console.log(`  Created and linked "elections-voting" topic (id=${topicId})`);
  return { collectionId, topicId };
}

// ─── Main export: generateElectionQuestions ───────────────────────────────────

/**
 * Generate election-specific civic trivia questions for a race.
 *
 * Steps:
 * 1. Load race from DB. Fail if not found.
 * 2. Check questionsGenerated flag. Throw GenerationBlockedError if already done (and not force).
 * 3. If force: archive existing questions, reset flag.
 * 4. Resolve collection + elections-voting topic.
 * 5. Compute expiresAt (end-of-day local timezone).
 * 6. Determine question target count.
 * 7. Build system prompt, call Claude API.
 * 8. Parse and validate response.
 * 9. If dryRun: log and return without inserting.
 * 10. Insert questions to DB, link to collection.
 * 11. Set questionsGenerated = true on the race.
 * 12. Return GenerationResult.
 */
export async function generateElectionQuestions(
  raceId: number,
  collectionSlug: string,
  opts: { force?: boolean; dryRun?: boolean } = {}
): Promise<GenerationResult> {
  const { force = false, dryRun = false } = opts;

  // 1. Load race from DB
  const [race] = await db
    .select()
    .from(electionRaces)
    .where(eq(electionRaces.id, raceId))
    .limit(1);

  if (!race) {
    throw new Error(`Election race not found: ID ${raceId}`);
  }

  console.log(`\nGenerating questions for: ${race.seat} — ${race.jurisdiction}`);
  console.log(`  Election date: ${race.electionDate.toISOString().split('T')[0]}`);
  console.log(`  Timezone: ${race.timezone}`);
  console.log(`  Candidates: ${race.candidates.map((c) => c.name).join(', ') || 'None'}`);

  // 2. Check questionsGenerated flag
  let archivedCount = 0;

  if (race.questionsGenerated && !force) {
    // Count existing questions for this race
    const existingRows = await db
      .select({ id: questions.id, createdAt: questions.createdAt })
      .from(questions)
      .where(eq(questions.electionRaceId, raceId))
      .orderBy(desc(questions.createdAt));

    const existingCount = existingRows.length;
    const latestCreatedAt = existingRows[0]?.createdAt?.toISOString() ?? null;

    throw new GenerationBlockedError(existingCount, latestCreatedAt);
  }

  // 3. If force: archive existing questions and reset flag
  if (force && race.questionsGenerated) {
    console.log(`  Force mode: archiving existing questions...`);

    const historyEntry = {
      action: 'archived' as const,
      timestamp: new Date().toISOString(),
      previousExpiresAt: undefined,
      newExpiresAt: undefined,
    };

    const archivedRows = await db
      .update(questions)
      .set({
        status: 'archived',
        expirationHistory: sql`${questions.expirationHistory} || ${JSON.stringify([historyEntry])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(questions.electionRaceId, raceId))
      .returning({ id: questions.id });

    archivedCount = archivedRows.length;
    console.log(`  Archived ${archivedCount} existing questions.`);

    // Reset questionsGenerated flag
    await db
      .update(electionRaces)
      .set({ questionsGenerated: false })
      .where(eq(electionRaces.id, raceId));
  }

  // 4. Resolve collection + topic
  console.log(`\n  Resolving collection "${collectionSlug}"...`);
  const { collectionId, topicId } = await resolveCollectionAndTopic(collectionSlug);
  console.log(`  Collection ID: ${collectionId}, Topic ID: ${topicId}`);

  // 5. Compute expiresAt — end-of-day in the jurisdiction's local timezone.
  // electionDate is stored as UTC midnight of the intended date (e.g. 2026-11-03T00:00:00Z).
  // Use toISOString().split('T')[0] to get the date as stored, avoiding timezone shift.
  const localDateStr = race.electionDate.toISOString().split('T')[0];

  const expiresAt = getEndOfDayUTC(localDateStr, race.timezone);
  console.log(`  Expires at: ${expiresAt.toISOString()} (end of ${localDateStr} in ${race.timezone})`);

  // 6. Determine question target count
  const questionTarget = getQuestionTarget(race);
  console.log(`  Question target: ${questionTarget} (based on seat type: "${race.seat}")`);

  // 7. Build system prompt and user message
  const systemPrompt = buildElectionSystemPrompt(race, questionTarget);
  const userMessage = `Generate exactly ${questionTarget} multiple-choice civic trivia questions about the ${race.seat} race in ${race.jurisdiction}.`;

  // 8. Call Claude API
  console.log(`\n  Calling Claude API (claude-sonnet-4-6)...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const contentBlock = response.content[0];
  if (contentBlock.type !== 'text') {
    throw new Error(`Unexpected Claude response type: ${contentBlock.type}`);
  }

  const responseText = contentBlock.text.trim();

  // Parse JSON from response (handle potential markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `No JSON object found in Claude response. Preview: ${responseText.slice(0, 300)}`
    );
  }

  let parsed: { questions: Array<{
    text: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: string;
    topicCategory: string;
    source: { name: string; url: string };
  }> };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(
      `Failed to parse JSON from Claude response: ${err instanceof Error ? err.message : err}`
    );
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error(`Claude response missing "questions" array. Got: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  // Loose validation — check each question has required fields
  const parsedQuestions = parsed.questions.filter((q, idx) => {
    if (!q.text || !Array.isArray(q.options) || q.options.length < 4 || q.correctAnswer === undefined) {
      console.warn(`  Warning: Skipping malformed question at index ${idx}`);
      return false;
    }
    return true;
  });

  console.log(`  Claude generated ${parsedQuestions.length} valid questions.`);

  // 9. Dry run: log and return without inserting
  if (dryRun) {
    console.log(`\n  [DRY RUN] Questions preview:`);
    parsedQuestions.forEach((q, i) => {
      console.log(`\n  Question ${i + 1}: ${q.text}`);
      q.options.forEach((opt, j) => {
        const marker = j === q.correctAnswer ? '✓' : ' ';
        console.log(`    [${marker}] ${opt}`);
      });
      console.log(`  Explanation: ${q.explanation}`);
      console.log(`  Difficulty: ${q.difficulty} | Source: ${q.source?.name}`);
    });

    return {
      questionsCreated: parsedQuestions.length,
      archived: archivedCount,
      raceId,
      jurisdiction: race.jurisdiction,
      collectionSlug,
    };
  }

  // 10. Insert questions into DB
  console.log(`\n  Inserting ${parsedQuestions.length} questions into database...`);
  let questionsCreated = 0;

  for (let i = 0; i < parsedQuestions.length; i++) {
    const q = parsedQuestions[i];
    const seq = i + 1;
    const externalId = buildExternalId(raceId, seq, force && archivedCount > 0);

    // Write-time answer-position guard -- the output example in the prompt above says
    // correctAnswer: 0, and the model copies it. Seeded on externalId for determinism.
    const placed = placeAnswer(q.options, q.correctAnswer, externalId);

    const inserted = await db
      .insert(questions)
      .values({
        externalId,
        text: q.text,
        options: placed.options,
        correctAnswer: placed.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topicId,
        subcategory: 'election-race',
        source: q.source ?? { name: 'Unknown', url: '' },
        learningContent: null,
        expiresAt,
        status: 'draft',
        expirationHistory: [],
        electionRaceId: raceId,
      })
      .onConflictDoNothing()
      .returning({ id: questions.id });

    if (inserted.length > 0) {
      const questionId = inserted[0].id;

      // Also link to collection_questions
      await db
        .insert(collectionQuestions)
        .values({ collectionId, questionId })
        .onConflictDoNothing();

      questionsCreated++;
    } else {
      console.warn(`  Warning: Question ${seq} (${externalId}) skipped — external ID conflict.`);
    }
  }

  console.log(`  Inserted: ${questionsCreated}/${parsedQuestions.length} questions.`);

  // 11. Set questionsGenerated = true on the race
  await db
    .update(electionRaces)
    .set({ questionsGenerated: true })
    .where(eq(electionRaces.id, raceId));

  console.log(`  Set questionsGenerated = true for race ${raceId}.`);

  // 12. Return result
  return {
    questionsCreated,
    archived: archivedCount,
    raceId,
    jurisdiction: race.jurisdiction,
    collectionSlug,
  };
}

/**
 * Current Term Question Generator
 *
 * Generates post-election "Who is the current [seat]?" trivia questions after
 * an election resolves. Questions are linked to the winning official and expire
 * at the end of their term date rather than the election date.
 *
 * Called from: POST /api/admin/election-races/:id/enter-result
 */

import { client } from '../../scripts/content-generation/anthropic-client.js';
import { db } from '../../db/index.js';
import { placeAnswer } from '../questionQuality/answerPlacement.js';
import {
  questions,
  collectionQuestions,
  electionRaces,
} from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { QUALITY_GUIDELINES } from '../../scripts/content-generation/prompts/quality-guidelines.js';
import {
  getEndOfDayUTC,
  resolveCollectionAndTopic,
} from './ElectionQuestionGenerator.js';

// ─── Exported interfaces ──────────────────────────────────────────────────────

export interface CurrentTermResult {
  questionsCreated: number;
  raceId: number;
  jurisdiction: string;
  collectionSlug: string;
}

// ─── Custom error for idempotency guard ──────────────────────────────────────

export class FollowupBlockedError extends Error {
  raceId: number;

  constructor(raceId: number) {
    super(`Current-term questions already generated for race ${raceId}.`);
    this.name = 'FollowupBlockedError';
    this.raceId = raceId;
  }
}

// ─── External ID builder ──────────────────────────────────────────────────────

/**
 * Build a unique external ID for a current-term question.
 * Format: elc-term-{raceId}-{seq} (e.g., elc-term-5-001)
 */
function buildCurrentTermExternalId(raceId: number, seq: number): string {
  return `elc-term-${raceId}-${String(seq).padStart(3, '0')}`;
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildCurrentTermSystemPrompt(
  race: { seat: string; jurisdiction: string; electionType: string },
  opts: { winnerName: string; termEndDate: string }
): string {
  return `You are a civic education content creator generating trivia questions about a recently elected official.

## Office Details
- Seat: ${race.seat}
- Jurisdiction: ${race.jurisdiction}
- Winner: ${opts.winnerName}
- Term End Date: ${opts.termEndDate}
- Election Type: ${race.electionType}

## Question Types
Generate exactly 6 questions:
1. "Who is the current ${race.seat}?" — straightforward knowledge check
2. "When does ${opts.winnerName}'s term as ${race.seat} expire?" — timeline question
3-4. Two questions about the role, powers, and responsibilities of this office
5. "Who won the [year] ${race.seat} election in ${race.jurisdiction}?" — election context (historical fact)
6. One additional office-specific question (salary, term length, how many members, notable powers, etc.)

## Rules
- All questions must be factual and non-partisan
- Do NOT compare candidates or express opinions
- Distractors should be plausible: real names of other officials, real dates, real government structures
- Each question must have exactly 4 answer options

## Output Format
Return ONLY a valid JSON object:
{
  "questions": [
    {
      "text": "Question text?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation with source reference",
      "difficulty": "easy",
      "topicCategory": "current-term",
      "source": { "name": "Source Name", "url": "https://..." }
    }
  ]
}

${QUALITY_GUIDELINES}`;
}

// ─── Main export: generateCurrentTermQuestions ────────────────────────────────

/**
 * Generate current-term civic trivia questions after an election resolves.
 *
 * Steps:
 * 1. Load race from DB. Throw if not found.
 * 2. Check followupGenerated — throw FollowupBlockedError if already done.
 * 3. Resolve collection + elections-voting topic.
 * 4. Compute expiresAt = end-of-day on termEndDate in race's timezone.
 * 5. Build current-term system prompt, call Claude API.
 * 6. Parse and validate JSON response.
 * 7. Insert 6 questions with elc-term- external IDs.
 * 8. Set followupGenerated = true and result = winnerName on the race.
 * 9. Return CurrentTermResult.
 */
export async function generateCurrentTermQuestions(
  raceId: number,
  collectionSlug: string,
  opts: { winnerName: string; termEndDate: string }
): Promise<CurrentTermResult> {
  // 1. Load race from DB
  const [race] = await db
    .select()
    .from(electionRaces)
    .where(eq(electionRaces.id, raceId))
    .limit(1);

  if (!race) {
    throw new Error(`Election race not found: ID ${raceId}`);
  }

  // 2. Check followupGenerated — idempotency guard
  if (race.followupGenerated) {
    throw new FollowupBlockedError(raceId);
  }

  console.log(`\nGenerating current-term questions for: ${race.seat} — ${race.jurisdiction}`);
  console.log(`  Winner: ${opts.winnerName}`);
  console.log(`  Term end date: ${opts.termEndDate}`);

  // 3. Resolve collection + topic
  console.log(`\n  Resolving collection "${collectionSlug}"...`);
  const { collectionId, topicId } = await resolveCollectionAndTopic(collectionSlug);
  console.log(`  Collection ID: ${collectionId}, Topic ID: ${topicId}`);

  // 4. Compute expiresAt — end of term in the jurisdiction's local timezone
  const expiresAt = getEndOfDayUTC(opts.termEndDate, race.timezone);
  console.log(`  Expires at: ${expiresAt.toISOString()} (end of ${opts.termEndDate} in ${race.timezone})`);

  // 5. Build system prompt
  const systemPrompt = buildCurrentTermSystemPrompt(race, opts);
  const userMessage = `Generate 6 current-term civic trivia questions about ${opts.winnerName} as ${race.seat} in ${race.jurisdiction}.`;

  // 6. Call Claude API
  console.log(`\n  Calling Claude API (claude-sonnet-4-6)...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
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

  let parsed: {
    questions: Array<{
      text: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
      difficulty: string;
      topicCategory: string;
      source: { name: string; url: string };
    }>;
  };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(
      `Failed to parse JSON from Claude response: ${err instanceof Error ? err.message : err}`
    );
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error(
      `Claude response missing "questions" array. Got: ${JSON.stringify(parsed).slice(0, 200)}`
    );
  }

  // Validate — filter out malformed questions
  const parsedQuestions = parsed.questions.filter((q, idx) => {
    if (
      !q.text ||
      !Array.isArray(q.options) ||
      q.options.length < 4 ||
      q.correctAnswer === undefined
    ) {
      console.warn(`  Warning: Skipping malformed question at index ${idx}`);
      return false;
    }
    return true;
  });

  console.log(`  Claude generated ${parsedQuestions.length} valid questions.`);

  // 7. Insert questions into DB
  console.log(`\n  Inserting ${parsedQuestions.length} questions into database...`);
  let questionsCreated = 0;

  for (let i = 0; i < parsedQuestions.length; i++) {
    const q = parsedQuestions[i];
    const seq = i + 1;
    const externalId = buildCurrentTermExternalId(raceId, seq);

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
        subcategory: 'current-term',
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

      // Link to collection_questions
      await db
        .insert(collectionQuestions)
        .values({ collectionId, questionId })
        .onConflictDoNothing();

      questionsCreated++;
    } else {
      console.warn(
        `  Warning: Question ${seq} (${externalId}) skipped — external ID conflict.`
      );
    }
  }

  console.log(`  Inserted: ${questionsCreated}/${parsedQuestions.length} questions.`);

  // 8. Update race: set followupGenerated = true and result = winnerName
  await db
    .update(electionRaces)
    .set({
      followupGenerated: true,
      result: opts.winnerName,
    })
    .where(eq(electionRaces.id, raceId));

  console.log(`  Set followupGenerated = true, result = "${opts.winnerName}" for race ${raceId}.`);

  // 9. Return result
  return {
    questionsCreated,
    raceId,
    jurisdiction: race.jurisdiction,
    collectionSlug,
  };
}

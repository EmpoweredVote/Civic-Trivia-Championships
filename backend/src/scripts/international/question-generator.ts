import { client, MODEL } from '../../scripts/content-generation/anthropic-client.js';
import type { ClaimResult } from './claim-extractor.js';
import { mintExternalId, mintForConfig, nextSequence } from '../content-generation/externalIdentity.js';

// ─── Volatility Types & Helpers ───────────────────────────────────────────────

export type Volatility = 'fast' | 'medium' | 'slow' | 'stable';

/**
 * Compute expiresAt for a new international question based on its volatility tier.
 * fast = 4 days (midpoint 3-5), medium = 10 days (midpoint 7-14),
 * slow = 60 days, stable = 180 days.
 */
export function computeExpiresAt(volatility: Volatility): Date {
  const now = new Date();
  const days: Record<Volatility, number> = {
    fast: 4,
    medium: 10,
    slow: 60,
    stable: 180,
  };
  const ms = days[volatility] * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  qualityGate: { passed: boolean; reason: string };
}

export interface QuestionWriteResult {
  questionId: number;
  externalId: string;
  status: 'active';
}

// ─── Claude Call 2: Question Generation ──────────────────────────────────────

const QUESTION_GENERATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    questions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          text: { type: 'string' as const },
          options: {
            type: 'array' as const,
            items: { type: 'string' as const },
          },
          correctAnswer: { type: 'integer' as const },
          explanation: { type: 'string' as const },
          difficulty: {
            type: 'string' as const,
            enum: ['easy', 'medium', 'hard'],
          },
          quality_gate: {
            type: 'object' as const,
            properties: {
              passed: { type: 'boolean' as const },
              reason: { type: 'string' as const },
            },
            required: ['passed', 'reason'] as string[],
            additionalProperties: false,
          },
        },
        required: ['text', 'options', 'correctAnswer', 'explanation', 'difficulty', 'quality_gate'] as string[],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'] as string[],
  additionalProperties: false,
};

const QUESTION_GENERATION_SYSTEM_PROMPT = `You are a civic trivia question writer. Given a verified factual claim from international news, generate 1-3 multiple-choice questions suitable for a trivia game.

Question composition rules:
- Target ~15% of questions involving concrete numbers: budgets, percentages, dates, quantities
- Prefer verifiable, non-disputed facts over characterizations or contested interpretations
- Preferred style: "Iran's annual military budget in 2025 was...?", "The US allocates what percentage of its budget to...?"
- Avoid questions requiring inference about motive, blame, or prediction
- Each question must have exactly 4 answer options; only one is correct
- Explanations: 1-2 sentences citing the factual basis

Quality gate — assess EACH question against ALL four blocking checks:
1. Partisan framing: assigns blame, takes sides on disputed political questions
2. Logical fallacies: false dilemma, straw man, false cause in question or options
3. Manipulative framing: leading questions, loaded language, emotionally charged phrasing
4. Unverifiability: correct answer requires knowing private intent or predicting future

Set quality_gate.passed = true ONLY if the question passes ALL four checks.
Set quality_gate.passed = false if ANY check fails; include in reason which check failed.

Generate 1 question for straightforward claims. Generate 2-3 for rich multi-faceted stories.`;

/**
 * Claude Call 2: Generate MCQ questions from a verified claim.
 * Returns ALL questions (passing and failing) so caller can count stats.
 * Failing questions are logged but NOT written to DB.
 */
export async function generateQuestions(claim: ClaimResult): Promise<GeneratedQuestion[]> {
  // Build source article list for user message
  const sourceLines = claim.sourceArticles
    .map(a => `- ${a.title} (${a.feedName}, ${a.pubDate.toDateString()})`)
    .join('\n');

  const userMessage =
    `Claim: ${claim.claim}\n` +
    `Fact snapshot: ${claim.factSnapshot}\n` +
    `Confidence: ${claim.confidenceTier}\n\n` +
    `Source articles:\n${sourceLines}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: QUESTION_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_config: { format: { type: 'json_schema', schema: QUESTION_GENERATION_SCHEMA } } as any,
    });

    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      console.error(
        `[QuestionGenerator] Unexpected response type: ${contentBlock.type} for claim: "${claim.claim.slice(0, 60)}"`,
      );
      return [];
    }

    // Guaranteed valid JSON when using structured output
    const parsed = JSON.parse(contentBlock.text) as {
      questions: Array<{
        text: string;
        options: string[];
        correctAnswer: number;
        explanation: string;
        difficulty: 'easy' | 'medium' | 'hard';
        quality_gate: { passed: boolean; reason: string };
      }>;
    };

    const questions: GeneratedQuestion[] = parsed.questions.map(q => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      qualityGate: { passed: q.quality_gate.passed, reason: q.quality_gate.reason },
    }));

    // Log blocked questions
    for (const q of questions) {
      if (!q.qualityGate.passed) {
        console.log(
          `[QualityGate] BLOCKED: "${q.text.slice(0, 60)}" — ${q.qualityGate.reason}`,
        );
      }
    }

    return questions;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[QuestionGenerator] Error generating questions for claim "${claim.claim.slice(0, 60)}": ${errorMsg}`,
    );
    return [];
  }
}

// ─── DB Write: Passing Questions Only ────────────────────────────────────────

/**
 * Write passing questions to the database as active, with collection_questions rows.
 *
 * Only questions where qualityGate.passed === true are written.
 * Questions failing the quality gate are never created in the DB.
 */
export async function writePassingQuestions(
  questions: GeneratedQuestion[],
  claim: ClaimResult,
  collectionId: number,
  jobId: number,
  externalIdPrefix: string | undefined,
  volatility: Volatility,
): Promise<QuestionWriteResult[]> {
  const passingQuestions = questions.filter(q => q.qualityGate.passed);
  if (passingQuestions.length === 0) return [];

  // Lazy DB imports (ESM pattern — consistent with replacementGenerator.ts)
  const { db } = await import('../../db/index.js');
  const { questions: questionsTable, collectionQuestions, topics, collections } = await import('../../db/schema.js');
  const { eq, sql } = await import('drizzle-orm');

  // ── Resolve/create "world-news" topic ──────────────────────────────────────
  const WORLD_NEWS_SLUG = 'world-news';
  const WORLD_NEWS_NAME = 'World News';

  let topicId: number;
  const existingTopic = await db
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.slug, WORLD_NEWS_SLUG))
    .limit(1);

  if (existingTopic.length > 0) {
    topicId = existingTopic[0].id;
  } else {
    const [newTopic] = await db
      .insert(topics)
      .values({
        name: WORLD_NEWS_NAME,
        slug: WORLD_NEWS_SLUG,
        description: 'International news and world affairs',
      })
      .returning({ id: topics.id });
    topicId = newTopic.id;
    console.log(`[QuestionGenerator] Created topic: ${WORLD_NEWS_NAME} (id=${topicId})`);
  }

  // ── Get current max external ID for this collection ────────────────────────
  // Scoped by collectionId via the join. The prefix LIKE that used to sit here
  // was redundant on top of correct scoping. '[0-9]+$' is anchored deliberately
  // — unanchored, it takes the FIRST digit run, which is wrong for a slug id.
  const maxIdResult = await db
    .select({
      maxId: sql<string>`MAX(SUBSTRING(${questionsTable.externalId} FROM '[0-9]+$')::int)`,
    })
    .from(questionsTable)
    .innerJoin(collectionQuestions, eq(questionsTable.id, collectionQuestions.questionId))
    .where(eq(collectionQuestions.collectionId, collectionId));

  let nextIdNum = nextSequence(maxIdResult[0]?.maxId);

  // A legacy collection has an externalIdPrefix and keeps minting its old
  // `prefix-NNNN` shape. A new-scheme collection has none — resolve its slug
  // from collectionId and mint `slug_NNNN` via mintExternalId.
  let collectionSlugForMint: string | undefined;
  if (!externalIdPrefix) {
    const [col] = await db
      .select({ slug: collections.slug })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1);
    collectionSlugForMint = col?.slug;
    if (!collectionSlugForMint) {
      throw new Error(
        `Cannot mint external id for collection ${collectionId}: no externalIdPrefix and no resolvable slug.`,
      );
    }
  }

  // ── Insert each passing question ────────────────────────────────────────────
  const results: QuestionWriteResult[] = [];
  const primarySource = claim.sourceArticles[0];

  for (const q of passingQuestions) {
    // FOUR-digit legacy width here, unlike the three-digit generators — it
    // matches ids already in the DB. The width is the third argument, not a
    // convention; see mintForConfig.
    const externalId = mintForConfig(
      { externalIdPrefix, collectionSlug: collectionSlugForMint! },
      nextIdNum,
      4,
    );
    nextIdNum++;

    const inserted = await db
      .insert(questionsTable)
      .values({
        externalId,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topicId,
        subcategory: WORLD_NEWS_SLUG,
        source: {
          name: primarySource.feedName,
          url: primarySource.url,
        },
        learningContent: null,
        expiresAt: computeExpiresAt(volatility),
        status: 'active' as const,
        expirationHistory: [],
        factSnapshot: claim.factSnapshot,
        confidenceTier: claim.confidenceTier,
        generationJobId: jobId,
        volatility,
      })
      .onConflictDoNothing()
      .returning({ id: questionsTable.id });

    if (!inserted || inserted.length === 0) {
      console.warn(
        `[QuestionGenerator] Skipped (external_id conflict): ${externalId}`,
      );
      continue;
    }

    const questionId = inserted[0].id;

    // Insert collection_questions row (required for game visibility)
    await db
      .insert(collectionQuestions)
      .values({ collectionId, questionId })
      .onConflictDoNothing();

    console.log(
      `[QuestionGenerator] Created: ${externalId} — "${q.text.slice(0, 60)}"`,
    );

    results.push({ questionId, externalId, status: 'active' });
  }

  return results;
}

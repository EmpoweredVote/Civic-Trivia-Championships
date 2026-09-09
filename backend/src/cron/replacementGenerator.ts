/**
 * Replacement Question Generator
 *
 * Generates a single replacement question for an archived expired question.
 * Called by the expiration sweep (Plan 02) after each archival.
 *
 * Design principle: never throws to the caller — all errors are returned as
 * { replaced: false, reason } to keep the cron loop clean.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import type { LocaleConfig } from '../scripts/content-generation/locale-configs/bloomington-in.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Exported types ───────────────────────────────────────────────────────────

export type ReplacementResult =
  | { replaced: true }
  | { replaced: false; reason: string };

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Generate a single replacement question for an archived expired question.
 *
 * Returns a result object — never throws to the caller.
 *
 * @param archivedQuestionId  DB id of the archived question (for logging)
 * @param archivedExternalId  externalId of the archived question (for logging)
 * @param topic               subcategory slug — may be null for old questions
 * @param collectionSlug      slug of the collection (e.g. "bloomington-in")
 * @param collectionId        DB id of the collection
 */
export async function generateReplacement(
  archivedQuestionId: number,
  archivedExternalId: string,
  topic: string | null,
  collectionSlug: string,
  collectionId: number,
): Promise<ReplacementResult> {
  try {
    // 1. Null topic guard — some old questions have null subcategory
    if (topic === null) {
      return { replaced: false, reason: 'no-topic' };
    }

    // Guard: skip replacement generation for international collections
    // International questions are managed by the RSS pipeline, not expiration replacement
    const { db: dbForTier } = await import('../db/index.js');
    const { collections } = await import('../db/schema.js');
    const { eq: eqForTier } = await import('drizzle-orm');
    const collectionRows = await dbForTier
      .select({ tier: collections.tier })
      .from(collections)
      .where(eqForTier(collections.id, collectionId))
      .limit(1);
    if (collectionRows[0]?.tier === 'international') {
      return { replaced: false, reason: 'international-collection-no-replacement' };
    }

    // 2. Load locale config — returns null if no config file exists
    const config = await tryLoadLocaleConfig(collectionSlug);
    if (config === null) {
      return { replaced: false, reason: 'no-locale-config' };
    }

    // Static imports for lightweight modules
    const { client, MODEL } = await import('../scripts/content-generation/anthropic-client.js');
    const { buildSystemPrompt } = await import('../scripts/content-generation/prompts/system-prompt.js');
    const { QuestionSchema } = await import('../scripts/content-generation/question-schema.js');
    const { auditQuestion } = await import('../services/qualityRules/index.js');

    // Helper to call Anthropic and get raw parsed JSON
    async function callAnthropicForOne(): Promise<unknown> {
      const systemPrompt = buildSystemPrompt(
        config!.name,
        { [topic!]: 1 },
        config!.collectionSlug,
        config!.officeholders,
      );

      const userMessage =
        `Generate exactly 1 civic trivia question in the '${topic}' topic for ${config!.name}. ` +
        `Return JSON with a single 'questions' array containing 1 question. ` +
        `Use the externalId prefix '${config!.externalIdPrefix}'.`;

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error(`Unexpected Anthropic response content type: ${contentBlock.type}`);
      }

      const responseText = contentBlock.text.trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found in Anthropic response preview: ${responseText.slice(0, 200)}`);
      }

      return JSON.parse(jsonMatch[0]);
    }

    // 3 & 4. Generate and parse with QuestionSchema (NOT BatchSchema)
    let parsedQuestion: ReturnType<typeof QuestionSchema.parse>;
    let attempt = 0;

    while (true) {
      attempt++;
      let rawResponse: unknown;

      try {
        rawResponse = await callAnthropicForOne();
      } catch (genErr) {
        if (attempt < 2) continue; // retry once on generation failure
        throw genErr;
      }

      // The AI returns { questions: [...] } — extract first element
      const rawQ = (rawResponse as { questions?: unknown[] })?.questions?.[0] ?? rawResponse;

      try {
        parsedQuestion = QuestionSchema.parse(rawQ);
        break; // parse succeeded
      } catch {
        if (attempt >= 2) {
          return { replaced: false, reason: 'parse-error' };
        }
        // retry once
      }
    }

    // 5. Run quality rules — check blocking violations only, skip URL check (advisory ok)
    const auditResult = await auditQuestion(parsedQuestion, { skipUrlCheck: true });
    if (auditResult.hasBlockingViolations) {
      const violationMessages = auditResult.violations
        .filter(v => v.severity === 'blocking')
        .map(v => v.message);
      return { replaced: false, reason: 'quality-fail: ' + violationMessages.join(', ') };
    }

    // 6. Allocate externalId — queries ALL statuses to avoid collision with archived IDs
    const nextId = await getNextExternalId(collectionId, config.externalIdPrefix);
    parsedQuestion.externalId =
      config.externalIdPrefix + '-' + String(nextId).padStart(3, '0');

    // 7. Semantic dedup — guarded by OPENAI_API_KEY
    if (process.env.OPENAI_API_KEY) {
      const { OpenAIEmbeddingService } = await import('../services/embeddings/OpenAIEmbeddingService.js');
      const { SemanticDupDetector } = await import('../services/embeddings/SemanticDupDetector.js');
      const { db } = await import('../db/index.js');
      const { questions: questionsTable, collectionQuestions: collectionQuestionsTable } = await import('../db/schema.js');
      const { eq, and } = await import('drizzle-orm');

      const embeddingService = new OpenAIEmbeddingService({ apiKey: process.env.OPENAI_API_KEY });

      // Query ACTIVE questions only — the just-archived question is excluded
      const activeQuestions = await db
        .select({
          id: questionsTable.id,
          externalId: questionsTable.externalId,
          text: questionsTable.text,
          options: questionsTable.options,
          correctAnswer: questionsTable.correctAnswer,
        })
        .from(questionsTable)
        .innerJoin(
          collectionQuestionsTable,
          eq(questionsTable.id, collectionQuestionsTable.questionId),
        )
        .where(
          and(
            eq(collectionQuestionsTable.collectionId, collectionId),
            eq(questionsTable.status, 'active'),
          ),
        );

      // Embed replacement question
      const replacementText = SemanticDupDetector.prepareTextForEmbedding({
        externalId: parsedQuestion.externalId,
        text: parsedQuestion.text,
        options: parsedQuestion.options,
        correctAnswer: parsedQuestion.correctAnswer,
        collections: [collectionSlug],
        qualityScore: null,
      });
      const replacementEmbedding = await embeddingService.embed(replacementText);

      // Check cosine similarity against all active questions
      let nearDupFound = false;
      for (const aq of activeQuestions) {
        const aqText = SemanticDupDetector.prepareTextForEmbedding({
          externalId: aq.externalId,
          text: aq.text,
          options: aq.options as string[],
          correctAnswer: aq.correctAnswer,
          collections: [collectionSlug],
          qualityScore: null,
        });
        const aqEmbedding = await embeddingService.embed(aqText);
        const similarity = SemanticDupDetector.cosineSimilarity(replacementEmbedding, aqEmbedding);
        if (similarity > 0.85) {
          nearDupFound = true;
          break;
        }
      }

      embeddingService.saveCache();

      if (nearDupFound) {
        // Retry generation once on near-dup
        if (attempt < 2) {
          // regenerate
          attempt++;
          let rawResponse2: unknown;
          try {
            rawResponse2 = await callAnthropicForOne();
          } catch {
            return { replaced: false, reason: 'near-duplicate' };
          }
          const rawQ2 = (rawResponse2 as { questions?: unknown[] })?.questions?.[0] ?? rawResponse2;
          try {
            parsedQuestion = QuestionSchema.parse(rawQ2);
          } catch {
            return { replaced: false, reason: 'near-duplicate' };
          }
          // Reallocate externalId for the retried question
          parsedQuestion.externalId =
            config.externalIdPrefix + '-' + String(nextId).padStart(3, '0');
        } else {
          return { replaced: false, reason: 'near-duplicate' };
        }
      }
    } else {
      console.log(JSON.stringify({
        level: 'warn',
        job: 'replacement-generator',
        message: 'OPENAI_API_KEY not set — skipping semantic dedup for replacement',
        archivedExternalId,
        collectionSlug,
      }));
    }

    // 8. Resolve topicId from topics table
    const { db: db2 } = await import('../db/index.js');
    const { topics } = await import('../db/schema.js');
    const { eq: eq2 } = await import('drizzle-orm');

    const topicRows = await db2
      .select({ id: topics.id })
      .from(topics)
      .where(eq2(topics.slug, topic))
      .limit(1);

    if (topicRows.length === 0) {
      return { replaced: false, reason: 'topic-not-found' };
    }
    const topicId = topicRows[0].id;

    // 9. Seed as active — direct insert, NOT seedQuestionBatch (which hardcodes 'draft')
    const { db: db3 } = await import('../db/index.js');
    const { questions: questionsTable2, collectionQuestions: collectionQuestionsTable2 } = await import('../db/schema.js');

    // Same write-time answer-position guard the content scripts use.
    const { placeAnswer } = await import('../services/questionQuality/answerPlacement.js');
    const placedReplacement = placeAnswer(
      parsedQuestion.options,
      parsedQuestion.correctAnswer,
      parsedQuestion.externalId
    );

    const newQuestion = {
      externalId: parsedQuestion.externalId,
      text: parsedQuestion.text,
      options: placedReplacement.options,
      correctAnswer: placedReplacement.correctAnswer,
      explanation: parsedQuestion.explanation,
      difficulty: parsedQuestion.difficulty,
      topicId,
      subcategory: topic,
      source: parsedQuestion.source,
      learningContent: null,
      expiresAt: parsedQuestion.expiresAt ? new Date(parsedQuestion.expiresAt) : null,
      status: 'active' as const,
      expirationHistory: [],
    };

    const inserted = await db3
      .insert(questionsTable2)
      .values(newQuestion)
      .onConflictDoNothing()
      .returning({ id: questionsTable2.id });

    if (!inserted || inserted.length === 0) {
      return { replaced: false, reason: 'external-id-conflict' };
    }

    const newQuestionId = inserted[0].id;

    await db3
      .insert(collectionQuestionsTable2)
      .values({ collectionId, questionId: newQuestionId })
      .onConflictDoNothing();

    console.log(JSON.stringify({
      level: 'info',
      job: 'replacement-generator',
      message: 'Replacement question seeded',
      archivedQuestionId,
      archivedExternalId,
      newExternalId: parsedQuestion.externalId,
      collectionSlug,
      topic,
    }));

    // 10. Success
    return { replaced: true };

  } catch (err) {
    return {
      replaced: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Internal: tryLoadLocaleConfig ───────────────────────────────────────────

/**
 * Try to load a locale config from the content-generation locale-configs directory.
 * Uses absolute paths from the cron file's location to avoid relative-import fragility.
 * Returns null if no config found — does not throw.
 */
async function tryLoadLocaleConfig(slug: string): Promise<LocaleConfig | null> {
  const configBase = resolve(
    __dirname,
    '..',
    'scripts',
    'content-generation',
    'locale-configs',
  );

  const paths = [
    resolve(configBase, `${slug}.js`),
    resolve(configBase, 'state-configs', `${slug}.js`),
  ];

  for (const configPath of paths) {
    try {
      const mod = await import(configPath);
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

// ─── Internal: getNextExternalId ─────────────────────────────────────────────

/**
 * Allocate next externalId number for a collection prefix.
 * Queries ALL question statuses (active, expired, archived) to avoid collision
 * with archived externalIds that are still in DB with a UNIQUE constraint.
 */
async function getNextExternalId(collectionId: number, prefix: string): Promise<number> {
  const { db } = await import('../db/index.js');
  const { questions, collectionQuestions } = await import('../db/schema.js');
  const { eq, and, sql } = await import('drizzle-orm');

  const result = await db
    .select({
      maxId: sql<string>`MAX(SUBSTRING(${questions.externalId} FROM '[0-9]+')::int)`,
    })
    .from(questions)
    .innerJoin(collectionQuestions, eq(questions.id, collectionQuestions.questionId))
    .where(
      and(
        eq(collectionQuestions.collectionId, collectionId),
        sql`${questions.externalId} LIKE ${prefix + '-%'}`,
      ),
    );

  const maxId = result[0]?.maxId ? parseInt(result[0].maxId, 10) : 0;
  return maxId + 1;
}

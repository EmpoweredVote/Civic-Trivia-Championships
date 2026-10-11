/**
 * generate-biloxi-officeholder-questions.ts
 *
 * Targeted generation pass for Biloxi, MS current-officeholder questions.
 * Generates ~14 questions specifically about current elected officials,
 * seeds them as draft with expiresAt pre-set, to satisfy the 15% expiring ratio.
 *
 * DO NOT RE-RUN AS WRITTEN. The ward-by-ward prompt below produces exactly the
 * seven-ward ROLL-CALL that was ruled out of the bank on 2026-09-29 and removed
 * from this collection — a repeated stem whose only varying token is a slot index.
 * biloxi-ms is a DOCUMENTED breach of the expiring floor at 9.2% precisely because
 * that roll-call is not allowed to carry the ratio. Rebuild around distinct OFFICES
 * (the madison-wi model) if this collection is revisited.
 *
 * Current officeholders (all expire 2029-06-01):
 *   Mayor: Andrew "FoFo" Gilich, Jr. (3rd term, re-elected June 2025)
 *   Ward 1: Wayne Gray
 *   Ward 2: Anthony Marshall
 *   Ward 3: Mike Nail
 *   Ward 4: Jamie Creel
 *   Ward 5: Paul Tisdale
 *   Ward 6: Kenny Glavan
 *   Ward 7: David Shoemaker
 *
 * Usage:
 *   cd backend
 *   npx tsx src/scripts/content-generation/generate-biloxi-officeholder-questions.ts [--dry-run]
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { questions, collections, collectionQuestions, topics } from '../../db/schema.js';
import { eq, and, like, inArray } from 'drizzle-orm';
import { DuplicateDetector } from '../../services/qualityRules/rules/duplicate.js';
import { ATTRIBUTION_OPENER } from './question-schema.js';

const DRY_RUN = process.argv.includes('--dry-run');

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';

// ─── Expiration date ───────────────────────────────────────────────────────────

const EXPIRES_AT = '2029-06-01T00:00:00+00:00';

// ─── Schema ───────────────────────────────────────────────────────────────────

const OfficeholderQuestionSchema = z.object({
  externalId: z.string().regex(/^bxl-4\d{2}$/, 'externalId must match bxl-4XX'),
  text: z.string().min(10).max(300),
  options: z.array(z.string().min(1).max(200)).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(20).max(500).refine(
    v => !ATTRIBUTION_OPENER.test(v),
    'Explanation must not open with an attribution phrase — attribution lives in source.url',
  ),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topicCategory: z.string().min(1),
  source: z.object({ name: z.string().min(1), url: z.string().url() }),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
});

const OfficeholderBatchSchema = z.object({
  questions: z.array(OfficeholderQuestionSchema).min(10).max(20),
});

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert civic trivia question writer specializing in Biloxi, Mississippi local government.

You will generate exactly 14 civic trivia questions specifically about CURRENT ELECTED OFFICIALS in Biloxi, MS.

CRITICAL ACCURACY RULES:
- Biloxi operates under a Strong Mayor-Council form of government (adopted 1978, effective 1981)
- Current Mayor: Andrew "FoFo" Gilich, Jr. (serving his 3rd term; re-elected June 3, 2025; term expires June 2029)
- Biloxi has a 7-member City Council — one council member per ward (7 wards total)
- Current council members (all elected June 2025, all terms expire June 2029):
  - Ward 1: Wayne Gray
  - Ward 2: Anthony Marshall
  - Ward 3: Mike Nail
  - Ward 4: Jamie Creel
  - Ward 5: Paul Tisdale
  - Ward 6: Kenny Glavan
  - Ward 7: David Shoemaker
- Biloxi is in Harrison County; the county seat is GULFPORT, NOT Biloxi
- Do NOT confuse Biloxi city government with Harrison County government

QUESTION REQUIREMENTS:
- Write questions in present tense: "Who is the current mayor of Biloxi?", "Who represents Ward 3?", etc.
- Do NOT include the year in the question text (no "As of 2026..." phrases)
- Each question must be factually distinct — cover different officials and roles
- Mix easy/medium/hard difficulty
- All officeholder questions must use topicCategory: "city-government"
- ALL questions MUST have expiresAt: "${EXPIRES_AT}" (ALL of these questions expire when the term ends in June 2029)
- Use externalId format bxl-4XX (e.g., bxl-401, bxl-402, ...) to avoid conflicts with existing bxl-001 to bxl-399 questions
- Source: use { name: "City of Biloxi", url: "https://www.biloxi.ms.us" } for all city government questions
- Explanations must NOT start with "According to" or any attribution phrase — start with
  the fact. The source goes in the source field (ruled 2026-09-29)

FORBIDDEN:
- Questions about county or state government (that's a different collection)
- Questions calling Biloxi the county seat of Harrison County (Gulfport is the county seat)
- Any question where expiresAt is null`;

const USER_PROMPT = `Generate exactly 14 civic trivia questions about current Biloxi, MS elected officials.

Cover these officials across the 14 questions:
1. Mayor Andrew "FoFo" Gilich, Jr. (4 questions: who he is, which term, when re-elected, strong-mayor form)
2. Ward 1 Wayne Gray (1 question)
3. Ward 2 Anthony Marshall (1 question)
4. Ward 3 Mike Nail (1 question)
5. Ward 4 Jamie Creel (1 question)
6. Ward 5 Paul Tisdale (1 question)
7. Ward 6 Kenny Glavan (1 question)
8. Ward 7 David Shoemaker (1 question)
9. City Council structure (2 questions: total number of council members, strong-mayor form of government)

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "externalId": "bxl-401",
      "text": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "A sentence or two teaching the fact, with no attribution opener",
      "difficulty": "easy",
      "topicCategory": "city-government",
      "source": { "name": "City of Biloxi", "url": "https://www.biloxi.ms.us" },
      "expiresAt": "${EXPIRES_AT}"
    },
    ...
  ]
}`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? 'DRY RUN -- no changes will be written\n' : 'LIVE RUN -- seeding to database\n');

  // ── Generate questions ──
  console.log('Calling Claude for Biloxi officeholder questions...');
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: USER_PROMPT }],
    system: SYSTEM_PROMPT,
  });

  const raw = response.content[0];
  if (raw.type !== 'text') throw new Error('Unexpected response type from Claude');

  // Extract JSON from response
  const jsonMatch = raw.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');

  // Parse and validate
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Raw response:', raw.text.substring(0, 500));
    throw new Error('Failed to parse JSON from Claude response');
  }

  const validated = OfficeholderBatchSchema.safeParse(parsed);
  if (!validated.success) {
    console.error('Validation errors:', JSON.stringify(validated.error.issues, null, 2));
    console.error('Raw questions:', JSON.stringify(parsed, null, 2));
    throw new Error('Question batch failed validation');
  }

  const batch = validated.data.questions;
  console.log(`\nGenerated ${batch.length} questions:\n`);
  for (const q of batch) {
    console.log(`  ${q.externalId} [${q.difficulty}] expires:${q.expiresAt?.split('T')[0] ?? 'null'} -- ${q.text.substring(0, 80)}`);
  }

  const expiringCount = batch.filter(q => q.expiresAt !== null).length;
  console.log(`\nExpiring: ${expiringCount}/${batch.length}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN complete -- no database changes.');
    process.exit(0);
  }

  // ── Seed to database ──
  console.log('\nSeeding to database...');

  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, 'biloxi-ms'))
    .limit(1);

  if (!collection) throw new Error('biloxi-ms collection not found -- run db:seed first');

  // Get the city-government topic ID
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.slug, 'city-government'))
    .limit(1);

  if (!topic) throw new Error('city-government topic not found -- run the main generator first to create topics');

  const topicIdMap: Record<string, number> = {
    'city-government': topic.id,
  };

  // Load existing questions for duplicate detection
  const existingLinks = await db
    .select({ questionId: collectionQuestions.questionId })
    .from(collectionQuestions)
    .where(eq(collectionQuestions.collectionId, collection.id));

  const detector = new DuplicateDetector();
  if (existingLinks.length > 0) {
    const existingQs = await db
      .select({ externalId: questions.externalId, text: questions.text })
      .from(questions)
      .where(
        and(
          inArray(questions.id, existingLinks.map(l => l.questionId)),
          inArray(questions.status, ['active', 'draft'])
        )
      );
    detector.loadExisting(existingQs);
    console.log(`Loaded ${existingQs.length} existing questions for duplicate detection`);
  }

  let seeded = 0;
  let skipped = 0;

  for (const q of batch) {
    const dupResult = detector.check(q);
    if (!dupResult.passed) {
      console.warn(`  Skipped (duplicate): ${q.externalId} -- ${dupResult.violations[0].message}`);
      skipped++;
      continue;
    }

    const inserted = await db
      .insert(questions)
      .values({
        externalId: q.externalId,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topicId: topicIdMap[q.topicCategory],
        subcategory: q.topicCategory,
        source: q.source,
        learningContent: null,
        expiresAt: q.expiresAt ? new Date(q.expiresAt) : null,
        status: 'draft' as const,
        expirationHistory: [],
      })
      .onConflictDoNothing()
      .returning({ id: questions.id });

    if (!inserted || inserted.length === 0) {
      console.log(`  Skipped (duplicate externalId): ${q.externalId}`);
      skipped++;
      continue;
    }

    await db.insert(collectionQuestions)
      .values({ collectionId: collection.id, questionId: inserted[0].id })
      .onConflictDoNothing();

    detector.add(q);
    console.log(`  Seeded: ${q.externalId} -- ${q.text.substring(0, 70)}`);
    seeded++;
  }

  console.log(`\nDone -- seeded: ${seeded}, skipped: ${skipped}`);

  // Final ratio check
  const allDraft = await db
    .select({ expiresAt: questions.expiresAt })
    .from(questions)
    .where(and(like(questions.externalId, 'bxl-%'), eq(questions.status, 'draft')));

  const withExpiry = allDraft.filter(q => q.expiresAt !== null).length;
  const ratio = ((withExpiry / allDraft.length) * 100).toFixed(1);
  console.log(`\nUpdated expiring ratio: ${withExpiry}/${allDraft.length} = ${ratio}%`);
  if (parseFloat(ratio) >= 15) {
    console.log('Ratio meets 15% target');
  } else {
    console.log('Still below 15% -- consider another targeted pass');
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

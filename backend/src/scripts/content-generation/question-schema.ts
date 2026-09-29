import { z } from 'zod';
import {
  NEW_EXTERNAL_ID_RE,
  LEGACY_EXTERNAL_ID_RE,
  FEDERAL_EXTERNAL_ID_RE,
} from './externalIdentity.js';

/**
 * Zod schema for validating AI-generated civic trivia questions.
 * Mirrors the database questions table structure from src/db/schema.ts.
 */
export const QuestionSchema = z.object({
  // External ID: either scheme.
  //   new     <collection-slug>_<NNNN>   e.g. "akron-oh_0001"
  //   legacy  <prefix>-<NNN|NNNN>        e.g. "bli-001", "wiran-1761"
  //   federal q<NNN>                     e.g. "q001" (no separator, predates every prefix scheme)
  // Widened from /^[a-z]{2,5}-\d{3}$/ on 2026-09-29: that pattern rejected
  // 3,501 rows the nightly news pipeline had already written.
  externalId: z
    .string()
    .refine(
      (v) =>
        NEW_EXTERNAL_ID_RE.test(v) ||
        LEGACY_EXTERNAL_ID_RE.test(v) ||
        FEDERAL_EXTERNAL_ID_RE.test(v),
      'externalId must look like "akron-oh_0001" (new), "bli-001" (legacy), or "q001" (federal)'
    ),

  // Question text
  text: z
    .string()
    .min(10, 'Question text must be at least 10 characters')
    .max(300, 'Question text must be at most 300 characters'),

  // Exactly 4 answer options
  options: z
    .array(
      z
        .string()
        .min(1, 'Option must not be empty')
        .max(200, 'Option must be at most 200 characters')
    )
    .length(4, 'Must have exactly 4 answer options'),

  // 0-based index of correct answer
  correctAnswer: z
    .number()
    .int()
    .min(0, 'correctAnswer must be 0-3')
    .max(3, 'correctAnswer must be 0-3'),

  // Explanation. Attribution lives in source.url, NOT in the prose — the
  // "According to ..." opener was stripped bank-wide on 2026-09-29 (1,978 -> 0),
  // and this refine would have made the generator write it straight back.
  explanation: z
    .string()
    .min(20, 'Explanation must be at least 20 characters')
    .max(500, 'Explanation must be at most 500 characters'),

  // Difficulty level matching federal questions
  difficulty: z.enum(['easy', 'medium', 'hard']),

  // Locale-specific topic slug (e.g., "city-government", "civic-history")
  topicCategory: z.string().min(1, 'topicCategory must not be empty'),

  // Authoritative source for the question
  source: z.object({
    name: z.string().min(1, 'Source name must not be empty'),
    url: z.string().url('Source URL must be a valid URL'),
  }),

  // ISO 8601 datetime or null (for elected official questions, set to term end date)
  expiresAt: z.string().datetime({ offset: true }).nullable(),
});

/**
 * Schema for a batch of questions returned by the AI.
 * Expects 15-30 questions per batch.
 */
export const BatchSchema = z.object({
  questions: z
    .array(QuestionSchema)
    .min(15, 'Batch must contain at least 15 questions')
    .max(30, 'Batch must contain at most 30 questions'),
});

// Inferred TypeScript types
export type ValidatedQuestion = z.infer<typeof QuestionSchema>;
export type ValidatedBatch = z.infer<typeof BatchSchema>;

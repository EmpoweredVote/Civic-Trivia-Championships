import { z } from 'zod';

/**
 * Zod schema for validating AI-generated civic trivia questions.
 * Mirrors the database questions table structure from src/db/schema.ts.
 */
export const QuestionSchema = z.object({
  // External ID: locale-prefix + 3-digit number (e.g., "bli-001", "lac-001")
  externalId: z
    .string()
    .regex(
      /^[a-z]{2,4}-\d{3}$/,
      'externalId must match pattern like "bli-001" or "lac-001"'
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

  // Explanation citing the source using "According to..." pattern
  explanation: z
    .string()
    .min(20, 'Explanation must be at least 20 characters')
    .max(500, 'Explanation must be at most 500 characters')
    .refine(
      (val) => val.includes('According to'),
      'Explanation must include "According to" citation'
    ),

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

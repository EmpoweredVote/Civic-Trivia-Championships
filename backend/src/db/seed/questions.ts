import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { NewQuestion } from '../schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load questions and sources data
const questionsData = JSON.parse(
  readFileSync(join(__dirname, '../../data/questions.json'), 'utf-8')
);

const sourcesData = JSON.parse(
  readFileSync(join(__dirname, './sources.json'), 'utf-8')
);

interface QuestionJSON {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  topicCategory?: string;
  learningContent?: {
    topic?: string;
    paragraphs?: string[];
    corrections?: Record<string, string>;
    source?: {
      name: string;
      url: string;
    };
  };
}

/**
 * Transform JSON questions to database insert format
 * @param topicIdMap - Mapping of topic slugs to database IDs
 * @returns Array of question insert objects
 */
export function getQuestionInserts(topicIdMap: Record<string, number>): NewQuestion[] {
  return (questionsData as QuestionJSON[]).map((q) => {
    const source = sourcesData[q.id];

    if (!source) {
      throw new Error(`Missing source for question ${q.id}`);
    }

    // Determine topic ID by looking up the topic string
    // Handle both title case and lowercase variants
    const topicKey = q.topic;
    let topicSlug: string;

    // Map topic string to slug
    const topicLowercase = topicKey.toLowerCase();
    if (topicLowercase === 'constitution') topicSlug = 'constitution';
    else if (topicLowercase === 'amendments') topicSlug = 'amendments';
    else if (topicKey === 'Branches of Government') topicSlug = 'branches-of-government';
    else if (topicLowercase === 'elections') topicSlug = 'elections';
    else if (topicKey === 'Civic Participation' || topicKey === 'civic-participation') topicSlug = 'civic-participation';
    else if (topicKey === 'Supreme Court') topicSlug = 'supreme-court';
    else if (topicKey === 'U.S. History') topicSlug = 'us-history';
    else if (topicKey === 'bill-of-rights') topicSlug = 'bill-of-rights';
    else if (topicKey === 'federalism') topicSlug = 'federalism';
    else if (topicKey === 'voting') topicSlug = 'voting';
    else if (topicKey === 'congress') topicSlug = 'congress';
    else if (topicKey === 'judiciary') topicSlug = 'judiciary';
    else if (topicKey === 'executive') topicSlug = 'executive';
    else {
      throw new Error(`Unknown topic: ${topicKey} for question ${q.id}`);
    }

    const topicId = topicIdMap[topicSlug];
    if (!topicId) {
      throw new Error(`Topic slug ${topicSlug} not found in topicIdMap for question ${q.id}`);
    }

    // Extract learning content (only paragraphs and corrections, NOT source or topic)
    let learningContent: { paragraphs: string[]; corrections: Record<string, string> } | null = null;

    if (q.learningContent && q.learningContent.paragraphs) {
      learningContent = {
        paragraphs: q.learningContent.paragraphs,
        corrections: q.learningContent.corrections || {}
      };

      // Verify source matches if it exists in learningContent
      if (q.learningContent.source) {
        const lcSource = q.learningContent.source;
        if (lcSource.name !== source.name || lcSource.url !== source.url) {
          console.warn(
            `Source mismatch for ${q.id}: learningContent has {name: "${lcSource.name}", url: "${lcSource.url}"} ` +
            `but sources.json has {name: "${source.name}", url: "${source.url}"}`
          );
        }
      }
    }

    return {
      externalId: q.id,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topicId,
      subcategory: q.topicCategory || null,
      source: {
        name: source.name,
        url: source.url
      },
      learningContent,
      expiresAt: null
    };
  });
}

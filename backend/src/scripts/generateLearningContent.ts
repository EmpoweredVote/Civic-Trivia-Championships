// Run: CLAUDE_API_KEY=sk-xxx npx tsx backend/src/scripts/generateLearningContent.ts
//
// Build-time script for AI content generation via Claude API
// Generates educational content for questions missing learningContent

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topic: string;
  topicCategory: string;
  learningContent?: {
    topic: string;
    paragraphs: string[];
    corrections: Record<string, string>;
    source: {
      name: string;
      url: string;
    };
  };
}

// Initialize Claude client
const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

function buildPrompt(question: Question): string {
  const wrongOptions = question.options
    .map((opt, idx) => ({ opt, idx }))
    .filter(({ idx }) => idx !== question.correctAnswer);

  return `Generate educational content for this U.S. civics question.

Question: ${question.text}
Options: ${question.options.map((o, i) => `${i}. ${o}`).join(', ')}
Correct Answer: ${question.correctAnswer} (${question.options[question.correctAnswer]})
Topic Category: ${question.topicCategory}

Requirements:
1. Write 2-3 informative paragraphs (150-200 words total)
2. First sentence should restate the question's correct answer explicitly (e.g., "The 13th Amendment abolished slavery in 1865")
3. Explain WHY this answer is important and provide historical context
4. For EACH wrong answer option, write a specific 1-2 sentence correction explaining why it's incorrect
5. Provide a credible .gov source with real URL (verify it exists)

Use only these authoritative sources:
- constitution.congress.gov
- archives.gov
- supremecourt.gov
- senate.gov
- house.gov
- usa.gov

Tone: Informative and clear—factual, straightforward, no fluff.

Wrong options to correct:
${wrongOptions.map(({ opt, idx }) => `  ${idx}. ${opt}`).join('\n')}

Return ONLY valid JSON matching this structure:
{
  "paragraphs": ["First paragraph...", "Second paragraph...", "Third paragraph (optional)..."],
  "corrections": {
${wrongOptions.map(({ idx }) => `    "${idx}": "Correction for option ${idx}..."`).join(',\n')}
  },
  "source": {
    "name": "U.S. Constitution - Congress.gov",
    "url": "https://constitution.congress.gov/browse/..."
  }
}`;
}

async function generateWithRetry(
  question: Question,
  maxRetries = 3
): Promise<{ topic: string; paragraphs: string[]; corrections: Record<string, string>; source: { name: string; url: string } }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`  Attempt ${attempt + 1}/${maxRetries}...`);

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: buildPrompt(question),
          },
        ],
      });

      const contentText = response.content[0].type === 'text' ? response.content[0].text : '';

      // Extract JSON from response (may have markdown code blocks)
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const content = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!content.paragraphs || !Array.isArray(content.paragraphs)) {
        throw new Error('Invalid content structure: missing paragraphs array');
      }
      if (!content.corrections || typeof content.corrections !== 'object') {
        throw new Error('Invalid content structure: missing corrections object');
      }
      if (!content.source || !content.source.name || !content.source.url) {
        throw new Error('Invalid content structure: missing source');
      }

      // Add topic field matching question's topicCategory
      return {
        topic: question.topicCategory,
        paragraphs: content.paragraphs,
        corrections: content.corrections,
        source: content.source,
      };
    } catch (error) {
      console.error(`  Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);

      if (attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt);
      console.log(`  Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('All retries failed');
}

async function main() {
  console.log('Starting learning content generation...\n');

  // Read questions
  const questionsPath = join(process.cwd(), 'src/data/questions.json');
  const questionsRaw = readFileSync(questionsPath, 'utf-8');
  const questions: Question[] = JSON.parse(questionsRaw);

  // Filter questions without learning content
  const questionsNeedingContent = questions.filter((q) => !q.learningContent);

  console.log(`Total questions: ${questions.length}`);
  console.log(`Questions with content: ${questions.length - questionsNeedingContent.length}`);
  console.log(`Questions needing content: ${questionsNeedingContent.length}\n`);

  if (questionsNeedingContent.length === 0) {
    console.log('All questions already have learning content!');
    return;
  }

  // Check API key
  if (!process.env.CLAUDE_API_KEY) {
    console.error('Error: CLAUDE_API_KEY environment variable not set');
    console.error('Usage: CLAUDE_API_KEY=sk-xxx npx tsx backend/src/scripts/generateLearningContent.ts');
    process.exit(1);
  }

  // Generate content for each question
  let successCount = 0;
  let failCount = 0;

  for (const question of questionsNeedingContent) {
    console.log(`Generating content for ${question.id}: ${question.text}`);

    try {
      const learningContent = await generateWithRetry(question);
      question.learningContent = learningContent;
      successCount++;
      console.log(`  ✓ Success\n`);

      // Rate limiting: 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ Failed: ${error instanceof Error ? error.message : error}\n`);
      failCount++;

      // Continue with other questions even if one fails
    }
  }

  // Write updated questions back to file
  writeFileSync(questionsPath, JSON.stringify(questions, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('Generation complete!');
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Total: ${successCount + failCount}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Usage:
//   npx tsx src/scripts/generateLearningContent.ts --difficulty hard --limit 15
//   npx tsx src/scripts/generateLearningContent.ts --ids q076,q078,q079
//   npx tsx src/scripts/generateLearningContent.ts --topic judiciary --limit 10
// Run from backend/ directory. Requires ANTHROPIC_API_KEY in .env or environment.
//
// Build-time script for AI content generation via Claude API
// Generates educational content for questions missing learningContent

import 'dotenv/config';
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

// Initialize Claude client (SDK auto-detects ANTHROPIC_API_KEY)
const client = new Anthropic();

function parseArgs(): { ids?: string[]; difficulty?: string; topic?: string; limit?: number } {
  const args = process.argv.slice(2);
  const result: { ids?: string[]; difficulty?: string; topic?: string; limit?: number } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ids' && args[i + 1]) { result.ids = args[i + 1].split(',').map(s => s.trim()); i++; }
    else if (args[i] === '--difficulty' && args[i + 1]) { result.difficulty = args[i + 1]; i++; }
    else if (args[i] === '--topic' && args[i + 1]) { result.topic = args[i + 1]; i++; }
    else if (args[i] === '--limit' && args[i + 1]) { result.limit = parseInt(args[i + 1], 10); i++; }
  }
  return result;
}

function buildPrompt(question: Question): string {
  const wrongOptions = question.options
    .map((opt, idx) => ({ opt, idx }))
    .filter(({ idx }) => idx !== question.correctAnswer);

  const today = new Date().toISOString().split('T')[0];

  return `Generate educational content for this U.S. civics question. Write for a general adult audience at an 8th-grade reading level.

Question: ${question.text}
Options: ${question.options.map((o, i) => `${i}. ${o}`).join(', ')}
Correct Answer: ${question.correctAnswer} (${question.options[question.correctAnswer]})
Topic Category: ${question.topicCategory}

Writing requirements:
1. Write 2-3 informative paragraphs (150-200 words total)
2. First sentence must restate the correct answer explicitly (e.g., "The 13th Amendment abolished slavery in 1865")
3. Explain WHY this answer matters and provide historical context
4. Use plain language: short sentences, define any legal or government jargon when first used, avoid academic tone
5. Be strictly nonpartisan: do not characterize any policy, party, or court decision as liberal, conservative, progressive, activist, or any political label. Present facts only.
6. For time-sensitive facts (population figures, current office-holders, recent laws), add "as of ${today}" after the fact
7. Embed inline hyperlinks on key terms using markdown: [key term](https://url). Use 1-3 links per paragraph on the most important terms. Links must point to authoritative sources from the allowlist below.
8. For EACH wrong answer option, write a specific 1-2 sentence correction explaining why it is incorrect. Keep the same nonpartisan, plain-language tone.

Approved source allowlist (links MUST come from these domains only):
- *.gov (e.g., constitution.congress.gov, archives.gov, supremecourt.gov, senate.gov, house.gov, usa.gov, loc.gov)
- khanacademy.org
- icivics.org
- en.wikipedia.org
- Archived news articles from major papers (nytimes.com, washingtonpost.com, apnews.com) for historical events only

Wrong options to correct:
${wrongOptions.map(({ opt, idx }) => `  ${idx}. ${opt}`).join('\n')}

Return ONLY valid JSON matching this structure (no markdown code blocks, no extra text):
{
  "paragraphs": ["First paragraph with [inline links](https://url)...", "Second paragraph...", "Third paragraph (optional)..."],
  "corrections": {
${wrongOptions.map(({ idx }) => `    "${idx}": "Correction for option ${idx}..."`).join(',\n')}
  },
  "source": {
    "name": "Descriptive source name",
    "url": "https://exact-url-from-allowlist.gov/..."
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
  const args = parseArgs();

  // Safety guard: require at least one filter flag
  const hasFilter = args.ids !== undefined || args.difficulty !== undefined || args.topic !== undefined || args.limit !== undefined;
  if (!hasFilter) {
    console.error('Error: At least one filter flag is required. The script will not process all questions by default.');
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx src/scripts/generateLearningContent.ts --difficulty hard --limit 15');
    console.error('  npx tsx src/scripts/generateLearningContent.ts --ids q076,q078,q079');
    console.error('  npx tsx src/scripts/generateLearningContent.ts --topic judiciary --limit 10');
    console.error('');
    console.error('Flags:');
    console.error('  --ids q076,q078,q079   Generate for specific question IDs (comma-separated)');
    console.error('  --difficulty hard       Filter by difficulty field (easy, medium, hard)');
    console.error('  --topic judiciary       Filter by topicCategory field');
    console.error('  --limit 15              Cap the number of questions to process');
    process.exit(1);
  }

  console.log('Starting learning content generation...\n');

  // Read questions
  const questionsPath = join(process.cwd(), 'src/data/questions.json');
  const questionsRaw = readFileSync(questionsPath, 'utf-8');
  const questions: Question[] = JSON.parse(questionsRaw);

  // Filter questions without learning content
  const questionsNeedingContent = questions.filter((q) => !q.learningContent);

  console.log(`Total questions: ${questions.length}`);
  console.log(`Questions with content: ${questions.length - questionsNeedingContent.length}`);
  console.log(`Questions needing content: ${questionsNeedingContent.length}`);

  // Apply CLI filters
  let filtered: Question[];

  if (args.ids) {
    // --ids takes priority over --difficulty and --topic
    filtered = questionsNeedingContent.filter((q) => args.ids!.includes(q.id));
  } else {
    filtered = questionsNeedingContent;
    if (args.difficulty) {
      filtered = filtered.filter((q) => q.difficulty === args.difficulty);
    }
    if (args.topic) {
      filtered = filtered.filter((q) => q.topicCategory === args.topic);
    }
  }

  // Apply --limit last
  if (args.limit !== undefined) {
    filtered = filtered.slice(0, args.limit);
  }

  console.log(`Processing ${filtered.length} questions (filtered from ${questionsNeedingContent.length} uncovered)\n`);

  if (filtered.length === 0) {
    console.log('No questions match the specified filters.');
    return;
  }

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('Usage: ANTHROPIC_API_KEY=sk-xxx npx tsx src/scripts/generateLearningContent.ts --difficulty hard');
    console.error('Or: Create backend/.env with ANTHROPIC_API_KEY=sk-xxx');
    process.exit(1);
  }

  // Generate content for each question
  let successCount = 0;
  let failCount = 0;
  const generatedContent: Record<string, { learningContent: any }> = {};

  for (const question of filtered) {
    console.log(`Generating content for ${question.id}: ${question.text}`);

    try {
      const learningContent = await generateWithRetry(question);
      generatedContent[question.id] = { learningContent };
      successCount++;
      console.log(`  Success\n`);

      // Rate limiting: 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  Failed: ${error instanceof Error ? error.message : error}\n`);
      failCount++;

      // Continue with other questions even if one fails
    }
  }

  // Write to temp file for review
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputPath = join(process.cwd(), `generated-content-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(generatedContent, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('Generation complete!');
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Total: ${successCount + failCount}`);
  console.log('='.repeat(60));
  console.log('\nGenerated content summary:\n');

  for (const [questionId, content] of Object.entries(generatedContent)) {
    const firstParagraph = content.learningContent.paragraphs[0];
    const preview = firstParagraph.length > 80 ? firstParagraph.slice(0, 80) + '...' : firstParagraph;
    const sourceUrl = content.learningContent.source.url;
    console.log(`${questionId}: ${preview}`);
    console.log(`  Source: ${sourceUrl}\n`);
  }

  console.log('='.repeat(60));
  console.log(`\nReview the generated content in: ${outputPath}`);
  console.log(`To apply, run: npx tsx src/scripts/applyContent.ts ${outputPath}`);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

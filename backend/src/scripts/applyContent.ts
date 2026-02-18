// Usage:
//   npx tsx src/scripts/applyContent.ts generated-content-2026-02-17T14-30-00.json
//   npx tsx src/scripts/applyContent.ts generated-content-2026-02-17T14-30-00.json --ids q076,q078
// Run from backend/ directory.
//
// Cherry-pick merge script: applies generated learning content into questions.json.
// By default applies ALL entries from the preview file.
// Use --ids to cherry-pick specific question IDs.

import { readFileSync, writeFileSync } from 'fs';
import { join, isAbsolute } from 'path';

interface LearningContent {
  topic: string;
  paragraphs: string[];
  corrections: Record<string, string>;
  source: {
    name: string;
    url: string;
  };
}

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topic: string;
  topicCategory: string;
  learningContent?: LearningContent;
}

interface PreviewEntry {
  learningContent: LearningContent;
}

function parseArgs(): { previewPath?: string; ids?: string[] } {
  const args = process.argv.slice(2);
  const result: { previewPath?: string; ids?: string[] } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ids' && args[i + 1]) {
      result.ids = args[i + 1].split(',').map((s) => s.trim());
      i++;
    } else if (!args[i].startsWith('--')) {
      // First positional argument is the preview file path
      if (!result.previewPath) {
        result.previewPath = args[i];
      }
    }
  }

  return result;
}

function resolvePath(filePath: string): string {
  // Handle absolute paths (Windows drive letter or Unix-style absolute)
  if (isAbsolute(filePath) || /^[A-Za-z]:/.test(filePath)) {
    return filePath;
  }
  // Relative path: resolve relative to cwd
  return join(process.cwd(), filePath);
}

function main() {
  const args = parseArgs();

  if (!args.previewPath) {
    console.error('Error: Preview file path is required.');
    console.error('');
    console.error('Usage:');
    console.error('  npx tsx src/scripts/applyContent.ts generated-content-2026-02-17T14-30-00.json');
    console.error('  npx tsx src/scripts/applyContent.ts generated-content-2026-02-17T14-30-00.json --ids q076,q078');
    console.error('');
    console.error('Options:');
    console.error('  --ids q076,q078   Cherry-pick specific question IDs from the preview file');
    process.exit(1);
  }

  // Resolve paths
  const previewPath = resolvePath(args.previewPath);
  const questionsPath = join(process.cwd(), 'src/data/questions.json');

  // Load preview file
  let preview: Record<string, PreviewEntry>;
  try {
    const previewRaw = readFileSync(previewPath, 'utf-8');
    preview = JSON.parse(previewRaw);
  } catch (error) {
    console.error(`Error reading preview file: ${previewPath}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Load questions.json
  let questions: Question[];
  try {
    const questionsRaw = readFileSync(questionsPath, 'utf-8');
    questions = JSON.parse(questionsRaw);
  } catch (error) {
    console.error(`Error reading questions.json: ${questionsPath}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Determine which IDs to apply
  const previewIds = Object.keys(preview);
  const targetIds = args.ids ? args.ids : previewIds;

  console.log(`Preview file: ${previewPath}`);
  console.log(`Preview contains: ${previewIds.length} entries`);
  if (args.ids) {
    console.log(`Cherry-picking: ${targetIds.join(', ')}`);
  } else {
    console.log(`Applying: all ${targetIds.length} entries`);
  }
  console.log('');

  // Build question ID index for fast lookup
  const questionIndex = new Map<string, number>();
  questions.forEach((q, i) => questionIndex.set(q.id, i));

  let appliedCount = 0;
  let skippedCount = 0;
  let warnCount = 0;
  const totalReviewed = targetIds.length;

  for (const questionId of targetIds) {
    const previewEntry = preview[questionId];

    if (!previewEntry) {
      console.warn(`WARN: ${questionId} not found in preview file — skipping`);
      warnCount++;
      continue;
    }

    const questionIdx = questionIndex.get(questionId);
    if (questionIdx === undefined) {
      console.warn(`WARN: ${questionId} not found in questions.json — skipping`);
      warnCount++;
      continue;
    }

    const question = questions[questionIdx];

    if (question.learningContent) {
      console.log(`SKIP: ${questionId} already has learningContent — skipping`);
      skippedCount++;
      continue;
    }

    // Apply the learning content
    questions[questionIdx] = {
      ...question,
      learningContent: previewEntry.learningContent,
    };
    console.log(`APPLY: ${questionId}`);
    appliedCount++;
  }

  // Write updated questions.json
  writeFileSync(questionsPath, JSON.stringify(questions, null, 2), 'utf-8');

  console.log('');
  console.log('='.repeat(60));
  console.log(`Applied ${appliedCount}, Skipped ${skippedCount}, Total reviewed ${totalReviewed}`);
  if (warnCount > 0) {
    console.log(`Warnings: ${warnCount} (IDs not found in preview or questions.json)`);
  }
  console.log('='.repeat(60));
  console.log(`\nUpdated: ${questionsPath}`);
}

main();

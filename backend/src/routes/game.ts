import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = Router();

// Get current file's directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load questions from JSON file
const questionsPath = join(__dirname, '../data/questions.json');
const questionsData = readFileSync(questionsPath, 'utf-8');
const allQuestions = JSON.parse(questionsData);

// Fisher-Yates shuffle algorithm
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// GET /questions - Returns 10 randomized questions
router.get('/questions', (_req: Request, res: Response) => {
  try {
    // Shuffle all questions and take first 10
    const shuffled = shuffle(allQuestions);
    const selectedQuestions = shuffled.slice(0, 10);

    res.status(200).json({
      questions: selectedQuestions
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      error: 'Failed to fetch questions'
    });
  }
});

export { router };

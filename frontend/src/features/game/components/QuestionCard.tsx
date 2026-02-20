import type { Question } from '../../../types/game';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
}

export function QuestionCard({ question, questionNumber, totalQuestions }: QuestionCardProps) {
  return (
    <div className="flex flex-col items-center gap-4 max-w-3xl mx-auto px-6" role="region" aria-label={`Question ${questionNumber} of ${totalQuestions}`}>
      {/* Topic badge */}
      <div className="text-teal-400/70 text-xs font-medium uppercase tracking-wider">
        {question.topic}
      </div>

      {/* Question text */}
      <div className="text-white text-3xl md:text-4xl font-bold text-center leading-relaxed">
        {question.text}
      </div>
    </div>
  );
}

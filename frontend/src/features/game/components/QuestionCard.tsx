import type { Question } from '../../../types/game';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
}

export function QuestionCard({ question, questionNumber }: QuestionCardProps) {
  return (
    <div className="flex flex-col items-center gap-4 max-w-3xl mx-auto px-6">
      {/* Topic badge */}
      <div className="text-teal-400 text-sm font-medium uppercase tracking-wider">
        {question.topic}
      </div>

      {/* Question number */}
      <div className="text-slate-400 text-sm font-medium">
        Question {questionNumber} of 10
      </div>

      {/* Question text */}
      <div className="text-white text-2xl md:text-3xl font-semibold text-center leading-relaxed">
        {question.text}
      </div>
    </div>
  );
}

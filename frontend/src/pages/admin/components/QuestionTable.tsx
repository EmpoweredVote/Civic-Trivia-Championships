import { DifficultyRate } from './DifficultyRate';

export interface QuestionRow {
  id: number;
  externalId: string;
  text: string;
  difficulty: string;
  qualityScore: number | null;
  violationCount: number | null;
  status: string;
  encounterCount: number;
  correctCount: number;
  createdAt: string;
  collectionNames: string[];
}

interface QuestionTableProps {
  questions: QuestionRow[] | null;
  sort: string;
  order: string;
  onSortChange: (column: string) => void;
  onQuestionClick: (id: number, index: number) => void;
}

export function QuestionTable({
  questions,
  sort,
  order,
  onSortChange,
  onQuestionClick,
}: QuestionTableProps) {
  const renderSortIcon = (columnKey: string) => {
    if (sort !== columnKey) return null;
    return (
      <span className="ml-1">
        {order === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const getDifficultyBadge = (difficulty: string) => {
    const badges = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    };
    return badges[difficulty as keyof typeof badges] || badges.medium;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      archived: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800',
    };
    return badges[status as keyof typeof badges] || badges.active;
  };

  // Loading skeleton
  if (!questions) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-red-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Question Text
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Collection(s)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Difficulty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Quality Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Encounters
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Correct Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Violations
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[...Array(10)].map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-12"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-12"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 bg-gray-200 rounded w-8"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-red-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Question Text
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Collection(s)
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-red-800"
              onClick={() => onSortChange('difficulty')}
            >
              Difficulty {renderSortIcon('difficulty')}
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-red-800"
              onClick={() => onSortChange('quality_score')}
            >
              Quality Score {renderSortIcon('quality_score')}
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-red-800"
              onClick={() => onSortChange('encounter_count')}
            >
              Encounters {renderSortIcon('encounter_count')}
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-red-800"
              onClick={() => onSortChange('correct_count')}
            >
              Correct Rate {renderSortIcon('correct_count')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Status
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer hover:bg-red-800"
              onClick={() => onSortChange('created_at')}
            >
              Created {renderSortIcon('created_at')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Violations
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {questions.map((question, index) => (
            <tr
              key={question.id}
              onClick={() => onQuestionClick(question.id, index)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 max-w-md truncate">
                  {question.text}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">
                  {question.collectionNames.join(', ')}
                </div>
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getDifficultyBadge(
                    question.difficulty
                  )}`}
                >
                  {question.difficulty}
                </span>
              </td>
              <td className="px-6 py-4">
                {question.qualityScore !== null ? (
                  <span className="text-sm font-medium text-gray-900">
                    {question.qualityScore}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Not scored</span>
                )}
              </td>
              <td className="px-6 py-4">
                <span className="text-sm text-gray-900">
                  {question.encounterCount}
                </span>
              </td>
              <td className="px-6 py-4">
                <DifficultyRate
                  correctCount={question.correctCount}
                  encounterCount={question.encounterCount}
                />
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                    question.status
                  )}`}
                >
                  {question.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-sm text-gray-900">
                  {new Date(question.createdAt).toLocaleDateString()}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                {question.violationCount !== null ? (
                  <span
                    className={`text-sm font-semibold ${
                      question.violationCount === 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {question.violationCount}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

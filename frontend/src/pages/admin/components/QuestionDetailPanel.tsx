import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useAuthStore } from '../../../store/authStore';
import { DifficultyRate } from './DifficultyRate';

interface Violation {
  rule: string;
  severity: 'blocking' | 'advisory';
  message: string;
  evidence?: string;
}

interface QuestionDetail {
  id: number;
  externalId: string;
  text: string;
  difficulty: string;
  status: string;
  createdAt: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctAnswer: 'a' | 'b' | 'c' | 'd';
  explanation: string;
  source: {
    name: string;
    url: string | null;
  };
  encounterCount: number;
  correctCount: number;
  qualityScore: number | null;
  violations: Violation[];
}

interface QuestionDetailPanelProps {
  questionId: number | null;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
}

// Helper to map violations to content sections
function getViolationsForSection(
  violations: Violation[],
  section: 'question' | 'options' | 'explanation' | 'source'
): Violation[] {
  const sectionRules: Record<string, string[]> = {
    question: ['partisan-framing', 'pure-lookup'],
    options: ['ambiguous-answers', 'multiple-correct'],
    explanation: ['weak-explanation', 'no-explanation'],
    source: ['broken-source-link', 'no-source'],
  };

  return violations.filter((v) => {
    const rules = sectionRules[section];
    return rules ? rules.includes(v.rule) : section === 'question'; // default to question
  });
}

// Inline violation badge component
function InlineViolationBadge({ violation }: { violation: Violation }) {
  const isBlocking = violation.severity === 'blocking';
  const bgColor = isBlocking
    ? 'bg-red-100 text-red-800 border-red-300'
    : 'bg-yellow-100 text-yellow-800 border-yellow-300';

  const formatRuleName = (rule: string) => {
    return rule
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${bgColor} mr-2 mb-2`}>
      {isBlocking ? (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span>{formatRuleName(violation.rule)}</span>
      {violation.evidence && (
        <span className="ml-1 text-xs italic opacity-80" title={violation.evidence}>
          *
        </span>
      )}
    </div>
  );
}

export function QuestionDetailPanel({
  questionId,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
}: QuestionDetailPanelProps) {
  const { accessToken } = useAuthStore();
  const [questionDetail, setQuestionDetail] = useState<QuestionDetail | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch question detail when questionId changes
  useEffect(() => {
    if (questionId === null || !accessToken) {
      setQuestionDetail(null);
      return;
    }

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/admin/questions/${questionId}/detail`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch question details');
        }

        const data = await response.json();
        setQuestionDetail(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [questionId, accessToken]);

  const isOpen = questionId !== null;

  // Badge helpers
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

  const getQualityScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 71) return 'text-green-600';
    if (score >= 41) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        {/* Panel */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                  <div className="flex h-full flex-col bg-white shadow-xl">
                    {/* Header */}
                    <div className="bg-red-900 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <Dialog.Title className="text-lg font-semibold text-white">
                          Question Details
                        </Dialog.Title>
                        <div className="flex items-center space-x-2">
                          {/* Prev button */}
                          <button
                            onClick={() => onNavigate('prev')}
                            disabled={!hasPrev}
                            className="p-2 text-white hover:bg-red-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Previous question"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                              />
                            </svg>
                          </button>
                          {/* Next button */}
                          <button
                            onClick={() => onNavigate('next')}
                            disabled={!hasNext}
                            className="p-2 text-white hover:bg-red-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Next question"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                          {/* Close button */}
                          <button
                            onClick={onClose}
                            className="p-2 text-white hover:bg-red-800 rounded"
                            aria-label="Close panel"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      {/* Loading state */}
                      {loading && (
                        <div className="space-y-4 animate-pulse">
                          <div className="h-8 bg-gray-200 rounded w-3/4" />
                          <div className="h-4 bg-gray-200 rounded w-full" />
                          <div className="h-4 bg-gray-200 rounded w-5/6" />
                          <div className="space-y-2">
                            <div className="h-6 bg-gray-200 rounded w-full" />
                            <div className="h-6 bg-gray-200 rounded w-full" />
                            <div className="h-6 bg-gray-200 rounded w-full" />
                            <div className="h-6 bg-gray-200 rounded w-full" />
                          </div>
                        </div>
                      )}

                      {/* Error state */}
                      {error && !loading && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                          {error}
                        </div>
                      )}

                      {/* Content */}
                      {questionDetail && !loading && (
                        <div className="space-y-6">
                          {/* Question text */}
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">
                              {questionDetail.text}
                            </h3>
                            {/* Inline violations for question */}
                            {getViolationsForSection(
                              questionDetail.violations,
                              'question'
                            ).length > 0 && (
                              <div className="border-l-4 border-red-300 pl-3 mt-2">
                                {getViolationsForSection(
                                  questionDetail.violations,
                                  'question'
                                ).map((v, idx) => (
                                  <InlineViolationBadge key={idx} violation={v} />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Answer options */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              Answer Options
                            </h4>
                            <div className="space-y-2">
                              {(['a', 'b', 'c', 'd'] as const).map((key) => {
                                const isCorrect = questionDetail.correctAnswer === key;
                                const optionViolations = getViolationsForSection(
                                  questionDetail.violations,
                                  'options'
                                );
                                const hasEvidence = optionViolations.some(
                                  (v) =>
                                    v.evidence &&
                                    questionDetail.options[key]
                                      .toLowerCase()
                                      .includes(v.evidence.toLowerCase())
                                );

                                return (
                                  <div
                                    key={key}
                                    className={`flex items-start p-3 rounded-md border ${
                                      isCorrect && !hasEvidence
                                        ? 'bg-green-50 border-green-300'
                                        : hasEvidence
                                        ? 'bg-red-50 border-red-300'
                                        : 'bg-gray-50 border-gray-200'
                                    }`}
                                  >
                                    <span className="font-semibold text-gray-700 mr-2">
                                      {key.toUpperCase()}.
                                    </span>
                                    <div className="flex-1">
                                      <span className="text-gray-900">
                                        {questionDetail.options[key]}
                                      </span>
                                      {isCorrect && (
                                        <svg
                                          className="inline-block w-5 h-5 ml-2 text-green-600"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Inline violations for options */}
                            {getViolationsForSection(
                              questionDetail.violations,
                              'options'
                            ).length > 0 && (
                              <div className="border-l-4 border-red-300 pl-3 mt-3">
                                {getViolationsForSection(
                                  questionDetail.violations,
                                  'options'
                                ).map((v, idx) => (
                                  <InlineViolationBadge key={idx} violation={v} />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Explanation */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              Explanation
                            </h4>
                            <div className="bg-gray-50 p-4 rounded-md">
                              <p className="text-gray-900">
                                {questionDetail.explanation}
                              </p>
                            </div>
                            {/* Inline violations for explanation */}
                            {getViolationsForSection(
                              questionDetail.violations,
                              'explanation'
                            ).length > 0 && (
                              <div className="border-l-4 border-yellow-300 pl-3 mt-2">
                                {getViolationsForSection(
                                  questionDetail.violations,
                                  'explanation'
                                ).map((v, idx) => (
                                  <InlineViolationBadge key={idx} violation={v} />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Learn More */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              Learn More
                            </h4>
                            {questionDetail.source.url ? (
                              <a
                                href={questionDetail.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-red-600 hover:text-red-700 underline"
                              >
                                {questionDetail.source.name}
                                <svg
                                  className="inline-block w-4 h-4 ml-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-gray-500">
                                {questionDetail.source.name || 'No source provided'}
                              </span>
                            )}
                            {/* Inline violations for source */}
                            {getViolationsForSection(
                              questionDetail.violations,
                              'source'
                            ).length > 0 && (
                              <div className="border-l-4 border-red-300 pl-3 mt-2">
                                {getViolationsForSection(
                                  questionDetail.violations,
                                  'source'
                                ).map((v, idx) => (
                                  <InlineViolationBadge key={idx} violation={v} />
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Metadata */}
                          <div className="flex items-center space-x-4 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full font-semibold ${getDifficultyBadge(
                                questionDetail.difficulty
                              )}`}
                            >
                              {questionDetail.difficulty}
                            </span>
                            <span
                              className={`px-2 py-1 rounded-full font-semibold ${getStatusBadge(
                                questionDetail.status
                              )}`}
                            >
                              {questionDetail.status}
                            </span>
                            <span className="text-gray-600">
                              Created:{' '}
                              {new Date(questionDetail.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-gray-600">
                              ID: {questionDetail.externalId}
                            </span>
                          </div>

                          {/* Telemetry */}
                          <div className="bg-blue-50 p-4 rounded-md">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                              Telemetry Data
                            </h4>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-gray-600 mb-1">Encounters</div>
                                <div className="text-lg font-semibold text-gray-900">
                                  {questionDetail.encounterCount}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-600 mb-1">Correct</div>
                                <div className="text-lg font-semibold text-gray-900">
                                  {questionDetail.correctCount}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-600 mb-1">
                                  Calculated Difficulty
                                </div>
                                <div className="text-lg font-semibold">
                                  <DifficultyRate
                                    correctCount={questionDetail.correctCount}
                                    encounterCount={questionDetail.encounterCount}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Quality Assessment Summary */}
                          <div className="border-t pt-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-3">
                              Quality Assessment
                            </h4>

                            {/* Score */}
                            <div className="mb-4">
                              <div className="text-sm text-gray-600 mb-1">
                                Quality Score
                              </div>
                              {questionDetail.qualityScore !== null ? (
                                <div
                                  className={`text-4xl font-bold ${getQualityScoreColor(
                                    questionDetail.qualityScore
                                  )}`}
                                >
                                  {questionDetail.qualityScore}
                                  <span className="text-lg text-gray-500">/100</span>
                                </div>
                              ) : (
                                <div className="text-2xl text-gray-400">Not scored</div>
                              )}
                            </div>

                            {/* Violations list */}
                            <div>
                              <div className="text-sm font-semibold text-gray-700 mb-2">
                                Violations
                              </div>
                              {questionDetail.violations.length > 0 ? (
                                <div className="space-y-3">
                                  {questionDetail.violations.map((violation, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-gray-50 p-3 rounded-md border border-gray-200"
                                    >
                                      <div className="flex items-start justify-between mb-1">
                                        <span
                                          className={`px-2 py-1 text-xs font-semibold rounded ${
                                            violation.severity === 'blocking'
                                              ? 'bg-red-100 text-red-800'
                                              : 'bg-yellow-100 text-yellow-800'
                                          }`}
                                        >
                                          {violation.severity === 'blocking'
                                            ? 'Blocking'
                                            : 'Advisory'}
                                        </span>
                                        <span className="text-sm font-medium text-gray-700">
                                          {violation.rule
                                            .split('-')
                                            .map(
                                              (w) =>
                                                w.charAt(0).toUpperCase() + w.slice(1)
                                            )
                                            .join(' ')}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-900 mb-1">
                                        {violation.message}
                                      </p>
                                      {violation.evidence && (
                                        <p className="text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded mt-2">
                                          {violation.evidence}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600 italic">
                                  No violations found
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

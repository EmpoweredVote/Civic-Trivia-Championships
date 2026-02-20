import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export interface QualityDelta {
  oldScore: number | null;
  newScore: number;
  oldViolations: number;
  newViolations: number;
  violations: Array<{
    rule: string;
    severity: 'blocking' | 'advisory';
    message: string;
    evidence?: string;
  }>;
}

interface QualityComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  delta: QualityDelta | null;
}

export function QualityComparisonModal({
  isOpen,
  onClose,
  delta,
}: QualityComparisonModalProps) {
  if (!delta) return null;

  const scoreChanged = delta.oldScore !== delta.newScore;
  const scoreImproved = delta.oldScore !== null && delta.newScore > delta.oldScore;
  const scoreWorsened = delta.oldScore !== null && delta.newScore < delta.oldScore;
  const scoreDelta = delta.oldScore !== null ? delta.newScore - delta.oldScore : 0;

  const violationsChanged = delta.oldViolations !== delta.newViolations;
  const violationsImproved = delta.newViolations < delta.oldViolations;

  const getScoreColor = () => {
    if (scoreImproved) return 'text-green-600';
    if (scoreWorsened) return 'text-red-600';
    return 'text-gray-600';
  };

  const getViolationColor = () => {
    if (violationsImproved) return 'text-green-600';
    if (delta.newViolations > delta.oldViolations) return 'text-red-600';
    return 'text-gray-600';
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

        {/* Modal */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-gray-200">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Quality Re-Scoring Complete
                  </Dialog.Title>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-4">
                  {/* Score comparison */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Quality Score
                    </h4>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-gray-400">
                        {delta.oldScore !== null ? delta.oldScore : 'N/A'}
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                      <div className="flex items-baseline gap-2">
                        <div className={`text-3xl font-bold ${getScoreColor()}`}>
                          {delta.newScore}
                        </div>
                        {scoreChanged && delta.oldScore !== null && (
                          <div className={`text-lg font-medium ${getScoreColor()}`}>
                            ({scoreDelta > 0 ? '+' : ''}
                            {scoreDelta})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Violations comparison */}
                  {violationsChanged && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Violations
                      </h4>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-gray-400">
                          {delta.oldViolations}
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                        <div className={`text-3xl font-bold ${getViolationColor()}`}>
                          {delta.newViolations}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Current violations list */}
                  {delta.violations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Current Violations
                      </h4>
                      <div className="space-y-2">
                        {delta.violations.map((violation, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200"
                          >
                            <span
                              className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${
                                violation.severity === 'blocking'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {violation.severity === 'blocking'
                                ? 'Blocking'
                                : 'Advisory'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {violation.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

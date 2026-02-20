import { Link } from 'react-router-dom';
import { ProgressBar } from './ProgressBar';

interface CollectionHealth {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  themeColor: string;
  stats: {
    activeCount: number;
    archivedCount: number;
    totalCount: number;
    difficulty: { easy: number; medium: number; hard: number };
    quality: { avgScore: number | null; minScore: number | null; unscoredCount: number };
    telemetry: { totalEncounters: number; totalCorrect: number; overallCorrectRate: number | null };
  };
}

interface CollectionCardProps {
  collection: CollectionHealth;
  expanded: boolean;
  onToggleExpand: () => void;
}

export function CollectionCard({ collection, expanded, onToggleExpand }: CollectionCardProps) {
  const { name, slug, isActive, themeColor, stats } = collection;
  const { activeCount, archivedCount, difficulty, quality, telemetry } = stats;

  // Calculate health status
  const getHealthStatus = () => {
    if (quality.avgScore === null) return 'gray';
    if (activeCount < 50 || quality.avgScore < 50) return 'red';
    if (activeCount < 80 || quality.avgScore < 70) return 'yellow';
    return 'green';
  };

  const healthStatus = getHealthStatus();
  const healthColors = {
    red: 'bg-red-600',
    yellow: 'bg-yellow-500',
    green: 'bg-green-600',
    gray: 'bg-gray-400',
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${Math.round(value * 100)}%`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Card header and summary (clickable area) */}
      <div
        className="relative cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Left color bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ backgroundColor: themeColor }}
        />

        <div className="pl-5 pr-4 py-4">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{name}</h3>
              <div className="flex items-center gap-2">
                {/* Active/Inactive badge */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                    isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            {/* Health indicator dot */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Health</span>
              <div className={`w-3 h-3 rounded-full ${healthColors[healthStatus]}`} />
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Active Questions</div>
              <div className="font-semibold text-gray-900">{activeCount}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Avg Quality</div>
              <div className="font-semibold text-gray-900">
                {quality.avgScore !== null ? Math.round(quality.avgScore) : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-0.5">Correct Rate</div>
              <div className="font-semibold text-gray-900">
                {formatPercentage(telemetry.overallCorrectRate)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Questions link */}
      <div className="px-4 pb-3 pt-2 border-t border-gray-100">
        <Link
          to={`/admin/questions?collection=${slug}`}
          className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View Questions
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-200 bg-gray-50 space-y-4 animate-slideDown">
          {/* Question Count */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Question Count</h4>
            <ProgressBar
              value={activeCount}
              max={100}
              label="Active Questions"
              color={activeCount >= 80 ? 'green' : activeCount >= 50 ? 'yellow' : 'red'}
            />
            <p className="text-xs text-gray-500 mt-1">{archivedCount} archived questions</p>
          </div>

          {/* Difficulty Distribution */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Difficulty Distribution</h4>
            <div className="space-y-2">
              <ProgressBar
                value={difficulty.easy}
                max={activeCount || 1}
                label="Easy"
                color="green"
              />
              <ProgressBar
                value={difficulty.medium}
                max={activeCount || 1}
                label="Medium"
                color="yellow"
              />
              <ProgressBar
                value={difficulty.hard}
                max={activeCount || 1}
                label="Hard"
                color="red"
              />
            </div>
          </div>

          {/* Quality Scores */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Quality Scores</h4>
            <ProgressBar
              value={quality.avgScore || 0}
              max={100}
              label="Avg Quality Score"
              color={
                quality.avgScore === null
                  ? 'gray'
                  : quality.avgScore >= 70
                  ? 'green'
                  : quality.avgScore >= 50
                  ? 'yellow'
                  : 'red'
              }
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Min score: {quality.minScore !== null ? Math.round(quality.minScore) : 'N/A'}</span>
              <span>{quality.unscoredCount} unscored</span>
            </div>
          </div>

          {/* Telemetry */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Telemetry</h4>
            {telemetry.overallCorrectRate !== null ? (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Encounters</div>
                  <div className="font-semibold text-gray-900">{telemetry.totalEncounters.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Correct</div>
                  <div className="font-semibold text-gray-900">{telemetry.totalCorrect.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">Correct Rate</div>
                  <div className="font-semibold text-gray-900">{formatPercentage(telemetry.overallCorrectRate)}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No data yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

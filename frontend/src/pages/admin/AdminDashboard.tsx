import { useAuthStore } from '../../store/authStore';

export function AdminDashboard() {
  const { user } = useAuthStore();

  const upcomingFeatures = [
    {
      title: 'Question Explorer',
      description: 'Browse, filter, and inspect questions',
      phase: 'Coming in Phase 20',
      icon: QuestionExplorerIcon,
    },
    {
      title: 'Collection Health',
      description: 'Monitor question counts and quality',
      phase: 'Coming in Phase 20',
      icon: CollectionHealthIcon,
    },
    {
      title: 'Content Generation',
      description: 'AI-powered question pipeline',
      phase: 'Coming in Phase 21',
      icon: ContentGenerationIcon,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user?.name || 'Admin'}
        </h1>
        <p className="mt-2 text-gray-600">
          Admin tools are being built in phases. Here's what's coming soon.
        </p>
      </div>

      {/* Feature cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {upcomingFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="bg-white rounded-lg border-2 border-red-100 p-6 hover:border-red-200 transition-colors"
            >
              {/* Icon */}
              <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-lg mb-4">
                <Icon className="w-6 h-6 text-red-600" />
              </div>

              {/* Title with badge */}
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                  Soon
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-3">
                {feature.description}
              </p>

              {/* Phase info */}
              <p className="text-xs text-red-600 font-medium">
                {feature.phase}
              </p>
            </div>
          );
        })}
      </div>

      {/* Legacy content review notice */}
      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg
            className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Legacy Content Review Tool
            </h4>
            <p className="text-sm text-blue-700">
              The v1.2 content review page will be integrated into the Question Explorer in Phase 20.
              For now, it remains accessible through its existing route.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon components
function QuestionExplorerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function CollectionHealthIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function ContentGenerationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

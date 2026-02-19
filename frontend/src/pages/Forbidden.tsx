import { Link } from 'react-router-dom';

export function Forbidden() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        {/* Shield Icon */}
        <div className="flex justify-center mb-6">
          <svg
            className="w-16 h-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        {/* 403 Status */}
        <h1 className="text-6xl font-bold text-gray-300 mb-4">403</h1>

        {/* Message */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Admin Access Required
        </h2>
        <p className="text-gray-600 mb-8">
          This area is for admins. If you think you should have access, please contact us.
        </p>

        {/* Back to Home Link */}
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

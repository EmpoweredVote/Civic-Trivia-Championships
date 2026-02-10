import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Header } from '../components/layout/Header';

export function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome, {user?.name || 'User'}!
          </h2>

          {/* Quick Play CTA */}
          <div className="text-center py-8">
            <button
              onClick={() => navigate('/play')}
              className="px-12 py-4 bg-teal-600 hover:bg-teal-700 text-white text-xl font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
            >
              Quick Play
            </button>
            <p className="text-gray-600 mt-4">
              10 questions. Test your civic knowledge.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

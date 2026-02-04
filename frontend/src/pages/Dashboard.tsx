import { useAuthStore } from '../store/authStore';
import { Header } from '../components/layout/Header';

export function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome, {user?.name || 'User'}!
          </h2>
          <p className="text-gray-600">
            Game features coming soon...
          </p>
        </div>
      </main>
    </div>
  );
}

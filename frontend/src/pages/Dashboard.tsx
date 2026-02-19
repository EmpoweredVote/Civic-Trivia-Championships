import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Header } from '../components/layout/Header';
import { useCollections } from '../features/collections/hooks/useCollections';
import { CollectionPicker } from '../features/collections/components/CollectionPicker';

export function Dashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { collections, selectedId, selectedCollection, loading, select } = useCollections();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {isAuthenticated && user ? `Welcome, ${user.name}!` : 'Civic Trivia Championship'}
          </h2>

          {/* Start Game Button */}
          <div className="text-center py-8">
            <button
              onClick={() => navigate('/play', { state: { collectionId: selectedId } })}
              className="px-12 py-4 min-h-[48px] bg-teal-600 hover:bg-teal-700 text-white text-xl font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
            >
              {selectedCollection ? `Play ${selectedCollection.name}` : 'Quick Play'}
            </button>
          </div>

          {/* Collection Picker */}
          <CollectionPicker
            collections={collections}
            selectedId={selectedId}
            loading={loading}
            onSelect={select}
          />

          {/* Sign-in nudge for anonymous users */}
          {!isAuthenticated && (
            <p className="text-gray-500 mt-6 text-sm text-center">
              <Link to="/login" className="text-teal-600 hover:text-teal-500 font-medium">Sign in</Link>
              {' '}or{' '}
              <Link to="/signup" className="text-teal-600 hover:text-teal-500 font-medium">create an account</Link>
              {' '}to track your progress and earn rewards.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

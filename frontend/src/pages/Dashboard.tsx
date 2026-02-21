import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Header } from '../components/layout/Header';
import { useCollections } from '../features/collections/hooks/useCollections';
import { CollectionPicker } from '../features/collections/components/CollectionPicker';

export function Dashboard() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { collections, selectedId, selectedCollection, loading, select } = useCollections();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="p-6">
          <div className="flex justify-center pt-4 pb-1">
            <img
              src="/images/civic-trivia-championships-logo.png"
              alt="Civic Trivia Championship"
              className="w-full max-w-2xl px-4"
            />
          </div>

          {/* Start Game Button */}
          <div className="text-center py-2">
            <button
              onClick={() => navigate('/play', { state: { collectionId: selectedId } })}
              className="px-12 py-4 min-h-[48px] bg-teal-600 hover:bg-teal-500 text-white text-xl font-bold rounded-lg shadow-lg shadow-teal-900/30 transition-all transform hover:scale-105 ring-1 ring-teal-500/20"
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
            <p className="text-slate-400 mt-6 text-sm text-center">
              <Link to="/login" className="text-teal-400 hover:text-teal-300 font-medium">Sign in</Link>
              {' '}or{' '}
              <Link to="/signup" className="text-teal-400 hover:text-teal-300 font-medium">create an account</Link>
              {' '}to track your progress and earn rewards.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

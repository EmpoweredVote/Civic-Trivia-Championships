import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Header } from '../components/layout/Header';
import { useCollections } from '../features/collections/hooks/useCollections';
import { CollectionPicker } from '../features/collections/components/CollectionPicker';

export function Dashboard() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { collections, selectedId, loading, select } = useCollections();
  const [playPressed, setPlayPressed] = useState(false);

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
              onPointerDown={() => setPlayPressed(true)}
              onPointerUp={() => setPlayPressed(false)}
              onPointerLeave={() => setPlayPressed(false)}
              className="transition-transform hover:scale-105 active:scale-95"
            >
              <img
                src={playPressed ? '/images/Play_Down.png' : '/images/Play_Up.png'}
                alt="Play"
                className="h-16 sm:h-20"
                draggable={false}
              />
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

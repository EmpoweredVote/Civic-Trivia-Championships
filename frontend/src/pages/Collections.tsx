import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { useCollections } from '../features/collections/hooks/useCollections';
import { CollectionPicker } from '../features/collections/components/CollectionPicker';
import { useTheme } from '../hooks/useTheme';

export function Collections() {
  const { collections, selectedId, loading, select } = useCollections();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const pageBg = darkMode ? '#0D1117' : '#F0F4F8';

  const handlePlayCollection = (id: number) => {
    navigate('/play', { state: { collectionId: id } });
  };

  const textColor = darkMode ? '#94A3B8' : '#64748B';

  return (
    <div style={{ minHeight: '100vh', background: pageBg }}>
      <Header />
      <section style={{ padding: '40px 0 64px' }}>
        <div style={{ padding: '0 24px' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to home"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', padding: 0, marginBottom: 20,
              cursor: 'pointer', fontFamily: "'Manrope', sans-serif",
              fontWeight: 600, fontSize: 14, color: textColor,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Back to home
          </button>

          <CollectionPicker
            collections={collections}
            selectedId={selectedId}
            loading={loading}
            onSelect={select}
            onPlay={handlePlayCollection}
          />

          {/* Banner photography is CC-licensed; some licences require the credit
              to be visible. Cards are too small for a credit line each. */}
          <button
            type="button"
            onClick={() => navigate('/credits')}
            style={{
              display: 'block', marginTop: 28, background: 'none', border: 'none',
              padding: 0, cursor: 'pointer', fontFamily: "'Manrope', sans-serif",
              fontSize: 13, fontWeight: 600, color: textColor,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            Image credits
          </button>
        </div>
      </section>
    </div>
  );
}

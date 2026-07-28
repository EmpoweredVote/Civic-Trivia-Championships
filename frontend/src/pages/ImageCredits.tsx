import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { useTheme } from '../hooks/useTheme';
import { BANNER_CREDITS } from '../data/bannerCredits';

/**
 * Visible attribution for collection banner photography.
 *
 * CC BY / CC BY-SA oblige us to display the credit where the image is used; a
 * note in the repo does not count. Cards are too small to carry a credit line
 * each, so they link here instead.
 */
export function ImageCredits() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const pageBg = darkMode ? '#0D1117' : '#F0F4F8';
  const cardBg = darkMode ? '#161B22' : '#FFFFFF';
  const border = darkMode ? '#243041' : '#E2E8F0';
  const heading = darkMode ? '#E6EDF3' : '#0F172A';
  const body = darkMode ? '#94A3B8' : '#64748B';
  const link = darkMode ? '#58A6FF' : '#1D4ED8';

  return (
    <div style={{ minHeight: '100vh', background: pageBg }}>
      <Header />
      <section style={{ padding: '40px 0 64px' }}>
        <div style={{ padding: '0 24px', maxWidth: 760, margin: '0 auto' }}>
          <button
            type="button"
            onClick={() => navigate('/collections')}
            aria-label="Back to collections"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', padding: 0, marginBottom: 20,
              cursor: 'pointer', fontFamily: "'Manrope', sans-serif",
              fontWeight: 600, fontSize: 14, color: body,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Back to collections
          </button>

          <h1 style={{
            fontFamily: "'Manrope', sans-serif", fontWeight: 800,
            fontSize: 28, color: heading, margin: '0 0 8px',
          }}>
            Image credits
          </h1>
          <p style={{
            fontFamily: "'Manrope', sans-serif", fontSize: 15,
            lineHeight: 1.6, color: body, margin: '0 0 28px',
          }}>
            Collection banner photography, with the licence each image is used under.
          </p>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {BANNER_CREDITS.map(credit => (
              <li
                key={credit.slug}
                style={{
                  background: cardBg, border: `1px solid ${border}`,
                  borderRadius: 12, padding: '14px 16px',
                }}
              >
                <div style={{
                  fontFamily: "'Manrope', sans-serif", fontWeight: 700,
                  fontSize: 15, color: heading, marginBottom: 4,
                }}>
                  {credit.collection}
                </div>
                <div style={{
                  fontFamily: "'Manrope', sans-serif", fontSize: 14,
                  lineHeight: 1.55, color: body,
                }}>
                  <a
                    href={credit.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: link, textDecoration: 'none' }}
                  >
                    {credit.title}
                  </a>
                  {' by '}{credit.author}{', '}
                  <a
                    href={credit.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: link, textDecoration: 'none' }}
                  >
                    {credit.license}
                  </a>
                </div>
              </li>
            ))}
          </ul>

          <p style={{
            fontFamily: "'Manrope', sans-serif", fontSize: 13,
            lineHeight: 1.6, color: body, margin: '24px 0 0',
          }}>
            Banners not listed here predate this registry and have no recorded
            provenance.
          </p>
        </div>
      </section>
    </div>
  );
}

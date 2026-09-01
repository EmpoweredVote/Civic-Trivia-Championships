import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Header } from '../components/layout/Header';
import { useCollections } from '../features/collections/hooks/useCollections';
import { CollectionPicker } from '../features/collections/components/CollectionPicker';
import type { CollectionSummary } from '../features/collections/types';
import { PillButton } from '../components/ui/PillButton';
import { useTheme } from '../hooks/useTheme';
import { useWindowSize } from '../hooks/useWindowSize';
import { BobbitScene } from '../components/bobbits/BobbitScene';
import { BobbitTrophyCarry } from '../components/bobbits/BobbitTrophyCarry';
import { BobbitCardGreeter } from '../components/bobbits/BobbitCardGreeter';

function PinIcon({ color = '#D4A017' }: { color?: string }) {
  return (
    <svg width="10" height="13" viewBox="0 0 10 13" fill={color} style={{ flexShrink: 0 }}>
      <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8C10 2.24 7.76 0 5 0zm0 6.5A1.5 1.5 0 115 3.5a1.5 1.5 0 010 3z"/>
    </svg>
  );
}

function PlayGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.166} viewBox="0 0 14 16" fill="currentColor">
      <path d="M1.5 1l11 7-11 7V1z"/>
    </svg>
  );
}

function getRegion(c: CollectionSummary): string {
  // Some localeName values come back as "City, State" — the badge only wants the state.
  if (c.localeName) return c.localeName.split(',').pop()!.trim().toUpperCase();
  if (c.tier === 'federal') return 'UNITED STATES';
  if (c.tier === 'state') return 'STATE LEVEL';
  return 'LOCAL';
}

export function Dashboard() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { collections, selectedId, selectedCollection, loading, select } = useCollections();
  const { darkMode } = useTheme();
  const { width } = useWindowSize();

  // Side-by-side from 1024px up (desktop + landscape tablet); stacked below.
  const isDesktop = width >= 1024;
  const isMobile = width < 640;

  // Plain flat background in both modes — no ambient effects.
  const pageBg = darkMode ? '#0D1117' : '#F0F4F8';
  const mutedColor = darkMode ? '#7487A1' : '#5B6B7F';

  const handlePlay = () => {
    navigate('/play', { state: { collectionId: selectedId } });
  };

  const handlePlayCollection = (collectionId: number) => {
    navigate('/play', { state: { collectionId } });
  };

  return (
    <div style={{ minHeight: '100vh', background: pageBg }}>
      <Header />

      {/* ── Hero ── */}
      <section
        style={{
          position: 'relative', overflow: 'hidden',
          padding: isMobile ? '28px 20px 32px' : '40px 24px 36px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%', maxWidth: 1240, margin: '0 auto',
            display: 'grid',
            // The featured collection gets the wider track so it reads as the focal point.
            gridTemplateColumns: isDesktop ? 'minmax(0, 0.9fr) minmax(0, 1.1fr)' : 'minmax(0, 1fr)',
            gap: isDesktop ? 48 : 28,
            alignItems: 'center',
          }}
        >
          {/* ── Left: identity + pitch ── */}
          <div style={{
            display: 'flex', flexDirection: 'column' as const,
            alignItems: isDesktop ? 'flex-start' : 'center',
            textAlign: isDesktop ? ('left' as const) : ('center' as const),
          }}>
            <img
              src={darkMode
                ? '/images/brand/civic-trivia-logo-dark.svg'
                : '/images/brand/civic-trivia-logo-light.svg'}
              alt="Civic Trivia Championship"
              style={{
                height: isDesktop ? 'clamp(64px, 7vw, 116px)' : 'clamp(56px, 14vw, 96px)',
                width: 'auto', maxWidth: '100%',
              }}
            />

            <p style={{
              fontFamily: "'Manrope', sans-serif", fontWeight: 300, fontSize: isMobile ? 15 : 16,
              color: darkMode ? '#94A3B8' : '#4B5768',
              maxWidth: 480, lineHeight: 1.6, margin: '18px 0 0',
            }}>
              Challenge your civic knowledge across local, state, and national collections. Climb the leaderboard. Earn your place.
            </p>

            {/* Change collection — the empty-state card owns this affordance when nothing is picked */}
            {selectedCollection && (
              <button
                onClick={() => navigate('/collections')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: 0, margin: '20px 0 0',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 15,
                  color: darkMode ? '#00C7B1' : '#00657C', transition: 'color 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = darkMode ? '#5EEAD4' : '#00849E'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = darkMode ? '#00C7B1' : '#00657C'; }}
              >
                Change Collection
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 1l5 5-5 5"/>
                </svg>
              </button>
            )}

            {!isAuthenticated && (
              <p style={{
                fontFamily: "'Manrope', sans-serif", fontSize: 14,
                color: mutedColor, maxWidth: 480,
                margin: '18px 0 0', lineHeight: 1.6,
              }}>
                <Link to="/login" style={{ color: darkMode ? '#00C7B1' : '#00657C', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
                {' '}or{' '}
                <Link to="/signup" style={{ color: darkMode ? '#00C7B1' : '#00657C', textDecoration: 'none', fontWeight: 600 }}>create an account</Link>
                {' '}to track your progress and earn rewards.
              </p>
            )}
          </div>

          {/* ── Right: the selected collection ── */}
          <div style={{ position: 'relative', width: '100%', maxWidth: isDesktop ? 'none' : 560, margin: isDesktop ? 0 : '0 auto' }}>
            {loading ? (
              <FeaturedSkeleton darkMode={darkMode} isMobile={isMobile} />
            ) : selectedCollection ? (
              <FeaturedCollection
                collection={selectedCollection}
                darkMode={darkMode}
                isMobile={isMobile}
                isDesktop={isDesktop}
                // No source exists for completed-question progress — see CollectionProgress.
                progress={null}
                onPlay={handlePlay}
              />
            ) : (
              <EmptyFeatured
                darkMode={darkMode}
                isMobile={isMobile}
                onExplore={() => navigate('/collections')}
              />
            )}
            {!loading && selectedCollection && (
              <BobbitCardGreeter darkMode={darkMode} isMobile={isMobile} />
            )}
          </div>
        </div>

        {/* Full-bleed edge-to-edge, breaking out of the content column and the section's own
            padding — the walk-in needs the real viewport edge, not just the content column's. */}
        <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
          <BobbitTrophyCarry darkMode={darkMode} isMobile={isMobile} />
        </div>
      </section>

      {/* ── All Collections preview ── */}
      <section id="all-collections" style={{ paddingBottom: 64, scrollMarginTop: 24 }}>
        <div style={{ padding: '0 24px' }}>
          <CollectionPicker
            collections={collections}
            selectedId={selectedId}
            loading={loading}
            onSelect={select}
            onPlay={handlePlayCollection}
            variant="preview"
            onSeeMore={() => navigate('/collections')}
          />
          <BobbitScene darkMode={darkMode} isMobile={isMobile} />
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────  Featured collection card  ───────────────────────── */

function cardShell(darkMode: boolean) {
  return {
    borderRadius: 20,
    overflow: 'hidden',
    border: `1px solid ${darkMode ? '#21262D' : '#E2E8F0'}`,
    background: darkMode ? '#161B22' : '#FFFFFF',
    boxShadow: darkMode
      ? '0 14px 40px rgba(0,0,0,0.42)'
      : 'none',
  };
}

/**
 * Image height is capped in `vh` so the card — and therefore the Play button —
 * stays above the fold on short laptop viewports, while still reading as a large
 * feature image on roomier screens.
 */
function imageHeight(isMobile: boolean): string {
  return isMobile ? 'clamp(170px, 36vw, 240px)' : 'clamp(180px, 26vh, 280px)';
}

/**
 * Completed-question progress for one collection.
 *
 * NOTHING IN THE PROJECT CAN SUPPLY THIS TODAY, so `FeaturedCollection` is always
 * called with `progress={null}` and renders its no-data fallback. The card is wired
 * end-to-end so a real source only has to fill this shape:
 *   - `trivia.player_stats` is a lifetime aggregate with no collection dimension.
 *   - No table records which questions a user has answered (no `user_questions`).
 *   - Game sessions live in Redis keyed by session id, and `POST /api/game/session`
 *     only ever creates a new one — there is no "my unfinished session" lookup.
 * `/api/users/profile/xp/history` has a `collectionSlug` per game, but its
 * `correctAnswers` double-counts replayed questions, so it cannot yield "N of M
 * completed" without deduplication the backend does not do.
 */
interface CollectionProgress {
  completed: number;
  total: number;
}

function FeaturedCollection({
  collection, darkMode, isMobile, isDesktop, progress, onPlay,
}: {
  collection: CollectionSummary;
  darkMode: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  progress: CollectionProgress | null;
  onPlay: () => void;
}) {
  // 4 of the 41 collections ship without a photo, so a large image needs a real fallback.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [collection.slug]);

  // Everything sits on the photo now, not a solid panel, so body text uses one
  // light-on-photo palette rather than a dark/light pair tuned for a panel bg.
  const bodyColor = 'rgba(255,255,255,0.8)';
  const metaColor = 'rgba(255,255,255,0.7)';

  const hasProgress = !!progress && progress.total > 0;
  const isResuming = hasProgress && progress.completed > 0;
  const headingId = `featured-${collection.slug}`;

  return (
    <div style={{ ...cardShell(darkMode), position: 'relative' as const }}>
      {/* ── Photo layer: fills the whole card. Its height is driven by the
          content column below, not the other way around. ── */}
      <div style={{
        position: 'absolute', inset: 0,
        // Doubles as the loading backdrop for the heavier photos and as the fallback fill.
        background: collection.themeColor,
        overflow: 'hidden',
      }}>
        {!imageFailed && (
          <img
            src={`/images/collections/${collection.slug}.jpg`}
            // Decorative: the location name is announced by the heading below.
            alt=""
            onError={() => setImageFailed(true)}
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {imageFailed && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${collection.themeColor} 0%, rgba(0,0,0,0.5) 100%)`,
          }}>
            <PinIcon color="rgba(255,255,255,0.5)" />
          </div>
        )}
      </div>

      {/* Scrim: bright up top so the photo still reads as a photo, dark enough
          by the bottom to hold every line of body text at AA. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none' as const,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.12) 32%, rgba(0,0,0,0.52) 56%, rgba(0,0,0,0.78) 100%)',
      }} />

      {/* Selected pill — this card only ever renders the currently-selected collection */}
      <div style={{
        position: 'absolute', left: isMobile ? 18 : 24, top: isMobile ? 14 : 18,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(20,24,32,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
      }}>
        <span aria-hidden="true" style={{
          width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
          letterSpacing: '0.02em', color: '#FFFFFF',
        }}>
          Selected
        </span>
      </div>

      {/* ── Content column: normal flow, so its height (plus the clear photo
          reveal above it) is what sizes the card and therefore the photo. ── */}
      <div style={{
        position: 'relative',
        // Top value is the reveal zone: same height the image used to have on
        // its own, so the upper photo stays fully visible before text starts.
        padding: isMobile ? `${imageHeight(isMobile)} 18px 16px` : `${imageHeight(isMobile)} 24px 20px`,
        display: 'flex', flexDirection: 'column' as const, gap: 12,
      }}>
        {/* Name over the photo — ties the place to the collection at a glance */}
        <h2
          id={headingId}
          style={{
            margin: 0,
            fontFamily: "'Manrope', sans-serif", fontWeight: 900,
            fontSize: isMobile ? 26 : isDesktop ? 36 : 30,
            lineHeight: 1.08, letterSpacing: '-0.025em',
            color: '#FFFFFF',
            textShadow: '0 2px 14px rgba(0,0,0,0.55)',
          }}
        >
          {collection.name}
        </h2>

        {/* Locale */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
        }}>
          <PinIcon color="#F0C24B" />
          <span style={{
            color: '#F0C24B', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
            whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {getRegion(collection)}
          </span>
        </div>

        <p style={{
          fontFamily: "'Manrope', sans-serif", fontWeight: 400, fontSize: isMobile ? 13 : 14,
          color: bodyColor, lineHeight: 1.5, margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {collection.description}
        </p>

        {hasProgress ? (
          <CollectionProgressMeter
            completed={progress.completed}
            total={progress.total}
            darkMode={darkMode}
            label={`${collection.name} progress`}
          />
        ) : (
          /* Fallback: state the total honestly rather than render an empty/faked bar. */
          <div style={{
            fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
            color: metaColor,
          }}>
            {collection.questionCount} questions ready to play
          </div>
        )}

        <PillButton
          onClick={onPlay}
          aria-label={`${isResuming ? 'Continue playing' : 'Play now'} — ${collection.name}`}
          className="focus-ring-primary"
          style={{ width: '100%', fontWeight: 800 }}
        >
          <PlayGlyph />
          {isResuming ? 'Continue Playing' : 'Play Now'}
        </PillButton>
      </div>
    </div>
  );
}

function CollectionProgressMeter({
  completed, total, darkMode, label,
}: {
  completed: number;
  total: number;
  darkMode: boolean;
  label: string;
}) {
  const done = Math.max(0, Math.min(completed, total));
  const pct = Math.round((done / total) * 100);
  const trackColor = darkMode ? '#21262D' : '#E2E8F0';
  const labelColor = darkMode ? '#8B9CB3' : '#64748B';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
        marginBottom: 7,
        fontFamily: "'Manrope', sans-serif", fontSize: 12,
      }}>
        <span style={{ fontWeight: 700, color: labelColor }}>
          {done} of {total} completed
        </span>
        <span style={{ fontWeight: 800, color: '#00C7B1' }}>{pct}%</span>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} questions completed`}
        style={{
          height: 7, borderRadius: 999, background: trackColor, overflow: 'hidden',
        }}
      >
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 999,
          background: 'linear-gradient(90deg, #00C7B1 0%, #5EEAD4 100%)',
          transition: 'width 0.35s ease-out',
        }} />
      </div>
    </div>
  );
}

function EmptyFeatured({
  darkMode, isMobile, onExplore,
}: {
  darkMode: boolean;
  isMobile: boolean;
  onExplore: () => void;
}) {
  const titleColor = darkMode ? '#F1F5F9' : '#0F172A';
  const bodyColor = darkMode ? '#7C90AC' : '#94A3B8';

  return (
    <div style={{
      ...cardShell(darkMode),
      border: `1px dashed ${darkMode ? '#2B3440' : '#CBD5E1'}`,
      boxShadow: 'none',
      display: 'flex', flexDirection: 'column' as const,
      alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const,
      // Roughly matches the populated card so the hero does not jump on selection.
      minHeight: isMobile ? 280 : 'clamp(300px, 44vh, 420px)',
      padding: isMobile ? '28px 22px' : '32px 36px',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: darkMode ? 'rgba(0,199,177,0.1)' : 'rgba(0,199,177,0.12)',
        border: `1px solid ${darkMode ? 'rgba(0,199,177,0.3)' : 'rgba(0,199,177,0.35)'}`,
        marginBottom: 16,
      }}>
        <PinIcon color="#00C7B1" />
      </div>

      <h2 style={{
        fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: isMobile ? 19 : 22,
        color: titleColor, margin: '0 0 8px', letterSpacing: '-0.01em',
      }}>
        No collection selected
      </h2>

      <p style={{
        fontFamily: "'Manrope', sans-serif", fontWeight: 400, fontSize: 14,
        color: bodyColor, lineHeight: 1.6, margin: '0 0 20px', maxWidth: 320,
      }}>
        Pick a city, state, or national collection to get started.
      </p>

      <PillButton onClick={onExplore} className="focus-ring-primary" style={{ fontWeight: 800 }}>
        Explore Collections
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l5 5-5 5"/>
        </svg>
      </PillButton>
    </div>
  );
}

function FeaturedSkeleton({ darkMode, isMobile }: { darkMode: boolean; isMobile: boolean }) {
  const block = darkMode ? '#21262D' : '#E2E8F0';
  const imageBlock = darkMode ? '#1B2027' : '#DDE5EE';

  return (
    <div style={cardShell(darkMode)} aria-hidden="true">
      <div style={{ height: imageHeight(isMobile), background: imageBlock }} />
      <div style={{
        padding: isMobile ? '14px 18px 16px' : '16px 24px 20px',
        display: 'flex', flexDirection: 'column' as const, gap: 12,
      }}>
        <div style={{ height: 10, width: '58%', background: block, borderRadius: 6 }} />
        <div>
          <div style={{ height: 10, width: '100%', background: block, borderRadius: 6, marginBottom: 7 }} />
          <div style={{ height: 10, width: '72%', background: block, borderRadius: 6 }} />
        </div>
        <div style={{ height: 10, width: '40%', background: block, borderRadius: 6 }} />
        <div style={{ height: 48, width: '100%', background: block, borderRadius: 999 }} />
      </div>
    </div>
  );
}

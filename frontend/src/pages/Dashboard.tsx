import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Header } from '../components/layout/Header';
import { useCollections } from '../features/collections/hooks/useCollections';
import { CollectionPicker } from '../features/collections/components/CollectionPicker';
import { useTheme } from '../hooks/useTheme';
import { usePlayerXp } from '../hooks/usePlayerXp';
import { fetchTriviaStats, type ProfileStats } from '../services/profileService';
import type { CollectionSummary } from '../features/collections/types';

function getRegion(c: CollectionSummary): string {
  if (c.localeName) return c.localeName.toUpperCase();
  if (c.tier === 'federal') return 'UNITED STATES';
  if (c.tier === 'state') return 'STATE LEVEL';
  return 'LOCAL';
}

function PinIcon() {
  return (
    <svg width="10" height="13" viewBox="0 0 10 13" fill="#D4A017" style={{ flexShrink: 0 }}>
      <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8C10 2.24 7.76 0 5 0zm0 6.5A1.5 1.5 0 115 3.5a1.5 1.5 0 010 3z"/>
    </svg>
  );
}

function PlayerStatsSection({ darkMode, displayName, userId }: { darkMode: boolean; displayName: string | null; userId: string | null }) {
  const cardBg = darkMode ? '#161B22' : '#FFFFFF';
  const titleColor = darkMode ? '#F1F5F9' : '#0F172A';
  const mutedColor = darkMode ? '#64748B' : '#94A3B8';
  const statBg = darkMode ? '#0D1117' : '#F8FAFC';
  const statBorder = darkMode ? '#21262D' : '#E2E8F0';
  const statLabelColor = darkMode ? '#475569' : '#94A3B8';

  const { xpData, isConnected } = usePlayerXp(userId);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    fetchTriviaStats().then(setStats).catch(() => {});
  }, [userId]);

  const xpNeeded = xpData ? xpData.xpInLevel + xpData.xpToNextLevel : 0;
  const progressPct = xpNeeded > 0 ? Math.round((xpData!.xpInLevel / xpNeeded) * 100) : 0;

  const statItems = [
    {
      label: 'Games Played',
      value: stats ? stats.gamesPlayed.toLocaleString() : '—',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      ),
    },
    {
      label: 'Best Score',
      value: stats ? stats.bestScore.toLocaleString() : '—',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8A020" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2h12v6a6 6 0 01-12 0V2zM4 2h2M18 2h2M8 20v-6M16 20v-6M5 20h14"/>
        </svg>
      ),
    },
    {
      label: 'Accuracy',
      value: stats ? `${Math.round(stats.overallAccuracy)}%` : '—',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
          <path d="M22 4L12 14.01l-3-3"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ background: cardBg, borderRadius: 16, padding: '28px', display: 'flex', flexDirection: 'column' as const, gap: 0, height: '100%', boxSizing: 'border-box' as const }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 'clamp(22px, 1.7vw, 30px)', color: titleColor, margin: 0, lineHeight: 1.2 }}>
          Welcome back{displayName ? `, ${displayName.split(' ')[0]}` : ''}!
        </h2>
        <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 300, fontSize: 13, color: mutedColor, margin: '4px 0 0' }}>
          Here's how you're doing.
        </p>
      </div>

      {/* XP Level */}
      {isConnected && xpData && (
        <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: statBg, border: `1px solid ${statBorder}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900, fontSize: 11, color: '#14B8A6' }}>
                  {xpData.level}
                </span>
              </div>
              <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, color: titleColor }}>Level {xpData.level}</span>
            </div>
            <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: mutedColor }}>
              {xpData.xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
            </span>
          </div>
          <div style={{ height: 6, background: statBorder, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: '#14B8A6', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: mutedColor, marginTop: 6 }}>
            {(xpData.xpToNextLevel).toLocaleString()} XP to next level
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, flex: 1 }}>
        {statItems.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: statBg, border: `1px solid ${statBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {s.icon}
              <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: statLabelColor, fontWeight: 500 }}>{s.label}</span>
            </div>
            <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 20, color: titleColor, letterSpacing: '-0.02em' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorksSection({ darkMode }: { darkMode: boolean }) {
  const cardBg = darkMode ? '#161B22' : '#FFFFFF';
  const titleColor = darkMode ? '#F1F5F9' : '#0F172A';
  const subtitleColor = darkMode ? '#94A3B8' : '#64748B';
  const stepTitleColor = darkMode ? '#E2E8F0' : '#0F172A';
  const stepDescColor = darkMode ? '#64748B' : '#94A3B8';
  const iconBg = darkMode ? '#0D1117' : '#EFF6FF';

  const steps = [
    {
      num: '01',
      title: 'Choose a collection',
      desc: 'Pick any city or national collection from the grid below.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
        </svg>
      ),
    },
    {
      num: '02',
      title: 'Learn your community',
      desc: 'Answer questions about local history, government, and civics.',
      icon: (
        <svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
    },
    {
      num: '03',
      title: 'Earn your score',
      desc: 'Track progress, replay collections, and climb the leaderboard.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2h12v6a6 6 0 01-12 0V2zM4 2h2M18 2h2M8 20v-6M16 20v-6M5 20h14"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ background: cardBg, borderRadius: 16, padding: '28px 28px 28px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', gap: 0, height: '100%', boxSizing: 'border-box' as const }}>
      <div>
        <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 'clamp(26px, 2vw, 36px)', color: titleColor, margin: 0, lineHeight: 1.1 }}>
          How it works
        </h2>
        <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 300, fontSize: 13, color: subtitleColor, margin: '5px 0 0' }}>
          Three steps to civic mastery.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 26, margin: '24px 0' }}>
        {steps.map(s => (
          <div key={s.num} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 42, height: 42, flexShrink: 0, borderRadius: '50%',
              background: iconBg, border: '1px solid rgba(20,184,166,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#14B8A6',
            }}>
              {s.icon}
            </div>
            <div style={{ paddingTop: 2 }}>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 700, color: stepTitleColor, lineHeight: 1.2 }}>
                <span style={{ color: '#14B8A6', fontWeight: 800, fontSize: 12, marginRight: 5 }}>{s.num}</span>
                {s.title}
              </div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: stepDescColor, marginTop: 3, lineHeight: 1.5 }}>
                {s.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturedCard({
  collection,
  onPlay,
  darkMode,
}: {
  collection: CollectionSummary | undefined;
  onPlay: () => void;
  darkMode: boolean;
}) {
  const cardBg = darkMode ? '#161B22' : '#FFFFFF';
  const borderColor = darkMode ? '#21262D' : '#E2E8F0';

  if (!collection) {
    return (
      <div style={{
        borderRadius: 16, background: cardBg,
        border: `2px dashed ${borderColor}`,
        minHeight: 360,
        display: 'flex', flexDirection: 'column' as const,
        alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: 32,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: darkMode ? '#0D1117' : '#EFF6FF',
          border: '1.5px solid rgba(20,184,166,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#14B8A6',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 16, color: darkMode ? '#E2E8F0' : '#0F172A', marginBottom: 6 }}>
            Choose a city to play
          </div>
          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: darkMode ? '#475569' : '#94A3B8', lineHeight: 1.5 }}>
            Select any collection from the grid below<br/>to see details and start playing.
          </div>
        </div>
      </div>
    );
  }

  const region = getRegion(collection);

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${borderColor}`, background: cardBg, display: 'flex', flexDirection: 'column' as const, height: '100%', boxSizing: 'border-box' as const }}>
      {/* Photo */}
      <div style={{ position: 'relative', height: 140, background: collection.themeColor, overflow: 'hidden' }}>
        <img
          src={`/images/collections/${collection.slug}.jpg`}
          alt={collection.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Selected badge — top right */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          padding: '4px 12px', borderRadius: 20,
          background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12, color: '#F1F5F9',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          Selected
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
        {/* Region */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <PinIcon />
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 700, fontSize: 11,
            letterSpacing: '0.12em', color: '#D4A017',
            textTransform: 'uppercase' as const,
          }}>
            {region}
          </span>
        </div>

        {/* City name */}
        <h2 style={{
          fontFamily: "'Manrope', sans-serif", fontWeight: 900, fontSize: 'clamp(28px, 2.2vw, 40px)',
          color: darkMode ? '#F1F5F9' : '#0F172A',
          margin: '0 0 8px', lineHeight: 1.05, letterSpacing: '-0.02em',
        }}>
          {collection.name}
        </h2>

        {/* Description */}
        <p style={{
          fontFamily: "'Manrope', sans-serif", fontWeight: 300, fontSize: 14,
          color: darkMode ? '#64748B' : '#94A3B8',
          lineHeight: 1.6, margin: '0 0 16px',
        }}>
          {collection.description}
        </p>

        {/* Play Now */}
        <button
          onClick={onPlay}
          style={{
            width: '100%', padding: 'clamp(14px, 1.1vw, 20px) clamp(20px, 1.6vw, 28px)', borderRadius: 12,
            background: '#E8A020', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 'clamp(16px, 1.25vw, 22px)',
            color: '#FFFFFF', transition: 'background 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#C87010'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#E8A020'; }}
        >
          <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
            <path d="M1.5 1l11 7-11 7V1z"/>
          </svg>
          Play Now
        </button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { isAuthenticated, displayName, user } = useAuthStore();
  const navigate = useNavigate();
  const { collections, selectedId, selectedCollection, loading, select } = useCollections();
  const { darkMode } = useTheme();

  const pageBg = darkMode ? '#0D1117' : '#F0F4F8';

  const handlePlay = () => {
    navigate('/play', { state: { collectionId: selectedId } });
  };

  return (
    <div style={{ minHeight: '100vh', background: pageBg }}>
      <Header />

      {/* ── Hero ── */}
      <section style={{ padding: '48px 0 44px' }}>
        <div style={{
          padding: '0 24px',
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 24,
        }}>
          {/* Left: title */}
          <div>
            <h1 style={{ margin: 0 }}>
              <span style={{
                display: 'block',
                fontFamily: "'Manrope', sans-serif", fontWeight: 900,
                fontSize: 'clamp(44px, 6vw, 108px)',
                color: darkMode ? '#FFFFFF' : '#0F172A',
                letterSpacing: '-0.02em', lineHeight: 1.0,
              }}>
                Civic Trivia
              </span>
              <span style={{
                display: 'block',
                fontFamily: "'Manrope', sans-serif", fontWeight: 900,
                fontSize: 'clamp(44px, 6vw, 108px)',
                color: '#14B8A6',
                letterSpacing: '-0.02em', lineHeight: 1.0,
              }}>
                Championship
              </span>
            </h1>

            <p style={{
              fontFamily: "'Manrope', sans-serif", fontWeight: 300, fontSize: 16,
              color: darkMode ? '#94A3B8' : '#64748B',
              maxWidth: 440, lineHeight: 1.6, margin: '16px 0 0',
            }}>
              Test your civic knowledge through local, state, and national trivia collections.
            </p>

            {!isAuthenticated && (
              <p style={{
                fontFamily: "'Manrope', sans-serif", fontSize: 14,
                color: darkMode ? '#475569' : '#94A3B8',
                margin: '12px 0 0',
              }}>
                <Link to="/login" style={{ color: '#E8A020', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
                {' '}or{' '}
                <Link to="/signup" style={{ color: '#E8A020', textDecoration: 'none', fontWeight: 600 }}>create an account</Link>
                {' '}to track your progress and earn rewards.
              </p>
            )}
          </div>

        </div>
      </section>

      {/* ── How it works + Featured card ── */}
      <section style={{ paddingBottom: 32 }}>
        <div
          className="md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
          style={{
            padding: '0 24px',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {isAuthenticated
            ? <PlayerStatsSection darkMode={darkMode} displayName={displayName} userId={user?.id ?? null} />
            : <HowItWorksSection darkMode={darkMode} />
          }
          <FeaturedCard collection={selectedCollection} onPlay={handlePlay} darkMode={darkMode} />
        </div>
      </section>

      {/* ── All Collections grid ── */}
      <section style={{ paddingBottom: 64 }}>
        <div style={{ padding: '0 24px' }}>
          <CollectionPicker
            collections={collections}
            selectedId={selectedId}
            loading={loading}
            onSelect={select}
          />
        </div>
      </section>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { ACCOUNTS_API_URL } from '../../services/accountsApi';
import { usePlayerXp } from '../../hooks/usePlayerXp';
import { useTheme } from '../../hooks/useTheme';
import { HowItWorksModal } from './HowItWorksModal';

function HowToPlayButton({ darkMode, onClick }: { darkMode: boolean; onClick: () => void }) {
  const [showTip, setShowTip] = useState(false);
  const idleBg = 'transparent';
  const hoverBg = darkMode ? '#21262D' : '#EEF4F7';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={e => { setShowTip(true); e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={e => { setShowTip(false); e.currentTarget.style.background = idleBg; }}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        aria-label="How to Play"
        className="flex items-center justify-center transition-colors"
        style={{
          color: '#14B8A6', borderRadius: '50%', width: '42px', height: '42px', boxSizing: 'border-box' as const,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: idleBg, cursor: 'pointer',
        }}
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 1 1 5.83 1c-.5 1-2 1.5-2 3" />
          <line x1="12" y1="17" x2="12" y2="17.01" />
        </svg>
      </button>
      {showTip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: '8px', padding: '6px 10px', borderRadius: '6px',
            background: '#111827', color: '#F1F5F9',
            fontFamily: "'Manrope', sans-serif", fontSize: '12px', fontWeight: 600,
            whiteSpace: 'nowrap' as const, pointerEvents: 'none' as const,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 60,
          }}
        >
          How to Play
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, accessToken, clearAuth, isAuthenticated, displayName, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen]             = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showSignedOutToast, setShowSignedOutToast] = useState(false);
  const menuRef                              = useRef<HTMLDivElement>(null);
  const userId                     = useAuthStore((s) => s.user?.id ?? null);
  const { xpData, isConnected: isXpConnected } = usePlayerXp(userId);
  const xpNeeded         = xpData ? xpData.xpInLevel + xpData.xpToNextLevel : 0;
  const progressPercent  = xpNeeded > 0 ? Math.round((xpData!.xpInLevel / xpNeeded) * 100) : 0;
  const { darkMode, toggleDarkMode, C }  = useTheme();

  const handleLogout = async () => {
    try {
      await fetch(`${ACCOUNTS_API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
    } catch {
      // Always clear local state regardless of logout errors
    }
    clearAuth();
    setShowSignedOutToast(true);
    setTimeout(() => setShowSignedOutToast(false), 3000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleMenuItemClick = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <>
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: darkMode ? '#161B22' : '#FFFFFF',
      borderBottom: `1px solid ${darkMode ? '#21262D' : '#E8EFF4'}`,
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>

          {/* Logo — swaps based on theme */}
          <div className="flex-shrink-0">
            <a href="https://alpha.empowered.vote">
              <img
                src={darkMode
                  ? '/images/Empowered Vote Dark Logo.png'
                  : '/images/Empowered_Vote_Logo_2026.png'}
                alt="Empowered Vote"
                className="h-10"
              />
            </a>
          </div>

          {/* Right side */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-4">
              {/* User info + XP */}
              <div className="hidden sm:flex flex-col items-end">
                <span style={{
                  fontFamily: "'Lora', Georgia, serif",
                  fontSize: '13px',
                  color: C.inkLight,
                  fontStyle: 'italic',
                }}>
                  {displayName || user.email}
                </span>
                {isXpConnected && xpData && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: '11px',
                      letterSpacing: '0.12em',
                      // C.mutedFg (#666666) fails AA contrast against this dark header
                      // background (3.01:1, needs 4.5:1) — overridden locally rather
                      // than changing the shared token used across admin pages.
                      color: darkMode ? '#94A3B8' : C.mutedFg,
                    }}>
                      LV {xpData.level}
                    </span>
                    <div style={{
                      width: '56px',
                      height: '4px',
                      background: C.ruleLight,
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        background: '#E8A020',
                        borderRadius: '2px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      color: darkMode ? '#94A3B8' : C.mutedFg,
                    }}>
                      {xpData.xpInLevel.toLocaleString()} XP
                    </span>
                  </div>
                )}
              </div>

              {/* How to Play */}
              <HowToPlayButton darkMode={darkMode} onClick={() => setShowHowItWorks(true)} />

              {/* Dark/Light toggle */}
              <button
                onClick={toggleDarkMode}
                className="flex items-center justify-center transition-colors"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{ color: '#14B8A6', borderRadius: '50%', width: '42px', height: '42px', boxSizing: 'border-box' as const, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = darkMode ? '#21262D' : '#EEF4F7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {darkMode ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {/* Account icon */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center justify-center transition-colors"
                  aria-label="Account menu"
                  style={{ color: '#14B8A6', borderRadius: '50%', width: '42px', height: '42px', boxSizing: 'border-box' as const, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent' }}
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: '8px',
                    width: '200px',
                    background: '#1E2432',
                    borderRadius: '12px',
                    padding: '8px 0',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    zIndex: 100,
                  }}>
                    {[
                      { label: 'Account', action: () => { window.location.href = 'https://login.empowered.vote/profile'; } },
                      ...(isAdmin ? [{ label: 'CTC Admin', action: () => navigate('/admin') }] : []),
                      { label: 'EV Financials', action: () => { window.location.href = 'https://financials.empowered.vote'; } },
                      { label: 'Feedback', action: () => navigate('/feedback') },
                    ].map(({ label, action }) => (
                      <div key={label}>
                        <button
                          onClick={() => handleMenuItemClick(action)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', fontFamily: "'Manrope', sans-serif", fontSize: '15px', fontWeight: 500, color: '#E2E8F0', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          {label}
                        </button>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 20px' }} />
                      </div>
                    ))}
                    <button
                      onClick={() => handleMenuItemClick(handleLogout)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', fontFamily: "'Manrope', sans-serif", fontSize: '15px', fontWeight: 500, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* How to Play */}
              <HowToPlayButton darkMode={darkMode} onClick={() => setShowHowItWorks(true)} />

              {/* Dark/Light toggle */}
              <button
                onClick={toggleDarkMode}
                className="flex items-center justify-center transition-colors"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{ color: '#14B8A6', borderRadius: '50%', width: '42px', height: '42px', boxSizing: 'border-box' as const, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = darkMode ? '#21262D' : '#EEF4F7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {darkMode ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {/* Account icon with Sign In / Sign Up dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center justify-center transition-colors"
                  aria-label="Account"
                  style={{ color: '#14B8A6', borderRadius: '50%', width: '42px', height: '42px', boxSizing: 'border-box' as const, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent' }}
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </button>

                {menuOpen && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: '8px',
                    width: '200px',
                    background: '#1E2432',
                    borderRadius: '12px',
                    padding: '8px 0',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    zIndex: 100,
                  }}>
                    <div>
                      <button
                        onClick={() => handleMenuItemClick(() => navigate('/leaderboard'))}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', fontFamily: "'Manrope', sans-serif", fontSize: '15px', fontWeight: 500, color: '#E2E8F0', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        Leaderboard
                      </button>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 20px' }} />
                    </div>
                    <button
                      onClick={() => handleMenuItemClick(() => navigate('/login'))}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', fontFamily: "'Manrope', sans-serif", fontSize: '15px', fontWeight: 500, color: '#E2E8F0', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      Sign in
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </header>
    {showSignedOutToast && (
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: '#1C1510',
        color: '#ECE7D9',
        fontFamily: "'Lora', Georgia, serif",
        fontSize: '14px',
        fontWeight: 500,
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(23,18,14,0.3)',
      }}>
        You've been signed out
      </div>
    )}
    <HowItWorksModal isOpen={showHowItWorks} onClose={() => setShowHowItWorks(false)} darkMode={darkMode} />
    </>
  );
}

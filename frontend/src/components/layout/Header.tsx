import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

export function Header() {
  const { user, accessToken, clearAuth, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      if (accessToken) {
        await authService.logout(accessToken);
      }
    } catch {
      // Ignore logout errors - clear local state anyway
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleMenuItemClick = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/">
              <img
                src="/images/Empowered_Vote_Logo_2026.png"
                alt="Empowered Vote"
                className="h-10"
              />
            </Link>
          </div>

          {/* User info and hamburger menu / Sign in links */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-4">
              <span className="hidden sm:block text-sm text-slate-300">
                {user.name || user.email}
              </span>

              {/* Admin pill (only for admin users) */}
              {user.isAdmin && (
                <Link
                  to="/admin"
                  className="text-xs font-medium bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full hover:bg-red-900/70 transition-colors"
                >
                  Admin
                </Link>
              )}

              {/* Hamburger menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="min-w-[48px] min-h-[48px] p-2 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
                  aria-label="Menu"
                >
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 py-2">
                    <button
                      onClick={() => handleMenuItemClick(() => navigate('/profile'))}
                      className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => handleMenuItemClick(handleLogout)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-sm font-medium text-teal-400 hover:text-teal-300">
                Sign in
              </Link>
              <Link to="/signup" className="text-sm font-medium text-teal-400 hover:text-teal-300">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

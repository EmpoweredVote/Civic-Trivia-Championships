import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';

const ADMIN_ACCENT = '#FF5740';
const SIDEBAR_BG = '#3D2E22';

export function AdminLayout() {
  const { user, isSuperAdmin } = useAuthStore();
  const { C } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: DashboardIcon },
    { name: 'Questions', href: '/admin/questions', icon: QuestionIcon },
    { name: 'Collections', href: '/admin/collections', icon: CollectionIcon },
    { name: 'Flag Review', href: '/admin/flags', icon: FlagIcon },
    { name: 'Duplicate Review', href: '/admin/duplicates', icon: DuplicateIcon },
    { name: 'Elections', href: '/admin/elections', icon: ElectionIcon },
    ...(isSuperAdmin ? [{ name: 'Manage Admins', href: '/admin/admins', icon: AdminsIcon }] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.paper }}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 20,
          }}
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 30,
          width: '256px',
          backgroundColor: SIDEBAR_BG,
          transform: sidebarOpen ? 'translateX(0)' : undefined,
          transition: 'transform 300ms ease-in-out',
        }}
        className={`lg:translate-x-0 ${sidebarOpen ? '' : '-translate-x-full'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Sidebar header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '64px',
              padding: '0 16px',
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderBottom: `1px solid rgba(255,255,255,0.1)`,
            }}
          >
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '18px',
              letterSpacing: '0.16em',
              color: ADMIN_ACCENT,
              margin: 0,
            }}>
              ADMIN PANEL
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ color: '#C8BAA6', background: 'none', border: 'none', cursor: 'pointer' }}
              className="lg:hidden"
              aria-label="Close sidebar"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '16px 8px', overflowY: 'auto' }}>
            {navigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px',
                    marginBottom: '2px',
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '14px',
                    letterSpacing: '0.12em',
                    textDecoration: 'none',
                    borderRadius: 0,
                    borderLeft: active ? `3px solid ${ADMIN_ACCENT}` : '3px solid transparent',
                    backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: active ? '#ECE7D9' : '#C8BAA6',
                    transition: 'background-color 150ms, color 150ms',
                  }}
                >
                  <Icon style={{ width: '20px', height: '20px', marginRight: '12px', flexShrink: 0 }} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <Link
              to="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '13px',
                letterSpacing: '0.1em',
                color: '#C8BAA6',
                textDecoration: 'none',
              }}
            >
              <svg width="20" height="20" style={{ marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to App
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          padding: '0 16px',
          backgroundColor: C.paper,
          borderBottom: `1px solid ${C.rule}`,
        }} className="lg:px-8">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
            className="lg:hidden"
            aria-label="Open sidebar"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '18px',
            letterSpacing: '0.16em',
            color: ADMIN_ACCENT,
            margin: 0,
          }}>
            ADMIN PANEL
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: '13px',
              color: C.muted,
            }} className="hidden sm:inline">
              {user?.email}
            </span>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: '#ECE7D9',
              backgroundColor: ADMIN_ACCENT,
              padding: '2px 8px',
              borderRadius: '2px',
            }}>
              Admin
            </span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Icon components
function DashboardIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function QuestionIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CollectionIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function FlagIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-11m0 0V8a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function DuplicateIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ElectionIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function AdminsIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

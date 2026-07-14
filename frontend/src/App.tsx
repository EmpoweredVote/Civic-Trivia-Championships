import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { AuthInitializer } from './components/AuthInitializer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SkipToContent } from './components/accessibility/SkipToContent';
import { LiveRegions } from './components/accessibility/LiveRegions';
import { ConfettiController } from './components/animations/ConfettiController';
import { useWebVitals } from './hooks/useWebVitals';
import { useAuthStore } from './store/authStore';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Game } from './pages/Game';
import { Profile } from './pages/Profile';
import { Forbidden } from './pages/Forbidden';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { QuestionsPage } from './pages/admin/QuestionsPage';
import { CollectionsPage } from './pages/admin/CollectionsPage';
import { FlagReviewPage } from './pages/admin/FlagReviewPage';
import { DuplicateReviewPage } from './pages/admin/DuplicateReviewPage';
import { ElectionsPage } from './pages/admin/ElectionsPage';
import { AdminsPage } from './pages/admin/AdminsPage';
import { Leaderboard } from './pages/Leaderboard';
import { Collections } from './pages/Collections';

// AdminGuard component: allows anyone with admin access (admin_users or a content-admin role)
function AdminGuard() {
  const { isAuthenticated, isLoading, tierResolved, isAdmin } = useAuthStore();

  if (isLoading || !tierResolved) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Forbidden />;

  return <Outlet />;
}

// SuperAdminGuard: restricts a route to super-admins only (e.g. Manage Admins)
function SuperAdminGuard() {
  const { isAuthenticated, isLoading, tierResolved, isSuperAdmin } = useAuthStore();

  if (isLoading || !tierResolved) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Forbidden />;

  return <Outlet />;
}

function PostHogPageview() {
  const location = useLocation();
  const posthog = usePostHog();
  useEffect(() => {
    posthog?.capture('$pageview');
    return () => { posthog?.capture('$pageleave'); };
  }, [location.pathname]);
  return null;
}

function App() {
  // Monitor Web Vitals in production
  useWebVitals();

  return (
    <BrowserRouter>
      <PostHogPageview />
      <SkipToContent />
      <LiveRegions />
      <ConfettiController />
      <AuthInitializer>
        <main id="main-content" tabIndex={-1}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/play" element={<Game />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/collections" element={<Collections />} />

            {/* Protected routes — require auth */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Admin routes — require admin role */}
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="questions" element={<QuestionsPage />} />
                <Route path="collections" element={<CollectionsPage />} />
                <Route path="flags" element={<FlagReviewPage />} />
                <Route path="duplicates" element={<DuplicateReviewPage />} />
                <Route path="elections" element={<ElectionsPage />} />
                {/* Manage Admins — super-admins only */}
                <Route element={<SuperAdminGuard />}>
                  <Route path="admins" element={<AdminsPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </main>
      </AuthInitializer>
    </BrowserRouter>
  );
}

export default App;

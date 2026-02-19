import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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

// AdminGuard component: checks for admin role
function AdminGuard() {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Forbidden />;

  return <Outlet />;
}

function App() {
  // Monitor Web Vitals in production
  useWebVitals();

  return (
    <BrowserRouter>
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

            {/* Protected routes — require auth */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Admin routes — require admin role */}
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                {/* Future admin routes will be added here in Phase 20 */}
              </Route>
            </Route>
          </Routes>
        </main>
      </AuthInitializer>
    </BrowserRouter>
  );
}

export default App;

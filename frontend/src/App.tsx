import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthInitializer } from './components/AuthInitializer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SkipToContent } from './components/accessibility/SkipToContent';
import { LiveRegions } from './components/accessibility/LiveRegions';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Game } from './pages/Game';
import { Profile } from './pages/Profile';

function App() {
  return (
    <BrowserRouter>
      <SkipToContent />
      <LiveRegions />
      <AuthInitializer>
        <main id="main-content" tabIndex={-1}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/play" element={<Game />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Routes>
        </main>
      </AuthInitializer>
    </BrowserRouter>
  );
}

export default App;

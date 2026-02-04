import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

export function Header() {
  const { user, accessToken, clearAuth, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

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

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold text-teal-600">Civic Trivia</h1>
          </div>

          {/* User info and logout */}
          {isAuthenticated && user && (
            <div className="flex items-center space-x-4">
              <span className="hidden sm:block text-sm text-gray-700">
                {user.name || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

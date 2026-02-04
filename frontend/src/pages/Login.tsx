import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import type { AuthError } from '../types/auth';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await authService.login({ email, password });
      setAuth(response.accessToken, response.user);
      navigate('/');
    } catch (err) {
      const authError = err as AuthError;

      if (authError.errors && authError.errors.length > 0) {
        const errors: Record<string, string> = {};
        authError.errors.forEach((e) => {
          errors[e.field] = e.message;
        });
        setFieldErrors(errors);
      } else if (authError.error) {
        setError(authError.error);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back to Civic Trivia Championship
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <Input
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <div className="pt-2">
            <Button type="submit" loading={loading} disabled={loading}>
              Sign in
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-medium text-teal-600 hover:text-teal-500"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

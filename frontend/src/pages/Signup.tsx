import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import type { AuthError } from '../types/auth';

export function Signup() {
  const [name, setName] = useState('');
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
      // First signup
      await authService.signup({ name, email, password });

      // Auto-login after successful signup
      const loginResponse = await authService.login({ email, password });
      setAuth(loginResponse.accessToken, loginResponse.user);
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
            Create your account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Join Civic Trivia Championship today
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Full name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            placeholder="John Doe"
            autoComplete="name"
            required
          />

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

          <div>
            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={loading} disabled={loading}>
              Create account
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-teal-600 hover:text-teal-500"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

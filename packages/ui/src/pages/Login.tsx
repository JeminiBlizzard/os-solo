import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, ApiError } from '@/lib/api';
import { useSession } from '@/hooks/useSession';

interface LoginResponse {
  user: {
    id: number;
    email: string;
    displayName: string;
  };
}

export function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: sessionLoading, invalidateSession } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, sessionLoading, navigate]);

  // Focus password input on mount
  useEffect(() => {
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, []);

  // Handle rate limit countdown
  useEffect(() => {
    if (rateLimitedUntil === null) return;

    const timer = setInterval(() => {
      const now = Date.now();
      if (now >= rateLimitedUntil) {
        setRateLimitedUntil(null);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitedUntil]);

  const loginMutation = useMutation({
    mutationFn: async (pw: string) => {
      return await apiClient.post<LoginResponse>('/api/v1/auth/login', { password: pw });
    },
    onSuccess: () => {
      invalidateSession();
      navigate('/', { replace: true });
    },
    onError: (err: Error) => {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('Incorrect password');
          toast.error('Incorrect password');
        } else if (err.status === 429) {
          setError('Too many attempts');
          toast.error('Too many attempts. Please wait before trying again.');
          // Disable submit for 60 seconds
          setRateLimitedUntil(Date.now() + 60 * 1000);
        }
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    loginMutation.mutate(password);
  };

  const isDisabled = loginMutation.isPending || rateLimitedUntil !== null;
  const remainingSeconds = rateLimitedUntil
    ? Math.ceil((rateLimitedUntil - Date.now()) / 1000)
    : 0;

  // Show loading while checking session
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-10">
        <div className="text-gray-60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4">
            <span className="text-2xl font-semibold text-gray-100">OS // SOLO</span>
          </div>
          <CardTitle className="text-xl text-gray-80">Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                ref={passwordInputRef}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className={error ? 'border-red-500' : ''}
                disabled={isDisabled}
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-brand-blue hover:bg-brand-blue/90"
              disabled={isDisabled}
            >
              {loginMutation.isPending
                ? 'Signing in...'
                : rateLimitedUntil
                ? `Wait ${remainingSeconds}s`
                : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams, useRouter as useNavigationRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface RegisterResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
}

async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<RegisterResponse | null> {
  try {
    // Use relative URL to leverage Next.js rewrites
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(error.message || `Registration failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.access_token && data.user) {
      return data as RegisterResponse;
    }
    
    return null;
  } catch (error) {
    throw error;
  }
}

function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useNavigationRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const result = await registerUser(email, password, name || email.split('@')[0]);
      
      if (result) {
        // Auto sign in after registration
        const signInResult = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (signInResult?.error) {
          setError('Registration successful but auto-login failed. Please sign in manually.');
        } else {
          // Force session update to ensure accessToken is synced to client state
          await update();
          router.push(callbackUrl);
        }
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking session
  if (status === 'loading') {
    return (
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  // Don't render register form if authenticated (will redirect)
  if (status === 'authenticated') {
    return null;
  }

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="text-muted-foreground">Sign up for your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name (optional)
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <button
        onClick={() => signIn('google', { callbackUrl })}
        className="w-full py-2 px-4 border rounded-md hover:bg-accent"
      >
        Sign up with Google
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/login" className="text-primary hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}

function RegisterFormWithSuspense() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}

export default function RegisterPage() {
  return <RegisterFormWithSuspense />;
}

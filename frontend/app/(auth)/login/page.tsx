  'use client';

  import { Suspense, useState, useEffect } from 'react';
  import { signIn, useSession } from 'next-auth/react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import { Loader2 } from 'lucide-react';

  function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
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

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setLoading(false);
      } else if (result?.ok) {
        // Force session update to ensure accessToken is synced to client state
        await update();
        router.push(callbackUrl);
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

  // Don't render login form if authenticated (will redirect)
  if (status === 'authenticated') {
    return null;
  }

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome Back</h1>
        <p className="text-muted-foreground">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}
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
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
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
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="w-full py-2 px-4 border rounded-md hover:bg-accent"
      >
        Sign in with Google
      </button>
    </div>
  );
}

function LoginFormWithSuspense() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

export default function LoginPage() {
  return <LoginFormWithSuspense />;
}

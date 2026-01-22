import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface InitializeSystemDto {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

interface InitializeSystemResponseDto {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface InitializationStatusDto {
  initialized: boolean;
  userCount: number;
  currencyCount?: number;
}

interface SetupError {
  statusCode?: number;
  message: string | string[];
  error?: string;
}

export function useSetup() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  };

  const checkStatus = useCallback(async (): Promise<InitializationStatusDto> => {
    const response = await fetch(`${getApiUrl()}/api/v1/setup/status`);
    if (!response.ok) {
      throw new Error('Failed to check initialization status');
    }
    return response.json();
  }, []);

  const initialize = useCallback(async (data: InitializeSystemDto, initSecret: string): Promise<InitializeSystemResponseDto> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/v1/setup/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Init-Secret': initSecret,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json() as InitializeSystemResponseDto | SetupError;

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('System is already initialized');
        }
        if (response.status === 403) {
          throw new Error('Invalid initialization secret');
        }
        if (response.status === 400 && Array.isArray(result.message)) {
          throw new Error(result.message.join('. '));
        }
        const errorMessage = typeof result.message === 'string' ? result.message : 'Initialization failed';
        throw new Error(errorMessage);
      }

      return result as InitializeSystemResponseDto;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const redirectToDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const redirectToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  return {
    isLoading,
    error,
    checkStatus,
    initialize,
    redirectToDashboard,
    redirectToLogin,
    clearError: () => setError(null),
  };
}

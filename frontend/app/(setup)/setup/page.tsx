'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SetupForm } from './setup-form';
import { useSetup } from '@/hooks/use-setup';

export default function SetupPage() {
  const router = useRouter();
  const { checkStatus, redirectToLogin } = useSetup();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkInitialization() {
      try {
        const status = await checkStatus();
        if (status.initialized) {
          // System already initialized, redirect to login
          redirectToLogin();
        }
      } catch {
        // If we can't check status, show the setup page
        // This might happen if the backend is not running yet
      } finally {
        setIsChecking(false);
      }
    }

    checkInitialization();
  }, [checkStatus, redirectToLogin]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <SetupForm />
    </div>
  );
}

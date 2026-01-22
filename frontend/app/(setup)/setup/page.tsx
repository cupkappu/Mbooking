'use client';

import { SetupForm } from './setup-form';
import { useSetup } from '@/hooks/use-setup';

export default function SetupPage() {
  const { status, isLoading, redirectToLogin } = useSetup();

  // Redirect to login if system is already initialized
  if (status?.initialized && !isLoading) {
    redirectToLogin();
    return null;
  }

  // Show loading state while checking status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking system status...</p>
        </div>
      </div>
    );
  }

  // Show setup form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <SetupForm />
    </div>
  );
}

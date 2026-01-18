'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { QueryProvider } from '@/providers/query-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <QueryProvider>
        {children}
      </QueryProvider>
    </NextAuthSessionProvider>
  );
}

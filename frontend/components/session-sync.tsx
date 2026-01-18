'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

// Extend the Session type to include accessToken
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
  }
}

export function SessionSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.accessToken) {
      try {
        localStorage.setItem('accessToken', session.accessToken);
      } catch (e) {
        // Silently handle storage errors
      }
    } else {
      // Clear token when session is null (logged out)
      try {
        localStorage.removeItem('accessToken');
      } catch (e) {
        // Silently handle storage errors
      }
    }
  }, [session]);

  return null;
}

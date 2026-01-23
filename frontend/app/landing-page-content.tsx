'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Header } from '@/components/home/header';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturesSection } from '@/components/home/features-section';
import { Footer } from '@/components/home/footer';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface InitializationStatus {
  initialized: boolean;
  userCount: number;
  currencyCount?: number;
}

export default function LandingPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if system is initialized
    const checkSetupStatus = async () => {
      try {
        const status = await apiClient.get<InitializationStatus>('/setup/status');
        setIsInitialized(status.initialized);
        
        if (!status.initialized && status.userCount === 0) {
          // System not initialized, redirect to setup
          router.replace('/setup');
        } else if (status.initialized && !session) {
          // System initialized but user not logged in, redirect to login
          router.replace('/login');
        }
        // If initialized and logged in, stay on landing page (will show dashboard link)
      } catch (error) {
        // If API fails, assume not initialized
        setIsInitialized(false);
        router.replace('/setup');
      }
    };

    checkSetupStatus();
  }, [router, session]);

  if (isInitialized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not initialized, don't render anything (will redirect)
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If initialized but not logged in, don't render anything (will redirect)
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAuthenticated = status === 'authenticated';
  const userName = session?.user?.name || null;

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated={isAuthenticated} userName={userName} />
      <main>
        <HeroSection isAuthenticated={isAuthenticated} />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
}

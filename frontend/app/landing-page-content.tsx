'use client';

import { useSession } from 'next-auth/react';
import { Header } from '@/components/home/header';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturesSection } from '@/components/home/features-section';
import { Footer } from '@/components/home/footer';
import { Loader2 } from 'lucide-react';

export default function LandingPageContent() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
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

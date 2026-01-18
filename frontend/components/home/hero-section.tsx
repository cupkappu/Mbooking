'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface HeroProps {
  isAuthenticated: boolean;
}

export function HeroSection({ isAuthenticated }: HeroProps) {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Multi-Currency Personal Accounting Software
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Beautiful, full-featured accounting with multi-currency support and
            double-entry bookkeeping.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={isAuthenticated ? '/dashboard' : '/login?signup=true'}>
              <Button size="lg" className="w-full sm:w-auto">
                {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Learn More ↓
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

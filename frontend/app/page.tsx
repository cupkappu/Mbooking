import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import the landing page content to avoid SSR issues with useSession
const LandingPageContent = dynamic(
  () => import('./landing-page-content'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export default function LandingPage() {
  return <LandingPageContent />;
}

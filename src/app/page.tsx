'use client';

import { useUser } from '@clerk/nextjs';
import { Store, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from '@/components/LoginPage';

export default function HomePage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/pos');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-4 select-none">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3.5 rounded-2xl shadow-xl shadow-emerald-500/25 text-white animate-pulse">
          <Store className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          <span>Loading Kassero Store...</span>
        </div>
      </div>
    );
  }

  // Not signed in
  return <LoginPage />;
}

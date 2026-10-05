'use client';

import { Store, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from '@/components/LoginPage';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsSignedIn(!!session);
      setIsLoaded(true);
      if (session) {
        router.push('/pos');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session);
      if (session) {
        router.push('/pos');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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

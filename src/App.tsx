import { Show, ClerkLoaded, ClerkLoading } from '@clerk/react';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import { Store, Loader2 } from 'lucide-react';

export default function App() {
  return (
    <>
      <ClerkLoading>
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-4 select-none">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3.5 rounded-2xl shadow-xl shadow-emerald-500/25 text-white animate-pulse">
            <Store className="w-8 h-8" />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            <span>Loading Kassero Store...</span>
          </div>
        </div>
      </ClerkLoading>

      <ClerkLoaded>
        <Show when="signed-in">
          <Layout />
        </Show>
        <Show when="signed-out">
          <LoginPage />
        </Show>
      </ClerkLoaded>
    </>
  );
}


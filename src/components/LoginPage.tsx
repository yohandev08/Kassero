'use client';

import React, { useState } from 'react';
import { Store, Moon, Sun, ShieldCheck, Loader2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/pos');
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/25 text-white">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-foreground">Kassero</h1>
            <p className="text-[11px] text-muted-foreground font-medium">Sari-Sari Store Management</p>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="flex items-center gap-2 text-xs font-medium cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Moon className="w-4 h-4 text-emerald-400" />
                <span>Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 z-10">
        <div className="text-center mb-6 max-w-md">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome to Kassero
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
            Please sign in to access your register, inventory, and utang ledger.
          </p>
        </div>

        <div className="w-full max-w-sm bg-card p-6 rounded-2xl shadow-lg border border-border/50">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive-foreground bg-destructive/90 rounded-lg">
                {error}
              </div>
            )}
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="store@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground z-10 border-t border-border/20">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Protected store authentication powered by Supabase</span>
      </footer>
    </div>
  );
}

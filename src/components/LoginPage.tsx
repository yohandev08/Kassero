'use client';

import React, { useState, useCallback } from 'react';
import { Store, Moon, Sun, ShieldCheck, Loader2, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function LoginPage(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    
    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please verify your store login details and try again.'
          : authError.message
      );
      setLoading(false);
    } else {
      router.push('/pos');
    }
  }, [email, password, router]);

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col justify-between relative overflow-hidden select-none">
      
      {/* 1. TOP HEADER */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2.5 rounded-xl shadow-md text-primary-foreground font-bold shrink-0">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight text-foreground">Kassero</h1>
            <p className="text-[11px] text-muted-foreground font-medium">Sari-Sari Store Management</p>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark/light theme"
          className="h-10 px-3 min-h-[44px] rounded-xl border border-border/60 flex items-center gap-2 hover:bg-muted text-foreground cursor-pointer text-xs font-bold transition-all active:scale-95 motion-reduce:transform-none"
        >
          {theme === 'dark' ? (
            <>
              <Moon className="w-4 h-4 text-primary" />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Light Mode</span>
            </>
          )}
        </button>
      </header>

      {/* 2. MAIN AUTHENTICATION CONTAINER */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 z-10 w-full">
        <div className="text-center mb-6 max-w-md w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3 border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Store Counter Portal</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Sign In to Kassero
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 font-medium max-w-sm mx-auto">
            Access your fast checkout register, customer utang ledger, and inventory database.
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-md bg-card p-6 sm:p-8 rounded-3xl shadow-sm border border-border/60">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl shadow-xs">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-0.5">
                Store Account Email
              </Label>
              <Input 
                id="email" 
                type="email" 
                inputMode="email"
                autoComplete="email"
                placeholder="store@example.com" 
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-12 min-h-[48px] rounded-xl bg-background border-input focus-visible:ring-primary/40 font-medium text-sm transition-colors"
              />
            </div>

            {/* Password Field with Reveal Toggle */}
            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-0.5">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••" 
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="h-12 min-h-[48px] pr-11 rounded-xl bg-background border-input focus-visible:ring-primary/40 font-medium text-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 min-h-[32px] min-w-[32px] flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer rounded-lg hover:bg-muted active:scale-90 transition-transform motion-reduce:transform-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={loading || !email.trim() || !password}
              className="w-full h-12 min-h-[48px] rounded-xl font-bold text-sm sm:text-base cursor-pointer mt-2 bg-primary hover:bg-primary/90 text-white shadow-sm active:scale-[0.98] transition-transform motion-reduce:transform-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing In to Store...</span>
                </div>
              ) : (
                'Sign In to Register'
              )}
            </Button>
          </form>

          {/* Quick Feature Badges */}
          <div className="mt-6 pt-5 border-t border-border/50 grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fast POS</span>
              <span className="text-[11px] font-semibold text-foreground">Instant Sales</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-x border-border/40">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Utang Ledger</span>
              <span className="text-[11px] font-semibold text-foreground">Zero Math Errors</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Inventory</span>
              <span className="text-[11px] font-semibold text-foreground">Stock Alerts</span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground z-10 border-t border-border/30 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span>Secure store session powered by Supabase authentication</span>
      </footer>
    </div>
  );
}

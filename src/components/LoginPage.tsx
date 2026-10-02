'use client';

import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/nextjs';
import { Store, Moon, Sun, ShieldCheck } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';

export default function LoginPage(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

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

        {/* Theme toggle & Mode toggle */}
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
            {mode === 'sign-in' ? 'Welcome to Kassero' : 'Create Store Account'}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
            {mode === 'sign-in'
              ? 'Please sign in to access your register, inventory, and utang ledger.'
              : 'Sign up to start managing your sari-sari store with ease.'}
          </p>

          {/* Toggle pill */}
          <div className="inline-flex items-center bg-muted/60 p-1 rounded-xl mt-4 border border-border/40">
            <button
              onClick={() => setMode('sign-in')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'sign-in'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('sign-up')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'sign-up'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Clerk Auth Component */}
        <div className="w-full flex justify-center">
          {mode === 'sign-in' ? (
            <SignIn routing="hash" />
          ) : (
            <SignUp routing="hash" />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground z-10 border-t border-border/20">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Protected store authentication powered by Clerk</span>
      </footer>
    </div>
  );
}

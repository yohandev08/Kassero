'use client';

import React, { useState } from 'react';
import { ShoppingCart, Users, Package, BarChart3, Store, Menu, X as CloseIcon, LogOut } from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { buttonVariants, Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  React.useEffect(() => {
    setMounted(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsAuthenticated(false);
        router.push('/');
      } else {
        setIsAuthenticated(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsAuthenticated(false);
        router.push('/');
      } else {
        setIsAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground gap-3 select-none">
        <div className="bg-primary/10 p-3 rounded-2xl text-primary animate-pulse">
          <Store className="w-8 h-8" />
        </div>
        <p className="text-xs font-bold text-muted-foreground animate-pulse">Verifying secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 h-14 border-b border-border/50 px-3.5 sm:px-6 flex items-center justify-between bg-card/60 backdrop-blur-md shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center hover:bg-muted text-foreground cursor-pointer active:scale-95 transition-all motion-reduce:transform-none"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline-block">
              Current View
            </span>
            <span className="text-muted-foreground/40 hidden sm:inline-block">•</span>
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {pathname === '/pos' && 'Point of Sale (POS)'}
              {pathname === '/ledger' && 'Utang & Customer Ledger'}
              {pathname === '/inventory' && 'Inventory & Restock'}
              {pathname === '/analytics' && 'Sales & Profit Analytics'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
            className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-xl border border-border/50 flex items-center justify-center hover:bg-muted text-foreground cursor-pointer transition-colors"
          >
            {mounted && theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </button>

          {/* Kassero Brand Badge */}
          <div className="flex items-center gap-2 bg-primary/10 px-2.5 py-1 rounded-xl border border-primary/20">
            <Store className="w-4 h-4 text-primary" />
            <span className="font-black text-xs sm:text-sm tracking-tight text-foreground">Kassero</span>
          </div>
        </div>
      </header>

      {/* 2. MOBILE BOTTOM NAVIGATION BAR */}
      <nav 
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/50 grid grid-cols-4 items-center z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <Link 
          href="/pos" 
          className={cn(
            'flex flex-col items-center justify-center h-full min-h-[44px] gap-1 text-[10px] font-bold transition-all active:scale-95 motion-reduce:transform-none select-none',
            pathname === '/pos' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn('p-1.5 rounded-xl transition-colors', pathname === '/pos' && 'bg-primary/15 text-primary')}>
            <ShoppingCart className="w-5 h-5" />
          </div>
          <span>POS</span>
        </Link>
        <Link 
          href="/ledger" 
          className={cn(
            'flex flex-col items-center justify-center h-full min-h-[44px] gap-1 text-[10px] font-bold transition-all active:scale-95 motion-reduce:transform-none select-none',
            pathname === '/ledger' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn('p-1.5 rounded-xl transition-colors', pathname === '/ledger' && 'bg-primary/15 text-primary')}>
            <Users className="w-5 h-5" />
          </div>
          <span>Ledger</span>
        </Link>
        <Link 
          href="/inventory" 
          className={cn(
            'flex flex-col items-center justify-center h-full min-h-[44px] gap-1 text-[10px] font-bold transition-all active:scale-95 motion-reduce:transform-none select-none',
            pathname === '/inventory' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn('p-1.5 rounded-xl transition-colors', pathname === '/inventory' && 'bg-primary/15 text-primary')}>
            <Package className="w-5 h-5" />
          </div>
          <span>Inventory</span>
        </Link>
        <Link 
          href="/analytics" 
          className={cn(
            'flex flex-col items-center justify-center h-full min-h-[44px] gap-1 text-[10px] font-bold transition-all active:scale-95 motion-reduce:transform-none select-none',
            pathname === '/analytics' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className={cn('p-1.5 rounded-xl transition-colors', pathname === '/analytics' && 'bg-primary/15 text-primary')}>
            <BarChart3 className="w-5 h-5" />
          </div>
          <span>Analytics</span>
        </Link>
      </nav>

      {/* 3. SIDEBAR DRAWER OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 4. HAMBURGER SIDEBAR DRAWER */}
      <aside className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col justify-between p-4 sm:p-5 shadow-2xl border-r border-sidebar-border z-50 select-none",
        "fixed inset-y-0 left-0 transform transition-transform duration-300 ease-in-out w-72 sm:w-80",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close Button */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close navigation menu"
          className="absolute top-4 right-4 h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer active:scale-95 transition-all motion-reduce:transform-none"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          {/* Store Brand Header */}
          <div className="flex items-center gap-3 px-2 py-1 mt-2">
            <div className="bg-primary p-2.5 rounded-xl shadow-md text-primary-foreground font-bold shrink-0">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-black text-base tracking-tight text-sidebar-foreground">Kassero</h2>
              <p className="text-[11px] text-muted-foreground font-medium">Sari-Sari Store Management</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 flex flex-col">
            <Link
              href="/pos"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-sm font-bold gap-3 h-12 min-h-[44px] px-3.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-[0.98] motion-reduce:transform-none',
                pathname === '/pos'
                  ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <ShoppingCart className="w-5 h-5 shrink-0" />
              <span>POS / Counter Register</span>
            </Link>

            <Link
              href="/ledger"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-sm font-bold gap-3 h-12 min-h-[44px] px-3.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-[0.98] motion-reduce:transform-none',
                pathname === '/ledger'
                  ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Users className="w-5 h-5 shrink-0" />
              <span>Utang & Customer Ledger</span>
            </Link>

            <Link
              href="/inventory"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-sm font-bold gap-3 h-12 min-h-[44px] px-3.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-[0.98] motion-reduce:transform-none',
                pathname === '/inventory'
                  ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Package className="w-5 h-5 shrink-0" />
              <span>Inventory & Restock</span>
            </Link>

            <Link
              href="/analytics"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-sm font-bold gap-3 h-12 min-h-[44px] px-3.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-[0.98] motion-reduce:transform-none',
                pathname === '/analytics'
                  ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <BarChart3 className="w-5 h-5 shrink-0" />
              <span>Sales & Profit Analytics</span>
            </Link>
          </nav>
        </div>

        {/* Footer Auth & Theme Toggle */}
        <div className="border-t border-sidebar-border pt-4 pb-2 space-y-3.5">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs font-bold text-sidebar-foreground/80">
              {mounted && theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
              <span>{mounted && theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme mode"
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                mounted && theme === 'dark' ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  mounted && theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="px-1">
            <Button 
              variant="ghost" 
              onClick={handleSignOut} 
              className="w-full justify-start text-sm font-bold text-foreground cursor-pointer h-11 min-h-[44px] rounded-xl bg-sidebar-accent/50 hover:bg-destructive/10 hover:text-destructive border border-sidebar-border/50 gap-2 active:scale-[0.98] transition-all motion-reduce:transform-none"
            >
              <LogOut className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-destructive" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* 5. MAIN VIEW AREA */}
      <main className="flex-1 bg-background p-2 sm:p-4 md:p-6 w-full max-w-full min-h-0">
        {children}
      </main>
    </div>
  );
}

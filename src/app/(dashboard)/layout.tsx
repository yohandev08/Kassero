'use client';

import React, { useState } from 'react';
import { ShoppingCart, Users, Package, BarChart3, Store, Menu, X as CloseIcon } from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { buttonVariants, Button } from '@/components/ui/button';
import { cn } from 'cn';
import { supabase } from '@/lib/supabase';

export default function DashboardLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground pb-16 lg:pb-0">
      
      {/* TOP NAVIGATION BAR */}
      <header className="h-14 border-b border-border/40 px-4 md:px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0 z-30">
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted text-foreground cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:inline-block">
            Current View
          </span>
          <span className="text-muted-foreground/40 hidden sm:inline-block">•</span>
          <span className="text-sm font-semibold text-foreground">
            {pathname === '/pos' && 'Point of Sale (POS)'}
            {pathname === '/ledger' && 'Utang & Customer Ledger'}
            {pathname === '/inventory' && 'Inventory & Stock Management'}
            {pathname === '/analytics' && 'Sales & Profit Analytics'}
          </span>
        </div>
        <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
              <Store className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-wide">Kassero</span>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/40 flex items-center justify-around z-40 shadow-[0_-4px_15px_rgba(0,0,0,0.03)] pb-safe h-16">
        <Link 
          href="/pos" 
          className={cn('flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-semibold transition-colors', pathname === '/pos' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
        >
          <div className={cn('p-1 rounded-full', pathname === '/pos' && 'bg-primary/10')}>
             <ShoppingCart className="w-5 h-5" />
          </div>
          <span>POS</span>
        </Link>
        <Link 
          href="/ledger" 
          className={cn('flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-semibold transition-colors', pathname === '/ledger' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
        >
          <div className={cn('p-1 rounded-full', pathname === '/ledger' && 'bg-primary/10')}>
             <Users className="w-5 h-5" />
          </div>
          <span>Customers</span>
        </Link>
        <Link 
          href="/inventory" 
          className={cn('flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-semibold transition-colors', pathname === '/inventory' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
        >
          <div className={cn('p-1 rounded-full', pathname === '/inventory' && 'bg-primary/10')}>
             <Package className="w-5 h-5" />
          </div>
          <span>Inventory</span>
        </Link>
        <Link 
          href="/analytics" 
          className={cn('flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-semibold transition-colors', pathname === '/analytics' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
        >
          <div className={cn('p-1 rounded-full', pathname === '/analytics' && 'bg-primary/10')}>
             <BarChart3 className="w-5 h-5" />
          </div>
          <span>Analytics</span>
        </Link>
      </nav>

      {/* DRAWER OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* HAMBURGER SIDEBAR DRAWER */}
      <aside className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col justify-between p-4 shadow-2xl border-r border-sidebar-border z-50 select-none",
        "fixed inset-y-0 left-0 transform transition-transform duration-300 ease-in-out w-72",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close Button */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          {/* Store Brand Header */}
          <div className="flex items-center gap-3 px-2 py-1 mt-2">
            <div className="bg-primary p-2.5 rounded-xl shadow-lg text-primary-foreground font-bold">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-sidebar-foreground">Kassero</h1>
              <p className="text-[11px] text-muted-foreground font-medium">Sari-Sari Store Management</p>
            </div>
          </div>

          {/* Nav Items (Hidden on Mobile, visible in drawer on Desktop if needed, but since it's a drawer, let's keep them visible for both just in case) */}
          <nav className="space-y-1.5 flex flex-col">
            <Link
              href="/pos"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-sm font-semibold gap-3 py-3 px-3 rounded-lg transition-all duration-200 cursor-pointer',
                pathname === '/pos'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <ShoppingCart className="w-5 h-5" /> POS / Register
            </Link>

            <Link
              href="/ledger"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-sm font-semibold gap-3 py-3 px-3 rounded-lg transition-all duration-200 cursor-pointer',
                pathname === '/ledger'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Users className="w-5 h-5" /> Utang & Customers
            </Link>

            <Link
              href="/inventory"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-sm font-semibold gap-3 py-3 px-3 rounded-lg transition-all duration-200 cursor-pointer',
                pathname === '/inventory'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Package className="w-5 h-5" /> Inventory & Restock
            </Link>

            <Link
              href="/analytics"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-sm font-semibold gap-3 py-3 px-3 rounded-lg transition-all duration-200 cursor-pointer',
                pathname === '/analytics'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <BarChart3 className="w-5 h-5" /> Sales & Profit
            </Link>
          </nav>
        </div>

        {/* Footer Auth & Theme Toggle */}
        <div className="border-t border-sidebar-border pt-4 pb-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground/70">
              {mounted && theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
              {mounted && theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </div>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme mode"
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ${mounted && theme === 'dark' ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${mounted && theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          <div className="px-2">
            <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start text-sm font-semibold text-foreground cursor-pointer bg-sidebar-accent/50 hover:bg-destructive/10 hover:text-destructive border border-sidebar-border/40">
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 bg-background p-2 sm:p-4 md:p-6 w-full max-w-full">
        {children}
      </main>
    </div>
  );
}

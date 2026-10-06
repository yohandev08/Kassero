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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="flex min-h-[100dvh] lg:h-[100dvh] bg-background text-foreground lg:overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={cn(
        "bg-sidebar text-sidebar-foreground flex flex-col justify-between p-4 shadow-2xl border-r border-sidebar-border z-50 select-none",
        "fixed inset-y-0 left-0 transform transition-transform duration-300 ease-in-out w-64 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close Button Mobile */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
        <div className="space-y-6">
          {/* Store Brand Header */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="bg-primary p-2.5 rounded-xl shadow-lg text-primary-foreground font-bold">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-sidebar-foreground">Kassero</h1>
              <p className="text-[11px] text-muted-foreground font-medium">Sari-Sari Store Management</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5 flex flex-col">
            <Link
              href="/pos"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-xs font-semibold gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 cursor-pointer',
                pathname === '/pos'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <ShoppingCart className="w-4 h-4" /> POS / Register
            </Link>

            <Link
              href="/ledger"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-xs font-semibold gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 cursor-pointer',
                pathname === '/ledger'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Users className="w-4 h-4" /> Utang & Customers
            </Link>

            <Link
              href="/inventory"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-xs font-semibold gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 cursor-pointer',
                pathname === '/inventory'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Package className="w-4 h-4" /> Inventory & Restock
            </Link>

            <Link
              href="/analytics"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'w-full justify-start text-xs font-semibold gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 cursor-pointer',
                pathname === '/analytics'
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <BarChart3 className="w-4 h-4" /> Sales & Profit
            </Link>
          </nav>
        </div>

        {/* Footer Auth & Theme Toggle */}
        <div className="border-t border-sidebar-border  pt-3.5 space-y-3">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-sidebar-accent/50 border border-sidebar-border/40">
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-xs text-foreground cursor-pointer">
              Sign Out
            </Button>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/70">
              {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-primary" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </div>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme mode"
              className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ${theme === 'dark' ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-md transition-transform ${theme === 'dark' ? 'translate-x-4.5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <div className="flex-1 flex flex-col lg:h-full lg:overflow-hidden w-full">
        {/* TOP NAVIGATION BAR */}
        <header className="h-14 border-b border-border/40 px-4 md:px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md hover:bg-muted text-foreground cursor-pointer"
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
        </header>

        <main className="flex-1 lg:overflow-auto bg-background p-2 sm:p-4 md:p-6 w-full max-w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

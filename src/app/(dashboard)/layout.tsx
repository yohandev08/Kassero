'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  Store,
  Menu,
  X as CloseIcon,
  LogOut,
  Moon,
  Sun,
  Crown,
  ShieldCheck,
  User as UserIcon,
  ShieldAlert,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { buttonVariants, Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, profile, role, isSuperAdmin, isAdmin, isCashier, loading: authLoading, signOut } = useAuth();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Route Access Guard
  useEffect(() => {
    if (authLoading) return;

    // Not authenticated -> redirect to login
    if (!user) {
      router.replace('/');
      return;
    }

    // Cashier restrictions: Only POS and Ledger
    if (isCashier) {
      if (pathname === '/inventory' || pathname === '/analytics' || pathname === '/users') {
        router.replace('/pos');
      }
    }

    // Admin restrictions: POS, Ledger, Inventory. (No Analytics or Users)
    if (role === 'admin') {
      if (pathname === '/analytics' || pathname === '/users') {
        router.replace('/pos');
      }
    }
  }, [user, role, isCashier, authLoading, pathname, router]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  // Loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground gap-3 select-none">
        <div className="bg-primary/10 p-3 rounded-2xl text-primary animate-pulse">
          <Store className="w-8 h-8" />
        </div>
        <p className="text-xs font-bold text-muted-foreground animate-pulse">
          Verifying security privileges...
        </p>
      </div>
    );
  }

  // Navigation Items defined based on RBAC permissions
  const navItems = [
    {
      href: '/pos',
      label: 'POS / Counter Register',
      shortLabel: 'POS',
      icon: ShoppingCart,
      allowed: true, // Everyone
    },
    {
      href: '/ledger',
      label: 'Utang & Customer Ledger',
      shortLabel: 'Ledger',
      icon: Users,
      allowed: true, // Everyone
    },
    {
      href: '/inventory',
      label: 'Inventory & Restock',
      shortLabel: 'Inventory',
      icon: Package,
      allowed: isAdmin || isSuperAdmin, // Admins & Superadmins
    },
    {
      href: '/analytics',
      label: 'Sales & Profit Analytics',
      shortLabel: 'Analytics',
      icon: BarChart3,
      allowed: isSuperAdmin, // Superadmin only
    },
    {
      href: '/users',
      label: 'Staff & Role Management',
      shortLabel: 'Staff',
      icon: Crown,
      allowed: isSuperAdmin, // Superadmin only
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.allowed);

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
              {pathname === '/users' && 'Staff & Role Management'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Active User Role Badge */}
          {isSuperAdmin && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-1.5 font-bold text-xs py-1 px-2.5 shadow-xs">
              <Crown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Owner</span>
              <span>Superadmin</span>
            </Badge>
          )}
          {role === 'admin' && (
            <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 gap-1.5 font-bold text-xs py-1 px-2.5 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Store</span>
              <span>Admin</span>
            </Badge>
          )}
          {isCashier && (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 gap-1.5 font-bold text-xs py-1 px-2.5 shadow-xs">
              <UserIcon className="w-3.5 h-3.5" />
              <span>Cashier</span>
            </Badge>
          )}

          {/* Quick theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
            className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-xl border border-border/50 flex items-center justify-center hover:bg-muted text-foreground cursor-pointer transition-colors"
          >
            {mounted && theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </button>

          {/* Kassero Brand Badge */}
          <div className="hidden sm:flex items-center gap-2 bg-primary/10 px-2.5 py-1 rounded-xl border border-primary/20">
            <Store className="w-4 h-4 text-primary" />
            <span className="font-black text-xs sm:text-sm tracking-tight text-foreground">Kassero</span>
          </div>
        </div>
      </header>

      {/* 2. MOBILE BOTTOM NAVIGATION BAR */}
      <nav 
        aria-label="Mobile Navigation"
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/50 items-center z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] grid",
          visibleNavItems.length === 2 && "grid-cols-2",
          visibleNavItems.length === 3 && "grid-cols-3",
          visibleNavItems.length === 4 && "grid-cols-4",
          visibleNavItems.length === 5 && "grid-cols-5",
        )}
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link 
              key={item.href}
              href={item.href} 
              className={cn(
                'flex flex-col items-center justify-center h-full min-h-[44px] gap-1 text-[10px] font-bold transition-all active:scale-95 motion-reduce:transform-none select-none',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn('p-1.5 rounded-xl transition-colors', isActive && 'bg-primary/15 text-primary')}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="truncate max-w-[60px]">{item.shortLabel}</span>
            </Link>
          );
        })}
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

          {/* User Profile Card */}
          <div className="p-3 rounded-2xl bg-sidebar-accent/50 border border-sidebar-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-sidebar-foreground truncate">
                  {profile?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-sidebar-border/40 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Privilege</span>
              {isSuperAdmin && (
                <span className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Superadmin
                </span>
              )}
              {role === 'admin' && (
                <span className="text-[10px] font-black uppercase text-blue-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Store Admin
                </span>
              )}
              {isCashier && (
                <span className="text-[10px] font-black uppercase text-emerald-500 flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> Cashier
                </span>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 flex flex-col">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'w-full justify-start text-sm font-bold gap-3 h-12 min-h-[44px] px-3.5 rounded-xl transition-all duration-150 cursor-pointer active:scale-[0.98] motion-reduce:transform-none',
                    isActive
                      ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
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

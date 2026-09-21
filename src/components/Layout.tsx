import React, { useState } from 'react';
import { ShoppingCart, Users, Package, BarChart3, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { UserButton } from '@clerk/react';
import { useSyncUserProfile } from '@/hooks/useSyncUserProfile';

import POS from './POS';
import CustomerLedger from './CustomerLedger';
import InventoryManager from './InventoryManager';
import SalesAnalytics from './SalesAnalytics';

export default function Layout(): React.JSX.Element {
  useSyncUserProfile();
  const [activeTab, setActiveTab] = useState<'pos' | 'ledger' | 'inventory' | 'analytics'>('pos');
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col justify-between p-4 shadow-2xl border-r border-sidebar-border z-10 select-none">
        <div className="space-y-6">
          {/* Store Brand Header */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-slate-950 font-bold">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-sidebar-foreground">Kassero</h1>
              <p className="text-[11px] text-muted-foreground font-medium">Sari-Sari Store Management</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            <Button
              variant="ghost"
              className={`w-full justify-start text-xs font-semibold gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'pos'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
              onClick={() => setActiveTab('pos')}
            >
              <ShoppingCart className="w-4 h-4" /> POS / Register
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-xs font-semibold gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
              onClick={() => setActiveTab('ledger')}
            >
              <Users className="w-4 h-4" /> Utang & Customers
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-xs font-semibold gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
              onClick={() => setActiveTab('inventory')}
            >
              <Package className="w-4 h-4" /> Inventory & Restock
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-xs font-semibold gap-3 py-2.5 px-3 rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart3 className="w-4 h-4" /> Sales & Profit
            </Button>
          </nav>
        </div>
        
        {/* Footer Auth & Theme Toggle */}
        <div className="border-t border-sidebar-border pt-3.5 space-y-3">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-sidebar-accent/50 border border-sidebar-border/40">
            <UserButton showName />
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/70">
              {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-emerald-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </div>
            <button 
              onClick={toggleTheme}
              aria-label="Toggle theme mode"
              className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                theme === 'dark' ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-md transition-transform ${
                  theme === 'dark' ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* TOP NAVIGATION BAR */}
        <header className="h-14 border-b border-border/40 px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current View
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-sm font-semibold text-foreground">
              {activeTab === 'pos' && 'Point of Sale (POS)'}
              {activeTab === 'ledger' && 'Utang & Customer Ledger'}
              {activeTab === 'inventory' && 'Inventory & Stock Management'}
              {activeTab === 'analytics' && 'Sales & Profit Analytics'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <UserButton showName />
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background p-6">
          {activeTab === 'pos' && <POS />}
          {activeTab === 'ledger' && <CustomerLedger />}
          {activeTab === 'inventory' && <InventoryManager />}
          {activeTab === 'analytics' && <SalesAnalytics />}
        </main>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ShoppingCart, Users, Package, BarChart3, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

import POS from './POS';
import CustomerLedger from './CustomerLedger';
import InventoryManager from './InventoryManager';
import SalesAnalytics from './SalesAnalytics';

export default function Layout(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'pos' | 'ledger' | 'inventory' | 'analytics'>('pos');

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between p-4 shadow-xl">
        <div className="space-y-6">
          {/* Store Brand Header */}
          <div className="flex items-center gap-3 px-2">
            <div className="bg-emerald-500 p-2 rounded-lg text-slate-900">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight text-slate-100">Tindahan POS</h1>
              <p className="text-[10px] text-slate-400">Sari-Sari Store Management</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1">
            <Button
              variant="ghost"
              className={`w-full justify-start text-xs font-medium gap-3 ${
                activeTab === 'pos'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              onClick={() => setActiveTab('pos')}
            >
              <ShoppingCart className="w-4 h-4" /> POS / Register
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-xs font-medium gap-3 ${
                activeTab === 'ledger'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              onClick={() => setActiveTab('ledger')}
            >
              <Users className="w-4 h-4" /> Utang & Customers
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-xs font-medium gap-3 ${
                activeTab === 'inventory'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              onClick={() => setActiveTab('inventory')}
            >
              <Package className="w-4 h-4" /> Inventory & Restock
            </Button>

            <Button
              variant="ghost"
              className={`w-full justify-start text-xs font-medium gap-3 ${
                activeTab === 'analytics'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart3 className="w-4 h-4" /> Sales & Profit
            </Button>
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-3 text-center">
          <p className="text-[10px] text-slate-500">Connected to Supabase</p>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'pos' && <POS />}
        {activeTab === 'ledger' && <CustomerLedger />}
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'analytics' && <SalesAnalytics />}
      </main>
    </div>
  );
}
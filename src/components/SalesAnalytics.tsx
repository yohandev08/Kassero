'use client';

import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import type { Sale } from '@/types';
import { fetchSalesWithItems } from '@/services/sales.Service';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  ShoppingBag,
  Award,
  Search,
  X,
  Calendar,
  BarChart3,
  RotateCcw,
  Receipt,
  Coins,
  Smartphone,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- shadcn/ui components ---
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TimeRange = 'all' | 'today' | 'week' | 'month';
type PaymentFilter = 'all' | 'Cash' | 'Utang' | 'Digital';

export default function SalesAnalytics(): React.JSX.Element {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 15;

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const fetchSalesData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchSalesWithItems();

    if (error) {
      console.error('Error fetching sales analytics:', error);
    } else {
      setSales((data as unknown as Sale[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange, paymentFilter, deferredSearchQuery]);

  // 1. Filter Sales by Time Range
  const salesByTime = useMemo(() => {
    if (timeRange === 'all') return sales;
    const now = new Date();

    if (timeRange === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return sales.filter(s => new Date(s.created_at).getTime() >= startOfToday);
    }

    if (timeRange === 'week') {
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return sales.filter(s => new Date(s.created_at).getTime() >= sevenDaysAgo);
    }

    if (timeRange === 'month') {
      const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      return sales.filter(s => new Date(s.created_at).getTime() >= thirtyDaysAgo);
    }

    return sales;
  }, [sales, timeRange]);

  // 2. Compute Financial Metrics & Top Products (Single-Pass Memo)
  const analytics = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let cashSales = 0;
    let utangSales = 0;
    let digitalSales = 0;

    const productSalesMap: Record<string, { quantity: number; revenue: number; profit: number }> = {};

    for (let i = 0; i < salesByTime.length; i++) {
      const sale = salesByTime[i];
      totalRevenue += sale.total_amount;

      if (sale.payment_type === 'Cash') cashSales += sale.total_amount;
      else if (sale.payment_type === 'Utang') utangSales += sale.total_amount;
      else if (sale.payment_type === 'Digital') digitalSales += sale.total_amount;

      if (sale.sale_items) {
        for (let j = 0; j < sale.sale_items.length; j++) {
          const item = sale.sale_items[j];
          const cost = item.products?.cost_price || 0;
          const itemProfit = item.subtotal - item.quantity * cost;
          totalProfit += itemProfit;

          const prodName = item.products?.product_name || 'General Item';
          if (!productSalesMap[prodName]) {
            productSalesMap[prodName] = { quantity: 0, revenue: 0, profit: 0 };
          }
          productSalesMap[prodName].quantity += item.quantity;
          productSalesMap[prodName].revenue += item.subtotal;
          productSalesMap[prodName].profit += itemProfit;
        }
      }
    }

    const profitMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const cashPercent = totalRevenue > 0 ? (cashSales / totalRevenue) * 100 : 0;
    const utangPercent = totalRevenue > 0 ? (utangSales / totalRevenue) * 100 : 0;
    const digitalPercent = totalRevenue > 0 ? (digitalSales / totalRevenue) * 100 : 0;

    const topProducts = Object.entries(productSalesMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const maxSold = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.quantity)) : 1;

    return {
      totalRevenue,
      totalProfit,
      profitMarginPercent,
      cashSales,
      utangSales,
      digitalSales,
      cashPercent,
      utangPercent,
      digitalPercent,
      topProducts,
      maxSold,
      totalTransactions: salesByTime.length,
    };
  }, [salesByTime]);

  // 3. Filter Sales for Table (Payment type + Search query)
  const filteredSales = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return salesByTime.filter((sale) => {
      // Payment type filter
      if (paymentFilter !== 'all' && sale.payment_type !== paymentFilter) {
        return false;
      }

      // Search query filter (Sale ID or item names)
      if (query) {
        const matchesId = sale.sale_id.toString().includes(query) || `#${sale.sale_id}`.includes(query);
        const matchesItem = sale.sale_items?.some(item => 
          (item.products?.product_name || '').toLowerCase().includes(query)
        );
        if (!matchesId && !matchesItem) return false;
      }

      return true;
    });
  }, [salesByTime, paymentFilter, deferredSearchQuery]);

  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = useMemo(() => {
    return filteredSales.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredSales, currentPage]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 p-1 sm:p-2 pb-8">
      {/* 1. HEADER & TIME FILTER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 bg-background p-3.5 sm:p-4 rounded-2xl shadow-xs border border-border/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Sales & Profit Analytics</h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              Track store earnings, net profit margins, and payment channel breakdowns.
            </p>
          </div>
        </div>

        {/* Time Range Filter Pills */}
        <div className="w-full sm:w-auto shrink-0">
          <Tabs
            value={timeRange}
            onValueChange={(val) => setTimeRange(val as TimeRange)}
            className="w-full sm:w-auto"
          >
            <TabsList className="h-11 min-h-[44px] p-1 bg-muted/60 border border-border/50 rounded-xl w-full sm:w-auto grid grid-cols-4">
              <TabsTrigger
                value="today"
                className="rounded-lg text-xs font-bold px-3 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
              >
                Today
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="rounded-lg text-xs font-bold px-3 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
              >
                7 Days
              </TabsTrigger>
              <TabsTrigger
                value="month"
                className="rounded-lg text-xs font-bold px-3 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
              >
                30 Days
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="rounded-lg text-xs font-bold px-3 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
              >
                All Time
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 2. CORE METRICS SLABS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        {/* Total Revenue */}
        <Card className="border-border/60 bg-background shadow-xs rounded-2xl overflow-hidden group hover:border-primary/40 transition-colors">
          <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between gap-2">
            <div className="flex justify-between items-start">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                Total Sales Revenue
              </p>
              <div className="p-2 rounded-xl bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
                ₱{analytics.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Gross counter sales volume
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Net Estimated Profit */}
        <Card className="border-emerald-500/30 bg-background shadow-xs rounded-2xl overflow-hidden group hover:border-emerald-500/50 transition-colors">
          <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between gap-2">
            <div className="flex justify-between items-start">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                Net Estimated Profit
              </p>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 transition-colors shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                +₱{analytics.totalProfit.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
                  {analytics.profitMarginPercent.toFixed(1)}% margin
                </Badge>
                <span className="text-[11px] text-muted-foreground">after product cost</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Transactions */}
        <Card className="border-border/60 bg-background shadow-xs rounded-2xl overflow-hidden group hover:border-primary/40 transition-colors">
          <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between gap-2">
            <div className="flex justify-between items-start">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                Total Transactions
              </p>
              <div className="p-2 rounded-xl bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
                {analytics.totalTransactions}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Completed counter checkouts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Utang Credit Exposure */}
        <Card className="border-rose-500/30 bg-background shadow-xs rounded-2xl overflow-hidden group hover:border-rose-500/50 transition-colors">
          <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between gap-2">
            <div className="flex justify-between items-start">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400 tracking-wider">
                Utang (Credit) Sales
              </p>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20 transition-colors shrink-0">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                ₱{analytics.utangSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                {analytics.utangPercent.toFixed(1)}% of total sales volume
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. PAYMENT BREAKDOWN & TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 lg:gap-4 shrink-0">
        
        {/* Payment Method Breakdown */}
        <Card className="border-border/60 bg-background shadow-xs rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="p-3.5 sm:p-4 pb-3 border-b border-border/50 bg-muted/15">
            <CardTitle className="text-base sm:text-lg font-black text-foreground">Payment Channels</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Revenue share by payment channel</CardDescription>
          </CardHeader>

          <CardContent className="p-3.5 sm:p-4 space-y-3.5 flex-1 flex flex-col justify-between">
            {/* Multi-color segment visual progress bar */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-muted-foreground mb-1.5">
                <span>Distribution Mix</span>
                <span className="tabular-nums">100%</span>
              </div>
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted/60">
                <div 
                  style={{ width: `${analytics.cashPercent}%` }} 
                  className="bg-primary h-full transition-all duration-500"
                  title={`Cash: ${analytics.cashPercent.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${analytics.utangPercent}%` }} 
                  className="bg-rose-500 h-full transition-all duration-500"
                  title={`Utang: ${analytics.utangPercent.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${analytics.digitalPercent}%` }} 
                  className="bg-cyan-500 h-full transition-all duration-500"
                  title={`Digital: ${analytics.digitalPercent.toFixed(1)}%`}
                />
              </div>
            </div>

            {/* Breakdown Cards */}
            <div className="space-y-2.5">
              {/* Cash */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-primary block">Cash Sales</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{analytics.cashPercent.toFixed(1)}% share</span>
                  </div>
                </div>
                <span className="font-black text-sm sm:text-base text-primary tabular-nums">
                  ₱{analytics.cashSales.toFixed(2)}
                </span>
              </div>

              {/* Utang */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 block">Utang (Credit)</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{analytics.utangPercent.toFixed(1)}% share</span>
                  </div>
                </div>
                <span className="font-black text-sm sm:text-base text-rose-600 dark:text-rose-400 tabular-nums">
                  ₱{analytics.utangSales.toFixed(2)}
                </span>
              </div>

              {/* Digital */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-cyan-600 dark:text-cyan-400 block">GCash / Digital</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{analytics.digitalPercent.toFixed(1)}% share</span>
                  </div>
                </div>
                <span className="font-black text-sm sm:text-base text-cyan-600 dark:text-cyan-400 tabular-nums">
                  ₱{analytics.digitalSales.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card className="lg:col-span-2 border-border/60 bg-background shadow-xs rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="p-3.5 sm:p-4 pb-3 border-b border-border/50 bg-muted/15">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base sm:text-lg font-black flex items-center gap-2 text-foreground">
                  <Award className="w-5 h-5 text-amber-500" />
                  Top Selling Products
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Ranked by units sold in the selected period</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-bold px-2.5 py-0.5 border-border/60">
                Top 5
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-3.5 sm:p-4 flex-1 flex flex-col justify-center">
            {analytics.topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center">
                <Award className="w-10 h-10 opacity-30 mb-2 text-muted-foreground" />
                <p className="font-bold text-sm text-foreground">No sales recorded for this timeframe</p>
                <p className="text-xs text-muted-foreground mt-0.5">Try switching the time filter to "All Time" to see product rankings.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.topProducts.map((product, index) => {
                  const relativePercentage = (product.quantity / analytics.maxSold) * 100;

                  return (
                    <div 
                      key={product.name} 
                      className="p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={cn(
                            "w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 tabular-nums",
                            index === 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30" :
                            index === 1 ? "bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-500/30" :
                            index === 2 ? "bg-amber-800/15 text-amber-800 dark:text-amber-300 border border-amber-800/30" :
                            "bg-muted text-muted-foreground"
                          )}>
                            #{index + 1}
                          </span>
                          <span className="font-bold text-foreground text-sm truncate">{product.name}</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="secondary" className="text-[11px] font-bold px-2 py-0 bg-primary/10 text-primary border border-primary/20 tabular-nums">
                            {product.quantity} sold
                          </Badge>
                          <span className="font-black text-sm text-foreground tabular-nums w-20 text-right">
                            ₱{product.revenue.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Visual volume proportion bar */}
                      <div className="w-full bg-muted/50 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary/80 h-full rounded-full transition-all duration-300"
                          style={{ width: `${relativePercentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. RECENT SALES TRANSACTIONS AUDIT LOG */}
      <Card className="border-border/60 bg-background shadow-xs rounded-2xl overflow-hidden flex flex-col mb-6">
        <CardHeader className="p-3.5 sm:p-4 pb-3 border-b border-border/50 bg-muted/15 shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-foreground">Sales Transaction History</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Individual receipt logs and payment audit records</CardDescription>
            </div>

            {/* Filter by payment channel & search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search sale ID or item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-10 min-h-[40px] text-xs sm:text-sm bg-background border-input rounded-xl focus-visible:ring-primary/40 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-md"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Payment filter pills */}
              <div className="flex gap-1.5 overflow-x-auto">
                {(['all', 'Cash', 'Utang', 'Digital'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setPaymentFilter(filter)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap active:scale-95 motion-reduce:transform-none",
                      paymentFilter === filter
                        ? filter === 'Cash'
                          ? "bg-primary text-white border-primary shadow-xs"
                          : filter === 'Utang'
                            ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                            : filter === 'Digital'
                              ? "bg-cyan-600 text-white border-cyan-600 shadow-xs"
                              : "bg-foreground text-background border-foreground shadow-xs"
                        : "bg-background border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {filter === 'all' ? 'All Channels' : filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex flex-col">
          <div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Receipt className="w-8 h-8 opacity-40 animate-pulse text-primary mb-2" />
                <p className="font-bold text-sm text-foreground">Loading sales history...</p>
                <p className="text-xs text-muted-foreground">Retrieving past transactions and line items</p>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center p-4">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-2">
                  <Receipt className="w-6 h-6 opacity-40" />
                </div>
                <p className="font-bold text-base text-foreground">No matching sales records found</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  {searchQuery || paymentFilter !== 'all' || timeRange !== 'all'
                    ? 'No transactions match your current search, time range, or payment filter.'
                    : 'No sales have been completed yet in Kassero.'}
                </p>
                {(searchQuery || paymentFilter !== 'all' || timeRange !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setPaymentFilter('all');
                      setTimeRange('all');
                    }}
                    className="mt-3 rounded-xl font-bold h-9 gap-1.5 border-border/60 cursor-pointer text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[650px]">
                    <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider font-bold border-b border-border/50 sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="p-3.5 pl-4">Receipt</th>
                        <th className="p-3.5">Timestamp</th>
                        <th className="p-3.5">Items Purchased</th>
                        <th className="p-3.5">Channel</th>
                        <th className="p-3.5 pr-4 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {paginatedSales.map((sale) => (
                        <tr key={sale.sale_id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3.5 pl-4 font-mono font-bold text-muted-foreground text-xs">
                            #{sale.sale_id}
                          </td>
                          <td className="p-3.5 font-medium text-foreground text-xs">
                            {new Date(sale.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                          <td className="p-3.5 text-xs text-muted-foreground font-medium">
                            {sale.sale_items && sale.sale_items.length > 0 ? (
                              <span className="truncate max-w-[280px] inline-block align-middle">
                                {sale.sale_items.map(item => `${item.quantity}x ${item.products?.product_name || 'Item'}`).join(', ')}
                              </span>
                            ) : (
                              'General Sale'
                            )}
                          </td>
                          <td className="p-3.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] uppercase tracking-wider font-bold",
                                sale.payment_type === 'Utang'
                                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  : sale.payment_type === 'Digital'
                                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                    : 'border-primary/30 bg-primary/10 text-primary'
                              )}
                            >
                              {sale.payment_type}
                            </Badge>
                          </td>
                          <td className="p-3.5 pr-4 text-right font-black text-foreground tabular-nums">
                            ₱{sale.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View */}
                <div className="grid grid-cols-1 gap-2.5 p-3 sm:p-4 md:hidden">
                  {paginatedSales.map((sale) => (
                    <Card key={sale.sale_id} className="border-border/60 shadow-xs relative overflow-hidden bg-background">
                      <CardContent className="p-3.5 flex flex-col gap-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Sale #{sale.sale_id}
                            </span>
                            <span className="text-xs font-semibold text-foreground mt-0.5">
                              {new Date(sale.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase tracking-wider font-bold shrink-0",
                              sale.payment_type === 'Utang'
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : sale.payment_type === 'Digital'
                                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                                  : 'border-primary/30 bg-primary/10 text-primary'
                            )}
                          >
                            {sale.payment_type}
                          </Badge>
                        </div>

                        {/* Purchased item summary snippet */}
                        {sale.sale_items && sale.sale_items.length > 0 && (
                          <div className="p-2 rounded-lg bg-muted/40 text-[11px] text-muted-foreground border border-border/40 line-clamp-2">
                            {sale.sale_items.map(item => `${item.quantity}x ${item.products?.product_name || 'Item'}`).join(', ')}
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-border/40">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            {sale.sale_items?.length || 0} items
                          </span>
                          <span className="text-sm font-black text-foreground tabular-nums">
                            ₱{sale.total_amount.toFixed(2)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 sm:p-4 border-t border-border/40 bg-muted/10 gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-10 min-h-[40px] px-3.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer"
              >
                Previous
              </Button>
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-10 min-h-[40px] px-3.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
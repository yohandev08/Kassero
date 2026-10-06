'use client';

import React, { useState, useEffect } from 'react';
import type { Sale } from '@/types';
import { fetchSalesWithItems } from '@/services/sales.Service';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  ShoppingBag,
  Award
} from 'lucide-react';

// --- shadcn/ui components ---
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SalesAnalytics(): React.JSX.Element {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    const { data, error } = await fetchSalesWithItems();

    if (error) {
      console.error('Error fetching sales analytics:', error);
    } else {
      setSales((data as unknown as Sale[]) || []);
    }
    setLoading(false);
  };

  // --- Financial Computations ---
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);

  // Profit calculation = Subtotal - (Quantity * Cost Price)
  let totalProfit = 0;
  const productSalesMap: Record<string, { qty: number; revenue: number }> = {};

  sales.forEach((sale) => {
    sale.sale_items?.forEach((item) => {
      const cost = item.products?.cost_price || 0;
      const profitFromItem = item.subtotal - item.quantity * cost;
      totalProfit += profitFromItem;

      // Track top selling products
      const pName = item.products?.product_name || 'Unknown Product';
      if (!productSalesMap[pName]) {
        productSalesMap[pName] = { qty: 0, revenue: 0 };
      }
      productSalesMap[pName].qty += item.quantity;
      productSalesMap[pName].revenue += item.subtotal;
    });
  });

  // Sales Breakdown by Payment Type
  const cashSales = sales.filter((sale) => sale.payment_type === 'Cash').reduce((sum, sale) => sum + sale.total_amount, 0);
  const utangSales = sales.filter((sale) => sale.payment_type === 'Utang').reduce((sum, sale) => sum + sale.total_amount, 0);
  const digitalSales = sales.filter((sale) => sale.payment_type === 'Digital').reduce((sum, sale) => sum + sale.total_amount, 0);

  // Sorted Top Selling Products
  const topProducts = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return (
    <div className="flex flex-col lg:h-full gap-6 p-4 lg:p-6 bg-muted/30 lg:overflow-y-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-3 tracking-tight">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="w-6 h-6" />
            </div>
            Sales & Profit Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track earnings, profit margins, and payment breakdown</p>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-background shadow-sm rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-foreground group-hover:scale-110 transition-transform">
            <DollarSign className="w-16 h-16" />
          </div>
          <CardContent className="p-5 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Sales Revenue</p>
            <p className="text-3xl font-black text-foreground">₱{totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5 shadow-sm rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-primary group-hover:scale-110 transition-transform">
            <TrendingUp className="w-16 h-16" />
          </div>
          <CardContent className="p-5 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Net Estimated Profit</p>
            <p className="text-3xl font-black text-primary">₱{totalProfit.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-background shadow-sm rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-muted-foreground group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-16 h-16" />
          </div>
          <CardContent className="p-5 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Transactions</p>
            <p className="text-3xl font-black text-foreground">{sales.length}</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-rose-500/5 shadow-sm rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-500 group-hover:scale-110 transition-transform">
            <CreditCard className="w-16 h-16" />
          </div>
          <CardContent className="p-5 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">Utang (Credit) Sales</p>
            <p className="text-3xl font-black text-rose-600 dark:text-rose-400">₱{utangSales.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* LOWER SECTION: PAYMENT BREAKDOWN & TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Method Breakdown */}
        <Card className="border-border/50 bg-background shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
            <CardTitle className="text-lg font-bold text-foreground">Payment Breakdown</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Revenue grouped by payment channel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="flex justify-between items-center p-4 bg-primary/5 rounded-2xl border border-primary/20 hover:border-primary/40 transition-colors">
              <span className="text-sm font-bold text-primary">Cash Transactions</span>
              <span className="font-black text-lg text-primary">₱{cashSales.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-rose-500/5 rounded-2xl border border-rose-500/20 hover:border-rose-500/40 transition-colors">
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400">Utang (Unpaid)</span>
              <span className="font-black text-lg text-rose-600 dark:text-rose-400">₱{utangSales.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-cyan-500/5 rounded-2xl border border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">GCash / Digital</span>
              <span className="font-black text-lg text-cyan-600 dark:text-cyan-400">₱{digitalSales.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card className="lg:col-span-2 border-border/50 bg-background shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Award className="w-5 h-5 text-amber-500" /> Top Selling Items
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Most frequently purchased items by quantity</CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {topProducts.length === 0 ? (
              <p className="text-sm font-semibold text-muted-foreground py-10 text-center opacity-60">No sales recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex justify-between items-center p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-black text-muted-foreground/50 text-xl w-6 text-center">#{index + 1}</span>
                      <span className="font-bold text-foreground text-sm">{product.name}</span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary border-primary/30">{product.qty} sold</Badge>
                      <span className="font-black text-foreground w-24 text-right">₱{product.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RECENT SALES TRANSACTIONS LOG */}
      <Card className="border-border/50 bg-background shadow-sm rounded-2xl overflow-hidden mb-6">
        <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
          <CardTitle className="text-lg font-bold text-foreground">Recent Sales History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider font-bold border-b border-border/50">
                <tr>
                  <th className="p-4">Sale ID</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Items Count</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sales.map((sale) => (
                  <tr key={sale.sale_id} className="hover:bg-muted/40 transition-colors">
                    <td className="p-4 font-mono font-medium text-muted-foreground">#{sale.sale_id}</td>
                    <td className="p-4 font-medium text-foreground">{new Date(sale.created_at).toLocaleString()}</td>
                    <td className="p-4 text-muted-foreground font-medium">{sale.sale_items?.length || 0} item(s)</td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider font-bold ${sale.payment_type === 'Utang'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : sale.payment_type === 'Digital'
                              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                              : 'border-primary/30 bg-primary/10 text-primary'
                          }`}
                      >
                        {sale.payment_type}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-black text-foreground">₱{sale.total_amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
            {sales.map((sale) => (
              <Card key={sale.sale_id} className="border-border/50 shadow-sm relative overflow-hidden">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sale #{sale.sale_id}</span>
                      <span className="text-sm font-semibold text-foreground mt-0.5">{new Date(sale.created_at).toLocaleString()}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider font-bold ${sale.payment_type === 'Utang'
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : sale.payment_type === 'Digital'
                            ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                            : 'border-primary/30 bg-primary/10 text-primary'
                        }`}
                    >
                      {sale.payment_type}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Items</span>
                      <span className="text-sm font-semibold">{sale.sale_items?.length || 0} item(s)</span>
                    </div>
                    <div className="flex flex-col border-l border-border/40 pl-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Revenue</span>
                      <span className="text-sm font-black text-foreground">₱{sale.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
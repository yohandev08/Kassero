'use client';

import React, { useState, useEffect } from 'react';
import type { Sale } from '@/types';
import { fetchSalesWithItems } from '@/services/salesService';
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
    <div className="flex flex-col h-full p-0.5 bg-background gap-5 overflow-y-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            Sales & Profit Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track earnings, profit margins, and payment breakdown</p>
        </div>

        
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 bg-card text-card-foreground shadow-sm rounded-xl">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Sales Revenue</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">₱{totalRevenue.toFixed(2)}</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5 text-card-foreground shadow-sm rounded-xl">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Net Estimated Profit</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">₱{totalProfit.toFixed(2)}</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card text-card-foreground shadow-sm rounded-xl">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{sales.length}</p>
            </div>
            <div className="p-2 rounded-xl bg-muted text-muted-foreground">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/5 text-card-foreground shadow-sm rounded-xl">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-400">Utang (Credit) Sales</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">₱{utangSales.toFixed(2)}</p>
            </div>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <CreditCard className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LOWER SECTION: PAYMENT BREAKDOWN & TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Payment Method Breakdown */}
        <Card className="border-border/80 bg-card text-card-foreground shadow-md rounded-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-base font-bold text-foreground">Payment Method Breakdown</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Revenue grouped by payment channel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Cash Transactions</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">₱{cashSales.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">Utang (Unpaid)</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">₱{utangSales.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
              <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">GCash / Digital</span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">₱{digitalSales.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card className="lg:col-span-2 border-border/80 bg-card text-card-foreground shadow-md rounded-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Award className="w-5 h-5 text-amber-500" /> Top Selling Items
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Most frequently purchased items by quantity</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No sales recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex justify-between items-center border-b border-border/50 pb-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-muted-foreground w-4 text-center">#{index + 1}</span>
                      <span className="font-semibold text-foreground">{product.name}</span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <Badge variant="secondary" className="text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">{product.qty} sold</Badge>
                      <span className="font-bold text-foreground w-24 text-right">₱{product.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RECENT SALES TRANSACTIONS LOG */}
      <Card className="border-border/80 bg-card text-card-foreground shadow-md rounded-xl overflow-hidden mb-4">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-base font-bold text-foreground">Recent Sales History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap min-w-[600px]">
            <thead className="bg-muted/50 text-muted-foreground font-bold uppercase border-b border-border/60">
              <tr>
                <th className="p-3.5">Sale ID</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Items Count</th>
                <th className="p-3.5">Payment Method</th>
                <th className="p-3.5 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sales.map((sale) => (
                <tr key={sale.sale_id} className="hover:bg-muted/40 transition-colors">
                  <td className="p-3.5 font-mono text-muted-foreground">#{sale.sale_id}</td>
                  <td className="p-3.5 text-foreground">{new Date(sale.created_at).toLocaleString()}</td>
                  <td className="p-3.5 text-muted-foreground">{sale.sale_items?.length || 0} item(s)</td>
                  <td className="p-3.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium ${
                        sale.payment_type === 'Utang'
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : sale.payment_type === 'Digital'
                          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {sale.payment_type}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-right font-bold text-foreground">₱{sale.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  RefreshCw,
  ShoppingBag,
  Award
} from 'lucide-react';

// --- shadcn/ui components ---
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SaleItemWithProduct {
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    product_name: string;
    cost_price: number;
  } | null;
}

interface Sale {
  sale_id: number;
  total_amount: number;
  payment_type: 'Cash' | 'Utang' | 'Digital';
  created_at: string;
  sale_items: SaleItemWithProduct[];
}

export default function SalesAnalytics(): React.JSX.Element {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select(`
        sale_id,
        total_amount,
        payment_type,
        created_at,
        sale_items (
          quantity,
          unit_price,
          subtotal,
          products ( product_name, cost_price )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales analytics:', error);
    } else {
      setSales((data as unknown as Sale[]) || []);
    }
    setLoading(false);
  };

  // --- Financial Computations ---
  const totalRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);

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
  const cashSales = sales.filter((s) => s.payment_type === 'Cash').reduce((sum, s) => sum + s.total_amount, 0);
  const utangSales = sales.filter((s) => s.payment_type === 'Utang').reduce((sum, s) => sum + s.total_amount, 0);
  const digitalSales = sales.filter((s) => s.payment_type === 'Digital').reduce((sum, s) => sum + s.total_amount, 0);

  // Sorted Top Selling Products
  const topProducts = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return (
    <div className="flex flex-col h-screen bg-slate-50 p-6 gap-6 overflow-y-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Sales & Profit Analytics
          </h1>
          <p className="text-xs text-slate-500">Track earnings, profit margins, and payment breakdown</p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchSalesData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Sales Revenue</p>
              <p className="text-2xl font-bold text-slate-900">₱{totalRevenue.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-primary" />
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-600">Net Estimated Profit</p>
              <p className="text-2xl font-bold text-emerald-700">₱{totalProfit.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Transactions</p>
              <p className="text-2xl font-bold text-slate-800">{sales.length}</p>
            </div>
            <ShoppingBag className="w-8 h-8 text-slate-400" />
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-red-600">Utang (Credit) Sales</p>
              <p className="text-2xl font-bold text-red-700">₱{utangSales.toFixed(2)}</p>
            </div>
            <CreditCard className="w-8 h-8 text-red-500" />
          </CardContent>
        </Card>
      </div>

      {/* LOWER SECTION: PAYMENT BREAKDOWN & TOP PRODUCTS */}
      <div className="grid grid-cols-3 gap-6">
        {/* Payment Method Breakdown */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Payment Method Breakdown</CardTitle>
            <CardDescription>Revenue grouped by payment channel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-xs font-semibold text-emerald-800">Cash Transactions</span>
              <span className="font-bold text-emerald-700">₱{cashSales.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
              <span className="text-xs font-semibold text-red-800">Utang (Unpaid)</span>
              <span className="font-bold text-red-700">₱{utangSales.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg border border-purple-100">
              <span className="text-xs font-semibold text-purple-800">GCash / Digital</span>
              <span className="font-bold text-purple-700">₱{digitalSales.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card className="col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> Top Selling Items
            </CardTitle>
            <CardDescription>Most frequently purchased items by quantity</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No sales recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b pb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400 w-4">#{idx + 1}</span>
                      <span className="font-semibold text-slate-800">{p.name}</span>
                    </div>
                    <div className="flex gap-4">
                      <Badge variant="secondary" className="text-[10px]">{p.qty} sold</Badge>
                      <span className="font-bold text-slate-900 w-20 text-right">₱{p.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RECENT SALES TRANSACTIONS LOG */}
      <Card className="border-slate-200 shadow-sm flex-1">
        <CardHeader>
          <CardTitle className="text-base">Recent Sales History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase border-b">
              <tr>
                <th className="p-3">Sale ID</th>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Items Count</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sales.map((sale) => (
                <tr key={sale.sale_id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-500">#{sale.sale_id}</td>
                  <td className="p-3 text-slate-600">{new Date(sale.created_at).toLocaleString()}</td>
                  <td className="p-3 text-slate-700">{sale.sale_items?.length || 0} item(s)</td>
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        sale.payment_type === 'Utang'
                          ? 'border-red-300 bg-red-50 text-red-600'
                          : sale.payment_type === 'Digital'
                          ? 'border-purple-300 bg-purple-50 text-purple-600'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {sale.payment_type}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900">₱{sale.total_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
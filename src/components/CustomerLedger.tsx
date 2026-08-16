import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  User, 
  Search, 
  History, 
  DollarSign, 
  CheckCircle, 
  Receipt
} from 'lucide-react';

// --- shadcn/ui components ---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// --- Type Definitions ---
interface Customer {
  customer_id: number;
  first_name: string;
  last_name: string;
  phone_number?: string;
  credit_limit: number;
  current_balance: number;
  is_allowed_utang: boolean;
}

interface SaleItem {
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    product_name: string;
  } | null;
}

interface UtangTransaction {
  utang_id: number;
  sale_id: number;
  amount: number;
  status: string;
  created_at: string;
  sales: {
    created_at: string;
    sale_items: SaleItem[];
  } | null;
}

export default function CustomerLedger(): React.JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [utangHistory, setUtangHistory] = useState<UtangTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Modal State for Payments
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // 1. Fetch Customers on Load
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('current_balance', { ascending: false });

    if (error) console.error('Error fetching customers:', error);
    else {
      setCustomers(data || []);
      // Auto-select first customer if available and none selected yet
      if (data && data.length > 0 && !selectedCustomer) {
        handleSelectCustomer(data[0]);
      }
    }
  };

  // 2. Fetch Customer Utang History (with sales and items details)
  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);

    const { data, error } = await supabase
      .from('utang_transactions')
      .select(`
        utang_id,
        sale_id,
        amount,
        status,
        created_at,
        sales (
          created_at,
          sale_items (
            quantity,
            unit_price,
            subtotal,
            products ( product_name )
          )
        )
      `)
      .eq('customer_id', customer.customer_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching utang history:', error);
    } else {
      setUtangHistory((data as unknown as UtangTransaction[]) || []);
    }
    setLoadingHistory(false);
  };

  // 3. Handle Recording Cash Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amountPaid = parseFloat(paymentAmount);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      return alert('Please enter a valid payment amount.');
    }

    if (amountPaid > selectedCustomer.current_balance) {
      return alert('Payment amount cannot be higher than the current balance!');
    }

    try {
      // A. Insert into PAYMENTS table
      const { error: payErr } = await supabase.from('payments').insert([
        {
          customer_id: selectedCustomer.customer_id,
          amount_paid: amountPaid,
          notes: paymentNotes || 'Cash Utang Payment',
        },
      ]);
      if (payErr) throw payErr;

      // B. Deduct balance from CUSTOMERS table
      const newBalance = selectedCustomer.current_balance - amountPaid;
      const { error: custErr } = await supabase
        .from('customers')
        .update({ current_balance: newBalance })
        .eq('customer_id', selectedCustomer.customer_id);

      if (custErr) throw custErr;

      // C. Update status of Unpaid Utang records if fully cleared
      if (newBalance === 0) {
        await supabase
          .from('utang_transactions')
          .update({ status: 'Paid' })
          .eq('customer_id', selectedCustomer.customer_id)
          .eq('status', 'Unpaid');
      }

      alert(`Payment of ₱${amountPaid.toFixed(2)} recorded successfully!`);

      // Reset form and refresh
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      
      // Refresh customer list and active history
      await fetchCustomers();
      handleSelectCustomer({ ...selectedCustomer, current_balance: newBalance });
    } catch (err: any) {
      console.error('Payment error:', err);
      alert('Failed to process payment: ' + err.message);
    }
  };

  // Filter customer list search query
  const filteredCustomers = customers.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-50 p-4 gap-4">
      {/* LEFT: Customer List & Search */}
      <Card className="w-1/3 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Customer Directory
          </CardTitle>
          <CardDescription>Select a customer to view ledger and record payments</CardDescription>

          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Search customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-2 pr-2">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">No customers found</div>
          ) : (
            filteredCustomers.map((cust) => {
              const isSelected = selectedCustomer?.customer_id === cust.customer_id;
              const isOverLimit = cust.current_balance > cust.credit_limit;

              return (
                <div
                  key={cust.customer_id}
                  onClick={() => handleSelectCustomer(cust)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {cust.first_name} {cust.last_name}
                    </p>
                    <p className="text-[11px] text-slate-400">{cust.phone_number || 'No phone'}</p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-bold text-sm ${
                        cust.current_balance > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      ₱{cust.current_balance.toFixed(2)}
                    </p>
                    <Badge
                      variant={isOverLimit ? 'destructive' : 'secondary'}
                      className="text-[9px] px-1.5 py-0"
                    >
                      Limit: ₱{cust.credit_limit}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* RIGHT: Customer Ledger & Utang Breakdown */}
      <Card className="w-2/3 flex flex-col">
        {selectedCustomer ? (
          <>
            <CardHeader className="border-b pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Phone: {selectedCustomer.phone_number || 'N/A'}
                  </p>
                </div>

                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={selectedCustomer.current_balance <= 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <DollarSign className="w-4 h-4 mr-1" /> Pay Utang
                </Button>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Total Debt</p>
                  <p className="text-xl font-bold text-red-600">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </p>
                </div>

                <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Credit Limit</p>
                  <p className="text-xl font-bold text-slate-800">
                    ₱{selectedCustomer.credit_limit.toFixed(2)}
                  </p>
                </div>

                <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Available Credit</p>
                  <p className="text-xl font-bold text-emerald-600">
                    ₱{Math.max(0, selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardHeader>

            {/* Transaction History Section */}
            <CardContent className="flex-1 overflow-y-auto pt-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" /> Utang Transaction History
              </h3>

              {loadingHistory ? (
                <div className="text-center py-10 text-slate-400 text-xs">Loading ledger...</div>
              ) : utangHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <CheckCircle className="w-10 h-10 mb-2 text-emerald-500" />
                  <p className="text-sm font-medium">No Utang records found</p>
                  <p className="text-xs">This customer has a clean record.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {utangHistory.map((tx) => (
                    <Card key={tx.utang_id} className="border border-slate-200 shadow-none">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start border-b pb-2 mb-2">
                          <div>
                            <span className="text-xs text-slate-400 font-mono">
                              Sale ID #{tx.sale_id}
                            </span>
                            <p className="text-xs text-slate-500">
                              {new Date(tx.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-sm text-red-600">
                              ₱{tx.amount.toFixed(2)}
                            </span>
                            <div className="mt-0.5">
                              <Badge
                                variant={tx.status === 'Paid' ? 'secondary' : 'outline'}
                                className={`text-[10px] ${
                                  tx.status === 'Unpaid'
                                    ? 'border-red-300 text-red-600 bg-red-50'
                                    : 'border-emerald-300 text-emerald-600 bg-emerald-50'
                                }`}
                              >
                                {tx.status}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Itemized List inside Sale */}
                        {tx.sales?.sale_items && tx.sales.sale_items.length > 0 && (
                          <div className="space-y-1 bg-slate-50 p-2 rounded text-xs">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase mb-1 flex items-center gap-1">
                              <Receipt className="w-3 h-3" /> Items Purchased
                            </p>
                            {tx.sales.sale_items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-slate-600">
                                <span>
                                  {item.quantity}x {item.products?.product_name || 'Product'}
                                </span>
                                <span>₱{item.subtotal.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
            <User className="w-12 h-12 mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">No Customer Selected</p>
            <p className="text-xs">Choose a customer from the left list to view details.</p>
          </div>
        )}
      </Card>

      {/* ================= PAYMENT DIALOG ================= */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Record Utang Payment</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <form onSubmit={handleRecordPayment} className="space-y-3 pt-2">
              <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Customer:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Current Debt:</span>
                  <span className="font-bold text-red-600">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs">Payment Amount (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="text-sm font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs">Notes / Reference (Optional)</Label>
                <Input
                  placeholder="e.g. Partial cash payment"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Submit Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
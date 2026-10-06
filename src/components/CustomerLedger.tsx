'use client';

import { useState, useEffect } from 'react';
import type { Customer, UtangTransaction } from '@/types';
import { fetchCustomers as fetchCustomersService, updateCustomerBalance } from '@/services/customerService';
import { fetchUtangHistory, recordPayment, markUtangAsPaid, fetchPayments } from '@/services/paymentService';
import {
  User,
  Search,
  History,
  DollarSign,
  CheckCircle,
  Receipt,
  Trash2,
  X,
  Check
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

export default function CustomerLedger(): React.JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [utangHistory, setUtangHistory] = useState<UtangTransaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [ledgerTab, setLedgerTab] = useState<'unpaid' | 'paid'>('unpaid');

  // Modal State for Payments
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Remove feature state
  const [removeMode, setRemoveMode] = useState<boolean>(false);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<number>>(new Set());

  // 1. Fetch Customers on Load (via service)
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await fetchCustomersService({
      orderBy: 'current_balance',
      ascending: false,
    });

    if (error) console.error('Error fetching customers:', error);
    else {
      setCustomers(data || []);
      // Auto-select first customer if available and none selected yet
      if (data && data.length > 0 && !selectedCustomer) {
        handleSelectCustomer(data[0]);
      }
    }
  };

  // 2. Fetch Customer Utang History (via service)
  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);

    const [utangRes, paymentsRes] = await Promise.all([
      fetchUtangHistory(customer.customer_id),
      fetchPayments(customer.customer_id)
    ]);

    if (utangRes.error) {
      console.error('Error fetching utang history:', utangRes.error);
    } else {
      setUtangHistory((utangRes.data as unknown as UtangTransaction[]) || []);
    }

    if (paymentsRes.error) {
      console.error('Error fetching payment history:', paymentsRes.error);
    } else {
      setPaymentHistory(paymentsRes.data || []);
    }
    setLoadingHistory(false);
  };

  // 3. Handle Recording Cash Payment (via services)
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
      // A. Insert into PAYMENTS table (via service)
      const { error: payErr } = await recordPayment({
        customer_id: selectedCustomer.customer_id,
        amount_paid: amountPaid,
        notes: paymentNotes || 'Cash Utang Payment',
      });
      if (payErr) throw payErr;

      // B. Deduct balance from CUSTOMERS table (via service)
      const newBalance = selectedCustomer.current_balance - amountPaid;
      const { error: custErr } = await updateCustomerBalance(
        selectedCustomer.customer_id,
        newBalance
      );

      if (custErr) throw custErr;

      // C. Update status of Unpaid Utang records if fully cleared (via service)
      if (newBalance === 0) {
        await markUtangAsPaid(selectedCustomer.customer_id);
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
  const filteredCustomers = customers.filter((customer) =>
    `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectForRemoval = (id: number) => {
    setSelectedForRemoval(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    if (selectedForRemoval.size === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedForRemoval(new Set());
    } else {
      setSelectedForRemoval(new Set(filteredCustomers.map(c => c.customer_id)));
    }
  };

  const exitRemoveMode = () => {
    setRemoveMode(false);
    setSelectedForRemoval(new Set());
  };

  const removeSelectedCustomers = async () => {
    if (selectedForRemoval.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedForRemoval.size} customer(s)?`)) return;

    try {
      const { deleteCustomers } = await import('@/services/customerService');
      const { error } = await deleteCustomers(Array.from(selectedForRemoval));
      if (error) throw error;
      
      // Update local state
      setCustomers(customers.filter(c => !selectedForRemoval.has(c.customer_id)));
      if (selectedCustomer && selectedForRemoval.has(selectedCustomer.customer_id)) {
        setSelectedCustomer(null);
        setUtangHistory([]);
      }
      exitRemoveMode();
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Failed to delete customers: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-full p-0.5 bg-background gap-4 lg:overflow-hidden">
      {/* LEFT: Customer List & Search */}
      <Card className="w-full lg:w-1/3 flex flex-col bg-card text-card-foreground border-border shadow-md rounded-xl overflow-hidden shrink-0 lg:shrink h-auto min-h-fit">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-row justify-between items-center gap-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary dark:text-primary">
                <User className="w-5 h-5" />
              </div>
              <span className="truncate">Customer Directory</span>
            </CardTitle>
            <Button size="sm" variant="outline"
              className={`text-xs font-semibold cursor-pointer transition-all w-fit shrink-0 ${
                removeMode
                  ? 'text-white bg-red-500 border-red-500 hover:bg-red-600 dark:bg-red-600 dark:border-red-600'
                  : 'text-red-600 border-red-500/30 hover:bg-red-500/10 dark:text-red-400 dark:border-red-400/30'
              }`}
              onClick={() => {
                if (removeMode) exitRemoveMode();
                else setRemoveMode(true);
              }}
            >
              {removeMode ? <X className="w-3.5 h-3.5 mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              {removeMode ? 'Cancel' : 'Remove'}
            </Button>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-2">Select a customer to view ledger and record payments</CardDescription>

          <div className="relative mt-3">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-[16px] md:text-xs bg-background border-input min-h-[44px] md:min-h-0"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-2 p-3 min-h-[250px]">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">No customers found</div>
          ) : (
            filteredCustomers.map((customer) => {
              const isSelected = selectedCustomer?.customer_id === customer.customer_id;
              const isOverLimit = customer.current_balance > customer.credit_limit;
              const isSelectedForRemoval = selectedForRemoval.has(customer.customer_id);

              return (
                <div
                  key={customer.customer_id}
                  onClick={removeMode ? () => toggleSelectForRemoval(customer.customer_id) : () => handleSelectCustomer(customer)}
                  className={`p-3 rounded-xl border transition-all duration-200 flex justify-between items-center relative ${
                    removeMode
                      ? isSelectedForRemoval
                        ? 'ring-2 ring-red-500 border-red-500 shadow-red-500/10 cursor-pointer bg-red-500/5'
                        : 'hover:ring-2 hover:ring-red-300 cursor-pointer bg-card'
                      : isSelected
                        ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30 cursor-pointer'
                        : 'border-border/70 bg-card hover:bg-muted/40 hover:border-primary/30 cursor-pointer'
                    }`}
                >
                  {/* Checkbox overlay in remove mode */}
                  {removeMode && (
                    <div className={`absolute left-3 z-10 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all ${
                      isSelectedForRemoval
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'border-muted-foreground/40 bg-background'
                    }`}>
                      {isSelectedForRemoval && <Check className="w-3 h-3" />}
                    </div>
                  )}
                  
                  <div className={removeMode ? "pl-7" : ""}>
                    <p className="font-semibold text-foreground text-sm">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{customer.phone_number || 'No phone'}</p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-bold text-sm ${customer.current_balance > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-primary dark:text-primary'
                        }`}
                    >
                      ₱{customer.current_balance.toFixed(2)}
                    </p>
                    <Badge
                      variant={isOverLimit ? 'destructive' : 'secondary'}
                      className={`text-[9px] px-1.5 py-0 font-medium ${!isOverLimit ? 'bg-muted text-muted-foreground' : ''
                        }`}
                    >
                      Limit: ₱{customer.credit_limit}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}

          {/* Floating action bar when customers are selected for removal */}
          {removeMode && (
            <div className="sticky bottom-0 left-0 right-0 mt-3 flex flex-col gap-3 bg-card/95 backdrop-blur-sm border border-red-500/30 rounded-xl p-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {selectedForRemoval.size} selected
                </span>
                <button
                  onClick={selectAllFiltered}
                  className="text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  Select All
                </button>
              </div>
              <div className="flex gap-2 w-full">
                <Button size="sm" variant="outline" className="text-xs cursor-pointer flex-1" onClick={exitRemoveMode}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={selectedForRemoval.size === 0}
                  className="text-xs font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm cursor-pointer disabled:opacity-50 flex-1"
                  onClick={removeSelectedCustomers}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete {selectedForRemoval.size > 0 ? `(${selectedForRemoval.size})` : ''}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RIGHT: Customer Ledger & Utang Breakdown */}
      <Card className="w-full lg:w-2/3 flex flex-col bg-card text-card-foreground border-border shadow-md rounded-xl overflow-hidden shrink-0 min-h-[60vh] lg:min-h-0">
        {selectedCustomer ? (
          <>
            <CardHeader className="border-b border-border/60 pb-4 bg-muted/20">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Phone: {selectedCustomer.phone_number || 'N/A'}
                  </p>
                </div>

                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={selectedCustomer.current_balance <= 0}
                  className="w-full sm:w-auto bg-primary hover:bg-primary text-white font-semibold cursor-pointer shadow-sm shadow-primary/20"
                >
                  <DollarSign className="w-4 h-4 mr-1" /> Pay Utang
                </Button>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="bg-background p-3 rounded-xl border border-border/80 shadow-xs">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold">Total Debt</p>
                  <p className="text-xl font-bold text-rose-500 dark:text-rose-400">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </p>
                </div>

                <div className="bg-background p-3 rounded-xl border border-border/80 shadow-xs">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold">Credit Limit</p>
                  <p className="text-xl font-bold text-foreground">
                    ₱{selectedCustomer.credit_limit.toFixed(2)}
                  </p>
                </div>

                <div className="bg-background p-3 rounded-xl border border-border/80 shadow-xs">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold">Available Credit</p>
                  <p className="text-xl font-bold text-primary dark:text-primary">
                    ₱{Math.max(0, selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardHeader>

            {/* Transaction History Section */}
            <CardContent className="flex-1 overflow-y-auto p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <History className="w-4 h-4 text-primary" /> Transaction History
                </h3>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant={ledgerTab === 'unpaid' ? 'default' : 'outline'}
                    className={`h-7 text-[10px] px-2.5 rounded-md cursor-pointer ${ledgerTab === 'unpaid' ? 'bg-primary text-white shadow-sm' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setLedgerTab('unpaid')}
                  >
                    Unpaid
                  </Button>
                  <Button 
                    size="sm" 
                    variant={ledgerTab === 'paid' ? 'default' : 'outline'}
                    className={`h-7 text-[10px] px-2.5 rounded-md cursor-pointer ${ledgerTab === 'paid' ? 'bg-primary text-white shadow-sm' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setLedgerTab('paid')}
                  >
                    Paid & Payments
                  </Button>
                </div>
              </div>

              {(() => {
                let filteredTimeline: any[] = [];
                if (ledgerTab === 'unpaid') {
                  filteredTimeline = utangHistory
                    .filter(u => u.status === 'Unpaid')
                    .map(u => ({ ...u, _type: 'utang', _date: new Date(u.created_at).getTime() }));
                } else {
                  filteredTimeline = [
                    ...utangHistory.filter(u => u.status === 'Paid').map(u => ({ ...u, _type: 'utang', _date: new Date(u.created_at).getTime() })),
                    ...paymentHistory.map(p => ({ ...p, _type: 'payment', _date: new Date(p.created_at).getTime() }))
                  ];
                }
                filteredTimeline.sort((a, b) => b._date - a._date);

                if (loadingHistory) {
                  return <div className="text-center py-10 text-muted-foreground text-xs">Loading ledger...</div>;
                }

                if (filteredTimeline.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground flex-1">
                      <CheckCircle className="w-10 h-10 mb-2 text-primary" />
                      <p className="text-sm font-semibold text-foreground">No records found</p>
                      <p className="text-xs text-muted-foreground">This section is empty.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filteredTimeline.map((event: any) => {
                      if (event._type === 'utang') {
                        return (
                          <Card key={`u-${event.utang_id}`} className="border border-border/70 bg-background shadow-xs rounded-xl overflow-hidden">
                            <CardContent className="p-3.5">
                              <div className="flex justify-between items-start border-b border-border/50 pb-2 mb-2">
                                <div>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    Sale ID #{event.sale_id}
                                  </span>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(event.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-sm text-rose-500 dark:text-rose-400">
                                    ₱{event.amount.toFixed(2)}
                                  </span>
                                  <div className="mt-0.5">
                                    <Badge
                                      variant={event.status === 'Paid' ? 'secondary' : 'outline'}
                                      className={`text-[10px] font-medium ${event.status === 'Unpaid'
                                        ? 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                                        : 'border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10'
                                        }`}
                                    >
                                      {event.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              {/* Itemized List inside Sale */}
                              {event.sales?.sale_items && event.sales.sale_items.length > 0 && (
                                <div className="space-y-1 bg-muted/40 p-2.5 rounded-lg text-xs border border-border/40">
                                  <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1 flex items-center gap-1">
                                    <Receipt className="w-3 h-3 text-primary" /> Items Purchased
                                  </p>
                                  {event.sales.sale_items.map((item: any, index: number) => (
                                    <div key={index} className="flex justify-between text-foreground font-medium">
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
                        );
                      } else {
                        return (
                          <Card key={`p-${event.payment_id}`} className="border border-green-500/30 bg-green-500/5 shadow-xs rounded-xl overflow-hidden">
                            <CardContent className="p-3.5">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-xs text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5" /> Payment Recorded
                                  </span>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {new Date(event.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-sm text-green-600 dark:text-green-400">
                                    +₱{event.amount_paid.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              {event.notes && (
                                <p className="text-xs text-muted-foreground mt-2 bg-background/50 p-2 rounded-lg border border-border/40">
                                  Note: {event.notes}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      }
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
            <User className="w-12 h-12 mb-2 text-muted-foreground/40" />
            <p className="font-semibold text-foreground">No Customer Selected</p>
            <p className="text-xs text-muted-foreground mt-0.5">Choose a customer from the left list to view details.</p>
          </div>
        )}
      </Card>

      {/* ================= PAYMENT DIALOG ================= */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Record Utang Payment</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <form onSubmit={handleRecordPayment} className="space-y-3 pt-2">
              <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Customer:</span>
                  <span className="font-semibold text-foreground">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Debt:</span>
                  <span className="font-bold text-rose-500 dark:text-rose-400">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Amount (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="text-[16px] md:text-sm font-semibold bg-background min-h-[44px] md:min-h-0"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Notes / Reference (Optional)</Label>
                <Input
                  placeholder="e.g. Partial cash payment"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="text-[16px] md:text-xs bg-background min-h-[44px] md:min-h-0"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary text-white font-semibold cursor-pointer">
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
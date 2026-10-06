'use client';

import { useState, useEffect } from 'react';
import type { Customer, UtangTransaction } from '@/types';
import { fetchCustomers as fetchCustomersService, updateCustomerBalance, addCustomer } from '@/services/customer.Service';
import { fetchUtangHistory, recordPayment, markUtangAsPaid, fetchPayments } from '@/services/payment.Service';
import {
  User,
  Search,
  History,
  DollarSign,
  CheckCircle,
  Receipt,
  Trash2,
  X,
  Check,
  UserPlus
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
import { ScrollArea } from '@/components/ui/scroll-area';

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

  // Add Customer State
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState<boolean>(false);
  const [newCustomer, setNewCustomer] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    credit_limit: 500,
  });

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
      const { deleteCustomers } = await import('@/services/customer.Service');
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

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.first_name || !newCustomer.last_name) {
      alert('First Name and Last Name are required.');
      return;
    }
    try {
      const { data, error } = await addCustomer({
        ...newCustomer,
        current_balance: 0,
        is_allowed_utang: true,
      });

      if (error) throw error;

      await fetchCustomers(); // Refresh the list
      setIsAddCustomerModalOpen(false);
      setNewCustomer({ first_name: '', last_name: '', phone_number: '', credit_limit: 500 });
    } catch (err: any) {
      console.error('Failed to add customer:', err);
      alert('Failed to add customer: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-full gap-6 p-4 lg:p-6 bg-muted/30 lg:overflow-hidden">
      {/* LEFT: Customer List & Search */}
      <Card className="w-full lg:w-1/3 flex flex-col bg-background shadow-sm border-border/50 rounded-2xl overflow-hidden shrink-0 lg:shrink h-auto lg:h-full min-h-fit relative">
        <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
          <div className="flex flex-row justify-between items-center gap-3">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-foreground tracking-tight">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <User className="w-5 h-5" />
              </div>
              <span className="truncate">Customers</span>
            </CardTitle>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline"
                className="text-xs font-semibold cursor-pointer rounded-lg bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all w-fit"
                onClick={() => setIsAddCustomerModalOpen(true)}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
              <Button size="sm" variant="outline"
                className={`text-xs font-semibold cursor-pointer rounded-lg transition-all w-fit ${removeMode
                  ? 'text-white bg-rose-500 border-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:border-rose-600'
                  : 'text-rose-600 border-rose-500/30 hover:bg-rose-500/10 dark:text-rose-400 dark:border-rose-400/30'
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
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-2">Manage customer accounts and utang</CardDescription>

          <div className="relative mt-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-background border-input rounded-xl focus-visible:ring-primary/40 shadow-sm"
            />
          </div>
        </CardHeader>

        <ScrollArea className="flex-1">
          <div className={`p-4 space-y-3 ${removeMode ? 'pb-32' : 'pb-4'}`}>
            {filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-60">
                <Search className="w-10 h-10 mb-3" />
                <p className="text-xs font-semibold">No customers found</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?.customer_id === customer.customer_id;
                const isOverLimit = customer.current_balance > customer.credit_limit;
                const isSelectedForRemoval = selectedForRemoval.has(customer.customer_id);

                return (
                  <div
                    key={customer.customer_id}
                    onClick={removeMode ? () => toggleSelectForRemoval(customer.customer_id) : () => handleSelectCustomer(customer)}
                    className={`p-4 rounded-2xl border transition-all duration-200 flex justify-between items-center relative overflow-hidden group ${removeMode
                      ? isSelectedForRemoval
                        ? 'ring-2 ring-rose-500 border-rose-500 shadow-sm cursor-pointer bg-rose-500/5'
                        : 'hover:ring-2 hover:ring-rose-300 cursor-pointer bg-background'
                      : isSelected
                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30 cursor-pointer'
                        : 'border-border/50 bg-background hover:bg-muted/40 hover:border-primary/30 cursor-pointer'
                      }`}
                  >
                    {/* Checkbox overlay in remove mode */}
                    {removeMode && (
                      <div className={`absolute left-4 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelectedForRemoval
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : 'border-muted-foreground/40 bg-background group-hover:border-rose-400'
                        }`}>
                        {isSelectedForRemoval && <Check className="w-3.5 h-3.5" />}
                      </div>
                    )}

                    <div className={removeMode ? "pl-8" : ""}>
                      <p className="font-bold text-foreground text-sm tracking-tight group-hover:text-primary transition-colors">
                        {customer.first_name} {customer.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{customer.phone_number || 'No phone'}</p>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <p
                        className={`font-black text-sm mb-1 ${customer.current_balance > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-primary'
                          }`}
                      >
                        ₱{customer.current_balance.toFixed(2)}
                      </p>
                      <Badge
                        variant={isOverLimit ? 'destructive' : 'secondary'}
                        className={`text-[9px] uppercase tracking-wider font-bold ${isOverLimit ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'bg-muted text-muted-foreground border-border/50'
                          }`}
                      >
                        Limit: ₱{customer.credit_limit}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Floating action bar when customers are selected for removal */}
        {removeMode && (
          <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 bg-card/95 backdrop-blur-md border border-rose-500/40 rounded-2xl p-4 shadow-xl z-20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">
                {selectedForRemoval.size} selected
              </span>
              <button
                onClick={selectAllFiltered}
                className="text-xs text-primary hover:underline font-bold cursor-pointer uppercase tracking-wider"
              >
                Select All
              </button>
            </div>
            <div className="flex gap-2 w-full">
              <Button size="sm" variant="outline" className="text-xs font-bold cursor-pointer flex-1 rounded-lg" onClick={exitRemoveMode}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedForRemoval.size === 0}
                className="text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-md cursor-pointer disabled:opacity-50 flex-1 rounded-lg"
                onClick={removeSelectedCustomers}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete {selectedForRemoval.size > 0 ? `(${selectedForRemoval.size})` : ''}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* RIGHT: Customer Ledger & Utang Breakdown */}
      <Card className="w-full lg:w-2/3 flex flex-col bg-background shadow-sm border-border/50 rounded-2xl overflow-hidden shrink-0 min-h-[60vh] lg:min-h-0 lg:h-full">
        {selectedCustomer ? (
          <>
            <CardHeader className="border-b border-border/50 pb-5 bg-muted/10 shrink-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-black">
                    {selectedCustomer.first_name[0]}{selectedCustomer.last_name[0]}
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black tracking-tight text-foreground">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Phone: {selectedCustomer.phone_number || 'N/A'}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={selectedCustomer.current_balance <= 0}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-11 px-6 shadow-md shadow-primary/20 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 mr-1" /> Pay Utang
                </Button>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                <div className="bg-background p-4 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-500 group-hover:scale-110 transition-transform">
                    <DollarSign className="w-12 h-12" />
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Total Debt</p>
                  <p className="text-3xl font-black text-rose-500 dark:text-rose-400">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </p>
                </div>

                <div className="bg-background p-4 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-foreground group-hover:scale-110 transition-transform">
                    <Receipt className="w-12 h-12" />
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Credit Limit</p>
                  <p className="text-3xl font-black text-foreground">
                    ₱{selectedCustomer.credit_limit.toFixed(2)}
                  </p>
                </div>

                <div className="bg-background p-4 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-primary group-hover:scale-110 transition-transform">
                    <CheckCircle className="w-12 h-12" />
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Available Credit</p>
                  <p className="text-3xl font-black text-primary">
                    ₱{Math.max(0, selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardHeader>

            {/* Transaction History Section */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background shrink-0">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" /> Transaction History
                </h3>
                <div className="flex gap-2 p-1 bg-muted/50 rounded-xl border border-border/50">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 text-xs font-bold px-4 rounded-lg cursor-pointer ${ledgerTab === 'unpaid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setLedgerTab('unpaid')}
                  >
                    Unpaid
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 text-xs font-bold px-4 rounded-lg cursor-pointer ${ledgerTab === 'paid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setLedgerTab('paid')}
                  >
                    Paid & Payments
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
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
                      return (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                          <History className="w-12 h-12 mb-4 animate-pulse" />
                          <p className="font-semibold text-sm">Loading ledger history...</p>
                        </div>
                      );
                    }

                    if (filteredTimeline.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                          <CheckCircle className="w-12 h-12 mb-4 text-primary" />
                          <p className="text-lg font-bold text-foreground">No records found</p>
                          <p className="text-sm mt-1">This section is completely clear.</p>
                        </div>
                      );
                    }

                    return filteredTimeline.map((event: any) => {
                      if (event._type === 'utang') {
                        return (
                          <Card key={`u-${event.utang_id}`} className="border border-border/50 bg-background shadow-sm rounded-2xl overflow-hidden hover:border-border transition-colors">
                            <CardContent className="p-0">
                              <div className="p-4 flex justify-between items-start bg-muted/10 border-b border-border/50">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Receipt className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-bold text-foreground tracking-tight">
                                      Sale #{event.sale_id}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(event.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="font-black text-lg text-rose-500 dark:text-rose-400 leading-none mb-2">
                                    ₱{event.amount.toFixed(2)}
                                  </span>
                                  <Badge
                                    variant={event.status === 'Paid' ? 'secondary' : 'outline'}
                                    className={`text-[10px] font-bold uppercase tracking-wider ${event.status === 'Unpaid'
                                      ? 'border-rose-500/30 text-rose-600 bg-rose-500/10'
                                      : 'border-green-500/30 text-green-600 bg-green-500/10'
                                      }`}
                                  >
                                    {event.status}
                                  </Badge>
                                </div>
                              </div>

                              {/* Itemized List */}
                              {event.sales?.sale_items && event.sales.sale_items.length > 0 && (
                                <div className="p-4 bg-background space-y-2 text-sm">
                                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">
                                    Items Purchased
                                  </p>
                                  {event.sales.sale_items.map((item: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center text-foreground group">
                                      <span className="font-medium">
                                        <span className="text-muted-foreground mr-2 font-mono text-xs">{item.quantity}x</span>
                                        {item.products?.product_name || 'Product'}
                                      </span>
                                      <span className="font-bold text-muted-foreground group-hover:text-foreground transition-colors">₱{item.subtotal.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      } else {
                        return (
                          <Card key={`p-${event.payment_id}`} className="border border-green-500/30 bg-green-500/5 shadow-sm rounded-2xl overflow-hidden hover:border-green-500/50 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-sm text-green-600 dark:text-green-400 font-bold flex items-center gap-2">
                                    <div className="p-1 rounded-full bg-green-500/20">
                                      <CheckCircle className="w-4 h-4" />
                                    </div>
                                    Payment Recorded
                                  </span>
                                  <p className="text-xs text-muted-foreground mt-2 font-medium">
                                    {new Date(event.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="font-black text-xl text-green-600 dark:text-green-400">
                                    +₱{event.amount_paid.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              {event.notes && (
                                <div className="mt-4 bg-background/50 p-3 rounded-xl border border-green-500/20 flex gap-2 items-start">
                                  <span className="text-xs font-bold text-green-600 uppercase tracking-wider mt-0.5">Note</span>
                                  <p className="text-sm text-muted-foreground font-medium flex-1">
                                    {event.notes}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      }
                    });
                  })()}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 bg-muted/10">
            <User className="w-16 h-16 mb-4 text-muted-foreground/30" />
            <p className="text-xl font-bold text-foreground">No Customer Selected</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a customer from the directory to view details.</p>
          </div>
        )}
      </Card>

      {/* ================= PAYMENT DIALOG ================= */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <div className="bg-primary/10 p-6 border-b border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                <DollarSign className="w-6 h-6" />
                Record Utang Payment
              </DialogTitle>
            </DialogHeader>
          </div>

          {selectedCustomer && (
            <form onSubmit={handleRecordPayment} className="p-6 space-y-5">
              <div className="p-4 bg-muted/30 border border-border/50 rounded-xl text-sm space-y-3 shadow-inner">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Customer</span>
                  <span className="font-bold text-foreground text-sm">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </span>
                </div>
                <div className="h-px w-full bg-border/50" />
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Current Debt</span>
                  <span className="font-black text-rose-500 dark:text-rose-400 text-lg">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment Amount (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="text-lg font-bold bg-background h-12 rounded-xl focus-visible:ring-primary/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes / Reference (Optional)</Label>
                <Input
                  placeholder="e.g. Partial cash payment"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40"
                />
              </div>

              <DialogFooter className="pt-4 border-t border-border/50 mt-2">
                <Button type="button" variant="ghost" onClick={() => setIsPaymentModalOpen(false)} className="rounded-xl font-semibold cursor-pointer">Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 shadow-md shadow-primary/20 cursor-pointer">
                  Submit Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= ADD CUSTOMER DIALOG ================= */}
      <Dialog open={isAddCustomerModalOpen} onOpenChange={setIsAddCustomerModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <div className="bg-primary/10 p-6 border-b border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                <UserPlus className="w-6 h-6" />
                Add New Customer
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Name</Label>
                <Input
                  required
                  placeholder="Juan"
                  value={newCustomer.first_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                  className="bg-background h-11 rounded-xl focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Name</Label>
                <Input
                  required
                  placeholder="Dela Cruz"
                  value={newCustomer.last_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                  className="bg-background h-11 rounded-xl focus-visible:ring-primary/40"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
              <Input
                placeholder="09..."
                value={newCustomer.phone_number}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone_number: e.target.value })}
                className="bg-background h-11 rounded-xl focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Credit Limit (₱)</Label>
              <Input
                type="number"
                required
                min="0"
                step="50"
                value={newCustomer.credit_limit}
                onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: Number(e.target.value) })}
                className="bg-background h-11 rounded-xl focus-visible:ring-primary/40"
              />
            </div>
            <DialogFooter className="pt-4 border-t border-border/50 mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddCustomerModalOpen(false)} className="rounded-xl font-semibold cursor-pointer">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 shadow-md shadow-primary/20 cursor-pointer">
                Save Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
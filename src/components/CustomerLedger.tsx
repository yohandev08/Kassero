'use client';

import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import type { Customer, UtangTransaction } from '@/types';
import { fetchCustomers as fetchCustomersService, addCustomer } from '@/services/customer.Service';
import { fetchUtangHistory, recordCustomerPayment, fetchPayments } from '@/services/payment.Service';
import { useAlert } from '@/context/AlertContext';
import {
  User,
  Search,
  PhilippinePeso,
  Trash2,
  X,
  UserPlus,
  ArrowLeft,
  Clock,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Check,
  RotateCcw,
  Wallet,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

type BalanceFilter = 'all' | 'with_debt' | 'settled';

export default function CustomerLedger(): React.JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [utangHistory, setUtangHistory] = useState<UtangTransaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(true);
  
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const { showAlert, showConfirm } = useAlert();

  // Navigation state for mobile view: 'list' or 'detail'
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

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

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, balanceFilter]);

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    const { data, error } = await fetchCustomersService({
      orderBy: 'current_balance',
      ascending: false,
    });

    if (error) {
      console.error('Error fetching customers:', error);
    } else {
      const customerList = data || [];
      setCustomers(customerList);
      if (customerList.length > 0 && !selectedCustomer) {
        handleSelectCustomer(customerList[0], true);
      }
    }
    setLoadingCustomers(false);
  }, [selectedCustomer]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSelectCustomer = useCallback(async (customer: Customer, autoSelect: boolean = false) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);

    if (!autoSelect) {
      setMobileView('detail');
    }

    const [utangResponse, paymentsResponse] = await Promise.all([
      fetchUtangHistory(customer.customer_id),
      fetchPayments(customer.customer_id)
    ]);

    if (utangResponse.error) {
      console.error('Error fetching utang history:', utangResponse.error);
    } else {
      setUtangHistory((utangResponse.data as unknown as UtangTransaction[]) || []);
    }

    if (paymentsResponse.error) {
      console.error('Error fetching payment history:', paymentsResponse.error);
    } else {
      setPaymentHistory(paymentsResponse.data || []);
    }
    setLoadingHistory(false);
  }, []);

  // Store-wide metrics
  const storeMetrics = useMemo(() => {
    let totalDebt = 0;
    let debtorsCount = 0;
    let settledCount = 0;
    let totalLimit = 0;

    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      totalDebt += c.current_balance || 0;
      totalLimit += c.credit_limit || 0;
      if (c.current_balance > 0) {
        debtorsCount++;
      } else {
        settledCount++;
      }
    }

    return {
      totalDebt,
      debtorsCount,
      settledCount,
      totalLimit,
      totalCustomers: customers.length,
    };
  }, [customers]);

  // Filtering Logic (Memoized & Deferred)
  const filteredCustomers = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return customers.filter((customer) => {
      // Balance tab filter
      if (balanceFilter === 'with_debt' && customer.current_balance <= 0) return false;
      if (balanceFilter === 'settled' && customer.current_balance > 0) return false;

      // Search query filter
      if (query) {
        const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
        const phone = (customer.phone_number || '').toLowerCase();
        if (!fullName.includes(query) && !phone.includes(query)) return false;
      }

      return true;
    });
  }, [customers, deferredSearchQuery, balanceFilter]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    return filteredCustomers.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredCustomers, currentPage]);

  const handleRecordPayment = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;

    const amountPaid = parseFloat(paymentAmount);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      return showAlert('Please enter a valid payment amount.');
    }

    if (amountPaid > selectedCustomer.current_balance) {
      return showAlert('Payment amount cannot be higher than the customer current balance!');
    }

    try {
      const { data, error: paymentError } = await recordCustomerPayment({
        customer_id: selectedCustomer.customer_id,
        amount_paid: amountPaid,
        notes: paymentNotes.trim() || 'Cash Utang Payment',
      });
      if (paymentError) throw paymentError;

      const newBalance = typeof data?.new_balance === 'number'
        ? data.new_balance
        : Math.max(0, selectedCustomer.current_balance - amountPaid);

      showAlert(`Payment of ₱${amountPaid.toFixed(2)} recorded successfully!`);

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');

      await fetchCustomers();
      
      handleSelectCustomer({ ...selectedCustomer, current_balance: newBalance });
    } catch (error: any) {
      console.error('Payment error:', error);
      showAlert('Failed to process payment: ' + error.message);
    }
  }, [selectedCustomer, paymentAmount, paymentNotes, showAlert, fetchCustomers, handleSelectCustomer]);

  const toggleSelectForRemoval = useCallback((id: number) => {
    setSelectedForRemoval(previousSelected => {
      const newSet = new Set(previousSelected);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    if (selectedForRemoval.size === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedForRemoval(new Set());
    } else {
      setSelectedForRemoval(new Set(filteredCustomers.map(customer => customer.customer_id)));
    }
  }, [selectedForRemoval, filteredCustomers]);

  const exitRemoveMode = useCallback(() => {
    setRemoveMode(false);
    setSelectedForRemoval(new Set());
  }, []);

  const removeSelectedCustomers = useCallback(async () => {
    if (selectedForRemoval.size === 0) return;

    const selectedArray = Array.from(selectedForRemoval);
    const debtors = customers.filter(
      c => selectedForRemoval.has(c.customer_id) && (c.current_balance || 0) > 0
    );

    if (debtors.length > 0) {
      const names = debtors.map(d => `${d.first_name} ${d.last_name}`).slice(0, 3).join(', ');
      const extra = debtors.length > 3 ? ` and ${debtors.length - 3} others` : '';
      return showAlert(
        `Cannot delete customer(s) with an outstanding debt balance: ${names}${extra}. Please settle their unpaid utang before deleting.`,
        'Outstanding Debt'
      );
    }

    showConfirm(`Are you sure you want to delete ${selectedForRemoval.size} customer(s)? This removes their account from the directory while safely preserving past transaction history.`, async () => {
      try {
        const { archiveCustomers } = await import('@/services/customer.Service');
        const { error } = await archiveCustomers(selectedArray);
        if (error) throw error;

        setCustomers(prev => prev.filter(c => !selectedForRemoval.has(c.customer_id)));
        if (selectedCustomer && selectedForRemoval.has(selectedCustomer.customer_id)) {
          setSelectedCustomer(null);
          setUtangHistory([]);
          setPaymentHistory([]);
          setMobileView('list');
        }
        exitRemoveMode();
        showAlert(`Successfully removed ${selectedArray.length} customer(s) from directory.`);
      } catch (error: any) {
        console.error('Delete error:', error);
        showAlert('Failed to delete customers: ' + error.message);
      }
    });
  }, [selectedForRemoval, customers, showConfirm, showAlert, selectedCustomer, exitRemoveMode]);

  const handleAddCustomer = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCustomer.first_name.trim() || !newCustomer.last_name.trim()) {
      showAlert('First Name and Last Name are required.');
      return;
    }
    try {
      const { data, error } = await addCustomer({
        first_name: newCustomer.first_name.trim(),
        last_name: newCustomer.last_name.trim(),
        phone_number: newCustomer.phone_number.trim(),
        credit_limit: Number(newCustomer.credit_limit) || 500,
        current_balance: 0,
        is_allowed_utang: true,
      });

      if (error) throw error;

      await fetchCustomers();
      setIsAddCustomerModalOpen(false);
      setNewCustomer({ first_name: '', last_name: '', phone_number: '', credit_limit: 500 });
      showAlert('Customer registered to ledger successfully!');
    } catch (error: any) {
      console.error('Failed to add customer:', error);
      showAlert('Failed to add customer: ' + error.message);
    }
  }, [newCustomer, showAlert, fetchCustomers]);

  // Live calculation for payment preview
  const paymentAmountNum = parseFloat(paymentAmount) || 0;
  const remainingDebtPreview = selectedCustomer ? Math.max(0, selectedCustomer.current_balance - paymentAmountNum) : 0;

  // Duplicate name detection in Add Customer
  const isDuplicateCustomer = useMemo(() => {
    const fn = newCustomer.first_name.trim().toLowerCase();
    const ln = newCustomer.last_name.trim().toLowerCase();
    if (!fn || !ln) return false;
    return customers.some(c => c.first_name.toLowerCase() === fn && c.last_name.toLowerCase() === ln);
  }, [newCustomer, customers]);

  // Timelines Memoized
  const unpaidTimeline = useMemo(() => {
    return utangHistory
      .filter(utang => utang.status === 'Unpaid')
      .map(utang => ({ ...utang, _type: 'utang', _date: new Date(utang.created_at).getTime() }))
      .sort((a, b) => b._date - a._date);
  }, [utangHistory]);
    
  const paidTimeline = useMemo(() => {
    return [
      ...utangHistory.filter(utang => utang.status === 'Paid').map(utang => ({ ...utang, _type: 'utang', _date: new Date(utang.created_at).getTime() })),
      ...paymentHistory.map(payment => ({ ...payment, _type: 'payment', _date: new Date(payment.created_at).getTime() }))
    ].sort((a, b) => b._date - a._date);
  }, [utangHistory, paymentHistory]);

  const renderUnpaidTimeline = () => {
    if (loadingHistory) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent" />
          <span className="text-sm font-semibold">Loading transaction records...</span>
        </div>
      );
    }
    if (unpaidTimeline.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2.5 text-center p-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="font-bold text-base text-foreground">Zero Outstanding Debt</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            This customer currently has no unpaid utang. All credit balances are fully settled!
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3 pb-4">
        {unpaidTimeline.map((event: any) => (
          <Card key={`u-${event.utang_id}`} className="border-border/60 hover:border-border transition-colors shadow-xs overflow-hidden">
            <CardHeader className="p-3.5 sm:p-4 flex flex-row items-start justify-between space-y-0 gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm sm:text-base font-bold text-foreground">Sale #{event.sale_id}</CardTitle>
                  <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    Unpaid
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-1 text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{new Date(event.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </CardDescription>
              </div>
              <div className="text-right shrink-0">
                <span className="font-black text-base sm:text-lg text-rose-600 dark:text-rose-400 tabular-nums">
                  ₱{event.amount.toFixed(2)}
                </span>
              </div>
            </CardHeader>
            {((event.sales?.sale_items && event.sales.sale_items.length > 0) ||
              (event.sales?.digital_services && event.sales.digital_services.length > 0)) && (
              <CardContent className="p-3.5 sm:p-4 pt-0">
                <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-2 border border-border/40">
                  <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Purchased Items</div>
                  {event.sales.sale_items?.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center gap-2">
                      <span className="truncate text-foreground font-medium">
                        {item.quantity}x {item.products?.product_name || 'Item'}
                      </span>
                      <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
                        ₱{item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {event.sales.digital_services?.map((ds: any, index: number) => (
                    <div key={`ds-${index}`} className="flex justify-between items-center gap-2">
                      <span className="truncate text-cyan-600 dark:text-cyan-400 font-medium">
                        1x [Digital] {ds.service_type} {ds.account_number_phone ? `(${ds.account_number_phone})` : ''}
                      </span>
                      <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
                        ₱{(Number(ds.transaction_amount) + Number(ds.convenience_fee)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    );
  };

  const renderPaidTimeline = () => {
    if (loadingHistory) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent" />
          <span className="text-sm font-semibold">Loading history records...</span>
        </div>
      );
    }
    if (paidTimeline.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2.5 text-center p-4">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-1">
            <Receipt className="w-6 h-6 opacity-60" />
          </div>
          <p className="font-bold text-base text-foreground">No Payment Records Found</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            No settled accounts or payment receipts recorded for this customer yet.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3 pb-4">
        {paidTimeline.map((event: any) => {
          if (event._type === 'payment') {
            return (
              <Card key={`p-${event.payment_id}`} className="border-border/60 hover:border-border transition-colors shadow-xs overflow-hidden">
                <CardHeader className="p-3.5 sm:p-4 flex flex-row items-start justify-between space-y-0 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm sm:text-base font-bold text-foreground">Utang Payment Received</CardTitle>
                      <Badge variant="secondary" className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Received
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1 text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{new Date(event.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-base sm:text-lg text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +₱{event.amount_paid.toFixed(2)}
                    </span>
                  </div>
                </CardHeader>
                {event.notes && (
                  <CardContent className="p-3.5 sm:p-4 pt-0">
                    <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 break-words">{event.notes}</p>
                  </CardContent>
                )}
              </Card>
            );
          } else {
            return (
              <Card key={`u-${event.utang_id}`} className="border-border/40 opacity-80 hover:opacity-100 transition-opacity shadow-xs overflow-hidden">
                <CardHeader className="p-3.5 sm:p-4 flex flex-row items-start justify-between space-y-0 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm sm:text-base font-semibold text-muted-foreground">Sale #{event.sale_id}</CardTitle>
                      <Badge variant="outline" className="text-[10px] font-bold tracking-wider px-2 py-0.5 border-border/60">
                        Settled
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1 text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{new Date(event.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm sm:text-base text-muted-foreground tabular-nums">
                      ₱{event.amount.toFixed(2)}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-3.5 lg:gap-4 items-start lg:h-[calc(100dvh-6.5rem)] lg:overflow-hidden p-1 sm:p-2">
      
      {/* 1. Customer List Panel (Visible on mobile when in 'list' view, always on desktop) */}
      <Card className={cn(
        "flex-col border-border/60 bg-background shadow-xs rounded-2xl w-full overflow-hidden transition-all",
        "lg:h-full min-h-0",
        mobileView === 'list' ? 'flex' : 'hidden lg:flex'
      )}>
        <CardHeader className="p-3.5 sm:p-4 border-b border-border/50 bg-muted/15 space-y-3 shrink-0">
          <div className="flex justify-between items-center gap-2">
            <div>
              <CardTitle className="text-lg sm:text-xl font-black tracking-tight text-foreground">Customer Ledger</CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-medium">Directory & utang credit records</CardDescription>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Button 
                variant="outline" 
                onClick={() => setIsAddCustomerModalOpen(true)}
                className="h-11 min-h-[44px] px-3.5 gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-bold cursor-pointer text-xs sm:text-sm active:scale-[0.98] transition-transform motion-reduce:transform-none"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Add</span>
              </Button>
              <Button 
                variant={removeMode ? "destructive" : "outline"} 
                onClick={() => {
                  if (removeMode) exitRemoveMode();
                  else setRemoveMode(true);
                }}
                className={cn(
                  "h-11 min-h-[44px] px-3.5 gap-1.5 rounded-xl font-bold cursor-pointer text-xs sm:text-sm active:scale-[0.98] transition-transform motion-reduce:transform-none",
                  !removeMode && "border-border/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {removeMode ? <X className="w-4 h-4 shrink-0" /> : <Trash2 className="w-4 h-4 shrink-0" />}
                <span>{removeMode ? 'Cancel' : 'Remove'}</span>
              </Button>
            </div>
          </div>

          {/* Search Input with centered touch target and clear button */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by customer name or phone..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10 pr-9 h-11 min-h-[44px] bg-background border-input rounded-xl focus-visible:ring-primary/40 text-sm font-medium w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-md hover:bg-muted"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Balance Filter Tabs */}
          <Tabs
            value={balanceFilter}
            onValueChange={(val) => setBalanceFilter(val as BalanceFilter)}
            className="w-full"
          >
            <TabsList className="h-10 min-h-[40px] p-1 bg-muted/60 border border-border/50 rounded-xl w-full grid grid-cols-3">
              <TabsTrigger
                value="all"
                className="rounded-lg text-xs font-bold px-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
              >
                All ({storeMetrics.totalCustomers})
              </TabsTrigger>
              <TabsTrigger
                value="with_debt"
                className="rounded-lg text-xs font-bold px-2 data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600 dark:data-[state=active]:text-rose-400 data-[state=active]:shadow-xs cursor-pointer"
              >
                With Debt ({storeMetrics.debtorsCount})
              </TabsTrigger>
              <TabsTrigger
                value="settled"
                className="rounded-lg text-xs font-bold px-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-xs cursor-pointer"
              >
                Settled ({storeMetrics.settledCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
          <ScrollArea className="flex-1 h-full min-h-0">
            <div className="p-3 sm:p-4 space-y-2.5">
              {loadingCustomers ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2 text-center p-4">
                  <User className="w-8 h-8 opacity-40 animate-pulse text-primary mb-1" />
                  <p className="font-bold text-sm text-foreground">Loading directory...</p>
                  <p className="text-xs text-muted-foreground">Retrieving customer balances and accounts</p>
                </div>
              ) : paginatedCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 text-center p-4">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-1">
                    <User className="w-6 h-6 opacity-40" />
                  </div>
                  <p className="font-bold text-foreground text-sm">No customers found</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {searchQuery || balanceFilter !== 'all'
                      ? 'No customers match your current search or balance filter.'
                      : 'You have not registered any customers yet.'}
                  </p>
                  {(searchQuery || balanceFilter !== 'all') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setBalanceFilter('all');
                      }}
                      className="mt-3 rounded-xl font-bold h-9 gap-1.5 border-border/60 cursor-pointer text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Filters</span>
                    </Button>
                  )}
                </div>
              ) : (
                paginatedCustomers.map((customer) => {
                  const isSelected = selectedCustomer?.customer_id === customer.customer_id;
                  const isOverLimit = customer.current_balance > customer.credit_limit;
                  const isSelectedForRemoval = selectedForRemoval.has(customer.customer_id);

                  return (
                    <div
                      key={customer.customer_id}
                      role="button"
                      tabIndex={0}
                      onClick={removeMode ? () => toggleSelectForRemoval(customer.customer_id) : () => handleSelectCustomer(customer)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (removeMode) toggleSelectForRemoval(customer.customer_id);
                          else handleSelectCustomer(customer);
                        }
                      }}
                      className={cn(
                        "w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none",
                        "flex items-center justify-between gap-3 min-h-[64px] active:scale-[0.99] motion-reduce:transform-none",
                        isSelected && !removeMode
                          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30" 
                          : "border-border/60 bg-background hover:bg-muted/40",
                        removeMode && isSelectedForRemoval && "border-destructive bg-destructive/10"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {removeMode && (
                          <div className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                            isSelectedForRemoval ? "bg-destructive border-destructive text-white" : "border-muted-foreground/40 bg-background"
                          )}>
                            {isSelectedForRemoval && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm sm:text-base text-foreground truncate">
                            {customer.first_name} {customer.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            {customer.phone_number ? (
                              <>
                                <Phone className="w-3 h-3 shrink-0" />
                                <span>{customer.phone_number}</span>
                              </>
                            ) : (
                              'No contact number'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                        <span className={cn(
                          "font-black text-sm sm:text-base tabular-nums",
                          customer.current_balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                        )}>
                          ₱{customer.current_balance.toFixed(2)}
                        </span>
                        <Badge 
                          variant={isOverLimit ? "destructive" : "secondary"}
                          className={cn(
                            "text-[10px] font-bold px-2 py-0 h-5 tabular-nums",
                            isOverLimit 
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30" 
                              : "bg-muted text-muted-foreground border-border/50"
                          )}
                        >
                          {isOverLimit ? 'Over Limit' : `Limit: ₱${customer.credit_limit}`}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          
          {totalPages > 1 && !removeMode && (
            <div className="flex items-center justify-between p-3 sm:p-4 border-t border-border/40 bg-muted/10 gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((previousPage) => Math.max(1, previousPage - 1))}
                disabled={currentPage === 1}
                className="h-11 min-h-[44px] px-4 rounded-xl font-bold text-xs sm:text-sm cursor-pointer"
              >
                Previous
              </Button>
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((previousPage) => Math.min(totalPages, previousPage + 1))}
                disabled={currentPage === totalPages}
                className="h-11 min-h-[44px] px-4 rounded-xl font-bold text-xs sm:text-sm cursor-pointer"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>

        {removeMode && (
          <CardFooter className="bg-muted/30 p-3 sm:p-4 border-t border-border/40 flex flex-col gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex justify-between items-center w-full text-xs font-bold">
              <span className="text-muted-foreground tabular-nums">{selectedForRemoval.size} customer(s) selected</span>
              <Button variant="ghost" size="sm" onClick={selectAllFiltered} className="h-8 text-primary font-bold cursor-pointer hover:bg-primary/10">
                {selectedForRemoval.size === filteredCustomers.length && filteredCustomers.length > 0 ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 h-11 min-h-[44px] rounded-xl font-bold cursor-pointer border-border/70" onClick={exitRemoveMode}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1 h-11 min-h-[44px] rounded-xl font-bold cursor-pointer active:scale-[0.98] transition-transform motion-reduce:transform-none" 
                disabled={selectedForRemoval.size === 0} 
                onClick={removeSelectedCustomers}
              >
                Delete Selected {selectedForRemoval.size > 0 ? `(${selectedForRemoval.size})` : ''}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* 2. Customer Details & Ledger Panel (Visible on mobile when in 'detail' view, always on desktop) */}
      <Card className={cn(
        "flex-col border-border/60 bg-background shadow-xs rounded-2xl w-full overflow-hidden transition-all",
        "lg:h-full min-h-0",
        mobileView === 'detail' ? 'flex' : 'hidden lg:flex'
      )}>
        {selectedCustomer ? (
          <>
            <CardHeader className="p-3.5 sm:p-4 border-b border-border/50 bg-muted/15 space-y-3.5 shrink-0">
              {/* Header with Mobile Back button & Customer summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <Button
                    variant="outline"
                    onClick={() => setMobileView('list')}
                    className="lg:hidden h-11 min-h-[44px] px-3 gap-1 rounded-xl font-bold border-border/60 cursor-pointer shrink-0"
                    aria-label="Back to Customer List"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">Back</span>
                  </Button>

                  <div className="min-w-0">
                    <CardTitle className="text-lg sm:text-2xl font-black text-foreground truncate tracking-tight">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate font-medium">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{selectedCustomer.phone_number || 'No contact number registered'}</span>
                    </CardDescription>
                  </div>
                </div>

                {/* Primary Action: Pay Utang */}
                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={selectedCustomer.current_balance <= 0}
                  className={cn(
                    "h-11 min-h-[44px] px-5 gap-2 rounded-xl font-bold text-sm shadow-sm cursor-pointer shrink-0 w-full sm:w-auto active:scale-[0.98] transition-transform motion-reduce:transform-none",
                    selectedCustomer.current_balance > 0 
                      ? "bg-primary hover:bg-primary/90 text-white" 
                      : "opacity-60 cursor-not-allowed"
                  )}
                >
                  <PhilippinePeso className="w-4 h-4 shrink-0" />
                  <span>Record Payment</span>
                </Button>
              </div>

              {/* Responsive Financial Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {/* Total Debt */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-rose-500/25 bg-rose-500/10 flex flex-col justify-center">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Outstanding Debt
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </span>
                </div>

                {/* Credit Limit */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-border/60 bg-muted/40 flex flex-col justify-center">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Credit Limit
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-foreground mt-0.5 tabular-nums">
                    ₱{selectedCustomer.credit_limit.toFixed(2)}
                  </span>
                </div>

                {/* Available Credit */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-primary/25 bg-primary/10 flex flex-col justify-center">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary">
                    Available Credit
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-primary mt-0.5 tabular-nums">
                    ₱{Math.max(0, selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardHeader>

            {/* Tabs & Timeline History */}
            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden min-h-0">
              <Tabs defaultValue="unpaid" className="flex-1 flex flex-col min-h-0">
                <div className="px-3.5 sm:px-6 pt-3 pb-2 border-b border-border/40 bg-muted/10 shrink-0">
                  <TabsList className="grid w-full grid-cols-2 h-11 min-h-[44px] p-1 bg-muted/60 rounded-xl">
                    <TabsTrigger 
                      value="unpaid" 
                      className="h-9 rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
                    >
                      Unpaid Utang ({unpaidTimeline.length})
                    </TabsTrigger>
                    <TabsTrigger 
                      value="paid" 
                      className="h-9 rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs cursor-pointer"
                    >
                      Paid & History ({paidTimeline.length})
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <ScrollArea className="flex-1 p-3.5 sm:p-6 h-full min-h-0">
                  <TabsContent value="unpaid" className="m-0 focus-visible:outline-none">
                    {renderUnpaidTimeline()}
                  </TabsContent>
                  
                  <TabsContent value="paid" className="m-0 focus-visible:outline-none">
                    {renderPaidTimeline()}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <User className="w-8 h-8 opacity-40 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold text-foreground">No Customer Selected</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs">
              Choose a customer from the directory to inspect their utang history and record payments.
            </p>
          </div>
        )}
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <div className="bg-primary/10 p-5 sm:p-6 border-b border-primary/20">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-black text-primary flex items-center gap-2">
                <PhilippinePeso className="w-5 h-5 sm:w-6 sm:h-6" />
                Record Utang Payment
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-1">
              Record a full or partial debt payment received from this customer.
            </p>
          </div>

          {selectedCustomer && (
            <form onSubmit={handleRecordPayment} className="p-5 sm:p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm p-3.5 rounded-xl bg-muted/40 border border-border/50">
                  <span className="text-xs font-semibold text-muted-foreground">Customer</span>
                  <span className="font-bold text-foreground">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                </div>

                <div className="flex justify-between items-center text-sm p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Current Outstanding Debt</span>
                  <span className="font-black text-rose-600 dark:text-rose-400 text-base tabular-nums">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </span>
                </div>
                
                {/* Payment Amount Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="payment-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Payment Amount (₱)
                    </Label>
                    {paymentAmountNum > 0 && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        Remaining Debt: ₱{remainingDebtPreview.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <Input
                    id="payment-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    max={selectedCustomer.current_balance}
                    required
                    placeholder="0.00"
                    value={paymentAmount}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    className="h-12 min-h-[44px] rounded-xl text-lg font-black tabular-nums focus-visible:ring-primary/40 bg-background"
                  />
                  
                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider mr-1">Quick Set:</span>
                    {[50, 100, 200, 500].map((preset) => {
                      if (preset > selectedCustomer.current_balance) return null;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPaymentAmount(preset.toFixed(2))}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border/60 bg-muted/30 hover:bg-muted hover:border-primary/50 text-foreground transition-all cursor-pointer active:scale-95 motion-reduce:transform-none tabular-nums"
                        >
                          ₱{preset}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(selectedCustomer.current_balance.toFixed(2))}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer active:scale-95 motion-reduce:transform-none tabular-nums"
                    >
                      Full Amount (₱{selectedCustomer.current_balance.toFixed(2)})
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="payment-notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Notes / Reference (Optional)
                  </Label>
                  <Input
                    id="payment-notes"
                    placeholder="e.g. Cash payment, GCash ref #..."
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    className="h-11 min-h-[44px] rounded-xl text-sm bg-background font-medium focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-border/50 gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="h-11 min-h-[44px] rounded-xl font-bold border-border/60 hover:bg-muted cursor-pointer w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={paymentAmountNum <= 0 || paymentAmountNum > selectedCustomer.current_balance}
                  className="h-11 min-h-[44px] rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-sm cursor-pointer w-full sm:w-auto active:scale-[0.98] transition-transform motion-reduce:transform-none disabled:opacity-50"
                >
                  Confirm Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={isAddCustomerModalOpen} onOpenChange={setIsAddCustomerModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <div className="bg-primary/10 p-5 sm:p-6 border-b border-primary/20">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-black text-primary flex items-center gap-2">
                <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
                Register New Customer
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-1">
              Add a regular customer to your store ledger to enable trust-based utang accounts.
            </p>
          </div>

          <form onSubmit={handleAddCustomer} className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="cust-first-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  First Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="cust-first-name"
                  required
                  placeholder="Juan"
                  value={newCustomer.first_name}
                  onChange={(event) => setNewCustomer({ ...newCustomer, first_name: event.target.value })}
                  className="h-11 min-h-[44px] rounded-xl text-sm font-medium bg-background focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-last-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Last Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="cust-last-name"
                  required
                  placeholder="Dela Cruz"
                  value={newCustomer.last_name}
                  onChange={(event) => setNewCustomer({ ...newCustomer, last_name: event.target.value })}
                  className="h-11 min-h-[44px] rounded-xl text-sm font-medium bg-background focus-visible:ring-primary/40"
                />
              </div>
            </div>

            {isDuplicateCustomer && (
              <p className="text-xs text-rose-500 font-semibold">A customer with this name is already registered.</p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cust-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Phone Number (Optional)
              </Label>
              <Input
                id="cust-phone"
                type="tel"
                inputMode="tel"
                placeholder="09123456789"
                value={newCustomer.phone_number}
                onChange={(event) => setNewCustomer({ ...newCustomer, phone_number: event.target.value })}
                className="h-11 min-h-[44px] rounded-xl text-sm font-medium bg-background focus-visible:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust-credit-limit" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Default Credit Limit (₱)
              </Label>
              <Input
                id="cust-credit-limit"
                type="number"
                inputMode="numeric"
                required
                min="0"
                step="50"
                value={newCustomer.credit_limit}
                onFocus={(event) => event.target.select()}
                onChange={(event) => setNewCustomer({ ...newCustomer, credit_limit: Number(event.target.value) })}
                className="h-11 min-h-[44px] rounded-xl text-sm font-bold bg-background tabular-nums focus-visible:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground">
                Maximum allowable credit balance before POS raises an over-limit warning.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t border-border/50 gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="h-11 min-h-[44px] rounded-xl font-bold border-border/60 hover:bg-muted cursor-pointer w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isDuplicateCustomer || !newCustomer.first_name.trim() || !newCustomer.last_name.trim()}
                className="h-11 min-h-[44px] rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-sm cursor-pointer w-full sm:w-auto active:scale-[0.98] transition-transform motion-reduce:transform-none disabled:opacity-50"
              >
                Register Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
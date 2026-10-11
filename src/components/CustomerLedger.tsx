'use client';

import { useState, useEffect } from 'react';
import type { Customer, UtangTransaction } from '@/types';
import { fetchCustomers as fetchCustomersService, updateCustomerBalance, addCustomer } from '@/services/customer.Service';
import { fetchUtangHistory, recordPayment, markUtangAsPaid, fetchPayments } from '@/services/payment.Service';
import { useAlert } from '@/context/AlertContext';
import {
  User,
  Search,
  DollarSign,
  Trash2,
  X,
  UserPlus,
  ArrowLeft,
  Clock,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Check
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
import { cn } from 'cn';

export default function CustomerLedger(): React.JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [utangHistory, setUtangHistory] = useState<UtangTransaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  
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
  }, [searchQuery]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await fetchCustomersService({
      orderBy: 'current_balance',
      ascending: false,
    });

    if (error) {
      console.error('Error fetching customers:', error);
    } else {
      setCustomers(data || []);
      if (data && data.length > 0 && !selectedCustomer) {
        handleSelectCustomer(data[0], true);
      }
    }
  };

  const handleSelectCustomer = async (customer: Customer, autoSelect: boolean = false) => {
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
  };

  const handleRecordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;

    const amountPaid = parseFloat(paymentAmount);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      return showAlert('Please enter a valid payment amount.');
    }

    if (amountPaid > selectedCustomer.current_balance) {
      return showAlert('Payment amount cannot be higher than the current balance!');
    }

    try {
      const { error: paymentError } = await recordPayment({
        customer_id: selectedCustomer.customer_id,
        amount_paid: amountPaid,
        notes: paymentNotes || 'Cash Utang Payment',
      });
      if (paymentError) throw paymentError;

      const newBalance = selectedCustomer.current_balance - amountPaid;
      const { error: customerError } = await updateCustomerBalance(
        selectedCustomer.customer_id,
        newBalance
      );

      if (customerError) throw customerError;

      if (newBalance === 0) {
        await markUtangAsPaid(selectedCustomer.customer_id);
      }

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
  };

  const filteredCustomers = customers.filter((customer) =>
    `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleSelectForRemoval = (id: number) => {
    setSelectedForRemoval(previousSelected => {
      const newSet = new Set(previousSelected);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    if (selectedForRemoval.size === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedForRemoval(new Set());
    } else {
      setSelectedForRemoval(new Set(filteredCustomers.map(customer => customer.customer_id)));
    }
  };

  const exitRemoveMode = () => {
    setRemoveMode(false);
    setSelectedForRemoval(new Set());
  };

  const removeSelectedCustomers = async () => {
    if (selectedForRemoval.size === 0) return;
    showConfirm(`Are you sure you want to delete ${selectedForRemoval.size} customer(s)?`, async () => {
      try {
        const { deleteCustomers } = await import('@/services/customer.Service');
        const { error } = await deleteCustomers(Array.from(selectedForRemoval));
        if (error) throw error;

        setCustomers(customers.filter(customer => !selectedForRemoval.has(customer.customer_id)));
        if (selectedCustomer && selectedForRemoval.has(selectedCustomer.customer_id)) {
          setSelectedCustomer(null);
          setUtangHistory([]);
          setMobileView('list');
        }
        exitRemoveMode();
      } catch (error: any) {
        console.error('Delete error:', error);
        showAlert('Failed to delete customers: ' + error.message);
      }
    });
  };

  const handleAddCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCustomer.first_name || !newCustomer.last_name) {
      showAlert('First Name and Last Name are required.');
      return;
    }
    try {
      const { data, error } = await addCustomer({
        ...newCustomer,
        current_balance: 0,
        is_allowed_utang: true,
      });

      if (error) throw error;

      await fetchCustomers();
      setIsAddCustomerModalOpen(false);
      setNewCustomer({ first_name: '', last_name: '', phone_number: '', credit_limit: 500 });
      showAlert('Customer added successfully!');
    } catch (error: any) {
      console.error('Failed to add customer:', error);
      showAlert('Failed to add customer: ' + error.message);
    }
  };
  
  const unpaidTimeline = utangHistory
    .filter(utang => utang.status === 'Unpaid')
    .map(utang => ({ ...utang, _type: 'utang', _date: new Date(utang.created_at).getTime() }))
    .sort((firstEntry, secondEntry) => secondEntry._date - firstEntry._date);
    
  const paidTimeline = [
    ...utangHistory.filter(utang => utang.status === 'Paid').map(utang => ({ ...utang, _type: 'utang', _date: new Date(utang.created_at).getTime() })),
    ...paymentHistory.map(payment => ({ ...payment, _type: 'payment', _date: new Date(payment.created_at).getTime() }))
  ].sort((firstEntry, secondEntry) => secondEntry._date - firstEntry._date);

  const renderUnpaidTimeline = () => {
    if (loadingHistory) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium">Loading transactions...</span>
        </div>
      );
    }
    if (unpaidTimeline.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 text-center p-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mb-1" />
          <p className="font-semibold text-foreground">No unpaid utang</p>
          <p className="text-xs text-muted-foreground">All credit balances are fully settled.</p>
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
                  <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">Unpaid</Badge>
                </div>
                <CardDescription className="text-xs mt-1 text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{new Date(event.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </CardDescription>
              </div>
              <div className="text-right shrink-0">
                <span className="font-black text-base sm:text-lg text-destructive">₱{event.amount.toFixed(2)}</span>
              </div>
            </CardHeader>
            {event.sales?.sale_items && event.sales.sale_items.length > 0 && (
              <CardContent className="p-3.5 sm:p-4 pt-0">
                <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-2 border border-border/40">
                  <div className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Purchased Items</div>
                  {event.sales.sale_items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center gap-2">
                      <span className="truncate text-foreground font-medium">
                        {item.quantity}x {item.products?.product_name || 'Item'}
                      </span>
                      <span className="shrink-0 font-bold text-muted-foreground">
                        ₱{item.subtotal.toFixed(2)}
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
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium">Loading history...</span>
        </div>
      );
    }
    if (paidTimeline.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 text-center p-4">
          <Receipt className="w-10 h-10 text-muted-foreground/40 mb-1" />
          <p className="font-semibold text-foreground">No payment records found</p>
          <p className="text-xs text-muted-foreground">No settled accounts or payment history recorded yet.</p>
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
                      <CardTitle className="text-sm sm:text-base font-bold text-foreground">Utang Payment</CardTitle>
                      <Badge variant="secondary" className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-primary/10 text-primary border-primary/20">Received</Badge>
                    </div>
                    <CardDescription className="text-xs mt-1 text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{new Date(event.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-base sm:text-lg text-primary">+₱{event.amount_paid.toFixed(2)}</span>
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
                      <Badge variant="outline" className="text-[10px] font-bold tracking-wider px-2 py-0.5">Settled</Badge>
                    </div>
                    <CardDescription className="text-xs mt-1 text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{new Date(event.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm sm:text-base text-muted-foreground">₱{event.amount.toFixed(2)}</span>
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
    <div className="w-full max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-4 lg:gap-6 items-start">
      
      {/* 1. Customer List Panel (Visible on mobile when in 'list' view, always on desktop) */}
      <Card className={cn(
        "flex-col border-border/50 bg-background shadow-sm rounded-2xl w-full overflow-hidden transition-all",
        "lg:h-[calc(100dvh-5.5rem)]",
        mobileView === 'list' ? 'flex' : 'hidden lg:flex'
      )}>
        <CardHeader className="p-4 sm:p-5 border-b border-border/40 space-y-3">
          <div className="flex justify-between items-center gap-2">
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">Customers</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Directory & utang credit</CardDescription>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Button 
                variant="outline" 
                onClick={() => setIsAddCustomerModalOpen(true)}
                className="h-11 min-h-[44px] px-3.5 gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-semibold cursor-pointer text-xs sm:text-sm"
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
                  "h-11 min-h-[44px] px-3.5 gap-1.5 rounded-xl font-semibold cursor-pointer text-xs sm:text-sm",
                  !removeMode && "border-border/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {removeMode ? <X className="w-4 h-4 shrink-0" /> : <Trash2 className="w-4 h-4 shrink-0" />}
                <span>{removeMode ? 'Cancel' : 'Remove'}</span>
              </Button>
            </div>
          </div>

          {/* Search Input with centered touch target */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10 pr-4 h-11 min-h-[44px] bg-muted/40 border-border/50 rounded-xl focus-visible:ring-primary/30 text-sm w-full"
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
          <ScrollArea className="flex-1 h-full">
            <div className="p-3 sm:p-4 space-y-2.5">
              {paginatedCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 text-center p-4">
                  <User className="w-10 h-10 opacity-30 mb-1" />
                  <p className="font-semibold text-foreground text-sm">No customers found</p>
                  <p className="text-xs text-muted-foreground">Try a different name or add a new customer.</p>
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
                        "flex items-center justify-between gap-3 min-h-[64px] active:scale-[0.99]",
                        isSelected && !removeMode
                          ? "border-primary bg-primary/5 shadow-xs" 
                          : "border-border/50 bg-background hover:bg-muted/40",
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
                              'No phone number'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                        <span className={cn(
                          "font-black text-sm sm:text-base",
                          customer.current_balance > 0 ? "text-destructive" : "text-muted-foreground"
                        )}>
                          ₱{customer.current_balance.toFixed(2)}
                        </span>
                        <Badge 
                          variant={isOverLimit ? "destructive" : "secondary"}
                          className="text-[10px] font-bold px-2 py-0 h-5"
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
                className="h-11 min-h-[44px] px-4 rounded-xl font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Previous
              </Button>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((previousPage) => Math.min(totalPages, previousPage + 1))}
                disabled={currentPage === totalPages}
                className="h-11 min-h-[44px] px-4 rounded-xl font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>

        {removeMode && (
          <CardFooter className="bg-muted/30 p-3 sm:p-4 border-t border-border/40 flex flex-col gap-2 shrink-0">
            <div className="flex justify-between items-center w-full text-xs font-semibold">
              <span className="text-muted-foreground">{selectedForRemoval.size} customer(s) selected</span>
              <Button variant="ghost" size="sm" onClick={selectAllFiltered} className="h-8 text-primary font-bold cursor-pointer">
                {selectedForRemoval.size === filteredCustomers.length && filteredCustomers.length > 0 ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 h-11 min-h-[44px] rounded-xl font-semibold cursor-pointer" onClick={exitRemoveMode}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1 h-11 min-h-[44px] rounded-xl font-bold cursor-pointer" 
                disabled={selectedForRemoval.size === 0} 
                onClick={removeSelectedCustomers}
              >
                Delete {selectedForRemoval.size > 0 ? `(${selectedForRemoval.size})` : ''}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* 2. Customer Details & Ledger Panel (Visible on mobile when in 'detail' view, always on desktop) */}
      <Card className={cn(
        "flex-col border-border/50 bg-background shadow-sm rounded-2xl w-full overflow-hidden transition-all",
        "lg:h-[calc(100dvh-5.5rem)]",
        mobileView === 'detail' ? 'flex' : 'hidden lg:flex'
      )}>
        {selectedCustomer ? (
          <>
            <CardHeader className="p-4 sm:p-5 border-b border-border/40 space-y-4">
              {/* Header with Mobile Back button & Customer summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <Button
                    variant="outline"
                    onClick={() => setMobileView('list')}
                    className="lg:hidden h-11 min-h-[44px] px-3 gap-1 rounded-xl font-semibold border-border/60 cursor-pointer shrink-0"
                    aria-label="Back to Customer List"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">Back</span>
                  </Button>

                  <div className="min-w-0">
                    <CardTitle className="text-lg sm:text-2xl font-black text-foreground truncate">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{selectedCustomer.phone_number || 'No contact number'}</span>
                    </CardDescription>
                  </div>
                </div>

                {/* Primary Action: Pay Utang */}
                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={selectedCustomer.current_balance <= 0}
                  className={cn(
                    "h-11 min-h-[44px] px-5 gap-2 rounded-xl font-bold text-sm shadow-md cursor-pointer shrink-0 w-full sm:w-auto",
                    selectedCustomer.current_balance > 0 
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20" 
                      : "opacity-60"
                  )}
                >
                  <DollarSign className="w-4 h-4 shrink-0" />
                  <span>Pay Utang</span>
                </Button>
              </div>

              {/* Responsive Financial Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                <div className="p-3.5 sm:p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex flex-col justify-center">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Debt</span>
                  <span className="text-xl sm:text-2xl font-black text-destructive mt-0.5">
                    ₱{selectedCustomer.current_balance.toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 sm:p-4 rounded-xl border border-border/60 bg-muted/30 flex flex-col justify-center">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Credit Limit</span>
                  <span className="text-xl sm:text-2xl font-black text-foreground mt-0.5">
                    ₱{selectedCustomer.credit_limit.toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 sm:p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col justify-center">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary">Available Credit</span>
                  <span className="text-xl sm:text-2xl font-black text-primary mt-0.5">
                    ₱{Math.max(0, selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardHeader>

            {/* Tabs & Timeline History */}
            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden min-h-0">
              <Tabs defaultValue="unpaid" className="flex-1 flex flex-col min-h-0">
                <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-border/40 bg-muted/10 shrink-0">
                  <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/60 rounded-xl">
                    <TabsTrigger value="unpaid" className="h-9 rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer">
                      Unpaid Utang ({unpaidTimeline.length})
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="h-9 rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer">
                      Paid & History ({paidTimeline.length})
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <ScrollArea className="flex-1 p-3.5 sm:p-6 h-full">
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
            <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
              <User className="w-8 h-8 opacity-40 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold text-foreground">No Customer Selected</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs">
              Choose a customer from the directory to view their utang history and record payments.
            </p>
          </div>
        )}
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl p-5 sm:p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold">Record Utang Payment</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-sm p-3 rounded-xl bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-bold text-foreground">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <span className="text-muted-foreground font-medium">Current Debt</span>
                  <span className="font-black text-destructive text-base">₱{selectedCustomer.current_balance.toFixed(2)}</span>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="payment-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Payment Amount (₱)
                  </Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    className="h-11 min-h-[44px] rounded-xl text-base font-semibold"
                  />
                  {selectedCustomer.current_balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(selectedCustomer.current_balance.toFixed(2))}
                      className="text-xs text-primary font-bold hover:underline cursor-pointer pt-1"
                    >
                      Set to Full Amount (₱{selectedCustomer.current_balance.toFixed(2)})
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="payment-notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Notes / Reference (Optional)
                  </Label>
                  <Input
                    id="payment-notes"
                    placeholder="e.g. Partial cash payment"
                    value={paymentNotes}
                    onChange={(event) => setPaymentNotes(event.target.value)}
                    className="h-11 min-h-[44px] rounded-xl text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="h-11 min-h-[44px] rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="h-11 min-h-[44px] rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer w-full sm:w-auto"
                >
                  Submit Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={isAddCustomerModalOpen} onOpenChange={setIsAddCustomerModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md w-[95vw] rounded-2xl p-5 sm:p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold">Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCustomer} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="cust-first-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Name</Label>
                <Input
                  id="cust-first-name"
                  required
                  placeholder="Juan"
                  value={newCustomer.first_name}
                  onChange={(event) => setNewCustomer({ ...newCustomer, first_name: event.target.value })}
                  className="h-11 min-h-[44px] rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-last-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Name</Label>
                <Input
                  id="cust-last-name"
                  required
                  placeholder="Dela Cruz"
                  value={newCustomer.last_name}
                  onChange={(event) => setNewCustomer({ ...newCustomer, last_name: event.target.value })}
                  className="h-11 min-h-[44px] rounded-xl text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
              <Input
                id="cust-phone"
                placeholder="09123456789"
                value={newCustomer.phone_number}
                onChange={(event) => setNewCustomer({ ...newCustomer, phone_number: event.target.value })}
                className="h-11 min-h-[44px] rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-credit-limit" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Credit Limit (₱)</Label>
              <Input
                id="cust-credit-limit"
                type="number"
                required
                min="0"
                step="50"
                value={newCustomer.credit_limit}
                onChange={(event) => setNewCustomer({ ...newCustomer, credit_limit: Number(event.target.value) })}
                className="h-11 min-h-[44px] rounded-xl text-sm"
              />
            </div>
            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="h-11 min-h-[44px] rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="h-11 min-h-[44px] rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer w-full sm:w-auto"
              >
                Save Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
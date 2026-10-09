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
  UserPlus
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CustomerLedger(): React.JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [utangHistory, setUtangHistory] = useState<UtangTransaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  
  const { showAlert, showConfirm } = useAlert();

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

  // Mobile details modal state
  const [isMobileDetailsModalOpen, setIsMobileDetailsModalOpen] = useState<boolean>(false);
  const [mobileViewTab, setMobileViewTab] = useState<'details' | 'unpaid' | 'paid'>('details');

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

    if (error) console.error('Error fetching customers:', error);
    else {
      setCustomers(data || []);
      if (data && data.length > 0 && !selectedCustomer) {
        handleSelectCustomer(data[0], true);
      }
    }
  };

  const handleSelectCustomer = async (customer: Customer, autoSelect: boolean = false) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);

    if (!autoSelect && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileViewTab('details');
      setIsMobileDetailsModalOpen(true);
    }

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

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amountPaid = parseFloat(paymentAmount);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      return showAlert('Please enter a valid payment amount.');
    }

    if (amountPaid > selectedCustomer.current_balance) {
      return showAlert('Payment amount cannot be higher than the current balance!');
    }

    try {
      const { error: payErr } = await recordPayment({
        customer_id: selectedCustomer.customer_id,
        amount_paid: amountPaid,
        notes: paymentNotes || 'Cash Utang Payment',
      });
      if (payErr) throw payErr;

      const newBalance = selectedCustomer.current_balance - amountPaid;
      const { error: custErr } = await updateCustomerBalance(
        selectedCustomer.customer_id,
        newBalance
      );

      if (custErr) throw custErr;

      if (newBalance === 0) {
        await markUtangAsPaid(selectedCustomer.customer_id);
      }

      showAlert(`Payment of ₱${amountPaid.toFixed(2)} recorded successfully!`);

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');

      await fetchCustomers();
      
      // Update selected customer state while keeping modals open if they were
      handleSelectCustomer({ ...selectedCustomer, current_balance: newBalance });
    } catch (err: any) {
      console.error('Payment error:', err);
      showAlert('Failed to process payment: ' + err.message);
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
    showConfirm(`Are you sure you want to delete ${selectedForRemoval.size} customer(s)?`, async () => {
      try {
        const { deleteCustomers } = await import('@/services/customer.Service');
        const { error } = await deleteCustomers(Array.from(selectedForRemoval));
        if (error) throw error;

        setCustomers(customers.filter(c => !selectedForRemoval.has(c.customer_id)));
        if (selectedCustomer && selectedForRemoval.has(selectedCustomer.customer_id)) {
          setSelectedCustomer(null);
          setUtangHistory([]);
          setIsMobileDetailsModalOpen(false);
        }
        exitRemoveMode();
      } catch (err: any) {
        console.error('Delete error:', err);
        showAlert('Failed to delete customers: ' + err.message);
      }
    });
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err: any) {
      console.error('Failed to add customer:', err);
      showAlert('Failed to add customer: ' + err.message);
    }
  };
  
  const unpaidTimeline = utangHistory
    .filter(u => u.status === 'Unpaid')
    .map(u => ({ ...u, _type: 'utang', _date: new Date(u.created_at).getTime() }))
    .sort((a, b) => b._date - a._date);
    
  const paidTimeline = [
    ...utangHistory.filter(u => u.status === 'Paid').map(u => ({ ...u, _type: 'utang', _date: new Date(u.created_at).getTime() })),
    ...paymentHistory.map(p => ({ ...p, _type: 'payment', _date: new Date(p.created_at).getTime() }))
  ].sort((a, b) => b._date - a._date);

  const renderUnpaidTimeline = () => {
    if (loadingHistory) {
      return <div className="text-center text-muted-foreground py-8">Loading history...</div>;
    }
    if (unpaidTimeline.length === 0) {
      return <div className="text-center text-muted-foreground py-8">No unpaid utang found.</div>;
    }
    return (
      <div className="space-y-4">
        {unpaidTimeline.map((event: any) => (
          <Card key={`u-${event.utang_id}`}>
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Sale #{event.sale_id}</CardTitle>
                <CardDescription>{new Date(event.created_at).toLocaleString()}</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                 <span className="font-bold text-destructive">₱{event.amount.toFixed(2)}</span>
                 <Badge variant="destructive">Unpaid</Badge>
              </div>
            </CardHeader>
            {event.sales?.sale_items && event.sales.sale_items.length > 0 && (
              <CardContent className="p-4 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.sales.sale_items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{item.quantity}x {item.products?.product_name || 'Product'}</TableCell>
                        <TableCell className="text-right">₱{item.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    );
  };

  const renderPaidTimeline = () => {
    if (loadingHistory) {
      return <div className="text-center text-muted-foreground py-8">Loading history...</div>;
    }
    if (paidTimeline.length === 0) {
      return <div className="text-center text-muted-foreground py-8">No payment records found.</div>;
    }
    return (
      <div className="space-y-4">
        {paidTimeline.map((event: any) => {
          if (event._type === 'payment') {
            return (
              <Card key={`p-${event.payment_id}`}>
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">Payment</CardTitle>
                    <CardDescription>{new Date(event.created_at).toLocaleString()}</CardDescription>
                  </div>
                  <span className="font-bold text-primary">+₱{event.amount_paid.toFixed(2)}</span>
                </CardHeader>
                {event.notes && (
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground">{event.notes}</p>
                  </CardContent>
                )}
              </Card>
            );
          } else {
            return (
              <Card key={`u-${event.utang_id}`}>
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base text-muted-foreground">Sale #{event.sale_id}</CardTitle>
                    <CardDescription>{new Date(event.created_at).toLocaleString()}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     <span className="font-bold text-muted-foreground">₱{event.amount.toFixed(2)}</span>
                     <Badge variant="outline">Paid</Badge>
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
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 p-6 h-full items-start">
      {/* 1. Customer List Panel */}
      <Card className="flex flex-col h-[calc(100vh-3rem)]">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Customers</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsAddCustomerModalOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" /> Add
              </Button>
              <Button 
                size="sm" 
                variant={removeMode ? "destructive" : "outline"} 
                onClick={() => {
                  if (removeMode) exitRemoveMode();
                  else setRemoveMode(true);
                }}
              >
                {removeMode ? <X className="w-4 h-4 mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {removeMode ? 'Cancel' : 'Remove'}
              </Button>
            </div>
          </div>
          <CardDescription>Manage customer accounts and utang</CardDescription>
          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute left-3 top-1.5 text-muted-foreground" />
            <Input
              placeholder="Search customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
          <ScrollArea className="flex-1 h-full">
            <div className="p-4 pt-1 space-y-4">
              {paginatedCustomers.length === 0 ? (
                <div className="text-center text-muted-foreground p-4">No customers found</div>
              ) : (
                paginatedCustomers.map((customer) => {
                  const isSelected = selectedCustomer?.customer_id === customer.customer_id;
                  const isOverLimit = customer.current_balance > customer.credit_limit;
                  const isSelectedForRemoval = selectedForRemoval.has(customer.customer_id);

                  return (
                    <Card
                      key={customer.customer_id}
                      className={`cursor-pointer transition-colors ${isSelected ? 'border-primary' : 'hover:bg-muted/50'} ${removeMode && isSelectedForRemoval ? 'border-destructive bg-destructive/10' : ''}`}
                      onClick={removeMode ? () => toggleSelectForRemoval(customer.customer_id) : () => handleSelectCustomer(customer)}
                    >
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="font-medium">{customer.first_name} {customer.last_name}</span>
                          <span className="text-sm text-muted-foreground">{customer.phone_number || 'No phone'}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`font-semibold ${customer.current_balance > 0 ? 'text-destructive' : ''}`}>
                            ₱{customer.current_balance.toFixed(2)}
                          </span>
                          <Badge variant={isOverLimit ? "destructive" : "secondary"}>
                            Limit: ₱{customer.credit_limit}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
          
          {totalPages > 1 && !removeMode && (
            <div className="flex items-center justify-between p-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
        {removeMode && (
          <CardFooter className="bg-muted p-4 flex flex-col gap-2">
             <div className="flex justify-between w-full">
                <span className="text-sm font-medium">{selectedForRemoval.size} selected</span>
                <Button variant="link" size="sm" onClick={selectAllFiltered}>Select All</Button>
             </div>
             <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={exitRemoveMode}>Cancel</Button>
                <Button variant="destructive" className="flex-1" disabled={selectedForRemoval.size === 0} onClick={removeSelectedCustomers}>
                  Delete {selectedForRemoval.size > 0 ? `(${selectedForRemoval.size})` : ''}
                </Button>
             </div>
          </CardFooter>
        )}
      </Card>

      {/* 2. Desktop Customer Details Panel */}
      <Card className="hidden lg:flex flex-col h-[calc(100vh-3rem)]">
        {selectedCustomer ? (
          <>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{selectedCustomer.first_name} {selectedCustomer.last_name}</CardTitle>
                  <CardDescription>Phone: {selectedCustomer.phone_number || 'N/A'}</CardDescription>
                </div>
                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={selectedCustomer.current_balance <= 0}
                >
                  <DollarSign className="w-4 h-4 mr-2" /> Pay Utang
                </Button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription>Total Debt</CardDescription>
                    <CardTitle className="text-destructive">₱{selectedCustomer.current_balance.toFixed(2)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription>Credit Limit</CardDescription>
                    <CardTitle>₱{selectedCustomer.credit_limit.toFixed(2)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription>Available Credit</CardDescription>
                    <CardTitle className="text-primary">₱{Math.max(0, selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
              <Tabs defaultValue="unpaid" className="flex-1 flex flex-col">
                <div className="px-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="unpaid">Unpaid Utang</TabsTrigger>
                    <TabsTrigger value="paid">Paid & Payments</TabsTrigger>
                  </TabsList>
                </div>
                
                <ScrollArea className="flex-1 p-6">
                  <TabsContent value="unpaid" className="m-0">
                    {renderUnpaidTimeline()}
                  </TabsContent>
                  
                  <TabsContent value="paid" className="m-0">
                    {renderPaidTimeline()}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
            <User className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No Customer Selected</p>
            <p className="text-sm">Choose a customer from the directory to view details.</p>
          </div>
        )}
      </Card>

      {/* 3. Mobile Customer Details Modal */}
      <Dialog open={isMobileDetailsModalOpen} onOpenChange={setIsMobileDetailsModalOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col p-4 sm:max-w-md w-[95vw]">
          <DialogHeader className="px-2">
            <DialogTitle>
              {mobileViewTab === 'details' ? 'Customer Details' : 
               mobileViewTab === 'unpaid' ? 'Unpaid Utang' : 'Paid & Payments'}
            </DialogTitle>
          </DialogHeader>
          
          {mobileViewTab === 'details' && selectedCustomer && (
            <div className="space-y-6 pt-4">
              <div className="px-2">
                <h3 className="text-xl font-bold">{selectedCustomer.first_name} {selectedCustomer.last_name}</h3>
                <p className="text-sm text-muted-foreground">Phone: {selectedCustomer.phone_number || 'N/A'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 px-2">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Total Debt</p>
                  <p className="text-lg font-bold text-destructive">₱{selectedCustomer.current_balance.toFixed(2)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Available Credit</p>
                  <p className="text-lg font-bold text-primary">₱{Math.max(0, selectedCustomer.credit_limit - selectedCustomer.current_balance).toFixed(2)}</p>
                </Card>
              </div>
              <div className="px-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => { setIsMobileDetailsModalOpen(false); setIsPaymentModalOpen(true); }}
                  disabled={selectedCustomer.current_balance <= 0}
                >
                  <DollarSign className="w-5 h-5 mr-2" /> Pay Utang
                </Button>
              </div>
              <div className="flex gap-3 px-2 pt-2 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setMobileViewTab('unpaid')}>
                  View Unpaid
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setMobileViewTab('paid')}>
                  View Paid
                </Button>
              </div>
            </div>
          )}

          {mobileViewTab === 'unpaid' && (
             <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
               <div className="px-2 pb-4">
                 <Button variant="ghost" size="sm" onClick={() => setMobileViewTab('details')}>
                   &larr; Back to Details
                 </Button>
               </div>
               <ScrollArea className="flex-1 px-2 pb-2">
                 {renderUnpaidTimeline()}
               </ScrollArea>
             </div>
          )}

          {mobileViewTab === 'paid' && (
             <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
               <div className="px-2 pb-4">
                 <Button variant="ghost" size="sm" onClick={() => setMobileViewTab('details')}>
                   &larr; Back to Details
                 </Button>
               </div>
               <ScrollArea className="flex-1 px-2 pb-2">
                 {renderPaidTimeline()}
               </ScrollArea>
             </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Utang Payment</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-muted-foreground">Customer</span>
                   <span className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <span className="text-muted-foreground">Current Debt</span>
                   <span className="font-medium text-destructive">₱{selectedCustomer.current_balance.toFixed(2)}</span>
                </div>
                
                <div className="space-y-2">
                  <Label>Payment Amount (₱)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes / Reference (Optional)</Label>
                  <Input
                    placeholder="e.g. Partial cash payment"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                <Button type="submit">Submit Payment</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={isAddCustomerModalOpen} onOpenChange={setIsAddCustomerModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCustomer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  required
                  placeholder="Juan"
                  value={newCustomer.first_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  required
                  placeholder="Dela Cruz"
                  value={newCustomer.last_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="09..."
                value={newCustomer.phone_number}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Credit Limit (₱)</Label>
              <Input
                type="number"
                required
                min="0"
                step="50"
                value={newCustomer.credit_limit}
                onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddCustomerModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
'use client';

import React, { useEffect, useState } from 'react';
import type { Product, Customer, CartItem } from '@/types';
import {
  fetchProducts as fetchProductsService,
  addProduct as addProductService,
  addDigitalService,
  archiveProducts,
  updateStockQuantity,
} from '@/services/product.Service';
import {
  fetchCustomers as fetchCustomersService,
  addCustomer as addCustomerService,
  updateCustomerBalance,
} from '@/services/customer.Service';
import { createSale, insertSaleItems } from '@/services/sales.Service';
import { recordUtangTransaction } from '@/services/payment.Service';
import { useAlert } from '@/context/AlertContext';
import {
  ShoppingCart,
  User,
  Plus,
  Minus,
  PackagePlus,
  UserPlus,
  Smartphone,
  Trash2,
  X,
  Check
} from 'lucide-react';

// --- shadcn/ui components ---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ModalType = 'none' | 'digital';

export default function POS(): React.JSX.Element {
  // Empty initial states
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isUtangMode, setIsUtangMode] = useState<boolean>(false);

  const { showAlert } = useAlert();

  // Checkout Form State
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Utang' | 'Digital'>('Cash');
  const [amountTendered, setAmountTendered] = useState<string>('');

  // Active Modal Control
  const [activeModal, setActiveModal] = useState<ModalType>('none');





  // Digital Service Form
  const [serviceType, setServiceType] = useState<string>('GCash Cash-In');
  const [serviceAccount, setServiceAccount] = useState<string>('');
  const [serviceAmount, setServiceAmount] = useState<string>('');
  const [convenienceFee, setConvenienceFee] = useState<string>('10');
  const [refNumber, setRefNumber] = useState<string>('');


  // Customer Search Popover
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');



  // ------- Data Fetching --------
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    // Fetch Products (via service)
    const { data: productData, error: prodErr } = await fetchProductsService();
    if (prodErr) console.error('Error loading products:', prodErr);
    else setProducts(productData || []);

    // Fetch Customers (via service)
    const { data: customerData, error: custErr } = await fetchCustomersService();
    if (custErr) console.error('Error loading customers:', custErr);
    else setCustomers(customerData || []);
  };

  // --- Derived Calculations ---
  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const changeGiven = amountTendered ? Math.max(0, parseFloat(amountTendered) - totalAmount) : 0;
  const realProducts = products.filter((product) => !product.product_name.startsWith('[Digital]'));
  const filteredProducts = products.filter(
    (product) =>
      !product.product_name.startsWith('[Digital]') &&
      product.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Handlers ---




  const handleAddDigitalService = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!serviceAmount) return showAlert('Transaction amount required.');

    const txAmount = parseFloat(serviceAmount) || 0;
    const fee = parseFloat(convenienceFee) || 0;
    const totalServiceCost = txAmount + fee;

    const { data, error } = await addDigitalService({
      product_name: `[Digital] ${serviceType} - ${serviceAccount || 'No Ref'}`,
      cost_price: txAmount,
      selling_price: totalServiceCost,
      stock_quantity: 999,
    });

    if (error) {
      showAlert('Failed to add digital service: ' + error.message);
      return;
    }

    addToCart(data);
    setServiceAccount(''); setServiceAmount(''); setRefNumber('');
    setActiveModal('none')

  };



  const addToCart = (product: Product): void => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product_id === product.product_id);
      if (existing) {
        return prevCart.map((item) =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.selling_price }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1, subtotal: product.selling_price }];
    });
  };

  const updateQuantity = (productId: number, delta: number): void => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {

          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? { ...item, quantity: newQty, subtotal: newQty * item.selling_price }
              : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return showAlert('Cart is empty!');
    if (paymentType === 'Utang' && !selectedCustomer) {
      return showAlert('Please select a customer for Utang transactions!');
    }

    try {
      // 1. Insert into SALES table (via service)
      const { data: sale, error: saleErr } = await createSale({
        customer_id: selectedCustomer ? parseInt(selectedCustomer, 10) : null,
        total_amount: totalAmount,
        payment_type: paymentType,
        amount_tendered: paymentType === 'Cash' ? parseFloat(amountTendered) || totalAmount : totalAmount,
        change_given: paymentType === 'Cash' ? changeGiven : 0,
      });

      if (saleErr) throw saleErr;

      // 2. Prepare & Insert SALE_ITEMS (via service)
      const saleItems = cart.map((item) => ({
        sale_id: sale.sale_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.selling_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsErr } = await insertSaleItems(saleItems);
      if (itemsErr) throw itemsErr;

      // 3. Deduct Stock Quantity for Each Product (via service)
      for (const item of cart) {
        await updateStockQuantity(item.product_id, item.stock_quantity - item.quantity);
      }

      // 4. Handle Utang Recording if payment is Utang (via service)
      if (paymentType === 'Utang' && selectedCustomer) {
        const customerIdInt = parseInt(selectedCustomer, 10);

        // Add Utang record
        await recordUtangTransaction({
          customer_id: customerIdInt,
          sale_id: sale.sale_id,
          amount: totalAmount,
          status: 'Unpaid',
        });

        // Get current customer balance & update
        const currentCust = customers.find((customer) => customer.customer_id === customerIdInt);
        if (currentCust) {
          await updateCustomerBalance(customerIdInt, (currentCust.current_balance || 0) + totalAmount);
        }
      }

      showAlert('Transaction completed.');

      // Clear cart and refresh products list to reflect new stock
      setCart([]);
      setAmountTendered('');
      setSelectedCustomer('');
      fetchInitialData();
    } catch (err: any) {
      console.error('Checkout failed:', err);
      showAlert('Error saving transaction: ' + err.message);
    }
  };

  //Filter Customer
  const filteredCustomers = customers.filter((customer) => {
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    return fullName.includes(customerSearch.toLowerCase());
  });

  return (
    <div className="flex flex-col lg:flex-row lg:h-full gap-6 p-4 lg:p-6 bg-muted/30 lg:overflow-hidden">
      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Header / Search / Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background p-4 rounded-2xl shadow-sm border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Point of Sale</h2>
              <p className="text-sm text-muted-foreground">Select products or services</p>
            </div>
          </div>

          <div className="flex flex-1 w-full sm:max-w-md items-center gap-3">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl bg-muted/50 border-none focus-visible:ring-primary/30 h-11"
              />
              <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <Button
              variant="default"
              className="rounded-xl h-11 px-4 gap-2 bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20 border border-cyan-500/20 shadow-sm cursor-pointer"
              onClick={() => setActiveModal('digital')}
            >
              <Smartphone className="w-4 h-4" />
              <span>Digital</span>
            </Button>
          </div>
        </div>

        {/* Product Grid */}
        <ScrollArea className="flex-1 rounded-2xl border border-border/50 bg-background shadow-sm">
          <div className="p-4">
            {realProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
                <PackagePlus className="w-16 h-16 mb-4 text-muted-foreground/30" />
                <p className="text-lg font-semibold text-foreground">No products available</p>
                <p className="text-sm mt-1">Add products in the inventory to start selling.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
                <ShoppingCart className="w-16 h-16 mb-4 text-muted-foreground/30" />
                <p className="text-lg font-semibold text-foreground">No matching products</p>
                <p className="text-sm mt-1">Try adjusting your search term.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {filteredProducts.map((product) => {
                  const outOfStock = product.stock_quantity <= 0;
                  return (
                    <Card
                      key={product.product_id}
                      onClick={() => !outOfStock && addToCart(product)}
                      className={`group overflow-hidden flex flex-col justify-between border-border/40 transition-all duration-300 ease-in-out cursor-pointer h-full ${outOfStock
                        ? 'opacity-50 grayscale bg-muted/30 cursor-not-allowed'
                        : 'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:bg-muted/20 bg-background'
                        }`}
                    >
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${outOfStock ? 'bg-muted' : 'bg-primary/10 text-primary'}`}>
                            <PackagePlus className="w-5 h-5" />
                          </div>
                          <Badge
                            variant={outOfStock ? "outline" : "secondary"}
                            className={outOfStock ? "text-[10px]" : "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20 text-[10px]"}
                          >
                            {outOfStock ? 'Out of Stock' : `${product.stock_quantity} left`}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm leading-tight mb-1 group-hover:text-primary transition-colors">{product.product_name}</h4>
                        </div>
                        <div className="mt-4 flex items-end justify-between">
                          <div className="text-lg font-bold tracking-tight">
                            ₱{product.selling_price.toFixed(2)}
                          </div>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${outOfStock ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground md:opacity-0 md:group-hover:opacity-100'}`}>
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT: Cart / Checkout Panel */}
      <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col shrink-0 gap-4">
        <Card className="flex-1 flex flex-col border-border/50 shadow-md bg-background overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-border/50 pb-4 bg-muted/10">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-bold">Current Order</CardTitle>
              <Badge variant="secondary" className="px-2.5 py-1 rounded-full font-bold">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
              </Badge>
            </div>
          </CardHeader>

          {/* Cart Items */}
          <ScrollArea className="flex-1 p-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 opacity-60">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Your cart is empty</p>
                <p className="text-xs mt-1">Scan or add items to begin</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex gap-3 group">
                    <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      {item.product_name.startsWith('[Digital]') ? <Smartphone className="w-6 h-6 text-cyan-600" /> : <PackagePlus className="w-6 h-6 text-primary" />}
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <p className="font-semibold text-sm truncate text-foreground">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">₱{item.selling_price.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <p className="font-bold text-sm">₱{item.subtotal.toFixed(2)}</p>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-md p-0.5 border border-border/50 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => updateQuantity(item.product_id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-background rounded shadow-sm text-foreground cursor-pointer">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-4 text-center text-xs font-bold">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.product_id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-background rounded shadow-sm text-foreground cursor-pointer">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Payment Section */}
          <div className="bg-muted/10 p-5 border-t border-border/50">
            {/* Customer Select / Mode Toggle */}
            <div className="mb-4 space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                  {isUtangMode ? 'Select Customer' : 'Customer'}
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    const newMode = !isUtangMode;
                    setIsUtangMode(newMode);
                    if (!newMode) {
                      setSelectedCustomer('walk-in');
                      if (paymentType === 'Utang') setPaymentType('Cash');
                    } else {
                      setSelectedCustomer('');
                      setPaymentType('Utang'); // Default to Utang when switched
                    }
                  }}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer uppercase tracking-wider"
                >
                  {isUtangMode ? 'Switch to Walk-in' : 'Switch to Utang'}
                </button>
              </div>

              {!isUtangMode ? (
                <div className="w-full flex items-center gap-2 px-3 py-2.5 border border-input rounded-xl bg-muted/30 text-sm font-medium text-foreground opacity-70">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>Walk-in Customer</span>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCustomerOpen(!customerOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 border border-input rounded-xl bg-background text-sm font-medium hover:bg-accent/50 focus:ring-2 focus:ring-primary/40 transition-all shadow-sm cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {selectedCustomer && selectedCustomer !== 'walk-in'
                          ? (() => {
                            const customer = customers.find(c => c.customer_id.toString() === selectedCustomer);
                            return customer ? `${customer.first_name} ${customer.last_name}` : 'Select Customer...';
                          })()
                          : 'Select Customer...'}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">▼</span>
                  </button>

                  {customerOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-border bg-muted/30">
                        <Input
                          type="text"
                          placeholder="Search customer..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="h-9 bg-background border-input rounded-lg"
                          autoFocus
                        />
                      </div>
                      <ScrollArea className="h-48">
                        <div className="p-1">
                          {filteredCustomers.length > 0 ? (
                            filteredCustomers.map((customer) => (
                              <div
                                key={customer.customer_id}
                                onClick={() => {
                                  setSelectedCustomer(customer.customer_id.toString());
                                  setCustomerOpen(false);
                                  setCustomerSearch('');
                                }}
                                className={`px-3 py-2 text-sm cursor-pointer rounded-md hover:bg-accent flex items-center justify-between transition-colors mt-1 ${selectedCustomer === customer.customer_id.toString() ? 'font-bold bg-primary/10 text-primary' : ''}`}
                              >
                                <span>{customer.first_name} {customer.last_name}</span>
                                <Badge variant="outline" className="text-[10px] font-normal">₱{customer.current_balance}</Badge>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                              No customer found
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Tabs */}
            <div className="mb-5 space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Payment Method</Label>
              <Tabs value={paymentType} onValueChange={(v) => setPaymentType(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-11 p-1 bg-background border border-border/50 rounded-xl">
                  <TabsTrigger value="Cash" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all cursor-pointer">Cash</TabsTrigger>
                  <TabsTrigger
                    value="Utang"
                    disabled={!isUtangMode || !selectedCustomer || selectedCustomer === 'walk-in'}
                    className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all disabled:opacity-30 cursor-pointer"
                  >
                    Utang
                  </TabsTrigger>
                  <TabsTrigger value="Digital" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all cursor-pointer">Digital</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Amount Tendered (Cash only) */}
            {paymentType === 'Cash' && (
              <div className="mb-5 space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Amount Tendered</Label>
                  {changeGiven > 0 && <span className="text-xs font-bold text-green-600 dark:text-green-400">Change: ₱{changeGiven.toFixed(2)}</span>}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">₱</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    className="pl-8 text-lg font-semibold h-12 bg-background rounded-xl border-input shadow-sm focus-visible:ring-primary/40"
                  />
                </div>
              </div>
            )}

            <Separator className="mb-4 bg-border/60" />

            {/* Totals */}
            <div className="flex justify-between items-end mb-5">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Amount</span>
              <span className="text-3xl font-black text-primary tracking-tight">₱{totalAmount.toFixed(2)}</span>
            </div>

            <Button
              className="w-full h-14 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 flex items-center gap-2 cursor-pointer"
              onClick={handleCheckout}
              disabled={cart.length === 0}
            >
              <Check className="w-5 h-5" />
              Complete Payment
            </Button>
          </div>
        </Card>
      </div>

      {/* Digital Service Modal */}
      <Dialog open={activeModal === 'digital'} onOpenChange={(open) => !open && setActiveModal('none')}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl p-0 overflow-hidden border-border bg-card">
          <div className="bg-cyan-500/10 p-6 border-b border-cyan-500/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-cyan-600">
                <Smartphone className="w-6 h-6" />
                Digital Transaction
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleAddDigitalService} className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Service Type</Label>
              <Select value={serviceType} onValueChange={(val) => setServiceType(val ?? '')}>
                <SelectTrigger className="h-11 rounded-xl bg-background cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GCash Cash-In" className="cursor-pointer">GCash Cash-In</SelectItem>
                  <SelectItem value="GCash Cash-Out" className="cursor-pointer">GCash Cash-Out</SelectItem>
                  <SelectItem value="E-Load" className="cursor-pointer">E-Load (Smart/Globe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Account / Mobile Number</Label>
              <Input placeholder="09170000000" value={serviceAccount} onChange={(e) => setServiceAccount(e.target.value)} className="h-11 rounded-xl bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Amount (₱)</Label>
                <Input type="number" required placeholder="0.00" value={serviceAmount} onChange={(e) => setServiceAmount(e.target.value)} className="h-11 rounded-xl bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Fee (₱)</Label>
                <Input type="number" value={convenienceFee} onChange={(e) => setConvenienceFee(e.target.value)} className="h-11 rounded-xl bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Reference No.</Label>
              <Input placeholder="Optional" value={refNumber} onChange={(e) => setRefNumber(e.target.value)} className="h-11 rounded-xl bg-background" />
            </div>
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setActiveModal('none')} className="rounded-xl cursor-pointer">Cancel</Button>
              <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl px-6 shadow-md shadow-cyan-600/20 cursor-pointer">Add to Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
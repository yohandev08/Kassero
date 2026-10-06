'use client';

import React, { useEffect, useState } from 'react';
import type { Product, Customer, CartItem } from '@/types';
import {
  fetchProducts as fetchProductsService,
  addProduct as addProductService,
  addDigitalService,
  archiveProducts,
  updateStockQuantity,
} from '@/services/productService';
import {
  fetchCustomers as fetchCustomersService,
  addCustomer as addCustomerService,
  updateCustomerBalance,
} from '@/services/customerService';
import { createSale, insertSaleItems } from '@/services/salesService';
import { recordUtangTransaction } from '@/services/paymentService';
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

type ModalType = 'none' | 'digital';

export default function POS(): React.JSX.Element {
  // Empty initial states
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
    if (!serviceAmount) return alert('Transaction amount required.');

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
      alert('Failed to add digital service: ' + error.message);
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
    if (cart.length === 0) return alert('Cart is empty!');
    if (paymentType === 'Utang' && !selectedCustomer) {
      return alert('Please select a customer for Utang transactions!');
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

      alert('Transaction completed.');

      // Clear cart and refresh products list to reflect new stock
      setCart([]);
      setAmountTendered('');
      setSelectedCustomer('');
      fetchInitialData();
    } catch (err: any) {
      console.error('Checkout failed:', err);
      alert('Error saving transaction: ' + err.message);
    }
  };

  //Filter Customer
  const filteredCustomers = customers.filter((customer) => {
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    return fullName.includes(customerSearch.toLowerCase());
  });

  return (
    <div className="flex flex-col lg:flex-row lg:h-full p-0.5 bg-background gap-4 lg:overflow-hidden">
      {/* LEFT: Product Catalog & Header */}
      <Card className="w-full lg:w-2/3 flex flex-col justify-between bg-card text-card-foreground border-border shadow-md rounded-xl overflow-hidden shrink-0 lg:shrink h-auto min-h-fit lg:h-auto">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary dark:text-primary">
                <ShoppingCart className="w-5 h-5" />
              </div>
              Products Catalog
            </CardTitle>

            <div className="relative w-full sm:w-60">
              <input
                type="text"
                placeholder="Search Products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[16px] md:text-xs bg-background border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">

              <Button size="sm" variant="outline" className="text-xs font-semibold text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-400/30 cursor-pointer" onClick={() => setActiveModal('digital')}>
                <Smartphone className="w-3.5 h-3.5 mr-1" /> GCash / E-Load
              </Button>


            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4">
          {realProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 border-2 border-dashed border-border/60 rounded-xl bg-muted/10">
              <ShoppingCart className="w-12 h-12 mb-2 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No products available</p>
              <p className="text-xs text-muted-foreground mt-1">Click the buttons above to populate your inventory or process digital transactions.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 border-2 border-dashed border-border/60 rounded-xl bg-muted/10">
              <ShoppingCart className="w-12 h-12 mb-2 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No matching products found</p>
              <p className="text-xs text-muted-foreground mt-1">Try searching with a different keyword.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                return (
                  <Card
                    key={product.product_id}
                    className={`transition duration-200 shadow-sm flex flex-col justify-between bg-card text-card-foreground border-border/80 rounded-xl relative ${
                      product.stock_quantity > 0
                        ? 'hover:border-primary hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5'
                        : 'opacity-60 cursor-not-allowed bg-muted/20'
                    }`}
                  >
                    <CardContent className="flex flex-col justify-between h-full p-3.5">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm line-clamp-1">{product.product_name}</h4>
                        <Badge
                          variant={product.stock_quantity > 0 ? "secondary" : "destructive"}
                          className={`mt-1.5 text-[10px] font-medium px-2 py-0.5 ${product.stock_quantity > 0
                            ? 'bg-primary/10 text-primary dark:text-primary border border-primary/30'
                            : ''
                            }`}
                        >
                          Stock: {product.stock_quantity}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="text-primary font-bold text-base">
                          ₱{product.selling_price.toFixed(2)}
                        </div>

                          <button
                            type="button"
                            disabled={product.stock_quantity <= 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}
                            className="bg-primary hover:bg-primary active:bg-primary text-white font-medium 
                            text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all disabled:opacity-50 
                            disabled:cursor-not-allowed shadow-sm hover:shadow-primary/20 cursor-pointer">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                            </svg>
                            Add
                          </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}


        </CardContent>
      </Card>

      {/* RIGHT: Cart & Payment Details */}
      <Card className="w-full lg:w-1/3 flex flex-col justify-between bg-card text-card-foreground border-border shadow-md rounded-xl overflow-hidden shrink-0 h-auto min-h-fit lg:h-auto">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            Current Order
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between p-4">
          {/* Cart List */}
          <div className="flex-1 flex flex-col overflow-y-auto border-b border-border/60 pb-2 space-y-1">
            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-10">
                <ShoppingCart className="w-9 h-9 mb-2 opacity-50 text-primary" />
                <p className="text-sm font-semibold text-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add products to get started</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product_id} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/40 transition-colors text-xs">
                  <div className="flex-1 pr-2">
                    <p className="font-semibold text-foreground line-clamp-1">{item.product_name}</p>
                    <p className="text-muted-foreground">₱{item.selling_price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/50">
                    <Button size="icon" variant="ghost" className="h-5 w-5 rounded cursor-pointer hover:bg-background" onClick={() => updateQuantity(item.product_id, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-5 text-center font-bold text-foreground">{item.quantity}</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5 rounded cursor-pointer hover:bg-background" onClick={() => updateQuantity(item.product_id, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="w-16 text-right font-bold text-primary">₱{item.subtotal.toFixed(2)}</div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 pt-3">
            {/* Searchable Customer Dropdown */}
            <div className="relative">
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs font-semibold flex items-center gap-1 text-foreground">
                  <User className="w-3.5 h-3.5 text-primary" /> Customer
                </Label>

              </div>

              {/* Main Trigger Button */}
              <button
                type="button"
                onClick={() => setCustomerOpen(!customerOpen)}
                className="w-full flex items-center justify-between text-[16px] md:text-xs px-3 py-2 border border-input rounded-lg bg-background text-foreground text-left hover:bg-accent/50 focus:ring-2 focus:ring-primary/40 cursor-pointer transition-all min-h-[44px] md:min-h-0"
              >
                <span className="truncate font-medium">
                  {selectedCustomer && selectedCustomer !== 'walk-in'
                    ? (() => {
                      const customer = customers.find(
                        (cust) => cust.customer_id.toString() === selectedCustomer
                      );
                      return customer ? `${customer.first_name} ${customer.last_name}` : 'Walk-in Customer';
                    })()
                    : 'Walk-in Customer'}
                </span>
                <span className="text-muted-foreground text-[10px]">▼</span>
              </button>

              {/* Dropdown Menu Overlay */}
              {customerOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden">
                  {/* Search Input Box */}
                  <div className="p-2 border-b border-border bg-muted/30">
                    <Input
                      type="text"
                      placeholder="Search customer..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="text-[16px] md:text-xs h-9 md:h-8 bg-background border-input"
                      autoFocus
                    />
                  </div>

                  {/* Customer List */}
                  <div className="max-h-48 overflow-y-auto py-1">
                    {/* Walk-in Customer Option */}
                    <div
                      onClick={() => {
                        setSelectedCustomer('walk-in');
                        setCustomerOpen(false);
                        setCustomerSearch('');
                      }}
                      className={`px-3 py-2 text-xs cursor-pointer hover:bg-accent flex items-center justify-between transition-colors ${selectedCustomer === 'walk-in' || !selectedCustomer ? 'font-bold text-primary bg-primary/5' : ''
                        }`}
                    >
                      Walk-in Customer
                    </div>

                    {/* Filtered Customer List */}
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((customer) => (
                        <div
                          key={customer.customer_id}
                          onClick={() => {
                            setSelectedCustomer(customer.customer_id.toString());
                            setCustomerOpen(false);
                            setCustomerSearch('');
                          }}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-accent flex items-center justify-between transition-colors ${selectedCustomer === customer.customer_id.toString() ? 'font-bold text-primary bg-primary/5' : ''
                            }`}
                        >
                          <span>{customer.first_name} {customer.last_name}</span>
                          <span className="text-muted-foreground text-[11px]">(Bal: ₱{customer.current_balance})</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                        No customer found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-3 gap-2">
              {(['Cash', 'Utang', 'Digital'] as const).map((type) => {
                const isUtangDisabled = type === 'Utang' && (!selectedCustomer || selectedCustomer === 'walk-in');
                const isSelected = paymentType === type;
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    className={`text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-all min-h-[44px] md:min-h-0 ${isSelected
                      ? 'bg-primary hover:bg-primary text-white shadow-sm shadow-primary/20'
                      : 'border-input hover:bg-accent text-foreground'
                      }`}
                    disabled={isUtangDisabled}
                    onClick={() => setPaymentType(type)}
                  >
                    {type}
                  </Button>
                );
              })}
            </div>

            {/* Cash Tendered */}
            {paymentType === 'Cash' && (
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Amount Tendered</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  className="text-[16px] md:text-sm bg-background border-input min-h-[44px] md:min-h-0"
                />
              </div>
            )}
          </div>

          {/* Totals & Submit */}
          <div className="border-t border-border/60 pt-3.5 mt-3 space-y-3">
            <div className="flex justify-between items-center text-foreground">
              <span className="font-semibold text-sm">Total</span>
              <span className="font-bold text-2xl text-primary dark:text-primary">₱{totalAmount.toFixed(2)}</span>
            </div>
            {paymentType === 'Cash' && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Change</span>
                <span className="font-semibold text-foreground">₱{changeGiven.toFixed(2)}</span>
              </div>
            )}

            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg cursor-pointer rounded-xl py-5" size="lg" onClick={handleCheckout}>
              Complete Transaction
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ================= SHADCN DIALOG MODALS ================= */}





      {/* 3. Digital Service Dialog */}
      <Dialog open={activeModal === 'digital'} onOpenChange={(open) => !open && setActiveModal('none')}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">GCash / E-Load Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddDigitalService} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Service Type</Label>
              <Select value={serviceType} onValueChange={(val) => setServiceType(val ?? '')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className={'cursor-pointer'} value="GCash Cash-In">GCash Cash-In</SelectItem>
                  <SelectItem className={'cursor-pointer'} value="GCash Cash-Out">GCash Cash-Out</SelectItem>
                  <SelectItem className={'cursor-pointer'} value="E-Load">E-Load (Smart/Globe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Account / Phone Number</Label>
              <Input placeholder="09170000000" value={serviceAccount} onChange={(e) => setServiceAccount(e.target.value)} className="text-[16px] md:text-sm bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Amount (₱)</Label>
                <Input type="number" required placeholder="500.00" value={serviceAmount} onChange={(e) => setServiceAmount(e.target.value)} className="text-[16px] md:text-sm bg-background" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Convenience Fee (₱)</Label>
                <Input type="number" value={convenienceFee} onChange={(e) => setConvenienceFee(e.target.value)} className="text-[16px] md:text-sm bg-background" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Reference Number (Optional)</Label>
              <Input placeholder="Ref # 1002391" value={refNumber} onChange={(e) => setRefNumber(e.target.value)} className="text-[16px] md:text-sm bg-background" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold cursor-pointer">Add Service to Cart</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
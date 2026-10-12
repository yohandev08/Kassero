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
import { cn } from '@/lib/utils';
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
  const [globalLowStockThreshold, setGlobalLowStockThreshold] = useState<number>(5);

  useEffect(() => {
    const loadThreshold = () => {
      const saved = localStorage.getItem('globalLowStockThreshold');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0) setGlobalLowStockThreshold(parsed);
      }
    };
    loadThreshold();
    window.addEventListener('storage', loadThreshold);
    return () => window.removeEventListener('storage', loadThreshold);
  }, []);

  const [isUtangMode, setIsUtangMode] = useState<boolean>(false);

  const { showAlert } = useAlert();

  // Checkout Form State
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Utang' | 'Digital'>('Cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  // Active Modal Control
  const [activeModal, setActiveModal] = useState<ModalType>('none');





  // Digital Service Form
  const [serviceType, setServiceType] = useState<string>('GCash Cash-In');
  const [serviceAccount, setServiceAccount] = useState<string>('');
  const [serviceAmount, setServiceAmount] = useState<string>('');
  const [convenienceFee, setConvenienceFee] = useState<string>('10');
  const [referenceNumber, setReferenceNumber] = useState<string>('');


  // Customer Search Popover
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');



  // ------- Data Fetching --------
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    // Fetch Products (via service)
    const { data: productData, error: productError } = await fetchProductsService();
    if (productError) console.error('Error loading products:', productError);
    else setProducts(productData || []);

    // Fetch Customers (via service)
    const { data: customerData, error: customerError } = await fetchCustomersService();
    if (customerError) console.error('Error loading customers:', customerError);
    else setCustomers(customerData || []);
  };

  // --- Derived Calculations ---
  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const tenderedNumber = parseFloat(amountTendered);
  const isTenderedValid = !isNaN(tenderedNumber) && tenderedNumber >= totalAmount;
  const changeGiven =
    paymentType === 'Cash' && amountTendered && isTenderedValid
      ? Math.max(0, tenderedNumber - totalAmount)
      : 0;

  const isCashInvalid =
    paymentType === 'Cash' &&
    (!amountTendered.trim() || isNaN(tenderedNumber) || tenderedNumber < totalAmount);
  const isUtangInvalid =
    paymentType === 'Utang' && (!selectedCustomer || selectedCustomer === 'walk-in');
  const isCheckoutDisabled = cart.length === 0 || isCashInvalid || isUtangInvalid || isCheckingOut;

  const realProducts = products.filter((product) => !product.product_name.startsWith('[Digital]'));
  const filteredProducts = products.filter(
    (product) =>
      !product.product_name.startsWith('[Digital]') &&
      product.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Handlers ---




  const handleAddDigitalService = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!serviceAmount) return showAlert('Transaction amount required.');

    const transactionAmount = parseFloat(serviceAmount) || 0;
    const fee = parseFloat(convenienceFee) || 0;
    const totalServiceCost = transactionAmount + fee;

    const { data, error } = await addDigitalService({
      product_name: `[Digital] ${serviceType} - ${serviceAccount || 'No Ref'}`,
      cost_price: transactionAmount,
      selling_price: totalServiceCost,
      stock_quantity: 999,
    });

    if (error) {
      showAlert('Failed to add digital service: ' + error.message);
      return;
    }

    addToCart(data);
    setServiceAccount(''); setServiceAmount(''); setReferenceNumber('');
    setActiveModal('none');
  };



  const addToCart = (product: Product): void => {
    const currentStock = products.find((p) => p.product_id === product.product_id)?.stock_quantity ?? product.stock_quantity;

    if (currentStock <= 0) {
      showAlert(`${product.product_name} is out of stock!`);
      return;
    }

    const existingInCart = cart.find((item) => item.product_id === product.product_id);
    if (existingInCart && existingInCart.quantity >= currentStock) {
      showAlert(`Cannot add more. Only ${currentStock} in stock for "${product.product_name}".`);
      return;
    }

    setCart((previousCart) => {
      const existing = previousCart.find((item) => item.product_id === product.product_id);
      if (existing) {
        if (existing.quantity >= currentStock) {
          return previousCart;
        }
        return previousCart.map((item) =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.selling_price }
            : item
        );
      }
      return [...previousCart, { ...product, stock_quantity: currentStock, quantity: 1, subtotal: product.selling_price }];
    });
  };

  const updateQuantity = (productId: number, delta: number): void => {
    const targetItem = cart.find((item) => item.product_id === productId);
    if (!targetItem) return;

    const currentStock = products.find((p) => p.product_id === productId)?.stock_quantity ?? targetItem.stock_quantity;

    if (delta > 0 && targetItem.quantity >= currentStock) {
      showAlert(`Cannot add more. Only ${currentStock} in stock for "${targetItem.product_name}".`);
      return;
    }

    setCart((previousCart) =>
      previousCart
        .map((item) => {
          if (item.product_id === productId) {
            let newQuantity = item.quantity + delta;
            if (delta > 0 && newQuantity > currentStock) {
              newQuantity = currentStock;
            }
            return newQuantity > 0
              ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.selling_price }
              : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (productId: number): void => {
    setCart((previousCart) => previousCart.filter((item) => item.product_id !== productId));
  };

  const handleSetQuantity = (productId: number, targetQty: number): void => {
    const targetItem = cart.find((item) => item.product_id === productId);
    if (!targetItem) return;

    const currentStock =
      products.find((p) => p.product_id === productId)?.stock_quantity ?? targetItem.stock_quantity;

    let finalQty = targetQty;
    if (finalQty > currentStock) {
      finalQty = currentStock;
    }

    setCart((previousCart) =>
      previousCart.map((item) => {
        if (item.product_id === productId) {
          const qty = Math.max(0, finalQty);
          return {
            ...item,
            quantity: qty,
            subtotal: qty * item.selling_price,
          };
        }
        return item;
      })
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return showAlert('Cart is empty!');

    // Validate that cart items do not exceed available stock
    for (const item of cart) {
      if (item.quantity <= 0) {
        return showAlert(`Please enter a valid quantity for "${item.product_name}".`);
      }
      const currentStock = products.find((p) => p.product_id === item.product_id)?.stock_quantity ?? item.stock_quantity;
      if (item.quantity > currentStock) {
        return showAlert(`Cannot checkout: "${item.product_name}" quantity (${item.quantity}) exceeds available stock (${currentStock}).`);
      }
    }

    if (paymentType === 'Cash') {
      if (!amountTendered.trim()) {
        return showAlert('Please enter the amount tendered.');
      }
      const tendered = parseFloat(amountTendered);
      if (isNaN(tendered) || tendered <= 0) {
        return showAlert('Please enter a valid amount tendered.');
      }
      if (tendered < totalAmount) {
        return showAlert(`Amount tendered (₱${tendered.toFixed(2)}) is less than total amount (₱${totalAmount.toFixed(2)}).`);
      }
    }

    if (paymentType === 'Utang' && (!selectedCustomer || selectedCustomer === 'walk-in')) {
      return showAlert('Please select a customer for Utang transactions!');
    }

    setIsCheckingOut(true);
    try {
      const finalTendered = paymentType === 'Cash' ? parseFloat(amountTendered) : totalAmount;
      const finalChange = paymentType === 'Cash' ? Math.max(0, finalTendered - totalAmount) : 0;

      // 1. Insert into SALES table (via service)
      const { data: sale, error: saleError } = await createSale({
        customer_id: selectedCustomer && selectedCustomer !== 'walk-in' ? parseInt(selectedCustomer, 10) : null,
        total_amount: totalAmount,
        payment_type: paymentType,
        amount_tendered: finalTendered,
        change_given: finalChange,
      });

      if (saleError) throw saleError;

      // 2. Prepare & Insert SALE_ITEMS (via service)
      const saleItems = cart.map((item) => ({
        sale_id: sale.sale_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.selling_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await insertSaleItems(saleItems);
      if (itemsError) throw itemsError;

      // 3. Deduct Stock Quantity for Each Product (via service)
      for (const item of cart) {
        const prod = products.find((p) => p.product_id === item.product_id);
        const currentStock = prod ? prod.stock_quantity : item.stock_quantity;
        await updateStockQuantity(item.product_id, Math.max(0, currentStock - item.quantity));
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
        const currentCustomer = customers.find((customer) => customer.customer_id === customerIdInt);
        if (currentCustomer) {
          await updateCustomerBalance(customerIdInt, (currentCustomer.current_balance || 0) + totalAmount);
        }
      }

      showAlert('Transaction completed.');

      // Clear cart and refresh products list to reflect new stock
      setCart([]);
      setAmountTendered('');
      setSelectedCustomer('');
      fetchInitialData();
    } catch (error: any) {
      console.error('Checkout failed:', error);
      showAlert('Error saving transaction: ' + error.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  //Filter Customer
  const filteredCustomers = customers.filter((customer) => {
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    return fullName.includes(customerSearch.toLowerCase());
  });

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row lg:h-[calc(100dvh-5.5rem)] gap-4 lg:gap-6 lg:overflow-hidden p-1">
      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden pb-1">
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
                onChange={(event) => setSearchQuery(event.target.value)}
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
                  const itemInCart = cart.find((item) => item.product_id === product.product_id);
                  const isMaxInCart = itemInCart ? itemInCart.quantity >= product.stock_quantity : false;
                  const isLowStock = (product.stock_quantity <= (product.reorder_level ?? globalLowStockThreshold)) && !outOfStock;
                  return (
                    <Card
                      key={product.product_id}
                      onClick={() => !outOfStock && !isMaxInCart && addToCart(product)}
                      className={`group overflow-hidden flex flex-col justify-between border-border/40 transition-all duration-300 ease-in-out cursor-pointer h-full ${outOfStock || isMaxInCart
                        ? 'opacity-50 grayscale bg-muted/30 cursor-not-allowed'
                        : 'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:bg-muted/20 bg-background'
                        }`}
                    >
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${outOfStock || isMaxInCart ? 'bg-muted' : 'bg-primary/10 text-primary'}`}>
                            <PackagePlus className="w-5 h-5" />
                          </div>
                          <Badge
                            variant={outOfStock ? "outline" : isMaxInCart ? "outline" : isLowStock ? "outline" : "secondary"}
                            className={outOfStock 
                                ? "text-[10px]" 
                                : isMaxInCart
                                  ? "bg-muted text-muted-foreground border-border text-[10px]"
                                  : isLowStock 
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] uppercase tracking-wider font-bold"
                                    : "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20 text-[10px]"}
                          >
                            {outOfStock ? 'Out of Stock' : isMaxInCart ? 'Max in Cart' : isLowStock ? `Low Stock (${product.stock_quantity})` : `${product.stock_quantity} left`}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm leading-tight mb-1 transition-colors">{product.product_name}</h4>
                        </div>
                        <div className="mt-4 flex items-end justify-between">
                          <div className="text-lg font-bold tracking-tight">
                            ₱{product.selling_price.toFixed(2)}
                          </div>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${outOfStock || isMaxInCart ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground md:opacity-0 md:group-hover:opacity-100'}`}>
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
      <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col shrink-0 gap-4 pt-1 pb-1">
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
                {cart.map((item) => {
                  const currentStock = products.find((p) => p.product_id === item.product_id)?.stock_quantity ?? item.stock_quantity;
                  const isMaxStock = item.quantity >= currentStock;

                  return (
                    <div key={item.product_id} className="flex items-center gap-3 group">
                    <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        {item.product_name.startsWith('[Digital]') ? <Smartphone className="w-6 h-6 text-cyan-600" /> : <PackagePlus className="w-6 h-6 text-primary" />}
                      </div>
                      <div className="flex-1 flex flex-col justify-center min-w-0">
                        <p className="font-semibold text-sm truncate text-foreground">{item.product_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">₱{item.selling_price.toFixed(2)}</p>
                          {isMaxStock && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              (Max stock: {currentStock})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between gap-1 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm">₱{item.subtotal.toFixed(2)}</p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product_id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Remove from cart"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1 border border-border/50">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, -1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-background active:bg-background rounded-md shadow-xs text-foreground cursor-pointer"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={currentStock}
                            value={item.quantity === 0 ? '' : item.quantity}
                            onFocus={(event) => event.target.select()}
                            onChange={(event) => {
                              const raw = event.target.value;
                              if (raw === '') {
                                handleSetQuantity(item.product_id, 0);
                                return;
                              }
                              const val = parseInt(raw, 10);
                              if (!isNaN(val)) {
                                handleSetQuantity(item.product_id, val);
                              }
                            }}
                            onBlur={() => {
                              if (item.quantity <= 0) {
                                handleSetQuantity(item.product_id, 1);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                (event.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-10 h-8 text-center text-xs font-bold bg-transparent rounded-md focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 cursor-text select-all"
                            title="Type quantity directly"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, 1)}
                            disabled={isMaxStock}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-md shadow-xs text-foreground transition-all",
                              isMaxStock
                                ? "opacity-30 cursor-not-allowed bg-transparent"
                                : "hover:bg-background active:bg-background cursor-pointer"
                            )}
                            title={isMaxStock ? `Maximum stock reached (${currentStock})` : "Increase quantity"}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                            const customer = customers.find(customer => customer.customer_id.toString() === selectedCustomer);
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
                          onChange={(event) => setCustomerSearch(event.target.value)}
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
              <Tabs value={paymentType} onValueChange={(value) => setPaymentType(value as any)} className="w-full">
                <TabsList className={`grid w-full h-11 p-1 bg-background border border-border/50 rounded-xl ${isUtangMode ? 'grid-cols-1' : 'grid-cols-3'}`}>
                  {!isUtangMode && <TabsTrigger value="Cash" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all cursor-pointer">Cash</TabsTrigger>}
                  <TabsTrigger
                    value="Utang"
                    disabled={!isUtangMode || !selectedCustomer || selectedCustomer === 'walk-in'}
                    className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all disabled:opacity-30 cursor-pointer"
                  >
                    Utang
                  </TabsTrigger>
                  {!isUtangMode && <TabsTrigger value="Digital" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all cursor-pointer">Digital</TabsTrigger>}
                </TabsList>
              </Tabs>
            </div>

            {/* Amount Tendered (Cash only) */}
            {paymentType === 'Cash' && (
              <div className="mb-5 space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Amount Tendered</Label>
                  {amountTendered && !isNaN(tenderedNumber) ? (
                    tenderedNumber < totalAmount ? (
                      <span className="text-xs font-semibold text-destructive">
                        Short: ₱{(totalAmount - tenderedNumber).toFixed(2)}
                      </span>
                    ) : changeGiven > 0 ? (
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">
                        Change: ₱{changeGiven.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        Exact Amount
                      </span>
                    )
                  ) : null}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">₱</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amountTendered}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => setAmountTendered(event.target.value)}
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
              className="w-full h-14 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleCheckout}
              disabled={isCheckoutDisabled}
            >
              <Check className="w-5 h-5" />
              {isCheckingOut ? 'Processing...' : 'Complete Payment'}
            </Button>
            {cart.length > 0 && paymentType === 'Cash' && !amountTendered.trim() && (
              <p className="text-center text-xs text-muted-foreground mt-2">
                Enter amount tendered to complete payment
              </p>
            )}
            {cart.length > 0 && paymentType === 'Cash' && amountTendered.trim() && !isNaN(tenderedNumber) && tenderedNumber < totalAmount && (
              <p className="text-center text-xs text-destructive mt-2">
                Amount tendered is less than total amount
              </p>
            )}
            {cart.length > 0 && paymentType === 'Utang' && (!selectedCustomer || selectedCustomer === 'walk-in') && (
              <p className="text-center text-xs text-amber-600 dark:text-amber-400 mt-2">
                Select a customer to complete Utang transaction
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Digital Service Modal */}
      <Dialog open={activeModal === 'digital'} onOpenChange={(open) => !open && setActiveModal('none')}>
        <DialogContent showCloseButton={false} className="sm:max-w-[425px] rounded-2xl p-0 overflow-hidden border-border bg-card">
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
              <Select value={serviceType} onValueChange={(value) => setServiceType(value ?? '')}>
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
              <Input placeholder="09170000000" value={serviceAccount} onChange={(event) => setServiceAccount(event.target.value)} className="h-11 rounded-xl bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Amount (₱)</Label>
                <Input type="number" required placeholder="0.00" value={serviceAmount} onFocus={(event) => event.target.select()} onChange={(event) => setServiceAmount(event.target.value)} className="h-11 rounded-xl bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Fee (₱)</Label>
                <Input type="number" value={convenienceFee} onFocus={(event) => event.target.select()} onChange={(event) => setConvenienceFee(event.target.value)} className="h-11 rounded-xl bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Reference No.</Label>
              <Input placeholder="Optional" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} className="h-11 rounded-xl bg-background" />
            </div>
            <DialogFooter className="pt-4 border-t border-border/50 gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setActiveModal('none')} className="h-11 min-h-[44px] rounded-xl font-bold border-border/50 hover:bg-accent cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" className="h-11 min-h-[44px] rounded-xl bg-primary hover:bg-primary/90 text-white font-bold px-6 shadow-md shadow-primary/20 cursor-pointer">
                Add to Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
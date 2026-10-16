'use client';

import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback } from 'react';
import type { Product, Customer, CartItem } from '@/types';
import {
  fetchProducts as fetchProductsService,
} from '@/services/product.Service';
import {
  fetchCustomers as fetchCustomersService,
} from '@/services/customer.Service';
import { completeCheckout } from '@/services/sales.Service';
import { useAlert } from '@/context/AlertContext';
import { cn } from '@/lib/utils';
import {
  calculateCartTotals,
  calculateChange,
  validateCreditLimit,
} from '@/lib/retail';
import {
  ShoppingCart,
  User,
  Plus,
  Minus,
  PackagePlus,
  Smartphone,
  Trash2,
  Check,
  AlertTriangle,
  Search,
  X,
  ArrowDown,
  CreditCard,
  Banknote,
  Loader2,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ModalType = 'none' | 'digital';

interface LastSaleReceipt {
  saleId: number;
  total: number;
  paymentType: 'Cash' | 'Utang' | 'Digital';
  tendered?: number;
  change?: number;
  customerName?: string;
}

export default function POS(): React.JSX.Element {
  // Empty initial states
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
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

  const { showAlert, showConfirm } = useAlert();

  // Checkout Form State
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Utang' | 'Digital'>('Cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  // Active Modal Control
  const [activeModal, setActiveModal] = useState<ModalType>('none');

  // Last Completed Sale Receipt Banner
  const [lastSale, setLastSale] = useState<LastSaleReceipt | null>(null);

  // Digital Service Form
  const [serviceType, setServiceType] = useState<string>('GCash Cash-In');
  const [serviceAccount, setServiceAccount] = useState<string>('');
  const [serviceAmount, setServiceAmount] = useState<string>('');
  const [convenienceFee, setConvenienceFee] = useState<string>('10');
  const [referenceNumber, setReferenceNumber] = useState<string>('');

  // Customer Search Popover with Click-Outside Listener
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setCustomerOpen(false);
      }
    };

    if (customerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [customerOpen]);

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

  // --- Deferred Non-Blocking Search Query ---
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // --- O(1) Lookup Maps (Eliminates O(N * M) nested array iterations across catalog and cart) ---
  const cartMap = useMemo(() => {
    const map = new Map<number, CartItem>();
    for (let i = 0; i < cart.length; i++) {
      map.set(cart[i].product_id, cart[i]);
    }
    return map;
  }, [cart]);

  const productStockMap = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < products.length; i++) {
      map.set(products[i].product_id, products[i].stock_quantity);
    }
    return map;
  }, [products]);

  // --- Derived Calculations (Centralized retail & financial logic) ---
  const { totalAmount, totalItemCount } = useMemo(
    () => calculateCartTotals(cart),
    [cart]
  );

  const cashChange = useMemo(
    () => calculateChange(amountTendered, totalAmount),
    [amountTendered, totalAmount]
  );

  const tenderedNumber = cashChange.tendered;
  const isTenderedValid = cashChange.isValid;
  const changeGiven = paymentType === 'Cash' ? cashChange.change : 0;
  const isCashInvalid = paymentType === 'Cash' && !cashChange.isValid;

  const selectedCustomerObj = useMemo(() => {
    if (!selectedCustomer || selectedCustomer === 'walk-in') return undefined;
    return customers.find(
      (customer) => customer.customer_id.toString() === selectedCustomer
    );
  }, [customers, selectedCustomer]);

  const creditStatus = useMemo(() => {
    if (!selectedCustomerObj) return null;
    return validateCreditLimit(selectedCustomerObj, totalAmount);
  }, [selectedCustomerObj, totalAmount]);

  const isCustomerDisallowedUtang =
    paymentType === 'Utang' && !!selectedCustomerObj && !selectedCustomerObj.is_allowed_utang;

  const isUtangInvalid =
    paymentType === 'Utang' &&
    (!selectedCustomer || selectedCustomer === 'walk-in' || isCustomerDisallowedUtang);

  const isCheckoutDisabled = cart.length === 0 || isCashInvalid || isUtangInvalid || isCheckingOut;

  const realProducts = useMemo(
    () => products.filter((product) => !product.product_name.startsWith('[Digital]')),
    [products]
  );

  // Extract distinct categories from inventory
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    realProducts.forEach((product) => {
      if (product.category && product.category.trim()) {
        cats.add(product.category.trim());
      }
    });
    return ['All', ...Array.from(cats).sort()];
  }, [realProducts]);

  const filteredProducts = useMemo(() => {
    const query = deferredSearchQuery.toLowerCase().trim();
    return products.filter((product) => {
      if (product.product_name.startsWith('[Digital]')) return false;

      const matchesCategory =
        selectedCategory === 'All' || product.category === selectedCategory;

      const matchesSearch =
        !query ||
        product.product_name.toLowerCase().includes(query) ||
        (product.category && product.category.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, deferredSearchQuery]);

  // Common Philippine Peso Banknotes for Smart Quick Bills
  const quickBills = useMemo(() => {
    if (totalAmount <= 0) return [];
    const denominations = [20, 50, 100, 200, 500, 1000];
    return denominations.filter((bill) => bill > totalAmount).slice(0, 3);
  }, [totalAmount]);

  // --- Handlers ---
  const handleAddDigitalService = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!serviceAmount) {
      return showAlert('Please enter the transaction amount before proceeding.', 'Amount Required');
    }

    const transactionAmount = parseFloat(serviceAmount) || 0;
    if (isNaN(transactionAmount) || transactionAmount <= 0) {
      return showAlert('Please enter a valid numeric transaction amount greater than zero.', 'Invalid Amount');
    }
    const fee = parseFloat(convenienceFee) || 0;
    const totalServiceCost = transactionAmount + fee;

    const digitalItem: CartItem = {
      product_id: -Date.now(),
      product_name: `[Digital] ${serviceType} - ${serviceAccount.trim() || 'No Ref'}`,
      category: 'Digital Service',
      unit_type: 'service',
      cost_price: transactionAmount,
      selling_price: totalServiceCost,
      stock_quantity: 9999,
      quantity: 1,
      subtotal: totalServiceCost,
      is_digital: true,
      digital_service: {
        service_type: serviceType,
        account_number_phone: serviceAccount.trim() || undefined,
        transaction_amount: transactionAmount,
        convenience_fee: fee,
        reference_number: referenceNumber.trim() || undefined,
      },
    };

    setCart((previousCart) => [...previousCart, digitalItem]);
    setServiceAccount('');
    setServiceAmount('');
    setReferenceNumber('');
    setActiveModal('none');
  };

  const addToCart = useCallback((product: Product): void => {
    const currentStock = productStockMap.get(product.product_id) ?? product.stock_quantity;

    if (currentStock <= 0) {
      showAlert(`"${product.product_name}" is currently out of stock in inventory.`, 'Out of Stock');
      return;
    }

    const existingInCart = cartMap.get(product.product_id);
    if (existingInCart && existingInCart.quantity >= currentStock) {
      showAlert(`Cannot add more. Only ${currentStock} units available for "${product.product_name}".`, 'Inventory Limit Reached');
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
  }, [productStockMap, cartMap, showAlert]);

  const updateQuantity = useCallback((productId: number, delta: number): void => {
    const targetItem = cartMap.get(productId);
    if (!targetItem) return;

    const currentStock = productStockMap.get(productId) ?? targetItem.stock_quantity;

    if (delta > 0 && targetItem.quantity >= currentStock) {
      showAlert(`Cannot add more. Only ${currentStock} units available for "${targetItem.product_name}".`, 'Inventory Limit Reached');
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
  }, [cartMap, productStockMap, showAlert]);

  const removeFromCart = useCallback((productId: number): void => {
    setCart((previousCart) => previousCart.filter((item) => item.product_id !== productId));
  }, []);

  const handleClearCart = useCallback((): void => {
    if (cart.length === 0) return;
    showConfirm(
      'Are you sure you want to remove all items from this order?',
      () => {
        setCart([]);
        setAmountTendered('');
      },
      'Clear Current Order'
    );
  }, [cart.length, showConfirm]);

  const handleSetQuantity = useCallback((productId: number, targetQty: number): void => {
    const targetItem = cartMap.get(productId);
    if (!targetItem) return;

    const currentStock = productStockMap.get(productId) ?? targetItem.stock_quantity;

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
  }, [cartMap, productStockMap]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      return showAlert('Add at least one product or digital service before checking out.', 'Order Cart Empty');
    }

    // Validate that physical cart items do not exceed available stock
    for (const item of cart) {
      if (item.quantity <= 0) {
        return showAlert(`Please enter a valid quantity for "${item.product_name}".`, 'Invalid Quantity');
      }
      if (!item.is_digital) {
        const currentStock = productStockMap.get(item.product_id) ?? item.stock_quantity;
        if (item.quantity > currentStock) {
          return showAlert(
            `Cannot checkout: quantity for "${item.product_name}" (${item.quantity}) exceeds available inventory (${currentStock}).`,
            'Insufficient Stock'
          );
        }
      }
    }

    if (paymentType === 'Cash') {
      if (!amountTendered.trim()) {
        return showAlert('Please enter the cash amount received from the customer.', 'Cash Amount Required');
      }
      const tendered = parseFloat(amountTendered);
      if (isNaN(tendered) || tendered <= 0) {
        return showAlert('Please enter a valid numeric cash amount greater than zero.', 'Invalid Cash Amount');
      }
      if (tendered < totalAmount) {
        return showAlert(
          `Amount tendered (₱${tendered.toFixed(2)}) is less than total amount (₱${totalAmount.toFixed(2)}). Please collect the remaining ₱${(totalAmount - tendered).toFixed(2)}.`,
          'Insufficient Cash'
        );
      }
    }

    if (paymentType === 'Utang') {
      if (!selectedCustomer || selectedCustomer === 'walk-in') {
        return showAlert('Please select a registered customer to record this credit transaction.', 'Customer Required');
      }
      if (selectedCustomerObj && !selectedCustomerObj.is_allowed_utang) {
        return showAlert(
          `"${selectedCustomerObj.first_name} ${selectedCustomerObj.last_name}" is currently not allowed to purchase on utang/credit.`,
          'Utang Credit Disallowed'
        );
      }
    }

    setIsCheckingOut(true);
    try {
      const finalTendered = paymentType === 'Cash' ? parseFloat(amountTendered) : totalAmount;
      const finalChange = paymentType === 'Cash' ? Math.max(0, finalTendered - totalAmount) : 0;

      const physicalItems = cart.filter((item) => !item.is_digital);
      const digitalItems = cart.filter((item) => item.is_digital && item.digital_service);

      // Complete sale, insert line items, deduct stock, record digital services, and record utang in a single atomic transaction
      const { data, error } = await completeCheckout({
        customer_id: selectedCustomer && selectedCustomer !== 'walk-in' ? parseInt(selectedCustomer, 10) : null,
        total_amount: totalAmount,
        payment_type: paymentType,
        amount_tendered: finalTendered,
        change_given: finalChange,
        items: physicalItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.selling_price,
          subtotal: item.subtotal,
        })),
        digital_services: digitalItems.map((item) => ({
          service_type: item.digital_service!.service_type,
          account_number_phone: item.digital_service!.account_number_phone || null,
          transaction_amount: item.digital_service!.transaction_amount,
          convenience_fee: item.digital_service!.convenience_fee,
          reference_number: item.digital_service!.reference_number || null,
        })),
      });

      if (error) throw error;

      // Record last completed sale summary for instant visual confirmation
      setLastSale({
        saleId: data?.sale_id,
        total: totalAmount,
        paymentType: paymentType,
        tendered: finalTendered,
        change: finalChange,
        customerName: selectedCustomerObj
          ? `${selectedCustomerObj.first_name} ${selectedCustomerObj.last_name}`
          : undefined,
      });

      showAlert(
        paymentType === 'Utang'
          ? `Utang sale of ₱${totalAmount.toFixed(2)} recorded to ${selectedCustomerObj?.first_name ?? 'customer'}'s account.`
          : paymentType === 'Cash' && finalChange > 0
            ? `Sale completed. Return change (sukli) of ₱${finalChange.toFixed(2)} to customer.`
            : `Sale of ₱${totalAmount.toFixed(2)} completed successfully.`,
        'Sale Completed'
      );

      // Clear cart and refresh products list to reflect new stock
      setCart([]);
      setAmountTendered('');
      setSelectedCustomer('');
      fetchInitialData();
    } catch (error: any) {
      console.error('Checkout failed:', error);
      showAlert(`Could not complete transaction: ${error.message}. Please check connection and try again.`, 'Transaction Failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Filter Customer for Utang Popover
  const filteredCustomers = useMemo(() => {
    const query = customerSearch.toLowerCase().trim();
    if (!query) return customers;
    return customers.filter((customer) => {
      const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
      return fullName.includes(query);
    });
  }, [customers, customerSearch]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row lg:h-[calc(100dvh-6.5rem)] gap-4 lg:gap-5 xl:gap-6 lg:overflow-hidden p-0.5 sm:p-1">
      {/* LEFT: Product Catalog */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-3.5 overflow-hidden min-h-0 pb-1">
        {/* Header / Search / Digital Action */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 bg-card p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 ring-1 ring-primary/20">
              <ShoppingCart className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">Point of Sale</h2>
              <p className="text-xs text-muted-foreground/90 font-normal">Select products or record digital e-services</p>
            </div>
          </div>

          <div className="flex flex-1 w-full sm:max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
              />
              <Input
                type="text"
                placeholder="Search products or categories..."
                aria-label="Search products or categories"
                value={searchQuery}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9.5 pr-8 rounded-xl bg-muted/40 border-border/60 focus-visible:ring-primary/30 h-10 text-xs sm:text-sm font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                  aria-label="Clear product search query"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <Button
              variant="default"
              className="rounded-xl h-10 px-3.5 gap-2 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 shadow-xs cursor-pointer text-xs font-semibold shrink-0 tracking-normal"
              onClick={() => setActiveModal('digital')}
              aria-label="Record digital service like GCash or E-Load"
            >
              <Smartphone className="w-4 h-4 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
              <span>Digital Service</span>
            </Button>
          </div>
        </div>

        {/* Category Filters (Vibrant, Clear Pills with explicit type tokens) */}
        {availableCategories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-none select-none shrink-0">
            {availableCategories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer select-none font-medium tracking-normal shrink-0',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs ring-2 ring-primary/20'
                      : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-border/60'
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Product Grid */}
        <ScrollArea className="flex-1 min-h-0 rounded-2xl border border-border/70 bg-card shadow-xs">
          <div className="p-3.5 sm:p-4">
            {realProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[38vh] text-muted-foreground">
                <PackagePlus className="w-14 h-14 mb-3 text-muted-foreground/30" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground tracking-tight">No products in inventory</p>
                <p className="text-xs text-muted-foreground mt-1">Add products in Inventory Management to start selling.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[38vh] text-muted-foreground">
                <ShoppingCart className="w-14 h-14 mb-3 text-muted-foreground/30" aria-hidden="true" />
                <p className="text-base font-semibold text-foreground tracking-tight">No matching products found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery ? `No items match "${searchQuery}"` : 'No items match the selected category'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="text-xs font-medium rounded-lg cursor-pointer h-8 px-3"
                    >
                      Clear search
                    </Button>
                  )}
                  {selectedCategory !== 'All' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCategory('All')}
                      className="text-xs font-medium rounded-lg cursor-pointer h-8 px-3"
                    >
                      Show all categories
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-3.5">
                {filteredProducts.map((product) => {
                  const outOfStock = product.stock_quantity <= 0;
                  const itemInCart = cartMap.get(product.product_id);
                  const isMaxInCart = itemInCart ? itemInCart.quantity >= product.stock_quantity : false;
                  const isLowStock =
                    product.stock_quantity <= (product.reorder_level ?? globalLowStockThreshold) && !outOfStock;

                  return (
                    <div
                      key={product.product_id}
                      onClick={() => !outOfStock && !isMaxInCart && addToCart(product)}
                      role="button"
                      tabIndex={outOfStock || isMaxInCart ? -1 : 0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !outOfStock && !isMaxInCart) {
                          e.preventDefault();
                          addToCart(product);
                        }
                      }}
                      aria-label={
                        outOfStock
                          ? `${product.product_name} is out of stock`
                          : isMaxInCart
                            ? `Maximum quantity of ${product.product_name} already in cart`
                            : `Add ${product.product_name} to cart for ₱${product.selling_price.toFixed(2)}`
                      }
                      className={cn(
                        'group flex flex-col justify-between border transition-all duration-200 cursor-pointer rounded-xl p-3 sm:p-3.5 select-none bg-card relative overflow-hidden',
                        outOfStock || isMaxInCart
                          ? 'opacity-40 grayscale cursor-not-allowed bg-muted/20 border-border/50'
                          : itemInCart
                            ? 'border-primary ring-1 ring-primary/30 bg-primary/[0.04] shadow-xs hover:border-primary hover:shadow-sm'
                            : 'border-border/70 hover:border-primary/50 hover:bg-muted/30 hover:shadow-xs active:scale-[0.99]'
                      )}
                    >
                      <div>
                        {/* Top Category & Status Badges */}
                        <div className="flex justify-between items-center gap-1.5 min-h-[22px] mb-2">
                          {product.category ? (
                            <span className="text-[10px] uppercase tracking-wider font-bold text-primary/80 truncate max-w-[50%]">
                              {product.category}
                            </span>
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            {itemInCart && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full border border-primary/25 tabular-nums animate-in fade-in zoom-in-90 duration-150 motion-reduce:animate-none">
                                <Check className="w-2.5 h-2.5" aria-hidden="true" />
                                {itemInCart.quantity} in cart
                              </span>
                            )}
                            {outOfStock && (
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full border border-border">
                                Out of stock
                              </span>
                            )}
                            {isLowStock && !outOfStock && (
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full tabular-nums">
                                Low ({product.stock_quantity})
                              </span>
                            )}
                            {!isLowStock && !outOfStock && !itemInCart && (
                              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full tabular-nums">
                                {product.stock_quantity} left
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title with fixed height measure for uniform vertical rhythm */}
                        <h4 className="font-semibold text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.5rem] text-foreground">
                          {product.product_name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between">
                        <span className="text-base sm:text-lg font-extrabold tracking-tight text-foreground tabular-nums">
                          ₱{product.selling_price.toFixed(2)}
                        </span>
                        <div
                          aria-hidden="true"
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 motion-reduce:transition-none',
                            outOfStock || isMaxInCart
                              ? 'text-muted-foreground/30'
                              : itemInCart
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-active:scale-90'
                          )}
                        >
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT: Cart / Checkout Panel */}
      <div id="checkout-panel" className="w-full lg:w-[410px] xl:w-[440px] flex flex-col shrink-0 min-h-0 pb-1">
        <Card className="flex-1 flex flex-col min-h-0 border-border/70 bg-card overflow-hidden rounded-2xl shadow-xs">
          <CardHeader className="border-b border-border/60 p-4 bg-muted/20 shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold tracking-tight text-foreground">Current Order</CardTitle>
                <Badge className="bg-primary/15 text-primary border-primary/25 font-bold text-xs px-2.5 py-0.5 rounded-full tabular-nums">
                  {totalItemCount} {totalItemCount === 1 ? 'Item' : 'Items'}
                </Badge>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-1 font-medium"
                  title="Clear all items in order"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear Order</span>
                </button>
              )}
            </div>

            {/* Last Sale Confirmation Receipt Banner */}
            {lastSale && (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 p-2.5 rounded-xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1.5 duration-200 motion-reduce:animate-none">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-300">
                    <Check className="w-3 h-3" aria-hidden="true" />
                  </div>
                  <p className="truncate text-xs">
                    Completed: <strong className="tabular-nums font-bold">₱{lastSale.total.toFixed(2)}</strong> ({lastSale.paymentType})
                    {lastSale.paymentType === 'Cash' && lastSale.change !== undefined && lastSale.change > 0 && (
                      <span className="text-emerald-700 dark:text-emerald-300 font-bold ml-1.5 tabular-nums">
                        • Sukli: ₱{lastSale.change.toFixed(2)}
                      </span>
                    )}
                    {lastSale.paymentType === 'Utang' && lastSale.customerName && (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1.5">
                        • Charged to {lastSale.customerName}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLastSale(null)}
                  className="text-muted-foreground hover:text-foreground p-1 ml-2 cursor-pointer transition-transform duration-100 hover:scale-110 active:scale-95 motion-reduce:transition-none"
                  aria-label="Dismiss completed sale banner"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </CardHeader>

          {/* Cart Items (Clean, Color-tagged List) */}
          <ScrollArea className="flex-1 min-h-0 p-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16 px-4">
                <div className="w-14 h-14 bg-muted/60 rounded-full flex items-center justify-center mb-2.5 text-muted-foreground/60">
                  <ShoppingCart className="w-7 h-7" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold tracking-tight text-foreground">Order cart is empty</p>
                <p className="text-xs text-muted-foreground mt-1 text-center max-w-[220px] leading-relaxed">
                  Select products from the catalog or add a digital service to begin
                </p>
              </div>
            ) : (
              <div className="p-3.5 divide-y divide-border/40">
                {cart.map((item) => {
                  const currentStock =
                    productStockMap.get(item.product_id) ?? item.stock_quantity;
                  const isMaxStock = item.quantity >= currentStock;
                  const isDigital = item.product_name.startsWith('[Digital]');

                  return (
                    <div
                      key={item.product_id}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-right-1 duration-150 motion-reduce:animate-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                            isDigital
                              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                              : 'bg-primary/10 text-primary'
                          )}
                        >
                          {isDigital ? (
                            <Smartphone className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <PackagePlus className="w-4 h-4" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs sm:text-sm text-foreground truncate leading-snug">{item.product_name}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                            ₱{item.selling_price.toFixed(2)} each
                            {isMaxStock && (
                              <span className="text-[10px] text-amber-700 dark:text-amber-300 ml-1.5 font-bold">
                                (Max: {currentStock})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        {/* Interactive Quantity Stepper */}
                        <div className="flex items-center border border-border/70 rounded-lg bg-muted/40 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, -1)}
                            className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-l-md cursor-pointer transition-all duration-100 active:scale-90 motion-reduce:transition-none"
                            aria-label={`Decrease ${item.product_name} quantity`}
                          >
                            <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
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
                            className="w-8 h-8 sm:h-7 text-center text-xs font-bold bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 cursor-text select-all tabular-nums text-foreground"
                            aria-label={`Quantity for ${item.product_name}`}
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product_id, 1)}
                            disabled={isMaxStock}
                            className={cn(
                              'w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-r-md transition-all duration-100 motion-reduce:transition-none',
                              isMaxStock
                                ? 'opacity-30 cursor-not-allowed text-muted-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer active:scale-90'
                            )}
                            aria-label={`Increase ${item.product_name} quantity`}
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="w-16 text-right">
                          <p className="font-bold text-xs sm:text-sm text-foreground tabular-nums">
                            ₱{item.subtotal.toFixed(2)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-md p-1.5 sm:p-1 min-w-[32px] min-h-[32px] flex items-center justify-center transition-all duration-100 hover:scale-105 active:scale-90 cursor-pointer motion-reduce:transition-none"
                          aria-label={`Remove ${item.product_name} from order`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Payment Section (Semantic Color Coding) */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-border/70 bg-muted/15 space-y-3.5">
            {/* Customer Select / Mode Toggle */}
            <div className="space-y-1.5" ref={customerDropdownRef}>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                  {isUtangMode ? 'Charge to Utang (Credit)' : 'Customer'}
                </span>
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
                      setPaymentType('Utang');
                    }
                  }}
                  className={cn(
                    'font-bold cursor-pointer transition-colors text-xs',
                    isUtangMode ? 'text-primary hover:underline' : 'text-rose-600 dark:text-rose-400 hover:underline'
                  )}
                >
                  {isUtangMode ? 'Switch to Walk-in Cash' : 'Switch to Customer Utang'}
                </button>
              </div>

              {!isUtangMode ? (
                <div className="w-full flex items-center gap-2 px-3 py-2 border border-input/60 rounded-xl bg-card text-xs text-muted-foreground shadow-2xs">
                  <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium text-foreground">Walk-in Customer (Cash / Digital)</span>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCustomerOpen(!customerOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-rose-500/30 rounded-xl bg-rose-500/[0.04] text-xs font-semibold hover:bg-rose-500/[0.08] transition-colors cursor-pointer shadow-2xs"
                    aria-label="Select registered customer for utang credit"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <User className="w-4 h-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      <span className="truncate text-foreground font-semibold">
                        {selectedCustomerObj
                          ? `${selectedCustomerObj.first_name} ${selectedCustomerObj.last_name}`
                          : 'Select registered customer...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {selectedCustomerObj && (
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 tabular-nums bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/25">
                          ₱{selectedCustomerObj.current_balance.toFixed(2)} owed
                        </span>
                      )}
                      <span className="text-muted-foreground text-[10px]" aria-hidden="true">▼</span>
                    </div>
                  </button>

                  {/* Customer Status Details if selected */}
                  {selectedCustomerObj && (
                    <div className="mt-1.5 p-2.5 bg-rose-500/10 rounded-xl text-xs space-y-1 border border-rose-500/25">
                      <div className="flex justify-between items-center text-foreground font-medium">
                        <span>Credit Limit: <strong className="tabular-nums font-bold">₱{selectedCustomerObj.credit_limit.toFixed(2)}</strong></span>
                        <span>Current Debt: <strong className="text-rose-600 dark:text-rose-400 tabular-nums font-bold">₱{selectedCustomerObj.current_balance.toFixed(2)}</strong></span>
                      </div>
                      {!selectedCustomerObj.is_allowed_utang && (
                        <p className="text-destructive font-bold text-xs pt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Customer is flagged as not allowed for credit.</span>
                        </p>
                      )}
                      {selectedCustomerObj.is_allowed_utang && creditStatus?.willExceed && (
                        <p className="text-amber-800 dark:text-amber-300 font-semibold text-xs pt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                          <span>
                            Sale will exceed credit limit by ₱{creditStatus.exceededBy.toFixed(2)}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {customerOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none">
                      <div className="p-2 border-b border-border bg-muted/40">
                        <Input
                          type="text"
                          placeholder="Search customer by name..."
                          aria-label="Search customer by name"
                          value={customerSearch}
                          autoCapitalize="words"
                          autoCorrect="off"
                          onChange={(event) => setCustomerSearch(event.target.value)}
                          className="h-8.5 bg-background border-input rounded-lg text-xs font-normal"
                          autoFocus
                        />
                      </div>
                      <ScrollArea className="h-44">
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
                                className={cn(
                                  'px-3 py-2.5 sm:py-2 text-xs min-h-[44px] cursor-pointer rounded-lg hover:bg-muted flex items-center justify-between transition-colors',
                                  selectedCustomer === customer.customer_id.toString()
                                    ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200 font-bold'
                                    : ''
                                )}
                              >
                                <div>
                                  <p className="font-semibold text-foreground">{customer.first_name} {customer.last_name}</p>
                                  <p className="text-[10px] text-muted-foreground tabular-nums font-normal">Limit: ₱{customer.credit_limit.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                                    ₱{customer.current_balance.toFixed(2)}
                                  </span>
                                  {!customer.is_allowed_utang && (
                                    <p className="text-[10px] text-destructive font-bold">No Credit</p>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                              No registered customers found
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Mode Selector Tabs */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Payment Channel
              </Label>
              <Tabs value={paymentType} onValueChange={(value) => setPaymentType(value as any)} className="w-full">
                <TabsList className={`grid w-full h-10 p-1 bg-muted/60 rounded-xl ${isUtangMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {!isUtangMode && (
                    <TabsTrigger
                      value="Cash"
                      className="rounded-lg text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Banknote className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Cash</span>
                    </TabsTrigger>
                  )}
                  {isUtangMode && (
                    <TabsTrigger
                      value="Utang"
                      className="rounded-lg text-xs font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Utang (Customer Credit)</span>
                    </TabsTrigger>
                  )}
                  {!isUtangMode && (
                    <TabsTrigger
                      value="Digital"
                      className="rounded-lg text-xs font-bold data-[state=active]:bg-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Digital (GCash)</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>

            {/* Amount Tendered (Cash only with smart quick bills) */}
            {paymentType === 'Cash' && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                    Cash Tendered
                  </span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {totalAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmountTendered(totalAmount.toFixed(2))}
                        className={cn(
                          'text-[11px] px-2.5 py-1.5 sm:py-1 rounded-lg border transition-all cursor-pointer font-bold tabular-nums shrink-0 min-h-[34px] sm:min-h-[28px] flex items-center justify-center',
                          amountTendered === totalAmount.toFixed(2)
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40'
                            : 'bg-primary/10 text-primary border-primary/25 hover:bg-primary/20'
                        )}
                      >
                        Exact
                      </button>
                    )}
                    {quickBills.map((bill) => {
                      const isSelected = amountTendered === bill.toString();
                      return (
                        <button
                          key={bill}
                          type="button"
                          onClick={() => setAmountTendered(bill.toString())}
                          className={cn(
                            'text-[11px] px-2.5 py-1.5 sm:py-1 rounded-lg border transition-all cursor-pointer font-semibold tabular-nums shrink-0 min-h-[34px] sm:min-h-[28px] flex items-center justify-center',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs ring-1 ring-primary/40'
                              : 'bg-card border-border/70 hover:border-primary/50 text-foreground hover:text-primary hover:bg-muted/30'
                          )}
                        >
                          ₱{bill}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-extrabold text-primary" aria-hidden="true">₱</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Cash amount received from customer"
                    value={amountTendered}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => setAmountTendered(event.target.value)}
                    className="pl-7 text-base font-bold h-11 sm:h-10 bg-card rounded-xl border-input tabular-nums shadow-2xs focus-visible:ring-primary/40"
                  />
                  {amountTendered && (
                    <button
                      type="button"
                      onClick={() => setAmountTendered('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg"
                      aria-label="Clear cash amount tendered"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Tendered Feedback */}
                {amountTendered && !isNaN(tenderedNumber) && (
                  <div className="pt-0.5">
                    {tenderedNumber < totalAmount ? (
                      <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between text-xs animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
                          <span className="text-rose-900 dark:text-rose-100 font-bold">Cash received is short</span>
                        </div>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                          Short by ₱{(totalAmount - tenderedNumber).toFixed(2)}
                        </span>
                      </div>
                    ) : changeGiven > 0 ? (
                      <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between shadow-xs animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 flex items-center justify-center font-black text-xs shrink-0">
                            ₱
                          </div>
                          <div>
                            <span className="text-emerald-950 dark:text-emerald-100 text-xs font-bold leading-tight block">
                              Change to Return (Sukli)
                            </span>
                            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
                              Hand exact cash to customer
                            </span>
                          </div>
                        </div>
                        <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums tracking-tight">
                          ₱{changeGiven.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-muted-foreground font-semibold text-xs px-1">
                        Exact cash amount received (No sukli needed)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <Separator className="bg-border/60" />

            {/* Total and Action */}
            <div className="flex justify-between items-baseline pt-0.5">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold block">
                  Total Order Amount
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in current order
                </span>
              </div>
              <span className="text-3xl sm:text-4xl font-black text-primary tracking-tight tabular-nums">
                ₱{totalAmount.toFixed(2)}
              </span>
            </div>

            <Button
              className={cn(
                'w-full h-13 text-sm sm:text-base font-extrabold rounded-xl text-white shadow-md flex items-center justify-center gap-2.5 cursor-pointer transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed tracking-tight motion-reduce:transition-none',
                paymentType === 'Utang'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  : paymentType === 'Digital'
                    ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/30'
                    : 'bg-primary hover:bg-primary/90 shadow-primary/30'
              )}
              onClick={handleCheckout}
              disabled={isCheckoutDisabled}
            >
              {isCheckingOut ? (
                <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden="true" />
              ) : paymentType === 'Cash' ? (
                <Banknote className="w-5 h-5 shrink-0" aria-hidden="true" />
              ) : paymentType === 'Utang' ? (
                <CreditCard className="w-5 h-5 shrink-0" aria-hidden="true" />
              ) : (
                <Smartphone className="w-5 h-5 shrink-0" aria-hidden="true" />
              )}
              <span>
                {isCheckingOut
                  ? 'Recording sale...'
                  : paymentType === 'Utang'
                    ? `Record Utang Sale • ₱${totalAmount.toFixed(2)}`
                    : paymentType === 'Digital'
                      ? `Complete Digital Sale • ₱${totalAmount.toFixed(2)}`
                      : `Complete Cash Sale • ₱${totalAmount.toFixed(2)}`}
              </span>
            </Button>

            {/* Contextual Status / Validation Messages */}
            {cart.length === 0 && (
              <p className="text-center text-xs text-muted-foreground font-medium">
                Add products or services above to begin order
              </p>
            )}
            {cart.length > 0 && paymentType === 'Cash' && !amountTendered.trim() && (
              <p className="text-center text-xs text-muted-foreground font-medium">
                Enter cash amount received to calculate customer change
              </p>
            )}
            {cart.length > 0 && paymentType === 'Cash' && amountTendered.trim() && !isNaN(tenderedNumber) && tenderedNumber < totalAmount && (
              <p className="text-center text-xs text-rose-600 dark:text-rose-400 font-bold tabular-nums">
                Amount received is short by ₱{(totalAmount - tenderedNumber).toFixed(2)}
              </p>
            )}
            {cart.length > 0 && paymentType === 'Utang' && (!selectedCustomer || selectedCustomer === 'walk-in') && (
              <p className="text-center text-xs text-rose-600 dark:text-rose-400 font-bold">
                Select a registered customer to record this utang sale
              </p>
            )}
            {cart.length > 0 && isCustomerDisallowedUtang && (
              <p className="text-center text-xs text-destructive font-bold">
                Selected customer is flagged as not allowed for credit
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Mobile Sticky Order Bar (when items are in cart) */}
      {cart.length > 0 && (
        <div className="lg:hidden sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-20 bg-card/95 backdrop-blur-md border border-border/80 p-3 shadow-md flex items-center justify-between rounded-2xl mx-1 mb-1">
          <div>
            <span className="text-[11px] text-muted-foreground font-medium">Order Total ({totalItemCount} items)</span>
            <p className="text-base font-extrabold text-primary tabular-nums">₱{totalAmount.toFixed(2)}</p>
          </div>
          <Button
            size="sm"
            className="rounded-xl font-bold bg-primary text-primary-foreground gap-1.5 shadow-xs cursor-pointer h-11 px-4 text-xs"
            onClick={() => {
              const checkoutElement = document.getElementById('checkout-panel');
              if (checkoutElement) {
                checkoutElement.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            <span>Review & Pay</span>
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* Digital Service Modal (Cyan Theme) */}
      <Dialog open={activeModal === 'digital'} onOpenChange={(open) => !open && setActiveModal('none')}>
        <DialogContent showCloseButton={false} className="sm:max-w-[440px] rounded-2xl p-0 overflow-hidden border-border bg-card">
          <div className="bg-cyan-500/10 p-5 sm:p-6 border-b border-cyan-500/20">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                <Smartphone className="w-5 h-5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
                Record Digital Service
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-1 font-normal">
              Add e-wallet transfers or phone load transactions to this order
            </p>
          </div>
          <form onSubmit={handleAddDigitalService} className="p-5 sm:p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Service Type</Label>
              <Select value={serviceType} onValueChange={(value) => setServiceType(value ?? '')}>
                <SelectTrigger className="h-10 rounded-xl bg-background cursor-pointer text-xs sm:text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GCash Cash-In" className="cursor-pointer text-xs sm:text-sm font-medium">GCash Cash-In</SelectItem>
                  <SelectItem value="GCash Cash-Out" className="cursor-pointer text-xs sm:text-sm font-medium">GCash Cash-Out</SelectItem>
                  <SelectItem value="Maya Transfer" className="cursor-pointer text-xs sm:text-sm font-medium">Maya Cash-In / Transfer</SelectItem>
                  <SelectItem value="E-Load (Smart / Globe / DITO)" className="cursor-pointer text-xs sm:text-sm font-medium">E-Load (Smart / Globe / DITO)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                Recipient / Mobile Number
              </Label>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="e.g. 0917 123 4567"
                aria-label="Recipient mobile or account number"
                value={serviceAccount}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(event) => setServiceAccount(event.target.value)}
                className="h-11 sm:h-10 rounded-xl bg-background text-xs sm:text-sm font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Transaction Amount (₱)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  aria-label="Transaction amount in Philippine Pesos"
                  value={serviceAmount}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setServiceAmount(event.target.value)}
                  className="h-11 sm:h-10 rounded-xl bg-background text-xs sm:text-sm font-semibold tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Convenience Fee (₱)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="10.00"
                  aria-label="Store convenience fee in Philippine Pesos"
                  value={convenienceFee}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setConvenienceFee(event.target.value)}
                  className="h-11 sm:h-10 rounded-xl bg-background text-xs sm:text-sm font-semibold tabular-nums"
                />
              </div>
            </div>

            {/* Calculated Customer Total */}
            {serviceAmount && !isNaN(parseFloat(serviceAmount)) && (
              <div className="p-3 bg-cyan-500/10 rounded-xl text-xs flex justify-between items-center border border-cyan-500/20">
                <span className="text-muted-foreground font-medium">Total to collect from customer:</span>
                <span className="font-extrabold text-sm text-cyan-700 dark:text-cyan-300 tabular-nums">
                  ₱{((parseFloat(serviceAmount) || 0) + (parseFloat(convenienceFee) || 0)).toFixed(2)}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Reference No. (Optional)</Label>
              <Input
                placeholder="e.g. GCash Ref #100234567"
                aria-label="Transaction reference number"
                value={referenceNumber}
                autoCapitalize="characters"
                autoCorrect="off"
                onChange={(event) => setReferenceNumber(event.target.value)}
                className="h-11 sm:h-10 rounded-xl bg-background text-xs sm:text-sm font-medium"
              />
            </div>
            <DialogFooter className="pt-3 border-t border-border/50 gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveModal('none')}
                className="h-11 sm:h-10 rounded-xl font-bold border-border/50 hover:bg-accent cursor-pointer text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 sm:h-10 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-5 shadow-xs cursor-pointer text-xs"
              >
                Add Digital Service to Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
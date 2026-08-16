import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ShoppingCart, 
  User, 
  CreditCard, 
  Plus, 
  Minus, 
  PackagePlus, 
  UserPlus, 
  Smartphone 
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

// --- Type Definitions ---
interface Product {
  product_id: number;
  product_name: string;
  category?: string;
  unit_type?: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
}

interface Customer {
  customer_id: number;
  first_name: string;
  last_name: string;
  phone_number?: string;
  credit_limit: number;
  current_balance: number;
  is_allowed_utang: boolean;
}

interface CartItem extends Product {
  quantity: number;
  subtotal: number;
}

type ModalType = 'none' | 'product' | 'customer' | 'digital';

export default function POS(): React.JSX.Element {
  // Empty initial states
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout Form State
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Utang' | 'Digital'>('Cash');
  const [amountTendered, setAmountTendered] = useState<string>('');

  // Active Modal Control
  const [activeModal, setActiveModal] = useState<ModalType>('none');

  // --- Form States for New Entities ---
  // Product Form
  const [newProductName, setNewProductName] = useState<string>('');
  const [newCostPrice, setNewCostPrice] = useState<string>('');
  const [newSellingPrice, setNewSellingPrice] = useState<string>('');
  const [newStock, setNewStock] = useState<string>('');

  // Customer Form
  const [newFirstName, setNewFirstName] = useState<string>('');
  const [newLastName, setNewLastName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newCreditLimit, setNewCreditLimit] = useState<string>('500');

  // Digital Service Form
  const [serviceType, setServiceType] = useState<string>('GCash Cash-In');
  const [serviceAccount, setServiceAccount] = useState<string>('');
  const [serviceAmount, setServiceAmount] = useState<string>('');
  const [convenienceFee, setConvenienceFee] = useState<string>('10');
  const [refNumber, setRefNumber] = useState<string>('');


  // ------- Components --------
  // --- Initial Data Fetching ---
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    // Fetch Products
    const { data: productData, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .order('product_name', { ascending: true });

    if (prodErr) console.error('Error loading products:', prodErr);
    else setProducts(productData || []);

    // Fetch Customers
    const { data: customerData, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .order('first_name', { ascending: true });

    if (custErr) console.error('Error loading customers:', custErr);
    else setCustomers(customerData || []);
  };

  // --- Derived Calculations ---
  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const changeGiven = amountTendered ? Math.max(0, parseFloat(amountTendered) - totalAmount) : 0;

  // --- Handlers ---
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newSellingPrice) return alert('Fill in product name and selling price.');

    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          product_name: newProductName,
          cost_price: parseFloat(newCostPrice) || 0,
          selling_price: parseFloat(newSellingPrice) || 0,
          stock_quantity: parseInt(newStock, 10) || 0,
        },
      ])
      .select();

    if (error) {
      alert('Failed to add product: ' + error.message);
    } else if (data) {
      setProducts((prev) => [...prev, data[0]]);
      setNewProductName(''); setNewCostPrice(''); setNewSellingPrice(''); setNewStock('');
      setActiveModal('none');
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newLastName) return alert('First and Last name are required.');

    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          first_name: newFirstName,
          last_name: newLastName,
          phone_number: newPhone,
          credit_limit: parseFloat(newCreditLimit) || 0,
          current_balance: 0,
          is_allowed_utang: true,
        },
      ])
      .select();

    if (error) {
      alert('Failed to register customer: ' + error.message);
    } else if (data && data[0]) {
      const newCust = data[0];
      setCustomers((prev) => [...prev, newCust]);
      setSelectedCustomer(newCust.customer_id.toString());
      setNewFirstName(''); setNewLastName(''); setNewPhone(''); setNewCreditLimit('500');
      setActiveModal('none');
    }
  };

  const handleAddDigitalService = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!serviceAmount) return alert('Transaction amount required.');

    const txAmount = parseFloat(serviceAmount) || 0;
    const fee = parseFloat(convenienceFee) || 0;
    const totalServiceCost = txAmount + fee;

    const digitalItem: Product = {
      product_id: Date.now(),
      product_name: `[Digital] ${serviceType} - ${serviceAccount || 'No Ref'}`,
      cost_price: txAmount,
      selling_price: totalServiceCost,
      stock_quantity: 999,
    };

    addToCart(digitalItem);
    setServiceAccount(''); setServiceAmount(''); setRefNumber('');
    setActiveModal('none');
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
      // 1. Insert into SALES table
      const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .insert([
          {
            customer_id: selectedCustomer ? parseInt(selectedCustomer, 10) : null,
            total_amount: totalAmount,
            payment_type: paymentType,
            amount_tendered: paymentType === 'Cash' ? parseFloat(amountTendered) || totalAmount : totalAmount,
            change_given: paymentType === 'Cash' ? changeGiven : 0,
          },
        ])
        .select()
        .single();

      if (saleErr) throw saleErr;

      // 2. Prepare & Insert SALE_ITEMS
      const saleItems = cart.map((item) => ({
        sale_id: sale.sale_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.selling_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems);
      if (itemsErr) throw itemsErr;

      // 3. Deduct Stock Quantity for Each Product
      for (const item of cart) {
        await supabase
          .from('products')
          .update({ stock_quantity: item.stock_quantity - item.quantity })
          .eq('product_id', item.product_id);
      }

      // 4. Handle Utang Recording if payment is Utang
      if (paymentType === 'Utang' && selectedCustomer) {
        const customerIdInt = parseInt(selectedCustomer, 10);
        
        // Add Utang record
        await supabase.from('utang_transactions').insert([
          {
            customer_id: customerIdInt,
            sale_id: sale.sale_id,
            amount: totalAmount,
            status: 'Unpaid',
          },
        ]);

        // Get current customer balance & update
        const currentCust = customers.find((c) => c.customer_id === customerIdInt);
        if (currentCust) {
          await supabase
            .from('customers')
            .update({ current_balance: (currentCust.current_balance || 0) + totalAmount })
            .eq('customer_id', customerIdInt);
        }
      }

      alert('Transaction completed and saved to Supabase!');
      
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
  

  return (
    <div className="flex h-screen bg-slate-50 p-4 gap-4">
      {/* LEFT: Product Catalog & Header */}
      <Card className="w-2/3 flex flex-col justify-between">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" /> Products
            </CardTitle>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => setActiveModal('digital')}>
                <Smartphone className="w-4 h-4 mr-1" /> GCash/E-Load
              </Button>
              <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => setActiveModal('customer')}>
                <UserPlus className="w-4 h-4 mr-1" /> Customer
              </Button>
              <Button size="sm" onClick={() => setActiveModal('product')}>
                <PackagePlus className="w-4 h-4 mr-1" /> Add Product
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20 border-2 border-dashed rounded-lg">
              <ShoppingCart className="w-12 h-12 mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">No products available</p>
              <p className="text-xs">Click the buttons above to populate your inventory or process digital transactions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {products.map((product) => (
                <Card 
                  key={product.product_id}
                  onClick={() => addToCart(product)}
                  className="cursor-pointer hover:border-primary transition shadow-sm hover:shadow"
                >
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{product.product_name}</h4>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        Stock: {product.stock_quantity}
                      </Badge>
                    </div>
                    <div className="mt-3 text-primary font-bold text-base">
                      ₱{product.selling_price.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* RIGHT: Cart & Payment Details */}
      <Card className="w-1/3 flex flex-col justify-between">
        <CardHeader>
          <CardTitle className="text-xl">Current Order</CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between">
          {/* Cart List */}
          <div className="max-h-52 overflow-y-auto border-b pb-2">
            {cart.length === 0 ? (
              <p className="text-slate-400 text-center py-8 text-sm">Cart is empty</p>
            ) : (
              cart.map((item) => (
                <div key={item.product_id} className="flex justify-between items-center my-2 text-xs">
                  <div className="flex-1 pr-2">
                    <p className="font-medium text-slate-800">{item.product_name}</p>
                    <p className="text-slate-400">₱{item.selling_price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(item.product_id, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center font-semibold">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQuantity(item.product_id, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="w-14 text-right font-bold">₱{item.subtotal.toFixed(2)}</div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 mt-3">
            {/* Customer Dropdown */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label className="text-xs flex items-center gap-1">
                  <User className="w-3 h-3" /> Customer
                </Label>
                <button onClick={() => setActiveModal('customer')} className="text-xs text-primary hover:underline">
                  + New
                </button>
              </div>
              <Select value={selectedCustomer} onValueChange={(val) => setSelectedCustomer(val ?? '')}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Walk-in Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.customer_id} value={c.customer_id.toString()}>
                      {c.first_name} {c.last_name} (Bal: ₱{c.current_balance})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div>
              <Label className="text-xs flex items-center gap-1 mb-1">
                <CreditCard className="w-3 h-3" /> Payment Method
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(['Cash', 'Utang', 'Digital'] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={paymentType === type ? 'default' : 'outline'}
                    className="text-xs"
                    onClick={() => setPaymentType(type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Cash Tendered */}
            {paymentType === 'Cash' && (
              <div>
                <Label className="text-xs mb-1">Amount Tendered</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
          </div>

          {/* Totals & Submit */}
          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Total</span>
              <span className="font-bold text-xl text-slate-900">₱{totalAmount.toFixed(2)}</span>
            </div>
            {paymentType === 'Cash' && (
              <div className="flex justify-between text-xs text-slate-500 mb-3">
                <span>Change</span>
                <span>₱{changeGiven.toFixed(2)}</span>
              </div>
            )}

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={handleCheckout}>
              Complete Transaction
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ================= SHADCN DIALOG MODALS ================= */}

      {/* 1. Add Product Dialog */}
      <Dialog open={activeModal === 'product'} onOpenChange={(open) => !open && setActiveModal('none')}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProduct} className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Product Name</Label>
              <Input required placeholder="e.g. Great Taste White" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Cost Price (₱)</Label>
                <Input type="number" step="0.01" placeholder="10.00" value={newCostPrice} onChange={(e) => setNewCostPrice(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Selling Price (₱)</Label>
                <Input type="number" step="0.01" required placeholder="12.00" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Stock Quantity</Label>
              <Input type="number" placeholder="24" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full">Save Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Add Customer Dialog */}
      <Dialog open={activeModal === 'customer'} onOpenChange={(open) => !open && setActiveModal('none')}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Register New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCustomer} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">First Name</Label>
                <Input required placeholder="Juan" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Last Name</Label>
                <Input required placeholder="Dela Cruz" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Phone Number</Label>
              <Input placeholder="09171234567" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Credit Limit (₱)</Label>
              <Input type="number" value={newCreditLimit} onChange={(e) => setNewCreditLimit(e.target.value)} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Register Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Digital Service Dialog */}
      <Dialog open={activeModal === 'digital'} onOpenChange={(open) => !open && setActiveModal('none')}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>GCash / E-Load Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddDigitalService} className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Service Type</Label>
              <Select value={serviceType} onValueChange={(val) => setServiceType(val ?? '')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GCash Cash-In">GCash Cash-In</SelectItem>
                  <SelectItem value="GCash Cash-Out">GCash Cash-Out</SelectItem>
                  <SelectItem value="E-Load">E-Load (Smart/Globe)</SelectItem>
                  <SelectItem value="Bills Payment">Bills Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Account / Phone Number</Label>
              <Input placeholder="09170000000" value={serviceAccount} onChange={(e) => setServiceAccount(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Amount (₱)</Label>
                <Input type="number" required placeholder="500.00" value={serviceAmount} onChange={(e) => setServiceAmount(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Convenience Fee (₱)</Label>
                <Input type="number" value={convenienceFee} onChange={(e) => setConvenienceFee(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Reference Number (Optional)</Label>
              <Input placeholder="Ref # 1002391" value={refNumber} onChange={(e) => setRefNumber(e.target.value)} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">Add Service to Cart</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
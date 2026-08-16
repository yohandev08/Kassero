import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Package,
  Search,
  PlusCircle,
  AlertTriangle,
  RefreshCw,
  Edit,
  Trash2,
  PackageCheck,
  TrendingUp,
  ArrowUpDown
} from 'lucide-react';

// --- shadcn/ui components ---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader,} from '@/components/ui/card';
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
  reorder_level: number;
  updated_at?: string;
}

type FilterTab = 'all' | 'low_stock' | 'out_of_stock';

export default function InventoryManager(): React.JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Active Modals Control
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isRestockOpen, setIsRestockOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);

  // Form States - Restock
  const [addStockQty, setAddStockQty] = useState<string>('');

  // Form States - Edit Product
  const [editName, setEditName] = useState<string>('');
  const [editCostPrice, setEditCostPrice] = useState<string>('');
  const [editSellingPrice, setEditSellingPrice] = useState<string>('');
  const [editReorderLevel, setEditReorderLevel] = useState<string>('');

  // Form States - Add New Product
  const [newName, setNewName] = useState<string>('');
  const [newCostPrice, setNewCostPrice] = useState<string>('');
  const [newSellingPrice, setNewSellingPrice] = useState<string>('');
  const [newStock, setNewStock] = useState<string>('');
  const [newReorderLevel, setNewReorderLevel] = useState<string>('5');
  const [newUnitType, setNewUnitType] = useState<string>('pcs');

  // 1. Fetch Products from Supabase
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('product_name', { ascending: true });

    if (error) {
      console.error('Error loading inventory:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  // 2. Restock Item Handler
  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qtyToAdd = parseInt(addStockQty, 10);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      return alert('Please enter a valid stock quantity.');
    }

    const updatedQty = selectedProduct.stock_quantity + qtyToAdd;

    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: updatedQty })
      .eq('product_id', selectedProduct.product_id);

    if (error) {
      alert('Failed to restock product: ' + error.message);
    } else {
      alert(`Successfully added ${qtyToAdd} unit(s) to ${selectedProduct.product_name}!`);
      setIsRestockOpen(false);
      setAddStockQty('');
      fetchProducts();
    }
  };

  // 3. Edit Product Handler
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const { error } = await supabase
      .from('products')
      .update({
        product_name: editName,
        cost_price: parseFloat(editCostPrice) || 0,
        selling_price: parseFloat(editSellingPrice) || 0,
        reorder_level: parseInt(editReorderLevel, 10) || 5,
      })
      .eq('product_id', selectedProduct.product_id);

    if (error) {
      alert('Failed to update product: ' + error.message);
    } else {
      alert('Product updated successfully!');
      setIsEditOpen(false);
      fetchProducts();
    }
  };

  // 4. Create Product Handler
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from('products').insert([
      {
        product_name: newName,
        cost_price: parseFloat(newCostPrice) || 0,
        selling_price: parseFloat(newSellingPrice) || 0,
        stock_quantity: parseInt(newStock, 10) || 0,
        reorder_level: parseInt(newReorderLevel, 10) || 5,
        unit_type: newUnitType,
      },
    ]);

    if (error) {
      alert('Failed to add product: ' + error.message);
    } else {
      alert('New product saved to inventory!');
      setIsAddOpen(false);
      setNewName(''); setNewCostPrice(''); setNewSellingPrice(''); setNewStock('');
      fetchProducts();
    }
  };

  // 5. Delete Product Handler
  const handleDeleteProduct = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from inventory?`)) return;

    const { error } = await supabase.from('products').delete().eq('product_id', id);

    if (error) {
      alert('Failed to delete: ' + error.message);
    } else {
      fetchProducts();
    }
  };

  // Open Edit Dialog and pre-populate values
  const openEditModal = (prod: Product) => {
    setSelectedProduct(prod);
    setEditName(prod.product_name);
    setEditCostPrice(prod.cost_price.toString());
    setEditSellingPrice(prod.selling_price.toString());
    setEditReorderLevel(prod.reorder_level.toString());
    setIsEditOpen(true);
  };

  // Open Restock Dialog
  const openRestockModal = (prod: Product) => {
    setSelectedProduct(prod);
    setAddStockQty('');
    setIsRestockOpen(true);
  };

  // Metric Computations
  const totalItems = products.length;
  const lowStockCount = products.filter((p) => p.stock_quantity <= p.reorder_level && p.stock_quantity > 0).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity === 0).length;
  const totalInventoryValue = products.reduce((sum, p) => sum + p.cost_price * p.stock_quantity, 0);

  // Filtering Logic
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'low_stock') return p.stock_quantity <= p.reorder_level && p.stock_quantity > 0;
    if (filterTab === 'out_of_stock') return p.stock_quantity === 0;
    return true;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50 p-6 gap-6">
      {/* HEADER & METRIC SUMMARY CARDS */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> Inventory & Restock Dashboard
          </h1>
          <p className="text-xs text-slate-500">Monitor stock levels, reorder alerts, and supplier deliveries</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <PlusCircle className="w-4 h-4 mr-1" /> Add New Item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Total Products</p>
              <p className="text-2xl font-bold text-slate-800">{totalItems}</p>
            </div>
            <PackageCheck className="w-8 h-8 text-slate-400" />
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-amber-600">Low Stock Warning</p>
              <p className="text-2xl font-bold text-amber-700">{lowStockCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-red-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-700">{outOfStockCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Inventory Cost Value</p>
              <p className="text-2xl font-bold text-emerald-600">₱{totalInventoryValue.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      {/* FILTER & TABLE SECTION */}
      <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex justify-between items-center">
            {/* Search Input */}
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <Button
                variant={filterTab === 'all' ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setFilterTab('all')}
              >
                All Items ({totalItems})
              </Button>
              <Button
                variant={filterTab === 'low_stock' ? 'default' : 'outline'}
                size="sm"
                className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => setFilterTab('low_stock')}
              >
                Low Stock ({lowStockCount})
              </Button>
              <Button
                variant={filterTab === 'out_of_stock' ? 'default' : 'outline'}
                size="sm"
                className="text-xs text-red-700 border-red-300 hover:bg-red-50"
                onClick={() => setFilterTab('out_of_stock')}
              >
                Out of Stock ({outOfStockCount})
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* INVENTORY TABLE */}
        <CardContent className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="text-center py-20 text-slate-400 text-xs">Loading inventory database...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-xs">No matching products found</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase sticky top-0 border-b">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Cost Price</th>
                  <th className="p-3">Selling Price</th>
                  <th className="p-3">Profit Margin</th>
                  <th className="p-3">Stock Quantity</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProducts.map((p) => {
                  const margin = p.selling_price - p.cost_price;
                  const isLow = p.stock_quantity <= p.reorder_level && p.stock_quantity > 0;
                  const isOut = p.stock_quantity === 0;

                  return (
                    <tr key={p.product_id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-semibold text-slate-800">
                        {p.product_name}
                        {p.unit_type && <span className="text-[10px] text-slate-400 ml-1">({p.unit_type})</span>}
                      </td>
                      <td className="p-3 text-slate-600">₱{p.cost_price.toFixed(2)}</td>
                      <td className="p-3 text-slate-900 font-bold">₱{p.selling_price.toFixed(2)}</td>
                      <td className="p-3 text-emerald-600 font-medium">
                        +₱{margin.toFixed(2)}
                      </td>
                      <td className="p-3 font-bold text-sm">
                        {p.stock_quantity}
                      </td>
                      <td className="p-3">
                        {isOut ? (
                          <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px]">Low Stock (Limit: {p.reorder_level})</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800">In Stock</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => openRestockModal(p)}
                        >
                          <ArrowUpDown className="w-3 h-3 mr-1" /> Restock
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => openEditModal(p)}
                        >
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteProduct(p.product_id, p.product_name)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ================= MODALS ================= */}

      {/* 1. RESTOCK MODAL */}
      <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Restock Item</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleRestock} className="space-y-3 pt-2">
              <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1">
                <p className="font-bold text-slate-800">{selectedProduct.product_name}</p>
                <p className="text-slate-500">Current Stock: <span className="font-semibold text-slate-900">{selectedProduct.stock_quantity}</span></p>
              </div>

              <div>
                <Label className="text-xs">Quantity to Add</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 24"
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  className="text-sm font-semibold"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                  Confirm Restock
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 2. EDIT PRODUCT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Product Details</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleEditProduct} className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Product Name</Label>
                <Input required value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Cost Price (₱)</Label>
                  <Input type="number" step="0.01" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Selling Price (₱)</Label>
                  <Input type="number" step="0.01" required value={editSellingPrice} onChange={(e) => setEditSellingPrice(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Reorder Level Alert Limit</Label>
                <Input type="number" value={editReorderLevel} onChange={(e) => setEditReorderLevel(e.target.value)} />
              </div>
              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 3. ADD NEW PRODUCT MODAL */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Inventory Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProduct} className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Product Name</Label>
              <Input required placeholder="e.g. San Miguel Light 330ml" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Cost Price (₱)</Label>
                <Input type="number" step="0.01" placeholder="45.00" value={newCostPrice} onChange={(e) => setNewCostPrice(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Selling Price (₱)</Label>
                <Input type="number" step="0.01" required placeholder="55.00" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Initial Stock</Label>
                <Input type="number" placeholder="24" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Reorder Level Alert</Label>
                <Input type="number" value={newReorderLevel} onChange={(e) => setNewReorderLevel(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Unit Type</Label>
              <Select value={newUnitType} onValueChange={(val) => setNewUnitType(val ?? '')}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                  <SelectItem value="pack">Pack</SelectItem>
                  <SelectItem value="sachet">Sachet</SelectItem>
                  <SelectItem value="bottle">Bottle</SelectItem>
                  <SelectItem value="can">Can</SelectItem>
                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Save Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
'use client';

import React, { useState, useEffect } from 'react';
import type { Product } from '@/types';
import {
  fetchProducts as fetchProductsService,
  addProduct as addProductService,
  updateProduct,
  archiveProducts,
  updateStockQuantity,
} from '@/services/productService';
import {
  Package,
  Search,
  PlusCircle,
  AlertTriangle,
  Edit,
  Trash2,
  X,
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
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);

  // Form States - Restock
  const [addStockQty, setAddStockQty] = useState<string>('');

  // Form States - Edit Product
  const [editName, setEditName] = useState<string>('');
  const [editCostPrice, setEditCostPrice] = useState<string>('');
  const [editSellingPrice, setEditSellingPrice] = useState<string>('');
  const [editReorderLevel, setEditReorderLevel] = useState<string>('');

  // Form States - Add New Product
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('');
  const [newCostPrice, setNewCostPrice] = useState<string>('');
  const [newSellingPrice, setNewSellingPrice] = useState<string>('');
  const [newStock, setNewStock] = useState<string>('');
  const [newReorderLevel, setNewReorderLevel] = useState<string>('5');
  const [newUnitType, setNewUnitType] = useState<string>('pcs');

  // 1. Fetch Products (via service)
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await fetchProductsService();

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

    const { error } = await updateStockQuantity(selectedProduct.product_id, updatedQty);

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

    const { error } = await updateProduct(selectedProduct.product_id, {
      product_name: editName,
      cost_price: parseFloat(editCostPrice) || 0,
      selling_price: parseFloat(editSellingPrice) || 0,
      reorder_level: parseInt(editReorderLevel, 10) || 5,
    });

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
    if (!newCategory) return alert('Please select a category.');

    const { error } = await addProductService({
      product_name: newName,
      category: newCategory,
      cost_price: parseFloat(newCostPrice) || 0,
      selling_price: parseFloat(newSellingPrice) || 0,
      stock_quantity: parseInt(newStock, 10) || 0,
      reorder_level: parseInt(newReorderLevel, 10) || 5,
      unit_type: newUnitType,
    });

    if (error) {
      alert('Failed to add product: ' + error.message);
    } else {
      alert('New product saved to inventory!');
      setIsAddOpen(false);
      setNewName(''); setNewCategory(''); setNewCostPrice(''); setNewSellingPrice(''); setNewStock('');
      fetchProducts();
    }
  };

  // 5. Archive Product Handler
  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to remove ${selectedItems.size} items from inventory?`)) return;

    const ids = Array.from(selectedItems);
    const { error } = await archiveProducts(ids);

    if (error) {
      alert('Failed to remove: ' + error.message);
    } else {
      setSelectedItems(new Set());
      setIsSelectMode(false);
      fetchProducts();
    }
  };

  // Open Edit Dialog and pre-populate values
  const openEditModal = (prod: Product) => {
    setSelectedProduct(prod);
    setEditName(prod.product_name);
    setEditCostPrice(prod.cost_price.toString());
    setEditSellingPrice(prod.selling_price.toString());
    setEditReorderLevel((prod.reorder_level ?? 5).toString());
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
  const lowStockCount = products.filter((product) => (product.stock_quantity <= (product.reorder_level ?? 5)) && product.stock_quantity > 0).length;
  const outOfStockCount = products.filter((product) => product.stock_quantity === 0).length;
  const totalInventoryValue = products.reduce((sum, product) => sum + product.cost_price * product.stock_quantity, 0);

  // Filtering Logic
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'low_stock') return (product.stock_quantity <= (product.reorder_level ?? 5)) && product.stock_quantity > 0;
    if (filterTab === 'out_of_stock') return product.stock_quantity === 0;
    return true;
  });

  const toggleSelect = (productId: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedItems.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredProducts.map(p => p.product_id)));
    }
  };

  return (
    <div className="flex flex-col lg:h-full p-0.5 bg-background gap-5 lg:overflow-hidden">
      {/* HEADER & METRIC SUMMARY CARDS */}
      <div className="flex flex-row justify-between items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary dark:text-primary shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <span className="truncate">Inventory & Restock Dashboard</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">Monitor stock levels, reorder alerts, and supplier deliveries</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="w-fit shrink-0 text-xs font-semibold bg-primary hover:bg-primary/90 text-white cursor-pointer shadow-sm shadow-primary/20">
            <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add New Item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 bg-card text-card-foreground shadow-sm rounded-xl">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{totalItems}</p>
            </div>
            <div className="p-2 rounded-xl bg-muted text-muted-foreground">
              <PackageCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5 text-card-foreground shadow-sm rounded-xl">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase text-amber-600 dark:text-amber-400">Low Stock Warning</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{lowStockCount}</p>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/5 text-card-foreground shadow-sm rounded-xl">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-400">Out of Stock</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">{outOfStockCount}</p>
            </div>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card text-card-foreground shadow-sm rounded-xl">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Inventory Cost Value</p>
              <p className="text-2xl font-bold text-primary dark:text-primary mt-0.5">₱{totalInventoryValue.toFixed(2)}</p>
            </div>
            <div className="p-2 rounded-xl bg-primary/10 text-primary dark:text-primary">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTER & TABLE SECTION */}
      <Card className="flex-1 flex flex-col overflow-hidden border-border/80 bg-card text-card-foreground shadow-md rounded-xl">
        <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex justify-between items-center">
            {/* Search Input */}
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-[16px] md:text-xs bg-background border-input min-h-[44px] md:min-h-0"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <Button
                variant={filterTab === 'all' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-semibold cursor-pointer ${
                  filterTab === 'all' 
                    ? 'bg-primary text-white hover:bg-primary shadow-xs' 
                    : 'border-input hover:bg-accent text-foreground'
                }`}
                onClick={() => setFilterTab('all')}
              >
                All Items ({totalItems})
              </Button>
              <Button
                variant={filterTab === 'low_stock' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-semibold cursor-pointer ${
                  filterTab === 'low_stock'
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'text-amber-600 border-amber-500/30 hover:bg-amber-500/10 dark:text-amber-400'
                }`}
                onClick={() => setFilterTab('low_stock')}
              >
                Low Stock ({lowStockCount})
              </Button>
              <Button
                variant={filterTab === 'out_of_stock' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-semibold cursor-pointer ${
                  filterTab === 'out_of_stock'
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'text-rose-600 border-rose-500/30 hover:bg-rose-500/10 dark:text-rose-400'
                }`}
                onClick={() => setFilterTab('out_of_stock')}
              >
                Out of Stock ({outOfStockCount})
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* INVENTORY TABLE */}
        <CardContent className="flex-1 overflow-auto p-0">
          {loading ? (
            <div className="text-center py-20 text-muted-foreground text-xs">Loading inventory database...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-xs">No matching products found</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-bold uppercase sticky top-0 border-b border-border/60 backdrop-blur-xs z-10">
                <tr>
                  {isSelectMode && (
                    <th className="p-3.5 w-10">
                      <input type="checkbox" onChange={selectAllFiltered} checked={filteredProducts.length > 0 && selectedItems.size === filteredProducts.length} className="cursor-pointer" />
                    </th>
                  )}
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">Cost Price</th>
                  <th className="p-3.5">Selling Price</th>
                  <th className="p-3.5">Profit Margin</th>
                  <th className="p-3.5">Stock Quantity</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredProducts.map((product) => {
                  const margin = product.selling_price - product.cost_price;
                  const isLow = (product.stock_quantity <= (product.reorder_level ?? 5)) && product.stock_quantity > 0;
                  const isOut = product.stock_quantity === 0;

                  return (
                    <tr key={product.product_id} className="hover:bg-muted/40 transition-colors">
                      {isSelectMode && (
                        <td className="p-3.5">
                          <input type="checkbox" checked={selectedItems.has(product.product_id)} onChange={() => toggleSelect(product.product_id)} className="cursor-pointer" />
                        </td>
                      )}
                      <td className="p-3.5 font-semibold text-foreground">
                        {product.product_name}
                        {product.unit_type && <span className="text-[10px] text-muted-foreground ml-1 font-normal">({product.unit_type})</span>}
                      </td>
                      <td className="p-3.5 text-muted-foreground">₱{product.cost_price.toFixed(2)}</td>
                      <td className="p-3.5 text-foreground font-bold">₱{product.selling_price.toFixed(2)}</td>
                      <td className="p-3.5 text-primary dark:text-primary font-semibold">
                        +₱{margin.toFixed(2)}
                      </td>
                      <td className="p-3.5 font-bold text-sm text-foreground">
                        {product.stock_quantity}
                      </td>
                      <td className="p-3.5">
                        {isOut ? (
                          <Badge variant="destructive" className="text-[10px] font-medium bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 text-[10px] font-medium">Low Stock ({product.reorder_level ?? 5})</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] font-medium bg-primary/10 text-primary dark:text-primary border border-primary/30">In Stock</Badge>
                        )}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-medium border-primary/30 text-primary dark:text-primary hover:bg-primary/10 cursor-pointer"
                          onClick={() => openRestockModal(product)}
                        >
                          <ArrowUpDown className="w-3 h-3 mr-1" /> Restock
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-medium border-input hover:bg-accent text-foreground cursor-pointer"
                          onClick={() => openEditModal(product)}
                        >
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Floating action button at bottom right */}
          <div className="sticky bottom-4 flex justify-end px-4 z-20 pointer-events-none mt-4 pb-2">
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              {isSelectMode ? (
                <div className="flex flex-col gap-3 bg-card/95 backdrop-blur-sm border border-red-500/30 rounded-xl p-3 shadow-lg min-w-[200px]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {selectedItems.size} selected
                    </span>
                    <button
                      onClick={selectAllFiltered}
                      className="text-xs text-primary hover:underline font-medium cursor-pointer"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button size="sm" variant="outline" className="text-xs cursor-pointer flex-1" onClick={() => { setIsSelectMode(false); setSelectedItems(new Set()); }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={selectedItems.size === 0}
                      className="text-xs font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm cursor-pointer disabled:opacity-50 flex-1"
                      onClick={handleDeleteSelected}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline"
                  className="text-xs font-semibold cursor-pointer shadow-lg text-red-600 border-red-500/30 hover:bg-red-500/10 dark:text-red-400 dark:border-red-400/30 bg-card"
                  onClick={() => setIsSelectMode(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================= MODALS ================= */}

      {/* 1. RESTOCK MODAL */}
      <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Restock Item</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleRestock} className="space-y-3 pt-2">
              <div className="bg-muted/40 p-3 rounded-xl border border-border text-xs space-y-1">
                <p className="font-bold text-foreground">{selectedProduct.product_name}</p>
                <p className="text-muted-foreground">Current Stock: <span className="font-semibold text-foreground">{selectedProduct.stock_quantity}</span></p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Quantity to Add</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 24"
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  className="text-[16px] md:text-sm font-semibold bg-background min-h-[44px] md:min-h-0"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary text-white font-semibold cursor-pointer">
                  Confirm Restock
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 2. EDIT PRODUCT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Edit Product Details</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleEditProduct} className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Product Name</Label>
                <Input required value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Cost Price (₱)</Label>
                  <Input type="number" step="0.01" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Selling Price (₱)</Label>
                  <Input type="number" step="0.01" required value={editSellingPrice} onChange={(e) => setEditSellingPrice(e.target.value)} className="bg-background" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Reorder Level Alert Limit</Label>
                <Input type="number" value={editReorderLevel} onChange={(e) => setEditReorderLevel(e.target.value)} className="bg-background" />
              </div>
              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-primary hover:bg-primary text-white font-semibold cursor-pointer">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 3. ADD NEW PRODUCT MODAL */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Add New Inventory Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProduct} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Product Name</Label>
              <Input required placeholder="e.g. San Miguel Light 330ml" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-background" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Category <span className="text-red-500">*</span></Label>
              <Select required value={newCategory} onValueChange={(val) => setNewCategory(val ?? '')}>
                <SelectTrigger className="text-[16px] md:text-xs bg-background min-h-[44px] md:min-h-0">
                  <SelectValue placeholder="Select Category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="cursor-pointer" value="Beverages">Beverages (Coffee, Juice, Water)</SelectItem>
                  <SelectItem className="cursor-pointer" value="Snacks">Snacks (Chips, Biscuits)</SelectItem>
                  <SelectItem className="cursor-pointer" value="Canned Goods">Canned Goods</SelectItem>
                  <SelectItem className="cursor-pointer" value="Noodles">Noodles</SelectItem>
                  <SelectItem className="cursor-pointer" value="Condiments">Condiments (Sauces, Spices)</SelectItem>
                  <SelectItem className="cursor-pointer" value="Personal Care">Personal Care (Soap, Shampoo)</SelectItem>
                  <SelectItem className="cursor-pointer" value="Household">Household (Detergent, Cleaners)</SelectItem>
                  <SelectItem className="cursor-pointer" value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Cost Price (₱)</Label>
                <Input type="number" step="0.01" placeholder="45.00" value={newCostPrice} onChange={(e) => setNewCostPrice(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Selling Price (₱)</Label>
                <Input type="number" step="0.01" required placeholder="55.00" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)} className="bg-background" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Initial Stock</Label>
                <Input type="number" placeholder="24" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Reorder Level Alert</Label>
                <Input type="number" value={newReorderLevel} onChange={(e) => setNewReorderLevel(e.target.value)} className="bg-background" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Unit Type</Label>
              <Select value={newUnitType} onValueChange={(val) => setNewUnitType(val ?? '')}>
                <SelectTrigger className="text-[16px] md:text-xs bg-background min-h-[44px] md:min-h-0">
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
              <Button type="submit" className="w-full bg-primary hover:bg-primary text-white font-semibold cursor-pointer">Save Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
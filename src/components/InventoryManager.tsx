'use client';

import React, { useState, useEffect } from 'react';
import type { Product } from '@/types';
import {
  fetchProducts as fetchProductsService,
  addProduct as addProductService,
  updateProduct,
  archiveProducts,
  updateStockQuantity,
} from '@/services/product.Service';
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
  ArrowUpDown,
  PackagePlus
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    <div className="flex flex-col lg:h-full gap-6 p-4 lg:p-6 bg-muted/30 lg:overflow-hidden">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background p-4 rounded-2xl shadow-sm border border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Inventory & Restock</h2>
            <p className="text-sm text-muted-foreground">Monitor stock levels and supplier deliveries</p>
          </div>
        </div>

        <div className="flex shrink-0 gap-3">
          <Button
            className="rounded-xl h-11 px-4 gap-2 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 cursor-pointer"
            onClick={() => setIsAddOpen(true)}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add New Item</span>
          </Button>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card className="border-border/50 bg-background shadow-sm rounded-2xl overflow-hidden group hover:border-primary/50 transition-colors">
          <CardContent className="p-3 sm:p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1 line-clamp-1">Total Products</p>
              <p className="text-xl sm:text-3xl font-black text-foreground">{totalItems}</p>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors text-muted-foreground w-fit">
              <PackageCheck className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-background shadow-sm rounded-2xl overflow-hidden group hover:border-amber-500/50 transition-colors">
          <CardContent className="p-3 sm:p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase text-amber-600 dark:text-amber-400 tracking-wider mb-1 line-clamp-1">Low Stock Warning</p>
              <p className="text-xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{lowStockCount}</p>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20 transition-colors w-fit">
              <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-background shadow-sm rounded-2xl overflow-hidden group hover:border-rose-500/50 transition-colors">
          <CardContent className="p-3 sm:p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase text-rose-600 dark:text-rose-400 tracking-wider mb-1 line-clamp-1">Out of Stock</p>
              <p className="text-xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">{outOfStockCount}</p>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20 transition-colors w-fit">
              <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-background shadow-sm rounded-2xl overflow-hidden group hover:border-primary/50 transition-colors">
          <CardContent className="p-3 sm:p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase text-primary tracking-wider mb-1 line-clamp-1">Inventory Value</p>
              <p className="text-xl sm:text-3xl font-black text-primary">₱{totalInventoryValue.toFixed(2)}</p>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors w-fit">
              <TrendingUp className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTER & TABLE SECTION */}
      <Card className="flex-1 flex flex-col overflow-hidden border-border/50 bg-background shadow-md rounded-2xl">
        <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 bg-background border-input rounded-xl focus-visible:ring-primary/40 shadow-sm"
              />
            </div>

            {/* Filter Tabs */}
            <Tabs value={filterTab} onValueChange={(val) => setFilterTab(val as FilterTab)} className="w-full lg:w-auto">
              <TabsList className="h-11 p-1 bg-muted/50 border border-border/50 rounded-xl w-full lg:w-auto">
                <TabsTrigger value="all" className="rounded-lg text-xs font-bold px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer">
                  All ({totalItems})
                </TabsTrigger>
                <TabsTrigger value="low_stock" className="rounded-lg text-xs font-bold px-4 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 data-[state=active]:shadow-sm cursor-pointer">
                  Low Stock ({lowStockCount})
                </TabsTrigger>
                <TabsTrigger value="out_of_stock" className="rounded-lg text-xs font-bold px-4 data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600 data-[state=active]:shadow-sm cursor-pointer">
                  Out of Stock ({outOfStockCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        {/* INVENTORY TABLE */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
              <Package className="w-12 h-12 mb-4 animate-pulse" />
              <p className="font-semibold text-sm">Loading inventory database...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
              <Search className="w-12 h-12 mb-4" />
              <p className="font-semibold text-sm">No matching products found</p>
              <p className="text-xs mt-1">Try adjusting your filters or search term</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
                    <TableRow className="hover:bg-transparent border-border/50">
                      {isSelectMode && (
                        <TableHead className="w-12 text-center px-4">
                          <input type="checkbox" onChange={selectAllFiltered} checked={filteredProducts.length > 0 && selectedItems.size === filteredProducts.length} className="w-4 h-4 cursor-pointer rounded border-border" />
                        </TableHead>
                      )}
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Product Name</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Cost Price</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Selling Price</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Profit Margin</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3 text-center">Stock</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Status</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const margin = product.selling_price - product.cost_price;
                      const isLow = (product.stock_quantity <= (product.reorder_level ?? 5)) && product.stock_quantity > 0;
                      const isOut = product.stock_quantity === 0;

                      return (
                        <TableRow key={product.product_id} className="hover:bg-muted/20 border-border/40 transition-colors group">
                          {isSelectMode && (
                            <TableCell className="text-center px-4 py-3">
                              <input type="checkbox" checked={selectedItems.has(product.product_id)} onChange={() => toggleSelect(product.product_id)} className="w-4 h-4 cursor-pointer rounded border-border" />
                            </TableCell>
                          )}
                          <TableCell className="font-semibold text-foreground text-sm px-4 py-3">
                            {product.product_name}
                            {product.unit_type && <span className="text-[10px] text-muted-foreground ml-2 px-1.5 py-0.5 rounded bg-muted/50 font-normal uppercase tracking-wider">{product.unit_type}</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 py-3">₱{product.cost_price.toFixed(2)}</TableCell>
                          <TableCell className="text-foreground font-bold px-4 py-3">₱{product.selling_price.toFixed(2)}</TableCell>
                          <TableCell className="font-bold text-green-600 dark:text-green-400 px-4 py-3">+₱{margin.toFixed(2)}</TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${isOut ? 'bg-rose-500/10 text-rose-600' : isLow ? 'bg-amber-500/10 text-amber-600' : 'bg-secondary text-secondary-foreground'}`}>
                              {product.stock_quantity}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {isOut ? (
                              <Badge variant="destructive" className="text-[10px] uppercase tracking-wider font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">Out of Stock</Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 text-[10px] uppercase tracking-wider font-bold">Low Stock ({product.reorder_level ?? 5})</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30">In Stock</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right px-4 py-3">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs font-semibold border-primary/30 text-primary dark:text-primary hover:bg-primary/10 cursor-pointer rounded-lg shadow-sm"
                                onClick={() => openRestockModal(product)}
                              >
                                <ArrowUpDown className="w-3 h-3 mr-1" /> Restock
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs font-semibold border-border hover:bg-accent text-foreground cursor-pointer rounded-lg shadow-sm"
                                onClick={() => openEditModal(product)}
                              >
                                <Edit className="w-3 h-3 mr-1" /> Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="grid grid-cols-1 gap-4 md:hidden p-4">
                {filteredProducts.map((product) => {
                  const margin = product.selling_price - product.cost_price;
                  const isLow = (product.stock_quantity <= (product.reorder_level ?? 5)) && product.stock_quantity > 0;
                  const isOut = product.stock_quantity === 0;

                  return (
                    <Card key={product.product_id} className={`relative overflow-hidden border-border/50 shadow-sm ${isSelectMode && selectedItems.has(product.product_id) ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-500/5' : ''}`}>
                      {isSelectMode && (
                        <div className="absolute top-4 left-4 z-10 flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            checked={selectedItems.has(product.product_id)} 
                            onChange={() => toggleSelect(product.product_id)} 
                            className="w-6 h-6 cursor-pointer rounded border-border accent-rose-500" 
                          />
                        </div>
                      )}
                      <CardContent className={`p-4 flex flex-col gap-3 ${isSelectMode ? 'pl-14' : ''}`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col">
                            <h3 className="font-bold text-foreground text-base tracking-tight leading-tight">{product.product_name}</h3>
                            {product.unit_type && <span className="text-[11px] text-muted-foreground uppercase font-semibold mt-0.5">{product.unit_type}</span>}
                          </div>
                          <div>
                            {isOut ? (
                              <Badge variant="destructive" className="text-[10px] uppercase tracking-wider font-bold bg-rose-500/15 text-rose-600 border border-rose-500/30">Out</Badge>
                            ) : isLow ? (
                              <Badge className="bg-amber-500/15 text-amber-700 border border-amber-500/30 text-[10px] uppercase tracking-wider font-bold">Low ({product.reorder_level ?? 5})</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold bg-green-500/10 text-green-600 border border-green-500/30">In Stock</Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/40">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Cost</span>
                            <span className="text-sm font-semibold">₱{product.cost_price.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col border-l border-border/40 pl-3">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Price</span>
                            <span className="text-sm font-bold text-foreground">₱{product.selling_price.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col border-l border-border/40 pl-3">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Stock</span>
                            <span className={`text-sm font-black ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-primary'}`}>
                              {product.stock_quantity}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-1">
                          <div className="text-xs font-bold text-green-600 dark:text-green-400">
                            Margin: +₱{margin.toFixed(2)}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 min-w-[44px] text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 rounded-lg cursor-pointer px-3"
                              onClick={() => openRestockModal(product)}
                            >
                              <ArrowUpDown className="w-4 h-4 md:mr-1" /> <span className="hidden sm:inline">Restock</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 min-w-[44px] text-xs font-semibold border-border hover:bg-accent text-foreground rounded-lg cursor-pointer px-3"
                              onClick={() => openEditModal(product)}
                            >
                              <Edit className="w-4 h-4 md:mr-1" /> <span className="hidden sm:inline">Edit</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* Floating action button at bottom right */}
          <div className="sticky bottom-4 flex justify-end px-4 z-20 pointer-events-none mt-4 pb-2">
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              {isSelectMode ? (
                <div className="flex flex-col gap-3 bg-card/95 backdrop-blur-md border border-rose-500/40 rounded-xl p-4 shadow-xl min-w-[220px]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">
                      {selectedItems.size} selected
                    </span>
                    <button
                      onClick={selectAllFiltered}
                      className="text-xs text-primary hover:underline font-bold cursor-pointer uppercase tracking-wider"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button size="sm" variant="outline" className="text-xs font-bold cursor-pointer flex-1 rounded-lg" onClick={() => { setIsSelectMode(false); setSelectedItems(new Set()); }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={selectedItems.size === 0}
                      className="text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-md cursor-pointer disabled:opacity-50 flex-1 rounded-lg"
                      onClick={handleDeleteSelected}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="icon" variant="outline"
                  className="w-12 h-12 rounded-full cursor-pointer shadow-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10 bg-card hover:scale-105 transition-transform"
                  onClick={() => setIsSelectMode(true)}
                  title="Remove Items"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </Card>

      {/* ================= MODALS ================= */}

      {/* 1. RESTOCK MODAL */}
      <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <div className="bg-primary/10 p-6 border-b border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                <ArrowUpDown className="w-6 h-6" />
                Restock Inventory
              </DialogTitle>
            </DialogHeader>
          </div>
          {selectedProduct && (
            <form onSubmit={handleRestock} className="p-6 space-y-5">
              <div className="bg-muted/40 p-4 rounded-xl border border-border/50 text-sm space-y-2 shadow-inner">
                <p className="font-bold text-foreground text-base">{selectedProduct.product_name}</p>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Current Stock Level</span>
                  <Badge variant="secondary" className="font-black text-sm px-3 bg-background border-border/50">{selectedProduct.stock_quantity}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantity to Add</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 24"
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  className="text-lg font-bold bg-background h-12 rounded-xl focus-visible:ring-primary/40"
                />
              </div>

              <DialogFooter className="pt-4 border-t border-border/50 mt-2">
                <Button type="button" variant="ghost" onClick={() => setIsRestockOpen(false)} className="rounded-xl font-semibold cursor-pointer">Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 shadow-md shadow-primary/20 cursor-pointer">
                  Confirm Restock
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 2. EDIT PRODUCT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <div className="bg-muted p-6 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Edit className="w-6 h-6" />
                Edit Product Details
              </DialogTitle>
            </DialogHeader>
          </div>
          {selectedProduct && (
            <form onSubmit={handleEditProduct} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Name</Label>
                <Input required value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-background h-11 rounded-xl font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost Price (₱)</Label>
                  <Input type="number" step="0.01" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} className="bg-background h-11 rounded-xl font-medium" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selling Price (₱)</Label>
                  <Input type="number" step="0.01" required value={editSellingPrice} onChange={(e) => setEditSellingPrice(e.target.value)} className="bg-background h-11 rounded-xl font-medium" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reorder Level Alert Limit</Label>
                <Input type="number" value={editReorderLevel} onChange={(e) => setEditReorderLevel(e.target.value)} className="bg-background h-11 rounded-xl font-medium" />
              </div>
              <DialogFooter className="pt-4 border-t border-border/50">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-xl font-semibold cursor-pointer">Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 shadow-md shadow-primary/20 cursor-pointer">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 3. ADD NEW PRODUCT MODAL */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <div className="bg-primary/10 p-6 border-b border-primary/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                <PackagePlus className="w-6 h-6" />
                Add New Inventory Product
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleAddProduct} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Name</Label>
              <Input required placeholder="e.g. San Miguel Light 330ml" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category <span className="text-rose-500">*</span></Label>
                <Select required value={newCategory} onValueChange={(val) => setNewCategory(val ?? '')}>
                  <SelectTrigger className="h-11 rounded-xl bg-background font-medium focus-visible:ring-primary/40 cursor-pointer">
                    <SelectValue placeholder="Select Category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem className="cursor-pointer" value="Beverages">Beverages</SelectItem>
                    <SelectItem className="cursor-pointer" value="Snacks">Snacks</SelectItem>
                    <SelectItem className="cursor-pointer" value="Canned Goods">Canned Goods</SelectItem>
                    <SelectItem className="cursor-pointer" value="Noodles">Noodles</SelectItem>
                    <SelectItem className="cursor-pointer" value="Condiments">Condiments</SelectItem>
                    <SelectItem className="cursor-pointer" value="Personal Care">Personal Care</SelectItem>
                    <SelectItem className="cursor-pointer" value="Household">Household</SelectItem>
                    <SelectItem className="cursor-pointer" value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unit Type</Label>
                <Select value={newUnitType} onValueChange={(val) => setNewUnitType(val ?? '')}>
                  <SelectTrigger className="h-11 rounded-xl bg-background font-medium focus-visible:ring-primary/40 cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem className="cursor-pointer" value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem className="cursor-pointer" value="pack">Pack</SelectItem>
                    <SelectItem className="cursor-pointer" value="sachet">Sachet</SelectItem>
                    <SelectItem className="cursor-pointer" value="bottle">Bottle</SelectItem>
                    <SelectItem className="cursor-pointer" value="can">Can</SelectItem>
                    <SelectItem className="cursor-pointer" value="kg">Kilogram (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost Price (₱)</Label>
                <Input type="number" step="0.01" placeholder="45.00" value={newCostPrice} onChange={(e) => setNewCostPrice(e.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selling Price (₱)</Label>
                <Input type="number" step="0.01" required placeholder="55.00" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Stock</Label>
                <Input type="number" placeholder="24" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reorder Level Alert</Label>
                <Input type="number" value={newReorderLevel} onChange={(e) => setNewReorderLevel(e.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl font-semibold cursor-pointer">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 shadow-md shadow-primary/20 cursor-pointer">Save Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
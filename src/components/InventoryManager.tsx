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
import { generatePurchaseOrderPDF } from '@/lib/pdfGenerator';
import { useAlert } from '@/context/AlertContext';
import {
  Package,
  Search,
  PlusCircle,
  AlertTriangle,
  Edit,
  Trash2,
  X,
  Check,
  PackageCheck,
  TrendingUp,
  ArrowUpDown,
  PackagePlus,
  Printer,
  Minus,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- shadcn/ui components ---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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

  const { showAlert, showConfirm } = useAlert();

  // Active Modals Control
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isRestockOpen, setIsRestockOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printItems, setPrintItems] = useState<{ productId: number; quantity: string; supplier?: string }[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [isProductPickerOpen, setIsProductPickerOpen] = useState<boolean>(false);

  // Form States - Restock
  const [addStockQuantity, setAddStockQuantity] = useState<string>('');

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
      const physicalProducts = (data || []).filter(product => !product.product_name.startsWith('[Digital]'));
      setProducts(physicalProducts);
    }
    setLoading(false);
  };

  // 2. Restock Item Handler
  const handleRestock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;

    const quantityToAdd = parseInt(addStockQuantity, 10);
    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
      return showAlert('Please enter a valid stock quantity.');
    }

    const updatedQuantity = selectedProduct.stock_quantity + quantityToAdd;

    const { error } = await updateStockQuantity(selectedProduct.product_id, updatedQuantity);

    if (error) {
      showAlert('Failed to restock product: ' + error.message);
    } else {
      showAlert(`Successfully added ${quantityToAdd} unit(s) to ${selectedProduct.product_name}!`);
      setIsRestockOpen(false);
      setAddStockQuantity('');
      fetchProducts();
    }
  };

  // 3. Edit Product Handler
  const handleEditProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;

    const { error } = await updateProduct(selectedProduct.product_id, {
      product_name: editName,
      cost_price: parseFloat(editCostPrice) || 0,
      selling_price: parseFloat(editSellingPrice) || 0,
      reorder_level: parseInt(editReorderLevel, 10) || 5,
    });

    if (error) {
      showAlert('Failed to update product: ' + error.message);
    } else {
      showAlert('Product updated successfully!');
      setIsEditOpen(false);
      fetchProducts();
    }
  };

  // 4. Create Product Handler
  const handleAddProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategory) return showAlert('Please select a category.');

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
      showAlert('Failed to add product: ' + error.message);
    } else {
      showAlert('New product saved to inventory!');
      setIsAddOpen(false);
      setNewName(''); setNewCategory(''); setNewCostPrice(''); setNewSellingPrice(''); setNewStock('');
      fetchProducts();
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedItems(new Set());
  };

  // 5. Archive Product Handler
  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;
    
    showConfirm(`Are you sure you want to delete ${selectedItems.size} product(s)?`, async () => {
      const ids = Array.from(selectedItems);
      const { error } = await archiveProducts(ids);

      if (error) {
        showAlert('Failed to delete products: ' + error.message);
      } else {
        exitSelectMode();
        fetchProducts();
      }
    });
  };

  // Open Edit Dialog and pre-populate values
  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setEditName(product.product_name);
    setEditCostPrice(product.cost_price.toString());
    setEditSellingPrice(product.selling_price.toString());
    setEditReorderLevel((product.reorder_level ?? 5).toString());
    setIsEditOpen(true);
  };

  // Open Restock Dialog
  const openRestockModal = (product: Product) => {
    setSelectedProduct(product);
    setAddStockQuantity('');
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
    setSelectedItems((previousSelected) => {
      const nextSelected = new Set(previousSelected);
      if (nextSelected.has(productId)) nextSelected.delete(productId);
      else nextSelected.add(productId);
      return nextSelected;
    });
  };

  const selectAllFiltered = () => {
    if (selectedItems.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredProducts.map(product => product.product_id)));
    }
  };

  const openPrintModal = () => {
    let targetProducts: Product[] = [];
    if (isSelectMode && selectedItems.size > 0) {
      targetProducts = products.filter(p => selectedItems.has(p.product_id));
    } else {
      targetProducts = products.filter(product => product.stock_quantity <= (product.reorder_level ?? 5));
    }
    
    setPrintItems(targetProducts.map(product => ({ 
      productId: product.product_id, 
      quantity: Math.max(1, (product.reorder_level ?? 5) * 2 - product.stock_quantity).toString(),
      supplier: '' 
    })));
    setProductSearchQuery('');
    setIsProductPickerOpen(false);
    setShowPrintModal(true);
  };

  const filteredCatalogProducts = products.filter(product =>
    product.product_name.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const handleAddProductToPrint = (product: Product) => {
    setPrintItems((previousItems) => {
      const existingIndex = previousItems.findIndex(item => item.productId === product.product_id);
      if (existingIndex >= 0) {
        return previousItems;
      }
      const defaultQty = product.stock_quantity <= (product.reorder_level ?? 5)
        ? Math.max(1, (product.reorder_level ?? 5) * 2 - product.stock_quantity)
        : Math.max(1, product.reorder_level ?? 5);
      return [
        ...previousItems,
        {
          productId: product.product_id,
          quantity: defaultQty.toString(),
          supplier: ''
        }
      ];
    });
  };

  const handleRemovePrintItem = (productId: number) => {
    setPrintItems(previousItems => previousItems.filter(item => item.productId !== productId));
  };

  const poGrandTotal = printItems.reduce((sum, item) => {
    const product = products.find(p => p.product_id === item.productId);
    const quantity = parseInt(item.quantity, 10) || 0;
    return sum + (product ? quantity * product.cost_price : 0);
  }, 0);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col lg:h-[calc(100dvh-5.5rem)] gap-4 lg:gap-6 lg:overflow-hidden p-1">
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
            variant="outline"
            className="rounded-xl h-11 px-4 gap-2 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
            onClick={openPrintModal}
            disabled={isSelectMode && selectedItems.size === 0}
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">
              {isSelectMode && selectedItems.size > 0 ? `Print Selected (${selectedItems.size})` : 'Print Restock List'}
            </span>
          </Button>
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
      <Card className="flex-1 flex flex-col overflow-hidden border-border/50 bg-background shadow-md rounded-2xl relative">
        <CardHeader className="pb-4 border-b border-border/50 bg-muted/10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 h-11 bg-background border-input rounded-xl focus-visible:ring-primary/40 shadow-sm"
              />
            </div>

            {/* Filter Tabs & Global Threshold */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
              <Tabs value={filterTab} onValueChange={(selectedFilterTab) => setFilterTab(selectedFilterTab as FilterTab)} className="w-full lg:w-auto">
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
              <Button 
                variant={isSelectMode ? "destructive" : "outline"} 
                onClick={() => {
                  if (isSelectMode) exitSelectMode();
                  else setIsSelectMode(true);
                }}
                className={cn(
                  "h-11 min-h-[44px] px-3.5 gap-1.5 rounded-xl font-semibold cursor-pointer text-xs sm:text-sm",
                  !isSelectMode && "border-border/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {isSelectMode ? <X className="w-4 h-4 shrink-0" /> : <Trash2 className="w-4 h-4 shrink-0" />}
                <span>{isSelectMode ? 'Cancel' : 'Remove'}</span>
              </Button>
            </div>
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
                        <TableHead className="w-12 px-3 py-3 text-center">
                          <div
                            role="checkbox"
                            aria-checked={selectedItems.size === filteredProducts.length && filteredProducts.length > 0}
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllFiltered();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                selectAllFiltered();
                              }
                            }}
                            className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer mx-auto",
                              selectedItems.size === filteredProducts.length && filteredProducts.length > 0
                                ? "bg-destructive border-destructive text-white"
                                : "border-muted-foreground/40 bg-background"
                            )}
                            title={selectedItems.size === filteredProducts.length && filteredProducts.length > 0 ? "Deselect All" : "Select All"}
                          >
                            {selectedItems.size === filteredProducts.length && filteredProducts.length > 0 && (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            )}
                          </div>
                        </TableHead>
                      )}
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Product Name</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Cost Price</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Selling Price</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Profit Margin</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3 text-center">Stock</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3">Status</TableHead>
                      {!isSelectMode && (
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground px-4 py-3 text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const margin = product.selling_price - product.cost_price;
                      const isLowStock = (product.stock_quantity <= (product.reorder_level ?? 5)) && product.stock_quantity > 0;
                      const isOutOfStock = product.stock_quantity === 0;
                      const isSelected = selectedItems.has(product.product_id);

                      return (
                        <TableRow 
                          key={product.product_id} 
                          onClick={() => { if (isSelectMode) toggleSelect(product.product_id); }}
                          className={cn(
                            "border-border/40 transition-colors group",
                            isSelectMode && "cursor-pointer select-none",
                            isSelectMode && isSelected ? "border-destructive bg-destructive/10" : "hover:bg-muted/20"
                          )}
                        >
                          {isSelectMode && (
                            <TableCell className="w-12 px-3 py-3 text-center">
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors mx-auto",
                                  isSelected
                                    ? "bg-destructive border-destructive text-white"
                                    : "border-muted-foreground/40 bg-background"
                                )}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
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
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${isOutOfStock ? 'bg-rose-500/10 text-rose-600' : isLowStock ? 'bg-amber-500/10 text-amber-600' : 'bg-secondary text-secondary-foreground'}`}>
                              {product.stock_quantity}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {isOutOfStock ? (
                              <Badge variant="destructive" className="text-[10px] uppercase tracking-wider font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">Out of Stock</Badge>
                            ) : isLowStock ? (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 text-[10px] uppercase tracking-wider font-bold">Low Stock ({product.reorder_level ?? 5})</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30">In Stock</Badge>
                            )}
                          </TableCell>
                          {!isSelectMode && (
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
                          )}
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
                  const isLowStock = (product.stock_quantity <= (product.reorder_level ?? 5)) && product.stock_quantity > 0;
                  const isOutOfStock = product.stock_quantity === 0;
                  const isSelected = selectedItems.has(product.product_id);

                  return (
                    <Card 
                      key={product.product_id} 
                      onClick={() => { if (isSelectMode) toggleSelect(product.product_id); }}
                      className={cn(
                        "relative overflow-hidden shadow-sm transition-colors",
                        isSelectMode && "cursor-pointer select-none",
                        isSelectMode && isSelected ? "border-destructive bg-destructive/10" : "border-border/50"
                      )}
                    >
                      <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {isSelectMode && (
                              <div className={cn(
                                "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                isSelected ? "bg-destructive border-destructive text-white" : "border-muted-foreground/40 bg-background"
                              )}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <h3 className="font-bold text-foreground text-base tracking-tight leading-tight truncate">{product.product_name}</h3>
                              {product.unit_type && <span className="text-[11px] text-muted-foreground uppercase font-semibold mt-0.5">{product.unit_type}</span>}
                            </div>
                          </div>
                          <div>
                            {isOutOfStock ? (
                              <Badge variant="destructive" className="text-[10px] uppercase tracking-wider font-bold bg-rose-500/15 text-rose-600 border border-rose-500/30">Out</Badge>
                            ) : isLowStock ? (
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
                            <span className={`text-sm font-black ${isOutOfStock ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-primary'}`}>
                              {product.stock_quantity}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-1">
                          <div className="text-xs font-bold text-green-600 dark:text-green-400">
                            Margin: +₱{margin.toFixed(2)}
                          </div>
                          {!isSelectMode && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 min-w-[44px] text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 rounded-lg cursor-pointer px-3"
                                onClick={(e) => { e.stopPropagation(); openRestockModal(product); }}
                              >
                                <ArrowUpDown className="w-4 h-4 md:mr-1" /> <span className="hidden sm:inline">Restock</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 min-w-[44px] text-xs font-semibold border-border hover:bg-accent text-foreground rounded-lg cursor-pointer px-3"
                                onClick={(e) => { e.stopPropagation(); openEditModal(product); }}
                              >
                                <Edit className="w-4 h-4 md:mr-1" /> <span className="hidden sm:inline">Edit</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

        </ScrollArea>

        {isSelectMode && (
          <CardFooter className="bg-muted/30 p-3 sm:p-4 border-t border-border/40 flex flex-col gap-2 shrink-0 mt-auto">
            <div className="flex justify-between items-center w-full text-xs font-semibold">
              <span className="text-muted-foreground">{selectedItems.size} product(s) selected</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={selectAllFiltered} 
                className="h-8 text-primary font-bold cursor-pointer hover:bg-primary/10"
              >
                {selectedItems.size === filteredProducts.length && filteredProducts.length > 0 ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                className="flex-1 h-11 min-h-[44px] rounded-xl font-semibold cursor-pointer" 
                onClick={exitSelectMode}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1 h-11 min-h-[44px] rounded-xl font-bold cursor-pointer" 
                disabled={selectedItems.size === 0} 
                onClick={handleDeleteSelected}
              >
                Delete {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* ================= MODALS ================= */}

      {/* 1. RESTOCK MODAL */}
      <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[400px] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
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

              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantity to Add</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const cur = parseInt(addStockQuantity, 10) || 0;
                      setAddStockQuantity(Math.max(1, cur - 1).toString());
                    }}
                    className="h-12 w-12 rounded-xl border-border/50 bg-muted/40 hover:bg-muted text-foreground p-0 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 24"
                    value={addStockQuantity}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) => setAddStockQuantity(event.target.value)}
                    className="text-lg font-bold text-center bg-background h-12 rounded-xl focus-visible:ring-primary/40 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const cur = parseInt(addStockQuantity, 10) || 0;
                      setAddStockQuantity((cur + 1).toString());
                    }}
                    className="h-12 w-12 rounded-xl border-border/50 bg-muted/40 hover:bg-muted text-foreground p-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider mr-1">Quick Add:</span>
                  {[5, 10, 25, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const cur = parseInt(addStockQuantity, 10) || 0;
                        setAddStockQuantity((cur + preset).toString());
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border/50 bg-muted/40 hover:bg-muted hover:border-primary/50 text-foreground transition-all cursor-pointer"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-border/50 mt-2">
                <Button type="button" variant="outline" onClick={() => setIsRestockOpen(false)} className="rounded-xl font-bold border-border/50 hover:bg-accent cursor-pointer">
                  Cancel
                </Button>
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
        <DialogContent showCloseButton={false} className="sm:max-w-[425px] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
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
                <Input required value={editName} onChange={(event) => setEditName(event.target.value)} className="bg-background h-11 rounded-xl font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cost Price (₱)</Label>
                  <Input type="number" step="0.01" value={editCostPrice} onFocus={(event) => event.target.select()} onChange={(event) => setEditCostPrice(event.target.value)} className="bg-background h-11 rounded-xl font-medium" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selling Price (₱)</Label>
                  <Input type="number" step="0.01" required value={editSellingPrice} onFocus={(event) => event.target.select()} onChange={(event) => setEditSellingPrice(event.target.value)} className="bg-background h-11 rounded-xl font-medium" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reorder Level Alert Limit</Label>
                <Input type="number" value={editReorderLevel} onFocus={(event) => event.target.select()} onChange={(event) => setEditReorderLevel(event.target.value)} className="bg-background h-11 rounded-xl font-medium" />
              </div>
              <DialogFooter className="pt-4 border-t border-border/50">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl font-bold border-border/50 hover:bg-accent cursor-pointer">
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 shadow-md shadow-primary/20 cursor-pointer">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 3. ADD NEW PRODUCT MODAL */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[500px] rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
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
              <Input required placeholder="e.g. San Miguel Light 330ml" value={newName} onChange={(event) => setNewName(event.target.value)} className={`bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40 ${newName.trim() && products.some(product => product.product_name.toLowerCase() === newName.trim().toLowerCase()) ? 'border-rose-500 ring-rose-500/20' : ''}`} />
              {newName.trim() && products.some(product => product.product_name.toLowerCase() === newName.trim().toLowerCase()) && (
                <p className="text-xs text-rose-500 font-semibold mt-1">Product already added.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category <span className="text-rose-500">*</span></Label>
                <Select required value={newCategory} onValueChange={(selectedCategory) => setNewCategory(selectedCategory ?? '')}>
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
                <Select value={newUnitType} onValueChange={(selectedUnitType) => setNewUnitType(selectedUnitType ?? '')}>
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
                <Input type="number" step="0.01" placeholder="45.00" value={newCostPrice} onFocus={(event) => event.target.select()} onChange={(event) => setNewCostPrice(event.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selling Price (₱)</Label>
                <Input type="number" step="0.01" required placeholder="55.00" value={newSellingPrice} onFocus={(event) => event.target.select()} onChange={(event) => setNewSellingPrice(event.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Stock</Label>
                <Input type="number" placeholder="24" value={newStock} onFocus={(event) => event.target.select()} onChange={(event) => setNewStock(event.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reorder Level Alert</Label>
                <Input type="number" value={newReorderLevel} onFocus={(event) => event.target.select()} onChange={(event) => setNewReorderLevel(event.target.value)} className="bg-background h-11 rounded-xl font-medium focus-visible:ring-primary/40" />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl font-bold border-border/50 hover:bg-accent cursor-pointer">
                Cancel
              </Button>
              <Button disabled={!!newName.trim() && products.some(product => product.product_name.toLowerCase() === newName.trim().toLowerCase())} type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                Save Product
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent showCloseButton={false} className="sm:max-w-[850px] max-h-[92vh] overflow-y-auto rounded-2xl p-0 border-border bg-card shadow-2xl printable-modal">
          <div className="p-4 sm:p-6 md:p-8 bg-background">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Purchase Order Review</h2>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">Review, add items, and adjust order quantities before downloading the PDF.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-bold text-xs px-3 py-1 bg-muted/50 border-border/60">
                  {printItems.length} {printItems.length === 1 ? 'item' : 'items'}
                </Badge>
                <Badge variant="secondary" className="font-black text-xs px-3 py-1 bg-primary/10 text-primary border-primary/20">
                  Total: ₱{poGrandTotal.toFixed(2)}
                </Badge>
              </div>
            </div>

            {/* CONTAINER: ADD PRODUCT TO REORDER */}
            <div className="bg-muted/30 border border-border/70 rounded-2xl p-4 sm:p-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <PackagePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Add Product to Reorder</h4>
                    <p className="text-xs text-muted-foreground">Pick any product from inventory to include in this purchase order (even if not low on stock)</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                  {products.length} products in inventory
                </span>
              </div>

              <div className="relative">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search product by name or click to browse..."
                      value={productSearchQuery}
                      onChange={(event) => {
                        setProductSearchQuery(event.target.value);
                        setIsProductPickerOpen(true);
                      }}
                      onFocus={() => setIsProductPickerOpen(true)}
                      className="pl-10 pr-9 h-11 bg-background rounded-xl border-border/60 text-sm focus-visible:ring-primary/40 font-medium"
                    />
                    {productSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setProductSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsProductPickerOpen(!isProductPickerOpen)}
                    className="h-11 rounded-xl px-4 font-bold border-border/60 bg-background hover:bg-muted cursor-pointer shrink-0"
                  >
                    <span>{isProductPickerOpen ? 'Hide Catalog' : 'Browse All'}</span>
                  </Button>
                </div>

                {/* Dropdown Catalog List */}
                {isProductPickerOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-popover text-popover-foreground border border-border/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
                    <div className="p-2.5 border-b border-border/50 bg-muted/40 flex items-center justify-between text-xs text-muted-foreground font-semibold px-3.5">
                      <span>{filteredCatalogProducts.length} product(s) available</span>
                      <button
                        type="button"
                        onClick={() => setIsProductPickerOpen(false)}
                        className="text-muted-foreground hover:text-foreground text-xs font-bold cursor-pointer"
                      >
                        Close ✕
                      </button>
                    </div>
                    <ScrollArea className="max-h-60 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {filteredCatalogProducts.length > 0 ? (
                          filteredCatalogProducts.map((product) => {
                            const isAlreadyInOrder = printItems.some(item => item.productId === product.product_id);
                            const isLow = product.stock_quantity <= (product.reorder_level ?? 5);

                            return (
                              <div
                                key={product.product_id}
                                onClick={() => {
                                  if (!isAlreadyInOrder) handleAddProductToPrint(product);
                                }}
                                className={`p-3 rounded-xl flex items-center justify-between gap-3 transition-all ${
                                  isAlreadyInOrder 
                                    ? 'bg-muted/40 border border-border/50 cursor-default opacity-80' 
                                    : 'hover:bg-muted/70 cursor-pointer'
                                }`}
                              >
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-foreground truncate">{product.product_name}</span>
                                    {isAlreadyInOrder && (
                                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 shrink-0">
                                        <Check className="w-3 h-3 mr-0.5" />
                                        In Order
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                    <span className="font-medium">Unit Cost: ₱{product.cost_price.toFixed(2)}</span>
                                    <span>•</span>
                                    <span>Selling: ₱{product.selling_price.toFixed(2)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs font-bold px-2 py-0.5 ${
                                      product.stock_quantity === 0
                                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                                        : isLow 
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    }`}
                                  >
                                    Stock: {product.stock_quantity}
                                  </Badge>

                                  {isAlreadyInOrder ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled
                                      className="h-8 rounded-lg text-xs font-bold gap-1 border-border/60 bg-muted/50 text-muted-foreground cursor-not-allowed"
                                    >
                                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>Added</span>
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-8 rounded-lg text-xs font-bold gap-1 cursor-pointer bg-primary hover:bg-primary/90 text-white shadow-xs"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleAddProductToPrint(product);
                                      }}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-8 text-center text-sm text-muted-foreground">
                            No matching products found for "{productSearchQuery}"
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>

            {/* REORDER ITEMS SECTION */}
            {printItems.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-border/80 rounded-2xl bg-muted/10 mb-8 flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                  <PackageCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">No Items in Purchase Order</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Currently no products are in the reorder list. Use the "Add Product to Reorder" container above to pick any product to reorder.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="border border-border/50 rounded-xl overflow-hidden mb-6 hidden md:block">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="font-bold">Product Name</TableHead>
                          <TableHead className="text-center font-bold w-[120px]">Current Stock</TableHead>
                          <TableHead className="text-center font-bold w-[150px]">Reorder Qty</TableHead>
                          <TableHead className="text-right font-bold w-[120px]">Unit Cost</TableHead>
                          <TableHead className="text-right font-bold w-[130px]">Est. Total</TableHead>
                          <TableHead className="text-center font-bold w-[60px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {printItems.map((item, index) => {
                          const product = products.find(product => product.product_id === item.productId);
                          if (!product) return null;
                          
                          const quantity = parseInt(item.quantity, 10) || 0;
                          const estimatedTotal = quantity * product.cost_price;
                          const isLow = product.stock_quantity <= (product.reorder_level ?? 5);
                          
                          return (
                            <TableRow key={item.productId}>
                              <TableCell className="font-semibold text-foreground">
                                <div>
                                  <p>{product.product_name}</p>
                                  <p className="text-[11px] text-muted-foreground">Category: {product.category || 'General'}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs font-bold px-2 py-0.5 ${
                                    product.stock_quantity === 0
                                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                                      : isLow 
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  }`}
                                >
                                  {product.stock_quantity}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="inline-flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/50">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = parseInt(item.quantity, 10) || 0;
                                      const next = Math.max(1, cur - 1);
                                      const newItems = [...printItems];
                                      newItems[index].quantity = next.toString();
                                      setPrintItems(newItems);
                                    }}
                                    className="w-7 h-7 flex items-center justify-center hover:bg-background active:bg-background rounded-md text-foreground cursor-pointer transition-colors"
                                    title="Decrease quantity"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input 
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onFocus={(event) => event.target.select()}
                                    onChange={(event) => {
                                      const newItems = [...printItems];
                                      newItems[index].quantity = event.target.value;
                                      setPrintItems(newItems);
                                    }}
                                    onBlur={() => {
                                      const val = parseInt(item.quantity, 10);
                                      if (isNaN(val) || val < 1) {
                                        const newItems = [...printItems];
                                        newItems[index].quantity = '1';
                                        setPrintItems(newItems);
                                      }
                                    }}
                                    className={`w-14 h-7 text-center text-sm font-bold bg-transparent rounded-md focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 cursor-text select-all ${parseInt(item.quantity, 10) < 1 || isNaN(parseInt(item.quantity, 10)) ? 'text-rose-500 ring-1 ring-rose-500' : 'text-foreground'}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur = parseInt(item.quantity, 10) || 0;
                                      const next = cur + 1;
                                      const newItems = [...printItems];
                                      newItems[index].quantity = next.toString();
                                      setPrintItems(newItems);
                                    }}
                                    className="w-7 h-7 flex items-center justify-center hover:bg-background active:bg-background rounded-md text-foreground cursor-pointer transition-colors"
                                    title="Increase quantity"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ₱{product.cost_price.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-bold text-foreground">
                                ₱{estimatedTotal.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePrintItem(item.productId)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer mx-auto"
                                  title="Remove from purchase order"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="grid grid-cols-1 gap-3 md:hidden mb-6">
                  {printItems.map((item, index) => {
                    const product = products.find(product => product.product_id === item.productId);
                    if (!product) return null;
                    const quantity = parseInt(item.quantity, 10) || 0;
                    const estimatedTotal = quantity * product.cost_price;
                    const isLow = product.stock_quantity <= (product.reorder_level ?? 5);

                    return (
                      <div key={item.productId} className="flex flex-col gap-2 p-4 border border-border/50 rounded-xl bg-card shadow-sm">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col min-w-0">
                            <p className="font-bold text-foreground text-sm leading-tight line-clamp-2">{product.product_name}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1 tracking-wider">
                              <span className={isLow ? "text-amber-500" : "text-emerald-500"}>
                                Stock: {product.stock_quantity}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-black text-primary">₱{estimatedTotal.toFixed(2)}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">₱{product.cost_price.toFixed(2)} / ea</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePrintItem(item.productId)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer ml-1"
                              title="Remove product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Reorder Qty:</span>
                          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1 border border-border/50">
                            <button
                              type="button"
                              onClick={() => {
                                const cur = parseInt(item.quantity, 10) || 0;
                                const next = Math.max(1, cur - 1);
                                const newItems = [...printItems];
                                newItems[index].quantity = next.toString();
                                setPrintItems(newItems);
                              }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-background active:bg-background rounded-md text-foreground cursor-pointer transition-colors"
                              title="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input 
                              type="number"
                              min="1"
                              value={item.quantity}
                              onFocus={(event) => event.target.select()}
                              onChange={(event) => {
                                const newItems = [...printItems];
                                newItems[index].quantity = event.target.value;
                                setPrintItems(newItems);
                              }}
                              onBlur={() => {
                                const val = parseInt(item.quantity, 10);
                                if (isNaN(val) || val < 1) {
                                  const newItems = [...printItems];
                                  newItems[index].quantity = '1';
                                  setPrintItems(newItems);
                                }
                              }}
                              className={`w-14 h-8 text-center text-sm font-bold bg-transparent rounded-md focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 cursor-text select-all ${parseInt(item.quantity, 10) < 1 || isNaN(parseInt(item.quantity, 10)) ? 'text-rose-500 ring-1 ring-rose-500' : 'text-foreground'}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cur = parseInt(item.quantity, 10) || 0;
                                const next = cur + 1;
                                const newItems = [...printItems];
                                newItems[index].quantity = next.toString();
                                setPrintItems(newItems);
                              }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-background active:bg-background rounded-md text-foreground cursor-pointer transition-colors"
                              title="Increase quantity"
                            >
                              <Plus className="w-8 h-8" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            {/* Modal Footer */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-4 border-t border-border/50">
              <div className="text-xs text-muted-foreground font-medium">
                {printItems.length > 0 && (
                  <span>
                    Ready to generate purchase order PDF for <strong className="text-foreground">{printItems.length}</strong> items.
                  </span>
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto rounded-xl font-bold cursor-pointer h-11 px-6 border-border/50 hover:bg-accent" onClick={() => setShowPrintModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => generatePurchaseOrderPDF(printItems, products)} 
                  disabled={printItems.length === 0 || printItems.some(item => parseInt(item.quantity, 10) < 1 || isNaN(parseInt(item.quantity, 10)))}
                  className="w-full sm:w-auto rounded-xl h-11 bg-primary hover:bg-primary/90 text-white font-bold cursor-pointer px-6 shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
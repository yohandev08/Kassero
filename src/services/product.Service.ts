import { supabase } from '@/lib/supabase';

// ============================
// Product Service
// All product-related database operations
// ============================

/** Fetch all active (non-archived) products, sorted by name */
export async function fetchProducts() {
  return supabase
    .from('products')
    .select('*')
    .eq('archived', false)
    .order('product_name', { ascending: true });
}

/** Insert a new product */
export async function addProduct(product: {
  product_name: string;
  category: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  reorder_level?: number;
  unit_type?: string;
}) {
  return supabase.from('products').insert([product]).select();
}

/** Update specific fields of a product */
export async function updateProduct(
  productId: number,
  updates: {
    product_name?: string;
    cost_price?: number;
    selling_price?: number;
    reorder_level?: number;
  }
) { 
  return supabase
    .from('products')
    .update(updates)
    .eq('product_id', productId);
}

/** Soft-delete: archive one or more products by ID */
export async function archiveProducts(productIds: number[]) {
  return supabase
    .from('products')
    .update({ archived: true })
    .in('product_id', productIds);
}

/** Update the stock quantity of a product (restock or deduction) */
export async function updateStockQuantity(productId: number, newQuantity: number) {
  return supabase
    .from('products')
    .update({ stock_quantity: newQuantity })
    .eq('product_id', productId);
}

/** Insert a digital service as a pseudo-product and return the row */
export async function addDigitalService(service: {
  product_name: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
}) {
  return supabase
    .from('products')
    .insert([service])
    .select()
    .single();
}

import { supabase } from '@/lib/supabase';

// ============================
// Sales Service
// All sales-related database operations
// ============================

/** Fetch all sales with joined sale_items and product details */
export async function fetchSalesWithItems() {
  return supabase
    .from('sales')
    .select(`
      sale_id,
      total_amount,
      payment_type,
      created_at,
      sale_items (
        quantity,
        unit_price,
        subtotal,
        products ( product_name, cost_price )
      )
    `)
    .order('created_at', { ascending: false });
}

/** Insert a new sale record */
export async function createSale(sale: {
  customer_id: number | null;
  total_amount: number;
  payment_type: string;
  amount_tendered: number;
  change_given: number;
}) {
  return supabase.from('sales').insert([sale]).select().single();
}

/** Insert sale line items */
export async function insertSaleItems(items: {
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}[]) {
  return supabase.from('sale_items').insert(items);
}

import { supabase } from '@/lib/supabase';

// ============================
// Sales Service
// All sales-related database operations
// ============================

export interface SalesSummaryData {
  total_revenue: number;
  total_profit: number;
  cash_sales: number;
  utang_sales: number;
  digital_sales: number;
  total_transactions: number;
}

/** Fetch high-level sales and profit aggregates computed directly in Postgres */
export async function fetchSalesSummary(options?: {
  startDate?: string;
  endDate?: string;
}) {
  return supabase.rpc('get_sales_summary', {
    p_start_date: options?.startDate || null,
    p_end_date: options?.endDate || null,
  });
}

/** Fetch sales with joined sale_items, product details, and digital services with time range filters */
export async function fetchSalesWithItems(options?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const { startDate, endDate, limit } = options || {};
  let query = supabase
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
      ),
      digital_services (
        service_id,
        sale_id,
        service_type,
        account_number_phone,
        transaction_amount,
        convenience_fee,
        reference_number,
        created_at
      )
    `)
    .order('created_at', { ascending: false });

  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }
  if (limit) {
    query = query.limit(limit);
  }

  return query;
}

export interface CheckoutItemPayload {
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface CheckoutDigitalServicePayload {
  service_type: string;
  account_number_phone: string | null;
  transaction_amount: number;
  convenience_fee: number;
  reference_number: string | null;
}

export interface CheckoutPayload {
  customer_id: number | null;
  total_amount: number;
  payment_type: string;
  amount_tendered: number;
  change_given: number;
  items: CheckoutItemPayload[];
  digital_services?: CheckoutDigitalServicePayload[];
}

/** Complete checkout transaction atomically via Postgres RPC */
export async function completeCheckout(payload: CheckoutPayload) {
  return supabase.rpc('complete_checkout', {
    p_customer_id: payload.customer_id,
    p_total_amount: payload.total_amount,
    p_payment_type: payload.payment_type,
    p_amount_tendered: payload.amount_tendered,
    p_change_given: payload.change_given,
    p_items: payload.items,
    p_digital_services: payload.digital_services || [],
  });
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


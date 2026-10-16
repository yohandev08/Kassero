import { supabase } from '@/lib/supabase';

// ============================
// Customer Service
// All customer-related database operations
// ============================

/** Fetch all active (non-archived) customers, with configurable sort order */
export async function fetchCustomers(options?: {
  orderBy?: string;
  ascending?: boolean;
  includeArchived?: boolean;
}) {
  const { orderBy = 'first_name', ascending = true, includeArchived = false } = options || {};
  let query = supabase
    .from('customers')
    .select('*')
    .order(orderBy, { ascending });

  if (!includeArchived) {
    query = query.eq('archived', false);
  }

  return query;
}

/** Insert a new customer */
export async function addCustomer(customer: {
  first_name: string;
  last_name: string;
  phone_number: string;
  credit_limit: number;
  current_balance: number;
  is_allowed_utang: boolean;
}) {
  return supabase.from('customers').insert([customer]).select();
}

/** Atomically adjust customer balance in Postgres (+delta increases debt, -delta decreases debt) */
export async function adjustCustomerBalance(customerId: number, delta: number) {
  return supabase.rpc('adjust_customer_balance', {
    p_customer_id: customerId,
    p_amount_delta: delta,
  });
}

/** Update a customer's current balance */
export async function updateCustomerBalance(customerId: number, newBalance: number) {
  return supabase
    .from('customers')
    .update({ current_balance: newBalance })
    .eq('customer_id', customerId);
}

/** Soft-delete: archive one or more customers by ID (rejects if debt > 0) */
export async function archiveCustomers(customerIds: number[]) {
  return supabase.rpc('archive_customers', {
    p_customer_ids: customerIds,
  });
}

/** Backward-compatible alias for soft-deleting customers */
export async function deleteCustomers(customerIds: number[]) {
  return archiveCustomers(customerIds);
}

import { supabase } from '@/lib/supabase';

// ============================
// Customer Service
// All customer-related database operations
// ============================

/** Fetch all customers, with configurable sort order */
export async function fetchCustomers(options?: {
  orderBy?: string;
  ascending?: boolean;
}) {
  const { orderBy = 'first_name', ascending = true } = options || {};
  return supabase
    .from('customers')
    .select('*')
    .order(orderBy, { ascending });
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

/** Update a customer's current balance */
export async function updateCustomerBalance(customerId: number, newBalance: number) {
  return supabase
    .from('customers')
    .update({ current_balance: newBalance })
    .eq('customer_id', customerId);
}

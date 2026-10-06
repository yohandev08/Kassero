import { supabase } from '@/lib/supabase';

// ============================
// Payment Service
// All utang / payment database operations
// ============================

/** Fetch utang history for a customer with joined sale + item details */
export async function fetchUtangHistory(customerId: number) {
  return supabase
    .from('utang_transactions')
    .select(`
      utang_id,
      sale_id,
      amount,
      status,
      created_at,
      sales (
        created_at,
        sale_items (
          quantity,
          unit_price,
          subtotal,
          products ( product_name )
        )
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
}

/** Insert a payment record */
export async function recordPayment(payment: {
  customer_id: number;
  amount_paid: number;
  notes: string;
}) {
  return supabase.from('payments').insert([payment]);
}

/** Fetch payment history for a customer */
export async function fetchPayments(customerId: number) {
  return supabase
    .from('payments')
    .select('payment_id, amount_paid, notes, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
}

/** Mark all unpaid utang transactions as paid for a customer */
export async function markUtangAsPaid(customerId: number) {
  return supabase
    .from('utang_transactions')
    .update({ status: 'Paid' })
    .eq('customer_id', customerId)
    .eq('status', 'Unpaid');
}

/** Insert a new utang transaction record */
export async function recordUtangTransaction(utang: {
  customer_id: number;
  sale_id: number;
  amount: number;
  status: string;
}) {
  return supabase.from('utang_transactions').insert([utang]);
}

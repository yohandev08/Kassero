// ============================
// Shared Type Definitions
// ============================

/** Product row from the `products` table */
export interface Product {
  product_id: number;
  product_name: string;
  category?: string;
  unit_type?: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  reorder_level?: number;
  updated_at?: string;
  archived?: boolean;
}

/** Customer row from the `customers` table */
export interface Customer {
  customer_id: number;
  first_name: string;
  last_name: string;
  phone_number?: string;
  credit_limit: number;
  current_balance: number;
  is_allowed_utang: boolean;
}

/** Cart item used by POS (product + quantity tracking) */
export interface CartItem extends Product {
  quantity: number;
  subtotal: number;
}

/** Sale item joined with product info (for analytics) */
export interface SaleItemWithProduct {
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    product_name: string;
    cost_price: number;
  } | null;
}

/** Sale item joined with product name only (for ledger) */
export interface LedgerSaleItem {
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    product_name: string;
  } | null;
}

/** Sale row with joined sale_items */
export interface Sale {
  sale_id: number;
  total_amount: number;
  payment_type: 'Cash' | 'Utang' | 'Digital';
  created_at: string;
  sale_items: SaleItemWithProduct[];
}

/** Utang transaction with joined sale + items */
export interface UtangTransaction {
  utang_id: number;
  sale_id: number;
  amount: number;
  status: string;
  created_at: string;
  sales: {
    created_at: string;
    sale_items: LedgerSaleItem[];
  } | null;
}

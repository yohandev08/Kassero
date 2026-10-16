// ============================
// Shared Type Definitions
// ============================

export type UserRole = 'cashier' | 'admin' | 'superadmin';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

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
  archived?: boolean;
}

export interface DigitalServiceItem {
  service_type: string;
  account_number_phone?: string;
  transaction_amount: number;
  convenience_fee: number;
  reference_number?: string;
}

export interface DigitalServiceRecord {
  service_id: number;
  sale_id: number;
  service_type: string;
  account_number_phone?: string;
  transaction_amount: number;
  convenience_fee: number;
  reference_number?: string;
  created_at?: string;
}

/** Cart item used by POS (product + quantity tracking) */
export interface CartItem extends Product {
  quantity: number;
  subtotal: number;
  is_digital?: boolean;
  digital_service?: DigitalServiceItem;
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

/** Sale row with joined sale_items and digital_services */
export interface Sale {
  sale_id: number;
  total_amount: number;
  payment_type: 'Cash' | 'Utang' | 'Digital';
  created_at: string;
  sale_items: SaleItemWithProduct[];
  digital_services?: DigitalServiceRecord[];
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
    digital_services?: DigitalServiceRecord[];
  } | null;
}


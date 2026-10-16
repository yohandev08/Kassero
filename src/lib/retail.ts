/**
 * Retail and financial business logic for Kassero POS
 * Handles currency math, cart totals, change (sukli) calculations, and credit limit checks.
 */

export interface CartItemLike {
  quantity: number;
  subtotal: number;
}

export interface CustomerCreditProfile {
  credit_limit: number;
  current_balance: number;
  is_allowed_utang?: boolean;
}

export interface ChangeCalculationResult {
  isValid: boolean;
  tendered: number;
  change: number;
  shortfall: number;
}

export interface CreditValidationResult {
  isAllowed: boolean;
  willExceed: boolean;
  newBalance: number;
  exceededBy: number;
  remainingCredit: number;
  errorMessage?: string;
}

/**
 * Calculates total sale amount and total item count from cart items.
 * Rounds to 2 decimal places to avoid floating-point math issues.
 */
export function calculateCartTotals(cart: CartItemLike[]): {
  totalAmount: number;
  totalItemCount: number;
} {
  let amount = 0;
  let count = 0;

  for (let i = 0; i < cart.length; i++) {
    amount += cart[i].subtotal || 0;
    count += cart[i].quantity || 0;
  }

  return {
    totalAmount: Math.round(amount * 100) / 100,
    totalItemCount: count,
  };
}

/**
 * Calculates change (sukli) for cash payments.
 * Ensures tendered amount is valid and meets or exceeds total sale amount.
 */
export function calculateChange(
  amountTendered: number | string,
  totalAmount: number
): ChangeCalculationResult {
  const tendered = typeof amountTendered === 'string' ? parseFloat(amountTendered) : amountTendered;
  const safeTotal = Math.max(0, Math.round(totalAmount * 100) / 100);

  if (isNaN(tendered) || tendered <= 0) {
    return {
      isValid: false,
      tendered: 0,
      change: 0,
      shortfall: safeTotal,
    };
  }

  const roundedTendered = Math.round(tendered * 100) / 100;

  if (roundedTendered < safeTotal) {
    return {
      isValid: false,
      tendered: roundedTendered,
      change: 0,
      shortfall: Math.round((safeTotal - roundedTendered) * 100) / 100,
    };
  }

  return {
    isValid: true,
    tendered: roundedTendered,
    change: Math.round((roundedTendered - safeTotal) * 100) / 100,
    shortfall: 0,
  };
}

/**
 * Validates whether a customer can purchase on utang (credit) given their
 * credit limit, current balance, and credit allowance flag.
 */
export function validateCreditLimit(
  customer: CustomerCreditProfile,
  additionalDebt: number
): CreditValidationResult {
  const isAllowedUtang = customer.is_allowed_utang !== false;
  const currentBalance = customer.current_balance || 0;
  const creditLimit = customer.credit_limit || 0;
  const safeAdditional = Math.max(0, additionalDebt || 0);

  const newBalance = Math.round((currentBalance + safeAdditional) * 100) / 100;
  const willExceed = newBalance > creditLimit;
  const exceededBy = willExceed ? Math.round((newBalance - creditLimit) * 100) / 100 : 0;
  const remainingCredit = Math.max(0, Math.round((creditLimit - newBalance) * 100) / 100);

  let errorMessage: string | undefined;
  if (!isAllowedUtang) {
    errorMessage = 'Customer is flagged as not allowed for credit.';
  } else if (willExceed) {
    errorMessage = `Sale will exceed credit limit by ₱${exceededBy.toFixed(2)}`;
  }

  return {
    isAllowed: isAllowedUtang && !willExceed,
    willExceed,
    newBalance,
    exceededBy,
    remainingCredit,
    errorMessage,
  };
}

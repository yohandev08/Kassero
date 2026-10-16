import { describe, it, expect } from 'vitest';
import {
  calculateCartTotals,
  calculateChange,
  validateCreditLimit,
} from './retail';

describe('Retail & Financial Logic', () => {
  describe('Cart Totals', () => {
    it('calculates total amount and item count correctly for multiple items', () => {
      const cart = [
        { quantity: 2, subtotal: 50 },
        { quantity: 3, subtotal: 75.5 },
        { quantity: 1, subtotal: 24.5 },
      ];

      const result = calculateCartTotals(cart);
      expect(result.totalItemCount).toBe(6);
      expect(result.totalAmount).toBe(150);
    });

    it('handles empty cart gracefully', () => {
      const result = calculateCartTotals([]);
      expect(result.totalItemCount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('prevents floating-point rounding errors on decimal currency values', () => {
      const cart = [
        { quantity: 1, subtotal: 19.99 },
        { quantity: 1, subtotal: 10.01 },
        { quantity: 1, subtotal: 5.55 },
      ];

      const result = calculateCartTotals(cart);
      expect(result.totalAmount).toBe(35.55);
      expect(result.totalItemCount).toBe(3);
    });
  });

  describe('Change Calculation (Sukli)', () => {
    it('calculates correct change when cash tendered exceeds total amount', () => {
      const result = calculateChange(500, 345.5);
      expect(result.isValid).toBe(true);
      expect(result.change).toBe(154.5);
      expect(result.shortfall).toBe(0);
    });

    it('returns zero change when exact cash amount is tendered', () => {
      const result = calculateChange('120.00', 120);
      expect(result.isValid).toBe(true);
      expect(result.change).toBe(0);
      expect(result.shortfall).toBe(0);
    });

    it('detects insufficient cash and reports shortfall', () => {
      const result = calculateChange(100, 150.75);
      expect(result.isValid).toBe(false);
      expect(result.change).toBe(0);
      expect(result.shortfall).toBe(50.75);
    });

    it('rejects invalid or negative cash tender input', () => {
      expect(calculateChange('', 100).isValid).toBe(false);
      expect(calculateChange('abc', 100).isValid).toBe(false);
      expect(calculateChange(-50, 100).isValid).toBe(false);
    });
  });

  describe('Credit Limit Validation (Utang)', () => {
    it('approves sale when new total debt remains within credit limit', () => {
      const customer = {
        credit_limit: 1000,
        current_balance: 300,
        is_allowed_utang: true,
      };

      const result = validateCreditLimit(customer, 200);
      expect(result.isAllowed).toBe(true);
      expect(result.willExceed).toBe(false);
      expect(result.newBalance).toBe(500);
      expect(result.remainingCredit).toBe(500);
      expect(result.exceededBy).toBe(0);
      expect(result.errorMessage).toBeUndefined();
    });

    it('approves sale when new debt exactly hits credit limit', () => {
      const customer = {
        credit_limit: 500,
        current_balance: 350,
        is_allowed_utang: true,
      };

      const result = validateCreditLimit(customer, 150);
      expect(result.isAllowed).toBe(true);
      expect(result.willExceed).toBe(false);
      expect(result.newBalance).toBe(500);
      expect(result.remainingCredit).toBe(0);
      expect(result.exceededBy).toBe(0);
    });

    it('flags warning when sale exceeds credit limit and calculates excess amount', () => {
      const customer = {
        credit_limit: 500,
        current_balance: 400,
        is_allowed_utang: true,
      };

      const result = validateCreditLimit(customer, 250);
      expect(result.isAllowed).toBe(false);
      expect(result.willExceed).toBe(true);
      expect(result.newBalance).toBe(650);
      expect(result.exceededBy).toBe(150);
      expect(result.remainingCredit).toBe(0);
      expect(result.errorMessage).toContain('150.00');
    });

    it('blocks utang transaction if customer is flagged as not allowed for credit', () => {
      const customer = {
        credit_limit: 2000,
        current_balance: 0,
        is_allowed_utang: false,
      };

      const result = validateCreditLimit(customer, 100);
      expect(result.isAllowed).toBe(false);
      expect(result.errorMessage).toBe('Customer is flagged as not allowed for credit.');
    });
  });
});

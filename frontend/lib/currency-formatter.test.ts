import {
  formatCurrency,
  formatCurrencyWithSign,
  formatMultiCurrency,
  setCurrenciesCache,
} from './currency-formatter';
import type { Currency } from '@/hooks/use-currencies';

describe('currency-formatter', () => {
  beforeEach(() => {
    // Clear the cache before each test
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('formatCurrency', () => {
    it('should format USD with dollar sign by default', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
    });

    it('should format HKD with HK$ sign', () => {
      expect(formatCurrency(1234.56, 'HKD')).toBe('HK$1,234.56');
    });

    it('should format CNY with ¥ sign', () => {
      expect(formatCurrency(1234.56, 'CNY')).toBe('¥1,234.56');
    });

    it('should format EUR with € sign', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56');
    });

    it('should format GBP with £ sign', () => {
      expect(formatCurrency(1234.56, 'GBP')).toBe('£1,234.56');
    });

    it('should format JPY with ¥ sign (default 2 decimals in fallback)', () => {
      expect(formatCurrency(1234.56, 'JPY')).toBe('¥1,234.56');
    });

    it('should use currency code for unknown currencies', () => {
      expect(formatCurrency(1234.56, 'XYZ')).toBe('XYZ1,234.56');
    });

    it('should show currency code when showCode is true', () => {
      expect(formatCurrency(1234.56, 'USD', { showCode: true })).toBe('1,234.56 USD');
    });

    it('should override decimals when specified', () => {
      expect(formatCurrency(1234.567, 'USD', { decimals: 3 })).toBe('$1,234.567');
    });

    it('should handle negative amounts (formatCurrency does not add sign)', () => {
      expect(formatCurrency(-1234.56, 'USD')).toBe('$-1,234.56');
    });

    it('should return "-" for undefined amount', () => {
      expect(formatCurrency(undefined as unknown as number, 'USD')).toBe('-');
    });

    it('should return "-" for null amount', () => {
      expect(formatCurrency(null as unknown as number, 'USD')).toBe('-');
    });

    it('should return "-" for NaN amount', () => {
      expect(formatCurrency(NaN, 'USD')).toBe('-');
    });

    it('should handle zero amount', () => {
      expect(formatCurrency(0, 'USD')).toBe('$0.00');
    });

    it('should handle small amounts with proper decimals', () => {
      expect(formatCurrency(0.01, 'USD')).toBe('$0.01');
      expect(formatCurrency(0.001, 'USD')).toBe('$0.00');
    });

    it('should use custom cache when available', () => {
      const customCurrencies: Currency[] = [
        { code: 'TEST', symbol: 'T$', decimal_places: 4, name: 'Test Currency', is_active: true },
      ];
      setCurrenciesCache(customCurrencies);

      expect(formatCurrency(1234.5678, 'TEST')).toBe('T$1,234.5678');
    });

    it('should use cached decimal_places from backend', () => {
      const customCurrencies: Currency[] = [
        { code: 'BTC', symbol: '₿', decimal_places: 8, name: 'Bitcoin', is_active: true },
      ];
      setCurrenciesCache(customCurrencies);

      expect(formatCurrency(1.123456789, 'BTC')).toBe('₿1.12345679');
    });
  });

  describe('formatCurrencyWithSign', () => {
    it('should format positive amounts without sign', () => {
      expect(formatCurrencyWithSign(1234.56, 'USD')).toBe('$1,234.56');
    });

    it('should format negative amounts with minus sign', () => {
      expect(formatCurrencyWithSign(-1234.56, 'USD')).toBe('-$1,234.56');
    });

    it('should format negative amounts with parentheses when useParentheses is true', () => {
      expect(formatCurrencyWithSign(-1234.56, 'USD', { useParentheses: true })).toBe('($1,234.56)');
    });

    it('should format positive amounts with parentheses option without adding parens', () => {
      expect(formatCurrencyWithSign(1234.56, 'USD', { useParentheses: true })).toBe('$1,234.56');
    });

    it('should return "-" for undefined amount', () => {
      expect(formatCurrencyWithSign(undefined as unknown as number, 'USD')).toBe('-');
    });

    it('should override decimals when specified', () => {
      expect(formatCurrencyWithSign(-1234.567, 'USD', { decimals: 2 })).toBe('-$1,234.57');
    });
  });

  describe('formatMultiCurrency', () => {
    it('should format multiple currencies', () => {
      const amounts = {
        USD: 1000,
        HKD: 5000,
        CNY: 300,
      };
      expect(formatMultiCurrency(amounts)).toEqual(['$1,000.00', 'HK$5,000.00', '¥300.00']);
    });

    it('should return empty array for empty object', () => {
      expect(formatMultiCurrency({})).toEqual([]);
    });

    it('should return empty array for null', () => {
      expect(formatMultiCurrency(null)).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(formatMultiCurrency(undefined)).toEqual([]);
    });

    it('should filter out zero amounts', () => {
      const amounts = {
        USD: 1000,
        HKD: 0,
        CNY: 300,
      };
      expect(formatMultiCurrency(amounts)).toEqual(['$1,000.00', '¥300.00']);
    });

    it('should filter out very small amounts (less than 0.001)', () => {
      const amounts = {
        USD: 1000,
        HKD: 0.0005,
        CNY: 300,
      };
      expect(formatMultiCurrency(amounts)).toEqual(['$1,000.00', '¥300.00']);
    });

    it('should show currency code when showCode is true', () => {
      const amounts = {
        USD: 1000,
        HKD: 5000,
      };
      expect(formatMultiCurrency(amounts, { showCode: true })).toEqual(['1,000.00 USD', '5,000.00 HKD']);
    });
  });
});

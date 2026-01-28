import { RateProvider } from '../interfaces/rate-provider.interface';

/**
 * Manual Rate Provider (内置)
 * 
 * 手动输入的汇率，优先级最低，用于 fallback
 */
export class ManualRateProvider implements RateProvider {
  readonly id = 'manual';
  readonly name = 'Manual Rate';
  readonly supportedCurrencies: string[] = [];  // 不限制
  readonly supportsHistorical = true;
  readonly priority = 999;  // 最低优先级
  readonly isEnabled = true;  // 手动 Provider 总是启用

  // 存储手动汇率
  private rates: Map<string, Map<string, { rate: number; date: Date }>> = new Map();

  /**
   * 设置手动汇率
   */
  setRate(from: string, to: string, rate: number, date: Date = new Date()): void {
    const key = from.toUpperCase();
    
    if (!this.rates.has(key)) {
      this.rates.set(key, new Map());
    }
    
    this.rates.get(key)!.set(to.toUpperCase(), { rate, date });
  }

  /**
   * 获取手动汇率
   */
  getRate(from: string, to: string): { rate: number; date: Date } | null {
    const key = from.toUpperCase();
    const toKey = to.toUpperCase();
    
    const currencyRates = this.rates.get(key);
    if (currencyRates) {
      return currencyRates.get(toKey) || null;
    }
    
    return null;
  }

  /**
   * 获取所有手动汇率
   */
  getAllRates(): Map<string, Map<string, { rate: number; date: Date }>> {
    return this.rates;
  }

  /**
   * 批量获取 (接口实现)
   */
  async fetchRates(
    baseCurrency: string,
    targetCurrencies: string[],
    _options?: { date?: Date }
  ): Promise<Map<string, number>> {
    const rates = new Map<string, number>();
    const baseKey = baseCurrency.toUpperCase();
    
    const currencyRates = this.rates.get(baseKey);
    if (!currencyRates) {
      return rates;
    }

    for (const currency of targetCurrencies) {
      const rate = currencyRates.get(currency.toUpperCase());
      if (rate) {
        rates.set(currency, rate.rate);
      }
    }
    
    return rates;
  }

  /**
   * 删除手动汇率
   */
  deleteRate(from: string, to: string): boolean {
    const key = from.toUpperCase();
    const toKey = to.toUpperCase();
    
    const currencyRates = this.rates.get(key);
    if (currencyRates) {
      return currencyRates.delete(toKey);
    }
    
    return false;
  }

  /**
   * 清空所有手动汇率
   */
  clear(): void {
    this.rates.clear();
  }
}

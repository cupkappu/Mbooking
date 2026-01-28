import { RateProvider, ProviderConfig } from '../interfaces/rate-provider.interface';
import { ProviderType } from '../provider.entity';

/**
 * REST API Rate Provider 实现
 * 
 * 支持配置:
 * - baseUrl: API 基础 URL
 * - apiKey: API 密钥 (可选)
 * - timeout: 请求超时 (默认 10s)
 * - headers: 自定义请求头
 */
export class RestRateProvider implements RateProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedCurrencies: string[];
  readonly supportsHistorical: boolean;
  readonly priority: number;
  readonly isEnabled: boolean;

  constructor(
    private config: ProviderConfig,
    private providerType: ProviderType = ProviderType.REST_API
  ) {
    this.id = providerType === ProviderType.REST_API 
      ? `rest:${config.name.toLowerCase().replace(/\s+/g, '-')}` 
      : `rest:${config.name}`;
    this.name = config.name;
    this.supportedCurrencies = config.supportedCurrencies || [];
    this.supportsHistorical = true;  // REST API 通常支持历史
    this.priority = config.priority ?? 1;
    this.isEnabled = true;
  }

  async fetchRates(
    baseCurrency: string,
    targetCurrencies: string[],
    options?: { date?: Date }
  ): Promise<Map<string, number>> {
    const timeout = (this.config.timeout ?? 10000);
    const baseUrl = this.config.baseUrl;
    
    if (!baseUrl) {
      throw new Error('REST Provider baseUrl not configured');
    }

    // 过滤有效的目标货币
    const validTargets = targetCurrencies.filter(c => 
      this.supportedCurrencies.includes(c)
    );
    
    if (validTargets.length === 0) {
      return new Map();
    }

    // 构建 API URL
    const dateStr = options?.date
      ? options.date.toISOString().split('T')[0]
      : 'latest';
    
    const symbols = validTargets.join(',');
    const url = `${baseUrl}/${dateStr}?base=${baseCurrency}&symbols=${symbols}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(this.config.headers || {}),
      };
      
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.rates) {
        throw new Error('Invalid response: missing rates');
      }

      // 转换为 Map
      const rates = new Map<string, number>();
      for (const currency of validTargets) {
        const rate = data.rates?.[currency];
        if (rate !== undefined) {
          rates.set(currency, Number(rate));
        }
      }
      
      return rates;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      const rates = await this.fetchRates('USD', ['EUR'], {});
      if (rates.has('EUR')) {
        return { success: true, message: 'Connection successful' };
      }
      return { success: false, message: 'No rate data returned' };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

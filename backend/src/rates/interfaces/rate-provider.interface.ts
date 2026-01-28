/**
 * Rate Provider Interface
 * 
 * 简化后的 Provider 接口设计:
 * - 最少方法: 只需要实现 fetchRates
 * - 可选方法: fetchHistoricalRate, testConnection
 * - 批量优先: 设计为批量获取，减少 API 调用
 */
export interface RateProvider {
  /** Provider 唯一标识 */
  readonly id: string;
  
  /** Provider 显示名称 */
  readonly name: string;
  
  /** 支持的货币列表 */
  readonly supportedCurrencies: string[];
  
  /** 是否支持历史汇率查询 */
  readonly supportsHistorical: boolean;
  
  /** Provider 优先级 (数字越小优先级越高) */
  readonly priority: number;

  /** 是否启用 */
  readonly isEnabled: boolean;

  /**
   * 获取汇率 (批量)
   * 
   * @param baseCurrency 基础货币 (如 "USD")
   * @param targetCurrencies 目标货币列表 (如 ["EUR", "GBP", "JPY"])
   * @param date 日期 (可选，默认最新)
   * @returns Map<货币对, 汇率> (如 "EUR" -> 0.92)
   */
  fetchRates(
    baseCurrency: string,
    targetCurrencies: string[],
    options?: { date?: Date }
  ): Promise<Map<string, number>>;

  /**
   * 获取历史汇率 (可选方法)
   */
  fetchHistoricalRate?(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<number>;

  /**
   * 测试连接 (可选方法)
   */
  testConnection?(): Promise<{ success: boolean; message?: string }>;
}

/**
 * Provider 配置类型
 */
export type ProviderType = 'rest_api' | 'js_plugin' | 'manual';

/**
 * Provider 配置接口
 */
export interface ProviderConfig {
  type: ProviderType;
  name: string;
  supportedCurrencies: string[];
  priority?: number;
  // REST API 配置
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  headers?: Record<string, string>;
  // JS Plugin 配置
  pluginPath?: string;
  // 其他配置
  [key: string]: any;
}

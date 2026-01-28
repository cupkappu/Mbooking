import * as path from 'path';
import * as fs from 'fs';
import { RateProvider, ProviderConfig } from '../interfaces/rate-provider.interface';

/**
 * JS Plugin Rate Provider 实现
 * 
 * 动态加载 JS 插件，支持:
 * - fetchRates: 批量获取汇率
 * - fetchHistoricalRate: 历史汇率 (可选)
 * - testConnection: 连接测试 (可选)
 */
export class JsPluginProvider implements RateProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedCurrencies: string[];
  readonly supportsHistorical: boolean;
  readonly priority: number;
  readonly isEnabled: boolean;

  private pluginModule: any;
  private pluginInstance: any;

  constructor(
    private config: ProviderConfig,
    private basePath: string = process.cwd()
  ) {
    this.id = `js:${config.name.toLowerCase().replace(/\s+/g, '-')}`;
    this.name = config.name;
    this.supportedCurrencies = config.supportedCurrencies || [];
    this.supportsHistorical = false;  // 默认不支持，插件可覆盖
    this.priority = config.priority ?? 2;
    this.isEnabled = true;
    
    this.loadPlugin();
  }

  private loadPlugin(): void {
    const pluginPath = this.config.pluginPath;
    
    if (!pluginPath) {
      throw new Error('JS Plugin path not configured');
    }

    // 解析绝对路径
    const absolutePath = path.isAbsolute(pluginPath)
      ? pluginPath
      : path.resolve(this.basePath, pluginPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Plugin file not found: ${absolutePath}`);
    }

    // 动态加载模块
    try {
      // 清除缓存以支持热重载
      delete require.cache[require.resolve(absolutePath)];
      
      const module = require(absolutePath);
      this.pluginModule = module;
      
      // 获取工厂函数
      const factory = module.default || module;
      
      if (typeof factory !== 'function') {
        throw new Error('Plugin must export a factory function');
      }

      // 创建插件实例，传入配置
      this.pluginInstance = factory(this.config);

      if (!this.pluginInstance) {
        throw new Error('Plugin factory returned invalid instance');
      }

      // 更新元数据 (通过插件实例)
      // 注意: 这里不再修改 readonly 属性，而是从插件实例读取

    } catch (error) {
      throw new Error(`Failed to load plugin: ${error}`);
    }
  }

  async fetchRates(
    baseCurrency: string,
    targetCurrencies: string[],
    options?: { date?: Date }
  ): Promise<Map<string, number>> {
    if (!this.pluginInstance?.fetchRates) {
      return new Map();
    }

    try {
      // 过滤有效的目标货币
      const validTargets = targetCurrencies.filter(c => 
        this.supportedCurrencies.includes(c)
      );
      
      if (validTargets.length === 0) {
        return new Map();
      }

      const result = await this.pluginInstance.fetchRates(
        validTargets,
        baseCurrency,
        options
      );

      // 转换格式: { "USD/EUR": 0.92 } -> Map { "EUR" => 0.92 }
      if (!result || typeof result !== 'object') {
        return new Map();
      }

      const rates = new Map<string, number>();
      for (const [key, value] of Object.entries(result)) {
        // 解析 key 格式: "BASE/TARGET" 或直接是 TARGET
        let targetCurrency = key;
        
        if (key.includes('/')) {
          const [, currency] = key.split('/');
          targetCurrency = currency;
        }
        
        if (validTargets.includes(targetCurrency)) {
          const rateNum = Number(value);
          if (!isNaN(rateNum)) {
            rates.set(targetCurrency, rateNum);
          }
        }
      }
      
      return rates;

    } catch (error) {
      throw new Error(`Plugin fetchRates failed: ${error}`);
    }
  }

  async fetchHistoricalRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<number> {
    if (!this.pluginInstance?.fetchHistoricalRate) {
      throw new Error('Plugin does not support historical rates');
    }

    const rate = await this.pluginInstance.fetchHistoricalRate(
      fromCurrency,
      toCurrency,
      date
    );

    return Number(rate);
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    if (this.pluginInstance?.testConnection) {
      try {
        return await this.pluginInstance.testConnection();
      } catch (error) {
        return { 
          success: false, 
          message: error instanceof Error ? error.message : 'Test failed' 
        };
      }
    }

    // 简化的连接测试
    try {
      const rates = await this.fetchRates('USD', ['EUR'], {});
      return { 
        success: rates.has('EUR'), 
        message: rates.has('EUR') ? 'OK' : 'No data' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 重新加载插件 (用于热更新)
   */
  reload(): void {
    this.loadPlugin();
  }

  /**
   * 获取插件健康状态
   */
  getHealthStatus(): { status: 'healthy' | 'degraded'; lastCheck: Date } {
    if (this.pluginInstance?.getHealthStatus) {
      return this.pluginInstance.getHealthStatus();
    }
    return { status: 'healthy', lastCheck: new Date() };
  }
}

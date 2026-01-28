import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateProvider, ProviderConfig } from '../interfaces/rate-provider.interface';
import { RestRateProvider } from '../providers/rate-rest.provider';
import { JsPluginProvider } from '../providers/rate-js.plugin';
import { ManualRateProvider } from '../providers/rate-manual.provider';
import { RateCacheService } from './rate-cache.service';
import { RateStorageService } from './rate-storage.service';
import { RateGraphEngine, PathResult } from './rate-graph.engine';
import { RateMonitorService } from './rate-monitor.service';
import { Provider, ProviderType } from '../provider.entity';

/**
 * Fetch Options
 */
export interface FetchOptions {
  from: string;
  to: string;
  date?: Date;
  providerId?: string;   // 指定 provider，不指定则按优先级尝试
  useCache?: boolean;    // 是否使用缓存 (默认 true)
}

/**
 * Fetch Result
 */
export interface FetchResult {
  from: string;
  to: string;
  rate: number;
  providerId: string;
  timestamp: Date;
  isInferred: boolean;
  path?: string[];
  hops?: number;
}

/**
 * Rate Fetch Service
 * 
 * 协调流程:
 * 1. 检查缓存 (2h TTL)
 * 2. 缓存未命中 → 调用 Providers
 * 3. 存储到数据库
 * 4. 更新缓存
 * 5. 构建图 + 路径查找
 * 6. 写入历史记录
 * 7. 更新监控指标
 */
@Injectable()
export class RateFetchService implements OnModuleInit {
  private readonly logger = new Logger(RateFetchService.name);

  // Providers 列表
  private providers: RateProvider[] = [];
  
  // Manual Provider (单例)
  private manualProvider: ManualRateProvider;

  constructor(
    private cacheService: RateCacheService,
    private storageService: RateStorageService,
    private graphEngine: RateGraphEngine,
    private monitorService: RateMonitorService,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
  ) {
    this.manualProvider = new ManualRateProvider();
  }

  async onModuleInit(): Promise<void> {
    // 从数据库加载 Providers
    await this.loadProviders();
    
    this.logger.log(`Loaded ${this.providers.length} rate providers`);
  }

  /**
   * 加载 Providers
   */
  private async loadProviders(): Promise<void> {
    const dbProviders = await this.storageService.getEnabledProviders();

    for (const dbProvider of dbProviders) {
      // 跳过数据库中的 manual provider，使用单例
      if (dbProvider.type === ProviderType.MANUAL) {
        continue;
      }

      try {
        const provider = this.createProvider(dbProvider);
        if (provider) {
          this.providers.push(provider);
        }
      } catch (error) {
        this.logger.warn(`Failed to load provider ${dbProvider.name}: ${error}`);
      }
    }

    // 添加 Manual Provider (最低优先级，单例)
    this.providers.push(this.manualProvider);

    // 按优先级排序
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 创建 Provider 实例
   */
  private createProvider(dbProvider: Provider): RateProvider | null {
    const config: ProviderConfig = {
      type: dbProvider.type as ProviderType,
      name: dbProvider.name,
      supportedCurrencies: dbProvider.supported_currencies || [],
      priority: dbProvider.priority,
      baseUrl: dbProvider.config?.base_url,
      apiKey: dbProvider.config?.api_key,
      timeout: dbProvider.config?.timeout ?? 10000,
      headers: dbProvider.config?.headers,
      pluginPath: dbProvider.config?.plugin_path,
    };

    switch (dbProvider.type) {
      case ProviderType.REST_API:
        return new RestRateProvider(config, dbProvider.type);
      case ProviderType.JS_PLUGIN:
        return new JsPluginProvider(config);
      case ProviderType.MANUAL:
        return this.manualProvider;
      default:
        this.logger.warn(`Unknown provider type: ${dbProvider.type}`);
        return null;
    }
  }

  /**
   * 获取汇率
   */
  async getRate(options: FetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    
    const { from, to, date = new Date(), providerId, useCache = true } = options;

    // 1. 同货币检查
    if (from.toUpperCase() === to.toUpperCase()) {
      return {
        from,
        to,
        rate: 1,
        providerId: 'identity',
        timestamp: new Date(),
        isInferred: false,
      };
    }

    // 2. 检查缓存
    let cacheHit = false;
    if (useCache) {
      const cached = await this.cacheService.get(from, to, date);
      if (cached) {
        cacheHit = true;
        
        this.monitorService.recordQuery({
          cacheHit: true,
          latencyMs: Date.now() - startTime,
          providerCalled: false,
          providerFailed: false,
          inferred: false,
        });

        return {
          from,
          to,
          rate: cached.rate,
          providerId: cached.providerId,
          timestamp: cached.fetchedAt,
          isInferred: false,
        };
      }
    }

    // 3. 缓存未命中 → 调用 Providers
    let rates: Map<string, number>;
    let usedProviderId: string;
    
    try {
      const result = await this.fetchFromProviders(from, to, date, providerId);
      rates = result.rates;
      usedProviderId = result.providerId;
    } catch (error) {
      this.monitorService.recordQuery({
        cacheHit: false,
        latencyMs: Date.now() - startTime,
        providerCalled: true,
        providerFailed: true,
        inferred: false,
      });
      
      throw error;
    }

    // 4. 存储到数据库
    await this.storageService.saveRates(from, date, rates, usedProviderId);

    // 5. 更新缓存
    await this.cacheService.setBatch(from, date, rates, usedProviderId);

    // 6. 构建图 + 路径查找
    const graph = this.graphEngine.buildGraph(rates, from, usedProviderId);
    const pathResult = this.graphEngine.findBestPath(graph, from, to, { maxHops: 5 });

    let finalRate: number;
    let isInferred = false;
    let path: string[] | undefined;
    let hops: number | undefined;

    if (pathResult) {
      finalRate = pathResult.totalRate;
      isInferred = pathResult.hops > 1;
      path = pathResult.path;
      hops = pathResult.hops;
    } else {
      finalRate = rates.get(to.toUpperCase()) || 1;
    }

    // 7. 写入历史记录
    await this.storageService.writeHistory(
      from,
      to,
      finalRate,
      date,
      usedProviderId,
      isInferred,
      hops,
      path
    );

    // 8. 更新监控指标
    this.monitorService.recordQuery({
      cacheHit: false,
      latencyMs: Date.now() - startTime,
      providerCalled: true,
      providerFailed: false,
      inferred: isInferred,
    });

    return {
      from,
      to,
      rate: finalRate,
      providerId: usedProviderId,
      timestamp: new Date(),
      isInferred,
      path,
      hops,
    };
  }

  /**
   * 货币转换
   */
  async convert(
    amount: number,
    from: string,
    to: string,
    date?: Date
  ): Promise<{
    amount: number;
    converted_amount: number;
    rate: number;
    from: string;
    to: string;
    date: Date;
    path?: string[];
    hops?: number;
  }> {
    const result = await this.getRate({ from, to, date });

    return {
      amount,
      converted_amount: amount * result.rate,
      rate: result.rate,
      from,
      to,
      date: result.timestamp,
      path: result.path,
      hops: result.hops,
    };
  }

  /**
   * 批量获取汇率
   */
  async getRatesBatch(
    conversions: Array<{ from: string; to: string; date?: Date }>
  ): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    // 按日期分组
    const byDate = new Map<string, Array<{ from: string; to: string }>>();

    for (const conv of conversions) {
      const dateStr = (conv.date || new Date()).toISOString().split('T')[0];
      
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, []);
      }
      byDate.get(dateStr)!.push({ from: conv.from, to: conv.to });
    }

    // 按日期处理
    for (const [dateStr, pairs] of byDate) {
      const date = new Date(dateStr);

      // 先检查缓存
      const cacheResults = await this.cacheService.getBatch(
        pairs.map(p => ({ from: p.from.toUpperCase(), to: p.to.toUpperCase(), date }))
      );

      // 缓存未命中的需要查询
      const uncached = pairs.filter(p => {
        const key = `${p.from.toUpperCase()}:${p.to.toUpperCase()}`;
        return !cacheResults.has(key);
      });

      if (uncached.length > 0) {
        // 获取基础货币的所有汇率
        const baseCurrencies = new Set(uncached.map(p => p.from.toUpperCase()));

        for (const base of baseCurrencies) {
          const targets = uncached
            .filter(p => p.from.toUpperCase() === base)
            .map(p => p.to.toUpperCase());

          try {
            const result = await this.fetchFromProviders(base, targets.join(','), date, undefined);
            
            // 存储和缓存
            await this.storageService.saveRates(base, date, result.rates, result.providerId);
            await this.cacheService.setBatch(base, date, result.rates, result.providerId);

            // 构建图
            const graph = this.graphEngine.buildGraph(result.rates, base, result.providerId);

            // 查询每个目标
            for (const target of targets) {
              if (base === target) {
                results.set(`${base}:${target}:${dateStr}`, 1);
                continue;
              }

              const pathResult = this.graphEngine.findBestPath(graph, base, target, { maxHops: 5 });
              const rate = pathResult?.totalRate || result.rates.get(target) || 1;
              
              results.set(`${base}:${target}:${dateStr}`, rate);
            }
          } catch (error) {
            this.logger.warn(`Failed to fetch rates for ${base}: ${error}`);
          }
        }
      }

      // 添加缓存命中的结果 (key 统一使用大写)
      for (const [key, entry] of cacheResults) {
        results.set(`${key}:${dateStr}`, entry.rate);
      }
    }

    return results;
  }

  /**
   * 获取可用路径
   */
  async getAvailablePaths(
    from: string,
    to: string,
    date?: Date
  ): Promise<PathResult[]> {
    const d = date || new Date();

    // 获取所有相关汇率
    const rates = await this.fetchAllRates(from, d);
    
    // 构建图
    const graph = this.graphEngine.buildGraph(rates, from, 'graph');

    // 查找所有路径
    return this.graphEngine.findAllPaths(graph, from, to, { maxPaths: 10, maxHops: 5 });
  }

  /**
   * 从 Providers 获取汇率
   */
  private async fetchFromProviders(
    from: string,
    to: string,
    date: Date,
    providerId?: string
  ): Promise<{ rates: Map<string, number>; providerId: string }> {
    const fromUpper = from.toUpperCase();
    const targets = to.toUpperCase().split(',').map(t => t.trim()).filter(t => t);

    if (targets.length === 0) {
      throw new Error('No valid target currencies');
    }

    // 选择 Providers
    const providersToTry = providerId
      ? this.providers.filter(p => p.id === providerId)
      : this.getEnabledProviders();

    for (const provider of providersToTry) {
      try {
        const startTime = Date.now();
        const rates = await provider.fetchRates(fromUpper, targets, { date });
        
        const duration = Date.now() - startTime;
        this.logger.debug(`Provider ${provider.name} returned ${rates.size} rates in ${duration}ms`);

        if (rates.size > 0) {
          return { rates, providerId: provider.id };
        }
      } catch (error) {
        this.logger.warn(`Provider ${provider.name} failed: ${error}`);
      }
    }

    throw new Error('All providers failed to fetch rate');
  }

  /**
   * 获取启用的 Providers (排除禁用的)
   */
  private getEnabledProviders(): RateProvider[] {
    return this.providers.filter(p => p.isEnabled || p.id === 'manual');
  }

  /**
   * 获取所有 Providers 的汇率
   */
  private async fetchAllRates(
    baseCurrency: string,
    date: Date
  ): Promise<Map<string, number>> {
    const baseUpper = baseCurrency.toUpperCase();
    const allRates = new Map<string, number>();
    const seenPairs = new Set<string>();

    for (const provider of this.getEnabledProviders()) {
      try {
        // 获取 Provider 支持的货币
        const targets = provider.supportedCurrencies.filter(
          c => c !== baseUpper
        );

        if (targets.length === 0) continue;

        const rates = await provider.fetchRates(baseUpper, targets, { date });

        for (const [currency, rate] of rates) {
          const pairKey = `${baseUpper}:${currency.toUpperCase()}`;
          
          // 避免重复
          if (!seenPairs.has(pairKey)) {
            allRates.set(currency.toUpperCase(), rate);
            seenPairs.add(pairKey);
          }
        }
      } catch (error) {
        this.logger.warn(`Provider ${provider.name} failed: ${error}`);
      }
    }

    return allRates;
  }

  /**
   * 设置手动汇率
   */
  setManualRate(from: string, to: string, rate: number, date?: Date): void {
    this.manualProvider.setRate(from, to, rate, date);
  }
}

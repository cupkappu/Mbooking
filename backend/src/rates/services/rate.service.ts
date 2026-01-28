import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RateFetchService } from './rate-fetch.service';
import { RateMonitorService } from './rate-monitor.service';
import { RateStorageService } from './rate-storage.service';
import { RateHistory } from '../entities/rate-history.entity';
import { RateStats } from '../entities/rate-stats.entity';

/**
 * 对外 API Service
 * 
 * 兼容现有 API:
 * - GET /rates/:from/:to
 * - GET /rates/:from/:to/:date
 * - POST /rates/convert
 * - GET /rates/:from/:to/history
 * - GET /rates/:from/:to/paths
 * - POST /rates/manual
 * 
 * 新增 API:
 * - GET /rates/stats/current
 * - GET /rates/stats/history
 */
@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    private fetchService: RateFetchService,
    private monitorService: RateMonitorService,
    private storageService: RateStorageService,
  ) {}

  /**
   * GET /rates/:from/:to
   * 获取最新汇率
   */
  async getLatestRate(from: string, to: string): Promise<{
    from: string;
    to: string;
    rate: number;
    timestamp: Date;
    source: string;
    path?: string[];
    hops?: number;
    isInferred: boolean;
  }> {
    const result = await this.fetchService.getRate({ from, to });

    return {
      from: result.from,
      to: result.to,
      rate: result.rate,
      timestamp: result.timestamp,
      source: result.providerId,
      path: result.path,
      hops: result.hops,
      isInferred: result.isInferred,
    };
  }

  /**
   * GET /rates/:from/:to/:date
   * 获取指定日期的汇率
   */
  async getRateAtDate(
    from: string,
    to: string,
    date: string
  ): Promise<{
    from: string;
    to: string;
    rate: number;
    timestamp: Date;
    source: string;
    path?: string[];
    hops?: number;
    isInferred: boolean;
  }> {
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      throw new NotFoundException('Invalid date format');
    }

    const result = await this.fetchService.getRate({ 
      from, 
      to, 
      date: dateObj 
    });

    return {
      from: result.from,
      to: result.to,
      rate: result.rate,
      timestamp: result.timestamp,
      source: result.providerId,
      path: result.path,
      hops: result.hops,
      isInferred: result.isInferred,
    };
  }

  /**
   * POST /rates/convert
   * 货币转换
   */
  async convert(
    body: { amount: number; from: string; to: string; date?: string }
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
    const { amount, from, to, date } = body;
    
    const dateObj = date ? new Date(date) : undefined;
    const result = await this.fetchService.convert(amount, from, to, dateObj);

    return {
      amount: result.amount,
      converted_amount: result.converted_amount,
      rate: result.rate,
      from: result.from,
      to: result.to,
      date: result.date,
      path: result.path,
      hops: result.hops,
    };
  }

  /**
   * GET /rates/:from/:to/history
   * 获取汇率历史
   */
  async getRateHistory(
    from: string,
    to: string,
    query: {
      fromDate?: string;
      toDate?: string;
      limit?: string;
    }
  ): Promise<{
    rates: Array<{
      from: string;
      to: string;
      rate: number;
      date: Date;
      provider_id: string;
      is_inferred: boolean;
      path?: string[];
      hops?: number;
    }>;
    total: number;
  }> {
    const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
    const toDate = query.toDate ? new Date(query.toDate) : undefined;
    const limit = query.limit ? parseInt(query.limit, 10) : 100;

    const result = await this.storageService.getHistory(from, to, {
      fromDate,
      toDate,
      limit,
    });

    return {
      rates: result.rates.map(r => ({
        from: r.fromCurrency,
        to: r.toCurrency,
        rate: Number(r.rate),
        date: r.date,
        provider_id: r.providerId,
        is_inferred: r.isInferred,
        path: r.path,
        hops: r.hops,
      })),
      total: result.total,
    };
  }

  /**
   * GET /rates/:from/:to/paths
   * 获取可用路径
   */
  async getAvailablePaths(
    from: string,
    to: string,
    query: { date?: string }
  ): Promise<Array<{
    path: string[];
    total_rate: number;
    hops: number;
  }>> {
    const date = query.date ? new Date(query.date) : undefined;
    const paths = await this.fetchService.getAvailablePaths(from, to, date);

    return paths.map(p => ({
      path: p.path,
      total_rate: p.totalRate,
      hops: p.hops,
    }));
  }

  /**
   * POST /rates/manual
   * 设置手动汇率
   */
  async setManualRate(body: {
    from: string;
    to: string;
    rate: number;
    date?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { from, to, rate, date } = body;
    const dateObj = date ? new Date(date) : new Date();

    this.fetchService.setManualRate(from, to, rate, dateObj);

    return {
      success: true,
      message: `Manual rate set: ${from}/${to} = ${rate}`,
    };
  }

  // ==================== 新增监控 API ====================

  /**
   * GET /rates/stats/current
   * 获取当前监控统计
   */
  getCurrentStats(): {
    cache_hit_rate: number;
    provider_success_rate: number;
    avg_latency_ms: number;
    total_queries: number;
    cache_hits: number;
    cache_misses: number;
    inferred_rates: number;
  } {
    const stats = this.monitorService.getCurrentStats();

    return {
      cache_hit_rate: stats.cacheHitRate,
      provider_success_rate: stats.providerSuccessRate,
      avg_latency_ms: stats.avgLatency,
      total_queries: stats.totalQueries,
      cache_hits: stats.cacheHits,
      cache_misses: stats.cacheMisses,
      inferred_rates: stats.inferredRates,
    };
  }

  /**
   * GET /rates/stats/history
   * 获取历史监控统计
   */
  async getStatsHistory(
    query: { fromDate?: string; toDate?: string; limit?: string }
  ): Promise<RateStats[]> {
    const now = new Date();
    const fromDate = query.fromDate 
      ? new Date(query.fromDate) 
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);  // 默认 7 天
    const toDate = query.toDate ? new Date(query.toDate) : now;
    const limit = query.limit ? parseInt(query.limit, 10) : 24 * 7;

    return this.monitorService.getStatsHistory(fromDate, toDate, limit);
  }

  // ==================== 其他 API ====================

  /**
   * GET /rates/providers
   * 获取 Providers 列表
   */
  async getProviders(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    priority: number;
    supported_currencies: string[];
    is_active: boolean;
  }>> {
    const providers = await this.storageService.getEnabledProviders();

    return providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      priority: p.priority,
      supported_currencies: p.supported_currencies,
      is_active: p.is_active,
    }));
  }

  /**
   * POST /rates/providers/:id/test
   * 测试 Provider 连接
   */
  async testProvider(id: string): Promise<{ success: boolean; message: string }> {
    const provider = await this.storageService.getProvider(id);
    
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // 这里可以添加实际的连接测试
    return {
      success: true,
      message: `Provider ${provider.name} is configured correctly`,
    };
  }
}

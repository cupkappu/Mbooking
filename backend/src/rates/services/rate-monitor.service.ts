import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateStats } from '../entities/rate-stats.entity';

/**
 * 实时统计快照
 */
interface StatsSnapshot {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  providerCalls: number;
  providerFailures: number;
  inferredRates: number;
  latencySum: number;
}

/**
 * Rate Monitor Service
 * 
 * 监控指标:
 * - cacheHitRate: 缓存命中率
 * - providerSuccessRate: Provider 成功率
 * - avgLatency: 平均查询延迟
 * - totalQueries: 总查询数
 * 
 * 统计周期:
 * - 实时统计: 内存中，按小时聚合
 * - 历史统计: 持久化到数据库 (保留 30 天)
 */
@Injectable()
export class RateMonitorService implements OnModuleInit {
  private readonly logger = new Logger(RateMonitorService.name);
  
  // 内存中的实时统计 (按小时聚合)
  private currentHour: StatsSnapshot = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    providerCalls: 0,
    providerFailures: 0,
    inferredRates: 0,
    latencySum: 0,
  };

  // 上次持久化的时间戳
  private lastFlushAt: Date = new Date(0);

  constructor(
    @InjectRepository(RateStats)
    private statsRepository: Repository<RateStats>,
  ) {}

  async onModuleInit(): Promise<void> {
    // 每分钟检查是否需要持久化
    this.startFlushTimer();
  }

  /**
   * 记录查询
   */
  recordQuery(options: {
    cacheHit: boolean;
    latencyMs: number;
    providerCalled: boolean;
    providerFailed: boolean;
    inferred: boolean;
  }): void {
    const { cacheHit, latencyMs, providerCalled, providerFailed, inferred } = options;

    this.currentHour.totalQueries++;
    this.currentHour.latencySum += latencyMs;

    if (cacheHit) {
      this.currentHour.cacheHits++;
    } else {
      this.currentHour.cacheMisses++;
    }

    if (providerCalled) {
      this.currentHour.providerCalls++;
    }

    if (providerFailed) {
      this.currentHour.providerFailures++;
    }

    if (inferred) {
      this.currentHour.inferredRates++;
    }
  }

  /**
   * 获取当前统计
   */
  getCurrentStats(): {
    cacheHitRate: number;
    providerSuccessRate: number;
    avgLatency: number;
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    inferredRates: number;
  } {
    const { 
      totalQueries, 
      cacheHits, 
      cacheMisses, 
      providerCalls, 
      providerFailures, 
      inferredRates,
      latencySum 
    } = this.currentHour;

    const cacheHitRate = totalQueries > 0 
      ? (cacheHits / totalQueries * 100) 
      : 0;

    const providerSuccessRate = providerCalls > 0 
      ? ((providerCalls - providerFailures) / providerCalls * 100) 
      : 100;

    const avgLatency = totalQueries > 0 
      ? (latencySum / totalQueries) 
      : 0;

    return {
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      providerSuccessRate: Math.round(providerSuccessRate * 100) / 100,
      avgLatency: Math.round(avgLatency * 100) / 100,
      totalQueries,
      cacheHits,
      cacheMisses,
      inferredRates,
    };
  }

  /**
   * 获取历史统计
   */
  async getStatsHistory(
    fromDate: Date,
    toDate: Date,
    limit: number = 24 * 7
  ): Promise<RateStats[]> {
    return this.statsRepository
      .createQueryBuilder('stats')
      .where('stats.date >= :fromDate', { fromDate })
      .andWhere('stats.date <= :toDate', { toDate })
      .orderBy('stats.date', 'DESC')
      .addOrderBy('stats.hour', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * 持久化统计到数据库
   */
  async flushStats(): Promise<void> {
    const now = new Date();
    
    // 检查是否在同一小时内 (不重复写入)
    if (this.lastFlushAt.getTime() > now.getTime() - 60 * 60 * 1000) {
      return;
    }

    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hour = now.getHours();

    const { 
      cacheHits, 
      cacheMisses, 
      providerCalls, 
      providerFailures, 
      inferredRates,
      latencySum,
      totalQueries 
    } = this.currentHour;

    const cacheHitRate = totalQueries > 0 
      ? (cacheHits / totalQueries * 100) 
      : 0;

    const avgLatencyMs = totalQueries > 0 
      ? (latencySum / totalQueries) 
      : 0;

    const stats = this.statsRepository.create({
      date,
      hour,
      totalQueries,
      cacheHits,
      cacheMisses,
      cacheHitRate,
      providerCalls,
      providerFailures,
      avgLatencyMs,
      inferredRates,
    });

    await this.statsRepository.save(stats);

    this.lastFlushAt = now;
    this.logger.log(`Rate stats flushed: ${totalQueries} queries, ${cacheHitRate.toFixed(1)}% cache hit`);

    // 重置当前小时统计
    this.currentHour = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      providerCalls: 0,
      providerFailures: 0,
      inferredRates: 0,
      latencySum: 0,
    };
  }

  /**
   * 获取 Provider 统计
   */
  async getProviderStats(): Promise<{
    providerId: string;
    name: string;
    calls: number;
    failures: number;
    successRate: number;
  }[]> {
    // 这里可以扩展，从数据库聚合 Provider 级别的统计
    // 目前返回实时统计
    return [];
  }

  /**
   * 启动定时器
   */
  private startFlushTimer(): void {
    // 每分钟检查是否需要持久化
    setInterval(async () => {
      await this.flushStats();
    }, 60 * 1000);
  }

  /**
   * 可能需要恢复统计 (如果服务重启)
   */
  private async maybeRecoverStats(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 检查数据库中是否有当前小时的记录
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const existing = await this.statsRepository.findOne({
      where: { date, hour: currentHour },
    });

    if (existing) {
      this.lastFlushAt = now;
      this.logger.log('Recovered stats from database');
    }
  }
}

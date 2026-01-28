import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from '../exchange-rate.entity';
import { Provider } from '../provider.entity';
import { RateHistory } from '../entities/rate-history.entity';
import { RateStats } from '../entities/rate-stats.entity';

/**
 * Rate Storage Service
 * 
 * 负责汇率数据的持久化:
 * - exchange_rates: 缓存数据 (可过期删除)
 * - rate_history: 历史记录 (永久保留)
 * - rate_stats: 监控统计 (保留 30 天)
 */
@Injectable()
export class RateStorageService {
  private readonly logger = new Logger(RateStorageService.name);

  constructor(
    @InjectRepository(ExchangeRate)
    private rateRepository: Repository<ExchangeRate>,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    @InjectRepository(RateHistory)
    private historyRepository: Repository<RateHistory>,
    @InjectRepository(RateStats)
    private statsRepository: Repository<RateStats>,
  ) {}

  // ==================== 汇率存储 ====================

  /**
   * 保存汇率到 exchange_rates
   */
  async saveRate(
    from: string,
    to: string,
    rate: number,
    date: Date,
    providerId: string
  ): Promise<ExchangeRate> {
    const dateStr = date.toISOString().split('T')[0];

    // 查找是否已存在
    const existing = await this.rateRepository.findOne({
      where: {
        from_currency: from.toUpperCase(),
        to_currency: to.toUpperCase(),
        date: new Date(dateStr),
      },
    });

    if (existing) {
      // 更新
      existing.rate = rate;
      existing.fetched_at = new Date();
      existing.provider_id = providerId;
      return this.rateRepository.save(existing);
    }

    // 新建
    const newRate = this.rateRepository.create({
      provider_id: providerId,
      from_currency: from.toUpperCase(),
      to_currency: to.toUpperCase(),
      rate,
      date: new Date(dateStr),
      fetched_at: new Date(),
    });

    return this.rateRepository.save(newRate);
  }

  /**
   * 批量保存汇率
   */
  async saveRates(
    from: string,
    date: Date,
    rates: Map<string, number>,
    providerId: string
  ): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    const dateObj = new Date(dateStr);

    for (const [to, rate] of rates) {
      await this.saveRate(from, to, rate, dateObj, providerId);
    }
  }

  /**
   * 获取缓存的汇率
   */
  async getCachedRate(
    from: string,
    to: string,
    date: Date
  ): Promise<ExchangeRate | null> {
    const dateStr = date.toISOString().split('T')[0];

    return this.rateRepository
      .createQueryBuilder('rate')
      .where('rate.from_currency = :from', { from: from.toUpperCase() })
      .andWhere('rate.to_currency = :to', { to: to.toUpperCase() })
      .andWhere('rate.date = :date', { date: new Date(dateStr) })
      .getOne();
  }

  /**
   * 获取日期范围内的汇率
   */
  async getRatesInRange(
    from: string,
    to: string,
    fromDate: Date,
    toDate: Date
  ): Promise<ExchangeRate[]> {
    return this.rateRepository
      .createQueryBuilder('rate')
      .where('rate.from_currency = :from', { from: from.toUpperCase() })
      .andWhere('rate.to_currency = :to', { to: to.toUpperCase() })
      .andWhere('rate.date >= :fromDate', { fromDate })
      .andWhere('rate.date <= :toDate', { toDate })
      .orderBy('rate.date', 'ASC')
      .getMany();
  }

  // ==================== 历史记录 ====================

  /**
   * 写入历史记录 (永久保留)
   */
  async writeHistory(
    from: string,
    to: string,
    rate: number,
    date: Date,
    providerId: string,
    isInferred: boolean = false,
    hops?: number,
    path?: string[]
  ): Promise<RateHistory> {
    const history = this.historyRepository.create({
      fromCurrency: from.toUpperCase(),
      toCurrency: to.toUpperCase(),
      rate,
      date: new Date(date.toISOString().split('T')[0]),
      providerId,
      isInferred,
      hops,
      path,
    });

    return this.historyRepository.save(history);
  }

  /**
   * 获取历史记录
   */
  async getHistory(
    from: string,
    to: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    }
  ): Promise<{ rates: RateHistory[]; total: number }> {
    const { fromDate, toDate, limit = 100 } = options;

    const query = this.historyRepository
      .createQueryBuilder('history')
      .where('history.from_currency = :from', { from: from.toUpperCase() })
      .andWhere('history.to_currency = :to', { to: to.toUpperCase() });

    if (fromDate) {
      query.andWhere('history.date >= :fromDate', { fromDate });
    }

    if (toDate) {
      query.andWhere('history.date <= :toDate', { toDate });
    }

    const [rates, total] = await query
      .orderBy('history.date', 'DESC')
      .take(limit)
      .getManyAndCount();

    return { rates, total };
  }

  /**
   * 获取历史统计 (按日期聚合)
   */
  async getHistoryStats(
    from: string,
    to: string,
    fromDate: Date,
    toDate: Date
  ): Promise<{
    avgRate: number;
    minRate: number;
    maxRate: number;
    sampleCount: number;
  }> {
    const result = await this.historyRepository
      .createQueryBuilder('history')
      .select('AVG(history.rate)', 'avgRate')
      .addSelect('MIN(history.rate)', 'minRate')
      .addSelect('MAX(history.rate)', 'maxRate')
      .addSelect('COUNT(*)', 'sampleCount')
      .where('history.from_currency = :from', { from: from.toUpperCase() })
      .andWhere('history.to_currency = :to', { to: to.toUpperCase() })
      .andWhere('history.date >= :fromDate', { fromDate })
      .andWhere('history.date <= :toDate', { toDate })
      .getRawOne();

    return {
      avgRate: Number(result.avgRate) || 0,
      minRate: Number(result.minRate) || 0,
      maxRate: Number(result.maxRate) || 0,
      sampleCount: Number(result.sampleCount) || 0,
    };
  }

  // ==================== Provider 管理 ====================

  /**
   * 获取所有启用的 Providers
   */
  async getEnabledProviders(): Promise<Provider[]> {
    return this.providerRepository.find({
      where: { is_active: true },
      order: { priority: 'ASC' },
    });
  }

  /**
   * 获取指定 Provider
   */
  async getProvider(id: string): Promise<Provider | null> {
    return this.providerRepository.findOne({ where: { id } });
  }

  // ==================== 监控统计 ====================

  /**
   * 保存统计
   */
  async saveStats(stats: RateStats): Promise<RateStats> {
    return this.statsRepository.save(stats);
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
      .orderBy('stats.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * 清理旧统计 (保留 30 天)
   */
  async cleanupOldStats(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await this.statsRepository
      .createQueryBuilder('stats')
      .delete()
      .where('stats.date < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  // ==================== 维护 ====================

  /**
   * 清理过期缓存 (exchange_rates)
   * 保留 7 天的缓存数据
   */
  async cleanupExpiredRates(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const result = await this.rateRepository
      .createQueryBuilder('rate')
      .delete()
      .where('rate.date < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
